---
type: Playbook
title: Developing a Feature
description: The full-stack feature lifecycle step by step, with a real commit as the worked example and routing to the page or skill for each step.
timestamp: '2026-08-05'
tags:
  - workflow
---

# Developing a Feature

**Work back-to-front, and treat codegen artifacts as part of every step's diff.** The canonical order below matches how shipped features actually land — worked example: commit `ff61d9bc7` (#4951, read-only feature) and its schema-changing sibling `38c92d035` (#4958, migration + mutations + heavy vitest).

## The lifecycle

1. **Design first.** Nail the domain vocabulary ([Domain Model](./domain-model.md)): which activity type, which user population, gamification impact, which auth layer guards it, what i18n strings and test level it needs. Record non-trivial work in `project/plans_wip/PLAN-<slug>.md`; move completed plans to `project/plans_archive/`, while deferred or future plans live in `project/plans_future/`.
2. **Schema/data change** (only if needed): edit the split Prisma schema, then migrate → sync → generate ([Data & Migrations](./data-and-migrations.md)). Update seeds if e2e needs the fixture — remember the three seed paths are independent.
3. **Shared types**: extend `packages/types` when frontend and backend share a shape.
4. **API**: Pothos object/field in `packages/graphql/src/schema/`, logic in `services/`, three-layer auth (`t.withAuth` + `withPermission`) ([GraphQL API Layer](./graphql-api-layer.md)).
5. **Ops + codegen**: add `Q*/M*/S*/F*.graphql`, run `pnpm --filter @klicker-uzh/graphql generate`, **commit the regenerated artifacts in the same change**.
6. **Frontend**: page/component per app conventions ([Frontend Conventions](./frontend-conventions.md) — or [Chat Platform](./chat-platform.md) for apps/chat), i18n de+en, `data-cy` on new interactive elements, gate by flags/permissions alone.
7. **Tests**: level per [Testing](./testing.md). #4951 shipped a read feature with no new e2e (honest precedent, not a virtue); #4958 shows the migration+mutation pattern with substantial graphql vitest.
8. **Verify before PR**: `pnpm run check:all` + `pnpm run build` + targeted tests + browser evidence (`npx agent-browser`) for UI.
9. **PR**: conventional-commit title (squash-merge), target `v3`.

## What #4951 actually touched (one commit)

`packages/types` (new + renamed types) → `schema/assessment.ts` + `query.ts` (object type, two fields, one arg) → `services/courses.ts` (new service fn) → auth (`asUser` + `withPermission(...ADMIN)` lecturer-side) → 2 new + 2 extended `.graphql` ops → committed codegen (`ops.ts` +78, `ops.schema.json` +404, both persisted-query maps, `schema.graphql`) → new manage page + component + gated nav button → +6/+6 lines de/en.

## Review reality

Automated reviewers (Copilot/CodeRabbit/SonarCloud/claude-code-review) flag many false positives. Before "fixing" a finding, check whether guards or fallbacks already exist — confirm against the actual code, not the bot summary.

## Skills for each step

Procedural, task-shaped guidance lives in [.agents/skills/](../.agents/skills/): environment bring-up and diagnosis (`klicker-environment-doctor`), feature design (`klicker-feature-design`), API work (`klicker-graphql-api`), schema/data work (`klicker-data-model`), UI work (`klicker-frontend-ui`), test routing and pre-PR verification (`klicker-testing-verification`), e2e authoring (`klicker-playwright-e2e`), browser verification (`agent-browser`), and wiki upkeep (`klicker-wiki-maintenance`).
