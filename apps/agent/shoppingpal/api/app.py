from __future__ import annotations

from contextlib import asynccontextmanager
from dataclasses import dataclass

from fastapi import FastAPI

from shoppingpal.api.routes import router
from shoppingpal.domain.missions import InMemoryMissionStore, MissionStore, PostgresMissionStore
from shoppingpal.eve.runtime import EveRuntime
from shoppingpal.graph.builder import ShoppingGraph, build_shopping_graph
from shoppingpal.graph.checkpoint import CheckpointRuntime
from shoppingpal.retrieval.medusa import CatalogClient, MedusaCatalogClient
from shoppingpal.settings import AgentSettings


@dataclass
class AgentRuntime:
    settings: AgentSettings
    missions: MissionStore
    catalog: CatalogClient
    checkpoints: CheckpointRuntime
    graph: ShoppingGraph | None = None
    eve: EveRuntime | None = None

    async def start(self) -> None:
        if isinstance(self.missions, PostgresMissionStore):
            await self.missions.start()
        saver = await self.checkpoints.start()
        self.graph = build_shopping_graph(self.catalog, self.missions, saver)
        self.eve = EveRuntime(self.graph)

    async def close(self) -> None:
        if isinstance(self.missions, PostgresMissionStore):
            await self.missions.close()
        await self.checkpoints.close()

    def require_graph(self) -> ShoppingGraph:
        if self.graph is None:
            raise RuntimeError("agent runtime has not started")
        return self.graph

    def require_eve(self) -> EveRuntime:
        if self.eve is None:
            raise RuntimeError("Eve runtime has not started")
        return self.eve


def _runtime(
    settings: AgentSettings,
    mission_store: MissionStore | None,
    catalog: CatalogClient | None,
    checkpoint_runtime: CheckpointRuntime | None,
) -> AgentRuntime:
    missions = mission_store or (
        PostgresMissionStore(settings.database_url)
        if settings.database_url
        else InMemoryMissionStore()
    )
    catalog_client = catalog or MedusaCatalogClient(
        settings.medusa_backend_url,
        settings.medusa_publishable_key,
        settings.medusa_region_id,
    )
    checkpoints = checkpoint_runtime or CheckpointRuntime(
        settings.checkpoint_backend,
        settings.database_url,
    )
    return AgentRuntime(settings, missions, catalog_client, checkpoints)


def create_app(
    settings: AgentSettings | None = None,
    *,
    mission_store: MissionStore | None = None,
    catalog: CatalogClient | None = None,
    checkpoint_runtime: CheckpointRuntime | None = None,
) -> FastAPI:
    resolved_settings = settings or AgentSettings.from_env()
    runtime = _runtime(resolved_settings, mission_store, catalog, checkpoint_runtime)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        await runtime.start()
        yield
        await runtime.close()

    app = FastAPI(
        title="ShoppingPal Agent",
        version="0.1.0",
        description="Eve conversational runtime over an explicit LangGraph shopping workflow.",
        lifespan=lifespan,
    )
    app.state.runtime = runtime
    app.include_router(router)
    return app
