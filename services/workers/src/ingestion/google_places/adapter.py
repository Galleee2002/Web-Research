from typing import Any

from .errors import GoogleInvalidResponseError


def extract_places(response: dict[str, Any]) -> list[dict[str, Any]]:
    places = response.get("places", [])
    if not isinstance(places, list):
        raise GoogleInvalidResponseError("Google Places response field 'places' must be a list")

    return [place for place in places if isinstance(place, dict)]


def has_geocoding_results(response: dict[str, Any]) -> bool:
    results = response.get("results", [])
    return isinstance(results, list) and len(results) > 0
