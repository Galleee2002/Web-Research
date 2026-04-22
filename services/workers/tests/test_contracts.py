import pytest

from contracts import (
    BUSINESS_SOURCE_GOOGLE_PLACES,
    NormalizedBusiness,
    validate_business_source,
    validate_lead_status,
    validate_normalized_business,
)


def test_normalized_business_accepts_minimum_valid_payload():
    business = NormalizedBusiness(
        name="Clinica Dental Centro",
        source=BUSINESS_SOURCE_GOOGLE_PLACES,
        has_website=False,
    )

    validate_normalized_business(business)


def test_validate_lead_status_rejects_unknown_status():
    with pytest.raises(ValueError, match="Invalid lead status"):
        validate_lead_status("archived")


def test_validate_business_source_rejects_unknown_source():
    with pytest.raises(ValueError, match="Invalid business source"):
        validate_business_source("manual")


def test_validate_normalized_business_rejects_website_presence_mismatch():
    business = NormalizedBusiness(
        name="Clinica Dental Centro",
        source=BUSINESS_SOURCE_GOOGLE_PLACES,
        has_website=True,
        website=None,
    )

    with pytest.raises(ValueError, match="has_website"):
        validate_normalized_business(business)
