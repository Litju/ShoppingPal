"use client";

import * as React from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";

import { useSyncCartOnChange } from "@/components/providers/cart-provider";
import { applyAgentCartAction } from "@/lib/actions/cart";
import type { CartPayload } from "@/lib/ai/schemas";
import { formatMoney } from "@shoppingpal/contracts";

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
              View cart -&gt;
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

/** Checkout status card. It never represents a locally-created order. */
export function CheckoutCard({
  toolCallId,
  ready,
  message,
}: {
  toolCallId: string;
  ready: boolean;
  message?: string;
}) {
  useSyncCartOnChange(toolCallId);
  return (
    <div className="my-2 rounded-lg border border-warning/40 bg-card p-4 text-sm">
      <p>{ready ? "Checkout is ready." : message ?? "Checkout isn't ready."}</p>
      {!ready && (
        <Link href="/checkout" className="mt-3 inline-block font-medium text-primary hover:underline">
          Open secure checkout →
        </Link>
      )}
    </div>
  );
}

export function CartProposalCard({
  toolCallId,
  action,
}: {
  toolCallId: string;
  action: {
    action?: "add" | "remove" | "update";
    operation_id: string;
    product_id: string;
    variant_id: string;
    quantity: number;
    expected_price: number;
    currency: string;
    requires_ui_execution: true;
  };
}) {
  const [result, setResult] = React.useState<{
    ok: boolean;
    message: string;
    cart: CartPayload | null;
  }>();

  React.useEffect(() => {
    let active = true;
    void applyAgentCartAction({
      action: action.action ?? "add",
      productId: action.product_id,
      variantId: action.variant_id,
      quantity: action.quantity,
      expectedPrice: action.expected_price,
      operationId: action.operation_id,
    }).then((next) => {
      if (active) {
        setResult({
          ok: next.ok,
          message: next.message,
          cart: next.cart as CartPayload | null,
        });
      }
    });
    return () => {
      active = false;
    };
  }, [action.action, action.expected_price, action.operation_id, action.product_id, action.quantity, action.variant_id]);

  if (!result) {
    return (
      <div className="my-2 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground" aria-live="polite">
        Applying the canonical cart action…
      </div>
    );
  }

  return (
    <CartActionCard
      toolCallId={toolCallId}
      ok={result.ok}
      message={result.message}
      cart={result.cart}
      action={action.action ?? "add"}
    />
  );
}
