from __future__ import annotations

import re
from dataclasses import dataclass

from shoppingpal.schemas import IntentType


@dataclass(frozen=True)
class PolicyDecision:
    allowed: bool
    approval_required: bool
    reason: str


def explicit_user_commerce_intent(message: str) -> bool:
    """Only user-authored action words can authorize a reversible cart proposal."""
    lowered = message.casefold()
    if any(
        phrase in lowered
        for phrase in (
            "add to cart",
            "to my cart",
            "put in my cart",
            "remove from cart",
            "change quantity",
            "update quantity",
        )
    ):
        return True
    return bool(
        re.search(
            r"\b(?:add|put)\s+(?:the\s+)?(?:first|second|third|it|this|that|one)\b",
            lowered,
        )
    )


def evaluate_policy(intent: IntentType, explicit: bool, action: str | None) -> PolicyDecision:
    if intent is not IntentType.COMMERCE_ACTION:
        return PolicyDecision(True, False, "read-only shopping workflow")
    if action == "checkout":
        return PolicyDecision(True, True, "material checkout requires explicit approval")
    if action in {"add", "remove", "update"} and explicit:
        return PolicyDecision(True, False, "explicit reversible customer action")
    return PolicyDecision(False, False, "commerce mutation requires explicit user intent")


def untrusted_catalog_text(text: str) -> str:
    """Keep retrieved text visibly data-only; it is never parsed as instructions."""
    return f"<untrusted_catalog_data>{text}</untrusted_catalog_data>"
