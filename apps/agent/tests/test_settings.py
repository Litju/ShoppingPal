from __future__ import annotations

from pydantic import ValidationError

from shoppingpal.settings import AgentSettings


def test_settings_load_runtime_and_commerce_environment(monkeypatch) -> None:
    values = {
        "AGENT_HOST": "0.0.0.0",
        "AGENT_PORT": "8200",
        "AGENT_INTERNAL_TOKEN": "local-token",
        "AGENT_ACTOR_SIGNING_SECRET": "actor-secret",
        "AGENT_ALLOW_UNAUTHENTICATED_LOCAL": "true",
        "AGENT_DATABASE_URL": "postgresql://user:pass@localhost:5433/db",
        "AGENT_CHECKPOINT_BACKEND": "POSTGRES",
        "MEDUSA_BACKEND_URL": "http://medusa:9000/",
        "MEDUSA_PUBLISHABLE_KEY": "pk_local",
        "MEDUSA_REGION_ID": "reg_local",
        "OPENAI_API_KEY": "ignored",
        "OPENAI_MODEL": "ignored",
    }
    for name, value in values.items():
        monkeypatch.setenv(name, value)

    settings = AgentSettings.from_env()

    assert settings.host == "0.0.0.0"
    assert settings.port == 8200
    assert settings.internal_token == "local-token"
    assert settings.actor_signing_secret == "actor-secret"
    assert settings.allow_unauthenticated_local is True
    assert settings.database_url == values["AGENT_DATABASE_URL"]
    assert settings.checkpoint_backend == "postgres"
    assert settings.medusa_backend_url == "http://medusa:9000"
    assert settings.medusa_publishable_key == "pk_local"
    assert settings.medusa_region_id == "reg_local"
    assert "openai_api_key" not in settings.model_dump()
    assert "openai_model" not in settings.model_dump()


def test_postgres_checkpoints_cannot_start_without_a_database_url() -> None:
    try:
        AgentSettings(checkpoint_backend="postgres")
    except ValidationError as error:
        assert "AGENT_DATABASE_URL" in str(error)
    else:
        raise AssertionError("postgres checkpoint configuration must require a database URL")
