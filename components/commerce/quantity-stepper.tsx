"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCart } from "@/components/providers/cart-provider";

export function QuantityStepper({
  productId,
  quantity,
  stock,
  maxQuantity = 10,
}: {
  productId: string;
  quantity: number;
  stock: number;
  maxQuantity?: number;
}) {
  const { setQuantity, pendingProductId } = useCart();
  const busy = pendingProductId === productId;

  return (
    <div
      className="inline-flex items-center rounded-md border border-input bg-card"
      role="group"
      aria-label="Quantity"
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={busy || quantity <= 1}
        aria-label="Decrease quantity"
        onClick={() => void setQuantity(productId, quantity - 1)}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <span className="w-8 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {quantity}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={busy || quantity >= Math.min(stock, maxQuantity)}
        aria-label="Increase quantity"
        onClick={() => void setQuantity(productId, quantity + 1)}
      >
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
