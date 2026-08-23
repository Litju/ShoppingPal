import { getTypesenseConfig } from "@/lib/commerce/config";

export interface TypesenseSearchHit<T> {
  document: T;
}

export interface TypesenseSearchResponse<T> {
  found: number;
  hits?: Array<TypesenseSearchHit<T>>;
}

export interface TypesenseSearchClient {
  search(params: Record<string, string | number>): Promise<TypesenseSearchResponse<{ id: string }>>;
}

export class TypesenseClient implements TypesenseSearchClient {
  private readonly config;

  constructor(config = getTypesenseConfig()) {
    if (!config) throw new Error("Typesense is not configured");
    this.config = config;
  }

  async search(params: Record<string, string | number>) {
    const query = new URLSearchParams(
      Object.entries(params).map(([key, value]) => [key, String(value)]),
    );
    const response = await fetch(
      `${this.config.baseUrl}/collections/products/documents/search?${query}`,
      {
        headers: { "X-TYPESENSE-API-KEY": this.config.apiKey },
        cache: "no-store",
      },
    );
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Typesense search failed (${response.status}): ${body.slice(0, 300)}`);
    }
    return (await response.json()) as TypesenseSearchResponse<{ id: string }>;
  }
}
