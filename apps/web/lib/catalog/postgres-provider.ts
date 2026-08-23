import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";

import * as schema from "@/db/schema";
import type { Database } from "@/lib/db";
import type {
  CatalogPage,
  CatalogProvider,
  CatalogQuery,
  CategorySlug,
  Product,
} from "@shoppingpal/contracts";
import { CATEGORY_LABELS } from "@shoppingpal/contracts";

type ProductRow = typeof schema.products.$inferSelect;

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    brand: row.brand,
    category: row.category as CategorySlug,
    description: row.description,
    price: row.price,
    currency: row.currency,
    images: row.images ?? [],
    stock: row.stock,
    ratingTenths: row.ratingTenths,
    reviewCount: row.reviewCount,
    tags: row.tags ?? [],
    specs: row.specs ?? {},
    featured: row.featured,
  };
}

export class PostgresCatalogProvider implements CatalogProvider {
  readonly name = "postgres";

  constructor(private readonly db: Database) {}

  async search(query: CatalogQuery): Promise<CatalogPage> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(60, Math.max(1, query.pageSize ?? 24));
    const conditions = [];

    if (query.categories && query.categories.length > 0) {
      conditions.push(inArray(schema.products.category, [...query.categories]));
    }
    if (query.brands && query.brands.length > 0) {
      conditions.push(
        inArray(
          sql`lower(${schema.products.brand})`,
          query.brands.map((b) => b.toLowerCase()),
        ),
      );
    }
    if (query.minPrice !== undefined) {
      conditions.push(gte(schema.products.price, query.minPrice));
    }
    if (query.maxPrice !== undefined) {
      conditions.push(lte(schema.products.price, query.maxPrice));
    }
    if (query.minRatingTenths !== undefined) {
      conditions.push(gte(schema.products.ratingTenths, query.minRatingTenths));
    }
    if (query.inStockOnly) {
      conditions.push(sql`${schema.products.stock} > 0`);
    }
    if (query.q && query.q.trim().length > 0) {
      // Token AND across the precomputed searchable column.
      for (const token of query.q
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 1)) {
        const pattern = `%${token}%`;
        conditions.push(
          or(ilike(schema.products.searchable, pattern), undefined),
        );
      }
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    let orderBy;
    switch (query.sort) {
      case "price-asc":
        orderBy = [asc(schema.products.price)];
        break;
      case "price-desc":
        orderBy = [desc(schema.products.price)];
        break;
      case "rating":
        orderBy = [desc(schema.products.ratingTenths), desc(schema.products.reviewCount)];
        break;
      case "relevance":
      case "popular":
      default:
        orderBy = [
          desc(schema.products.featured),
          desc(schema.products.reviewCount),
          desc(schema.products.ratingTenths),
        ];
        break;
    }

    const rows = await this.db
      .select()
      .from(schema.products)
      .where(where)
      .orderBy(...orderBy)
      .limit(500);

    let items = rows.map(rowToProduct);
    if (query.tags && query.tags.length > 0) {
      const wanted = new Set(query.tags.map((t) => t.toLowerCase()));
      items = items.filter((p) =>
        p.tags.some((t) => wanted.has(t.toLowerCase())),
      );
    }

    const total = items.length;
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);
    return rows[0] ? rowToProduct(rows[0]) : null;
  }

  async getBySlug(slug: string): Promise<Product | null> {
    const rows = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.slug, slug))
      .limit(1);
    return rows[0] ? rowToProduct(rows[0]) : null;
  }

  async getByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(schema.products)
      .where(inArray(schema.products.id, ids.slice(0, 100)));
    const order = new Map(ids.map((id, i) => [id, i]));
    return rows
      .map(rowToProduct)
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  }

  async featured(): Promise<Product[]> {
    const rows = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.featured, true))
      .orderBy(desc(schema.products.reviewCount))
      .limit(12);
    return rows.map(rowToProduct);
  }

  async related(product: Product, limit = 4): Promise<Product[]> {
    const rows = await this.db
      .select()
      .from(schema.products)
      .where(eq(schema.products.category, product.category))
      .orderBy(desc(schema.products.ratingTenths))
      .limit(limit + 4);
    const scored = rows
      .map(rowToProduct)
      .filter((p) => p.id !== product.id)
      .sort((a, b) => b.ratingTenths - a.ratingTenths);
    return scored.slice(0, limit);
  }

  async categories(): Promise<
    Array<{ slug: CategorySlug; label: string; count: number }>
  > {
    const rows = await this.db
      .select({
        category: schema.products.category,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.products)
      .groupBy(schema.products.category);
    return rows.map((row) => ({
      slug: row.category as CategorySlug,
      label: CATEGORY_LABELS[row.category as CategorySlug] ?? row.category,
      count: row.count,
    }));
  }
}
