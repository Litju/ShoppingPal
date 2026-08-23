from __future__ import annotations

import hashlib


def operation_id(
    actor_id: str,
    graph_run_id: str,
    action_type: str,
    canonical_target: str,
    action_revision: str,
) -> str:
    material = "|".join((actor_id, graph_run_id, action_type, canonical_target, action_revision))
    digest = hashlib.sha256(material.encode("utf-8")).hexdigest()[:32]
    return f"op_{digest}"
