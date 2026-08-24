import { afterEach, describe, expect, it } from "vitest";

import { sealCheckoutOrder, verifyCheckoutOrder } from "@/lib/checkout/receipt";

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
});
