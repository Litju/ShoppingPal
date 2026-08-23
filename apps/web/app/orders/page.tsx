import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Your orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sign in to see your order history.
        </p>
        <Button asChild className="mt-6">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Your orders</h1>
      <p className="mt-4 rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Order history will appear here after checkout is enabled.
      </p>
    </div>
  );
}
