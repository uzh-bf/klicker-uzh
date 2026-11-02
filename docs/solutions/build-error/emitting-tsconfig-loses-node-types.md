---
type: Solution
title: Emitting Build Loses @types/node While the Package Check Stays Green
description: A mid-merge install-state inconsistency broke Node ambient types in the emitting build only; explicit types plus a forced install fixed it, and baseUrl was not the cause.
module: typescript
date: 2026-08-03
problem_type: build_error
severity: medium
symptoms:
  - 'The emitting build stops resolving Node globals (TS2591 Cannot find name process, TS2503 Cannot find namespace NodeJS) after a large merge with tsconfig cleanup'
  - 'pnpm run check still passes for the same package, so the failure only appears in the emitting build'
root_cause: 'A workspace install left inconsistent by incremental pnpm add operations during the merge — the same state that made an undeclared transitive dependency unresolvable elsewhere — not the removal of the deprecated baseUrl, which a post-merge reproduction cleared'
tags:
  - typescript
  - tsconfig
  - node-types
  - pnpm
  - mcp
---

# Emitting Build Loses `@types/node` While the Package Check Stays Green

## Problem

Merging the TypeScript 6 base into PR #5109 removed the deprecated
package-level `baseUrl` from `apps/mcp-lecturer` and `apps/mcp-student`. Right
afterwards both packages failed their emitting build (`tsconfig.build.json` →
`tsc -p`) with TS2591/TS2503 on Node globals, even though `@types/node` was a
declared devDependency — while the package `check` script kept passing.

## Symptoms

The break is asymmetric between the two compiler invocations of the same package:

- `pnpm --filter @klicker-uzh/mcp-student build` no longer resolves Node
  globals or `node:*` module imports.
- `pnpm --filter @klicker-uzh/mcp-student check` passes, because the check
  config's `include` covers `./vitest.config.ts` and the Vitest type graph
  drags the Node types back in.

A package whose check is green and whose build is red is the signature:
compare the two configs' `include` sets before suspecting the source.

## What the Root Cause Was NOT

The first diagnosis blamed the `baseUrl` removal ("dropping `baseUrl` drops
the implicit `@types/node` pickup"). A post-merge reproduction disproved it:
with a healthy install, removing `types: ["node"]` again (still no `baseUrl`)
builds green — `@types/node` is auto-loaded from the package's own
`node_modules/@types` by default type-root discovery, exactly as in the other
emitting Node packages (`packages/hatchet`, `apps/response-api`, …), none of
which declare `types` or `baseUrl`.

The real trigger was the workspace install state at that point in the merge:
incremental `pnpm add` operations had left the store inconsistent — the same
state that made `assistant-stream` (an undeclared transitive dependency of the
pinned `@assistant-ui/react-ai-sdk@1.3.7`) unresolvable to Turbopack until a
`pnpm install --force` rebuilt the hoisted links. In that window, type-root
discovery for the MCP apps found nothing.

## Solution

Two independent fixes, both applied:

1. `pnpm install --force` — repairs the inconsistent store/link state after
   incremental adds. This is the fix for the actual root cause.
2. `types: ["node"]` in the emitting config (see
   `apps/mcp-lecturer/tsconfig.json`, `apps/mcp-student/tsconfig.json`,
   inherited by their `tsconfig.build.json`) — kept deliberately: it makes the
   Node-types dependency explicit instead of relying on automatic type-root
   discovery, and it turns a broken install into a hard, well-located error.

The same merge also needed
`import hashes from '@klicker-uzh/graphql/dist/client.json' with { type: 'json' }`
in `apps/mcp-student/src/graphqlClient.ts`, because `module: NodeNext`
requires the import attribute for JSON.

## Prevention

- When changing a package's resolution settings or dependencies, run the
  **emitting** command, not only `check`: `pnpm --filter <pkg> build`. Treat a
  green check on a package with a separate build config as inconclusive.
- After a run of incremental `pnpm add`/`remove` operations inside a large
  merge, finish with one `pnpm install --force` before trusting build results.
- Restoring `baseUrl` is never the fix — it is deprecated in TypeScript 6 and
  the rest of the workspace has dropped it (see the path-mapping rule in
  [Frontend Conventions](../../frontend-conventions.md#nextjs-tooling)).
