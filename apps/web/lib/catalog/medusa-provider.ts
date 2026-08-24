import type {
  CatalogPage,
  CatalogProvider,
  CatalogQuery,
  CategorySlug,
  Product,
} from "@shoppingpal/contracts";

import { getMedusaConfig } from "@/lib/commerce/config";
import { MedusaClient } from "@/lib/commerce/medusa-client";
import { applyCatalogQuery, buildSearchableText } from "@/lib/catalog/query";

/**
 * MedusaCatalogAdapter — the storefront read model backed by the canonical
 * Medusa catalog. Implements the existing CatalogProvider seam so UI and
 * agent keep working unchanged.
 *
 * Presentation DTOs are normalized here: price/stock come from variant
 * state, never from product-level assumptions.
 */

interface MedusaVariant {
  id: string;
  title: string;
  sku?: string | null;
  inventory_quantity?: number;
  manage_inventory?: boolean;
  calculated_price?: { calculated_amount?: number; currency_code?: string } | null;
}

interface MedusaProduct {
  id: string;
  handle: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  status: string;
  external_id?: string | null;
  metadata?: Record<string, unknown> | null;
  variants?: MedusaVariant[];
}

interface MedusaCategory {
  id: string;
  name: string;
  handle: string;
  products_count?: number;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isPurchasable(variant: MedusaVariant): boolean {
  return variant.manage_inventory === false || num(variant.inventory_quantity) > 0;
}

function toPresentation(p: MedusaProduct): Product | null {
  const variant = p.variants?.find(isPurchasable) ?? p.variants?.[0];
  if (!variant) return null;
  const meta = (p.metadata ?? {}) as Record<string, unknown>;
  const categorySlug = str(meta.category_slug);
  if (!categorySlug) return null;

  const stock =
    variant.manage_inventory === false
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, num(variant.inventory_quantity));
  // Availability is computed from managed inventory levels; when a variant
  // is unmanaged it is treated as always available.
  const available = stock > 0;

  return {
    id: p.id,
    slug: p.handle,
    title: p.title,
    brand: str(meta.brand),
    category: categorySlug as CategorySlug,
    description: str(p.description),
    price: num(variant.calculated_price?.calculated_amount),
    currency:
      variant.calculated_price?.currency_code?.toUpperCase() ?? "USD",
    images: [],
    stock,
    ratingTenths: num(meta.rating_tenths),
    reviewCount: num(meta.review_count),
    tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
    specs:
      meta.specs && typeof meta.specs === "object"
        ? (meta.specs as Record<string, string>)
        : {},
    featured: Boolean(meta.featured) && available,
  };
}

export class MedusaCatalogProvider implements CatalogProvider {
  readonly name = "medusa";
  private readonly client: MedusaClient;
  private regionId?: string;

  private categoryIdByHandle: Promise<Map<string, string>> | null = null;

  constructor(client?: MedusaClient, regionId?: string) {
    const config = getMedusaConfig();
    if (!config) throw new Error("Medusa is not configured");
    this.client = client ?? new MedusaClient(config);
    this.regionId = regionId ?? config.regionId;
  }

  private pricingQuery(): string {
    if (!this.regionId) return "";
    return `&region_id=${encodeURIComponent(this.regionId)}`;
  }

  private static readonly PRODUCT_FIELDS = [
    "id",
    "handle",
    "title",
    "description",
    "status",
    "external_id",
    "metadata",
    "+variants.id",
    "+variants.sku",
    "+variants.manage_inventory",
    "+variants.inventory_quantity",
    "+variants.calculated_price.calculated_amount",
    "+variants.calculated_price.currency_code",
  ].join(",");

  private async fetchProducts(params: string): Promise<Product[]> {
    const res = await this.client.get<{ products: MedusaProduct[] }>(
      `/store/products?limit=200&fields=${MedusaCatalogProvider.PRODUCT_FIELDS}${this.pricingQuery()}&${params}`,
    );
    return res.products
      .filter((p) => p.status === "published")
      .map(toPresentation)
      .filter((p): p is Product => p !== null);
  }

  async search(query: CatalogQuery): Promise<CatalogPage> {
    if (!this.regionId) {
      // Without a configured region Medusa cannot calculate prices; force a
      // pricing context by reading any region once.
      const regions = await this.client.get<{
        regions: Array<{ id: string }>;
      }>("/store/regions?limit=1");
      this.regionId = regions.regions[0]?.id;
    }
    const all = await this.fetchProducts("order=title");
    const searchable = new Map(
      all.map((product) => [product.id, buildSearchableText(product)]),
    );
    const { items, total } = applyCatalogQuery(all, searchable, query);

    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(60, Math.max(1, query.pageSize ?? 24));
    return {
      items: items.slice((page - 1) * pageSize, page * pageSize),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string): Promise<Product | null> {
    try {
      const res = await this.client.get<{ product: MedusaProduct }>(
        `/store/products/${id}?fields=${MedusaCatalogProvider.PRODUCT_FIELDS}${this.pricingQuery()}`,
      );
      return toPresentation(res.product);
    } catch {
      return null;
    }
  }

  async getBySlug(slug: string): Promise<Product | null> {
    const res = await this.client.get<{ products: MedusaProduct[] }>(
      `/store/products?handle=${encodeURIComponent(slug)}&limit=1&fields=${MedusaCatalogProvider.PRODUCT_FIELDS}${this.pricingQuery()}`,
    );
    const found = res.products[0];
    return found ? toPresentation(found) : null;
  }

  async getByIds(ids: string[]): Promise<Product[]> {
    if (ids.length === 0) return [];
    const params = ids.map((id) => `id[]=${encodeURIComponent(id)}`).join("&");
    const res = await this.client.get<{ products: MedusaProduct[] }>(
      `/store/products?limit=${ids.length}&${params}&fields=${MedusaCatalogProvider.PRODUCT_FIELDS}${this.pricingQuery()}`,
    );
    return res.products
      .map(toPresentation)
      .filter((p): p is Product => p !== null);
  }

  async featured(): Promise<Product[]> {
    const all = await this.search({ inStockOnly: true, pageSize: 60 });
    return all.items.filter((p) => p.featured).slice(0, 8);
  }

  async related(product: Product, limit = 4): Promise<Product[]> {
    const page = await this.search({
      categories: [product.category],
      pageSize: 24,
    });
    return page.items
      .filter((p) => p.id !== product.id)
      .map((p) => ({
        p,
        score:
          (p.category === product.category ? 5 : 0) +
          p.tags.filter((t) => product.tags.includes(t)).length * 2 +
          (Math.abs(p.price - product.price) < 5000 ? 1 : 0),
      }))
      .filter((r) => r.score > 0)
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.p.ratingTenths - a.p.ratingTenths ||
          a.p.slug.localeCompare(b.p.slug),
      )
      .slice(0, limit)
      .map((r) => r.p);
  }

  async categories(): Promise<
    Array<{ slug: CategorySlug; label: string; count: number }>
  > {
    const map = await this.categoryIdMap();
    const cats = await this.client.get<{ product_categories: MedusaCategory[] }>(
      "/store/product-categories?limit=50&fields=id,name,handle",
    );
    const counts = new Map<string, number>();
    const all = await this.fetchProducts("");
    for (const p of all) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);

    return cats.product_categories
      .filter((c) => map.has(c.handle))
      .map((c) => ({
        slug: c.handle as CategorySlug,
        label: c.name,
        count: counts.get(c.handle) ?? 0,
      }));
  }

  private async categoryIdMap(): Promise<Map<string, string>> {
    if (!this.categoryIdByHandle) {
      this.categoryIdByHandle = (async () => {
        const res = await this.client.get<{
          product_categories: MedusaCategory[];
        }>("/store/product-categories?limit=50&fields=id,handle");
        return new Map(
          res.product_categories.map((c) => [c.handle, c.id]),
        );
      })();
    }
    return this.categoryIdByHandle;
  }

  /** Exposed for cart flows that need to resolve category filters. */
  async categoryIdForHandle(handle: string): Promise<string | undefined> {
    return (await this.categoryIdMap()).get(handle);
  }
}
