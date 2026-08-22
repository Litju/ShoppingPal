import * as React from "react";
import Link from "next/link";
import { AlertCircle, Loader2 } from "lucide-react";

import {
  BundleCard,
  ProductRecommendation,
} from "@/components/chat/generative/recommendation-card";
import { CartActionCard, CheckoutCard, SavedChip } from "@/components/chat/generative/cart-action-card";
import { ProductComparison } from "@/components/chat/generative/comparison-table";
import { ProductResults, ResultsSkeleton } from "@/components/chat/generative/product-results";
import type { ShoppingPalMessage } from "@/components/chat/types";

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

        if (part.type.startsWith("tool-")) {
          const streaming =
            "state" in part &&
            (part as { state?: string }).state === "input-streaming";
          return (
            <ToolPartView
              key={key}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              part={part as any}
              streaming={streaming}
            />
          );
        }

        return null;
      })}
    </>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ToolPartView({ part, streaming }: { part: any; streaming: boolean }) {
  const toolName = String(part.type.replace(/^tool-/, ""));
  const toolCallId: string = part.toolCallId ?? `${toolName}-${Math.random()}`;

  if (streaming) {
    return <ToolSkeleton label={TOOL_LABELS[toolName] ?? "Working…"} />;
  }

  switch (toolName) {
    case "searchProducts": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.searchProducts} />;
      return <ProductResults products={part.output.products ?? []} />;
    }
    case "findAlternatives": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.findAlternatives} />;
      return (
        <ProductResults
          products={part.output.alternatives ?? []}
          emptyMessage="No cheaper alternatives worth switching for — this may already be the value pick."
        />
      );
    }
    case "recommendProduct": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.recommendProduct} />;
      return <ProductRecommendation output={part.output} />;
    }
    case "compareProducts": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.compareProducts} />;
      return <ProductComparison output={part.output} />;
    }
    case "buildBundle": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.buildBundle} />;
      return <BundleCard output={part.output} />;
    }
    case "getCart": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.getCart} />;
      const lines = part.output?.cart?.lines ?? [];
      if (lines.length === 0) {
        return (
          <div className="my-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            Your cart is empty.
          </div>
        );
      }
      const items = lines
        .map((l: { quantity: number; title: string; lineTotal: number; currency: string }) => `• ${l.quantity} × ${l.title}`)
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
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS[toolName]} />;
      return (
        <CartActionCard
          toolCallId={toolCallId}
          ok={Boolean(part.output.ok)}
          message={part.output.message}
          cart={part.output.cart}
          action={toolName === "addToCart" ? "add" : toolName === "updateCart" ? "update" : "remove"}
        />
      );
    }
    case "saveProduct": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.saveProduct} />;
      return <SavedChip message={part.output.message} />;
    }
    case "prepareCheckout": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.prepareCheckout} />;
      return (
        <CheckoutCard
          toolCallId={toolCallId}
          ready={Boolean(part.output.ready)}
          url={part.output.url}
          mode={part.output.mode}
          total={part.output.total}
          currency={part.output.currency}
          itemCount={part.output.itemCount}
          message={part.output.message}
        />
      );
    }
    case "getProduct": {
      if (part.state !== "output-available") return <ToolSkeleton label={TOOL_LABELS.getProduct} />;
      if (!part.output.product) {
        return (
          <div className="my-2 rounded-lg border border-dashed border-border bg-card p-4 text-sm text-muted-foreground">
            {part.output.message ?? "Product not found."}
          </div>
        );
      }
      return <ProductResults products={[part.output.product]} />;
    }
    default:
      return (
        <div className="my-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground">
          <AlertCircle aria-hidden="true" className="h-3.5 w-3.5" />
          Ran “{toolName}”
        </div>
      );
  }
}
