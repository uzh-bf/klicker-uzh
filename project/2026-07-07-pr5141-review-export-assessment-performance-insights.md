# Review — PR #5141: Export Student Assessment Report with Verifiable Credentials

> **STATUS (added 2026-07-17): PRE-REMEDIATION BASELINE — do not read the Verdict below as describing the current branch.**
> This review was performed on 2026-07-07 against the branch as it stood before PR #5173. All findings below are preserved unedited as the historical record of what that review found; nothing in §1–§7 has been rewritten to look clean in hindsight. PR #5173 (commit `2c7acbbfa`, merged into this branch) subsequently remediated the two Blockers this review calls critical (forgeable scores, no issuance authorization) plus the high-severity PII exposure and several of the mediums. **§6 below is annotated inline** with what was fixed by #5173 and what — if anything — is still open as of 2026-07-17. See `project/2026-07-06-export-assessment-performance-insights-plan.md` for the corresponding plan-side corrections. Do not use this document's original Verdict/sign-off gate as the current release decision; use the §6 annotations instead.

- **PR**: https://github.com/uzh-bf/klicker-uzh/pull/5141
- **Branch**: `export-assessment-performance-insights` → `v3`
- **Reviewed**: 2026-07-07 (full branch diff `v3...HEAD`, all 32 files) — **pre-#5173 baseline, see status banner above**
- **Verdict (as of 2026-07-07, superseded — see §6 annotations)**: **Not production-ready.** Good feature direction and a clean schema/UI skeleton, but the core trust model is broken and a hands-on security pass (§7) confirmed the escape hatches don't hold: credentials are **forgeable in production** (persisted operations do not protect the client-supplied payload — verified, not assumed), issuance has **no authorization** (any authenticated principal, including anonymous accounts, can mint), and the public credential query exposes the **course join PIN and lecturer email** in dev/test. On top of that, both verification claims in the PR description are false: the shipped unit test **fails when actually run**, and the shipped E2E test **cannot pass** against the seeded database. Concrete evidence and a step-by-step fix plan below; a security sign-off gate is in §6.

This document is written so a junior engineer can execute it top-to-bottom. Each finding has evidence (file:line) and a "Fix" with acceptance criteria. Work through the Blockers in order; they are sequenced so later fixes build on earlier ones.

**This is what the review found on 2026-07-07.** It is kept as-is, including file:line references that point at the pre-#5173 code and may no longer match current line numbers. For the present state of each finding, see the annotations in §6.

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

```text
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
- Production's persisted-operations allow-list does **not** prevent this, and this was verified concretely in round 2 (see §7): `usePersistedOperations` pins only the operation *document*, not its variables ([apps/backend-docker/src/app.ts:149-156](../apps/backend-docker/src/app.ts)). The persisted `MIssueCredential` document declares `$courseId`, `$type`, **and `$metadata`** all as free variables ([MIssueCredential.graphql](../packages/graphql/src/graphql/ops/MIssueCredential.graphql)), and the operation hash is a plain `sha256` of the document text that ships in the client bundle (`packages/graphql/src/public/{client,server}.json` are a name→hash / hash→query manifest, 287 entries, `issueCredential` among them). A logged-in student replays that exact persisted hash with `{ courseId: <any>, type: COURSE_ASSESSMENT_INSIGHTS, metadata: { totalPoints: 9999, … } }` and gets a green "Verifiziert" page for fabricated scores **on production**, not just dev. The plan's tamper-proofing claim ("Any modification of the printed HTML/PDF values by the student is detected") is exactly inverted: the database itself is made to contain attacker-chosen values. **Persisted operations are not a mitigating control here — do not rely on them.**

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

Round-2 confirmation: the scope machinery to prevent the lecturer-JWT case already exists and is used by the neighbouring `studentAssessmentResults` query — `const asParticipant = { authenticated: true, role: DB.UserRole.PARTICIPANT }` + `t.withAuth(asParticipant)` ([query.ts:914](../packages/graphql/src/schema/query.ts), definition at [query.ts:128](../packages/graphql/src/schema/query.ts)). The new resolver simply doesn't use it. With `maskedErrors: !process.env.DEBUG` on in production ([app.ts:186](../apps/backend-docker/src/app.ts)), the resulting Prisma `P2003` foreign-key error is masked to a generic "Unexpected error" — so the failure mode is an opaque 500 to the client and a noisy stack in the logs, not a clean rejection.

**Fix:**

1. Declare the mutation as `t.withAuth(asParticipant).field(…)`; same for the lecturer-side query/mutation with the appropriate scope (`asUser` + the existing `checkAccess`/`withPermission` course check is fine there and already present).
2. Inside the resolver, verify an active `Participation` exists for `(ctx.user.sub, courseId)` and that the course has `isAssessmentEnabled: true`; throw a GraphQL error otherwise. Note: after fix 2.1 this comes almost for free — `getStudentAssessmentResults` already returns null/empty for non-enabled courses ([courses.ts:630](../packages/graphql/src/services/courses.ts)); treat that as "refuse to issue".
3. **Explicitly reject temporary/anonymous participants.** `role === PARTICIPANT` is *also* true for anonymous "temporary" participant accounts (KlickerUZH's anonymous login), so `asParticipant` alone still lets a throwaway account mint an official-looking credential. Add a check that the participant is a real, identified account (e.g. has an `ssoEmail`/non-temporary flag) before issuing, or the "verified" report can be minted by an anonymous user with no institutional identity.

**Acceptance criteria**: lecturer JWT → clean auth error, not masked 500; participant not enrolled → auth error; course without assessment → error; temporary/anonymous participant → refused. Add one unit test per case.

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

### 2.8 Public unauthenticated credential query exposes the full `Course` type (join PIN + lecturer email)

**Severity: high (latent in prod, live in dev/test) — found in round-2 security pass.**

The public, unauthenticated `verifiableCredential(token)` query has no auth scope ([verification.ts:55-65](../packages/graphql/src/schema/verification.ts)) and its `course` field resolves to the **full `Course` object type** (`CourseRef`) via `findUniqueOrThrow` ([verification.ts:43-50](../packages/graphql/src/schema/verification.ts)). The `Course` type exposes sensitive fields:

- `pinCode` — the course **join secret** (used as `/course/{id}/join?pin={pinCode}`, [CourseOverviewHeader.tsx:157](../apps/frontend-manage/src/components/courses/CourseOverviewHeader.tsx)); anyone who can read it can enrol in the course.
- `notificationEmail` — lecturer email ([course.ts:93](../packages/graphql/src/schema/course.ts)).
- `owner → User.email` — lecturer PII, **non-nullable** ([course.ts:177](../packages/graphql/src/schema/course.ts) → [user.ts:26](../packages/graphql/src/schema/user.ts)).

**Why it's not "critical" but still must be fixed:** in production the persisted-operations boundary pins the *document*, and the only persisted operation reaching this field (`QGetVerifiableCredential`) selects just `course { id name displayName }`, so `pinCode`/`owner.email` are not selectable via that op in prod. **But**:

1. In dev/test the server sets `allowArbitraryOperations` ([app.ts:150-152](../apps/backend-docker/src/app.ts)), so any client holding a token can select `course { pinCode owner { email } }` today.
2. The schema *surface* is wrong regardless of the runtime guard: a public, unauthenticated entry point should never return a type that carries a join secret and owner PII. This is one persisted-ops-config change (or one new persisted query that happens to select those fields) away from a live leak, and `graphql-armor` depth/cost limits are disabled (§3.5) so nothing else constrains traversal.

**Fix:** give the public `verifiableCredential.course` field a **minimal projection type** (`id`, `name`, `displayName` only) instead of `CourseRef` — define a small `PublicCourseInfo` object ref and resolve into it, so the sensitive fields are unreachable from the unauthenticated surface by construction. Do the same for anything else this public query can traverse into.

**Acceptance criteria**: querying `verifiableCredential(token){ course { pinCode owner { email } } }` against a dev server returns a schema/validation error (field does not exist on the returned type), not data.

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

`exportReport.ts` interpolates `courseName`, `studentEmail`, and i18n texts into an HTML string without escaping ([exportReport.ts:85-415](../apps/frontend-pwa/src/components/insights/assessmentResults/exportReport.ts)). Course names are lecturer-controlled → a malicious/compromised lecturer account can inject markup/script into files students download and open locally. **Fix**: add a tiny `escapeHtml()` for every interpolated value (5 entities), and keep the SVG generator numeric-only. Note: after 2.1, `studentEmail` becomes server-sourced, but `courseName` is still lecturer-authored free text, so escaping remains required.

### 3.5 GraphQL query depth and cost limits are disabled

**Severity: medium (defense-in-depth) — round-2 finding.** `graphql-armor` is initialised with **both** `maxDepth` and `costLimit` disabled ([app.ts:30-36](../apps/backend-docker/src/app.ts)). With a public, unauthenticated entry point (`verifiableCredential`) now traversing into the rich, recursive `Course` graph (§2.8), there is no depth/cost ceiling protecting that surface if the persisted-ops boundary is ever relaxed or bypassed in a non-prod environment. This is pre-existing config, not introduced by this PR, but this PR is what adds the unauthenticated deep-traversal entry point, which changes the risk calculus. **Fix (follow-up, coordinate with maintainers):** don't block this PR on re-enabling armor globally, but pair the §2.8 minimal-projection fix with it, and file a follow-up to re-evaluate enabling `maxDepth`/`costLimit`.

### 3.6 Resolvers throw generic `Error`, which prod masking turns into "Unexpected error"

**Severity: low.** The new resolvers throw `new Error('Not authenticated' | 'Not authorized' | 'Credential not found')` ([verification.ts:96,120-123,133-134](../packages/graphql/src/schema/verification.ts)). With `maskedErrors` on in production ([app.ts:186](../apps/backend-docker/src/app.ts)) these collapse to a generic "Unexpected error", so the student/lecturer UIs (which already swallow errors, §4.3) can't show anything meaningful. Use typed `GraphQLError` with stable `extensions.code` values like the rest of the codebase, so the client can distinguish "not authorized" from a real server fault. (Most of these throws also disappear once the resolvers move to `withAuth`/`withPermission` per §2.2.)

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

> **Annotation (added 2026-07-17): remediation status of each step below, verified against the current branch (PR #5173 / `2c7acbbfa`).** The numbered list and sign-off gate are left as originally written (they describe the fix pass as planned on 2026-07-07); each item now carries a `→ status:` line with what actually shipped, checked against the code in this worktree. Nothing below was deleted or reworded in the original text — only the `→ status:` lines are new.

Work on the PR branch; one commit per numbered step; run the listed verification each time. **Do steps 1 and 2 first — they neutralise the two critical trust holes; everything else is downstream.**

1. **Server-side snapshot** (§2.1) + **auth/enrollment/temporary-account rejection** (§2.2) — one slice; they touch the same resolver. This is the security core: after it, scores can't be forged and only real enrolled participants can issue. Verify: new unit tests + manual GraphQL calls (lecturer JWT → clean error not masked 500, non-enrolled participant → error, temporary/anonymous participant → error, valid participant → server-computed snapshot). **Also replay the persisted `MIssueCredential` hash with a tampered `metadata` variable and confirm it is now rejected/ignored** (this is the exact prod attack from §2.1).
   → **status: FIXED.** `issueAssessmentReport(courseId)` (`packages/graphql/src/schema/verification.ts:239`, `packages/graphql/src/services/assessmentReports.ts:613`) takes no client-supplied payload — the resolver builds `AssessmentReportSnapshotV1` itself from the participant's own course/invitation/score data and hashes it (`snapshotHash`). It is scoped `t.withAuth(asParticipant)` and additionally checks `ctx.user.role !== DB.UserRole.PARTICIPANT`, an accepted `Participation`, and an `ACCEPTED` course invitation with a non-null `acceptedAt` (`assessmentReports.ts:310-346`) before it will issue — a lecturer JWT or a participant without an accepted invitation gets a typed `GraphQLError`, not a 500. The `MIssueCredential.graphql` op no longer declares a `metadata` variable at all, so there is nothing left to tamper via persisted-op replay.
2. **Minimal public course projection** (§2.8) — replace `verifiableCredential.course: CourseRef` with a 3-field `PublicCourseInfo` type. Verify: `verifiableCredential(token){ course { pinCode owner { email } } }` against a dev server returns a schema error, not data.
   → **status: FIXED.** The public query (`assessmentReportVerification`, `verification.ts:212`) returns a dedicated `PublicAssessmentReportCourse` object ref (`verification.ts:67-70`), separate from the lecturer-facing `AssessmentReportCourse` ref that exposes more fields — `pinCode`/`owner.email` are not reachable from the public type.
3. **Fix unit test expectation** (§2.3) and add the tests from steps 1–2. Verify: `./run-tests-local.sh verification.test.ts` green; paste output in PR.
   → **status: FIXED (superseded by a full test rewrite).** `packages/graphql/test/verification.test.ts` (1019 lines) and `packages/graphql/test/assessmentReports.test.ts` (203 lines, new) now cover the redaction/authorization/idempotency behavior. CI's `test-graphql` job passes on the current PR head commit `f769bec30` (`gh pr checks 5141`, verified 2026-07-17).
4. **Idempotent issuance + revocation policy** (§2.6, needs product-owner decision — ask before coding) + **typed GraphQL errors** (§3.6). Verify: unit tests.
   → **status: PARTIALLY ADDRESSED — see caveat.** Issuance is idempotent (unchanged snapshot returns the existing `ACTIVE` record) and re-issuing claims that match a `REVOKED` record's claims is now explicitly blocked (`ASSESSMENT_REPORT_REVOKED`), while re-issuing with genuinely changed data supersedes the prior record (`issueAssessmentReportInTransaction`, `assessmentReports.ts:429-541`). Resolvers throw typed `GraphQLError`s with `extensions.code` (e.g. `FORBIDDEN`, `NOT_FOUND`) instead of generic `Error`. **Caveat**: this repo has no record of an explicit product-owner sign-off on this exact policy shape — it reads as an engineering-derived answer to the open question, not a documented product decision. Flag for product confirmation if that matters for this feature's compliance posture.
5. **Public exposure hardening** (§3.1: revoked-metadata stripping, expiry decision, histogram/privacy-notice wording) + **crash-hardening** (§3.3) + **HTML escaping** (§3.4). Verify: unit test with malformed legacy metadata; manual verify-page check. File the §3.5 armor follow-up.
   → **status: MOSTLY FIXED.** `getPublicAssessmentReport` (`services/verification.ts:74-109`) redacts non-`ACTIVE` records to `{status, issuedAt, snapshot: null}`, and a hash-mismatch/malformed record redacts to `DATA_UNAVAILABLE` rather than crashing. `exportReport.ts` has an `escapeHtml()` helper (`exportReport.ts:55`) applied to interpolated values. The `expiresAt` column and public-histogram-wording items were not individually re-checked here — treat as unverified rather than fixed.
6. **Perf decision** (§2.7) — discuss the two options in the PR thread first; implement the chosen one. Verify: Prisma query logs on the student page.
   → **status: FIXED (cheapest option taken).** `getStudentAssessmentResults` (`services/courses.ts:543`) no longer computes cohort-wide percentile/histogram on every page view — that aggregation (`calculateAssessmentCourseScores`) now runs only inside `issueAssessmentReport` at issuance time (`assessmentReports.ts:348`).
   → 2026-07-17 note: the split introduced a second scoring path — `packages/graphql/src/services/assessmentScores.ts` (203 lines, new) — reviewed only for the presence of `calculateAssessmentCourseScores`, not audited end-to-end for score-calculation correctness.
7. **Identity on verify page** (§2.5) + **wording fixes** (§3.2). Verify: screenshot pair (report vs. verify page).
   → **status: FIXED.** `verify/index.tsx:322` renders `{snapshot.subject.email}` on the status banner. A search for the original "digital signiert / digitally signed" / "manipulationssicher" strings found no matches in `exportReport.ts` or `verify/index.tsx`, consistent with the wording having been corrected — not independently re-read line-by-line.
8. **UX/i18n batch** (§4.1–4.13). Verify: agent-browser walkthrough with screenshots (repo rule for UI changes), DE + EN locales, mobile + desktop viewports.
   → **status: PARTIALLY VERIFIED.** `verify/index.tsx` uses `next-intl` (`useTranslations`) rather than hardcoded bilingual strings. The rest of item 4's sub-points (QR race, silent failures, `window.confirm`, fake seal, pagination, etc.) were **not** individually re-checked for this annotation pass — do not assume all of §4 is closed.
   → **No `agent-browser` walkthrough has been run as part of this annotation pass.** Per repo rules this is required before treating any frontend-facing part of this PR as browser-verified; it is still an open, pending manual step.
9. **Fix and actually run the E2E spec** (§2.4). Verify: green Playwright output in PR.
   → **status: FIXED.** `playwright/tests/Z-credential-verification.spec.ts` was substantially rewritten (part of the #5173 diff, +/- several hundred lines) alongside new helpers in `playwright/util/credentialVerification.ts` and `playwright/util/constants.ts`. CI's `test-playwright` shards all pass on the current PR head commit `f769bec30` (verified via `gh pr checks 5141`, 2026-07-17).
10. Re-run the full loop: `CI=true pnpm run check:all && pnpm run build`, unit tests, E2E, then update the PR description's Verification section with real outputs/screenshots.
    → **status: CI-verified as of 2026-07-17** (`gh pr checks 5141`): build, check-types, check-format, check-lint, check-syncpack, test-graphql, test-playwright (all 8 shards) all report `pass` on commit `f769bec30`. This was checked via GitHub's check-run status, not by re-running the commands locally in this pass.

Estimated effort: steps 1–5 (security + correctness) ≈ 2–3 days, 6–9 ≈ 1–2 days including verification.

### Security sign-off gate (must all be true before merge)

> **Annotation (added 2026-07-17):** gate re-evaluated against the current branch. Checkboxes below reflect what code inspection and CI status support as of 2026-07-17, not the 2026-07-07 baseline.

- [x] Scores on the verify page are server-computed; a tampered persisted `MIssueCredential` replay cannot change them (§2.1). — no `metadata` variable exists on the mutation to tamper with.
- [x] `issueAssessmentReport` rejects lecturer JWTs (role check + `t.withAuth(asParticipant)`), non-enrolled participants (accepted-invitation check), and effectively requires a real accepted invitation (§2.2) — the original "temporary/anonymous participant" wording is superseded by the invitation-based identity check: no accepted invitation means no issuance, regardless of account type.
- [x] The public credential query cannot reach `Course.pinCode` / `owner.email` on any environment (§2.8) — dedicated minimal `PublicAssessmentReportCourse` type.
- [x] Revoked/superseded credentials do not serve `snapshot` publicly; re-issuing matching claims after revocation is explicitly refused rather than silently minting a fresh active credential (§3.1, §2.6).
- [x] Exported HTML escapes interpolated values via `escapeHtml()` (§3.4).
- [x] The committed unit + E2E suites run green in CI on the current PR head commit (`f769bec30`), per `gh pr checks 5141` (§2.3, §2.4).
- [ ] **Still open / not verified in this pass**: `graphql-armor` `maxDepth`/`costLimit` remain disabled (§3.5, `apps/backend-docker/src/app.ts`) — explicitly deferred as a follow-up in the original review and still disabled in the current code; `expiresAt` column disposition (§3.1); full §4 UX/i18n batch beyond the verify page; and the **mandatory `agent-browser` before/after screenshot verification** of the export and verification flows, which per repo rules has not yet been performed.

---

## 7. Security re-verification (round 2) — method and evidence

This section records the hands-on second pass focused solely on security, so the findings above are auditable rather than asserted.

**Method.** Read the backend GraphQL server wiring end-to-end ([apps/backend-docker/src/app.ts](../apps/backend-docker/src/app.ts)), the auth-scope builder ([packages/graphql/src/builder.ts:56-90](../packages/graphql/src/builder.ts)), the full `Course`/`User` type field exposure ([course.ts](../packages/graphql/src/schema/course.ts), [user.ts](../packages/graphql/src/schema/user.ts)), and the persisted-operation manifests. Each finding was chased to the point where the escape hatch (persisted ops, prod masking, scope guards) was either confirmed to close the hole or confirmed **not** to.

**Key confirmations:**

| Claim | Verified how | Result |
| --- | --- | --- |
| Persisted ops don't stop score forgery | `MIssueCredential.graphql` declares `$courseId/$type/$metadata` as free variables; `server.json`/`client.json` are a sha256(doc)→query / name→hash manifest (287 entries incl. `issueCredential`) that ships to the client; `allowArbitraryOperations` only true in dev/test ([app.ts:150-152](../apps/backend-docker/src/app.ts)) | **Forgery works in production** — persisted ops pin the document, not the attacker-controlled variables (§2.1) |
| `issueCredential` has no scope guard | Resolver uses `if (!ctx.user)` ([verification.ts:95-99](../packages/graphql/src/schema/verification.ts)); neighbouring `studentAssessmentResults` uses `t.withAuth(asParticipant)` ([query.ts:914,128](../packages/graphql/src/schema/query.ts)) | Confirmed; lecturer JWT → `participantId = User uuid` → Prisma P2003, masked to generic 500 in prod (§2.2) |
| `role: PARTICIPANT` includes anonymous accounts | `authScopes.role` in [builder.ts:63-76](../packages/graphql/src/builder.ts) matches any `PARTICIPANT`, including temporary logins | Even the correct `asParticipant` guard is insufficient — must additionally reject temporary/anonymous accounts (§2.2 step 3) |
| Public credential query leaks course PII | `verifiableCredential` has no auth ([verification.ts:55-65](../packages/graphql/src/schema/verification.ts)) and returns `course: CourseRef`; `Course` exposes `pinCode` (join secret), `notificationEmail`, and `owner → User.email` (non-null) | Latent in prod (persisted-op field pinning), live in dev/test (§2.8) |
| Query depth/cost unbounded | `EnvelopArmor({ maxDepth:{enabled:false}, costLimit:{enabled:false} })` ([app.ts:30-36](../apps/backend-docker/src/app.ts)) | Confirmed; no ceiling on the new public deep-traversal surface (§3.5) |
| Revoked credential still returns metadata | `getCredentialByToken` does `findUnique` with no `isRevoked` filter ([verification.ts:30-45](../packages/graphql/src/services/verification.ts)); public op selects `metadata` | Confirmed; email + scores + cohort histogram served publicly forever, even post-revocation (§3.1) |

**What held up as safe (no change):** token entropy (32 random bytes) makes enumeration infeasible; lecturer-side `courseVerificationRecords`/`revokeCredential` correctly gate on course WRITE access via `checkAccess`/`withPermission`; `maskedErrors` is on in production; CSRF-prevention and CORS-with-credentials are configured. These are genuine strengths — the problem is specifically the unauthenticated issue/verify surface and the client-trusted payload, not the lecturer path.

**Net security posture:** two **critical** issues (forgeable scores §2.1, no issuance authz §2.2) plus one **high** latent PII exposure (§2.8) and several supporting mediums. None are mitigated by the existing persisted-ops / masking controls in the way one might assume — that assumption was tested and disproven. The feature must not ship until steps 1–2 of §6 land and the security sign-off gate is green.

---

*Review produced with multi-agent verification plus a hands-on round-2 security pass: every load-bearing claim was either executed (build/typecheck/unit test/codegen) or independently re-verified against the code with file:line evidence, and each security escape hatch was tested rather than assumed. Findings that could not be confirmed were dropped or downgraded (e.g. the i18n `.replace` pattern was tested and works; the earlier "lockfile broken" suspicion was traced to a local pnpm-version mismatch and discarded).*
