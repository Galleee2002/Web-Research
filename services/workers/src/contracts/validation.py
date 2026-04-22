from .constants import (
    BUSINESS_SOURCES,
    INPUT_LIMITS,
    LEAD_STATUSES,
    SEARCH_RUN_STATUSES,
)
from .models import NormalizedBusiness


def validate_lead_status(status: str) -> str:
    if status not in LEAD_STATUSES:
        raise ValueError(f"Invalid lead status: {status}")
    return status


def validate_search_run_status(status: str) -> str:
    if status not in SEARCH_RUN_STATUSES:
        raise ValueError(f"Invalid search run status: {status}")
    return status


def validate_business_source(source: str) -> str:
    if source not in BUSINESS_SOURCES:
        raise ValueError(f"Invalid business source: {source}")
    return source


def normalize_required_text(value: str, field_name: str, max_length: int) -> str:
    if not isinstance(value, str):
        raise ValueError(f"{field_name} must be a string")

    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{field_name} is required")

    if len(normalized) > max_length:
        raise ValueError(f"{field_name} must be {max_length} characters or fewer")

    return normalized


def validate_normalized_business(business: NormalizedBusiness) -> NormalizedBusiness:
    business.name = normalize_required_text(
        business.name,
        "name",
        INPUT_LIMITS["text_search"],
    )
    business.source = validate_business_source(business.source)

    if business.website is None and business.has_website:
        raise ValueError("has_website cannot be true when website is None")

    if business.lat is not None and not -90 <= business.lat <= 90:
        raise ValueError("lat must be between -90 and 90")

    if business.lng is not None and not -180 <= business.lng <= 180:
        raise ValueError("lng must be between -180 and 180")

    return business
