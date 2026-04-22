from workers.config.settings import WorkerSettings


def test_settings_use_safe_development_defaults_without_secrets(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("GOOGLE_PLACES_API_KEY", raising=False)

    settings = WorkerSettings()

    assert settings.app_env == "development"
    assert settings.database_url is None
    assert settings.google_places_api_key is None
    assert settings.default_page_size == 20
    assert settings.max_page_size == 100
    assert settings.log_level == "info"
