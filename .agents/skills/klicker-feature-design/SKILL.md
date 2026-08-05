---
name: klicker-feature-design
description: Design a KlickerUZH feature before writing code. Use at the start of any non-trivial feature or change in this repository — to pin down domain vocabulary, affected layers, auth, i18n, gamification impact, and test level — and to write the plan file that the implementation will follow.
---

# KlickerUZH Feature Design

Spec before code. A design that answers the questions below prevents the classic rework loops (wrong entity, missing auth layer, forgotten codegen, untestable UI). Lifecycle context: [docs/developing-a-feature.md](../../../docs/developing-a-feature.md).

## The plan file

Non-trivial work gets a plan in `project/plans_wip/PLAN-<slug>.md` (existing files there are the template). Keep it short: Goal, Non-goals, the answers below, slice list, Progress log. Update Progress as you work; move completed plans to `project/plans_archive/`. Deferred or future plans live in `project/plans_future/`.

## Questions a design MUST answer

1. **Domain vocabulary** — which entities, in the repo's words ([docs/domain-model.md](../../../docs/domain-model.md))? `User` or `Participant`? Which activity type (LiveQuiz / PracticeQuiz / MicroLearning / GroupActivity)? `Element` or `ElementInstance` (source vs published snapshot)? Getting this wrong invalidates everything downstream.
2. **Layer footprint** — which of: Prisma schema (→ migration + sync + seeds), `packages/types`, GraphQL schema/service/ops (→ codegen commit), frontend app(s), i18n, Hatchet tasks? List the packages you will touch.
3. **Auth** — who may call it? Pick the layer-1 scope object (`asUser`/`asParticipant`/…) and, for object-scoped operations, the `PermissionLevel` (READ/EXECUTE/WRITE/ADMIN). ([docs/graphql-api-layer.md](../../../docs/graphql-api-layer.md))
4. **Gamification impact** — does it award points/XP or touch leaderboards? Points and XP are separate tracks with different conditions; changes here need the domain page open.
5. **Async impact** — does it publish/schedule/aggregate anything? Then Hatchet workers are in scope, including local verification needs ([docs/async-and-workers.md](../../../docs/async-and-workers.md)).
6. **UI surface** — which app(s)? pages-router conventions vs chat island? New user-visible strings (de+en) and new `data-cy` hooks?
7. **Test level + evidence** — per `klicker-testing-verification`: what will you run, what will CI cover, what browser evidence will you capture?
8. **Seeds/fixtures** — do e2e tests need new fixtures? Then all relevant seed paths (dev/Playwright) are in scope.

## Discipline

- Challenge the ask if a simpler slice ships the value; propose 2–3 approaches with a recommendation for ambiguous product/design work — one question at a time.
- Study a comparable shipped feature before designing (worked traces: `ff61d9bc7` read-feature, `38c92d035` schema+mutation) — mirror its shape rather than inventing structure.
- The design is done when a second engineer could implement it without asking you anything about scope.
