# Dev container (Phase 1 + Phase 2 Tier 1)

Self-contained local environment for `klicker-uzh`. No Infisical/Doppler, no
external EduID, no `/etc/hosts` edits — clone, route through devrouter, and run.
The devcontainer owns the whole stack (toolchain, Postgres, 3× Redis, MailHog,
Hatchet, install + build + seed, `turbo dev`);
[devrouter](https://github.com/rschlaefli/devrouter) fronts it on a shared
`:443` / `:5432` so many projects coexist with **zero host-port collisions**
(nothing is published on the host).

> **Scope:** all runnable apps — **backend, auth, frontend-pwa, frontend-manage,
> frontend-control, olat-api, response-api, lti-service, chat**, and the **two
> Hatchet workers**. All run in the one `app` container; the workers have no
> port/route. Still skipped: `analytics` (Python), `office-addin`, and `docs`
> (no `dev` task / extra toolchain). The legacy host-based stack (`docker-compose.yml`,
> `util/traefik`, Infisical, `/etc/hosts` + mkcert `*.klicker.com`) is untouched.

## How to Run

You can run the devcontainer in two modes:

### Mode 1: Plain localhost (Default & Self-Contained)

Use this if you are running in a headless cloud server or want to avoid installing Traefik/mkcert on your host:

1. Ensure `.devcontainer/devcontainer.json` specifies only `docker-compose.yml` (default).
2. Start the devcontainer (`devpod up .` or via VS Code).
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

### Mode 2: devrouter (Routed HTTPS domains)

Use this to mirror production domain behaviors and test cookie-sharing over HTTPS:

1. **Host prerequisite**: Install [devrouter](https://github.com/rschlaefli/devrouter) (≥ 0.0.21) and start it:
   ```bash
   dev up && dev tls install   # Traefik + the shared `devnet` + mkcert CA
   ```
2. Edit `.devcontainer/devcontainer.json` to include the devrouter overlay:
   ```json
   "dockerComposeFile": ["docker-compose.yml", "docker-compose.devrouter.yml"]
   ```
3. Start the devcontainer (`devpod up .` or via VS Code).
4. Run the routing registrar command on your host:
   ```bash
   for a in api auth pwa manage control olat-api response-api lti chat db; do dev app run "$a"; done
   ```
5. Open `https://manage.klicker.localhost` (credentials: `lecturer` / `abcd`).

## Run with DevPod

```bash
devpod up . --ide none         # builds image, starts infra, installs, builds, seeds
for a in api auth pwa manage control olat-api response-api lti chat db; do dev app run "$a"; done   # register routes
```

Open <https://manage.klicker.localhost> and log in as **`lecturer` / `abcd`**
(accept the terms checkbox). The dev servers auto-start in the background
(`tail -f /tmp/dev.log`; first compile can take a minute).

## How routing works

The monorepo runs **all apps in the one `klicker-app` container** via
`turbo dev`; devrouter's Traefik (on `devnet`) routes each hostname to that
container's internal port — no published host ports.

| What              | Host                                     | Upstream (devnet)  |
| ----------------- | ---------------------------------------- | ------------------ |
| API (GraphQL)     | `https://api.klicker.localhost`          | `klicker-app:3000` |
| Auth              | `https://auth.klicker.localhost`         | `klicker-app:3010` |
| PWA (student)     | `https://pwa.klicker.localhost`          | `klicker-app:3001` |
| Manage (lecturer) | `https://manage.klicker.localhost`       | `klicker-app:3002` |
| Control           | `https://control.klicker.localhost`      | `klicker-app:3003` |
| OLAT API          | `https://olat-api.klicker.localhost`     | `klicker-app:3030` |
| Response API      | `https://response-api.klicker.localhost` | `klicker-app:7078` |
| LTI Service       | `https://lti.klicker.localhost`          | `klicker-app:4000` |
| Chat App          | `https://chat.klicker.localhost`         | `klicker-app:3004` |
| Postgres          | `db.klicker.localhost:5432`              | `klicker-db:5432`  |

The two Hatchet workers (`hatchet-worker-general`, `hatchet-worker-response-processor`)
also run in the `app` container but have **no port/route** — they consume the
Hatchet event queue (responses pushed by `response-api`).

Infra (the 3× Redis, MailHog, Hatchet) is **not** routed — the apps reach it by
compose DNS (`redis_exec`, `redis_cache`, `redis_assessment`, `mailhog`,
`hatchet:7077`). Connect to the DB from the host with direct-SSL:

```bash
psql "host=db.klicker.localhost port=5432 user=klicker-prod password=klicker \
      dbname=klicker-prod sslmode=require sslnegotiation=direct"
```

## Auth model in dev

EduID is replaced by klicker's own **credentials login** (no OIDC mock needed).
Seeded users (`packages/prisma-data`): `lecturer`/`abcd` (ADMIN), `free`/`abcd`,
`pro1..3`/`abcd`, and `testuser1..50`/`abcdabcd`. Cross-app sessions work because
every app is served under `*.klicker.localhost` and the cookie domain resolves to
`klicker.localhost` (from `NEXTAUTH_URL`); the `AUTH_*_ALLOWED_HOSTS` env adds the
`*.klicker.localhost` hosts that the hardcoded defaults (only `klicker.com`) miss.

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

| Service                             | Image                                      | Purpose                                                |
| ----------------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| `app`                               | local `Dockerfile` (Node 24 + pnpm 11.5.0) | runs `turbo dev` for the core + Tier-1 apps + workers  |
| `postgres`                          | `postgres:15`                              | DB (klicker-prod + shadow/lti/qa/hatchet via init.sql) |
| `redis_exec`/`_assessment`/`_cache` | `redis:7`                                  | live-quiz exec / assessment / cache + pub/sub          |
| `mailhog`                           | `mailhog/mailhog`                          | dev SMTP sink                                          |
| `hatchet`                           | `hatchet-lite:v0.73.1`                     | workflow engine (gRPC :7077)                           |
| `hatchet_token`                     | `hatchet-lite:v0.73.1`                     | one-shot: mint the client token                        |
| `litellm`                           | `ghcr.io/berriai/litellm`                  | LLM proxy for chat (port 4000 intra-net)               |

Environment lives in `devcontainer.env` (committed, dev-only). Lifecycle:
`post-create.sh` (install + build packages + prisma reset/push/seed + token) then
`post-start.sh` (launch `turbo dev`).

## Notes

- `node_modules` is a named volume (pnpm hoists natives into the root
  `node_modules/.pnpm`, so one root volume covers the monorepo).
- Reset the DB: `pnpm --filter @klicker-uzh/prisma exec prisma migrate reset --skip-seed --force`.
- `response-api` + both workers run `tsx --watch --env-file=.env`; node 24 errors
  if `.env` is missing, so `post-create` seeds an **empty** `.env` in each dir
  (the container env from `devcontainer.env` is what actually applies).
- Tier 3 (`chat`) needs an upstream LLM key: set `UPSTREAM_OPENAI_API_KEY`.
