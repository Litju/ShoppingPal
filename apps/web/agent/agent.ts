import { createOpenAI } from "@ai-sdk/openai";
import { defineAgent } from "eve";

const openCodeGo = createOpenAI({
  name: "opencode-go",
  baseURL: "https://opencode.ai/zen/go/v1",
  apiKey: process.env.OPENCODE_GO_API_KEY!,
});

const shoppingPalModel = openCodeGo.responses("gpt-5.6-luna");

export default defineAgent({
  model: shoppingPalModel,
  modelContextWindowTokens: 200_000,
  description: "Shopping Pal helps customers choose from the canonical store catalog.",
});
