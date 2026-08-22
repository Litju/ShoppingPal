"use client";

import Link from "next/link";
import { Scale } from "lucide-react";

import { ProductImage } from "@/components/commerce/product-image";
import type { z } from "zod";
import type { compareProductsOutput, productSummarySchema } from "@/lib/ai/schemas";

type CompareOutput = z.infer<typeof compareProductsOutput>;
type ProductSummary = z.infer<typeof productSummarySchema>;

/** Structured side-by-side comparison that highlights differences only. */
export function ProductComparison({ output }: { output: CompareOutput }) {
  const { products, rows, highlights } = output;
  if (products.length < 2) {
    return (
      <div className="my-3 rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
        I need at least two valid products to compare. Which ones did you mean?
      </div>
    );
  }

  const differing = rows.filter((r) => r.differs);
  const identical = rows.filter((r) => !r.differs);

  return (
    <section aria-label="Product comparison" className="my-3 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <Scale aria-hidden="true" className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Side-by-side comparison</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <caption className="sr-only">Comparison of {products.map((p) => p.title).join(", ")}</caption>
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th scope="col" className="w-28 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Feature
              </th>
              {products.map((product: ProductSummary) => (
                <th key={product.id} scope="col" className="px-4 py-3 text-left align-top">
                  <Link href={`/products/${product.slug}`} className="focus-ring block hover:underline">
                    <span className="mb-2 block h-10 w-10 overflow-hidden rounded-md border border-border bg-muted">
                      <ProductImage slug={product.slug} category={product.category} title={product.title} />
                    </span>
                    <span className="text-xs font-semibold leading-tight">{product.title}</span>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {differing.map((row) => (
              <tr key={`diff-${row.label}`} className="border-b border-border last:border-b-0">
                <th scope="row" className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                  {row.label}
                </th>
                {row.values.map((value, i) => (
                  <td key={`${products[i]?.id}-${row.label}`} className="px-4 py-2 font-medium">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {highlights.length > 0 && (
        <div className="border-t border-border bg-muted/40 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">What actually matters</p>
          <ul className="mt-1.5 space-y-1" role="list">
            {highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span aria-hidden="true" className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {identical.length > 0 && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Identical across all: {identical.map((r) => r.label).slice(0, 6).join(", ")}
          {identical.length > 6 && ` +${identical.length - 6} more`}
        </p>
      )}
    </section>
  );
}
