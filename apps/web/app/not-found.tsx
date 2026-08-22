import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wide text-primary">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">We looked everywhere</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        That page or product doesn&apos;t exist — but your pal can find something close.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/products" className={cn(buttonVariants({ variant: "outline" }))}>
          Browse products
        </Link>
        <Link href="/" className={cn(buttonVariants())}>
          Home
        </Link>
      </div>
    </div>
  );
}
