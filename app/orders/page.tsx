import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/server";
import { getCheckoutService } from "@/lib/checkout";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Your orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in to see your order history. Guest checkouts keep their receipt
          link after purchase.
        </p>
        <Button asChild className="mt-6">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  }

  const checkout = await getCheckoutService();
  const orders = (await checkout?.listOrdersForUser(user.id)) ?? [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Your orders</h1>

      {orders.length === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
          No orders yet — your future hauls will appear here.
        </p>
      ) : (
        <ul role="list" className="mt-6 space-y-3">
          {orders.map((order) => (
            <li key={order.id} className="rounded-lg border border-border bg-card p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    Order #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.createdAt).toLocaleString("en-US")}
                  </p>
                </div>
                <span className="inline-flex items-center gap-2">
                  <span className={order.status === "paid" ? "rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success" : "rounded-full bg-secondary px-2 py-0.5 text-xs font-medium"}>
                    {order.status === "paid" ? "Paid" : order.status}
                  </span>
                  <span className="font-semibold">{formatMoney(order.total, order.currency)}</span>
                </span>
              </div>
              <Link
                href={`/orders/${order.id}`}
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline focus-ring"
              >
                View details →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
