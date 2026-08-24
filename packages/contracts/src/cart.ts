import type { CartTotalsLike } from "./money";

export interface CartLine {
  productId: string;
  slug: string;
  title: string;
  brand: string;
  quantity: number;
  /** Integer minor units, sourced from the catalog — never from the client. */
  unitPrice: number;
  lineTotal: number;
  stock: number;
  currency: string;
  imageHint?: string;
}

export interface CartDTO extends CartTotalsLike {
  id: string | null;
  lines: CartLine[];
  itemCount: number;
  currency: string;
}

export const EMPTY_CART: CartDTO = {
  id: null,
  lines: [],
  subtotal: 0,
  shipping: 0,
  tax: 0,
  total: 0,
  itemCount: 0,
  currency: "USD",
};

export type CartErrorCode =
  | "invalid_product"
  | "invalid_quantity"
  | "out_of_stock"
  | "cart_not_found"
  | "price_changed";

export class CartError extends Error {
  constructor(
    public readonly code: CartErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CartError";
  }
}

/** Clamp quantity into the allowed range [1, MAX_QTY_PER_LINE]. */
export const MAX_QTY_PER_LINE = 10;

export function clampQuantity(quantity: number): number {
  if (!Number.isInteger(quantity)) throw new CartError("invalid_quantity", "Quantity must be a whole number.");
  if (quantity < 1) throw new CartError("invalid_quantity", "Quantity must be at least 1.");
  return Math.min(quantity, MAX_QTY_PER_LINE);
}

/**
 * Merge a guest cart's lines into an existing user cart.
 * Pure function used by both providers and tests.
 */
export function mergedLineQuantities(
  userLines: Map<string, number>,
  guestLines: Array<{ productId: string; quantity: number }>,
): Map<string, number> {
  const result = new Map(userLines);
  for (const line of guestLines) {
    const current = result.get(line.productId) ?? 0;
    result.set(line.productId, Math.min(current + line.quantity, MAX_QTY_PER_LINE));
  }
  return result;
}
