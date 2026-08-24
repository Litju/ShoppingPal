"use client";

import * as React from "react";
import { CardElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

import {
  completeCheckoutAction,
  startCheckoutAction,
  type CheckoutInput,
} from "@/lib/actions/checkout";
import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@shoppingpal/contracts";

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PK?.startsWith("pk_test_")
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK)
  : null;
const inputClass =
  "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary";

const initialDetails: CheckoutInput = {
  email: "",
  firstName: "",
  lastName: "",
  address1: "",
  city: "",
  postalCode: "",
  countryCode: "US",
  province: "",
  phone: "",
};

export function CheckoutForm() {
  const { cart, ready } = useCart();
  const [details, setDetails] = React.useState<CheckoutInput>(initialDetails);
  const [clientSecret, setClientSecret] = React.useState<string>();
  const [error, setError] = React.useState<string>();
  const [starting, setStarting] = React.useState(false);

  const update = (field: keyof CheckoutInput) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setDetails((current) => ({ ...current, [field]: event.target.value }));
  };

  async function beginPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setStarting(true);
    const result = await startCheckoutAction(details);
    if (result.ok) setClientSecret(result.clientSecret);
    else setError(result.error);
    setStarting(false);
  }

  if (!ready) return <p className="text-sm text-muted-foreground">Loading your cart…</p>;
  if (cart.lines.length === 0) return <p className="text-sm text-muted-foreground">Your cart is empty.</p>;
  if (!stripePromise) {
    return <p className="rounded-lg border border-warning/40 bg-card p-4 text-sm">Stripe checkout is not configured.</p>;
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-6">
        {!clientSecret ? (
          <form onSubmit={beginPayment} className="space-y-5 rounded-lg border border-border bg-card p-5">
            <h2 className="font-semibold">Shipping details</h2>
            <p className="text-xs text-muted-foreground">Demo store — test payments only.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span>Email</span>
                <input required type="email" value={details.email} onChange={update("email")} className={inputClass} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Phone (optional)</span>
                <input type="tel" value={details.phone} onChange={update("phone")} className={inputClass} />
              </label>
              <label className="space-y-1 text-sm">
                <span>First name</span>
                <input required value={details.firstName} onChange={update("firstName")} className={inputClass} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Last name</span>
                <input required value={details.lastName} onChange={update("lastName")} className={inputClass} />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2">
                <span>Address</span>
                <input required value={details.address1} onChange={update("address1")} className={inputClass} />
              </label>
              <label className="space-y-1 text-sm">
                <span>City</span>
                <input required value={details.city} onChange={update("city")} className={inputClass} />
              </label>
              <label className="space-y-1 text-sm">
                <span>State / province (optional)</span>
                <input value={details.province} onChange={update("province")} className={inputClass} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Postal code</span>
                <input required value={details.postalCode} onChange={update("postalCode")} className={inputClass} />
              </label>
              <label className="space-y-1 text-sm">
                <span>Country code</span>
                <input
                  required
                  maxLength={2}
                  value={details.countryCode}
                  onChange={update("countryCode")}
                  className={`${inputClass} uppercase`}
                />
              </label>
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" disabled={starting}>
              {starting ? "Preparing payment…" : "Continue to payment"}
            </Button>
          </form>
        ) : (
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <StripePaymentForm clientSecret={clientSecret} details={details} />
          </Elements>
        )}
      </section>

      <aside className="h-fit rounded-lg border border-border bg-card p-5">
        <h2 className="font-semibold">Order summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between"><dt>Items</dt><dd>{cart.itemCount}</dd></div>
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(cart.subtotal, cart.currency)}</dd></div>
          <div className="flex justify-between"><dt>Shipping</dt><dd>{formatMoney(cart.shipping, cart.currency)}</dd></div>
          <div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(cart.tax, cart.currency)}</dd></div>
          <div className="flex justify-between border-t border-border pt-3 font-semibold"><dt>Total</dt><dd>{formatMoney(cart.total, cart.currency)}</dd></div>
        </dl>
      </aside>
    </div>
  );
}

function StripePaymentForm({ clientSecret, details }: { clientSecret: string; details: CheckoutInput }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = React.useState<string>();
  const [pending, setPending] = React.useState(false);

  async function pay(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;
    const card = elements.getElement(CardElement);
    if (!card) return;
    setError(undefined);
    setPending(true);
    const payment = await stripe.confirmCardPayment(clientSecret, {
      payment_method: {
        card,
        billing_details: {
          name: `${details.firstName} ${details.lastName}`,
          email: details.email,
          phone: details.phone || undefined,
          address: {
            city: details.city,
            country: details.countryCode,
            line1: details.address1,
            postal_code: details.postalCode,
            state: details.province || undefined,
          },
        },
      },
    });
    if (payment.error || payment.paymentIntent?.status !== "succeeded") {
      setError(payment.error?.message ?? "Stripe did not authorize this payment.");
      setPending(false);
      return;
    }
    const completed = await completeCheckoutAction();
    if (!completed.ok) {
      setError(completed.error);
      setPending(false);
      return;
    }
    window.location.assign(`/checkout/success?order=${encodeURIComponent(completed.orderId)}`);
  }

  return (
    <form onSubmit={pay} className="space-y-5 rounded-lg border border-border bg-card p-5">
      <h2 className="font-semibold">Payment</h2>
      <div className="rounded-md border border-border p-3"><CardElement options={{ hidePostalCode: true }} /></div>
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      <Button type="submit" disabled={pending || !stripe || !elements}>
        {pending ? "Processing payment…" : "Pay now"}
      </Button>
      <p className="text-xs text-muted-foreground">Use Stripe test mode credentials during qualification.</p>
    </form>
  );
}
