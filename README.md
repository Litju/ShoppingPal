# ShoppingPal

<p align="center">
  <img src="docs/assets/readme/app-home.png" alt="ShoppingPal home screen with the shopping companion prompt and featured catalog" width="100%" />
</p>

<p align="center"><strong>An agent-assisted commerce platform for discovering, comparing, and purchasing products.</strong></p>

ShoppingPal pairs a conventional storefront with a typed shopping assistant. The assistant can narrow a request, compare grounded product options, and propose cart actions, while Medusa remains the authority for products, variants, prices, inventory, customers, carts, checkout, and orders.

The system is designed around explicit boundaries:

```text
Browser
  -> Next.js storefront
  -> official Eve session runtime in `apps/web/agent`
  -> FastAPI typed graph boundary
  -> LangGraph ShoppingGraph
       -> Typesense discovery
       -> Medusa canonical commerce
       -> Shopping Mission persistence
```

The web server derives the actor scope, revalidates proposed mutations against current Medusa state, and renders only canonical cart acknowledgements. If the agent is unavailable, the storefront still works. If Medusa is unavailable, browsing is intentionally read-only and checkout reports the limitation instead of simulating a payment.

## Demonstrated engineering

- Next.js and React storefront with responsive product, cart, account, and checkout surfaces
- Medusa-backed product, variant, inventory, customer, cart, checkout, and order authority
- Typesense discovery projection with canonical Medusa rehydration
- Eve conversational runtime and explicit LangGraph shopping workflow
- FastAPI and Pydantic service boundary with actor scoping and approval boundaries
- Shopping Missions persisted independently from chat history and graph checkpoints
- Structured generative commerce UI backed by typed payloads
- Idempotent commerce mutations with price and inventory revalidation
- Prompt-injection boundaries for untrusted catalog content
- Deterministic degraded operation when external model credentials are absent
- Production-oriented unit, service, and build qualification with explicit live-service gates

## Stack

| Layer | Technologies | Responsibility |
| --- | --- | --- |
| Storefront | Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI | Product browsing, PDPs, cart UI, accounts, and assistant UI |
| Commerce | Medusa 2.19, PostgreSQL 16, Redis 7, Docker Compose | Canonical commerce state and mutations |
| Search | Typesense 27.1 | Discovery projection only |
| Agent service | Python 3.13, FastAPI, Pydantic 2, Uvicorn | Typed graph boundary, actor scope, and internal service authentication |
| Agent workflow | Vercel Eve, LangGraph, LangChain Core | Session runtime in the web app, explicit shopping workflow, and typed runnable boundary |
| Quality | pnpm, Turborepo, Vitest, Playwright, Ruff, Pyright, Pytest | Workspace orchestration and qualification |

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

## Run it

Read [docs/OPERATIONS.md](docs/OPERATIONS.md) for service order and Windows-specific checks. The root [.env.example](.env.example) is a configuration reference; service-specific examples live in `apps/agent/.env.example` and `apps/commerce/.env.example`.

Install the pinned workspace dependencies:

```powershell
pnpm install --frozen-lockfile
```

For a storefront-only session, leave `MEDUSA_BACKEND_URL` and `AGENT_URL` unset and start the web app:

```powershell
pnpm --filter @shoppingpal/web dev
```

This mode supports catalog browsing and a deterministic local assistant experience. Commerce actions remain clearly unavailable without Medusa.

For the full local topology, use the following terminals in order. The search
projection must run after Medusa is listening:

Terminal 1 — bootstrap and start Medusa:

```powershell
docker compose -f infra/docker-compose.yml up -d

$env:DATABASE_URL = "postgres://shoppingpal:shoppingpal@localhost:5433/shoppingpal"
pnpm --dir apps/commerce exec medusa db:migrate
pnpm --dir apps/commerce run db:seed
$env:MEDUSA_BACKEND_URL = "http://localhost:9000"
pnpm --dir apps/commerce exec medusa exec ./src/scripts/ensure-publishable-key.ts
# Copy the publishable key printed above and set the seeded region id.
$env:MEDUSA_PUBLISHABLE_KEY = "<local-publishable-key>"
$env:MEDUSA_REGION_ID = "<local-region-id>"
pnpm --dir apps/commerce exec medusa start
```

Terminal 2 — sync Typesense from the live Medusa service:

```powershell
$env:MEDUSA_BACKEND_URL = "http://localhost:9000"
$env:MEDUSA_PUBLISHABLE_KEY = "<local-publishable-key>"
$env:MEDUSA_REGION_ID = "<local-region-id>"
pnpm --dir apps/commerce run search:sync
```

Terminal 3 — configure and start the agent. Use the seeded Medusa publishable key and region id from the local service:

```powershell
cd apps/agent
uv sync --frozen
$env:AGENT_DATABASE_URL = "postgresql://shoppingpal:shoppingpal@localhost:5433/shoppingpal"
$env:AGENT_CHECKPOINT_BACKEND = "postgres"
$env:AGENT_INTERNAL_TOKEN = "local-shoppingpal-agent-token"
$env:MEDUSA_BACKEND_URL = "http://localhost:9000"
$env:MEDUSA_PUBLISHABLE_KEY = "<local-publishable-key>"
$env:MEDUSA_REGION_ID = "<local-region-id>"
uv run uvicorn main:app --host 127.0.0.1 --port 8200
```

Terminal 4 — start the web app with the same service values:

```powershell
$env:MEDUSA_BACKEND_URL = "http://localhost:9000"
$env:MEDUSA_PUBLISHABLE_KEY = "<local-publishable-key>"
$env:MEDUSA_REGION_ID = "<local-region-id>"
$env:AGENT_URL = "http://localhost:8200"
$env:AGENT_INTERNAL_TOKEN = "local-shoppingpal-agent-token"
pnpm --filter @shoppingpal/web dev
```

Replace angle-bracket values with the values created by the local bootstrap. They are placeholders, not credentials to commit.

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

The complete qualification receipt, service limitations, and clean-clone notes are kept in [HANDOFF.md](HANDOFF.md). The final architecture and authority boundaries are documented in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Checkout and demo boundaries

When Medusa and its Stripe provider are configured, `/checkout` performs the real Medusa v2 flow: the server action updates the canonical cart and initializes a Stripe payment session, the browser confirms the payment with the public Stripe key, and the server completes the cart. An order reference is shown only after Medusa returns an order result. `STRIPE_CAPTURE=true` is the default; set it explicitly in the commerce environment when changing capture behavior.

Without the required Medusa or Stripe configuration, checkout returns an explicit configuration error and creates no order. The deterministic assistant path is a local fallback; it never represents an external model or replaces Medusa as commerce authority.

## Hosted release boundary

This repository snapshot contains deployable integration code, but it does not claim a hosted production deployment. A live release still requires provisioned Postgres/Redis, Medusa, FastAPI, Typesense, Stripe test credentials, an AI Gateway key, and Vercel environment variables. See [HANDOFF.md](HANDOFF.md) for the exact qualification receipt and remaining external actions.

## Product screenshots

The README images are screenshots from the local ShoppingPal storefront and are committed under `docs/assets/readme/`:

- Home: `/`
- Catalog: `/products?category=audio`
- Product detail: `/products/marlowe-pulse-anc-headphones`
