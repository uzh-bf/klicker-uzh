# Escape Room Quiz Mode — Implementation Plan

## Plan Identity

- Plan: `project/2026-07-07-pr-5143-escape-room-quiz-mode-plan.md`
- Branch: `escape-room-quiz-mode-plan` (plan-only; implementation branches off `v3` later, one branch per slice group or single branch per workflow)
- Target branch: `v3`
- PR: [#5143](https://github.com/uzh-bf/klicker-uzh/pull/5143) (draft)
- Audience: junior engineer + coding agent. Follow `df-sliced-development-workflow` (dated plan, one slice at a time, review + simplification + commit per slice).

## Goal

New "escape room" mode for self-paced quizzes:

1. Sequential gating: stack N+1 opens only after stack N answered fully correct.
2. Optional per-question hints; using one costs time.
3. Global countdown per participant (e.g. 90 min); hard stop on expiry.
4. New QR-code element type: scanning the correct QR code = solved.
5. Lecturer evaluation view: per-participant progress bar over all questions, live.

## Non-Goals (v1)

- Team/group escape rooms (individual play only; teams = follow-up).
- QR_SCAN support in live quiz, microlearning, group activity (practice-quiz surface only; validators reject elsewhere).
- Geofencing / location checks on QR scans.
- Anti-cheat beyond opaque server-validated QR tokens (photo-sharing of correct QR not preventable).
- Gamification/achievement hooks beyond existing XP flow (follow-up).
- Analytics service (apps/analytics) integration.
- Narrative/theming engine (rooms, scenes, story). Plain quiz UI with countdown + locks.

## Key Decisions

- **Decision: extend PracticeQuiz, not new activity type.** PracticeQuiz already has SEQUENTIAL order type, immediate server-side correctness on answer, resume behavior, per-participant `QuestionResponse` data, evaluation page. New activity type = every layer duplicated (CASE_STUDY element type alone took 20+ PRs; activity type is bigger). Escape mode = config on PracticeQuiz + one new attempt model + gating logic.
- **Decision: server-side gating, not client-only.** `respondToElementStack` (packages/graphql/src/services/stacks.ts:3164) must reject answers for locked stacks and expired attempts. Client lock UI is UX, not security.
- **Decision: correctness bar = all elements in stack `CORRECT`** (`ResponseCorrectness.CORRECT`, packages/prisma/src/prisma/schema/response.prisma:1). Unlimited retries until correct (escape-room convention). PARTIAL does not unlock.
- **Decision: hint cost = time penalty, not hint cap.** Evidence: hint use naturally low, correlates with genuinely stuck students; hard caps create "hopeless deadlock" (see Research). Default 120s penalty per hint, configurable per quiz; hints per element optional.
- **Decision: countdown per participant, starts at explicit "Start" action.** `deadline = startedAt + timeLimit - penaltySeconds`. Server enforces on every mutation; client renders countdown. Hard stop on expiry, then solution/debrief screen (evidence: hard stop + debrief is the norm; no source recommends overtime).
- **Decision: QR_SCAN = real new ElementType, scoped to practice quiz surfaces.** Alternative considered: fake it as FREE_TEXT + camera sugar — rejected (wrong authoring UX, wrong evaluation display, exact-match solution leaks shape). Cost control: validators block QR_SCAN outside practice quiz, so live-quiz/group grading paths untouched in v1.
- **Decision: QR payload = opaque random short code, validated server-side.** QR encodes `klicker-qr:<code>` with a human-typeable code (8-10 chars base32, CSPRNG) so the manual-entry fallback is usable under time pressure (review finding 5). Correct code lives in element options server-side, never shipped to client pre-answer (same pattern as existing sample-solution stripping, stacks.ts:1380). Decoy QR codes are generated at print time only, not persisted — any non-matching payload grades wrong anyway (review finding 9).
- **Decision: lecturer progress view = polling, not subscription.** Evaluation pages poll today; escape dashboard reuses that. Refresh 5-10s is fine for 90-min activity with ≤300 participants.

## Research

One subagent per question (4 codebase, 4 web). Two web + two codebase agents failed on rate/spend limits; gaps filled by main-agent inline research — marked below.

### R1 Codebase: activity models (inline research — subagent failed)

- PracticeQuiz model: `packages/prisma/src/prisma/schema/quiz.prisma:23` — has `orderType ElementOrderType (SEQUENTIAL | SPACED_REPETITION)`, `availableFrom`, `PublicationStatus`, `stacks ElementStack[]`, relations to `QuestionResponse`, `ParticipantActivityPerformance`, `ActivityProgress`.
- PWA run component: `apps/frontend-pwa/src/components/practiceQuiz/PracticeQuiz.tsx` — client-side navigation via `currentIx` over `quiz.stacks`; gating hooks in naturally here.
- Wizard: `apps/frontend-manage/src/components/activities/creation/practiceQuiz/PracticeQuizWizard.tsx`.
- Evaluation page exists: `apps/frontend-manage/src/pages/practiceQuiz/[id]/evaluation.tsx`.

### R2 Codebase: adding a new element type (subagent, DONE)

- ElementType enum source of truth: `packages/prisma/src/prisma/schema/element.prisma:9` (SC, MC, KPRIM, FREE_TEXT, NUMERICAL, CONTENT, FLASHCARD, SELECTION, CASE_STUDY). GraphQL wraps it 1:1 in `packages/graphql/src/schema/elementData.ts:25`; codegen regenerates `ops.ts` / `public/schema.graphql`.
- Options = untyped Prisma `Json`; real typing in `packages/types/src/index.ts:508-660` + per-type validators `packages/graphql/src/lib/validateAndProcessElementOptions.ts`.
- Manage editor: per-type options components under `apps/frontend-manage/src/components/elements/manipulation/options/`, registered in `useElementTypeOptions.ts`; also `ElementEditForm.tsx`, `useValidationSchema.ts`, `useElementFormInitialValues.ts`, `ElementTypeMonitor.tsx`.
- Student rendering registry: `packages/shared-components/src/StudentElement.tsx:129-473` — if/else on GraphQL `__typename`; one component per type.
- Grading: one pure function per type in `packages/grading/src/index.ts:39-256`, called from per-type switch in `packages/graphql/src/services/stacks.ts:1499-1624` (plus liveQuizzes.ts + groups.ts branches — out of scope for v1 QR).
- **Precedent: CASE_STUDY rollout = 20+ sequential PRs** (Jan-Feb 2025, starting PR #4477: 21 files/778 insertions for foundations alone; grading PR #4486: 20 files/2375 insertions). Applicability: budget QR_SCAN as multi-PR track; scope reduction to practice-quiz-only is essential.
- QR generation already in repo: `react-qrcode-logo` 3.0.0 (frontend-manage, join links). Zero QR *scanning* code anywhere (grep confirmed) — camera dependency is new, PWA only.

### R3 Codebase: correctness/response data (inline research — subagent failed)

- `respondToElementStack` returns `{ id, status: StackFeedbackStatus, score, evaluations }` immediately (stacks.ts:3164-3245) — correctness signal for gating already exists in the answer path.
- Per-participant per-instance state: `QuestionResponse` (response.prisma:7) — `firstResponseCorrectness`, `correctCount`, `lastAnsweredAt`, `averageTimeSpent`, per participant+instance. Progress = cleared-stack count derivable, but attempt timing/hints need a new model.
- Aggregates exist (`ParticipantActivityPerformance` completion fraction, `ActivityProgress` counts — analytics.prisma:251,270) but are batch/analytics oriented; live dashboard should query `EscapeRoomAttempt` + `QuestionResponse` directly.
- Sample solutions stripped server-side unless answered (stacks.ts:1380 pattern) — same must hold for hint texts and QR tokens.

### R4 Web: existing tools (subagent, DONE)

- No mainstream competitor (Wooclap, Mentimeter, Particify, Kahoot) has native escape mode — differentiation, not catch-up. Kahoot's closest (Robot Run) is team-threshold minigame, different mechanic. [wooclap.com/en/blog/mentimeter-vs-wooclap, support.kahoot.com Robot Run article]
- H5P Escape Room (NDLA, open source): scenes locked behind codes/sub-activities; scoreboard aggregation. No timer/hint engine documented. [github.com/NDLANO/h5p-escape-room]
- Canvas "escape room" = recipe: one-question-at-a-time + correct-answer feedback text reveals next password + module prerequisites. Validates answer-gated progression as proven mechanic. [citt.it.ufl.edu article]
- Google Forms breakout: response validation + section branching — the low-tech baseline our mode replaces.
- QR in other tools (Plickers, Quizizz Paper Mode) = answer *input* modality, not scan-the-right-code puzzle. **Our QR mechanic has no reference implementation — design validation logic ourselves.**
- Nearpod "View Progress" per-student lesson position = closest precedent for the lecturer progress view. [nearpod.com/blog/how-to-digital-escape-room]

### R5 Web: hint + countdown design (subagent, DONE)

- Hints mandatory in design, player-requested trigger (no per-team gamemaster in classroom digital setting). Render inline in quiz UI, don't break flow. [escapED framework; roomescapeartist.com hint systems]
- Empirical (process mining, 4 university online escape rooms, Escapp platform, 2024): hint use low, correlates with struggling students, no abuse observed → generous availability + small time penalty > hard caps. [Santamaría-Urbieta & López-Pernas, Revista de Educación 2024 — abstract only, paywalled]
- Conventions: "first hint free, later hints cost time" and "3 hints" both common; exhausted caps = deadlock, avoid. Lecturer manual hint-grant from dashboard = recommended safety net (v1: optional; note in dashboard slice).
- Visible countdown: lowers anticipatory anxiety, no performance difference, less off-task behavior; high variance in fixation → per-quiz toggle "show countdown prominently vs collapsed" is cheap and worth it. [PMC12731990; ERIC ED622605]
- Expiry: hard stop + immediate debrief/solution reveal is the norm; overtime breaks fairness. 90 min fits a European lecture block (above 60-min entertainment norm, fine for edu with debrief). [tandfonline 2020 escape-room review; escaperoomdata.com]

### R6 Web: QR mechanics + scanning tech (inline research — subagent failed; evidence thinner)

- BarcodeDetector API: not Baseline; missing/partial in Safari + Firefox → cannot be sole path. [MDN Barcode Detection API]
- Libraries: `html5-qrcode` (ZXing-js based, community fork, known iOS quirks), `qr-scanner` (nimiq; uses BarcodeDetector when available, worker fallback), Quagga2 (1D focus, irrelevant). [scanbot.io comparison; npm]
- Recommendation: small spike in QR slice — prefer `qr-scanner` (BarcodeDetector-first + fallback, small); fallback choice `html5-qrcode`. Manual-entry fallback field (type code printed under QR) is mandatory for camera-denied/broken devices.
- Limitation: no deep source on anti-sharing designs; opaque signed/random tokens + decoy codes is our own design, flagged as assumption.

### R7 Web: facilitator dashboards (subagent failed — partial via R4)

- Nearpod per-student position view + downloadable report (R4). Generic pattern for "M participants × N sequential steps": one row per participant, horizontal segmented progress bar, sortable by progress/stuck-time.
- Limitation: no dedicated evidence on stuck-detection UX; "no progress for X min" highlight is our own design, cheap and reversible.

## Architecture (target state)

### Data model (packages/prisma)

- `PracticeQuiz` new fields (migration):
  - `isEscapeRoom Boolean @default(false)` (or `mode` enum if reviewer prefers; boolean simpler)
  - `escapeTimeLimit Int?` (minutes)
  - `escapeHintPenaltySeconds Int @default(120)`
- New model `EscapeRoomAttempt`:
  - `id`, `participantId`, `practiceQuizId` (`@@unique([participantId, practiceQuizId])` — one attempt v1)
  - `startedAt DateTime`, `completedAt DateTime?`, `expiredAt DateTime?`
  - `penaltySeconds Int @default(0)`
  - `hintsUsed Json` (array of `{stackId, elementInstanceId, requestedAt}`)
- Hints: authored per element instance in escape wizard → stored in `ElementInstance.options` JSON (`hint: string`, markdown). Avoids touching Element editor + element library semantics.
- QR_SCAN options on `Element.options`: `{ correctCode: string, displayInstructions?: string }`. Code generated server-side (CSPRNG, 8-10 chars base32), never exposed in participant-facing GraphQL types. Decoy codes exist only on the printed sheet.

### GraphQL (packages/graphql)

- Mutations: `startEscapeRoomAttempt(quizId)`, `requestEscapeRoomHint(quizId, elementInstanceId)` (records usage, adds penalty, returns hint text — hint never in pre-answer payload), `resetEscapeRoomAttempt(quizId, participantId)` (lecturer-only; recovery from crashes/glitches under one-attempt policy — review finding 3).
- `respondToElementStack`: gate when quiz `isEscapeRoom` — reject if stack locked (a previous stack not fully CORRECT), attempt missing/expired; recompute expiry server-side per call with a ~5s grace window for network latency (review finding 4).
- PracticeQuiz query for participants: return **only unlocked stacks** plus `totalStacks` count — do not null-out fields on locked stacks, existing non-nullable GraphQL/TS types would break (review finding 1). Attempt state (deadline, penalties, per-stack cleared flags) added; attempt payload includes **already-used hints with their text** so hints survive refresh/device switch (review finding 2). Client countdown derives from server-sent remaining seconds at fetch time, not client wall-clock vs deadline (clock drift — review finding 11).
- Lecturer query: `escapeRoomProgress(quizId)` → per participant: username/avatar, clearedCount, totalStacks, currentStackOrder, hintsUsed, penaltySeconds, startedAt, deadline, status (ACTIVE/FINISHED/EXPIRED/NOT_STARTED).
- Codegen after every schema/ops change (`pnpm --filter @klicker-uzh/graphql generate`).

### Frontend

- PWA `PracticeQuiz.tsx`: escape branch — start screen (rules, time limit, hint policy) → locked navigation (cap `currentIx` at first-uncleared) → persistent countdown (deadline from server; re-sync on every mutation response) → wrong answer = shake/"try again", retry allowed → hint button per element where authored (confirm dialog states penalty) → completion screen (time used, hints) / expiry screen (hard stop + solutions where allowed).
- Manage wizard: escape settings step in `PracticeQuizWizard.tsx` (toggle, time limit, hint penalty, per-element hint fields; force `orderType: SEQUENTIAL`).
- Manage evaluation: escape tab on `pages/practiceQuiz/[id]/evaluation.tsx` — table, one row per participant, segmented progress bar, stuck highlight (no cleared stack in last 5 min), poll 5-10s.
- QR: manage generates printable QR sheet (existing `react-qrcode-logo`; browser print CSS is enough v1, no PDF lib); PWA `QrScanQuestion` in shared-components (camera scan + manual code entry fallback).

### Grading (packages/grading)

- `gradeQuestionQrScan(correctToken, submittedToken)` → 1 | 0. Wire into stacks.ts per-type switch only (not liveQuizzes/groups; validators forbid QR_SCAN there v1).

## Slices

Each slice: implement → verify → review subagent → simplification subagent → conventional commit. UI slices: verify via `agent-browser` (delegated login, seeded `lecturer`/`testuser1`), screenshots for PR.

1. **Slice 1 — Escape config, schema + wizard (`feat(practice-quiz): escape room configuration`)**
   - Prisma fields + `EscapeRoomAttempt` + migration + `prisma:sync`; GraphQL type/mutation surface for create/edit; wizard settings step; validators (escape requires SEQUENTIAL + published window sanity).
   - Verify: create + publish escape quiz via manage UI; `pnpm --filter @klicker-uzh/graphql check`.
2. **Slice 2a — Attempt + gating, backend only (`feat(graphql): escape room attempt and gating`)**
   - `startEscapeRoomAttempt`; participant query returns attempt + unlocked-stacks-only shape; `respondToElementStack` gating + expiry enforcement with grace window. No UI yet (split per review finding 6).
   - Verify: vitest/GraphQL-level — locked stack answer rejected, expired attempt rejected, unlock after CORRECT.
3. **Slice 2b — PWA escape run UI (`feat(pwa): escape room run experience`)**
   - Start screen (rules, time limit, hint policy), locked nav (cap `currentIx`), countdown from server remaining-seconds, retry-until-correct with prior inputs preserved client-side (review finding 8), completion/expiry screens.
   - Verify: agent-browser as testuser1 — wrong answer blocks, correct unlocks, deadline expiry blocks answering (shrink time limit for test). Tracer bullet: mode demoable after this slice.
4. **Slice 3 — Hints (`feat(practice-quiz): time-penalty hints`)**
   - Hint authoring in wizard (per element); `requestEscapeRoomHint` (penalty + record + return text); used hints in attempt payload (refresh-safe); PWA hint button/dialog; deadline shifts immediately.
   - Verify: agent-browser — hint shows, survives reload, countdown drops by penalty, hint usage recorded once.
5. **Slice 4 — Lecturer progress dashboard (`feat(manage): escape room progress evaluation`)**
   - `escapeRoomProgress` query (authorize owner); evaluation tab with per-participant progress bars, hints/penalty/time columns, polling; `resetEscapeRoomAttempt` button per row. Stuck highlight deferred to Slice 7 polish (review finding 10).
   - Verify: two seeded students at different stacks → bars differ; poll updates live; reset lets a student restart.
6. **Slice 5 — QR_SCAN foundations (`feat(elements): QR scan element type — authoring`)**
   - Prisma enum value + migration; types + options validation; manage option editor (auto-generated short code, decoy count for print only) + registry entries; printable QR sheet; GraphQL union member with code stripping.
   - Verify: create QR element, print preview shows codes, participant payload contains no codes (inspect GraphQL response).
   - Note: QR track (5+6) is the heaviest and most cross-cutting part (CASE_STUDY precedent: 20+ PRs for a full type). Junior should pair with a senior here, or the track can be pulled out into its own follow-up PR series without blocking slices 1-4 (review finding 7).
7. **Slice 6 — QR_SCAN answering + grading (`feat(pwa): QR scan answering`)**
   - Scanner spike (`qr-scanner` vs `html5-qrcode`, 1-2h, pick one); `QrScanQuestion` in shared-components (camera + manual entry fallback); StudentElement branch; grading fn + stacks.ts wiring; block QR_SCAN in live-quiz/microlearning/group creation validators.
   - Verify: real phone/laptop camera scan correct + decoy QR; manual entry path; wrong scan does not unlock.
8. **Slice 7 — Polish, i18n, e2e (`test(playwright): escape room workflow`)**
   - de/en strings for all new UI; playwright workflow test (create escape quiz → student solves with hint → dashboard shows progress); stuck-highlight on dashboard (optional, if time); docs page stub.
   - Verify: `pnpm run check`, targeted playwright spec green.

Dependencies: 2a needs 1; 2b needs 2a; 3,4 need 2b; 6 needs 5; 5 independent of 2-4 (parallelizable); 7 last. QR track (5-6) is the risky/expensive one — CASE_STUDY precedent says expect follow-up fixes; do not batch with other slices.

## Assumptions (state in PR, cheap to reverse)

- Individual play, one attempt per participant; lecturer can reset an attempt from the dashboard (Slice 4).
- Escape quizzes should use single-element stacks (wizard shows a recommendation); multi-element stacks work but retries re-render all elements, prior inputs preserved client-side only.
- Countdown starts per participant at explicit start; no synchronized global start v1.
- Hint penalty applies to remaining time (deadline moves earlier), default 120s.
- Progress dashboard shows participant username (existing pseudonym practice); no real names.
- Expired/finished participants see solutions only if lecturer enabled existing solution display.

## Security Notes (write normal)

- All gating, expiry, hint, and QR-token validation must be enforced server-side in the GraphQL services; the client UI is presentation only. Locked stack content, hint texts, and QR tokens must never be present in any participant-facing GraphQL response before the participant has legitimately reached them.
- QR tokens must be generated with a CSPRNG and treated like sample solutions (stripped via the existing pattern in stacks.ts:1380).
- `escapeRoomProgress` exposes participant activity data; restrict to the quiz owner via the existing three-layer auth pattern (authenticate → authorize → execute) and reuse participant pseudonymization.
- Rate-limit or debounce `requestEscapeRoomHint` and answer submissions server-side to the extent existing middleware allows; document any gap.
- Final security review subagent (`$security-review`) mandatory before the implementation PR is marked ready.

### Deferred hardening (SEC#3, SEC#4) — accepted residual risk

The independent security review surfaced two hardening items that are **intentionally deferred out of this PR** with the rationale below. Both are recorded here and mirrored in the PR body so the decision is auditable; both get a follow-up ticket rather than silent omission.

- **SEC#3 — no dedicated rate limit on `requestEscapeRoomHint` / answer submission.** Deferred.
  - _Residual risk:_ a scripted participant could hammer the hint or submit resolvers.
  - _Why acceptable now:_ the feature already carries app-level throttles that blunt the abuse. Every hint applies a **monotonic time penalty** to the participant's own attempt, so hint-spam is self-defeating and bounded by the finite hint count; a wrong answer arms a **5s server-side lockout** that rejects premature resubmits; attempts are per-participant/per-group with a server-anchored deadline, and sequential gating prevents skipping ahead. The remaining exposure is compute load, not a correctness or data-leak bug.
  - _Why not fixed here:_ KlickerUZH has **no per-resolver rate-limit primitive** today. Adding a Redis-backed limiter is a cross-cutting platform concern that should be designed once and applied uniformly (hint, submit, login, magic-link), not bolted onto one feature. Doing it inside this PR would either duplicate infra or under-build it.
  - _Follow-up:_ ticket to add a shared resolver rate-limit primitive and apply it to the escape hint + submit paths (and other participant-facing mutations).

- **SEC#4 — QR-scan code comparison is not constant-time.** Deferred.
  - _Site:_ `gradeQrScanResponse` in `packages/types/src/index.ts` compares with `normalized === expected` (short-circuits on first differing char).
  - _Residual risk:_ a theoretical timing side-channel could leak the code character-by-character.
  - _Why acceptable now:_ the code is **72 bits of CSPRNG entropy** (`randomBytes(9)` base64url), single-use inside an escape context and redacted from participant-facing payloads. Recovering it char-by-char via `===` timing requires isolating nanosecond-scale differences across the network; wall-clock jitter dwarfs that signal, and the per-participant attempt/lockout model further throttles the sampling an attacker would need. Threat model = classroom escape rooms, not a credential or financial secret.
  - _Why not fixed here:_ `gradeQrScanResponse` lives in the **isomorphic `@klicker-uzh/types` package** that is bundled into the frontend. Pulling `node:crypto.timingSafeEqual` into it risks the browser build; a correct fix relocates QR comparison to a server-only module — a refactor disproportionate to the residual risk.
  - _Follow-up:_ ticket to move QR-code comparison to a server-only path and switch to `crypto.timingSafeEqual`.

## Verification & PR Evidence

- Per-slice: `pnpm --filter @klicker-uzh/graphql check`, targeted vitest (`grading`), agent-browser screenshots (desktop + mobile viewport) attached to PR.
- Final: playwright workflow spec, `pnpm run check:all`, screenshots of wizard, student run (locked → unlocked → countdown → hint → completion), dashboard.

## Goal Prompt Requirements (for implementing agent)

- Reference this plan by exact path; update `Progress` while working; rename plan file with PR id when known (separate metadata commit).
- One slice at a time; review + simplification subagents + clean conventional commit per slice; independent final branch review (prefer `agy`, fall back Codex) + `$security-review` before PR ready; `$df-mr-description-writer` for the PR body; `Next Steps` section at the end.

## Independent Plan Review

- Reviewer: Antigravity CLI (`agy`, Gemini) — workflow-approved external review; plan text + repo context only, no secrets.
- 11 findings, all integrated or explicitly handled:
  1. Critical — locked-stack field stripping breaks non-nullable GraphQL/TS types → **accepted**: return only unlocked stacks + `totalStacks`, no nulled fields.
  2. Critical — hints lost on refresh if only returned by mutation → **accepted**: used hints (with text) included in attempt payload.
  3. Critical — no attempt reset for crashed/glitched students → **accepted**: `resetEscapeRoomAttempt` mutation + dashboard button (Slice 4).
  4. Important — strict deadline rejects borderline submissions under latency → **accepted**: ~5s server-side grace window.
  5. Important — UUID manual entry unusable on mobile → **accepted**: short base32 code (8-10 chars) as QR payload + typed fallback.
  6. Important — Slice 2 too large → **accepted**: split into 2a (backend) / 2b (PWA UI).
  7. Important — new ElementType heavy for a junior → **accepted**: pairing/senior note on QR track; track separable from slices 1-4.
  8. Important — multi-element stack retries lose correct inputs → **accepted**: client preserves prior inputs; wizard recommends single-element stacks.
  9. Minor — persisted decoy tokens YAGNI → **accepted**: decoys generated at print time only.
  10. Minor — stuck highlight premature → **accepted**: deferred to Slice 7 (optional).
  11. Minor — client clock drift vs deadline → **accepted**: countdown from server-sent remaining seconds.

## Progress

- 2026-07-07: Research done (4 subagents OK, 4 failed on rate/spend limits — gaps filled inline, marked in Research). Plan drafted. Independent `agy` review done, 11 findings integrated. Next: plan commit → draft PR.
- 2026-07-12: All slices implemented on `codex/escape-room-production` (PR #5143). Feature complete across practice quizzes, microlearnings, group activities, and live-quiz blocks: server-side sequential gating, per-participant/group attempts with server-anchored countdown, 5s wrong-answer lockout, time-penalty hints, QR-scan answer elements (CSPRNG codes, redacted like sample solutions, print sheets), and the lecturer progress dashboard with owner-only reset. Slice 10 verification pass:
  - Playwright `Z-escape-room.spec.ts`: 17/17 green — full authoring→publish→play loops for quiz, microlearning, and group activity, plus a server-side security regression test (future-stack hint → `ESCAPE_ROOM_GATED`; anonymous submit → `ESCAPE_ROOM_FORBIDDEN`).
  - GraphQL integration `escapeRoom.test.ts`: 62/62 green (B1 integrity guard, B2 owner-only reset, B4 retention, gating/lockout/expiry/completion, group atomic submission, progress aggregation, plus a new microlearning retry regression test).
  - Two product bugs found and fixed during e2e: escape microlearnings were silently swallowing retries under the single-submission guard (`stacks.ts`), and the microlearning page threw "Stack not found" instead of rendering the intro/lockout overlay when the server withheld stacks (`[ix].tsx`).
  - Gates: full turbo `check` 23/23, prettier clean, frontend lint clean, codegen + Prisma-sync parity clean, opengrep clean (no escape-room findings). QR-outside-escape enforced server-side in all three creation validators.
  - LiveQuiz escape browser coverage deferred: server path covered by the integration suite; the participant overlay is the shared `EscapeRoomOverlay` already exercised by the practice-quiz browser tests; driving a full live control-app session in-browser is heavy and flaky for low marginal value.
- 2026-07-12 (review remediation): addressed the LiveQuiz-escape review findings in-PR rather than deferring them.
  - **SEC#1 status gate:** `startEscapeRoomAttempt` / `requestEscapeRoomHint` now reject unpublished practice quizzes / microlearnings / group activities and non-active LiveQuiz blocks (`practiceQuizzes.ts`). Two integration regression tests added → `escapeRoom.test.ts` now **64/64** green.
  - **MAINT#1 unit bug:** LiveQuiz escape time limit was authored in minutes but read back/persisted inconsistently; the wizard now round-trips minutes and `submitLiveQuizForm.tsx` converts to seconds (`* 60`) with a `?? 5` default. Guarded by a new authoring→edit Playwright test in `Z-escape-room.spec.ts` that asserts the edit form re-prefills the time limit in **minutes**, not the stored seconds.
  - **MAINT#5 i18n:** dedicated keys `escapeRoomAssessmentIncompatible` + `escapeRoomNoQrOutside` added to `en.ts`/`de.ts` (no reused/borrowed strings).
  - **MAINT#2/#3/#4 typing:** `stacks.ts` escape types tightened; stray `t()` casts removed in `QuestionArea.tsx` + `ElementStack.tsx`; `useEscapeRoom` `Pick` widened to include the overlay stats fields (`startedAt`/`completedAt`/`penaltySeconds`/`hintsUsed`) so `EscapeRoomOverlay` typechecks at all three call sites.
  - **SEC#3 / SEC#4:** intentionally deferred with documented rationale — see [Deferred hardening](#deferred-hardening-sec3-sec4--accepted-residual-risk).
  - Re-verification (correct worktree container, `default-es-d54ef-app-1`, fresh run): turbo `check` 11/11; `escapeRoom.test.ts` 64/64; `format:check` (`prettier --check .`) clean; `check:syncpack`, `check:prisma-sync`, `check:agents-md` all pass; lint on changed packages clean; graphql codegen produces no drift. opengrep on the changed escape-room files is clean (2 `unsafe-formatstring` findings at `practiceQuizzes.ts:725/781` are pre-existing on `v3`, outside this branch's diff). Note: `pnpm run check:all` as a whole reports failure only on its `check:format` step, which is `lint-staged` and requires git — git is unavailable inside the devcontainer (the mount is a worktree pointer), so that step is an environment artifact, not a formatting defect; `format:check` (stronger, checks all files) is the substitute and passes.

## Next Steps

1. Final security + maintainability review of the branch; address findings.
2. Refresh the engineering wiki escape-room page and confirm the lecturer/student tutorials match shipped behavior.
3. Capture PR screenshots (wizard, student locked→unlocked→countdown→hint→completion, dashboard) at desktop + mobile.
4. Finalize the PR description; decide the push strategy for PR head `escape-room-quiz-mode-plan` (cannot fast-forward — needs merge-in or force-with-lease, with explicit user approval). Do not merge without approval.
