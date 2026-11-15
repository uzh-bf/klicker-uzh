# Escape Room — Group Activity projector and session clock (W3b)

- **Status:** rulings S1–S4 settled 2026-11-15; executable
- **Roadmap:** second half of W3 of [the classroom escape rooms roadmap](2026-11-07-classroom-escape-rooms-plan.md). [W3a](2026-11-14-escape-room-insights-plan.md) delivered the shared dashboard insights and the Live Quiz projector (#6906).
- **Approval mode:** executable batch under the roadmap approval of 2026-11-08 (cards A–F, primitive "Escape Room session"), the reorder of 2026-11-14 and the user's "Plan W3b" of 2026-11-15. Rulings S1–S4 of 2026-11-15.
- **Goal:** a lecturer runs a Group Activity escape room live in class: opens a lobby, starts play for all groups at once, pauses and ends it, and shows ranking and progress on a projector.
- **Branch:** `codex/escape-room-group-session` on top of `codex/escape-room-insights` (#6906), added to native stack 5228 as its top layer.
- **Ceremony tier:** full path (one migration, new phase checks on every group escape write path, link-protected query).

## Current state

- `GroupActivity` has a fixed window (`scheduledStartAt`, `scheduledEndAt`) and a `PublicationStatus`; Hatchet tasks publish and end it. Nothing models a lobby or a pause.
- Group escape attempts are keyed by course group (`groupId`, `groupActivityId`). Each attempt's deadline is `startedAt + timeLimit + grace` (`isEscapeRoomExpired` in `packages/types`); penalties count toward ranked time only. Ranked time (`scoreEscapeRoomAttempt`) and the dashboard's time spent are wall-clock spans from `startedAt`.
- Write paths of a group attempt: `startEscapeRoomAttempt`, `requestEscapeRoomHint`/`revealEscapeRoomHint`, `skipEscapeRoomStage`/`skipGroupStage`, the answer path (`groups.ts` pre-check, then `submitEscapeRoomGroupActivityDecisions`, which re-checks status and window inside its Serializable transaction), the bonus answer of a completed attempt, the lazy expiry in start, hint, skip, answer and `getEscapeRoomProgress`, and the lecturer reset. The hint `UPDATE` and the start upsert run without a transaction.
- Stages stay masked for players while the activity is `PUBLISHED`; an `EXPIRED` attempt masks every stage. Editing the configuration is allowed only in draft.
- The W3a projector query accepts Live Quiz blocks only; its reference type already knows a `groupActivity` kind.
- The only lecturer page with the group escape table is `courses/grading/groupActivity/[id]`.

## Rulings (user, 2026-11-15)

The user chose the recommendation for S1–S3 and "No extension" for S4.

- **S1 — What "end" does.** Recommended: ending the session stops escape play, finalizes running attempts as `EXPIRED`, closes open bonus windows, and shows all stages to the groups again, as after the window; the Group Activity stays published until its window or the existing manual end. Alternative: ending the session also ends the Group Activity (`ENDED`), as the existing end action does.
- **S2 — After the end.** Recommended: the end is final, and resetting a group is blocked once the session ended, because a reset would delete a ranked result the group can no longer replay. Alternative: the lecturer may reopen to running, which needs rules for attempts already finalized.
- **S3 — Before the start.** Recommended: with the clock on, groups can open the activity in the lobby but cannot start their attempt or see stages until the lecturer starts the session; the PWA says so. Alternative: groups may start early and the clock only adds pause and end.
- **S4 — Pauses near the window end.** A pause does not move `scheduledEndAt`. Ruled: no automatic extension; the control bar shows the window end, and the lecturer extends it with the existing action when needed.

## Scope

In:

- **Session clock (Group Activity only, optional).** A switch on the escape configuration, off by default, so existing escape rooms behave as today. With it on, the session has phases lobby, running, paused and ended, driven by the lecturer, and only inside the published window.
- **Phase rules.** Start, answers, hints and skips are rejected unless the session runs. Pause freezes every group's clock, lockout, bonus window and ranked time, and hides the current stage; resume continues them. Late groups are timed from their own start. The end finalizes running attempts.
- **Lecturer controls** on the group activity escape dashboard: start, pause, resume, end, and the projector button.
- **PWA:** lobby, paused and ended states in the escape overlay; the countdown freezes while paused.
- **Group Activity projector:** the W3a projector accepts a Group Activity reference. Rows show course group names (card F); phase comes from the session, or from the publication status when the clock is off.
- **Load smoke** of group polling plus the projector.

Out: activity teams, anonymous play and PIN (W5); mistake counts (W4); practice reopen (W6); restarting an ended session (unless S2 says otherwise).

## Decisions

- **Session state on the escape configuration** (roadmap primitive "Escape Room session"). New `EscapeRoomConfig` fields: `sessionClock` (boolean, default false), `sessionPhase` (enum LOBBY, RUNNING, PAUSED, ENDED, default LOBBY), `sessionStartedAt`, `sessionEndedAt`, and `sessionPauses` (JSON list of closed pause intervals, plus `sessionPausedAt` for an open one). One generated migration; all defaults keep existing rows unchanged. The switch is set in the create and edit inputs and, like the rest of the configuration, is locked after publication.
- **Active time, one helper.** `getEscapeRoomActiveSeconds(from, to, session)` in `packages/types` subtracts every pause overlapping the range, treating an open pause as ending at `now`. `isEscapeRoomExpired` gains an optional session argument and uses it for the deadline (range `startedAt` to now); `scoreEscapeRoomAttempt` and the dashboard's time spent use it for ranked time (range `startedAt` to the last outcome); the projector's `endsAt` and the bonus window use it too. Every Group Activity call site passes the session; Live Quiz, Practice Quiz and Microlearning pass none and keep today's numbers. This also covers late starters, completed attempts in their bonus window and attempts that finished before a pause.
- **Lockouts across a pause.** Resume shifts `lockoutUntil` of every attempt whose lockout was still running at the pause start by the pause length, in the same transaction as the phase change. The attempt payload returns `lockoutRemainingSeconds` from the server, so the PWA stops deriving server time from the remaining seconds.
- **One phase check** `assertEscapeRoomSessionRunning` in `escapeRooms.ts`, read inside the transaction of every participant write path: start (moved into a transaction), answer, bonus answer, hint and skip. The hint `UPDATE` gains a status condition and a phase subquery. With the clock off the check returns immediately; it never replaces the existing status and window checks. Reset is a lecturer action and is blocked only in ENDED (S2).
- **Effective phase.** `ENDED` whenever the session ended, the activity is no longer `PUBLISHED`, or its window has passed; otherwise the stored phase. Reads finalize `IN_PROGRESS` attempts of an effectively ended session, as W3a does for a closed Live Quiz block, which covers a start or answer racing the end.
- **Transitions** are one mutation `setEscapeRoomSessionPhase(groupActivityId, phase)` for lecturers with write access, only when `sessionClock` is on: LOBBY→RUNNING, RUNNING→PAUSED, PAUSED→RUNNING, RUNNING|PAUSED→ENDED. Each is a Serializable compare-and-set on the current phase, so double clicks and two lecturers cannot apply a transition twice. RUNNING requires the activity to be `PUBLISHED` and inside its window. Ending expires `IN_PROGRESS` attempts and closes bonus windows in the same transaction (S1).
- **Masking.** While the clock is on and the phase is LOBBY or PAUSED, all stages are masked for players; after the end they are shown (S1).
- **Activity end.** Both `handleEndExpiredGroupActivity` and the manual `endGroupActivity` end a running or paused session in their transaction, so the published window stays the outer bound; the effective phase covers anything they miss.
- **PWA countdown** keeps the server's `remainingSeconds`, now pause-aware; the attempt payload adds `sessionPhase`, and the hook stops animating while it is not `RUNNING`. While the clock is on, the PWA polls a small session-phase query and refetches the full activity only when the phase changes, so 400 students in the lobby do not each poll the full activity details.
- **Projector.** The projector service branches on the reference kind. Group Activity digest `escape-projector:groupActivity:<id>`; lecturers with read access call it without a digest. Phase: the session phase with the clock on (PAUSED shows as running with a paused flag); otherwise `SCHEDULED` → lobby, `PUBLISHED` → running, `ENDED`/`GRADED` → closed. Rows use the course group name and pause-aware times, no ids. Debrief is withheld until the phase is closed. The Manage page moves to a route that takes the shared reference, with the Live Quiz route kept as is and the identity-query exemption extended to the new route.
- **Load smoke.** `util/load-test` gains a group scenario sized at about 400 student clients spread over the seeded groups: students poll the session phase, one lecturer polls the dashboard, one projector polls; answers go through the existing decisions mutation. Thresholds as in W3a (p95 under 500 ms per endpoint, error rate under 1 %), recorded as a dev-server smoke.

## Slices

1. **Session model, active time and phase rules (GraphQL).** Migration, `prisma:sync`, create and edit inputs, active-time helper and its call sites, phase check on every write path, transitions mutation, lockout shift, effective phase and read-time finalization, both end hooks, masking. Tests: each write path rejected in lobby, paused and ended; transitions reject invalid and duplicate moves, RUNNING outside the window and a clock that is off; a pause of N seconds adds N to remaining time, lockout and bonus window and leaves ranked time unchanged, for an attempt running through the pause, one started after it and one completed before it; an answer racing the end is rejected or finalized; end expires running attempts; reset blocked after end; clock off and the other three modes keep today's numbers. The draft PR opens after this slice.
2. **Group Activity projector query.** Reference branch, digest variant, group rows, phase mapping. Tests: wrong digest, Live Quiz digest used for a group activity and the reverse, lecturer without access; no ids in the payload; debrief withheld before close.
3. **Manage.** Clock switch in the Group Activity escape settings; control bar with phase, window end and the four actions, plus the projector button, on the grading dashboard; projector route for group activities.
4. **PWA.** Session-phase polling; lobby, paused and ended states; frozen countdown; server-provided lockout.
5. **Docs, load smoke, end to end.** Tutorial and wiki for the session clock; the group load scenario; Playwright: a lecturer starts, pauses, resumes and ends a session while a group plays, and the projector shows the run.

## Test portfolio

| Risk | Obligation | Seam |
| --- | --- | --- |
| Clock or phase bypass | add new | GraphQL service tests per write path and transition |
| Pause loses or adds time, or shifts ranking | add new | GraphQL test of remaining time, lockout, bonus window and ranked time across a pause |
| Concurrent transitions apply twice, or play continues after the end | add new | GraphQL compare-and-set and race tests |
| Existing escape rooms change behaviour | add new | GraphQL tests with the clock off and for the other modes |
| Projector exposes ids or opens with the wrong link | extend existing | W3a projector authorization tests |
| Polling load in a 400-student lecture | extend existing | `util/load-test` group scenario |
| Classroom flow regresses end to end | extend existing | Playwright group escape spec |
| Copy and layout | none | browser screenshots |

## Verification

- Container: `check` for graphql, frontend-manage, frontend-pwa; Biome on changed files; escape-room GraphQL suites, run before browser checks (they empty the local database); migration generated with the Prisma tool, `pnpm run prisma:sync`, and a drift check.
- Host: escape-room Playwright suite through the host launcher; the load smoke.
- Browser: lecturer control bar in each phase, projector lobby/running/paused/closed for a group activity, PWA lobby, paused and ended states; desktop plus one mobile capture of the PWA.
- One independent review of the integrated layer.

## Authority

Granted: local commits, pushing `codex/escape-room-group-session`, a draft PR on top of #6906, adding it to stack 5228, its description and synthetic screenshots, the local migration on the disposable test database.
Withheld: marking ready, reviewer requests, merge, deployment, force-pushes of lower layers, contacting the lecturer, local database re-seeds (each needs its own approval).

## Recovery and terminal condition

A slice that fails verification is fixed or reverted before the next one. A needed change in a lower layer is recorded as a gap. The batch ends when the draft PR exists on top of #6906 with screenshots, its checks have run, the load smoke result is recorded, and remaining gaps are listed.

## Progress

- 2026-11-15: drafted after mapping the Group Activity lifecycle, escape write paths and the W3a projector.
- 2026-11-15: rulings S1–S3 as recommended; S4 "No extension".
- 2026-11-15: independent critique (REVISE, 10 findings) accepted in full: pause model moved from a per-attempt counter to session pause intervals with one active-time helper (deadline, ranking, bonus, projector); lazy-expiry sites, hint and start races, manual end, PWA lockout, lobby polling cost and the create/edit inputs added; S1 and S2 sharpened, S4 added.
