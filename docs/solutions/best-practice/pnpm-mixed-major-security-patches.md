---
module: dependency-resolution
date: 2026-10-24
problem_type: best_practice
severity: medium
tags: [pnpm, dependency-overrides, peer-dependencies, zod]
---

# Preserve mixed peer ranges when patching one dependency major

## Context

This workspace supports consumers on different Zod majors. A security patch for
existing Zod 4 dependencies must preserve applications that still declare Zod 3.

## Guidance

In pnpm 12, an override selected by a version range can also rewrite peer
requirements that intersect that range. A selector such as
`zod@>=4.0.0 <4.6.6` can replace a peer requirement accepting both Zod 3 and 4
with the single Zod 4 target. The selector alone does not prove major isolation.

Inspect the generated lockfile's peer requirements and actual dependency edges,
as well as direct manifests. When resolution needs help, select exact consumers
whose published dependencies already require the affected major. Retain mixed
peer requirements and check consumers on every integration branch involved.

Audit overrides after resolution. If the published ranges already accept the
fixed version, remove unnecessary pins through native lockfile regeneration.
Use narrowly reviewed release-age exceptions when needed, and confirm that a
frozen install retains the intended versions.

## Why This Matters

Unchanged direct manifests can conceal a peer-resolution migration. A patch
verified only on an upstream consolidation branch also misses consumers added
by its downstream branches.

## When to Apply

Use this check when one library major remains supported while another receives
a security patch. Follow the repository's
[override audit procedure](../../../.agents/skills/klicker-dependency-overrides/SKILL.md)
and inspect the generated [lockfile](../../../pnpm-lock.yaml).
