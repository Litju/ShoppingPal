"use client";

import * as React from "react";
import Link from "next/link";

import { ProductCard } from "@/components/commerce/product-card";
import { getCatalogProvider } from "@/lib/catalog";
import type { Product } from "@/lib/catalog/types";

const VIEWED_KEY = "sp_recently_viewed";

export function pushRecentlyViewed(slug: string) {
  try {
    const raw = window.localStorage.getItem(VIEWED_KEY);
    const slugs = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [slug, ...slugs.filter((s) => s !== slug)].slice(0, 8);
    window.localStorage.setItem(VIEWED_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function RecentlyViewed() {
  const [products, setProducts] = React.useState<Product[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = window.localStorage.getItem(VIEWED_KEY);
        const slugs = raw ? (JSON.parse(raw) as string[]) : [];
        if (slugs.length === 0) {
          setProducts([]);
          return;
        }
        // Resolve slugs through the catalog search endpoint.
        const results = await Promise.all(
          slugs.slice(0, 4).map((slug) =>
            fetch(`/api/catalog/product/${slug}`)
              .then((r) => (r.ok ? r.json() : null))
              .catch(() => null),
          ),
        );
        const items = results.filter(Boolean) as Product[];
        if (!cancelled) setProducts(items);
      } catch {
        if (!cancelled) setProducts([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!products || products.length === 0) return null;

  return (
    <section aria-labelledby="recently-viewed-heading">
      <h2 id="recently-viewed-heading" className="text-lg font-bold tracking-tight">
        Recently viewed
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Stored only in this browser.{" "}
        <Link href="/products" className="underline hover:text-foreground focus-ring">
          Keep browsing
        </Link>
      </p>
    </section>
  );
}
