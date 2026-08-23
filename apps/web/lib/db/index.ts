import fs from "node:fs";
import path from "node:path";

import { sql } from "drizzle-orm";

import * as schema from "@/db/schema";

export type DatabaseProviderKind = "postgres" | "pglite";

export interface DatabaseHandle {
  db: Database;
  kind: DatabaseProviderKind;
}

/**
 * Single database type for the whole app. Runtime drivers:
 * - DATABASE_URL set  â†’ Postgres (works with Neon pooled URLs, Supabase, RDS…)
 * - DATABASE_URL empty → embedded PGlite persisted under .data/pg for
 *   non-commerce saved/chat state only
 */
type Executor = import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema>;

export type Database = Executor;

/**
 * Production Next.js bundles lib/db separately per route/runtime entrypoint,
 * so a module-level promise alone lets several PGlite instances race against
 * the same data directory (WASM aborts mid-DDL). Stashing the in-flight
 * handle on globalThis makes initialization process-wide idempotent.
 */
const globalForDb = globalThis as unknown as {
  __shoppingPalDbHandle?: Promise<DatabaseHandle>;
  __shoppingPalDbSchemaReady?: boolean;
};

/** Resolve which database backend the app should use. */
export function databaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Whether a usable database exists at all. With no DATABASE_URL the app
 * transparently uses embedded PGlite, so this is almost always true —
 * both backends hold saved items and conversation persistence only.
 */
export async function databaseAvailable(): Promise<boolean> {
  try {
    await getDatabase();
    return true;
  } catch (error) {
    console.error("[db] unavailable:", error);
    return false;
  }
}

async function createHandle(): Promise<DatabaseHandle> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const postgresModule = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = postgresModule.default(url, {
      prepare: false,
      max: 10,
      // Neon and other serverless platforms need TLS.
      ssl: url.includes("localhost") || url.includes("127.0.0.1") ? undefined : "require",
    });
    return { db: drizzle(client, { schema }), kind: "postgres" };
  }

  // Zero-config non-commerce state store: embedded Postgres (WASM).
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = path.join(process.cwd(), ".data", "pg");
  fs.mkdirSync(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  const { drizzle } = await import("drizzle-orm/pglite");
  return {
    db: drizzle(client, { schema }) as unknown as Database,
    kind: "pglite",
  };
}

/**
 * Returns the shared database handle. Creates and migrates the underlying
 * database lazily on first access, so `pnpm dev` works with zero setup.
 */
export function getDatabase(): Promise<DatabaseHandle> {
  if (!globalForDb.__shoppingPalDbHandle) {
    globalForDb.__shoppingPalDbHandle = (async () => {
      const handle = await createHandle();
      await ensureSchema(handle);
      return handle;
    })().catch((error) => {
      globalForDb.__shoppingPalDbHandle = undefined;
      throw error;
    });
  }
  return globalForDb.__shoppingPalDbHandle;
}

/**
 * Warm the database once at server boot (called from instrumentation.ts)
 * so schema creation completes before any request can race it.
 */
export async function warmDatabase(): Promise<boolean> {
  try {
    await getDatabase();
    return true;
  } catch (error) {
    console.error("[db] warmup failed:", error);
    return false;
  }
}

/** Create non-commerce state tables when missing. */
export async function ensureSchema(handle: DatabaseHandle): Promise<void> {
  if (globalForDb.__shoppingPalDbSchemaReady) return;
  await runMigrations(handle.db);
  globalForDb.__shoppingPalDbSchemaReady = true;
}

/** Apply the small non-commerce schema without a legacy migration directory. */
export async function runMigrations(db: Database): Promise<void> {
  const statements = [
    `ALTER TABLE IF EXISTS "saved_products" DROP CONSTRAINT IF EXISTS "saved_products_user_id_user_id_fk"`,
    `ALTER TABLE IF EXISTS "saved_products" DROP CONSTRAINT IF EXISTS "saved_products_product_id_products_id_fk"`,
    `ALTER TABLE IF EXISTS "conversations" DROP CONSTRAINT IF EXISTS "conversations_user_id_user_id_fk"`,
    `ALTER TABLE IF EXISTS "saved_products" ALTER COLUMN "product_id" TYPE text USING "product_id"::text`,
    `DROP TABLE IF EXISTS "cart_items", "carts", "order_items", "orders", "products" CASCADE`,
    `DROP TABLE IF EXISTS "account", "session", "verification", "user" CASCADE`,
    `CREATE TABLE IF NOT EXISTS "saved_products" ("id" uuid PRIMARY KEY NOT NULL, "user_id" text, "guest_token" text, "product_id" text NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS "conversations" ("id" uuid PRIMARY KEY NOT NULL, "user_id" text, "guest_token" text, "title" text DEFAULT 'New conversation' NOT NULL, "context" jsonb DEFAULT '{}'::jsonb NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL, "updated_at" timestamp with time zone DEFAULT now() NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS "messages" ("id" uuid PRIMARY KEY NOT NULL, "conversation_id" uuid NOT NULL REFERENCES "conversations"("id") ON DELETE cascade, "role" text NOT NULL, "parts" jsonb DEFAULT '[]'::jsonb NOT NULL, "created_at" timestamp with time zone DEFAULT now() NOT NULL)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "saved_products_user_unique" ON "saved_products" ("user_id", "product_id")`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "saved_products_guest_unique" ON "saved_products" ("guest_token", "product_id")`,
    `CREATE INDEX IF NOT EXISTS "conversations_user_idx" ON "conversations" ("user_id")`,
    `CREATE INDEX IF NOT EXISTS "messages_conversation_idx" ON "messages" ("conversation_id")`,
  ];
  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function extractRows<T>(result: any): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && Array.isArray(result.rows)) return result.rows as T[];
  return [];
}
