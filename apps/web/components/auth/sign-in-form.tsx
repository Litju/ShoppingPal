"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInEmail, signInWithGoogle } from "@/lib/auth/client";
import { mergeGuestCartAction } from "@/lib/actions/cart";

export function SignInForm() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [googleEnabled, setGoogleEnabled] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => setGoogleEnabled(Boolean(cfg.googleEnabled)))
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signInEmail(email, password);
      if (!result.ok) {
        setError(result.error ?? "Could not sign in.");
        return;
      }
      // Bring the guest cart along.
      await mergeGuestCartAction();
      toast.success("Welcome back!");
      router.push("/account");
      router.refresh();
    } catch {
      setError("Sign-in is unavailable right now. Configure the commerce service to enable accounts.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" data-testid="sign-in-form">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <Button type="submit" className="w-full" size="lg" disabled={busy}>
        Sign in
      </Button>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={!googleEnabled}
        title={googleEnabled ? undefined : "Google sign-in is not configured"}
        onClick={() => {
          if (!googleEnabled) return;
          void signInWithGoogle("/account").then((r) => {
            if (r.ok && r.url) window.location.href = r.url;
            else toast.error(r.error ?? "Google sign-in isn't configured.");
          });
        }}
      >
        Continue with Google
      </Button>
      {!googleEnabled && (
        <p className="text-center text-[11px] text-muted-foreground">
          Google sign-in activates when OAuth credentials are configured.
        </p>
      )}

      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link href="/sign-up" className="font-medium text-primary hover:underline focus-ring">
          Create an account
        </Link>
      </p>
    </form>
  );
}
