# Live Quiz Per-Element Response Counts

## Goal

Report received and processed response totals for each `ElementInstance` in the
lecturer live quiz cockpit.

## References

- Design: `docs/superpowers/specs/2026-08-05-live-quiz-response-counts-design.md`
- Implementation plan: `docs/superpowers/plans/2026-08-05-live-quiz-response-counts.md`

## Non-goals

- Block-level response totals.
- Replacing the existing participant count.
- Prisma, scoring, XP, leaderboard, polling, or subscription changes.

## Feature-design decisions

- Domain: LiveQuiz `ElementBlock` execution containing `ElementInstance`s.
- Layers: `packages/util`, response API, response processor, GraphQL, Manage UI,
  i18n, Playwright, and engineering wiki.
- Auth: reuse `cockpitQuiz` user authentication and LiveQuiz `EXECUTE`
  permission.
- Gamification: no effect.
- Async: track Hatchet ingress and successful regular/assessment aggregation in
  execution Redis.
- UI: per-element English/German received and processed labels with stable
  `data-cy` selectors.
- Fixtures: reuse the existing live quiz lifecycle; no seed changes.
- Delivery: one ordinary draft PR targeting `v3`.

## Slices

- [ ] Shared Redis key helper and unit test.
- [ ] Received and processed event tracking.
- [ ] Per-element GraphQL fields and integration test.
- [ ] Lecturer UI, i18n, and Playwright assertion.
- [ ] Wiki documentation and full verification.
- [ ] Independent branch review and draft PR.

## Progress

- 2026-08-05: User approved the per-element design and implementation planning
  began on `feat/live-quiz-response-counts`.
