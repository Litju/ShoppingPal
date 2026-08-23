export interface AgentCandidate {
  product_id: string;
  variant_id: string;
  slug: string;
  title: string;
  brand: string;
  description: string;
  price: number;
  currency: string;
  stock: number;
  in_stock: boolean;
  rating_tenths: number;
  review_count: number;
  tags: string[];
  specs: Record<string, string>;
}

export interface AgentCartProposal {
  kind: "cart_proposal";
  operation_id: string;
  actor_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  expected_price: number;
  currency: string;
  canonical_revision: string;
  requires_ui_execution: true;
}

export interface AgentGraphRequest {
  message: string;
  session_id?: string;
  mission_id?: string | null;
  graph_run_id?: string | null;
}

export interface AgentGraphResponse {
  run_id: string;
  correlation_id: string;
  session_id: string;
  mission_id: string | null;
  intent: "recommend" | "compare" | "compatibility" | "refine" | "commerce_action";
  payload: Record<string, unknown>;
  proposed_action: AgentCartProposal | null;
  approval_required: boolean;
  degraded: boolean;
}

/** Server-side typed boundary; never call the privileged agent directly from a browser. */
export async function runAgentGraph(
  baseUrl: string,
  input: AgentGraphRequest,
  context: { actorId: string; internalToken?: string; correlationId?: string },
): Promise<AgentGraphResponse> {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/v1/graph/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-actor-id": context.actorId,
      ...(context.internalToken ? { "x-agent-internal-token": context.internalToken } : {}),
      ...(context.correlationId ? { "x-correlation-id": context.correlationId } : {}),
    },
    body: JSON.stringify(input),
    cache: "no-store",
  });
  const body: unknown = await response.json();
  if (!response.ok) throw new Error(`Agent request failed (${response.status})`);
  return body as AgentGraphResponse;
}
