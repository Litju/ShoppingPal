import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { AskPalButton } from "@/components/commerce/ask-pal-button";
import { ProductCard } from "@/components/commerce/product-card";
import { ProductGallery } from "@/components/commerce/product-gallery";
import { Price, RatingStars } from "@shoppingpal/ui";
import { SaveButton } from "@/components/commerce/save-button";
import { StockBadge } from "@/components/commerce/stock-badge";
import { TrackRecentlyViewed } from "@/components/commerce/track-recently-viewed";
import { Badge } from "@/components/ui/badge";
import { getCatalogProvider } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getCatalogProvider();
  const product = await catalog.getBySlug(slug);
  if (!product) return { title: "Product not found" };
  return {
    title: `${product.brand} ${product.title}`,
    description: product.description.slice(0, 150),
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const catalog = await getCatalogProvider();
  const product = await catalog.getBySlug(slug);
  if (!product) notFound();

  const related = await catalog.related(product, 4);

  // Deterministic review distribution derived from the rating.
  const rating = product.ratingTenths / 10;
  const weights = [0.06, 0.08, 0.14, 0.32, 0.4];
  const skew = (5 - rating) * 3;
  const dist = weights.map((w, i) =>
    Math.max(
      1,
      Math.round(product.reviewCount * Math.max(0.02, w - (i < 2 ? skew / 100 : 0))),
    ),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <TrackRecentlyViewed slug={product.slug} />

      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
        Home / {product.category.replace(/-/g, " ")} /{" "}
        <span className="font-medium text-foreground">{product.title}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)]">
        <ProductGallery slug={product.slug} category={product.category} title={product.title} />

        <div className="max-w-xl">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">
              {product.brand}
            </span>
            <StockBadge stock={product.stock} />
          </div>

          <h1 className="mt-2 text-balance text-3xl font-bold tracking-tight">{product.title}</h1>
          <div className="mt-2">
            <RatingStars ratingTenths={product.ratingTenths} reviewCount={product.reviewCount} size="md" />
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <Price minor={product.price} currency={product.currency} className="text-3xl" />
            <span className="text-sm text-muted-foreground">taxes calculated at checkout</span>
          </div>

          <p className="mt-5 leading-relaxed text-muted-foreground">{product.description}</p>

          <ul className="mt-5 flex flex-wrap gap-1.5" aria-label="Use cases">
            {product.tags.slice(0, 8).map((tag) => (
              <li key={tag}>
                <Badge variant="secondary" className="normal-case">{tag}</Badge>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
            <AddToCartButton
              productId={product.id}
              title={product.title}
              stock={product.stock}
              size="lg"
              className="flex-1"
            />
            <SaveButton productId={product.id} title={product.title} variant="outline" className="h-11 w-11" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Free shipping over $75 · 30-day returns · Secure Stripe checkout
          </p>

          <div className="mt-6 border-t border-border pt-6">
            <AskPalButton productName={product.title} productSlug={product.slug} />
          </div>
        </div>
      </div>

      {/* Specifications + reviews */}
      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="specs-heading" className="rounded-lg border border-border bg-card p-6">
          <h2 id="specs-heading" className="font-bold tracking-tight">Specifications</h2>
          <dl className="mt-4 divide-y divide-border">
            {Object.entries(product.specs).map(([key, value]) => (
              <div key={key} className="flex items-start justify-between gap-4 py-2.5 text-sm">
                <dt className="shrink-0 font-medium text-muted-foreground">{key}</dt>
                <dd className="text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="reviews-heading" className="rounded-lg border border-border bg-card p-6">
          <h2 id="reviews-heading" className="font-bold tracking-tight">Reviews</h2>
          <div className="mt-4 flex items-center gap-6">
            <div className="text-center">
              <p className="text-4xl font-bold tabular-nums">{rating.toFixed(1)}</p>
              <RatingStars ratingTenths={product.ratingTenths} className="mt-1" />
              <p className="mt-1 text-xs text-muted-foreground">
                {product.reviewCount.toLocaleString("en-US")} reviews
              </p>
            </div>
            <dl className="flex-1 space-y-1">
              {[5, 4, 3, 2, 1].map((stars) => {
                const count = dist[stars - 1] ?? 0;
                const pct = product.reviewCount > 0 ? (count / product.reviewCount) * 100 : 0;
                return (
                  <div key={stars} className="flex items-center gap-2 text-xs">
                    <dt className="w-6 text-right text-muted-foreground">{stars}★</dt>
                    <dd className="flex flex-1 items-center gap-2">
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <span
                          className="block h-full rounded-full bg-star"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </span>
                      <span className="w-12 text-muted-foreground">{count.toLocaleString("en-US")}</span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </section>
      </div>

      {related.length > 0 && (
        <section aria-labelledby="related-heading" className="mt-12">
          <h2 id="related-heading" className="text-lg font-bold tracking-tight">
            More like this
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
