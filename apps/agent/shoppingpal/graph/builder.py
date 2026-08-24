from __future__ import annotations

from typing import Any
from uuid import uuid4

from langgraph.graph import END, START, StateGraph

from shoppingpal.domain.missions import MissionStore
from shoppingpal.graph.state import GraphState
from shoppingpal.nodes.workflow import make_nodes
from shoppingpal.retrieval.medusa import CatalogClient
from shoppingpal.schemas import CartProposal, GraphRequest, GraphResponse, IntentType


def _after_requirements(state: GraphState) -> str:
    query = state.get("requirements", {}).get("query", "").strip()
    return "clarify" if len(query) < 3 else "retrieve"


def _route_intent(state: GraphState) -> str:
    return state.get("intent", IntentType.RECOMMEND.value)


def _after_policy(state: GraphState) -> str:
    if state.get("error") or not state.get("policy_allowed", False):
        return "emit"
    if state.get("approval_required", False):
        return "approval"
    return "execute"


class ShoppingGraph:
    def __init__(self, catalog: CatalogClient, missions: MissionStore, checkpointer: Any) -> None:
        nodes = make_nodes(catalog, missions)
        builder = StateGraph(GraphState)
        for name, node in nodes.items():
            builder.add_node(name, node)  # type: ignore[arg-type]

        builder.add_edge(START, "classify_intent")
        builder.add_edge("classify_intent", "load_mission_context")
        builder.add_edge("load_mission_context", "extract_requirements")
        builder.add_conditional_edges(
            "extract_requirements",
            _after_requirements,
            {"clarify": "request_clarification", "retrieve": "plan_retrieval"},
        )
        builder.add_edge("request_clarification", END)
        builder.add_edge("plan_retrieval", "search_catalog")
        builder.add_edge("search_catalog", "hydrate_candidates")
        builder.add_edge("hydrate_candidates", "apply_hard_constraints")
        builder.add_edge("apply_hard_constraints", "rank_candidates")
        builder.add_edge("rank_candidates", "route_intent")
        builder.add_conditional_edges(
            "route_intent",
            _route_intent,
            {
                IntentType.RECOMMEND.value: "recommend",
                IntentType.COMPARE.value: "compare_products",
                IntentType.COMPATIBILITY.value: "compatibility_check",
                IntentType.BUNDLE.value: "build_bundle",
                IntentType.REFINE.value: "recommend",
                IntentType.COMMERCE_ACTION.value: "propose_commerce_action",
            },
        )
        for result_node in ("recommend", "compare_products", "compatibility_check", "build_bundle"):
            builder.add_edge(result_node, "construct_result")
        builder.add_edge("construct_result", END)

        builder.add_edge("propose_commerce_action", "resolve_canonical_entities")
        builder.add_edge("resolve_canonical_entities", "reverify_commerce_state")
        builder.add_edge("reverify_commerce_state", "evaluate_action_policy")
        builder.add_conditional_edges(
            "evaluate_action_policy",
            _after_policy,
            {"emit": "emit_ack", "approval": "request_approval", "execute": "execute_commerce_action"},
        )
        builder.add_edge("request_approval", "emit_ack")
        builder.add_edge("execute_commerce_action", "emit_ack")
        builder.add_edge("emit_ack", END)
        self.compiled = builder.compile(checkpointer=checkpointer)

    async def run(self, request: GraphRequest, *, actor_id: str, correlation_id: str) -> GraphResponse:
        run_id = request.graph_run_id or f"run_{uuid4().hex}"
        initial: GraphState = {
            "actor_id": actor_id,
            "session_id": request.session_id,
            "mission_id": request.mission_id,
            "message": request.message,
            "correlation_id": correlation_id,
            "graph_run_id": run_id,
            "context_product_ids": request.context_product_ids,
        }
        result = await self.compiled.ainvoke(
            initial,
            config={"configurable": {"thread_id": f"{actor_id}:{request.session_id}"}},
        )
        payload = result.get("result_payload") or {"kind": "empty", "products": []}
        proposed_action = None
        if payload.get("kind") == "cart_proposal":
            proposed_action = CartProposal.model_validate(payload)
        return GraphResponse(
            run_id=run_id,
            correlation_id=correlation_id,
            session_id=request.session_id,
            mission_id=request.mission_id,
            intent=IntentType(result.get("intent", IntentType.RECOMMEND.value)),
            payload=payload,
            proposed_action=proposed_action,
            approval_required=bool(result.get("approval_required", False)),
            degraded=bool(result.get("degraded", False)),
        )


def build_shopping_graph(catalog: CatalogClient, missions: MissionStore, checkpointer: Any) -> ShoppingGraph:
    return ShoppingGraph(catalog, missions, checkpointer)
