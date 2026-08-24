import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows";
import { Modules } from "@medusajs/framework/utils";
import type { ExecArgs } from "@medusajs/framework/types";
import { SEED_PRODUCTS, productIdForSlug } from "@shoppingpal/contracts";
/**
 * Imports the deterministic ShoppingPal seed catalog into Medusa.
 *
 * Mapping (design doc §11.1):
 *   product            -> Medusa Product (handle = slug)
 *   price              -> variant price (USD, integer minor units)
 *   stock              -> managed inventory on the default variant
 *   brand/category/tags/specs/rating -> metadata (+ Medusa category)
 * Every product receives one explicit default variant.
 *
 * Idempotent: products are keyed by external_id = productIdForSlug(slug);
 * re-running refreshes metadata instead of duplicating.
 */

const CATEGORY_LABELS: Record<string, string> = {
  computers: "Computers",
  "computer-accessories": "Computer Accessories",
  audio: "Audio",
  "phones-accessories": "Phones & Accessories",
  fitness: "Fitness",
  home: "Home",
  kitchen: "Kitchen",
  outdoors: "Outdoors",
  "everyday-carry": "Everyday Carry",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function seedCatalog({ container }: ExecArgs) {
  const logger: any = container.resolve("logger");
  const productModuleService: any = container.resolve(Modules.PRODUCT);

  // 0. Ensure a USD region so storefront pricing has canonical context.
  const regionModuleService: any = container.resolve(Modules.REGION);
  const regions: any[] = await regionModuleService.listRegions(
    { currency_code: "usd" },
    { take: 1 },
  );
  let usdRegion = regions[0];
  if (!usdRegion) {
    usdRegion = await regionModuleService.createRegions({
      name: "United States",
      currency_code: "usd",
      countries: ["us"],
    });
    logger.info(`Created USD region ${usdRegion.id}.`);
  }

  const salesChannelService: any = container.resolve(Modules.SALES_CHANNEL);
  let channel = (await salesChannelService.listSalesChannels(
    { name: "ShoppingPal Storefront" },
    { take: 1 },
  ))[0];
  if (!channel) {
    channel = (await salesChannelService.listSalesChannels({}, { take: 1 }))[0];
  }
  if (!channel) {
    channel = await salesChannelService.createSalesChannels({
      name: "ShoppingPal Storefront",
      is_default: true,
    });
    logger.info("Created sales channel: ShoppingPal Storefront.");
  }

  if (process.env.STRIPE_API_KEY?.trim()) {
    const query: any = container.resolve("query");
    const link: any = container.resolve("remoteLink");
    const providerResult = await query.graph({
      entity: "payment_provider",
      fields: ["id"],
      filters: { id: "pp_stripe_stripe" },
    });
    if (providerResult.data.length === 0) {
      throw new Error(
        "STRIPE_API_KEY is configured but pp_stripe_stripe is not registered.",
      );
    }
    const relationResult = await query.graph({
      entity: "region_payment_provider",
      fields: ["payment_provider_id"],
      filters: { region_id: usdRegion.id },
    });
    if (
      !relationResult.data.some(
        (relation: { payment_provider_id: string }) =>
          relation.payment_provider_id === "pp_stripe_stripe",
      )
    ) {
      await link.create({
        [Modules.REGION]: { region_id: usdRegion.id },
        [Modules.PAYMENT]: { payment_provider_id: "pp_stripe_stripe" },
      });
      logger.info(`Enabled Stripe payments for region ${usdRegion.id}.`);
    }
  }

  // 1. Upsert the nine storefront categories.
  const existingCats: any[] = await productModuleService.listProductCategories(
    {},
    { select: ["id", "name", "handle"] },
  );
  const catByHandle = new Map<string, any>(
    existingCats.map((c) => [c.handle as string, c]),
  );

  const missing = Object.entries(CATEGORY_LABELS).filter(
    ([handle]) => !catByHandle.has(handle),
  );
  for (const [handle, name] of missing) {
    await createProductCategoriesWorkflow(container as any).run({
      input: { product_categories: [{ name, handle }] },
    });
  }
  if (missing.length > 0) {
    const created: any[] = await productModuleService.listProductCategories(
      {},
      { select: ["id", "name", "handle"] },
    );
    for (const c of created) catByHandle.set(c.handle as string, c);
  }

  // 2. Upsert products with an explicit default variant each.
  const existing: any[] = await productModuleService.listProducts(
    {},
    { select: ["id", "handle", "external_id"] },
  );
  const byExternalId = new Map<string, any>(
    existing.map((p) => [p.external_id as string, p]),
  );

  let createdCount = 0;
  let updatedCount = 0;

  for (const seed of SEED_PRODUCTS) {
    const externalId = productIdForSlug(seed.slug);
    const categoryId = catByHandle.get(seed.category)?.id;
    const metadata = {
      brand: seed.brand,
      category_slug: seed.category,
      rating_tenths: seed.ratingTenths,
      review_count: seed.reviewCount,
      tags: seed.tags,
      specs: seed.specs,
      featured: seed.featured,
    };

    if (!byExternalId.has(externalId)) {
      await createProductsWorkflow(container as any).run({
        input: {
          products: [
            {
              external_id: externalId,
              title: seed.title,
              subtitle: `${seed.brand}`,
              description: seed.description,
              handle: seed.slug,
              status: "published",
              discountable: false,
              categories: categoryId ? [{ id: categoryId }] : [],
              metadata,
              options: [{ title: "Title", values: ["Default"] }],
              variants: [
                {
                  title: `Default`,
                  sku: seed.slug.toUpperCase().replace(/-/g, "_"),
                  manage_inventory: true,
                  inventory_quantity: seed.stock,
                  allow_backorder: false,
                  options: { Title: "Default" },
                  prices: [
                    {
                      amount: seed.price,
                      currency_code: "usd",
                    },
                  ],
                },
              ],
            },
          ],
        },
      } as any);
      createdCount += 1;
    } else {
      const existingProduct = byExternalId.get(externalId)!;
      // Keep canonical rows fresh without recreating variants/prices.
      await productModuleService.updateProducts(existingProduct.id, {
        title: seed.title,
        description: seed.description,
        status: "published",
        metadata,
      });
      updatedCount += 1;
    }
  }

  logger.info(
    `Seed complete: ${SEED_PRODUCTS.length} catalog entries processed (${createdCount} created, ${updatedCount} updated).`,
  );

  // 3. Ensure every product is reachable from the default sales channel,
  //    otherwise /store/products/:id 404s for publishable-key callers.
  const link: any = container.resolve("remoteLink");
  const query: any = container.resolve("query");
  const allProducts: any[] = await productModuleService.listProducts(
    {},
    { select: ["id"] },
  );
  const linkedIds = new Set<string>(
    (
      await query.graph({
        entity: "product_sales_channel" as any,
        fields: ["product_id"],
        filters: { sales_channel_id: channel.id },
      })
    ).data.map((row: any) => row.product_id),
  );
  const toLink = allProducts
    .map((p) => p.id)
    .filter((id) => !linkedIds.has(id));
  if (toLink.length > 0) {
    await link.create(
      toLink.map((productId) => ({
        [Modules.PRODUCT]: { product_id: productId },
        [Modules.SALES_CHANNEL]: { sales_channel_id: channel.id },
      })),
    );
    logger.info(`Linked ${toLink.length} products to sales channel ${channel.name}.`);
  }

  // 4. Stock topology: one warehouse location linked to the sales channel,
  //    with inventory levels mirroring the seed's per-product stock.
  const stockLocationService: any = container.resolve(Modules.STOCK_LOCATION);
  const inventoryService: any = container.resolve(Modules.INVENTORY);

  let warehouse = (
    await stockLocationService.listStockLocations(
      { name: "ShoppingPal Warehouse" },
      { take: 1 },
    )
  )[0];
  if (!warehouse) {
    warehouse = await stockLocationService.createStockLocations({
      name: "ShoppingPal Warehouse",
    });
    logger.info("Created stock location: ShoppingPal Warehouse.");
  }

  const stockBySku = new Map<string, number>(
    SEED_PRODUCTS.map((p) => [
      p.slug.toUpperCase().replace(/-/g, "_"),
      p.stock,
    ]),
  );

  const items: any[] = await inventoryService.listInventoryItems(
    {},
    { take: 1000 },
  );
  const levels: any[] = await inventoryService.listInventoryLevels({
    location_id: [warehouse.id],
  });
  const leveled = new Set(levels.map((l) => l.inventory_item_id));

  let createdLevels = 0;
  const toCreate: Array<{
    inventory_item_id: string;
    location_id: string;
    stocked_quantity: number;
  }> = [];
  for (const item of items) {
    if (leveled.has(item.id)) continue;
    const stocked =
      stockBySku.get(item.sku ?? "") ??
      Math.max(0, Number(item.stocked_quantity ?? 0));
    toCreate.push({
      inventory_item_id: item.id,
      location_id: warehouse.id,
      stocked_quantity: stocked,
    });
  }
  if (toCreate.length > 0) {
    await inventoryService.createInventoryLevels(toCreate);
    createdLevels = toCreate.length;
  }
  logger.info(
    `Inventory levels ensured (${createdLevels} created at ${warehouse.name}).`,
  );

  // Link is idempotent-enough: duplicates raise a unique-constraint error
  // we can safely ignore on re-runs.
  try {
    await link.create([
      {
        [Modules.SALES_CHANNEL]: { sales_channel_id: channel.id },
        [Modules.STOCK_LOCATION]: { stock_location_id: warehouse.id },
      },
    ]);
    logger.info(`Linked ${channel.name} to ${warehouse.name}.`);
  } catch {
    logger.info(`Sales channel already linked to ${warehouse.name}.`);
  }
}
