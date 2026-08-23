import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import * as schema from "@/db/schema";
import { extractRows, runMigrations, type Database } from "@/lib/db";

describe("non-commerce state schema", () => {
  it("stores Medusa ids without recreating commerce tables", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema }) as unknown as Database;
    await runMigrations(db);

    await db.insert(schema.savedProducts).values({
      userId: "cus_medusa_test",
      productId: "prod_01MEDUSA_CANONICAL",
    });

    const tables = await db.execute<{ products: string | null; saved: string | null }>(
      sql`select to_regclass('public.products') as products, to_regclass('public.saved_products') as saved`,
    );
    const row = extractRows<{ products: string | null; saved: string | null }>(tables)[0];
    expect(row?.products ?? null).toBeNull();
    expect(row?.saved).toBe("saved_products");
  }, 15_000);

  it("does not delete existing commerce tables during app-state setup", async () => {
    const client = new PGlite();
    const db = drizzle(client, { schema }) as unknown as Database;
    await db.execute(sql`create table products (id text primary key)`);

    await runMigrations(db);

    const tables = await db.execute<{ products: string | null }>(
      sql`select to_regclass('public.products') as products`,
    );
    const row = extractRows<{ products: string | null }>(tables)[0];
    expect(row?.products).toBe("products");
  }, 15_000);
});
