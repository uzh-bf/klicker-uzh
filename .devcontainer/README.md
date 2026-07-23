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
> frontend-control, olat-api, response-api, lti-service, chat**, the **two
> Hatchet workers**, and the **lecturer MCP server** (`mcp-lecturer`). All run
> in the one `app` container; the workers and `mcp-lecturer` have no
> port/route (`mcp-lecturer` listens on `localhost:7081`, reached in-container
> by `chat`). Still skipped: `analytics` (Python), `office-addin`, and `docs`
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

The lecturer MCP server (`mcp-lecturer`) also runs in the `app` container with
**no route** — it listens on `localhost:7081` and `apps/chat` reaches it there
directly (in-container; see `apps/chat/src/services/mcpUrl.ts`'s development
default). It needs `APP_ORIGIN_AUTH` (JWT issuer, already exported above —
namespaced per workspace the same way) and a JWT secret, which it takes from
`MCP_LECTURER_JWT_SECRET` or falls back to `APP_SECRET`.

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

`backend` needs a `HATCHET_CLIENT_TOKEN`, minted per Hatchet instance. The
`hatchet_token` sidecar mints one to a shared volume; `post-create` writes it to
`.devcontainer/.hatchet.env` (gitignored) and `post-start` sources it. The
backend **requires** it to boot — its `HatchetClient.init` runs at module load
(not lazy), so without the token the API crashes at startup and never serves.

The sidecar runs `hatchet-admin token create`, which writes to Hatchet's DB. It
must hit the **same** DB the server uses: hatchet-lite's generated `/config`
points the admin tool at its internal bundled Postgres (`127.0.0.1:5431`, only
reachable inside the hatchet container), so the sidecar is given `DATABASE_URL`
for the shared `postgres` service to override it. It mints within seconds of the
hatchet DB migrations finishing. If the API is down, check
`docker logs <project>-hatchet_token-1` and `.devcontainer/.hatchet.env`.

## What's inside

| Service                             | Image                                      | Purpose                                                               |
| ----------------------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| `app`                               | local `Dockerfile` (Node 24 + pnpm 11.5.0) | runs every routed app plus the two Hatchet workers and `mcp-lecturer` |
| `postgres`                          | `postgres:15`                              | DB (klicker-prod + shadow/lti/qa/hatchet via init.sql)                |
| `redis_exec`/`_assessment`/`_cache` | `redis:7`                                  | live-quiz exec / assessment / cache + pub/sub                         |
| `mailhog`                           | `mailhog/mailhog`                          | dev SMTP sink                                                         |
| `hatchet`                           | `hatchet-lite:v0.73.1`                     | workflow engine (gRPC :7077)                                          |
| `hatchet_token`                     | `hatchet-lite:v0.73.1`                     | one-shot: mint the client token                                       |
| `litellm`                           | `ghcr.io/berriai/litellm`                  | LLM proxy for chat (port 4000 intra-net)                              |

Environment lives in `devcontainer.env` (committed, dev-only). Lifecycle:
`post-create.sh` (install + build packages + prisma reset/push/seed + token) then
host-side `devrouter ensure` delivers its matching process helper and invokes
`post-start.sh` (set Klicker origins and call that helper). Runtime state is
`/tmp/devrouter-process-klicker-dev.state`: exact workspace, command, adapter
bytes, and declared non-secret runtime-origin values are fingerprinted for
reuse; stale owned groups are replaced boundedly, and unknown processes are
never killed. HTTP readiness remains in
`devrouter ensure .`; the root build script forces production mode even though
the live container exports `NODE_ENV=development`. Rerun ensure after
`pnpm run build` so stale Next.js dev output can trigger the single
container-recreate budget.

The image also carries uv `0.11.12` and selects Python 3.12, matching the
analytics image and lint CI so the root quality gate runs inside the container.

## Notes

- `node_modules` is a named volume (pnpm hoists natives into the root
  `node_modules/.pnpm`, so one root volume covers the monorepo).
- Reset the DB: `pnpm --filter @klicker-uzh/prisma exec prisma migrate reset --skip-seed --force`.
- `response-api` + both workers run `tsx --watch --env-file=.env`; node 24 errors
  if `.env` is missing, so `post-create` seeds an **empty** `.env` in each dir
  (the container env from `devcontainer.env` is what actually applies).
- Tier 3 (`chat`) needs an upstream LLM key: set `UPSTREAM_OPENAI_API_KEY`.
- `mcp-lecturer` runs plain `tsx` (no `--watch`) — `tsx --watch` is known to
  silently kill long-running Node 24 servers in this repo, so it deliberately
  does not use it in dev (no restart-on-change; restart the app manually via
  `devrouter exec . -- ...` after edits).
