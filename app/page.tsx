import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { HomePalComposer } from "@/components/chat/home-pal-composer";
import { ProductCard } from "@/components/commerce/product-card";
import { RecentlyViewed } from "@/components/commerce/recently-viewed";
import { getCatalogProvider } from "@/lib/catalog";
import { COLLECTIONS } from "@/lib/catalog/data/products";
import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@/lib/catalog/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const catalog = await getCatalogProvider();
  const [featured, categories] = await Promise.all([
    catalog.featured(),
    catalog.categories(),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-14 px-4 py-8 lg:px-6">
      {/* Hero */}
      <section className="pt-6 sm:pt-10" aria-labelledby="hero-heading">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Shopping Pal
          </p>
          <h1 id="hero-heading" className="mt-3 text-balance text-4xl font-bold tracking-tight sm:text-5xl">
            What are you looking for?
          </h1>
          <p className="mt-3 text-balance text-base leading-relaxed text-muted-foreground sm:text-lg">
            Describe it like you&apos;d tell a friend — budget, use case, must-haves.
            Your pal searches the real catalog, compares the contenders and sets up your cart.
          </p>
          <div className="mt-6 text-left">
            <HomePalComposer />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section aria-labelledby="categories-heading">
        <h2 id="categories-heading" className="sr-only">Shop by category</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9 lg:gap-2">
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/products?category=${c.slug}`}
              className="focus-ring group flex flex-col items-center gap-1 rounded-lg border border-border bg-card px-2 py-4 text-center transition-colors hover:border-primary/40"
            >
              <span className="line-clamp-1 text-xs font-semibold sm:text-sm">{CATEGORY_LABELS[c.slug]}</span>
              <span className="text-[11px] text-muted-foreground">{c.count} items</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section aria-labelledby="featured-heading">
        <div className="flex items-end justify-between">
          <div>
            <h2 id="featured-heading" className="text-lg font-bold tracking-tight">
              Featured this week
            </h2>
            <p className="text-sm text-muted-foreground">Hand-picked value from across the catalog.</p>
          </div>
          <Link href="/products?sort=rating" className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline focus-ring sm:inline-flex">
            Top rated <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {featured.slice(0, 10).map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* Collections */}
      <section aria-labelledby="collections-heading">
        <h2 id="collections-heading" className="text-lg font-bold tracking-tight">
          Curated collections
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {COLLECTIONS.map((collection) => (
            <Link
              key={collection.slug}
              href={`/products?tag=${collection.tag}`}
              className="focus-ring group rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <h3 className="font-semibold group-hover:text-primary">{collection.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {collection.description}
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Explore <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <RecentlyViewed />
    </div>
  );
}
