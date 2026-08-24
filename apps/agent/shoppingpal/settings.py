from __future__ import annotations

import os

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AgentSettings(BaseModel):
    model_config = ConfigDict(frozen=True)

    medusa_backend_url: str = "http://localhost:9000"
    medusa_publishable_key: str = ""
    medusa_region_id: str = ""
    typesense_url: str = ""
    typesense_api_key: str = ""
    database_url: str = ""
    internal_token: str = ""
    actor_signing_secret: str = ""
    allow_unauthenticated_local: bool = False
    checkpoint_backend: str = "memory"
    host: str = "127.0.0.1"
    port: int = Field(default=8000, ge=1, le=65535)

    @model_validator(mode="after")
    def validate_checkpoint_configuration(self) -> "AgentSettings":
        if self.checkpoint_backend not in {"memory", "postgres"}:
            raise ValueError("AGENT_CHECKPOINT_BACKEND must be memory or postgres")
        if self.checkpoint_backend == "postgres" and not self.database_url.strip():
            raise ValueError("AGENT_DATABASE_URL is required when checkpoints use postgres")
        if self.internal_token.strip() and not self.actor_signing_secret.strip():
            raise ValueError("AGENT_ACTOR_SIGNING_SECRET is required when AGENT_INTERNAL_TOKEN is configured")
        return self

    @classmethod
    def from_env(cls) -> "AgentSettings":
        return cls(
            medusa_backend_url=os.getenv("MEDUSA_BACKEND_URL", "http://localhost:9000").rstrip("/"),
            medusa_publishable_key=os.getenv("MEDUSA_PUBLISHABLE_KEY", ""),
            medusa_region_id=os.getenv("MEDUSA_REGION_ID", ""),
            typesense_url=(os.getenv("TYPESENSE_URL") or os.getenv("TYPESENSE_HOST") or "").rstrip("/"),
            typesense_api_key=os.getenv("TYPESENSE_API_KEY", ""),
            database_url=os.getenv("AGENT_DATABASE_URL", ""),
            internal_token=os.getenv("AGENT_INTERNAL_TOKEN", ""),
            actor_signing_secret=os.getenv("AGENT_ACTOR_SIGNING_SECRET", ""),
            allow_unauthenticated_local=os.getenv("AGENT_ALLOW_UNAUTHENTICATED_LOCAL", "").lower()
            in {"1", "true", "yes"},
            checkpoint_backend=os.getenv("AGENT_CHECKPOINT_BACKEND", "memory").lower(),
            host=os.getenv("AGENT_HOST", "127.0.0.1"),
            port=int(os.getenv("AGENT_PORT", "8000")),
        )
