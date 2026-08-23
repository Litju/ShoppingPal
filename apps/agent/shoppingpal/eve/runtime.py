from __future__ import annotations

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field

from shoppingpal.graph.builder import ShoppingGraph
from shoppingpal.observability.context import new_trace_context, set_trace_context
from shoppingpal.schemas import EveEnvelope, GraphRequest


@dataclass
class EveSession:
    session_id: str
    actor_id: str
    messages: list[str] = field(default_factory=list)
    last_product_ids: list[str] = field(default_factory=list)


class EveRuntime:
    """Eve is the session/streaming envelope; ShoppingGraph owns workflow state."""

    MAX_SESSIONS = 1000
    MAX_MESSAGES_PER_SESSION = 30

    def __init__(self, graph: ShoppingGraph) -> None:
        self.graph = graph
        self.sessions: dict[tuple[str, str], EveSession] = {}

    def _session(self, actor_id: str, session_id: str) -> tuple[EveSession, bool]:
        key = (actor_id, session_id)
        session = self.sessions.get(key)
        if session is None:
            session = EveSession(session_id=session_id, actor_id=actor_id)
            self.sessions[key] = session
            if len(self.sessions) > self.MAX_SESSIONS:
                self.sessions.pop(next(iter(self.sessions)))
            return session, True
        self.sessions.pop(key)
        self.sessions[key] = session
        return session, False

    async def handle(self, actor_id: str, request: GraphRequest, correlation_id: str) -> list[EveEnvelope]:
        session, created = self._session(actor_id, request.session_id)
        context = new_trace_context(
            actor_id,
            request.session_id,
            mission_id=request.mission_id,
            graph_run_id=request.graph_run_id,
            correlation_id=correlation_id,
        )
        set_trace_context(context)
        session.messages.append(request.message)
        del session.messages[:-self.MAX_MESSAGES_PER_SESSION]
        if session.last_product_ids:
            request = request.model_copy(update={"context_product_ids": session.last_product_ids})
        response = await self.graph.run(request, actor_id=actor_id, correlation_id=context.correlation_id)
        products = response.payload.get("products")
        if isinstance(products, list):
            session.last_product_ids = [
                str(product.get("product_id"))
                for product in products
                if isinstance(product, dict) and product.get("product_id")
            ][:12]
        events: list[EveEnvelope] = []
        if created:
            events.append(
                EveEnvelope(
                    event="session_started",
                    correlation_id=context.correlation_id,
                    session_id=request.session_id,
                    payload={"runtime": "eve", "model_routing": "deterministic_structured_fallback"},
                ),
            )
        events.append(
            EveEnvelope(
                event="approval_required" if response.approval_required else "graph_result",
                correlation_id=response.correlation_id,
                session_id=response.session_id,
                payload=response.model_dump(mode="json"),
            ),
        )
        return events

    async def stream(self, actor_id: str, request: GraphRequest, correlation_id: str) -> AsyncIterator[str]:
        for envelope in await self.handle(actor_id, request, correlation_id):
            yield f"event: {envelope.event}\ndata: {json.dumps(envelope.model_dump(mode='json'))}\n\n"
