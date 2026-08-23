import * as React from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";

import {
  BundleCard,
  ProductRecommendation,
} from "@/components/chat/generative/recommendation-card";
import { CartActionCard, CheckoutCard, SavedChip } from "@/components/chat/generative/cart-action-card";
import { ProductComparison } from "@/components/chat/generative/comparison-table";
import { CartProposalCard } from "@/components/chat/generative/cart-action-card";
import { ProductResults, ResultsSkeleton } from "@/components/chat/generative/product-results";
import type { ShoppingPalMessage } from "@/components/chat/types";
import { toolName } from "@/components/chat/types";
import type { Bundle, CartPayload, ProductSummary, Recommendation } from "@/lib/ai/schemas";

type ToolRecord = Record<string, unknown>;
type ToolPart = {
  type: string;
  toolName?: string;
  state?: string;
  toolCallId?: string;
  output?: unknown;
};
type CompareOutput = {
  products: ProductSummary[];
  rows: Array<{ label: string; values: string[]; differs: boolean }>;
  highlights: string[];
  notFound: string[];
};
type CartAction = {
  action: "add" | "remove" | "update";
  operation_id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  expected_price: number;
  currency: string;
  requires_ui_execution: true;
};

function isRecord(value: unknown): value is ToolRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): ToolRecord {
  return isRecord(value) ? value : {};
}

function asRecords(value: unknown): ToolRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asStringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(asRecord(value)).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((block, i) => (
        <p key={i} className="whitespace-pre-line">
          {block}
        </p>
      ))}
    </div>
  );
}

function ToolSkeleton({ label }: { label?: string }) {
  return (
    <div className="my-3" aria-live="polite" aria-busy="true">
      <div className="mb-1 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
        {label ?? "Working…"}
      </div>
      <ResultsSkeleton />
    </div>
  );
}

const TOOL_LABELS: Record<string, string> = {
  searchProducts: "Searching the catalog…",
  getProduct: "Pulling up product details…",
  compareProducts: "Comparing options…",
  findAlternatives: "Looking for alternatives…",
  recommendProduct: "Weighing the best pick…",
  buildBundle: "Assembling your bundle…",
  getCart: "Checking your cart…",
  addToCart: "Adding to cart…",
  updateCart: "Updating your cart…",
  removeFromCart: "Removing from cart…",
  saveProduct: "Saving…",
  prepareCheckout: "Preparing checkout…",
  run_shopping_graph: "Checking the canonical shopping workflow…",
};

/** Renders one assistant message's parts with generative commerce UI. */
export function MessageParts({ message }: { message: ShoppingPalMessage }) {
  return (
    <>
      {message.parts.map((part, index) => {
        const key = `${message.id ?? "msg"}-${index}`;

        if (part.type === "text") {
          if (!part.text.trim()) return null;
          return (
            <div key={key} className="max-w-none">
              <Prose text={part.text} />
            </div>
          );
        }

        if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
          const streaming =
            "state" in part &&
            (part as { state?: string }).state === "input-streaming";
          return (
            <ToolPartView
              key={key}
              part={part as ToolPart}
              streaming={streaming}
            />
          );
        }

        return null;
      })}
    </>
  );
}

function ToolPartView({ part, streaming }: { part: ToolPart; streaming: boolean }) {
  const currentToolName = toolName(part);
  const toolCallId: string = part.toolCallId ?? `${currentToolName}-${Math.random()}`;
  const output = asRecord(part.output);

  if (streaming) {
    return <ToolSkeleton label={TOOL_LABELS[currentToolName] ?? "Working…"} />;
  }

  switch (currentToolName) {
    case "run_shopping_graph": {
      if (part.state !== "output-available") {
        return <ToolSkeleton label={TOOL_LABELS.run_shopping_graph} />;
      }
      return <GraphToolPart toolCallId={toolCallId} output={output} />;
    }
    case "searchProducts": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.searchProducts} />;
      return <ProductResults products={asRecords(output.products).map(toProductSummary)} />;
    }
    case "findAlternatives": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.findAlternatives} />;
      return (
        <ProductResults
          products={asRecords(output.alternatives).map(toProductSummary)}
          emptyMessage="No cheaper alternatives worth switching for — this may already be the value pick."
        />
      );
    }
    case "recommendProduct": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.recommendProduct} />;
      return <ProductRecommendation output={toRecommendation(output)} />;
    }
    case "compareProducts": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.compareProducts} />;
      return <ProductComparison output={toComparisonOutput(output)} />;
    }
    case "buildBundle": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.buildBundle} />;
      return <BundleCard output={toBundle(output)} />;
    }
    case "getCart": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.getCart} />;
      const lines = asRecords(asRecord(output.cart).lines);
      if (lines.length === 0) {
        return (
          <div className="my-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Your cart is empty.
          </div>
        );
      }
      const items = lines
        .map((line) => `• ${asNumber(line.quantity)} × ${asString(line.title, "Unnamed item")}`)
        .join("\n");
      return (
        <div className="my-2 rounded-lg border border-border bg-card p-4 text-sm">
          <p className="whitespace-pre-line">{items}</p>
          <Link href="/cart" className="mt-2 inline-block font-medium text-primary hover:underline">
            Open cart →
          </Link>
        </div>
      );
    }
    case "addToCart":
    case "updateCart":
    case "removeFromCart": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS[currentToolName]} />;
      return (
        <CartActionCard
          toolCallId={toolCallId}
          ok={Boolean(output.ok)}
          message={asString(output.message, "The cart action was acknowledged.")}
          cart={isRecord(output.cart) ? (output.cart as CartPayload) : null}
          action={currentToolName === "addToCart" ? "add" : currentToolName === "updateCart" ? "update" : "remove"}
        />
      );
    }
    case "saveProduct": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.saveProduct} />;
      return <SavedChip message={asString(output.message, "Saved.")} />;
    }
    case "prepareCheckout": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.prepareCheckout} />;
      return (
        <CheckoutCard
          toolCallId={toolCallId}
          ready={Boolean(output.ready)}
          message={asString(output.message)}
        />
      );
    }
    case "getProduct": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.getProduct} />;
      if (!isRecord(output.product)) {
        return (
          <div className="my-2 rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
            {asString(output.message, "Product not found.")}
          </div>
        );
      }
      return <ProductResults products={[toProductSummary(output.product)]} />;
    }
    default:
      return (
        <div className="my-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
          Ran “{currentToolName}”
        </div>
      );
  }
}

function toProductSummary(value: unknown): ProductSummary {
  const product = asRecord(value);
  return {
    id: asString(product.id ?? product.product_id),
    slug: asString(product.slug),
    title: asString(product.title, "Unnamed product"),
    brand: asString(product.brand),
    category: asString(product.category, "other"),
    description: asString(product.description),
    price: asNumber(product.price),
    currency: asString(product.currency, "USD"),
    ratingTenths: asNumber(product.ratingTenths ?? product.rating_tenths),
    reviewCount: asNumber(product.reviewCount ?? product.review_count),
    stock: asNumber(product.stock),
    tags: asStringArray(product.tags),
    specs: asStringRecord(product.specs),
  };
}

function toRecommendation(output: ToolRecord): Recommendation {
  return {
    product: toProductSummary(output.product),
    reasons: asStringArray(output.reasons),
    tradeoffs: asStringArray(output.tradeoffs),
    budgetRemaining: typeof output.budgetRemaining === "number" ? output.budgetRemaining : null,
    overBudgetBy: typeof output.overBudgetBy === "number" ? output.overBudgetBy : null,
  };
}

function toComparisonOutput(output: ToolRecord): CompareOutput {
  return {
    products: asRecords(output.products).map(toProductSummary),
    rows: asRecords(output.rows).map((row) => ({
      label: asString(row.label),
      values: asStringArray(row.values),
      differs: Boolean(row.differs),
    })),
    highlights: asStringArray(output.highlights),
    notFound: asStringArray(output.notFound),
  };
}

function toBundle(output: ToolRecord): Bundle {
  return {
    items: asRecords(output.items).map(toProductSummary),
    total: asNumber(output.total),
    budget: typeof output.budget === "number" ? output.budget : null,
    remaining: typeof output.remaining === "number" ? output.remaining : null,
    overflow: typeof output.overflow === "number" ? output.overflow : null,
    rationale: asStringArray(output.rationale),
  };
}

function toCartAction(value: unknown): CartAction | null {
  const action = asRecord(value);
  if (
    (action.action !== "add" && action.action !== "remove" && action.action !== "update") ||
    typeof action.operation_id !== "string" ||
    typeof action.product_id !== "string" ||
    typeof action.variant_id !== "string" ||
    typeof action.quantity !== "number" ||
    typeof action.expected_price !== "number" ||
    typeof action.currency !== "string" ||
    action.requires_ui_execution !== true
  ) {
    return null;
  }
  return {
    action: action.action,
    operation_id: action.operation_id,
    product_id: action.product_id,
    variant_id: action.variant_id,
    quantity: action.quantity,
    expected_price: action.expected_price,
    currency: action.currency,
    requires_ui_execution: true,
  };
}

function GraphToolPart({ toolCallId, output }: { toolCallId: string; output: ToolRecord }) {
  const payload = asRecord(output.payload);
  const cartAction = toCartAction(output.cart_action);
  if (cartAction) {
    return <CartProposalCard toolCallId={toolCallId} action={cartAction} />;
  }
  if (payload.kind === "recommendations") {
    return <ProductResults products={asRecords(payload.products).map(toProductSummary)} />;
  }
  if (payload.kind === "comparison") {
    const products = asRecords(payload.products).map(toProductSummary);
    const rows = Object.entries(asRecord(payload.differences)).map(([label, values]) => ({
      label: label.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      values: asStringArray(values),
      differs: new Set(asStringArray(values)).size > 1,
    }));
    return <ProductComparison output={{ products, rows, highlights: [], notFound: [] }} />;
  }
  if (payload.kind === "bundle") {
    return <BundleCard output={toBundle(payload)} />;
  }
  if (payload.kind === "approval_required") {
    return <CheckoutCard toolCallId={toolCallId} ready={false} message={asString(payload.message)} />;
  }
  if (payload.kind === "commerce_rejected") {
    return (
      <div className="my-2 rounded-lg border border-destructive/40 bg-card p-4 text-sm">
        {asString(payload.message, "The canonical cart action was rejected.")}
      </div>
    );
  }
  if (payload.kind === "clarification") {
    return <div className="my-2 rounded-lg border border-border bg-card p-4 text-sm">{asString(payload.question)}</div>;
  }
  return null;
}
