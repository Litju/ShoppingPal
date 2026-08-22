"use client";

import * as React from "react";
import { Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/providers/cart-provider";
import { cn } from "@/lib/utils";

export function AddToCartButton({
  productId,
  title,
  stock,
  quantity = 1,
  size = "default",
  variant = "default",
  className,
  label,
}: {
  productId: string;
  title: string;
  stock: number;
  quantity?: number;
  size?: "sm" | "default" | "lg";
  variant?: "default" | "secondary" | "outline" | "ghost";
  className?: string;
  label?: string;
}) {
  const { addToCart, pendingProductId } = useCart();
  const disabled = stock <= 0;
  const busy = pendingProductId === productId;

  return (
    <Button
      type="button"
      size={size}
      variant={disabled ? "secondary" : variant}
      disabled={disabled || busy}
      aria-label={disabled ? `${title} is out of stock` : `Add ${title} to cart`}
      onClick={async () => {
        const ok = await addToCart(productId, quantity);
        if (ok) toast.success(`Added ${title} to your cart`);
        else toast.error("Could not add to your cart.");
      }}
      className={cn(disabled && "text-muted-foreground", className)}
    >
      {busy ? <Loader2 className="animate-spin" /> : <ShoppingCart />}
      {disabled ? "Out of stock" : (label ?? "Add to cart")}
    </Button>
  );
}
