import type { Metadata } from "next";

import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-center text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Keep your cart, saves and conversations across devices.
      </p>
      <div className="mt-8">
        <SignUpForm />
      </div>
    </div>
  );
}
