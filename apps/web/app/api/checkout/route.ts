import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth/server";
import { getCartProvider, resolveCartRef } from "@/lib/cart/session";
import { getCheckoutService } from "@/lib/checkout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** User-triggered checkout: creates the order snapshot + payment session. */
export async function POST(request: Request) {
  try {
    const checkout = await getCheckoutService();
    const provider = await getCartProvider();
    if (!checkout || !provider) {
      return NextResponse.json({ error: "Checkout unavailable." }, { status: 503 });
    }
    const user = await getSessionUser();
    const ref = await resolveCartRef();
    if (!ref) {
      // No cart yet — nothing to check out.
      return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    }
    const cart = await provider.getCart(ref);
    if (cart.lines.length === 0) {
      return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
    }
    const origin = new URL(request.url).origin;
    const prep = await checkout.prepareCheckout(user?.id ?? null, cart, origin);
    return NextResponse.json({
      url: prep.url,
      mode: prep.mode,
      orderId: prep.orderId,
    });
  } catch (error) {
    console.error("[api/checkout]", error);
    return NextResponse.json({ error: "Checkout failed." }, { status: 500 });
  }
}
