import { createHmac, timingSafeEqual } from "node:crypto";

function receiptSecret(): string | null {
  const secret = process.env.CHECKOUT_RECEIPT_SECRET?.trim() || process.env.AGENT_INTERNAL_TOKEN?.trim();
  if (secret) return secret;
  return process.env.NODE_ENV === "production" ? null : "shoppingpal-development-receipt-secret";
}

function signature(orderId: string, secret: string): string {
  return createHmac("sha256", secret).update(orderId).digest("base64url");
}

export function sealCheckoutOrder(orderId: string): string | null {
  const secret = receiptSecret();
  return secret ? `${orderId}.${signature(orderId, secret)}` : null;
}

export function verifyCheckoutOrder(orderId: string | undefined, sealed: string | undefined): boolean {
  const secret = receiptSecret();
  if (!secret || !orderId || !sealed) return false;
  const separator = sealed.lastIndexOf(".");
  if (separator <= 0) return false;
  const sealedOrderId = sealed.slice(0, separator);
  const received = Buffer.from(sealed.slice(separator + 1));
  const expected = Buffer.from(signature(sealedOrderId, secret));
  return (
    sealedOrderId === orderId &&
    received.length === expected.length &&
    timingSafeEqual(received, expected)
  );
}
