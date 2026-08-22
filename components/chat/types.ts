import type { InferUITools, UIMessage } from "ai";

import type { ShoppingPalTools } from "@/lib/ai/tools";

export interface ChatMessageMetadata {
  pageContext?: {
    source?: "product-page" | "category" | "home" | "cart" | "search";
    productName?: string;
    productSlug?: string;
    category?: string;
  };
  shortlist?: Array<{ position: number; title: string; id: string }>;
}

export type ChatUITools = InferUITools<ShoppingPalTools>;
export type ShoppingPalMessage = UIMessage<
  ChatMessageMetadata,
  never,
  ChatUITools
>;

export const SUGGESTED_PROMPTS_HOME = [
  "Best headphones under $250 for gym and commuting",
  "Laptop, monitor and keyboard for programming under $1,800",
  "Build me the best home gym setup under $1,000",
];

export function extractShortlist(
  messages: ShoppingPalMessage[],
): Array<{ position: number; title: string; id: string }> {
  const entries: Array<{ position: number; title: string; id: string }> = [];
  const seen = new Set<string>();
  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts) {
      if (
        (part.type === "tool-searchProducts" ||
          part.type === "tool-findAlternatives") &&
        part.state === "output-available"
      ) {
        const products =
          "products" in part.output
            ? (part.output.products as Array<{ id: string; title: string }>)
            : [];
        for (const p of products ?? []) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            entries.push({ position: seen.size, title: p.title, id: p.id });
          }
        }
      }
      if (part.type === "tool-recommendProduct" && part.state === "output-available") {
        const p = part.output.product;
        if (p && !seen.has(p.id)) {
          seen.add(p.id);
          entries.push({ position: seen.size, title: p.title, id: p.id });
        }
      }
      if (part.type === "tool-buildBundle" && part.state === "output-available") {
        for (const item of part.output.items) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            entries.push({ position: seen.size, title: item.title, id: item.id });
          }
        }
      }
    }
  }
  return entries.slice(-8);
}

/** Extract plain text from a message's text parts. */
export function messageText(message: ShoppingPalMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}
