# Implementation Plan — Verifiable Credentials and Verification System

Goal: Implement a generic, database-verified credentialing system in KlickerUZH. It supports the student performance insights export for the medical faculty as its first use case, alongside a unified verification portal, dynamic QR-code-enabled PDF/HTML footers, and a lecturer dashboard to view and revoke issued credentials.

Branch: `export-assessment-performance-insights`
Target: `v3`
Plan Path: `project/2026-07-06-export-assessment-performance-insights-plan.md`
MR/PR: unknown

---

## Non-Goals
* No PDF server-side generation using Puppeteer (local print-to-PDF / standalone HTML meets medical faculty needs).
* No support for decentralized W3C DID wallets in v1.
* No additional database models for achievements or course certificates (the `VerifiableCredential` model supports them generically via a versioned `snapshot` JSON column, but views are deferred until required).

> **Note (post-#5173 remediation):** the original version of this plan described a design where the client supplied a `metadata` payload for the issued credential. That was a critical forgery vector — a client-supplied payload cannot be trusted as verified data — and was replaced by PR #5173 (commit `2c7acbbfa`) before this branch shipped. The sections below describe the **shipped** server-computed design. Do not reintroduce a client-supplied metadata/snapshot argument on the issuance mutation.

---

## Resolved Questions & Grill Findings
* **GDPR Compliance (resolved)**: `VerifiableCredential.participantId` has `onDelete: Cascade` to `Participant` (see `packages/prisma/src/prisma/schema/verification.prisma`). When a student's account is deleted, all of their issued credentials are deleted with it. This is the one part of the original GDPR claim that is settled by the schema.
* **Revocation policy (do not overclaim — see shipped behavior below)**: whether a lecturer revoking a credential should permanently block the student from getting an equivalent report again, or only invalidate that one snapshot, was flagged as an open product decision during the PR #5141 review (`project/2026-07-07-pr5141-review-export-assessment-performance-insights.md`, §2.6). The remediation in PR #5173 (`2c7acbbfa`) shipped a specific policy in `issueAssessmentReportInTransaction` (`packages/graphql/src/services/assessmentReports.ts`): re-issuing while the same claims (score/course, excluding the peer-comparison histogram) match a **revoked** record throws `ASSESSMENT_REPORT_REVOKED` and refuses to issue; re-issuing with **changed** underlying data (e.g. new results) is still allowed and supersedes the prior ACTIVE record. This is the mechanism actually running in production. There is no evidence in this repo of a separate, explicit product-owner sign-off on this exact policy beyond the engineering remediation — treat it as the current shipped behavior, not as a formally ratified product decision, until confirmed otherwise.
* **Tamper Proofing**: Employers verify records against the live database via the public verification page (`apps/frontend-pwa/src/pages/verify/index.tsx`). The verification token travels in the URL **fragment** (`https://pwa.klicker.uzh.ch/verify#<token>`, read from `window.location.hash`), not a path segment, so it is never sent to the server as part of a plain page request; the lookup itself is a POST-based GraphQL call. Any modification of the printed HTML/PDF values by the student is detected because the server serves its own stored, hashed snapshot, not anything from the file.
* **Offline Access**: The HTML export remains standalone and offline-functional. The QR code is rendered on the client canvas as a base64 Data URL and embedded directly into the HTML payload.

---

## Slices

### Slice 1: Database Schema & Migration
* **Do**:
  * Create [`packages/prisma/src/prisma/schema/verification.prisma`](../packages/prisma/src/prisma/schema/verification.prisma) to define the `VerifiableCredential` model, the `CredentialType` enum, and the `CredentialStatus` enum (`ACTIVE` / `REVOKED` / `SUPERSEDED`).
  * Update `packages/prisma/src/prisma/schema/course.prisma` and `packages/prisma/src/prisma/schema/participant.prisma` to declare the back-relations.
* **Check**:
  * Run `pnpm run prisma:migrate` to create and apply the local database migration.
  * Run `pnpm run prisma:sync` to mirror the schema to the analytics package (`apps/analytics`).
  * Regenerate the Prisma client (part of `prisma:migrate`/`postinstall`, or `pnpm --filter @klicker-uzh/prisma generate` explicitly) — a schema edit is not complete until the generated client reflects it.
  * Run `pnpm run check` to verify the codebase compiles against the regenerated client.
* **Commit**: `feat(prisma): add verifiable credential schema`

### Slice 2: Backend Service & GraphQL API
* **Do**:
  * Implement service functions for **server-side** snapshot computation, issuance, retrieval, and revocation in [`packages/graphql/src/services/assessmentReports.ts`](../packages/graphql/src/services/assessmentReports.ts) and [`packages/graphql/src/services/verification.ts`](../packages/graphql/src/services/verification.ts). The service computes the immutable `AssessmentReportSnapshotV1` payload itself (course, subject, scores, histogram) from the participant's own data — it never accepts a client-supplied snapshot/metadata argument — and hashes it with SHA-256 (`snapshotHash`) for tamper detection.
  * Implement GraphQL schema types and resolvers in `packages/graphql/src/schema/verification.ts`:
    * `Query.assessmentReportVerification(token)`: Public lookup (unauthenticated), redacts to `{status, issuedAt, snapshot: null}` unless the record is `ACTIVE`.
    * `Query.courseAssessmentReportRecords(courseId, ...)` / `Query.courseAssessmentReportRecordCount(courseId)`: Lecturer-only lookup, `t.withAuth(asUserFullAccess)` plus a course-ADMIN `checkAccess` check.
    * `Mutation.issueAssessmentReport(courseId)`: Participant issuance, `t.withAuth(asParticipant)`. No client-supplied payload — the resolver computes the snapshot itself. Idempotent: an unchanged snapshot returns the existing `ACTIVE` record; a changed snapshot supersedes it and issues a new `ACTIVE` record. Runs in a `Serializable` transaction with bounded retries on Prisma `P2034`.
    * `Mutation.revokeAssessmentReport(id)`: Lecturer revocation, `t.withAuth(asUserFullAccess)` plus a course-ADMIN `checkAccess` check performed **before** existence is revealed (unauthorized and non-existent both return `NOT_FOUND`).
  * Run codegen to update GraphQL client bindings.
  * Create unit tests in `packages/graphql/test/assessmentReports.test.ts` and `packages/graphql/test/verification.test.ts`.
* **Check**:
  * Run `pnpm --filter @klicker-uzh/graphql generate` (codegen).
  * Run `pnpm --filter @klicker-uzh/graphql test` to verify all tests pass.
* **Commit**: `feat(graphql): implement verifiable credentials queries and mutations`

### Slice 3: Student PWA Export & Verification Portal
* **Do**:
  * Update [`SuspendedAssessmentResults.tsx`](../apps/frontend-pwa/src/components/insights/assessmentResults/SuspendedAssessmentResults.tsx): Trigger the `issueAssessmentReport(courseId)` mutation to issue a credential upon export, generate the verification QR code, and pass the returned token to `exportReport.ts`.
  * Update [`exportReport.ts`](../apps/frontend-pwa/src/components/insights/assessmentResults/exportReport.ts) to append a UZH-branded footer containing the QR code image and the clickable verification URL.
  * Create page [`verify/index.tsx`](../apps/frontend-pwa/src/pages/verify/index.tsx) (the token is read from the URL **fragment** via `window.location.hash`, not a `[token]` path segment or query string, so it is never sent to the server in a plain page request):
    * Displays a large success banner: **"Status: Verifiziert / Verified"** matching UZH Corporate Design.
    * Renders the scores cards, percentile box, and dynamic Recharts points histogram.
    * If revoked or superseded, displays a prominent warning banner instead of the redacted scores.
* **Check**:
  * Run `pnpm --filter @klicker-uzh/frontend-pwa build` to verify compiling.
  * **Required**: verify with `agent-browser` (per repo rules, `.agents/skills/agent-browser/SKILL.md`) — capture before/after screenshots of the export flow and the verification page (valid, revoked/superseded, malformed-token states). A successful build and a manual QR scan are not sufficient verification on their own.
* **Commit**: `feat(frontend-pwa): implement student export footer and verification portal`

### Slice 4: Lecturer UI (Manage Portal)
* **Do**:
  * Add translations in `de.ts` and `en.ts` for all verification strings.
  * Create [`CourseVerifiableCredentialsModal.tsx`](../apps/frontend-manage/src/components/courses/CourseVerifiableCredentialsModal.tsx) and [`CourseVerifiableCredentialsList.tsx`](../apps/frontend-manage/src/components/courses/CourseVerifiableCredentialsList.tsx) in `apps/frontend-manage/src/components/courses/`.
  * Add the "Issued Credentials" button in [`results.tsx`](../apps/frontend-manage/src/pages/courses/%5Bid%5D/assessment/results.tsx) to trigger the modal.
* **Check**:
  * Run `pnpm --filter @klicker-uzh/frontend-manage build` to verify compiling.
  * Verify with `agent-browser`: open the lecturer dashboard, confirm the modal lists issued/revoked records, click "Revoke", and confirm the status updates in the UI and DB. Capture before/after screenshots per repo rules.
* **Commit**: `feat(frontend-manage): add lecturer credentials dashboard and revocation UI`

### Slice 5: Quality Assurance & Verification
* **Do**:
  * Run linting, formatting, type checking, and syncpack checks across all packages.
  * Run final E2E verification loops.
* **Check**:
  * Run `pnpm run check:all` from the repository root.
* **Commit**: `chore(project): final code quality checks and plan updates`

---

## Progress

* **2026-07-06**: Plan written, reviewed, simplified, and committed to project directory.
* **2026-07-06**: Slice 1 completed. Added `VerifiableCredential` model and `CredentialType` enum, ran dev database migrations, synced schemas, and verified successful compilation.
* **2026-07-06**: Slice 2 completed. Created backend verification services and GraphQL resolvers/queries/mutations for issuing, resolving, listing, and revoking credentials. Added Vitest unit tests.
  * **Correction (added 2026-07-17)**: this entry originally read "Added and verified comprehensive Vitest unit tests." That overclaimed — the 2026-07-07 review (`project/2026-07-07-pr5141-review-export-assessment-performance-insights.md`, §1, §2.3) ran the suite live and found 1 of 4 tests failing at that time (`does not resolve a revoked credential`). The tests were added on 2026-07-06 but had not actually been run green before that claim was written.
* **2026-07-17**: PR #5173 (`2c7acbbfa`) remediated the design (client-supplied metadata → server-computed, hashed, versioned snapshot; added auth/enrollment checks; redacted public verification; fragment-based tokens) and rewrote the test suites (`packages/graphql/test/assessmentReports.test.ts`, `packages/graphql/test/verification.test.ts`, `playwright/tests/Z-credential-verification.spec.ts`). On the current PR head commit (`f769bec30`), CI's `test-graphql` and `test-playwright` jobs both pass (verified via `gh pr checks 5141`, 2026-07-17). This supersedes the 2026-07-06 test-status claim above; do not read the correction note as still describing the current state.

---

## Goal Prompt (For Next Session / Subagents)
Review the implementation plan at `project/2026-07-06-export-assessment-performance-insights-plan.md`. Execute the slices one-by-one. For each slice, implement, run tests, obtain a review, simplify the code, and make a clean commit before proceeding. Run `pnpm run check:all` at the end to verify.
