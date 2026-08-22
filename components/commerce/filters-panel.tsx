"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategorySlug } from "@/lib/catalog/types";

export function FiltersPanel({
  categories,
}: {
  categories: Array<{ slug: CategorySlug; label: string; count: number }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedCategories = React.useMemo(
    () => searchParams.getAll("category"),
    [searchParams],
  );
  const selectedBrands = React.useMemo(
    () => searchParams.getAll("brand"),
    [searchParams],
  );

  const updateParam = React.useCallback(
    (key: string, value: string | null, { resetPage = true } = {}) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
      if (resetPage) params.delete("page");
      const qs = params.toString();
      router.push(qs ? `/products?${qs}` : "/products", { scroll: false });
    },
    [router, searchParams],
  );

  const toggleMulti = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const existing = params.getAll(key);
    params.delete(key);
    if (existing.includes(value)) {
      for (const v of existing) if (v !== value) params.append(key, v);
    } else {
      for (const v of existing) params.append(key, v);
      params.append(key, value);
    }
    params.delete("page");
    const qs = params.toString();
    router.push(qs ? `/products?${qs}` : "/products", { scroll: false });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between lg:hidden">
        <h2 className="text-sm font-semibold">Filters</h2>
      </div>

      <section aria-labelledby="filter-category">
        <h3 id="filter-category" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Category
        </h3>
        <ul className="mt-2.5 space-y-2" role="list">
          {categories.map((c) => (
            <li key={c.slug}>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm focus-ring">
                <Checkbox
                  checked={selectedCategories.includes(c.slug)}
                  onCheckedChange={() => toggleMulti("category", c.slug)}
                  aria-label={`Filter by ${c.label}`}
                />
                <span>{c.label}</span>
                <span className="ml-auto text-xs text-muted-foreground">{c.count}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="filter-price">
        <h3 id="filter-price" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Price
        </h3>
        <form
          className="mt-2.5 flex items-center gap-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <Label htmlFor="min-price" className="sr-only">Minimum price</Label>
          <Input
            id="min-price"
            inputMode="decimal"
            placeholder="Min"
            defaultValue={searchParams.get("min") ?? ""}
            onBlur={(e) => updateParam("min", normalizePrice(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateParam("min", normalizePrice(e.currentTarget.value));
            }}
          />
          <span aria-hidden="true" className="text-muted-foreground">–</span>
          <Label htmlFor="max-price" className="sr-only">Maximum price</Label>
          <Input
            id="max-price"
            data-testid="max-price-input"
            inputMode="decimal"
            placeholder="Max"
            defaultValue={searchParams.get("max") ?? ""}
            onBlur={(e) => updateParam("max", normalizePrice(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") updateParam("max", normalizePrice(e.currentTarget.value));
            }}
          />
        </form>
      </section>

      <section aria-labelledby="filter-rating">
        <h3 id="filter-rating" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Rating
        </h3>
        <div className="mt-2.5 space-y-1">
          {[45, 40].map((tenths) => (
            <button
              key={tenths}
              type="button"
              onClick={() =>
                updateParam(
                  "rating",
                  searchParams.get("rating") === String(tenths) ? null : String(tenths),
                )
              }
              aria-pressed={searchParams.get("rating") === String(tenths)}
              className={
                "focus-ring w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent " +
                (searchParams.get("rating") === String(tenths) ? "bg-primary-soft font-medium" : "")
              }
            >
              {(tenths / 10).toFixed(1)}★ &amp; up
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="filter-stock">
        <h3 id="filter-stock" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Availability
        </h3>
        <label className="mt-2.5 flex cursor-pointer items-center gap-2.5 text-sm focus-ring">
          <Checkbox
            checked={searchParams.get("stock") === "in"}
            onCheckedChange={() =>
              updateParam("stock", searchParams.get("stock") === "in" ? null : "in")
            }
            aria-label="In stock only"
          />
          In stock only
        </label>
      </section>

      {(selectedCategories.length > 0 ||
        selectedBrands.length > 0 ||
        searchParams.get("min") ||
        searchParams.get("max") ||
        searchParams.get("rating") ||
        searchParams.get("stock")) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/products", { scroll: false })}
        >
          <X /> Clear all filters
        </Button>
      )}
    </div>
  );
}

function normalizePrice(input: string): string | null {
  const cleaned = input.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return cleaned;
}

export function SortSelect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "popular";
  return (
    <Select
      value={current}
      onValueChange={(v) => {
        const params = new URLSearchParams(searchParams.toString());
        if (v === "popular") params.delete("sort");
        else params.set("sort", v);
        params.delete("page");
        const qs = params.toString();
        router.push(qs ? `/products?${qs}` : "/products", { scroll: false });
      }}
    >
      <SelectTrigger className="w-[170px]" aria-label="Sort products">
        <SelectValue placeholder="Sort" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="popular">Most popular</SelectItem>
        <SelectItem value="price-asc">Price: low to high</SelectItem>
        <SelectItem value="price-desc">Price: high to low</SelectItem>
        <SelectItem value="rating">Highest rated</SelectItem>
      </SelectContent>
    </Select>
  );
}

export function ActiveFilterBadges() {
  const searchParams = useSearchParams();
  const entries: Array<{ key: string; value: string; label: string }> = [];
  for (const [key, value] of searchParams.entries()) {
    if (["category", "brand", "tag"].includes(key)) {
      entries.push({ key, value, label: `${key}: ${value}` });
    } else if (key === "min") {
      entries.push({ key, value, label: `min $${value}` });
    } else if (key === "max") {
      entries.push({ key, value, label: `max $${value}` });
    }
  }
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {entries.map((e) => (
        <Badge key={`${e.key}-${e.value}`} variant="secondary">
          {e.label}
        </Badge>
      ))}
    </div>
  );
}
