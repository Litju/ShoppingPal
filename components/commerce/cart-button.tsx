"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { QuantityStepper } from "@/components/commerce/quantity-stepper";
import { useCart } from "@/components/providers/cart-provider";
import { startCheckoutAction } from "@/lib/actions/checkout";
import { formatMoney } from "@/lib/money";
import { Loader2, ShoppingCart } from "lucide-react";

function CartLines() {
  const { cart } = useCart();
  if (cart.lines.length === 0) {
    return (
      <div className="px-4 py-12 text-center text-sm text-muted-foreground">
        Your cart is empty.
        <p className="mt-1 text-xs">Find something good — your pal can help.</p>
      </div>
    );
  }
  return (
    <ul role="list" className="divide-y divide-border px-4">
      {cart.lines.map((line) => (
        <li key={line.productId} className="flex items-center gap-3 py-3">
          <Link href={`/products/${line.slug}`} className="focus-ring min-w-0 flex-1">
            <span className="block truncate text-sm font-medium hover:underline">{line.title}</span>
            <span className="text-xs text-muted-foreground">{formatMoney(line.unitPrice, line.currency)} each</span>
          </Link>
          <QuantityStepper productId={line.productId} quantity={line.quantity} stock={line.stock} />
          <span className="w-20 text-right text-sm font-semibold tabular-nums">
            {formatMoney(line.lineTotal, line.currency)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function CartButton() {
  const { cart } = useCart();
  const [starting, setStarting] = React.useState(false);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          data-testid="cart-button"
          aria-label={`Open cart, ${cart.itemCount} item${cart.itemCount === 1 ? "" : "s"}`}
          className="focus-ring relative inline-flex h-9 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-accent"
        >
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden sm:inline">Cart</span>
          {cart.itemCount > 0 && (
            <span
              data-testid="cart-count"
              className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
            >
              {cart.itemCount}
            </span>
          )}
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Your cart</SheetTitle>
          <SheetDescription>Prices and totals verified server-side.</SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <CartLines />
        </div>

        <div className="border-t border-border p-4">
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal</dt>
              <dd>{formatMoney(cart.subtotal, cart.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd>{cart.shipping === 0 ? "Free" : formatMoney(cart.shipping, cart.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tax</dt>
              <dd>{formatMoney(cart.tax, cart.currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <dt>Total</dt>
              <dd data-testid="cart-total">{formatMoney(cart.total, cart.currency)}</dd>
            </div>
          </dl>
          <Button
            size="lg"
            className="mt-4 w-full"
            disabled={cart.lines.length === 0 || starting}
            onClick={async () => {
              setStarting(true);
              const result = await startCheckoutAction();
              if (!result.ok) {
                alert(result.error);
                setStarting(false);
                return;
              }
              window.location.href = result.url;
            }}
          >
            {starting && <Loader2 className="animate-spin" />}
            Checkout
          </Button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Free shipping over $75 · Secure checkout via Stripe
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
