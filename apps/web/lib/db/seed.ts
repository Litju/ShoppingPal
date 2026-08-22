import { sql } from "drizzle-orm";

import * as schema from "@/db/schema";
import { SEED_PRODUCTS } from "@/lib/catalog/data/products";
import { deterministicUuid } from "@shoppingpal/contracts";
import type { Database } from "@/lib/db";

/**
 * Insert or update every seed product. Ids are deterministic (derived from
 * slug) so cart references stay valid across database backends.
 */
export async function upsertSeedProducts(db: Database): Promise<number> {
  const rows = SEED_PRODUCTS.map((product) => ({
    id: deterministicUuid("shopping-pal-product", product.slug),
    slug: product.slug,
    title: product.title,
    brand: product.brand,
    category: product.category,
    description: product.description,
    price: product.price,
    currency: "USD",
    images: [] as string[],
    stock: product.stock,
    ratingTenths: product.ratingTenths,
    reviewCount: product.reviewCount,
    tags: product.tags,
    specs: product.specs,
    searchable: [
      product.title,
      product.brand,
      product.category,
      product.description,
      ...product.tags,
    ]
      .join(" ")
      .toLowerCase(),
    featured: product.featured,
  }));

  const chunkSize = 20;
  let written = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await db
      .insert(schema.products)
      .values(chunk)
      .onConflictDoUpdate({
        target: schema.products.slug,
        set: {
          title: sql`excluded.title`,
          brand: sql`excluded.brand`,
          category: sql`excluded.category`,
          description: sql`excluded.description`,
          price: sql`excluded.price`,
          stock: sql`excluded.stock`,
          ratingTenths: sql`excluded.rating_tenths`,
          reviewCount: sql`excluded.review_count`,
          tags: sql`excluded.tags`,
          specs: sql`excluded.specs`,
          searchable: sql`excluded.searchable`,
          featured: sql`excluded.featured`,
        },
      });
    written += chunk.length;
  }
  return written;
}

/** Seed only when the catalog is empty (used on app boot). */
export async function ensureSeeded(db: Database): Promise<boolean> {
  try {
    const result = await db.execute<{ count: string | number }>(
      sql`select count(*)::text as count from products`,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (Array.isArray(result) ? result : (result as any).rows ?? []) as Array<{ count: string | number }>;
    const count = Number(rows[0]?.count ?? 0);
    if (count > 0) return false;
    await upsertSeedProducts(db);
    return true;
  } catch {
    return false;
  }
}
