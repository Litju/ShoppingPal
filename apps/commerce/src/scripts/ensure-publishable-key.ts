import { Modules } from "@medusajs/framework/utils";
import { linkSalesChannelsToApiKeyWorkflow } from "@medusajs/medusa/core-flows";
import type { ExecArgs } from "@medusajs/framework/types";

type Logger = { info(message: string): void };
type Channel = { id: string; name: string };
type PublishableKey = { id: string; token: string };
type ApiKeyService = {
  listApiKeys(filter: { title: string }): Promise<PublishableKey[]>;
  createApiKeys(input: {
    title: string;
    type: "publishable";
    created_by: string;
  }): Promise<PublishableKey>;
};
type SalesChannelService = {
  listSalesChannels(
    filter: Record<string, never> | { name: string },
    options: { take: number },
  ): Promise<Channel[]>;
  createSalesChannels(input: {
    name: string;
    is_default: boolean;
  }): Promise<Channel>;
};

/**
 * Ensures a storefront publishable API key exists, linked to a sales
 * channel that carries the seeded catalog. Prints the token; idempotent.
 */
export default async function ensurePublishableKey({ container }: ExecArgs) {
  const logger = container.resolve("logger") as unknown as Logger;
  const apiKeyService = container.resolve(
    Modules.API_KEY,
  ) as unknown as ApiKeyService;
  const salesChannelService = container.resolve(
    Modules.SALES_CHANNEL,
  ) as unknown as SalesChannelService;

  let channel = (await salesChannelService.listSalesChannels(
    { name: "ShoppingPal Storefront" },
    { take: 1 },
  ))[0];
  if (!channel) {
    const defaultChannel = (await salesChannelService.listSalesChannels(
      {},
      { take: 1 },
    ))[0];
    channel =
      defaultChannel ??
      (await salesChannelService.createSalesChannels({
        name: "ShoppingPal Storefront",
        is_default: true,
      }));
  }

  let key = (await apiKeyService.listApiKeys({
    title: "ShoppingPal Storefront",
  }))[0];
  if (key) {
    logger.info(`Publishable key already present: ${key.token}`);
  } else {
    key = await apiKeyService.createApiKeys({
      title: "ShoppingPal Storefront",
      type: "publishable",
      created_by: "",
    });
    logger.info(`Publishable key created: ${key.token}`);
  }

  type WorkflowContainer = Parameters<typeof linkSalesChannelsToApiKeyWorkflow>[0];
  await linkSalesChannelsToApiKeyWorkflow(container as WorkflowContainer).run({
    input: { id: key.id, add: [channel.id] },
  });
  logger.info(`Key ${key.token} linked to sales channel ${channel.name}`);
}
