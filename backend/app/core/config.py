from functools import lru_cache
from zoneinfo import ZoneInfo
from urllib.parse import urlsplit
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator


def normalize_origin(value: str) -> str:
    value = value.strip().rstrip("/")
    parsed = urlsplit(value)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.path
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError("Use an exact http(s) origin, e.g. https://nourish.vercel.app")
    # Accessing port also validates malformed port values.
    parsed.port
    return value


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/nourish"
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    app_timezone: str = "Asia/Kolkata"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("frontend_url")
    @classmethod
    def frontend_origin(cls, value):
        return normalize_origin(value)

    @field_validator("cors_origins")
    @classmethod
    def additional_origins(cls, value):
        return ",".join(normalize_origin(x) for x in value.split(",") if x.strip())

    @property
    def allowed_origins(self) -> list[str]:
        return sorted({self.frontend_url, *filter(None, self.cors_origins.split(","))})

    @field_validator("database_url")
    @classmethod
    def postgres_url(cls, value):
        if value.startswith("postgres://"):
            value = value.replace("postgres://", "postgresql+psycopg://", 1)
        elif value.startswith("postgresql://"):
            value = value.replace("postgresql://", "postgresql+psycopg://", 1)
        if not value.startswith("postgresql+psycopg://"):
            raise ValueError("Nourish requires PostgreSQL with psycopg")
        return value

    @field_validator("app_timezone")
    @classmethod
    def valid_timezone(cls, value):
        ZoneInfo(value)
        return value

    @property
    def timezone(self):
        return ZoneInfo(self.app_timezone)


@lru_cache
def get_settings():
    return Settings()
