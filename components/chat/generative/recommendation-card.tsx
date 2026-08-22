"use client";

import Link from "next/link";
import { ArrowRight, Check, PackageCheck, Sparkles } from "lucide-react";

import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { Price, RatingStars } from "@/components/commerce/price";
import { ProductImage } from "@/components/commerce/product-image";
import { SaveButton } from "@/components/commerce/save-button";
import type { Bundle, Recommendation } from "@/lib/ai/schemas";
import { formatMoney } from "@/lib/money";

/**
 * Prominent recommendation card: product, price, grounded reasons, honest
 * downside, and commerce actions.
 */
export function ProductRecommendation({ output }: { output: Recommendation }) {
  const { product, reasons, tradeoffs, budgetRemaining, overBudgetBy } = output;
  return (
    <article className="my-3 overflow-hidden rounded-lg border border-primary/30 bg-card shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border bg-primary-soft/60 px-4 py-2">
        <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
          Shopping Pal recommends
        </span>
      </div>

      <div className="flex flex-col gap-4 p-4 sm:flex-row">
        <Link
          href={`/products/${product.slug}`}
          className="focus-ring block w-full shrink-0 overflow-hidden rounded-md border border-border sm:w-36"
        >
          <div className="aspect-square w-full bg-muted">
            <ProductImage slug={product.slug} category={product.category} title={product.title} />
          </div>
        </Link>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {product.brand}
          </p>
          <h3 className="mt-0.5 text-base font-semibold leading-snug">
            <Link href={`/products/${product.slug}`} className="hover:underline focus-ring">
              {product.title}
            </Link>
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
            <Price minor={product.price} currency={product.currency} />
            <RatingStars ratingTenths={product.ratingTenths} reviewCount={product.reviewCount} />
          </div>

          <ul className="mt-3 space-y-1.5" aria-label="Why this fits your requirements">
            {reasons.slice(0, 4).map((reason, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>

          {tradeoffs.length > 0 && (
            <div className="mt-3 rounded-md bg-muted/70 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Honest tradeoff
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{tradeoffs[0]}</p>
            </div>
          )}

          {(budgetRemaining !== null || overBudgetBy !== null) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {budgetRemaining !== null &&
                `${formatMoney(budgetRemaining, product.currency)} of your budget would remain.`}
              {overBudgetBy !== null && `That's ${formatMoney(overBudgetBy, product.currency)} over budget.`}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-4 py-3">
        <AddToCartButton productId={product.id} title={product.title} stock={product.stock} label="Add to cart" />
        <SaveButton productId={product.id} title={product.title} variant="outline" className="h-9 px-3 has-[>svg]:px-3" />
        <Link
          href={`/products/${product.slug}`}
          className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          View details <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

/** Bundle card: items, prices, total, budget status, rationale, one-add action. */
export function BundleCard({
  output,
  toolCallId,
}: {
  output: Bundle;
  toolCallId?: string;
}) {
  void toolCallId;
  return (
    <article className="my-3 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <PackageCheck aria-hidden="true" className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Curated bundle</span>
      </div>

      <ul className="divide-y divide-border" role="list">
        {output.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            <Link href={`/products/${item.slug}`} className="focus-ring shrink-0 overflow-hidden rounded-md border border-border">
              <div className="h-12 w-12 bg-muted">
                <ProductImage slug={item.slug} category={item.category} title={item.title} />
              </div>
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={`/products/${item.slug}`} className="block truncate text-sm font-medium hover:underline focus-ring">
                {item.title}
              </Link>
              <RatingStars ratingTenths={item.ratingTenths} reviewCount={item.reviewCount} />
            </div>
            <Price minor={item.price} currency={item.currency} compact className="text-sm" />
          </li>
        ))}
      </ul>

      <div className="border-t border-border px-4 py-3">
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Bundle total</dt>
            <dd className="font-semibold">{formatMoney(output.total)}</dd>
          </div>
          {output.budget !== null && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Budget</dt>
              <dd>{formatMoney(output.budget)}</dd>
            </div>
          )}
          {output.remaining !== null && (
            <div className="flex justify-between text-success">
              <dt>Left over</dt>
              <dd className="font-medium">{formatMoney(output.remaining)}</dd>
            </div>
          )}
          {output.overflow !== null && (
            <div className="flex justify-between text-destructive">
              <dt>Over budget by</dt>
              <dd className="font-medium">{formatMoney(output.overflow)}</dd>
            </div>
          )}
        </dl>

        <ul className="mt-3 space-y-1" aria-label="Bundle rationale">
          {output.rationale.map((line, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span aria-hidden="true" className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
              <span>{line}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4">
          {output.items[0] && (
            <>
              <AddToCartButton
                productId={output.items[0].id}
                title={`${output.items.length}-item bundle (starts with ${output.items[0].title})`}
                stock={output.items[0].stock}
                label={`Add first item (${output.items.length}-piece bundle)`}
                size="lg"
                className="w-full"
              />
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Adds the featured item — say “add the rest too” in chat to add every piece.
              </p>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
