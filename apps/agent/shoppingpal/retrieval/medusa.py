from __future__ import annotations

from typing import Any, Protocol

import httpx

from shoppingpal.schemas import Candidate


class CatalogClient(Protocol):
    async def search(self, query: str, *, limit: int = 24) -> list[Candidate]: ...

    async def get_by_ids(self, product_ids: list[str]) -> list[Candidate]: ...


def _candidate(product: dict[str, Any]) -> Candidate | None:
    variants = product.get("variants") or []
    variant = variants[0] if variants else None
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
    """Agent discovery reads Medusa directly; Typesense is never an authority here."""

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
