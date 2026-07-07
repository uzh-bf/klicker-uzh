# PLAN — devcontainer phase 2 (remaining apps)

- **Date:** 2026-06-15
- **Branch:** `feat/devcontainer-phase2-tier1` (stacked on `feat/devcontainer-devnet`, Phase 1 PR #5119)
- **Goal:** add the remaining runnable klicker apps to the same single-container `turbo dev` + devrouter pattern. No new architecture — more `--filter` entries, more routes, more env, one optional new infra container (LiteLLM, chat tier only).

Phase 1 (merged scope of #5119) onboarded the 5 core apps: backend-docker, auth, frontend-pwa/manage/control. All run in the ONE `app` container; devrouter routes each `*.klicker.localhost` host to an internal port over the shared `devnet` network. Infra (postgres / 3× redis / mailhog / hatchet) reached by compose DNS.

## Tiers

Sequenced by effort. Each tier ships as its own PR so it can be validated (clean-rebuild zero-touch test) and merged independently.

### Tier 1 — zero new infra (THIS branch)

Reuse Phase-1 infra entirely. Two HTTP apps get routes; two hatchet workers have no port/route.

| App | Pkg | Port (dev) | Dev cmd | `--env-file`? | Route |
|---|---|---|---|---|---|
| olat-api | `@klicker-uzh/olat-api` | 3030 | `tsx --watch src/index.ts` | no | `olat-api.klicker.localhost → 3030` |
| response-api | `@klicker-uzh/response-api` | 7078 | `tsx --watch --env-file=.env` | **yes** | `response-api.klicker.localhost → 7078` |
| hatchet-worker-general | `@klicker-uzh/hatchet-worker-general` | — | `tsx --watch --env-file .env` | **yes** | none |
| hatchet-worker-response-processor | `@klicker-uzh/hatchet-worker-response-processor` | — | `tsx --watch --env-file .env` | **yes** | none |

**Key gotcha discovered (Phase-2 #28):** response-api + both workers run `tsx --watch --env-file=.env`. Node 20 (`node:20-bookworm-slim`, 20.19.4) **hard-errors if `.env` is missing** (`--env-file-if-exists` is the tolerant variant; not used here). `.env` / `.env.*` are gitignored, and no `.env` is created in the container. Fix: `post-create` creates an **empty** `.env` in each of the three app dirs. Empty (not a copy of `.env.example`) so the container's process env — devcontainer.env — wins; `.env.example` carries `localhost` values that would wrongly override compose-DNS hosts. olat-api's dev cmd has no `--env-file`, so it inherits container env directly and is truly zero-touch.

**Boot deps (all already provided by Phase 1):**
- response-api imports `@klicker-uzh/hatchet` (`HatchetClient.init` at module load) → needs `HATCHET_CLIENT_TOKEN` at boot. Supplied via `.hatchet.env` (sourced by post-start). Same for both workers (register with the engine).
- response-api: redis_exec + redis_assessment (Phase-1 env), `APP_ORIGIN_*` (Phase-1 env).
- worker-general: postgres + 3 redis + hatchet. No new env.
- worker-response-processor: redis_exec (live-quiz default) + `APP_SECRET` (set); postgres only in assessment mode.

**New env (devcontainer.env):**
- `OLAT_API_KEY=abcd` — olat-api reads `process.env.OLAT_API_KEY` (dev value; gates its bearer auth).
- `CORS_ALLOWED_ORIGINS=https://pwa.klicker.localhost` — response-api allow-list for the PWA browser origin that POSTs responses (`NEXT_PUBLIC_ADD_RESPONSE_URL`, already set Phase 1).

**turbo.json globalEnv audit:** `OLAT_API_KEY`, `ASSESSMENT_MODE`, all `LTI_*`, `APP_ORIGIN_LTI`, OpenAI/Langfuse vars are **already declared**. Gap = `CORS_ALLOWED_ORIGINS` (not NEXT_PUBLIC, so no Next framework-inference; would be stripped by strict-env → same class of bug as the Phase-1 `REDIS_ASSESSMENT_*` strip). Add it.

**Exact edits:**
1. `.devcontainer/devcontainer.env` — add `OLAT_API_KEY` + `CORS_ALLOWED_ORIGINS` (Phase-2 block).
2. `turbo.json` — add `CORS_ALLOWED_ORIGINS` to `globalEnv` (alphabetical).
3. `.devcontainer/post-create.sh` — create empty `.env` for response-api + 2 workers (idempotent `touch`/`: >` only if absent).
4. `.devcontainer/post-start.sh` — add 4 `--filter`s (olat-api, response-api, both workers); update the echoed route list.
5. `.devcontainer/docker-compose.yml` — add `olat-api.klicker.localhost` + `response-api.klicker.localhost` to `app.extra_hosts` (keeps the "any *.klicker.localhost resolves" invariant).
6. `.devrouter.yml` — add http routes olat-api→3030, response-api→7078; update PHASE comment.
7. `.devcontainer/README.md` + `AGENTS.md` — document the two new hosts + the worker/`.env` note.

No `devcontainer.json` change — no new containers (all run in `app`); workers/APIs need no `runServices` entry.

**Verification:** clean rebuild (devpod delete + volume purge + devpod up) = zero-touch test. Then: login manage (lecturer/abcd) → run a live-quiz → student PWA submits a response → confirm it flows response-api → hatchet → worker-response-processor → DB → manage reflects it. Hit olat-api `/health` and Scalar `/api-docs` through `olat-api.klicker.localhost` with the API key. Confirm both workers register (hatchet UI / logs).

### Tier 2 — build-race pre-build, LMS deferred (follow-up PR)

- **lti** (`@klicker-uzh/lti-service`, port 4000 via `LTI_PORT`): `dev:lti` = `rollup --watch` ∥ `nodemon` → **build race** (same failure as backend-docker). Add `@klicker-uzh/lti-service` to the post-create pre-build filter so `dist` exists before `turbo dev`. Uses `klicker-prod-lti` DB (already created by `util/init.sql`) when `LTI_DB_TYPE=postgres`. Boots self-contained; full LTI launch needs an external LMS → **verify boot + health only**, document LMS integration as manual. `LTI_*` env already in turbo.json globalEnv; add the dev values + `APP_ORIGIN_LTI` to devcontainer.env. Route `lti.klicker.localhost → 4000`.

### Tier 3 — new infra (LiteLLM) + bring-your-own-key (last PR)

- **chat** (`@klicker-uzh/chat`, port 3004, `next dev --turbo`): chat tables already in Phase-1 schema. Needs an LLM endpoint. Recommended: add a **LiteLLM container** to `.devcontainer/docker-compose.yml` (mirror root compose + `util/litellm/config.yaml`), point `OPENAI_BASE_URL=http://litellm:4000`, require a user-supplied `UPSTREAM_OPENAI_API_KEY`. Langfuse + MCP (Context7 cloud, KB local:1417) optional / graceful-degrade. **Not zero-touch** — gate behind a documented "set `UPSTREAM_OPENAI_API_KEY` to enable chat" note; never fail boot. Env: `NEXT_PUBLIC_CHAT_URL`, `APP_ORIGIN_CHAT`, `OPENAI_BASE_URL` (all NEXT_PUBLIC auto-inferred; `APP_ORIGIN_CHAT` already-style). Route `chat.klicker.localhost → 3004`.

### SKIP

- **analytics** — Python/Poetry ETL, no `dev` turbo task, no port. Needs Python toolchain.
- **office-addin** — port 3020 HTTPS, no `dev` task, needs Office host; taskpane redirects to prod.
- **docs** — Docusaurus (`dev:docs`, 5500), pure static, no backend dep. Optional.

## Skill feedback loop

- Tier 1 → devrouter `devcontainer-onboarding`: "once container+routing exist, adding apps = more `--filter`s" + new GOTCHA #28 (`tsx --env-file` hard-errors on missing file → seed empty `.env`).
- Tier 2 → reinforces build-race pre-build (#26).
- Tier 3 → new gotcha: "optional service needing an upstream secret — gate, don't fail boot."

## Progress

- 2026-06-15: plan written; Tier 1 implemented on `feat/devcontainer-phase2-tier1` (8 files: devcontainer.env, turbo.json, post-create.sh, post-start.sh, docker-compose.yml, .devrouter.yml, README.md, AGENTS.md).
- 2026-06-15: Tier 1 smoke-validated in the live `becd4` container (non-destructive, alongside the running core 5). All 4 new apps boot under container env: olat-api `/health` 200 + `/api-docs` 200 with `Bearer abcd` (port 3030); response-api root 200, both Redis up, CORS = `https://pwa.klicker.localhost`, assessment disabled (port 7078); both Hatchet workers connect (`LISTEN_STRATEGY_V2`, "listening for actions"). The empty-`.env` seeding fixes the node-20 `--env-file` crash (no `ENOENT`). No runtime errors (only pre-existing rollup type-warnings in workspace packages). Pending: full clean-rebuild zero-touch acceptance test; commit + draft PR stacked on #5119.
