"use client";

import * as React from "react";
import Link from "next/link";
import { Heart } from "lucide-react";

import { ProductCard } from "@/components/commerce/product-card";
import {
  getSavedProductsAction,
} from "@/lib/actions/saved";
import { readGuestSaved } from "@/components/commerce/save-button";
import { useSessionUser } from "@/lib/auth/client";

export function SavedList() {
  const session = useSessionUser();
  const user = session.user ?? null;
  const [products, setProducts] = React.useState<
    Awaited<ReturnType<typeof getSavedProductsAction>> | null
  >(null);

  React.useEffect(() => {
    if (session.pending) return;
    let cancelled = false;
    getSavedProductsAction(readGuestSaved()).then((items) => {
      if (!cancelled) setProducts(items);
    });
    return () => {
      cancelled = true;
    };
  }, [session.pending, user]);

  if (products === null) {
    return (
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
        <Heart aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-3 font-semibold">Nothing saved yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Tap the heart on any product to keep it here.
          {!user && " Guest saves live in this browser; sign in to sync them."}
        </p>
        <Link
          href="/products"
          className="mt-5 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-ring"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-testid="saved-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

