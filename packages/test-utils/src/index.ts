import type { CartLine } from "@shoppingpal/contracts";

/**
 * Deterministic test fixtures shared across workspaces.
 * Values are integer minor units — mirrors production invariants.
 */

let counter = 0;

export interface SeedProductOverrides {
  id?: string;
  slug?: string;
  title?: string;
  brand?: string;
  category?: string;
  description?: string;
  price?: number;
  stock?: number;
  ratingTenths?: number;
  reviewCount?: number;
  tags?: string[];
  specs?: Record<string, string>;
  featured?: boolean;
}

export function makeSeedProduct(overrides: SeedProductOverrides = {}) {
  counter += 1;
  const slug = overrides.slug ?? `fixture-product-${counter}`;
  return {
    id: overrides.id ?? slug,
    slug,
    title: overrides.title ?? `Fixture Product ${counter}`,
    brand: overrides.brand ?? "FixtureBrand",
    category: overrides.category ?? "audio",
    description: overrides.description ?? "A deterministic fixture product for tests.",
    price: overrides.price ?? 19900,
    currency: "USD",
    stock: overrides.stock ?? 25,
    ratingTenths: overrides.ratingTenths ?? 47,
    reviewCount: overrides.reviewCount ?? 1200,
    tags: overrides.tags ?? ["fixture"],
    specs: overrides.specs ?? { Type: "Fixture" },
    featured: overrides.featured ?? false,
  };
}

export function makeCartLine(overrides: Partial<CartLine> = {}): CartLine {
  counter += 1;
  const unitPrice = overrides.unitPrice ?? 19900;
  const quantity = overrides.quantity ?? 1;
  return {
    productId: overrides.productId ?? `fixture-line-${counter}`,
    slug: overrides.slug ?? `fixture-slug-${counter}`,
    title: overrides.title ?? `Fixture Line ${counter}`,
    brand: overrides.brand ?? "FixtureBrand",
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
    stock: overrides.stock ?? 50,
    currency: overrides.currency ?? "USD",
    imageHint: overrides.imageHint,
  };
}
