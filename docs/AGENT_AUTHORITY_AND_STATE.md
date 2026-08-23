# Agent authority and state

## Actor mapping

The web server derives `ActorContext` from the Medusa customer session or a scoped guest actor. It sends only the scoped actor ID and an internal service token to FastAPI. The browser cannot assign a privileged actor.

## State separation

- Eve sessions contain conversation/session context and the last canonical shortlist used for ordinal requests.
- LangGraph checkpoints contain workflow execution state and use Postgres in the `agent` database schema.
- Shopping Missions are independent rows in `agent.shopping_missions`, scoped by actor, and survive Eve session/checkpoint replacement.
- Medusa remains the only product, variant, inventory, cart, checkout, payment, and order authority. The web database has no commerce tables after the post-parity cleanup.

## Mutation protocol

1. The graph reads Medusa product, variant, current price, and inventory.
2. The graph revalidates inventory immediately before creating a `CartProposal`.
3. `operation_id` is stable for actor, graph run, action, target, and canonical revision.
4. The web adapter checks expected canonical price and variant, sends Medusa's idempotency key, and executes the existing server-side cart provider.
5. Only the returned cart is rendered as an `addToCart` UI part; rejection is plain text and never a success card.

Catalog descriptions are wrapped as untrusted data and cannot authorize tools. Checkout is approval-gated and currently reports Medusa's missing payment setup rather than fabricating order success; neither the agent nor the web database creates a local order.
