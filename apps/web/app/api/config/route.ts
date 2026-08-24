import { NextResponse } from "next/server";

import { medusaEnabled, stripeTestModeEnabled } from "@/lib/commerce/config";
import { checkoutReceiptConfigured } from "@/lib/checkout/receipt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public capability flags so the UI can degrade gracefully. */
export async function GET() {
  const authEnabled = medusaEnabled();
  return NextResponse.json({
    authEnabled,
    googleEnabled: false,
    checkoutEnabled: authEnabled && stripeTestModeEnabled() && checkoutReceiptConfigured(),
  });
}
