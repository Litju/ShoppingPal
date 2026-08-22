import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { databaseAvailable, getDatabase } from "@/lib/db";

/** Minimal structural surface of the Better Auth instance we rely on. */
export interface PalAuth {
  api: {
    getSession(args: { headers: Headers }): Promise<{
      user: { id: string; name: string; email: string; image?: string | null };
    } | null>;
  };
  handler(request: Request): Promise<Response>;
}

/**
 * Better Auth is enabled whenever a real Postgres database is available.
 * In embedded-demo mode (no DATABASE_URL) the app degrades gracefully:
 * browse/chat/cart still work, account pages explain how to enable auth.
 */

let authPromise: Promise<PalAuth> | null = null;

export async function getAuth(): Promise<PalAuth | null> {
  if (!(await databaseAvailable())) return null;
  if (!authPromise) {
    authPromise = (async () => {
      const { db } = await getDatabase();
      const googleId = process.env.GOOGLE_CLIENT_ID?.trim();
      const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const auth: any = betterAuth({
        secret:
          process.env.BETTER_AUTH_SECRET?.trim() ||
          "shopping-pal-demo-secret-not-for-production-use",
        trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
        database: drizzleAdapter(db as never, {
          provider: "pg",
          schema: {
            user: (await import("@/db/schema")).user,
            session: (await import("@/db/schema")).session,
            account: (await import("@/db/schema")).account,
            verification: (await import("@/db/schema")).verification,
          },
        }),
        emailAndPassword: { enabled: true },
        ...(googleId && googleSecret
          ? {
              socialProviders: {
                google: {
                  clientId: googleId,
                  clientSecret: googleSecret,
                },
              },
            }
          : {}),
        plugins: [nextCookies()],
      });
      return auth as PalAuth;
    })().catch((error) => {
      authPromise = null;
      throw error;
    });
  }
  return authPromise;
}

/** Current signed-in user (or null). Safe to call in any server context. */
export async function getSessionUser(): Promise<{
  id: string;
  name: string;
  email: string;
  image: string | null;
} | null> {
  const auth = await getAuth();
  if (!auth) return null;
  try {
    const { headers } = await import("next/headers");
    const result = await auth.api.getSession({
      headers: await headers(),
    });
    if (!result?.user) return null;
    return {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      image: result.user.image ?? null,
    };
  } catch {
    return null;
  }
}

export function googleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}
