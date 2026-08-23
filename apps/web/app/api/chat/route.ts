import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { z } from "zod";

import { getActorContext, getSessionUser } from "@/lib/auth/server";
import {
  agentPayloadToUiResult,
  getAgentConfig,
  runEveAgent,
} from "@/lib/agent/client";
import { aiConfigured } from "@/lib/ai/model";
import { streamDemoAgent } from "@/lib/ai/demo-agent";
import { appendMessage, deriveTitle, upsertConversation } from "@/lib/chat/persist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uiMessageSchema = z.object({
  id: z.string().optional(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(z.unknown()).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const chatRequestSchema = z.object({
  conversationId: z.string().uuid().optional(),
  messages: z.array(uiMessageSchema).min(1),
});

interface PageMetadata {
  productName?: string;
  productSlug?: string;
  category?: string;
  shortlist?: Array<{ position: number; title: string; id: string }>;
}

function textOf(message: { role: string; parts: unknown[] }): string {
  return (message.parts as Array<{ type?: string; text?: string }>)
    .filter((p) => p?.type === "text")
    .map((p) => p.text ?? "")
    .join(" ")
    .trim();
}

export async function POST(request: Request) {
  let body: z.infer<typeof chatRequestSchema>;
  try {
    body = chatRequestSchema.parse(await request.json());
  } catch (error) {
    return Response.json(
      { error: "Invalid request", detail: error instanceof Error ? error.message : undefined },
      { status: 400 },
    );
  }

  const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
  const userText = lastUser ? textOf(lastUser) : "";
  const metadata = (lastUser?.metadata ?? {}) as PageMetadata;

  const user = await getSessionUser();
  const shortlist = metadata.shortlist ?? [];

  // Persist the user turn for signed-in users with a database.
  if (user && body.conversationId) {
    const ownsConversation = await upsertConversation({
      conversationId: body.conversationId,
      userId: user.id,
      title: deriveTitle(userText),
    });
    if (ownsConversation) {
      await appendMessage({
        conversationId: body.conversationId,
        userId: user.id,
        role: "user",
        parts: lastUser?.parts ?? [],
      });
    }
  }

  const agentConfig = getAgentConfig();
  if (agentConfig) {
    try {
      const actor = await getActorContext();
      const envelopes = await runEveAgent({
        baseUrl: agentConfig.baseUrl,
        internalToken: agentConfig.internalToken,
        actorId: actor?.actorId ?? `guest:${body.conversationId ?? "anon"}`,
        sessionId: body.conversationId ?? "eve-anon",
        message: userText,
        contextProductIds: shortlist.map((entry) => entry.id),
      });
      const result = envelopes.find(
        (envelope) => envelope.event === "graph_result" || envelope.event === "approval_required",
      );
      const payload = result?.payload.payload;
      const uiResult = await agentPayloadToUiResult(
        payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {},
        userText,
      );
      const stream = createUIMessageStream({
        execute: async ({ writer }) => {
          writer.write({ type: "start" });
          writer.write({ type: "start-step" });
          if (payload) {
            writer.write({ type: "data-agent-result", data: payload });
          }
          for (const [index, event] of uiResult.events.entries()) {
            const toolCallId = `eve-call-${Date.now()}-${index}`;
            writer.write({
              type: "tool-input-available",
              toolCallId,
              toolName: event.name,
              input: event.input,
            });
            writer.write({ type: "tool-output-available", toolCallId, output: event.output });
          }
          const id = "eve-result";
          writer.write({ type: "text-start", id });
          writer.write({ type: "text-delta", id, delta: uiResult.text });
          writer.write({ type: "text-end", id });
          writer.write({ type: "finish-step" });
          writer.write({ type: "finish" });
        },
        onError: () => "The shopping workflow is unavailable right now. The store still works normally.",
      });
      if (user && body.conversationId) {
        await appendMessage({
          conversationId: body.conversationId,
          userId: user.id,
          role: "assistant",
          parts: [],
        });
      }
      return createUIMessageStreamResponse({ stream });
    } catch (error) {
      console.error("[chat] Eve unavailable; preserving degraded storefront:", error);
      return Response.json(
        { error: "Shopping Pal is unavailable right now. The store still works normally." },
        { status: 502 },
      );
    }
  }

  /* ── Offline demo agent ────────────────────────────────────────────────── */
  if (!aiConfigured()) {
    const sessionKey = user?.id ?? body.conversationId ?? "anon";
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        await streamDemoAgent({
          writer,
          text: userText,
          sessionKey,
        });
        if (user && body.conversationId) {
          // Persist a compact assistant record (demo path builds parts inline).
          await appendMessage({
            conversationId: body.conversationId,
            userId: user.id,
            role: "assistant",
            parts: [],
          });
        }
      },
      onError: () => "The pal hit a snag. Try again.",
    });
    return createUIMessageStreamResponse({ stream });
  }

  // A configured model without the target agent service is not a second
  // production authority. Keep the conventional store usable and surface a
  // truthful degraded response until Eve is connected.
  return Response.json(
    { error: "Shopping Pal is unavailable right now. The store still works normally." },
    { status: 502 },
  );
}
