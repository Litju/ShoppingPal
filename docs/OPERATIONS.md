# Local operations

## Service order

1. Start Docker Desktop and `infra/docker-compose.yml` (PostgreSQL `:5433`, Redis `:6379`, Typesense `:8108`).
2. Run Medusa migrations, seed the catalog, and create a publishable key.
3. Sync the Typesense projection from the live Medusa Store API.
4. Start the agent on `:8200` with the database, checkpoint, Medusa, and internal-token variables.
5. Build the web app and commerce service, then start the production server on `:3100` before Playwright.

Without Medusa variables, the web app is intentionally browse-only. Without an agent URL, the web fallback can demonstrate deterministic assistant responses, but it does not claim external-model reasoning.

## Checks

Run from the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Run from `apps/agent`:

```powershell
uv sync --frozen
uv run ruff check .
uv run pyright
uv run pytest
```

The browser suite skips commerce cases when Medusa, the agent, or the Stripe public key is not configured. Those skips represent the documented degraded contract, not passing live commerce qualification.

## Browser qualification hygiene

Playwright can reuse a stale web server when `reuseExistingServer` is enabled. Verify the exact listener on `:3100`, stop it when needed, rebuild the web app, start the production server, and verify the port before running E2E. Remove any local `apps/web/.env.local` after the run.

PowerShell 5.1 can corrupt UTF-8 and add a BOM when rewriting source or JSON files. Use the repository patch workflow or an encoding-controlled writer for changes.

## Infrastructure notes

Typesense's `/health` endpoint is the service check. The local Docker image may report an unhealthy container when its configured probe depends on a binary not included in the image; that probe state does not change Typesense's discovery-authority boundary.

Checkout uses the Medusa Stripe payment provider when configured. A failed or unconfigured payment path must remain an explicit error and must not create a local order. The live test requires `MEDUSA_BACKEND_URL`, `MEDUSA_PUBLISHABLE_KEY`, `MEDUSA_REGION_ID`, `NEXT_PUBLIC_STRIPE_PK`, a running agent, and Stripe test credentials in the commerce service.
