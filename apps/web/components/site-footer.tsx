import Link from "next/link";

import { CATEGORY_LABELS, CATEGORY_SLUGS } from "@shoppingpal/contracts";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface mt-16">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-6">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm font-bold">Shopping Pal</p>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Your pal for finding the right thing to buy. Real catalog, honest
              tradeoffs, and an assistant that can actually act on your cart.
            </p>
          </div>
          <nav aria-label="Categories">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Shop</p>
            <ul className="mt-3 space-y-1.5">
              {CATEGORY_SLUGS.slice(0, 5).map((slug) => (
                <li key={slug}>
                  <Link
                    href={`/products?category=${slug}`}
                    className="text-sm text-muted-foreground hover:text-foreground focus-ring"
                  >
                    {CATEGORY_LABELS[slug]}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <nav aria-label="More categories">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">More</p>
            <ul className="mt-3 space-y-1.5">
              {CATEGORY_SLUGS.slice(5).map((slug) => (
                <li key={slug}>
                  <Link
                    href={`/products?category=${slug}`}
                    className="text-sm text-muted-foreground hover:text-foreground focus-ring"
                  >
                    {CATEGORY_LABELS[slug]}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/products" className="text-sm font-medium hover:underline focus-ring">
                  Everything →
                </Link>
              </li>
            </ul>
          </nav>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
            <ul className="mt-3 space-y-1.5">
              <li><Link href="/account" className="text-sm text-muted-foreground hover:text-foreground focus-ring">Account</Link></li>
              <li><Link href="/orders" className="text-sm text-muted-foreground hover:text-foreground focus-ring">Orders</Link></li>
              <li><Link href="/saved" className="text-sm text-muted-foreground hover:text-foreground focus-ring">Saved items</Link></li>
              <li><Link href="/cart" className="text-sm text-muted-foreground hover:text-foreground focus-ring">Cart</Link></li>
            </ul>
          </div>
        </div>
        <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Shopping Pal. A demo storefront — every brand and product is fictional.
          Prices in USD. Checkout requires a configured Medusa payment provider.
        </p>
      </div>
    </footer>
  );
}
