"use client";

import * as React from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ProductImage } from "@/components/commerce/product-image";
import { QuantityStepper } from "@/components/commerce/quantity-stepper";
import { useCart } from "@/components/providers/cart-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { startCheckoutAction } from "@/lib/actions/checkout";
import { formatMoney } from "@shoppingpal/contracts";
import { cn } from "@/lib/utils";

export function CartView({ compact = false }: { compact?: boolean }) {
  const { cart, ready, removeItem, pendingProductId } = useCart();
  const [starting, setStarting] = React.useState(false);

  if (!ready) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (cart.lines.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
        <p className="font-semibold">Your cart is empty</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse the store or ask your pal to find something.
        </p>
        <Link href="/products" className={cn(buttonVariants(), "mt-5")}>
          Browse products
        </Link>
      </div>
    );
  }

  async function checkout() {
    setStarting(true);
    const result = await startCheckoutAction();
    if (!result.ok) {
      toast.error(result.error ?? "Could not start checkout.");
      setStarting(false);
      return;
    }
    window.location.href = result.url;
  }

  return (
    <div className={cn("grid gap-8", !compact && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
      <section aria-label="Cart items">
        <ul role="list" className="divide-y divide-border rounded-lg border border-border bg-card" data-testid="cart-lines">
          {cart.lines.map((line) => (
            <li key={line.productId} className="flex items-center gap-4 p-4" data-testid={`cart-line-${line.slug}`}>
              <Link href={`/products/${line.slug}`} className="focus-ring h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
                <ProductImage slug={line.slug} category="" title={line.title} />
              </Link>
              <div className="min-w-0 flex-1">
                <Link href={`/products/${line.slug}`} className="block truncate font-medium hover:underline focus-ring">
                  {line.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(line.unitPrice, line.currency)} each Â· {line.brand}
                  {line.stock < 15 && ` Â· only ${line.stock} left`}
                </p>
              </div>
              <QuantityStepper productId={line.productId} quantity={line.quantity} stock={line.stock} />
              <span className="w-24 text-right font-semibold tabular-nums" data-testid="line-total">
                {formatMoney(line.lineTotal, line.currency)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove ${line.title} from cart`}
                disabled={pendingProductId === line.productId}
                onClick={() => void removeItem(line.productId)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <aside aria-label="Order summary">
        <div className="rounded-lg border border-border bg-card p-5 lg:sticky lg:top-24">
          <h2 className="font-bold tracking-tight">Order summary</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Subtotal ({cart.itemCount} items)</dt>
              <dd data-testid="summary-subtotal">{formatMoney(cart.subtotal, cart.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd>{cart.shipping === 0 ? "Free" : formatMoney(cart.shipping, cart.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Estimated tax (8%)</dt>
              <dd>{formatMoney(cart.tax, cart.currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-border pt-3 text-base font-bold">
              <dt>Total</dt>
              <dd data-testid="summary-total">{formatMoney(cart.total, cart.currency)}</dd>
            </div>
          </dl>
          <Button size="lg" className="mt-5 w-full" onClick={() => void checkout()} disabled={starting}>
            Checkout
          </Button>
          <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
            Totals are computed server-side from catalog prices.
          </p>
        </div>
      </aside>
    </div>
  );
}
