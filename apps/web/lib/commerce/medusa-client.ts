import type { MedusaConfig } from "@/lib/commerce/config";

/**
 * Minimal typed client for the Medusa v2 Store API. Only what the
 * ShoppingPal adapters need — no SDK weight, no admin surface.
 */

export class MedusaClient {
  constructor(private readonly config: MedusaConfig) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        "x-publishable-api-key": this.config.publishableKey,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Medusa ${init?.method ?? "GET"} ${path} failed (${res.status}): ${body.slice(0, 300)}`,
      );
    }
    return (await res.json()) as T;
  }

  get<T>(path: string, headers?: HeadersInit): Promise<T> {
    return this.request<T>(path, { headers });
  }

  post<T>(path: string, body?: unknown, headers?: HeadersInit): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: JSON.stringify(body ?? {}),
      headers,
    });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }
}
