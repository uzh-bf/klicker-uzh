# Devrouter Pilot Runbook (API + PWA + Chat)

Date: 2026-02-15
Repository: `/Volumes/HOME/Git/klicker/klicker-uzh`
Devrouter version: 0.0.14

## Scope

Pilot validation for:
- `api.klicker.localhost` (backend/GraphQL)
- `pwa.klicker.localhost` (student PWA)
- `chat.klicker.localhost` (AI chat)
- `db.klicker.localhost` (postgres TCP)
- Redis services (auto-started as dependencies)

Using:
- `.devrouter.yml`
- `docker-compose.devrouter.yml`
- `util/devrouter/run-api.sh`
- `util/devrouter/run-pwa.sh`
- `util/devrouter/run-chat.sh`

## App Dependency Graph

```
api  --> postgres, redis-exec, redis-assessment, redis-cache
chat --> postgres
pwa  --> (none)
```

Running `dev app run api` auto-starts postgres + all 3 Redis instances.
Running `dev app run chat` auto-starts postgres only.

## Prerequisites

- **Infisical CLI** must be installed and authenticated (`infisical login`)
- `.infisical.json` in repo root points to the correct project
- The Infisical `dev` environment provides `APP_SECRET`, `AZURE_*`, and other secrets needed for authenticated flows

## Quick Start

```bash
dev up
dev tls install
dev app run api --repo . --yes     # starts postgres + redis automatically
dev app run pwa --repo . --yes     # in another terminal
dev app run chat --repo . --yes    # in another terminal
```

## Validation Commands

```bash
dev doctor --repo .
dev app ls --repo .
dev ls
curl -kI https://api.klicker.localhost/healthz
curl -kI https://pwa.klicker.localhost
curl -kI https://chat.klicker.localhost
```

## Secret Injection

All `hostRun` commands are wrapped with `infisical run --env dev --` in `.devrouter.yml`. Infisical injects secrets (APP_SECRET, AZURE_*, etc.) as environment variables before the run script executes.

**DATABASE_URL precedence**: If Infisical provides `DATABASE_URL`, the run scripts (`run-api.sh`, `run-chat.sh`) explicitly `export DATABASE_URL=...` using devrouter-injected `POSTGRES_HOST`/`POSTGRES_PORT`, which overrides the Infisical value. This is correct -- the devrouter-managed Postgres coordinates must win.

## Known Warnings

1. **Postgres credential mismatch** (`repo.postgres-credentials WARN`)
   - Expected: repo uses `klicker-prod/klicker/klicker-prod` instead of devrouter default prisma creds.
   - Mitigation: `run-api.sh` and `run-chat.sh` override `DATABASE_URL`/`SHADOW_DATABASE_URL` when `POSTGRES_PORT` is injected.

## Upgrade History

- **v0.0.10 -> v0.0.14** (2026-02-15): Added Redis as `kind: dependency` entries (v0.0.13 feature), added chat app, bumped devrouter version, added healthchecks to docker-compose services.
- **v0.0.10** (initial): API + PWA + postgres pilot. Redis required manual startup.
