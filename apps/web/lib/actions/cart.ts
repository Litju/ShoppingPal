"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { getSessionUser } from "@/lib/auth/server";
import {
  ensureCartRef,
  getCartProvider,
  resolveCartRef,
} from "@/lib/cart/session";
import { EMPTY_CART, type CartDTO } from "@shoppingpal/contracts";

export interface ActionResult<T = undefined> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function currentCart(): Promise<CartDTO> {
  const provider = await getCartProvider();
  const ref = await resolveCartRef();
  if (!provider || !ref) return EMPTY_CART;
  return provider.getCart(ref);
}

export async function getCartAction(): Promise<CartDTO> {
  try {
    return await currentCart();
  } catch (error) {
    console.error("[cart] get failed:", error);
    return EMPTY_CART;
  }
}

export async function addToCartAction(
  productId: string,
  quantity = 1,
): Promise<ActionResult<CartDTO>> {
  try {
    const provider = await getCartProvider();
    if (!provider) return { ok: false, error: "Cart unavailable in demo mode." };
    const ref = await ensureCartRef();
    const cart = await provider.addItem(ref, productId, quantity, "ui");
    revalidatePath("/", "layout");
    return { ok: true, data: cart };
  } catch (error) {
    if (error instanceof Error && error.name === "CartError") {
      return { ok: false, error: error.message };
    }
    console.error("[cart] add failed:", error);
    return { ok: false, error: "Could not add to cart." };
  }
}

export async function setQuantityAction(
  productId: string,
  quantity: number,
): Promise<ActionResult<CartDTO>> {
  try {
    const provider = await getCartProvider();
    if (!provider) return { ok: false, error: "Cart unavailable in demo mode." };
    const ref = await ensureCartRef();
    const cart =
      quantity === 0
        ? await provider.removeItem(ref, productId)
        : await provider.setItemQuantity(ref, productId, quantity);
    revalidatePath("/cart");
    return { ok: true, data: cart };
  } catch (error) {
    if (error instanceof Error && error.name === "CartError") {
      return { ok: false, error: error.message };
    }
    console.error("[cart] update failed:", error);
    return { ok: false, error: "Could not update cart." };
  }
}

export async function removeFromCartAction(
  productId: string,
): Promise<ActionResult<CartDTO>> {
  try {
    const provider = await getCartProvider();
    if (!provider) return { ok: false, error: "Cart unavailable in demo mode." };
    const ref = await ensureCartRef();
    const cart = await provider.removeItem(ref, productId);
    revalidatePath("/cart");
    return { ok: true, data: cart };
  } catch (error) {
    console.error("[cart] remove failed:", error);
    return { ok: false, error: "Could not remove item." };
  }
}

/** Merge the guest cart into the user's cart right after sign-in/sign-up. */
export async function mergeGuestCartAction(): Promise<ActionResult<CartDTO>> {
  try {
    const provider = await getCartProvider();
    const user = await getSessionUser();
    if (!provider || !user) return { ok: true };
    const store = await cookies();
    const guestToken = store.get("sp_guest")?.value;
    let merged;
    if (guestToken) {
      merged = await provider.mergeGuestCart(guestToken, user.id);
      store.delete("sp_guest");
    } else {
      merged = await provider.getCart({ kind: "user", userId: user.id });
    }
    revalidatePath("/", "layout");
    return { ok: true, data: merged };
  } catch (error) {
    console.error("[cart] merge failed:", error);
    return { ok: false, error: "Could not merge your previous cart." };
  }
}
