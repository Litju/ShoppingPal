import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { getCheckoutService } from "@/lib/checkout";
import { completeDemoOrderAction } from "@/lib/actions/checkout";
import { formatMoney } from "@shoppingpal/contracts";

export const metadata: Metadata = { title: "Demo checkout" };
export const dynamic = "force-dynamic";

/**
 * Clearly-labeled simulated payment page used when Stripe credentials are
 * absent. Nothing here touches real money.
 */
export default async function DemoCheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const checkout = await getCheckoutService();
  if (!checkout) notFound();
  const record = await checkout.getOrder(orderId);
  if (!record || record.order.mode !== "demo") notFound();
  const { order, items } = record;

  if (order.status === "paid") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Already paid</h1>
        <Button asChild className="mt-6">
          <Link href={`/checkout/success?order=${orderId}`}>View receipt</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-lg border border-warning/50 bg-warning/10 p-4 text-center text-sm font-medium text-warning">
        DEMO CHECKOUT — no real payment is processed
      </div>

      <div className="mt-6 rounded-lg border border-border bg-card">
        <ul role="list" className="divide-y divide-border p-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
              <span className="min-w-0 truncate">
                {item.quantity} × {item.titleSnapshot}
              </span>
              <span className="tabular-nums">{formatMoney(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1 border-t border-border p-4 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatMoney(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{formatMoney(order.shipping)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd>{formatMoney(order.tax)}</dd></div>
          <div className="flex justify-between border-t border-border pt-2 font-bold"><dt>Total</dt><dd data-testid="demo-total">{formatMoney(order.total)}</dd></div>
        </dl>
      </div>

      <form action={completeDemoOrderAction} className="mt-6">
        <input type="hidden" name="orderId" value={orderId} />
        <Button type="submit" size="lg" className="w-full" data-testid="complete-demo-order">
          Complete demo purchase
        </Button>
      </form>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Add STRIPE_SECRET_KEY (test mode) to switch to real hosted checkout.
      </p>
    </div>
  );
}
