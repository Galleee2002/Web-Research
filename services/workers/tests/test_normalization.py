import json
from pathlib import Path

import pytest

from normalization.business import normalize_google_place


FIXTURES_DIR = Path(__file__).parent / "fixtures"


def load_fixture(name: str) -> dict:
    return json.loads((FIXTURES_DIR / name).read_text())


def place_at(index: int) -> dict:
    return load_fixture("google_places_text_search.json")["places"][index]


def test_normalize_google_place_maps_complete_places_payload():
    business = normalize_google_place(place_at(0))

    assert business.external_id == "places/clinica-dental-centro"
    assert business.name == "Clinica Dental Centro"
    assert business.category == "Dentist"
    assert business.address == "Av. Santa Fe 1234, Buenos Aires, Argentina"
    assert business.phone == "+54 11 4567-8901"
    assert business.website == "https://clinicadentalcentro.example"
    assert business.has_website is True
    assert business.maps_url == "https://maps.google.com/?cid=123"
    assert business.lat == -34.5951
    assert business.lng == -58.3938


def test_normalize_google_place_preserves_partial_payload_with_optional_none_values():
    business = normalize_google_place(place_at(1))

    assert business.external_id == "places/local-partial"
    assert business.name == "Local Partial"
    assert business.address == "Calle Demo 99, Buenos Aires, Argentina"
    assert business.category is None
    assert business.phone is None
    assert business.website is None
    assert business.maps_url is None
    assert business.lat is None
    assert business.lng is None
    assert business.has_website is False


def test_normalize_google_place_requires_display_name_text():
    with pytest.raises(ValueError, match="name"):
        normalize_google_place(place_at(4))


def test_normalize_google_place_uses_primary_type_when_display_category_is_missing():
    business = normalize_google_place(place_at(2))

    assert business.category == "doctor"


def test_normalize_google_place_completes_location_fields_from_geocoding():
    geocoding_result = load_fixture("google_geocoding_result.json")

    business = normalize_google_place(place_at(0), geocoding_result)

    assert business.city == "Buenos Aires"
    assert business.region == "Ciudad Autonoma de Buenos Aires"
    assert business.country == "Argentina"
    assert business.lat == -34.5951
    assert business.lng == -58.3938


def test_normalize_google_place_uses_geocoding_coordinates_only_as_fallback():
    geocoding_result = load_fixture("google_geocoding_result.json")

    business = normalize_google_place(place_at(3), geocoding_result)

    assert business.city == "Buenos Aires"
    assert business.region == "Ciudad Autonoma de Buenos Aires"
    assert business.country == "Argentina"
    assert business.lat == -34.5956
    assert business.lng == -58.3942


@pytest.mark.parametrize(
    "website_uri",
    [
        "https://instagram.com/consultorio-demo",
        "https://yelp.com/biz/consultorio-demo",
    ],
)
def test_normalize_google_place_discards_non_owned_website_candidates(website_uri):
    raw_place = {
        "id": "places/social-profile",
        "displayName": {"text": "Consultorio Social"},
        "formattedAddress": "Calle Social 123, Buenos Aires, Argentina",
        "websiteUri": website_uri,
    }

    business = normalize_google_place(raw_place)

    assert business.website is None
    assert business.has_website is False
