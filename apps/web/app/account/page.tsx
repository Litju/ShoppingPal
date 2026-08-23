import Link from "next/link";
import type { Metadata } from "next";

import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getSessionUser();

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Account</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Sign in to sync your cart, saved items and Shopping Pal
          conversations. Local development can use embedded app state; production
          uses the configured database and commerce service.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild variant="outline">
            <Link href="/sign-up">Create account</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Your account</h1>
      <div className="mt-6 rounded-lg border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="mt-1 text-lg font-semibold">{user.name}</p>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <nav aria-label="Account sections" className="mt-6 grid gap-3 sm:grid-cols-2">
        <Link
          href="/orders"
          className="focus-ring rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40"
        >
          <p className="font-semibold">Orders</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Track purchases and re-open receipts.
          </p>
        </Link>
        <Link
          href="/saved"
          className="focus-ring rounded-lg border border-border bg-card p-5 transition-colors hover:border-primary/40"
        >
          <p className="font-semibold">Saved items</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Your synced shortlist across devices.
          </p>
        </Link>
      </nav>
    </div>
  );
}
