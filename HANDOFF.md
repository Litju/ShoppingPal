# ShoppingPal release handoff

This document records the implementation snapshot and separates local qualification from external deployment qualification. A skipped live check is not reported as a pass.

## Runtime summary

The Next.js storefront hosts the official Eve runtime in `apps/web/agent`. Its `run_shopping_graph` tool calls the FastAPI service, which exposes the typed LangGraph `ShoppingGraph` boundary. Typesense accelerates discovery; Medusa remains the authority for products, variants, prices, inventory, carts, checkout, payments, and orders.

Cart proposals are revalidated against canonical Medusa state before mutation. Checkout uses the Medusa v2 payment-session flow with Stripe: the server initializes the session, the browser confirms the client secret, and the server completes the cart before showing an order reference.

## Service prerequisites

| Service | Local endpoint | Required for |
| --- | --- | --- |
| Web | `:3000` or `:3100` | Storefront and Eve UI |
| PostgreSQL | `:5433` | Medusa and agent persistence |
| Redis | `:6379` | Medusa |
| Typesense | `:8108` | Live discovery projection |
| Medusa | `:9000` | Canonical commerce and Stripe sessions |
| Agent | `:8200` | LangGraph tool calls |
| Stripe test account | external | Payment confirmation and webhooks |
| AI Gateway | external | Hosted Eve model calls |

The storefront has a browse-only degraded mode. The deterministic fallback may answer local demo prompts without model credentials, but it never fabricates payment, order, or canonical commerce results.

## Qualification receipt

```text
SHOPPINGPAL_PUBLIC_PORTFOLIO_RELEASE

SOURCE_HEAD=ca615029ff6ba45295ab7410a68f0f07ec68cd6a
RELEASE_COMMIT=SEE_GIT_LOG
RELEASE_TAG=NOT_CREATED

OFFICIAL_EVE=PASS (eve 0.44.3; Next.js integration builds)
FASTAPI_GRAPH_BOUNDARY=PASS
MEDUSA_PACKAGE_BUILD=PASS
STRIPE_TEST_PAYMENT=NOT_RUN (no configured live commerce environment)
CANONICAL_ORDER=NOT_RUN
TYPESENSE_LIVE_SYNC=NOT_RUN
HOSTED_DEPLOYMENT=NOT_RUN

WEB_LINT=PASS (existing Next pages-directory warning only)
WEB_TYPECHECK=PASS
WEB_TESTS=PASS (75)
WEB_BUILD=PASS
PYTHON_RUFF=PASS
PYTHON_PYRIGHT=PASS
PYTHON_TESTS=PASS (12 passed, 2 skipped)
LIVE_E2E=NOT_RUN (requires Medusa, agent, and Stripe test configuration)
DEGRADED_E2E=PASS (1 passed, 7 skipped)
CLEAN_CLONE=NOT_RUN

PUBLIC_RELEASE_READY=BLOCKED_ON_EXTERNAL_PROVISIONING
```

The checks above were run from this working tree. The browser suite contains explicit skips for absent live services; those skips do not qualify checkout, payment, order creation, or hosted deployment.

## External release actions

Provision and configure these before calling the release live:

1. Postgres/Redis for the agent and Medusa.
2. A public FastAPI deployment for `apps/agent`, with `AGENT_INTERNAL_TOKEN` shared only with the web app and agent.
3. A Medusa deployment with its database, Redis, publishable key, region, and Stripe test provider.
4. Typesense and a completed catalog sync from Medusa.
5. Stripe test keys and webhook secret; set `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CAPTURE`, and the web `NEXT_PUBLIC_STRIPE_PK`.
6. AI Gateway access through `AI_GATEWAY_API_KEY`; set `SHOPPINGPAL_AGENT_MODEL` only to a model available to that account.
7. Vercel environment variables for the web app, then a production build and live Playwright run.

Keep secrets in the hosting providers and ignored local environment files. The committed `.env.example` files contain placeholders only.

## Local commands

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

```powershell
cd apps/agent
uv sync --frozen
uv run ruff check .
uv run pyright
uv run pytest
```

See [README.md](README.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), and [docs/OPERATIONS.md](docs/OPERATIONS.md) for topology, authority boundaries, and startup order.
