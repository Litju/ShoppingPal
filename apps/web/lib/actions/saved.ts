"use server";

import { getSessionUser } from "@/lib/auth/server";
import { getSavedService } from "@/lib/saved";
import { getCatalogProvider } from "@/lib/catalog";
import type { Product } from "@shoppingpal/contracts";

export interface SavedState {
  productIds: string[];
}

export async function getSavedIdsAction(): Promise<string[]> {
  try {
    const saved = await getSavedService();
    if (!saved) return [];
    const user = await getSessionUser();
    if (user) return saved.listIds({ kind: "user", userId: user.id });
    return [];
  } catch (error) {
    console.error("[saved] list ids failed:", error);
    return [];
  }
}

/** Guest saved items live in localStorage on the client; this endpoint
 * serves signed-in users and returns full products. */
export async function getSavedProductsAction(
  guestIds: string[] = [],
): Promise<Product[]> {
  try {
    const catalog = await getCatalogProvider();
    const user = await getSessionUser();
    if (user) {
      const saved = await getSavedService();
      const ids = saved ? await saved.listIds({ kind: "user", userId: user.id }) : [];
      return catalog.getByIds(ids);
    }
    return catalog.getByIds(guestIds);
  } catch (error) {
    console.error("[saved] load failed:", error);
    return [];
  }
}

export async function saveProductAction(
  productId: string,
): Promise<{ ok: boolean; saved: boolean; error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) {
      // Guests save locally in the browser; nothing server-side to do.
      return { ok: true, saved: true };
    }
    const savedService = await getSavedService();
    if (!savedService) return { ok: false, saved: false, error: "Saving unavailable." };
    const result = await savedService.save({ kind: "user", userId: user.id }, productId);
    return { ok: true, saved: result.saved };
  } catch (error) {
    console.error("[saved] save failed:", error);
    return { ok: false, saved: false, error: "Could not save product." };
  }
}

export async function unsaveProductAction(
  productId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const user = await getSessionUser();
    if (!user) return { ok: true };
    const savedService = await getSavedService();
    if (!savedService) return { ok: false, error: "Saving unavailable." };
    await savedService.unsave({ kind: "user", userId: user.id }, productId);
    return { ok: true };
  } catch (error) {
    console.error("[saved] unsave failed:", error);
    return { ok: false, error: "Could not update saved list." };
  }
}
