import { and, eq, inArray, sql } from "drizzle-orm";

import * as schema from "@/db/schema";
import type { Database } from "@/lib/db";
import { computeTotals } from "@shoppingpal/contracts";
import {
  CartError,
  clampQuantity,
  EMPTY_CART,
  mergedLineQuantities,
  MAX_QTY_PER_LINE,
  type CartDTO,
} from "@shoppingpal/contracts";

export type CartRef =
  | { kind: "user"; userId: string }
  | { kind: "guest"; token: string };

/**
 * Drizzle-backed cart store. Totals are always computed here, server-side,
 * from catalog prices. Browser-supplied prices are never trusted.
 */
export class DrizzleCartProvider {
  constructor(private readonly db: Database) {}

  private ownerWhere(ref: CartRef) {
    return ref.kind === "user"
      ? eq(schema.carts.userId, ref.userId)
      : eq(schema.carts.guestToken, ref.token);
  }

  async getOrCreateCartId(ref: CartRef): Promise<string> {
    const existing = await this.db
      .select({ id: schema.carts.id })
      .from(schema.carts)
      .where(this.ownerWhere(ref))
      .limit(1);
    if (existing[0]) return existing[0].id;
    const inserted = await this.db
      .insert(schema.carts)
      .values(
        ref.kind === "user"
          ? { userId: ref.userId }
          : { guestToken: ref.token },
      )
      .onConflictDoNothing()
      .returning({ id: schema.carts.id });
    if (inserted[0]) return inserted[0].id;
    const raced = await this.db
      .select({ id: schema.carts.id })
      .from(schema.carts)
      .where(this.ownerWhere(ref))
      .limit(1);
    if (!raced[0]) throw new Error("Failed to create cart");
    return raced[0].id;
  }

  async findCartIdOrNull(ref: CartRef): Promise<string | null> {
    const rows = await this.db
      .select({ id: schema.carts.id })
      .from(schema.carts)
      .where(this.ownerWhere(ref))
      .limit(1);
    return rows[0]?.id ?? null;
  }

  /** Build the cart DTO with server-computed totals. */
  async getCart(ref: CartRef): Promise<CartDTO> {
    const cartId = await this.findCartIdOrNull(ref);
    if (!cartId) return EMPTY_CART;
    return this.buildCartDto(cartId);
  }

  async buildCartDto(cartId: string | null): Promise<CartDTO> {
    if (!cartId) return EMPTY_CART;
    const rows = await this.db
      .select({
        productId: schema.products.id,
        slug: schema.products.slug,
        title: schema.products.title,
        brand: schema.products.brand,
        price: schema.products.price,
        currency: schema.products.currency,
        stock: schema.products.stock,
        quantity: schema.cartItems.quantity,
      })
      .from(schema.cartItems)
      .innerJoin(
        schema.products,
        eq(schema.cartItems.productId, schema.products.id),
      )
      .where(eq(schema.cartItems.cartId, cartId))
      .orderBy(schema.cartItems.createdAt);

    const lines = rows.map((row) => ({
      productId: row.productId,
      slug: row.slug,
      title: row.title,
      brand: row.brand,
      quantity: row.quantity,
      unitPrice: row.price,
      lineTotal: row.price * row.quantity,
      stock: row.stock,
      currency: row.currency,
    }));
    const totals = computeTotals(lines);
    return {
      id: cartId,
      lines,
      itemCount: lines.reduce((n, l) => n + l.quantity, 0),
      currency: lines[0]?.currency ?? "USD",
      ...totals,
    };
  }

  async addItem(
    ref: CartRef,
    productId: string,
    quantity: number,
    via: "ui" | "agent" = "ui",
  ): Promise<CartDTO> {
    const qty = clampQuantity(quantity);
    const product = await this.db
      .select({
        id: schema.products.id,
        stock: schema.products.stock,
        title: schema.products.title,
      })
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);
    const row = product[0];
    if (!row) {
      throw new CartError("invalid_product", `Unknown product ${productId}`);
    }
    if (row.stock <= 0) {
      throw new CartError(
        "out_of_stock",
        `${row.title} is out of stock right now.`,
      );
    }

    const cartId = await this.getOrCreateCartId(ref);
    const existing = await this.db
      .select({ quantity: schema.cartItems.quantity })
      .from(schema.cartItems)
      .where(
        and(
          eq(schema.cartItems.cartId, cartId),
          eq(schema.cartItems.productId, productId),
        ),
      )
      .limit(1);
    const currentQty = existing[0]?.quantity ?? 0;
    const nextQty = Math.min(currentQty + qty, Math.min(row.stock, MAX_QTY_PER_LINE));

    if (existing[0]) {
      await this.db
        .update(schema.cartItems)
        .set({ quantity: nextQty })
        .where(
          and(
            eq(schema.cartItems.cartId, cartId),
            eq(schema.cartItems.productId, productId),
          ),
        );
    } else {
      await this.db.insert(schema.cartItems).values({
        cartId,
        productId,
        quantity: nextQty,
        addedVia: via,
      });
    }
    await this.touchCart(cartId);
    return this.buildCartDto(cartId);
  }

  async setItemQuantity(
    ref: CartRef,
    productId: string,
    quantity: number,
  ): Promise<CartDTO> {
    const cartId = await this.findCartIdOrNull(ref);
    if (!cartId) throw new CartError("cart_not_found", "No active cart.");
    if (quantity === 0) return this.removeItem(ref, productId);
    const qty = clampQuantity(quantity);

    const stockRow = await this.db
      .select({ stock: schema.products.stock })
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);
    if (!stockRow[0]) {
      throw new CartError("invalid_product", `Unknown product ${productId}`);
    }
    if (qty > stockRow[0].stock) {
      throw new CartError(
        "out_of_stock",
        `Only ${stockRow[0].stock} left in stock.`,
      );
    }
    const updated = await this.db
      .update(schema.cartItems)
      .set({ quantity: qty })
      .where(
        and(
          eq(schema.cartItems.cartId, cartId),
          eq(schema.cartItems.productId, productId),
        ),
      )
      .returning({ id: schema.cartItems.id });
    if (updated.length === 0) {
      throw new CartError("invalid_product", "Item not present in cart.");
    }
    await this.touchCart(cartId);
    return this.buildCartDto(cartId);
  }

  async removeItem(ref: CartRef, productId: string): Promise<CartDTO> {
    const cartId = await this.findCartIdOrNull(ref);
    if (!cartId) return EMPTY_CART;
    await this.db
      .delete(schema.cartItems)
      .where(
        and(
          eq(schema.cartItems.cartId, cartId),
          eq(schema.cartItems.productId, productId),
        ),
      );
    await this.touchCart(cartId);
    return this.buildCartDto(cartId);
  }

  async clearCart(ref: CartRef): Promise<void> {
    const cartId = await this.findCartIdOrNull(ref);
    if (!cartId) return;
    await this.db.delete(schema.cartItems).where(eq(schema.cartItems.cartId, cartId));
    await this.touchCart(cartId);
  }

  /**
   * Merge a guest cart into the signed-in user's cart after authentication,
   * then delete the guest cart. Returns the user's merged cart DTO.
   */
  async mergeGuestCart(guestToken: string, userId: string): Promise<CartDTO> {
    const guestCartId = await this.findCartIdOrNull({ kind: "guest", token: guestToken });
    if (!guestCartId) {
      return this.getCart({ kind: "user", userId });
    }
    const userCartId = await this.getOrCreateCartId({ kind: "user", userId });

    const guestItems = await this.db
      .select({
        productId: schema.cartItems.productId,
        quantity: schema.cartItems.quantity,
      })
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartId, guestCartId));

    const userItems = await this.db
      .select({
        productId: schema.cartItems.productId,
        quantity: schema.cartItems.quantity,
      })
      .from(schema.cartItems)
      .where(eq(schema.cartItems.cartId, userCartId));

    const merged = mergedLineQuantities(
      new Map(userItems.map((i) => [i.productId, i.quantity])),
      guestItems.map((i) => ({ productId: i.productId, quantity: i.quantity })),
    );

    // Validate against stock before writing.
    const productIds = [...merged.keys()];
    const stockRows = productIds.length
      ? await this.db
          .select({ id: schema.products.id, stock: schema.products.stock })
          .from(schema.products)
          .where(inArray(schema.products.id, productIds))
      : [];
    const stockById = new Map(stockRows.map((r) => [r.id, r.stock]));

    for (const [productId, quantity] of merged) {
      const maxQty = Math.min(quantity, stockById.get(productId) ?? 0, MAX_QTY_PER_LINE);
      if (maxQty <= 0) continue;
      await this.db
        .insert(schema.cartItems)
        .values({ cartId: userCartId, productId, quantity: maxQty })
        .onConflictDoUpdate({
          target: [schema.cartItems.cartId, schema.cartItems.productId],
          set: { quantity: maxQty },
        });
    }

    await this.db.delete(schema.carts).where(eq(schema.carts.id, guestCartId));
    await this.touchCart(userCartId);
    return this.buildCartDto(userCartId);
  }

  private async touchCart(cartId: string): Promise<void> {
    await this.db
      .update(schema.carts)
      .set({ updatedAt: sql`now()` })
      .where(eq(schema.carts.id, cartId));
  }
}
