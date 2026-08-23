import type { EveMessage } from "eve/react";

export interface ChatMessageMetadata {
  pageContext?: {
    source?: "product-page" | "category" | "home" | "cart" | "search";
    productName?: string;
    productSlug?: string;
    category?: string;
  };
  shortlist?: Array<{ position: number; title: string; id: string }>;
}

export type ShoppingPalMessage = EveMessage;

export const SUGGESTED_PROMPTS_HOME = [
  "Best headphones under $250 for gym and commuting",
  "Laptop, monitor and keyboard for programming under $1,800",
  "Build me the best home gym setup under $1,000",
];

type ToolPart = {
  type: string;
  toolName?: string;
  state?: string;
  output?: unknown;
};

type ToolRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ToolRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): ToolRecord {
  return isRecord(value) ? value : {};
}

function asRecords(value: unknown): ToolRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function toolName(part: ToolPart): string {
  return part.type === "dynamic-tool"
    ? String(part.toolName ?? "")
    : part.type.replace(/^tool-/, "");
}

export function extractShortlist(
  messages: readonly ShoppingPalMessage[],
): Array<{ position: number; title: string; id: string }> {
  const entries: Array<{ position: number; title: string; id: string }> = [];
  const seen = new Set<string>();

  for (const message of messages) {
    if (message.role !== "assistant") continue;
    for (const part of message.parts as readonly ToolPart[]) {
      if (part.state !== "output-available") continue;
      const output = asRecord(part.output);
      const payload = asRecord(output.payload ?? output);
      const products = [
        ...asRecords(payload.products),
        ...asRecords(payload.items),
        ...(isRecord(payload.product) ? [payload.product] : []),
      ];
      for (const product of products) {
        const id = product.id ?? product.product_id;
        const title = product.title;
        if (typeof id !== "string" || typeof title !== "string" || seen.has(id)) continue;
        seen.add(id);
        entries.push({ position: seen.size, title, id });
      }
    }
  }

  return entries.slice(-8);
}

export function messageText(message: ShoppingPalMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export { toolName };
