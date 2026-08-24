from __future__ import annotations

import logging
import re
from contextvars import ContextVar
from typing import Any, Protocol

import httpx

from shoppingpal.schemas import Candidate

logger = logging.getLogger(__name__)


class CatalogClient(Protocol):
    async def search(self, query: str, *, limit: int = 24) -> list[Candidate]: ...

    async def get_by_ids(self, product_ids: list[str]) -> list[Candidate]: ...


def _candidate(product: dict[str, Any]) -> Candidate | None:
    variants = product.get("variants") or []
    variant = next(
        (
            item
            for item in variants
            if item.get("manage_inventory") is False or int(item.get("inventory_quantity") or 0) > 0
        ),
        variants[0] if variants else None,
    )
    if not variant or not variant.get("id"):
        return None
    calculated = variant.get("calculated_price") or {}
    stock = int(variant.get("inventory_quantity") or 0)
    metadata = product.get("metadata") or {}
    tags_value = metadata.get("tags")
    tags = tags_value if isinstance(tags_value, list) else []
    specs_value = metadata.get("specs")
    specs = specs_value if isinstance(specs_value, dict) else {}
    return Candidate(
        product_id=str(product["id"]),
        variant_id=str(variant["id"]),
        slug=str(product.get("handle") or product["id"]),
        title=str(product.get("title") or "Untitled product"),
        brand=str(metadata.get("brand") or ""),
        category=str(metadata.get("category") or metadata.get("category_slug") or "other"),
        description=str(product.get("description") or ""),
        price=int(calculated.get("calculated_amount") or 0),
        currency=str(calculated.get("currency_code") or "USD").upper(),
        stock=stock,
        in_stock=variant.get("manage_inventory") is False or stock > 0,
        rating_tenths=int(metadata.get("rating_tenths") or 0),
        review_count=int(metadata.get("review_count") or 0),
        tags=[str(tag) for tag in tags if isinstance(tag, str)],
        specs={str(key): str(value) for key, value in specs.items()},
    )


class MedusaCatalogClient:
    """Canonical commerce hydration and fallback catalog client."""

    def __init__(self, base_url: str, publishable_key: str, region_id: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.publishable_key = publishable_key
        self.region_id = region_id

    def _headers(self) -> dict[str, str]:
        return {"x-publishable-api-key": self.publishable_key}

    def _fields(self) -> str:
        return ",".join(
            (
                "id",
                "handle",
                "title",
                "description",
                "metadata",
                "+variants.id",
                "+variants.sku",
                "+variants.manage_inventory",
                "+variants.inventory_quantity",
                "+variants.calculated_price.calculated_amount",
                "+variants.calculated_price.currency_code",
            ),
        )

    async def search(self, query: str, *, limit: int = 24) -> list[Candidate]:
        params = {
            "limit": str(min(limit, 100)),
            "region_id": self.region_id,
            "fields": self._fields(),
        }
        if query.strip():
            params["q"] = query.strip()
        async with httpx.AsyncClient(base_url=self.base_url, timeout=10.0) as client:
            response = await client.get("/store/products", params=params, headers=self._headers())
            response.raise_for_status()
            products = response.json().get("products", [])
        return [candidate for product in products if (candidate := _candidate(product)) is not None]

    async def get_by_ids(self, product_ids: list[str]) -> list[Candidate]:
        if not product_ids:
            return []
        async with httpx.AsyncClient(base_url=self.base_url, timeout=10.0) as client:
            results: list[Candidate] = []
            for product_id in product_ids:
                response = await client.get(
                    f"/store/products/{product_id}",
                    params={"region_id": self.region_id, "fields": self._fields()},
                    headers=self._headers(),
                )
                if response.status_code == 404:
                    continue
                response.raise_for_status()
                candidate = _candidate(response.json().get("product", {}))
                if candidate is not None:
                    results.append(candidate)
        return results


class TypesenseCatalogClient:
    """Search disposable Typesense ids, then hydrate every result from Medusa."""

    def __init__(self, canonical: MedusaCatalogClient, base_url: str, api_key: str) -> None:
        self.canonical = canonical
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self._degraded: ContextVar[bool] = ContextVar("shoppingpal_typesense_degraded", default=False)

    @property
    def degraded(self) -> bool:
        return self._degraded.get()

    def _headers(self) -> dict[str, str]:
        return {"X-TYPESENSE-API-KEY": self.api_key}

    async def search(self, query: str, *, limit: int = 24) -> list[Candidate]:
        self._degraded.set(False)
        if not self.base_url or not self.api_key:
            self._degraded.set(True)
            return await self.canonical.search(query, limit=limit)
        try:
            params = {
                "q": query.strip() or "*",
                "query_by": "title,brand,category,description,tags,handle,sku,specs",
                "per_page": str(min(limit, 100)),
                "page": "1",
            }
            async with httpx.AsyncClient(base_url=self.base_url, timeout=10.0) as client:
                response = await client.get(
                    "/collections/products/documents/search",
                    params=params,
                    headers=self._headers(),
                )
                response.raise_for_status()
                hits = response.json().get("hits", [])
            ids = list(
                dict.fromkeys(
                    str(hit["document"]["id"])
                    for hit in hits
                    if isinstance(hit, dict)
                    and isinstance(hit.get("document"), dict)
                    and hit["document"].get("id")
                ),
            )
            if not ids:
                self._degraded.set(True)
                return await self.canonical.search(query, limit=limit)
            hydrated = await self.canonical.get_by_ids(ids)
            if not hydrated:
                self._degraded.set(True)
                return await self.canonical.search(query, limit=limit)
            by_id = {candidate.product_id: candidate for candidate in hydrated}
            matched = [
                by_id[product_id]
                for product_id in ids
                if product_id in by_id and _matches_query(by_id[product_id], query)
            ]
            return matched or await self.canonical.search(query, limit=limit)
        except (httpx.HTTPError, TypeError, ValueError, KeyError) as error:
            self._degraded.set(True)
            logger.warning("Typesense unavailable; falling back to canonical Medusa search: %s", error)
            return await self.canonical.search(query, limit=limit)

    async def get_by_ids(self, product_ids: list[str]) -> list[Candidate]:
        return await self.canonical.get_by_ids(product_ids)


def _matches_query(candidate: Candidate, query: str) -> bool:
    tokens = re.findall(r"[a-z0-9]+", query.casefold())
    if not tokens:
        return True
    haystack = " ".join(
        (
            candidate.title,
            candidate.brand,
            candidate.category,
            candidate.description,
            candidate.slug,
            *candidate.tags,
            *candidate.specs.keys(),
            *candidate.specs.values(),
        ),
    ).casefold()
    return any(token in haystack for token in tokens)
