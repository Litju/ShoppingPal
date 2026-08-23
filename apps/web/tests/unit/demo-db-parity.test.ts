import { describe, expect, it } from "vitest";

import { StaticCatalogProvider } from "@/lib/catalog/static-provider";
import { makeCartLine, makeSeedProduct } from "@shoppingpal/test-utils";

/**
 * Browse-only degraded mode keeps deterministic catalog ids and pure contract
 * fixtures available without creating a second commerce authority.
 */
describe("degraded catalog / contract parity", () => {
  it("static-catalog ids are deterministic and stable across instances", async () => {
    const a = new StaticCatalogProvider();
    const b = new StaticCatalogProvider();
    const [pa, pb] = await Promise.all([a.search({ pageSize: 60 }), b.search({ pageSize: 60 })]);
    expect(pa.items.map((p) => p.id)).toEqual(pb.items.map((p) => p.id));
  });

  it("shared test fixtures produce contract-shaped cart lines", () => {
    const line = makeCartLine({ unitPrice: 2500, quantity: 2 });
    expect(line.lineTotal).toBe(5000);
    const product = makeSeedProduct({ slug: "fixture-parity", price: 4900 });
    expect(product.price).toBe(4900);
    expect(product.currency).toBe("USD");
  });
});
