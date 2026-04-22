from typing import Any

import httpx

from .client import _decode_response
from .errors import (
    GoogleCredentialsError,
    GoogleGeocodingStatusError,
    GoogleTimeoutError,
)

GEOCODING_URL = "https://maps.googleapis.com/maps/api/geocode/json"


class GoogleGeocodingClient:
    def __init__(
        self,
        api_key: str | None,
        quota: Any,
        timeout_seconds: float = 10.0,
        http_client: httpx.Client | None = None,
    ) -> None:
        self.api_key = api_key
        self.quota = quota
        self.timeout_seconds = timeout_seconds
        self.http_client = http_client or httpx.Client(timeout=timeout_seconds)

    def geocode(self, address_or_location: str) -> dict[str, Any]:
        if not self.api_key:
            raise GoogleCredentialsError(
                "GOOGLE_GEOCODING_API_KEY or GOOGLE_PLACES_API_KEY is required"
            )

        self.quota.reserve("geocoding")
        try:
            response = self.http_client.get(
                GEOCODING_URL,
                params={"address": address_or_location, "key": self.api_key},
                timeout=self.timeout_seconds,
            )
        except httpx.TimeoutException as exc:
            raise GoogleTimeoutError("Google Geocoding request timed out") from exc

        data = _decode_response(response, "Google Geocoding")
        status = data.get("status")
        if status in {"OK", "ZERO_RESULTS"}:
            return data

        raise GoogleGeocodingStatusError(
            f"Google Geocoding returned status {status or 'UNKNOWN_ERROR'}"
        )
