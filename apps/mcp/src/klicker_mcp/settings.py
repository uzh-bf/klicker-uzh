"""Runtime settings loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-driven settings.

    Field aliases use the canonical env-var names shared with the rest of the monorepo
    (see `turbo.json` `globalEnv`). New variables MUST also be added to `turbo.json`.
    """

    model_config = SettingsConfigDict(env_file=None, extra="ignore", populate_by_name=True)

    host: str = Field(default="0.0.0.0", alias="MCP_HOST")
    port: int = Field(default=7079, alias="MCP_PORT")
    mcp_path: str = Field(default="/mcp", alias="MCP_PATH")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")

    api_origin: str = Field(default="http://localhost:3000", alias="APP_ORIGIN_API")
    app_secret: str = Field(default="abcd", alias="APP_SECRET")

    # --- OAuth bridge (iteration 5) -------------------------------------------
    # When any of these are unset, OAuth is disabled and the server falls back
    # to pass-through mode (clients send Authorization: Bearer headers
    # themselves). That's the local-dev and CI default.
    mcp_origin: str | None = Field(default=None, alias="MCP_ORIGIN")
    mcp_upstream_client_id: str | None = Field(default=None, alias="MCP_UPSTREAM_CLIENT_ID")
    mcp_upstream_client_secret: str | None = Field(default=None, alias="MCP_UPSTREAM_CLIENT_SECRET")
    mcp_upstream_authorize_url: str | None = Field(default=None, alias="MCP_UPSTREAM_AUTHORIZE_URL")
    mcp_upstream_token_url: str | None = Field(default=None, alias="MCP_UPSTREAM_TOKEN_URL")
    mcp_upstream_issuer: str | None = Field(default=None, alias="MCP_UPSTREAM_ISSUER")
    mcp_storage_url: str | None = Field(default=None, alias="MCP_STORAGE_URL")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
