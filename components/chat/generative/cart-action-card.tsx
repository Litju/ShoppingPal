"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";

import { useSyncCartOnChange } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";
import type { CartPayload } from "@/lib/ai/schemas";
import { formatMoney } from "@/lib/money";

/** Communicates cart mutations that Shopping Pal performed. */
export function CartActionCard({
  toolCallId,
  ok,
  message,
  cart,
  action,
}: {
  toolCallId: string;
  ok: boolean;
  message: string;
  cart: CartPayload | null;
  action: "add" | "update" | "remove";
}) {
  // Resync global cart UI with the mutation Shopping Pal made server-side.
  useSyncCartOnChange(toolCallId);

  const itemCount = cart?.itemCount ?? null;
  return (
    <div
      className={
        "my-2 flex items-start gap-3 rounded-lg border bg-card p-4 " +
        (ok ? "border-border" : "border-destructive/40")
      }
    >
      <span
        aria-hidden="true"
        className={
          "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full " +
          (ok ? "bg-primary-soft text-primary" : "bg-destructive/10 text-destructive")
        }
      >
        {ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {action === "add" ? "Added to your cart" : action === "update" ? "Cart updated" : "Removed from cart"}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">{message}</p>
        {cart && (
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              {itemCount} item{itemCount === 1 ? "" : "s"} in cart
            </span>
            <span>Subtotal {formatMoney(cart.subtotal, cart.currency)}</span>
            <Link href="/cart" className="font-medium text-primary hover:underline">
              View cart →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function SavedChip({ message }: { message: string }) {
  return (
    <div className="my-2 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
      <Check aria-hidden="true" className="h-3.5 w-3.5 text-success" />
      <span>{message}</span>
    </div>
  );
}

/** Checkout preparation — the user completes payment themselves. */
export function CheckoutCard({
  toolCallId,
  url,
  mode,
  total,
  currency,
  itemCount,
  ready,
  message,
}: {
  toolCallId: string;
  url?: string;
  mode?: "stripe" | "demo";
  total?: number;
  currency?: string;
  itemCount?: number;
  ready: boolean;
  message?: string;
}) {
  useSyncCartOnChange(toolCallId);
  if (!ready) {
    return (
      <div className="my-2 rounded-lg border border-warning/40 bg-card p-4 text-sm">
        {message ?? "Checkout isn't ready."}
      </div>
    );
  }
  return (
    <div className="my-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Order prepared</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {itemCount} item{itemCount === 1 ? "" : "s"}
            {total !== undefined && ` · ${formatMoney(total, currency)}`}
          </p>
        </div>
        {mode === "demo" ? (
          <span className="rounded-full border border-warning/50 bg-warning/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-warning">
            Demo checkout
          </span>
        ) : (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Stripe
          </span>
        )}
      </div>
      <Button asChild className="mt-3 w-full" size="lg">
        <a href={url ?? "#"}>Complete checkout</a>
      </Button>
      <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
        I never place orders on my own — payment is always completed by you.
      </p>
    </div>
  );
}
