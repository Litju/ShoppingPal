import type { CatalogProvider } from "@shoppingpal/contracts";
import { StaticCatalogProvider } from "@/lib/catalog/static-provider";
import { PostgresCatalogProvider } from "@/lib/catalog/postgres-provider";
import { MedusaCatalogProvider } from "@/lib/catalog/medusa-provider";
import { medusaEnabled } from "@/lib/commerce/config";
import { databaseConfigured, getDatabase } from "@/lib/db";
import { ensureSeeded } from "@/lib/db/seed";

/**
 * Provider boundary for the catalog. After the convergence, Medusa is the
 * canonical commerce authority; the embedded legacy stack remains only for
 * zero-credential demo mode until final legacy removal (design doc §27).
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
  if (medusaEnabled()) {
    return new MedusaCatalogProvider();
  }
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
