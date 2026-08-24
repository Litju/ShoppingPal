import { afterEach, describe, expect, it } from "vitest";

import {
  checkoutReceiptConfigured,
  sealCheckoutOrder,
  verifyCheckoutOrder,
} from "@/lib/checkout/receipt";

const previous = process.env.CHECKOUT_RECEIPT_SECRET;

afterEach(() => {
  if (previous === undefined) delete process.env.CHECKOUT_RECEIPT_SECRET;
  else process.env.CHECKOUT_RECEIPT_SECRET = previous;
});

describe("checkout receipt binding", () => {
  it("accepts only a server-sealed matching order id", () => {
    process.env.CHECKOUT_RECEIPT_SECRET = "receipt-test-secret";
    const sealed = sealCheckoutOrder("order_test")!;

    expect(verifyCheckoutOrder("order_test", sealed)).toBe(true);
    expect(verifyCheckoutOrder("order_other", sealed)).toBe(false);
    expect(verifyCheckoutOrder("order_test", `${sealed}tampered`)).toBe(false);
    expect(verifyCheckoutOrder("order_test", "order_test.fake")).toBe(false);
  });

  it("fails closed in production without the dedicated receipt secret", () => {
    const env = process.env as Record<string, string | undefined>;
    const previousNodeEnv = env.NODE_ENV;
    try {
      env.NODE_ENV = "production";
      delete env.CHECKOUT_RECEIPT_SECRET;
      expect(checkoutReceiptConfigured()).toBe(false);
    } finally {
      if (previousNodeEnv === undefined) delete env.NODE_ENV;
      else env.NODE_ENV = previousNodeEnv;
    }
  });
});
