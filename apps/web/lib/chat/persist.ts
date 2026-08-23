import { and, asc, desc, eq } from "drizzle-orm";

import * as schema from "@/db/schema";
import type { Database } from "@/lib/db";
import { getDatabase } from "@/lib/db";

/**
 * Conversation persistence for signed-in users. Guests keep history in the
 * browser only.
 */

let dbPromise: Promise<Database> | null = null;

async function getDb(): Promise<Database | null> {
  const { databaseAvailable } = await import("@/lib/db");
  if (!(await databaseAvailable())) return null;
  if (!dbPromise) {
    dbPromise = getDatabase().then(({ db }) => db);
  }
  return dbPromise;
}

export interface PersistedOwner {
  userId: string;
}

export function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 57)}...` : clean || "New conversation";
}

export async function upsertConversation(params: {
  conversationId: string;
  userId: string;
  title?: string;
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .insert(schema.conversations)
    .values({
      id: params.conversationId,
      userId: params.userId,
      title: params.title ?? "New conversation",
    })
    .onConflictDoUpdate({
      target: schema.conversations.id,
      set: {
        updatedAt: new Date(),
        ...(params.title !== undefined && params.title !== "New conversation"
          ? { title: params.title }
          : {}),
      },
      where: eq(schema.conversations.userId, params.userId),
    })
    .returning({ id: schema.conversations.id });
  return rows.length > 0;
}

export async function appendMessage(params: {
  conversationId: string;
  userId: string;
  role: "user" | "assistant";
  parts: unknown[];
}): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    const ownedConversation = await db
      .select({ id: schema.conversations.id })
      .from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.id, params.conversationId),
          eq(schema.conversations.userId, params.userId),
        ),
      )
      .limit(1);
    if (!ownedConversation[0]) return false;

    await db.insert(schema.messages).values({
      conversationId: params.conversationId,
      role: params.role,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      parts: params.parts as any[],
    });
    await db
      .update(schema.conversations)
      .set({ updatedAt: new Date() })
      .where(
        and(
          eq(schema.conversations.id, params.conversationId),
          eq(schema.conversations.userId, params.userId),
        ),
      );
    return true;
  } catch (error) {
    console.error("[chat-persist] failed:", error);
    return false;
  }
}

export async function listConversations(userId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: schema.conversations.id,
      title: schema.conversations.title,
      updatedAt: schema.conversations.updatedAt,
    })
    .from(schema.conversations)
    .where(eq(schema.conversations.userId, userId))
    .orderBy(desc(schema.conversations.updatedAt))
    .limit(30);
}

export async function getConversationMessages(
  conversationId: string,
  userId: string,
): Promise<Array<{ id: string; role: string; parts: unknown[] }>> {
  const db = await getDb();
  if (!db) return [];
  const convo = await db
    .select({ id: schema.conversations.id })
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, conversationId),
        eq(schema.conversations.userId, userId),
      ),
    )
    .limit(1);
  if (!convo[0]) return [];
  const rows = await db
    .select()
    .from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId))
    .orderBy(asc(schema.messages.createdAt));
  void userId;
  return rows.map((row) => ({
    id: row.id,
    role: row.role,
    parts: row.parts ?? [],
  }));
}
