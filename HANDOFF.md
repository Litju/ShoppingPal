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

The final values below are written only after the public cleanup has been requalified:

```text
SHOPPINGPAL_PUBLIC_PORTFOLIO_RELEASE

SOURCE_HEAD=
FINAL_HEAD=
RELEASE_TAG=
WORKTREE_CLEAN=

PRODUCT_RUNTIME=
OFFICIAL_EVE=
AGENT_MODEL=
LANGGRAPH=
MEDUSA=
TYPESENSE=
STRIPE_TEST_PAYMENT=
CANONICAL_ORDER=

DEVELOPMENT_AGENT_TRACE_AUDIT=
INTERNAL_NAMING_AUDIT=
MODEL_PROVIDER_UI_LEAKAGE=
PROMPT_AUDIT=
SOURCE_COMMENT_AUDIT=
DEPENDENCY_AUDIT=
DEAD_CODE_AUDIT=
PUBLIC_DOCS=
ARCHITECTURE_DOC=
ENV_CONTRACT=
PERSONAL_DATA_AUDIT=
SECRET_TREE_AUDIT=
SECRET_HISTORY_AUDIT=

DESKTOP_UX=
MOBILE_UX=
ACCESSIBILITY=
DEGRADED_MODE=

WEB_LINT=
WEB_TYPECHECK=
WEB_TESTS=
WEB_BUILD=
PYTHON_RUFF=
PYTHON_PYRIGHT=
PYTHON_TESTS=
EVE_EVALS=
E2E=
STRIPE_E2E=
CLEAN_CLONE=

PUBLIC_RELEASE_READY=
KNOWN_LIMITATIONS=
```

Checkout is `PASS_WITH_LIMITATION` until a Medusa payment provider is configured. The static catalog is browse-only without Medusa, external model credentials are optional, and browser skips are expected for unavailable service prerequisites.
