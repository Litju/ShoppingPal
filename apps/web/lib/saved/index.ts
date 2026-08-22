import { and, desc, eq } from "drizzle-orm";

import * as schema from "@/db/schema";
import type { Database } from "@/lib/db";
import { getDatabase } from "@/lib/db";

export interface SavedRef {
  kind: "user";
  userId: string;
}
export interface SavedRefGuest {
  kind: "guest";
  token: string;
}

export type SavedOwner = SavedRef | SavedRefGuest;

/** Saved products ("wishlist") for signed-in users and guest tokens. */
export class DrizzleSavedProvider {
  constructor(private readonly db: Database) {}

  private ownerWhere(owner: SavedOwner) {
    return owner.kind === "user"
      ? eq(schema.savedProducts.userId, owner.userId)
      : eq(schema.savedProducts.guestToken, owner.token);
  }

  async listIds(owner: SavedOwner): Promise<string[]> {
    const rows = await this.db
      .select({ productId: schema.savedProducts.productId })
      .from(schema.savedProducts)
      .where(this.ownerWhere(owner))
      .orderBy(desc(schema.savedProducts.createdAt))
      .limit(200);
    return rows.map((r) => r.productId);
  }

  async save(
    owner: SavedOwner,
    productId: string,
  ): Promise<{ saved: boolean }> {
    const inserted = await this.db
      .insert(schema.savedProducts)
      .values(
        owner.kind === "user"
          ? { userId: owner.userId, productId }
          : { guestToken: owner.token, productId },
      )
      .onConflictDoNothing()
      .returning({ id: schema.savedProducts.id });
    return { saved: inserted.length > 0 };
  }

  async unsave(owner: SavedOwner, productId: string): Promise<void> {
    await this.db
      .delete(schema.savedProducts)
      .where(and(this.ownerWhere(owner), eq(schema.savedProducts.productId, productId)));
  }
}

let savedPromise: Promise<DrizzleSavedProvider | null> | null = null;

export async function getSavedService(): Promise<DrizzleSavedProvider | null> {
  const { databaseAvailable } = await import("@/lib/db");
  if (!(await databaseAvailable())) return null;
  if (!savedPromise) {
    savedPromise = getDatabase().then(({ db }) => new DrizzleSavedProvider(db));
  }
  return savedPromise;
}
