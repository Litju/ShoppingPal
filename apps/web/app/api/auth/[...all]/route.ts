import { NextResponse } from "next/server";

import {
  getSessionUser,
  medusaAuthAction,
  MEDUSA_CUSTOMER_COOKIE,
} from "@/lib/auth/server";
import { medusaEnabled } from "@/lib/commerce/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() {
  return Response.json(
    {
      error: "auth_unavailable",
      message: "Authentication needs a configured commerce backend.",
    },
    { status: 503 },
  );
}

function medusaAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("(401)")) return "Invalid email or password.";
  if (message.includes("(409)")) return "An account with that email already exists.";
  return "Could not complete authentication.";
}

export async function GET(request: Request) {
  if (!medusaEnabled()) return unavailable();
  const path = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
  if (path === "get-session") {
    const user = await getSessionUser();
    return NextResponse.json(user ? { user } : null);
  }
  return NextResponse.json({ error: "unsupported_auth_action" }, { status: 404 });
}

export async function POST(request: Request) {
  if (!medusaEnabled()) return unavailable();
  const path = new URL(request.url).pathname.replace(/^\/api\/auth\//, "");
  if (path === "sign-out") {
    const response = NextResponse.json({});
    response.cookies.delete(MEDUSA_CUSTOMER_COOKIE);
    response.cookies.delete("sp_guest");
    return response;
  }
  if (path === "sign-in/email" || path === "sign-up/email") {
    try {
      const body = (await request.json()) as {
        name?: string;
        email?: string;
        password?: string;
      };
      if (!body.email || !body.password) {
        return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
      }
      const result = await medusaAuthAction(path, {
        name: body.name,
        email: body.email,
        password: body.password,
      });
      const response = NextResponse.json({ user: result.user });
      response.cookies.set(MEDUSA_CUSTOMER_COOKIE, result.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return response;
    } catch (error) {
      return NextResponse.json({ error: medusaAuthError(error) }, { status: 400 });
    }
  }
  return NextResponse.json({ error: "unsupported_auth_action" }, { status: 404 });
}
