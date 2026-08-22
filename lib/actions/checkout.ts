"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth/server";
import { ensureCartRef, getCartProvider } from "@/lib/cart/session";
import { getCheckoutService } from "@/lib/checkout";

/**
 * Checkout entry point used by the storefront UI. The agent can only
 * *prepare* checkout; this is the explicit user-triggered path.
 */
export async function startCheckoutAction(): Promise<
  { ok: true; url: string } | { ok: false; error: string }
> {
  const checkout = await getCheckoutService();
  const provider = await getCartProvider();
  if (!checkout || !provider) {
    return { ok: false, error: "Checkout unavailable right now." };
  }
  const user = await getSessionUser();
  const ref = await ensureCartRef();
  const cart = await provider.getCart(ref);
  if (cart.lines.length === 0) {
    return { ok: false, error: "Your cart is empty." };
  }
  const origin =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    `http://localhost:${process.env.PORT ?? 3000}`;
  try {
    const prep = await checkout.prepareCheckout(user?.id ?? null, cart, origin);
    if (prep.mode === "stripe") {
      return { ok: true, url: prep.url };
    }
    // Demo mode: route to the clearly labeled simulated payment page.
    return { ok: true, url: prep.url };
  } catch (error) {
    console.error("[checkout] failed:", error);
    return { ok: false, error: "Could not start checkout. Try again." };
  }
}

/** Demo-mode payment confirmation — clearly labeled in the UI. */
export async function completeDemoOrderAction(formData: FormData): Promise<void> {
  const orderId = String(formData.get("orderId") ?? "");
  const checkout = await getCheckoutService();
  const valid = Boolean(orderId) && Boolean(checkout);
  if (!valid) redirect("/cart");
  const result = await checkout!.completeDemoOrder(orderId).catch(() => false);
  if (!result) redirect("/cart");

  // Payment confirmed by explicit user action → clear the cart server-side.
  const provider = await getCartProvider();
  const user = await getSessionUser();
  if (provider) {
    if (user) {
      await provider.clearCart({ kind: "user", userId: user.id });
    } else {
      const store = await cookies();
      const token = store.get("sp_guest")?.value;
      if (token) await provider.clearCart({ kind: "guest", token });
    }
  }
  redirect(`/checkout/success?order=${orderId}`);
}
