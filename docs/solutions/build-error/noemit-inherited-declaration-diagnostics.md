---
type: Solution
title: noEmit Does Not Disable Inherited Declaration Diagnostics
description: Keep declaration analysis explicit when a no-output check extends an emitting TypeScript config.
module: typescript
date: 2026-07-19
problem_type: build_error
severity: low
symptoms:
  - 'A check-only tsconfig with noEmit still reports TS2883 declaration portability diagnostics'
  - 'Removing declaration overrides from the GraphQL check config produces 33 diagnostics'
root_cause: 'noEmit prevents output but does not disable declaration analysis inherited from an emitting base config'
tags:
  - typescript
  - declarations
  - tsconfig
  - typecheck
---

# `noEmit` Does Not Disable Inherited Declaration Diagnostics

## Problem

While simplifying the TypeScript check configs, replacing their overrides with only `noEmit: true` caused the GraphQL check to report 33 `TS2883` declaration-portability diagnostics. The source had not changed, and the package build still intentionally emits declarations.

## Symptoms

The failure appears only in a check config that extends a declaration-emitting base. A standalone `noEmit` setting looks sufficient because no files are written, but TypeScript still analyzes whether inferred public types can be named portably.

## What Didn't Work

- Setting only `noEmit: true` stopped output but retained the inherited `declaration: true` and `declarationMap: true` analysis.
- Retaining `composite: false` did not describe the check's real role and did not disable declaration analysis.
- Weakening the package's main declaration-emitting config would have hidden existing public-type debt from the actual library build.

## Solution

Keep the emitting base config unchanged. In the check-only config, set all three role-defining overrides:

```json
{
  "compilerOptions": {
    "declaration": false,
    "declarationMap": false,
    "noEmit": true
  }
}
```

The live examples are `packages/graphql/tsconfig.check.json:3` and `packages/prisma/tsconfig.check.json:3`. [PR #5167](https://github.com/uzh-bf/klicker-uzh/pull/5167) contains the TypeScript 6 compiler audit and verification evidence.

## Why This Works

`noEmit` controls whether TypeScript writes files. The declaration options separately control declaration-oriented analysis. Overriding them in the check config keeps fast source checking independent from the package's real declaration build without weakening that build.

## Prevention

When a check config extends an emitting config, inspect the resolved compiler options instead of assuming `noEmit` resets emit-related behavior. Run the package check after generated dependencies exist, then run the actual declaration build as a separate gate. The repository's `klicker-testing-verification` procedure now records this distinction.
