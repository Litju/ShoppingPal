import { NextResponse } from "next/server";

import { databaseAvailable } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public capability flags so the UI can degrade gracefully. */
export async function GET() {
  const authEnabled = await databaseAvailable();
  return NextResponse.json({
    authEnabled,
    googleEnabled: authEnabled && Boolean(
      process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
    ),
    stripeEnabled: Boolean(process.env.STRIPE_SECRET_KEY?.trim()),
  });
}
