import { z } from "zod";

/** Product projection sent to the UI and validated at the boundary. */
export const productSummarySchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  brand: z.string(),
  category: z.string(),
  /** Truncated marketing-free description (~160 chars). */
  description: z.string(),
  /** Integer minor units (cents). */
  price: z.number().int(),
  currency: z.string(),
  ratingTenths: z.number().int(),
  reviewCount: z.number().int(),
  stock: z.number().int(),
  tags: z.array(z.string()),
  specs: z.record(z.string(), z.string()),
});

export type ProductSummary = z.infer<typeof productSummarySchema>;

/* ── searchProducts ─────────────────────────────────────────────────────── */

export const sortOptionSchema = z.enum([
  "relevance",
  "price-asc",
  "price-desc",
  "rating",
  "popular",
]);

export const searchProductsInput = z.object({
  query: z.string().max(200).optional().describe("Free-text query."),
  category: z.string().max(40).optional().describe("Category slug filter."),
  brands: z.array(z.string().max(60)).max(6).optional(),
  tags: z.array(z.string().max(40)).max(6).optional(),
  minPrice: z.number().int().min(0).optional().describe("Minimum price in cents."),
  maxPrice: z.number().int().min(0).optional().describe("Maximum price in cents."),
  inStockOnly: z.boolean().optional(),
  sort: sortOptionSchema.optional(),
  limit: z.number().int().min(1).max(12).default(6),
});

export const searchProductsOutput = z.object({
  products: z.array(productSummarySchema),
  total: z.number().int(),
});

/* ── getProduct ─────────────────────────────────────────────────────────── */

export const getProductInput = z.object({
  slugOrId: z.string().min(1).max(120),
});

export const getProductOutput = z.object({
  product: productSummarySchema.nullable(),
  message: z.string().optional(),
});

/* ── compareProducts ────────────────────────────────────────────────────── */

export const compareProductsInput = z.object({
  productIds: z.array(z.string()).min(2).max(4),
});

export const comparisonRowSchema = z.object({
  label: z.string(),
  values: z.array(z.string()),
  /** True when this row differs meaningfully between products. */
  differs: z.boolean(),
});

export const compareProductsOutput = z.object({
  products: z.array(productSummarySchema),
  rows: z.array(comparisonRowSchema),
  highlights: z.array(z.string()),
  notFound: z.array(z.string()),
});

/* ── findAlternatives ───────────────────────────────────────────────────── */

export const findAlternativesInput = z.object({
  productId: z.string().min(1),
  direction: z
    .enum(["cheaper", "similar", "better"])
    .default("similar")
    .describe("cheaper = lower price tier, better = higher rating tier."),
  maxPrice: z.number().int().min(0).optional(),
});

export const findAlternativesOutput = z.object({
  baseProductId: z.string(),
  alternatives: z.array(productSummarySchema),
});

/* ── recommendProduct ───────────────────────────────────────────────────── */

export const recommendProductInput = z.object({
  productId: z.string().min(1),
  budget: z.number().int().min(0).optional().describe("User's stated budget in cents."),
  useCaseTags: z.array(z.string().max(40)).max(6).optional().describe(
    "Use-case requirements stated by the user (e.g. gym, commute).",
  ),
});

export const recommendationSchema = z.object({
  product: productSummarySchema,
  reasons: z.array(z.string()).min(1),
  tradeoffs: z.array(z.string()),
  budgetRemaining: z.number().int().nullable(),
  overBudgetBy: z.number().int().nullable(),
});

export type Recommendation = z.infer<typeof recommendationSchema>;

/* ── buildBundle ────────────────────────────────────────────────────────── */

export const buildBundleInput = z.object({
  description: z.string().max(400).optional(),
  budget: z.number().int().min(0).optional(),
  productIds: z.array(z.string()).max(8).optional().describe(
    "Explicit items to bundle (validated against budget when given).",
  ),
  focusTags: z.array(z.string().max(40)).max(4).optional(),
});

export const bundleSchema = z.object({
  items: z.array(productSummarySchema).min(1),
  total: z.number().int(),
  budget: z.number().int().nullable(),
  remaining: z.number().int().nullable(),
  overflow: z.number().int().nullable(),
  rationale: z.array(z.string()).min(1),
});

export type Bundle = z.infer<typeof bundleSchema>;
export const buildBundleOutput = bundleSchema;

/* ── Cart tools ─────────────────────────────────────────────────────────── */

const cartLineSchema = z.object({
  productId: z.string(),
  slug: z.string(),
  title: z.string(),
  brand: z.string(),
  quantity: z.number().int(),
  unitPrice: z.number().int(),
  lineTotal: z.number().int(),
  stock: z.number().int(),
  currency: z.string(),
});

export const cartSchema = z.object({
  id: z.string().nullable(),
  itemCount: z.number().int(),
  subtotal: z.number().int(),
  shipping: z.number().int(),
  tax: z.number().int(),
  total: z.number().int(),
  currency: z.string(),
  lines: z.array(cartLineSchema),
});

export type CartPayload = z.infer<typeof cartSchema>;

export const getCartInput = z.object({});

export const getCartOutput = z.object({ cart: cartSchema });

export const cartMutationOutput = z.object({
  ok: z.boolean(),
  message: z.string(),
  cart: cartSchema.nullable(),
});
export const addToCartOutput = cartMutationOutput;
export const updateCartOutput = cartMutationOutput;
export const removeFromCartOutput = cartMutationOutput;

export const addToCartInput = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(10).default(1),
});

export const updateCartInput = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(0).max(10),
});

export const removeFromCartInput = z.object({
  productId: z.string().min(1),
});

/* ── saveProduct ────────────────────────────────────────────────────────── */

export const saveProductInput = z.object({ productId: z.string().min(1) });

export const saveProductOutput = z.object({
  saved: z.boolean(),
  message: z.string(),
});

/* ── prepareCheckout ────────────────────────────────────────────────────── */

export const prepareCheckoutInput = z.object({});

export const prepareCheckoutOutput = z.object({
  ready: z.boolean(),
  orderId: z.string().optional(),
  url: z.string().optional(),
  mode: z.enum(["stripe", "demo"]).optional(),
  total: z.number().int().optional(),
  currency: z.string().optional(),
  itemCount: z.number().int().optional(),
  message: z.string().optional(),
});
