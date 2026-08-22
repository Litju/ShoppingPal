"use client";

import * as React from "react";
import { MotionConfig } from "motion/react";
import { Toaster } from "sonner";

import { ChatProvider } from "@/components/chat/chat-context";
import { CartProvider } from "@/components/providers/cart-provider";

export function Providers({
  children,
  initialCart,
}: {
  children: React.ReactNode;
  initialCart?: import("@/lib/cart/types").CartDTO;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <CartProvider initialCart={initialCart}>
        <ChatProvider>
          {children}
          <Toaster position="bottom-center" richColors closeButton />
        </ChatProvider>
      </CartProvider>
    </MotionConfig>
  );
}
