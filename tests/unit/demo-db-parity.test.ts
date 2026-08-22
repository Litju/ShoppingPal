import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "@/db/schema";
import { runMigrations, type Database } from "@/lib/db";
import { upsertSeedProducts } from "@/lib/db/seed";
import { StaticCatalogProvider } from "@/lib/catalog/static-provider";
import { DrizzleCartProvider } from "@/lib/cart/drizzle-cart-provider";

/**
 * Regression coverage for the baseline PDP defect: on a fresh demo database
 * the products table was empty while the UI catalog served static data, so
 * every "Add to cart" failed with invalid_product and the header badge never
 * updated. Seed-on-boot must keep both worlds consistent.
 */
describe("demo database / catalog parity", () => {
  it("seeded database accepts static-catalog product ids for cart mutation", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema }) as unknown as Database;
    await runMigrations(db);
    const seeded = await upsertSeedProducts(db);
    expect(seeded).toBe(86);

    const catalog = new StaticCatalogProvider();
    const first = (await catalog.search({ categories: ["audio"], pageSize: 1 })).items[0];
    if (!first) throw new Error("expected an audio product in seed data");

    const cart = new DrizzleCartProvider(db);
    const ref = { kind: "guest" as const, token: "parity-test-token" };
    const dto = await cart.addItem(ref, first.id, 1, "ui");
    expect(dto.itemCount).toBe(1);
    expect(dto.lines[0]?.productId).toBe(first.id);
    expect(dto.lines[0]?.unitPrice).toBe(first.price);
  });

  it("static-catalog ids are deterministic and stable across instances", async () => {
    const a = new StaticCatalogProvider();
    const b = new StaticCatalogProvider();
    const [pa, pb] = await Promise.all([a.search({ pageSize: 60 }), b.search({ pageSize: 60 })]);
    expect(pa.items.map((p) => p.id)).toEqual(pb.items.map((p) => p.id));
  });
});
