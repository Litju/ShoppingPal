"use client";

import * as React from "react";

/**
 * Lightweight session bindings over the stable ShoppingPal auth endpoints.
 * The server route selects Medusa Auth and keeps the UI contract stable.
 */

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

interface SessionState {
  user: SessionUser | null;
  pending: boolean;
}

const SESSION_LISTENERS = new Set<() => void>();
let cachedSession: SessionState | null = null;

function notify() {
  for (const listener of SESSION_LISTENERS) listener();
}

async function refreshSessionCache(): Promise<void> {
  try {
    const res = await fetch("/api/auth/get-session", { credentials: "include" });
    const data = res.ok ? ((await res.json()) as { user?: SessionUser } | null) : null;
    cachedSession = { user: data?.user ?? null, pending: false };
  } catch {
    cachedSession = { user: null, pending: false };
  }
  notify();
}

if (typeof window !== "undefined") {
  void refreshSessionCache();
}

export function useSessionUser(): SessionState {
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const listener = () => force();
    SESSION_LISTENERS.add(listener);
    return () => {
      SESSION_LISTENERS.delete(listener);
    };
  }, []);
  return cachedSession ?? { user: null, pending: true };
}

/** POST helper against the canonical auth bridge with a consistent error shape. */
async function authPost<T>(path: string, body: unknown): Promise<{ ok: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(`/api/auth/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return { ok: false, error: String(json.message ?? json.error ?? `Request failed (${res.status})`) };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, error: "Network error." };
  }
}

export async function signInEmail(email: string, password: string) {
  const result = await authPost<{ user?: SessionUser }>("sign-in/email", { email, password });
  await refreshSessionCache();
  return result;
}

export async function signUpEmail(name: string, email: string, password: string) {
  const result = await authPost<{ user?: SessionUser }>("sign-up/email", { name, email, password });
  await refreshSessionCache();
  return result;
}

export async function signOutUser(): Promise<void> {
  await authPost("sign-out", {});
  await refreshSessionCache();
}

export async function signInWithGoogle(callbackURL = "/account"): Promise<{ ok: boolean; url?: string; error?: string }> {
  const result = await authPost<{ url?: string; redirect?: boolean }>("sign-in/social", {
    provider: "google",
    callbackURL,
  });
  if (!result.ok) return result;
  // Providers may return the target URL without redirecting inline.
  return { ok: true, url: result.data?.url };
}
