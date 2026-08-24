# ShoppingPal

Live Demo: hosted commerce release pending provider setup

Source: [github.com/Litju/ShoppingPal](https://github.com/Litju/ShoppingPal)

The FastAPI agent has a verified Vercel Preview at [shoppingpal-agent.vercel.app](https://shoppingpal-agent-dv1bddpq0-julitocrztuga-2084s-projects.vercel.app). The final storefront URL will be added here after the hosted commerce release is provisioned and qualified.

<p align="center">
  <img src="docs/assets/readme/app-home.png" alt="ShoppingPal home screen with the shopping companion prompt and featured catalog" width="100%" />
</p>

<p align="center"><strong>An agent-assisted commerce platform for discovering, comparing, and purchasing products.</strong></p>

ShoppingPal pairs a conventional storefront with a typed shopping assistant. The assistant can narrow a request, compare grounded product options, and propose cart actions, while Medusa remains the authority for products, variants, prices, inventory, customers, carts, checkout, and orders.

The system is designed around explicit boundaries:

```text
Browser
  -> Next.js storefront on Vercel (`shoppingpal`)
  -> official Eve session runtime in `apps/web/agent`
  -> FastAPI typed graph boundary on Vercel (`shoppingpal-agent`)
  -> LangGraph ShoppingGraph
       -> Medusa canonical catalog and commerce state
       -> PostgreSQL Shopping Mission and checkpoint persistence

Storefront catalog path
  -> Typesense discovery projection
  -> Medusa hydration and revalidation
```

The web server derives the actor scope, revalidates proposed mutations against current Medusa state, and renders only canonical cart acknowledgements. If the agent is unavailable, the storefront still works. If Medusa is unavailable, browsing is intentionally read-only and checkout reports the limitation instead of simulating a payment.

## Agent workflow

For an assistant turn, the server-side flow is:

1. OpenCode Go with the qualified `gpt-5.6-luna` model produces the structured model response when configured.
2. Official Eve owns the conversational session, stream, tool boundary, and durable cursor.
3. Eve calls `run_shopping_graph` through the authenticated FastAPI boundary.
4. LangGraph classifies intent, loads Shopping Mission context, extracts constraints, queries the canonical Medusa catalog, hydrates candidates, applies hard constraints, and returns typed recommendations, comparisons, compatibility results, bundles, or commerce proposals.
5. The web server revalidates any commerce proposal and performs the Medusa cart mutation only after the required user approval.

OpenCode Go credentials, the agent internal token, database URLs, provider keys, and webhook secrets are server-only. The browser receives no privileged FastAPI credentials.

## Canonical commerce boundary

Typesense is a disposable read model for fast storefront discovery. Its candidates are never authoritative for price, variant identity, inventory, payment, or order state. The purchase path is always:

```text
Typesense candidate (optional)
  -> Medusa product and variant hydration
  -> current Medusa price and inventory revalidation
  -> canonical cart mutation
  -> Stripe test-mode payment session
  -> Medusa cart completion and canonical order
```

The model may propose an action, but it cannot mark payment success. Eve approval cannot create an order. Only a successful Stripe/Medusa state transition can produce the purchase result. If Typesense is empty or unavailable, the storefront falls back to canonical Medusa data; if Medusa or Stripe is unavailable, ShoppingPal reports that limitation and does not fabricate commerce success.

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
# Set the seeded storefront key and region id in the ignored local environment.
# The bootstrap command intentionally does not log the publishable key.
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

Stripe is TEST MODE ONLY. When Medusa and its official `pp_stripe_stripe` provider are configured, `/checkout` performs the real Medusa v2 flow: the server action updates the canonical cart and initializes a Stripe payment session, Stripe Elements confirms the payment with the browser-safe publishable key, and the server completes the cart. An order reference is shown only after Medusa returns an order result. `STRIPE_CAPTURE=true` is the default; set it explicitly in the commerce environment when changing capture behavior.

Without the required Medusa or Stripe configuration, checkout returns an explicit configuration error and creates no order. The deterministic assistant path is a local fallback; it never represents an external model or replaces Medusa as commerce authority.

## Deployment topology

The repository is a pnpm/Turborepo monorepo, deployed as separate services. The Vercel storefront uses the official Eve stable `services` pipeline; it has no custom `.output` or `.vercel/output` dashboard directory.

| Component | Hosting and root | Responsibility | Current status |
| --- | --- | --- | --- |
| Storefront | Vercel project `shoppingpal`, `apps/web` | Next.js storefront, Eve session runtime, assistant UI, cart, and checkout | Eve/OpenCode Go/streaming/session qualification is complete; final public URL is pending hosted commerce qualification |
| Agent | Vercel project `shoppingpal-agent`, `apps/agent` | FastAPI and LangGraph ShoppingGraph | Preview deployed and health/auth boundary verified at [the current agent Preview](https://shoppingpal-agent-dv1bddpq0-julitocrztuga-2084s-projects.vercel.app) |
| Commerce | Render service `shoppingpal-commerce` | Medusa API and canonical commerce state | Declarative service definition is in [`render.yaml`](render.yaml); hosted URL and runtime secrets remain to be configured |
| Search | Render service `shoppingpal-search` | Typesense disposable discovery read model | Rebuilds from the canonical Medusa catalog after an empty restart; hosted service remains to be configured |
| Databases | Neon project `shoppingpal` | Separate logical databases `shoppingpal_commerce` and `shoppingpal_agent` | Commerce migrations and the 86-product seed have been verified; hosted runtime wiring remains part of release qualification |
| Runtime cache | Upstash Redis | Medusa/runtime Redis requirement | Provider resource is pending account terms acceptance and provisioning |
| Payments | Stripe test mode | `pp_stripe_stripe` payment sessions, Elements confirmation, webhook, and Medusa order completion | Code path is present; hosted test credentials and webhook still require configuration and sandbox qualification |

The web server calls the agent with `AGENT_URL` and `AGENT_INTERNAL_TOKEN`; the browser never calls privileged FastAPI routes directly. Hosting secrets are configured through provider-encrypted environments and ignored local files only. Actual `.env` files and credentials are never committed.

## Hosted release status

The Vercel agent deployment is a real, Git-connected Preview rather than a local-only stub: `/health` returns the Postgres-backed runtime status, privileged graph routes reject missing internal authentication, and Shopping Mission persistence has been exercised against the Neon agent database.

The full public commerce release is intentionally not claimed yet. It requires the remaining provider actions and hosted gates for Render Medusa, Render Typesense, Upstash Redis, Stripe test mode, the hosted shopping graph, canonical cart/order behavior, and production/browser qualification. Until those checks are green, this README keeps the Live Demo entry explicitly pending. See [HANDOFF.md](HANDOFF.md) for the qualification receipt and remaining external actions.

## Product screenshots

The README images are screenshots from the local ShoppingPal storefront and are committed under `docs/assets/readme/`:

- Home: `/`
- Catalog: `/products?category=audio`
- Product detail: `/products/marlowe-pulse-anc-headphones`
