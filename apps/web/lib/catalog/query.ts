import type {
  CatalogQuery,
  Product,
  SortOption,
} from "@/lib/catalog/types";

/**
 * Pure catalog query logic. Used by the static provider directly and by unit
 * tests as the reference implementation of search/filter/sort semantics.
 */

export function buildSearchableText(p: {
  title: string;
  brand: string;
  category: string;
  description: string;
  tags: string[];
}): string {
  return [p.title, p.brand, p.category, p.description, ...p.tags]
    .join(" ")
    .toLowerCase();
}

const STOP_WORDS = new Set([
  "the", "a", "an", "for", "and", "or", "with", "under", "best", "me", "my",
  "to", "of", "in", "on", "i", "need", "want", "find", "show", "good", "great",
  "cheap", "cheapest",
]);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

/**
 * Relevance score: token matches weighted by field. Deterministic.
 */
export function relevanceScore(
  product: Product,
  tokens: string[],
  searchable: string,
): number {
  if (tokens.length === 0) return 0;
  const title = product.title.toLowerCase();
  const brand = product.brand.toLowerCase();
  const tags = product.tags.map((t) => t.toLowerCase());
  let score = 0;
  for (const token of tokens) {
    if (title.includes(token)) score += 6;
    if (brand.includes(token)) score += 4;
    if (tags.some((tag) => tag === token || tag.includes(token))) score += 3;
    if (product.category.toLowerCase().includes(token)) score += 3;
    if (searchable.includes(token)) score += 1;
  }
  return score;
}

export interface QueryError {
  field: string;
}

/** Applies filters, then sorts, then pages. Never throws on odd input —
 * invalid numeric bounds are ignored so bad URLs degrade gracefully. */
export function applyCatalogQuery(
  products: Product[],
  searchableMap: Map<string, string>,
  query: CatalogQuery,
): { items: Product[]; total: number } {
  let list = products;

  if (query.categories && query.categories.length > 0) {
    const set = new Set<string>(query.categories);
    list = list.filter((p) => set.has(p.category));
  }
  if (query.brands && query.brands.length > 0) {
    const set = new Set(query.brands.map((b) => b.toLowerCase()));
    list = list.filter((p) => set.has(p.brand.toLowerCase()));
  }
  if (query.tags && query.tags.length > 0) {
    const set = new Set(query.tags.map((t) => t.toLowerCase()));
    list = list.filter((p) => p.tags.some((t) => set.has(t.toLowerCase())));
  }
  if (typeof query.minPrice === "number" && Number.isFinite(query.minPrice)) {
    list = list.filter((p) => p.price >= query.minPrice!);
  }
  if (typeof query.maxPrice === "number" && Number.isFinite(query.maxPrice)) {
    list = list.filter((p) => p.price <= query.maxPrice!);
  }
  if (
    typeof query.minRatingTenths === "number" &&
    Number.isFinite(query.minRatingTenths)
  ) {
    list = list.filter((p) => p.ratingTenths >= query.minRatingTenths!);
  }
  if (query.inStockOnly) {
    list = list.filter((p) => p.stock > 0);
  }

  const qTokens = query.q ? tokenize(query.q) : [];
  if (qTokens.length > 0) {
    list = list
      .map((product) => ({
        product,
        score: relevanceScore(
          product,
          qTokens,
          searchableMap.get(product.id) ?? "",
        ),
      }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title))
      .map((r) => r.product);
  } else {
    list = sortProducts(list, query.sort ?? "popular");
  }

  return { items: list, total: list.length };
}

function sortProducts(list: Product[], sort: SortOption | undefined): Product[] {
  const sorted = [...list];
  switch (sort) {
    case "price-asc":
      sorted.sort((a, b) => a.price - b.price);
      break;
    case "price-desc":
      sorted.sort((a, b) => b.price - a.price);
      break;
    case "rating":
      sorted.sort(
        (a, b) =>
          b.ratingTenths - a.ratingTenths ||
          b.reviewCount - a.reviewCount,
      );
      break;
    case "relevance":
    case "popular":
    default:
      // Deterministic "popularity": featured first, then reviews, then rating.
      sorted.sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          b.reviewCount - a.reviewCount ||
          b.ratingTenths - a.ratingTenths ||
          a.slug.localeCompare(b.slug),
      );
      break;
  }
  return sorted;
}
