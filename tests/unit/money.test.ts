import { describe, expect, it } from "vitest";

import {
  applyBps,
  computeTotals,
  formatMoney,
  formatMoneyCompact,
  formatRating,
  parsePriceInputToMinor,
} from "@/lib/money";

describe("formatMoney", () => {
  it("formats integer minor units", () => {
    expect(formatMoney(0)).toBe("$0.00");
    expect(formatMoney(5)).toBe("$0.05");
    expect(formatMoney(19900)).toBe("$199.00");
    expect(formatMoney(1234567)).toBe("$12,345.67");
  });

  it("throws on non-integer input (no float prices)", () => {
    expect(() => formatMoney(19.99)).toThrow(TypeError);
    expect(() => formatMoney(Number.NaN)).toThrow(TypeError);
  });

  it("handles negatives and other currencies", () => {
    expect(formatMoney(-500)).toBe("-$5.00");
    expect(formatMoney(1000, "EUR")).toBe("€10.00");
  });
});

describe("formatMoneyCompact / formatRating", () => {
  it("drops trailing .00 only", () => {
    expect(formatMoneyCompact(19900)).toBe("$199");
    expect(formatMoneyCompact(19999)).toBe("$199.99");
  });

  it("renders tenths-based ratings", () => {
    expect(formatRating(48)).toBe("4.8");
    expect(formatRating(40)).toBe("4.0");
  });
});

describe("parsePriceInputToMinor", () => {
  it("parses common user input", () => {
    expect(parsePriceInputToMinor("$250")).toBe(25000);
    expect(parsePriceInputToMinor("1,800")).toBe(180000);
    expect(parsePriceInputToMinor("1299.50")).toBe(129950);
    expect(parsePriceInputToMinor(" 42 ")).toBe(4200);
  });

  it("rejects garbage instead of guessing", () => {
    expect(parsePriceInputToMinor("abc")).toBeNull();
    expect(parsePriceInputToMinor("-5")).toBeNull();
    expect(parsePriceInputToMinor("")).toBeNull();
    expect(parsePriceInputToMinor("1.234")).toBeNull();
  });
});

describe("computeTotals — server-side cart math", () => {
  it("sums lines and applies free shipping over $75", () => {
    const totals = computeTotals([{ unitPrice: 4000, quantity: 2 }]); // $80
    expect(totals.subtotal).toBe(8000);
    expect(totals.shipping).toBe(0);
    expect(totals.tax).toBe(640); // 8%
    expect(totals.total).toBe(8640);
  });

  it("charges flat shipping below the threshold", () => {
    const totals = computeTotals([{ unitPrice: 2500, quantity: 1 }]);
    expect(totals.shipping).toBe(499);
    expect(totals.tax).toBe(200);
    expect(totals.total).toBe(2500 + 499 + 200);
  });

  it("never charges shipping on an empty cart", () => {
    const totals = computeTotals([]);
    expect(totals).toEqual({ subtotal: 0, shipping: 0, tax: 0, total: 0 });
  });

  it("is exact at the free-shipping boundary", () => {
    expect(computeTotals([{ unitPrice: 7500, quantity: 1 }]).shipping).toBe(0);
    expect(computeTotals([{ unitPrice: 7499, quantity: 1 }]).shipping).toBe(499);
  });
});

describe("applyBps", () => {
  it("rounds half-up on integers", () => {
    expect(applyBps(19900, 800)).toBe(1592);
    expect(applyBps(101, 5000)).toBe(51); // 50.5 → 51
    expect(applyBps(0, 800)).toBe(0);
  });
});
