# Escape Room Quiz Mode — Implementation Review & Roadmap to Production

- **PR:** [#5143](https://github.com/uzh-bf/klicker-uzh/pull/5143) — `feat(quiz): generalized escape room mode and response validation`
- **Execution branch:** `codex/escape-room-production` in `trees/escape-room-production` → target `v3`
- **PR source branch:** `escape-room-quiz-mode-plan`; publication is authorized after the final local gates and target refresh pass.
- **Initial review HEAD:** `82d02d0cd`
- **Initial diff size:** 77 files, +4349 / −179 vs `origin/v3`
- **Initial reviewer:** senior pass (Claude) — 5 parallel review agents (PWA, manage, backend, tests, bots/CI) + manual verification of every blocking finding against the code.
- **Follow-up review:** 2026-07-11 at local HEAD `4cd05b1e7`; local branch 18 commits ahead of PR HEAD `8d2fb1a7`; `v3...HEAD` spans 187 files, +12912 / −1245.
- **Companion doc:** original plan at [project/2026-07-07-pr-5143-escape-room-quiz-mode-plan.md](2026-07-07-pr-5143-escape-room-quiz-mode-plan.md).

---

## 1. Initial verdict at `82d02d0cd`

**The initial branch was not mergeable.** Strong foundational work — the data model, server-side stack masking for logged-in participants, the countdown anchoring, and the config upsert/delete lifecycle were sound. But the reviewed head had **security-integrity holes that defeated the core anti-cheat premise**, a **schema/migration drift**, and a **scope mismatch** vs the agreed plan. It also shipped **three configurable knobs and one whole code path that were unreachable or dead** (hints, live-quiz escape, QR — none existed as usable features). The current verdict and completed execution record are in §11.

The honest framing for the junior: you built escape mode **wide** (all four activity types) instead of **deep** (the plan's PracticeQuiz-only v1 with hints + QR + lecturer dashboard). The width added duplication and dead surface; the depth the plan actually asked for is missing. Roadmap in §7 converges the two.

### Initial severity summary at `82d02d0cd`

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

### Landed on source branch (verified: `tsc` + codegen/build green; integration tests authored for CI)

Commit hashes in this table refer to the original `escape-room-quiz-mode-plan` history. Gate 0 replayed the feature onto `codex/escape-room-production`; `git range-diff` records the replay mapping. New execution slices use clean-branch hashes directly.

| Commit | Phase | What |
|--------|-------|------|
| `f0bd5ca48` | 0 | B5 docker-compose port revert; M9 stray CI comment; B6 playwright login sigs; B3 migration unique index |
| `8fd46c88d` | 1 | **B1 partial:** anon/non-participant guard added in `respondToElementStack` + stack masking for non-participants in `getPracticeQuizData`/`getMicroLearningData`; follow-up review found the client-controlled `isOwner` bypass in B7 below. **B2** `resetEscapeRoomAttempt` lecturer-only; **B4** retention window (90d) + `statsAggregatedAt` marker; follow-up review found statistics corruption in B10. **M1 partial:** group lockout enforced, but empty/partial submissions still complete the room (B8). |
| `7162c3df2` | 2 | **M6** shared `EscapeRoomSettingsFields` + `useEscapeRoomYupFields`; **M4** i18n (10 keys en+de); **M5** order forced Sequential + selector disabled in escape mode; validation bounds (time ≤1440min, penalty ≤3600s) |
| `247a0154c` | 4 | **Lecturer dashboard data layer:** owner-authorized `escapeRoomProgress` query (`escapeRooms.ts` service) — per-participant cleared/total stacks, status, time, penalty, hints, lockout; `EscapeRoomProgress`/`EscapeRoomAttemptProgress` types + op + codegen |
| `d51a545e3` `6c1b0e75a` `8d2fb1a7e` | 1 | **M7 partial:** escape-room integration tests cover the anon guard, sequential gating, lockout, expiry, reset auth, completion, retention, and progress aggregation. The owner-preview test currently blesses an anonymous `isOwner: true` bypass; B7 reverses that expectation. No group empty/partial/foreign-instance tests exist. Live-DB integration was CI-verified at remote HEAD `8d2fb1a7`. |
| `5dc008c11` | 2 | **M2/M3** structured escape error codes surfaced as participant feedback: `stacks.ts` attaches `extensions.code` (NO_ATTEMPT/LOCKOUT/EXPIRED/GATED/FORBIDDEN, LOCKOUT carries `lockoutUntil`); `ElementStack` maps them to localized toasts + a live lockout countdown that disables Submit; `EscapeRoomOverlay` dialogs get `aria-label`/`role=timer` and the participant reset button is replaced by a "contact lecturer" message; `useEscapeRoom` once-guards the expiry refetch; 8 i18n keys en+de. **Browser-verified on a recovered devcontainer stack (en+de): start/expired overlays, lockout toast+countdown, timer a11y** |
| `8da2662f4` | 3 | **Phase 3a partial:** time-penalty hint storage, atomic idempotent charging, enrollment, active-attempt, lockout, expiry, single-activity-ID, and activity-membership checks landed. Follow-up review found no current/unlocked-stack authorization, so an active participant can enumerate numeric instance IDs and reveal future-stage hints (B9). Used hint text also does not survive refresh automatically (M11). |
| `cedfe235d` | 3 | **Phase 3b** manage hint authoring. `escapeRoomHint` on `ElementInstanceFormInput`; `isEscapeRoom` threaded `StackCreationStep` → `StackBlockCreation` → `WizardElementList`, which renders a per-element hint `FormikTextField` (name `stacks.{s}.elements.{e}.escapeRoomHint`, cy `escape-room-hint-stack-{s}-{e}`) only when `isEscapeRoom && type==='stack'`; `submitPracticeQuizForm`/`submitMicrolearningForm` forward the hint (only in escape mode) into each element's `ElementInstanceInput`. i18n key `escapeRoomHintPlaceholder` en+de. **Browser-verified (manage, lecturer):** hint input renders under each stack element in escape mode after adding a content element (en placeholder "Optional hint (costs time when revealed)"); German bundle resolves "Optionaler Hinweis (kostet Zeit bei Anzeige)" |
| `9a907c976` | 3 | **Phase 3c** PWA participant hint reveal. `ElementStack` gains an optional `escapeRoom` prop (`activityType`/`hintPenalty`/`onHintRevealed`), wired at both call sites (`PracticeQuiz.tsx`, `microLearnings/[id]/[ix].tsx`). Per element with `options.hasHint`, a "Reveal hint (−{penalty}s)" button calls `RequestEscapeRoomHint` with the correct activity id + `instanceId`; the returned text replaces the button (kept in local state), a success toast notes the penalty, and `onHintRevealed` refetches so the live countdown drops. Single-flight; structured escape errors reuse `handleEscapeRoomError`. i18n `escapeRoomRequestHint` + `escapeRoomHintRevealedToast` en+de. **Browser-verified (PWA, participant, en+de):** button label shows the cost, click reveals the hint inline, server charges `penaltySeconds` 0→30 + `hintsUsed` `["250"]`, countdown drops |
| `f32b12e6b` | UX | **UX/design polish pass** (browser-verified en+de, all overlay states). Fixed invisible icon circles from nonexistent Tailwind shades (`slate-750`/`red-650`/`green-650` → real 600/900 shades); completion screen now shows escape time, hints used, and time penalty; expired screen shows cleared/total stages; in-progress chip with door icon + stage progress; timer pulses red under 60s (`role=timer` kept); start screen gets a stages/time/penalty stats row; overview page in escape mode swaps the misleading order/repetition rows for a one-attempt info row and hides the localStorage reset button (would desync server attempt state); `numOfStacks` added to `FMicroLearningDataWithoutSolutions`; 7 i18n keys en+de |
| `1d27c4de6` | UX | **Intro story (engagement)** + two found-in-verification bug fixes. `escapeRoomIntroText` arg on all six create/edit mutations → trimmed into `EscapeRoomConfig.introText` (column existed since the original migration but nothing wrote/read it); manage wizards get a markdown textarea (max 5000, yup-validated, cy `escape-room-intro-text`) prefilled on edit; PWA start overlay renders it via `DynamicMarkdown` (cy `escape-room-intro-text-display`), falling back to the generic copy. **Bug 1 (create was broken):** all three services put `escapeRoomConfig: { upsert }` into the shared create/update JSON — Prisma rejects nested `upsert` on the create branch (`Unknown argument 'upsert'`), so creating a NEW escape-room activity via the wizard always failed; create branch now uses a plain nested `create`. **Bug 2 (edit prefill was broken):** `getSinglePracticeQuiz`/`getSingleMicroLearning`/`getGroupActivity` never `include`d `escapeRoomConfig` (the Pothos field is `t.expose`, not a prisma relation), so wizard edit/duplicate showed the escape checkbox unchecked for existing escape rooms; includes added. Browser-verified full chain (manage create → DB row → edit prefill → PWA start screen markdown en+de) |
| `c7879835b` | UX | **Game loop fix (practice quiz, found-in-verification).** The participant answer loop was broken end-to-end: server-side masking means `quiz.stacks` only ever holds cleared stacks + the first uncleared one, so `currentStep === totalSteps` fired on EVERY stack and `onAllStacksCompletion` booted the participant to home after each answer; the per-stack localStorage evaluation lock also made wrong-answer retries impossible. Fix: escape-mode `handleEscapeAdvance` in `PracticeQuiz.tsx` — correct answer → refetch (unmask next stack) + advance; wrong answer → wipe stored evaluation (`qi-{quizId}-{stackId}`) + remount stack via retry nonce; `totalSteps` uses `numOfStacks`; completion stays server-driven (attempt status flips → overlay). `ElementStack` passes the freshly graded status through the immediate flashcard/content continue path where parent progress state isn't settled yet. Browser-verified: wrong stays + resets card, correct advances (chip 0/34→1/34), rapid resubmit inside lockout window shows countdown + disabled submit. **Follow-up gap (deferred):** microlearning escape retry has the same class of problem — URL-ix navigation (`[id]/[ix].tsx`) + `singleSubmission` + `GetPreviousStackEvaluation` conflict with wrong-answer retries; needs its own slice |
| `1a291bff9` | 4 | **Phase 4 Dashboard** lecturer escape-room progress view. New `EscapeRoomProgress.tsx` + an "Escape Room" tab (door icon) in the practice-quiz/microlearning evaluation nav. `ActivityEvaluation` gained an `escapeRoomActivityType?` prop that runs the owner-scoped `GetEscapeRoomProgress` query (`skip` when absent); `escapeRoomAvailable = progress != null` gates the tab (so non-escape activities show nothing), and it polls every 5s only while the tab is active. `ActiveStackType` extended with `'escapeRoom'` (and `useEvaluationInitialization` now imports the shared type instead of an inline union). The table renders per attempt: displayName, colored status pill (In progress/Completed/Expired), cleared/total progress bar, hints, `+mm:ss` penalty, `mm:ss` time spent, a red "Locked out" sub-label, and a two-step per-row **Reset** (lecturer-only, owner-authorized `resetEscapeRoomAttempt` → refetch). i18n `escapeRoom*` keys under `manage.evaluation` en+de. **Browser-verified (manage, lecturer, en+de):** tab appears only for the escape-room quiz; all three status pills + penalty/time/hints/lockout render; confirm-reset deletes the attempt and the row refetches away |

### Verification environment (browser loop established)
The branch-correct DevPod workspace is `codex-escape-room-production`, mounted from `trees/escape-room-production` and routed by devrouter through `https://{api,auth,pwa,manage,control,response-api}.klicker.codex-escape-room-production.localhost`. The app and database use the matching `codex-escape-room-production-app` and `codex-escape-room-production-db` aliases on `devnet`. Run Node, pnpm, Prisma, Playwright, and repository checks inside that container. Browser verification uses isolated `agent-browser` lecturer/student sessions against the same namespaced routes; the Playwright browser receives a matching host-resolver rule. The final 2026-07-19 runtime run used a fresh `devrouter ensure .` proof for the durable workspace owner and verified the mounted worktree before execution; transient container IDs are deliberately not used as identity.

### Initial remaining slices before §11 execution
This was the backlog before the revised plan in §11 was executed:
- **M2/M3 — PWA usability (blocking): ✅ DONE (`5dc008c11`, browser-verified en+de).** Submit error handling + `lockoutUntil` retry countdown in `ElementStack.tsx`; participant self-reset removed from `EscapeRoomOverlay` → "contact lecturer" message; once-guard in `useEscapeRoom.ts`; overlay a11y (`role=dialog`/`aria-modal`/`aria-label`, `role=timer`). Note: the `liveQuiz/QuestionArea.tsx` lockout code was **retained** (not deleted) — it is the M8 live-quiz escape path, kept per the §7/§208 scope decision, and shares `escapeRoomIncorrectToast`.
- **Phase 3 — Hints: PARTIAL.** Practice-quiz/microlearning authoring and reveal work, with atomic charging. Merge blockers remain: future-stack authorization (B9), edit/save round-trip (B11), and refresh-safe revealed text (M11). Group/live hint surfaces remain missing despite the all-four scope decision.
- **Phase 4 — Dashboard UI: PARTIAL (`1a291bff9`, browser-verified manage/lecturer en+de).** Practice-quiz/microlearning attempt rows work. The query omits enrolled participants who have not started, so the planned `NOT_STARTED` state and one-row-per-participant view are absent. Group/live UI remains missing.
- **UX/engagement pass: ✅ DONE (`f32b12e6b` + `1d27c4de6`, browser-verified en+de).** Overlay states polished (stats, progress, urgency pulse), overview de-mislead, and a lecturer-authored markdown **intro story** on the start screen. The verification loop surfaced and fixed two real regressions: escape-room **creation** via wizard was impossible (Prisma nested-upsert-in-create), and **edit/duplicate prefill** silently dropped the escape config (missing `include`). Both now covered by the browser-verified chain; add unit tests for the create path in the playwright/test slice below.
- **Phase 4 — QR_SCAN element type: ✅ IMPLEMENTED through Slice 9.** Canonical schema/contracts, owner authoring, print-time decoys, BarcodeDetector-first scanning, validated manual fallback, and server-side grading now cover all four Escape Room modes. Runtime camera/print proof remains part of Slice 10.
- **M8 — Live-quiz escape authoring:** the `response-api` validation path exists but has no wizard; add the escape surface to `liveQuiz/*Step.tsx` (kept per scope). Then expose `elementBlockId` in `escapeRoomProgress` (service already handles it).
- **Playwright e2e suite: ✅ 19/19 PASS AGAINST THE REAL ROUTED STACK.** The suite covers PracticeQuiz, Microlearning, QR fallback, two simultaneous GroupActivity participants with lecturer monitoring/reset, and LiveQuiz authoring plus participant progression, cockpit monitoring, reset, and reload. Eight current screenshots cover English/German, desktop/mobile, QR print/manual fallback, and separate agent-browser lecturer/student runtime proof. A physical device camera was unavailable; camera denial and the manual fallback are verified, while real-camera scanning remains an explicit release limitation.
- **Wizard edit hint round-trip (found while authoring the e2e suite):** `escapeRoomHint` is never prefetched back into the wizard on edit (no mapping from instance `options.escapeRoomHint` to the form's stack elements), and re-saving rebuilds instance options without it (`packages/util/src/elements.ts` Cases 2/3 only spread the hint when the incoming input has one) — **editing an escape room silently wipes all authored hints**. Fix: prefill the hint into wizard initialValues + decide preserve-vs-clear semantics on resave. The e2e edit test deliberately leaves the wizard without saving to avoid tripping this.
- **apps/docs documentation (release gate): ✅ SYNCHRONIZED.** The lecturer and student tutorials cover all four supported modes, shared GroupActivity attempts, per-block LiveQuiz behavior, hints, monitoring/reset, and the complete QR Scan print/decoy/camera/manual workflow. The Docusaurus production build passes. Its unrelated pre-existing broken link, broken-anchor, CSS-transform, and stale Browserslist warnings remain unchanged. The local static server returned HTTP 200; agent-browser could not leave `about:blank` for this loopback-only preview after multiple isolated proxy/namespace attempts, so the documentation gate uses the successful production build and current feature-runtime screenshots rather than claiming a separate docs browser proof.
- **Process guard: EXCLUDED FROM CLEAN REPLAY.** Commit `0e5e20927` changes global repository policy, not escape-room behavior. Keep it on a separate docs branch/PR. This roadmap still requires Playwright, user docs, wiki, and skill updates before release.
- **Phase 5:** replaced by the revised execution plan in §11. Do not mark the PR ready from the completion labels above.

---

## 11. Follow-up review and revised execution plan: 2026-07-11

### Current verdict

**Release-ready locally; fresh CI remains.** Every roadmap slice and local release gate is complete. The branch is integrated with the latest verified `origin/v3`, and the post-integration security, maintainability, and Klicker branch reviews report no Critical or Important findings. Do not merge until the pushed head passes required CI and the user gives explicit merge approval.

### Execution progress

- **Goal:** active from 2026-07-11; execute this full roadmap through final PR readiness without merging.
- **Current:** Final base synchronization completed locally on 2026-07-26 as merge commit `4bd6f8c4c`. It integrated the sole target delta `c8de9c897` (`chore(prisma-data): add round-parameterized course-award seed (#5191)`) without conflicts; the merge changed only that upstream commit's ten course-award seed, data-wiki, ignore-rule, and plan paths, with no Escape Room behavior path touched. The exact `codex-escape-room-production` DevPod was absent after the session boundary and was rebuilt through `devrouter ensure .`; its owner, ten namespaced routes, Node `v24.16.0`, seeded database, dev servers, and workers are restored. Fresh configured verification passes: repository `check:all` completed 24/24 tasks with Prisma parity, formatting, lint, syncpack, and agent-doc checks; the production build completed 21/21 tasks. A raw package-wide `tsc --noEmit` probe remains red only in historical `prisma-data/src/scripts/*` files that the package does not expose as a configured check; none of the merged seed files appeared in its errors. Independent correctness and simplification reviews of `4bd6f8c4c` both returned `DONE` with no findings; both verified that the upstream and merge deltas share stable patch-id `11faeca2f97673cd2bc0d6f825b12e430b71b802`.
- **Plan review:** independent §11 review completed; accepted changes split authority, group atomicity, hints, timers, dashboards, mode completion, and QR work into smaller gates and moved runtime regression checks forward.
- **Verified baseline:** live fetch set `origin/v3` to `eef745d06`. Exact source patch `ec55eec57^2..ec55eec57` and clean baseline commit `85f7a45e6` share patch-id `f5ca36676f15d205959013ee28f6f0cb21f3f58b` and the same 77 paths. Later feature commits are patch-identical under `git range-diff`. Direct source-vs-clean tree differences are limited to 16 expected upstream/excluded files; feature trees match. Clean branch diff is 102 files, +8771/−535, instead of 187 files; unrelated agent-readiness/CI, analytics implementation, chat, Node/devcontainer, and global AGENTS policy commits are absent. Required analytics Prisma mirrors remain.
- **Gate 0 review:** independent correctness review and simplification review both returned `DONE_WITH_CONCERNS`, with no Critical findings. Accepted: use `origin/v3`, label source hashes, clarify the second-parent delta, and keep global policy out. Deferred: squash checkpoint-only docs history; current commits preserve provenance and add no unrelated tree content.
- **Slice 1a evidence:** TDD red proved anonymous and participant `isOwner: true` spoofing reached grading and the authenticated owner could not preview. The public argument and PWA variable are removed; authority is now derived from the authenticated USER/ADMIN matching the PracticeQuiz or Microlearning owner. Focused integration: 22/22 passed; GraphQL `tsc --noEmit`, generated artifacts, Prettier, and `git diff --check` passed. Independent correctness review found no Critical/Important issues. Its only DB-read concern and the simplification review's duplicate-test concern were resolved before commit.
- **Slice 1b evidence:** TDD red proved empty, partial, duplicate, and foreign sets completed the room and concurrent valid submissions both mutated state. Escape submissions now use a serializable transaction; validate membership, lifecycle, active attempt, exact supported instance set, gradability, and per-type payload domains before writes; and atomically commit results, decisions, expiry/lockout, or completion. Production-shaped selected-only SC/MC/KPRIM payloads (including all-false KPRIM), malformed payload rollback, mid-loop rollback, zero-answerable fail-closed, incorrect transition, expiry-only transition, and one-winner concurrency are covered. Focused integration: 39/39 passed; GraphQL `tsc --noEmit`, Prettier, and `git diff --check` passed. Three correctness review passes resolved every Critical/Important finding; final simplification review returned no material blocker and deferred dispatch deduplication as maintainability debt to avoid regression risk in this security slice.
- **Slice 2a evidence:** TDD red proved future-stack hint enumeration and missing reload restoration. PracticeQuiz and MicroLearning now share current-stack completion and used-hint restoration helpers; CONTENT does not deadlock sequencing; focused authorization selects only required fields; and only the caller-scoped attempt's used instance IDs restore text. Sequential/idempotent and concurrent same-hint charging, future rejection then distinct unlocked charge, active cross-participant privacy, and MicroLearning parity are covered. Full Escape Room integration: 42/42 passed; focused hint tests: 10/10; GraphQL/PWA/Playwright typechecks, generated artifacts, 11-test spec discovery, Prettier, and `git diff --check` passed. Independent correctness re-review returned DONE; simplification findings were resolved with typed/shared helpers. The E2E spec now asserts reveal → reload → restored text. Runtime execution remains pending: container Playwright's CDN installer hangs after download, and host Chrome cannot run the spec's direct-Prisma setup through the devrouter PostgreSQL TLS bridge despite the documented CA/direct-negotiation settings. Application routes and services are live; no code finding remains.
- **Slice 2b evidence:** Owner-only `escapeRoomHints` supplies raw prefill data only for edit mode; participant fragments remain unchanged. Shared patch semantics preserve omitted hints, trim/store non-empty hints, clear blank/null hints, and copy only the intended hint during duplication. Persistent PracticeQuiz and MicroLearning update paths ignore duplicate inputs sharing the same source ID. Full Escape Room integration: 46/46 passed; GraphQL and frontend-manage typechecks and generated artifacts passed. Independent correctness and simplification findings were fixed and both re-reviews returned DONE. Browser edit/save proof remains grouped with the existing Playwright environment gate.
- **Slice 3 evidence:** Microlearning disables regular single-submission restoration in escape mode, propagates the submitted stack status through the shared continue callback, remounts and clears local evaluation state after a wrong answer, stays on the same URL through lockout, refetches and advances only on correct, and redirects stale/reloaded URLs to the first uncleared stack. The Playwright suite now includes create/publish plus wrong, lockout, retry, correct, two reload points, and final completion (13 tests discovered total). PWA and Playwright typechecks pass; independent correctness and simplification reviews returned DONE. Runtime awaits the existing browser infrastructure gate.
- **Slice 4 evidence:** Submission/event paths remain the sole statistics owners; prune no longer fabricates tries from hints/penalties or writes the same completion to every instance. It atomically marks all unprocessed finished attempts and prunes already-processed attempts outside retention. COMPLETED retention uses `completedAt`; EXPIRED retention uses the documented conservative `startedAt` fallback because no terminal timestamp exists. Focused tests cover retention (including long-running/recent completion), repeated-run idempotency/no PracticeQuiz double count, real transaction rejection through a non-mutating Prisma proxy, untouched marker, and safe retry. Full Escape Room integration: 48/48 passed; GraphQL typecheck and Prisma sync checks passed. Both independent review findings were resolved and re-reviews returned DONE.
- **Slice 5a evidence:** `EscapeRoomAttempt.remainingSeconds` is calculated against server time with penalties applied and requested by PracticeQuiz, Microlearning, and GroupActivity operations; separate `expiresInSeconds` includes the shared five-second action grace without displaying extra game time. The participant hook animates both snapshots with `performance.now()`, never the client wall clock, and keys its one expiry refetch to the attempt ID. Answer success/failure, hint reveal, and lockout errors trigger refetch; lockout errors use shared server duration math and animate monotonically. Boundary/penalty/grace helper tests pass; full Escape Room integration: 49/49; GraphQL/PWA/Playwright typechecks, generated artifacts, and 13-test discovery pass. Clock-skew Playwright assertions cover the bounded main timer, material hint-penalty reduction, and lockout. Both independent review findings were resolved and re-reviews returned DONE; runtime awaits the existing browser infrastructure gate.
- **Slice 5b evidence:** PracticeQuiz/Microlearning dashboard progress now merges the full enrolled activity-course roster with attempts, returns `NOT_STARTED` rows with nullable attempt IDs, excludes participants outside the course, and exposes reset only for attempt-backed rows. `isActive` controls leaderboard membership, not Escape Room monitoring. GroupActivity keeps its single shared attempt row. A dedicated GraphQL progress-status enum preserves database attempt status semantics. Focused progress tests: 3/3; full Escape Room integration: 50/50; GraphQL/manage/Playwright typechecks and generated artifacts pass. E2E targets the completed row robustly, asserts not-started visibility, exercises cancel via its new `data-cy`, confirms reset, and keeps the roster table visible. Polling remains scoped to the active dashboard tab.
- **Slice 6a evidence:** GroupActivity authoring now exposes the shared escape settings and per-instance hint fields, owner-only edit readback, patch-preserving edits/clear, and duplicate inheritance. Participants reveal and reload shared hints, receive localized structured lockout/expiry feedback, retain editable responses after wrong answers, and retry after the shared lockout. Distinct concurrent member hints charge atomically; concurrent member starts converge on one attempt, including the driver-adapter P2002 race fallback. Full Escape Room integration: 53/53; GraphQL/manage/PWA/Playwright typechecks and generated persisted-operation artifacts pass; the OKF wiki validates. Correctness and simplification re-reviews returned no actionable findings. Two-session browser concurrency evidence remains grouped with the documented runtime infrastructure gate.
- **Slice 6b evidence:** Published GroupActivities now expose an EXECUTE-scoped monitoring action to the live-capable grading page. Escape-room pages poll shared group progress every five seconds only after configuration is confirmed; ordinary activities do not poll. Reset visibility is derived server-side at WRITE permission, and an authorized reset clears the attempt plus GroupActivity instance, local grading selection/edit state, and refetches both datasets. Unauthorized reset preserves state. Focused progress/reset tests pass; GraphQL/manage/Playwright typechecks and generated artifacts pass. Correctness and simplification re-reviews returned no actionable findings. Live two-session/dashboard browser proof remains behind the documented runtime infrastructure gate.
- **Slice 7a evidence:** LiveQuiz escape blocks now require an explicit attempt from a regular participant, validate live-quiz/block/instance binding, enforce lockout plus the shared five-second action grace, and complete only after every supported answerable instance is cleared. Attempt-scoped Redis state prevents reset inheritance; deterministic response message IDs, producer claims, and a prevalidated atomic worker done marker make retries idempotent across publish and persistence failures. Focused response-api tests: 12/12; worker dedup tests: 7/7; full Escape Room GraphQL integration: 55/55; response-api and worker typechecks pass; the OKF wiki validates. Browser proof remains grouped with Slices 7b/7c behind the documented runtime infrastructure gate.
- **Slice 7b evidence:** LiveQuiz blocks now create/edit/read back Escape Room configuration and owner-only instance hints, reject empty/unsupported element sets on both client and server, and reject assessment-mode combinations. Active participant data includes config, attempt state, safe hint-presence flags, and only previously revealed hint text. The UI requires explicit start, synchronizes reset attempts without clobbering optimistic state, keys local responses to the attempt identity, animates the game clock, enforces lockout across submit/hint controls, requests charged hints, restores them after reload, advances sequentially, and accepts completion only from the server response. GraphQL codegen/build and GraphQL/manage/PWA/Playwright typechecks pass; full Escape Room GraphQL integration: 57/57, including authoring round-trip and invalid-block/assessment regressions. Correctness and simplification re-reviews returned no actionable findings; runtime browser proof stays grouped with Slice 7c behind the documented environment gate.
- **Slice 7c evidence:** The LiveQuiz cockpit loads Escape Room config on its actual cockpit service path, polls progress only for the active escape block, counts supported instances, shows completed status-derived progress, and refetches after reset. Progress requires and binds the authorized `liveQuizId`/`elementBlockId` pair before reading attempts; a cross-quiz mismatch regression closes the mixed-ID leak found in review. Reset visibility is derived from WRITE access while EXECUTE-only users retain monitoring. GraphQL codegen/build, GraphQL/manage/Playwright typechecks, and full Escape Room integration (57/57) pass. Correctness and simplification re-reviews returned no actionable findings. Full LiveQuiz browser proof remains behind the documented environment gate.
- **Slice 8a evidence:** `QR_SCAN` now exists in the canonical and analytics Prisma schemas with a verified migration and nullable unique source-element code. Shared and GraphQL element/data unions recognize the type, while instance snapshotting explicitly strips the code from participant data. URL-safe 12-character codes use 72 bits from Node's CSPRNG; 1,000-code uniqueness/format and participant-token leakage regressions pass. Prisma generation, GraphQL codegen, all 23 monorepo TypeScript checks, and the 48-test util suite pass.
- **Slice 8b evidence:** The lecturer element editor now creates, reopens, previews, edits, and duplicates QR Scan elements through a dedicated mutation. Creation/duplication generate distinct opaque codes, edits preserve the existing code, exact-owner lookup is isolated from participant data, and cross-type mutation IDs fail closed. The focused lifecycle/authorization/schema suite passes, generated persisted operations are current, and GraphQL/manage/shared typechecks pass. Browser proof remains behind the documented environment gate.
- **Slice 8c evidence:** Exact owners can open a dedicated print view that renders the real code with 0–20 request-time CSPRNG decoys. Decoys are unique, distinct from the answer, never persisted, and absent from participant APIs. Printed cards are shuffled and neutrally labeled; the answer legend and controls are screen-only, with print CSS producing a clean grid. Focused print authorization/count/uniqueness tests and manage/GraphQL typechecks pass. Physical print/mobile scan proof remains behind the documented runtime environment gate.
- **Slice 9 evidence:** A shared `QrScanQuestion` uses BarcodeDetector/getUserMedia first and retains a validated 12-character manual field when camera APIs are absent, denied, or fail while scanning. Camera acquisition is single-flight and stale/disabled/unmounted streams are stopped. PracticeQuiz/Microlearning and GroupActivity submit typed QR payloads; LiveQuiz serializes the same value through response-api. Canonical browser-safe normalization/validation/grading helpers keep every path aligned. Exact-code grading, decoys, malformed input, replay, group atomicity, LiveQuiz event publication, sequential gating, exact stack/activity/type binding, and participant answer-token non-disclosure are covered; completed group decisions are redacted before persistence and the QR response is absent from participant output types. QR placement is rejected outside Escape Room activities. Focused GraphQL integration: 61/61; combined QR contracts + Escape Room: 69/69; response-api: 14/14; frontend request serialization: 1/1. All affected package builds/typechecks and the 14-test Playwright discovery pass. The delayed camera-denial/manual-fallback browser case is authored but runtime and real-device camera evidence remain Slice 10 gates.
- **Slice 10a evidence:** LiveQuiz activation subscriptions no longer broadcast escape-room questions; participant queries expose no content before attempt start and only the first uncleared supported instance during an active attempt. The response API and hint service use one shared current-stage helper and supported-type list, rejecting future stages before grading or penalty. Attempt starts require exactly one activity ID, participant data refetches after start/progression, and lecturer progress persists passive expiry while re-reading state to preserve a concurrent completion. The correctness review found and the implementation fixed the expiry race; the simplification review led to the shared stage helper and a consolidated LiveQuiz fixture. Devcontainer checkpoints: GraphQL Escape Room 70/70 and response-api 15/15. Types, GraphQL, response-api, and PWA typechecks pass; generated operations are current.
- **Slice 10b evidence:** commits `046b430ec` and `40a30d554` validate integer/range configuration before database access in all four modes, centralize the five-second grace constant, protect QR print data with schema-level READ permission, remove resolver Prisma fallback reads, atomically increment/expire LiveQuiz try counters, and make test QR fixtures unique per run. Participant state now resets when the LiveQuiz attempt scope changes; dashboard resets await their refetches; initial monitoring failures are visible and retryable; async refetch types and the i18n fallback are explicit; QR decoy input is an integer. The correctness review caught non-atomic Redis expiry, missing query recovery, and inadequate public-seam tests; the simplification review caught the remaining N+1 and the first response-scope test's false claim. All were fixed, and both final re-reviews returned DONE. Devcontainer checkpoints: GraphQL Escape Room 80/80 and response-api 16/16; the hook-level response-scope regression passes. GraphQL codegen is current with no generated diff; all six affected package checks, Prettier, `git diff --check`, Prisma sync, and both full pre-commit `check:all` gates pass.
- **Slice 10c evidence:** the exact `codex-escape-room-production` DevPod/devrouter workspace passed the complete 19-test Escape Room Playwright spec. Runtime proof now includes two concurrent GroupActivity members sharing lockout, completion, reload, lecturer monitoring, and reset; plus LiveQuiz participant start, incorrect answer, lockout, correct completion, cockpit monitoring in German, reset, and SSR reload. The loop exposed and fixed four production defects: response submissions needed the `/AddResponse` route and early CORS setup; GroupActivity data omitted `escapeRoomConfig`; LiveQuiz rendering raced `currentInstance`; and normal PWA SSR neither selected the backend-precedence participant token nor forwarded it as Bearer. The reset operation also omitted `elementBlockId`. Independent correctness review found one loopback-host test matcher, fixed by matching the endpoint path; independent simplification findings were applied. A fresh full rerun passed 19/19 in 1.7 minutes. Playwright captured six English/German desktop/mobile and QR screenshots; separate agent-browser sessions proved delegated lecturer access, participant login, active attempt, cockpit visibility, and attempt persistence after reload, with two additional screenshots and no browser errors. A physical camera was unavailable, so camera-denial/manual-entry fallback is proven while real-camera scanning is recorded as an explicit limitation.
- **Branch-correct runtime checkpoint:** Devrouter 0.0.35 reconciled the durable owner `codex-escape-room-production` to the exact worktree after one empty stale Docker network and one exited duplicate app container were removed with explicit approval; all persistent volumes were preserved. A warm `devrouter ensure . --json` returned `recreated: false`, ten namespaced routes, and one exact mounted container. Inside that DevPod, `/workspaces/klicker-uzh` resolves to SHA `d455b10c2` with Node `v24.16.0` and pnpm `11.5.0`; the app and database expose `codex-escape-room-production-app` / `codex-escape-room-production-db` aliases on `devnet`, and PostgreSQL reports ready.
- **Shared-types boundary checkpoint:** the supported Escape Room element list is typed from the browser-safe `ElementType` union and no longer imports the Prisma runtime enum. Node 24 checks pass for `@klicker-uzh/types`, `@klicker-uzh/response-api`, and `@klicker-uzh/graphql`; the emitted `packages/types/dist/index.js` contains the list with no Prisma runtime import. Independent correctness and simplification reviews approved the change; a focused emitted-JS regression test remains optional follow-up, not a blocker.
- **Hatchet runtime checkpoint:** the exact stack exposed a pre-existing local runner failure: Hatchet SDK 1.9.4's heartbeat listener treats in-process `tsx --watch` and `node --watch` worker-thread protocol messages as logger methods, then crashes both workers. The failed `process.execArgv` and Node-watch approaches were discarded. Both worker apps now follow the existing Rollup-watch plus nodemon-supervised plain-Node pattern, with an initial build preventing fresh-checkout races and no dependency-version drift. Both worker PIDs remained alive beyond repeated four-second heartbeats and through rebuild-triggered restarts; general/response-processor builds and typechecks, frozen offline lock verification, formatting, routed API/auth/PWA/manage/response health, and OKF core validation pass. Independent correctness and simplification reviews approved the change with no blocking findings.
- **Review-cleanup checkpoint:** current review findings are either already fixed by Slices 10a/10b or resolved in the branch: changed imports use configured aliases where every owning tool resolves them; `useEscapeRoom` and `PracticeQuizProps` now require Promise-returning refresh callbacks; the three asynchronous activity modes resolve one consistent `120`-second fallback per component; stale QR camera acquisition relies solely on the monotonic acquisition token; and Playwright calendar month/year selection no longer re-parses locale-dependent output. The Vitest-only helper keeps its relative import because that runner does not resolve the app alias. Manage/PWA/shared-components typechecks, Playwright TypeScript, focused PWA tests, formatting, `git diff --check`, and both app lint suites pass (pre-existing warnings only). Independent correctness and simplification reviews approved the final diff.
- **QR migration checkpoint:** the blocking unique index is removed from the enum/column migration and created concurrently in a later one-statement migration, the supported workaround for the repository's pinned Prisma 6.16.1 execution path. A fresh disposable PostgreSQL database replayed all 179 migrations successfully; `pg_index` reported `Element_qrScanCode_key` as unique and valid. The disposable database was removed. Prisma schema parity, Prisma typecheck, SQL formatting, `git diff --check`, and both independent reviews pass.
- **Slice 10d evidence:** the exact routed workspace completed the expanded Playwright suite at 19/19 in 1.8 minutes, covering PracticeQuiz, Microlearning, QR manual fallback/print, two concurrent GroupActivity participants plus lecturer monitoring/reset, and LiveQuiz participant/cockpit/reset/reload. GraphQL Escape Room tests passed 85/85 before the final test split, the template round-trip passed 6/6 on a reset disposable database, response-api passed 18/18, `check:all` passed, the full production build completed 21/21 tasks, the Docusaurus production build and OKF core validation passed, branch-scoped Opengrep reported zero findings across 179 files, and `git diff --check` passed. The six committed verification screenshots were refreshed from that run.
- **Slice 10e evidence:** generalized lifecycle ownership now lives in `escapeRooms.ts`, with the progress read model separated into `escapeRoomProgress.ts`; all submission paths share target-scoped lifecycle claims and exact response-set checks. Final maintainability review required three structural corrections: GroupActivity and stack Escape Room orchestration now live in focused typed modules, LiveQuiz state/control rendering moved out of `QuestionArea` behind one post-response callback, and reset/template/feature fixtures were split from oversized test files. Final security review found and the implementation closed a late-response path after LiveQuiz block closure by checking cached `blockClosedAt`, authoritative DB active-block state, and both again after acquiring the lifecycle claim. Fresh evidence after these corrections: GraphQL Escape Room 86/86, response-api 20/20, GraphQL/response-api/PWA checks, frontend lint with no new warning, repository-wide `check:all`, and `git diff --check` all pass. The independent Klicker branch crosscheck, final security review, and mandatory thermonuclear review all return APPROVE with no Critical or Important findings.
- **Post-`v3` release evidence (2026-07-19):** the TypeScript 6 target update is integrated without changing Escape Room behavior. `check:all`, the 21-task production build, the Docusaurus production build, Prisma sync, and `git diff --check` pass. GraphQL Escape Room tests pass 86/86 and response-api tests pass 20/20. OKF core validation passes with 20 existing hygiene warnings. Diff-aware Opengrep reports zero findings against `origin/v3`. The exact namespaced stack passes all 19 Escape Room Playwright cases in 2.4 minutes. An initial browser run exposed mixed production/dev `.next` output left by the build; after reversibly moving generated outputs aside and recreating the exact DevPod, the clean run passed. This was a runtime cache collision, not a product-code failure. Post-integration security, thermonuclear maintainability, and Klicker branch crosscheck reviews all approve with no Critical or Important findings. After publication, the response path's post-claim cleared-instance return made a later negated guard provably always true; removing only that wrapper preserves event, Redis, completion, and race behavior and passes both quick re-reviews. CI's formatter-only import correction is published at `4a30012c0`; changed-file formatting and the shared-components check pass. The five remaining local formatter warnings are generated `next-env.d.ts` runtime artifacts outside the branch diff and were not CI findings.
- **Next:** publish the synchronized head and babysit fresh required CI. Stop before merge pending explicit approval.

### Takeover audit — 2026-07-13

- **Live state:** PR #5143 is open, non-draft, mergeable, and blocked only by review approval. All 22 required checks pass at `56b51e18c`; SonarCloud's advisory new-code duplication metric is 4.5% against a 3% target.
- **Branch review:** 165 changed files and about 25k additions / 8.7k deletions, dominated by generated GraphQL artifacts. The worktree is clean except for the untracked session handoff. The PR body is stale at `ec55eec57` and understates the branch scope and remaining gates.
- **Review backlog:** 27 review threads remain unresolved (24 current, 3 outdated). Valid current findings are folded into Slice 10b; obsolete or disproven findings will be resolved with evidence only after the corrections land.
- **P0 specification gap:** LiveQuiz participant queries return every element in the active escape block. Response API grading accepts any bound instance without proving its predecessors are cleared, and LiveQuiz hint requests skip current-stage authorization. A participant can therefore inspect or answer future stages out of order.
- **P1 correctness gaps:** attempt start accepts mixed activity identifiers; passive deadline expiry is not reflected in monitoring until another mutation; response attempt counters lack expiry on the incorrect path; changing LiveQuiz attempt scope can leave stale local response state.
- **Standards gaps:** QR print authorization lacks the schema-layer permission wrapper; PracticeQuiz `isCorrect` performs a resolver-level Prisma read per stack; the prune schedule is absent from the worker wiki; the LiveQuiz grace value is duplicated across packages; one participant fallback bypasses i18n typing.
- **Runtime gap:** CI proves 18 automated browser tests, but GroupActivity uses one participant session and LiveQuiz stops after author/edit. There is no participant/cockpit/reset proof and no screenshot evidence across required locales/viewports.
- **Documentation gap:** `docs/domain-model.md` still describes an active-only roster, and the lecturer tutorial describes only PracticeQuiz/Microlearning instead of all four supported activity modes and QR_SCAN.

### Confirmed findings

| ID | Sev | Finding | Evidence | Required result |
|----|-----|---------|----------|-----------------|
| B7 | P0 | `respondToElementStack` trusts client `isOwner`; anonymous caller can set `true` and bypass attempt, timer, lockout, gating, and tracking while receiving grading feedback. Existing test explicitly permits this. | `schema/mutation.ts:273-285`; `services/stacks.ts:3200-3215,3305-3335`; `test/escapeRoom.test.ts:238-258` | Derive preview/owner permission server-side. Client input must not grant bypass. |
| B8 | P0 | Group escape accepts empty/partial responses; `allCorrect` starts true and checks only supplied entries. Foreign instance IDs are not constrained to the activity before results mutate. | `services/groups.ts:1551-1715` | Validate exact required answerable-instance set, reject missing/duplicate/foreign IDs, and make validation + writes transactional. |
| B9 | P1 | Hint request verifies activity membership but not current/unlocked stack. Numeric instance-ID enumeration can reveal future hints. | `services/practiceQuizzes.ts:1271-1289` | Reuse sequential gating before reading hint text. |
| B10 | P1 | Prune job invents tries from hints/penalties and applies identical counts to every instance even though normal submissions already update `InstanceStatistics`; swallowed partial failures can still mark aggregation complete. | `services/pruneEscapeRooms.ts:79-148`; `services/stacks.ts:247-309` | Define one statistics owner per mode; no double counting or fabricated per-instance data. |
| B11 | P1 | Wizard edit does not prefill hints; save can remove them. Persistent-instance path ignores incoming changes. | `PracticeQuizWizard.tsx:224-242`; `MicroLearningWizard.tsx:241-260`; `util/elements.ts:391-495` | Authorized prefill plus explicit preserve/update/clear semantics. |
| B12 | P1 | Microlearning keeps `singleSubmission` and always advances, so wrong answers cannot follow the promised retry loop. | `microLearnings/[id]/[ix].tsx:164-179`; `ElementStack.tsx:263-281` | Wrong stays on current URL/stack, clears stored evaluation, respects lockout, then retries. |
| M10 | P2 | Countdown derives deadline from participant `Date.now()` instead of server-sent remaining time. | `useEscapeRoom.ts:56-62` | Server-anchored remaining time re-synced after each relevant mutation/refetch. |
| M11 | P2 | Revealed hint text lives only in component state. Reload restores the button, not the revealed hint. | `ElementStack.tsx:101-105,208-230` | Return only already-used hint text to the owning participant; render it after reload without another charge. |
| M12 | P2 | Dashboard loads attempts only, omitting enrolled participants who have not started. | `services/escapeRooms.ts:98-111` | Include `NOT_STARTED` rows from the authorized course roster. |
| M13 | P2 | Branch diff contains unrelated analytics and agent-readiness/CI work. Local HEAD is 18 commits ahead of the PR branch. | `git diff v3...HEAD`: 187 files, +12912/−1245 | Produce a clean escape-room-only review base before publication. |

### Research before implementation

1. **Preview authorization:** map every `respondToElementStack` caller. Decide whether lecturer preview should reuse the participant mutation with server-derived permission or use a separate authenticated preview path.
2. **Statistics ownership:** trace `InstanceStatistics` writes for PracticeQuiz, Microlearning, GroupActivity, and LiveQuiz. Record which path owns unique participants, tries, correctness, and average time before changing prune logic.
3. **Live-quiz policy:** confirm temporary-participant eligibility, explicit-start behavior, enrollment rules, block completion semantics, and 5-second grace behavior. Current response-api path auto-starts and never completes attempts.
4. **Branch cleanup:** identify escape-room commits that are not patch-equivalent to `v3`. Prepare a clean branch/cherry-pick plan. Do not rewrite the remote PR branch without explicit approval.

### Revised slices

**Environment gate for every UI slice:** confirm the branch-correct devcontainer, devrouter routes, delegated logins, Playwright browser executable, and target database before changing UI. Static discovery is not runtime evidence.

#### Gate 0: establish the clean review base

- **Do:** immediately build an escape-room-only commit list from `v3`; classify unrelated analytics/CI commits; create a clean branch/worktree under `trees/` if needed. Move directly to Slice 1a after equivalence checks; do not spend time polishing branch metadata.
- **Check:** `git range-diff`, `git diff --stat v3...<clean-head>`, and feature-file checksums preserve intended escape work.
- **Stop:** no force-push, branch deletion, or worktree removal without explicit approval.
- **Commit:** none unless a new plan/branch metadata commit is needed.

#### Slice 1a: make preview authority server-owned

- **Do:** remove client-granted `isOwner`; derive preview permission from authenticated context and activity permission. Update mutation operations/callers so preview mode cannot be asserted by the client.
- **Tests:** anonymous and participant owner spoof rejected; authenticated authorized preview works; unauthorized lecturer preview rejected; locked-stack grading never runs for rejected callers.
- **Check:** targeted GraphQL integration suite + `@klicker-uzh/graphql` typecheck.
- **Commit:** `fix(escape-room): derive preview authority on server`

#### Slice 1b: make group completion exact and atomic

- **Do:** validate the complete required answerable-instance set before any result write. Reject empty, partial, duplicate, and foreign IDs. Wrap validation, result updates, decision state, lockout, and attempt transition in one transaction.
- **Tests:** every invalid input leaves results, decisions, lockout, and attempt unchanged; valid full response completes once; concurrent group submissions produce one consistent transition.
- **Check:** targeted GraphQL integration suite, then the full GraphQL escape regression file as the security checkpoint.
- **Commit:** `fix(group-activity): validate escape-room submissions atomically`

#### Slice 2a: secure hint access and reload recovery

- **Do:** gate reveal to the current/unlocked stack. Return already-used hints only to the owning participant so revealed text survives reload without another charge. Keep unused raw hints absent from participant payloads.
- **Tests:** future hint rejected; current hint revealed once; reload returns used hint only; cross-participant/activity requests rejected; concurrent requests charge once.
- **Browser:** PracticeQuiz + Microlearning reveal/reload, en+de.
- **Commit:** `fix(escape-room): authorize and restore revealed hints`

#### Slice 2b: make hint authoring round-trip safely

- **Do:** add owner-authorized edit prefill without exposing raw hints through shared participant fields. Define semantics: omitted = preserve, blank/null = clear, non-empty = update. Apply the same rules to persistent, replaced, and duplicated instances.
- **Tests:** unchanged edit preserves; edit updates; explicit clear removes; duplicate copies intended value; unauthorized query cannot read raw hint.
- **Browser:** PracticeQuiz + Microlearning edit/save/reopen, en+de.
- **Commit:** `fix(manage): preserve escape-room hints on edit`

#### Slice 3: repair the Microlearning game loop

- **Do:** add escape-specific advance/retry flow for URL-index navigation; disable `singleSubmission` semantics for escape retries; clear the correct local/evaluation state after wrong answers; keep current stage through lockout; advance only on correct.
- **Tests:** focused Playwright microlearning flow with wrong, lockout, retry, correct, reload, and final completion.
- **Browser:** delegated participant, desktop + mobile, en+de.
- **Commit:** `fix(microlearning): support escape-room retries`

#### Slice 4: repair statistics ownership

- **Do:** use research result to remove double counting. Prefer event-time submission statistics where already authoritative. Aggregate only metrics unavailable elsewhere. Make aggregation atomic or retry-safe; never mark a partially failed attempt complete.
- **Tests:** repeated prune is idempotent; partial failure retries safely; PracticeQuiz submissions are not counted twice; Group/Live behavior matches documented owner.
- **Check:** GraphQL tests + Prisma/schema checks if data shape changes.
- **Commit:** `fix(escape-room): prevent duplicate attempt statistics`

#### Slice 5a: server-anchor participant time

- **Do:** expose server-calculated remaining seconds or server timestamp; re-sync after start, answer, hint, lockout, and refetch. Keep server expiry authoritative.
- **Tests:** skewed client clock does not change displayed/server status; latency/grace boundary; penalty and lockout re-sync.
- **Browser:** timer under clock skew, desktop + mobile, en+de.
- **Commit:** `fix(escape-room): anchor countdown to server time`

#### Slice 5b: complete the participant dashboard roster

- **Do:** build rows from the authorized course roster plus attempts; add `NOT_STARTED`; add the missing cancel `data-cy`; replace `activity: any` with generated types.
- **Tests:** not-started/in-progress/completed/expired rows; polling; reset permissions; users outside the course absent.
- **Browser:** all dashboard states, desktop + mobile, en+de.
- **Commit:** `fix(manage): include all escape-room participants`

#### Slice 6a: add GroupActivity authoring and participant features

- **Do:** thread escape state into group stack authoring; add hint authoring/reveal; surface structured lockout/expiry errors; reuse server contracts from Slices 1b and 2.
- **Tests:** two members share one attempt; concurrent distinct hints charge once each; wrong answers preserve retry state.
- **Browser:** lecturer authoring + two live participant sessions, en+de. Record concurrency evidence, not only automated tests.
- **Commit:** `feat(group-activity): add escape-room participant flow`

#### Slice 6b: add GroupActivity dashboard and runtime gate

- **Do:** add group progress/reset UI and polling; show shared attempt identity and state consistently for every member.
- **Tests:** reset clears intended group state; polling observes live progress; unauthorized lecturer blocked.
- **Check:** full GraphQL escape regression file + GroupActivity Playwright/runtime flow before claiming mode support.
- **Browser:** lecturer dashboard plus two concurrent participant sessions, en+de.
- **Commit:** `feat(group-activity): add escape-room monitoring`

#### Slice 7a: finish the LiveQuiz server contract

- **Do:** enforce confirmed participant policy and explicit-start semantics in response-api; add 5-second grace; mark the block attempt completed; validate instance/block binding; remove dead server branches.
- **Tests:** temporary/regular participant policy, no-attempt rejection, expiry/grace, lockout, completion, and binding.
- **Check:** response-api tests + GraphQL tests for start/reset contracts.
- **Commit:** `fix(live-quiz): enforce escape-room attempts`

#### Slice 7b: add LiveQuiz authoring and participant runtime

- **Do:** add wizard block configuration and participant/cockpit UI using the server contract from Slice 7a.
- **Tests:** create/edit/publish config round-trip and participant completion flow.
- **Browser:** lecturer cockpit + participant, desktop + mobile, en+de.
- **Commit:** `feat(live-quiz): add escape-room workflow`

#### Slice 7c: add LiveQuiz dashboard and reset

- **Do:** expose authorized `elementBlockId` progress/reset and add monitoring UI.
- **Tests:** progress, polling, reset, and unauthorized access.
- **Check:** full LiveQuiz Playwright/runtime flow before claiming mode support.
- **Commit:** `feat(live-quiz): add escape-room monitoring`

#### Slice 8a: add QR_SCAN schema and type contracts

- **Do:** add Prisma enum/model fields, migration, generated client, shared types, GraphQL unions/inputs, registry entries, and CSPRNG opaque short-code generation. Audit every exhaustive `ElementType` consumer.
- **Tests:** migration/schema parity, token uniqueness/format, enum compatibility, no participant token leakage.
- **Check:** `prisma:sync`, client generation, GraphQL codegen, package typechecks, targeted builds. Slice 9 cannot start until this gate is green.
- **Commit:** `feat(elements): add QR scan contracts`

#### Slice 8b: add QR_SCAN authoring

- **Do:** add manage editor and owner-authorized code lifecycle. Keep participant payload content-free.
- **Tests:** create/edit/duplicate authorization and payload stripping.
- **Browser:** author/reopen/duplicate, en+de.
- **Commit:** `feat(manage): add QR scan authoring`

#### Slice 8c: add QR print and decoy workflow

- **Do:** add authorized print view, real code placement, decoy generation at print time, and print CSS. Never persist or expose decoys through participant APIs.
- **Tests:** print authorization, decoy uniqueness, real/decoy separation, no token leakage.
- **Browser:** print preview and physical/mobile scan smoke test.
- **Commit:** `feat(manage): add QR escape-room print sheets`

#### Slice 9: QR_SCAN answering and grading

- **Do:** implement BarcodeDetector-first scanner with chosen fallback, manual entry, shared question renderer, grading, sequential gating, and unsupported-activity validation.
- **Tests:** correct, decoy, malformed, replay, camera denied, manual fallback, locked-stack payload leak.
- **Browser:** laptop + real mobile camera when available; manual fallback mandatory.
- **Commit:** `feat(pwa): add QR scan escape-room answers`

#### Slice 10a: close takeover security and contract gaps

- **Do:** mask locked LiveQuiz stages in participant data; enforce the current unlocked stage in response-api grading and LiveQuiz hint requests; refetch participant data after start and successful progression; reject attempt starts with anything other than exactly one activity identifier; and make progress derive/persist passive expiry safely.
- **Tests:** no LiveQuiz element content before start; only cleared/current content after start; future answer and future hint rejected before grading/charging; current stage accepted; mixed activity identifiers rejected without persistence; elapsed attempts appear expired in monitoring without a participant mutation.
- **Check:** focused response-api and GraphQL integration suites, generated operations, GraphQL/PWA typechecks, then the complete Escape Room regression file.
- **Stop:** any further P0/P1 security finding keeps runtime expansion blocked.
- **Commit:** `fix(escape-room): enforce live quiz stage order`

#### Slice 10b: close validated review findings

- **Do:** expire incorrect-response Redis attempt counters; reset LiveQuiz local response state when attempt scope changes; validate integer QR decoy counts; await dashboard resets; correct async refetch types; surface initial evaluation-query errors; use repository aliases/i18n keys in changed files; add schema-layer QR print authorization; eliminate the accepted resolver-level N+1; centralize the shared grace constant outside `packages/hatchet`; and document the prune schedule. Add server-side numeric Escape Room configuration validation across every mode.
- **Tests:** focused regressions for every behavior change, including direct GraphQL invalid settings and response-scope switching. Reject invalid/YAGNI review suggestions with evidence rather than implementation.
- **Check:** affected package tests/typechecks, GraphQL generation/build, Prettier, and `git diff --check`.
- **Commit:** one or more narrowly scoped `fix(...)` commits, keeping policy/docs-only changes separate where useful.

#### Slice 10c: complete real runtime and evidence

- **Do:** extend Playwright/runtime coverage across two concurrent GroupActivity participants and the lecturer dashboard, plus LiveQuiz participant progression, cockpit monitoring, reset, and reload. Run the full 18-test baseline plus new cases against the real host browser stack. Capture English/German desktop/mobile screenshots and QR print/manual-fallback evidence; record any real-camera limitation explicitly.
- **Check:** browser-visible state, not only assertions; screenshots correspond to the current PR head and real routed stack.
- **Commit:** `test(escape-room): verify complete workflow`

#### Slice 10d: full release gate and publication sync

- **Do:** synchronize the progress plan, engineering wiki, lecturer/student tutorials, generated artifacts, and PR body with the actual final scope and evidence. Resolve review threads only with current code evidence.
- **Check:** `check:all`, targeted builds/tests, Prisma parity, `opengrep scan --config auto`, runtime Playwright, browser screenshots, and clean `git diff --check`.
- **Review:** per-slice correctness/simplification; final `security-review`; final `thermo-nuclear-code-quality-review`; independent Klicker branch crosscheck. Resolve findings or record explicit, evidence-backed deferrals.
- **PR:** push only after every required gate is green. Rewrite the complete branch body with `rs-mr-description-writer` and read it back from GitHub. Never merge without explicit user approval.
- **Commit:** `docs(project): finalize escape-room rollout` after all evidence is current.

#### Slice 10e: resolve final release-review blockers

- **Do:** move generalized attempt, hint, and atomic reset ownership into the canonical Escape Room service; split its progress read model at the natural boundary; serialize GraphQL and LiveQuiz submissions with an atomic per-attempt/stage claim and recheck lifecycle state after acquiring it; preserve Escape Room configuration, hints, and QR Scan elements through LiveQuiz templates; align hint-edit, reset, and QR-print controls with their actual WRITE/OWNER permissions; split the oversized GraphQL and Playwright regression modules without changing behavior; extract Escape Room submission policy from generic group/stack services and LiveQuiz state from `QuestionArea`; and reject LiveQuiz responses once the block is no longer authoritatively active.
- **Tests:** concurrent correct/incorrect submissions allow exactly one grading mutation in both GraphQL and response-api; reset remains typed, idempotent, and transactional; template round-trip retains config/hints/QR; permission mismatches have focused coverage where practical; every mechanically split regression is still discovered and passes.
- **Check:** affected package typechecks/tests and generated operations first; then repeat fresh `check:all`, build, Prisma parity, branch-scoped Opengrep, routed browser suite, security review, branch crosscheck, and thermonuclear maintainability review.
- **Stop:** any failed claim-state recheck, template round-trip, permission regression, lost test, or final-review finding keeps the PR unpublished.
- **Commit:** `fix(escape-room): close final release blockers`, followed by structural test/docs commits when independently green.

### Dependencies and stop conditions

- Gate 0 establishes the clean base immediately; Slice 1a is the first implementation gate.
- Slices 1a and 1b before every participant-facing feature slice. Run the full GraphQL escape regression checkpoint after both.
- Slices 2a and 2b before calling hints complete or extending hint E2E.
- Slice 3 before calling Microlearning supported.
- Slice 4 before accepting analytics output. Run the broader statistics/GraphQL regression checkpoint immediately after it.
- Slice 5a before timer completion claims; Slice 5b before dashboard completion claims.
- Slices 6a and 6b before calling GroupActivity supported. Live two-session evidence is mandatory.
- Slices 7a, 7b, and 7c before calling LiveQuiz supported. Run its full runtime flow after 7b and 7c.
- Slices 8a, 8b, 8c, and 9 stay separate. Schema/client/codegen compatibility must pass after 8a; QR scope must not be batched into another slice.
- Slice 10a is now a blocking correction to the earlier LiveQuiz slices. Slice 10b follows only after its security regressions pass. Runtime evidence in Slice 10c, publication preparation in Slice 10d, and the final-review corrections in Slice 10e remain ordered final gates.
- Any new P0/P1 security finding stops feature expansion until fixed and regression-tested.

### Next action

Verify, commit, and push the Microlearning Playwright navigation correction, then babysit required CI. Stop before merge pending explicit approval.
