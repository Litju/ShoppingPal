# SHOPPINGPAL ARCHITECTURE CONVERGENCE V1 — EXECUTION HANDOFF

**Mission:** `ARCHITECTURE_CONVERGENCE_V1`
**Authoritative spec:** `C:\Users\Usuario\Downloads\ShoppingPal_Architecture_Convergence_V1_and_OXAlpha_OneShot.md` (2,573 lines). It is the design authority, migration contract, invariants list, qualification spec, and definition of done. The final receipt (spec §32 + §AD) is the deliverable.
**Repository:** local `C:\Users\Usuario\Desktop\Projects\ShoppingPal` (= github.com/Litju/ShoppingPal)
**Branch:** `work/architecture-convergence-v1` (never touch `main`)
**Baseline:** `ee032c2461864616df9a1a609b326a3a1409e3c8`

Commits so far:

```text
ee032c2  Shopping Pal: agentic commerce storefront        <- baseline
19503b0  Gate A: baseline qualification                    <- DONE
e533b2d  Gate B: monorepo convergence                      <- DONE
5dac4c8  Gate C: Medusa commerce cutover                    <- DONE
```

---

## 1. GATES COMPLETED (with executed evidence)

### Gate A — baseline qualification ✅
- Repaired malformed `pnpm-workspace.yaml` (pnpm was 100% broken at baseline).
- Rewrote ESLint config as valid flat config for eslint-config-next 16 (old one was TS-in-.mjs, lint had never run); fixed 17 surfaced lint errors.
- **PDP cart-badge defect root-caused and fixed** (it was three stacked bugs):
  1. Demo DB never seeded → static-catalog ids didn't exist in PGlite → every add-to-cart died silently (`invalid_product`). Fix: idempotent seed-on-boot in `getDatabase()` + regression test `apps/web/tests/unit/demo-db-parity.test.ts`.
  2. PGlite init race across Next.js route bundles (WASM `Aborted()`) → fixed with `globalThis` singleton handle/schema flags + boot warmup via `instrumentation.ts`.
  3. Mobile sheet could never close (Close button under its own panel; launcher wired to `open()` instead of `toggle()`).
- Evidence: lint PASS, typecheck PASS, unit 61→62/62 PASS, build PASS, Playwright 3 executed / 0 failed.

### Gate B — monorepo convergence ✅
- Storefront moved to `apps/web` via tracked renames (history intact).
- `packages/contracts` — money math, cart DTOs, deterministic ids, catalog dataset (`SEED_PRODUCTS`). Compiles to CJS `dist/` (required by `medusa exec`; web consumes it too). Build with `pnpm --filter @shoppingpal/contracts build`.
- `packages/ui` — `Price`, `RatingStars`, `cn`. Tailwind scans it via `@source` in `apps/web/app/globals.css`.
- `packages/config` (shared tsconfig.base), `packages/test-utils` (fixtures).
- pnpm workspaces + Turborepo. Root scripts: `pnpm lint|typecheck|test|build|test:e2e`.
- Single root flat ESLint config (`eslint.config.mjs`); no per-app eslint.
- Evidence: all gates re-run green in monorepo layout.

### Gate C — Medusa commerce cutover ✅ (`5dac4c8`)
DONE:
- `infra/docker-compose.yml`: postgres16 (:5433!), redis7 (:6379), typesense27 (:8108). Postgres and Redis healthy; Typesense `/health` returns 200, but its image healthcheck is unhealthy because the image does not include the configured `wget` probe.
- `apps/commerce`: Medusa v2.19 backend (`@medusajs/medusa`, `@medusajs/framework`, `@medusajs/cli`, ts-node devDep, admin dashboard disabled in `medusa-config.ts`).
- `db:migrate` PASS. Seed script `src/scripts/seed-catalog.ts` is idempotent (external_id = `productIdForSlug(slug)`):
  - 86 products created, each with explicit default variant + USD price + managed inventory
  - 9 categories, all products categorized
  - USD region created: `reg_01M0NPRJJ2EM1V9HSK9P6B3ZXC`
  - Sales channel "Default Sales Channel": publishable key linked + ALL products linked
  - Stock location "ShoppingPal Warehouse" linked to channel; 86 inventory levels seeded from product stock (2 intentionally zero: NORDVEX_FLUX_14_GAMING, CASCADE_45QT_COOLER)
- Publishable key: `pk_7327ddf3c97c65cb62984c1d43e2271968e9d273d85d73e2936f7e31e8f5f246` (reprint: `pnpm exec medusa exec ./src/scripts/ensure-publishable-key.ts`)
- API smoke proven: store product fetch w/ price ($129900 = $1,299.00 ✓), cart create, add line item qty 2 → subtotal 259800 ✓, update qty ✓.
- Web adapters written:
  - `apps/web/lib/commerce/config.ts` — strangler switch: `MEDUSA_BACKEND_URL`+`MEDUSA_PUBLISHABLE_KEY`(+`MEDUSA_REGION_ID`) set ⇒ Medusa mode; unset ⇒ legacy demo stack.
  - `lib/commerce/medusa-client.ts` — typed Store API client.
  - `lib/catalog/medusa-provider.ts` — full CatalogProvider impl; **must always pass explicit `fields=` including `metadata` and variant inventory/price fields** (store defaults omit them; missing metadata broke PDPs once already).
  - `lib/cart/medusa-cart-provider.ts` — same surface as DrizzleCartProvider; guest cookie carries the Medusa cart id; `attachCustomer(cartId, token)` ready for Gate D; legacy-compatible `mergeGuestCart`.
  - `lib/cart/session.ts` selects provider by runtime; `ensureCartRef()` creates a Medusa cart and stores its id in the `sp_guest` cookie in medusa mode.
- Browser-verified: PDP add-to-cart against live Medusa updates badge ("Open cart, 1 item") for tidepool-sprint-2-earbuds.
- Root cause of the non-total variant resolution was confirmed: product detail requests omitted the required `region_id` pricing context, and the variant fallback used Medusa's invalid `variants[]=` query shape. Both failures were swallowed as `undefined` by the adapter. The resolver now passes the configured region on every product lookup, uses `variants.id[]=` for variant lookup, and selects the exact matching variant before falling back to the product default.
- Regression coverage: `apps/web/tests/unit/medusa-cart-provider.test.ts` covers Tidepool (previously working), Marlowe (previously failing), an invalid product, and an out-of-stock product; invalid and non-purchasable variants never reach the cart mutation.
- Qualification evidence: fresh `pnpm --filter @shoppingpal/web build` PASS; Medusa-mode `pnpm --filter @shoppingpal/web test:e2e` PASS (3 executed, 3 viewport-skipped); no-env legacy `pnpm --filter @shoppingpal/web test:e2e` PASS (3 executed, 3 viewport-skipped); root `pnpm lint`, `pnpm typecheck`, and `pnpm test` PASS (66 unit tests).
- Medusa checkout remains explicitly degraded, not falsely successful: native `POST /store/carts/{id}/complete` returned `400 Payment collection has not been initiated for cart` because no payment provider is configured. Medusa-mode checkout reports `Checkout isn't available right now. Medusa payment setup is required.` The legacy demo checkout remains green until its later removal gate.

---

## 2. RESOLVED Gate C defect

**Historical symptom:** In Medusa mode, add-to-cart failed for SOME products with server log
`[cart] add rejected: Unknown product.` (thrown from `MedusaCartProvider.addItem` when `resolveVariant()` returns undefined).

**Deterministic repro observed:**
- WORKS: `/products?category=audio` → first item (tidepool-sprint-2-earbuds) → Add → badge=1.
- FAILS: `/products?q=headphones` → first item (marlowe-pulse-anc-headphones) → Add → badge stays 0.

Both went through identical storefront paths, but the old adapter collapsed the missing pricing context and malformed variant query into `undefined`. Live Medusa responses showed Marlowe (`prod_01M0NAYVQ6KEV8NG2BSWA3VHHF`, variant `variant_01M0NAYVRAFT0DDECTGCQM3GRD`) and Tidepool (`prod_01M0NAYVWGV0CGAWD0EYYS5EKM`, variant `variant_01M0NAYVXWP90Z00KA17GNN9MZ`) were both published, priced, and in stock. The shared resolver fix and regression suite are recorded above.

---

## 3. ENVIRONMENT FACTS (hard-won — do not rediscover)

Windows 11, PowerShell 5.1. Gotchas that cost hours:
- PS 5.1: no `&&` (use `if ($?) {}`); `[bracket]` paths are wildcards → use `-LiteralPath`; `Get-Content`/`Set-Content` mangle UTF-8 → mojibake (`â€"`, `â‚¬`). For any bulk file rewrite use Node or `[System.IO.File]::ReadAllText/WriteAllText` (UTF-8 no BOM). A repair pass pattern exists in git history (`fix-mojibake.tmp.cjs`, commit e533b2d era).
- UTF-8 BOM breaks Turbopack JSON parsing (`Error parsing package.json file`) — strip BOMs if you ever Set-Content JSON from PS.
- Native Windows PostgreSQL 17 owns `localhost:5432` → Docker Postgres is on **5433**. DATABASE_URL everywhere: `postgres://shoppingpal:shoppingpal@localhost:5433/shoppingpal`.
- Docker Desktop must be launched manually (`Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"`), wait for engine before compose.
- Playwright: `reuseExistingServer:!CI` silently reuses STALE servers → always `Get-NetTCPConnection -LocalPort 3100 | Stop-Process` + delete `apps/web/.data` before runs. Rebuild web before E2E after ANY code change.
- sonner toasts pause while hovered; mobile toaster spans full width — tests must move mouse off it (`page.mouse.move(8,120)`) or clicks get blocked forever.
- Next streaming can duplicate text nodes momentarily → strict-mode locator violations; use `.first()` on copy assertions.
- Ports: web dev 3000, E2E 3100, Medusa 9000, Typesense 8108, Redis 6379, Postgres host 5433.
- Background servers started via `Start-Process pnpm.cmd … -RedirectStandardOutput $env:TEMP\*.log`; PIDs in `$env:TEMP\medusa-pid.txt`. Medusa currently RUNNING on :9000.

Medusa-mode env for web/E2E:
```powershell
$env:MEDUSA_BACKEND_URL="http://localhost:9000"
$env:MEDUSA_PUBLISHABLE_KEY="pk_7327ddf3c97c65cb62984c1d43e2271968e9d273d85d73e2936f7e31e8f5f246"
$env:MEDUSA_REGION_ID="reg_01M0NPRJJ2EM1V9HSK9P6B3ZXC"
```

Commerce commands (cwd `apps/commerce`):
```powershell
$env:DATABASE_URL="postgres://shoppingpal:shoppingpal@localhost:5433/shoppingpal"
pnpm exec medusa db:migrate
pnpm run db:seed            # medusa exec ./src/scripts/seed-catalog.ts
pnpm exec medusa start      # :9000, admin disabled
```

---

## 4. REMAINING GATES (in order)

### Gate D — Medusa Auth cutover
- emailpass provider is default-enabled in v2: `POST /auth/customer/emailpass/register` then `/auth/customer/emailpass` (login) → JWT. Validate via `GET /store/customers/me` (Bearer).
- Replace `apps/web/lib/auth/server.ts` internals: `getSessionUser()` reads `sp_customer` httpOnly cookie → verifies JWT against `/store/customers/me`, returns `{id,email,name}`. Keep the same exported surface so UI unchanged.
- Sign-up/sign-in server actions call Medusa auth routes server-to-server; set cookie; then `mergeGuestCartAction` uses `MedusaCartProvider.attachCustomer(guestCartId, jwt)` for guest→user continuity (endpoint exists, implemented).
- Define `ActorContext` in packages/contracts per spec §12; derive server-side only (browser never sends privileged fields).
- DELETE Better Auth after parity: remove deps `better-auth`, files `lib/auth/client.ts`(rewrite thin), `app/api/auth/[...all]`, Better Auth tables from `db/schema.ts` (legacy schema dies fully in Gate L anyway), sign-in/up forms keep same UX but new actions.
- Qualify: register/login/logout E2E, guest cart continuity across auth, account/orders pages read from Medusa (`GET /store/customers/me/orders`? v2: orders via customer scope — check exact route in 2.19 docs; fallback custom API route in apps/commerce/src/api using admin/container if needed).

### Gate E — Typesense projection
- Container up (API key `shoppingpal-dev-key`, :8108).
- `apps/commerce/src/scripts/sync-typesense.ts`: create collection `products` (fields: id/handle/title/brand/category/description/tags[](facet)/specs flattened/price(facet)/in_stock(bool)/rating_tenths/sku/variant_id), upsert 86 docs from live Medusa data (not seed constants!) — proves projection-of-canonical.
- Web search seam: extend `lib/commerce/config.ts` with `SEARCH_BACKEND=typesense|catalog` ; when typesense, `getCatalogProvider().search()` routes keyword/facet queries through Typesense then REHYDRATES canonical state from Medusa (`getByIds`) before returning — invariant §13/§I. Stale-index tests: mutate Typesense doc directly (wrong price/stock) → assert purchase-path output uses Medusa values.
- Qualify per spec §29.4.

### Gate F — apps/agent (FastAPI + LangGraph + LangChain + Eve + Missions)
- Python 3.13 via `uv python install 3.13`. Layout per spec §7: `apps/agent/shoppingpal/{api,graph,nodes,domain,retrieval,ranking,tools,policies,observability}`, pyproject.toml, uv.lock.
- Deps: fastapi, uvicorn[standard], langgraph, langchain, langchain-openai (or anthropic/google optional), pydantic v2, asyncpg, ruff, pyright, pytest, httpx.
- API versioned `/api/v1/*`, Pydantic boundaries, OpenAPI, generate TS client into `packages/contracts/agent-api.ts` (hand-maintained acceptable if documented).
- ShoppingGraph nodes exactly as spec §15/K with conditional edges, checkpointer (langgraph-checkpoint-postgres to same agent DB), interrupts for Class C approvals.
- Structured outputs (spec §L schemas) via Pydantic + `with_structured_output`.
- **Eve**: no external Eve service exists — implement Eve IN-REPO as the conversational runtime module of apps/agent (`eve/`): sessions, SSE streaming envelope, approval interactions, model routing; it invokes ShoppingGraph through the typed boundary. Document this decision in docs/ARCHITECTURE.md. Remove AI SDK ToolLoopAgent outer loop from web once Eve parity proven (keep generative UI components; they consume the SAME typed payloads — adapt `app/api/chat/route.ts` to proxy Eve SSE when `AGENT_URL` set, else fall back to existing demo-agent (degraded contract preserved)).
- Shopping Missions: own tables in agent-domain Postgres (schema `agent`), fields per spec §18/N. Persist independent of chat/checkpoints. API endpoints + typed payloads (`ShoppingMissionSummary/Update`).
- Commerce mutations from agent: NOT direct Medusa writes from Python without policy — preferred topology: agent returns `CartProposal`; web executes via existing server actions (keeps actor/authz server-side). Document choice; alternatively signed internal endpoint. Idempotency keys (§24/T) mandatory either way.
- Gates: `uv sync --frozen`, `uv run ruff check .`, `uv run pyright`, `uv run pytest`.

### Safety/idempotency/observability (spec §20/23/24/25)
- operation_id = sha256(actor_id|graph_run_id|action_type|canonical_target|revision); replay tests.
- Price/inventory reverify node reads canonical state immediately pre-execute.
- Prompt-injection: treat retrieved/catalog text as untrusted; tool authority only from code; test injection strings cannot trigger mutations.
- correlation_id/actor_id/eve_session_id/mission_id/graph_run_id/commerce_operation_id propagated; structured logs; OTel exporter optional-by-env; LangSmith via env vars.

### Legacy removal (spec §27/W) — only after parity
Delete: Drizzle commerce tables/provider, custom CheckoutService order/payment authority, Better Auth, ToolLoopAgent outer runtime, PGlite commerce runtime, obsolete drizzle/ migrations folder. Keep static catalog ONLY if needed for zero-infra degraded browsing (document; commerce actions must degrade clearly, never simulate success — spec §26).

### Full E2E + clean clone + docs + secret audit + FINAL RECEIPT (spec §30/31/Z/AC/AD)
- Required E2E matrix incl. safety + degraded modes.
- Clean clone: fresh clone → `pnpm install --frozen-lockfile` → `uv sync --frozen` → `docker compose up -d` → bootstrap commerce → sync search → gates.
- Docs: README.md, docs/{ARCHITECTURE,AGENT_AUTHORITY_AND_STATE,ARCHITECTURE_CONVERGENCE_V1,OPERATIONS}.md matching reality.
- Secret audit: no .env committed, .env.example placeholders only, no node_modules/build/data in git.
- Output the exact receipt template from spec §AD — every field needs executed evidence; PASS_WITH_LIMITATIONS allowed only with concrete non-fabricated limitations.

---

## 5. CURRENT STATE AFTER GATE C
Gate C is committed as `5dac4c8`; the working tree was clean after the qualification commit. The next active gate is Gate D (Medusa Auth).

Servers left running: Medusa :9000 (log `$env:TEMP\medusa-start.log`) and the Docker trio. Web :3100 was stopped after both fresh-build E2E runs. Typesense is reachable on :8108 but remains Docker-healthcheck-unhealthy for the documented missing-`wget` reason.
