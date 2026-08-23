import { describe, expect, it } from "vitest";

import { agentPayloadToUiResult } from "@/lib/agent/client";

const candidate = {
  product_id: "prod_marlowe",
  variant_id: "variant_marlowe",
  slug: "marlowe-pulse-anc-headphones",
  title: "Marlowe Sound Pulse ANC Headphones",
  brand: "Marlowe Sound",
  category: "audio",
  description: "Canonical product",
  price: 19900,
  currency: "USD",
  stock: 61,
  in_stock: true,
  rating_tenths: 47,
  review_count: 3208,
  tags: ["headphones"],
  specs: { Type: "Over-ear" },
};

describe("Eve result adapter", () => {
  it("keeps recommendations in the existing result and recommendation cards", async () => {
    const result = await agentPayloadToUiResult(
      { kind: "recommendations", products: [candidate], explanation: "canonical" },
      "headphones under $250",
    );

    expect(result.events.map((event) => event.name)).toEqual([
      "searchProducts",
      "recommendProduct",
    ]);
    expect((result.events[0]?.output as { products: Array<{ id: string }> }).products[0]?.id).toBe(
      "prod_marlowe",
    );
  });

  it("maps canonical comparisons to the existing accessible comparison table", async () => {
    const result = await agentPayloadToUiResult(
      {
        kind: "comparison",
        products: [candidate, { ...candidate, product_id: "prod_northwind", title: "Northwind Fjord", price: 24900 }],
        differences: { price: ["$199.00", "$249.00"] },
      },
      "compare headphones",
    );

    const output = result.events[0]?.output as { highlights: string[] };
    expect(result.events[0]?.name).toBe("compareProducts");
    expect(output.highlights[0]).toContain("Biggest price gap is");
  });

  it("does not turn invalid approval or commerce results into a success card", async () => {
    const checkout = await agentPayloadToUiResult(
      { kind: "approval_required", action: "checkout", message: "approval" },
      "prepare checkout",
    );
    const rejected = await agentPayloadToUiResult(
      { kind: "commerce_rejected", message: "not purchasable" },
      "add it to my cart",
    );

    expect(checkout.events).toHaveLength(0);
    expect(checkout.text).toContain("secure checkout page");
    expect(rejected.events).toHaveLength(0);
    expect(rejected.text).toBe("not purchasable");
  });
});
