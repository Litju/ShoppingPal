import { ProductCardSkeleton } from "@/components/commerce/product-card";

export default function ProductsLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="mt-6 grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="hidden space-y-4 lg:block">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-full animate-pulse rounded bg-muted" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
