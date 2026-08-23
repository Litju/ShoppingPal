# ShoppingPal

<p align="center">
  <img src="docs/assets/readme/hero-workspace.jpg" alt="A calm product workspace with a laptop and warm desk lighting" width="100%" />
</p>

<p align="center"><strong>A grounded shopping companion for finding the right thing without making up the details.</strong></p>

ShoppingPal combines a calm storefront with a typed shopping workflow. It can help someone narrow a messy request into useful options, compare tradeoffs, and propose a cart action without letting a language model invent prices, stock, variants, or order state.

The authority split is deliberate:

```text
Eve /api/v1
        |
LangGraph ShoppingGraph
        |
Typesense discovery -> Medusa hydration -> CartProposal
        |
web actor scope + price/variant/inventory revalidation
        |
Medusa idempotent cart mutation -> canonical ACK -> UI
```

Medusa owns products, variants, prices, inventory, carts, customers, and checkout state. Typesense is discovery-only. Eve owns sessions, streaming, approvals, and the handoff into the explicit ShoppingGraph. The web server derives the scoped `ActorContext`, verifies the graph's `CartProposal` against current Medusa state, performs the mutation, and renders only the returned cart acknowledgement. The storefront remains usable in a keyless degraded mode with deterministic shopping behavior; an external model is optional and never becomes commerce truth.

<table>
  <tr>
    <td><img src="docs/assets/readme/headphones.jpg" alt="Over-ear headphones resting on a warm neutral surface" width="100%" /></td>
    <td><img src="docs/assets/readme/watch.jpg" alt="A simple watch representing considered product choices" width="100%" /></td>
    <td><img src="docs/assets/readme/laptop-workspace.jpg" alt="A laptop workspace representing the shopping workflow" width="100%" /></td>
  </tr>
</table>

## Why it exists

Conversation and commerce need different authorities. ShoppingPal makes that boundary explicit:

- Discovery can be fast and ranked, but every candidate is hydrated against current Medusa state.
- Prices and inventory are revalidated before mutation.
- Cart changes return a canonical acknowledgement before the UI commits the result.
- Stable operation IDs make retries safe and idempotent.
- Approval gates and actor scoping keep suggestions separate from authorization.
- If the agent disappears, the conventional storefront still works.
- Without Medusa, browsing is static and browse-only; cart mutations fail explicitly.
- Checkout remains degraded until a Medusa payment provider is configured.

## Stack

| Layer | Responsibility |
| --- | --- |
| Next.js storefront | Product browsing, PDPs, cart UI, generative commerce UI |
| Medusa | Canonical commerce state and mutations |
| Typesense | Search and discovery projection only |
| FastAPI + Eve | Conversation, session, streaming, approvals, and agent boundary |
| LangGraph | Explicit ShoppingGraph workflow |
| LangChain | Model/tool/structured-output primitives |
| Shopping Missions | Durable shopping objectives independent of chat history |

## Local topology

| Service | Address |
| --- | --- |
| Web development | `http://localhost:3000` |
| Web production / Playwright | `http://localhost:3100` |
| Medusa | `http://localhost:9000` |
| Typesense | `http://localhost:8108` |
| Redis | `localhost:6379` |
| Docker PostgreSQL | `localhost:5433` |
| Agent | `http://localhost:8200` |

The native PostgreSQL service owns `:5432`; use the Docker database on `:5433` for Medusa and the agent.

## Run it

Read [HANDOFF.md](HANDOFF.md) and [docs/OPERATIONS.md](docs/OPERATIONS.md) before starting services. The handoff is the execution-state authority and includes the Windows encoding, port, rebuild, and stale-server rules.

For a storefront-only development session:

```powershell
pnpm install
pnpm --filter @shoppingpal/web dev
```

For the canonical Medusa path, start the dependencies and seed Medusa first:

```powershell
docker compose -f infra/docker-compose.yml up -d

$env:DATABASE_URL = "postgres://shoppingpal:shoppingpal@localhost:5433/shoppingpal"
pnpm --dir apps/commerce exec medusa db:migrate
pnpm --dir apps/commerce run db:seed
pnpm --dir apps/commerce run search:sync
pnpm --dir apps/commerce exec medusa start
```

In a second terminal, start the agent with the documented `MEDUSA_*` and `AGENT_*` variables:

```powershell
cd apps/agent
uv sync --frozen
uv run uvicorn main:app --host 127.0.0.1 --port 8200
```

Set `AGENT_URL=http://localhost:8200` for the web process. The app can run without model credentials; the deterministic Eve/ShoppingGraph path and the web demo fallback are intentional.

## Qualification

Web checks run from the repository root:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Agent checks run from `apps/agent`:

```powershell
uv sync --frozen
uv run ruff check .
uv run pyright
uv run pytest
```

The complete executed evidence, gate SHAs, known limitations, and final receipt live in [HANDOFF.md](HANDOFF.md).

## Visual credits

The README photography is stored locally for stable rendering and was sourced from Unsplash. It is product mood imagery, not catalog truth or a claim about the products shown.

- [Hero workspace source](https://images.unsplash.com/photo-1498050108023-c5249f4df085)
- [Headphones source](https://images.unsplash.com/photo-1505740420928-5e560c06d30e)
- [Watch source](https://images.unsplash.com/photo-1523275335684-37898b6baf30)
- [Laptop workspace source](https://images.unsplash.com/photo-1516321318423-f06f85e504b3)
