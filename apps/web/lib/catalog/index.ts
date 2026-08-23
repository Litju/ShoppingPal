import type { CatalogProvider } from "@shoppingpal/contracts";
import { StaticCatalogProvider } from "@/lib/catalog/static-provider";
import { MedusaCatalogProvider } from "@/lib/catalog/medusa-provider";
import { TypesenseCatalogProvider } from "@/lib/catalog/typesense-provider";
import { medusaEnabled, searchBackend } from "@/lib/commerce/config";

/** Medusa is canonical; static data is browse-only degraded fallback. */

let staticProvider: CatalogProvider | null = null;

export async function getCatalogProvider(): Promise<CatalogProvider> {
  if (medusaEnabled()) {
    const canonical = new MedusaCatalogProvider();
    return searchBackend() === "typesense"
      ? new TypesenseCatalogProvider(canonical)
      : canonical;
  }
  if (!staticProvider) {
    staticProvider = new StaticCatalogProvider();
  }
  return staticProvider;
}
