"use client";

import Link from "next/link";
import { SearchX } from "lucide-react";

import { Price, RatingStars } from "@/components/commerce/price";
import { ProductImage } from "@/components/commerce/product-image";
import type { ProductSummary } from "@/lib/ai/schemas";

/** Horizontal product result cards rendered inside the conversation. */
export function ProductResults({
  products,
  emptyMessage,
}: {
  products: Array<
    Pick<ProductSummary, "id" | "slug" | "title" | "brand" | "price" | "currency" | "ratingTenths" | "reviewCount" | "stock" | "category">
  >;
  emptyMessage?: string;
}) {
  if (products.length === 0) {
    return (
      <div className="my-3 flex items-start gap-3 rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
        <SearchX aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{emptyMessage ?? "Nothing matched. Try a broader query or different budget."}</p>
      </div>
    );
  }
  return (
    <ul
      role="list"
      className="my-3 flex snap-x gap-3 overflow-x-auto pb-2"
      aria-label="Product results"
    >
      {products.map((product) => (
        <li key={product.id} className="w-56 shrink-0 snap-start">
          <Link
            href={`/products/${product.slug}`}
            className="focus-ring group flex h-full flex-col rounded-lg border border-border bg-card transition-shadow hover:shadow-md"
          >
            <div className="aspect-[4/3] overflow-hidden rounded-t-lg bg-muted">
              <div className="h-full w-full transition-transform duration-200 group-hover:scale-[1.03]">
                <ProductImage slug={product.slug} category={product.category} title={product.title} />
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-1 p-3">
              <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {product.brand}
              </span>
              <span className="line-clamp-2 text-sm font-semibold leading-snug">{product.title}</span>
              <RatingStars ratingTenths={product.ratingTenths} reviewCount={product.reviewCount} />
              <div className="mt-auto flex items-center justify-between pt-1">
                <Price minor={product.price} currency={product.currency} compact />
                {product.stock <= 0 ? (
                  <span className="text-xs font-medium text-destructive">Out of stock</span>
                ) : (
                  <span className="text-xs text-muted-foreground">{product.stock} in stock</span>
                )}
              </div>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ResultsSkeleton() {
  return (
    <div className="my-3 flex gap-3 overflow-hidden" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-56 shrink-0 rounded-lg border border-border bg-card p-3">
          <div className="aspect-[4/3] animate-pulse rounded-md bg-muted" />
          <div className="mt-3 h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="mt-2 h-4 w-full animate-pulse rounded bg-muted" />
          <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}
