# Escape Room — Design and UX Pass

- **Status:** In progress
- **Approval mode:** executable batch. The user chose the direction ("framed immersion"), the landing (a new top stack layer) and the local runtime restart on 2026-11-12.
- **Goal:** make the Escape Room fit Klicker's design patterns and feel like an educational escape room, in all four modes, without a schema change.
- **Branch:** `codex/escape-room-design` on top of `codex/escape-room-rules` (#6826), to be added to native stack 5228.
- **Ceremony tier:** full path. UI-only package across `apps/frontend-pwa`, `apps/frontend-manage`, `packages/shared-components` and `packages/i18n`.

## Direction

Keep a distinct escape frame, built from design-system components and theme colours, applied the same way in Practice Quiz, Microlearning, Group Activity and Live Quiz. The question area stays standard Klicker.

## Decisions

- No Prisma or GraphQL schema change. Operations may request more fields of types that already exist.
- Stage data differs by mode, so the frame reads it through one per-mode adapter:
  - Practice Quiz and Microlearning: `stageOutcomes`.
  - Group Activity: solved stages from `stageDecisions`, reveal, skip and bonus from `stageOutcomes`.
  - Live Quiz: the cleared prefix only (`escapeRoomClearedInstances` of `escapeRoomTotalInstances`); it has no reveal, skip or bonus.
- Ranked time on the student ending: `completedAt − startedAt + penaltySeconds − bonusSeconds` (the credit only after a correct bonus answer). It lives in one helper in `apps/frontend-pwa`. Live Quiz shows escape time and hints only, because the lecturer has no ranked time there.
- The student ending does not show a rank. A rank needs data about other participants and the leaderboard opt-in rules; that belongs to the planned shared dashboard work.
- Way out of the ending, by mode: Practice Quiz and Microlearning link to the course; Group Activity navigates in the same tab; Live Quiz dismisses the ending and stays in the session.
- "Ranked time" stays as the term and is explained once in the rules summary.
- Hints and penalties use the informational and warning styles; green is reserved for solved stages.
- One term per concept in each language: "stage" / "Station" for a step of the room, "question" / "Frage" for the element inside it.
- Tests and specs find the frame through stable `data-cy` hooks, not through copy.
- Out of scope: per-stage story text and skins (schema change); solutions in a debrief (planned mistake-feedback work); sort controls on the dashboard; the CodeQL alert at `apps/response-api/src/escapeRoom.ts:47`, which sits in the Live Quiz layer and is handled there.

## Slices

One writer per slice. Each slice owns its strings and the Playwright specs it affects, is verified in the container (`check`, Biome, affected unit tests) and committed on its own.

1. **Frame: stage adapter, tracker, timer, start, expired and ending.**
   Files: `EscapeRoomOverlay.tsx`, the escape header, `PracticeQuiz.tsx`, `PracticeQuizOverview.tsx`, the Microlearning page `pages/course/[courseId]/microLearnings/[id]/[ix].tsx`, the group page `pages/group/[groupId]/activity/[activityId].tsx`, `LiveQuizEscapeRoomControls.tsx`, the Live Quiz block operation, i18n.
   - Per-mode stage adapter and the ranked-time helper.
   - Header: one marker per stage (open, current, solved, revealed, skipped, bonus), collapsing to a counter when markers do not fit at 375 px; timer states scaled to the limit (last tenth, last minute).
   - Start: the activity's title, the story, a full rules summary for the mode, the one-attempt and no-pause warning.
   - Ending: headline by outcome, ranked time, per-stage recap, bonus result, the mode's way out. Expired: recap and the same way out.
   - Dialog: focus moves in and is trapped, content scrolls, reduced motion respected, colours from one small set of named classes with checked contrast.
   Acceptance: the same stage count on every student screen; the tracker shows a solved, a revealed and a skipped stage; every end state has a way out; the ending never says every question was cleared after a reveal or skip; nothing clips at 375 px; text on the frame meets AA contrast.
2. **Play screen.**
   Files: `ElementStack.tsx`, `InstanceHeader`, `StepProgressWithScoring.tsx`, `EscapeRoomSkipButton.tsx`, `GroupActivityStack.tsx`, `LiveQuizEscapeRoomControls.tsx`, `useLiveQuizEscapeRoom.ts`, i18n.
   - Hints as info notices with one hint-button style in every mode; penalty toasts as warnings.
   - Skip as a secondary button with icon and a named cancel control.
   - During an attempt: bookmark, thumbs and comments hidden, points hidden, step markers kept.
   - Lockout and incorrect notice restored after a reload. The remaining lockout is derived from server-relative data (`expiresInSeconds` gives the clock offset) and clamped to the configured lockout; Live Quiz stops rebuilding its deadline from the wall clock.
   - Live regions for the lockout and notices.
   Acceptance: after a wrong answer and a reload the lockout countdown is shown, also with a skewed device clock; hints look the same in all four modes; ordinary Practice Quiz and Microlearning pages are unchanged.
3. **Lecturer wizard.** Escape Room rules in their own card with short labels, help tooltips and the preset; shorter hint placeholder.
   Acceptance: no label overflows its card at 1440 px and 1024 px; every rule field has a tooltip.
4. **Lecturer dashboard and QR.** Client-side order: ranked attempts first, then in progress, then not started. A summary line and a toggle to hide not-started participants (shown by default). Reset confirmation styled like neighbouring destructive actions. QR scan and print inputs use design-system components.
   Acceptance: rank order is top to bottom; the summary matches the rows.
5. **Terms and docs.** Remaining term renames in English and German, both tutorials and their screenshots.

Slices 3 and 4 serve lecturers and may become a separate stack layer; that topology change needs the user's approval and is asked when slices 1 and 2 are done.

## Test portfolio

| Risk | Obligation | Seam |
| --- | --- | --- |
| Stage states differ between screens or modes | add new | unit test of the stage adapter |
| Student ranked time differs from the lecturer's | add new | unit test of the ranked-time helper |
| Dashboard order ignores rank | add new | unit test of the sort helper |
| Ending is a dead end or shows the wrong time | extend existing | Playwright `rules.ts` flow |
| Lockout lost after reload or wrong under clock skew | extend existing | Playwright `practice-quiz.ts` lockout flow |
| Copy and visual styling | none | browser screenshots only |

## Verification

- Container: `check`, Biome format and lint on changed files, the escape-room unit suites.
- Host Playwright: `Z-escape-room` and `QR-elements` with the `manage,pwa` profile. Live Quiz participation runs only in CI.
- Browser: before and after screenshots of every changed screen at 375 px and desktop width, in English and German, including the Group Activity and Microlearning student views and the expired screen.
- One independent review of the integrated branch before the draft PR is called complete.

## Authority

Granted: local commits, pushing `codex/escape-room-design`, opening a draft PR, adding it to stack 5228, updating its description.
Withheld: marking ready, reviewer requests, merge, deployment, schema changes, a second new stack layer.

## Recovery and terminal condition

A slice that fails verification is fixed or reverted before the next one starts. The batch ends when the draft PR exists on top of #6826 with screenshots, its checks have run, and remaining gaps are listed.

## Progress

- 2026-11-12: plan written; branch created at `c247f51ab3`.
- 2026-11-12: independent plan critique returned "revise". Accepted: per-mode stage adapter, named ranked-time formula, server-relative lockout restore, keeping step markers, per-mode way out, scrollable dialog, stable `data-cy` hooks, frame slice before play screen, client-side dashboard sort, explicit out-of-scope list. Deferred to the user: splitting the lecturer slices into their own layer.
- 2026-11-12: slices 1 to 5 implemented and committed; draft PR #6884 opened on top of #6826 and added to stack 5228. One independent review per slice group; findings fixed or recorded below.
- Deviations: the dashboard sort helper has no unit test, because `apps/frontend-manage` has no test runner and the helper stays private to its component. The Microlearning participant query needed a one-line server fix to report the stage total. The lecturer slices landed in this layer; moving them to their own layer is still the user's decision.
- 2026-11-12: final screenshots captured and published in the PR description. Two findings from them were fixed: the secondary exit button was unreadable on the dark card while the bonus offer shows, and the Group Activity task list still showed the vote and comment controls.
- 2026-11-12: the time-up screen (Group Activity), the Microlearning ending and the Group Activity wizard were checked in a browser. The time-up recap labelled the unfinished stage as current; fixed.
- 2026-11-12: the stack was rebased onto current `v3`, which clears the deploy-parity step of the codebase check; all required checks pass on the rebased design layer.
- 2026-11-12: the Group Activity ending and the Live Quiz start and time-up dialogs were checked in a browser. The time-up line said "0 of 1 stages"; the count is now pluralised in both languages.
- 2026-11-12: two findings of the automated review were fixed and checked in a browser. The time-up recap of a Practice Quiz or Microlearning lost the stages cleared before expiry after a reload, because the server withholds the stacks of an expired attempt; the adapter now falls back to the recorded outcomes. The Live Quiz block settings had lost the units of the time limit and hint penalty when the labels were shortened; the fields show them again.
- Known gaps: after a reload the Group Activity time-up screen shows no stage recap, because the server withholds the stage list of an expired attempt and exposes no stage count; the Live Quiz completed ending was not checked in a browser, because the local stack cannot submit Live Quiz answers; Live Quiz participation runs only in CI; the lockout-after-reload Playwright step has to land within the fixed 5 s lockout; a React duplicate-key console warning appears when the Group Activity page and the Live Quiz session page load, its source is not located and it does not come from the escape-room stage lists.
