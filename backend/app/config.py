from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str
    secret_key: str
    algorithm: str = "HS256"

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v: str) -> str:
        if len(v.encode()) < 32:
            raise ValueError(
                "SECRET_KEY deve essere >= 32 byte. "
                "Genera una chiave sicura con: openssl rand -hex 32"
            )
        return v
    access_token_expire_minutes: int = 60
    app_env: str = "development"
    allowed_origins: str = "http://localhost:5173"
    ntfy_topic: str = ""

    @property
    def origins_list(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]


@lru_cache
def get_settings() -> Settings:
    return Settings()
