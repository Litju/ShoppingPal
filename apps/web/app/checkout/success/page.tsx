import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Order confirmed" };

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string | string[] }>;
}) {
  const params = await searchParams;
  const orderId = Array.isArray(params.order) ? params.order[0] : params.order;
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{orderId ? "Order submitted" : "Checkout status"}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {orderId
          ? "Medusa accepted the completed checkout. Your order reference is shown below."
          : "No completed order reference was provided."}
      </p>
      {orderId && <p className="mt-4 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">{orderId}</p>}
      <Button asChild className="mt-6">
        <Link href="/products">Back to shopping</Link>
      </Button>
    </div>
  );
}
