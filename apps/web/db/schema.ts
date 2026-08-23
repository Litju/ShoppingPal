import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Non-commerce application state only. Medusa owns catalog, cart, checkout,
 * payment, inventory, and order state; these tables hold saved items and chat
 * persistence for the web shell.
 */

export const savedProducts = pgTable(
  "saved_products",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id"),
    guestToken: text("guest_token"),
    productId: text("product_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("saved_products_user_unique").on(t.userId, t.productId),
    uniqueIndex("saved_products_guest_unique").on(t.guestToken, t.productId),
  ],
);

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id"),
    guestToken: text("guest_token"),
    title: text("title").notNull().default("New conversation"),
    context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("conversations_user_idx").on(t.userId)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    parts: jsonb("parts").$type<unknown[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId)],
);
