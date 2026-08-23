import { z } from "zod";

import { runAddToCart } from "@/lib/ai/engine";

const agentEnvelopeSchema = z.object({
  event: z.enum(["session_started", "graph_result", "approval_required", "error"]),
  correlation_id: z.string(),
  session_id: z.string(),
  payload: z.record(z.string(), z.unknown()),
});

const agentConfigSchema = z.object({
  baseUrl: z.string().url(),
  internalToken: z.string().optional(),
});

const candidateSchema = z.object({
  product_id: z.string(),
  variant_id: z.string(),
  slug: z.string(),
  title: z.string(),
  brand: z.string().default(""),
  category: z.string().default("other"),
  description: z.string().default(""),
  price: z.number().int().nonnegative(),
  currency: z.string(),
  stock: z.number().int().nonnegative(),
  in_stock: z.boolean(),
  rating_tenths: z.number().int().nonnegative(),
  review_count: z.number().int().nonnegative(),
  tags: z.array(z.string()),
  specs: z.record(z.string(), z.string()),
});

const cartProposalSchema = z.object({
  kind: z.literal("cart_proposal"),
  operation_id: z.string(),
  actor_id: z.string(),
  product_id: z.string(),
  variant_id: z.string(),
  quantity: z.number().int().min(1).max(10),
  expected_price: z.number().int().nonnegative(),
  currency: z.string(),
  canonical_revision: z.string(),
  requires_ui_execution: z.literal(true),
});

export interface AgentToolEvent {
  name: string;
  input: unknown;
  output: unknown;
}

export interface AgentUiResult {
  events: AgentToolEvent[];
  text: string;
}

function toProductSummary(candidate: z.infer<typeof candidateSchema>) {
  return {
    id: candidate.product_id,
    slug: candidate.slug,
    title: candidate.title,
    brand: candidate.brand,
    category: candidate.category,
    description: candidate.description.slice(0, 160),
    price: candidate.price,
    currency: candidate.currency,
    ratingTenths: candidate.rating_tenths,
    reviewCount: candidate.review_count,
    stock: candidate.stock,
    tags: candidate.tags,
    specs: candidate.specs,
  };
}

function formatMinor(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

function comparisonOutput(products: Array<z.infer<typeof candidateSchema>>, differences: Record<string, string[]>) {
  const rows = Object.entries(differences).map(([label, values]) => ({
    label: label.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
    values,
    differs: new Set(values).size > 1,
  }));
  const highlights: string[] = [];
  if (products.length >= 2) {
    const prices = products.map((product) => product.price);
    const spread = Math.max(...prices) - Math.min(...prices);
    const currency = products[0]?.currency ?? "USD";
    if (spread > 0) {
      const cheapest = products.reduce((left, right) => (left.price <= right.price ? left : right));
      highlights.push(
        `Biggest price gap is ${formatMinor(spread, currency)} — ${cheapest.title} is the value anchor.`,
      );
    }
  }
  highlights.push("These rows are derived from the current store catalog data.");
  return {
    products: products.map(toProductSummary),
    rows,
    highlights,
    notFound: [],
  };
}

/** Convert typed Eve results into the existing accessible generative UI parts. */
export async function agentPayloadToUiResult(
  payload: Record<string, unknown>,
  userText: string,
): Promise<AgentUiResult> {
  if (payload.kind === "approval_required" && payload.action === "checkout") {
    return {
      events: [],
      text: "Checkout isn't available right now; payment setup is required.",
    };
  }
  if (payload.kind === "recommendations") {
    const products = z.array(candidateSchema).safeParse(payload.products);
    if (!products.success) return { events: [], text: "I couldn't validate the catalog result." };
    const summaries = products.data.map(toProductSummary);
    const first = products.data[0];
    const events: AgentToolEvent[] = [
      {
        name: "searchProducts",
        input: { query: userText, limit: summaries.length },
        output: { products: summaries, total: summaries.length },
      },
    ];
    if (first) {
      events.push({
        name: "recommendProduct",
        input: { productId: first.product_id },
        output: {
          product: toProductSummary(first),
          reasons: ["Matches the current request using current store catalog data."],
          tradeoffs: [],
          budgetRemaining: null,
          overBudgetBy: null,
        },
      });
    }
    return {
      events,
      text: products.data.length
        ? `I found ${products.data.length} current catalog option${products.data.length === 1 ? "" : "s"} for you.`
        : "I couldn't find a current catalog match for that request.",
    };
  }

  if (payload.kind === "comparison") {
    const products = z.array(candidateSchema).safeParse(payload.products);
    const differences = z.record(z.string(), z.array(z.string())).safeParse(payload.differences);
    if (!products.success || !differences.success) {
      return { events: [], text: "I couldn't validate the comparison result." };
    }
    return {
      events: [
        {
          name: "compareProducts",
          input: { productIds: products.data.map((product) => product.product_id) },
          output: comparisonOutput(products.data, differences.data),
        },
      ],
      text: "Here is a current canonical comparison of the matching products.",
    };
  }

  if (payload.kind === "bundle") {
    const products = z.array(candidateSchema).safeParse(payload.items);
    const bundle = z
      .object({
        total: z.number().int().nonnegative(),
        budget: z.number().int().nonnegative().nullable(),
        remaining: z.number().int().nullable(),
        overflow: z.number().int().nullable(),
        rationale: z.array(z.string()),
      })
      .safeParse(payload);
    if (!products.success || !bundle.success) {
      return { events: [], text: "I couldn't validate the bundle result." };
    }
    return {
      events: [
        {
          name: "buildBundle",
          input: { description: userText, budget: bundle.data.budget },
          output: {
            items: products.data.map(toProductSummary),
            total: bundle.data.total,
            budget: bundle.data.budget,
            remaining: bundle.data.remaining,
            overflow: bundle.data.overflow,
            rationale: bundle.data.rationale,
          },
        },
      ],
      text: "I assembled a current, in-stock bundle from the store catalog.",
    };
  }

  if (payload.kind === "cart_proposal") {
    const proposal = cartProposalSchema.safeParse(payload);
    if (!proposal.success) return { events: [], text: "I couldn't validate that cart action." };
    try {
      const cart = await runAddToCart(
        { productId: proposal.data.product_id, quantity: proposal.data.quantity },
        {
          expectedPrice: proposal.data.expected_price,
          expectedVariantId: proposal.data.variant_id,
          operationId: proposal.data.operation_id,
        },
      );
      return {
        events: [
          {
            name: "addToCart",
            input: { productId: proposal.data.product_id, quantity: proposal.data.quantity },
            output: cart,
          },
        ],
        text: "The canonical cart mutation was applied and confirmed.",
      };
    } catch (error) {
      return {
        events: [],
        text: `I couldn't add that item: ${error instanceof Error ? error.message : "canonical cart state rejected it"}`,
      };
    }
  }

  return { events: [], text: agentResultText(payload) };
}

export function getAgentConfig() {
  const baseUrl = process.env.AGENT_URL?.trim();
  if (!baseUrl) return null;
  const parsed = agentConfigSchema.safeParse({
    baseUrl,
    internalToken: process.env.AGENT_INTERNAL_TOKEN?.trim() || undefined,
  });
  return parsed.success ? parsed.data : null;
}

export async function runEveAgent(options: {
  baseUrl: string;
  internalToken?: string;
  actorId: string;
  sessionId: string;
  message: string;
  missionId?: string;
  contextProductIds?: string[];
}): Promise<Array<z.infer<typeof agentEnvelopeSchema>>> {
  const response = await fetch(
    `${options.baseUrl.replace(/\/$/, "")}/api/v1/eve/sessions/${encodeURIComponent(options.sessionId)}/messages`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-actor-id": options.actorId,
        ...(options.internalToken
          ? { "x-agent-internal-token": options.internalToken }
          : {}),
      },
      body: JSON.stringify({
        message: options.message,
        mission_id: options.missionId ?? null,
        context_product_ids: options.contextProductIds ?? [],
      }),
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error(`Eve request failed (${response.status})`);
  return z.array(agentEnvelopeSchema).parse(await response.json());
}

export function agentResultText(payload: Record<string, unknown>): string {
  if (payload.kind === "cart_proposal") {
    return "I prepared that cart action with the current price and inventory. The storefront will apply it and confirm the canonical result.";
  }
  if (payload.kind === "approval_required") {
    if (payload.action === "checkout") {
      return "Checkout isn't available right now; payment setup is required.";
    }
    return String(payload.message ?? "This action needs your explicit confirmation before it can proceed.");
  }
  if (payload.kind === "commerce_rejected") {
    return String(payload.message ?? "That commerce action could not be completed from canonical state.");
  }
  if (payload.kind === "recommendations") {
    const products = Array.isArray(payload.products) ? payload.products : [];
    return products.length
      ? `I found ${products.length} current catalog option${products.length === 1 ? "" : "s"} for you.`
      : "I couldn't find a current catalog match for that request.";
  }
  if (payload.kind === "comparison") return "Here is a current canonical comparison of the matching products.";
  if (payload.kind === "compatibility") return "I checked the matching products against the available canonical specifications.";
  if (payload.kind === "clarification") return String(payload.question ?? "What should we narrow down?");
  return "I have a structured result from the shopping workflow.";
}
