import type {
  CatalogPage,
  CatalogProvider,
  CatalogQuery,
  CategorySlug,
  Product,
} from "@shoppingpal/contracts";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@shoppingpal/contracts";
import { applyCatalogQuery, buildSearchableText } from "@/lib/catalog/query";
import { deterministicUuid } from "@shoppingpal/contracts";

import { SEED_PRODUCTS, type SeedProduct } from "@shoppingpal/contracts";

export interface StaticCatalogOptions {
  /** Provide to use custom rows (tests). Defaults to SEED_PRODUCTS. */
  products?: SeedProduct[];
}

/** In-memory catalog built from the seed data. Zero external dependencies. */
export class StaticCatalogProvider implements CatalogProvider {
  readonly name = "static";

  private readonly byId: Map<string, Product>;
  private readonly searchable: Map<string, string>;

  constructor(options: StaticCatalogOptions = {}) {
    const rows = options.products ?? SEED_PRODUCTS;
    const products: Product[] = rows.map((row) => ({
      ...row,
      id: deterministicUuid("shopping-pal-product", row.slug),
      currency: row.currency ?? "USD",
      images: row.images ?? [],
    }));
    this.byId = new Map(products.map((p) => [p.id, p]));
    this.searchable = new Map(
      products.map((p) => [
        p.id,
        buildSearchableText(p),
      ]),
    );
  }

  async search(query: CatalogQuery): Promise<CatalogPage> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(60, Math.max(1, query.pageSize ?? 24));
    const { items, total } = applyCatalogQuery(
      [...this.byId.values()],
      this.searchable,
      query,
    );
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string): Promise<Product | null> {
    return this.byId.get(id) ?? null;
  }

  async getBySlug(slug: string): Promise<Product | null> {
    for (const p of this.byId.values()) {
      if (p.slug === slug) return p;
    }
    return null;
  }

  async getByIds(ids: string[]): Promise<Product[]> {
    const out: Product[] = [];
    for (const id of ids) {
      const p = this.byId.get(id);
      if (p) out.push(p);
    }
    return out;
  }

  async featured(): Promise<Product[]> {
    return [...this.byId.values()].filter((p) => p.featured);
  }

  async related(product: Product, limit = 4): Promise<Product[]> {
    const scored = [...this.byId.values()]
      .filter((p) => p.id !== product.id)
      .map((p) => {
        let score = 0;
        if (p.category === product.category) score += 5;
        score += p.tags.filter((t) => product.tags.includes(t)).length * 2;
        if (Math.abs(p.price - product.price) < 5000) score += 1;
        return { p, score };
      })
      .filter((r) => r.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.p.ratingTenths - a.p.ratingTenths ||
          a.p.slug.localeCompare(b.p.slug),
      );
    return scored.slice(0, limit).map((r) => r.p);
  }

  async categories(): Promise<
    Array<{ slug: CategorySlug; label: string; count: number }>
  > {
    const counts = new Map<CategorySlug, number>();
    for (const p of this.byId.values()) {
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    return CATEGORY_SLUGS.map((slug) => ({
      slug,
      label: CATEGORY_LABELS[slug],
      count: counts.get(slug) ?? 0,
    }));
  }
}
