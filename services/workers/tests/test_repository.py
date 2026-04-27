from contracts import NormalizedBusiness
from workers.repository import WorkerRepository, normalize_dedupe_text


def test_normalize_dedupe_text_collapses_case_spacing_and_punctuation():
    assert normalize_dedupe_text(" Clinica  Demo, S.R.L. ") == "clinicademosrl"


def test_normalize_dedupe_text_removes_diacritics():
    assert normalize_dedupe_text("Clínica Démo") == "clinicademo"


def test_repository_merge_payload_preserves_manual_fields_and_fills_missing_data():
    repository = WorkerRepository("postgres://unused")
    existing = {
        "id": "business-1",
        "external_id": None,
        "category": None,
        "address": "Av. Siempre Viva 123",
        "city": None,
        "region": None,
        "country": None,
        "lat": None,
        "lng": None,
        "phone": None,
        "website": None,
        "has_website": False,
        "maps_url": None,
        "status": "contacted",
        "notes": "Llamar el lunes",
        "search_run_id": "search-old",
    }
    incoming = NormalizedBusiness(
        external_id="place-1",
        name="Clinica Demo",
        category="Dentist",
        address="Av. Siempre Viva 123",
        city="Buenos Aires",
        region="CABA",
        country="Argentina",
        lat=-34.6037,
        lng=-58.3816,
        phone="011 5555 1234",
        website="https://clinicademo.com",
        has_website=True,
        maps_url="https://maps.google.com/?cid=123",
    )

    payload = repository._build_merge_payload(existing, incoming)

    assert payload["id"] == "business-1"
    assert payload["external_id"] == "place-1"
    assert payload["category"] == "Dentist"
    assert payload["city"] == "Buenos Aires"
    assert payload["region"] == "CABA"
    assert payload["country"] == "Argentina"
    assert payload["lat"] == -34.6037
    assert payload["lng"] == -58.3816
    assert payload["phone"] == "011 5555 1234"
    assert payload["website"] == "https://clinicademo.com"
    assert payload["has_website"] is True
    assert payload["maps_url"] == "https://maps.google.com/?cid=123"


def test_find_existing_business_returns_name_address_strategy_when_external_id_missing():
    repository = WorkerRepository("postgres://unused")

    class FakeResult:
        def __init__(self, row):
            self.row = row

        def fetchone(self):
            return self.row

    class FakeConnection:
        def __init__(self):
            self.calls = 0

        def execute(self, *_args, **_kwargs):
            self.calls += 1
            if self.calls == 1:
                return FakeResult(None)
            return FakeResult({"id": "business-1"})

    existing, dedupe_strategy = repository._find_existing_business(
        FakeConnection(),
        NormalizedBusiness(
            external_id="place-1",
            name="Clinica Demo",
            category="Dentist",
            address="Av. Siempre Viva 123",
            city="Buenos Aires",
            region="CABA",
            country="Argentina",
            lat=-34.6037,
            lng=-58.3816,
            phone="011 5555 1234",
            website=None,
            has_website=False,
            maps_url=None,
        ),
    )

    assert existing == {"id": "business-1"}
    assert dedupe_strategy == "name_address"


def test_find_existing_business_does_not_name_address_match_existing_external_id():
    repository = WorkerRepository("postgres://unused")

    class FakeResult:
        def __init__(self, row):
            self.row = row

        def fetchone(self):
            return self.row

    class FakeConnection:
        def __init__(self):
            self.calls = 0

        def execute(self, sql, *_args, **_kwargs):
            self.calls += 1
            if self.calls == 1:
                return FakeResult(None)
            if "external_id is null" in sql:
                return FakeResult(None)
            return FakeResult({"id": "business-1", "external_id": "place-other"})

    existing, dedupe_strategy = repository._find_existing_business(
        FakeConnection(),
        NormalizedBusiness(
            external_id="place-1",
            name="Clinica Demo",
            category="Dentist",
            address="Av. Siempre Viva 123",
            city="Buenos Aires",
            region="CABA",
            country="Argentina",
            lat=-34.6037,
            lng=-58.3816,
            phone="011 5555 1234",
            website=None,
            has_website=False,
            maps_url=None,
        ),
    )

    assert existing is None
    assert dedupe_strategy is None


def test_ensure_opportunity_inserts_placeholder_row_only_for_businesses_without_website():
    repository = WorkerRepository("postgres://unused")

    class FakeConnection:
        def __init__(self):
            self.calls = []

        def execute(self, query, params):
            self.calls.append((query, params))

    connection = FakeConnection()

    repository._ensure_opportunity(connection, "business-1", False)
    repository._ensure_opportunity(connection, "business-2", True)

    assert len(connection.calls) == 1
    query, params = connection.calls[0]
    assert "insert into opportunities" in query
    assert "is_selected" in query
    assert "false" in query
    assert "on conflict (business_id) do nothing" in query
    assert params == ("business-1",)
