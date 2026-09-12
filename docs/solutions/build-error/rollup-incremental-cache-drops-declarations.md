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

The relevant cleanup is `packages/prisma/rollup.config.js:16`, and the declaration settings remain in `packages/prisma/tsconfig.json:24`. [PR #5167](https://github.com/uzh-bf/klicker-uzh/pull/5167) contains the sequential production and all-Turbopack build evidence.

## Why This Works

Rollup plugin `buildStart` hooks can overlap. The TypeScript plugin's incremental program and the delete plugin therefore must not share state in the directory being removed. Disabling incremental mode for this one build makes declaration emission independent of hook timing; Turbo remains the outer build cache.

## Prevention

For Rollup packages that delete their output directory, verify two consecutive uncached builds and inspect required declaration artifacts after the second. Enable TypeScript incremental state only when the build owner preserves or recreates the matching outputs and compiler state atomically. Give every compiler invocation its own build-info file; for example, Export's library, CLI, and no-output check each use separate state.
