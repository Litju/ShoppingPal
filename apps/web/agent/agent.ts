import { defineAgent } from "eve";

const model =
  process.env.SHOPPINGPAL_AGENT_MODEL?.trim() ||
  "nvidia/nemotron-3.5-lightning-free";

export default defineAgent({
  model,
  description: "Shopping Pal helps customers choose from the canonical store catalog.",
});
