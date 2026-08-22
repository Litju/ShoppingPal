import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";

import {
  FiltersPanel,
  SortSelect,
} from "@/components/commerce/filters-panel";
import { ProductCard, ProductCardSkeleton } from "@/components/commerce/product-card";
import { getCatalogProvider } from "@/lib/catalog";
import { CATEGORY_LABELS, CATEGORY_SLUGS, type CategorySlug, type SortOption } from "@/lib/catalog/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Browse products",
};

interface SearchParams {
  q?: string;
  category?: string | string[];
  brand?: string | string[];
  tag?: string;
  min?: string;
  max?: string;
  rating?: string;
  stock?: string;
  sort?: string;
  page?: string;
}

function toList(value?: string | string[]): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

const PAGE_SIZE = 24;

function parseMoney(value?: string): number | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const n = Math.round(parseFloat(cleaned) * 100);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const categoriesFilter = toList(sp.category).filter((c): c is CategorySlug =>
    (CATEGORY_SLUGS as readonly string[]).includes(c),
  );

  const query = {
    q: sp.q?.trim() || undefined,
    categories: categoriesFilter.length > 0 ? categoriesFilter : undefined,
    brands: toList(sp.brand),
    tags: sp.tag ? [sp.tag] : undefined,
    minPrice: parseMoney(sp.min),
    maxPrice: parseMoney(sp.max),
    minRatingTenths: sp.rating === "45" || sp.rating === "40" ? Number(sp.rating) : undefined,
    inStockOnly: sp.stock === "in",
    sort: (["price-asc", "price-desc", "rating", "relevance"].includes(sp.sort ?? "")
      ? sp.sort
      : "popular") as SortOption,
    page: Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1),
    pageSize: PAGE_SIZE,
  };

  const catalog = await getCatalogProvider();
  const [result, categories] = await Promise.all([
    catalog.search(query),
    catalog.categories(),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const page = Math.min(query.page!, totalPages);

  function pageHref(target: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(sp)) {
      if (value === undefined) continue;
      if (key === "page") continue;
      if (Array.isArray(value)) for (const v of value) params.append(key, v);
      else params.set(key, value);
    }
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return qs ? `/products?${qs}` : "/products";
  }

  const heading = query.q
    ? `Results for “${query.q}”`
    : categoriesFilter.length === 1 && categoriesFilter[0]
      ? (CATEGORY_LABELS[categoriesFilter[0]] ?? "Products")
      : "All products";

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="products-heading">
            {heading}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="results-count">
            {result.total} product{result.total === 1 ? "" : "s"}
            {sp.tag ? ` tagged “${sp.tag}”` : ""}
          </p>
        </div>
        <Suspense fallback={null}>
          <SortSelect />
        </Suspense>
      </header>

      <div className="mt-6 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside aria-label="Product filters" className="lg:border-r lg:border-border lg:pr-6">
          <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted" />}>
            <FiltersPanel categories={categories} />
          </Suspense>
        </aside>

        <section aria-label="Products">
          {result.items.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
              <p className="font-medium">No products match those filters.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try widening the price range or clearing a filter.
              </p>
              <Link
                href="/products"
                className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-ring"
              >
                Clear filters
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4" data-testid="product-grid">
                {result.items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>

              {totalPages > 1 && (
                <nav aria-label="Pagination" className="mt-8 flex items-center justify-center gap-2">
                  {page > 1 && (
                    <Link
                      href={pageHref(page - 1)}
                      className="focus-ring rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      Previous
                    </Link>
                  )}
                  <span className="px-3 text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                  {page < totalPages && (
                    <Link
                      href={pageHref(page + 1)}
                      className="focus-ring rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
                    >
                      Next
                    </Link>
                  )}
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
