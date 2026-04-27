import pytest

from normalization.website_detection import detect_own_website


@pytest.mark.parametrize(
    ("raw_url", "expected_website"),
    [
        ("https://clinicadentalcentro.example", "https://clinicadentalcentro.example"),
        ("HTTP://WWW.CLINICAEXAMPLE.COM/path", "HTTP://WWW.CLINICAEXAMPLE.COM/path"),
        ("https://notinstagram.com", "https://notinstagram.com"),
    ],
)
def test_detect_own_website_accepts_owned_domains(raw_url, expected_website):
    detected = detect_own_website(raw_url)

    assert detected.website == expected_website
    assert detected.has_website is True


@pytest.mark.parametrize(
    "raw_url",
    [
        None,
        "",
        "   ",
        "not a url",
        "mailto:hello@example.com",
        "https:///missing-host",
    ],
)
def test_detect_own_website_rejects_empty_or_invalid_urls(raw_url):
    detected = detect_own_website(raw_url)

    assert detected.website is None
    assert detected.has_website is False


@pytest.mark.parametrize(
    "raw_url",
    [
        "https://instagram.com/clinicadentalcentro",
        "https://www.instagram.com/clinicadentalcentro",
        "https://m.facebook.com/clinicadentalcentro",
        "https://fb.com/clinicadentalcentro",
        "https://wa.me/541112345678",
        "https://api.whatsapp.com/send?phone=541112345678",
        "https://linktr.ee/clinicadentalcentro",
        "https://beacons.ai/clinicadentalcentro",
        "https://google.com/search?q=clinica",
        "https://maps.google.com/?cid=123",
        "https://business.google.com/example",
        "https://yelp.com/biz/clinica-dental-centro",
        "https://tripadvisor.com/Attraction_Review-demo",
    ],
)
def test_detect_own_website_rejects_social_google_and_directory_domains(raw_url):
    detected = detect_own_website(raw_url)

    assert detected.website is None
    assert detected.has_website is False
