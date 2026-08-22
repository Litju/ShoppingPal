import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getCheckoutService } from "@/lib/checkout";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Order details" };
export const dynamic = "force-dynamic";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const checkout = await getCheckoutService();
  if (!checkout) notFound();
  const record = await checkout.getOrder(id);
  if (!record) notFound();
  const { order, items } = record;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 lg:px-6">
      <p
        className={
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide " +
          (order.status === "paid"
            ? "bg-success/15 text-success"
            : "bg-secondary text-muted-foreground")
        }
      >
        {order.status === "paid" ? "Paid" : order.status}
        {order.mode === "demo" && " · demo"}
      </p>
      <h1 className="mt-3 text-2xl font-bold tracking-tight">
        Order #{order.id.slice(0, 8).toUpperCase()}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Placed {new Date(order.createdAt).toLocaleString("en-US")}
      </p>

      <ul role="list" className="mt-8 divide-y divide-border rounded-lg border border-border bg-card">
        {items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-4 p-4 text-sm">
            <div className="min-w-0">
              <Link href={`/products/${item.slugSnapshot}`} className="font-medium hover:underline focus-ring">
                {item.titleSnapshot}
              </Link>
              <p className="text-xs text-muted-foreground">
                {item.brandSnapshot} · qty {item.quantity} × {formatMoney(item.unitPrice)}
              </p>
            </div>
            <span className="font-semibold tabular-nums">{formatMoney(item.lineTotal)}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-4 space-y-1.5 rounded-lg border border-border bg-card p-5 text-sm">
        <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatMoney(order.subtotal)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Shipping</dt><dd>{formatMoney(order.shipping)}</dd></div>
        <div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd>{formatMoney(order.tax)}</dd></div>
        <div className="flex justify-between border-t border-border pt-2 font-bold"><dt>Total</dt><dd>{formatMoney(order.total)}</dd></div>
      </dl>
    </div>
  );
}
