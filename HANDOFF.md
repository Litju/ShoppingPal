# ShoppingPal release handoff

This document is the public operational companion to the [README](README.md). It describes the current runtime, the local service order, the qualification commands, and the known boundaries of the project.

## Runtime summary

ShoppingPal is an agent-assisted commerce platform. The Next.js storefront calls the in-repository Eve runtime through FastAPI; Eve invokes the typed LangGraph ShoppingGraph. Typesense accelerates discovery, while Medusa remains the canonical source for product, variant, price, inventory, customer, cart, checkout, payment, and order state.

The agent returns typed recommendations and `CartProposal` messages. The web server derives actor scope, revalidates the proposal against Medusa, executes the idempotent cart mutation, and sends the canonical acknowledgement to the UI. Shopping Missions live independently from conversation history and graph checkpoints.

## Service prerequisites

| Service | Local endpoint | Required for |
| --- | --- | --- |
| Web | `:3000` or `:3100` | Storefront |
| PostgreSQL | `:5433` | Medusa and agent persistence |
| Redis | `:6379` | Medusa |
| Typesense | `:8108` | Live discovery projection |
| Medusa | `:9000` | Auth, cart, checkout, and canonical commerce |
| Agent | `:8200` | Eve and ShoppingGraph workflows |

The storefront can run without the service prerequisites in browse-only degraded mode. The deterministic web assistant can run without model credentials. Neither mode fabricates commerce or payment results.

## Startup

Follow the commands in [README.md](README.md) and the service notes in [docs/OPERATIONS.md](docs/OPERATIONS.md). Keep service credentials in ignored local environment files. The committed examples contain placeholders only.

## Qualification commands

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

Live qualification also covers Medusa catalog/auth/cart behavior, Typesense projection and canonical rehydration, Eve events, Shopping Mission persistence, idempotent proposals, degraded operation, and the explicit checkout limitation when no payment provider is configured.

## Qualification receipt

The `FINAL_HEAD` below is the qualified implementation snapshot. The commit
that records this receipt changes only this handoff document.

```text
SHOPPINGPAL_PUBLIC_PORTFOLIO_RELEASE

SOURCE_HEAD=f89edcec5544ac67baa97d6bdc77fa2780b51e31
FINAL_HEAD=06ec120962f6b933d22fd5ca3d7cf86f94c9c1a9
RELEASE_TAG=NOT_CREATED
WORKTREE_CLEAN=PASS

PRODUCT_RUNTIME=PASS
OFFICIAL_EVE=PASS
AGENT_MODEL=PASS_WITH_LIMITATION
LANGGRAPH=PASS
MEDUSA=PASS
TYPESENSE=PASS_WITH_LIMITATION
STRIPE_TEST_PAYMENT=NOT_RUN
CANONICAL_ORDER=NOT_RUN

DEVELOPMENT_AGENT_TRACE_AUDIT=PASS
INTERNAL_NAMING_AUDIT=PASS
MODEL_PROVIDER_UI_LEAKAGE=PASS
PROMPT_AUDIT=PASS
SOURCE_COMMENT_AUDIT=PASS
DEPENDENCY_AUDIT=PASS
DEAD_CODE_AUDIT=PASS_WITH_LIMITATION
PUBLIC_DOCS=PASS
ARCHITECTURE_DOC=PASS
ENV_CONTRACT=PASS
PERSONAL_DATA_AUDIT=PASS
SECRET_TREE_AUDIT=PASS
SECRET_HISTORY_AUDIT=PASS_WITH_LIMITATION

DESKTOP_UX=PASS
MOBILE_UX=PASS
ACCESSIBILITY=PASS_WITH_LIMITATION
DEGRADED_MODE=PASS

WEB_LINT=PASS
WEB_TYPECHECK=PASS
WEB_TESTS=PASS (73)
WEB_BUILD=PASS
PYTHON_RUFF=PASS
PYTHON_PYRIGHT=PASS
PYTHON_TESTS=PASS (12 passed, 2 skipped)
EVE_EVALS=PASS
E2E=PASS (live 4 passed, 4 skipped; degraded 1 passed, 7 skipped)
STRIPE_E2E=PASS_WITH_LIMITATION
CLEAN_CLONE=PASS

PUBLIC_RELEASE_READY=PASS_WITH_LIMITATIONS
KNOWN_LIMITATIONS=Stripe is intentionally unconfigured; checkout returns an explicit 503 and no order is created. External model credentials are optional, so the deterministic structured fallback is the default. Typesense `/health` and sync passed, but the local Docker healthcheck reports unhealthy because its image lacks the probe binary. Historical commits retain a local publishable key and earlier release wording; no private secret was found and public history was not rewritten.
```

Checkout is `PASS_WITH_LIMITATION` until a payment provider is configured. The static catalog is browse-only without the commerce service, external model credentials are optional, and browser skips are expected for unavailable service prerequisites.
