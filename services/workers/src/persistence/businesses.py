from dataclasses import dataclass
import logging
from typing import Literal, Protocol

from contracts import NormalizedBusiness, validate_normalized_business
from persistence.dedup import canonicalize_dedup_text, fallback_dedup_key

logger = logging.getLogger(__name__)

MatchedBy = Literal["external_id", "name_address", "none"]

BUSINESS_COLUMNS = """
  id,
  search_run_id,
  external_id,
  source,
  name,
  category,
  address,
  city,
  region,
  country,
  lat,
  lng,
  phone,
  website,
  has_website,
  maps_url,
  status,
  notes
"""

MERGE_FIELDS = (
    "phone",
    "website",
    "maps_url",
    "category",
    "city",
    "region",
    "country",
    "lat",
    "lng",
    "external_id",
    "search_run_id",
)


@dataclass(frozen=True, slots=True)
class BusinessRecord:
    id: str
    search_run_id: str | None
    external_id: str | None
    source: str
    name: str
    category: str | None
    address: str | None
    city: str | None
    region: str | None
    country: str | None
    lat: float | None
    lng: float | None
    phone: str | None
    website: str | None
    has_website: bool
    maps_url: str | None
    status: str
    notes: str | None


@dataclass(frozen=True, slots=True)
class UpsertBusinessResult:
    business_id: str
    created: bool
    matched_by: MatchedBy
    merged_fields: list[str]


class BusinessRepositoryProtocol(Protocol):
    def find_by_external_id(
        self,
        source: str,
        external_id: str,
    ) -> BusinessRecord | None:
        ...

    def find_by_name_address(
        self,
        source: str,
        name_key: str,
        address_key: str,
    ) -> BusinessRecord | None:
        ...

    def insert_business(
        self,
        business: NormalizedBusiness,
        search_run_id: str | None,
    ) -> BusinessRecord:
        ...

    def update_business(
        self,
        record_id: str,
        fields: dict[str, object],
    ) -> BusinessRecord:
        ...


class BusinessRepository:
    def __init__(self, connection: object) -> None:
        self.connection = connection

    def find_by_external_id(
        self,
        source: str,
        external_id: str,
    ) -> BusinessRecord | None:
        row = self._fetch_one(
            f"""
            select {BUSINESS_COLUMNS}
            from businesses
            where source = %s and external_id = %s
            limit 1
            """,
            (source, external_id),
        )
        return _row_to_record(row)

    def find_by_name_address(
        self,
        source: str,
        name_key: str,
        address_key: str,
    ) -> BusinessRecord | None:
        rows = self._fetch_all(
            f"""
            select {BUSINESS_COLUMNS}
            from businesses
            where source = %s
              and external_id is null
              and address is not null
            order by created_at asc
            """,
            (source,),
        )

        for row in rows:
            record = _row_to_record(row)
            if record is None:
                continue
            if (
                canonicalize_dedup_text(record.name) == name_key
                and canonicalize_dedup_text(record.address) == address_key
            ):
                return record

        return None

    def insert_business(
        self,
        business: NormalizedBusiness,
        search_run_id: str | None,
    ) -> BusinessRecord:
        row = self._fetch_one(
            f"""
            insert into businesses (
              search_run_id,
              external_id,
              source,
              name,
              category,
              address,
              city,
              region,
              country,
              lat,
              lng,
              phone,
              website,
              has_website,
              maps_url
            )
            values (
              %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            returning {BUSINESS_COLUMNS}
            """,
            (
                search_run_id,
                business.external_id,
                business.source,
                business.name,
                business.category,
                business.address,
                business.city,
                business.region,
                business.country,
                business.lat,
                business.lng,
                business.phone,
                business.website,
                business.has_website,
                business.maps_url,
            ),
        )
        record = _row_to_record(row)
        if record is None:
            raise RuntimeError("business insert did not return a row")
        return record

    def update_business(
        self,
        record_id: str,
        fields: dict[str, object],
    ) -> BusinessRecord:
        if not fields:
            row = self._fetch_one(
                f"""
                select {BUSINESS_COLUMNS}
                from businesses
                where id = %s
                limit 1
                """,
                (record_id,),
            )
            record = _row_to_record(row)
            if record is None:
                raise RuntimeError(f"business not found for update: {record_id}")
            return record

        assignments = ", ".join(f"{field} = %s" for field in fields)
        values = [*fields.values(), record_id]
        row = self._fetch_one(
            f"""
            update businesses
            set {assignments}, updated_at = now()
            where id = %s
            returning {BUSINESS_COLUMNS}
            """,
            tuple(values),
        )
        record = _row_to_record(row)
        if record is None:
            raise RuntimeError(f"business not found for update: {record_id}")
        return record

    def _fetch_one(self, sql: str, params: tuple[object, ...]) -> object | None:
        from psycopg.rows import dict_row

        with self.connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(sql, params)
            return cursor.fetchone()

    def _fetch_all(self, sql: str, params: tuple[object, ...]) -> list[object]:
        from psycopg.rows import dict_row

        with self.connection.cursor(row_factory=dict_row) as cursor:
            cursor.execute(sql, params)
            return list(cursor.fetchall())


class BusinessUpsertService:
    def __init__(self, repository: BusinessRepositoryProtocol) -> None:
        self.repository = repository

    def upsert_business(
        self,
        business: NormalizedBusiness,
        search_run_id: str | None = None,
    ) -> UpsertBusinessResult:
        business = validate_normalized_business(business)
        match, matched_by = self._find_match(business)

        if match is None:
            inserted = self.repository.insert_business(business, search_run_id)
            return UpsertBusinessResult(
                business_id=inserted.id,
                created=True,
                matched_by="none",
                merged_fields=[],
            )

        merge_fields = _merge_fields(match, business, search_run_id)
        updated = self.repository.update_business(match.id, merge_fields)
        merged_fields = [
            field for field in merge_fields if field in MERGE_FIELDS
        ]

        logger.info(
            "duplicate business detected",
            extra={
                "matched_by": matched_by,
                "source": business.source,
                "external_id": business.external_id,
                "name_key": canonicalize_dedup_text(business.name),
            },
        )
        return UpsertBusinessResult(
            business_id=updated.id,
            created=False,
            matched_by=matched_by,
            merged_fields=merged_fields,
        )

    def _find_match(
        self,
        business: NormalizedBusiness,
    ) -> tuple[BusinessRecord | None, MatchedBy]:
        if business.external_id is not None:
            match = self.repository.find_by_external_id(
                business.source,
                business.external_id,
            )
            if match is not None:
                return match, "external_id"

        fallback_key = fallback_dedup_key(business)
        if fallback_key is None:
            return None, "none"

        match = self.repository.find_by_name_address(
            business.source,
            fallback_key[0],
            fallback_key[1],
        )
        if match is not None:
            return match, "name_address"

        return None, "none"


def upsert_business(
    business: NormalizedBusiness,
    search_run_id: str | None = None,
) -> UpsertBusinessResult:
    from psycopg import connect
    from workers.config.settings import WorkerSettings

    settings = WorkerSettings()
    if settings.database_url is None:
        raise RuntimeError("DATABASE_URL is required to persist businesses")

    with connect(settings.database_url) as connection:
        repository = BusinessRepository(connection)
        return BusinessUpsertService(repository).upsert_business(
            business,
            search_run_id,
        )


def _merge_fields(
    existing: BusinessRecord,
    incoming: NormalizedBusiness,
    search_run_id: str | None,
) -> dict[str, object]:
    fields: dict[str, object] = {}
    incoming_values = {
        "phone": incoming.phone,
        "website": incoming.website,
        "maps_url": incoming.maps_url,
        "category": incoming.category,
        "city": incoming.city,
        "region": incoming.region,
        "country": incoming.country,
        "lat": incoming.lat,
        "lng": incoming.lng,
        "external_id": incoming.external_id,
        "search_run_id": search_run_id,
    }

    for field in MERGE_FIELDS:
        current_value = getattr(existing, field)
        incoming_value = incoming_values[field]
        if _is_empty(current_value) and not _is_empty(incoming_value):
            fields[field] = incoming_value

    if "website" in fields:
        fields["has_website"] = incoming.has_website

    return fields


def _is_empty(value: object) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    return False


def _row_to_record(row: object | None) -> BusinessRecord | None:
    if row is None:
        return None

    return BusinessRecord(
        id=str(row["id"]),
        search_run_id=_optional_str(row["search_run_id"]),
        external_id=_optional_str(row["external_id"]),
        source=str(row["source"]),
        name=str(row["name"]),
        category=_optional_str(row["category"]),
        address=_optional_str(row["address"]),
        city=_optional_str(row["city"]),
        region=_optional_str(row["region"]),
        country=_optional_str(row["country"]),
        lat=_optional_float(row["lat"]),
        lng=_optional_float(row["lng"]),
        phone=_optional_str(row["phone"]),
        website=_optional_str(row["website"]),
        has_website=bool(row["has_website"]),
        maps_url=_optional_str(row["maps_url"]),
        status=str(row["status"]),
        notes=_optional_str(row["notes"]),
    )


def _optional_str(value: object) -> str | None:
    return None if value is None else str(value)


def _optional_float(value: object) -> float | None:
    return None if value is None else float(value)
