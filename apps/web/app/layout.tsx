import type { Metadata } from "next";

import { AssistantShell } from "@/components/chat/assistant-shell";
import { Providers } from "@/components/providers/providers";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getCatalogProvider } from "@/lib/catalog";
import { getCartAction } from "@/lib/actions/cart";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Shopping Pal — your pal for finding the right thing to buy",
    template: "%s · Shopping Pal",
  },
  description:
    "Shop a real catalog with an AI-native shopping companion. Describe what you need, get grounded recommendations, comparisons and bundles — then check out.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  let categories: Array<{ slug: string; label: string }> = [];
  try {
    const catalog = await getCatalogProvider();
    const rows = await catalog.categories();
    categories = rows.map((r) => ({ slug: r.slug, label: r.label }));
  } catch {
    // Header falls back to static labels.
  }

  const initialCart = await getCartAction().catch(() => undefined);

  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <Providers initialCart={initialCart}>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
          >
            Skip to content
          </a>
          <SiteHeader categories={categories} />
          <AssistantShell>{children}</AssistantShell>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
