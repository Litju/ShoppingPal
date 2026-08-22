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
 * - DATABASE_URL emptyâ†’ embedded PGlite persisted under .data/pg (demo mode)
 */
type Executor = import("drizzle-orm/postgres-js").PostgresJsDatabase<typeof schema>;

export type Database = Executor;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

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
 * demo mode has full cart/order/auth functionality.
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

  // Zero-config demo database: embedded Postgres (WASM) persisted under .data/pg
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
      // Seed-on-boot keeps every backend consumer (cart, auth, checkout,
      // saved) consistent with the catalog's deterministic product ids.
      // Idempotent: no-op whenever the products table already has rows.
      const { ensureSeeded } = await import("@/lib/db/seed");
      await ensureSeeded(handle.db);
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
 * so schema creation and seeding complete before any request can race it.
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

/** Create tables when missing so fresh environments are usable immediately. */
export async function ensureSchema(handle: DatabaseHandle): Promise<void> {
  if (globalForDb.__shoppingPalDbSchemaReady) return;
  try {
    const result = await handle.db.execute<{ regclass: string | null }>(
      sql`select to_regclass('public.products') as regclass`,
    );
    const rows = extractRows<{ regclass: string | null }>(result);
    if (rows[0]?.regclass != null) {
      globalForDb.__shoppingPalDbSchemaReady = true;
      return;
    }
  } catch {
    // fall through to migration
  }
  await runMigrations(handle.db);
  globalForDb.__shoppingPalDbSchemaReady = true;
}

/** Apply generated drizzle migrations from ./drizzle */
export async function runMigrations(db: Database): Promise<void> {
  const journalPath = path.join(MIGRATIONS_FOLDER, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    throw new Error(
      "No migrations found. Run `pnpm db:generate` to create them from db/schema.ts.",
    );
  }
  interface JournalEntry {
    tag: string;
  }
  const journal = JSON.parse(
    fs.readFileSync(journalPath, "utf8"),
  ) as { entries: JournalEntry[] };
  for (const entry of journal.entries) {
    const file = path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`);
    const contents = fs.readFileSync(file, "utf8");
    for (const statement of splitStatements(contents)) {
      await db.execute(sql.raw(statement));
    }
  }
}

function splitStatements(sqlText: string): string[] {
  const byMarker = sqlText.split(/--> statement-breakpoint;?\s*\n?/g);
  const chunks = byMarker.length > 1 ? byMarker : sqlText.split(/;\s*\n/g);
  return chunks
    .flatMap((chunk) => chunk.split(/;\s*(?:\n|$)/))
    .map((s) => s.replace(/^\s*;+/, "").trim())
    .filter((s) => s.length > 0 && !/^--/.test(s));
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function extractRows<T>(result: any): T[] {
  if (Array.isArray(result)) return result as T[];
  if (result && Array.isArray(result.rows)) return result.rows as T[];
  return [];
}
