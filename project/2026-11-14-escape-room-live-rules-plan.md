# Escape Room — Live Quiz rules (W7)

- **Status:** In progress
- **Roadmap:** W7 of [the classroom escape rooms roadmap](2026-11-07-classroom-escape-rooms-plan.md). On 2026-11-14 the user moved Live Quiz first: W7, then W3, ahead of W4–W6.
- **Approval mode:** executable batch under the roadmap approval of 2026-11-08 (cards A–F) and the reorder of 2026-11-14.
- **Goal:** a Live Quiz Escape Room block enforces the same scoring rules as the other modes, so the lecturer's format ("Akte Alpenglanz") can run as a Live Quiz with its penalties, reveal, skip, bonus, ordered hints and a ranked result.
- **Branch:** `codex/escape-room-live-rules` on top of `codex/escape-room-design` (#6884), added to native stack 5228 as its top layer.
- **Ceremony tier:** full path (grading path in the Response API, GraphQL inputs, three apps).

## Scope

In:

- Block settings for every shared rule (wrong-answer penalty, tries before reveal, reveal penalty, skip penalty, bonus credit, indexed hint penalties) and the classroom preset, in the Live Quiz block modal; persisted on the block's `EscapeRoomConfig`.
- Ordered hints per element in Live Quiz blocks (one per line, as in the other modes).
- Response API grading with the shared rule functions: wrong-answer penalty, reveal after the configured tries (clears the stage without a solved response), per-stage `stageOutcomes` for every outcome, the bonus stage after completion with its time credit.
- Skip for Live Quiz blocks through the existing `skipEscapeRoomStage` mutation.
- Student screens: tries left, reveal notice, skip with confirmation, ordered hints with their prices, bonus offer and result, stage markers for revealed, skipped and bonus stages.
- Ranking and outcome columns for Live Quiz in the cockpit table.

Out:

- Mistake feedback. It needs W4's mistake ranges on numerical elements, which do not exist yet. W7's Response API path is built so W4 can add them.
- Per-team numbers and anonymous teams (roadmap: later for Live Quiz).
- Template inputs for the new rules (`TemplateBlockInput`); templates keep today's fields, so saving a Live Quiz as a template keeps only the first hint and no rules. The docs say so.
- Persisting results after the block closes and the projector: W3.

## Decisions

- **The Response API reads the rules from the block's `EscapeRoomConfig`** through the instance query it already runs (`loadEscapeRoomInstanceState`), and maps them with the shared `getEscapeRoomRules`. Hints and skip read the same record, so there is one source and no null encoding.
- **Stage key for Live Quiz is the element instance id.** `stageOutcomes` entries use it; progress already counts stages by instance id.
- **All rule state is written under the existing lifecycle claim** (`getEscapeRoomLifecycleClaimKey('liveQuizBlock', …)`), which serializes a participant's answers, hints and skips. Read-modify-write of `stageOutcomes` and `penaltySeconds` happens inside it.
- **Reveal and skip clear a stage without a Hatchet event.** They record `REVEALED` or `SKIPPED` (with the penalty) in Prisma first, then add the instance to `escape-attempt:<id>:cleared` and delete its tries key. A stage counts as cleared when either store says so, so a retry repairs a failed Redis write. No solved response is recorded; the answer statistics count only real solutions, and the close gate has nothing to drain.
- **A Live skip goes through the close gate.** It acquires the block's response slot like an answer and is rejected once the block is closing.
- **A reveal shows the solution**, as in the other modes: the Response API returns it with the reveal (choice indices for SC, MC and KPRIM, the exact value or range for numerical, the accepted answers for free text; nothing for QR scan), and the reveal notice displays it.
- **One answerable-stage check for Live Quiz**, modelled on `assertAnswerableStage` in the stack modes, decides for answers, hints and skips: the current regular stage while the attempt runs, or the unanswered bonus stage of a completed attempt within the time limit. Outcomes in `stageOutcomes` are checked before the Redis cleared shortcut, so resubmitting a revealed stage is not reported as correct. Expiry checks never turn a completed attempt into an expired one.
- **Wrong attempts are counted in `stageOutcomes`**, the shared source; the per-instance Redis `tries` key stays for the solved response's `tries` value.
- **Bonus:** when `bonusSeconds` is set and the block has more than one stage, the last stage is the bonus stage. The attempt completes when every other stage is cleared; the completing response says a bonus is pending. The bonus stage is then offered once, within the time limit, without hints or skip; a correct answer records `BONUS_CORRECT` with the credit and emits the solved response; a wrong answer records `BONUS_WRONG` without lockout or penalty; both add the bonus instance to the cleared set. The student query shows the bonus stage for a completed attempt with an unanswered bonus.
- **Existing quizzes and attempts.** A Live element's single `escapeRoomHint` keeps working as the first hint; edits write `escapeRoomHints` through `getEscapeRoomHintUpdate`. Live attempts from before this layer have no `stageOutcomes`; the cockpit ranks them by `completedAt` as solved without penalties beyond the recorded hint penalties.
- **A wrong answer still locks for the configured lockout**, except when it triggers a reveal.
- **Penalties count toward ranked time only**, as ruled on 2026-11-08; the clock is unchanged.
- **Response contract:** the Response API JSON adds `attemptsLeft`, `revealed`, `penaltySeconds` and `bonus` (`correct`/`wrong`) next to `status`, `completed` and `lockoutUntil`. Existing fields keep their meaning.

## Slices

1. **Authoring.** `ElementBlockInput.escapeRoomRules` (reusing the rules input type), validation and persistence in `manipulateLiveQuiz` (create, edit and duplicate keep the rules; hints through `getEscapeRoomHintUpdate`); `QGetSingleLiveQuiz` loads every hint and rule field so edits keep them; a multi-line hint field per live element; the Manage block modal gets the rules card in a prop-driven mode (values and change handler for one block, preset applied to that block) and the per-block yup schema gets the rule fields. Acceptance: GraphQL test of the config and hints round trip through the wizard's query and mutation; browser check of the modal and an edit that keeps the rules.
2. **Grading.** Response API rules as above, with unit tests for penalty, reveal (no Hatchet event, no pending close-gate entry, stage cleared, solution returned), completion with and without bonus, bonus correct and wrong, a second bonus answer rejected, a late bonus keeping the attempt completed, resubmitting a revealed stage, lockout skipped on reveal.
3. **Skip and student data.** `skipEscapeRoomStage` accepts `elementBlockId` (claim, response slot, Prisma before Redis); hints use the same answerable-stage check and are refused on the bonus stage; the running-quiz query and ops select the rule fields, `revealedHints`, the attempt's `stageOutcomes`, and expose the bonus stage after completion. GraphQL tests for skip (penalty, held claim, closing block, bonus not skippable, completion) and for the bonus exposure.
4. **Student UI.** Hook and controls parse the new response fields and use the shared pieces (tries left, reveal notice, skip button, ordered hints, bonus offer, stage tracker with outcomes). Stage-adapter unit test for Live outcomes.
5. **Ranking, docs, end-to-end.** Rank and outcome columns for Live Quiz in the cockpit; docs and both tutorials; the Live Quiz Playwright test plays a block with the classroom preset (wrong answers, reveal, skip, bonus).

Each slice is verified in the container and committed on its own.

## Test portfolio

| Risk | Obligation | Seam |
| --- | --- | --- |
| Live Quiz rules diverge from the shared rules | add new | Response API tests calling the shared functions |
| Reveal or skip records a solved response or blocks the close gate | add new | Response API test (no event, no pending entry); GraphQL skip test |
| Concurrent answer and skip double-charge | extend existing | skip under the lifecycle claim, GraphQL test with a held claim |
| Rules lost on edit or duplicate | extend existing | `escapeRoomLiveQuiz.test.ts` config round trip |
| Bonus credit or ranking wrong for Live Quiz | add new | progress service test with Live outcomes |
| Classroom flow regresses end to end | extend existing | Playwright `live-quiz.ts` (CI; locally needs both Hatchet workers) |
| Copy and styling | none | browser screenshots |

## Verification

- Container: `check` for graphql, response-api, frontend-pwa, frontend-manage; Biome on changed files; the escape-room GraphQL suites, the Response API tests, the worker deduplication tests (`escapeResponseDedup.test.ts`), the close-gate tests (`escapeRoomResponseGate.test.ts`), grading and PWA unit tests.
- Browser: the Akte Alpenglanz quiz with the classroom preset, played by test teams (requires both Hatchet workers in the local stack).
- One independent review of the integrated layer before the draft PR is called complete.

## Authority

Granted: local commits, pushing `codex/escape-room-live-rules`, a draft PR on top of #6884, adding it to stack 5228, its description and screenshots.
Withheld: marking ready, reviewer requests, merge, deployment, force-pushes of lower layers.

## Recovery and terminal condition

A slice that fails verification is fixed or reverted before the next one. A change needed in a lower layer is recorded as a gap, not made there. The batch ends when the draft PR exists on top of #6884 with screenshots, its required checks have run, and remaining gaps are listed; then W3 is planned.

## Progress

- 2026-11-14: plan written on `codex/escape-room-live-rules` at `d6c23a4b6b`.
- 2026-11-14: independent plan critique (planner) returned REVISE with six findings, all accepted: one answerable-stage check covering the bonus after completion and expiry; skip through the close gate with Prisma before Redis; rules read from Prisma instead of the activation cache; edit round trip of every hint and rule; reveal shows the solution; template and pre-existing attempt gaps documented, mistake feedback moved to W4 in the roadmap.
