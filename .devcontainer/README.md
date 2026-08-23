# Self-contained dev container

Self-contained local environment for `klicker-uzh`. No Infisical/Doppler, no
external EduID, no `/etc/hosts` edits — clone, route through devrouter, and run.
The devcontainer owns the whole stack (toolchain, Postgres, 3× Redis, MailHog,
Azurite Blob Storage, Hatchet, install + build + seed, `turbo dev`);
[devrouter](https://github.com/rschlaefli/devrouter) fronts it on a shared
`:443` / `:5432`. Linked worktrees publish no host ports and can coexist;
the primary checkout intentionally keeps fixed localhost ports and is
one-at-a-time.

> **Scope:** all runnable apps — **backend, auth, frontend-pwa, frontend-manage,
> frontend-control, olat-api, response-api, lti-service, chat**, the **two
> Hatchet workers**, and both internal MCP servers (`mcp-lecturer` and
> `mcp-student`). All run in the one `app` container; the workers and MCP
> servers have no port/route (`mcp-lecturer` listens on `localhost:7081` and
> `mcp-student` on `localhost:7080`, both reached in-container by `chat`). Still
> skipped: `analytics` (Python), `office-addin`, and `docs`
> (no `dev` task / extra toolchain). The legacy host-based stack (`docker-compose.yml`,
> `util/traefik`, Infisical, `/etc/hosts` + mkcert `*.klicker.com`) is untouched.

## How to Run

You can run the devcontainer in two modes:

### Mode 1: Primary checkout

The primary checkout keeps fixed localhost ports and receives stable unnamespaced devrouter routes:

1. Run one-time setup: `devrouter setup --yes`.
2. Start and prove the checkout: `devrouter ensure .`.
3. The applications are exposed directly on your host's ports:
   - Student PWA: `http://localhost:3001`
   - Lecturer UI (Manage): `http://localhost:3002` (login: `lecturer` / `abcd`)
   - Mobile Controller: `http://localhost:3003`
   - Chat Assistant: `http://localhost:3004`
   - API Backend: `http://localhost:3000`
   - Auth Service: `http://localhost:3010`
   - MailHog UI: `http://localhost:8025`
   - Hatchet Dashboard: `http://localhost:8888`
   - Azurite Blob Storage: `http://localhost:10000/klickerdev`
   - Postgres DB: `localhost:5432`

### Mode 2: Linked checkout

Use this to mirror production domain behaviors, test cookie-sharing over HTTPS, and enable parallel workspaces:

1. **Host prerequisite**: Install [devrouter](https://github.com/rschlaefli/devrouter) ≥ 0.0.35 and set it up:
   ```bash
   devrouter setup --yes   # Traefik + the shared `devnet` + mkcert CA
   ```
2. Reconcile this existing linked worktree with one command:
   ```bash
   devrouter ensure .
   ```
   To create a new worktree instead, run `devrouter workspace up <branch-name>` from the main repository. Both commands persist one identity, select the devrouter overlay, mount linked Git metadata, start or attach the exact DevPod, prove the runtime, and reconcile routes.
3. Open `https://manage.klicker.<workspace>.localhost` (credentials: `lecturer` / `abcd`).

Do not use bare `devpod up`, manual `WORKSPACE`, or per-app `--workspace` route loops for this managed devcontainer. Those paths bypass the identity and runtime proof.

## Checkout lifecycle

```bash
devrouter ensure .
devrouter exec . -- <command...>
devrouter stop .
```

Open the Manage URL printed by `ensure` and log in as **`lecturer` / `abcd`**
(accept the terms checkbox). The dev servers run in the background; inspect
`/tmp/dev.log` through `devrouter exec` or an exact DevPod shell.

## How routing works

The monorepo runs **all apps in one container** via `turbo dev`;
devrouter's Traefik (on `devnet`) routes each hostname to that container's
internal port. The linked-worktree overlay publishes no host ports and exposes
`${WORKSPACE}-app` and `${WORKSPACE}-db` aliases. The primary overlay exposes
stable unnamespaced aliases plus fixed localhost ports. `.devrouter.yml` uses
the selected checkout identity in every proxy upstream.

| What              | Host                                                 | Upstream (devnet)            |
| ----------------- | ---------------------------------------------------- | ---------------------------- |
| API (GraphQL)     | `https://api.klicker.<workspace>.localhost`          | `${WORKSPACE}-app:3000`      |
| Auth              | `https://auth.klicker.<workspace>.localhost`         | `${WORKSPACE}-app:3010`      |
| PWA (student)     | `https://pwa.klicker.<workspace>.localhost`          | `${WORKSPACE}-app:3001`      |
| Manage (lecturer) | `https://manage.klicker.<workspace>.localhost`       | `${WORKSPACE}-app:3002`      |
| Control           | `https://control.klicker.<workspace>.localhost`      | `${WORKSPACE}-app:3003`      |
| OLAT API          | `https://olat-api.klicker.<workspace>.localhost`     | `${WORKSPACE}-app:3030`      |
| Response API      | `https://response-api.klicker.<workspace>.localhost` | `${WORKSPACE}-app:7078`      |
| Blob Storage      | `https://blob.klicker.<workspace>.localhost`         | `${WORKSPACE}-azurite:10000` |
| Graph Blob source | `http://127.0.0.1:10003` (host only)                 | `${WORKSPACE}-azurite:10000` |
| LTI Service       | `https://lti.klicker.<workspace>.localhost`          | `${WORKSPACE}-app:4000`      |
| Chat App          | `https://chat.klicker.<workspace>.localhost`         | `${WORKSPACE}-app:3004`      |
| Postgres          | `db.klicker.<workspace>.localhost:5432`              | `${WORKSPACE}-db:5432`       |

The two Hatchet workers (`hatchet-worker-general`, `hatchet-worker-response-processor`)
also run in the `app` container but have **no port/route** — they consume the
Hatchet event queue (responses pushed by `response-api`).

Azurite's browser-facing account URL is
`https://blob.klicker.<workspace>.localhost/klickerdev`. Server-side SDK calls
use the workspace-specific Azurite alias over HTTP; `post-start.sh` configures
the exact Manage origin as Blob CORS on that local emulator. This split keeps
browser uploads production-like without making Node trust the host's routed
certificate or requiring Azure credentials.

The linked DevRouter overlay also maps the same Azurite container to loopback
port `10003` by default. `KB_GRAPH_BLOB_HOST_PORT` can override that host port;
the generated graph source URLs use `KB_GRAPH_BLOB_ACCOUNT_URL` and never
change the browser-facing upload URL. Cleartext graph source URLs are accepted
only for loopback and `.localhost` development hosts.

The lecturer and student MCP servers also run in the `app` container with **no
route** — they listen on `localhost:7081` and `localhost:7080`, respectively,
and `apps/chat` reaches them directly (in-container; see
`apps/chat/src/services/lecturerMcp.ts:getLecturerMcpUrl` and
`apps/chat/src/services/studentPracticeMcp.ts:getStudentPracticeMcpUrl`). Both
need `APP_ORIGIN_AUTH` (JWT issuer, already exported above — namespaced per
workspace the same way). Lecturer tokens use `MCP_LECTURER_JWT_SECRET` or fall
back to `APP_SECRET`; student tokens use `APP_SECRET`.

Infra (the 3× Redis, MailHog, Hatchet) is **not** routed — the apps reach it by
compose DNS (`redis_exec`, `redis_cache`, `redis_assessment`, `mailhog`,
`hatchet:7077`). Connect to the DB from the host with direct-SSL:

```bash
psql "host=db.klicker.<workspace>.localhost port=5432 user=klicker-prod password=klicker \
      dbname=klicker-prod sslmode=require sslnegotiation=direct"
```

## Auth model in dev

EduID is replaced by klicker's own **credentials login** (no OIDC mock needed).
Seeded users (`packages/prisma-data`): `lecturer`/`abcd` (ADMIN), `free`/`abcd`,
`pro1..3`/`abcd`, and `testuser1..50`/`abcdabcd`. Cross-app sessions work because
linked-worktree apps are served under the same `klicker.<workspace>.localhost`
parent and the cookie domain resolves to that parent. `post-start.sh` rewrites
the public origins and `AUTH_*_ALLOWED_HOSTS` when `WORKSPACE` is set, because
the hardcoded defaults only know `klicker.com`.

## Hatchet token

`backend` needs a `HATCHET_CLIENT_TOKEN`. In `hatchet-lite-dev`, the engine automatically mints its worker API token on boot to `/config/authdisabled-token` (shared volume); `post-create` writes it to `.devcontainer/.hatchet.env` (gitignored) and `post-start` sources it. The backend **requires** it to boot — its `HatchetClient.init` runs at module load (not lazy).

## What's inside

| Service                             | Image                                            | Purpose                                                                 |
| ----------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `app`                               | local `Dockerfile` (Node 24 + pnpm 11.5.0)       | runs every routed app plus the two Hatchet workers and both MCP servers |
| `postgres`                          | `postgres:15`                                    | DB (klicker-prod + shadow/lti/qa/hatchet via init.sql)                  |
| `redis_exec`/`_assessment`/`_cache` | `redis:7`                                        | live-quiz exec / assessment / cache + pub/sub                           |
| `mailhog`                           | `mailhog/mailhog`                                | dev SMTP sink                                                           |
| `azurite`                           | `mcr.microsoft.com/azure-storage/azurite:3.36.0` | local Blob service for browser uploads                                  |
| `hatchet`                           | `hatchet-lite-dev:v0.101.0`                      | workflow engine (gRPC :7077, no UI auth)                                |
| `litellm`                           | `ghcr.io/berriai/litellm-database:v1.96.2`       | LLM proxy + Auto V2 complexity router for chat (port 4000 intra-net)    |

Environment lives in `devcontainer.env` (committed, dev-only). Lifecycle:
`post-create.sh` (install + build packages + prisma reset/push/seed + token) then
host-side `devrouter ensure` delivers its matching process helper and invokes
`post-start.sh` (set Klicker origins and call that helper). Runtime state is
`/tmp/devrouter-process-klicker-dev.state` for the app stack and
`/tmp/devrouter-process-klicker-local-mcp.state` for the seeded local MCP
fixture. Exact workspace, command, adapter bytes, and declared non-secret
runtime-origin values are fingerprinted for reuse; stale owned groups are
replaced boundedly, and unknown processes are never killed. The MCP command
also carries the fixture source hash so a source edit forces managed
replacement. HTTP readiness remains in
`devrouter ensure .`; the root build script forces production mode even though
the live container exports `NODE_ENV=development`. Rerun ensure after
`pnpm run build` so stale Next.js dev output can trigger the single
container-recreate budget.

The image also carries uv `0.11.12` and selects Python 3.12, matching the
analytics image and lint CI so the root quality gate runs inside the container.

## Local KB ingestion and graph builder

The Klicker worker uses the producer-neutral `data-ingestion` resource API for
KB resource acceptance. It is not part of this DevPod compose project. Start
the sibling service on the host before clicking **Ingest**:

```bash
DATA_INGESTION_REPO=/path/to/data-ingestion \
KLICKER_KB_APP_ORIGIN=https://api.klicker.<workspace>.localhost \
  ./util/start-local-kb-ingestion.sh
```

This starts the real `modules/ingestion-api` service on
`http://127.0.0.1:18081` with an ignored SQLite state file and a local-only
Klicker producer registry. `KB_INGESTION_LOCAL_PORT` can override the
loopback-only host port. The DevPod reaches the default through
`http://host.docker.internal:18081`; the app's source-gateway URL is rewritten
to the namespaced API route so blob sources remain addressable by a host-side
worker. The API service accepts operations durably; running the separate
data-ingestion dispatcher/worker fleet is still required for downstream
fetching, embeddings, and vector-store activation.

For the full local dispatcher/fetch-worker path, explicitly point the API and
worker fleet at the same PostgreSQL state store. SQLite remains the default for
API-only development:

```bash
KB_INGESTION_STATE_BACKEND=postgres \
KB_INGESTION_STATE_DSN=postgresql://<local-user>@127.0.0.1:<pg-port>/hatchet \
KB_INGESTION_STATE_SCHEMA=ingestion_state_local \
DATA_INGESTION_REPO=/path/to/data-ingestion \
KLICKER_KB_APP_ORIGIN=https://api.klicker.<workspace>.localhost \
  ./util/start-local-kb-ingestion.sh --foreground
```

The worker-side `INGESTION_STATE_DSN`, `INGESTION_STATE_SCHEMA`, and
`INGESTION_STATE_ENSURE_SCHEMA` must use the same values. Keep the source
gateway credential in the worker environment rather than a committed file.

For the graph-builder boundary, start the canonical
`kg-content-generation/lightrag_research` local Hatchet/FalkorDB stack, then
write its local token into the ignored DevPod env file:

```bash
KG_CONTENT_GENERATION_REPO=/path/to/kg-content-generation
(
  cd "$KG_CONTENT_GENERATION_REPO"
  FALKORDB_HOST_PORT=16379 \
    ./lightrag_research/scripts/hatchet/start_local_stack.sh
)

KB_GRAPH_FALKORDB_HOST_PORT=16379 \
KG_CONTENT_GENERATION_REPO="$KG_CONTENT_GENERATION_REPO" \
  ./util/configure-local-kb-graph-builder.sh
```

The alternate host port leaves DevRouter's Redis port untouched while the
host-side graph worker and DevPod use the same FalkorDB instance. Do not copy
model IDs from an older local branch; this script keeps the branch's current
model configuration.

Restart or re-run `devrouter ensure <checkout>` after generating that file so
the app worker loads the local Hatchet and FalkorDB connection. No graph token
is committed. Without this optional file, the graph integration remains
disabled and the rest of the DevPod still starts normally.

## Notes

- `node_modules` is a named volume (pnpm hoists natives into the root
  `node_modules/.pnpm`, so one root volume covers the monorepo).
- Reset the DB without seeding: `pnpm --filter @klicker-uzh/prisma run prisma:reset:raw --force`.
- `response-api` + both workers run `tsx --watch --env-file=.env`; node 24 errors
  if `.env` is missing, so `post-create` seeds an **empty** `.env` in each dir
  (the container env from `devcontainer.env` is what actually applies).
- Tier 3 (`chat`) needs an upstream LLM key: set `UPSTREAM_OPENAI_API_KEY`.
- Both MCP servers run plain `tsx` (no `--watch`) — `tsx --watch` is known to
  silently kill long-running Node 24 servers in this repo, so they deliberately
  do not use it in dev (no restart-on-change; restart the app manually via
  `devrouter exec . -- ...` after edits).
- Auto V2 sends its Luna-low classification and semantic embedding requests to
  the same upstream as the selected answer model. With OpenRouter, use only
  seeded or synthetic content and expect the extra calls to add latency/cost.
- Benibot's seeded Tutor and Explainer modes use the read-only `doc_query`
  fixture at `http://localhost:1417/mcp`. Its log is `/tmp/local-mcp.log`.
