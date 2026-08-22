"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Heart, LogOut, Menu, Search, User } from "lucide-react";

import { CartButton } from "@/components/commerce/cart-button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { signOutUser, useSessionUser } from "@/lib/auth/client";

interface CategoryInfo {
  slug: string;
  label: string;
}

const NAV_CATEGORIES: CategoryInfo[] = [
  { slug: "computers", label: "Computers" },
  { slug: "computer-accessories", label: "Accessories" },
  { slug: "audio", label: "Audio" },
  { slug: "phones-accessories", label: "Phones" },
  { slug: "fitness", label: "Fitness" },
  { slug: "home", label: "Home" },
  { slug: "kitchen", label: "Kitchen" },
  { slug: "outdoors", label: "Outdoors" },
  { slug: "everyday-carry", label: "Everyday Carry" },
];

export function SiteHeader({ categories }: { categories?: CategoryInfo[] }) {
  const cats = categories ?? NAV_CATEGORIES;
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = React.useState("");
  const session = useSessionUser();
  const user = session.user;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    router.push(query ? `/products?q=${encodeURIComponent(query)}` : "/products");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:px-6">
        <Link href="/" className="focus-ring flex shrink-0 items-center gap-2" aria-label="Shopping Pal home">
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 7V6a6 6 0 0 1 12 0v1" />
              <path d="M4 7h16l-1.2 13a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8L4 7z" />
              <path d="M9 12l3 3 3-5" />
            </svg>
          </span>
          <span className="hidden text-base font-bold tracking-tight sm:inline">
            Shopping Pal
          </span>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger
            className="focus-ring hidden h-9 items-center gap-1 rounded-md px-2.5 text-sm font-medium hover:bg-accent md:inline-flex"
            aria-label="Browse categories"
          >
            Categories <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {cats.map((c) => (
              <DropdownMenuItem key={c.slug} asChild>
                <Link href={`/products?category=${c.slug}`}>{c.label}</Link>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/products">All products</Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <form onSubmit={submitSearch} role="search" className="relative min-w-0 flex-1 max-w-xl">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search products or ask your pal…"
            aria-label="Search products"
            className="pl-9 pr-16"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
            Enter
          </kbd>
        </form>

        <nav aria-label="Account and cart" className="ml-auto flex items-center gap-2">
          <Link
            href="/saved"
            data-testid="saved-link"
            className="focus-ring hidden h-9 items-center gap-2 rounded-md border border-input bg-card px-3 text-sm font-medium hover:bg-accent sm:inline-flex"
          >
            <Heart className="h-4 w-4" />
            Saved
          </Link>

          <CartButton />

          <DropdownMenu>
            <DropdownMenuTrigger
              data-testid="account-trigger"
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-card px-2.5 text-sm font-medium hover:bg-accent"
              aria-label={user ? `Account menu for ${user.name}` : "Sign in menu"}
            >
              <User className="h-4 w-4" />
              <span className="hidden max-w-24 truncate md:inline">
                {user ? user.name.split(" ")[0] : "Sign in"}
              </span>
              {!session.pending && !user && (
                <Badge variant="secondary" className="hidden lg:inline-flex">Guest</Badge>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {user ? (
                <>
                  <DropdownMenuLabel>{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account"><User /> Account</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/orders">Orders</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() =>
                      void signOutUser().then(() => router.refresh())
                    }
                  >
                    <LogOut /> Sign out
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/sign-in">Sign in</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/sign-up">Create account</Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>

      {/* Mobile category strip */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-t border-border px-4 py-2 md:hidden">
        {cats.slice(0, 6).map((c) => (
          <Link
            key={c.slug}
            href={`/products?category=${c.slug}`}
            className="whitespace-nowrap rounded-full border border-border bg-card px-3 py-1 text-xs font-medium hover:bg-accent focus-ring"
          >
            {c.label}
          </Link>
        ))}
      </div>
    </header>
  );
}



