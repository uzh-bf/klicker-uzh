---
type: Solution
title: Add the Missing React Types Edge to Recharts 2
description: Repair the isolated pnpm type graph instead of weakening compiler checks or application code.
module: dependency-management
date: 2026-07-19
problem_type: build_error
severity: medium
symptoms:
  - 'React package checks fail with TS2607 and TS2786 in Recharts legacy class declarations'
  - 'The failure appears after regenerating the lockfile for the merged React 19 dependency graph'
root_cause: "recharts@2.15.3 imports React declarations but does not declare @types/react, so pnpm's isolated virtual package lacks the required type edge"
tags:
  - pnpm
  - recharts
  - react-types
  - typescript
  - lockfile
---

# Add the Missing React Types Edge to Recharts 2

## Problem

After rebasing the TypeScript 6 upgrade onto the merged Next.js 16 and React 19 base, checks in React-facing packages failed with `TS2607` and `TS2786` inside Recharts declarations. The failure appeared only after a clean lockfile regeneration because the old graph had made React types accidentally visible to Recharts.

## Root Cause

`@uzh-bf/design-system@4.1.6` uses `recharts@2.15.3`. That Recharts release imports React types but does not declare `@types/react`, so pnpm has no reason to link the type package into the isolated Recharts virtual package. The merged graph removed the incidental hoisting that had hidden the missing edge.

Running the same check with TypeScript 5.6 reproduced the failure. This ruled out a TypeScript 6 language or declaration-compatibility regression.

## What Did Not Work

- Reinstalling without changing the dependency graph reproduced the same diagnostics.
- Downgrading only the compiler to TypeScript 5.6 reproduced the same diagnostics.
- Changing application source or weakening compiler checks would have treated the symptom outside the package that owns the missing dependency edge.

## Solution

Add a pnpm `packageExtensions` entry scoped to `recharts@2.15.3` and declare `@types/react` as a peer. Regenerate the lockfile so each React-specific Recharts snapshot records and receives the matching type dependency.

```yaml
packageExtensions:
  'recharts@2.15.3':
    peerDependencies:
      '@types/react': '*'
```

Verify from a clean install rather than relying on an existing `node_modules` tree. Confirm the Recharts virtual package links `@types/react`, then run the full typecheck and production build graphs.

## Prevention

After rebasing one dependency-upgrade PR onto another, always regenerate from a clean dependency tree and rerun the entire consumer graph. If a declaration package becomes invisible, compare the package's declared peers with the old and new virtual-store edges before changing application code or compiler settings.

## Reference

- `pnpm-workspace.yaml` contains the package-scoped extension.
- `pnpm-lock.yaml` records the extension checksum and the explicit Recharts-to-React-types edges.
- [PR #5167](https://github.com/uzh-bf/klicker-uzh/pull/5167) contains the TypeScript 6 rebase and verification evidence.
