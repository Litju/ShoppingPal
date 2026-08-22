import { Star } from "lucide-react";

import { formatMoney, formatMoneyCompact, formatRating } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Price({
  minor,
  currency,
  compact = false,
  className,
}: {
  minor: number;
  currency?: string;
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("font-semibold tabular-nums", className)}>
      {(compact ? formatMoneyCompact : formatMoney)(minor, currency)}
    </span>
  );
}

export function RatingStars({
  ratingTenths,
  reviewCount,
  size = "sm",
  className,
}: {
  ratingTenths: number;
  reviewCount?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const rating = ratingTenths / 10;
  const starClass = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <span
      className={cn("inline-flex items-center gap-1 text-sm", className)}
      aria-label={`Rated ${formatRating(ratingTenths)} out of 5${reviewCount !== undefined ? `, ${reviewCount.toLocaleString("en-US")} reviews` : ""}`}
    >
      <span className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star
            key={i}
            className={cn(
              starClass,
              rating >= i - 0.25
                ? "fill-star text-star"
                : rating >= i - 0.75
                  ? "fill-star/40 text-star"
                  : "fill-muted text-muted",
            )}
          />
        ))}
      </span>
      <span className="font-medium">{formatRating(ratingTenths)}</span>
      {reviewCount !== undefined && (
        <span className="text-muted-foreground">
          ({reviewCount.toLocaleString("en-US")})
        </span>
      )}
    </span>
  );
}
