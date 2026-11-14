# Escape Room — dashboard insights and Live Quiz projector (W3a)

- **Status:** Rulings R1–R3 settled 2026-11-14; executable
- **Roadmap:** W3 of [the classroom escape rooms roadmap](2026-11-07-classroom-escape-rooms-plan.md). The user ordered Live Quiz first (W7, then W3) on 2026-11-14. W3 is split: **W3a** (this plan) delivers the shared dashboard insights for all four modes and the Live Quiz projector; **W3b** delivers the Group Activity projector, the optional session clock and its phase rules.
- **Approval mode:** executable batch under the roadmap approval of 2026-11-08 (cards A–F), the reorder of 2026-11-14 and the rulings R1–R3 of 2026-11-14.
- **Goal:** after a classroom escape room, a lecturer keeps the results and can debrief them: ranking, per-stage outcomes and an authored debrief text, on a projector during play and in the evaluation afterwards, plus a CSV export.
- **Branch:** `codex/escape-room-insights` on top of `codex/escape-room-live-rules` (#6903), added to native stack 5228 as its top layer.
- **Ceremony tier:** full path (new link-protected query, privacy filter, three apps).

## Rulings (user, 2026-11-14)

- **R1 — Dashboard and CSV list everyone; only opted-in participants get a rank.** The lecturer keeps every row to help or reset a team. The projector lists opted-in participants only.
- **R2 — Opt-in follows the Live Quiz leaderboard.** In gamified courses only opted-in participants (`isActive`) are listed on the projector; in other courses everyone is listed. Names come from the public profile, otherwise "Anonymous".
- **R3 — Results are kept, like the gamified Live Quiz leaderboard.** The user ruled: "no reason to delete them". The prune job stops deleting finalized attempts (`COMPLETED`, `EXPIRED`); it keeps only its idempotent `retentionProcessedAt` marking. No aggregate table and no 90-day limit in UI or docs.

## Scope

In (W3a):

- **Results are kept (all modes).** The prune job no longer deletes finalized attempts (R3); a lecturer reset remains the only deletion path.
- **Results survive the block close (Live Quiz).** Closing a block finalizes its running attempts as `EXPIRED`; progress counts cleared stages from `stageOutcomes` for every attempt status (Redis adds only to running attempts). The cockpit keeps the escape table for the last executed escape block; the Live Quiz evaluation page shows it per executed escape block for logged-in lecturers.
- **Per-stage insights for all four modes** in the progress service and `EscapeRoomProgress.tsx`.
- **Authored debrief text** per stage, edited next to the hints in the four wizards.
- **CSV export** of the attempt table.
- **Live Quiz projector:** a Manage page for one escape block, opened from the cockpit with a purpose-scoped link.
- **Load smoke** of the cockpit and projector polling against the local stack.

Out (W3b or later): Group Activity projector, session clock and phase rules; mistake counts (W4); per-team numbers and anonymous teams (W4, W5); templates (`createLiveQuizFromTemplate` and the other template paths keep only today's fields, as recorded in W7).

## Decisions

- **Finalize after a successful close.** The drain runs inside `updateLiveQuizBlockResultsFromCache` (`packages/util/src/blocks.ts`), which reopens the gate on a cache miss or error. The expiry runs only after that helper returns non-null in `deactivateLiveQuizBlock`, as one `updateMany` of `IN_PROGRESS` attempts of that non-assessment escape block to `EXPIRED`; it is never placed between the drain and the block update. The lazy fallback in the progress service also expires `IN_PROGRESS` attempts of an `EXECUTED` block, which covers a start that races the close.
- **One cleared-stage rule for Live Quiz.** A stage is cleared when `stageOutcomes` records `SOLVED`, `REVEALED` or `SKIPPED`, or, for a running attempt, when the Redis set has it.
- **Per-stage shape**, one per stage for every mode: `solved`, `revealed`, `skipped`, `attemptedNotCleared` (wrong attempts or hints but no outcome), `notReached` (started attempts that never got there), `wrongAttempts`, `hintsUsed`, and for the bonus stage `bonusCorrect` / `bonusWrong`. Counts are over started attempts, not the roster. A new exported normalizer `getEscapeRoomStageResults(mode, attempt, stages)` maps every mode to `{ stageKey, outcome, wrongAttempts, hints }`: stack modes key by stack id and map hint instance ids to their stack; Group Activity reads reveal and skip from `stageResponses` with the instance id; Live Quiz and Group Activity key by instance id.
- **Debrief text** is stored in element instance options as `escapeRoomDebrief`, persisted in the create, edit and duplicate paths that carry `escapeRoomHints`, and kept out of the participant `ElementInstanceOptions` type. Lecturers read it through the existing `escapeRoomHints` edit query and the progress payload. In stack modes each stage's debrief is the texts of its elements joined in element order. The projector returns `debrief: null` until the block is `EXECUTED`.
- **Projector access.** A purpose-scoped digest `sha256(APP_SECRET, 'escape-projector:' + kind + ':' + id)`, compared with `timingSafeEqual`, linked only from the cockpit; it does not unlock the results page, the PIN or leaderboard profiles. A logged-in lecturer with READ access may call it without the digest.
- **Projector query** mirrors the `escapeRoomProgress` arguments (shared activity reference); W3a accepts Live Quiz blocks only. It returns a dedicated payload type without attempt, participant or group ids: phase from the block status (`SCHEDULED` → lobby, `ACTIVE` → running, `EXECUTED` → closed), `serverNow`, the block's `closesAt` from `ElementBlock.expiresAt` when set, ranking rows (display name, rank, cleared stages, outcomes, ranked time, own `endsAt` from the attempt start plus the escape time limit), per-stage results, and the debrief after close.
- **Names and opt-in** follow R2. The temporary-participant case does not apply: Live escape play requires a course participant.
- **CSV** is generated in the browser from the loaded table, with translated headers and every cell that starts with `=`, `+`, `-` or `@` prefixed with a quote.
- **Evaluation page** shows the escape tables only to logged-in lecturers; the HMAC results link skips them.

## Slices

1. **Close finalization, cleared-stage rule and retention (GraphQL).** `handlePruneEscapeRooms` (`packages/graphql/src/services/pruneEscapeRooms.ts`) keeps marking and drops the `deleteMany`. Tests: closing a block with running and completed attempts; a failed close leaves attempts running; progress of an expired Live attempt keeps its solved count; the lazy fallback for an executed block; an old finalized attempt survives the prune job.
2. **Per-stage insights and debrief text (GraphQL).** Normalizer, per-stage payload, debrief persistence. Tests: the same outcome sequence through each mode gives the same per-stage numbers; debrief round trip; the participant query of a running block carries no debrief.
3. **Projector query.** Scoped digest, payload, opt-in per R2. Tests: wrong digest, digest of another quiz, the results-page HMAC rejected, lecturer without access rejected; a participant who did not opt in is counted but not listed; no ids in the payload; debrief null while running.
4. **Manage dashboard.** Per-stage section, ranking per R1, CSV export, cockpit keeps the last executed escape block, evaluation page escape tables for lecturers.
5. **Manage authoring and projector.** Debrief field in the four wizards; projector page (lobby with participant link and QR, running, closed) and the cockpit button.
6. **Docs, load smoke, end to end.** Tutorials and wiki (results are kept per R3; remove any 90-day statement); a `util/load-test` k6 script against the local routed stack with 50 seeded participants answering through the Response API, plus cockpit and projector polling at their intervals, scaled to an equivalent request rate for 400 students; pass at p95 under 500 ms and error rate under 1 %, recorded in Progress; Playwright: the Live Quiz escape spec opens the projector during and after the block and the evaluation after close.

## Test portfolio

| Risk | Obligation | Seam |
| --- | --- | --- |
| Live Quiz results lost or miscounted after close | add new | GraphQL close and progress tests |
| Finished results deleted by housekeeping | add new | prune job test |
| Per-stage numbers disagree between modes | add new | one sequence through each mode |
| Projector exposes non-opted-in participants or ids | add new | GraphQL authorization test |
| Projector link unlocks other data, or other links unlock it | add new | GraphQL authorization test |
| Debrief leaks before close or to participants | add new | participant payload and projector tests |
| Polling load in a 400-student lecture | add new | `util/load-test` smoke on the local stack |
| Classroom flow regresses end to end | extend existing | Playwright Live Quiz escape spec |
| Copy and layout | none | browser screenshots |

## Verification

- Container: `check` for graphql, frontend-manage, frontend-pwa; Biome on changed files; escape-room GraphQL suites, run before browser checks (they empty the local database).
- Host: escape-room Playwright suite with `--runtime-profile playwright` and `URL_API` set to the routed API; the load smoke.
- Browser: projector lobby, running and closed views on a synthetic quiz; dashboard per-stage section and CSV; evaluation after close.
- One independent review of the integrated layer.

## Authority

Granted: local commits, pushing `codex/escape-room-insights`, a draft PR on top of #6903, adding it to stack 5228, its description and synthetic screenshots.
Withheld: marking ready, reviewer requests, merge, deployment, force-pushes of lower layers, contacting the lecturer.

## Recovery and terminal condition

A slice that fails verification is fixed or reverted before the next one. A needed change in a lower layer is recorded as a gap. The batch ends when the draft PR exists on top of #6903 with screenshots, its checks have run, the load smoke result is recorded, and remaining gaps are listed; then W3b is planned.

## Progress

- 2026-11-14: plan drafted on `codex/escape-room-insights` at `0dd52e6dfd`.
- 2026-11-14: independent plan critique (planner) returned REVISE with 11 findings, all accepted: per-attempt clocks instead of one `endsAt`; expiry only after a successful close plus a lazy fallback for executed blocks; purpose-scoped projector digest; dedicated payload on the shared activity reference; complete per-stage shape with a named normalizer; debrief read paths, server-side null before close and templates out of scope; CSV formula neutralisation; evaluation tables only for logged-in lecturers; realistic local load smoke with thresholds; slice 4 split. Three findings became rulings R1–R3.
- 2026-11-14: user ruled R1 "All, rank opted-in", R2 "Follow leaderboard", and R3 against the 90-day recommendation: results are kept like the gamified leaderboard. Slice 1 now also stops the prune job from deleting finalized attempts.
