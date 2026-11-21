# Classroom escape rooms roadmap

## Approval summary

**Why and what changes?** A lecturer built a standalone lecture-hall escape room ("Akte Alpenglanz") for about 400 students. Teams of 3–4 join with a team code and no login. They crack numbered files in order, each team gets its own numbers, and wrong answers trigger targeted feedback. A projector shows a live ranking and a per-file debrief. Klicker's draft Escape Room stack (#5224–#5227) cannot host this format.

This roadmap closes the gap by extending the **shared Escape Room core**, so every Escape Room benefits where it makes sense: Practice Quiz, Microlearning, Group Activity and Live Quiz blocks. Only what is inherently about teams stays specific to Group Activity:

1. Every Escape Room gets the lecturer's scoring rules and a ranking.
2. One Escape Room dashboard with insights (ranking, per-stage progress, debrief, mistake counts, CSV export) serves all four modes. The projector view and the lecturer-run clock exist only for synchronous play in Group Activity and Live Quiz blocks; Practice Quiz and Microlearning stay asynchronous.
3. Numerical stages can generate per-attempt numbers and give targeted feedback for typical mistakes, which feeds the shared debrief.
4. Group Activity stages unlock in order, and teams can form inside the activity anonymously behind an optional PIN.
5. Finished Escape Rooms can reopen as untimed practice with fresh numbers.

**What stays unchanged?** Group Activities without Escape Room mode keep course groups, clues, decision submission, manual grading and course points. Existing Escape Room configurations keep their behavior: new rules default to "off" or to today's values.

**What could change the decision?**

- The stack is unmerged and 374 commits behind `v3`; building more layers on it is fragile (card A).
- Shared rules touch all four grading paths, including the Live Quiz Response API.
- Anonymous joining takes Group Activity outside the course-enrolment boundary (card C).
- Local database and browser runs were blocked when the stack was last verified; W0 must restore them.

**How will we know it is done?** A synthetic fixture modeled on the lecturer's first level runs end to end in a browser as a Group Activity: anonymous teams join, the lecturer runs the clock, teams see different numbers, mistakes get targeted feedback, the projector shows ranking and debrief, and the activity reopens for practice. The same dashboard insights, rules and mistake feedback are shown working for a Practice Quiz, and the dashboard and projector for a Live Quiz block. Non-escape Group Activities still pass their existing tests.

**What does approval authorize?** See the execution contract. Merging, marking ready and deployment stay withheld.

## Execution contract

- **Execution owner:** main session, one package at a time.
- **Boundary owner:** self.
- **Approval mode:** executable batch for W0–W7 once cards A–F are ruled.
- **Authority:** worktrees under `trees/`, local commits, ordinary pushes of new task branches, draft PR creation and updates on `uzh-bf/klicker-uzh`, configured reviews including the standing `/final-review`. Card A additionally requests force-pushing the four existing stack branches with lease.
- **Withheld:** merging any PR, marking PRs ready, requesting human reviewers, deployment, contacting the lecturer, committing the lecturer's materials.
- **Terminal:** W0–W7 delivered as draft PRs with green required CI, browser evidence in each UI PR, plan Progress current, and the integrated final review of the top layer complete.
- **Pause:** a ruling that changes a card's outcome; a migration the schema tool cannot generate with at most a documented hand-written addition; local database or browser runtime still unavailable after W0's bounded repair; a required check that cannot run anywhere.

## Design rule: shared core, thin mode adapters

The stack already has a shared core, and every new capability extends it rather than adding a Group Activity copy:

- one configuration per Escape Room (`EscapeRoomConfig`) and one attempt record (`EscapeRoomAttempt`);
- one activity reference covering the four modes, with shared start, hint and reset (`services/escapeRooms.ts`);
- one progress service (`services/escapeRoomProgress.ts`) and one Manage component (`EscapeRoomProgress.tsx`), already used by the activity evaluation tab, the Group Activity grading page and the Live Quiz cockpit;
- one PWA overlay and hook (`EscapeRoomOverlay.tsx`, `useEscapeRoom.ts`) for Practice Quiz, Microlearning and Group Activity, plus Live Quiz controls.

Each mode keeps only its adapter: where stages come from, which grading entry point runs (`escapeRoomStackSubmissions.ts`, `groupEscapeRoomSubmissions.ts`, `apps/response-api/src/escapeRoom.ts`), where progress is stored, and who the player is. Live Quiz is the different one: its progress lives in Redis and correct answers flow through Hatchet, so it gets its own adapter package (W7).

Shared code has fixed homes, so the GraphQL services, the Response API and the response-processor worker call the same functions:

- pure rule, number and mistake-matching functions and the formula evaluator go in `packages/grading`, which has no workspace runtime dependencies and must not import `packages/util`; it gains `mathjs` 11.9.1, the version `packages/graphql` already pins;
- pause-aware expiry extends `isEscapeRoomExpired` in `packages/types`, next to the existing shared escape helpers.

## Decision cards

### A — Refresh the stack before building on it

- **Action:** rebase #5224 → #5225 → #5226 → #5227 onto current `v3`. Re-timestamp and regenerate the stack's three July migrations so they sort after `v3`'s migrations. Regenerate the tracked GraphQL SDL snapshot, rerun CI, and force-push the four branches with lease. Save the four pre-rebase heads as backup refs first.
- **Why:** building on a base 374 commits behind multiplies conflict cost. Migrations dated July would otherwise sort before already-applied `v3` migrations.
- **Recommendation:** approve.
- **Better alternative, if you can:** get #5224–#5227 reviewed and merged into `v3` first, then build on `v3` with a shorter stack. That needs a reviewer and your merge authority; this roadmap does not request it.
- **Risk and recovery:** the force-push rewrites draft branches nobody else is known to build on; the backup refs restore them. A conflict that changes Escape Room behavior pauses for your review.
- **Declining:** later layers build on the stale base, and integration with `v3` becomes a blocking step before any merge.

### B — Ordered Group Activity stages replace the all-at-once challenge

- **Action:** in Group Activity Escape Room mode, each element of the activity's single stack becomes one stage, and stages unlock in element order, like stacks in Practice Quiz and questions in a Live Quiz block. This amends #5226 in place.
- **Why:** ordered stages are what every other Escape Room mode already does; Group Activity is the outlier. #5226 is unmerged, so nothing live depends on its semantics. Duplication, templates and the PWA all assume one stack; elements as stages keeps that.
- **Recommendation:** amend in place.
- **Alternative:** a "stage order" setting keeping both behaviors. It doubles grading and monitoring paths for a format with no known user.
- **Risk:** #5226's review history partly describes the old behavior; its PR description is rewritten.
- **Declining:** group escape stays all at once and the lecturer's ordered files cannot be modelled.

### C — Anonymous activity teams with an optional PIN (Group Activity only)

A Group Activity gets a **team source** setting:

| Team source | Who can join | Identity stored | Course points |
| --- | --- | --- | --- |
| Course groups (default, today) | Enrolled participants in a course group | Participant | As today |
| Activity teams | Anyone with the activity link, plus the PIN if set | Team name and a pseudonymous device token | None |

- **Recommendation:** build both. Logged-in members of activity teams are a possible later variant; the member record leaves room for it.
- **Retention ruling needed:** recommendation is to delete activity teams, their members and answers 30 days after the activity ends. The existing escape-attempt prune job (90 days) stays for everyone else. Per-stage outcome counts for the debrief are kept on the Escape Room, because they contain no identity.
- **Risk:** anyone in the room with link and PIN can join. Team names appear on the projector, so lecturers can rename and remove teams. Team-code guessing is rate limited.
- **Other variants considered:**
  - Logged-in activity teams now: more identity than the lecture needs.
  - One device per team: covered, since a team may have one device.
  - Course PIN join (`Course.pinCode`): it enrols a logged-in participant, the step the lecturer wants to skip.
  - Live Quiz as host: no team primitive and no asynchronous practice window.
  - Anonymous play in Live Quiz Escape Room blocks: the stack excludes Live Quiz temporary participants today. The new member identity could later serve them; not in this batch.
- **Declining:** every student needs a Klicker account and course enrolment, and teams must form in the course before the lecture.

### D — Per-attempt numbers live on the numerical element

- **Action:** a numerical element can declare random variables (range, rounding) and derived values (formulas). Prompt, explanation, solution ranges and mistake ranges may reference them. Each attempt stores a seed; values derive from the seed and the variable name.
- **Why on the element:** the same element works in any Escape Room mode that grades per attempt, and later in non-escape activities.
- **Recommendation:** approve, enabled in Practice Quiz, Microlearning and Group Activity Escape Rooms (card F).
- **Alternative:** activity-level variables shared across stages. Seeding by variable name keeps that addable later without a migration. Before W4, the lecturer's file structure is checked to confirm stages do not share numbers.
- **Risk:** formulas are user input evaluated on the server. They are parsed and checked against an allowlist of syntax nodes, constants, declared variables and arithmetic functions, validated at authoring time, and non-finite results are rejected.
- **Declining:** every player sees the same numbers and neighbours can copy answers.

### E — Shared scoring rules on every Escape Room

- **Action:** the Escape Room configuration gains a wrong-answer time penalty, an ordered hint list per stage with individual penalties, a maximum number of attempts before the solution is revealed and that reveal's penalty, a skip penalty, and an optional bonus stage with one attempt and a time credit. The existing lockout stays as its own cooldown setting. Ranking: stages solved without reveal or skip, then elapsed time including penalties.
- **Compatibility:** all new rules default to off, so existing Escape Rooms behave as today. An existing single hint becomes a one-item list. The inconsistent hint-penalty defaults (30 in the schema, 120 in the service) are unified to 30.
- **Recommendation:** approve, with the lecturer's values offered as a preset in the editor.
- **Alternative:** rules only for Group Activity. That creates a second rule set and a second ranking for no product reason.
- **Risk:** the Live Quiz grading path runs in the Response API, so the rules are evaluated there through the same shared function; its existing claim and close-gate tests must keep passing.
- **Declining:** the lecturer's penalty logic cannot be reproduced.

### F — Which shared capability reaches which mode now

| Capability | Practice Quiz | Microlearning | Group Activity | Live Quiz block |
| --- | --- | --- | --- | --- |
| Scoring rules and ranking (E) | yes (W2) | yes (W2) | yes (W2) | yes (W7) |
| Dashboard insights: ranking, progress, debrief, mistake counts, CSV export | yes | yes | yes | yes |
| Projector (lobby, live ranking, debrief on screen) | no, asynchronous | no, asynchronous | yes | yes |
| Lecturer-run clock (start, pause, end) | no, asynchronous | no, asynchronous | optional, inside the scheduled window | no, the block's open and close already control it |
| Per-attempt numbers (D) | yes | yes | yes | later |
| Mistake feedback | yes (W4) | yes (W4) | yes (W4) | yes (W7) |
| Ordered stages | already | already | W1 | already |
| Anonymous teams and PIN (C) | no | no | yes | later |
| Practice reopen with fresh numbers | yes, configuration setting | yes, after the scheduled end | yes, after the scheduled end | no |

Practice Quiz and Microlearning are asynchronous: students play whenever the activity is available, and lecturers follow along through the dashboard insights. Practice Quiz has a start date but no end window, so its practice reopen is a setting on the Escape Room configuration rather than a window-driven phase.

Rankings on the dashboard and projector protect individuals. Individual modes show pseudonyms only, and only participants who opted into leaderboards (`Participation.isActive`). Activity teams show their team names. Course groups show their group names.

- **Recommendation:** approve this matrix.
- **Why Live Quiz is separate and partly "later":** Live Quiz keeps cleared stages and tries in Redis, grades from solutions cached at block activation, and sends correct answers to Hatchet. Rules and mistake feedback there need mistake ranges in that cache, and reveal or skip must clear a stage without emitting a solved response. W7 delivers that contract last, so a Live Quiz regression cannot hold back the classroom path. Per-player numbers and anonymous play also need changes to that pipeline and the shared statistics, which the lecturer's format does not require.
- **Alternative:** Group Activity only for everything except the dashboard. Smaller, but it leaves four modes with diverging behavior.
- **Declining:** each capability is built for Group Activity only, and the matrix becomes follow-up work.

## Primitive impact

| Product primitive | Disposition | Contract delta | Affected compositions and consumers | Evidence or open ruling |
| --- | --- | --- | --- | --- |
| Escape Room configuration | extend | scoring rules, bonus stage, optional session clock (Group Activity), practice reopen setting | all four modes; Manage settings fields | cards E, F |
| Escape Room attempt | extend | seed, per-stage answers and outcome (solved, revealed, skipped), mistake keys; keyed by exactly one of participant, course group or activity team | GraphQL grading adapters, ranking, debrief, CSV, reset | cards B, E; Live Quiz keeps per-stage progress in Redis and Hatchet (W7) |
| Escape Room practice attempt | create | separate record for untimed practice with its own seed, so it never collides with the one ranked attempt per player and never touches ranking | practice reopen in Practice Quiz, Microlearning, Group Activity | the existing unique keys allow one attempt per player and activity; changing them would not be additive |
| Escape Room session | create | lecturer phase (lobby, running, paused, ended) with one clock, on the Escape Room configuration, inside the activity's published window | Group Activity attempts, projector, PWA timer | card F; Live Quiz blocks keep their own lifecycle |
| Escape Room hint | extend | ordered list with individual penalties | authoring, attempt, all modes | card E |
| Numerical element | extend | variables, derived values, rendered prompt and explanation per attempt; mistake ranges with label and feedback | element editor, shared grading, evaluation | cards D, F |
| Group Activity | extend | team source setting; Escape Room elements as ordered stages | Manage wizard, PWA group pages, grading, templates, duplication | cards B, C |
| Activity team | create | team scoped to one Group Activity, joined by team code; one or more anonymous members | escape attempt, ranking, projector, CSV export | card C; course groups require a course, carry course scores and messaging, and accept only participants |
| Activity member | create | pseudonymous device identity for one activity team, own token and cookie name; reuses only the Live Quiz token-signing helper | auth context in `apps/backend-docker` and `apps/response-api`, PWA join flow | the Live Quiz temporary identity is quiz-keyed and shares one cookie |
| Activity PIN | extend | optional PIN for Group Activity, same cookie pattern as Live Quiz | join flow | `setLiveQuizPinCookie` pattern |
| Group Activity instance | reuse | non-escape course-group activities keep `decisions`; Escape Room attempts are the per-stage answer record for every mode | grading, evaluation | escape `decisions` were only written when all answers were correct |

The dashboard and projector are presentation over these primitives, not primitives themselves.

## Work items

The four stack PRs are refreshed (W0), #5226 is amended (W1), and W2–W7 stack linearly above #5227 under `$rs-stacked-change`. Each package derives its own execution plan before implementation. If the stack becomes unwieldy, W2–W7 can rebase onto `v3` once #5224–#5227 merge.

### W0 — Stack refresh and working runtime

- **Outcome:** card A done; the self-contained devcontainer starts for this worktree with database, Hatchet and routed apps; `agent-browser` reaches the PWA and Manage.
- **Acceptance:** required GitHub checks green on all four heads; escape-room GraphQL tests and Playwright spec pass; a throwaway schema change generates a migration with the container's raw migrate command and is discarded.
- **Recovery:** one bounded repair of devrouter or Docker access (`klicker-environment-doctor`). If it fails, pause.

### W1 — Ordered Group Activity stages (amends #5226)

- **Outcome:** card B; a course-group team plays elements as ordered stages through the shared overlay; per-stage answers live on the attempt.
- **Early proof:** two members of one course group clear stage 1 and both see stage 2 unlock.
- **Acceptance:** existing group escape concurrency tests extended to ordered stages; non-escape Group Activity tests unchanged and green; browser evidence.

#### W1 execution plan

- **Worktree:** `trees/escape-room-group` on `codex/escape-room-group`, with a fresh devrouter runtime (profile `manage,pwa`). Its `.devrouter.yml` carries #6773's `freshBootstrap` declaration as an uncommitted local overlay; it never enters a commit.
- **Stage definition:** the stages are the activity's response elements (`isGroupEscapeRoomResponseType`) in ascending instance `order` across its stacks. Content elements stay visible and never gate.
- **Data model:** one generated migration adds `stageResponses Json @default("[]")` to `EscapeRoomAttempt`. Entries are `{ instanceId, response, clearedAt }`, appended only on a correct answer. QR responses are stored without the scanned code, like `decisions` today. Reset already deletes the attempt, so it also clears stage state.
- **Submission:** `submitGroupActivityDecisions` in escape mode accepts exactly one response, for the first uncleared stage. Another instance fails with `ESCAPE_ROOM_GATED`. The Redis claim and serializable transaction stay. Correct appends the stage; the last stage also writes `decisions` and `decisionsSubmittedAt` and completes the attempt. Incorrect sets the lockout and appends nothing. Element results statistics update on every submission, as today. Non-escape submission is untouched.
- **API exposure:** the participant attempt exposes `clearedStageInstanceIds`. The group participant query masks locked stages on the server, mirroring individual mode, so a member cannot read later questions from the network. `requestEscapeRoomHint` accepts only the current stage. The progress service counts group stages as response elements and cleared stages as `stageResponses` entries; dashboard labels must read as stages, not stacks, for every mode.
- **PWA:** cleared stages render read-only with the team's answer; the current stage is editable with its hint; later stages show a locked placeholder. Submit sends only the current stage. While an attempt is in progress, the details query polls every 5 seconds so other members see unlocks and lockouts.
- **Tests (portfolio rows "Non-escape Group Activity regresses" and "Concurrent team submissions"):** extend `escapeRoomGroupActivity.test.ts` with stage order, gating of a later stage, wrong answer lockout without progress, completion writing `decisions`, and two members racing on one stage (one clears, the other gets gated or processing). Update `playwright/tests/escape-room/group.ts` to clear two stages with two members. Existing non-escape group tests run unchanged.
- **Docs:** `docs/domain-model.md` and the #5226 description describe ordered stages.
- **Fixture:** the seeded Testkurs group used by the escape Playwright test must hold two enrolled test users; otherwise the test creates one.
- **Commit boundary:** amend the group layer's single W0 commit, keeping one commit per layer. Then rebuild `codex/escape-room-live` on it with the W0 per-layer method; conflicts in `escapeRooms.ts`, `escapeRoomProgress.ts`, the attempt model and the PWA are expected there. Force-push both with lease.
- **Pause:** a migration that the raw migrate command cannot generate cleanly, or a needed change to the shared individual-mode services.

### W2 — Shared scoring rules and ranking (GraphQL modes)

- **Outcome:** card E for Practice Quiz, Microlearning and Group Activity. One shared rule function in `packages/grading` decides penalties, reveal, skip and bonus credit and is called by both GraphQL grading adapters. The shared progress service returns a ranking, which `EscapeRoomProgress.tsx` shows wherever it is used today. Live Quiz follows in W7.
- **Acceptance:** rule unit tests in `packages/grading`; one service test per GraphQL adapter proving the same outcome for the same answer sequence; existing Escape Rooms with default settings behave as before; browser evidence for a Practice Quiz and a Group Activity.

#### W2 execution plan

- **Branch and PR:** `codex/escape-room-rules` from #5227's head, worked in `trees/escape-room-group` (its runtime is bound to that path; the `.devrouter.yml` overlay stays uncommitted). New draft PR with base `codex/escape-room-live`, added to the native stack. This plan file enters in its first commit.
- **Rule semantics** (taken from the lecturer's engine; every new setting defaults off):
  - wrong answer: `wrongAnswerPenalty` seconds and one counted wrong attempt for the stage; the existing lockout still applies;
  - reveal: when `maxWrongAttempts` is set and reached, the stage clears with outcome `REVEALED` and `revealPenalty`, without lockout;
  - skip: allowed only when `skipPenalty` is set; clears the current stage with outcome `SKIPPED`;
  - hints: an ordered list per element, revealed one at a time for the current stage only. A hint's own penalty wins; otherwise the config's ordered `hintPenalties` list applies by hint index (the lecturer's 120/240 s), then `hintPenalty`. The legacy single `escapeRoomHint` reads as a one-item list, and its existing `hintsUsed` key (`"<instanceId>"`) stays valid for the first hint; later hints use `"<instanceId>:<index>"`;
  - bonus: when `bonusSeconds` is set, the last stage is a bonus stage. The attempt completes when every other stage has an outcome; the bonus then accepts exactly one answer while time remains, without penalty or lockout, and a correct answer credits `bonusSeconds`. The credit never extends the time limit;
  - penalties and the clock: user ruling 2026-11-08, penalties count toward the ranked time only and no longer shorten the remaining time (`isEscapeRoomExpired`). This also applies to existing hint penalties and to Live Quiz blocks;
  - ranking: stages with outcome `SOLVED` (bonus excluded) descending, then ranked time ascending, where ranked time = last stage outcome time − start + penalties − bonus credit. Attempts that never started rank last.
- **Shared code:** `packages/grading/src/escapeRoomRules.ts` holds pure functions for wrong answer, reveal, skip, bonus, hint penalty, attempt score and ranking. Both GraphQL adapters and the progress service call them; the Response API calls them in W7.
- **Data model (one generated migration):** `EscapeRoomConfig` gains `hintPenalties Int[] @default([])`, `wrongAnswerPenalty Int @default(0)`, `maxWrongAttempts Int?`, `revealPenalty Int @default(0)`, `skipPenalty Int?`, `bonusSeconds Int?`. `EscapeRoomAttempt` gains `stageOutcomes Json @default("[]")`, entries `{ stageKey, wrongAttempts, outcome, at, creditSeconds? }` with outcome `SOLVED | REVEALED | SKIPPED | BONUS_CORRECT | BONUS_WRONG` (stage key: stack id in individual modes, instance id in Group Activity). Hint lists live in element instance options as `escapeRoomHints: [{ text, penalty? }]`. The service default for `hintPenalty` becomes 30 everywhere (Microlearning used 120).
- **Stage clearing:** in individual modes a stack counts as cleared when all its elements are answered correctly (today) or it has a `REVEALED`/`SKIPPED` outcome. One helper, `isEscapeRoomStackCleared(elements, outcome)`, serves every call site: `escapeRoomStackSubmissions.ts` (current, preceding and completion checks), `practiceQuizzes.ts` and `microLearning.ts` masking, `escapeRooms.ts` hint gating, and `escapeRoomProgress.ts`. Group Activity appends reveal and skip to `stageResponses` as `{ instanceId, response: null, outcome, clearedAt }`, so the W1 derivation in `groups.ts` masking, hint gating, `groupEscapeRoomSubmissions.ts` and progress keeps working; `stageOutcomes` holds only its wrong-attempt counts and the bonus. `stageDecisions` skips entries without a response.
- **Bonus paths:** the stack and group adapters accept a `COMPLETED` attempt only for an unanswered bonus stage within the time limit; their current-stage checks treat the bonus as current only after the other stages have outcomes. The bonus answer stays outcome-only: Group Activity `decisions` are written when the last non-bonus stage clears. Practice Quiz and Microlearning masking must show the bonus stack once the attempt is `COMPLETED`; the PWA completion screen gains a "bonus available" state.
- **Concurrency:** `skipEscapeRoomStage` takes the same lifecycle claim as hints and submissions.
- **API:** config fields in the create, edit, duplicate and template paths of Practice Quiz, Microlearning and Group Activity; `EscapeRoomAttempt.stageOutcomes` and current-stage `attemptsLeft`; `skipEscapeRoomStage` mutation on the shared activity reference; hint results add `revealedHints` and whether more exist, keeping `revealedHint` for Live Quiz; the progress service adds rank, solved, revealed and skipped counts and ranked time.
- **UI:** Manage settings fields for the five rules plus a "classroom preset" button with the lecturer's values (5 tries, 30 s wrong, 120/240 s hints, 480 s reveal, 600 s skip, 180 s bonus); a hint-list editor per element in escape mode. Live Quiz blocks keep today's fields until W7. PWA overlay shows tries left, a skip button with its penalty, the next hint's penalty and all revealed hints, a reveal notice and the bonus stage after completion. `EscapeRoomProgress.tsx` adds rank and outcome columns.
- **Tests (portfolio rows "Existing Escape Rooms change behavior under new defaults", "Grading adapters disagree", "Concurrent team submissions"):** rule unit tests; one service test per adapter running the same sequence (two wrong, hint 1, hint 2, reveal, skip, solve, bonus) and asserting equal penalties, outcomes and score; existing escape tests unchanged with defaults; a concurrency case that two members cannot both trigger a reveal or skip. Playwright: extend the practice-quiz and group escape specs with skip, reveal and bonus.
- **Slices:** (1) rules and unit tests; (2) schema, config persistence and hint lists; (3) adapters, skip, bonus and service tests; (4) progress ranking and dashboard column; (5) Manage authoring; (6) PWA; (7) Playwright, engineering and user docs. One commit per slice on the branch. The draft PR opens after slice 3, so CI exercises the server contract before the wizards and the PWA land.
- **Pause:** a migration the raw migrate command cannot generate, or a change needed in the Response API before W7.

### W3 — Shared dashboard insights, projector and session clock

- **Outcome:** one Escape Room dashboard for all four modes (ranking, per-stage progress, per-stage debrief with an authored debrief text, CSV export, reset), reached from each mode's existing entry point. For the synchronous modes, Group Activity and Live Quiz blocks, one projector page addressed by the shared activity reference shows lobby (link, QR, and PIN once W5 lands), ranking with remaining time, per-stage progress and the debrief. The optional session clock exists for Group Activity only (card F).
- **Phase rules:** for Group Activity, the scheduled window and Hatchet tasks keep governing publication; a session runs only inside the window, and the lecturer's end closes play early. Submissions outside the running phase are rejected, pause freezes every clock, and late players are timed from joining.
- **Privacy:** individual rankings show pseudonyms of opted-in participants only (card F).
- **Acceptance:** service tests for phase transitions and rejected submissions in Group Activity; an authorization test that dashboard and projector rankings omit participants who did not opt in; dashboard insights render for all four modes and the projector for Group Activity and Live Quiz; a load smoke test with about 400 simulated polling clients plus the projector, using `util/load-test`.

### W4 — Per-attempt numbers and mistake feedback

- **Outcome:** card D and mistake ranges with label and feedback in Practice Quiz, Microlearning and Group Activity; Live Quiz follows in W7. Prompt and explanation are rendered per attempt in the resolver. Wrong answers matching a range return its feedback and record a mistake key. The W3 debrief shows per-stage mistake counts.
- **Acceptance:**
  - The evaluator rejects anything outside the allowlist.
  - Two players or teams receive different values and are graded against their own solutions.
  - Before an Escape Room stage closes, participant payloads contain no explanation, formulas, derived solution values, mistake ranges or seed. The resolver nulls the explanation only for open Escape Room stages; the shared element fragment is unchanged, because eight operations outside Escape Rooms rely on it.
  - A solution bound of exactly 0 grades correctly. Today `gradeQuestionNumerical` skips a zero bound; this is fixed.
  - Parametrized stages skip the shared per-question answer statistics, which would mix different values, and record outcome keys instead.

### W5 — Anonymous activity teams and PIN

- **Outcome:** card C. Devices join by link (and PIN if set), create or join a team by team code, and receive a scoped member token under its own cookie name. Lecturers rename and remove teams from the shared dashboard. Activity teams earn no course points.
- **Acceptance:** authorization tests covering a token from another activity, a removed team, a course-group member, and a student who is also logged in. Team-code joins are rate limited; team size and name length are capped. The retention job deletes expired activity teams. The attempt's "exactly one owner" rule is enforced by a hand-written check constraint documented in the generated migration. Browser evidence of the mobile join flow.
- **Gate:** run `$rs-data-protection-by-design` while settling the member and team shape.

### W6 — Practice reopen

- **Outcome:** the lecturer opens practice in the modes card F names: solo, untimed, free hints, a fresh seed per attempt, not ranked. Practice attempts use the separate practice-attempt record, so the ranked attempt and its results stay intact. Anonymous Group Activity players practise as a one-device activity team. Practice attempts are exempt from the window check; ranked attempts are not.
- **Acceptance:** practice attempts never change ranking, results or debrief counts; a player can restart with new numbers; full Playwright run of the synthetic Group Activity fixture from lobby to practice.

### W7 — Live Quiz adapter

- **Outcome:** card E rules for Live Quiz Escape Room blocks through the Response API; mistake feedback for Live Quiz follows with W4, which the user ordered after W7 and W3 on 2026-11-14. Mistake ranges and rule settings enter the block-activation cache. Reveal and skip clear a stage in Redis without emitting a solved response. Penalties and mistake keys reach the shared dashboard and debrief.
- **Acceptance:** Response API tests for wrong-answer penalty, reveal, skip and bonus (mistake feedback with W4); existing claim and close-gate tests and worker deduplication tests still pass; browser evidence of a Live Quiz block with the classroom rules. Execution plan: [2026-11-14-escape-room-live-rules-plan.md](2026-11-14-escape-room-live-rules-plan.md).

## Test portfolio (roadmap level)

Each package plan refines these rows; it does not add rows for helpers or lines.

| Risk or behavior | Obligation | Primary seam | Owning item |
| --- | --- | --- | --- |
| Non-escape Group Activity regresses | extend existing | existing group Playwright and GraphQL tests | W1, W5 |
| Existing Escape Rooms change behavior under new defaults | extend existing | current escape-room GraphQL and Response API tests | W2 |
| Grading adapters disagree on the same rules | add new | shared rule unit tests plus one test per adapter | W2 |
| Concurrent team submissions double-charge or skip stages | extend existing | escape-room GraphQL concurrency tests | W1, W2 |
| Clock or phase bypass | add new | GraphQL service tests on session transitions | W3 |
| Polling load in a 400-student lecture | add new | `util/load-test` smoke run | W3 |
| Formula evaluation escapes the allowlist | add new | evaluator unit tests | W4 |
| Solutions or explanations leak before a stage closes | add new | participant resolver test | W4 |
| Zero solution bound misgraded | add new | `packages/grading` unit test | W4 |
| Wrong mistake attributed or statistics mixed | add new | grading and service tests with synthetic ranges | W4 |
| Cross-activity or cross-team access with a member token | add new | GraphQL authorization tests | W5 |
| Practice attempts leak into results | add new | service test | W6 |
| Projector exposes participants who did not opt in | add new | GraphQL authorization test | W3 |
| Live Quiz rules diverge from the shared rules | add new | Response API tests calling the shared function | W7 |
| End-to-end classroom run | add new | Playwright spec on a synthetic fixture | W6 |

Fixtures are synthetic and test-owned; the lecturer's materials stay outside the repository.

## Execution context

- Repository `uzh-bf/klicker-uzh`; target `v3`; stack base `codex/escape-room-live` (#5227), currently at `a9e198d5d5`.
- Planning worktree `trees/group-escape-classroom`, branch `rs/group-escape-classroom`. The plan file moves into the W2 layer's first commit, since W0 and W1 amend existing PRs.
- Migrations: generated with the container's raw migrate command per `CLAUDE.md`, then `prisma:sync`.
- Formula evaluation: `mathjs` 11.9.1 is already a dependency of `packages/graphql`; the shared evaluator must also be usable from the Response API.
- Browser verification: `agent-browser` with delegated login; screenshot galleries in each UI PR. User docs: `apps/docs/docs/tutorials/escape_room.mdx` and `student_tutorials/escape_room.mdx` are updated in the package that changes the described behavior.

## Review provenance

- 2026-11-08, W2 execution plan: one advisor critique. Accepted: config-level ordered hint penalties for the preset; reveal and skip recorded in `stageResponses` for Group Activity so one cleared-stage source remains; explicit bonus code paths; skip under the lifecycle claim; additive `revealedHints`; draft PR after slice 3. Surfaced as a ruling: penalties versus the clock.
- 2026-11-08, W1 execution plan: one advisor critique (Claude Fable 5.1). Accepted: server-side masking of locked stages and current-stage hint gating, explicit commit choice, stage units on the dashboard, fixture check, finishing W0 acceptance first. No findings rejected.

- 2026-11-07: independent plan critique (planner) of the Group-Activity-only draft returned REVISE with 14 findings. Accepted: runtime and migration re-timestamping in W0; new member table instead of extending the Live Quiz identity; per-stage answers on the attempt; check constraint for the attempt key; session and window mapping; explanation leak; zero-bound grading bug; syntax allowlist; shared statistics; reordering (numbers before anonymous teams; #5226 amended in place); browser runtime prerequisite and load smoke test; join rate limiting and caps; retention home; complete decision cards and hint-default fix. Deferred: logged-in activity teams. Load-bearing source claims were verified.
- 2026-11-07: re-scoped to the shared Escape Room core at the user's request (design rule, card F).
- 2026-11-07: focused re-check by the same reviewer returned REVISE with six findings, all accepted and verified in source: Live Quiz moved into its own adapter package W7 because its progress lives in Redis and Hatchet; Practice Quiz session and practice reopen become lecturer toggles because it has no end window; projector rankings show opted-in pseudonyms only; shared code homes named (`packages/grading` gains `mathjs`, pause-aware expiry in `packages/types`); explanation withheld in the resolver instead of the shared fragment; a separate practice-attempt record because the existing unique keys allow one attempt per player.
- 2026-11-08: user ruling: Practice Quiz and Microlearning are asynchronous. They get the shared dashboard insights but no projector and no session clock; the session clock serves Group Activity only.

## Progress

- 2026-11-07: roadmap re-scoped; awaiting rulings on cards A–F. Next action after approval: W0.
- 2026-11-08: approved as recommended (cards A–F). W0 started in `trees/escape-room-stack`: backup refs `refs/backup/escape-room-20261108/{qr,individual,group,live}` recorded. Commit-by-commit replay abandoned because original stack commits contain committed conflict markers; switched to one 3-way merge per layer. QR layer merged onto `origin/v3` on local branch `restack/qr` (cherry-pick in progress, conflicts resolved, QR migrations re-timestamped to `20261108100000`/`20261108100100`). Paused on two blockers: (1) the pre-commit hook fails on a stale partial host `node_modules` and the repo forbids a host `pnpm install`; (2) the new `restack-qr` runtime fails bootstrap because its databases are empty and `.devrouter.yml` declares no `freshBootstrap`, so `devrouter ensure --initialize-new` is unavailable; `devrouter stop .` also fails on the degraded runtime. Nothing pushed.
- 2026-11-08: user approved bypassing the host pre-commit hook for the restack (`HUSKY=0`, with gitleaks and the identity check run by hand). Restack done: one commit per layer on `origin/v3` (`5b8efe36cd`), pushed with lease to `codex/escape-room-{qr,individual,group,live}` (heads `e4b6fb84ed`, `01deeedc86`, `d7cd5fa3e3`, `884ba510e9`); old heads remain in `refs/backup/escape-room-20261108/*`. Migrations re-timestamped to `20261108100000`, `20261108100100`, `20261108100200`. Ported the escape-room submit flow into v3's refactored `ElementStack` handlers; kept the server-derived owner check; regenerated the public SDL and lockfile per layer; registered `QR-elements` and `Z-escape-room` specs in `playwright/profiles.json`. Container checks per layer (`check`, `format:check`, `check:lint`, `check:syncpack`, `check:prisma-sync`, `check:agents-md`, `check:playwright-ci`) match the `origin/v3` baseline; the analytics lint and the installed-devrouter shard test fail on v3 too in a bare container. Database-backed tests and browser checks not run locally. Still paused: the devrouter runtime cannot initialize a fresh disposable database (`.devrouter.yml` lacks `freshBootstrap`); the failed `restack-qr` workspace remains and `devrouter stop` refuses it. PR CI on the new heads was still running.
- 2026-11-08: user chose "Add freshBootstrap config". Reused #6773's `.devrouter.yml` declaration as an uncommitted local overlay in a new worktree `trees/escape-room-group` (registrations follow the checkout path, so `trees/escape-room-stack` stays bound to the failed `restack-qr` registration). `devrouter ensure --profile manage,pwa --initialize-new` initialized and seeded workspace `codex-escape-room-group` on Devsy 1.24.0. Escape-room GraphQL tests pass in the container (8 files, 85 tests on the group layer).
- 2026-11-08: W0 acceptance found three stack regressions on v3 and one test-runner gap: (1) the three edit queries used a variable `@include`, which this server rejects for every value, so editing, duplicating and converting practice quizzes, microlearnings and group activities loaded nothing; hints now come from a separate `GetEscapeRoomHints` query that runs only in edit mode; (2) the library page dropped a restored selection while the type-filtered element list refetched; the pruning effect now waits for the load; (3) the QR spec used test ids that v3 #5714 renamed; (4) the live layer's vitest test ran under v3's `node:test` glob and is now `liveQuizResponse.spec.ts`. Fixes amended into each layer's single commit in `trees/escape-room-fix`. Also found on v3 itself, not in the stack: `playwright:host` with a `live-quiz` profile waits for Hatchet workers that dev-test mode never starts; local runs use `--runtime-profile manage,pwa`. #5224's SonarCloud duplication gate (4.1% versus 3%) is advisory; `final-ai-stack-review` errors only because #5225 and #5226 are drafts.
- 2026-11-08: W1 implemented in `trees/escape-room-group` (uncommitted until the group-layer amend). Each answerable element is one stage; `EscapeRoomAttempt.stageResponses` (one generated migration) stores cleared stages; submission takes exactly the current stage (`ESCAPE_ROOM_GATED` otherwise), a wrong answer locks the team out without clearing, the last stage completes the attempt and writes the decisions. Details mask later stages; hints work only on the current stage; progress counts stages. New nullable `EscapeRoomAttempt.stageDecisions` (null for practice quizzes and microlearnings, so their typed clients stay valid). PWA: cleared stages read-only, only the current stage submits, 5-second polling while in progress, stale-stage `ESCAPE_ROOM_GATED` and the new `ESCAPE_ROOM_CONFLICT` refetch silently. Escape and QR GraphQL tests: 86 passed; non-escape group tests 54 passed (one unreproduced failure in three reruns); graphql `check:ts`, PWA `check`, `check:prisma-sync` and Biome format pass. Engineering docs updated.
- 2026-11-08: W1 landed in the stack and pushed with lease: individual `db57b8b5b2` (#5225), group `670d723c1b` (#5226), live `a5213125f2` (#5227); QR `29383b61fb` unchanged. Two restack regressions surfaced by the browser run were fixed in the individual layer: the library hid QR elements in creation mode (it now offers them while the open wizard has Escape Room enabled, which keeps the QR boundary spec valid), and the microlearning and group escape specs used month offsets that ignored the wizard's next-month default date. Live-layer conflicts (progress counting, two docs) resolved. Container check set on all three layers matches the `v3` baseline (only analytics lint and the installed-devrouter shard test fail) with no lockfile, SDL or format drift. Live head: escape and QR GraphQL 103 passed plus the template suite alone; browser `Z-escape-room` + `QR-elements` 23 passed; the live-quiz browser test needs the `live-quiz` profile, which the known v3 worker bug blocks locally. #5226 description rewritten. Remaining for W1: screenshot gallery for the staged participant view; CI on the new heads.
- 2026-11-08: W1 CI follow-ups: #5227's Live Quiz browser test waited for the answer form behind the account prompt; the prompt helper now takes the Escape Room start button as its ready marker. #5224 failed the QR boundary and W4 wizard specs because the library-selection guard sat in #5225; it moved into the QR layer and the upper layers were rebuilt without tree changes. Pushed with lease: QR `3989eda911`, individual `d5efa23514`, group `f798cab8aa`, live `17ab743a15`. Before the rebuild, every #5225 and #5226 check passed except the advisory `ocr-review`. #5226 now shows four screenshots of the staged participant view and the group dashboard.
- 2026-11-08: W2 started on `codex/escape-room-rules`. Slice 1 (`a0aff1614f`): shared rule functions and unit tests in `packages/grading`. Slice 2 (`1cb9822565`): one generated migration `20261108180000_add_escape_room_scoring_rules` (config rules, `stageOutcomes`), `escapeRoomRules` input on the six Practice Quiz, Microlearning and Group Activity mutations, ordered hint lists on instances, hint penalty default unified to 30. Escape GraphQL suites pass (90 tests plus the template suite alone). Paused before slice 3 on the penalties-versus-clock ruling.
- 2026-11-08: user ruled penalties count toward ranked time only. Slice 3: shared stage-outcome helpers, rule-aware individual and group adapters (wrong-answer penalty, reveal, bonus after completion), ordered hint reveal with indexed penalties, `skipEscapeRoomStage` under the lifecycle claim, `stageOutcomes` and `revealedHints` in the API. A parity test runs one sequence through Practice Quiz and Group Activity and gets identical outcomes and penalties; a two-member skip race charges once. Escape GraphQL suites 108 passed plus the template suite alone; non-escape group tests 54 passed.
- 2026-11-08: Slice 4 (`9337127671`): the progress service scores and ranks Practice Quiz, Microlearning and Group Activity attempts with the shared rules; revealed and skipped stages count as cleared; the dashboard shows rank, outcome counts and ranked time (not for Live Quiz). Client ops now select the new config fields and `stageOutcomes`, which fixed Manage and PWA type errors introduced in slice 2. Slice 5 (`ae2942ffcd`): rules fields and a classroom-preset button in the three wizards (preset moved to `@klicker-uzh/types`), multi-line hints per question, `escapeRoomRules` on the six mutation ops (they had been missing), and restored import declarations that a `biome check --write` run had rewritten in slice 4; use `biome format` only. Browser check of the settings step (preset, validation) passed with a temporary spec. Docs (`2ba03c53ba`): wiki and both tutorials describe the rules, ranking and the ordered group stages. Slice 6 (PWA) delegated to an executor. Stack CI: the remaining #5225–#5227 failures were cancelled runs (Playwright, intl smoke, OCR review) and were re-run.
- 2026-11-08: W2 complete on #6826. Slice 6 (`761cda1c77`, PWA via executor, reviewed): tries left, revealed notice, ordered hints with position prices, skip with confirmation, bonus after completion; group bonus outcomes mirrored into `stageOutcomes`. Slice 7 (`af59ec4a48`): browser flow for preset, hints, reveal, skip, bonus and ranked dashboard; existing hint test no longer expects the clock to drop. OCR review (incomplete, 48 of 64 sections) found 20 issues; fixed in `3e49afe023`: duplication and conversion no longer clear hints, skip honours the activity window, bonus-after-expiry reports expiry, consistent completed progress, NaN-safe ranking, plural tries text, grading no longer re-exports the preset. Declined: legacy-attempt ranking (no released data), a shared 3600 constant, a single rules computation in the services, preset-derived strings in Playwright (no types dependency there). Verification: grading 15, escape GraphQL 107 plus the template suite alone, browser 20, container `check`/`format:check`/`check:lint`/`check:prisma-sync`; CI on the slice-7 head passed (18 checks). `/final-review` was posted but the workflow skips drafts outside a verified native stack, so it needs #6826 marked ready (separately gated) or linked into the native stack.
