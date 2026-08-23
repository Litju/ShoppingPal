from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field


class IntentType(StrEnum):
    RECOMMEND = "recommend"
    COMPARE = "compare"
    COMPATIBILITY = "compatibility"
    BUNDLE = "bundle"
    REFINE = "refine"
    COMMERCE_ACTION = "commerce_action"


class MissionStatus(StrEnum):
    ACTIVE = "active"
    PAUSED = "paused"
    COMPLETE = "complete"
    ARCHIVED = "archived"


class Candidate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    product_id: str
    variant_id: str
    slug: str
    title: str
    brand: str = ""
    category: str = "other"
    description: str = ""
    price: int = Field(ge=0)
    currency: str = "USD"
    stock: int = Field(ge=0)
    in_stock: bool
    rating_tenths: int = Field(default=0, ge=0)
    review_count: int = Field(default=0, ge=0)
    tags: list[str] = Field(default_factory=list)
    specs: dict[str, str] = Field(default_factory=dict)


class ShoppingIntent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent: IntentType
    explicit_commerce: bool = False
    action: Literal["add", "remove", "update", "checkout"] | None = None


class Constraint(BaseModel):
    key: str
    value: str
    hard: bool = True


class Preference(BaseModel):
    key: str
    value: str


class SearchPlan(BaseModel):
    query: str
    constraints: list[Constraint] = Field(default_factory=list)


class RequirementClarification(BaseModel):
    question: str
    missing: list[str] = Field(default_factory=list)


class Requirements(BaseModel):
    query: str
    max_price: int | None = Field(default=None, ge=0)
    min_price: int | None = Field(default=None, ge=0)
    in_stock_only: bool = True
    constraints: list[Constraint] = Field(default_factory=list)
    preferences: list[Preference] = Field(default_factory=list)


class RankedCandidate(BaseModel):
    candidate: Candidate
    score: float
    reasons: list[str] = Field(default_factory=list)


class RecommendationResult(BaseModel):
    kind: Literal["recommendations"] = "recommendations"
    products: list[Candidate]
    explanation: str


class ProductComparison(BaseModel):
    kind: Literal["comparison"] = "comparison"
    products: list[Candidate]
    differences: dict[str, list[str]]


class CompatibilityAssessment(BaseModel):
    kind: Literal["compatibility"] = "compatibility"
    compatible: bool | None
    products: list[Candidate]
    reasons: list[str]


class BundleResult(BaseModel):
    kind: Literal["bundle"] = "bundle"
    items: list[Candidate]
    total: int = Field(ge=0)
    budget: int | None = Field(default=None, ge=0)
    remaining: int | None = None
    overflow: int | None = None
    rationale: list[str] = Field(default_factory=list)


class CommerceActionProposal(BaseModel):
    action: Literal["add", "remove", "update", "checkout"]
    product_id: str | None = None
    variant_id: str | None = None
    quantity: int = Field(default=1, ge=1, le=10)


class CartProposal(BaseModel):
    kind: Literal["cart_proposal"] = "cart_proposal"
    operation_id: str
    actor_id: str
    product_id: str
    variant_id: str
    quantity: int = Field(ge=1, le=10)
    expected_price: int = Field(ge=0)
    currency: str
    canonical_revision: str
    requires_ui_execution: Literal[True] = True


class CommerceMutationAck(BaseModel):
    kind: Literal["cart_mutation_ack"] = "cart_mutation_ack"
    operation_id: str
    status: Literal["acknowledged", "rejected", "pending"]
    message: str
    cart: dict[str, Any] | None = None


class ShoppingMissionCreate(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    goal: str = Field(min_length=1, max_length=2000)
    budget: int | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    hard_constraints: list[Constraint] = Field(default_factory=list)
    soft_preferences: list[Preference] = Field(default_factory=list)
    selected_products: list[str] = Field(default_factory=list)
    rejected_products: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    compatibility_requirements: list[str] = Field(default_factory=list)


class ShoppingMissionUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    goal: str | None = Field(default=None, min_length=1, max_length=2000)
    budget: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    hard_constraints: list[Constraint] | None = None
    soft_preferences: list[Preference] | None = None
    selected_products: list[str] | None = None
    rejected_products: list[str] | None = None
    open_questions: list[str] | None = None
    compatibility_requirements: list[str] | None = None
    status: MissionStatus | None = None


class ShoppingMission(BaseModel):
    mission_id: str = Field(default_factory=lambda: f"mission_{uuid4().hex}")
    actor_id: str
    customer_id: str | None = None
    title: str
    goal: str
    budget: int | None = None
    currency: str = "USD"
    hard_constraints: list[Constraint] = Field(default_factory=list)
    soft_preferences: list[Preference] = Field(default_factory=list)
    selected_products: list[str] = Field(default_factory=list)
    rejected_products: list[str] = Field(default_factory=list)
    open_questions: list[str] = Field(default_factory=list)
    compatibility_requirements: list[str] = Field(default_factory=list)
    status: MissionStatus = MissionStatus.ACTIVE
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class GraphRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    session_id: str = Field(default_factory=lambda: f"graph_{uuid4().hex}", min_length=1, max_length=120)
    mission_id: str | None = Field(default=None, max_length=120)
    graph_run_id: str | None = Field(default=None, max_length=120)
    context_product_ids: list[str] = Field(default_factory=list, max_length=12)


class GraphResponse(BaseModel):
    run_id: str
    correlation_id: str
    session_id: str
    mission_id: str | None = None
    intent: IntentType
    payload: dict[str, Any]
    proposed_action: CartProposal | None = None
    approval_required: bool = False
    degraded: bool = False
