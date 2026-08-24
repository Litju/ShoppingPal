import { createHmac } from "node:crypto";
import { z } from "zod";
import type { ToolContext } from "eve/tools";

const graphResponseSchema = z.object({
  run_id: z.string(),
  correlation_id: z.string(),
  session_id: z.string(),
  mission_id: z.string().nullable(),
  intent: z.enum(["recommend", "compare", "compatibility", "bundle", "refine", "commerce_action"]),
  payload: z.record(z.string(), z.unknown()),
  proposed_action: z
    .object({
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
    })
    .nullable(),
  approval_required: z.boolean(),
  degraded: z.boolean(),
});

const publicCartActionSchema = z.object({
  action: z.enum(["add", "remove", "update"]),
  operation_id: z.string(),
  product_id: z.string(),
  variant_id: z.string(),
  quantity: z.number().int().min(1).max(10),
  expected_price: z.number().int().nonnegative(),
  currency: z.string(),
  requires_ui_execution: z.literal(true),
});

export const graphToolResultSchema = z.object({
  intent: z.enum(["recommend", "compare", "compatibility", "bundle", "refine", "commerce_action"]),
  payload: z.record(z.string(), z.unknown()),
  approval_required: z.boolean(),
  degraded: z.boolean(),
  cart_action: publicCartActionSchema.nullable(),
});

export type GraphToolResult = z.infer<typeof graphToolResultSchema>;

function cartActionFromPayload(
  payload: Record<string, unknown>,
  proposal: z.infer<typeof graphResponseSchema>["proposed_action"],
) {
  const source = proposal ?? (payload.kind === "commerce_proposal" ? payload : null);
  if (!source || typeof source !== "object") return null;
  const action = "action" in source && source.action !== "checkout" ? source.action : "add";
  if (action !== "add" && action !== "remove" && action !== "update") return null;
  const operationId = "operation_id" in source ? source.operation_id : undefined;
  const productId = "product_id" in source ? source.product_id : undefined;
  const variantId = "variant_id" in source ? source.variant_id : undefined;
  const quantity = "quantity" in source ? source.quantity : undefined;
  const expectedPrice = "expected_price" in source ? source.expected_price : undefined;
  const currency = "currency" in source ? source.currency : undefined;
  if (
    typeof operationId !== "string" ||
    typeof productId !== "string" ||
    typeof variantId !== "string" ||
    typeof quantity !== "number" ||
    typeof expectedPrice !== "number" ||
    typeof currency !== "string"
  ) {
    return null;
  }
  return {
    action,
    operation_id: operationId,
    product_id: productId,
    variant_id: variantId,
    quantity,
    expected_price: expectedPrice,
    currency,
    requires_ui_execution: true as const,
  };
}

function publicPayload(payload: Record<string, unknown>) {
  if (payload.kind !== "cart_proposal") return payload;
  const { actor_id: _actorId, canonical_revision: _revision, ...safePayload } = payload;
  return safePayload;
}

export async function runShoppingGraph(
  input: { message: string; contextProductIds?: string[]; missionId?: string },
  ctx: Pick<ToolContext, "session">,
): Promise<GraphToolResult> {
  const baseUrl = process.env.AGENT_URL?.trim();
  if (!baseUrl) throw new Error("Shopping workflow is not configured.");
  const actorId =
    ctx.session.auth.current && ctx.session.auth.current.principalType !== "anonymous"
      ? ctx.session.auth.current.principalId
      : `eve:${ctx.session.id}`;
  const graphRunId = `run_${ctx.session.turn.id}`;
  const actorSigningSecret = process.env.AGENT_ACTOR_SIGNING_SECRET?.trim();
  if (!actorSigningSecret) throw new Error("Shopping workflow actor binding is not configured.");
  const actorProof = createHmac("sha256", actorSigningSecret).update(actorId).digest("base64url");

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/graph/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-actor-id": actorId,
      "x-actor-proof": actorProof,
      ...(process.env.AGENT_INTERNAL_TOKEN?.trim()
        ? { "x-agent-internal-token": process.env.AGENT_INTERNAL_TOKEN.trim() }
        : {}),
    },
    body: JSON.stringify({
      message: input.message,
      session_id: ctx.session.id,
      mission_id: input.missionId ?? null,
      graph_run_id: graphRunId,
      context_product_ids: input.contextProductIds ?? [],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Shopping workflow unavailable (${response.status}).`);
  }

  const result = graphResponseSchema.parse(await response.json());
  const cartAction = cartActionFromPayload(result.payload, result.proposed_action);
  return graphToolResultSchema.parse({
    intent: result.intent,
    payload: publicPayload(result.payload),
    approval_required: result.approval_required,
    degraded: result.degraded,
    cart_action: cartAction,
  });
}
