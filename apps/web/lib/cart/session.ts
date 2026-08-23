import { cookies } from "next/headers";

import { getSessionUser } from "@/lib/auth/server";
import {
  DrizzleCartProvider,
  type CartRef,
} from "@/lib/cart/drizzle-cart-provider";
import { MedusaCartProvider } from "@/lib/cart/medusa-cart-provider";
import { medusaEnabled } from "@/lib/commerce/config";
import { databaseAvailable, getDatabase } from "@/lib/db";

export const GUEST_COOKIE = "sp_guest";
export const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

/**
 * Cart mutations run through one server-side provider regardless of whether
 * the mutation originates from storefront UI or from Shopping Pal tools.
 * Runtime selection follows the commerce authority (design doc §4):
 * Medusa when configured, embedded legacy stack otherwise.
 */

let drizzleProviderPromise: Promise<DrizzleCartProvider> | null = null;
let medusaProviderPromise: Promise<MedusaCartProvider> | null = null;

export type ActiveCartProvider = DrizzleCartProvider | MedusaCartProvider;

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

async function getDrizzleCartProvider(): Promise<DrizzleCartProvider | null> {
  if (!(await databaseAvailable())) return null;
  if (!drizzleProviderPromise) {
    drizzleProviderPromise = getDatabase().then(
      ({ db }) => new DrizzleCartProvider(db),
    );
  }
  try {
    return await drizzleProviderPromise;
  } catch (error) {
    console.error("[cart] provider unavailable:", error);
    drizzleProviderPromise = null;
    return null;
  }
}

export async function getCartProvider(): Promise<ActiveCartProvider | null> {
  const medusa = await getMedusaCartProvider();
  if (medusa) return medusa;
  return getDrizzleCartProvider();
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

  // In Medusa mode the guest cookie carries the anonymous cart id; legacy
  // mode keeps opaque guest tokens mapped to a local carts row.
  if (!token || (medusaEnabled() && !token.startsWith("cart_"))) {
    if (medusaEnabled()) {
      const medusa = await getMedusaCartProvider();
      if (!medusa) throw new Error("Medusa cart provider unavailable");
      token = await medusa.createCart();
    } else {
      token = newGuestToken();
    }
    store.set(GUEST_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: CART_COOKIE_MAX_AGE,
    });
  }
  return { kind: "guest", token };
}
