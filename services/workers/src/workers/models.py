from dataclasses import dataclass
from typing import Any

from contracts import NormalizedBusiness


@dataclass(slots=True)
class SearchRun:
    id: str
    query: str
    location: str
    source: str
    correlation_id: str | None
    status: str
    total_found: int
    parent_search_run_id: str | None = None
    page_number: int = 1
    provider_page_token: str | None = None
    provider_next_page_token: str | None = None
    error_message: str | None = None
    error_code: str | None = None
    error_stage: str | None = None
    observability: dict[str, Any] | None = None


@dataclass(slots=True)
class UpsertResult:
    action: str
    business_id: str | None = None
    external_id: str | None = None
    dedupe_strategy: str | None = None


@dataclass(slots=True)
class SearchRunProcessingResult:
    search_run_id: str
    correlation_id: str | None
    status: str
    total_found: int
    inserted_count: int
    updated_count: int
    deduped_count: int
    geocoding_calls: int
    duration_ms: int | None = None
    error_message: str | None = None
    error_code: str | None = None
    error_stage: str | None = None
    businesses: list[NormalizedBusiness] | None = None
    observability: dict[str, Any] | None = None
