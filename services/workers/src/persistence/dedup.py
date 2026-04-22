import re
import unicodedata

from contracts import NormalizedBusiness


def canonicalize_dedup_text(value: str | None) -> str:
    if value is None:
        return ""

    without_accents = "".join(
        character
        for character in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(character)
    )
    lowercased = without_accents.lower().strip()
    without_punctuation = re.sub(r"[^\w\s]", " ", lowercased, flags=re.UNICODE)
    collapsed = re.sub(r"\s+", " ", without_punctuation)
    return collapsed.strip()


def fallback_dedup_key(business: NormalizedBusiness) -> tuple[str, str] | None:
    name_key = canonicalize_dedup_text(business.name)
    address_key = canonicalize_dedup_text(business.address)

    if not name_key or not address_key:
        return None

    return name_key, address_key
