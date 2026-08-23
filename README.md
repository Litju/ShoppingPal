# ShoppingPal

<p align="center">
  <img src="docs/assets/readme/app-home.png" alt="ShoppingPal home screen with the shopping companion prompt and featured catalog" width="100%" />
</p>

<p align="center"><strong>An e-commerce web app powered by ShoppingPal: an agent companion from product search to a canonical cart.</strong></p>

ShoppingPal combines a calm storefront with an agent companion for the shopping journey. It helps narrow a messy request into useful options, compare tradeoffs, and propose a cart action without letting a language model invent prices, stock, variants, or order state.

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
    <td width="50%"><img src="docs/assets/readme/app-catalog.png" alt="ShoppingPal audio catalog screen with filters and product cards" width="100%" /></td>
    <td width="50%"><img src="docs/assets/readme/app-product.png" alt="ShoppingPal Marlowe product detail screen with price, stock, specs, reviews, and add-to-cart" width="100%" /></td>
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

| Layer | Technologies | Responsibility |
| --- | --- | --- |
| Web storefront | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI | Product browsing, PDPs, cart UI, and generative commerce UI |
| Commerce | Medusa 2.19, PostgreSQL 16, Redis 7, Docker Compose | Canonical commerce state and mutations |
| Search | Typesense 27.1 | Search and discovery projection only |
| Agent API | Python 3.13, FastAPI, Pydantic v2, Uvicorn | Conversation, sessions, streaming, approvals, and the agent boundary |
| Agent workflow | Eve, LangGraph, LangChain Core | Session runtime, explicit ShoppingGraph workflow, and model/tool/structured-output primitives |
| Shopping Missions | PostgreSQL-backed durable domain state | Shopping objectives independent of chat history and checkpoints |
| Quality and tooling | pnpm 11, Turborepo, Vitest, Playwright, Ruff, Pyright, Pytest | Workspace orchestration, static checks, unit tests, browser tests, and Python validation |

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

## Product screenshots

Every image in this README is a real screenshot captured from the local ShoppingPal web app and committed under `docs/assets/readme/`. No stock photography is used.

- Home: `/`
- Audio catalog: `/products?category=audio`
- Marlowe product detail: `/products/marlowe-pulse-anc-headphones`
