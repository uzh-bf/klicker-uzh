# Regular Live Quiz Reset

**Date:** 2026-07-30

**Status:** Approved design

**Scope:** Reset completed regular Live Quizzes without changing assessment reset policy

## Summary

Activity owners and administrators can reset an ended regular Live Quiz to a reusable draft. Reset permanently removes the completed run's responses, aggregated results, feedback, and leaderboards while preserving the quiz definition and identity.

For gamified quizzes, reset also reverses every external reward awarded when the quiz ended: course points, participant XP, timeline contributions, and achievement increments. New runs record exact reward deltas in a durable per-run ledger. A legacy gamified quiz can be reset only when the system can reconstruct a complete ledger from its remaining data; otherwise reset is blocked rather than performing a partial rollback.

## Goals

- Allow activity owners and administrators to reuse an ended regular Live Quiz.
- Preserve the activity ID, links, PIN, questions, settings, course assignment, and sharing configuration.
- Remove all quiz-local data belonging to the completed run.
- Reverse gamification effects exactly and idempotently.
- Make destructive impact visible before confirmation.
- Preserve existing assessment reset authorization and behavior.
- Record reset attempts and outcomes without logging participant identities or responses.

## Non-goals

- Resetting draft, scheduled, or running quizzes.
- Replacing the existing abort flow for running quizzes.
- Partial reset or retention of selected result categories.
- Force-resetting legacy gamified quizzes with incomplete reward data.
- Bulk reset.
- Keeping the deleted run available as evaluation history.
- Changing assessment reset policy.

## Existing Behavior

Regular Live Quizzes already support aborting a running quiz. Abort returns the quiz to draft and clears its current execution state. Ended regular quizzes can be evaluated, duplicated, or deleted, but not reset.

Ended assessment Live Quizzes have a separate reset operation. It returns the quiz to draft, deletes response and feedback data, resets blocks and results, clears leaderboards and Redis keys, and is limited to assessment course administrators and owners.

Regular quizzes have an additional constraint: ending a gamified quiz applies effects outside the quiz itself. The current implementation can add:

- Session scores to the course leaderboard.
- XP to participant totals.
- Points and XP to daily timeline aggregates.
- Rank achievement rewards and achievement-count increments.

Session leaderboard points remain linked to the Live Quiz, but XP is retained per quiz only in Redis and expires after the final block closes. Timeline and achievement records are cumulative. Therefore a complete rollback of an arbitrary legacy gamified quiz cannot be inferred reliably from the database alone.

## Product Behavior

### Eligibility

A regular Live Quiz is resettable when all of the following are true:

- Its status is `ENDED`.
- It is not deleted.
- The current user is an activity owner or has `ADMIN` permission on the activity.
- If it awarded gamification rewards, an applied reward ledger exists or a complete legacy ledger can be reconstructed.

Draft, scheduled, and running quizzes are not resettable. Executors, editors, and viewers cannot reset a quiz.

An ended non-gamified legacy quiz does not require a reward ledger because it has no external rewards to reverse.

### Preserved Data

Reset preserves:

- Activity ID, namespace, links, and PIN.
- Name, display name, and description.
- Questions, content, element instances, ordering, and quiz settings.
- Course assignment.
- Direct and derived permissions.
- Sharing and catalog configuration.
- Review metadata unrelated to execution.
- Reversed reward-run records required for accounting and idempotency.

### Deleted or Reset Data

Reset:

- Changes the quiz status to `DRAFT`.
- Clears `startedAt`, `finishedAt`, `availableFrom`,
  `scheduledPublicationTaskId`, and any active-block relation.
- Returns every block to `SCHEDULED`.
- Clears block start, close, and expiry timestamps.
- Increments block execution counters so delayed work from the old run is rejected.
- Restores instance `results` and `anonymousResults` to their initial values.
- Deletes individual Live Quiz responses when present.
- Deletes Q&A feedback and responses.
- Deletes confusion feedback.
- Deletes session and temporary leaderboard entries.
- Clears all Redis execution keys for the quiz.

### Reversed Gamification Data

For every reward entry belonging to the applied run, reset reverses the exact deltas previously applied:

- Course leaderboard points.
- Participant XP.
- Timeline points and XP in the original daily entry, or in its derived weekly
  entry after the daily source has been compacted.
- Achievement occurrence count.

If the original daily entry still exists, affected weekly timeline aggregates
are recomputed from that week's daily source entries after reversal. If the
daily entry has already been removed by timeline compaction, reset subtracts
the ledgered delta directly from the corresponding weekly entry. If neither
entry exists, no timeline reward remains to reverse.

## Architecture

### Public API

Add a canonical `resetLiveQuiz(id: String!): ResetLiveQuizPayload!` mutation.

The mutation uses full-access lecturer authentication and object-level `ADMIN` permission. The service performs authoritative quiz-type, status, deletion, and reward-ledger checks.

`ResetLiveQuizPayload` contains:

- `outcome`: a reset outcome enum.
- `activity`: the updated `ActivityInfo` on success, otherwise `null`.

Expected outcomes are:

- `SUCCESS`
- `INVALID_STATE`
- `REWARD_DATA_UNAVAILABLE`
- `CONFLICT`

Unexpected failures remain GraphQL errors and are logged. Authorization failures use the existing GraphQL authorization behavior and do not disclose quiz state.

Keep `resetAssessmentLiveQuiz` as an assessment-only compatibility field. It delegates to the shared reset core with the existing assessment policy and retains its current return shape. The new regular-quiz feature does not weaken or otherwise change assessment authorization.

Add an administrator-protected reset-summary query. Its result contains:

- Counts of responses, Q&A feedback, confusion feedback, and leaderboard entries.
- Total course points and XP to reverse.
- Number of timeline and achievement changes to reverse.
- Eligibility and a localized-client-safe reason enum.
- Legacy reconstruction status: `NOT_REQUIRED`, `AVAILABLE`, or `UNAVAILABLE`.

The summary is informational. The mutation reloads and validates all data so a stale summary cannot authorize or execute an invalid reset.

### Reward Ledger

Introduce `LiveQuizRewardRun` and `LiveQuizRewardEntry` models linked to a Live
Quiz and the affected participants. `LiveQuizRewardRunStatus` has the values
`APPLIED` and `REVERSED`.

**Reward run**

- Unique run ID.
- Live Quiz ID.
- Run end timestamp.
- `status: LiveQuizRewardRunStatus`.
- `isLegacyReconstructed: Boolean`, defaulting to `false`.
- Reversal timestamp and acting user.
- Created and updated timestamps.

**Participant reward entry**

- Reward-run ID and participant ID, unique as a pair.
- Course and participation references when applicable.
- Course leaderboard point delta.
- Participant XP delta.
- Timeline date, point delta, and XP delta.
- Achievement ID and occurrence-count delta when applicable.

Achievement reward points and XP are included in the total point and XP deltas. The separate achievement fields record only the occurrence change that must be reversed.

Reversed runs are retained. Each later execution of the same quiz creates a new run rather than reusing a reversed record.

### Ending a Gamified Quiz

The existing end flow will use one reward-calculation result as the source for both mutations and ledger entries. This prevents the rollback ledger from drifting from the values actually awarded.

After reading the final Redis scores and XP, a single database transaction will:

1. Validate that the quiz is still running and ready to end.
2. Calculate rank achievements using the existing rules.
3. Apply course-point, participant-XP, timeline, and achievement deltas.
4. Persist the reward run and participant entries with those exact deltas.
5. Mark the quiz as `ENDED` and set `finishedAt`.

If any step fails, neither rewards, ledger data, nor ended status is committed. Repeated end requests return the already-ended quiz without creating another applied reward run.

Every newly ended regular Live Quiz creates a reward run. A non-gamified run
has no participant reward entries, providing uniform run identity and audit
metadata. Reset does not require a reward run for a legacy non-gamified quiz.

### Legacy Reconstruction

Legacy reconstruction is exact-or-reject. It uses every applicable source from:

- Persisted session and temporary leaderboard entries.
- The unexpired per-participant Redis XP hash.
- Quiz, block, participation, and course-gamification data.
- The same pure rank-achievement calculation used by the end flow.

Before reconstructing, the service compares all expected permanent participants and reward-bearing entries across these sources. It must be able to determine every course-point, XP, timeline, and achievement delta. It then persists the reconstructed applied run and performs reset in the same transaction.

Missing Redis XP, mismatched participant sets, inconsistent scores, or any ambiguous achievement attribution produce `REWARD_DATA_UNAVAILABLE`. No subset is reversed.

### Reset Transaction

The shared reset core runs a conditional transaction at serializable isolation:

1. Reload the quiz and validate status, type policy, deletion state, and permissions.
2. Load the applied reward run or complete legacy reconstruction.
3. Conditionally transition the reward run from `APPLIED` to `REVERSED`.
4. Reverse participant and course reward deltas.
5. Reverse timeline deltas in the original daily entry or, after daily
   compaction, in the corresponding weekly entry.
6. Decrement achievement counts, deleting an instance only when its count reaches zero.
7. Return the quiz and blocks to their initial execution state.
8. Restore initial instance results and delete responses, feedback, and leaderboards.
9. Conditionally transition the quiz from `ENDED` to `DRAFT`.

Only one concurrent transaction can perform both state transitions. A losing request returns `CONFLICT`; it cannot deduct rewards twice. Any database error rolls back the entire reset.

### Cache and Derived Data

After commit:

- Invalidate the `LiveQuiz` entity.
- Delete all Redis keys matching the quiz execution namespace.
- Recompute affected weekly timeline aggregates whose daily source entries
  still exist.
- Refresh activity queries in the frontend.

Cache cleanup is attempted synchronously. If it fails, the service enqueues an
idempotent Hatchet cleanup task with the quiz ID; Hatchet retries the task
according to its workflow policy. The committed reset is still reported as
successful because returning an error after commit would invite an unsafe
retry. As defense in depth, starting any draft quiz clears old execution keys
before writing fresh metadata.

Weekly timeline values are normally derived data. The reset path supports any
historical week rather than only the current cron window. A delayed
recomputation does not change the successful reward reversal stored in
participant, course, timeline, and ledger records.

## User Experience

### Action Visibility

The existing ended-status action list continues to contain `resetLiveQuiz`. Permission filtering changes so:

- Regular quizzes expose it to activity owners and administrators.
- Assessment quizzes retain their existing assessment-course reviewer restriction.
- Other permission levels never receive the action.

The server remains authoritative.

### Confirmation Modal

Generalize the existing `LiveQuizResetModal` and its wording. Opening it fetches the reset summary with `network-only` policy.

The modal requires explicit acknowledgment for each non-empty category:

- Responses and aggregated results.
- Q&A feedback.
- Confusion feedback.
- Leaderboard and external gamification rewards.

Empty categories are shown as not applicable and count as acknowledged. The primary action stays disabled until the summary is loaded and all applicable categories are acknowledged.

The message states that:

- The same quiz will return to draft.
- The listed run data and rewards will be permanently removed.
- Links, PIN, questions, settings, course assignment, and sharing remain unchanged.
- The operation is audited and cannot be undone.

For a legacy gamified quiz with incomplete data, the modal shows the blocking reason and recommends duplicating the quiz. It does not expose a partial-reset override.

### Success and Failure

On `SUCCESS`, close the modal, refresh the activity list and course data, and show the quiz as a normal draft.

For `INVALID_STATE`, `REWARD_DATA_UNAVAILABLE`, or `CONFLICT`, keep the modal open and show localized guidance. Unexpected errors use the standard error toast. The client never treats a missing activity or network error as success.

English and German messages are required. Interactive controls retain stable `data-cy` identifiers; the regular reset identifier must not be assessment-specific.

## Security and Privacy

- Require full-access lecturer authentication.
- Require `ADMIN` object permission for regular quizzes.
- Preserve the additional course-admin/owner policy for assessment quizzes.
- Recheck authorization and status inside the mutation.
- Do not return reset summaries to users who cannot reset the activity.
- Do not log participant IDs, names, answers, or response payloads.
- Keep reward entries limited to the identifiers and numeric deltas required for rollback.

## Audit Behavior

Record reset initiation, success, blocked outcomes, and failures. Entries include:

- Acting user ID.
- Live Quiz ID.
- Reward-run ID when present.
- Outcome or failure-reason code.
- Aggregate totals for reversed points, XP, timeline changes, and achievements.

The reward run also stores durable reversal metadata, including actor and timestamp. This preserves a minimal accounting record even if delivery to the existing asynchronous audit log is delayed.

Audit-event failure before the destructive transaction blocks reset. If the success event cannot be delivered after commit, the reset remains successful, the durable reversal metadata is retained, and audit delivery is retried.

## Testing Strategy

### GraphQL and Service Integration

Cover:

- Owner and administrator success.
- Editor, executor, viewer, and unauthenticated rejection.
- Standalone and course-linked regular quizzes.
- Draft, scheduled, running, ended, and deleted states.
- Assessment compatibility and unchanged assessment authorization.
- Complete deletion and initialization of quiz-local data.
- Preservation of quiz definition, identity, PIN, course, and sharing.
- Reward-run creation with exact deltas when a gamified quiz ends.
- Reversal of course points, participant XP, daily timeline data, weekly derived data, and achievement counts.
- Achievement decrement and deletion-at-zero behavior.
- Repeated and concurrent reset requests.
- Database failure rollback.
- Exact legacy reconstruction success.
- Missing, expired, or inconsistent legacy data rejection.
- Non-gamified legacy reset without a ledger.
- Cache cleanup and clean-start defense.
- Structured outcomes and audit metadata.

Use the real test database and Redis path for reward, legacy reconstruction,
and concurrency behavior. Limit mocks to failure injection for external audit
delivery and cache-cleanup retries.

### Frontend and Browser

Add Playwright coverage for:

- Action visibility by status and permission.
- Summary counts and confirmation gating.
- Successful regular reset and refreshed draft state.
- Blocked legacy reset.
- Structured failure handling.

Verify the real manage frontend in English and German with seeded local data. Capture the ended state, destructive confirmation, and resulting draft state. Check that the modal remains usable at desktop and narrow viewports.

### Repository Verification

Run:

- Prisma migration and schema synchronization checks.
- GraphQL code generation.
- Targeted GraphQL and Playwright tests.
- Workspace type checking.
- Prettier format checking.
- Linting and static analysis.
- A production build of affected packages and apps.

## Documentation

Update the engineering wiki with:

- The regular Live Quiz reset lifecycle.
- The reward-run invariant: external rewards and ledger entries are committed together.
- Exact-or-reject legacy reconstruction.
- The requirement that reset and reward reversal remain one transaction.
- The distinction between aborting a running quiz and resetting an ended quiz.

## Acceptance Criteria

The feature is complete when:

1. An activity owner or administrator can reset an eligible ended regular Live Quiz.
2. Unauthorized users and non-ended quizzes cannot be reset through either UI or API.
3. Quiz-local run data is removed and the same activity returns to a reusable draft.
4. Quiz identity, definition, links, PIN, course assignment, and sharing remain unchanged.
5. Every reward from a ledgered gamified run is reversed exactly once.
6. Incomplete legacy gamification data blocks reset without changing any state.
7. A failed transaction leaves both rewards and quiz state unchanged.
8. Concurrent or repeated requests cannot reverse rewards twice.
9. The confirmation accurately lists destructive effects and requires explicit acknowledgment.
10. Audit metadata exists for initiation and outcome without participant or response data.
11. Assessment reset behavior and authorization remain unchanged.
