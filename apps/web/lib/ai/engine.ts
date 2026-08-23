import { z } from "zod";

import type { Product, CategorySlug } from "@shoppingpal/contracts";
import { getCatalogProvider } from "@/lib/catalog";
import { buildBundleFromCandidates, validateExplicitBundle } from "@/lib/catalog/bundle";
import { computeRecommendation } from "@/lib/ai/explain";
import {
  addToCartInput,
  compareProductsInput,
  getProductInput,
  prepareCheckoutOutput,
  removeFromCartInput,
  searchProductsInput,
  updateCartInput,
  type Bundle,
  type CartPayload,
  type ProductSummary,
  type Recommendation,
} from "@/lib/ai/schemas";
import { getCartProvider, ensureCartRef, resolveCartRef } from "@/lib/cart/session";
import { getSessionUser } from "@/lib/auth/server";
import { getCheckoutService } from "@/lib/checkout";
import { medusaEnabled } from "@/lib/commerce/config";

/**
 * Engine functions: the single source of commerce truth for Shopping Pal.
 * Both the LLM tool layer and the offline demo agent call these — so facts
 * (prices, stock, totals) always originate from application code.
 */

function toSummary(p: Product): ProductSummary {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    brand: p.brand,
    category: p.category,
    description:
      p.description.length > 160
        ? `${p.description.slice(0, 157).trimEnd()}...`
        : p.description,
    price: p.price,
    currency: p.currency,
    ratingTenths: p.ratingTenths,
    reviewCount: p.reviewCount,
    stock: p.stock,
    tags: p.tags,
    specs: p.specs,
  };
}

export async function runSearchProducts(
  input: z.infer<typeof searchProductsInput>,
): Promise<{ products: ProductSummary[]; total: number }> {
  const catalog = await getCatalogProvider();
  const page = await catalog.search({
    q: input.query,
    categories: input.category ? [input.category as CategorySlug] : undefined,
    brands: input.brands,
    tags: input.tags,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    inStockOnly: input.inStockOnly,
    sort: input.sort ?? (input.query ? "relevance" : "popular"),
    pageSize: input.limit,
  });
  return {
    products: page.items.map(toSummary),
    total: page.total,
  };
}

export async function runGetProduct(
  input: z.infer<typeof getProductInput>,
): Promise<{ product: ProductSummary | null; message?: string }> {
  const catalog = await getCatalogProvider();
  const bySlug = await catalog.getBySlug(input.slugOrId);
  const product = bySlug ?? (await catalog.getById(input.slugOrId));
  if (!product) {
    return {
      product: null,
      message: `No product matches "${input.slugOrId}" in the catalog.`,
    };
  }
  return { product: toSummary(product) };
}

const money = (n: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(n / 100);

export async function runCompareProducts(
  input: z.infer<typeof compareProductsInput>,
): Promise<{
  products: ProductSummary[];
  rows: Array<{ label: string; values: string[]; differs: boolean }>;
  highlights: string[];
  notFound: string[];
}> {
  const catalog = await getCatalogProvider();
  const found = await catalog.getByIds(input.productIds);
  const foundIds = new Set(found.map((p) => p.id));
  const notFound = input.productIds.filter((id) => !foundIds.has(id));

  if (found.length < 2) {
    return { products: [], rows: [], highlights: [], notFound };
  }

  const summaries = found.map(toSummary);
  const rows: Array<{ label: string; values: string[]; differs: boolean }> = [];
  const pushRow = (label: string, values: Array<string | number>) => {
    const strs = values.map((v) => String(v));
    rows.push({ label, values: strs, differs: new Set(strs).size > 1 });
  };

  pushRow("Price", found.map((p) => money(p.price, p.currency)));
  pushRow(
    "Rating",
    found.map((p) => `${(p.ratingTenths / 10).toFixed(1)} (${p.reviewCount.toLocaleString("en-US")})`),
  );
  pushRow("Availability", found.map((p) => (p.stock > 0 ? `${p.stock} in stock` : "Out of stock")));

  const specKeys = [
    ...new Set(found.flatMap((p) => Object.keys(p.specs))),
  ].slice(0, 12);
  for (const key of specKeys) {
    pushRow(key, found.map((p) => p.specs[key] ?? "—"));
  }

  const highlights: string[] = [];
  const prices = found.map((p) => p.price);
  const priceSpread = Math.max(...prices) - Math.min(...prices);
  if (priceSpread > 0) {
    const cheapest = found.reduce((a, b) => (a.price <= b.price ? a : b));
    highlights.push(
      `Biggest price gap is ${money(priceSpread)} — ${cheapest.title} is the value anchor.`,
    );
  }
  const ratings = found.map((p) => p.ratingTenths);
  if (new Set(ratings).size > 1) {
    const best = found.reduce((a, b) => (a.ratingTenths >= b.ratingTenths ? a : b));
    highlights.push(`${best.title} carries the strongest rating of the set.`);
  } else {
    highlights.push(`All three rate identically — decide on specs and fit.`);
  }
  const differingSpecs = specKeys.filter(
    (key) => new Set(found.map((p) => p.specs[key] ?? "")).size > 1,
  );
  if (differingSpecs.length > 0) {
    highlights.push(`Decide on: ${differingSpecs.slice(0, 4).join(", ")}.`);
  }

  return { products: summaries, rows, highlights, notFound };
}

export async function runFindAlternatives(input: {
  productId: string;
  direction?: "cheaper" | "similar" | "better";
  maxPrice?: number;
}): Promise<{
  baseProductId: string;
  alternatives: ProductSummary[];
}> {
  const catalog = await getCatalogProvider();
  const base =
    (await catalog.getById(input.productId)) ??
    (await catalog.getBySlug(input.productId));
  if (!base) return { baseProductId: input.productId, alternatives: [] };

  const direction = input.direction ?? "similar";
  let maxPrice: number | undefined;
  if (direction === "cheaper") {
    maxPrice = Math.min(input.maxPrice ?? base.price - 1, base.price - 1);
  } else if (input.maxPrice !== undefined) {
    maxPrice = input.maxPrice;
  }

  const result = await catalog.search({
    categories: [base.category],
    maxPrice: maxPrice && maxPrice > 0 ? maxPrice : undefined,
    minPrice: direction === "better" ? base.price : undefined,
    sort: direction === "better" ? "rating" : "popular",
    pageSize: 12,
  });

  const alternatives = result.items
    .filter((p) => p.id !== base.id && p.stock > 0)
    .filter((p) => (direction === "better" ? p.ratingTenths >= base.ratingTenths : true))
    .sort((a, b) =>
      direction === "cheaper"
        ? b.price - a.price // closest to the original from below
        : b.ratingTenths - a.ratingTenths || a.price - b.price,
    )
    .slice(0, 4)
    .map(toSummary);

  return { baseProductId: base.id, alternatives };
}

export async function runRecommendProduct(
  input: {
    productId: string;
    budget?: number;
    useCaseTags?: string[];
  },
): Promise<Recommendation | null> {
  const catalog = await getCatalogProvider();
  const product =
    (await catalog.getById(input.productId)) ??
    (await catalog.getBySlug(input.productId));
  if (!product) return null;

  const peersPage = await catalog.search({
    categories: [product.category],
    pageSize: 24,
  });
  return computeRecommendation(product, {
    budget: input.budget,
    useCaseTags: input.useCaseTags,
    peers: peersPage.items.filter((p) => p.stock >= 0),
  });
}

export async function runBuildBundle(input: {
  description?: string;
  budget?: number;
  productIds?: string[];
  focusTags?: string[];
}): Promise<Bundle | null> {
  const catalog = await getCatalogProvider();

  if (input.productIds && input.productIds.length > 0) {
    const products = await catalog.getByIds(input.productIds);
    const bundle = validateExplicitBundle(products, input.budget);
    if (bundle) return bundle;
  }

  const candidates: Array<{
    product: Product;
    area: string;
    score: number;
  }> = [];

  const areas = (input.focusTags ?? []).slice(0, 4);
  for (const tag of areas) {
    const page = await catalog.search({
      tags: [tag],
      inStockOnly: true,
      sort: "rating",
      pageSize: 8,
    });
    for (const p of page.items) {
      candidates.push({ product: p, area: tag, score: defaultScore(p) });
    }
  }

  if (candidates.length === 0 && input.description) {
    const page = await catalog.search({
      q: input.description,
      inStockOnly: true,
      sort: "rating",
      pageSize: 16,
    });
    for (const p of page.items) {
      candidates.push({ product: p, area: p.category, score: defaultScore(p) });
    }
  }

  return buildBundleFromCandidates({
    budget: input.budget,
    explicit: [],
    candidates,
    maxItems: Math.max(3, areas.length || 4),
  });
}

function defaultScore(p: Product): number {
  return p.ratingTenths * 10 + Math.log10(p.reviewCount + 10) * 5;
}

/* ── Cart-backed operations ─────────────────────────────────────────────── */

async function cartPayload(): Promise<CartPayload> {
  const provider = await getCartProvider();
  const ref = await resolveCartRef();
  if (!provider || !ref) throw new Error("Cart unavailable");
  const cart = await provider.getCart(ref);
  return {
    ...cart,
  };
}

export async function runGetCart(): Promise<{ cart: CartPayload }> {
  return { cart: await cartPayload() };
}

export async function runAddToCart(
  input: z.infer<typeof addToCartInput>,
  guard: {
    expectedPrice?: number;
    expectedVariantId?: string;
    operationId?: string;
  } = {},
): Promise<{
  ok: boolean;
  message: string;
  cart: CartPayload | null;
}> {
  const provider = await getCartProvider();
  if (!provider) throw new Error("Cart unavailable");
  const ref = await ensureCartRef();
  const product = await runGetProduct({ slugOrId: input.productId });
  if (!product.product) throw new Error(product.message ?? "Unknown product.");
  if (guard.expectedPrice !== undefined && product.product.price !== guard.expectedPrice) {
    throw new Error("The canonical price changed before the cart action was acknowledged.");
  }
  const cart = await provider.addItem(
    ref,
    guard.expectedVariantId ?? input.productId,
    input.quantity,
    "agent",
    guard.operationId,
  );
  return {
    ok: true,
    message: `Added ${quantityPhrase(input.quantity)}${product.product ? ` — ${product.product.title}` : ""} to your cart.`,
    cart,
  };
}

function quantityPhrase(qty: number): string {
  return qty === 1 ? "1 item" : `${qty} items`;
}

export async function runUpdateCart(input: z.infer<typeof updateCartInput>) {
  const provider = await getCartProvider();
  if (!provider) throw new Error("Cart unavailable");
  const ref = await ensureCartRef();
  const cart =
    input.quantity === 0
      ? await provider.removeItem(ref, input.productId)
      : await provider.setItemQuantity(ref, input.productId, input.quantity);
  return {
    ok: true,
    message:
      input.quantity === 0
        ? "Removed from your cart."
        : `Updated quantity to ${input.quantity}.`,
    cart,
  };
}

export async function runRemoveFromCart(input: z.infer<typeof removeFromCartInput>) {
  const provider = await getCartProvider();
  if (!provider) throw new Error("Cart unavailable");
  const ref = await ensureCartRef();
  const cart = await provider.removeItem(ref, input.productId);
  return { ok: true, message: "Removed from your cart.", cart };
}

/* ── Save & checkout ────────────────────────────────────────────────────── */

export async function runSaveProduct(input: { productId: string }) {
  const { getSavedService } = await import("@/lib/saved");
  const saved = await getSavedService();
  if (!saved) return { saved: false, message: "Saving is unavailable right now." };
  const user = await getSessionUser();
  const ref = user ? { kind: "user" as const, userId: user.id } : await ensureGuestRef();
  const product = await runGetProduct({ slugOrId: input.productId });
  if (!product.product) {
    return { saved: false, message: "That product no longer exists." };
  }
  const result = await saved.save(ref, input.productId);
  return {
    saved: result.saved,
    message: result.saved
      ? `Saved ${product.product.title} to your list.`
      : `${product.product.title} was already in your saved list.`,
  };
}

async function ensureGuestRef(): Promise<{ kind: "guest"; token: string }> {
  const { ensureCartRef } = await import("@/lib/cart/session");
  const ref = await ensureCartRef();
  if (ref.kind === "user") throw new Error("Unexpected auth state");
  return ref;
}

export async function runPrepareCheckout(): Promise<
  z.infer<typeof prepareCheckoutOutput>
> {
  if (medusaEnabled()) {
    return {
      ready: false,
      message: "Checkout isn't available right now. Medusa payment setup is required.",
    };
  }
  const checkout = await getCheckoutService();
  const provider = await getCartProvider();
  if (!checkout || !provider) {
    return { ready: false, message: "Checkout isn't available right now." };
  }
  const ref = await resolveCartRef();
  if (!ref) return { ready: false, message: "Your cart is empty." };
  const cart = await provider.getCart(ref);
  if (cart.lines.length === 0) {
    return { ready: false, message: "Your cart is empty — add something first." };
  }
  const user = await getSessionUser();
  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
  const prep = await checkout.prepareCheckout(user?.id ?? null, cart, origin);
  return {
    ready: true,
    orderId: prep.orderId,
    url: prep.url,
    mode: prep.mode,
    total: cart.total,
    currency: cart.currency,
    itemCount: cart.itemCount,
    message:
      prep.mode === "stripe"
        ? "I've prepared a Stripe Checkout session. Complete payment to place the order."
        : "I've prepared your order. Open checkout to confirm it — I'll never place an order without you.",
  };
}
