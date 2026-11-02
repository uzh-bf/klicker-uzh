# Restore assessment submission audit provenance

## Goal

Resolve the actual Hatchet event for a covered assessment submission so the
response worker can persist the answer and its audit evidence. The current
lookup sends a workflow run ID as a workflow-definition filter and returns no
events. Reproduced with the production resolver and a query-aware fixture.

## Scope

- Change only response-worker event resolution, focused tests, and audit docs.
- Filter assessment events by server-stamped submission metadata, paginate, and
  retain exact workflow-run association and ambiguity checks.
- Preserve submission metadata validation, bounded visibility retries, and
  actual event IDs; never substitute a run ID or accept an unrelated resend.
- No schema, GraphQL, frontend, auth, scoring, XP, or deployment changes.
- Sealing and staging recovery/replay are outside this PR.

## Verification

- Query-aware regression: original code fails with the staging error.
- Unit cases for resends, pagination, delayed visibility, absent/ambiguous
  association, and metadata mismatch.
- Real disposable PostgreSQL test using the production resolver: answer and
  acceptance/validation/persistence/scoring evidence commit together.
- Worker typecheck/build, repository hooks, and independent review.

## Progress

- Reproduced: 1 failing resolver test, 21 passing existing tests.
- Confirmed upstream SQL filters `workflowIds` against `r.workflow_id`, despite
  the misleading generated SDK description.
- Implemented metadata filtering, pagination, and exact run association.
- All 57 response-worker tests pass with fresh disposable PostgreSQL and Redis;
  the new integration test uses the production resolver and checks all four
  submission events carry the actual triggering event ID.
- Worker typecheck passes. Independent source review found no actionable issues.
- Repository delivery checks are recorded in the PR. Staging deployment and
  replay of previously failed submissions require a separate rollout step.
