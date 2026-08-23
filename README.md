# ShoppingPal

ShoppingPal is a conventional commerce storefront with an optional typed shopping-agent path. Medusa is the commerce authority; Typesense is discovery-only; the FastAPI agent proposes actions and the web server performs and acknowledges cart mutations against canonical state.

## Local topology

| Service | Address |
| --- | --- |
| Web / Playwright | `http://localhost:3100` |
| Medusa | `http://localhost:9000` |
| Typesense | `http://localhost:8108` |
| Redis | `localhost:6379` |
| Docker PostgreSQL | `localhost:5433` |
| Agent | `http://localhost:8200` |

The native PostgreSQL service owns `:5432`; use the Docker database on `:5433` for Medusa and the agent.

## Qualification

Web checks run from the repository root with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`. Agent checks run from `apps/agent` with `uv sync --frozen`, `uv run ruff check .`, `uv run pyright`, and `uv run pytest`.

Read [HANDOFF.md](HANDOFF.md) and [docs/OPERATIONS.md](docs/OPERATIONS.md) before starting services. The handoff is the execution-state authority.
