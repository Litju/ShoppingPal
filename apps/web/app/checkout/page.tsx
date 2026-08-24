import Link from "next/link";

import { CheckoutForm } from "@/components/commerce/checkout-form";

export default function CheckoutPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Shopping Pal</p>
          <h1 className="text-3xl font-bold tracking-tight">Checkout</h1>
        </div>
        <Link href="/cart" className="text-sm font-medium text-primary hover:underline">
          Back to cart
        </Link>
      </div>
      <CheckoutForm />
    </main>
  );
}
