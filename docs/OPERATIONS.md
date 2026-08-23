# Operations and qualification

## Start order

1. Start Docker Desktop and `infra/docker-compose.yml` (Postgres `:5433`, Redis `:6379`, Typesense `:8108`).
2. Boot Medusa on `:9000`, run migrations, and seed the idempotent catalog.
3. Sync Typesense from the live Medusa Store API.
4. Start the agent on `:8200` with `AGENT_DATABASE_URL`, `AGENT_CHECKPOINT_BACKEND=postgres`, the Medusa URL/key/region, and an internal token.
5. Stop any existing web process, rebuild, then start the production web server on `:3100` before Playwright.

## Checks

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e

cd apps/agent
uv sync --frozen
uv run ruff check .
uv run pyright
uv run pytest
```

PowerShell 5.1 text rewrites can introduce mojibake or a UTF-8 BOM. Use `apply_patch` or an encoding-controlled writer for source changes. Playwright can reuse a stale `:3100` process; verify and stop the exact listener, rebuild, start, verify the port, and only then run E2E. Remove any temporary `apps/web/.env.local` after qualification.

Typesense's API health endpoint is green even though its Docker healthcheck is not: the image does not contain the configured `wget` probe. Treat that as an infrastructure healthcheck limitation, not as a catalog-authority failure.
