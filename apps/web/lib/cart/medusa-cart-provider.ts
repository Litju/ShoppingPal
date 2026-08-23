import {
  CartError,
  clampQuantity,
  EMPTY_CART,
  type CartDTO,
} from "@shoppingpal/contracts";

import { getMedusaConfig } from "@/lib/commerce/config";
import { MedusaClient } from "@/lib/commerce/medusa-client";
import type { CartRef } from "@/lib/cart/drizzle-cart-provider";

/**
 * MedusaCartAdapter — canonical cart authority (design doc §4/§11.2).
 *
 * Implements the same surface as the legacy DrizzleCartProvider so the
 * storefront session layer can switch runtimes without UI changes.
 *
 * Identity mapping:
 *   {kind:"guest", token}  → token stores the anonymous Medusa cart id.
 *   {kind:"user", userId}  → per-user cart id is kept in a server cookie;
 *                            the cart is attached to the customer during
 *                            auth cutover (Gate D).
 */

interface MedusaCartLineItem {
  id: string;
  title: string;
  subtitle?: string | null;
  product_handle?: string | null;
  product_id?: string | null;
  variant_id?: string | null;
  quantity: number;
  unit_price: number;
  thumbnail?: string | null;
}

interface MedusaCart {
  id: string;
  items?: MedusaCartLineItem[];
  subtotal: number;
  shipping_total: number;
  tax_total: number;
  total: number;
  currency_code: string;
}

interface StoreProduct {
  id: string;
  handle: string;
  title: string;
  variants: Array<{
    id: string;
    inventory_quantity?: number;
    manage_inventory?: boolean;
    calculated_price?: { calculated_amount?: number; currency_code?: string } | null;
  }>;
}

export class MedusaCartProvider {
  readonly name = "medusa-cart";

  private readonly client: MedusaClient;
  private regionId: string;

  constructor(client?: MedusaClient, regionId?: string) {
    const config = getMedusaConfig();
    if (!config) throw new Error("Medusa is not configured");
    this.client = client ?? new MedusaClient(config);
    this.regionId = regionId ?? config.regionId ?? "";
  }

  private async ensureRegionId(): Promise<string> {
    if (this.regionId) return this.regionId;
    const regions = await this.client.get<{ regions: Array<{ id: string }> }>(
      "/store/regions?limit=1",
    );
    const id = regions.regions[0]?.id;
    if (!id) throw new Error("Medusa has no region configured");
    this.regionId = id;
    return id;
  }

  private async fetchCart(cartId: string): Promise<MedusaCart | null> {
    try {
      const res = await this.client.get<{ cart: MedusaCart }>(
        `/store/carts/${cartId}`,
      );
      return res.cart;
    } catch {
      return null;
    }
  }

  private toDto(medusa: MedusaCart): CartDTO {
    // Line presentation is hydrated from catalog state server-side; Medusa
    // already revalidated prices at add/update time.
    return {
      id: medusa.id,
      lines: (medusa.items ?? []).map((item) => ({
        productId: item.product_id ?? item.id,
        slug: item.product_handle ?? "",
        title: item.title,
        brand: item.subtitle ?? "",
        quantity: item.quantity,
        unitPrice: item.unit_price,
        lineTotal: item.unit_price * item.quantity,
        stock: Number.MAX_SAFE_INTEGER,
        currency: medusa.currency_code.toUpperCase(),
        imageHint: item.thumbnail ?? undefined,
      })),
      itemCount: (medusa.items ?? []).reduce((n, l) => n + l.quantity, 0),
      subtotal: medusa.subtotal ?? 0,
      shipping: medusa.shipping_total ?? 0,
      tax: medusa.tax_total ?? 0,
      total: medusa.total ?? 0,
      currency: medusa.currency_code.toUpperCase(),
    };
  }

  async findCartIdOrNull(ref: CartRef): Promise<string | null> {
    if (ref.kind === "guest") {
      return ref.token.startsWith("cart_") ? ref.token : null;
    }
    return null; // user carts are resolved by the session layer in Gate D
  }

  async getOrCreateCartId(ref: CartRef): Promise<string> {
    const existing = await this.findCartIdOrNull(ref);
    if (existing) {
      const cart = await this.fetchCart(existing);
      if (cart) return cart.id;
    }
    return this.createCart();
  }

  async createCart(): Promise<string> {
    const regionId = await this.ensureRegionId();
    const res = await this.client.post<{ cart: MedusaCart }>("/store/carts", {
      region_id: regionId,
    });
    return res.cart.id;
  }

  async getCart(ref: CartRef): Promise<CartDTO> {
    const cartId = await this.findCartIdOrNull(ref);
    if (!cartId) return EMPTY_CART;
    const cart = await this.fetchCart(cartId);
    if (!cart) return EMPTY_CART;
    return this.toDto(cart);
  }

  async buildCartDto(cartId: string | null): Promise<CartDTO> {
    if (!cartId) return EMPTY_CART;
    const cart = await this.fetchCart(cartId);
    if (!cart) return EMPTY_CART;
    return this.toDto(cart);
  }

  async addItem(
    ref: CartRef,
    productIdOrVariant: string,
    quantity: number,
    _via: "ui" | "agent" = "ui",
  ): Promise<CartDTO> {
    void _via;
    const qty = clampQuantity(quantity);
    const cartId = await this.getOrCreateCartId(ref);

    // Canonical entity resolution: accept product id/slug and resolve the
    // default variant from live Medusa state — never trust client hints.
    const variant = await this.resolveVariant(productIdOrVariant);
    if (!variant) {
      throw new CartError("invalid_product", "Unknown product.");
    }
    if (
      variant.manage_inventory !== false &&
      num(variant.inventory_quantity) <= 0
    ) {
      throw new CartError("out_of_stock", "That item is out of stock right now.");
    }

    try {
      const res = await this.client.post<{ cart: MedusaCart }>(
        `/store/carts/${cartId}/line-items`,
        { variant_id: variant.id, quantity: qty },
      );
      return this.toDto(res.cart);
    } catch (error) {
      throw new CartError(
        "invalid_product",
        error instanceof Error ? error.message : "Could not add to cart.",
      );
    }
  }

  async setItemQuantity(
    ref: CartRef,
    productIdOrVariant: string,
    quantity: number,
  ): Promise<CartDTO> {
    if (quantity === 0) return this.removeItem(ref, productIdOrVariant);
    const qty = clampQuantity(quantity);
    const cartId = await this.findCartIdOrNull(ref);
    if (!cartId) throw new CartError("cart_not_found", "No active cart.");

    const cart = await this.fetchCart(cartId);
    if (!cart) throw new CartError("cart_not_found", "No active cart.");
    const variant = await this.resolveVariant(productIdOrVariant);
    const line = (cart.items ?? []).find(
      (i) => i.variant_id === variant?.id || i.product_id === variant?.id?.replace(/^variant/, "prod"),
    ) ?? (variant ? (cart.items ?? []).find((i) => i.variant_id === variant.id) : undefined);
    if (!line) throw new CartError("invalid_product", "Item not present in cart.");

    const res = await this.client.post<{ cart: MedusaCart }>(
      `/store/carts/${cartId}/line-items/${line.id}`,
      { quantity: qty },
    );
    return this.toDto(res.cart);
  }

  async removeItem(ref: CartRef, productIdOrVariant: string): Promise<CartDTO> {
    const cartId = await this.findCartIdOrNull(ref);
    if (!cartId) return EMPTY_CART;
    const cart = await this.fetchCart(cartId);
    if (!cart) return EMPTY_CART;
    const variant = await this.resolveVariant(productIdOrVariant);
    const line = (cart.items ?? []).find((i) =>
      variant ? i.variant_id === variant.id : false,
    );
    if (!line) return this.toDto(cart);
    const res = await this.client.delete<{ parent?: MedusaCart }>(
      `/store/carts/${cartId}/line-items/${line.id}`,
    );
    if (res.parent) return this.toDto(res.parent);
    return this.getCart(ref);
  }

  async clearCart(ref: CartRef): Promise<void> {
    const cartId = await this.findCartIdOrNull(ref);
    if (!cartId) return;
    const cart = await this.fetchCart(cartId);
    for (const line of cart?.items ?? []) {
      await this.client.delete(`/store/carts/${cartId}/line-items/${line.id}`);
    }
  }

  /**
   * Guest→authenticated continuity: attach the customer's auth identity to
   * the current cart. Called by the auth cutover with a customer JWT.
   */
  async attachCustomer(cartId: string, customerToken: string): Promise<void> {
    await this.client.post(`/store/carts/${cartId}/customer`, undefined, {
      authorization: `Bearer ${customerToken}`,
    });
  }

  /**
   * Legacy-compatible merge entry point. In Medusa mode the guest token IS
   * the anonymous cart id; the cart survives sign-in and is attached to
   * the authenticated customer via attachCustomer during auth cutover.
   */
  async mergeGuestCart(guestToken: string, userId: string): Promise<CartDTO> {
    void userId;
    if (!guestToken.startsWith("cart_")) return EMPTY_CART;
    return this.getCart({ kind: "guest", token: guestToken });
  }

  /**
   * Resolve a product id / slug / variant id into the live default variant
   * with current price + inventory straight from Medusa.
   */
  private async resolveVariant(
    productIdOrSlugOrVariant: string,
  ): Promise<StoreProduct["variants"][number] | undefined> {
    const fields = [
      "id",
      "handle",
      "+variants.id",
      "+variants.sku",
      "+variants.manage_inventory",
      "+variants.inventory_quantity",
      "+variants.calculated_price.calculated_amount",
      "+variants.calculated_price.currency_code",
    ].join(",");
    const regionQuery = `&region_id=${encodeURIComponent(await this.ensureRegionId())}`;

    let product: StoreProduct | undefined;
    if (productIdOrSlugOrVariant.startsWith("prod_")) {
      try {
        product = (
          await this.client.get<{ product: StoreProduct }>(
            `/store/products/${productIdOrSlugOrVariant}?fields=${fields}${regionQuery}`,
          )
        ).product;
      } catch {
        product = undefined;
      }
    }
    if (!product) {
      const byHandle = await this.client
        .get<{ products: StoreProduct[] }>(
          `/store/products?handle=${encodeURIComponent(productIdOrSlugOrVariant)}&limit=1&fields=${fields}${regionQuery}`,
        )
        .catch(() => ({ products: [] as StoreProduct[] }));
      product = byHandle.products[0];
    }
    if (!product) {
      const byVariant = await this.client
        .get<{ products: StoreProduct[] }>(
          `/store/products?variants.id[]=${encodeURIComponent(productIdOrSlugOrVariant)}&limit=1&fields=${fields}${regionQuery}`,
        )
        .catch(() => ({ products: [] as StoreProduct[] }));
      product = byVariant.products[0];
    }
    return (
      product?.variants.find((variant) => variant.id === productIdOrSlugOrVariant) ??
      product?.variants[0]
    );
  }
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
