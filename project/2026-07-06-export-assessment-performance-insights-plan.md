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
* No additional database models for achievements or course certificates (schema supports them generically via `metadata` JSON, but views are deferred until required).

---

## Resolved Questions & Grill Findings
* **GDPR Compliance**: The credential model cascades on participant deletion. When a student deletes their account or requests revocation, all active verification records are deleted or marked revoked.
* **Tamper Proofing**: Employers verify records against the live database at `https://klicker.uzh.ch/verify/[token]`. Any modification of the printed HTML/PDF values by the student is detected.
* **Offline Access**: The HTML export remains standalone and offline-functional. The QR code is rendered on the client canvas as a base64 Data URL and embedded directly into the HTML payload.

---

## Slices

### Slice 1: Database Schema & Migration
* **Do**:
  * Create [`packages/prisma/src/prisma/schema/verification.prisma`](file:///Users/roland/.gemini/antigravity/worktrees/klicker-uzh/export-assessment-performance-insights/packages/prisma/src/prisma/schema/verification.prisma) to define the `VerifiableCredential` model and `CredentialType` enum.
  * Update `packages/prisma/src/prisma/schema/course.prisma` and `packages/prisma/src/prisma/schema/participant.prisma` to declare the back-relations.
* **Check**:
  * Run `pnpm run prisma:migrate` to create and apply the local database migration.
  * Run `pnpm run prisma:sync` to mirror the schema to the analytics package.
  * Run `pnpm run check` to verify Prisma client compiles successfully.
* **Commit**: `feat(prisma): add verifiable credential schema`

### Slice 2: Backend Service & GraphQL API
* **Do**:
  * Implement service functions in [`packages/graphql/src/services/verification.ts`](file:///Users/roland/.gemini/antigravity/worktrees/klicker-uzh/export-assessment-performance-insights/packages/graphql/src/services/verification.ts) for credential issuance, retrieval, and revocation.
  * Implement GraphQL schema types and resolvers in `packages/graphql/src/schema/verification.ts`:
    * `Query.verifiableCredential(token)`: Public lookup (unauthenticated).
    * `Query.courseVerificationRecords(courseId)`: Lecturer-only lookup (authenticated, checked against course ownership).
    * `Mutation.issueCredential(courseId, type, metadata)`: Student issuance (authenticated).
    * `Mutation.revokeCredential(id)`: Lecturer revocation (authenticated, checked against course ownership).
  * Run codegen to update GraphQL client bindings.
  * Create unit tests in `packages/graphql/test/verification.test.ts`.
* **Check**:
  * Run `pnpm --filter @klicker-uzh/graphql generate` (codegen).
  * Run `pnpm --filter @klicker-uzh/graphql test` to verify all tests pass.
* **Commit**: `feat(graphql): implement verifiable credentials queries and mutations`

### Slice 3: Student PWA Export & Verification Portal
* **Do**:
  * Update [`SuspendedAssessmentResults.tsx`](file:///Users/roland/.gemini/antigravity/worktrees/klicker-uzh/export-assessment-performance-insights/apps/frontend-pwa/src/components/insights/assessmentResults/SuspendedAssessmentResults.tsx): Trigger the mutation to issue a credential upon export, generate the verification QR code using a client-side library (`react-qrcode-logo` or simple canvas), and pass it to `exportReport.ts`.
  * Update [`exportReport.ts`](file:///Users/roland/.gemini/antigravity/worktrees/klicker-uzh/export-assessment-performance-insights/apps/frontend-pwa/src/components/insights/assessmentResults/exportReport.ts) to append a UZH-branded footer containing the QR code image and the clickable verification URL.
  * Create page [`verify/[token].tsx`](file:///Users/roland/.gemini/antigravity/worktrees/klicker-uzh/export-assessment-performance-insights/apps/frontend-pwa/src/pages/verify/%5Btoken%5D.tsx):
    * Displays a large success banner: **"Status: Verifiziert / Verified"** matching UZH Corporate Design.
    * Renders the scores cards, percentile box, and dynamic Recharts points histogram.
    * If revoked, displays a prominent warning: **"Ungültig / Invalid (Widerrufen)"**.
* **Check**:
  * Run `pnpm --filter @klicker-uzh/frontend-pwa build` to verify compiling.
  * Export a performance report, open the HTML file, scan the QR code, and verify it directs to the correct URL.
* **Commit**: `feat(frontend-pwa): implement student export footer and verification portal`

### Slice 4: Lecturer UI (Manage Portal)
* **Do**:
  * Add translations in `de.ts` and `en.ts` for all verification strings.
  * Create `IssuedCredentialsModal.tsx` in `apps/frontend-manage/src/components/courses/modals/IssuedCredentialsModal.tsx`.
  * Add the "Issued Credentials" button in [`results.tsx`](file:///Users/roland/.gemini/antigravity/worktrees/klicker-uzh/export-assessment-performance-insights/apps/frontend-manage/src/pages/courses/%5Bid%5D/assessment/results.tsx) to trigger the modal.
* **Check**:
  * Run `pnpm --filter @klicker-uzh/frontend-manage build` to verify compiling.
  * Open the lecturer dashboard, verify the modal lists issued credentials, click "Revoke", and verify the status updates in the UI and DB immediately.
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
* **2026-07-06**: Slice 2 completed. Created backend verification services and GraphQL resolvers/queries/mutations for issuing, resolving, listing, and revoking credentials. Added and verified comprehensive Vitest unit tests.

---

## Goal Prompt (For Next Session / Subagents)
Review the implementation plan at `project/2026-07-06-export-assessment-performance-insights-plan.md`. Execute the slices one-by-one. For each slice, implement, run tests, obtain a review, simplify the code, and make a clean commit before proceeding. Run `pnpm run check:all` at the end to verify.
