# Review — PR #5141: Export Student Assessment Report with Verifiable Credentials

- **PR**: https://github.com/uzh-bf/klicker-uzh/pull/5141
- **Branch**: `export-assessment-performance-insights` → `v3`
- **Reviewed**: 2026-07-07 (full branch diff `v3...HEAD`, all 32 files)
- **Verdict**: **Not production-ready.** Good feature direction and a clean schema/UI skeleton, but the core trust model is broken (credentials are forgeable), and both verification claims in the PR description are false: the shipped unit test **fails when actually run**, and the shipped E2E test **cannot pass** against the seeded database. Concrete evidence and a step-by-step fix plan below.

This document is written so a junior engineer can execute it top-to-bottom. Each finding has evidence (file:line) and a "Fix" with acceptance criteria. Work through the Blockers in order; they are sequenced so later fixes build on earlier ones.

---

## 1. What was verified and how (evidence log)

All commands were run on a clean checkout of the PR branch with the repo-pinned toolchain (`pnpm@11.5.0`, see `package.json` → `packageManager`).

| Check | Command | Result |
| --- | --- | --- |
| Lockfile integrity | `CI=true pnpm install --frozen-lockfile` | ✅ passes, lockfile in sync with `pnpm-workspace.yaml` overrides |
| Monorepo build | `CI=true pnpm run build` | ✅ 22/22 tasks succeed |
| Typecheck | `CI=true pnpm run check` | ✅ 22/22 tasks, 0 TS errors |
| GraphQL codegen freshness | `pnpm --filter @klicker-uzh/graphql generate` then `git status` | ✅ no diff — committed `ops.ts`, `ops.schema.json`, `client.json`, `server.json` are in sync |
| New unit tests | `vitest run test/verification.test.ts` against a fresh Postgres 16 with `prisma db push` | ❌ **1 of 4 tests fails** (details in §2.3) |
| New E2E test | static analysis against seed data | ❌ **cannot pass** (details in §2.4) |

Unit test failure output (verbatim):

```
✓ correctly issues a new verifiable credential
✓ resolves a valid credential by token
× does not resolve a revoked credential
  → expected { …(10) } to be null
✓ retrieves all credentials for a course
Tests  1 failed | 3 passed (4)
```

**Conclusion from the evidence log**: the PR description's verification section ("Run E2E tests…", "Added and verified comprehensive Vitest unit tests" in the plan's progress log) does not reflect reality. Neither test suite was run successfully before commit. Independent of any individual bug, this means **every behavioral claim in this PR must be re-verified manually** during the fix pass.

---

## 2. Blockers (must fix before merge)

### 2.1 Credentials are forgeable — client-supplied `metadata` is stored and served as verified truth

**Severity: critical (defeats the entire purpose of the feature).**

- `issueCredential` mutation accepts `metadata: Json!` from the client and stores it verbatim: [packages/graphql/src/schema/verification.ts:87-108](../packages/graphql/src/schema/verification.ts), [packages/graphql/src/services/verification.ts:4-28](../packages/graphql/src/services/verification.ts).
- The client computes all scores locally and sends them: `handleExport` in [SuspendedAssessmentResults.tsx](../apps/frontend-pwa/src/components/insights/assessmentResults/SuspendedAssessmentResults.tsx) (the `metadata: { …aggregated points… }` object).
- The public verify portal renders `credential.metadata.*` as officially verified data: [apps/frontend-pwa/src/pages/verify/[token].tsx:276-452](../apps/frontend-pwa/src/pages/verify/%5Btoken%5D.tsx).
- Production's persisted-operations allow-list does **not** prevent this: `usePersistedOperations` only pins the operation *document*, not the variables ([apps/backend-docker/src/app.ts:149-156](../apps/backend-docker/src/app.ts)). A student replays the persisted `MIssueCredential` hash with inflated numbers in the `metadata` variable and gets a green "Verifiziert" page for fabricated scores. The plan's tamper-proofing claim ("Any modification of the printed HTML/PDF values by the student is detected") is exactly inverted: the database itself contains attacker-chosen values.

**Fix (architectural, do this first — several later fixes fall out of it):**

1. Remove the `metadata` argument from the `issueCredential` mutation entirely. Signature becomes `issueCredential(courseId, type)`.
2. In the resolver, compute the snapshot **server-side**: call `CourseService.getStudentAssessmentResults({ courseId, participantId: ctx.user.sub }, ctx)` and build the metadata object (points aggregate, percentile, histogram, participantEmail, courseName) from its return value — the same aggregation currently done client-side moves into the service.
3. Update `MIssueCredential.graphql`, run `pnpm --filter @klicker-uzh/graphql generate`, and strip the metadata assembly from `handleExport` in `SuspendedAssessmentResults.tsx` (the component keeps its local aggregation only for on-screen display and the HTML file).
4. Add a unit test: issue a credential via the resolver path and assert the stored metadata matches what `getStudentAssessmentResults` returns for that participant — not what any client sent.

**Acceptance criteria**: `MIssueCredential` has no client-controlled payload; the verify page shows only server-computed values; test from step 4 passes.

### 2.2 No authorization or enrollment checks on `issueCredential`

**Severity: critical.** Confirmed by adversarial re-verification.

- The resolver only checks `if (!ctx.user)` ([verification.ts:95-99](../packages/graphql/src/schema/verification.ts)). Problems:
  - Any authenticated principal passes — including **lecturer** JWTs, whose `sub` is a `User` id, not a `Participant` id. The FK insert then fails with a raw Prisma P2003 → unhandled 500.
  - No check that the participant is **enrolled** in `courseId`, and no check that the course has `isAssessmentEnabled: true`. Any participant can mint credentials for any course UUID they discover.
  - The codebase has established guards for exactly this: `t.withAuth(asParticipant)` (see `studentAssessmentResults` in [packages/graphql/src/schema/query.ts:914-925](../packages/graphql/src/schema/query.ts)) — the new resolvers hand-roll `if (!ctx.user)` instead.

**Fix:**

1. Declare the mutation as `t.withAuth(asParticipant).field(…)`; same for the lecturer-side query/mutation with the appropriate scope (`asUser` + the existing `checkAccess`/`withPermission` course check is fine there and already present).
2. Inside the resolver, verify an active `Participation` exists for `(ctx.user.sub, courseId)` and that the course has `isAssessmentEnabled: true`; throw a GraphQL error otherwise. Note: after fix 2.1 this comes almost for free — `getStudentAssessmentResults` already returns null/empty for non-enabled courses ([courses.ts:630](../packages/graphql/src/services/courses.ts)); treat that as "refuse to issue".

**Acceptance criteria**: lecturer JWT → clean auth error, not 500; participant not enrolled → auth error; course without assessment → error. Add one unit test per case.

### 2.3 Shipped unit test fails; its expectation is also wrong for the product

**Severity: critical (broken CI the moment these tests run; false safety net for revocation).**

- `does not resolve a revoked credential` ([packages/graphql/test/verification.test.ts:130-147](../packages/graphql/test/verification.test.ts)) expects `getCredentialByToken` → `null` after revocation. The service does no `isRevoked` filtering ([services/verification.ts:30-45](../packages/graphql/src/services/verification.ts)) and returns the row — **test fails** (verified live, output in §1).
- Do **not** "fix" this by filtering in the service: the verify page and the PR's own Playwright test *require* the revoked row to be returned so the red "Widerrufen / Revoked" banner can render ([verify/[token].tsx:163-192](../apps/frontend-pwa/src/pages/verify/%5Btoken%5D.tsx)).

**Fix**: change the test to assert `resolved !== null && resolved.isRevoked === true`. Then decide explicitly (and encode in a test) what a revoked credential exposes publicly — see §3.1.

**Acceptance criteria**: `pnpm --filter @klicker-uzh/graphql test verification.test.ts` green against a live DB (use `packages/graphql/test/run-tests-local.sh`).

### 2.4 Shipped E2E test cannot pass — wrong course, nonexistent UI string

**Severity: critical (the "verified E2E flow" never ran).** Two independent, fatal blockers found by seed-data analysis:

1. The test targets `COURSE_ID_TEST` ("Testkurs"), which is seeded with `isAssessmentEnabled: false` ([packages/prisma-data/src/data/seedTEST.ts:257](../packages/prisma-data/src/data/seedTEST.ts)). The assessment results tab is only rendered when `course.isAssessmentEnabled` ([apps/frontend-pwa/src/pages/course/[courseId]/index.tsx:242-251](../apps/frontend-pwa/src/pages/course/%5BcourseId%5D/index.tsx)), and the backend also gates on it. The seeded assessment-enabled courses are `COURSE_ID_TEST4` (aka `COURSE_ID_ASSESSMENT`, seedTEST.ts:313-333) and `COURSE_ID_TEST5`.
2. The test clicks `text=Leistungsübersicht` ([playwright/tests/Z-credential-verification.spec.ts:26](../playwright/tests/Z-credential-verification.spec.ts)) — that string exists **nowhere** in the codebase. The actual tab label (i18n key `pwa.courses.assessmentResults`) is "Assessment Resultate" / "Assessment Results".

So test 1 times out at its first assertion, and tests 2–4 depend on the token captured in test 1 → the whole file fails. (What *is* fine: `fullyParallel: false` + 1 worker makes the shared `verificationToken` module variable safe, and the token regex matches the 64-char hex format.)

**Fix:**

1. Retarget the test at the assessment-enabled seeded course; verify that course has a student with results (check the seed's live-quiz responses; if the cohort is < 5 participants with results, assert the "not enough data" branch instead of the percentile, or extend the seed).
2. Replace text-based selectors with `data-cy` attributes (repo convention; `testIdAttribute` is already `data-cy` in `playwright/playwright.config.ts:41`). Add `data-cy` to the tab trigger if missing.
3. Run the suite for real: `pnpm run dev:test` stack + `pnpm --filter @klicker-uzh/playwright exec playwright test Z-credential-verification.spec.ts`. Paste the passing output into the PR.

**Acceptance criteria**: green run of the spec locally, output attached to PR. Per repo rules (CLAUDE.md → agent-browser), also capture before/after screenshots of: student export section, downloaded HTML report, verify page (valid + revoked), lecturer modal — and attach them to the PR description.

### 2.5 Verify portal shows no student identity — verification is not actually possible

**Severity: critical (product gap, not just polish).**

The portal renders course, type, issue date, token, and scores — but never who the credential belongs to ([verify/[token].tsx:226-268](../apps/frontend-pwa/src/pages/verify/%5Btoken%5D.tsx); `metadata.studentEmail` exists but is never displayed). An employer holding a printed report cannot bind it to the applicant: a student can hand-edit the name/email in the downloaded HTML (it's plain text), and the QR still resolves to a green "Verified" page with matching scores. Combined with 2.1 this makes the verification theater; even after 2.1 it remains a real hole.

**Fix**: display the credential subject (at minimum the same email shown in the report; sourced server-side per 2.1) prominently on the verify page, in the same block as the status banner. Update the report footer text to instruct verifiers: "compare name/email and scores against the verification page."

**Acceptance criteria**: verify page shows subject identity; exported report and portal show identical identity + scores from the same server snapshot.

### 2.6 Revocation is silently defeated by re-export

**Severity: high → blocker in combination with the feature's purpose.**

`verificationToken` lives only in component state; after a reload, every export click mints a **new active credential** ([SuspendedAssessmentResults.tsx:168-207](../apps/frontend-pwa/src/components/insights/assessmentResults/SuspendedAssessmentResults.tsx)). A student whose credential a lecturer revoked simply re-exports and gets a fresh valid token — no signal to anyone. Side effects: unbounded row growth, duplicate rows cluttering the lecturer modal, no rate limiting.

**Fix** (server-side, in the `issueCredential` resolver):

1. Make issuance idempotent: if an active (non-revoked) credential of the same `(participantId, courseId, type)` exists, return it instead of creating a new row. Consider a partial unique index or `@@unique([participantId, courseId, type])` with revoked rows excluded via an application-level check.
2. Decide the revocation policy explicitly with the product owner: does revoke mean "this student may not export anymore" (then block re-issuance while a revoked credential exists and surface a message to the student) or "this snapshot was invalid" (then allow re-issue and show issue count/history to the lecturer)? Document the decision in this file's follow-up section.

**Acceptance criteria**: repeated export clicks/session reloads reuse one credential; behavior after revocation matches the documented policy; unit test covers both.

### 2.7 Heavy whole-course recomputation on every student page view

**Severity: high (production performance, medical-faculty scale).**

`getStudentAssessmentResults` now calls `calculateCourseScoresInternal`, which loads **all** ended live quizzes with all blocks/elements/responses **and all participations** of the course ([courses.ts:679-742 and 940-1010](../packages/graphql/src/services/courses.ts)) — on every render of the student results page, with `fetchPolicy: 'network-only'` on the client. For a cohort of several hundred students this is an expensive query storm (every student's page view recomputes every student's score).

**Fix options (pick one, discuss in PR):**

- **Cheapest**: compute percentile/histogram only at issuance time (inside the fixed `issueCredential` from 2.1), and drop them from the per-view `studentAssessmentResults` query; show them on the page only after export, or behind an explicit "compute my comparison" action.
- **Better UX-preserving**: cache the cohort score distribution in Redis keyed by courseId with a short TTL (the repo already uses ioredis; invalidate on point corrections), so per-view cost is one cache read.

**Acceptance criteria**: student results page issues no query that scales with cohort size on every view (verify via Prisma query logs), or the cached path is demonstrably hit.

---

## 3. High-priority issues (fix before or immediately after merge)

### 3.1 Public data exposure and lifecycle gaps

- **Revoked credentials still expose full metadata** publicly (query returns the row; the page renders the red banner but the API serves scores + email to anyone with the token). Decide and enforce: after revocation, return only `{ isRevoked, issuedAt, course }` — strip metadata in the resolver.
- **`expiresAt` is dead**: never set, never checked ([schema/verification.ts](../packages/graphql/src/schema/verification.ts), [verify/[token].tsx](../apps/frontend-pwa/src/pages/verify/%5Btoken%5D.tsx)). Either implement expiry (set on issue + filter/flag on verify) or remove the column until needed.
- **Cohort histogram is republished publicly forever** in credential metadata — aggregate data about *other* students served unauthenticated to link holders. Combined with the privacy notice ([en.ts ~1134](../packages/i18n/messages/en.ts)) claiming "No individual scores … are transmitted or displayed", the notice is **factually false** (the histogram *is* transmitted and displayed publicly; with small cohorts, bins of count 1 reveal an individual's score range). Fix the wording, and consider suppressing bins with count < k or raising the `hasEnoughData` threshold for the *public* page specifically.
- **Metadata size unbounded** (until 2.1 lands): server accepts arbitrarily large JSON. Fixed automatically by 2.1.
- **Lecturer modal displays raw bearer tokens** for all students ([CourseVerifiableCredentialsModal.tsx:100-102](../apps/frontend-manage/src/components/courses/CourseVerifiableCredentialsModal.tsx)). Lecturers already see scores, so impact is moderate, but there's no need to show the full secret — show a truncated token (first 8 chars) plus a copy-link action.

### 3.2 False "digitally signed" claims

Report footer and verify page claim the document is "digital signiert / digitally signed" and data comes from "manipulationssicheren Datenbanken" ([exportReport.ts:398-400](../apps/frontend-pwa/src/components/insights/assessmentResults/exportReport.ts), [verify/[token].tsx:214-221,458-465](../apps/frontend-pwa/src/pages/verify/%5Btoken%5D.tsx)). There is no cryptographic signature anywhere — this is a DB lookup. For a document aimed at employers on behalf of the university, overclaiming security properties is a legal/reputational risk. **Fix**: reword to "can be verified against the live KlickerUZH database via the link/QR code". (Actual signing — e.g. W3C VC — is explicitly out of scope per the plan; the wording must match what's built.)

### 3.3 Crash-hardening of the public page

`formatNum(credential.metadata.basePoints)` etc. are called unguarded; malformed metadata (possible today via 2.1; still possible later via old rows) throws `val.toFixed is not a function` → white page ([verify/[token].tsx:281-324, 350-450](../apps/frontend-pwa/src/pages/verify/%5Btoken%5D.tsx)). **Fix**: parse `metadata` through a zod schema (the repo has zod available) and render a graceful "data unavailable" state on mismatch. Also fixes the `histogram.map` on arbitrary JSON.

### 3.4 HTML injection in the exported report

`exportReport.ts` interpolates `courseName`, `studentEmail`, and i18n texts into an HTML string without escaping ([exportReport.ts:85-415](../apps/frontend-pwa/src/components/insights/assessmentResults/exportReport.ts)). Course names are lecturer-controlled → a malicious/compromised lecturer account can inject markup/script into files students download and open locally. **Fix**: add a tiny `escapeHtml()` for every interpolated value (5 entities), and keep the SVG generator numeric-only.

---

## 4. Quality and UX issues (ordered, with fixes)

1. **i18n bypassed everywhere in new UI**: verify page, manage modal, results.tsx button ("Zertifikate / Credentials"), and revoke confirm are hardcoded bilingual DE/EN strings — while the codebase (and this PR's own PWA section) uses `next-intl` keys. Move all strings to `packages/i18n/messages/{de,en}.ts`. The bilingual-on-one-page style also reads cluttered for employers; pick locale via the existing routing (`getServerSideProps` already loads messages — currently unused).
2. **Export texts fetched without ICU params**: `t('pwa.assessment.percentileText')`, `ofAvailable`, `excludingBonus` are fetched param-less then `.replace('{value}', …)` ([SuspendedAssessmentResults.tsx runDownload](../apps/frontend-pwa/src/components/insights/assessmentResults/SuspendedAssessmentResults.tsx)). Verified working (next-intl falls back to the raw message) but it logs `IntlError`s on every export and breaks if fallback behavior changes. Pass real values to `t()` and drop the `.replace` layer. Also remove dead `|| 'Kurs'`-style fallbacks (`t()` never returns falsy) and the German literals in them.
3. **Silent failures**: issue-credential and revoke errors go to `console.error` only ([SuspendedAssessmentResults.tsx:200-205](../apps/frontend-pwa/src/components/insights/assessmentResults/SuspendedAssessmentResults.tsx), [CourseVerifiableCredentialsModal.tsx:44-46](../apps/frontend-manage/src/components/courses/CourseVerifiableCredentialsModal.tsx)). Show a `UserNotification`/toast; on export failure the button just stops spinning with zero explanation.
4. **QR race**: hidden canvas + `setTimeout(100)` ([SuspendedAssessmentResults.tsx:158-166, 400-413](../apps/frontend-pwa/src/components/insights/assessmentResults/SuspendedAssessmentResults.tsx)) — on slow devices the canvas isn't painted and the report silently ships **without** the verification footer. Replace with a direct data-URL QR generation (e.g. `qrcode` package `toDataURL`, no DOM dependency) awaited before building the HTML.
5. **"Not Found" flash**: while `router.query.token` is undefined on first client render, `skip` is true and `loading` false → error banner flashes ([verify/[token].tsx:25-45,147](../apps/frontend-pwa/src/pages/verify/%5Btoken%5D.tsx)). Gate rendering on `router.isReady`.
6. **`window.confirm` for revoke** ([CourseVerifiableCredentialsModal.tsx:31-38](../apps/frontend-manage/src/components/courses/CourseVerifiableCredentialsModal.tsx)) — use the design-system `Modal` confirm pattern used elsewhere in manage; also gives you a place for the revocation-policy explanation from 2.6.
7. **Fake UZH seal**: both the report and the verify page hand-draw an imitation UZH seal/wordmark in SVG ([exportReport.ts:294-309](../apps/frontend-pwa/src/components/insights/assessmentResults/exportReport.ts), [verify/[token].tsx:57-130](../apps/frontend-pwa/src/pages/verify/%5Btoken%5D.tsx)). Corporate-design compliance for an official-looking document: use the official logo asset (exists in the repo/public assets), inlined as data-URI for the offline HTML.
8. **PDF expectation gap**: button says HTML, plan says "print-to-PDF meets needs", but nothing tells the student *how* to get a PDF. Add one hint line ("Open the file and use your browser's Print → Save as PDF") near the export button and inside the report; extend the report's `@media print` rules with `page-break-inside: avoid` for `.points-grid`, `.info-grid`, `.percentile-box`.
9. **Accessibility** (public page will be used by third parties): add `aria-live="polite"` around the status banner swap, an accessible name/text alternative for the histograms (visually-hidden data table or `aria-label` with bin summary), check `text-uzh-blue`-on-`bg-blue-50/50` contrast at 11px (likely < 4.5:1), and distinguish "Not Found" (amber/neutral) from "Revoked" (red) — right now both are the same red, which conflates "broken link" with "university explicitly invalidated this".
10. **Lecturer modal scale/UX**: no pagination (medical faculty course → hundreds of rows), global `revoking` flag disables all revoke buttons at once, and "Empfänger" comes from client-supplied metadata until 2.1 lands. Add simple pagination or search, per-row loading state, and a count badge on the button.
11. **Small backend cleanups**: `@@index([token])` is redundant (`@unique` already creates the index — drop it in a follow-up migration or before merge since migration hasn't shipped); `'Missing E-Mail'` literal ends up printed in an official report — resolve to username or omit the line; percentile is self-inclusive ("≤ your score", minimum 20% at cohort 5) — text explains it consistently, keep, but document in code comment.
12. **`prisma:sync` note**: apps/analytics schema mirror contains no model files at all on `v3` — the sync convention is dormant repo-wide, so this PR isn't uniquely at fault; the plan's claim that sync was run is still inaccurate. Run `pnpm run prisma:sync` and commit if analytics is expected to consume this model; otherwise ignore.

---

## 5. What is in good shape (verified, no action)

- Schema design is sensible and generic (`CredentialType` enum + JSON snapshot supports future certificate types); migration matches the Prisma schema.
- Token generation is cryptographically sound: `crypto.randomBytes(32).toString('hex')`, unique-constrained; enumeration is infeasible.
- Lecturer-side authorization (`courseVerificationRecords`, `revokeCredential`) correctly checks course WRITE access via the existing `checkAccess`; course owners have `derivedPermission` rows (created via `recomputeDerivedPermissions` on course creation), so the modal works for owners.
- Build, typecheck, lockfile, and GraphQL codegen artifacts are all clean (see §1).
- Playwright config (serial, 1 worker) makes the test file's shared-token design safe once the test itself is fixed.

---

## 6. Execution order for the fix pass (junior checklist)

Work on the PR branch; one commit per numbered step; run the listed verification each time.

1. **Server-side snapshot** (§2.1) + **auth/enrollment** (§2.2) — one slice; they touch the same resolver. Verify: new unit tests + manual GraphQL calls (lecturer JWT, non-enrolled participant, valid participant).
2. **Fix unit test expectation** (§2.3) and add tests from steps 1. Verify: `./run-tests-local.sh verification.test.ts` green; paste output in PR.
3. **Idempotent issuance + revocation policy** (§2.6, needs product-owner decision — ask before coding). Verify: unit tests.
4. **Public exposure hardening** (§3.1: revoked-metadata stripping, expiry decision, histogram/privacy-notice wording) + **crash-hardening** (§3.3) + **HTML escaping** (§3.4). Verify: unit test with malformed legacy metadata; manual verify-page check.
5. **Perf decision** (§2.7) — discuss the two options in the PR thread first; implement the chosen one. Verify: Prisma query logs on the student page.
6. **Identity on verify page** (§2.5) + **wording fixes** (§3.2). Verify: screenshot pair (report vs. verify page).
7. **UX/i18n batch** (§4.1–4.10). Verify: agent-browser walkthrough with screenshots (repo rule for UI changes), DE + EN locales, mobile + desktop viewports.
8. **Fix and actually run the E2E spec** (§2.4). Verify: green Playwright output in PR.
9. Re-run the full loop: `CI=true pnpm run check:all && pnpm run build`, unit tests, E2E, then update the PR description's Verification section with real outputs/screenshots.

Estimated effort: steps 1–4 ≈ 1–2 days, 5–8 ≈ 1–2 days including verification.

---

*Review produced with multi-agent verification: every load-bearing claim was either executed (build/typecheck/unit test/codegen) or independently re-verified against the code with file:line evidence; findings that could not be confirmed were dropped or downgraded (e.g. the i18n `.replace` pattern was tested and works; the earlier "lockfile broken" suspicion was traced to a local pnpm-version mismatch and discarded).*
