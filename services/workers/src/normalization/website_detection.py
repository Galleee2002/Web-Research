from dataclasses import dataclass
from urllib.parse import urlparse


NON_OWNED_WEBSITE_DOMAINS = (
    "instagram.com",
    "facebook.com",
    "fb.com",
    "wa.me",
    "api.whatsapp.com",
    "linktr.ee",
    "beacons.ai",
    "google.com",
    "maps.google.com",
    "yelp.com",
    "tripadvisor.com",
)


@dataclass(frozen=True, slots=True)
class WebsiteDetection:
    website: str | None
    has_website: bool


def detect_own_website(raw_url: str | None) -> WebsiteDetection:
    if not isinstance(raw_url, str):
        return WebsiteDetection(website=None, has_website=False)

    website = raw_url.strip()
    if not website:
        return WebsiteDetection(website=None, has_website=False)

    parsed = urlparse(website)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return WebsiteDetection(website=None, has_website=False)

    hostname = parsed.hostname.rstrip(".").lower()
    if _is_non_owned_domain(hostname):
        return WebsiteDetection(website=None, has_website=False)

    return WebsiteDetection(website=website, has_website=True)


def _is_non_owned_domain(hostname: str) -> bool:
    return any(
        hostname == domain or hostname.endswith(f".{domain}")
        for domain in NON_OWNED_WEBSITE_DOMAINS
    )
