from __future__ import annotations

from fastapi.testclient import TestClient

from shoppingpal.api.app import create_app
from shoppingpal.settings import AgentSettings
from tests.test_graph import FakeCatalog, product


def client() -> TestClient:
    settings = AgentSettings(internal_token="test-token")
    return TestClient(create_app(settings, catalog=FakeCatalog([product()])))


def headers(actor: str = "customer_1") -> dict[str, str]:
    return {"x-agent-internal-token": "test-token", "x-actor-id": actor}


def test_api_requires_internal_boundary_and_scopes_missions() -> None:
    with client() as app:
        unauthorized = app.get("/api/v1/missions")
        assert unauthorized.status_code == 401

        created = app.post(
            "/api/v1/missions",
            headers=headers(),
            json={"title": "Workstation", "goal": "Upgrade my workstation", "budget": 200000},
        )
        assert created.status_code == 201
        mission_id = created.json()["mission_id"]

        own = app.get("/api/v1/missions", headers=headers())
        other = app.get("/api/v1/missions", headers=headers("customer_2"))
        assert len(own.json()) == 1
        assert other.json() == []
        assert app.get(f"/api/v1/missions/{mission_id}", headers=headers("customer_2")).status_code == 404


def test_api_graph_and_eve_return_typed_results() -> None:
    with client() as app:
        graph = app.post(
            "/api/v1/graph/runs",
            headers={**headers(), "x-correlation-id": "corr-api"},
            json={"message": "headphones under $250", "graph_run_id": "run-api"},
        )
        assert graph.status_code == 200
        assert graph.json()["correlation_id"] == "corr-api"
        assert graph.json()["payload"]["products"][0]["price"] == 19900

        eve = app.post(
            "/api/v1/eve/sessions/eve-api/messages",
            headers=headers(),
            json={"message": "compare headphones"},
        )
        assert eve.status_code == 200
        assert eve.json()[-1]["event"] == "graph_result"

        stream = app.post(
            "/api/v1/eve/sessions/eve-api/stream",
            headers=headers(),
            json={"message": "recommend headphones"},
        )
        assert stream.status_code == 200
        assert "event: graph_result" in stream.text
