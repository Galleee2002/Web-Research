import json

import httpx
import pytest

from ingestion.google_places.adapter import extract_places, has_geocoding_results
from ingestion.google_places.client import GooglePlacesClient
from ingestion.google_places.errors import (
    GoogleCredentialsError,
    GoogleGeocodingStatusError,
    GoogleInvalidResponseError,
    GoogleRateLimitError,
    GoogleRequestError,
)
from ingestion.google_places.geocoding import GoogleGeocodingClient


class RecordingQuota:
    def __init__(self):
        self.providers: list[str] = []

    def reserve(self, provider: str) -> None:
        self.providers.append(provider)


def test_places_search_uses_text_search_new_endpoint_and_field_mask():
    quota = RecordingQuota()
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        captured["headers"] = request.headers
        captured["body"] = json.loads(request.content)
        return httpx.Response(
            200,
            json={
                "places": [
                    {
                        "id": "place-1",
                        "displayName": {"text": "Clinica Demo"},
                    }
                ]
            },
        )

    client = GooglePlacesClient(
        api_key="test-key",
        quota=quota,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    response = client.search_text("dentistas", "Buenos Aires")

    assert captured["url"] == "https://places.googleapis.com/v1/places:searchText"
    assert captured["headers"]["X-Goog-Api-Key"] == "test-key"
    assert "places.id" in captured["headers"]["X-Goog-FieldMask"]
    assert "places.websiteUri" in captured["headers"]["X-Goog-FieldMask"]
    assert captured["body"] == {
        "textQuery": "dentistas in Buenos Aires",
        "pageSize": 20,
    }
    assert extract_places(response) == [
        {"id": "place-1", "displayName": {"text": "Clinica Demo"}}
    ]
    assert quota.providers == ["places"]


def test_places_search_sends_page_token_when_requested():
    quota = RecordingQuota()
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"places": []})

    client = GooglePlacesClient(
        api_key="test-key",
        quota=quota,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    client.search_text("dentistas", "Buenos Aires", page_token="next-page-token")

    assert captured["body"] == {
        "textQuery": "dentistas in Buenos Aires",
        "pageSize": 20,
        "pageToken": "next-page-token",
    }


def test_places_search_requires_api_key():
    client = GooglePlacesClient(api_key=None, quota=RecordingQuota())

    with pytest.raises(GoogleCredentialsError, match="GOOGLE_PLACES_API_KEY"):
        client.search_text("dentistas", "Buenos Aires")


def test_places_search_maps_rate_limit_and_server_errors():
    rate_limited = GooglePlacesClient(
        api_key="test-key",
        quota=RecordingQuota(),
        http_client=httpx.Client(
            transport=httpx.MockTransport(
                lambda _request: httpx.Response(429, json={"error": {"message": "quota"}})
            )
        ),
    )

    with pytest.raises(GoogleRateLimitError):
        rate_limited.search_text("dentistas", "Buenos Aires")

    server_error = GooglePlacesClient(
        api_key="test-key",
        quota=RecordingQuota(),
        http_client=httpx.Client(
            transport=httpx.MockTransport(lambda _request: httpx.Response(503))
        ),
    )

    with pytest.raises(GoogleRequestError, match="503"):
        server_error.search_text("dentistas", "Buenos Aires")


def test_places_search_rejects_invalid_json_response():
    client = GooglePlacesClient(
        api_key="test-key",
        quota=RecordingQuota(),
        http_client=httpx.Client(
            transport=httpx.MockTransport(
                lambda _request: httpx.Response(200, content=b"not-json")
            )
        ),
    )

    with pytest.raises(GoogleInvalidResponseError):
        client.search_text("dentistas", "Buenos Aires")


def test_geocoding_client_uses_address_key_and_returns_ok_payload():
    quota = RecordingQuota()
    captured = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["url"] = str(request.url)
        return httpx.Response(
            200,
            json={
                "status": "OK",
                "results": [
                    {
                        "formatted_address": "Buenos Aires, Argentina",
                        "geometry": {"location": {"lat": -34.6037, "lng": -58.3816}},
                    }
                ],
            },
        )

    client = GoogleGeocodingClient(
        api_key="geo-key",
        quota=quota,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )

    response = client.geocode("Buenos Aires")

    assert captured["url"].startswith("https://maps.googleapis.com/maps/api/geocode/json")
    assert "address=Buenos+Areas" not in captured["url"]
    assert "address=Buenos+Aires" in captured["url"]
    assert "key=geo-key" in captured["url"]
    assert has_geocoding_results(response) is True
    assert quota.providers == ["geocoding"]


def test_geocoding_zero_results_returns_empty_results():
    client = GoogleGeocodingClient(
        api_key="geo-key",
        quota=RecordingQuota(),
        http_client=httpx.Client(
            transport=httpx.MockTransport(
                lambda _request: httpx.Response(
                    200,
                    json={"status": "ZERO_RESULTS", "results": []},
                )
            )
        ),
    )

    response = client.geocode("No results")

    assert response == {"status": "ZERO_RESULTS", "results": []}
    assert has_geocoding_results(response) is False


def test_geocoding_rejects_provider_error_status():
    client = GoogleGeocodingClient(
        api_key="geo-key",
        quota=RecordingQuota(),
        http_client=httpx.Client(
            transport=httpx.MockTransport(
                lambda _request: httpx.Response(
                    200,
                    json={"status": "OVER_QUERY_LIMIT", "error_message": "quota"},
                )
            )
        ),
    )

    with pytest.raises(GoogleGeocodingStatusError, match="OVER_QUERY_LIMIT"):
        client.geocode("Buenos Aires")
