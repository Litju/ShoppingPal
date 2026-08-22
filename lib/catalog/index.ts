import type { CatalogProvider } from "@/lib/catalog/types";
import { StaticCatalogProvider } from "@/lib/catalog/static-provider";
import { PostgresCatalogProvider } from "@/lib/catalog/postgres-provider";
import { databaseConfigured, getDatabase } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";

/**
 * Provider boundary for the catalog. The app ships with its own Postgres
 * catalog; alternative providers (merchant feeds, APIs, web-shopping
 * adapters) can implement CatalogProvider without touching the agent or UI.
 */

let postgresProviderPromise: Promise<CatalogProvider> | null = null;

async function getPostgresProvider(): Promise<CatalogProvider> {
  if (!postgresProviderPromise) {
    postgresProviderPromise = (async () => {
      const { db } = await getDatabase();
      await ensureSeeded(db);
      return new PostgresCatalogProvider(db);
    })().catch((error) => {
      postgresProviderPromise = null;
      throw error;
    });
  }
  return postgresProviderPromise;
}

let staticProvider: CatalogProvider | null = null;

export async function getCatalogProvider(): Promise<CatalogProvider> {
  if (databaseConfigured()) {
    try {
      return await getPostgresProvider();
    } catch (error) {
      console.error(
        "[catalog] Database unavailable, falling back to static catalog:",
        error instanceof Error ? error.message : error,
      );
    }
  }
  if (!staticProvider) {
    staticProvider = new StaticCatalogProvider();
  }
  return staticProvider;
}
