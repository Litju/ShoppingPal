"use client";

import * as React from "react";
import { motion } from "motion/react";

import { ProductImage } from "@/components/commerce/product-image";
import { cn } from "@/lib/utils";

/** Lightweight gallery over the generated artwork: main view + zoom variants. */
export function ProductGallery({
  slug,
  category,
  title,
}: {
  slug: string;
  category: string;
  title: string;
}) {
  const views = ["Front", "Detail", "In use", "Scale"] as const;
  const [active, setActive] = React.useState(0);
  const [zoom, setZoom] = React.useState<{ x: number; y: number } | null>(null);

  return (
    <div>
      <div
        className="relative aspect-square w-full overflow-hidden rounded-lg border border-border bg-card"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setZoom({
            x: ((e.clientX - rect.left) / rect.width) * 100,
            y: ((e.clientY - rect.top) / rect.height) * 100,
          });
        }}
        onMouseLeave={() => setZoom(null)}
      >
        <motion.div
          key={active}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="h-full w-full transition-transform"
          style={
            zoom
              ? { transform: "scale(1.6)", transformOrigin: `${zoom.x}% ${zoom.y}%` }
              : undefined
          }
        >
          <ProductImage
            slug={`${slug}-${views[active]}`}
            category={category}
            title={title}
          />
        </motion.div>
        <span className="absolute bottom-3 left-3 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {views[active]}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2" role="tablist" aria-label="Product gallery">
        {views.map((view, i) => (
          <button
            key={view}
            role="tab"
            aria-selected={active === i}
            aria-label={`View ${view}`}
            onClick={() => setActive(i)}
            className={cn(
              "focus-ring aspect-square overflow-hidden rounded-md border bg-muted",
              active === i ? "border-primary" : "border-border hover:border-input",
            )}
          >
            <ProductImage slug={`${slug}-${view}`} category={category} title={title} />
          </button>
        ))}
      </div>
    </div>
  );
}
