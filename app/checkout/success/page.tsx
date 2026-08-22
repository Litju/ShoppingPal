import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { getCheckoutService } from "@/lib/checkout";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Order confirmed" };
export const dynamic = "force-dynamic";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string; session_id?: string }>;
}) {
  const { order: orderId, session_id: sessionId } = await searchParams;
  const checkout = await getCheckoutService();

  let status: "paid" | "pending" | "missing" = "missing";
  if (checkout && orderId) {
    if (sessionId) {
      status = await checkout.verifyStripeReturn(orderId, sessionId);
    } else {
      const record = await checkout.getOrder(orderId);
      status = record?.order.status === "paid" ? "paid" : "pending";
    }
  }

  if (status === "missing") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Receipt unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn&apos;t find that order. If you just paid, check your orders page in a moment.
        </p>
        <Button asChild className="mt-6">
          <Link href="/products">Back to shopping</Link>
        </Button>
      </div>
    );
  }

  const record = checkout && orderId ? await checkout.getOrder(orderId) : null;
  const paid = status === "paid";

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center" data-testid="checkout-success">
      <span
        aria-hidden="true"
        className={
          "mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl " +
          (paid ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground")
        }
      >
        {paid ? "✓" : "…"}
      </span>
      <h1 className="mt-4 text-2xl font-bold tracking-tight" data-testid="success-heading">
        {paid ? "Order confirmed" : "Payment processing"}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {paid
          ? `Thanks! Order #${orderId?.slice(0, 8).toUpperCase()} is confirmed${record ? ` — ${formatMoney(record.order.total, record.order.currency)}` : ""}.`
          : "Your payment is still settling. Refresh this page or check your orders shortly."}
      </p>

      <div className="mt-6 flex justify-center gap-3">
        {orderId && (
          <Button asChild variant="outline">
            <Link href={`/orders/${orderId}`}>View receipt</Link>
          </Button>
        )}
        <Button asChild>
          <Link href="/products">Keep shopping</Link>
        </Button>
      </div>
    </div>
  );
}
