import type { ExecArgs } from "@medusajs/framework/types";

const TYPESENSE_URL = process.env.TYPESENSE_URL?.trim() || "http://localhost:8108";
const TYPESENSE_API_KEY = process.env.TYPESENSE_API_KEY?.trim() || "shoppingpal-dev-key";
const MEDUSA_URL = process.env.MEDUSA_BACKEND_URL?.trim() || "http://localhost:9000";
const MEDUSA_KEY = process.env.MEDUSA_PUBLISHABLE_KEY?.trim() || "";

type ProductVariant = {
  id: string;
  sku?: string | null;
  inventory_quantity?: number | null;
  manage_inventory?: boolean;
  calculated_price?: { calculated_amount?: number; currency_code?: string } | null;
};

type Product = {
  id: string;
  handle: string;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
  variants?: ProductVariant[];
};

type TypesenseDocument = {
  id: string;
  handle: string;
  title: string;
  brand: string;
  category: string;
  description: string;
  tags: string[];
  specs: string;
  price: number;
  in_stock: boolean;
  rating_tenths: number;
  review_count: number;
  sku: string;
  variant_id: string;
};

async function typesenseRequest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${TYPESENSE_URL}${path}`, {
    ...init,
    headers: {
      "X-TYPESENSE-API-KEY": TYPESENSE_API_KEY,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function fetchMedusaProducts(): Promise<Product[]> {
  if (!MEDUSA_KEY) throw new Error("MEDUSA_PUBLISHABLE_KEY is required for a live catalog sync.");
  let regionId = process.env.MEDUSA_REGION_ID?.trim();
  if (!regionId) {
    const regions = await fetch(`${MEDUSA_URL}/store/regions?limit=1`, {
      headers: { "x-publishable-api-key": MEDUSA_KEY },
    });
    if (!regions.ok) throw new Error(`Could not load Medusa regions (${regions.status}).`);
    regionId = ((await regions.json()) as { regions?: Array<{ id: string }> }).regions?.[0]?.id;
  }
  if (!regionId) throw new Error("A Medusa pricing region is required for a live catalog sync.");
  const fields = [
    "id",
    "handle",
    "title",
    "description",
    "metadata",
    "+variants.id",
    "+variants.sku",
    "+variants.manage_inventory",
    "+variants.inventory_quantity",
    "+variants.calculated_price.calculated_amount",
    "+variants.calculated_price.currency_code",
  ].join(",");
  const query = new URLSearchParams({ limit: "200", fields, region_id: regionId });
  const response = await fetch(`${MEDUSA_URL}/store/products?${query}`, {
    headers: { "x-publishable-api-key": MEDUSA_KEY },
  });
  if (!response.ok) throw new Error(`Could not load Medusa products (${response.status}).`);
  return ((await response.json()) as { products: Product[] }).products;
}

function toDocument(product: Product): TypesenseDocument | null {
  const variant = product.variants?.find(
    (item) => item.manage_inventory === false || Number(item.inventory_quantity ?? 0) > 0,
  ) ?? product.variants?.[0];
  if (!variant) return null;
  const metadata = product.metadata ?? {};
  const price = Number(variant.calculated_price?.calculated_amount ?? 0);
  const stock = Number(variant.inventory_quantity ?? 0);
  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    brand: typeof metadata.brand === "string" ? metadata.brand : "",
    category: typeof metadata.category_slug === "string" ? metadata.category_slug : "",
    description: product.description ?? "",
    tags: Array.isArray(metadata.tags) ? metadata.tags.filter((tag): tag is string => typeof tag === "string") : [],
    specs: JSON.stringify(metadata.specs ?? {}),
    price,
    in_stock: variant.manage_inventory === false || stock > 0,
    rating_tenths: Number(metadata.rating_tenths ?? 0),
    review_count: Number(metadata.review_count ?? 0),
    sku: variant.sku ?? "",
    variant_id: variant.id,
  };
}

export default async function syncTypesense({ container }: ExecArgs) {
  const logger = container.resolve("logger") as { info(message: string): void };
  const products = await fetchMedusaProducts();
  const documents = products.map(toDocument).filter((document): document is TypesenseDocument => document !== null);

  const remove = await typesenseRequest("/collections/products", { method: "DELETE" });
  if (!remove.ok && remove.status !== 404) {
    throw new Error(`Could not replace Typesense collection (${remove.status}).`);
  }

  const create = await typesenseRequest("/collections", {
    method: "POST",
    body: JSON.stringify({
      name: "products",
      fields: [
        { name: "handle", type: "string", facet: true },
        { name: "title", type: "string" },
        { name: "brand", type: "string", facet: true },
        { name: "category", type: "string", facet: true },
        { name: "description", type: "string" },
        { name: "tags", type: "string[]", facet: true },
        { name: "specs", type: "string" },
        { name: "price", type: "int32", facet: true },
        { name: "in_stock", type: "bool", facet: true },
        { name: "rating_tenths", type: "int32" },
        { name: "review_count", type: "int32" },
        { name: "sku", type: "string" },
        { name: "variant_id", type: "string" },
      ],
    }),
  });
  if (!create.ok) throw new Error(`Could not create Typesense collection (${create.status}).`);

  const imported = await typesenseRequest(
    "/collections/products/documents/import?action=upsert",
    {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: documents.map((document) => JSON.stringify(document)).join("\n"),
    },
  );
  if (!imported.ok) throw new Error(`Could not import Typesense documents (${imported.status}).`);
  const results = (await imported.text())
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (results.length === 0) throw new Error("Typesense returned no import results.");
  const failed = results.filter((line) => {
    try {
      return !JSON.parse(line).success;
    } catch {
      return true;
    }
  });
  if (failed.length > 0) throw new Error(`Typesense rejected ${failed.length} documents.`);
  logger.info(`Typesense sync complete: ${documents.length} live Medusa products projected.`);
}
