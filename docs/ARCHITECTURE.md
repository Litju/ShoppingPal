# ShoppingPal architecture

## Authorities

- Medusa owns products, variants, prices, inventory, carts, customers, and checkout state.
- Typesense is a discovery projection. Search candidate IDs are rehydrated from Medusa before ranking or commerce decisions.
- `apps/agent` owns the typed shopping workflow, Eve session envelope, approval policy, canonical revalidation, and independent Shopping Mission state. Python does not mutate Medusa directly.
- The web server owns actor-scoped cookies, server actions, and execution of `CartProposal` messages. It emits the UI only after the canonical cart mutation returns.

## Runtime flow

```text
Eve /api/v1
  -> ShoppingGraph (LangGraph)
  -> Medusa catalog hydration
  -> deterministic constraints and ranking
  -> CartProposal with operation_id
  -> web canonical revalidation + Medusa cart mutation
  -> typed tool part + cart refresh
```

Eve is an in-repository runtime in `apps/agent/shoppingpal/eve`; it is not a second agent framework. LangChain supplies the structured runnable boundary, LangGraph owns the explicit workflow, and FastAPI/Pydantic own the service boundary.

## Degraded operation

The storefront remains usable when the agent is absent. With no agent URL and no model credentials, the deterministic demo agent preserves the existing generative UI for local demonstration. A configured model without `AGENT_URL` returns an explicit unavailable response rather than silently reactivating a second production authority. Medusa checkout remains an explicit degraded boundary until a payment provider is configured.
