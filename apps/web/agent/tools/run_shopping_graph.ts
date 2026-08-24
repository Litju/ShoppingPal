import { defineTool } from "eve/tools";
import { z } from "zod";

import { graphToolResultSchema, runShoppingGraph } from "../lib/graph";

export default defineTool({
  description:
    "Run the canonical ShoppingPal workflow. Use this for catalog search, recommendations, comparisons, compatibility, bundles, and explicit cart requests. Pass the user's request faithfully; include product IDs from the current shortlist when acting on a prior result.",
  inputSchema: z.object({
    message: z.string().min(1).max(2000),
    contextProductIds: z.array(z.string()).max(12).optional(),
    missionId: z.string().max(120).optional(),
    requestId: z.string().max(120).optional(),
  }),
  outputSchema: graphToolResultSchema,
  execute: runShoppingGraph,
});
