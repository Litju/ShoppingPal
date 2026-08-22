import type { Product } from "@/lib/catalog/types";
import { formatMoney } from "@/lib/money";
import type { Recommendation } from "@/lib/ai/schemas";

/**
 * Grounded explanation helpers. Reasons and tradeoffs are computed from
 * structured catalog facts only — never invented by the model.
 */

const USE_CASE_PHRASES: Record<string, string> = {
  gym: "sweat-resistant build that survives gym sessions",
  workout: "built to stay put through workouts",
  running: "secure fit for running",
  commuting: "made for loud commutes",
  commute: "made for loud commutes",
  travel: "packable for travel",
  programming: "comfortable for long typing sessions",
  "desk-setup": "a natural desk-upgrade pick",
  "home-gym": "core home-gym equipment",
  camping: "field-tested for camping trips",
  hiking: "suited to day hikes and beyond",
  coffee: "a solid step up for better coffee",
  gaming: "fast response for gaming",
  budget: "easy on the wallet",
  student: "student-friendly price",
};

function phraseForTag(tag: string): string {
  const key = tag.toLowerCase();
  return USE_CASE_PHRASES[key] ?? `tagged for ${tag.replace(/-/g, " ")}`;
}

export function summarize(product: Product): string {
  const text = product.description.trim();
  if (text.length <= 160) return text;
  return `${text.slice(0, 157).trimEnd()}...`;
}

/**
 * Compute grounded reasons/tradeoffs for recommending `product` given the
 * user's stated constraints. `peers` are same-category alternatives used for
 * honest relative statements.
 */
export function computeRecommendation(
  product: Product,
  options: {
    budget?: number;
    useCaseTags?: string[];
    peers?: Product[];
  },
): Recommendation {
  const { budget, useCaseTags = [], peers = [] } = options;
  const money = (n: number) => formatMoney(n, product.currency);

  const reasons: string[] = [];
  const tradeoffs: string[] = [];

  if (budget !== undefined) {
    if (product.price <= budget) {
      reasons.push(
        `Fits your budget with ${money(budget - product.price)} to spare.`,
      );
    }
  }

  if (product.reviewCount >= 400 && product.ratingTenths >= 45) {
    reasons.push(
      `Rated ${(product.ratingTenths / 10).toFixed(1)}/5 across ${product.reviewCount.toLocaleString("en-US")} reviews.`,
    );
  }

  const matchedTags = useCaseTags.filter((tag) =>
    product.tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
  );
  for (const tag of matchedTags.slice(0, 3)) {
    reasons.push(`${phraseForTag(tag)} — exactly your "${tag}" requirement.`);
  }

  const notableSpecs = Object.entries(product.specs).slice(0, 2);
  for (const [key, value] of notableSpecs) {
    reasons.push(`${key}: ${value}.`);
  }

  if (product.stock > 0 && product.stock < 15) {
    reasons.push(`Still ${stockPhrase(product.stock)}.`);
  } else if (product.stock > 0) {
    reasons.push("In stock and ready to ship.");
  }

  /* ── Honest tradeoffs ─────────────────────────────────────────────────── */

  const ratedPeers = peers.filter((p) => p.id !== product.id);
  const cheapestPeer = ratedPeers
    .slice()
    .sort((a, b) => a.price - b.price)[0];
  const bestRatedPeer = ratedPeers
    .slice()
    .sort(
      (a, b) => b.ratingTenths - a.ratingTenths || b.reviewCount - a.reviewCount,
    )[0];

  if (budget !== undefined && product.price > budget) {
    tradeoffs.push(
      `${money(product.price - budget)} over your stated budget.`,
    );
  }
  if (
    bestRatedPeer &&
    bestRatedPeer.ratingTenths > product.ratingTenths &&
    bestRatedPeer.price <= product.price
  ) {
    tradeoffs.push(
      `${bestRatedPeer.brand} ${bestRatedPeer.title} rates higher (${(bestRatedPeer.ratingTenths / 10).toFixed(1)}) for less money.`,
    );
  } else if (cheapestPeer && cheapestPeer.price < product.price * 0.8) {
    tradeoffs.push(
      `Costs ${money(product.price - cheapestPeer.price)} more than the cheapest option we found (${cheapestPeer.title}).`,
    );
  }
  if (product.stock === 0) {
    tradeoffs.push("Currently out of stock.");
  } else if (product.stock < 15) {
    tradeoffs.push(`Limited availability — only ${stockPhrase(product.stock)}.`);
  }
  if (tradeoffs.length === 0 && bestRatedPeer) {
    tradeoffs.push(
      `Rating is level with ${bestRatedPeer.title}, so it comes down to fit and feel.`,
    );
  }
  if (tradeoffs.length === 0) {
    tradeoffs.push("No major downsides surfaced in the data we checked.");
  }

  const remaining =
    budget !== undefined && product.price <= budget
      ? budget - product.price
      : null;
  const overBudgetBy =
    budget !== undefined && product.price > budget ? product.price - budget : null;

  return {
    product: {
      id: product.id,
      slug: product.slug,
      title: product.title,
      brand: product.brand,
      category: product.category,
      description: summarize(product),
      price: product.price,
      currency: product.currency,
      ratingTenths: product.ratingTenths,
      reviewCount: product.reviewCount,
      stock: product.stock,
      tags: product.tags,
      specs: product.specs,
    },
    reasons: reasons.slice(0, 5),
    tradeoffs: tradeoffs.slice(0, 2),
    budgetRemaining: remaining,
    overBudgetBy,
  };
}

function stockPhrase(stock: number): string {
  return stock <= 5 ? `${stock} left in stock` : `${stock} in stock`;
}
