from __future__ import annotations

from shoppingpal.settings import AgentSettings


def test_settings_load_runtime_and_commerce_environment(monkeypatch) -> None:
    values = {
        "AGENT_HOST": "0.0.0.0",
        "AGENT_PORT": "8200",
        "AGENT_INTERNAL_TOKEN": "local-token",
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
    assert settings.database_url == values["AGENT_DATABASE_URL"]
    assert settings.checkpoint_backend == "postgres"
    assert settings.medusa_backend_url == "http://medusa:9000"
    assert settings.medusa_publishable_key == "pk_local"
    assert settings.medusa_region_id == "reg_local"
    assert "openai_api_key" not in settings.model_dump()
    assert "openai_model" not in settings.model_dump()
