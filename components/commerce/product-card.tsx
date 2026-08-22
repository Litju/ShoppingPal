import Link from "next/link";

import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { Price, RatingStars } from "@/components/commerce/price";
import { ProductImage } from "@/components/commerce/product-image";
import { SaveButton } from "@/components/commerce/save-button";
import { StockBadge } from "@/components/commerce/stock-badge";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/catalog/types";

export function ProductCard({
  product,
  className,
}: {
  product: Pick<
    Product,
    | "id"
    | "slug"
    | "title"
    | "brand"
    | "price"
    | "currency"
    | "ratingTenths"
    | "reviewCount"
    | "stock"
    | "category"
  > & { tags?: string[] };
  className?: string;
}) {
  return (
    <article
      className={
        "group relative flex flex-col rounded-lg border border-border bg-card transition-shadow hover:shadow-md focus-within:shadow-md " +
        (className ?? "")
      }
    >
      <Link
        href={`/products/${product.slug}`}
        className="focus-ring block overflow-hidden rounded-t-lg"
        aria-label={`View ${product.title}`}
      >
        <div className="aspect-square w-full overflow-hidden bg-muted">
          <div className="h-full w-full transition-transform duration-200 group-hover:scale-[1.03]">
            <ProductImage
              slug={product.slug}
              category={product.category}
              title={product.title}
            />
          </div>
        </div>
      </Link>

      <SaveButton productId={product.id} title={product.title} className="absolute right-2 top-2 bg-card/90" />

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{product.brand}</span>
          {product.stock <= 0 ? (
            <StockBadge stock={0} />
          ) : product.stock < 15 ? (
            <Badge variant="warning">Only {product.stock} left</Badge>
          ) : null}
        </div>
        <h3 className="text-sm font-semibold leading-snug">
          <Link href={`/products/${product.slug}`} className="hover:underline focus-ring">
            {product.title}
          </Link>
        </h3>
        <RatingStars ratingTenths={product.ratingTenths} reviewCount={product.reviewCount} />
        <div className="mt-auto flex items-center justify-between pt-2">
          <Price minor={product.price} currency={product.currency} compact />
          <AddToCartButton
            productId={product.id}
            title={product.title}
            stock={product.stock}
            size="sm"
          />
        </div>
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-card">
      <div className="aspect-square w-full animate-pulse bg-muted" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="h-3 w-20 animate-pulse rounded bg-muted" />
        <div className="h-4 w-full animate-pulse rounded bg-muted" />
        <div className="h-3 w-24 animate-pulse rounded bg-muted" />
        <div className="mt-auto flex items-center justify-between pt-2">
          <div className="h-5 w-16 animate-pulse rounded bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
