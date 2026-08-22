import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 lg:px-6" aria-busy="true">
      <div className="mx-auto h-10 w-80 max-w-full animate-pulse rounded-lg bg-muted" />
      <div className="mx-auto mt-3 h-4 w-96 max-w-full animate-pulse rounded bg-muted" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
      <span className="sr-only">
        Loading. <Link href="/">Shopping Pal</Link>
      </span>
      <span className={cn("hidden")} />
    </div>
  );
}
