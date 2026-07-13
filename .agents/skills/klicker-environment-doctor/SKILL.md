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

| Symptom                                             | Fix                                                                            |
| --------------------------------------------------- | ------------------------------------------------------------------------------ |
| `sh: run-p: command not found` (hooks fail)         | `pnpm install`                                                                 |
| `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`        | `pnpm install --config.confirmModulesPurge=false`                              |
| `ERR_PNPM_LOCKFILE_CONFIG_MISMATCH` under `CI=true` | restore lockfile (check 1), install without `CI=true`                          |
| ~19 packages fail `pnpm run check`                  | `pnpm run build` once (generates Prisma client, codegen, dists), then re-check |

Healthy sequence from scratch: `pnpm install` → `pnpm run build` → `pnpm run check` (verified ~20s / ~1.5min / clean). A production build inside a running devcontainer can replace Next.js dev output; from a linked worktree, run `devrouter workspace ensure .` afterward so the owned runtime is health-checked and recovered when needed.

## Check 3 — stale GraphQL codegen

Symptoms: typecheck can't find a `*Document`, or a running backend rejects an operation (persisted-query hash unknown outside dev/test). Fix:

```bash
pnpm --filter @klicker-uzh/graphql generate
git status   # regenerated src/ops.ts + src/public/*.json MUST be committed with the change
```

## Check 4 — stale Prisma schema sync

If `apps/analytics` complains about schema drift or a schema edit isn't visible: `pnpm run prisma:sync` (mirrors schema, excludes `js.prisma`), then regenerate/build. Full ritual: [docs/data-and-migrations.md](../../../docs/data-and-migrations.md).

## Check 5 — port conflicts

```bash
lsof -nP -iTCP:5432 -sTCP:LISTEN   # repeat for 6379 6380 6381 7077 8888 80 443
```

`Bind for :::5432 failed: port is already allocated` means another stack holds the port — stop it or don't start the colliding service. Plain localhost and legacy host-based paths publish fixed ports, so only one such stack runs per machine. Parallel devcontainer worktrees use the port-free base compose file plus `.devcontainer/docker-compose.devrouter.yml`; the one-at-a-time fallback uses `.devcontainer/docker-compose.localhost.yml`. If manage media uploads fail with an Azure Blob CORS error while GraphQL auth still works, check the storage account before changing app CORS. The media library uploads directly from the browser to Azure Blob Storage via SAS, so its CORS rule must allow the actual local origin. Use exact origins for production/staging accounts and dev-only localhost rules for a dedicated dev storage account.

## Check 6 — infra bring-up / server status (headless-safe)

Depending on your environment path:

### Path A: Inside Devcontainer

The container manages infra services and app servers automatically in the background. Re-run the ownership-aware lifecycle check, then inspect logs:

```bash
bash .devcontainer/post-start.sh
cat /tmp/klicker-dev-process.state
tail -n 50 /tmp/dev.log   # inspect server startup logs
```

An exact fingerprint is reused only while all routed app endpoints remain below 500; a stale or unhealthy owned process group is restarted; an unknown process is reported and left untouched. For a linked worktree that fails before container entry, run `devrouter workspace ensure .` on the host so one stale exact-path DevPod can be recreated once.

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

Seeded dev DB contains the AGENTS.md test accounts (`lecturer`, `testuser1..50` — values in AGENTS.md only). If the DB is empty or foreign: seed with `pnpm run prisma:setup` **only after confirming the volume holds no real work** (fresh volume, test course names like "Testkurs"). When in doubt, ask the user.

## Check 9 — secrets (config-derived)

App dev servers need Infisical (`infisical whoami` to verify auth); infra and builds do not. No Infisical access → use the `dev:raw`/localhost path and say so in your report instead of debugging secret-dependent features.
