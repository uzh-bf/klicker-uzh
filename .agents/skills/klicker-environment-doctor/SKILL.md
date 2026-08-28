---
name: klicker-environment-doctor
description: Diagnose and repair a broken KlickerUZH development environment. Use on a fresh clone/worktree, when pnpm install/build/check or git hooks fail, when Docker infra or ports misbehave, when codegen artifacts are stale, when Hatchet-dependent features do nothing, or when the database needs (re)seeding. Every other klicker skill routes here on environment failure.
---

# KlickerUZH Environment Doctor

Run the checks **in order** — later checks assume earlier ones pass. Background facts live in the wiki: [docs/getting-started.md](../../../docs/getting-started.md).

Provenance: checks 1–5 and 7–9 were executed and verified on macOS (2026-07-07). Check 6's process reconciler was executed in the Linux devcontainer image, and its host-side devrouter lifecycle was verified from a clean linked worktree on macOS (2026-07-13). Other steps marked **config-derived** were read from config, not executed — treat their exact output as unconfirmed.

## Agent ground rules

- **Never start dev servers unprompted.** Only bring up what the current task explicitly needs, and tear it down after (`./_down.sh` stops this checkout's compose project).
- **Never run `./_run_app_dependencies.sh` headless** — it has interactive `confirm` prompts and an `EXIT` trap that tears down the stack it just started. Run its steps individually instead (check 6).
- **Destructive resets (`pnpm run prisma:setup`, volume wipes) only on demonstrably test-seeded state** — check first (check 8), and ask when unsure. On shared/developer machines, other projects' containers are none of your business: scope every docker command to this checkout's compose project.

## Check 1 — package manager

```bash
pnpm --version   # MUST print 11.x
```

Wrong major (e.g. 9.x from a stale Volta shim; `VOLTA_FEATURE_PNPM` unset) **silently rewrites `pnpm-lock.yaml`**. If `git status` shows lockfile churn you didn't intend: `git checkout pnpm-lock.yaml`, then reinstall with pnpm 11 (e.g. `/opt/homebrew/bin/pnpm` or `export VOLTA_FEATURE_PNPM=1`).

## Check 2 — install and build state

| Symptom                                             | Fix                                                                                    |
| --------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `sh: run-p: command not found` (hooks fail)         | `pnpm install`                                                                         |
| `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`        | `pnpm install --config.confirmModulesPurge=false`                                      |
| `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` under `CI=true` | restore lockfile (check 1), install without `CI=true`                                  |
| ~19 packages fail `pnpm run check`                  | `pnpm run build` once (generates Prisma client, GraphQL outputs, dists), then re-check |

Healthy sequence from scratch inside the devcontainer: `pnpm install` → `pnpm run build` → `pnpm run check` (verified ~20s / ~1.5min / clean). The root build script forces `NODE_ENV=production`, including when the devcontainer exports `NODE_ENV=development` for its live apps. A production build can replace Next.js dev output; run `devrouter ensure .` afterward so the exact checkout runtime is health-checked and recovered when needed.

Managed DevPods share only the pnpm content store through the external Docker
volume `klicker-uzh-pnpm-store-v1`, mounted at `/pnpm/.pnpm-store`.
`.devcontainer/initialize.sh` creates it before Compose. Each worktree retains
its own `node_modules`, `.next`, and PostgreSQL volumes. Inspect the cache with
`docker volume inspect klicker-uzh-pnpm-store-v1`; do not remove it while any
Klicker DevPod is running, and never substitute broad Docker pruning.

## Check 3 — stale GraphQL codegen

Symptoms: typecheck can't find a `*Document`, or a running backend rejects an operation (persisted-query hash unknown outside dev/test). Fix:

```bash
pnpm --filter @klicker-uzh/graphql generate
test -f packages/graphql/src/ops.ts
test -f packages/graphql/src/public/client.json
test -f packages/graphql/src/public/server.json
git diff --exit-code -- packages/graphql/src/public/schema.graphql
```

The typed documents and persisted-query maps are ignored build outputs. A
package build regenerates them before Rollup; only the public SDL snapshot is
tracked for review and GraphQL tooling.

## Check 4 — stale Prisma schema sync

If `apps/analytics` complains about schema drift or a schema edit isn't visible: `pnpm run prisma:sync` (mirrors model files while preserving Analytics-owned `py.prisma` and `datasource.prisma`), then regenerate/build. Full ritual: [docs/data-and-migrations.md](../../../docs/data-and-migrations.md).

## Check 5 — port conflicts

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN   # repeat for 6379 6380 6381 7077 8888 80 443
```

`Bind for :::5432 failed: port is already allocated` means another stack holds the port — stop it or don't start the colliding service. Plain localhost and legacy host-based paths publish fixed ports, so only one such stack runs per machine. Parallel devcontainer worktrees use the port-free base compose file plus `.devcontainer/docker-compose.devrouter.yml`; the one-at-a-time fallback uses `.devcontainer/docker-compose.localhost.yml`.

The managed DevPod needs no Azure credentials for media or KB uploads: it starts a Blob-only Azurite service, routes `blob.klicker[.<workspace>].localhost`, and configures the exact Manage origin as local Blob CORS during `post-start.sh`. `Blob storage is not configured` means the app process predates that environment; run `devrouter ensure .` and retry against the printed Blob route. A browser CORS failure with working GraphQL should first be reproduced as an `OPTIONS` request to that route using the exact Manage origin. Do not print the SAS query. Production and staging Azure accounts still require exact deployed origins; never add localhost CORS to them.

## Check 6 — infra bring-up / server status (headless-safe)

Depending on your environment path:

### Path A: Managed devcontainer

Run the ownership-aware lifecycle check from the host, then inspect the exact container through devrouter:

```bash
devrouter ensure . [--profile <selection>]
devrouter exec . -- cat /tmp/devrouter-process-klicker-dev.state
devrouter exec . -- tail -n 50 /tmp/dev.log
```

This repository pins devrouter 0.0.42; managed profiles require 0.0.40 or
newer. `devrouter ensure`
delivers its matching process helper to the exact validated container and
fingerprints the workspace, selection, command, adapter bytes, and declared
non-secret origin allowlist. The helper replaces a stale owned process group
and leaves unknown processes untouched. Host-side ensure checks only the
selected routes and restores the last usable generated config after a failed
profile transition. Version 0.0.39 does not provide that rollback guarantee.

Use application profiles (`manage`, `pwa`, `chat`, `live-quiz`) for routed app
work and add independent capabilities (`ai`, `mcp`, `email`) only when needed.
Omitting the profile selects `full`. The `live-quiz` startup proof includes
Response API `/healthz` plus live general and response-processor workers.

Ordinary managed restarts preserve the worktree's `.next/dev` caches. Only the
confirmed stale-route signature requests one full `.next` removal for the exact
affected app, and symlinked cache targets fail closed.

`devrouter doctor --repo .` provides static diagnostics. `devrouter ensure .`
resolves the checkout-specific overlay and is the authoritative runtime proof.
Stop the exact runtime afterward with `devrouter stop .`; do not delete its
containers, volumes, branch, or worktree as routine cleanup.

### Path B: Host-based Setup

Manually boot the compose infrastructure:

```bash
docker compose config --quiet                       # resolves WITHOUT secrets (verified)
docker compose up -d postgres redis_exec redis_assessment redis_cache mailhog hatchet
docker compose ps                                   # everything Started/healthy?
```

Continuation for app work: `.github/scripts/wait-for-infra.sh`, then `./util/_create_hatchet_token.sh`, then `pnpm run --filter @klicker-uzh/prisma prisma:push`. Traefik path (`*.klicker.com`) additionally needs `/etc/hosts` entries, mkcert certs (`util/_create_ssl_certificates.sh`), and the `reverse_proxy_<os>` service.

## Check 7 — Hatchet and workers (config-derived)

Feature "does nothing" / mutation fails `workflow not found` → the Hatchet engine or a worker is missing, or a worker points at the wrong DB. Workers need the **same `DATABASE_URL`, `APP_SECRET`, Redis settings** as the apps, plus `HATCHET_CLIENT_TOKEN`. See [docs/async-and-workers.md](../../../docs/async-and-workers.md).

## Check 8 — database state (config-derived)

Seeded dev DB contains the AGENTS.md test accounts (`lecturer`, `testuser1..50` — values in AGENTS.md only). Prisma 7 reset/migrate commands are seed-free. On the legacy host stack, `pnpm run prisma:setup` wraps the reset/push/seed composite with Infisical. In the self-contained DevPod, use `pnpm --filter @klicker-uzh/prisma run prisma:reset:raw --force`, then `pnpm --filter @klicker-uzh/prisma run prisma:push:raw`, then `pnpm --filter @klicker-uzh/prisma-data run seed:raw` as shown in `.devcontainer/post-create.sh`. Use either path **only after confirming the volume holds no real work** (fresh volume, test course names like "Testkurs"). When in doubt, ask the user.

## Check 9 — secrets (config-derived)

App dev servers need Infisical (`infisical whoami` to verify auth); infra and builds do not. No Infisical access → use the `dev:raw`/localhost path and say so in your report instead of debugging secret-dependent features.
