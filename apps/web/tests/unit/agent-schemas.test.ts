import { describe, expect, it } from "vitest";

import {
  addToCartInput,
  buildBundleInput,
  compareProductsInput,
  productSummarySchema,
  recommendProductInput,
  searchProductsInput,
  updateCartInput,
} from "@/lib/ai/schemas";
import { detectIntent, extractBudgetCents, extractOrdinal, quantityFromText } from "@/lib/ai/demo-intent";

describe("tool input schemas — the grounding contract", () => {
  it("searchProducts accepts a grounded query", () => {
    const parsed = searchProductsInput.parse({
      query: "headphones",
      category: "audio",
      maxPrice: 25000,
      inStockOnly: true,
    });
    expect(parsed.limit).toBe(6); // default applied
  });

  it("searchProducts rejects out-of-range limits and negative prices", () => {
    expect(() => searchProductsInput.parse({ limit: 13 })).toThrow();
    expect(() => searchProductsInput.parse({ minPrice: -1 })).toThrow();
  });

  it("compareProducts requires at least two ids", () => {
    expect(compareProductsInput.safeParse({ productIds: ["a", "b"] }).success).toBe(true);
    expect(compareProductsInput.safeParse({ productIds: ["a"] }).success).toBe(false);
    expect(
      compareProductsInput.safeParse({ productIds: ["a", "b", "c", "d", "e"] }).success,
    ).toBe(false);
  });

  it("cart quantities are clamped by schema bounds", () => {
    expect(addToCartInput.safeParse({ productId: "p1", quantity: 0 }).success).toBe(false);
    expect(addToCartInput.safeParse({ productId: "p1", quantity: 11 }).success).toBe(false);
    expect(addToCartInput.safeParse({ productId: "p1" }).success).toBe(true); // default 1
    // updateCart allows 0 (= remove)
    expect(updateCartInput.safeParse({ productId: "p1", quantity: 0 }).success).toBe(true);
  });

  it("budgets are integer cents only", () => {
    expect(recommendProductInput.safeParse({ productId: "x", budget: 250.5 }).success).toBe(false);
    expect(recommendProductInput.safeParse({ productId: "x", budget: 25000 }).success).toBe(true);
  });

  it("bundle input allows focus tags or explicit ids", () => {
    expect(buildBundleInput.safeParse({ budget: 100000, focusTags: ["laptop"] }).success).toBe(true);
    expect(buildBundleInput.safeParse({ budget: -5 }).success).toBe(false);
  });
});

describe("product summary schema", () => {
  it("validates a complete projection", () => {
    expect(
      productSummarySchema.safeParse({
        id: "id1",
        slug: "s",
        title: "T",
        brand: "B",
        category: "audio",
        description: "D",
        price: 100,
        currency: "USD",
        ratingTenths: 45,
        reviewCount: 10,
        stock: 3,
        tags: [],
        specs: {},
      }).success,
    ).toBe(true);

    // Float price would violate the money invariant.
    expect(
      productSummarySchema.safeParse({
        id: "id1", slug: "s", title: "T", brand: "B", category: "audio",
        description: "D", price: 9.99, currency: "USD", ratingTenths: 45,
        reviewCount: 10, stock: 3, tags: [], specs: {},
      }).success,
    ).toBe(false);
  });
});

describe("demo intent parsing (offline agent)", () => {
  it("extracts budgets in every common phrasing", () => {
    expect(extractBudgetCents("best headphones under $250")).toBe(25000);
    expect(extractBudgetCents("laptop monitor keyboard under 1,800 total")).toBe(180000);
    expect(extractBudgetCents("home gym setup under $1k")).toBe(100000);
    expect(extractBudgetCents("something for 1000 dollars please")).toBe(100000);
    expect(extractBudgetCents("no budget mentioned")).toBeUndefined();
  });

  it("classifies intents deterministically", () => {
    expect(detectIntent("compare these three")).toBe("compare");
    expect(detectIntent("add the second one to my cart")).toBe("add-to-cart");
    expect(detectIntent("build me the best home gym setup under $1,000")).toBe("bundle");
    expect(detectIntent("cheaper alternative?")).toBe("cheaper-alternative");
    expect(detectIntent("what's in my cart?")).toBe("cart-status");
    expect(detectIntent("prepare checkout")).toBe("checkout");
    expect(detectIntent("hi there")).toBe("greeting");
    expect(detectIntent("save this one for later")).toBe("save");
    expect(detectIntent("find me a good monitor")).toBe("search");
  });

  it("resolves ordinals and quantities", () => {
    expect(extractOrdinal("add the second one to my cart")).toBe(2);
    expect(extractOrdinal("option 3 please")).toBe(3);
    expect(extractOrdinal("no ordinal here")).toBeNull();
    expect(quantityFromText("add two of them")).toBe(2);
    expect(quantityFromText("qty 4 of that")).toBe(4);
    expect(quantityFromText("just add it")).toBe(1);
  });
});
