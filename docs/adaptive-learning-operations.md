---
type: Operations Runbook
title: Adaptive Learning Operations
description: Course-scoped rollout, rollback, pilot monitoring, calibration interpretation, support triage, and legacy-data audit for adaptive practice quizzes.
timestamp: '2026-07-14'
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
| Unpublish or delete                                          | Allowed. An attempted quiz is retained rather than hard-deleted; unpublish retains its immutable pool.    |
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

## Standard-Setting Protocol

Complete this protocol before enabling a named pilot. The purpose is to establish defensible curricular meaning for each leaf-level assignment; the software's theta mapping cannot create that meaning on its own.

1. The teaching owner writes observable descriptors for every level band and each competence/subcompetence leaf, states the intended use of the result, and approves the theta-band ordering before experts see item assignments.
2. Two subject-matter experts independently assign every pilot item to one leaf and one ordered level. They work from the same descriptor set without seeing each other's labels or the runtime's proposed route. Unsupported, ambiguous, or multi-construct items are flagged instead of forced into a cell.
3. Before reconciliation, report the item count, exact level agreement, same-or-adjacent agreement, and linearly weighted Cohen's kappa with its confidence interval. Predeclare the weighting rule and missing/flagged-item treatment. The pilot gate is weighted kappa `>= 0.70`; do not compute kappa after adjudication and present it as independent agreement.
4. Reconcile every disagreement in a recorded meeting. A third expert adjudicates unresolved cases. No item with an unresolved disagreement greater than one band enters the pilot, and no unresolved leaf disagreement is silently resolved by averaging.
5. The two experts and teaching owner approve the final assignments, level descriptors, ordered boundaries, mapping rule, and capped/near-boundary result wording. Placement and Diagnostic retain `a = 1.2`; any empirical discrimination change is a separately reviewed Research/calibration decision.
6. Archive the pre-reconciliation labels, agreement output, adjudication decisions, final blueprint counts, signatories, and date in the restricted pilot record. Store no participant responses in this artifact.

Repeat the affected parts whenever descriptors, boundaries, item wording, controlled answers, leaf assignments, or level assignments change. Expanding a bank with new items requires independent labels for those items before publication.

## Rollback Procedure

1. Invoke `MSetCourseAdaptiveLearningEnabled` with the course id and `enabled: false`.
2. Verify the adaptive quiz has disappeared from participant discovery and direct bootstrap returns no quiz data.
3. Decide whether to leave the quiz published but disabled for investigation or unpublish it. Before the first attempt, a draft quiz may be converted to STANDARD. After an attempt exists, unpublishing retains the exact immutable pool and a later republish reuses it; create or duplicate a separate standard quiz if non-adaptive delivery is required. Do not delete attempts or pool snapshots during incident triage.
4. Use the retained anonymous cohort view to inspect aggregate stop reasons and integrity warnings.
5. Communicate that adaptive delivery is paused. Do not interpret a disabled participant-result endpoint as lost data.
6. Re-enable only after the incident owner records the cause, remediation, and verification evidence.

Disabling does not retroactively change results. If a result was used for a decision, the teaching team owns the correction and communication process.

Unpublishing is the narrower quiz-level takedown. While unpublished, a participant cannot start, resume/read state, restart, or submit and receives `ADAPTIVE_QUIZ_UNAVAILABLE`; abandoning an owned active attempt remains available. Republishing an attempted quiz reuses the same immutable pool. A staging rehearsal must prove that an unsubmitted active attempt resumes with the same `nextPoolItemId` after republish and that no response or duplicate attempt was created during the pause.

Course deletion is not a rollback mechanism once adaptive attempts or aggregate snapshots exist. The service returns `ADAPTIVE_COURSE_HISTORY_RETAINED` after locking the course, quizzes, and adaptive configs; Manage keeps the deletion modal open and directs the owner to archive the course. A competing attempt start and course deletion serialize in both lock orders, so the outcome is either an unused deleted course or durable retained history, never a partially deleted adaptive record. `ADAPTIVE_COURSE_DELETION_CONFLICT` is retryable operational contention, not permission to bypass retention.

## Phase 10 Migration Procedure

These roles must be named in the restricted change record before staging or production execution:

- **Release engineer:** runs the exact reviewed commit and Prisma deploy command, records start/end time and exit status, and stops the application rollout on any failed migration.
- **Database-operations owner:** approves the backup and tested restore point, watches locks and database health, decides whether an untouched environment may be restored, and owns any forward repair.
- **Adaptive feature owner:** confirms every real course remains disabled, runs the post-deploy retention/kill-switch checks, and gives the application go/no-go decision.

The repository does not define an automated production migration job. Run `pnpm --filter @klicker-uzh/prisma run prisma:deploy:qa` or `prisma:deploy:prod` only from the approved release environment; those commands resolve the database URL through Infisical and call `prisma migrate deploy`.

### Before deployment

1. Record the commit SHA, target database, current `_prisma_migrations` head, named roles, and the default-off adaptive-course allow-list. Stop if an unapproved real course is enabled.
2. Take the platform-approved backup/snapshot. Restore it into an isolated PostgreSQL 17 environment and prove that the database opens, the migration history is readable, and the aggregate preflight below completes. Record the backup id and restore evidence. A backup without a tested restore is not a go decision.
3. On an expendable PostgreSQL server, replay all prior migrations, the populated malformed fixture, and the three Phase 10 migrations:

```bash
DATABASE_URL="$DISPOSABLE_POSTGRES_ADMIN_URL" \
  pnpm --filter @klicker-uzh/prisma run verify:adaptive-migration
```

4. From a secret-injected, SELECT-only staging/production shell, run the aggregate preflight. It uses repeatable-read/read-only mode, a 2-second lock timeout, and a 2-minute statement timeout and emits no participant ids or response content:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f packages/prisma/src/prisma/audits/adaptive-learning-phase10-preflight.sql
```

Every `invalid_*` count must be zero. `repairable_*` counts may be nonzero only when the feature owner has reconciled them to the deterministic migration policy: an unresumable in-progress attempt becomes abandoned; a missing pool/snapshot is restored only from its unique immutable pool identity; terminal lifecycle fields are canonicalized. Any invalid numeric value, non-contiguous response order, or unresolvable pool identity is an abort, never an invitation to guess at student evidence.

5. Check database activity for long-running transactions or DDL. Start only inside the approved maintenance window. The repair migration enforces a 5-second lock timeout and a 15-minute statement timeout; either timeout is an abort. Do not raise these limits ad hoc.

### Execution and monitoring

Keep every adaptive course disabled. The release engineer runs the environment-specific deploy command once while database operations watches lock waits, blocked sessions, replication lag, CPU, storage, and error rate. A migration lock wait approaching 5 seconds, any deadlock/timeout, unexpected row-count growth, replication-health failure, or nonzero command exit stops the application deployment. Do not edit `_prisma_migrations` or mark a failed migration applied by hand.

Each migration is transactional. If a later migration fails after an earlier one committed, leave the committed safety improvement in place, diagnose against a restored clone, and resume with a reviewed forward fix or the unchanged idempotent deployment command.

### Post-deployment

1. Re-run the aggregate preflight. All `invalid_*` and `repairable_*` counts must now be zero.
2. Verify that the six `apqa_*`/`apqr_*`/`apqe_*` runtime constraints report `convalidated = true`; the owner, attempt/config, attempt/quiz-course, and direct attempt/course foreign keys must be validated with `confdeltype = 'r'` (`RESTRICT`).
3. In staging, prove direct deletion of an attempted quiz/course fails, participant erasure removes that participant's attempts, and account deletion is blocked until tree ownership transfer completes.
4. Rehearse both takedown levels with active test attempts. Course disable must make submit fail closed while support/cohort access and abandon remain available; re-enable must resume the same immutable item. Quiz unpublish must return `ADAPTIVE_QUIZ_UNAVAILABLE`; republish must resume the same item and pool. Confirm no duplicate response or attempt.
5. Keep production courses disabled until the feature owner attaches this evidence and the remaining pilot gates approve a named allow-list entry.

There is no destructive down migration. A full restore is permissible only when operations proves that no writes of any kind occurred after the backup and the application rollout has not begun. After any post-backup write, keep the course gate disabled and ship a reviewed forward fix; restoring would discard unrelated data and retained adaptive history.

## Pilot Monitoring

The adaptive evaluation route reports only released selected-attempt aggregates. `packages/graphql/src/services/adaptivePracticeQuizCohort.ts` selects one canonical completed attempt per participant in bounded batches, while `packages/graphql/src/services/adaptivePracticeQuizDiagnostics.ts` computes median/P95 question count and known elapsed time, near-boundary rate, missing-duration detection, response/estimate count mismatches, exposure, and item-fit summaries. Per-question elapsed time is client-reported, restricted to whole seconds in `0..86400`, and suitable only as a screening diagnostic. `packages/graphql/src/services/adaptivePracticeQuizPrivacy.ts` is the single k=5 policy for categorical, binary, known/missing, anomaly, percentile, and item metrics. Every withheld field is `null` with a typed field/reason record; a withheld boolean is never serialized as `false`. A response-count mismatch that cannot be released emits only event type and quiz id to restricted operational logs; it never logs counts, participant/attempt ids, response content, or timings.

Item diagnostics report:

- Item response count and exposure rate.
- Observed correctness.
- Expected correctness from the immutable 3PL item snapshot and the root-specific pre-response routing estimate replayed in response order.
- Observed-minus-expected residual at 30 or more responses.
- Exposure above 40 percent and absolute residual at least 0.25 as review flags.

These are screening diagnostics, not calibrated item parameters. Expected correctness inherits the lecturer-assigned level anchor and fixed/research discrimination assumptions. Never auto-relevel an item or change a student's result from this table. Review flagged items with teaching staff, response-space validity, content evidence, and independent item-level judgement.

### Required Privacy Rules

- Completed attempts are released only when distinct completed-participant count reaches a multiple of five. Retakes and new participants between release boundaries remain hidden until the next boundary.
- The first authorized lecturer read at a boundary lazily writes one `AdaptivePracticeQuizCohortSnapshot` for the config, release size/watermark, attempt-selection policy, and policy version. Concurrent first reads converge on the same unique row; participant submission never writes a snapshot.
- Snapshot JSON is server-generated aggregate data only. The model has no participant, participation, attempt, username, response, theta, or person-level timing field. Never add one without a new privacy review and migration.
- Cohort size is `null` before the first release. In-progress and abandoned lifecycle counts are not part of the public cohort API.
- Attempt selection (`FIRST_COMPLETED` or `LATEST_COMPLETED`) is applied only to the fixed released set, preventing a retake from changing analytics one at a time.
- Every released binary value and its complement must be zero or at least five. This includes stop reasons, insufficient-data and near-boundary counts, integrity mismatches, and missing-duration indicators.
- Every level distribution includes insufficient-data as a categorical cell; any non-empty cell from one to four suppresses the whole distribution.
- Percentiles are returned only when known and missing source populations are each zero or at least five. One missing or one known duration therefore withholds both timing percentiles and the missingness indicator.
- Item exposure uses complementary-cell suppression: exposed or unexposed counts from one to four hide exposure counts/rates.
- Correct/incorrect cells from one to four independently hide observed and expected correctness even when exposure itself is releasable.
- Residuals remain hidden below 30 responses even when the k-anonymity cells are valid.
- The UI distinguishes a privacy-withheld value from a genuine zero/false and from a metric that lacks the minimum diagnostic sample. The support record must not contain participant identities or individual adaptive outcomes.

The field-level matrix is covered at cohort sizes 0-15, including release boundaries, singleton complements, known/missing timing, integrity anomalies, insufficient results, item cells, retakes, deletion, concurrent first reads, and repeated polling. Participant/attempt erasure invalidates every snapshot for that config through a database trigger. The next authorized read may generate only the currently complete lower boundary; a formerly released higher boundary stays invalid until five complete participants are again available. This prevents a one-person deletion from being exposed as a one-person aggregate delta while honoring erasure. Retention or export of invalidated aggregate rows requires explicit privacy-owner approval.

## Operational Signals And Alerts

`packages/graphql/src/services/adaptivePracticeQuizEvents.ts` is the allow-list boundary for adaptive operational output. Events may contain course/quiz ids, lifecycle phase, stop reason, aggregate answered-question count, retry number, release size, aggregate object count, and snapshot-generation duration. They must never contain participant/attempt ids, usernames, raw or normalized responses, element content/solutions, theta, standard error, level result, or exact individual timing. Event-schema changes require a privacy review and an allow-list test before deployment.

Create these restricted dashboards from the structured JSON `event` field:

| Dashboard      | Required panels                                                                                                                                                                     |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime health | Starts/completions/abandonments, completions by stop reason, `TOTAL_QUESTION_CAP` and `POOL_EXHAUSTED` rates, transaction retry/exhaustion, and course-gate denials by course/quiz. |
| Integrity      | Replayed, stale, foreign, and invalid-pool rejections by quiz; publication blocks; source-sharing revocations.                                                                      |
| Cohort service | Snapshot generated/cache-hit/failed counts, generation p50/p95/p99 by release size, and invalidated-row backlog from an aggregate database health query.                            |
| Pilot quality  | Released hard-cap, near-boundary, missing-duration, exposure, and item-residual metrics from the privacy-safe lecturer view. Do not reconstruct these from participant logs.        |

Configure alerts with the named adaptive feature owner and operations on-call:

| Signal                    | Initial threshold                                                           | Required response                                                                                                           |
| ------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Pool exhaustion           | Any completed production-preset attempt with `POOL_EXHAUSTED` in 15 minutes | Disable the course if repeated; inspect publication readiness and immutable pool integrity.                                 |
| Integrity rejection spike | At least 3 for one quiz or 10 globally in 5 minutes                         | Check client/version mismatch or abuse; disable the affected course when unexplained.                                       |
| Retry exhaustion          | Any `EXHAUSTED` event in 5 minutes                                          | Page operations; inspect database locks/deadlocks and preserve the failed request context without participant data.         |
| Cohort snapshot failure   | Any failure, or generation p95 above 2 seconds for 15 minutes               | Keep participant delivery running; disable lecturer cohort reads if repeated and inspect query plans/locks.                 |
| Hard-cap rate             | Above 25% once at least 20 completions exist in the rolling pilot window    | Pause expansion and review classification reachability, item bank, and boundary learners with teaching/psychometric owners. |
| Course-gate denials       | More than 5 for one course in 5 minutes after a planned disable             | Confirm the kill switch is intentional and communicate the pause; investigate stale clients only if traffic persists.       |
| Sharing revocation        | Any affected adaptive quiz                                                  | Require a fresh readiness/publication authorization review before republishing or replacing its pool.                       |

Before enabling a pilot, fire one synthetic event of each alertable class in a non-production environment or use the monitoring platform's test facility. Record dashboard links, alert delivery time, on-call acknowledgement, course-disable rehearsal, false-positive disposition, and the named feature/operations owners. Alert rules are not production evidence until this drill succeeds. Retain operational events according to the platform's restricted-log policy; do not export them to lecturer analytics.

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

Reusable competence trees are owned content and may carry the meaning of historical attempts. The owner foreign key is `RESTRICT`, so deleting an owner cannot cascade a tree. `packages/graphql/src/services/adaptiveLearningAccountClosure.ts` provides the locked preflight and idempotent transfer; `packages/graphql/src/scripts/transferUserContent.ts:run` invokes it in the same transaction as the other owned-content transfer. The script requires `TRANSFER_USER_CONTENT_SOURCE_USER_ID` and `TRANSFER_USER_CONTENT_TARGET_USER_ID` and does nothing merely by being imported. Each changed tree writes an internal `COMPETENCE_TREE`/`OWNER_TRANSFERRED` activity record; rerunning the successful transfer creates no duplicate changes or audit rows.

Before closing an owner account:

1. Run the adaptive account-closure preflight and identify every owned tree and its linked courses/adaptive quizzes.
2. Approve a valid successor account, then transfer the tree, courses, and quizzes in the same controlled operation. Source and target users are locked in deterministic id order before tree rows.
3. Re-run the preflight; it must report zero remaining source-owned trees. Verify the audit records, linked-course access, owner operations, and historical cohort results.
4. Delete the source account only after the complete content-transfer preflight passes. Treat a foreign-key rejection as retained-history protection, not as a reason to disable the constraint.

## Engineering Smoke Test

The focused Playwright journeys are `playwright/tests/Z-adaptive-learning.spec.ts` and `playwright/tests/Z-adaptive-learning-release.spec.ts`. Their 13 Chromium tests exercise the course kill switch, depth-5 tree creation and cross-course links, failed element-mapping recovery through a real server validation conflict without duplicate creation, semantic assignment-table navigation and mobile overflow, adaptive PracticeQuiz creation/publication, transient result/submission recovery, all five valid element types, zero-answer resume and start-over, a committed restart whose response is lost, unknown elapsed-time resume, stale/concurrent duplicate submission rejection, immediate unpublication revocation, negative owner/course/student metadata boundaries, explicit `MASTERY`/`NEAREST` level-band interpretation, retained-history course deletion guidance, English/German mobile and desktop results, fixed five-person and ten-person anonymous releases, singleton duration suppression, and complementary-cell suppression. Setup removes fixed-name fixtures before creating them, teardown restores every course rollout flag it changed, and persistence assertions prevent a retry from passing on stale state.

Run it only against the dedicated Playwright environment; its global setup deletes and reseeds test data:

```bash
pnpm --filter @klicker-uzh/playwright test -- \
  tests/Z-adaptive-learning.spec.ts \
  tests/Z-adaptive-learning-release.spec.ts \
  --project=chromium
```

This smoke test is release evidence for the engineering workflow. It is not a substitute for the real-course agreement, timing, fairness, teaching, privacy, or operational signoffs below.

## External Signoffs

Engineering can deliver the flag, migration, permission tests, anonymous metrics, browser coverage, and rollback contract. The following remain external production evidence and must be attached to the rollout record rather than checked off from a local build:

- Real-course pilot results against independent teacher labels.
- Teaching-team review and named approval.
- Staging and production legacy-audit output and cleanup decision.
- Deployment-environment permission/privacy verification.
- Support and incident owner acceptance.
