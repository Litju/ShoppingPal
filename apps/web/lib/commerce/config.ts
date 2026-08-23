import { z } from "zod";

/**
 * Commerce runtime selection (strangler pattern).
 *
 * MEDUSA_BACKEND_URL set  → Medusa is canonical commerce authority
 *                           (catalog/cart served through Medusa Store API).
 * MEDUSA_BACKEND_URL unset → embedded legacy stack (PGlite demo mode),
 *                            kept only until final legacy removal.
 */

const medusaConfigSchema = z.object({
  baseUrl: z.string().url(),
  publishableKey: z.string().min(1),
  regionId: z.string().min(1).optional(),
});

export interface MedusaConfig {
  baseUrl: string;
  publishableKey: string;
  regionId?: string;
}

let cached: MedusaConfig | null | undefined;

export function getMedusaConfig(): MedusaConfig | null {
  if (cached !== undefined) return cached;
  const parsed = medusaConfigSchema.safeParse({
    baseUrl: process.env.MEDUSA_BACKEND_URL?.trim() ?? "",
    publishableKey: process.env.MEDUSA_PUBLISHABLE_KEY?.trim() ?? "",
    regionId: process.env.MEDUSA_REGION_ID?.trim() || undefined,
  });
  cached = parsed.success ? parsed.data : null;
  return cached;
}

/** True when Medusa owns the commerce domain in this runtime. */
export function medusaEnabled(): boolean {
  return getMedusaConfig() !== null;
}
