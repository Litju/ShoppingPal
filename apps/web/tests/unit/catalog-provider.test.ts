import { describe, expect, it } from "vitest";

import { StaticCatalogProvider } from "@/lib/catalog/static-provider";
import {
  buildBundleFromCandidates,
  validateExplicitBundle,
} from "@/lib/catalog/bundle";
import { SEED_PRODUCTS } from "@/lib/catalog/data/products";
import type { Product } from "@/lib/catalog/types";

const provider = new StaticCatalogProvider();

describe("StaticCatalogProvider", () => {
  it("finds products by slug and returns null for unknown", async () => {
    const found = await provider.getBySlug("auralux-aero-14");
    expect(found?.title).toContain("Aero 14");
    expect(await provider.getBySlug("nope-nope")).toBeNull();
  });

  it("getByIds ignores unknown ids without throwing", async () => {
    const known = await provider.getBySlug("helioform-terra-27-monitor");
    expect(known).not.toBeNull();
    const results = await provider.getByIds([
      known!.id,
      "00000000-0000-4000-8000-000000000000",
    ]);
    expect(results).toHaveLength(1);
    expect(results[0]?.slug).toBe("helioform-terra-27-monitor");
  });

  it("paginates search results", async () => {
    const page1 = await provider.search({ pageSize: 10, page: 1 });
    const page2 = await provider.search({ pageSize: 10, page: 2 });
    expect(page1.items).toHaveLength(10);
    expect(page1.total).toBeGreaterThan(10);
    expect(page2.items[0]?.id).not.toBe(page1.items[0]?.id);
  });

  it("uses deterministic ids shared with the DB seeder", async () => {
    const p1 = await provider.getBySlug("tidepool-sprint-2-earbuds");
    const p2 = await provider.getBySlug("tidepool-sprint-2-earbuds");
    expect(p1?.id).toBe(p2?.id);
  });

  it("suggests related products from the same category", async () => {
    const base = await provider.getBySlug("marlowe-pulse-anc-headphones");
    const related = await provider.related(base!, 4);
    expect(related).toHaveLength(4);
    for (const item of related) {
      expect(item.category).toBe("audio");
    }
  });
});

function asProduct(seed: (typeof SEED_PRODUCTS)[number]): Product {
  return {
    ...seed,
    id: seed.slug,
    currency: "USD",
    images: [],
  };
}

describe("bundle builder — budget math", () => {
  const candidates = [
    { product: asProduct(SEED_PRODUCTS.find((p) => p.slug === "quill-byte-devdesk-tower")!), area: "laptop", score: 480 },
    { product: asProduct(SEED_PRODUCTS.find((p) => p.slug === "auralux-chromenote-go")!), area: "laptop", score: 430 },
    { product: asProduct(SEED_PRODUCTS.find((p) => p.slug === "helioform-terra-27-monitor")!), area: "monitor", score: 462 },
    { product: asProduct(SEED_PRODUCTS.find((p) => p.slug === "vantage-labs-mech-75-keyboard")!), area: "keyboard", score: 473 },
    { product: asProduct(SEED_PRODUCTS.find((p) => p.slug === "summit-forge-half-rack")!), area: "rack", score: 487 },
  ];

  it("picks the best item per area while staying under budget", () => {
    const bundle = buildBundleFromCandidates({
      budget: 180_000,
      candidates,
      maxItems: 4,
    });
    expect(bundle).not.toBeNull();
    // Greedy fills every area it can; the total never busts $1,800.
    expect(bundle!.items.length).toBe(4);
    expect(bundle!.total).toBeLessThanOrEqual(180_000);
    expect(bundle!.overflow).toBeNull();
    expect(bundle!.remaining).toBe(180_000 - bundle!.total);
  });

  it("downgrades an area when the best pick busts the budget", () => {
    const tight = buildBundleFromCandidates({
      budget: 60_000,
      candidates,
      maxItems: 4,
    });
    expect(tight).not.toBeNull();
    expect(tight!.items.map((i) => i.slug)).not.toContain("quill-byte-devdesk-tower");
    expect(tight!.total).toBeLessThanOrEqual(60_000);
  });

  it("skips areas with nothing affordable and reports it", () => {
    const bundle = buildBundleFromCandidates({
      budget: 20_000,
      candidates: [candidates[3]!], // keyboard only
      maxItems: 4,
    });
    expect(bundle?.items.map((i) => i.slug)).toEqual(["vantage-labs-mech-75-keyboard"]);
  });

  it("returns null when nothing fits at all", () => {
    expect(
      buildBundleFromCandidates({ budget: 1000, candidates }),
    ).toBeNull();
  });
});

describe("explicit bundle validation", () => {
  const laptop = asProduct(SEED_PRODUCTS.find((p) => p.slug === "helioform-airbook-13")!);
  const keyboard = asProduct(SEED_PRODUCTS.find((p) => p.slug === "grid-grain-precision-mouse")!);

  it("reports remaining budget when under", () => {
    const bundle = validateExplicitBundle([laptop, keyboard], 80_000);
    expect(bundle?.total).toBe(laptop.price + keyboard.price);
    expect(bundle?.remaining).toBe(80_000 - bundle!.total);
    expect(bundle?.overflow).toBeNull();
  });

  it("reports overflow honestly", () => {
    const bundle = validateExplicitBundle([laptop], 50_000);
    expect(bundle?.overflow).toBe(laptop.price - 50_000);
    expect(bundle?.remaining).toBeNull();
  });

  it("rejects empty selections", () => {
    expect(validateExplicitBundle([], 100_000)).toBeNull();
  });
});

