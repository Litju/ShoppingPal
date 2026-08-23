import { tool } from "ai";

import {
  addToCartInput,
  addToCartOutput,
  buildBundleInput,
  buildBundleOutput,
  compareProductsInput,
  compareProductsOutput,
  findAlternativesInput,
  findAlternativesOutput,
  getCartInput,
  getCartOutput,
  getProductInput,
  getProductOutput,
  prepareCheckoutInput,
  prepareCheckoutOutput,
  recommendProductInput,
  recommendationSchema,
  removeFromCartInput,
  removeFromCartOutput,
  saveProductInput,
  saveProductOutput,
  searchProductsInput,
  searchProductsOutput,
  updateCartInput,
  updateCartOutput,
} from "@/lib/ai/schemas";
import {
  runAddToCart,
  runBuildBundle,
  runCompareProducts,
  runFindAlternatives,
  runGetCart,
  runGetProduct,
  runPrepareCheckout,
  runRecommendProduct,
  runRemoveFromCart,
  runSaveProduct,
  runSearchProducts,
  runUpdateCart,
} from "@/lib/ai/engine";

/**
 * Shopping Pal's tools. Every fact the model can state about products, carts
 * or checkout comes from these validated tool results — never from memory.
 */
export function createShoppingPalTools() {
  return {
    searchProducts: tool({
      description:
        "Search the real product catalog. Use for any browsing or discovery request. " +
        "Prices are integer cents (maxPrice: 25000 = $250). Returns grounded results only.",
      inputSchema: searchProductsInput,
      outputSchema: searchProductsOutput,
      execute: (input) => runSearchProducts(input),
    }),

    getProduct: tool({
      description:
        "Fetch one product by slug or id for details. Use before deep-diving into a specific item.",
      inputSchema: getProductInput,
      outputSchema: getProductOutput,
      execute: (input) => runGetProduct(input),
    }),

    compareProducts: tool({
      description:
        "Compare 2-4 products side by side. Returns structured rows highlighting meaningful differences.",
      inputSchema: compareProductsInput,
      outputSchema: compareProductsOutput,
      execute: (input) => runCompareProducts(input),
    }),

    findAlternatives: tool({
      description:
        "Find alternative products relative to a given one. direction 'cheaper' = lower-priced options, 'better' = higher-rated options.",
      inputSchema: findAlternativesInput,
      outputSchema: findAlternativesOutput,
      execute: (input) => runFindAlternatives(input),
    }),

    recommendProduct: tool({
      description:
        "Present ONE product as the strong recommendation with grounded reasons and honest tradeoffs. " +
        "Always pass the user's budget (cents) and use-case tags they stated so reasons anchor to their requirements.",
      inputSchema: recommendProductInput,
      outputSchema: recommendationSchema,
      execute: async (input) => {
        const rec = await runRecommendProduct(input);
        if (!rec) throw new Error(`Unknown product ${input.productId}`);
        return rec;
      },
    }),

    buildBundle: tool({
      description:
        "Build or validate a multi-product bundle under an optional budget (cents). " +
        "Pass focusTags describing each needed slot (e.g. ['laptop','monitor','keyboard']) or explicit productIds to check fit.",
      inputSchema: buildBundleInput,
      outputSchema: buildBundleOutput,
      execute: async (input) => {
        const bundle = await runBuildBundle(input);
        if (!bundle) throw new Error("Could not assemble a bundle from the catalog.");
        return bundle;
      },
    }),

    getCart: tool({
      description:
        "Read the user's current cart with server-computed totals. Never estimate totals yourself.",
      inputSchema: getCartInput,
      outputSchema: getCartOutput,
      execute: async () => runGetCart(),
    }),

    addToCart: tool({
      description:
        "Add a product to the cart. Only call when the user clearly asked for it.",
      inputSchema: addToCartInput,
      outputSchema: addToCartOutput,
      execute: (input) => runAddToCart(input),
    }),

    updateCart: tool({
      description: "Change the quantity of a cart line. quantity 0 removes it.",
      inputSchema: updateCartInput,
      outputSchema: updateCartOutput,
      execute: (input) => runUpdateCart(input),
    }),

    removeFromCart: tool({
      description: "Remove a product from the cart entirely.",
      inputSchema: removeFromCartInput,
      outputSchema: removeFromCartOutput,
      execute: (input) => runRemoveFromCart(input),
    }),

    saveProduct: tool({
      description: "Save a product to the user's saved list (wishlist).",
      inputSchema: saveProductInput,
      outputSchema: saveProductOutput,
      execute: (input) => runSaveProduct({ productId: input.productId }),
    }),

    prepareCheckout: tool({
      description:
        "Report whether the current cart can proceed to canonical checkout. Never create a local order or claim that payment succeeded.",
      inputSchema: prepareCheckoutInput,
      outputSchema: prepareCheckoutOutput,
      execute: () => runPrepareCheckout(),
    }),
  };
}

export type ShoppingPalTools = ReturnType<typeof createShoppingPalTools>;
