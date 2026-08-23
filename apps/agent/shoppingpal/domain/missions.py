from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any, Protocol
from uuid import uuid4

from shoppingpal.schemas import (
    ShoppingMission,
    ShoppingMissionCreate,
    ShoppingMissionUpdate,
)


class MissionStore(Protocol):
    async def create(self, actor_id: str, payload: ShoppingMissionCreate) -> ShoppingMission: ...

    async def get(self, actor_id: str, mission_id: str) -> ShoppingMission | None: ...

    async def list(self, actor_id: str) -> list[ShoppingMission]: ...

    async def update(
        self,
        actor_id: str,
        mission_id: str,
        payload: ShoppingMissionUpdate,
    ) -> ShoppingMission | None: ...


class InMemoryMissionStore:
    """Test/degraded store; production settings select Postgres."""

    def __init__(self) -> None:
        self._missions: dict[tuple[str, str], ShoppingMission] = {}
        self._lock = asyncio.Lock()

    async def create(self, actor_id: str, payload: ShoppingMissionCreate) -> ShoppingMission:
        async with self._lock:
            now = datetime.now(timezone.utc)
            mission = ShoppingMission(
                mission_id=f"mission_{uuid4().hex}",
                actor_id=actor_id,
                **payload.model_dump(),
                created_at=now,
                updated_at=now,
            )
            self._missions[(actor_id, mission.mission_id)] = mission
            return mission

    async def get(self, actor_id: str, mission_id: str) -> ShoppingMission | None:
        return self._missions.get((actor_id, mission_id))

    async def list(self, actor_id: str) -> list[ShoppingMission]:
        return [mission for (owner, _), mission in self._missions.items() if owner == actor_id]

    async def update(
        self,
        actor_id: str,
        mission_id: str,
        payload: ShoppingMissionUpdate,
    ) -> ShoppingMission | None:
        async with self._lock:
            current = self._missions.get((actor_id, mission_id))
            if current is None:
                return None
            values = current.model_dump()
            values.update(payload.model_dump(exclude_unset=True))
            values["updated_at"] = datetime.now(timezone.utc)
            updated = ShoppingMission.model_validate(values)
            self._missions[(actor_id, mission_id)] = updated
            return updated


class PostgresMissionStore:
    """Durable agent-domain state in the shared Postgres instance, isolated by schema."""

    def __init__(self, database_url: str) -> None:
        self.database_url = database_url
        self._pool: Any = None

    async def start(self) -> None:
        import asyncpg

        self._pool = await asyncpg.create_pool(self.database_url, min_size=1, max_size=5)
        async with self._pool.acquire() as connection:
            await connection.execute("CREATE SCHEMA IF NOT EXISTS agent")
            await connection.execute(
                """
                CREATE TABLE IF NOT EXISTS agent.shopping_missions (
                    mission_id TEXT PRIMARY KEY,
                    actor_id TEXT NOT NULL,
                    customer_id TEXT,
                    title TEXT NOT NULL,
                    goal TEXT NOT NULL,
                    budget BIGINT,
                    currency TEXT NOT NULL,
                    hard_constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
                    soft_preferences JSONB NOT NULL DEFAULT '[]'::jsonb,
                    selected_products JSONB NOT NULL DEFAULT '[]'::jsonb,
                    rejected_products JSONB NOT NULL DEFAULT '[]'::jsonb,
                    open_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
                    compatibility_requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
                    status TEXT NOT NULL DEFAULT 'active',
                    created_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                )
                """,
            )
            await connection.execute(
                "CREATE INDEX IF NOT EXISTS shopping_missions_actor_idx "
                "ON agent.shopping_missions (actor_id, updated_at DESC)",
            )

    async def close(self) -> None:
        if self._pool is not None:
            await self._pool.close()
            self._pool = None

    def _require_pool(self) -> Any:
        if self._pool is None:
            raise RuntimeError("PostgresMissionStore has not been started")
        return self._pool

    @staticmethod
    def _json(value: object) -> str:
        return json.dumps(value, separators=(",", ":"))

    @staticmethod
    def _from_row(row: Any) -> ShoppingMission:
        values = dict(row)
        for key in (
            "hard_constraints",
            "soft_preferences",
            "selected_products",
            "rejected_products",
            "open_questions",
            "compatibility_requirements",
        ):
            if isinstance(values[key], str):
                values[key] = json.loads(values[key])
        return ShoppingMission.model_validate(values)

    async def create(self, actor_id: str, payload: ShoppingMissionCreate) -> ShoppingMission:
        now = datetime.now(timezone.utc)
        mission = ShoppingMission(
            mission_id=f"mission_{uuid4().hex}",
            actor_id=actor_id,
            **payload.model_dump(),
            created_at=now,
            updated_at=now,
        )
        values = mission.model_dump()
        async with self._require_pool().acquire() as connection:
            await connection.execute(
                """
                INSERT INTO agent.shopping_missions (
                    mission_id, actor_id, customer_id, title, goal, budget, currency,
                    hard_constraints, soft_preferences, selected_products, rejected_products,
                    open_questions, compatibility_requirements, status, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb,
                          $11::jsonb, $12::jsonb, $13::jsonb, $14, $15, $16)
                """,
                mission.mission_id,
                mission.actor_id,
                mission.customer_id,
                mission.title,
                mission.goal,
                mission.budget,
                mission.currency,
                self._json(values["hard_constraints"]),
                self._json(values["soft_preferences"]),
                self._json(values["selected_products"]),
                self._json(values["rejected_products"]),
                self._json(values["open_questions"]),
                self._json(values["compatibility_requirements"]),
                mission.status.value,
                mission.created_at,
                mission.updated_at,
            )
        return mission

    async def get(self, actor_id: str, mission_id: str) -> ShoppingMission | None:
        async with self._require_pool().acquire() as connection:
            row = await connection.fetchrow(
                "SELECT * FROM agent.shopping_missions WHERE actor_id = $1 AND mission_id = $2",
                actor_id,
                mission_id,
            )
        return self._from_row(row) if row else None

    async def list(self, actor_id: str) -> list[ShoppingMission]:
        async with self._require_pool().acquire() as connection:
            rows = await connection.fetch(
                "SELECT * FROM agent.shopping_missions WHERE actor_id = $1 "
                "ORDER BY updated_at DESC",
                actor_id,
            )
        return [self._from_row(row) for row in rows]

    async def update(
        self,
        actor_id: str,
        mission_id: str,
        payload: ShoppingMissionUpdate,
    ) -> ShoppingMission | None:
        current = await self.get(actor_id, mission_id)
        if current is None:
            return None
        values = current.model_dump()
        values.update(payload.model_dump(exclude_unset=True))
        values["updated_at"] = datetime.now(timezone.utc)
        updated = ShoppingMission.model_validate(values)
        serialized = updated.model_dump()
        async with self._require_pool().acquire() as connection:
            await connection.execute(
                """
                UPDATE agent.shopping_missions SET
                    title = $1, goal = $2, budget = $3, currency = $4,
                    hard_constraints = $5::jsonb, soft_preferences = $6::jsonb,
                    selected_products = $7::jsonb, rejected_products = $8::jsonb,
                    open_questions = $9::jsonb, compatibility_requirements = $10::jsonb,
                    status = $11, updated_at = $12
                WHERE actor_id = $13 AND mission_id = $14
                """,
                updated.title,
                updated.goal,
                updated.budget,
                updated.currency,
                self._json(serialized["hard_constraints"]),
                self._json(serialized["soft_preferences"]),
                self._json(serialized["selected_products"]),
                self._json(serialized["rejected_products"]),
                self._json(serialized["open_questions"]),
                self._json(serialized["compatibility_requirements"]),
                updated.status.value,
                updated.updated_at,
                actor_id,
                mission_id,
            )
        return updated
