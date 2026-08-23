from __future__ import annotations

import logging
from contextvars import ContextVar
from dataclasses import dataclass
from uuid import uuid4


@dataclass(frozen=True)
class TraceContext:
    correlation_id: str
    actor_id: str
    eve_session_id: str
    mission_id: str | None = None
    graph_run_id: str | None = None
    commerce_operation_id: str | None = None


_current_context: ContextVar[TraceContext | None] = ContextVar("shoppingpal_trace", default=None)


def new_trace_context(
    actor_id: str,
    eve_session_id: str,
    *,
    mission_id: str | None = None,
    graph_run_id: str | None = None,
    correlation_id: str | None = None,
) -> TraceContext:
    return TraceContext(
        correlation_id=correlation_id or f"corr_{uuid4().hex}",
        actor_id=actor_id,
        eve_session_id=eve_session_id,
        mission_id=mission_id,
        graph_run_id=graph_run_id,
    )


def set_trace_context(context: TraceContext) -> None:
    _current_context.set(context)


def current_trace_context() -> TraceContext | None:
    return _current_context.get()


def log_event(logger: logging.Logger, event: str, **fields: object) -> None:
    context = current_trace_context()
    safe_fields = {
        "event": event,
        "correlation_id": context.correlation_id if context else None,
        "actor_id": context.actor_id if context else None,
        "eve_session_id": context.eve_session_id if context else None,
        "mission_id": context.mission_id if context else None,
        "graph_run_id": context.graph_run_id if context else None,
        **fields,
    }
    logger.info("shoppingpal_event=%s", safe_fields)
