from __future__ import annotations

import re
from typing import Any, Awaitable, Callable, Literal, cast

from langchain_core.runnables import RunnableLambda

from shoppingpal.domain.missions import MissionStore
from shoppingpal.graph.state import GraphState
from shoppingpal.policies.idempotency import operation_id
from shoppingpal.policies.safety import evaluate_policy, explicit_user_commerce_intent
from shoppingpal.ranking.deterministic import rank_candidates
from shoppingpal.retrieval.medusa import CatalogClient
from shoppingpal.schemas import (
    BundleResult,
    Candidate,
    CartProposal,
    CommerceActionProposal,
    CompatibilityAssessment,
    Constraint,
    IntentType,
    ProductComparison,
    RecommendationResult,
    Requirements,
    SearchPlan,
    ShoppingIntent,
)
from shoppingpal.tools.canonical import candidate_revision

Node = Callable[[GraphState], Awaitable[dict[str, Any]]]


def _classify_message(message: str) -> ShoppingIntent:
    lowered = message.casefold()
    if "checkout" in lowered or "pay" in lowered or "purchase" in lowered:
        return ShoppingIntent(intent=IntentType.COMMERCE_ACTION, explicit_commerce=True, action="checkout")
    if ("add" in lowered and "cart" in lowered) or "put in my cart" in lowered:
        return ShoppingIntent(
            intent=IntentType.COMMERCE_ACTION,
            explicit_commerce=explicit_user_commerce_intent(message),
            action="add",
        )
    if "remove from cart" in lowered:
        return ShoppingIntent(intent=IntentType.COMMERCE_ACTION, explicit_commerce=True, action="remove")
    if "change quantity" in lowered or "update quantity" in lowered:
        return ShoppingIntent(intent=IntentType.COMMERCE_ACTION, explicit_commerce=True, action="update")
    if "compatib" in lowered or "work with" in lowered:
        return ShoppingIntent(intent=IntentType.COMPATIBILITY)
    if "build" in lowered and any(word in lowered for word in ("setup", "bundle", "kit", "pack")):
        return ShoppingIntent(intent=IntentType.BUNDLE)
    if "compare" in lowered or " versus " in f" {lowered} ":
        return ShoppingIntent(intent=IntentType.COMPARE)
    if "instead" in lowered or "refine" in lowered or "cheaper" in lowered:
        return ShoppingIntent(intent=IntentType.REFINE)
    return ShoppingIntent(intent=IntentType.RECOMMEND)


_structured_intent = RunnableLambda(_classify_message)


def _parse_requirements(message: str) -> Requirements:
    max_price: int | None = None
    min_price: int | None = None
    maximum = re.search(r"(?:under|below|max(?:imum)?(?: of)?)\s*\$?\s*(\d[\d,]*(?:\.\d{1,2})?)", message.casefold())
    minimum = re.search(r"(?:over|above|min(?:imum)?(?: of)?)\s*\$?\s*(\d[\d,]*(?:\.\d{1,2})?)", message.casefold())
    if maximum:
        max_price = round(float(maximum.group(1).replace(",", "")) * 100)
    if minimum:
        min_price = round(float(minimum.group(1).replace(",", "")) * 100)
    constraints = []
    if "in stock" in message.casefold() or "available" in message.casefold():
        constraints.append(Constraint(key="availability", value="in_stock", hard=True))
    return Requirements(
        query=message,
        max_price=max_price,
        min_price=min_price,
        in_stock_only=True,
        constraints=constraints,
    )


def _catalog_query(message: str) -> str:
    query = re.sub(
        r"\b(add|to|my|cart|put|in|remove|from|change|quantity|qty|update|checkout)\b",
        "",
        message,
        flags=re.IGNORECASE,
    )
    query = re.sub(
        r"\b(?:under|below|max(?:imum)?(?: of)?|over|above|min(?:imum)?(?: of)?)\s*\$?\s*\d[\d,]*(?:\.\d{1,2})?",
        "",
        query,
        flags=re.IGNORECASE,
    )
    query = re.sub(
        r"\b(?:find|me|the|a|an|for|and|recommend|compare|compatibility|compatible|cheaper|instead|refine|build|best|setup|bundle|kit|pack)\b",
        "",
        query,
        flags=re.IGNORECASE,
    )
    return " ".join(query.split())


def _models(values: list[dict[str, Any]]) -> list[Candidate]:
    return [Candidate.model_validate(value) for value in values]


def _ranked_models(values: list[dict[str, Any]]) -> list[Candidate]:
    return [Candidate.model_validate(value["candidate"]) for value in values]


def _mentioned_first(message: str, products: list[Candidate]) -> list[Candidate]:
    lowered = message.casefold()
    mentioned = [
        (lowered.find(product.title.casefold()), product)
        for product in products
        if lowered.find(product.title.casefold()) >= 0
    ]
    mentioned.sort(key=lambda item: item[0])
    mentioned_products = [product for _, product in mentioned]
    mentioned_ids = {product.product_id for product in mentioned_products}
    return [*mentioned_products, *(product for product in products if product.product_id not in mentioned_ids)]


def make_nodes(catalog: CatalogClient, missions: MissionStore) -> dict[str, Node]:
    async def classify_intent(state: GraphState) -> dict[str, Any]:
        intent = ShoppingIntent.model_validate(await _structured_intent.ainvoke(state["message"]))
        return {
            "intent": intent.intent.value,
            "explicit_commerce": intent.explicit_commerce,
            "action": intent.action,
        }

    async def load_mission_context(state: GraphState) -> dict[str, Any]:
        mission_id = state.get("mission_id")
        if not mission_id:
            return {"mission_context": None}
        mission = await missions.get(state["actor_id"], mission_id)
        return {"mission_context": mission.model_dump(mode="json") if mission else None}

    async def extract_requirements(state: GraphState) -> dict[str, Any]:
        requirements = _parse_requirements(state["message"])
        mission = state.get("mission_context") or {}
        if requirements.max_price is None and isinstance(mission.get("budget"), int):
            requirements.max_price = mission["budget"]
        return {"requirements": requirements.model_dump(mode="json")}

    async def request_clarification(state: GraphState) -> dict[str, Any]:
        return {
            "result_payload": {
                "kind": "clarification",
                "question": "What are you shopping for, and is there a budget or must-have constraint?",
                "missing": ["shopping goal"],
            },
        }

    async def plan_retrieval(state: GraphState) -> dict[str, Any]:
        requirements = Requirements.model_validate(state["requirements"])
        return {
            "search_plan": SearchPlan(
                query=_catalog_query(requirements.query),
                constraints=requirements.constraints,
            ).model_dump(mode="json"),
        }

    async def search_catalog(state: GraphState) -> dict[str, Any]:
        plan = SearchPlan.model_validate(state["search_plan"])
        query = "" if state.get("intent") == IntentType.BUNDLE.value else plan.query
        candidates = await catalog.search(query, limit=100)
        if not candidates and query:
            candidates = await catalog.search("", limit=100)
        return {"candidates": [candidate.model_dump(mode="json") for candidate in candidates]}

    async def hydrate_candidates(state: GraphState) -> dict[str, Any]:
        candidate_ids = [candidate["product_id"] for candidate in state.get("candidates", [])]
        direct_ids = re.findall(r"\bprod_[A-Za-z0-9_-]+\b", state["message"])
        context_ids = state.get("context_product_ids", [])
        hydrated = await catalog.get_by_ids(list(dict.fromkeys([*direct_ids, *context_ids, *candidate_ids])))
        return {"candidates": [candidate.model_dump(mode="json") for candidate in hydrated]}

    async def apply_hard_constraints(state: GraphState) -> dict[str, Any]:
        requirements = Requirements.model_validate(state["requirements"])
        candidates = _models(state.get("candidates", []))
        filtered = [
            candidate
            for candidate in candidates
            if (requirements.max_price is None or candidate.price <= requirements.max_price)
            and (requirements.min_price is None or candidate.price >= requirements.min_price)
            and (not requirements.in_stock_only or candidate.in_stock)
        ]
        return {"candidates": [candidate.model_dump(mode="json") for candidate in filtered]}

    async def rank_candidates_node(state: GraphState) -> dict[str, Any]:
        ranked = rank_candidates(
            Requirements.model_validate(state["requirements"]).query,
            _models(state.get("candidates", [])),
        )
        return {"ranked_candidates": [item.model_dump(mode="json") for item in ranked]}

    async def route_intent(state: GraphState) -> dict[str, Any]:
        return {}

    async def recommend(state: GraphState) -> dict[str, Any]:
        products = _ranked_models(state.get("ranked_candidates", []))[:6]
        result = RecommendationResult(
            products=products,
            explanation="These results are ranked from current canonical Medusa price, stock, and catalog data.",
        )
        return {"result_payload": result.model_dump(mode="json")}

    async def compare_products(state: GraphState) -> dict[str, Any]:
        products = _mentioned_first(state["message"], _ranked_models(state.get("ranked_candidates", [])))[:4]
        differences = {
            "price": [f"{product.title}: {product.price} {product.currency}" for product in products],
            "stock": [f"{product.title}: {product.stock} available" for product in products],
        }
        return {"result_payload": ProductComparison(products=products, differences=differences).model_dump(mode="json")}

    async def compatibility_check(state: GraphState) -> dict[str, Any]:
        products = _ranked_models(state.get("ranked_candidates", []))[:4]
        requirements = Requirements.model_validate(state["requirements"])
        reasons = [
            f"Checked canonical specs and availability for {len(products)} candidate(s).",
            *[f"Constraint: {constraint.key}={constraint.value}" for constraint in requirements.constraints],
        ]
        assessment = CompatibilityAssessment(
            compatible=True if products else None,
            products=products,
            reasons=reasons,
        )
        return {"result_payload": assessment.model_dump(mode="json")}

    async def build_bundle(state: GraphState) -> dict[str, Any]:
        requirements = Requirements.model_validate(state["requirements"])
        ranked = _ranked_models(state.get("ranked_candidates", []))
        items: list[Candidate] = []
        total = 0
        for candidate in ranked:
            if not candidate.in_stock or len(items) >= 4:
                continue
            if requirements.max_price is not None and total + candidate.price > requirements.max_price:
                continue
            items.append(candidate)
            total += candidate.price
        if not items and ranked:
            items = [ranked[0]]
            total = ranked[0].price
        budget = requirements.max_price
        remaining = budget - total if budget is not None and total <= budget else None
        overflow = total - budget if budget is not None and total > budget else None
        result = BundleResult(
            items=items,
            total=total,
            budget=budget,
            remaining=remaining,
            overflow=overflow,
            rationale=[
                "Every item is hydrated from current Medusa catalog, price, and inventory data.",
                "The set is limited to purchasable canonical variants within the stated budget when possible.",
            ],
        )
        return {"result_payload": result.model_dump(mode="json")}

    async def construct_result(state: GraphState) -> dict[str, Any]:
        return {"result_payload": state.get("result_payload") or {"kind": "recommendations", "products": []}}

    async def propose_commerce_action(state: GraphState) -> dict[str, Any]:
        ranked = _ranked_models(state.get("ranked_candidates", []))
        direct_ids = re.findall(r"\bprod_[A-Za-z0-9_-]+\b", state["message"])
        ordinal_names = {"first": 1, "1st": 1, "second": 2, "2nd": 2, "third": 3, "3rd": 3}
        ordinal_match = re.search(r"\b(first|1st|second|2nd|third|3rd)\b", state["message"].casefold())
        ordinal = ordinal_names.get(ordinal_match.group(1)) if ordinal_match else None
        context_ids = state.get("context_product_ids", [])
        contextual_id = context_ids[ordinal - 1] if ordinal and len(context_ids) >= ordinal else None
        product_id = direct_ids[0] if direct_ids else contextual_id or (ranked[0].product_id if ranked else None)
        quantity_match = re.search(r"\b(?:quantity|qty|for)\s*(\d+)\b", state["message"], re.IGNORECASE)
        quantity = min(10, max(1, int(quantity_match.group(1)))) if quantity_match else 1
        action = cast(Literal["add", "remove", "update", "checkout"], state.get("action") or "add")
        proposal = CommerceActionProposal(
            action=action,
            product_id=product_id,
            quantity=quantity,
        )
        if product_id is None:
            return {"commerce_proposal": proposal.model_dump(mode="json"), "error": "No canonical product matched the request."}
        return {"commerce_proposal": proposal.model_dump(mode="json")}

    async def resolve_canonical_entities(state: GraphState) -> dict[str, Any]:
        proposal = CommerceActionProposal.model_validate(state["commerce_proposal"])
        if not proposal.product_id:
            return {"error": "The requested product does not exist in Medusa."}
        matches = await catalog.get_by_ids([proposal.product_id])
        if not matches:
            return {"error": "The requested product does not exist in Medusa."}
        return {"canonical_candidate": matches[0].model_dump(mode="json")}

    async def reverify_commerce_state(state: GraphState) -> dict[str, Any]:
        candidate_data = state.get("canonical_candidate")
        proposal = CommerceActionProposal.model_validate(state["commerce_proposal"])
        if not candidate_data:
            return {"error": state.get("error") or "Canonical Medusa state could not be read."}
        candidate = Candidate.model_validate(candidate_data)
        if proposal.action == "add" and not candidate.in_stock:
            return {"error": "The canonical Medusa variant is not purchasable right now."}
        return {"canonical_candidate": candidate.model_dump(mode="json"), "error": None}

    async def evaluate_action_policy(state: GraphState) -> dict[str, Any]:
        intent = IntentType(state["intent"])
        decision = evaluate_policy(intent, state.get("explicit_commerce", False), state.get("action"))
        return {
            "policy_allowed": decision.allowed,
            "approval_required": decision.approval_required,
            "policy_reason": decision.reason,
        }

    async def request_approval(state: GraphState) -> dict[str, Any]:
        return {
            "result_payload": {
                "kind": "approval_required",
                "action": state.get("action"),
                "message": "Please explicitly confirm before a material checkout action can proceed.",
            },
        }

    async def execute_commerce_action(state: GraphState) -> dict[str, Any]:
        candidate = Candidate.model_validate(state["canonical_candidate"])
        proposal = CommerceActionProposal.model_validate(state["commerce_proposal"])
        revision = candidate_revision(candidate)
        op_id = operation_id(
            state["actor_id"],
            state["graph_run_id"],
            proposal.action,
            candidate.product_id,
            f"{revision}:{proposal.quantity}",
        )
        if proposal.action == "add":
            cart_proposal = CartProposal(
                operation_id=op_id,
                actor_id=state["actor_id"],
                product_id=candidate.product_id,
                variant_id=candidate.variant_id,
                quantity=proposal.quantity,
                expected_price=candidate.price,
                currency=candidate.currency,
                canonical_revision=revision,
            )
            return {
                "commerce_proposal": cart_proposal.model_dump(mode="json"),
                "result_payload": cart_proposal.model_dump(mode="json"),
            }
        return {
            "result_payload": {
                "kind": "commerce_proposal",
                "operation_id": op_id,
                "action": proposal.action,
                "product_id": candidate.product_id,
                "variant_id": candidate.variant_id,
                "quantity": proposal.quantity,
                "expected_price": candidate.price,
                "currency": candidate.currency,
                "canonical_revision": revision,
                "requires_ui_execution": True,
            },
        }

    async def emit_ack(state: GraphState) -> dict[str, Any]:
        if state.get("error"):
            return {
                "result_payload": {
                    "kind": "commerce_rejected",
                    "message": state["error"],
                },
            }
        return {"result_payload": state.get("result_payload") or {"kind": "commerce_pending"}}

    return {
        "classify_intent": classify_intent,
        "load_mission_context": load_mission_context,
        "extract_requirements": extract_requirements,
        "request_clarification": request_clarification,
        "plan_retrieval": plan_retrieval,
        "search_catalog": search_catalog,
        "hydrate_candidates": hydrate_candidates,
        "apply_hard_constraints": apply_hard_constraints,
        "rank_candidates": rank_candidates_node,
        "route_intent": route_intent,
        "recommend": recommend,
        "compare_products": compare_products,
        "compatibility_check": compatibility_check,
        "build_bundle": build_bundle,
        "construct_result": construct_result,
        "propose_commerce_action": propose_commerce_action,
        "resolve_canonical_entities": resolve_canonical_entities,
        "reverify_commerce_state": reverify_commerce_state,
        "evaluate_action_policy": evaluate_action_policy,
        "request_approval": request_approval,
        "execute_commerce_action": execute_commerce_action,
        "emit_ack": emit_ack,
    }
