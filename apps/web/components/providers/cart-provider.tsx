"use client";

import * as React from "react";
import { toast } from "sonner";

import {
  addToCartAction,
  getCartAction,
  removeFromCartAction,
  setQuantityAction,
} from "@/lib/actions/cart";
import { EMPTY_CART, type CartDTO } from "@shoppingpal/contracts";

export interface CartContextValue {
  cart: CartDTO;
  ready: boolean;
  pendingProductId: string | null;
  addToCart: (productId: string, quantity?: number) => Promise<boolean>;
  setQuantity: (productId: string, quantity: number) => Promise<boolean>;
  removeItem: (productId: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const CartContext = React.createContext<CartContextValue | null>(null);

export function useCart(): CartContextValue {
  const ctx = React.useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

/** Components that imply an external cart mutation mount this to resync. */
export function useSyncCartOnChange(trigger: unknown) {
  const { refresh } = useCart();
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);
}

export function CartProvider({
  children,
  initialCart,
}: {
  children: React.ReactNode;
  initialCart?: CartDTO;
}) {
  const [cart, setCart] = React.useState<CartDTO>(initialCart ?? EMPTY_CART);
  const [ready, setReady] = React.useState(Boolean(initialCart));
  const [pendingProductId, setPending] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    getCartAction().then((c) => {
      if (!cancelled) {
        setCart(c);
        setReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const run = React.useCallback(
    async (
      productId: string | null,
      fn: () => Promise<CartDTO>,
      successMessage?: string,
    ): Promise<boolean> => {
      setPending(productId);
      try {
        const next = await fn();
        setCart(next);
        if (successMessage) toast.success(successMessage);
        return true;
      } catch {
        toast.error("Something went wrong updating your cart.");
        void getCartAction().then(setCart);
        return false;
      } finally {
        setPending(null);
      }
    },
    [],
  );

  const value = React.useMemo<CartContextValue>(
    () => ({
      cart,
      ready,
      pendingProductId,
      addToCart: (productId, quantity = 1) =>
        run(
          productId,
            () => addToCartAction(productId, quantity, globalThis.crypto.randomUUID()).then((r) => {
            if (!r.ok || !r.data) throw new Error(r.error);
            return r.data;
          }),
        ),
      setQuantity: (productId, quantity) =>
        run(
          productId,
          () => setQuantityAction(productId, quantity).then((r) => {
            if (!r.ok || !r.data) throw new Error(r.error);
            return r.data;
          }),
        ),
      removeItem: (productId) =>
        run(
          productId,
          () => removeFromCartAction(productId).then((r) => {
            if (!r.ok || !r.data) throw new Error(r.error);
            return r.data;
          }),
        ),
      refresh: async () => {
        setCart(await getCartAction());
      },
    }),
    [cart, ready, pendingProductId, run],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
