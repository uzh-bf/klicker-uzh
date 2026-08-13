# PR 5390 analysis-core pragmatic simplification plan

## Goal and boundary

- Problem: the lower analysis-core pull request constructs a private metric
  provenance model that no consumer uses; the governed report layer owns the
  shareable provenance contract.
- Goal: remove only the unused core provenance object shaping without changing
  analysis behavior or its privacy boundary.
- Non-goals: change eligibility, lineage, exchange states, rating coverage,
  provider behavior, ordering, tests, report provenance, the upper branch, or
  W2.
- Ceremony: full path under the approved W1 delegation contract because the
  code is part of a personal-data analysis seam.
- Authority: local plan, code, test, review-artifact, verification, and commit
  work on `rs/chatbot-analysis-core` only. Push, pull-request updates, rebases,
  upper-branch propagation, merge, deployment, production or real-data access,
  external messages, cleanup, and W2 are withheld.

## Identity and continuity

- Plan: `project/2026-08-13-pr-5390-analysis-core-pragmatic-simplification-plan.md`.
- Branch: `rs/chatbot-analysis-core`.
- Worktree:
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/chatbot-learning-analytics`.
- Pull request: [#5390](https://github.com/uzh-bf/klicker-uzh/pull/5390),
  targeting `v3`.
- Selected source: `7e9d8e06c6e8fe5f7e0db17735a4364a873d110b`.
- Contract identity:
  `fe7587ab0a4060fe6f8be2ed2dfe042bad47fca36ab2ba779ca20206bbad60ab`.
- Related history:
  `project/2026-08-12-chatbot-learning-analytics-plan.md` remains the broader
  package plan; its existing item contract is not rewritten here.
- Target currency: remote `v3` advanced to
  `3dfdbe2f9fb2206339553340db96ac2f139e5153`, seven commits past the frozen
  base. Those commits do not touch this plan or the owned core paths. Rebase is
  withheld and not required for W1 local completion.

## Settled contract

- Do: remove `MetricProvenance`, `createMetricProvenance`,
  `AnalysisCoreResult.provenance`, and the `runAnalysisCore` provenance
  construction.
- Preserve: fail-closed purpose, course, effective-window, and withdrawal
  eligibility.
- Preserve: the bounded lineage filter and its invariant comment.
- Preserve: the `buildExchanges` fallback scan, which distinguishes an
  in-window reply excluded by eligibility from a genuinely absent reply.
- Preserve: linked, ambiguous, absent, and outside-window states; rating
  coverage; the provider contract; all eight core tests; and the private
  comparator.
- Stop: return `NEEDS_CONTEXT` before any behavior, scope, topology, privacy,
  data-integrity, file-surface, or authority change.

## Primitive and data-protection impact

| Primitive | Disposition | Contract delta |
| --- | --- | --- |
| Analysis eligibility | Reuse | None |
| Exchange | Reuse | None |
| Rating coverage | Reuse | None |
| Record provider | Reuse | None |
| Artifact provenance | Reuse | None; it remains owned by the report layer |

- Data-protection gate: no processing changes. The slice changes no collection,
  processing extent, retention, accessibility, pseudonym, or artifact default.
  It removes only an unused in-memory object shape.
- ADRs: ADR-0005 and ADR-0006 remain valid and unchanged.

## Research and planning-stage review

- Research: none. No external API, library contract, or unresolved decision can
  affect this repository-determined deletion.
- Planner: configured read-only planner agent
  `019ffccb-60c6-7b31-bd26-52347906fef9`.
- Verdict: `DONE`.
- Report:
  `project/_local/reviews/2026-08-13-pr-5390-analysis-core-pragmatic-simplification-planning-stage.md`.
- Accepted changes: use this W1-specific plan, declare no new tests, retain the
  slice in the main session, run paired post-slice specialists, and give W1 its
  own integrated final review.

## Delegation Map

| Workstream | Slice | Owner | Dependency | Acceptance boundary |
| --- | --- | --- | --- | --- |
| W1 pragmatic core simplification | S1 — delete unused provenance shaping | `main` | This plan committed from the selected source | Eight tests, strict analysis check, changed-path formatting, diff check, and exact removal-only audit pass |

## Feature-wide test portfolio

| Risk or behavior | Existing evidence | Test obligation | Primary seam | Distinct failure caught | Owner |
| --- | --- | --- | --- | --- | --- |
| Purpose, course, window, and withdrawal remain fail closed | Core tests 1, 2, 7, and 8 | None; retain existing | `selectEligibleMessages` and `runAnalysisCore` fixtures | An ineligible message enters analysis | S1 |
| Linked, ambiguous, absent, and outside-window states remain distinct | Core tests 3, 4, 7, and 8 | None; retain existing | `buildExchanges` fixtures | A regenerated, excluded, or outside-window reply is misclassified | S1 |
| Rating coverage and provider input remain stable | Core tests 5, 6, and 8 | None; retain existing | Coverage and provider fixtures | Ratings or provider selectors drift | S1 |
| Only unused provenance shaping is removed | Strict analysis typecheck and exact diff | No new test | Type contract and committed diff | A live caller or unrelated behavior changes | S1 |

## Slice S1 — remove unused provenance shaping

- Problem: `runAnalysisCore` computes and returns provenance that no current
  consumer uses.
- Route: `main`.
- Execution-tier skip reason: delegation costs more than the work.
- Owned implementation paths:
  `packages/prisma-data/src/chatbot-analysis/core.ts` and, only if a focused
  check proves it strictly necessary,
  `packages/prisma-data/src/chatbot-analysis/core.test.ts`.
- Do: delete only the four settled provenance surfaces. Do not reduce or rewrite
  tests.
- Check:
  `devrouter exec . -- pnpm --filter @klicker-uzh/prisma-data test`;
  `devrouter exec . -- pnpm --filter @klicker-uzh/prisma-data run check:analysis`;
  `devrouter exec . -- pnpm exec biome check packages/prisma-data/src/chatbot-analysis/core.ts`;
  plan Prettier check; `git diff --check`; eight-test count; exact diff audit.
- Commit: `refactor(prisma-data): remove unused analysis core provenance`.
- Post-slice review: the slice is substantive and data-integrity-sensitive. Run
  exactly one simplifier and one slice reviewer in parallel on the same
  immutable committed range, with no writer active. The reviewer covers
  correctness, contract compliance, data integrity, and verification
  sufficiency.
- Final review: one integrated final reviewer covers correctness, plan
  compliance, maintainability, and security. Architecture is not applicable
  because no trust boundary or data flow changes.

## Progress

- Status: S1 implemented, verified, and accepted by both post-slice roles;
  integrated final review remains.
- Active slice: final W1 closure.
- Completed: takeover verification, planning-stage review, plan commit
  `1398f42fd`, implementation commit `fac726762`, focused verification, and
  paired post-slice simplification and review.
- Remaining: commit this Progress update, run fresh final verification, and
  obtain the integrated final review.
- Latest verified range:
  `1398f42fdd81abd97c41ce7c02df7e04a7351d0c..fac726762f915c84d2ad9ac53b623a444343f614`.
- Verification: Node `v24.16.0`; focused Vitest passed 8/8; strict
  `check:analysis` passed; changed-path Biome passed; `git diff --check` passed;
  the implementation commit contains 34 deletions and no additions in
  `core.ts`. The commit hook also passed `check:all` on host Node 26 with engine
  warnings and is supporting evidence only.
- Test delta: no tests added, changed, or removed; all eight existing tests are
  retained.
- Planning report:
  `project/_local/reviews/2026-08-13-pr-5390-analysis-core-pragmatic-simplification-planning-stage.md`.
- Simplifier: done —
  `project/_local/reviews/2026-08-13-pr-5390-analysis-core-pragmatic-simplification-simplifier.md`.
- Slice review: done —
  `project/_local/reviews/2026-08-13-pr-5390-analysis-core-pragmatic-simplification-slice-review.md`.
- Integrated final review: pending on the final committed range.
- Active child IDs: none.
- Delivery: required and achieved layer is verified local commits only; no
  external action is authorized.
- Blockers: none. The runtime lacked the native `slice-reviewer` role, so the
  documented materially equivalent trusted read-only fallback was used and is
  recorded in its report. A rejected parallel spawn partially created one
  extra simplifier; it returned the same no-finding result and was closed
  without counting as another gate.
- Next: commit this Progress update, run the final checks, and start the
  configured integrated final reviewer.

## Completion evidence

- Fresh command results for the focused tests, strict analysis check, changed
  paths, and `git diff --check`.
- Exact committed range and changed paths.
- Planning, simplifier, slice-review, and integrated-final report paths.
- Explicit list of withheld external actions not taken.
