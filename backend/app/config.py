"""
Application configuration.

All settings are loaded from environment variables so that no credentials
are ever hardcoded in source. See .env.example for the variables required.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    database_url: str

    # CORS - comma separated list of allowed origins
    cors_origins: str

    # App
    environment: str = "development"
    low_stock_threshold: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


settings = Settings()