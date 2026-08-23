import type { UIMessageStreamWriter } from "ai";

import { getCatalogProvider } from "@/lib/catalog";
import type { ProductSummary } from "@/lib/ai/schemas";
import {
  detectHints,
  detectIntent,
  extractBudgetCents,
  extractOrdinal,
  quantityFromText,
  scoreProductMatch,
} from "@/lib/ai/demo-intent";
import {
  runAddToCart,
  runBuildBundle,
  runCompareProducts,
  runFindAlternatives,
  runGetCart,
  runPrepareCheckout,
  runRecommendProduct,
  runSaveProduct,
  runSearchProducts,
} from "@/lib/ai/engine";
import { formatMoney } from "@shoppingpal/contracts";

/**
 * Offline Shopping Pal engine. When no LLM provider is configured this
 * deterministic agent still runs the real tools against the real catalog and
 * streams the same UI-message parts, so the generative commerce experience is
 * fully demonstrable without any API keys.
 */

export interface ShortlistEntry {
  id: string;
  slug: string;
  title: string;
}

/** Per-session shortlist so "add the second one" works across turns. */
const shortlists = new Map<string, ShortlistEntry[]>();

function rememberShortlist(key: string, entries: ShortlistEntry[]) {
  if (entries.length > 0) shortlists.set(key, entries);
}

class DemoWriter {
  private textId = 0;
  private callId = 0;

  constructor(private readonly writer: UIMessageStreamWriter) {}

  begin() {
    this.writer.write({ type: "start" });
    this.writer.write({ type: "start-step" });
  }

  async text(content: string): Promise<void> {
    const id = `demo-text-${this.textId++}`;
    this.writer.write({ type: "text-start", id });
    // Small chunks to feel like streaming without artificial delay.
    for (const chunk of chunkText(content)) {
      this.writer.write({ type: "text-delta", id, delta: chunk });
    }
    this.writer.write({ type: "text-end", id });
  }

  async tool<T>(name: string, input: unknown, execute: () => Promise<T>): Promise<T> {
    const toolCallId = `demo-call-${this.callId++}`;
    this.writer.write({
      type: "tool-input-available",
      toolCallId,
      toolName: name,
      input,
    });
    const output = await execute();
    this.writer.write({ type: "tool-output-available", toolCallId, output });
    return output;
  }

  end() {
    this.writer.write({ type: "finish-step" });
    this.writer.write({ type: "finish" });
  }
}

function chunkText(text: string): string[] {
  if (text.length < 80) return [text];
  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + 60));
    i += 60;
  }
  return chunks;
}

export async function streamDemoAgent(options: {
  writer: UIMessageStreamWriter;
  text: string;
  sessionKey: string;
}): Promise<void> {
  const w = new DemoWriter(options.writer);
  w.begin();
  try {
    await respond(w, options.text, options.sessionKey);
  } catch (error) {
    console.error("[demo-agent]", error);
    await w.text(
      "Something went wrong on my side just now — the store itself is fine. Try rephrasing that?",
    );
  }
  w.end();
}

async function respond(w: DemoWriter, rawText: string, sessionKey: string) {
  const intent = detectIntent(rawText);
  const budget = extractBudgetCents(rawText);
  const hints = detectHints(rawText);
  const shortlist = shortlists.get(sessionKey) ?? [];

  switch (intent) {
    case "greeting": {
      await w.text(
        "Hey! I'm Shopping Pal. Tell me what you're shopping for and a budget if you have one — like \"best headphones under $250 for gym and commuting\" or \"home gym setup under $1,000\". I'll search the catalog, compare options, and can add picks straight to your cart.",
      );
      return;
    }

    case "compare": {
      const matched = await matchMentionedProducts(rawText, shortlist);
      const ids =
        matched.length >= 2
          ? matched.slice(0, 3).map((p) => p.id)
          : shortlist.slice(0, 3).map((p) => p.id);
      if (ids.length < 2) {
        await w.text(
          "Happy to compare — give me at least two products by name (e.g. \"compare Marlowe Pulse ANC vs Northwind Fjord\"), or ask me for options first.",
        );
        return;
      }
      const result = await w.tool(
        "compareProducts",
        { productIds: ids },
        () => runCompareProducts({ productIds: ids }),
      );
      const names = result.products.map((p) => p.title).join(", ");
      const highlightLines = result.highlights.map((h) => `• ${h}`).join("\n");
      await w.text(
        `Here's how they stack up:\n\n${highlightLines}\n\nThe table above shows only the rows where they actually differ. Want me to recommend one based on your priorities?`,
      );
      rememberShortlist(
        sessionKey,
        result.products.map((p) => ({ id: p.id, slug: p.slug, title: p.title })),
      );
      void names;
      return;
    }

    case "add-to-cart": {
      const ordinal = extractOrdinal(rawText);
      let target: ShortlistEntry | undefined;
      if (ordinal && shortlist[ordinal - 1]) {
        target = shortlist[ordinal - 1];
      } else {
        const matched = await matchMentionedProducts(rawText, shortlist);
        target = matched[0]
          ? { id: matched[0].id, slug: matched[0].slug, title: matched[0].title }
          : shortlist[0];
      }
      if (!target) {
        await w.text(
          "I couldn't tell which product you mean. Search for something first, then say \"add the second one to my cart\".",
        );
        return;
      }
      const quantity = quantityFromText(rawText.replace(/\b(add|to|my|cart)\b/gi, ""));
      const result = await w.tool(
        "addToCart",
        { productId: target.id, quantity },
        () => runAddToCart({ productId: target!.id, quantity }),
      );
      const total = result.cart ? formatMoney(result.cart.total) : null;
      await w.text(
        `Done — ${target.title} (×${quantity}) is in your cart.${total ? ` Cart total: ${total}.` : ""} You can adjust quantities any time in the cart.`,
      );
      return;
    }

    case "bundle": {
      const focusTags = deriveFocusTags(rawText, hints);
      const bundle = await w.tool(
        "buildBundle",
        {
          description: rawText.slice(0, 200),
          budget,
          focusTags: focusTags.length > 0 ? focusTags : undefined,
        },
        () => runBuildBundle({
          description: rawText.slice(0, 200),
          budget,
          focusTags: focusTags.length > 0 ? focusTags : undefined,
        }),
      );
      if (!bundle || bundle.items.length === 0) {
        await w.text(
          "I couldn't put together a complete set with what's in stock right now. Loosen the budget slightly or drop one requirement and I'll try again.",
        );
        return;
      }
      const totalLine = budget
        ? `${formatMoney(bundle.total)} of your ${formatMoney(budget)}${
            bundle.remaining !== null ? ` — ${formatMoney(bundle.remaining)} left over` : ""
          }`
        : formatMoney(bundle.total);
      await w.text(
        `Here's a ${focusTags.length > 0 ? "setup" : "bundle"} I'd stand behind: ${bundle.items
          .map((i) => i.title)
          .join(" + ")}. Total ${totalLine}. Every pick is in stock — tap through the card to add it all at once.`,
      );
      return;
    }

    case "cheaper-alternative": {
      const base = await resolveBaseProduct(rawText, shortlist);
      if (!base) {
        await w.text("Which product should I find alternatives for? Name it or pull one up first.");
        return;
      }
      const result = await w.tool(
        "findAlternatives",
        { productId: base.id, direction: "cheaper" },
        () => runFindAlternatives({ productId: base.id, direction: "cheaper", maxPrice: budget }),
      );
      const best = result.alternatives[0];
      if (!best) {
        await w.text(
          `I couldn't find a cheaper in-stock alternative to the ${base.title} that isn't a big step down. It may already be the value pick.`,
        );
        return;
      }
      await w.tool(
        "searchProducts",
        { query: best.category.replace(/-/g, " "), inStockOnly: true, limit: 6 },
        () =>
          runSearchProducts({
            category: best.category,
            maxPrice: budget,
            inStockOnly: true,
            sort: "price-asc",
            limit: 6,
          }),
      );
      await w.text(
        `Cheapest solid swap is the ${best.title} at ${formatMoney(best.price)}. The cards below show cheaper options — want a deeper comparison?`,
      );
      return;
    }

    case "cart-status": {
      const result = await w.tool("getCart", {}, () => runGetCart());
      const cart = result.cart;
      if (cart.lines.length === 0) {
        await w.text("Your cart is empty. Find something you like and I'll handle the adding.");
        return;
      }
      const items = cart.lines
        .map((l) => `• ${l.quantity} × ${l.title} — ${formatMoney(l.lineTotal, l.currency)}`)
        .join("\n");
      await w.text(
        `Here's your cart:\n${items}\n\nSubtotal ${formatMoney(cart.subtotal)}, shipping ${formatMoney(cart.shipping)}, tax ${formatMoney(cart.tax)} — total ${formatMoney(cart.total)}. Say "checkout" when you're ready and I'll prepare it.`,
      );
      return;
    }

    case "checkout": {
      const prep = await w.tool("prepareCheckout", {}, () => runPrepareCheckout());
      if (!prep.ready) {
        await w.text(prep.message ?? "Checkout isn't ready yet.");
        return;
      }
      await w.text("Checkout is ready.");
      return;
    }

    case "save": {
      const base = await resolveBaseProduct(rawText, shortlist);
      if (!base) {
        await w.text("Tell me which product to save — e.g. \"save the Northwind Fjord\".");
        return;
      }
      const result = await w.tool(
        "saveProduct",
        { productId: base.id },
        () => runSaveProduct({ productId: base.id }),
      );
      await w.text(result.saved ? result.message : result.message);
      return;
    }

    case "search":
    default: {
      const tags = [...new Set(hints.flatMap((h) => h.tags ?? []))];
      const category = hints.find((h) => h.category)?.category;
      const query = cleanQuery(rawText);
      if (!query && tags.length === 0 && !category) {
        await w.text(
          "What are you looking for? Try \"headphones under $100 for the gym\", \"a monitor for programming under $500\", or \"build me a camping kit under $300\".",
        );
        return;
      }
      const searchInput = {
        query: query || undefined,
        category,
        tags: tags.length > 0 ? tags : undefined,
        maxPrice: budget,
        inStockOnly: true,
        sort: "relevance" as const,
        limit: 6,
      };
      const result = await w.tool(
        "searchProducts",
        searchInput,
        () => runSearchProducts(searchInput),
      );

      if (result.products.length === 0) {
        await w.text(
          budget
            ? `Nothing in the catalog matches that under ${formatMoney(budget)}. Want me to raise the ceiling or look at adjacent categories?`
            : "No matches for that. Try fewer words or a broader category and I'll narrow down from there.",
        );
        return;
      }

      rememberShortlist(
        sessionKey,
        result.products.map((p) => ({ id: p.id, slug: p.slug, title: p.title })),
      );

      // Recommend the best-value candidate when the request has constraints.
      if (budget !== undefined || tags.length > 0) {
        const winner = pickBestValue(result.products, budget);
        if (winner) {
          const rec = await w.tool(
            "recommendProduct",
            {
              productId: winner.id,
              budget,
              useCaseTags: tags,
            },
            () =>
              runRecommendProduct({
                productId: winner.id,
                budget,
                useCaseTags: tags,
              }).then((r) => r ?? throwErr("no recommendation")),
          );
          await w.text(
            rec.overBudgetBy === null
              ? `My pick is the ${rec.product.brand} ${rec.product.title}. Top reason: ${rec.reasons[0]?.toLowerCase()} One honest caveat: ${rec.tradeoffs[0]?.toLowerCase()}`
              : `Closest fit is the ${rec.product.title}, though it's ${formatMoney(rec.overBudgetBy ?? 0)} over budget. Caveat: ${rec.tradeoffs[0]?.toLowerCase() ?? "n/a"}`,
          );
          return;
        }
      }

      await w.text(
        `Found ${result.total} match${result.total === 1 ? "" : "es"}. Cards below — ask me to compare two, find cheaper alternatives, or add one to your cart.`,
      );
      return;
    }
  }
}

function throwErr(message: string): never {
  throw new Error(message);
}

/** Best value = highest rating among cheapest half within budget. Deterministic. */
function pickBestValue(products: ProductSummary[], budget?: number): ProductSummary | null {
  const eligible = products.filter((p) => p.stock > 0 && (!budget || p.price <= budget));
  if (eligible.length === 0) return null;
  return [...eligible].sort((a, b) => {
    const scoreA = a.ratingTenths * 1000 + Math.log10(a.reviewCount + 10) * 50 - a.price / 10_000;
    const scoreB = b.ratingTenths * 1000 + Math.log10(b.reviewCount + 10) * 50 - b.price / 10_000;
    return scoreB - scoreA;
  })[0] ?? null;
}

function cleanQuery(text: string): string {
  return text
    .replace(/(?:find|show|get)(?:\s+me)?/gi, "")
    .replace(/i(?:'m| am)?\s+(?:looking|shopping)\s+for/gi, "")
    .replace(/i need|i want/gi, "")
    .replace(/best|good|great|top\b/gi, "")
    .replace(/under\s*\$?\s*[\d,.]+k?\b/gi, "")
    .replace(/\$\s*[\d,.]+k?\b/g, "")
    .replace(/\bfor\b\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function matchMentionedProducts(
  text: string,
  shortlist: ShortlistEntry[],
): Promise<ProductSummary[]> {
  const catalog = await getCatalogProvider();
  const page = await catalog.search({ pageSize: 60 });
  const scored = page.items
    .map((product) => ({
      summary: {
        id: product.id,
        slug: product.slug,
        title: product.title,
        brand: product.brand,
        category: product.category,
        description: "",
        price: product.price,
        currency: product.currency,
        ratingTenths: product.ratingTenths,
        reviewCount: product.reviewCount,
        stock: product.stock,
        tags: product.tags,
        specs: product.specs,
      },
      score: scoreProductMatch(text, product),
    }))
    .filter((r) => r.score >= 8)
    .sort((a, b) => b.score - a.score);

  if (scored.length > 0) return scored.map((s) => s.summary);

  // Fall back to shortlist titles mentioned in text.
  const lower = text.toLowerCase();
  const fromShortlist = shortlist.filter((entry) =>
    entry.title.toLowerCase().split(" ").some((word) => word.length > 3 && lower.includes(word)),
  );
  if (fromShortlist.length > 0) {
    const catalog2 = await getCatalogProvider();
    const products = await catalog2.getByIds(fromShortlist.map((f) => f.id));
    return products.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      brand: p.brand,
      category: p.category,
      description: "",
      price: p.price,
      currency: p.currency,
      ratingTenths: p.ratingTenths,
      reviewCount: p.reviewCount,
      stock: p.stock,
      tags: p.tags,
      specs: p.specs,
    }));
  }
  return [];
}

async function resolveBaseProduct(
  text: string,
  shortlist: ShortlistEntry[],
): Promise<ShortlistEntry | null> {
  const ordinal = extractOrdinal(text);
  if (ordinal && shortlist[ordinal - 1]) return shortlist[ordinal - 1] ?? null;
  const matched = await matchMentionedProducts(text, shortlist);
  if (matched[0]) {
    return { id: matched[0].id, slug: matched[0].slug, title: matched[0].title };
  }
  return shortlist[0] ?? null;
}

/** Derive bundle slots from scene keywords ("home gym", "desk setup"...). */
function deriveFocusTags(
  text: string,
  hints: Array<{ label: string; tags?: string[] }>,
): string[] {
  const lower = text.toLowerCase();
  const scenes: Array<{ words: string[]; tags: string[] }> = [
    { words: ["home gym", "gym setup"], tags: ["strength-training", "bench", "cardio", "recovery"] },
    { words: ["desk setup", "programming setup"], tags: ["laptop", "monitor", "keyboard", "mouse"] },
    { words: ["camping kit", "camping setup", "camping trip"], tags: ["tent", "sleeping-bag", "camping", "lighting"] },
    { words: ["coffee setup", "coffee station"], tags: ["coffee"] },
    { words: ["commuter kit"], tags: ["commuting", "backpack", "power-bank"] },
  ];
  for (const scene of scenes) {
    if (scene.words.some((w) => lower.includes(w))) return scene.tags;
  }
  // Noun slots mentioned explicitly ("laptop, monitor and keyboard").
  const nouns: Array<{ word: string; tag: string }> = [
    { word: "laptop", tag: "laptop" },
    { word: "monitor", tag: "monitor" },
    { word: "keyboard", tag: "keyboard" },
    { word: "mouse", tag: "mouse" },
    { word: "tent", tag: "tent" },
    { word: "sleeping bag", tag: "sleeping-bag" },
    { word: "dumbbell", tag: "strength-training" },
    { word: "kettlebell", tag: "strength-training" },
    { word: "bench", tag: "bench" },
    { word: "grinder", tag: "coffee" },
    { word: "kettle", tag: "coffee" },
    { word: "speaker", tag: "speaker" },
  ];
  const explicitNouns = nouns.filter((n) => lower.includes(n.word)).map((n) => n.tag);
  if (explicitNouns.length > 0) return [...new Set(explicitNouns)];

  const hintTags = hints.flatMap((h) => h.tags ?? []);
  if (hintTags.length > 0) return [...new Set(hintTags)].slice(0, 4);

  // Single-category bundles are still useful ("camping under $300").
  const singleCategoryScenes: Array<{ words: string[]; tag: string }> = [
    { words: ["camping"], tag: "camping" },
    { words: ["gym", "fitness"], tag: "home-gym" },
    { words: ["coffee"], tag: "coffee" },
    { words: ["travel kit"], tag: "travel" },
  ];
  for (const scene of singleCategoryScenes) {
    if (scene.words.some((w) => lower.includes(w))) return [scene.tag];
  }
  return [];
}
