from __future__ import annotations

from typing import Any, TypedDict


class GraphState(TypedDict, total=False):
    actor_id: str
    session_id: str
    mission_id: str | None
    message: str
    correlation_id: str
    graph_run_id: str
    context_product_ids: list[str]
    degraded: bool
    intent: str
    explicit_commerce: bool
    action: str | None
    mission_context: dict[str, Any] | None
    requirements: dict[str, Any]
    search_plan: dict[str, Any]
    candidates: list[dict[str, Any]]
    ranked_candidates: list[dict[str, Any]]
    canonical_candidate: dict[str, Any] | None
    result_payload: dict[str, Any]
    commerce_proposal: dict[str, Any] | None
    policy_allowed: bool
    approval_required: bool
    policy_reason: str
    error: str | None
