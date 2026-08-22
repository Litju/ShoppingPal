/**
 * Money is always stored and transported as integer minor currency units
 * (e.g. cents). Floating point is never used for persisted prices.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
};

/** Format integer minor units as a display string: 249900 -> "$2,499.00" */
export function formatMoney(minorUnits: number, currency = "USD"): string {
  if (!Number.isInteger(minorUnits)) {
    throw new TypeError(`formatMoney expects integer minor units, got ${minorUnits}`);
  }
  const negative = minorUnits < 0;
  const abs = Math.abs(minorUnits);
  const major = Math.floor(abs / 100);
  const cents = abs % 100;
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const majorStr = major.toLocaleString("en-US");
  const centStr = cents.toString().padStart(2, "0");
  return `${negative ? "-" : ""}${symbol}${majorStr}.${centStr}`;
}

/** Compact display for tight spaces: drops ".00" when whole dollars. */
export function formatMoneyCompact(minorUnits: number, currency = "USD"): string {
  const full = formatMoney(minorUnits, currency);
  return full.endsWith(".00") ? full.slice(0, -3) : full;
}

/** Parse a user-typed dollar amount ("1,299", "1299.50", "$250") to minor units. */
export function parsePriceInputToMinor(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export interface CartTotalsLike {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
}

/**
 * Pure cart math shared by every surface. All inputs are integer minor units.
 * Shipping is free over FREE_SHIPPING_THRESHOLD, otherwise flat fee.
 */
export const FREE_SHIPPING_THRESHOLD = 7500;
export const FLAT_SHIPPING = 499;
export const TAX_RATE_BPS = 800; // 8.00% in basis points — integer math only

export function computeTotals(
  lines: Array<{ unitPrice: number; quantity: number }>,
): CartTotalsLike {
  const subtotal = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const shipping =
    subtotal === 0 || subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING;
  const tax = applyBps(subtotal, TAX_RATE_BPS);
  const total = subtotal + shipping + tax;
  return { subtotal, shipping, tax, total };
}

/** Multiply by basis points with round-half-up on integers. */
export function applyBps(amountMinor: number, bps: number): number {
  return Math.round((amountMinor * bps) / 10_000);
}

/** Rating is stored in tenths of a star (48 => 4.8). */
export function formatRating(ratingTenths: number): string {
  return (ratingTenths / 10).toFixed(1);
}
