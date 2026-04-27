from contracts import BUSINESS_SOURCE_GOOGLE_PLACES, NormalizedBusiness
from persistence.dedup import canonicalize_dedup_text, fallback_dedup_key


def test_canonicalize_dedup_text_normalizes_casing_spacing_punctuation_and_accents():
    assert (
        canonicalize_dedup_text("  Clínica---Dental   Centro, S.A.  ")
        == "clinica dental centro s a"
    )


def test_fallback_dedup_key_uses_normalized_name_and_address():
    business = NormalizedBusiness(
        name=" Clínica Dental Centro ",
        source=BUSINESS_SOURCE_GOOGLE_PLACES,
        address="Av. Santa Fé 1234, Buenos Aires",
    )

    assert fallback_dedup_key(business) == (
        "clinica dental centro",
        "av santa fe 1234 buenos aires",
    )


def test_fallback_dedup_key_is_disabled_without_address():
    business = NormalizedBusiness(
        name="Clinica Dental Centro",
        source=BUSINESS_SOURCE_GOOGLE_PLACES,
        address=None,
    )

    assert fallback_dedup_key(business) is None
