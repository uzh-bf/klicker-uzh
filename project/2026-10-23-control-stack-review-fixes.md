# Controller stack review fixes

## Approval summary

Repair the three confirmed controller review findings: quiz ending must not bypass an unsuccessful block closure; Q&A settings changed by another controller must remain observable; content acknowledgments must not count as question responses. Preserve the current controller design, GraphQL operation shapes, permissions, assessment policy and five-layer PR topology.

The user authorized this executable batch with “so fix that” after the review and repair recommendation. Authority covers implementation, regression tests, local runtime repair and verification, local commits, ordinary non-force pushes and updates to the existing PR descriptions. Merge, deployment, readiness changes, branch deletion and history rewriting remain outside this batch. Existing local runtime remains available for manual testing.

The package finishes when all three repairs pass focused regression and browser checks, required internal review is complete, and the affected existing PR layers contain the verified changes. Report any concrete CI or publication blocker separately. No production data, paid model calls, dependencies or database migration is required.

## Execution details

### Baseline and scope

Full path because quiz lifecycle changes protect persisted results. Execution mode: standard (exact selected runtime model identity is unavailable). Existing review evidence is in ignored `project/_local/reviews/control-stack-6539-review.md`. Current top: `1b4bd890e9258517a85827989d05b7edb2ad1b2b`; ultimate target `v3-ai`; stack 6540 consists of PRs 6536, 6537, 6538, 6509 and 6539. Keep all PR identities and their order.

The prior runtime-only Rollup workaround is preserved as a private local patch and remains outside delivery. It may be applied for local builds; do not publish it as controller source. Avoid integrating unrelated target drift solely to change the tested baseline.

### Primitive impact

| Primitive | Disposition | Required behavior | Consumers |
| --- | --- | --- | --- |
| Live quiz lifecycle | Extend enforcement of existing invariant | End only when no block is active; failed close cannot lead to end; concurrent activation/end cannot produce an ended quiz with an active block or duplicate rewards | API, controller, manage |
| Q&A settings | Reuse | Other controllers' changes remain observable while Q&A is disabled and empty | Controller Q&A and pending counter |
| Question response | Reuse | Content acknowledgment is not a vote or question; preserve existing question totals | Controller status and statistics |

### Ownership and sequence

Main owns API transaction/concurrency design, integration, runtime, commits and publication. A bounded executor owns the settled controller changes. Planner challenges this frozen plan before implementation; simplification, risk review and final review cover the complete committed correction package. No matching prior review covers these new repairs.

Delegation Map: API repair → main (unresolved concurrency design; accept persisted state/reward tests); controller repair → executor (accept three browser regression scenarios and type check); propagation → main after both accepted repairs (accept unchanged topology and ancestry-preserving commits); final verification/publication → main after integration (accept checks, reviews and remote read-back). Stop propagation on unexpected remote movement or any need to rewrite history. Current implementing branch is `feat/control-ios-shell` in the same review worktree.

1. API repair, owned by main: in `packages/graphql/src/services/liveQuizzes.ts`, claim `PUBLISHED → ENDED` on the quiz row inside an interactive transaction only if `activeBlockId` is null, before reading reward inputs or awarding rewards. Keep all reward writes and the terminal transition in that transaction. A losing end returns the currently ended quiz for idempotency, otherwise rejects without rewards. Activation guards published status at its write boundary; rejected activation does not initialize Redis, publish or schedule timers. Add focused lifecycle coverage in a new `packages/graphql/test/liveQuizLifecycle.test.ts` using real disposable PostgreSQL and test-owned synchronization. Cover both activation/end orderings, concurrent and repeated end, active-block rejection, no-participant ending, and reward-write rollback. Assert exactly-once XP and applicable reward effects. Place this change in PR 6537.
2. Controller repair, owned by executor: inspect `RunningQuizBanner.tsx` and reject a false/null close result before ending; keep Q&A settings polling in `pages/session/[id].tsx`; exclude content instances from vote/question aggregation in `StatsPanel.tsx` and from the response helper in `LiveEvaluationCard.tsx` where needed. Extend `playwright/tests/C-control.spec.ts` for consequential browser regressions, using test-owned synthetic fixtures; no production mocks or new app abstraction. Place controller code/tests in PR 6509.
3. Main integrates normal commits upward into the existing layers, preserving ancestry and avoiding history rewriting. Record recovery refs and exact remote heads before propagation; verify every layer and use ordinary fast-forward publication. Keep user work and local build overlay out of staged delivery.
4. Run focused checks and real browser acceptance on the same retained runtime, inspect screenshots for the affected Q&A/stats/error states, complete required reviews, update descriptions from verified evidence, and report per-layer CI.

### Test portfolio

| Risk | Obligation | Primary seam | Acceptance |
| --- | --- | --- | --- |
| Failed close followed by end | Extend existing | Controller browser workflow | False closure response produces failure and leaves quiz running |
| Concurrent start/end and repeated rewards | Add new | GraphQL lifecycle service with disposable database | Only valid state transitions commit; rejected end has no award side effects; ended quiz cannot activate a block |
| Q&A disabled window misses remote enable | Extend existing | Two browser pages against real local app | Disabled page observes enable from another page and questions remain observable |
| Content acknowledgments counted as questions/votes | Extend existing | Browser statistics with synthetic content and question | One acknowledgment plus one question answer displays one question response |

The failed-close browser test intercepts false and null mutation results and asserts no end mutation is sent, confirmation remains open and no success occurs. Q&A uses independent pages, remote enabling and a new pending question without reload. Statistics uses more content acknowledgments than question answers and asserts response count, question count and fallback participant count while retaining server-provided counts.

Existing five util aggregation tests remain protection for delayed result persistence. Run repo-native type checks, staged formatting, lint and required hooks in the container. Host owns Git and browser tests. Reuse unchanged passing evidence. New test files are justified only for the uncovered lifecycle contract.

### Runtime and authority

Reuse the exact existing review worktree and managed runtime. Retained-runtime browser checks use the supported `KLICKER_PLAYWRIGHT_PRESERVE_DATABASE=1` path and uniquely owned synthetic fixtures with scoped cleanup. Do not invoke broad GraphQL `testCleanup` against retained data. Lifecycle tests use scoped owned records in the marked disposable database with isolated Redis test doubles; a separate database is preferred if an existing supported route can provision it without altering the guard. If that isolation cannot be established, keep database contents and fail that verification branch explicitly. The user's manual-testing request is the keep-running lease, revisited when testing ends. No retained database reset, real data discovery, cluster access or external notification is authorized. Test data is local and synthetic; Teams webhook was absent in the baseline and must remain so during mutation tests.

## Progress

- Planner approved the transaction invariant and scoped synthetic-fixture strategy before implementation.
- All three repairs are implemented. Six real PostgreSQL lifecycle regressions and all five Chromium controller workflow tests passed. Required container type, format, lint and hook checks passed.
- The simplifier found only two redundant test counters; both were removed while retaining the six lifecycle cases and two-page polling assertions. Risk review and integrated final review precede publication.
- Direct browser verification confirmed remote Q&A enable and disable in an already loaded controller. Desktop and compact screenshots use local synthetic fixtures; native iOS execution remains outside this correction's verification.
- Next action: finish reviews, propagate the API and controller corrections into their existing layers with ancestry-preserving merges, verify the resulting tree and publish ordinary fast-forward updates. Keep the exact review runtime running for the user's manual testing.
