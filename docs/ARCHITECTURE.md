# ShoppingPal architecture

## Runtime topology

```text
Browser
   |
   v
Next.js storefront + Eve session boundary
   |
   v
FastAPI service
   |
   v
LangGraph ShoppingGraph
   |---- Typesense discovery projection
   |---- Medusa canonical commerce
   |---- Shopping Mission persistence

Medusa
   |---- PostgreSQL
   |---- Redis
   |---- Stripe payment provider (optional)
```

Eve is the official conversational runtime in `apps/web/agent`, mounted into Next.js with `withEve`. Its channel and tool boundary own session identity, streaming events, and approvals. The `run_shopping_graph` Eve tool calls the FastAPI service; FastAPI and Pydantic expose only the typed `GraphRequest`/`GraphResponse` boundary into `ShoppingGraph`. LangGraph owns the explicit workflow and LangChain Core supplies the structured runnable boundary.

## Authority boundaries

- Medusa owns products, variants, prices, inventory, customers, carts, checkout, payments, and orders.
- Typesense is a discovery projection. Search candidates are rehydrated from Medusa before ranking or commerce decisions.
- The agent service owns workflow state, approval policy, canonical revalidation, and Shopping Mission state. It does not mutate Medusa directly.
- The web server derives actor-scoped cookies and executes `CartProposal` messages through the canonical Medusa cart provider.
- Checkout updates the canonical Medusa cart, initializes `pp_stripe_stripe`, confirms the returned client secret in the browser, and completes the cart server-side before displaying an order reference.
- The web database creates only saved-item and conversation state; startup never drops commerce or authentication tables.
- The web database/PGlite runtime stores saved products and conversation messages only. It does not own commerce records.

## Mutation protocol

1. The workflow searches discovery data and hydrates candidates from Medusa.
2. The workflow rechecks the canonical variant, price, and inventory before creating a `CartProposal`.
3. The proposal includes a stable operation id derived from actor, graph run, action, target, and canonical revision.
4. The web server verifies the proposal against current Medusa state and sends the operation id as the commerce idempotency key.
5. The UI renders a cart action only after Medusa returns the canonical cart acknowledgement.

Catalog and user-provided text are untrusted data. They can inform a recommendation but cannot authorize a tool or commerce mutation.

## Degraded operation

The storefront remains usable when the agent is absent. With no agent URL and no model credentials, the web fallback provides deterministic shopping responses for local demonstration. A configured model without the agent service returns an explicit unavailable response rather than activating a second production authority.

When Medusa is absent, the static catalog is browse-only and cart mutations fail explicitly. Checkout is a real Medusa/Stripe flow when configured. Without the provider, the route fails closed with a configuration error; no local order or simulated payment is created.
