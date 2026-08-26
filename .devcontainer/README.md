# Self-contained dev container

Self-contained local environment for `klicker-uzh`. No Infisical/Doppler, no
external EduID, no `/etc/hosts` edits — clone, route through devrouter, and run.
The devcontainer owns the whole stack (toolchain, Postgres, 3× Redis, MailHog,
Hatchet, install + build + seed, `turbo dev`);
[devrouter](https://github.com/rschlaefli/devrouter) fronts it on a shared
`:443` / `:5432`. Linked worktrees publish no host ports and can coexist;
the primary checkout intentionally keeps fixed localhost ports and is
one-at-a-time.

> **Scope:** all runnable apps — **backend, auth, frontend-pwa, frontend-manage,
> frontend-control, olat-api, response-api, lti-service, chat**, and the **two
> Hatchet workers**. All run in the one `app` container; the workers have no
> port/route. Still skipped: `analytics` (Python), `office-addin`, and `docs`
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
   - Postgres DB: `localhost:5432`

### Mode 2: Linked checkout

Use this to mirror production domain behaviors, test cookie-sharing over HTTPS, and enable parallel workspaces:

1. **Host prerequisite**: Install [devrouter](https://github.com/rschlaefli/devrouter) ≥ 0.0.38 and set it up:
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
devrouter ensure . --profile chat          # one application profile
devrouter ensure . --profile chat,ai,mcp   # additive merged selection
devrouter exec . -- <command...>
devrouter stop .
```

Open the Manage URL printed by `ensure` and log in as **`lecturer` / `abcd`**
(accept the terms checkbox). The dev servers run in the background; inspect
`/tmp/dev.log` through `devrouter exec` or an exact DevPod shell.

## Profiles

Profiles (devrouter >= 0.0.39) select three independent dimensions: routed
apps, optional Compose services, and managed processes. Merged selections are
additive and order-insensitive; omitting `--profile` keeps the all-on `full`
default. The committed native `devcontainer.json` stays all-on for VS Code and
direct DevPod use - only devrouter generated effective config selects less.

| Profile                                 | What starts                                                                   |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| `manage` / `pwa` / `chat` / `live-quiz` | That app set + API/Auth (+ PWA for chat; workers for live-quiz), the 3x Redis |
| `ai`                                    | LiteLLM only - no routes, no app process                                      |
| `mcp`                                   | The local MCP fixture (Benibot) only                                          |
| `email`                                 | MailHog only                                                                  |
| `full` (default)                        | Everything, including LiteLLM, MailHog, and the MCP fixture                   |

Postgres and Hatchet stay in the managed base for every profile (the backend
treats both as boot-critical). Capability-only selections keep the idle app
container plus that base and start no Turbo process; switching profiles never
recreates the container, reruns post-create, resets the database, or removes
volumes.

## How routing works

The monorepo runs **all apps in one container** via `turbo dev`;
devrouter's Traefik (on `devnet`) routes each hostname to that container's
internal port. The linked-worktree overlay publishes no host ports and exposes
`${WORKSPACE}-app` and `${WORKSPACE}-db` aliases. The primary overlay exposes
stable unnamespaced aliases plus fixed localhost ports. `.devrouter.yml` uses
the selected checkout identity in every proxy upstream.

| What              | Host                                                 | Upstream (devnet)       |
| ----------------- | ---------------------------------------------------- | ----------------------- |
| API (GraphQL)     | `https://api.klicker.<workspace>.localhost`          | `${WORKSPACE}-app:3000` |
| Auth              | `https://auth.klicker.<workspace>.localhost`         | `${WORKSPACE}-app:3010` |
| PWA (student)     | `https://pwa.klicker.<workspace>.localhost`          | `${WORKSPACE}-app:3001` |
| Manage (lecturer) | `https://manage.klicker.<workspace>.localhost`       | `${WORKSPACE}-app:3002` |
| Control           | `https://control.klicker.<workspace>.localhost`      | `${WORKSPACE}-app:3003` |
| OLAT API          | `https://olat-api.klicker.<workspace>.localhost`     | `${WORKSPACE}-app:3030` |
| Response API      | `https://response-api.klicker.<workspace>.localhost` | `${WORKSPACE}-app:7078` |
| LTI Service       | `https://lti.klicker.<workspace>.localhost`          | `${WORKSPACE}-app:4000` |
| Chat App          | `https://chat.klicker.<workspace>.localhost`         | `${WORKSPACE}-app:3004` |
| Postgres          | `db.klicker.<workspace>.localhost:5432`              | `${WORKSPACE}-db:5432`  |

The two Hatchet workers (`hatchet-worker-general`, `hatchet-worker-response-processor`)
also run in the `app` container but have **no port/route** — they consume the
Hatchet event queue (responses pushed by `response-api`).

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

`backend` needs a `HATCHET_CLIENT_TOKEN`. In `hatchet-lite-dev`, the engine
automatically mints its worker API token on boot to
`/config/authdisabled-token` (shared volume). `post-create` writes it to
`.devcontainer/.hatchet.env` (gitignored), and `post-start` sources it. On a
cold application profile, `post-start` also closes the boot race by waiting for
and persisting a token that appeared just after `post-create` timed out.
Capability-only profiles skip that wait. The backend **requires** the token to
boot because its `HatchetClient.init` runs at module load (not lazy).

## What's inside

| Service                             | Image                                      | Purpose                                                              |
| ----------------------------------- | ------------------------------------------ | -------------------------------------------------------------------- |
| `app`                               | local `Dockerfile` (Node 24 + pnpm 11.5.0) | runs every routed app plus the two Hatchet workers                   |
| `postgres`                          | `postgres:15`                              | DB (klicker-prod + shadow/lti/qa/hatchet via init.sql)               |
| `redis_exec`/`_assessment`/`_cache` | `redis:7`                                  | live-quiz exec / assessment / cache + pub/sub                        |
| `mailhog`                           | `mailhog/mailhog`                          | dev SMTP sink                                                        |
| `hatchet`                           | `hatchet-lite-dev:v0.101.0`                | workflow engine (gRPC :7077, no UI auth)                             |
| `litellm`                           | `ghcr.io/berriai/litellm-database:v1.96.2` | LLM proxy + Auto V2 complexity router for chat (port 4000 intra-net) |

Environment lives in `devcontainer.env` (committed, dev-only). Lifecycle:
host-side `initialize.sh` creates the persistent machine-local pnpm store,
`post-create.sh` links dependencies into the worktree-specific `node_modules`
volume and builds/seeds the workspace, then `devrouter ensure` delivers its
matching process helper and invokes `post-start.sh`. Runtime state is
`/tmp/devrouter-process-klicker-dev.state` for the app stack and
`/tmp/devrouter-process-klicker-local-mcp.state` for the seeded local MCP
fixture. Exact workspace, command, adapter bytes, and declared non-secret
runtime-origin values are fingerprinted for reuse; stale owned groups are
replaced boundedly, and unknown processes are never killed. The MCP command
also carries the fixture source hash so a source edit forces managed
replacement. The app command also fingerprints dependency inputs, Next.js route
structure, configuration, and the checked-out commit. A true process start
preserves each worktree's `.next/dev` output; a changed dependency fingerprint
runs one frozen install against the persistent `node_modules` volume and shared
pnpm content store.

Before `post-start` reports success, it probes every Next app's readiness
contract. Unauthenticated Chat must answer `401 application/json` on a nested
API route, and the committed shell pages of auth, PWA, manage, and control must
answer `2xx` HTML or a redirect. Five consecutive `404 text/html` responses on such a
known-existing route after the startup grace period identify stale Next.js
route state. Only that signature requests one managed restart with a full
`.next` cleanup for exactly the affected apps. Other errors fail closed without
removing caches; a data-driven 404, for example a missing quiz evaluation, is
an application failure rather than a cache signature. Run
`devrouter exec . -- pnpm run dev:doctor` for the same read-only check across
all five apps. The root build script forces production mode even though the
live container exports `NODE_ENV=development`; rerun `devrouter ensure .`
afterward to restore and prove the development runtime.

The image also carries uv `0.11.12` and selects Python 3.12, matching the
analytics image and lint CI so the root quality gate runs inside the container.

## Notes

- `node_modules` is a named volume (pnpm hoists natives into the root
  `node_modules/.pnpm`, so one root volume covers the monorepo). Its dependency
  stamp prevents reuse after lockfile or workspace-manifest changes.
- `/pnpm/.pnpm-store` is the only machine-shared cache. The external Docker
  volume `klicker-uzh-pnpm-store-v1` is created idempotently before Compose and
  survives individual DevPod deletion. `node_modules`, `.next`, and PostgreSQL
  data remain worktree-scoped.
- Removing `klicker-uzh-pnpm-store-v1` is destructive cache cleanup. Stop every
  Klicker DevPod that uses it first, then remove that exact volume manually with
  `docker volume rm klicker-uzh-pnpm-store-v1`; never use broad Docker pruning.
- Reset the DB without seeding: `pnpm --filter @klicker-uzh/prisma run prisma:reset:raw --force`.
- `response-api` runs `tsx --watch --env-file=.env`; both Hatchet workers compile
  with Rollup and run the emitted JavaScript under nodemon. Node 24 errors if
  `.env` is missing, so `post-create` seeds an **empty** `.env` in each dir (the
  container env from `devcontainer.env` is what actually applies).
- Tier 3 (`chat`) needs an upstream LLM key: set `UPSTREAM_OPENAI_API_KEY`.
- Auto V2 sends its Luna-low classification and semantic embedding requests to
  the same upstream as the selected answer model. With OpenRouter, use only
  seeded or synthetic content and expect the extra calls to add latency/cost.
- Benibot's seeded Tutor and Explainer modes use the read-only `doc_query`
  fixture at `http://localhost:1417/mcp`. Its log is `/tmp/local-mcp.log`.
