import { NextResponse } from "next/server";

import { medusaEnabled } from "@/lib/commerce/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public capability flags so the UI can degrade gracefully. */
export async function GET() {
  const authEnabled = medusaEnabled();
  return NextResponse.json({
    authEnabled,
    googleEnabled: false,
    checkoutEnabled: false,
  });
}
