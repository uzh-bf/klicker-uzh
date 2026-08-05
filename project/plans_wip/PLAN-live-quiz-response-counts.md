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

- [x] Shared Redis key helper and unit test.
- [x] Received and processed event tracking.
- [x] Per-element GraphQL fields and integration test.
- [x] Lecturer UI, i18n, and Playwright assertion.
- [x] Wiki documentation and full verification.
- [ ] Independent branch review and draft PR.

## Progress

- 2026-08-05: User approved the per-element design and implementation planning
  began on `feat/live-quiz-response-counts`.
- 2026-08-05: Added the shared Redis key contract. The focused utility suite
  passed (47/47) and the DevPod typecheck passed. The DevPod build exposed the
  environment-wide Rollup TypeScript parser limitation at the unchanged
  `packages/util/src/types.ts:8` (`Expected '{', got 'type'`); the host
  `pnpm --filter @klicker-uzh/util build` fallback passed.
- 2026-08-05: Added received/processed tracking for standard and assessment
  responses. In the DevPod, the response API check/build and response-processor
  check passed. The DevPod response-processor build encountered the same parser
  limitation at the unchanged
  `apps/hatchet-worker-response-processor/src/redis.ts:3` (`let redis: Redis`,
  `Expected a semicolon`); the host
  `pnpm --filter @klicker-uzh/hatchet-worker-response-processor build` fallback
  passed.
- 2026-08-05: GraphQL code generation, package typecheck, package build, and the
  focused `liveQuizResponseCounts.test.ts` integration test passed (1 file / 1
  test). It verified active counts of 2/1 and 0/0, executed counts of 1/1, and
  scheduled null/null. The initial red run was infrastructure-blocked by a
  missing schema and unreachable localhost Redis; temporary in-container TCP
  forwarding used for the green run was terminated afterwards.
- 2026-08-05: Frontend Manage and Playwright typechecks passed, and Playwright's
  Chromium `--list` discovered 81 tests, including the modified checkpoint in
  `tests/O-live-quiz.spec.ts`. English and German labels and per-element
  assertions are in place; runtime E2E and browser screenshot evidence remain
  part of Task 6.
- 2026-08-05: Documented the per-element Redis-set semantics, identifiers,
  two-second cockpit polling, one-day instance-key expiry, and the operational
  meaning of the received/processed difference. Targeted Prettier validation
  and `git diff --check` passed. The canonical OKF validator could not run
  because its documented global script,
  `~/.agents/skills/rs-llm-wiki-okf/scripts/validate.sh`, is not installed in
  this environment; no repository-local replacement exists.
- 2026-08-05: The exact DevPod `pnpm run check:all` passed all 25 tasks after an
  environment-only repair installed the repository-required uv CPython 3.12.13
  and recreated the ignored `apps/analytics/.venv`. The first attempt had
  selected Python 3.14.4 and could not compile pandas 2.2.2 without a C compiler.
- 2026-08-05: Host `opengrep scan --config auto` exited successfully after
  scanning 3,157 tracked files with 1,074 rules. It reported 637 repository-wide
  findings, including existing audit findings outside this feature; this
  advisory baseline was not changed in this slice.
- 2026-08-05: The exact DevPod `pnpm run build` reached the unchanged
  `packages/hatchet/src/index.ts:1`, then encountered the environment-wide
  Rollup TypeScript parser limitation (`Expected ',', got 'HatchetClient'`).
  The host fallback initially reached the Next applications but could not fetch
  configured Google fonts in the sandbox; the network-enabled host
  `pnpm run build` rerun passed all 22 tasks. Existing non-blocking next-intl,
  ESM deprecation, Browserslist, large-page-data, Rollup plugin TypeScript, and
  Manage `MISSING_MESSAGE` warnings remain unrelated to this feature.
