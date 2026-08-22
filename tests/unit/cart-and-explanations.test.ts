import { describe, expect, it } from "vitest";

import {
  CartError,
  clampQuantity,
  mergedLineQuantities,
  MAX_QTY_PER_LINE,
} from "@/lib/cart/types";
import { computeRecommendation } from "@/lib/ai/explain";
import type { Product } from "@/lib/catalog/types";

describe("cart line validation (pure rules)", () => {
  it("clamps into [1, MAX_QTY_PER_LINE]", () => {
    expect(clampQuantity(1)).toBe(1);
    expect(clampQuantity(5)).toBe(5);
    expect(clampQuantity(999)).toBe(MAX_QTY_PER_LINE);
  });

  it("rejects invalid quantities with typed errors", () => {
    expect(() => clampQuantity(0)).toThrow(CartError);
    expect(() => clampQuantity(-2)).toThrow(CartError);
    try {
      clampQuantity(1.5);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as CartError).code).toBe("invalid_quantity");
    }
  });
});

describe("guest → user cart merge math", () => {
  it("sums quantities per product and caps at the max", () => {
    const merged = mergedLineQuantities(
      new Map([["p1", 4], ["p2", 1]]),
      [
        { productId: "p1", quantity: 3 },
        { productId: "p3", quantity: 2 },
      ],
    );
    expect(merged.get("p1")).toBe(7);
    expect(merged.get("p2")).toBe(1);
    expect(merged.get("p3")).toBe(2);

    const capped = mergedLineQuantities(new Map([["p1", 9]]), [
      { productId: "p1", quantity: 5 },
    ]);
    expect(capped.get("p1")).toBe(MAX_QTY_PER_LINE);
  });

  it("handles an empty guest cart", () => {
    const merged = mergedLineQuantities(new Map([["p1", 2]]), []);
    expect(merged.get("p1")).toBe(2);
  });
});

function product(partial: Partial<Product> & { id: string }): Product {
  return {
    slug: partial.id,
    title: "Thing",
    brand: "Brand",
    category: "audio",
    description: "Desc",
    price: 10000,
    currency: "USD",
    images: [],
    stock: 50,
    ratingTenths: 46,
    reviewCount: 800,
    tags: ["headphones"],
    specs: { Battery: "30 h" },
    featured: false,
    ...partial,
  };
}

describe("grounded recommendation explanations", () => {
  const pick = product({ id: "pick", price: 19900, ratingTenths: 47, reviewCount: 3208, stock: 61, tags: ["headphones", "commuting"] });
  const cheaperPeer = product({ id: "cheap", price: 6900, ratingTenths: 43, reviewCount: 3402, tags: ["earbuds"] });

  it("anchors reasons to the stated budget and use case", () => {
    const rec = computeRecommendation(pick, {
      budget: 25000,
      useCaseTags: ["commuting"],
      peers: [cheaperPeer],
    });
    expect(rec.reasons.join(" ")).toContain("budget");
    expect(rec.reasons.join(" ")).toContain("to spare");
    expect(rec.budgetRemaining).toBe(5100);
    expect(rec.overBudgetBy).toBeNull();
    // Honest tradeoff grounded in peer data.
    expect(rec.tradeoffs[0]).toContain("$130.00");
    expect(rec.tradeoffs[0]).toContain("cheapest option");
  });

  it("calls out over-budget picks instead of hiding it", () => {
    const rec = computeRecommendation(product({ id: "x", price: 30000 }), {
      budget: 25000,
    });
    expect(rec.overBudgetBy).toBe(5000);
    expect(rec.tradeoffs[0]).toContain("over your stated budget");
  });

  it("always surfaces at least one tradeoff", () => {
    const rec = computeRecommendation(pick, {});
    expect(rec.tradeoffs.length).toBeGreaterThan(0);
  });

  it("flags low stock honestly", () => {
    const rec = computeRecommendation(product({ id: "y", stock: 3 }), {
      peers: [product({ id: "z" })],
    });
    expect(`${rec.reasons.join(" ")} ${rec.tradeoffs.join(" ")}`).toMatch(/left in stock/i);
  });
});
