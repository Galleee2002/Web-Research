LEAD_STATUSES = ("new", "reviewed", "contacted", "discarded", "opportunities")
SEARCH_RUN_STATUSES = ("pending", "processing", "completed", "failed")

BUSINESS_SOURCE_GOOGLE_PLACES = "google_places"
BUSINESS_SOURCES = (BUSINESS_SOURCE_GOOGLE_PLACES,)

DEFAULT_PAGE = 1
DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100

INPUT_LIMITS = {
    "query": 120,
    "location": 160,
    "notes": 2000,
    "city": 120,
    "category": 120,
    "text_search": 160,
}
