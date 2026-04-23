from __future__ import annotations

from datetime import UTC, datetime
import json
import logging
from typing import Any

from ingestion.google_places.errors import (
    DailyGoogleRequestLimitExceeded,
    GoogleCredentialsError,
    GoogleGeocodingStatusError,
    GoogleInvalidResponseError,
    GoogleRateLimitError,
    GoogleRequestError,
    GoogleTimeoutError,
)


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def log_event(
    logger: logging.Logger,
    level: int,
    event: str,
    **fields: Any,
) -> None:
    payload = {
        "timestamp": utc_now_iso(),
        "level": logging.getLevelName(level).lower(),
        "event": event,
        "correlation_id": None,
        "search_run_id": None,
        "route": None,
        "method": None,
        "status_code": None,
        "provider": None,
        "error_code": None,
        "error_stage": None,
        "duration_ms": None,
        "result_count": None,
    }
    payload.update(fields)
    logger.log(level, json.dumps(payload, sort_keys=True, default=str))


def classify_error_code(error: Exception) -> str:
    if isinstance(error, GoogleRateLimitError):
        return "provider_error"
    if isinstance(error, GoogleRequestError):
        return "provider_error"
    if isinstance(error, GoogleTimeoutError):
        return "timeout_error"
    if isinstance(error, GoogleInvalidResponseError):
        return "provider_error"
    if isinstance(error, GoogleGeocodingStatusError):
        return "provider_error"
    if isinstance(error, DailyGoogleRequestLimitExceeded):
        return "provider_error"
    if isinstance(error, GoogleCredentialsError):
        return "provider_error"
    return "internal_error"
