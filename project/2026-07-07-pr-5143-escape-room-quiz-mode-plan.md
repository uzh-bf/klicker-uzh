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

## Next Steps

1. Junior: read plan + R2 precedent PRs (#4477, #4486) before touching QR track.
2. Confirm with product owner: individual-only v1, hint penalty default, one-attempt policy.
3. Start Slice 1 on a fresh branch off `v3`.
