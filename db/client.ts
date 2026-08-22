/**
 * Convenience re-export: the database handle lives in lib/db so both app code
 * and CLI scripts can share one lazy, provider-resolving client.
 */
export {
  getDatabase,
  databaseConfigured,
  ensureSchema,
  runMigrations,
  extractRows,
} from "@/lib/db";
export type { Database, DatabaseHandle, DatabaseProviderKind } from "@/lib/db";
