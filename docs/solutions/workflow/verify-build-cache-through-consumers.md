---
module: ci
date: 2026-09-06
problem_type: workflow
severity: low
tags: [turbo, cache, generated-code, ci]
---

# Verify build caches through their consumers

## Context

Prisma and GraphQL generate source files outside `dist`. That alone does not
prove the current Turbo outputs are incomplete for a particular CI consumer.

## Guidance

Remove the producer's generated and built outputs in an isolated checkout,
restore its cache, and compile a cold downstream consumer. Run that consumer's
tests as well. Check the package's exported interfaces, not just its generator
output directory. Preserve the original outputs in a task-local backup when
testing restoration.

## Why this matters

The hosted dependency-build probe restored Prisma's bundled client and Pothos
declarations from `dist` while `src/prisma/client` remained absent. GraphQL and
the general worker still compiled, and the GraphQL tests passed. Expanding
cached source outputs was unnecessary for these consumers. Other consumers
that import generated source directly need their own proof.

## When to apply

Use this check before changing Turbo output declarations or sharing caches
between workflows. Matching files do not establish matching task identities:
the Playwright `build:test` seed is not a cache seed for hosted `build` tasks.

## Examples

[Prisma exports](../../../packages/prisma/package.json) point at built files;
[its Rollup configuration](../../../packages/prisma/rollup.config.js) emits
declarations there. [GraphQL's Rollup configuration](../../../packages/graphql/rollup.config.js)
copies generated public maps into `dist`. The
[hosted build verification](../../../project/2026-09-06-hosted-build-cache-compatibility.md)
records cold, restored, and mixed-hit results without claiming hosted speedup.
