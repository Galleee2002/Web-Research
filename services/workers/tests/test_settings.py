from workers.config.settings import WorkerSettings


def test_settings_use_safe_development_defaults_without_secrets(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_GEOCODING_API_KEY", raising=False)

    settings = WorkerSettings(_env_file=None)

    assert settings.app_env == "development"
    assert settings.database_url is None
    assert settings.google_places_api_key is None
    assert settings.google_geocoding_api_key is None
    assert settings.effective_google_geocoding_api_key is None
    assert settings.google_request_timeout_seconds == 10.0
    assert settings.google_daily_request_limit == 1000
    assert settings.google_quota_state_path == ".worker-state/google-api-quota.json"
    assert settings.default_page_size == 20
    assert settings.max_page_size == 100
    assert settings.log_level == "info"


def test_settings_use_places_key_for_geocoding_when_specific_key_is_missing(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "places-key")
    monkeypatch.delenv("GOOGLE_GEOCODING_API_KEY", raising=False)

    settings = WorkerSettings(_env_file=None)

    assert settings.google_places_api_key == "places-key"
    assert settings.google_geocoding_api_key is None
    assert settings.effective_google_geocoding_api_key == "places-key"


def test_settings_prefer_specific_geocoding_key(monkeypatch):
    monkeypatch.setenv("GOOGLE_PLACES_API_KEY", "places-key")
    monkeypatch.setenv("GOOGLE_GEOCODING_API_KEY", "geocoding-key")

    settings = WorkerSettings(_env_file=None)

    assert settings.effective_google_geocoding_api_key == "geocoding-key"


def test_settings_reject_invalid_log_level(monkeypatch):
    monkeypatch.setenv("LOG_LEVEL", "verbose")

    try:
        WorkerSettings(_env_file=None)
    except ValueError as exc:
        assert "LOG_LEVEL" in str(exc) or "log_level" in str(exc)
    else:
        raise AssertionError("expected invalid LOG_LEVEL to fail")


def test_settings_require_production_secrets(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)

    try:
        WorkerSettings(_env_file=None)
    except ValueError as exc:
        assert "DATABASE_URL" in str(exc)
    else:
        raise AssertionError("expected missing production secrets to fail")
