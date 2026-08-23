"use server";

/**
 * Checkout is intentionally a canonical Medusa boundary. Until a Medusa
 * payment provider is configured, the storefront reports degraded checkout
 * instead of creating a local order or simulating payment.
 */
export async function startCheckoutAction(): Promise<
  { ok: false; error: string }
> {
  return {
    ok: false,
    error: "Checkout isn't available right now; payment setup is required.",
  };
}
