"use server";

import { getSessionUser } from "@/lib/auth/server";
import {
  getConversationMessages,
  listConversations,
} from "@/lib/chat/persist";

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export async function listConversationsAction(): Promise<ConversationSummary[]> {
  const user = await getSessionUser();
  if (!user) return [];
  const rows = await listConversations(user.id);
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export interface PersistedChatMessage {
  id: string;
  role: string;
  parts: unknown[];
}

export async function loadConversationAction(
  conversationId: string,
): Promise<PersistedChatMessage[]> {
  const user = await getSessionUser();
  if (!user) return [];
  return getConversationMessages(conversationId, user.id) as Promise<
    PersistedChatMessage[]
  >;
}
