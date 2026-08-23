import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Checkout is owned by Medusa; no local order/payment authority remains. */
export async function POST() {
  return NextResponse.json(
    { error: "Checkout isn't available right now; payment setup is required." },
    { status: 503 },
  );
}
