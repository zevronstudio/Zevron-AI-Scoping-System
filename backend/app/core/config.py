from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=("../.env", ".env"), extra="ignore")
    database_url: str = "sqlite:///./zevron.db"
    openai_api_key: str = ""
    llm_provider: Literal["local", "minimax", "openai"] = "openai"
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = "gpt-4.1-mini"
    frontend_url: str = "http://localhost:3000"
    environment: str = "development"
    agent_timeout_seconds: int = Field(default=120, ge=5, le=300)
    guest_lifetime_days: int = 30
    ai_requests_per_hour: int = 30

    @field_validator("llm_base_url")
    @classmethod
    def validate_base_url(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        if value:
            parsed = urlsplit(value)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.hostname
                or parsed.username
                or parsed.password
                or parsed.query
                or parsed.fragment
            ):
                raise ValueError(
                    "LLM_BASE_URL must be an HTTP(S) URL without credentials or query parameters"
                )
        return value

    @property
    def provider_api_key(self) -> str:
        return self.openai_api_key if self.llm_provider == "openai" else self.llm_api_key

    @property
    def discovery_available(self) -> bool:
        return bool(
            self.provider_api_key.strip()
            and self.llm_model.strip()
            and (self.llm_provider == "openai" or self.llm_base_url)
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
