import type { Metadata } from "next";

import { SavedList } from "@/components/commerce/saved-list";

export const metadata: Metadata = {
  title: "Saved items",
};

export default function SavedPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <h1 className="text-2xl font-bold tracking-tight">Saved items</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your shortlist across the catalog.
      </p>
      <div className="mt-6">
        <SavedList />
      </div>
    </div>
  );
}
