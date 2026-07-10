# Escape Room Quiz Mode — Implementation Review & Roadmap to Production

- **PR:** [#5143](https://github.com/uzh-bf/klicker-uzh/pull/5143) — `feat(quiz): generalized escape room mode and response validation`
- **Branch:** `escape-room-quiz-mode-plan` → target `v3`
- **Reviewed at HEAD:** `82d02d0cd`
- **Diff size:** 77 files, +4349 / −179 vs `origin/v3`
- **Reviewer:** senior pass (Claude) — 5 parallel review agents (PWA, manage, backend, tests, bots/CI) + manual verification of every blocking finding against the code.
- **Companion doc:** original plan at [project/2026-07-07-pr-5143-escape-room-quiz-mode-plan.md](2026-07-07-pr-5143-escape-room-quiz-mode-plan.md).

---

## 1. Verdict

**Not mergeable yet.** Strong foundational work — the data model, server-side stack masking for logged-in participants, the countdown anchoring, and the config upsert/delete lifecycle are all sound. But there are **security-integrity holes that defeat the core anti-cheat premise**, a **schema/migration drift**, and a **scope mismatch** vs the agreed plan. The feature also ships **three configurable knobs and one whole code path that are unreachable or dead** (hints, live-quiz escape, QR — none exist as usable features).

The honest framing for the junior: you built escape mode **wide** (all four activity types) instead of **deep** (the plan's PracticeQuiz-only v1 with hints + QR + lecturer dashboard). The width added duplication and dead surface; the depth the plan actually asked for is missing. Roadmap in §7 converges the two.

### Severity summary

| Sev | Count | Headline items |
|-----|-------|----------------|
| 🔴 Blocking | 6 | Anonymous gating bypass; participant self-reset wipes responses; migration index drift; prune deletes all completed attempts nightly; docker-compose port change; playwright test targets nonexistent element |
| 🟠 Major | 9 | Group-activity lockout never enforced; no error handling on any mutation; lockout toast in wrong/dead component; hardcoded English lecturer strings; order-select editable in escape mode; 12.4% code duplication (Sonar gate); no unit tests for ~450 new backend lines; live-quiz escape path unreachable; stray CI-debug comment |
| 🟡 Minor | ~12 | Countdown drift/no aria-live; resume-after-refresh UX; no max bounds; lossy minute rounding; `activity: any`; EscapeRoomConfig ungated; etc. |
| ⚪ Nit | ~4 | 23× needless `as any` on `t()`; radix cleanup noise; data-cy present but unexercised |

---

## 2. Blocking findings (must fix before merge)

### B1 🔴 Anonymous / temporary-participant callers bypass all escape-room enforcement
- **Where:** [packages/graphql/src/services/stacks.ts:3181](packages/graphql/src/services/stacks.ts) — every escape check (attempt lookup, lockout, time-limit, sequential gating) is nested inside `if (ctx.user?.sub && ctx.user.role === DB.UserRole.PARTICIPANT)`. The mutation itself ([mutation.ts:272](packages/graphql/src/schema/mutation.ts), "ANONYMOUS OPERATIONS" region) has **no auth requirement**.
- **Also:** [practiceQuizzes.ts:112](packages/graphql/src/services/practiceQuizzes.ts) — `getPracticeQuizData` masks locked stacks **only** for the `PARTICIPANT` branch; an anonymous/non-participant caller falls through to `return { ...quiz, isOwner }` with **all stacks and all question content**.
- **Failure scenario:** a caller with no cookie (or a `TEMPORARY_PARTICIPANT` JWT) queries the quiz → receives every stack's stems/options → calls `respondToElementStack` for any stackId → `respondToElement` ([stacks.ts:2913](packages/graphql/src/services/stacks.ts)) grades and returns real CORRECT/INCORRECT feedback with `participation: null`, **no gating, no lockout, no timer, no rate limit**. Full correctness oracle → trivial brute force → escape room "solved" out of band.
- **Fix:** when the target stack belongs to an escape-room activity, require `ctx.user?.role === PARTICIPANT` and a valid `IN_PROGRESS` attempt — throw `GraphQLError` otherwise, *before* grading. Mirror the masking guard in `getPracticeQuizData`/`getMicroLearningData` so non-participants get `stacks: []` for escape activities. Add a regression test (see T-list in §6).

### B2 🔴 Participant self-reset deletes own responses → unlimited retries + XP re-farm, and skips enrollment check
- **Where:** [practiceQuizzes.ts:1071-1200 `resetEscapeRoomAttempt`](packages/graphql/src/services/practiceQuizzes.ts). Non-lecturer branch only asserts `role === PARTICIPANT` then deletes the attempt **and** `questionResponse.deleteMany` for the activity.
- **Failure scenarios:**
  1. Countdown almost expired or attempt stuck → participant calls `resetEscapeRoomAttempt` → fresh attempt, full time again, prior responses wiped. Defeats the one-attempt + hard-countdown semantics. The PWA even exposes this as a one-click **Reset** button with no confirmation on the Expired/Completed overlay ([PracticeQuiz.tsx:196](apps/frontend-pwa/src/components/practiceQuiz/PracticeQuiz.tsx), microLearning + group pages similarly).
  2. **Authz gap (greptile, verified):** unlike `startEscapeRoomAttempt` (which does a `participation.findUnique` enrollment check), the reset path does **no** enrollment/membership re-check — it trusts the attacker-supplied `practiceQuizId`/`microLearningId`/`elementBlockId`. A participant unenrolled from a course but still holding an old activity id can wipe attempt + response rows.
- **Plan said:** reset is a **lecturer-only** dashboard action (Slice 4, review finding 3). Self-reset was never in scope.
- **Fix:** remove participant self-reset entirely; make `resetEscapeRoomAttempt` lecturer-only (WRITE permission, which the lecturer branch already checks). Remove the PWA Reset button, or repoint the overlay's "stuck" state to a "contact your lecturer" message. If any self-service reset is truly wanted, it needs enrollment re-check + attempt-count cap + confirmation — defer to a follow-up.

### B3 🔴 Prisma migration is missing the `participantId_elementBlockId` unique index (schema/DB drift)
- **Where:** [quiz.prisma:536](packages/prisma/src/prisma/schema/quiz.prisma) declares `@@unique([participantId, elementBlockId])`, and [escapeRoom.ts:80](apps/response-api/src/escapeRoom.ts) does `findUnique({ where: { participantId_elementBlockId: … } })`. But [migration.sql](packages/prisma/src/prisma/schema/migrations/20260707103049_add_escape_room_mode/migration.sql) creates only 3 of the 4 unique indexes — **no** `EscapeRoomAttempt_participantId_elementBlockId_key`.
- **Failure scenario:** `prisma migrate` drift on deploy; and without the DB constraint, concurrent creates can insert duplicate `(participantId, elementBlockId)` rows, after which `findUnique` throws "more than one row". Migration was hand-edited or schema changed after generation.
- **Fix:** regenerate the migration from schema (`pnpm run prisma:migrate`) so all four unique indexes match the schema, then `pnpm run prisma:sync`. Verify `prisma migrate diff` is clean.

### B4 🔴 Nightly prune deletes ALL completed/expired attempts with no retention window
- **Where:** [pruneEscapeRooms.ts:14-20](packages/graphql/src/services/pruneEscapeRooms.ts) selects `status IN (COMPLETED, EXPIRED)` with no `completedAt`/age cutoff; [:127-132](packages/graphql/src/services/pruneEscapeRooms.ts) deletes them all. Cron `0 2 * * *` daily ([packages/hatchet/src/index.ts](packages/hatchet/src/index.ts)).
- **Failure scenarios:**
  1. Attempt completed at 01:59 → deleted at 02:00. Because `getPracticeQuizData` treats `!attempt` as never-started (`filteredStacks = []`), the participant who **finished** now sees an empty quiz.
  2. `startEscapeRoomAttempt` only blocks re-start when an `existingAttempt` row is present — once pruned, a participant can start a **fresh full-time attempt** of an already-completed room → free replay, breaks XP/points integrity.
- **Fix:** only prune attempts older than a retention window (e.g. `completedAt < now − N days`) **after** any stats aggregation; never same-day. Confirm the intended purpose of prune with the product owner — if it's only meant to expire stale `IN_PROGRESS` attempts, it should not touch COMPLETED at all.

### B5 🔴 `docker-compose.yml` Postgres port remapped 5432 → 55433
- **Where:** [docker-compose.yml:198](docker-compose.yml). Almost certainly a leftover from the junior running two stacks locally.
- **Impact:** breaks every developer's and CI's default DB connection string. Not part of the feature.
- **Fix:** revert to `5432:5432`.

### B6 🔴 Playwright escape-room test targets a UI element that does not exist → red CI
- **Where:** [playwright/tests/Z-escape-room.spec.ts:45](playwright/tests/Z-escape-room.spec.ts) fills `getByTestId('insert-stack-display-name-0')`. That test-id exists nowhere in `apps/frontend-manage/src` (config maps `testIdAttribute: 'data-cy'`; the real stack component exposes `data-cy="stack-${ix}"` / `stack-container-header`, no per-stack display-name input).
- **Impact:** `test-playwright (5,8)` fails deterministically on original + retry (not flake). This is the only escape-room CI failure that is real and owned by this PR (GitGuardian + the catalog shard failures are pre-existing/unrelated — see §5).
- **Fix:** correct the selector / drop the nonexistent `.fill()` step, and also fix the `loginLecturer`/`loginStudent` call signatures (§4 M-list) while in the file.

---

## 3. Major findings

### M1 🟠 Group-activity lockout is set but never enforced
[groups.ts:1701-1712](packages/graphql/src/services/groups.ts) writes `lockoutUntil` on an incorrect group submission, but `submitGroupActivityDecisions` never reads it before allowing the next submission (unlike `stacks.ts:3240` which throws while locked). Lockout is cosmetic for group escape rooms → immediate resubmission, zero penalty. Fix: add the same `dayjs().isBefore(lockoutUntil)` guard at the top of the group submit path, or drop group escape support for v1 (see scope decision in §7).

### M2 🟠 Zero GraphQL error handling in the entire PWA feature path
[ElementStack `respondToElementStack`](apps/frontend-pwa/src/components/practiceQuiz/PracticeQuiz.tsx) call, and `startAttempt`/`resetAttempt` in [useEscapeRoom.ts:41,55](apps/frontend-pwa/src/components/hooks/useEscapeRoom.ts), have no `try/catch`/`onError`. Since the backend now *throws* `GraphQLError` for lockout/expiry/gating, the participant gets an unhandled promise rejection and **no feedback** (button just stops spinning). Fix: catch and surface a toast for each documented error (`locked out`, `expired`, `answer preceding questions first`).

### M3 🟠 Lockout/incorrect toast lives in the wrong component; escape submit path shows nothing
The only `responseStatus === 'incorrect'` / 429 lockout handling is in [QuestionArea.tsx:240-256](apps/frontend-pwa/src/components/liveQuiz/QuestionArea.tsx) (a **liveQuiz** component that escape room never routes through). The real escape submit path (`ElementStack.tsx`) was **not touched** and has no incorrect/lockout UI at all. `lockoutUntil` is typed but never read anywhere → no cooldown, retry allowed immediately. Fix: move lockout/incorrect handling into the actual escape submission path; render a countdown-until-retry from `lockoutUntil`; delete the dead QuestionArea code.

### M4 🟠 All lecturer-facing escape strings are hardcoded English, not i18n'd
8+ strings across [PracticeQuizSettingsStep.tsx:168,186,196](apps/frontend-manage/src/components/activities/creation/practiceQuiz/PracticeQuizSettingsStep.tsx) + the Micro/Group equivalents + validation messages in the three Wizards. None exist in `de.ts`/`en.ts` (only the participant-facing PWA strings were added). Fix: extract to i18n keys in both catalogs. Two PWA keys are also missing (`escapeRoomIncorrectToast`, `escapeRoomLockoutToast`) — and note `getMessageFallback` ignores `defaultValue`, so missing keys render literally as `"<key> is not yet translated"`.

### M5 🟠 Order select stays editable after escape mode enabled → guaranteed submit-time crash
[PracticeQuizSettingsStep.tsx:141-174](apps/frontend-manage/src/components/activities/creation/practiceQuiz/PracticeQuizSettingsStep.tsx) force-sets `order = Sequential` once on toggle, but leaves the select editable. Flip it back to shuffled with escape still on → submit sends `isEscapeRoom:true` + non-sequential order → backend throws ([practiceQuizzes.ts:221](packages/graphql/src/services/practiceQuizzes.ts)) with no client guard. Fix: disable the order select while `isEscapeRoom` is checked.

### M6 🟠 12.4% duplicated new code — Sonar quality gate fails (limit 3%)
320 duplicated lines / 34 blocks. The escape config block (Checkbox + 2 number fields + yup `.when()` + initial-value + submit mapper) is copy-pasted across all three wizard trios; resolver-side start/reset/config logic is mirrored per activity type. Fix: extract one shared `EscapeRoomSettingsFields` component + shared yup fragment + shared mapper, and a shared resolver helper. This single refactor clears the Sonar gate and kills M4's "fix in 3 places" risk.

### M7 🟠 No unit/integration tests for ~450 lines of the riskiest new logic
No vitest coverage for `startEscapeRoomAttempt`, `resetEscapeRoomAttempt`, the gating/lockout/completion branches in `respondToElementStack`, `pruneEscapeRooms`, or the response-api `handleEscapeRoomValidation` (that app has **no test infra at all**). Only two happy-path e2e tests exist. Every blocking bug above is exactly what a unit test would have caught. Fix: see §6 test backlog.

### M8 🟠 Live-quiz escape path is unreachable dead code
`apps/response-api/src/escapeRoom.ts` implements a full live-quiz grading/lockout path, and `liveQuiz.ts` exposes an `escapeRoomConfig` read field, but **no wizard configures it** and `createLiveQuiz`/`editLiveQuiz` have no escape input. So the code (and its Redis `instanceInfo` contract, the `grading` dependency added to response-api) can never run in production. Fix: either finish the live-quiz authoring surface or remove the response-api path + `EscapeRoomConfig.elementBlockId` relation for v1. Given the plan scoped live-quiz **out** of v1, removal is the lighter path.

### M9 🟠 Stray CI-debug artifact committed
[ActivityCreation.tsx:220](apps/frontend-manage/src/components/activities/ActivityCreation.tsx) contains `// Trigger CI workflow 2`. Remove.

---

## 4. Minor & nits (condensed)

- **Countdown:** pure client `Date.now()` recompute each second, no server-offset correction, `lockoutSeconds` not factored; `refetch()` fires from the 1s interval on expiry with **no once-guard** → potential per-second polling storm if the resolver doesn't proactively flip status ([useEscapeRoom.ts:77](apps/frontend-pwa/src/components/hooks/useEscapeRoom.ts)). Add an `if (expired) return` guard + clear the interval.
- **A11y:** `EscapeRoomOverlay` blocking states have no `role="dialog"`/`aria-modal`/focus-trap; background stays tab-reachable; countdown has no `aria-live` ([EscapeRoomOverlay.tsx:44-196](apps/frontend-pwa/src/components/practiceQuiz/EscapeRoomOverlay.tsx)).
- **Resume UX:** `currentIx` resets to `-1` on refresh regardless of `isStarted` → participant must re-click the (misleading) "Start Attempt" while the clock is already running ([practiceQuizzes/[id].tsx:123](apps/frontend-pwa/src/pages/course/[courseId]/practiceQuizzes/[id].tsx)).
- **Validation bounds:** no max on `timeLimit`/`hintPenalty` in any yup schema (`999999999` accepted); minute↔second round-trip is lossy (`Math.round(timeLimit/60)` on load, `×60` on save).
- **`EscapeRoomConfig` fully public** ([escapeRoomConfig.ts:7-20](packages/graphql/src/schema/escapeRoomConfig.ts)) — `timeLimit`/`hintPenalty`/`lockoutSeconds` exposed with no `ctx.user` gate (low risk: game rules, not answers; but inconsistent with sibling fields).
- **`GroupActivityDetails.escapeRoomAttempts`** ([groupActivity.ts:309](packages/graphql/src/schema/groupActivity.ts)) uses `parent.group.id` with no membership re-check, unlike its sibling resolver — confirm upstream scoping.
- **Typing:** `useEscapeRoom.ts:14 activity: any`; `let timeLimit = 3600` dead init ([practiceQuizzes.ts:922](packages/graphql/src/services/practiceQuizzes.ts)).
- **Playwright:** `loginLecturer(page, {…})` / `loginStudent(page, {…})` pass a 2nd arg the helpers don't accept ([workflow.ts:263,355](playwright/util/workflow.ts)) → imported credential constants are dead/misleading. Timer assertion `span:has-text(":")`.first() is unscoped and minute-boundary-flaky.
- **Nits:** 23× `as any` on `t()` calls for keys that exist; unrelated `parseInt(x,10)` radix churn scattered into 4 wizards; `data-cy` attrs added but no test exercises them; `pages/index.tsx` + `WizardLayout` height/flex changes touch shared layout for all activity types (regression-untested).

---

## 5. Bot review & CI triage (verified against HEAD)

| Source | Claim | Verdict |
|--------|-------|---------|
| greptile ×3 (dedup→1) | `resetEscapeRoomAttempt` participant path skips enrollment check | **VALID** → B2 |
| CodeQL | `loginLecturer/Student` superfluous 2nd arg (spec:18,67) | **VALID** → M-list |
| CodeQL | `let timeLimit = 3600` useless init | **VALID** (cosmetic) → §4 |
| copilot / coderabbit / codex | — | **N/A** (all three hit quota, never ran) |
| GitGuardian | "Generic Password" in `.devrouter.yml` / `.devcontainer/docker-compose.yml` | **FALSE-POSITIVE / pre-existing** — not in this diff (`git diff origin/v3...HEAD` on both files is empty); local dev password already on `v3`. |
| SonarCloud | Quality gate: 12.4% duplication on new code | **VALID** → M6 |
| Playwright shard 5 | `insert-stack-display-name-0` timeout | **VALID, PR-owned** → B6 |
| Playwright shard 5 | `U-catalog.spec.ts` failures | **Unrelated** — different feature, pre-existing flake |

CI otherwise green (build-amd/arm, types, lint, format, graphql/grading/util tests, CodeQL, 7/8 playwright shards).

---

## 6. Test backlog (ranked by risk)

Unit/integration (vitest, `packages/graphql/test/`):
1. Anonymous/temporary caller against an escape stack → rejected, no grading (guards B1).
2. Sequential gating: answering stack N+1 before N-correct → `GraphQLError` (server, not just UI).
3. Wrong answer → `lockoutUntil` set; submit during lockout → rejected; after lockout → allowed.
4. Expiry: `startedAt` back-dated past `timeLimit` → status→EXPIRED, submit rejected.
5. `resetEscapeRoomAttempt`: lecturer WRITE ok; participant/unenrolled rejected (guards B2).
6. Completion: last correct stack → status→COMPLETED, `completedAt` set, fires once.
7. `pruneEscapeRooms`: recent COMPLETED **retained**, only stale removed (guards B4).
8. Group lockout enforcement (guards M1) — or delete group path (M8/scope).

E2E (playwright, expand `Z-escape-room.spec.ts` to ≥3 stacks):
9. Multi-stack run-through proving gating end-to-end; wrong-answer lockout UI; expiry overlay; other two wizards' toggles. Fix login signatures + selectors first (B6).

response-api: add vitest infra + a `handleEscapeRoomValidation` grading test **iff** the live-quiz path is kept (else remove per M8).

---

## 7. Roadmap to production readiness

Sequenced so each phase is independently reviewable/commit-able. Phases 0–2 are release-blocking; 3–4 deliver the plan's missing depth; 5 is the original v1 finish line.

### Phase 0 — Stop the bleeding (blocking, ~0.5 day)
1. Revert `docker-compose.yml` port (B5).
2. Remove stray CI comment (M9).
3. Fix playwright selector + login signatures so CI is green on a known-good baseline (B6).
4. Regenerate the migration so all four unique indexes match schema; `prisma:sync`; confirm `migrate diff` clean (B3).

### Phase 1 — Close the integrity holes (blocking, ~2 days)
5. **B1:** require `PARTICIPANT` + valid `IN_PROGRESS` attempt whenever the target stack is escape-room, before grading; mirror stack masking for non-participants in `getPracticeQuizData`/`getMicroLearningData`.
6. **B2:** make `resetEscapeRoomAttempt` lecturer-only (WRITE); remove PWA self-reset button; repoint the overlay "stuck" state to a lecturer-contact message.
7. **B4:** add retention-window filter to `pruneEscapeRooms` (confirm intended purpose with product owner first); never delete same-day COMPLETED.
8. **M1:** enforce group lockout, **or** cut the group escape path (decide with §7 scope note).
9. Add unit tests 1–7 from §6 alongside each fix — no fix lands without its regression test.

### Phase 2 — Make the built surface usable & clean (blocking, ~2 days)
10. **M2/M3:** real error handling + lockout/incorrect UI on the actual escape submit path; delete dead QuestionArea code; read `lockoutUntil` for a retry countdown.
11. **M4:** move all lecturer + missing PWA strings into `de.ts`/`en.ts`.
12. **M6:** extract shared `EscapeRoomSettingsFields` component + yup fragment + mapper + resolver helper → clears Sonar gate, de-triplicates.
13. **M5:** disable order select in escape mode; add max bounds + fix lossy minute rounding (§4).
14. **M8 decision:** remove the unreachable live-quiz/response-api path **or** commit to finishing its authoring surface. Recommendation: **remove for v1** (plan scoped it out); reintroduce with the live-quiz wizard later.
15. A11y pass on the overlay (§4).

### Phase 3 — Deliver the plan's missing depth: hints (~2–3 days)
The `hintPenalty` knob is shipped but there is **no hint authoring, no hint request, no hint content anywhere**. Per the plan (Slice 3): add per-element hint text authoring (Element options JSON), a participant "request hint" mutation that appends to `EscapeRoomAttempt.hintsUsed` and adds `penaltySeconds`, and PWA hint UI showing the cost. Until then, **hide the hint-penalty field** so lecturers aren't configuring a dead feature.

### Phase 4 — Deliver the plan's missing depth: QR_SCAN + lecturer dashboard (~4–5 days)
16. **QR_SCAN element type** (plan Slices 5–6): none of it exists. New `ElementType`, opaque CSPRNG short-code payload validated server-side, browser scanning (`qr-scanner`, BarcodeDetector-first), print workflow, manual-entry fallback. Senior pairing recommended (plan finding 7).
17. **Lecturer progress dashboard** (plan Slice 4): none exists. `escapeRoomProgress` owner-authorized query + per-participant segmented progress bar, hints/penalty/time columns, polling, and the (now lecturer-only) reset button. `pages/index.tsx` currently only has layout changes, no dashboard.

### Phase 5 — v1 finish
18. Full e2e (§6 #9), UI-facing screenshots (agent-browser, desktop+mobile, de+en) attached to the PR per repo policy.
19. Final security review + `df-mr-description-writer` PR update reflecting the true scope.

### Scope decision to confirm with product owner
The plan's v1 was **PracticeQuiz-only, individual play**, deliberately excluding microlearning/group/live-quiz to control cost. The implementation went the opposite way — all four activity types, no hints/QR/dashboard. **Recommendation:** narrow back to PracticeQuiz (+ optionally microlearning) for v1, delete the group + live-quiz escape paths (removes M1, M8, and a large share of the duplication), and spend the recovered budget on Phases 3–4 depth. This should be an explicit product call before Phase 2's removal steps.

---

## 8. What's done well
- Server-side stack masking for authenticated participants is correct — locked/future stacks are genuinely withheld via `slice(0, firstUnclearedIx+1)`, not just hidden client-side (for the logged-in path).
- Countdown is server-anchored (`startedAt + timeLimit − penalty`), not a naive client timer that resets on render.
- Config upsert/delete lifecycle is consistent and transactional across the three services; edit-flow correctly reconstructs form state from `escapeRoomConfig`.
- Expiry grace period (`+5s`) is applied consistently across all three enforcement sites.
- The `EscapeRoomOverlay` state machine (start/expired/completed/in-progress) is clean and reused across activity types; de/en added for its core strings.
- `completedAt` completion logic is race-safe (fires exactly once on the last correct answer; idempotent update).

---

## 9. How to use this document
Work top-down: **Phase 0 → 1 → 2 gate the merge.** Each numbered step cites the finding and the file:line. Land one fix + its test per commit (conventional commits, scope prefix). Re-request review after Phase 2; Phases 3–5 can be a follow-up PR if the product owner accepts a narrower v1. Do not merge while B1–B6 are open.

---

## 10. Progress — implementation of this roadmap

Scope decision (§ end): product chose **keep all four activity types + fix them**, and **fixes + the missing depth features** (hints, QR_SCAN, lecturer dashboard). So §7's "narrow back" recommendation is NOT taken; M1 (group lockout) and M8 (live-quiz path) are kept, not cut.

### Landed on branch (verified: `tsc` + codegen/build green; integration tests authored for CI)

| Commit | Phase | What |
|--------|-------|------|
| `f0bd5ca48` | 0 | B5 docker-compose port revert; M9 stray CI comment; B6 playwright login sigs; B3 migration unique index |
| `8fd46c88d` | 1 | **B1** anon/non-participant grading bypass closed in `respondToElementStack` + stack masking for non-participants in `getPracticeQuizData`/`getMicroLearningData`; **B2** `resetEscapeRoomAttempt` lecturer-only; **B4** `pruneEscapeRooms` retention window (90d) + `statsAggregatedAt` idempotency marker; **M1** group lockout enforced in `submitGroupActivityDecisions` |
| `7162c3df2` | 2 | **M6** shared `EscapeRoomSettingsFields` + `useEscapeRoomYupFields`; **M4** i18n (10 keys en+de); **M5** order forced Sequential + selector disabled in escape mode; validation bounds (time ≤1440min, penalty ≤3600s) |
| `247a0154c` | 4 | **Lecturer dashboard data layer:** owner-authorized `escapeRoomProgress` query (`escapeRooms.ts` service) — per-participant cleared/total stacks, status, time, penalty, hints, lockout; `EscapeRoomProgress`/`EscapeRoomAttemptProgress` types + op + codegen |
| `d51a545e3` `6c1b0e75a` `8d2fb1a7e` | 1 | **M7** escape-room security regression tests (`packages/graphql/test/escapeRoom.test.ts`) — B1 anon guard + owner bypass, sequential gating, lockout window, expiry, B2 reset auth (lecturer/participant/no-write), completion fires-once, B4 prune retention, `escapeRoomProgress` aggregation; `seedEscapeRoomPracticeQuiz` helper (real `elementData` + `instanceStatistics` so graded submits don't NPE). Live-DB integration → CI-verified |
| `5dc008c11` | 2 | **M2/M3** structured escape error codes surfaced as participant feedback: `stacks.ts` attaches `extensions.code` (NO_ATTEMPT/LOCKOUT/EXPIRED/GATED/FORBIDDEN, LOCKOUT carries `lockoutUntil`); `ElementStack` maps them to localized toasts + a live lockout countdown that disables Submit; `EscapeRoomOverlay` dialogs get `aria-label`/`role=timer` and the participant reset button is replaced by a "contact lecturer" message; `useEscapeRoom` once-guards the expiry refetch; 8 i18n keys en+de. **Browser-verified on a recovered devcontainer stack (en+de): start/expired overlays, lockout toast+countdown, timer a11y** |
| `_this commit_` | 3 | **Phase 3a** time-penalty hints backend. `escapeRoomHint` authored via `ElementInstanceInput` → persisted into instance `options` (`util/elements.ts` Cases 2/3, same slot/behaviour as `resetTimeDays`). **Leak-proof by construction:** the raw string is never declared on any output type — only a derived `hasHint: Boolean!` on `ElementInstanceOptions`; the three participant fragments (`FPracticeQuizDataWithoutSolutions`/`FMicroLearningDataWithoutSolutions`/`QGroupActivityDetails`) select `hasHint`. `requestEscapeRoomHint(activityId, instanceId)` reveals the text exactly once, gated by PARTICIPANT + **exactly-one-activity-ID** + enrollment + owns IN_PROGRESS/non-expired/non-locked attempt + instance-belongs-to-activity; charges `hintPenalty` into `penaltySeconds` and appends to `hintsUsed` via a **single atomic jsonb UPDATE** (`\|\|` append guarded by `NOT @>`, race-free for shared group rows). 6 integration tests. Adversarially reviewed (2 confirmed findings — priority-mismatch hint leak + lost-update race — both fixed); atomic SQL smoke-tested against the live schema |

### Verification environment (browser loop now established)
The **browser loop is available**: a branch-correct `klicker-hlum` devcontainer stack runs on the shared `devnet` behind TLS `devrouter` (`https://{pwa,auth,api}.klicker.localhost`), seeded, with an `EscapeRoomConfig` attached to "Practice Quiz Demo" (Testkurs) for interactive testing. Verify with **`agent-browser --session escaperoom`** (login participant `testuser1`/`abcdabcd`, lecturer `lecturer`/`abcd`). Multi-stack gotcha: on a shared `devnet` the `postgres` alias round-robins across stacks — pin it in the app container's `/etc/hosts`, or keep only one klicker stack up. `tsc` + prettier + lint run **inside the container**; graphql integration tests are live-DB → CI. Per `CLAUDE.md`, browser verification is mandatory before UI work is marked done — now unblocked for every slice below.

### Remaining slices
Frontend + full-stack features, deliberately **not** built blind. Each is code-scoped and ready:
- **M2/M3 — PWA usability (blocking): ✅ DONE (`5dc008c11`, browser-verified en+de).** Submit error handling + `lockoutUntil` retry countdown in `ElementStack.tsx`; participant self-reset removed from `EscapeRoomOverlay` → "contact lecturer" message; once-guard in `useEscapeRoom.ts`; overlay a11y (`role=dialog`/`aria-modal`/`aria-label`, `role=timer`). Note: the `liveQuiz/QuestionArea.tsx` lockout code was **retained** (not deleted) — it is the M8 live-quiz escape path, kept per the §7/§208 scope decision, and shares `escapeRoomIncorrectToast`.
- **Phase 3 — Hints (full feature): 3a backend ✅ DONE (`_this commit_`).** `escapeRoomHint` on `ElementInstanceInput` → instance `options`; content-free `hasHint` boolean is the only output surface (raw text leak-proof by construction); `requestEscapeRoomHint` mutation reveals once after full ownership/activity/single-ID validation, charging `hintPenalty` atomically. **Remaining (require browser loop):** **3b** manage authoring — per-instance hint input in the wizard (`WizardElementList.tsx` row UI + `ElementInstanceFormInput` + `submitPracticeQuizForm.ts` wiring); **3c** PWA request-hint button in `ElementStack` gated on `hasHint`, calling `requestEscapeRoomHint`, showing the penalty cost + returned hint.
- **Phase 4 — Dashboard UI:** consume `escapeRoomProgress` (already shipped) in the manage evaluation views (`pages/{practiceQuiz,microLearning}/[id]/evaluation.tsx`) — segmented per-participant progress bar, hints/penalty/time columns, polling, and the now-lecturer-only reset button.
- **Phase 4 — QR_SCAN element type:** new `ElementType` across the registry (`elementData.ts`/`element.ts` unions, `useElementTypeOptions.ts`, `StudentElement.tsx`, grading dispatch in `stacks.ts` + `response-api/escapeRoom.ts`), opaque CSPRNG code payload, scanning (BarcodeDetector-first) + manual fallback + print workflow. Largest/riskiest — senior pairing.
- **M8 — Live-quiz escape authoring:** the `response-api` validation path exists but has no wizard; add the escape surface to `liveQuiz/*Step.tsx` (kept per scope). Then expose `elementBlockId` in `escapeRoomProgress` (service already handles it).
- **Phase 5:** expand `Z-escape-room.spec.ts` to a ≥3-stack run-through (fix the drag-and-drop stack-builder selectors); agent-browser screenshots (desktop+mobile, de+en) on the PR; final security review; PR description via `rs-mr-description-writer`.
