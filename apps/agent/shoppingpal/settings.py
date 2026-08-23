from __future__ import annotations

import os

from pydantic import BaseModel, ConfigDict, Field


class AgentSettings(BaseModel):
    model_config = ConfigDict(frozen=True)

    medusa_backend_url: str = "http://localhost:9000"
    medusa_publishable_key: str = ""
    medusa_region_id: str = ""
    database_url: str = ""
    internal_token: str = ""
    checkpoint_backend: str = "memory"
    host: str = "127.0.0.1"
    port: int = Field(default=8000, ge=1, le=65535)

    @classmethod
    def from_env(cls) -> "AgentSettings":
        return cls(
            medusa_backend_url=os.getenv("MEDUSA_BACKEND_URL", "http://localhost:9000").rstrip("/"),
            medusa_publishable_key=os.getenv("MEDUSA_PUBLISHABLE_KEY", ""),
            medusa_region_id=os.getenv("MEDUSA_REGION_ID", ""),
            database_url=os.getenv("AGENT_DATABASE_URL", ""),
            internal_token=os.getenv("AGENT_INTERNAL_TOKEN", ""),
            checkpoint_backend=os.getenv("AGENT_CHECKPOINT_BACKEND", "memory").lower(),
            host=os.getenv("AGENT_HOST", "127.0.0.1"),
            port=int(os.getenv("AGENT_PORT", "8000")),
        )
