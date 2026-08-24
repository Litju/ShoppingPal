import { NextResponse } from "next/server";

import { startCheckoutAction } from "@/lib/actions/checkout";

export async function POST(request: Request) {
  try {
    const result = await startCheckoutAction(await request.json());
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid checkout request." }, { status: 400 });
  }
}
