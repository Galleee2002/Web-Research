from typing import Any

from contracts import NormalizedBusiness, validate_normalized_business
from ingestion.google_places.errors import GoogleInvalidResponseError

from .website_detection import classify_business_website


def _get_display_name(place: dict[str, Any]) -> str:
    display_name = place.get("displayName")
    if not isinstance(display_name, dict):
        raise GoogleInvalidResponseError("Google Places payload is missing displayName.text")

    text = display_name.get("text")
    if not isinstance(text, str) or not text.strip():
        raise GoogleInvalidResponseError("Google Places payload is missing displayName.text")

    return text.strip()


def _get_primary_type(place: dict[str, Any]) -> str | None:
    primary_type_display_name = place.get("primaryTypeDisplayName")
    if isinstance(primary_type_display_name, dict):
        text = primary_type_display_name.get("text")
        if isinstance(text, str) and text.strip():
            return text.strip()

    primary_type = place.get("primaryType")
    if isinstance(primary_type, str) and primary_type.strip():
        return primary_type.strip()

    return None


def _get_location(place: dict[str, Any]) -> tuple[float | None, float | None]:
    location = place.get("location")
    if not isinstance(location, dict):
        return None, None

    lat = location.get("latitude")
    lng = location.get("longitude")
    return _to_float(lat), _to_float(lng)


def _to_float(value: Any) -> float | None:
    if value is None:
        return None

    if isinstance(value, (float, int)):
        return float(value)

    return None


def _extract_geocoding_component(
    geocoding_response: dict[str, Any] | None,
    wanted_type: str,
) -> str | None:
    result = _get_first_geocoding_result(geocoding_response)
    if result is None:
        return None

    components = result.get("address_components")
    if not isinstance(components, list):
        return None

    for component in components:
        if not isinstance(component, dict):
            continue

        types = component.get("types")
        if not isinstance(types, list):
            continue

        if wanted_type not in types:
            continue

        long_name = component.get("long_name")
        if isinstance(long_name, str) and long_name.strip():
            return long_name.strip()

    return None


def _get_first_geocoding_result(
    geocoding_response: dict[str, Any] | None,
) -> dict[str, Any] | None:
    if not isinstance(geocoding_response, dict):
        return None

    results = geocoding_response.get("results")
    if not isinstance(results, list) or not results:
        return None

    first_result = results[0]
    return first_result if isinstance(first_result, dict) else None


def _get_geocoding_location(
    geocoding_response: dict[str, Any] | None,
) -> tuple[float | None, float | None]:
    result = _get_first_geocoding_result(geocoding_response)
    if result is None:
        return None, None

    geometry = result.get("geometry")
    if not isinstance(geometry, dict):
        return None, None

    location = geometry.get("location")
    if not isinstance(location, dict):
        return None, None

    return _to_float(location.get("lat")), _to_float(location.get("lng"))


def normalize_google_place(
    place: dict[str, Any],
    geocoding_response: dict[str, Any] | None,
) -> NormalizedBusiness:
    name = _get_display_name(place)
    lat, lng = _get_location(place)
    geocoding_lat, geocoding_lng = _get_geocoding_location(geocoding_response)
    website, has_website = classify_business_website(place.get("websiteUri"))

    business = NormalizedBusiness(
        external_id=place.get("id") if isinstance(place.get("id"), str) else None,
        name=name,
        category=_get_primary_type(place),
        address=place.get("formattedAddress")
        if isinstance(place.get("formattedAddress"), str)
        else None,
        city=_extract_geocoding_component(geocoding_response, "locality"),
        region=_extract_geocoding_component(
            geocoding_response,
            "administrative_area_level_1",
        ),
        country=_extract_geocoding_component(geocoding_response, "country"),
        lat=lat if lat is not None else geocoding_lat,
        lng=lng if lng is not None else geocoding_lng,
        phone=place.get("nationalPhoneNumber")
        if isinstance(place.get("nationalPhoneNumber"), str)
        else (
            place.get("internationalPhoneNumber")
            if isinstance(place.get("internationalPhoneNumber"), str)
            else None
        ),
        website=website,
        has_website=has_website,
        maps_url=place.get("googleMapsUri")
        if isinstance(place.get("googleMapsUri"), str)
        else None,
    )
    return validate_normalized_business(business)
