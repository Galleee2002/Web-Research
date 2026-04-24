from __future__ import annotations

from datetime import UTC, datetime
import json
import logging
import re
from typing import Any

SENSITIVE_ASSIGNMENT_PATTERN = re.compile(
    r"\b((?:GOOGLE_[A-Z_]*API_KEY|DATABASE_URL|API_KEY|TOKEN|SECRET|PASSWORD)=)([^&\s]+)",
    re.IGNORECASE,
)
DATABASE_URL_PATTERN = re.compile(r"\bpostgres(?:ql)?://[^\s\"']+", re.IGNORECASE)
URL_KEY_PATTERN = re.compile(r"([?&]key=)[^&\s\"']+", re.IGNORECASE)


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def redact_sensitive_text(value: str) -> str:
    redacted = DATABASE_URL_PATTERN.sub("[REDACTED_DATABASE_URL]", value)
    redacted = SENSITIVE_ASSIGNMENT_PATTERN.sub(r"\1[REDACTED]", redacted)
    return URL_KEY_PATTERN.sub(r"\1[REDACTED]", redacted)


def redact_value(value: Any) -> Any:
    if isinstance(value, str):
        return redact_sensitive_text(value)
    return value


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
    payload.update({key: redact_value(value) for key, value in fields.items()})
    logger.log(level, json.dumps(payload, sort_keys=True, default=str))


def classify_error_code(error: Exception) -> str:
    from ingestion.google_places.errors import (
        DailyGoogleRequestLimitExceeded,
        GoogleCredentialsError,
        GoogleGeocodingStatusError,
        GoogleInvalidResponseError,
        GoogleRateLimitError,
        GoogleRequestError,
        GoogleTimeoutError,
    )

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
