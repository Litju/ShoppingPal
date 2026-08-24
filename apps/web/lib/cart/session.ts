import { cookies } from "next/headers";

import { getSessionUser, MEDUSA_CUSTOMER_COOKIE } from "@/lib/auth/server";
import type { CartRef } from "@/lib/cart/types";
import { MedusaCartProvider } from "@/lib/cart/medusa-cart-provider";
import { medusaEnabled } from "@/lib/commerce/config";

export const GUEST_COOKIE = "sp_guest";
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/**
 * Cart mutations run through one server-side provider regardless of whether
 * the mutation originates from storefront UI or from Shopping Pal tools.
 * Medusa is the only commerce authority. Without its configuration, catalog
 * browsing remains available but cart mutations fail explicitly.
 */

let medusaProviderPromise: Promise<MedusaCartProvider> | null = null;

export type ActiveCartProvider = MedusaCartProvider;

async function getMedusaCartProvider(): Promise<MedusaCartProvider | null> {
  if (!medusaEnabled()) return null;
  if (!medusaProviderPromise) {
    medusaProviderPromise = Promise.resolve(new MedusaCartProvider());
  }
  try {
    return await medusaProviderPromise;
  } catch (error) {
    console.error("[cart] medusa provider unavailable:", error);
    return null;
  }
}

export async function getCartProvider(): Promise<ActiveCartProvider | null> {
  return getMedusaCartProvider();
}

export function newGuestToken(): string {
  return `g_${crypto.randomUUID().replace(/-/g, "")}`;
}

/**
 * Resolve the cart owner for the current request context.
 * Reads (never writes) cookies — safe inside RSC.
 */
export async function resolveCartRef(): Promise<CartRef | null> {
  const user = await getSessionUser();
  const store = await cookies();
  const token = store.get(GUEST_COOKIE)?.value;
  if (user) {
    // Medusa keeps the attached cart addressable by its cart id. Retain that
    // id in the httpOnly cookie so authenticated requests use the same cart.
    if (medusaEnabled() && token?.startsWith("cart_")) {
      return { kind: "guest", token };
    }
    return { kind: "user", userId: user.id };
  }
  if (token) return { kind: "guest", token };
  return null;
}

/** Like resolveCartRef but creates a guest token when none exists.
 * Only callable in Server Actions / Route Handlers. */
export async function ensureCartRef(): Promise<CartRef> {
  const user = await getSessionUser();
  const store = await cookies();
  let token = store.get(GUEST_COOKIE)?.value;

  if (user && !medusaEnabled()) return { kind: "user", userId: user.id };

  if (user && medusaEnabled() && token?.startsWith("cart_")) {
    return { kind: "guest", token };
  }

  // In Medusa mode the guest cookie carries the anonymous cart id. When
  // commerce is unavailable, an opaque token may still scope saved state, but
  // no cart provider is created.
  if (!token || (medusaEnabled() && !token.startsWith("cart_"))) {
    if (medusaEnabled()) {
      const medusa = await getMedusaCartProvider();
      if (!medusa) throw new Error("Medusa cart provider unavailable");
      token = await medusa.createCart();
      const customerToken = store.get(MEDUSA_CUSTOMER_COOKIE)?.value;
      if (user && customerToken) {
        await medusa.attachCustomer(token, customerToken);
      }
    } else {
      token = newGuestToken();
    }
    store.set(GUEST_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: CART_COOKIE_MAX_AGE,
    });
  }
  return { kind: "guest", token };
}
