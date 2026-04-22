from dataclasses import dataclass

from .constants import BUSINESS_SOURCE_GOOGLE_PLACES


@dataclass(slots=True)
class NormalizedBusiness:
    name: str
    source: str = BUSINESS_SOURCE_GOOGLE_PLACES
    has_website: bool = False
    external_id: str | None = None
    category: str | None = None
    address: str | None = None
    city: str | None = None
    region: str | None = None
    country: str | None = None
    lat: float | None = None
    lng: float | None = None
    phone: str | None = None
    website: str | None = None
    maps_url: str | None = None
