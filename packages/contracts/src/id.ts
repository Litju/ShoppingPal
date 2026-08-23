/**
 * Deterministic identity shared by every ShoppingPal surface.
 * Product ids must be byte-identical across the static catalog, the
 * commerce database, search projections, and agent payloads — otherwise
 * cross-system references silently break.
 */

function fnv(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** Deterministic UUID v5-style id derived from a name, stable across providers. */
export function deterministicUuid(namespaceSeed: string, name: string): string {
  // FNV-1a based 128-bit hash expanded into uuid format.
  let h1 = 0x811c9dc5 ^ fnv(namespaceSeed);
  const parts: number[] = [];
  for (let i = 0; i < 4; i++) {
    h1 ^= fnv(`${name}:${i}`);
    parts.push(h1 >>> 0);
  }
  const hex = parts.map((n) => n.toString(16).padStart(8, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`, // version 4 nibble for realism
    ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) +
      hex.slice(17, 20),
    hex.slice(20, 32),
  ].join("-");
}

/** Canonical namespace for seed-catalog product ids. */
export const PRODUCT_ID_NAMESPACE = "shopping-pal-product";

export function productIdForSlug(slug: string): string {
  return deterministicUuid(PRODUCT_ID_NAMESPACE, slug);
}
