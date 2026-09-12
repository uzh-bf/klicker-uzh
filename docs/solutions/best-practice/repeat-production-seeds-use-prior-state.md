---
module: prisma-data
date: 2026-07-16
problem_type: best_practice
severity: high
tags:
  - production-seed
  - prisma
  - leaderboard
  - dry-run
  - replay-safety
---

# Repeat Production Seeds Must Validate Prior Mutable State

## Context

A later Summer School activity seed initially treated an active `Participation` row as the authoritative membership check. Production inspection showed that this assumption was too strong: one participant was inactive and another had no participation row, even though the latter still had the exact participant ID and 900-point course leaderboard state from the earlier successful seed.

## Guidance

For a later additive seed, validate the state the new mutation will actually extend. Resolve external identifiers exactly, report participation anomalies, and require the expected existing course leaderboard record before incrementing it. Do not silently create a replacement leaderboard record when the operation assumes an earlier award already ran.

Pair that invariant with a payload-bound replay lock: the dry run records the complete before state and a deterministic input hash, write mode refuses to start if production or the payload has drifted, and the transaction rechecks the snapshot before applying atomic increments. Do not let a later dry run overwrite a changed snapshot, and treat the after dump as a completed-run receipt.

## Why This Matters

Participation state can change independently of previously awarded points. Making it the sole gate can reject a correct historical mapping, while creating missing state can conceal a wrong participant or an incomplete earlier run. Anchoring the operation to the record being incremented catches both cases without ignoring useful participation warnings.

## When to Apply

Use this pattern for follow-up points, XP, achievement, or correction batches that depend on an earlier production assignment. For a first-time enrollment seed, participation may still be the correct required invariant; choose the gate based on the state the operation claims already exists.

## Examples

- `packages/prisma-data/src/data/seedSummerSchoolPortfolio2026.ts:166` queries participation for warnings without treating it as the only source of truth.
- `packages/prisma-data/src/data/seedSummerSchoolPortfolio2026.ts:200` reads the leaderboard, XP, and achievement state that the operation extends.
- `packages/prisma-data/src/data/seedSummerSchoolPortfolio2026.ts:241` fails if the expected existing course leaderboard record is absent.
- `packages/prisma-data/src/data/seedSummerSchoolPortfolio2026.ts:342` blocks completed runs before querying production.
- `packages/prisma-data/src/data/seedSummerSchoolPortfolio2026.ts:348` hashes the validated payload; lines 367-374 protect the payload-bound before snapshot before any write, and lines 384-400 check it again before and inside the transaction.
- [PR #5180](https://github.com/uzh-bf/klicker-uzh/pull/5180) records the production evidence, review hardening, and verification for the reference implementation.
