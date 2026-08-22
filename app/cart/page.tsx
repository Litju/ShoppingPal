import type { Metadata } from "next";

import { CartView } from "@/components/commerce/cart-view";

export const metadata: Metadata = {
  title: "Your cart",
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight" data-testid="cart-heading">
          Your cart
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Items added by you or by Shopping Pal land in the same cart.
        </p>
      </header>
      <CartView />
    </div>
  );
}
