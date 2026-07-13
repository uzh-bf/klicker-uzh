---
type: Operations Runbook
title: Adaptive Learning Operations
description: Course-scoped rollout, rollback, pilot monitoring, calibration interpretation, support triage, and legacy-data audit for adaptive practice quizzes.
timestamp: '2026-07-13'
tags:
  - adaptive-learning
  - operations
  - rollout
  - privacy
---

# Adaptive Learning Operations

**Adaptive learning is default-off per course and must stay limited to named pilot courses until the real-course acceptance gates pass.** Disabling the flag is a reversible kill switch: it preserves competence trees, publication pools, attempts, responses, estimates, and anonymous lecturer history.

## Scope And Authority

`Course.isAdaptiveLearningEnabled` gates only `PracticeQuiz.mode = ADAPTIVE`. It does not gate reusable competence-tree authoring or standard practice quizzes. The persisted operation is `packages/graphql/src/graphql/ops/MSetCourseAdaptiveLearningEnabled.graphql:MSetCourseAdaptiveLearningEnabled`; the resolver requires the GraphQL admin scope and `packages/graphql/src/services/courses.ts:setCourseAdaptiveLearningEnabled` rechecks the administrator's current database role.

Each state change:

- Locks the course row against concurrent adaptive writes.
- Writes one `ActivityLogEntry` modification record when the value actually changes.
- Invalidates the course cache entry.
- Returns `NOT_FOUND` for an unknown course and `ADAPTIVE_ROLLOUT_FORBIDDEN` when the database role is not administrator.

Do not backfill the flag across existing courses. Enable one reviewed course id at a time.

## Disabled-State Contract

| Surface                                                      | Disabled behavior                                                                                         |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Competence-tree library/editor                               | Remains available; trees can still be created, reviewed, duplicated, archived, and reused across courses. |
| Standard practice quizzes                                    | Unchanged.                                                                                                |
| Adaptive setup preview and create/edit                       | Blocked with `ADAPTIVE_COURSE_DISABLED`; no partial quiz/config write.                                    |
| Adaptive publication preview                                 | Returns disabled readiness and cannot schedule.                                                           |
| Adaptive publication/pool materialization                    | Blocked under a shared course lock; no post-disable pool write.                                           |
| Participant discovery/direct bootstrap                       | Hidden or `null`, including a direct URL.                                                                 |
| Start, resume/state, restart, submit, and participant result | Blocked with `ADAPTIVE_COURSE_DISABLED`.                                                                  |
| Abandon active attempt                                       | Allowed so a participant can close retained state.                                                        |
| Lecturer cohort history                                      | Remains available to authorized administrators of the quiz.                                               |
| Unpublish or delete                                          | Allowed. After attempts exist, unpublish retains the immutable publication pool for audit and republish.  |
| Change ADAPTIVE to STANDARD                                  | Allowed only before the first attempt; afterwards create or duplicate a standard quiz.                    |

The authoritative enforcement is in `packages/graphql/src/services/adaptiveLearningRollout.ts:lockAdaptiveLearningCourseEnabled` and the adaptive write services. The shared course lock makes an administrative disable wait for an in-flight write and prevents a new adaptive write from committing after disable returns.

## Enable Procedure

1. Confirm the course team has selected the mapping rule, preset, attempt policy, result use, and level-band language.
2. Confirm every enabled coverage cell has scorable items and the fresh publication preview is ready. Resolve warnings deliberately; do not treat warnings as hidden success.
3. Confirm the course has an identified rollback owner and support contact.
4. Invoke `MSetCourseAdaptiveLearningEnabled` with the reviewed course id and `enabled: true` from an administrator-authenticated operational client.
5. Create or edit the adaptive practice quiz, request a fresh publication preview, and publish immediately. Scheduled adaptive publication remains unsupported.
6. Verify participant discovery and one non-production test participation from the real course configuration before inviting the pilot cohort.
7. Record the course id, quiz id, tree id, enable timestamp, responsible administrator, teaching signoff, and rollback owner in the restricted pilot record.

Course, quiz, and tree ids are operational identifiers. Do not add participant ids, usernames, response payloads, or individual result bands to the rollout record.

## Rollback Procedure

1. Invoke `MSetCourseAdaptiveLearningEnabled` with the course id and `enabled: false`.
2. Verify the adaptive quiz has disappeared from participant discovery and direct bootstrap returns no quiz data.
3. Decide whether to leave the quiz published but disabled for investigation or unpublish it. Before the first attempt, a draft quiz may be converted to STANDARD. After an attempt exists, unpublishing retains the exact immutable pool and a later republish reuses it; create or duplicate a separate standard quiz if non-adaptive delivery is required. Do not delete attempts or pool snapshots during incident triage.
4. Use the retained anonymous cohort view to inspect aggregate stop reasons and integrity warnings.
5. Communicate that adaptive delivery is paused. Do not interpret a disabled participant-result endpoint as lost data.
6. Re-enable only after the incident owner records the cause, remediation, and verification evidence.

Disabling does not retroactively change results. If a result was used for a decision, the teaching team owns the correction and communication process.

## Pilot Monitoring

The adaptive evaluation route reports only released selected-attempt aggregates. `packages/graphql/src/services/adaptivePracticeQuizzes.ts:serializePilotMetrics` computes median/P95 question count and known elapsed time, near-boundary rate, missing-duration detection, and response/estimate count mismatches from canonical attempt, response, and estimate rows. Per-question elapsed time is client-reported, restricted to whole seconds in `0..86400`, and suitable only as a screening diagnostic. Phase 9 must apply field-aware k=5 value/complement and known/missing suppression before these fields are production-visible; until then, the course rollout gate remains closed.

`packages/graphql/src/services/adaptivePracticeQuizzes.ts:serializeItemDiagnostics` reports:

- Item response count and exposure rate.
- Observed correctness.
- Expected correctness from the immutable 3PL item snapshot and the root-specific pre-response routing estimate replayed in response order.
- Observed-minus-expected residual at 30 or more responses.
- Exposure above 40 percent and absolute residual at least 0.25 as review flags.

These are screening diagnostics, not calibrated item parameters. Expected correctness inherits the lecturer-assigned level anchor and fixed/research discrimination assumptions. Never auto-relevel an item or change a student's result from this table. Review flagged items with teaching staff, response-space validity, content evidence, and independent item-level judgement.

### Required Privacy Rules

- Completed attempts are released only when distinct completed-participant count reaches a multiple of five. Retakes and new participants between release boundaries remain hidden until the next boundary.
- Cohort size and completed totals are `null` before the first release. In-progress and abandoned lifecycle counts are never returned, even after release.
- Attempt selection (`FIRST_COMPLETED` or `LATEST_COMPLETED`) is applied only to the fixed released set, preventing a retake from changing analytics one at a time.
- Any non-empty bucket smaller than five suppresses the whole distribution.
- Item exposure also uses complementary-cell suppression: exposed or unexposed counts from one to four hide the item row's counts/rates.
- Correct/incorrect cells from one to four hide observed and expected correctness.
- Residuals remain hidden below 30 responses even when the k-anonymity cells are valid.
- The UI and support record must not contain participant identities or individual adaptive outcomes.

The current checkpoint implements the fixed release watermark and core level/item distribution suppression. The complete missingness, anomaly, percentile, and insufficient-data complement matrix is a Phase 9 release blocker, so this section defines the required production contract rather than claiming final privacy approval.

## Go/No-Go Gates

All gates are required before adaptive outcomes are used for placement or another high-stakes decision:

| Gate                | Acceptance                                                                                                                                           |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Teacher agreement   | Exact level agreement at least 0.70 and same-or-adjacent agreement at least 0.95 on a predeclared, independently teacher-labelled pilot sample.      |
| Completion burden   | Median completion time at most 25 minutes for the target course and no unexplained P95 tail accepted by the teaching team.                           |
| Exposure            | No item appears in more than 40 percent of selected completed attempts; investigate suppressed or high-exposure rows rather than assuming they pass. |
| Runtime integrity   | No response/estimate count mismatch, unexpected pool exhaustion, or unexplained missing duration.                                                    |
| Didactic review     | Teaching staff approve level semantics, mapping rule, capped/near-boundary wording, item flags, and the intended use of results.                     |
| Privacy/permissions | Anonymous suppression and negative role/direct-URL checks pass in the deployment environment.                                                        |
| Operations          | Rollback is rehearsed, support ownership is assigned, and the legacy-data audit has an approved outcome.                                             |

Synthetic simulation gates are engineering regressions only. They cannot satisfy teacher agreement, fairness, course timing, or teaching signoff.

## Support Triage

Record the following in the approved support system:

- Course/quiz id, environment, locale, browser/device class, and timestamp range.
- Whether the course flag was enabled, whether the quiz was published, and the aggregate stop reason.
- Redacted screenshot or error code; remove names, participant ids, response text, and individual level bands.
- Aggregate number affected and whether a response-count or duration warning appeared.
- Rollback action, owner, and next review time.

For an individual access issue, verify participation and authorization in the restricted operational system. Do not paste adaptive responses or results into a general ticket. For a suspected data-integrity issue, disable the course first, retain all rows, and escalate before repairing data.

## Legacy Data Audit

The standalone `AdaptiveAssessment*` tables are legacy. They are not part of the active GraphQL or UI feature, but they must not be dropped until staging and production have been audited with `packages/prisma/src/prisma/audits/adaptive-learning-legacy.sql`.

Run on a read replica or with a SELECT-only role:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f packages/prisma/src/prisma/audits/adaptive-learning-legacy.sql
```

The script starts a repeatable-read, read-only transaction, applies short statement/lock timeouts, reports aggregate counts only, and rolls back. Keep the output in the restricted change record.

| Decision                      | Required action                                                                                                                                                   |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CLEANUP_CANDIDATE`           | Confirm the same result in staging and production, obtain product/data-owner approval and a recoverable backup, then create and review a separate drop migration. |
| `SEED_ONLY_MANUAL_REVIEW`     | Verify the known development seed is the only owner of all rows. Do not infer this from total counts alone; approve explicit purge/retention.                     |
| `MIGRATION_DECISION_REQUIRED` | Stop cleanup. Define retention, export, archival, or migration semantics with product, teaching, privacy, and data owners.                                        |

Any nonzero `cross_assessment_responses` value is an integrity incident and blocks cleanup. Never copy row-level participant data into an issue or pull request.

## Ownership And Account Closure

Reusable competence trees are owned content and may carry the meaning of historical attempts. `packages/graphql/src/scripts/transferUserContent.ts:run` includes `competenceTrees` in manual ownership transfer. Before closing an owner account:

1. Identify every owned tree and its linked courses/adaptive quizzes.
2. Transfer the tree, courses, and quizzes to the approved successor in the same controlled operation.
3. Verify linked-course access, owner operations, and historical cohort results after transfer.
4. Do not rely on owner-relation cascade deletion for used trees.

## Engineering Smoke Test

The focused Playwright journey is `playwright/tests/Z-adaptive-learning.spec.ts`. It exercises the course kill switch, depth-5 tree creation and cross-course links, element mapping and inferred parameters, adaptive PracticeQuiz creation/publication with four distinct pool items, five independent four-response participant completions, a persisted final level that must match the student headline, the question timer, and the anonymous released cohort view. Setup removes fixed-name fixtures before creating them, teardown restores every course rollout flag it changed, and persistence assertions prevent a retry from passing on stale state.

Run it only against the dedicated Playwright environment; its global setup deletes and reseeds test data:

```bash
pnpm --filter @klicker-uzh/playwright test -- \
  tests/Z-adaptive-learning.spec.ts --project=chromium
```

This smoke test is release evidence for the engineering workflow. It is not a substitute for the real-course agreement, timing, fairness, teaching, privacy, or operational signoffs below.

## External Signoffs

Engineering can deliver the flag, migration, permission tests, anonymous metrics, browser coverage, and rollback contract. The following remain external production evidence and must be attached to the rollout record rather than checked off from a local build:

- Real-course pilot results against independent teacher labels.
- Teaching-team review and named approval.
- Staging and production legacy-audit output and cleanup decision.
- Deployment-environment permission/privacy verification.
- Support and incident owner acceptance.
