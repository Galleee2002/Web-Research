from dataclasses import replace
import os
from uuid import uuid4

import pytest

from contracts import BUSINESS_SOURCE_GOOGLE_PLACES, NormalizedBusiness
from persistence.businesses import (
    BusinessRecord,
    BusinessRepository,
    BusinessUpsertService,
    UpsertBusinessResult,
)


class FakeBusinessRepository:
    def __init__(self) -> None:
        self.records: dict[str, BusinessRecord] = {}
        self.next_id = 1

    def find_by_external_id(
        self,
        source: str,
        external_id: str,
    ) -> BusinessRecord | None:
        return next(
            (
                record
                for record in self.records.values()
                if record.source == source and record.external_id == external_id
            ),
            None,
        )

    def find_by_name_address(
        self,
        source: str,
        name_key: str,
        address_key: str,
    ) -> BusinessRecord | None:
        from persistence.dedup import canonicalize_dedup_text

        return next(
            (
                record
                for record in self.records.values()
                if record.source == source
                and record.external_id is None
                and canonicalize_dedup_text(record.name) == name_key
                and canonicalize_dedup_text(record.address) == address_key
            ),
            None,
        )

    def insert_business(
        self,
        business: NormalizedBusiness,
        search_run_id: str | None,
    ) -> BusinessRecord:
        record = BusinessRecord(
            id=f"business-{self.next_id}",
            search_run_id=search_run_id,
            external_id=business.external_id,
            source=business.source,
            name=business.name,
            category=business.category,
            address=business.address,
            city=business.city,
            region=business.region,
            country=business.country,
            lat=business.lat,
            lng=business.lng,
            phone=business.phone,
            website=business.website,
            has_website=business.has_website,
            maps_url=business.maps_url,
            status="new",
            notes=None,
        )
        self.records[record.id] = record
        self.next_id += 1
        return record

    def update_business(
        self,
        record_id: str,
        fields: dict[str, object],
    ) -> BusinessRecord:
        record = self.records[record_id]
        updated = replace(record, **fields)
        self.records[record_id] = updated
        return updated


def make_business(**overrides: object) -> NormalizedBusiness:
    values = {
        "name": "Clinica Dental Centro",
        "source": BUSINESS_SOURCE_GOOGLE_PLACES,
        "external_id": "places/clinica-dental-centro",
        "category": "Dentist",
        "address": "Av. Santa Fe 1234, Buenos Aires",
        "city": None,
        "region": None,
        "country": None,
        "lat": None,
        "lng": None,
        "phone": None,
        "website": None,
        "has_website": False,
        "maps_url": None,
    }
    values.update(overrides)
    return NormalizedBusiness(**values)


def upsert(
    repository: FakeBusinessRepository,
    business: NormalizedBusiness,
    search_run_id: str | None = None,
) -> UpsertBusinessResult:
    return BusinessUpsertService(repository).upsert_business(business, search_run_id)


def test_upsert_by_external_id_is_idempotent():
    repository = FakeBusinessRepository()
    business = make_business(phone="+54 11 4567-8901")

    first = upsert(repository, business)
    second = upsert(repository, make_business(phone="+54 11 4567-8901"))

    assert first.created is True
    assert second.created is False
    assert second.matched_by == "external_id"
    assert len(repository.records) == 1


def test_upsert_falls_back_to_normalized_name_and_address_without_external_id():
    repository = FakeBusinessRepository()
    first_business = make_business(
        external_id=None,
        name="Clínica Dental Centro",
        address="Av. Santa Fe 1234, Buenos Aires",
    )
    duplicate_business = make_business(
        external_id=None,
        name=" clinica   dental centro ",
        address="Av Santa Fe 1234 Buenos Aires",
    )

    first = upsert(repository, first_business)
    second = upsert(repository, duplicate_business)

    assert first.created is True
    assert second.created is False
    assert second.matched_by == "name_address"
    assert len(repository.records) == 1


def test_upsert_fallback_completes_missing_external_id():
    repository = FakeBusinessRepository()
    first = upsert(repository, make_business(external_id=None))

    second = upsert(
        repository,
        make_business(external_id="places/clinica-dental-centro"),
    )

    record = repository.records[first.business_id]
    assert second.created is False
    assert second.matched_by == "name_address"
    assert second.merged_fields == ["external_id"]
    assert record.external_id == "places/clinica-dental-centro"
    assert len(repository.records) == 1


def test_upsert_merges_missing_fields_only():
    repository = FakeBusinessRepository()
    upsert(repository, make_business(phone=None, website=None, has_website=False))

    result = upsert(
        repository,
        make_business(
            phone="+54 11 4567-8901",
            website="https://clinicadentalcentro.example",
            has_website=True,
            maps_url="https://maps.google.com/?cid=123",
        ),
    )

    record = repository.records[result.business_id]
    assert result.created is False
    assert result.merged_fields == ["phone", "website", "maps_url"]
    assert record.phone == "+54 11 4567-8901"
    assert record.website == "https://clinicadentalcentro.example"
    assert record.has_website is True
    assert record.maps_url == "https://maps.google.com/?cid=123"


def test_upsert_preserves_manual_status_and_notes():
    repository = FakeBusinessRepository()
    result = upsert(repository, make_business(phone=None))
    repository.records[result.business_id] = replace(
        repository.records[result.business_id],
        status="contacted",
        notes="Already called.",
    )

    upsert(repository, make_business(phone="+54 11 4567-8901"))

    record = repository.records[result.business_id]
    assert record.status == "contacted"
    assert record.notes == "Already called."
    assert record.phone == "+54 11 4567-8901"


def test_upsert_does_not_merge_name_address_match_with_different_external_id():
    repository = FakeBusinessRepository()
    upsert(repository, make_business(external_id="places/original"))

    result = upsert(repository, make_business(external_id="places/other"))

    assert result.created is True
    assert result.matched_by == "none"
    assert len(repository.records) == 2


@pytest.mark.skipif(
    not os.environ.get("DATABASE_URL"),
    reason="DATABASE_URL is required for PostgreSQL integration coverage",
)
def test_postgres_upsert_uses_partial_unique_external_id_index():
    from psycopg import connect

    external_id = f"places/test-{uuid4()}"
    database_url = os.environ["DATABASE_URL"]

    with connect(database_url) as connection:
        try:
            repository = BusinessRepository(connection)
            service = BusinessUpsertService(repository)
            first = service.upsert_business(make_business(external_id=external_id))
            second = service.upsert_business(make_business(external_id=external_id))

            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    select count(*)::int
                    from businesses
                    where source = %s and external_id = %s
                    """,
                    (BUSINESS_SOURCE_GOOGLE_PLACES, external_id),
                )
                count = cursor.fetchone()[0]

            assert first.created is True
            assert second.created is False
            assert second.matched_by == "external_id"
            assert count == 1
        finally:
            with connection.cursor() as cursor:
                cursor.execute(
                    "delete from businesses where source = %s and external_id = %s",
                    (BUSINESS_SOURCE_GOOGLE_PLACES, external_id),
                )
