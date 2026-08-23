from __future__ import annotations

from dataclasses import dataclass
from hmac import compare_digest
from typing import TYPE_CHECKING
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse

from shoppingpal.schemas import (
    EveEnvelope,
    EveMessageRequest,
    GraphRequest,
    GraphResponse,
    ShoppingMission,
    ShoppingMissionCreate,
    ShoppingMissionUpdate,
)

if TYPE_CHECKING:
    from shoppingpal.api.app import AgentRuntime


router = APIRouter()


@dataclass(frozen=True)
class RequestContext:
    actor_id: str
    correlation_id: str


def _runtime(request: Request) -> AgentRuntime:
    return request.app.state.runtime


def _context(
    request: Request,
    x_actor_id: str | None,
    x_correlation_id: str | None,
    x_agent_internal_token: str | None,
) -> RequestContext:
    runtime = _runtime(request)
    expected = runtime.settings.internal_token
    if expected:
        if not x_agent_internal_token or not compare_digest(x_agent_internal_token, expected):
            raise HTTPException(status_code=401, detail="agent internal authentication required")
    elif not (
        runtime.settings.allow_unauthenticated_local
        and runtime.settings.host in {"127.0.0.1", "localhost", "::1"}
    ):
        raise HTTPException(status_code=503, detail="agent internal authentication is not configured")
    return RequestContext(
        actor_id=x_actor_id or "guest",
        correlation_id=x_correlation_id or f"corr_{uuid4().hex}",
    )


@router.get("/api/v1/health")
async def health(request: Request) -> dict[str, str]:
    runtime = _runtime(request)
    return {
        "status": "ok",
        "runtime": "eve-shoppinggraph",
        "checkpoint_backend": runtime.settings.checkpoint_backend,
    }


@router.post("/api/v1/graph/runs", response_model=GraphResponse)
async def run_graph(
    request: Request,
    body: GraphRequest,
    x_actor_id: str | None = Header(default=None),
    x_correlation_id: str | None = Header(default=None),
    x_agent_internal_token: str | None = Header(default=None),
) -> GraphResponse:
    context = _context(request, x_actor_id, x_correlation_id, x_agent_internal_token)
    return await _runtime(request).require_graph().run(
        body,
        actor_id=context.actor_id,
        correlation_id=context.correlation_id,
    )


@router.post("/api/v1/eve/sessions/{session_id}/messages", response_model=list[EveEnvelope])
async def eve_message(
    request: Request,
    session_id: str,
    body: EveMessageRequest,
    x_actor_id: str | None = Header(default=None),
    x_correlation_id: str | None = Header(default=None),
    x_agent_internal_token: str | None = Header(default=None),
) -> list[EveEnvelope]:
    context = _context(request, x_actor_id, x_correlation_id, x_agent_internal_token)
    graph_request = GraphRequest(
        session_id=session_id,
        message=body.message,
        mission_id=body.mission_id,
        context_product_ids=body.context_product_ids,
    )
    return await _runtime(request).require_eve().handle(
        context.actor_id,
        graph_request,
        context.correlation_id,
    )


@router.post("/api/v1/eve/sessions/{session_id}/stream")
async def eve_stream(
    request: Request,
    session_id: str,
    body: EveMessageRequest,
    x_actor_id: str | None = Header(default=None),
    x_correlation_id: str | None = Header(default=None),
    x_agent_internal_token: str | None = Header(default=None),
):
    context = _context(request, x_actor_id, x_correlation_id, x_agent_internal_token)
    graph_request = GraphRequest(
        session_id=session_id,
        message=body.message,
        mission_id=body.mission_id,
        context_product_ids=body.context_product_ids,
    )
    return StreamingResponse(
        _runtime(request).require_eve().stream(context.actor_id, graph_request, context.correlation_id),
        media_type="text/event-stream",
        headers={"cache-control": "no-cache", "x-accel-buffering": "no"},
    )


@router.post("/api/v1/missions", response_model=ShoppingMission, status_code=201)
async def create_mission(
    request: Request,
    body: ShoppingMissionCreate,
    x_actor_id: str | None = Header(default=None),
    x_agent_internal_token: str | None = Header(default=None),
) -> ShoppingMission:
    context = _context(request, x_actor_id, None, x_agent_internal_token)
    return await _runtime(request).missions.create(context.actor_id, body)


@router.get("/api/v1/missions", response_model=list[ShoppingMission])
async def list_missions(
    request: Request,
    x_actor_id: str | None = Header(default=None),
    x_agent_internal_token: str | None = Header(default=None),
) -> list[ShoppingMission]:
    context = _context(request, x_actor_id, None, x_agent_internal_token)
    return await _runtime(request).missions.list(context.actor_id)


@router.get("/api/v1/missions/{mission_id}", response_model=ShoppingMission)
async def get_mission(
    request: Request,
    mission_id: str,
    x_actor_id: str | None = Header(default=None),
    x_agent_internal_token: str | None = Header(default=None),
) -> ShoppingMission:
    context = _context(request, x_actor_id, None, x_agent_internal_token)
    mission = await _runtime(request).missions.get(context.actor_id, mission_id)
    if mission is None:
        raise HTTPException(status_code=404, detail="mission not found")
    return mission


@router.patch("/api/v1/missions/{mission_id}", response_model=ShoppingMission)
async def update_mission(
    request: Request,
    mission_id: str,
    body: ShoppingMissionUpdate,
    x_actor_id: str | None = Header(default=None),
    x_agent_internal_token: str | None = Header(default=None),
) -> ShoppingMission:
    context = _context(request, x_actor_id, None, x_agent_internal_token)
    mission = await _runtime(request).missions.update(context.actor_id, mission_id, body)
    if mission is None:
        raise HTTPException(status_code=404, detail="mission not found")
    return mission
