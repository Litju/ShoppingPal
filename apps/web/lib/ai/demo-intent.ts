/**
 * Deterministic intent parsing for the offline demo agent. Pure functions so
 * they can be unit-tested. This powers the zero-credential Shopping Pal
 * experience — same engine outputs, same UI, no model required.
 */

export interface CategoryHint {
  label: string;
  category?: string;
  tags?: string[];
}

const KEYWORD_MAP: Array<{ words: string[]; hint: CategoryHint }> = [
  { words: ["home gym", "gym setup", "gym"], hint: { label: "fitness", tags: ["home-gym", "strength-training"] } },
  { words: ["headphones", "over-ear", "anc"], hint: { label: "headphones", category: "audio", tags: ["headphones"] } },
  { words: ["earbuds", "earphones"], hint: { label: "earbuds", category: "audio", tags: ["earbuds"] } },
  { words: ["laptop", "notebook", "ultrabook", "macbook"], hint: { label: "laptop", category: "computers", tags: ["laptop"] } },
  { words: ["monitor", "display", "screen"], hint: { label: "monitor", category: "computer-accessories", tags: ["monitor"] } },
  { words: ["keyboard"], hint: { label: "keyboard", tags: ["keyboard"] } },
  { words: ["mouse"], hint: { label: "mouse", tags: ["mouse"] } },
  { words: ["desk setup", "workstation", "programming", "developer"], hint: { label: "desk setup", tags: ["desk-setup"] } },
  { words: ["running", "marathon", "jogging"], hint: { label: "running", tags: ["running"] } },
  { words: ["camping", "campsite", "tent"], hint: { label: "camping", tags: ["camping"] } },
  { words: ["hiking", "backpacking", "trail"], hint: { label: "hiking", tags: ["hiking"] } },
  { words: ["coffee", "espresso", "pour-over"], hint: { label: "coffee", tags: ["coffee"] } },
  { words: ["kitchen", "cooking"], hint: { label: "kitchen", category: "kitchen" } },
  { words: ["phone case", "case", "charger", "power bank", "cable"], hint: { label: "phone gear", category: "phones-accessories" } },
  { words: ["commute", "commuting", "subway", "train"], hint: { label: "commuting", tags: ["commuting"] } },
  { words: ["travel", "flight", "airport"], hint: { label: "travel", tags: ["travel"] } },
  { words: ["wallet", "everyday carry", "edc"], hint: { label: "everyday carry", category: "everyday-carry" } },
  { words: ["speaker", "bluetooth speaker"], hint: { label: "speakers", category: "audio", tags: ["speaker"] } },
  { words: ["bedding", "bedroom", "sleep"], hint: { label: "home", category: "home" } },
];

export function detectHints(text: string): CategoryHint[] {
  const lower = text.toLowerCase();
  const hints: CategoryHint[] = [];
  for (const { words, hint } of KEYWORD_MAP) {
    if (words.some((w) => lower.includes(w))) {
      if (!hints.some((h) => h.label === hint.label)) hints.push(hint);
    }
  }
  return hints;
}

/** "$250", "under 1,800", "budget of $1k", "1000 dollars" → cents */
export function extractBudgetCents(text: string): number | undefined {
  const kMatch =
    /(?:\$|usd\s?)?\s*(\d+(?:\.\d+)?)\s*k\b/i.exec(text) ??
    /(\d+(?:\.\d+)?)\s*(?:thousand)\b/i.exec(text);
  if (kMatch?.[1] !== undefined && kMatch[1] !== "") {
    return Math.round(parseFloat(kMatch[1]) * 100_000);
  }
  const patterns = [
    /(?:under|below|less than|max(?:imum)?|up to|upto|budget(?:\s+of)?)\s*\$?\s*([\d,]+(?:\.\d{1,2})?)/i,
    /\$\s*([\d,]+(?:\.\d{1,2})?)/,
    /([\d,]+(?:\.\d{1,2})?)\s*(?:dollars|bucks|usd)/i,
  ];
  for (const pattern of patterns) {
    const m = pattern.exec(text);
    if (m?.[1]) {
      const value = parseFloat(m[1].replace(/,/g, ""));
      if (Number.isFinite(value) && value > 0 && value <= 1_000_000) {
        return Math.round(value * 100);
      }
    }
  }
  return undefined;
}

export type DemoIntentType =
  | "compare"
  | "add-to-cart"
  | "bundle"
  | "cheaper-alternative"
  | "cart-status"
  | "checkout"
  | "greeting"
  | "save"
  | "search";

export function detectIntent(text: string): DemoIntentType {
  const lower = text.toLowerCase();
  if (/^\s*(hi|hello|hey|yo|sup)\b/.test(lower)) return "greeting";
  if (/\b(add|put|drop|throw)\b[^.?!]*\b(to|in|into)\b[^.?!]*\b(cart|bag)\b/.test(lower)) {
    return "add-to-cart";
  }
  if (/\b(save|bookmark)\b/.test(lower) && !/\bcart\b/.test(lower)) return "save";
  if (/\bcompare\b|\bversus\b|\bvs\.?\b/.test(lower)) return "compare";
  if (/\b(bundle|setup|set ?up|kit|everything i need|outfit my)\b/.test(lower)) {
    return "bundle";
  }
  if (/\b(cheaper|less expensive|more affordable)\b.*\b(alternative|option|pick|choice)?\b/.test(lower) || /\balternatives?\b/.test(lower)) {
    return "cheaper-alternative";
  }
  if (/\b(checkout|check out|pay now|place (my )?order)\b/.test(lower)) return "checkout";
  if (/\b(my cart|the cart|show cart|what.s in my cart|cart status|whats in my cart)\b/.test(lower)) {
    return "cart-status";
  }
  return "search";
}

const ORDINALS: Record<string, number> = {
  first: 1, "1st": 1, one: 1,
  second: 2, "2nd": 2, two: 2,
  third: 3, "3rd": 3, three: 3,
  fourth: 4, "4th": 4,
  fifth: 5, "5th": 5,
};

/** "the second one", "#2", "option 3" → 1-based position */
export function extractOrdinal(text: string): number | null {
  const lower = text.toLowerCase();
  const wordMatch = /\b(first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th)\b/.exec(lower);
  if (wordMatch?.[1]) {
    const ordinal = ORDINALS[wordMatch[1]];
    if (ordinal !== undefined) return ordinal;
  }
  const digitMatch = /#(\d)|\boption (\d)\b|\bnumber (\d)\b/.exec(lower);
  if (digitMatch) {
    const n = digitMatch[1] ?? digitMatch[2] ?? digitMatch[3];
    if (n !== undefined) {
      const parsed = parseInt(n, 10);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

/** Score how well a product title/tags match free text. Pure. */
export function scoreProductMatch(
  text: string,
  product: { title: string; brand: string; tags: string[]; category: string },
): number {
  const lower = text.toLowerCase();
  let score = 0;
  const titleTokens = `${product.brand} ${product.title}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);
  for (const token of titleTokens) {
    if (lower.includes(token)) score += 4;
  }
  for (const tag of product.tags) {
    if (lower.includes(tag.toLowerCase())) score += 3;
  }
  if (lower.includes(product.category.toLowerCase())) score += 2;
  return score;
}

export function quantityFromText(text: string): number {
  const wordMatch = /\b(two|three|four|five)\b/i.exec(text);
  const words: Record<string, number> = { two: 2, three: 3, four: 4, five: 5 };
  const word = wordMatch?.[1]?.toLowerCase();
  if (word && words[word] !== undefined) {
    return words[word];
  }
  const digitMatch = /\b(?:qty|quantity|x)?\s*(\d{1,2})\b/i.exec(text);
  if (digitMatch?.[1]) {
    const n = parseInt(digitMatch[1], 10);
    if (n >= 1 && n <= 10) return n;
  }
  return 1;
}
