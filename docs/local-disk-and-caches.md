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
  (`~/Library/pnpm/store/v11` for pnpm 11). Repository `.npmrc` sets no
  `store-dir`.
- In the devcontainer, the store volume `klicker-uzh-pnpm-store-v1` is mounted
  both at `/pnpm/.pnpm-store` (the configured store) and at
  `<workspace>/.pnpm-store`. The workspace bind mount and the volume are
  different devices inside the container, so pnpm may fall back to a workspace
  store during installs; the second mount makes that fallback land in the
  shared volume instead of on the host bind mount. See
  [.devcontainer/README.md](../.devcontainer/README.md).
- A `.pnpm-store/` directory inside any worktree is a **fallback store** (for
  example created by a sandboxed agent whose home is read-only). It is
  regenerable: deleting it never breaks existing `node_modules` (hardlinks
  keep the content alive); the worst case is re-downloading packages.

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
