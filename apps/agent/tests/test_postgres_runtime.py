from __future__ import annotations

import os

import pytest

from shoppingpal.domain.missions import PostgresMissionStore
from shoppingpal.graph.checkpoint import CheckpointRuntime
from shoppingpal.schemas import ShoppingMissionCreate, ShoppingMissionUpdate

DATABASE_URL = os.getenv("AGENT_DATABASE_URL", "")
requires_postgres = pytest.mark.skipif(not DATABASE_URL, reason="AGENT_DATABASE_URL is not configured")


@requires_postgres
async def test_mission_survives_store_restart_in_agent_schema() -> None:
    actor_id = "qualification-postgres"
    first = PostgresMissionStore(DATABASE_URL)
    await first.start()
    mission = await first.create(
        actor_id,
        ShoppingMissionCreate(title="Durable mission", goal="Survive a session restart", budget=12345),
    )
    await first.close()

    second = PostgresMissionStore(DATABASE_URL)
    await second.start()
    try:
        loaded = await second.get(actor_id, mission.mission_id)
        assert loaded is not None
        assert loaded.goal == "Survive a session restart"
        changed = await second.update(
            actor_id,
            mission.mission_id,
            ShoppingMissionUpdate(selected_products=["prod_marlowe"]),
        )
        assert changed is not None
        assert changed.selected_products == ["prod_marlowe"]
        await second._pool.execute(  # pyright: ignore[reportOptionalMemberAccess]
            "DELETE FROM agent.shopping_missions WHERE mission_id = $1",
            mission.mission_id,
        )
    finally:
        await second.close()


@requires_postgres
async def test_postgres_checkpoint_runtime_initializes() -> None:
    checkpoints = CheckpointRuntime("postgres", DATABASE_URL)
    saver = await checkpoints.start()
    try:
        assert saver is not None
    finally:
        await checkpoints.close()
