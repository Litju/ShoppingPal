import type { Metadata } from "next";

import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-center text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Your guest cart merges automatically when you sign in.
      </p>
      <div className="mt-8">
        <SignInForm />
      </div>
    </div>
  );
}
