# Wiki Bootstrap — Phase 0 Bring-Up Evidence

Engagement evidence for `PLAN-llm-wiki-and-skills.md` (S1). All commands executed 2026-07-07 on macOS (Darwin 25.5.0, OrbStack Docker), inside a fresh git worktree of this repo. Anything **not** executed is listed under [Not executed](#not-executed-config-derived-only) and must be labeled `config-derived` wherever the wiki or a skill mentions it.

Constraint: the engagement machine is a maintainer laptop with unrelated container stacks occupying host ports (5432, 6379, 7077, 8888) and a standing instruction not to start the app. App-layer bring-up was therefore **not** executed; package-layer and infra-layer were.

## Verified (executed, with outcomes)

| # | Command | Outcome |
|---|---|---|
| 1 | `pnpm install` (pnpm **11.5.0** = `packageManager`) | OK, 21.7s (cold-store worktree). Peer warnings in `apps/docs`, `packages/prisma` are pre-existing. |
| 2 | `pnpm run build` | OK, 21/21 turbo tasks, 1m23s. **No secrets needed.** |
| 3 | `git commit` (husky pre-commit → `check:all`) | OK ~12s after install+build. Fails hard without them (signatures 1, 5). |
| 4 | `docker compose config --quiet` | OK without secret injection — compose resolves with inline defaults. |
| 5 | `./util/sync-schema.sh` | OK (copies prisma schema for analytics/python). |
| 6 | `./util/_run_with_infisical.sh --env dev docker compose up -d postgres redis_exec redis_assessment redis_cache mailhog` | Partial: mailhog (1025/8025), redis_assessment (6381), redis_cache (6380) **Started**; postgres (5432) failed (signature 4); redis_exec (6379) failed the same way (host port taken by unrelated stack). |
| 7 | `docker compose down -v` | Clean teardown of this project's containers/volumes only. |

Toolchain facts (read, not inferred): `package.json` → `volta.node = 24.16.0`, `volta.pnpm = 11.5.0`, `packageManager = pnpm@11.5.0`. AGENTS.md's "Node.js 20 (Volta-pinned)" is **stale**; `packages/word-cloud` pins `engines.node = 20` and warns under 24 (harmless warning today).

## Failure signatures (exact text → cause → fix)

1. `sh: run-p: command not found` + `husky - pre-commit script failed (code 1)`
   → `node_modules` missing (fresh clone/worktree). Fix: `pnpm install` with pnpm 11.
2. `[ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY] Aborted removal of modules directory due to no TTY`
   → pnpm 11 found a `node_modules` created by another pnpm major; non-interactive shell can't confirm purge. Fix: `pnpm install --config.confirmModulesPurge=false` (or `CI=true`, but see 3).
3. `[ERR_PNPM_LOCKFILE_CONFIG_MISMATCH] Cannot proceed with the frozen installation. The current "overrides" configuration doesn't match the value found in the lockfile`
   → two causes stack: `CI=true` forces frozen mode, and an earlier install with the **wrong pnpm major** (9.x via a stale Volta shim; `VOLTA_FEATURE_PNPM` unset so Volta ignores the pin) had silently rewritten `pnpm-lock.yaml` (~380-line churn). Fix: `git checkout pnpm-lock.yaml`, then non-frozen install with pnpm 11. Prevention: `pnpm --version` must print 11.x **before** installing.
4. `Bind for :::5432 failed: port is already allocated`
   → another process/stack holds the host port. Diagnose: `lsof -nP -iTCP:5432 -sTCP:LISTEN`. Same class applies to 6379 (redis_exec), 7077/8888 (hatchet), 80/443 (traefik).
5. Fresh clone, `pnpm run check` → ~19 packages fail typecheck
   → generated artifacts missing (Prisma client, GraphQL codegen, package dists). Fix: `pnpm run build` once, then check.

## Agent-path traps (verified by reading, confirmed structurally)

- `_run_app_dependencies.sh` is **interactive**: two `confirm` prompts, foreground `docker compose logs -f`, and a `trap cleanup INT TERM HUP EXIT` that runs `./_down.sh`. A headless agent running it non-interactively will hang on prompts and, on shell exit, **tear down the stack it just started**. Headless path = run its steps individually (sync-schema → certs (mac) → compose up selected services → `wait-for-infra.sh` → hatchet token → `prisma:push`).
- Compose project name derives from the working directory (`busy-shirley-b9c7bc-*` here, `klicker-uzh_*` in the main checkout) → worktrees get **parallel container/volume sets**; the same host ports still collide. Only one stack variant can run at a time per machine.
- `./util/_run_with_infisical.sh` requires an authenticated Infisical CLI and passes `--watch`. Compose infra itself resolves without secrets (verified #4); app dev servers are the secret consumers.

## Not executed (config-derived only)

Blocked by the no-app-start instruction and occupied host ports; every downstream mention must carry a "not verified in engagement, run doctor checks on your machine" label:

- `pnpm run dev` / `dev:raw` / `dev:test` / `dev:playwright` (app servers, ports 3000–3010).
- Traefik `*.klicker.com` path: `util/_create_ssl_certificates.sh`, `/etc/hosts` entries, proxy container.
- Hatchet container + `./util/_create_hatchet_token.sh` (+ cypress variant).
- `prisma:push` / `prisma:setup` seeding; seeded-login health check (lecturer `lecturer`/delegated, `testuser1..50`).
- `.github/scripts/wait-for-infra.sh`.
