import type {
  CatalogPage,
  CatalogProvider,
  CatalogQuery,
  CategorySlug,
  Product,
} from "@shoppingpal/contracts";

import { applyCatalogQuery, buildSearchableText } from "@/lib/catalog/query";
import {
  TypesenseClient,
  type TypesenseSearchClient,
} from "@/lib/commerce/typesense-client";

/** Typesense supplies candidate ids only; every returned product is Medusa-hydrated. */
export class TypesenseCatalogProvider implements CatalogProvider {
  readonly name = "typesense";

  constructor(
    private readonly canonical: CatalogProvider,
    private readonly searchClient: TypesenseSearchClient = new TypesenseClient(),
  ) {}

  async search(query: CatalogQuery): Promise<CatalogPage> {
    try {
      const result = await this.searchClient.search({
        q: query.q?.trim() || "*",
        query_by: "title,brand,category,description,tags,handle,sku,specs",
        per_page: 250,
        page: 1,
      });
      const ids = (result.hits ?? []).map((hit) => hit.document.id);
      if (ids.length === 0) {
        console.warn("[catalog] Typesense returned no candidates; using canonical Medusa search.");
        return this.canonical.search(query);
      }
      const hydrated = await this.canonical.getByIds(ids);
      if (hydrated.length === 0) {
        console.warn("[catalog] Typesense candidates did not hydrate; using canonical Medusa search.");
        return this.canonical.search(query);
      }
      const searchable = new Map(
        hydrated.map((product) => [product.id, buildSearchableText(product)]),
      );
      const { items, total } = applyCatalogQuery(hydrated, searchable, query);
      const page = Math.max(1, query.page ?? 1);
      const pageSize = Math.min(60, Math.max(1, query.pageSize ?? 24));
      return {
        items: items.slice((page - 1) * pageSize, page * pageSize),
        total,
        page,
        pageSize,
      };
    } catch (error) {
      console.error(
        "[catalog] Typesense unavailable; using canonical Medusa search:",
        error instanceof Error ? error.message : error,
      );
      return this.canonical.search(query);
    }
  }

  getById(id: string): Promise<Product | null> {
    return this.canonical.getById(id);
  }

  getBySlug(slug: string): Promise<Product | null> {
    return this.canonical.getBySlug(slug);
  }

  getByIds(ids: string[]): Promise<Product[]> {
    return this.canonical.getByIds(ids);
  }

  featured(): Promise<Product[]> {
    return this.canonical.featured();
  }

  related(product: Product, limit?: number): Promise<Product[]> {
    return this.canonical.related(product, limit);
  }

  categories(): Promise<Array<{ slug: CategorySlug; label: string; count: number }>> {
    return this.canonical.categories();
  }
}
