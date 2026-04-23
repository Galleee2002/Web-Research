from ingestion.google_places.errors import GoogleInvalidResponseError
from workers.normalization import normalize_google_place


def test_normalize_google_place_filters_social_profiles_as_non_websites():
    business = normalize_google_place(
        {
            "id": "place-1",
            "displayName": {"text": "Cafe Demo"},
            "formattedAddress": "Calle Falsa 123, Buenos Aires, Argentina",
            "websiteUri": "https://instagram.com/cafedemo",
            "googleMapsUri": "https://maps.google.com/?cid=999",
            "location": {"latitude": -34.6, "longitude": -58.38},
        },
        geocoding_response={
            "status": "OK",
            "results": [
                {
                    "address_components": [
                        {
                            "long_name": "Buenos Aires",
                            "types": ["locality", "political"],
                        },
                        {
                            "long_name": "Argentina",
                            "types": ["country", "political"],
                        },
                    ],
                    "geometry": {"location": {"lat": -34.6037, "lng": -58.3816}},
                }
            ],
        },
    )

    assert business.name == "Cafe Demo"
    assert business.external_id == "place-1"
    assert business.website is None
    assert business.has_website is False
    assert business.city == "Buenos Aires"
    assert business.country == "Argentina"
    assert business.lat == -34.6
    assert business.lng == -58.38


def test_normalize_google_place_requires_display_name_text():
    try:
        normalize_google_place({"id": "place-1", "displayName": {}}, None)
    except GoogleInvalidResponseError as error:
        assert "displayName.text" in str(error)
    else:
        raise AssertionError("Expected normalize_google_place to reject missing displayName.text")
