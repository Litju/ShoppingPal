from __future__ import annotations

from base64 import urlsafe_b64encode
from dataclasses import dataclass
from hashlib import sha256
from hmac import compare_digest
from hmac import new as hmac_new
from typing import TYPE_CHECKING
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException, Request

from shoppingpal.schemas import (
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


def _actor_proof(secret: str, actor_id: str) -> str:
    digest = hmac_new(secret.encode(), actor_id.encode(), sha256).digest()
    return urlsafe_b64encode(digest).rstrip(b"=").decode()


def _context(
    request: Request,
    x_actor_id: str | None,
    x_correlation_id: str | None,
    x_agent_internal_token: str | None,
    x_actor_proof: str | None,
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
    actor_id = x_actor_id.strip() if x_actor_id else ""
    if not actor_id or len(actor_id) > 200:
        raise HTTPException(status_code=400, detail="actor identity required")
    if expected:
        actor_secret = runtime.settings.actor_signing_secret
        if not actor_secret or not x_actor_proof or not compare_digest(
            x_actor_proof,
            _actor_proof(actor_secret, actor_id),
        ):
            raise HTTPException(status_code=401, detail="actor identity proof required")
    return RequestContext(
        actor_id=actor_id,
        correlation_id=x_correlation_id or f"corr_{uuid4().hex}",
    )


@router.get("/api/v1/health")
async def health(request: Request) -> dict[str, str]:
    runtime = _runtime(request)
    return {
        "status": "ok",
        "runtime": "langgraph-shoppinggraph",
        "checkpoint_backend": runtime.settings.checkpoint_backend,
    }


@router.post("/api/v1/graph/runs", response_model=GraphResponse)
async def run_graph(
    request: Request,
    body: GraphRequest,
    x_actor_id: str | None = Header(default=None),
    x_correlation_id: str | None = Header(default=None),
    x_agent_internal_token: str | None = Header(default=None),
    x_actor_proof: str | None = Header(default=None),
) -> GraphResponse:
    context = _context(request, x_actor_id, x_correlation_id, x_agent_internal_token, x_actor_proof)
    return await _runtime(request).require_graph().run(
        body,
        actor_id=context.actor_id,
        correlation_id=context.correlation_id,
    )


@router.post("/api/v1/missions", response_model=ShoppingMission, status_code=201)
async def create_mission(
    request: Request,
    body: ShoppingMissionCreate,
    x_actor_id: str | None = Header(default=None),
    x_agent_internal_token: str | None = Header(default=None),
    x_actor_proof: str | None = Header(default=None),
) -> ShoppingMission:
    context = _context(request, x_actor_id, None, x_agent_internal_token, x_actor_proof)
    return await _runtime(request).missions.create(context.actor_id, body)


@router.get("/api/v1/missions", response_model=list[ShoppingMission])
async def list_missions(
    request: Request,
    x_actor_id: str | None = Header(default=None),
    x_agent_internal_token: str | None = Header(default=None),
    x_actor_proof: str | None = Header(default=None),
) -> list[ShoppingMission]:
    context = _context(request, x_actor_id, None, x_agent_internal_token, x_actor_proof)
    return await _runtime(request).missions.list(context.actor_id)


@router.get("/api/v1/missions/{mission_id}", response_model=ShoppingMission)
async def get_mission(
    request: Request,
    mission_id: str,
    x_actor_id: str | None = Header(default=None),
    x_agent_internal_token: str | None = Header(default=None),
    x_actor_proof: str | None = Header(default=None),
) -> ShoppingMission:
    context = _context(request, x_actor_id, None, x_agent_internal_token, x_actor_proof)
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
    x_actor_proof: str | None = Header(default=None),
) -> ShoppingMission:
    context = _context(request, x_actor_id, None, x_agent_internal_token, x_actor_proof)
    mission = await _runtime(request).missions.update(context.actor_id, mission_id, body)
    if mission is None:
        raise HTTPException(status_code=404, detail="mission not found")
    return mission
