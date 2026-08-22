import { cookies } from "next/headers";

import { getSessionUser } from "@/lib/auth/server";
import { DrizzleCartProvider, type CartRef } from "@/lib/cart/drizzle-cart-provider";
import { databaseAvailable, getDatabase } from "@/lib/db";

export const GUEST_COOKIE = "sp_guest";
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

let providerPromise: Promise<DrizzleCartProvider> | null = null;

/**
 * Cart mutations run through one server-side provider regardless of whether
 * the mutation originates from storefront UI or from Shopping Pal tools.
 */
export async function getCartProvider(): Promise<DrizzleCartProvider | null> {
  if (!(await databaseAvailable())) return null;
  if (!providerPromise) {
    providerPromise = getDatabase().then(({ db }) => new DrizzleCartProvider(db));
  }
  try {
    return await providerPromise;
  } catch (error) {
    console.error("[cart] provider unavailable:", error);
    providerPromise = null;
    return null;
  }
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
  if (user) return { kind: "user", userId: user.id };
  const store = await cookies();
  const token = store.get(GUEST_COOKIE)?.value;
  if (token) return { kind: "guest", token };
  return null;
}

/** Like resolveCartRef but creates a guest token when none exists.
 * Only callable in Server Actions / Route Handlers. */
export async function ensureCartRef(): Promise<CartRef> {
  const user = await getSessionUser();
  if (user) return { kind: "user", userId: user.id };
  const store = await cookies();
  let token = store.get(GUEST_COOKIE)?.value;
  if (!token) {
    token = newGuestToken();
    store.set(GUEST_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: CART_COOKIE_MAX_AGE,
    });
  }
  return { kind: "guest", token };
}
