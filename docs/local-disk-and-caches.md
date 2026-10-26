---
type: Guide
title: Local Disk and Caches
description: How Turbo and pnpm caches are laid out across worktrees, why they can grow, and the commands that reclaim space safely.
timestamp: '2026-09-03'
tags:
  - environment
  - caching
  - worktrees
---

# Local Disk and Caches

This repository is worked on through many parallel Git worktrees (`trees/*`,
`.claude/worktrees/*`), often by coding agents. Generated data must therefore
stay bounded per worktree and shared where the tooling supports it.

## Turbo local cache (Turbo >= 2.10)

- The local cache lives at `.turbo/cache` of the **main checkout**. Linked
  worktrees share it automatically (Turbo detects Git worktrees since 2.8);
  there is deliberately **no `cacheDir` override and no `--cache-dir` flag** in
  package scripts, because a relative custom dir would give every worktree its
  own unbounded cache again.
- The cache is bounded in `turbo.json`: `cacheMaxSize: 10GB`,
  `cacheMaxAge: 14d`. Eviction runs in a background thread whenever
  `turbo run` starts; oldest entries go first. Old agent worktree history
  ages out on its own.
- Build task outputs exclude Turbo-irrelevant Next.js internals:
  `.next/**` minus `!.next/cache/**` and `!.next/dev/**`. Without the
  exclusions, webpack/dev caches inflate every cache artifact by ~100 MB.
- CI: `check.yml` uses remote-only caching (`TURBO_REMOTE_ONLY`); the Playwright
  CI caches the local `.turbo` path, which stays valid because the default
  cache dir is `.turbo/cache`.

## pnpm store

- The one true content store is pnpm's default machine store
  (`~/Library/pnpm/store/v11` on macOS for pnpm 12.11.2; the store schema
  remains v11). Use `pnpm store path --silent` for the effective path on your
  platform. Repository `.npmrc` sets no
  `store-dir`.
- In the devcontainer, the store volume `klicker-uzh-pnpm-store-v1` is mounted
  both at `/pnpm/.pnpm-store` (the configured store) and at
  `<workspace>/.pnpm-store` (the legacy fallback location). The explicit store
  configuration and existing mounts stay stable across the upgrade. See
  [.devcontainer/README.md](../.devcontainer/README.md).
- With no explicit store directory, pnpm 12 uses
  `<project>/node_modules/.pnpm-store` when no writable parent directory can
  share hardlinks, such as a sandbox or isolated volume. Older installs may
  leave a worktree-root `.pnpm-store/`. These content stores are regenerable;
  the worktree cleanup already covers both via `node_modules` and
  `.pnpm-store`. See the [pnpm 12 release notes](https://github.com/pnpm/pnpm/releases/tag/v12.0.0).

## Cleanup commands

| Command                         | Removes                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm disk:usage`               | Report only: primary consumers, pnpm stores, per-worktree generated data, stale-worktree candidates                                                                                  |
| `pnpm clean:cache`              | This worktree's `.turbo`, `node_modules/.cache`, `.next/cache`                                                                                                                       |
| `pnpm clean:generated`          | This worktree's build/test output (`.next`, `dist`, `out`, `coverage`, Playwright reports). Stop the dev stack first (it refuses while dev server ports answer; `--force` overrides) |
| `pnpm clean:worktree -- <path>` | Full reset of a finished worktree: everything above plus `node_modules` and `.pnpm-store`. Refuses the main checkout                                                                 |

All modes support `--dry-run` to preview sizes. They never touch tracked
source, committed data, or the GraphQL generated client documents that dev
servers need until the next codegen run.

## Finished-worktree flow

```bash
devrouter stop <path-to-worktree>   # stop its container/routes
pnpm clean:worktree -- <path>       # reclaim generated data
git worktree remove <path>          # remove the worktree (keeps the branch)
```

`pnpm disk:usage` lists worktrees that are fully merged into `v3`, clean, and
inactive for over 30 days as removal candidates — it never deletes them.
