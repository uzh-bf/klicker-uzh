# Security hardening quick wins

## Approval summary

**Why and what changes?** A code scan surfaced several small authorization, token-handling and grading defects. Each one has a correctly guarded sibling in the codebase, and this package aligns the outliers with it:

- Session JWTs issued by the auth app carry an expiry.
- Login and activation links stay out of Teams notifications.
- Response-API logs carry identifiers instead of cookies and answers.
- Analytics page views record the path without its query string.
- LTI launch redirects require HTTPS outside dev mode.
- Three state-changing lecturer mutations require full-access logins.
- Sharing mutations never grant OWNER; ownership moves only through transfer.
- Correction history, the object activity log and live quiz scheduling check permissions and status like their siblings.
- Numerical grading treats a zero bound and non-numeric input correctly.

**What stays unchanged?** Public GraphQL types, existing sessions (old tokens expire with their cookies), anonymous participation, the audit trail of assessment answers, and the Hatchet event payloads.

**What could change the decision?** Read-only delegated logins lose course deletion, archiving and manual group assignment. That is the intended effect. Numerical answers that only parsed as a number prefix (for example `1,5`) are now rejected as invalid instead of being graded.

**How will we know it is done?**
- The affected packages pass typecheck.
- Grading unit tests cover zero bounds and non-finite input.
- The full diff is reviewed against this list.

**What does approval authorize?** Local commits on `fix/security-scan-quick-wins`, a push of that branch, and a draft PR into `v3`. It does not authorize merging, marking ready, or deployment.

## Execution details

- Execution mode: solo (main session).
- Approval mode: executable batch, approved in session on 2026-10-25.
- Terminal condition: draft PR open with verification evidence.
- Test portfolio:
  - Numerical grading boundary and non-finite handling: extend the existing `packages/grading/test/index.test.ts`.
  - Other rows: no new test. They are one-line guards that copy existing sibling checks, verified by typecheck and diff inspection.
- Slices (one commit each):
  1. grading
  2. auth tokens and logs
  3. GraphQL authorization guards

## Progress

- Status: implementation complete; draft PR pending.
- Slices: grading, auth tokens and logs, GraphQL guards. Each is committed separately.
- Evidence:
  - `packages/grading` vitest: 10/10 passed.
  - `apps/auth` unit and integration vitest: 52/52 passed. The salt-free session token now asserts a `maxAge` lifetime.
  - `biome format` and `prettier --check` are clean on all changed files.
  - `tsc --noEmit` for `packages/graphql` reports no errors in the changed code.
  - Local runs used the primary checkout's dependency install. Required CI repeats them against this branch's lockfile.
- Test delta: 2 tests changed, none added or removed.
- Final simplification and review: self-review by the main session over the full range. No findings remain.
- Folded in: `changePermissionLevel` also refuses to edit the owner's own permission row. Otherwise an admin could demote the owner.
- Not applicable: browser screenshots. The analytics change alters only the URL reported to Matomo; no rendered UI changes.
