from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class WorkerSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = Field(default="development", alias="APP_ENV")
    database_url: str | None = Field(default=None, alias="DATABASE_URL")
    google_places_api_key: str | None = Field(
        default=None,
        alias="GOOGLE_PLACES_API_KEY",
    )
    google_geocoding_api_key: str | None = Field(
        default=None,
        alias="GOOGLE_GEOCODING_API_KEY",
    )
    google_request_timeout_seconds: float = Field(
        default=10.0,
        alias="GOOGLE_REQUEST_TIMEOUT_SECONDS",
    )
    google_daily_request_limit: int = Field(
        default=1000,
        alias="GOOGLE_DAILY_REQUEST_LIMIT",
    )
    google_quota_state_path: str = Field(
        default=".worker-state/google-api-quota.json",
        alias="GOOGLE_QUOTA_STATE_PATH",
    )
    default_page_size: int = Field(default=20, alias="DEFAULT_PAGE_SIZE")
    max_page_size: int = Field(default=100, alias="MAX_PAGE_SIZE")
    log_level: str = Field(default="info", alias="LOG_LEVEL")

    @property
    def effective_google_geocoding_api_key(self) -> str | None:
        return self.google_geocoding_api_key or self.google_places_api_key
