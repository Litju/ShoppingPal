import type { Product } from "@/lib/catalog/types";
import type { Bundle } from "@/lib/ai/schemas";
import { summarize } from "@/lib/ai/explain";
import { formatMoney } from "@shoppingpal/contracts";

/**
 * Pure bundle builder. Given candidate pools and a budget, greedily picks one
 * strong item per focus area while staying under budget. Deterministic.
 */

export interface BundleCandidate {
  product: Product;
  /** Focus area this candidate belongs to (e.g. "laptop", "monitor"). */
  area: string;
  score: number;
}

export interface BuildBundleOptions {
  budget?: number;
  maxItems?: number;
  /** Explicit items chosen by the agent — validated, never re-picked. */
  explicit?: Product[];
  candidates: BundleCandidate[];
}

/** Greedy selection: strongest per area, cheapest-first fallback under budget. */
export function buildBundleFromCandidates(options: BuildBundleOptions): Bundle | null {
  const { budget, explicit = [], candidates, maxItems = 6 } = options;

  const picked: Array<{ product: Product; why: string }> = [];
  let spent = 0;
  const rationale: string[] = [];

  for (const product of explicit) {
    if (picked.some((p) => p.product.id === product.id)) continue;
    if (budget !== undefined && spent + product.price > budget) continue;
    picked.push({ product, why: "You asked for this item." });
    spent += product.price;
  }

  const areas = new Map<string, BundleCandidate[]>();
  for (const c of candidates) {
    if (explicit.some((p) => p.id === c.product.id)) continue;
    if (picked.some((p) => p.product.id === c.product.id)) continue;
    const list = areas.get(c.area) ?? [];
    list.push(c);
    areas.set(c.area, list);
  }

  // Strongest pick per area that still fits the remaining budget.
  for (const [area, list] of [...areas.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    if (picked.length >= maxItems) break;
    const sorted = [...list].sort(
      (a, b) =>
        b.score - a.score ||
        a.product.price - b.product.price ||
        a.product.slug.localeCompare(b.product.slug),
    );
    const chosen =
      sorted.find(
        (c) => budget === undefined || spent + c.product.price <= budget,
      ) ??
      sorted.filter(
        (c) => budget === undefined || c.product.price <= budget,
      ).at(-1);
    if (!chosen) {
      rationale.push(`Skipped ${area}: nothing solid left within budget.`);
      continue;
    }
    if (budget !== undefined && spent + chosen.product.price > budget) continue;
    picked.push({
      product: chosen.product,
      why: `Best-rated ${area} option that fits (${chosen.product.ratingTenths / 10}/5).`,
    });
    spent += chosen.product.price;
  }

  if (picked.length === 0) return null;

  const total = picked.reduce((sum, p) => sum + p.product.price, 0);
  for (const { product, why } of picked) {
    rationale.push(`${product.title} — ${why}`);
  }
  if (budget !== undefined) {
    if (total <= budget) {
      rationale.push(`Total lands at ${formatMoney(total)} — under your budget.`);
    }
  }

  return toBundle(picked.map((p) => p.product), rationale, budget ?? null, total);
}

/** Validate an explicit set of items against a budget without re-selection. */
export function validateExplicitBundle(
  products: Product[],
  budget?: number,
): Bundle | null {
  if (products.length === 0) return null;
  const total = products.reduce((s, p) => s + p.price, 0);
  const rationale = products.map((p) => `${p.title} — included as requested.`);
  return toBundle(products, rationale, budget ?? null, total);
}

function toBundle(
  products: Product[],
  rationale: string[],
  budget: number | null,
  total: number,
): Bundle {
  return {
    items: products.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      brand: p.brand,
      category: p.category,
      description: summarize(p),
      price: p.price,
      currency: p.currency,
      ratingTenths: p.ratingTenths,
      reviewCount: p.reviewCount,
      stock: p.stock,
      tags: p.tags,
      specs: p.specs,
    })),
    total,
    budget,
    remaining: budget !== null && total <= budget ? budget - total : null,
    overflow: budget !== null && total > budget ? total - budget : null,
    rationale,
  };
}
