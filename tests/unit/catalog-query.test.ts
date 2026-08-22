import { describe, expect, it } from "vitest";

import { SEED_PRODUCTS } from "@/lib/catalog/data/products";
import {
  applyCatalogQuery,
  buildSearchableText,
  deterministicUuid,
  relevanceScore,
  tokenize,
} from "@/lib/catalog/query";
import type { CatalogQuery, Product } from "@/lib/catalog/types";

function makeProduct(overrides: Partial<Product> & { id: string }): Product {
  return {
    slug: overrides.id,
    title: "Test Product",
    brand: "Acme",
    category: "audio",
    description: "A test product",
    price: 10000,
    currency: "USD",
    images: [],
    stock: 10,
    ratingTenths: 45,
    reviewCount: 500,
    tags: ["test"],
    specs: {},
    featured: false,
    ...overrides,
  };
}

const PRODUCTS: Product[] = [
  makeProduct({ id: "a", title: "Pulse ANC Headphones", tags: ["headphones", "commuting"], price: 19900, stock: 5, ratingTenths: 47, reviewCount: 900 }),
  makeProduct({ id: "b", title: "Budget Earbuds", category: "audio", tags: ["earbuds"], price: 4900, stock: 0, ratingTenths: 43, reviewCount: 1200 }),
  makeProduct({ id: "c", title: "Studio Monitor Speaker", category: "audio", tags: ["speakers"], price: 29900, stock: 20, ratingTenths: 49, reviewCount: 300, featured: true }),
  makeProduct({ id: "d", title: "Dev Laptop", category: "computers", tags: ["laptop", "programming"], price: 129900, stock: 8, ratingTenths: 46, reviewCount: 700 }),
];

const SEARCHABLE = new Map(
  PRODUCTS.map((p) => [p.id, buildSearchableText(p)]),
);

function run(query: CatalogQuery) {
  return applyCatalogQuery(PRODUCTS, SEARCHABLE, query);
}

describe("tokenize + relevanceScore", () => {
  it("drops stop words and short tokens", () => {
    expect(tokenize("The best headphones for me")).toEqual(["headphones"]);
  });

  it("weights title matches above tag/description matches", () => {
    const p = PRODUCTS[0]!;
    expect(relevanceScore(p, ["pulse"], SEARCHABLE.get("a") ?? "")).toBeGreaterThan(
      relevanceScore(p, ["test"], SEARCHABLE.get("a") ?? ""),
    );
  });

  it("scores zero when no tokens match", () => {
    expect(relevanceScore(PRODUCTS[1]!, ["zzz"], SEARCHABLE.get("b") ?? "")).toBe(0);
  });
});

describe("applyCatalogQuery filters", () => {
  it("filters by category", () => {
    const { items } = run({ categories: ["audio"] });
    expect(items.map((p) => p.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("applies inclusive price bounds in minor units", () => {
    const { items } = run({ minPrice: 4900, maxPrice: 19900 });
    expect(items.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("filters by minimum rating (tenths)", () => {
    const { items } = run({ minRatingTenths: 45 });
    // d (4.6) qualifies alongside c (4.9) and a (4.7).
    expect(items.map((p) => p.id)).toEqual(["c", "a", "d"]);
  });

  it("filters to in-stock only", () => {
    const { items } = run({ inStockOnly: true });
    expect(items.map((p) => p.id)).not.toContain("b");
  });

  it("matches ANY of the requested tags", () => {
    const { items } = run({ tags: ["earbuds", "programming"] });
    expect(items.map((p) => p.id).sort()).toEqual(["b", "d"]);
  });

  it("matches brands case-insensitively", () => {
    const { items } = run({ brands: ["ACME"] });
    expect(items).toHaveLength(PRODUCTS.length);
  });

  it("ignores invalid numeric bounds instead of throwing", () => {
    const result = run({ minPrice: Number.NaN, maxPrice: undefined });
    expect(result.total).toBe(PRODUCTS.length);
  });

  it("ranks text search by relevance and drops non-matches", () => {
    const { items, total } = run({ q: "noise cancelling headphones pulse" });
    expect(total).toBeGreaterThanOrEqual(1);
    expect(items[0]?.id).toBe("a");
  });

  it("sorts by price ascending and descending", () => {
    expect(run({ sort: "price-asc" }).items[0]?.id).toBe("b");
    expect(run({ sort: "price-desc" }).items[0]?.id).toBe("d");
  });

  it("sorts by rating with reviews as tiebreaker", () => {
    expect(run({ sort: "rating" }).items[0]?.id).toBe("c");
  });

  it("popular sort puts featured first deterministically", () => {
    expect(run({}).items[0]?.id).toBe("c");
  });
});

describe("deterministicUuid", () => {
  it("is stable across calls and unique across slugs", () => {
    const a1 = deterministicUuid("shopping-pal-product", "auralux-aero-14");
    const a2 = deterministicUuid("shopping-pal-product", "auralux-aero-14");
    const b = deterministicUuid("shopping-pal-product", "nordvex-studio-16");
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("seed catalog sanity", () => {
  it("ships ~80 products across all nine required categories", () => {
    expect(SEED_PRODUCTS.length).toBeGreaterThanOrEqual(75);
    const categories = new Set(SEED_PRODUCTS.map((p) => p.category));
    for (const required of [
      "computers",
      "computer-accessories",
      "audio",
      "phones-accessories",
      "fitness",
      "home",
      "kitchen",
      "outdoors",
      "everyday-carry",
    ]) {
      expect(categories.has(required as never)).toBe(true);
    }
  });

  it("never uses lorem ipsum and keeps integer prices", () => {
    for (const p of SEED_PRODUCTS) {
      expect(Number.isInteger(p.price)).toBe(true);
      expect(p.description.toLowerCase()).not.toContain("lorem");
      expect(Object.keys(p.specs).length).toBeGreaterThan(0);
    }
  });
});

