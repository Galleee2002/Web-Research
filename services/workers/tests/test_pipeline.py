from dataclasses import dataclass

from contracts import NormalizedBusiness
from ingestion.google_places.errors import GoogleRequestError
from workers.models import SearchRun, UpsertResult
from workers.pipeline import WorkerPipeline


class FakeSearchRepository:
    def __init__(self, search_run: SearchRun | None):
        self._search_run = search_run
        self.persisted_search_run_id: str | None = None
        self.persisted_businesses: list[NormalizedBusiness] = []
        self.persisted_total_found: int | None = None
        self.persisted_observability: dict | None = None
        self.failed_search_run_id: str | None = None
        self.failed_error_message: str | None = None
        self.failed_error_code: str | None = None
        self.failed_error_stage: str | None = None

    def claim_next_pending_search_run(self) -> SearchRun | None:
        search_run = self._search_run
        self._search_run = None
        return search_run

    def persist_search_run_results(
        self,
        search_run: SearchRun,
        businesses: list[NormalizedBusiness],
        total_found: int,
        observability: dict,
    ) -> list[UpsertResult]:
        self.persisted_search_run_id = search_run.id
        self.persisted_businesses = businesses
        self.persisted_total_found = total_found
        self.persisted_observability = observability
        return [
            UpsertResult(action="inserted", business_id=f"business-{index + 1}")
            for index, _business in enumerate(businesses)
        ]

    def mark_search_run_failed(
        self,
        search_run: SearchRun,
        error_message: str,
        error_code: str,
        error_stage: str,
        observability: dict,
    ) -> None:
        self.failed_search_run_id = search_run.id
        self.failed_error_message = error_message
        self.failed_error_code = error_code
        self.failed_error_stage = error_stage
        self.persisted_observability = observability


@dataclass
class FakePlacesClient:
    response: dict

    def search_text(self, query: str, location: str) -> dict:
        self.last_query = query
        self.last_location = location
        return self.response


@dataclass
class FakePlacesClientFailure:
    error: Exception

    def search_text(self, query: str, location: str) -> dict:
        raise self.error


class FakeGeocodingClient:
    def __init__(self, response: dict):
        self.response = response
        self.calls: list[str] = []

    def geocode(self, address_or_location: str) -> dict:
        self.calls.append(address_or_location)
        return self.response


def build_search_run() -> SearchRun:
    return SearchRun(
        id="search-1",
        query="dentistas",
        location="Buenos Aires",
        source="google_places",
        correlation_id="corr-1",
        status="processing",
        total_found=0,
    )


def build_geocoding_response() -> dict:
    return {
        "status": "OK",
        "results": [
            {
                "address_components": [
                    {
                        "long_name": "Buenos Aires",
                        "short_name": "Buenos Aires",
                        "types": ["locality", "political"],
                    },
                    {
                        "long_name": "Ciudad Autonoma de Buenos Aires",
                        "short_name": "CABA",
                        "types": ["administrative_area_level_1", "political"],
                    },
                    {
                        "long_name": "Argentina",
                        "short_name": "AR",
                        "types": ["country", "political"],
                    },
                ],
                "geometry": {"location": {"lat": -34.6037, "lng": -58.3816}},
            }
        ],
    }


def test_pipeline_processes_pending_search_run_and_persists_normalized_businesses():
    repository = FakeSearchRepository(build_search_run())
    places_client = FakePlacesClient(
        response={
            "places": [
                {
                    "id": "place-1",
                    "displayName": {"text": "Clinica Demo"},
                    "formattedAddress": "Av. Corrientes 1234, Buenos Aires, Argentina",
                    "primaryTypeDisplayName": {"text": "Dentist"},
                    "nationalPhoneNumber": "011 5555 1234",
                    "websiteUri": "https://clinicademo.com",
                    "googleMapsUri": "https://maps.google.com/?cid=123",
                }
            ]
        }
    )
    geocoding_client = FakeGeocodingClient(response=build_geocoding_response())
    pipeline = WorkerPipeline(
        repository=repository,
        places_client=places_client,
        geocoding_client=geocoding_client,
    )

    result = pipeline.process_next_pending_search_run()

    assert result is not None
    assert result.search_run_id == "search-1"
    assert result.status == "completed"
    assert result.correlation_id == "corr-1"
    assert result.total_found == 1
    assert result.inserted_count == 1
    assert result.updated_count == 0
    assert result.deduped_count == 0
    assert result.geocoding_calls == 1
    assert repository.persisted_search_run_id == "search-1"
    assert repository.persisted_total_found == 1
    assert repository.persisted_observability is not None
    assert repository.persisted_observability["provider"] == "google_places"
    assert len(repository.persisted_businesses) == 1
    business = repository.persisted_businesses[0]
    assert business.external_id == "place-1"
    assert business.name == "Clinica Demo"
    assert business.category == "Dentist"
    assert business.city == "Buenos Aires"
    assert business.region == "Ciudad Autonoma de Buenos Aires"
    assert business.country == "Argentina"
    assert business.lat == -34.6037
    assert business.lng == -58.3816
    assert business.website == "https://clinicademo.com"
    assert business.has_website is True
    assert geocoding_client.calls == ["Av. Corrientes 1234, Buenos Aires, Argentina"]


def test_pipeline_marks_search_run_failed_when_provider_request_fails():
    repository = FakeSearchRepository(build_search_run())
    pipeline = WorkerPipeline(
        repository=repository,
        places_client=FakePlacesClientFailure(
            error=GoogleRequestError("Google Places request failed with status 503")
        ),
        geocoding_client=FakeGeocodingClient(response=build_geocoding_response()),
    )

    result = pipeline.process_next_pending_search_run()

    assert result is not None
    assert result.search_run_id == "search-1"
    assert result.correlation_id == "corr-1"
    assert result.status == "failed"
    assert result.error_message == "Google Places request failed with status 503"
    assert result.error_code == "provider_error"
    assert result.error_stage == "places"
    assert repository.failed_search_run_id == "search-1"
    assert repository.failed_error_message == "Google Places request failed with status 503"
    assert repository.failed_error_code == "provider_error"
    assert repository.failed_error_stage == "places"
    assert repository.persisted_businesses == []
