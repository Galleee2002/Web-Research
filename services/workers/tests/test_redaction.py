import logging

from workers.observability import redact_sensitive_text, log_event


def test_redact_sensitive_text_masks_database_urls_and_api_keys():
    text = (
        "failed postgres://user:secret@localhost:5432/app "
        "with GOOGLE_PLACES_API_KEY=abc123 and https://x.test/?key=secret"
    )

    redacted = redact_sensitive_text(text)

    assert "secret" not in redacted
    assert "abc123" not in redacted
    assert "[REDACTED_DATABASE_URL]" in redacted
    assert "GOOGLE_PLACES_API_KEY=[REDACTED]" in redacted
    assert "key=[REDACTED]" in redacted


def test_log_event_redacts_sensitive_string_fields(caplog):
    logger = logging.getLogger("test_redaction")

    with caplog.at_level(logging.ERROR):
        log_event(
            logger,
            logging.ERROR,
            "db_failed",
            error_message="postgres://user:secret@localhost:5432/app",
        )

    assert "secret" not in caplog.text
    assert "[REDACTED_DATABASE_URL]" in caplog.text
