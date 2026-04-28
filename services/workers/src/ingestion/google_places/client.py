from typing import Any

import httpx

from .errors import (
    GoogleCredentialsError,
    GoogleInvalidResponseError,
    GoogleRateLimitError,
    GoogleRequestError,
    GoogleTimeoutError,
)

PLACES_TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText"
DEFAULT_TEXT_SEARCH_PAGE_SIZE = 20

DEFAULT_PLACES_FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.primaryType",
        "places.primaryTypeDisplayName",
        "places.types",
        "places.location",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.websiteUri",
        "places.googleMapsUri",
        "nextPageToken",
    ]
)


class GooglePlacesClient:
    def __init__(
        self,
        api_key: str | None,
        quota: Any,
        timeout_seconds: float = 10.0,
        http_client: httpx.Client | None = None,
        field_mask: str = DEFAULT_PLACES_FIELD_MASK,
    ) -> None:
        self.api_key = api_key
        self.quota = quota
        self.timeout_seconds = timeout_seconds
        self.http_client = http_client or httpx.Client(timeout=timeout_seconds)
        self.field_mask = field_mask

    def search_text(
        self,
        query: str,
        location: str,
        page_token: str | None = None,
    ) -> dict[str, Any]:
        if not self.api_key:
            raise GoogleCredentialsError("GOOGLE_PLACES_API_KEY is required")

        self.quota.reserve("places")
        payload: dict[str, Any] = {
            "textQuery": f"{query} in {location}",
            "pageSize": DEFAULT_TEXT_SEARCH_PAGE_SIZE,
        }
        if isinstance(page_token, str) and page_token.strip():
            payload["pageToken"] = page_token

        try:
            response = self.http_client.post(
                PLACES_TEXT_SEARCH_URL,
                headers={
                    "X-Goog-Api-Key": self.api_key,
                    "X-Goog-FieldMask": self.field_mask,
                },
                json=payload,
                timeout=self.timeout_seconds,
            )
        except httpx.TimeoutException as exc:
            raise GoogleTimeoutError("Google Places request timed out") from exc

        return _decode_response(response, "Google Places")


def _decode_response(response: httpx.Response, provider_name: str) -> dict[str, Any]:
    if response.status_code == 429:
        raise GoogleRateLimitError(f"{provider_name} rate limit exceeded")

    if response.status_code >= 400:
        raise GoogleRequestError(
            f"{provider_name} request failed with status {response.status_code}"
        )

    try:
        data = response.json()
    except ValueError as exc:
        raise GoogleInvalidResponseError(f"{provider_name} returned invalid JSON") from exc

    if not isinstance(data, dict):
        raise GoogleInvalidResponseError(f"{provider_name} returned an invalid payload")

    return data
