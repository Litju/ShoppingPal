"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { getCartProvider, resolveCartRef } from "@/lib/cart/session";
import { MedusaCartProvider } from "@/lib/cart/medusa-cart-provider";
import { medusaEnabled } from "@/lib/commerce/config";
import { sealCheckoutOrder } from "@/lib/checkout/receipt";

const checkoutInputSchema = z.object({
  email: z.string().email().max(200),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  address1: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  postalCode: z.string().trim().min(2).max(20),
  countryCode: z.string().trim().regex(/^[a-z]{2}$/i),
  province: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(40).optional(),
});

export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export async function startCheckoutAction(input: CheckoutInput): Promise<
  | { ok: true; clientSecret: string }
  | { ok: false; error: string }
> {
  const parsed = checkoutInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid shipping address and email." };
  if (!medusaEnabled()) return { ok: false, error: "Checkout is unavailable until commerce is configured." };

  try {
    const provider = await getCartProvider();
    const ref = await resolveCartRef();
    if (!(provider instanceof MedusaCartProvider) || !ref) {
      return { ok: false, error: "Checkout is unavailable until Medusa is configured." };
    }
    const session = await provider.initializeStripeCheckout(ref, parsed.data);
    return { ok: true, clientSecret: session.clientSecret };
  } catch (error) {
    console.error("[checkout] initialization failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not initialize checkout.",
    };
  }
}

export async function completeCheckoutAction(): Promise<
  | { ok: true; orderId: string }
  | { ok: false; error: string }
> {
  if (!medusaEnabled()) return { ok: false, error: "Checkout is unavailable until commerce is configured." };

  try {
    const provider = await getCartProvider();
    const ref = await resolveCartRef();
    if (!(provider instanceof MedusaCartProvider) || !ref) {
      return { ok: false, error: "Checkout is unavailable until Medusa is configured." };
    }
    const result = await provider.completeCheckout(ref);
    if (result.type === "cart") {
      const error = typeof result.error === "string" ? result.error : result.error?.message;
      return { ok: false, error: error ?? "Medusa did not authorize the order." };
    }
    if (!result.order?.id) return { ok: false, error: "Medusa did not return an order reference." };
    const receipt = sealCheckoutOrder(result.order.id);
    if (!receipt) return { ok: false, error: "Checkout receipt signing is not configured." };
    (await cookies()).set("sp_checkout_order", receipt, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/checkout/success",
      maxAge: 60 * 10,
    });
    return { ok: true, orderId: result.order.id };
  } catch (error) {
    console.error("[checkout] completion failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Could not complete the order.",
    };
  }
}
