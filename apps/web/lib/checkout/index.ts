import Stripe from "stripe";

import { and, desc, eq } from "drizzle-orm";
import * as schema from "@/db/schema";
import type { Database } from "@/lib/db";
import type { CartDTO } from "@shoppingpal/contracts";

/**
 * Checkout boundary. Shopping Pal may PREPARE a checkout (order snapshot +
 * payment session) but can never complete a purchase on its own — payment is
 * always confirmed by an explicit user action on a hosted/demo page.
 */

let stripePromise: Promise<Stripe | null> | null = null;

export async function getStripe(): Promise<Stripe | null> {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (!stripePromise) {
    stripePromise = Promise.resolve(new Stripe(key)).catch(() => {
      stripePromise = null;
      return null;
    }) as unknown as Promise<Stripe | null>;
  }
  return stripePromise;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export interface CheckoutPreparation {
  orderId: string;
  url: string;
  mode: "stripe" | "demo";
}

export class CheckoutService {
  constructor(private readonly db: Database) {}

  /** Snapshot the cart into an order using server-computed totals. */
  async createPendingOrder(
    userId: string | null,
    cart: CartDTO,
  ): Promise<string> {
    if (cart.lines.length === 0) throw new Error("Cart is empty.");
    const [order] = await this.db
      .insert(schema.orders)
      .values({
        userId,
        status: "pending",
        mode: stripeConfigured() ? "stripe" : "demo",
        subtotal: cart.subtotal,
        shipping: cart.shipping,
        tax: cart.tax,
        total: cart.total,
        currency: cart.currency,
      })
      .returning({ id: schema.orders.id });
    if (!order) throw new Error("Could not create order.");

    await this.db.insert(schema.orderItems).values(
      cart.lines.map((line) => ({
        orderId: order.id,
        productId: line.productId,
        titleSnapshot: line.title,
        brandSnapshot: line.brand,
        slugSnapshot: line.slug,
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineTotal: line.lineTotal,
      })),
    );
    return order.id;
  }

  async prepareCheckout(
    userId: string | null,
    cart: CartDTO,
    origin: string,
  ): Promise<CheckoutPreparation> {
    const orderId = await this.createPendingOrder(userId, cart);

    const stripe = await getStripe();
    if (!stripe) {
      return {
        orderId,
        mode: "demo",
        url: `/checkout/demo/${orderId}`,
      };
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: cart.lines.map((line) => ({
        quantity: line.quantity,
        price_data: {
          currency: line.currency.toLowerCase(),
          unit_amount: line.unitPrice,
          product_data: {
            name: `${line.brand} ${line.title}`,
          },
        },
      })),
      shipping_options:
        cart.shipping > 0
          ? [
              {
                shipping_rate_data: {
                  type: "fixed_amount" as const,
                  display_name: "Standard shipping",
                  fixed_amount: {
                    amount: cart.shipping,
                    currency: cart.currency.toLowerCase(),
                  },
                },
              },
            ]
          : undefined,
      // Tax is already inside our computed totals; charge it as part of items.
      success_url: `${origin}/checkout/success?order=${orderId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cart?canceled=1`,
      metadata: { orderId },
    });

    if (!session.url) throw new Error("Stripe returned no checkout URL.");

    await this.db
      .update(schema.orders)
      .set({
        stripeSessionId: session.id,
        updatedAt: new Date(),
      })
      .where(eq(schema.orders.id, orderId));

    return { orderId, mode: "stripe", url: session.url };
  }

  /** Called by the demo checkout page when the user explicitly confirms. */
  async completeDemoOrder(orderId: string): Promise<boolean> {
    const rows = await this.db
      .update(schema.orders)
      .set({ status: "paid", updatedAt: new Date() })
      .where(and(eq(schema.orders.id, orderId), eq(schema.orders.mode, "demo")))
      .returning({ id: schema.orders.id });
    return rows.length > 0;
  }

  /** Verify a Stripe session after redirect back from hosted checkout. */
  async verifyStripeReturn(
    orderId: string,
    sessionId: string,
  ): Promise<"paid" | "pending"> {
    const orderRows = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1);
    const order = orderRows[0];
    if (!order || order.stripeSessionId !== sessionId) return "pending";
    if (order.status === "paid") return "paid";

    const stripe = await getStripe();
    if (!stripe) return "pending";
    const session =
      await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== "paid") return "pending";

    await this.db
      .update(schema.orders)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(schema.orders.id, orderId));
    return "paid";
  }

  async getOrder(
    orderId: string,
  ): Promise<{ order: typeof schema.orders.$inferSelect; items: Array<typeof schema.orderItems.$inferSelect> } | null> {
    const rows = await this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.id, orderId))
      .limit(1);
    const order = rows[0];
    if (!order) return null;
    const items = await this.db
      .select()
      .from(schema.orderItems)
      .where(eq(schema.orderItems.orderId, orderId));
    return { order, items };
  }

  async listOrdersForUser(
    userId: string,
  ): Promise<Array<typeof schema.orders.$inferSelect>> {
    return this.db
      .select()
      .from(schema.orders)
      .where(eq(schema.orders.userId, userId))
      .orderBy(desc(schema.orders.createdAt))
      .limit(50);
  }
}

let checkoutServicePromise: Promise<CheckoutService | null> | null = null;

export async function getCheckoutService(): Promise<CheckoutService | null> {
  if (!checkoutServicePromise) {
    checkoutServicePromise = (async () => {
      const { getDatabase } = await import("@/lib/db");
      const { db } = await getDatabase();
      return new CheckoutService(db);
    })();
  }
  try {
    return await checkoutServicePromise;
  } catch {
    return null;
  }
}
