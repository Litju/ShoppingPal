import { describe, expect, it } from "vitest";

import type { CatalogProvider, Product } from "@shoppingpal/contracts";
import {
  TypesenseCatalogProvider,
} from "@/lib/catalog/typesense-provider";
import type { TypesenseSearchClient } from "@/lib/commerce/typesense-client";

const canonicalHeadphones: Product = {
  id: "prod_marlowe",
  slug: "marlowe-pulse-anc-headphones",
  title: "Marlowe Sound Pulse ANC Headphones",
  brand: "Marlowe Sound",
  category: "audio",
  description: "Noise cancelling headphones for commuting.",
  price: 19900,
  currency: "USD",
  images: [],
  stock: 61,
  ratingTenths: 47,
  reviewCount: 3208,
  tags: ["headphones", "commuting"],
  specs: {},
  featured: true,
};

const soldOutHeadphones = { ...canonicalHeadphones, id: "prod_sold_out", stock: 0 };

function canonical(products: Product[]): CatalogProvider {
  return {
    name: "medusa",
    search: async () => ({ items: products, total: products.length, page: 1, pageSize: 24 }),
    getById: async (id) => products.find((product) => product.id === id) ?? null,
    getBySlug: async (slug) => products.find((product) => product.slug === slug) ?? null,
    getByIds: async (ids) => ids.flatMap((id) => products.filter((product) => product.id === id)),
    featured: async () => products,
    related: async () => products,
    categories: async () => [],
  };
}

function staleClient(...ids: string[]): TypesenseSearchClient {
  return {
    search: async () => ({
      found: ids.length,
      hits: ids.map((id) => ({ document: { id } })),
    }),
  };
}

describe("TypesenseCatalogProvider", () => {
  it("rehydrates current price and stock from Medusa", async () => {
    const provider = new TypesenseCatalogProvider(
      canonical([canonicalHeadphones]),
      staleClient("prod_marlowe"),
    );

    const result = await provider.search({ q: "headphones", inStockOnly: true });

    expect(result.items[0]).toMatchObject({ id: "prod_marlowe", price: 19900, stock: 61 });
  });

  it("does not let a stale low Typesense price authorize a canonical price filter", async () => {
    const provider = new TypesenseCatalogProvider(
      canonical([canonicalHeadphones]),
      staleClient("prod_marlowe"),
    );

    const result = await provider.search({ q: "headphones", maxPrice: 10000 });

    expect(result.items).toHaveLength(0);
  });

  it("does not let stale in-stock discovery authorize a canonical out-of-stock item", async () => {
    const provider = new TypesenseCatalogProvider(
      canonical([soldOutHeadphones]),
      staleClient("prod_sold_out"),
    );

    const result = await provider.search({ q: "headphones", inStockOnly: true });

    expect(result.items).toHaveLength(0);
  });

  it("falls back when Typesense has no candidates", async () => {
    const provider = new TypesenseCatalogProvider(
      canonical([canonicalHeadphones]),
      staleClient(),
    );

    const result = await provider.search({ q: "headphones" });

    expect(result.items).toEqual([canonicalHeadphones]);
  });
});
