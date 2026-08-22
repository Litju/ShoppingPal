import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unavailable() {
  return Response.json(
    {
      error: "auth_unavailable",
      message:
        "Authentication needs a Postgres DATABASE_URL. The store works without it in demo mode.",
    },
    { status: 503 },
  );
}

export async function GET(request: Request) {
  const auth = await getAuth();
  if (!auth) return unavailable();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return toNextJsHandler(auth as any).GET(request);
}

export async function POST(request: Request) {
  const auth = await getAuth();
  if (!auth) return unavailable();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return toNextJsHandler(auth as any).POST(request);
}
