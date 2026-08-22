import type { LanguageModel } from "ai";

/**
 * Runtime LLM provider resolution. The application never couples to one
 * vendor: whichever provider has credentials (or is forced via AI_PROVIDER)
 * supplies the model. With no credentials the app uses the offline demo agent.
 */

export function aiConfigured(): boolean {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (forced === "openai") return Boolean(process.env.OPENAI_API_KEY?.trim());
  if (forced === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  if (forced === "google") return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim());
  return Boolean(
    process.env.OPENAI_API_KEY?.trim() ||
      process.env.ANTHROPIC_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim(),
  );
}

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  google: "gemini-2.0-flash",
} as const;

export async function resolveModel(): Promise<LanguageModel | null> {
  const forced = process.env.AI_PROVIDER?.trim().toLowerCase();
  const modelId = process.env.AI_MODEL?.trim();

  const order: Array<"openai" | "anthropic" | "google"> =
    forced === "openai" || forced === "anthropic" || forced === "google"
      ? [forced]
      : ["openai", "anthropic", "google"];

  for (const provider of order) {
    try {
      switch (provider) {
        case "openai": {
          const key = process.env.OPENAI_API_KEY?.trim();
          if (!key) continue;
          const { createOpenAI } = await import("@ai-sdk/openai");
          const openai = createOpenAI({ apiKey: key });
          return openai(modelId || DEFAULT_MODELS.openai);
        }
        case "anthropic": {
          const key = process.env.ANTHROPIC_API_KEY?.trim();
          if (!key) continue;
          const { createAnthropic } = await import("@ai-sdk/anthropic");
          const anthropic = createAnthropic({ apiKey: key });
          return anthropic(modelId || DEFAULT_MODELS.anthropic);
        }
        case "google": {
          const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
          if (!key) continue;
          const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
          const google = createGoogleGenerativeAI({ apiKey: key });
          return google(modelId || DEFAULT_MODELS.google);
        }
      }
    } catch (error) {
      console.error(`[ai] Failed to initialize ${provider}:`, error);
    }
  }
  return null;
}
