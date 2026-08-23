import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Checkout status" };

/** A truthful fallback until Medusa payment completion is enabled. */
export default function CheckoutSuccessPage() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Checkout status unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Order status is reported by Medusa after a payment provider is configured.
        This page never marks an order paid locally.
      </p>
      <Button asChild className="mt-6">
        <Link href="/products">Back to shopping</Link>
      </Button>
    </div>
  );
}
