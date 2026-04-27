from typing import Any
from urllib.parse import urlsplit

from contracts import NormalizedBusiness, validate_normalized_business
from normalization.website_detection import detect_own_website


def normalize_google_place(
    raw_place: dict[str, Any],
    geocoding_result: dict[str, Any] | None = None,
) -> NormalizedBusiness:
    name = _nested_text(raw_place, "displayName", "text")
    if name is None:
        raise ValueError("name is required")

    place_lat, place_lng = _place_coordinates(raw_place)
    geocoding_components = _geocoding_components(geocoding_result)
    geocoding_lat, geocoding_lng = _geocoding_coordinates(geocoding_result)
    detected_website = detect_own_website(_optional_text(raw_place.get("websiteUri")))

    business = NormalizedBusiness(
        external_id=_optional_text(raw_place.get("id")),
        name=name,
        category=_category(raw_place),
        address=_optional_text(raw_place.get("formattedAddress")),
        city=_component_value(geocoding_components, "locality"),
        region=_component_value(geocoding_components, "administrative_area_level_1"),
        country=_component_value(geocoding_components, "country"),
        lat=place_lat if place_lat is not None else geocoding_lat,
        lng=place_lng if place_lng is not None else geocoding_lng,
        phone=_optional_text(
            raw_place.get("internationalPhoneNumber")
            or raw_place.get("nationalPhoneNumber")
        ),
        website=detected_website.website,
        maps_url=_optional_http_url(raw_place.get("googleMapsUri")),
        has_website=detected_website.has_website,
    )

    return validate_normalized_business(business)


def _optional_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None

    stripped = value.strip()
    return stripped or None


def _optional_http_url(value: Any) -> str | None:
    text = _optional_text(value)
    if text is None:
        return None

    try:
        parsed = urlsplit(text)
    except ValueError:
        return None

    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None

    return text


def _nested_text(payload: dict[str, Any], *path: str) -> str | None:
    value: Any = payload
    for key in path:
        if not isinstance(value, dict):
            return None
        value = value.get(key)

    return _optional_text(value)


def _category(raw_place: dict[str, Any]) -> str | None:
    return _nested_text(raw_place, "primaryTypeDisplayName", "text") or _optional_text(
        raw_place.get("primaryType")
    )


def _place_coordinates(raw_place: dict[str, Any]) -> tuple[float | None, float | None]:
    location = raw_place.get("location")
    if not isinstance(location, dict):
        return None, None

    return _number(location.get("latitude")), _number(location.get("longitude"))


def _geocoding_coordinates(
    geocoding_result: dict[str, Any] | None,
) -> tuple[float | None, float | None]:
    first_result = _first_geocoding_result(geocoding_result)
    if first_result is None:
        return None, None

    geometry = first_result.get("geometry")
    if not isinstance(geometry, dict):
        return None, None

    location = geometry.get("location")
    if not isinstance(location, dict):
        return None, None

    return _number(location.get("lat")), _number(location.get("lng"))


def _number(value: Any) -> float | None:
    if isinstance(value, bool):
        return None

    if isinstance(value, int | float):
        return float(value)

    return None


def _first_geocoding_result(
    geocoding_result: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not isinstance(geocoding_result, dict):
        return None

    results = geocoding_result.get("results")
    if not isinstance(results, list) or not results:
        return None

    first_result = results[0]
    return first_result if isinstance(first_result, dict) else None


def _geocoding_components(
    geocoding_result: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    first_result = _first_geocoding_result(geocoding_result)
    if first_result is None:
        return []

    components = first_result.get("address_components")
    if not isinstance(components, list):
        return []

    return [component for component in components if isinstance(component, dict)]


def _component_value(components: list[dict[str, Any]], component_type: str) -> str | None:
    for component in components:
        types = component.get("types")
        if isinstance(types, list) and component_type in types:
            return _optional_text(component.get("long_name"))

    return None
