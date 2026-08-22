"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app-error]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-bold tracking-tight">Something broke on our side</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        The storefront and your cart are safe. Try again, or browse while we shake it off.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-ring"
        >
          Try again
        </button>
        <a
          href="/products"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent focus-ring"
        >
          Browse products
        </a>
      </div>
    </div>
  );
}
