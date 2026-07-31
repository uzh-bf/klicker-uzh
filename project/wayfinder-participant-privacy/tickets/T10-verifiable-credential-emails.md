# T10 — Fold the verifiable-credential email surface into the plan

Label: `wayfinder:research`
Parent: [MAP.md](../MAP.md)
Status: open
Assignee:
Blocked by: —

## Question

Surfaced by [Re-verify the plan's 13 codebase claims against current v3](T01-reverify-codebase-claims.md).
PR #5141 added a personal-data store the plan predates and therefore never accounts for:
`VerifiableCredential` keeps a participant's email address in `subjectEmail`, raw and
non-nullable, and keeps a second copy inside the credential snapshot.

Map the surface and state what it costs the plan. Specifically:

- **Every read and write.** Start from `services/assessmentReports.ts`,
  `services/verification.ts`, `schema/verification.ts`, the lecturer list and modal in
  `apps/frontend-manage/src/components/courses/`, the participant-facing
  `apps/frontend-pwa/src/pages/verify/index.tsx`, and the analytics mirror at
  `apps/analytics/prisma/schema/verification.prisma`.
- **The invitation dependency.** Issuing throws `ASSESSMENT_REPORT_IDENTITY_UNVERIFIED`
  when the course has no invitation email for the participant
  (`assessmentReports.ts:341-346`). The plan wants raw invitation emails gone, so say
  what issuing would resolve against instead.
- **The snapshot-hash constraint.** `subject.email` sits inside the JSON covered by
  `snapshotHash`, and a credential's whole point is that it stays verifiable after
  issue. Say what happens to already-issued rows if the identity representation changes
  — reissue, dual-verify, grandfather — and what each costs.
- **Which slice owns it.** This is an assessment-side surface, so it plausibly belongs
  with Slice 4's assessment identity work rather than the non-assessment email removal
  in Slices 2 and 6. Say where it lands, or say it needs its own slice.

Feasibility and options, not a decision. If a genuine choice remains after the surface
is mapped, that becomes its own ticket rather than being settled here.

Background on the feature itself is in
[the export assessment insights plan](../../2026-07-06-export-assessment-performance-insights-plan.md)
and [its review](../../2026-07-07-pr5141-review-export-assessment-performance-insights.md).

## Resolution

<!-- filled in on close -->
