import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  stepCountIs,
  ToolLoopAgent,
  type UIMessage,
} from "ai";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/server";
import { aiConfigured, resolveModel } from "@/lib/ai/model";
import { createShoppingPalTools } from "@/lib/ai/tools";
import { buildSystemPrompt } from "@/lib/ai/prompts";
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
  conversationId: z.string().max(80).optional(),
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
    await upsertConversation({
      conversationId: body.conversationId,
      userId: user.id,
      title: deriveTitle(userText),
    });
    await appendMessage({
      conversationId: body.conversationId,
      role: "user",
      parts: lastUser?.parts ?? [],
    });
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
            role: "assistant",
            parts: [],
          });
        }
      },
      onError: () => "The pal hit a snag. Try again.",
    });
    return createUIMessageStreamResponse({ stream });
  }

  /* ── Real LLM agent ────────────────────────────────────────────────────── */
  try {
    const model = await resolveModel();
    if (!model) throw new Error("AI configured but no provider resolved.");

    const tools = createShoppingPalTools();
    const system = buildSystemPrompt({
      productName: metadata.productName,
      productSlug: metadata.productSlug,
      category: metadata.category,
      shortlist: shortlist.map((s, i) => ({
        position: s.position ?? i + 1,
        title: s.title,
        id: s.id,
      })),
    });

    const agent = new ToolLoopAgent({
      model,
      instructions: system,
      tools,
      temperature: 0.4,
      stopWhen: stepCountIs(10),
    });

    const uiMessages = body.messages as unknown as UIMessage[];
    const modelMessages = await convertToModelMessages(uiMessages);
    const result = await agent.stream({
      messages: modelMessages,
    });

    return result.toUIMessageStreamResponse({
      originalMessages: uiMessages,
      onFinish: async ({ responseMessage }) => {
        if (user && body.conversationId) {
          await appendMessage({
            conversationId: body.conversationId,
            role: "assistant",
            parts: (responseMessage?.parts ?? []) as unknown[],
          });
        }
      },
    });
  } catch (error) {
    console.error("[chat] agent failed:", error);
    return Response.json(
      { error: "Shopping Pal is unavailable right now. The store still works normally." },
      { status: 502 },
    );
  }
}
