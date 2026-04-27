from urllib.parse import urlsplit


BLOCKED_WEBSITE_HOSTS = {
    "instagram.com",
    "www.instagram.com",
    "facebook.com",
    "www.facebook.com",
    "fb.com",
    "www.fb.com",
    "wa.me",
    "api.whatsapp.com",
    "whatsapp.com",
    "www.whatsapp.com",
    "linktr.ee",
    "www.linktr.ee",
    "beacons.ai",
    "www.beacons.ai",
    "google.com",
    "www.google.com",
    "maps.google.com",
    "yelp.com",
    "www.yelp.com",
    "tripadvisor.com",
    "www.tripadvisor.com",
}


def classify_business_website(url: str | None) -> tuple[str | None, bool]:
    if url is None:
        return None, False

    normalized = url.strip()
    if not normalized:
        return None, False

    try:
        parsed = urlsplit(normalized)
    except ValueError:
        return None, False

    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None, False

    hostname = parsed.netloc.lower()
    if hostname.startswith("www."):
        hostname = hostname[4:]

    if hostname in {
        host[4:] if host.startswith("www.") else host for host in BLOCKED_WEBSITE_HOSTS
    }:
        return None, False

    for blocked_host in BLOCKED_WEBSITE_HOSTS:
        canonical_blocked = blocked_host[4:] if blocked_host.startswith("www.") else blocked_host
        if hostname == canonical_blocked or hostname.endswith(f".{canonical_blocked}"):
            return None, False

    return normalized, True
