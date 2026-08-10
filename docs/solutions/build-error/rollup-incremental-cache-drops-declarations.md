---
type: Solution
title: Do Not Share a Deleted Rollup Output Directory with TypeScript Incremental State
description: Keep Prisma declaration rebuilds deterministic when Rollup deletes its output directory at build start.
module: build-tooling
date: 2026-07-19
problem_type: build_error
severity: medium
symptoms:
  - 'A second Prisma Rollup build succeeds but leaves dist without client.d.ts and index.d.ts'
  - 'The following @klicker-uzh/types build reports missing Prisma client exports and value-as-type diagnostics'
root_cause: 'TypeScript incremental state inside dist can race with Rollup deleting that same directory before declaration emission'
tags:
  - rollup
  - typescript
  - incremental
  - declarations
  - prisma
---

# Do Not Share a Deleted Rollup Output Directory with TypeScript Incremental State

## Problem

After enabling `incremental` in emitted packages, the production build passed but the immediately following all-Turbopack test build failed in `@klicker-uzh/types`. Prisma's second Rollup build exited successfully while leaving JavaScript and `tsconfig.tsbuildinfo` in `dist`, but no `client.d.ts` or `index.d.ts` for downstream packages.

## Symptoms

The downstream compiler reported missing exports such as `AppliedPointCorrection` and treated Prisma enum and client imports as values rather than types. Inspecting `packages/prisma/dist` after the successful Rollup command showed that its declaration files were absent.

## What Didn't Work

- A single clean production build passed, so it did not exercise the stale incremental state.
- Running only root typechecks passed while the earlier declaration output still existed.
- Keeping `tsBuildInfoFile` inside `dist` did not preserve a usable cache because Prisma's Rollup config deletes that directory at build start.

## Solution

Keep Prisma's declaration-emitting config non-incremental: remove both `incremental` and `tsBuildInfoFile` from `packages/prisma/tsconfig.json`. The Rollup build still emits declarations, but each invocation computes them from the generated source instead of consulting state stored in the directory it cleans.

The relevant cleanup is `packages/prisma/rollup.config.js:16-18`, and the TypeScript plugin mitigation is at `packages/prisma/rollup.config.js:20-29`. The declaration settings remain in `packages/prisma/tsconfig.json:23-25`. [PR #5167](https://github.com/uzh-bf/klicker-uzh/pull/5167) contains the sequential production and all-Turbopack build evidence.

## Why This Works

Rollup plugin `buildStart` hooks can overlap. The TypeScript plugin's incremental program and the delete plugin therefore must not share state in the directory being removed. Disabling incremental mode for this one build makes declaration emission independent of hook timing; Turbo remains the outer build cache.

The same rule applies when builds alternate between the host and the DevPod. Their TypeScript incremental state contains different absolute workspace paths. Sharing `.rollup.cache` or `dist/tsconfig.tsbuildinfo` can make Rollup skip TypeScript emission and hand raw syntax such as `export type` or `as string` to Rollup's JavaScript parser. The Rollup configs now override both `incremental` and `tsBuildInfoFile` inside `compilerOptions` for every TypeScript plugin invocation, including Export's library and CLI targets (`packages/export/rollup.config.js:17-23`, `packages/export/rollup.config.js:40-49`). Package-level `tsc` checks retain their own configured incremental state; Turbo owns Rollup's reusable package-output cache.

## Prevention

For Rollup packages that delete their output directory, verify two consecutive builds and inspect required declaration artifacts after the second. Keep Rollup's TypeScript plugin non-incremental unless a future build owner can preserve compiler state atomically across every supported runtime. Let Turbo cache the resulting package outputs, and keep separate incremental build-info files for independent package-level `tsc` checks.
