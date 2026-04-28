from typing import Any

from contracts import NormalizedBusiness
from ingestion.google_places.errors import GoogleInvalidResponseError
from normalization.business import normalize_google_place as normalize_google_place_canonical


def normalize_google_place(
    place: dict[str, Any],
    geocoding_response: dict[str, Any] | None,
) -> NormalizedBusiness:
    try:
        return normalize_google_place_canonical(place, geocoding_response)
    except ValueError as error:
        if "name is required" in str(error):
            raise GoogleInvalidResponseError(
                "Google Places payload is missing displayName.text"
            ) from error
        raise
