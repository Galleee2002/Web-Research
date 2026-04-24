from pydantic import Field
from pydantic import field_validator, model_validator
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

    @field_validator("app_env")
    @classmethod
    def validate_app_env(cls, value: str) -> str:
        if value not in {"development", "production", "test"}:
            raise ValueError("APP_ENV must be development, production, or test")
        return value

    @field_validator("log_level")
    @classmethod
    def validate_log_level(cls, value: str) -> str:
        if value not in {"debug", "info", "warn", "warning", "error"}:
            raise ValueError("LOG_LEVEL must be debug, info, warn, warning, or error")
        return value

    @field_validator(
        "google_request_timeout_seconds",
        "google_daily_request_limit",
        "default_page_size",
        "max_page_size",
    )
    @classmethod
    def validate_positive_number(cls, value):
        if value <= 0:
            raise ValueError("numeric settings must be positive")
        return value

    @model_validator(mode="after")
    def validate_production_requirements(self):
        if self.app_env == "production":
            if not self.database_url:
                raise ValueError("DATABASE_URL is required in production")
            if not self.google_places_api_key:
                raise ValueError("GOOGLE_PLACES_API_KEY is required in production")
        if self.default_page_size > self.max_page_size:
            raise ValueError("DEFAULT_PAGE_SIZE must be less than or equal to MAX_PAGE_SIZE")
        return self

    @property
    def effective_google_geocoding_api_key(self) -> str | None:
        return self.google_geocoding_api_key or self.google_places_api_key
