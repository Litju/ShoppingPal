import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { CartError } from "@shoppingpal/contracts";
import type { CartRef } from "@/lib/cart/types";
import { MedusaCartProvider } from "@/lib/cart/medusa-cart-provider";
import type { MedusaClient } from "@/lib/commerce/medusa-client";

const REGION_ID = "reg_test_usd";
const CART_ID = "cart_test";

type Variant = {
  id: string;
  inventory_quantity: number;
  manage_inventory: boolean;
  calculated_price: { calculated_amount: number; currency_code: string };
};

type Product = {
  id: string;
  handle: string;
  title: string;
  variants: Variant[];
};

const products: Product[] = [
  {
    id: "prod_tidepool",
    handle: "tidepool-sprint-2-earbuds",
    title: "Tidepool Sprint 2 Earbuds",
    variants: [
      {
        id: "variant_tidepool",
        inventory_quantity: 120,
        manage_inventory: true,
        calculated_price: { calculated_amount: 8900, currency_code: "usd" },
      },
    ],
  },
  {
    id: "prod_marlowe",
    handle: "marlowe-pulse-anc-headphones",
    title: "Marlowe Pulse ANC Headphones",
    variants: [
      {
        id: "variant_marlowe",
        inventory_quantity: 61,
        manage_inventory: true,
        calculated_price: { calculated_amount: 19900, currency_code: "usd" },
      },
    ],
  },
  {
    id: "prod_sold_out",
    handle: "cascade-45qt-cooler",
    title: "Cascade 45QT Cooler",
    variants: [
      {
        id: "variant_sold_out",
        inventory_quantity: 0,
        manage_inventory: true,
        calculated_price: { calculated_amount: 15900, currency_code: "usd" },
      },
    ],
  },
];

const ref: CartRef = { kind: "guest", token: CART_ID };

function emptyCart() {
  return {
    id: CART_ID,
    items: [],
    subtotal: 0,
    shipping_total: 0,
    tax_total: 0,
    total: 0,
    currency_code: "usd",
  };
}

function makeClient() {
  const getCalls: string[] = [];
  const postCalls: Array<{ path: string; body: unknown }> = [];
  const client = {
    get: async <T>(path: string): Promise<T> => {
      getCalls.push(path);
      if (path === `/store/carts/${CART_ID}`) {
        return { cart: emptyCart() } as T;
      }

      const url = new URL(`http://test${path}`);
      if (url.pathname.startsWith("/store/products/")) {
        const productId = url.pathname.split("/").pop();
        const product = products.find((item) => item.id === productId);
        if (!product) throw new Error("not found");
        return { product } as T;
      }

      if (url.pathname === "/store/products") {
        const handle = url.searchParams.get("handle");
        const variantId =
          url.searchParams.get("variants.id[]") ?? url.searchParams.get("variants.id");
        const product = products.find(
          (item) =>
            item.handle === handle ||
            item.variants.some((variant) => variant.id === variantId),
        );
        return { products: product ? [product] : [] } as T;
      }

      throw new Error(`Unexpected GET ${path}`);
    },
    post: async <T>(path: string, body?: unknown): Promise<T> => {
      postCalls.push({ path, body });
      const variantId = (body as { variant_id?: string } | undefined)?.variant_id;
      const product = products.find((item) =>
        item.variants.some((variant) => variant.id === variantId),
      );
      const variant = product?.variants.find((item) => item.id === variantId);
      if (!product || !variant) throw new Error("variant not found");
      const quantity = (body as { quantity: number }).quantity;
      const amount = variant.calculated_price.calculated_amount * quantity;
      return {
        cart: {
          ...emptyCart(),
          items: [
            {
              id: "line_test",
              title: product.title,
              product_id: product.id,
              product_handle: product.handle,
              variant_id: variant.id,
              quantity,
              unit_price: variant.calculated_price.calculated_amount,
            },
          ],
          subtotal: amount,
          total: amount,
        },
      } as T;
    },
  } as unknown as MedusaClient;

  return { client, getCalls, postCalls };
}

function createProvider(client: MedusaClient) {
  return new MedusaCartProvider(client, REGION_ID);
}

function makeCheckoutClient() {
  const postCalls: Array<{ path: string; body: unknown }> = [];
  const cart = {
    ...emptyCart(),
    items: [
      {
        id: "line_test",
        title: "Marlowe Pulse ANC Headphones",
        product_id: "prod_marlowe",
        product_handle: "marlowe-pulse-anc-headphones",
        variant_id: "variant_marlowe",
        quantity: 1,
        unit_price: 19900,
      },
    ],
    subtotal: 19900,
    total: 19900,
  };
  const client = {
    get: async <T>(path: string): Promise<T> => {
      if (path === `/store/carts/${CART_ID}`) return { cart } as T;
      throw new Error(`Unexpected GET ${path}`);
    },
    post: async <T>(path: string, body?: unknown): Promise<T> => {
      postCalls.push({ path, body });
      if (path === `/store/carts/${CART_ID}`) return {} as T;
      if (path === "/store/payment-collections") {
        return { payment_collection: { id: "paycol_test" } } as T;
      }
      if (path === "/store/payment-collections/paycol_test/payment-sessions") {
        return {
          payment_collection: {
            id: "paycol_test",
            payment_sessions: [
              {
                id: "session_test",
                provider_id: "pp_stripe_stripe",
                data: { client_secret: "pi_test_secret" },
              },
            ],
          },
        } as T;
      }
      throw new Error(`Unexpected POST ${path}`);
    },
  } as unknown as MedusaClient;
  return { client, postCalls };
}

describe("MedusaCartProvider variant resolution", () => {
  const previousEnv = {
    backend: process.env.MEDUSA_BACKEND_URL,
    key: process.env.MEDUSA_PUBLISHABLE_KEY,
    region: process.env.MEDUSA_REGION_ID,
  };

  beforeAll(() => {
    process.env.MEDUSA_BACKEND_URL = "http://localhost:9000";
    process.env.MEDUSA_PUBLISHABLE_KEY = "pk_fixture";
    process.env.MEDUSA_REGION_ID = REGION_ID;
  });

  afterAll(() => {
    if (previousEnv.backend === undefined) delete process.env.MEDUSA_BACKEND_URL;
    else process.env.MEDUSA_BACKEND_URL = previousEnv.backend;
    if (previousEnv.key === undefined) delete process.env.MEDUSA_PUBLISHABLE_KEY;
    else process.env.MEDUSA_PUBLISHABLE_KEY = previousEnv.key;
    if (previousEnv.region === undefined) delete process.env.MEDUSA_REGION_ID;
    else process.env.MEDUSA_REGION_ID = previousEnv.region;
  });

  it.each([
    ["prod_tidepool", "variant_tidepool"],
    ["prod_marlowe", "variant_marlowe"],
  ])("adds the known purchasable product %s", async (productId, variantId) => {
    const { client, getCalls, postCalls } = makeClient();
    const cart = await createProvider(client).addItem(ref, productId, 1);
    const expected = products.find((product) => product.id === productId)!;

    expect(cart.itemCount).toBe(1);
    expect(cart.lines[0]).toMatchObject({
      productId,
      slug: expected.handle,
      quantity: 1,
      unitPrice: expected.variants[0]!.calculated_price.calculated_amount,
    });
    expect(postCalls).toHaveLength(1);
    expect(postCalls[0]!.body).toMatchObject({ variant_id: variantId, quantity: 1 });
    expect(getCalls.some((path) => path.startsWith(`/store/products/${productId}?`))).toBe(true);
    expect(
      getCalls
        .filter((path) => path.includes("/store/products"))
        .every((path) => path.includes(`region_id=${REGION_ID}`)),
    ).toBe(true);
  });

  it("rejects an invalid product without reaching the cart mutation", async () => {
    const { client, postCalls } = makeClient();

    await expect(createProvider(client).addItem(ref, "prod_missing", 1)).rejects.toMatchObject({
      name: "CartError",
      code: "invalid_product",
    } satisfies Partial<CartError>);
    expect(postCalls).toHaveLength(0);
  });

  it("reports a canonical out-of-stock variant as non-purchasable", async () => {
    const { client, postCalls } = makeClient();

    await expect(createProvider(client).addItem(ref, "prod_sold_out", 1)).rejects.toMatchObject({
      name: "CartError",
      code: "out_of_stock",
    } satisfies Partial<CartError>);
    expect(postCalls).toHaveLength(0);
  });

  it("initializes a Stripe payment session from the canonical cart", async () => {
    const { client, postCalls } = makeCheckoutClient();
    const session = await createProvider(client).initializeStripeCheckout(ref, {
      email: "buyer@example.com",
      firstName: "Test",
      lastName: "Buyer",
      address1: "1 Market Street",
      city: "San Francisco",
      postalCode: "94105",
      countryCode: "US",
    });

    expect(session).toEqual({ cartId: CART_ID, clientSecret: "pi_test_secret" });
    expect(postCalls.map(({ path }) => path)).toEqual([
      `/store/carts/${CART_ID}`,
      "/store/payment-collections",
      "/store/payment-collections/paycol_test/payment-sessions",
    ]);
  });
});
