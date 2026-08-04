# Regular Live Quiz Reset

**Original date:** 2026-07-30

**Revised:** 2026-08-04

**Status:** Approved design

**Scope:** Reset ended regular Live Quizzes without changing assessment reset policy or cumulative rewards

## Summary

Activity owners and administrators can reset an ended regular Live Quiz to a reusable draft while keeping the quiz ID, PIN, definition, permissions, and links. Reset removes data that belongs only to the completed run, including its responses and per-quiz leaderboards.

Already awarded cumulative rewards are permanent. Reset does not read, recalculate, subtract, or otherwise change course leaderboard points, participant XP, timeline entries, achievements, awards, or participation records. The implementation therefore needs no reward ledger, reward reconstruction, or rollback tables.

## Product Decision

The reset boundary follows the persistence scope of the data:

- **Per-run quiz data is disposable.** It is deleted so the same Live Quiz can be executed again.
- **Cumulative rewards are permanent.** Once awarded, they remain part of the participant's and course's history.
- **The session leaderboard is per-run data.** `LeaderboardEntry` records of type `SESSION` that belong to the quiz are deleted on reset.
- **The temporary leaderboard is per-run data.** `TemporaryLeaderboardEntry` records for anonymous participants are deleted with the session leaderboard.

This deliberately allows a participant to earn additional cumulative rewards when the reset quiz is run again. Reset never subtracts rewards from the previous run.

## Goals

- Allow an activity owner or administrator to reuse an ended regular Live Quiz.
- Preserve quiz identity, definition, course assignment, sharing, and permissions.
- Delete all data scoped to the completed execution.
- Preserve all cumulative rewards permanently.
- Make the destructive effects and preserved rewards explicit before confirmation.
- Reject unauthorized, assessment, and non-ended resets on the server.
- Keep the operation atomic and safe against concurrent reset attempts.
- Preserve existing assessment reset behavior and authorization.

## Non-goals

- Reversing or recalculating already awarded rewards.
- Recording reward deltas in a reset-specific ledger.
- Retaining an evaluation history for the deleted run.
- Versioning executions or leaderboards.
- Creating a duplicate quiz instead of resetting the original.
- Resetting draft, scheduled, or running quizzes.
- Replacing the existing abort flow for running quizzes.
- Partial reset or user-selectable retention categories.
- Bulk reset.
- Changing assessment reset policy.

## Existing Behavior

Regular Live Quizzes can be aborted while running, duplicated, evaluated after completion, or deleted. They cannot currently be returned from `ENDED` to `DRAFT` for another execution.

Ended assessment Live Quizzes have a separate reset operation. The regular reset must not broaden or weaken its assessment-course authorization rules.

The regular quiz end flow awards cumulative gamification data through existing services. Those services remain unchanged. Reset only removes data directly associated with the completed quiz execution.

## Eligibility and Authorization

A regular Live Quiz is resettable only when all of the following are true:

- Its status is `ENDED`.
- It is not deleted.
- `isAssessmentEnabled` is `false`.
- The actor is the activity owner or holds `ADMIN` or `OWNER` permission on the activity.

Editors, executors, viewers, unrelated users, and unauthenticated callers cannot reset the quiz. Draft, scheduled, and running quizzes are rejected. Assessment quizzes continue to use their existing assessment reset mutation and policy.

The UI hides the action when the known state or permission is ineligible, but the mutation remains authoritative and rechecks every condition inside the reset transaction.

## Data Boundary

### Preserved Quiz Definition

Reset preserves:

- Live Quiz ID, namespace, PIN, and links.
- Name, display name, description, and settings.
- Course assignment and gamification configuration.
- Blocks, elements, element instances, ordering, and question content.
- Direct and derived permissions.
- Sharing and catalog configuration.
- Review metadata unrelated to the completed execution.

### Deleted Per-run Data

Reset deletes:

- `LiveQuizResponse` records for the quiz's element instances.
- Q&A feedback and associated responses.
- Confusion feedback.
- `LeaderboardEntry` records linked to the quiz with type `SESSION`.
- `TemporaryLeaderboardEntry` records linked to the quiz.
- Redis execution data belonging to the completed run.

Regular Live Quiz responses may contain response-level scoring fields, but they are execution artifacts rather than cumulative balances. Their deletion does not subtract from any already awarded course, participant, timeline, achievement, or award record.

Point corrections are limited by the existing application policy to assessment quizzes. This feature rejects assessment quizzes before deletion and does not change the point-correction flow.

### Reset Execution State

Reset:

- Changes the quiz status from `ENDED` to `DRAFT`.
- Clears `startedAt`, `finishedAt`, `availableFrom`, `scheduledPublicationTaskId`, and the active-block relation.
- Returns every block to `SCHEDULED`.
- Clears block start, close, and expiry timestamps.
- Increments every block execution counter so delayed work and old response identities cannot collide with the next run.
- Restores every element instance's `results` and `anonymousResults` to their initial values.

### Permanently Preserved Cumulative Rewards

Reset must not query for mutation, update, delete, decrement, or recompute:

- `COURSE` leaderboard entries and participation course scores.
- Participant XP.
- Daily or weekly timeline entries.
- Participant achievements and their counts.
- Award entries and titles.
- Participation records or other cumulative performance records.

No reward data is included in the reset payload or audit totals. A later execution may award new cumulative rewards through the ordinary end flow.

## Architecture

### Public API

Keep the canonical `resetLiveQuiz(id: String!): ResetLiveQuizPayload!` mutation for regular quizzes. It uses full-access lecturer authentication and object-level administrator authorization.

`ResetLiveQuizPayload` contains:

- `outcome`: the structured reset outcome.
- `activity`: the updated `ActivityInfo` on success and `null` otherwise.

Supported outcomes are:

- `SUCCESS`
- `INVALID_STATE`
- `CONFLICT`

Unexpected database or infrastructure failures remain GraphQL errors. Authentication and authorization failures follow the existing GraphQL behavior and do not disclose whether a quiz exists.

Remove reward-specific outcomes, reward-run identifiers, reversal totals, legacy reconstruction state, and weekly recomputation information from the public and internal reset contracts.

Keep `resetAssessmentLiveQuiz` as an assessment-only compatibility mutation with its existing return shape and authorization policy. It may share low-level execution cleanup helpers only where doing so leaves assessment behavior unchanged.

### Reset Summary

Keep the administrator-protected reset-summary query so the confirmation modal can display the destructive scope. It reports:

- Number of responses.
- Number of Q&A feedback entries.
- Number of confusion feedback entries.
- Number of permanent `SESSION` leaderboard entries.
- Number of temporary leaderboard entries, either separately or included in a clearly named combined leaderboard count.
- Eligibility and a client-localizable reason.

Remove course points, XP, timeline changes, achievement changes, reward availability, and legacy reconstruction from the summary. The summary is informational; the mutation reloads and validates current state.

### Reset Transaction

The regular reset runs in one database transaction:

1. Lock the Live Quiz row to serialize reset and lifecycle transitions.
2. Reload the quiz with permissions and required execution relations.
3. Verify authorization, non-deleted state, regular quiz type, and `ENDED` status.
4. Reset blocks and increment execution counters.
5. Reset aggregate instance results.
6. Delete responses, feedback, confusion feedback, `SESSION` leaderboard entries, and temporary leaderboard entries.
7. Conditionally transition the quiz from `ENDED` to `DRAFT` and clear its execution fields.

Any failure rolls back every database change. A concurrent or repeated request cannot perform a second reset after the first request changes the quiz to `DRAFT`; it returns `CONFLICT` or `INVALID_STATE` according to the observed lifecycle state.

The transaction contains no reads or writes to cumulative reward models.

### End Flow and Database Schema

Restore the regular Live Quiz end flow to its behavior before this feature branch. It continues to award rewards through the existing gamification services without creating a reset-specific record.

Remove the proposed `LiveQuizRewardRun`, `LiveQuizRewardEntry`, and `LiveQuizRewardRunStatus` schema additions, their relations, analytics mirrors, migration, services, generated types, and tests. Because the migration has not landed on the target branch, removing it from the branch leaves no production rollback migration to execute.

The final feature requires no database schema change.

### Cache and Derived Data

After the database commit:

- Invalidate the `LiveQuiz` entity for connected clients.
- Clear Redis execution keys belonging to the completed run.
- Refresh affected frontend activity queries.

Use the existing cache-generation guard so delayed cleanup cannot remove a newer execution cache if the quiz is started immediately after reset. If synchronous cache cleanup fails, enqueue the idempotent cleanup task. A committed database reset remains successful; returning a failure after commit could invite an unsafe destructive retry.

Starting a draft quiz continues to initialize a fresh execution namespace as defense in depth.

No timeline or reward-derived data is recomputed during cache cleanup.

## User Experience

### Action Visibility

Show the reset action for an ended regular Live Quiz only when the current user is the activity owner or an administrator. Preserve the existing assessment action visibility and assessment-course restrictions.

The server remains authoritative if UI data is stale or the mutation is called directly.

### Confirmation Modal

Opening the reset modal fetches the summary with a network-only policy. The modal explains that:

- The same quiz, ID, PIN, questions, settings, course assignment, sharing, and permissions remain.
- Responses, aggregate results, feedback, confusion feedback, and the session and temporary leaderboards are permanently deleted.
- The quiz returns to draft and can be started again.
- Previously awarded course points, XP, timeline rewards, achievements, and awards remain unchanged.
- The deleted run data cannot be restored.

Use one explicit destructive acknowledgment covering the run data deletion. Remove the reward-reversal acknowledgment and all wording that claims cumulative rewards will be reversed.

On success, close the modal, refresh the activity list and relevant course data, and show the quiz as a normal draft. On a structured lifecycle conflict, keep the modal open and show localized guidance. Unexpected errors use the standard error handling.

English and German text are required. Interactive controls retain stable `data-cy` identifiers that are not assessment-specific.

## Audit and Privacy

Record reset initiation, completion, blocked outcome, and unexpected failure using the existing audit mechanism. Include only:

- Acting user ID.
- Live Quiz ID.
- Operation ID.
- Outcome or failure code.
- Aggregate counts of deleted run-data categories when useful.

Do not include participant identities, answers, response payloads, leaderboard contents, or cumulative reward values. Remove reward-run IDs and reversal totals from reset audit events.

An audit delivery failure after a committed reset does not change the mutation result. Existing retry behavior may deliver the audit asynchronously.

## Error Handling and Concurrency

- Missing or inaccessible quizzes follow existing non-disclosing authorization behavior.
- Non-ended or deleted quizzes produce `INVALID_STATE`.
- Assessment quizzes are rejected by the regular reset path and continue to use the assessment mutation.
- A losing concurrent reset produces `CONFLICT` or observes `INVALID_STATE`; it cannot delete data twice while reporting two successes.
- Database failures roll back the complete reset transaction.
- Cache cleanup failures are retried without rolling back or re-running the committed database reset.

## Testing Strategy

### Service and GraphQL Tests

Cover:

- Owner and activity administrator success.
- Editor, executor, viewer, unrelated-user, and unauthenticated rejection.
- Standalone and course-linked regular quizzes.
- Draft, scheduled, running, ended, and deleted states.
- Assessment rejection through the regular mutation and unchanged assessment reset behavior.
- Deletion of responses, Q&A feedback, confusion feedback, `SESSION` leaderboard entries, and temporary leaderboard entries.
- Reset of quiz timestamps, active block, blocks, execution counters, and aggregate results.
- Preservation of quiz ID, PIN, definition, course, sharing, and permissions.
- Exact preservation of `COURSE` leaderboard scores, participant XP, timeline entries, achievements, awards, participations, and cumulative performance records.
- A second run using the incremented execution without response identity collisions.
- Repeated and concurrent reset requests.
- Transaction rollback after an injected database failure.
- Cache generation race protection and cleanup retry behavior.
- Structured outcomes and privacy-safe audit metadata.

Use the real test database and Redis path for transaction, deletion, preservation, and cache behavior. Limit mocks to controlled failure injection for audit and cleanup delivery.

### Frontend and Browser Tests

Cover:

- Reset action visibility by status and permission.
- Summary counts and destructive confirmation gating.
- Copy stating both deleted per-run data and preserved cumulative rewards.
- Successful regular reset and refreshed draft state.
- Structured conflict handling.
- No reward-reversal or reward-unavailable UI.

Verify the real manage frontend in English and German. Capture screenshots of the ended quiz action, confirmation modal, and resulting draft state at desktop and narrow viewports.

### Repository Verification

Run:

- GraphQL code generation.
- Targeted GraphQL service tests.
- Targeted Playwright tests.
- Affected workspace typechecks.
- Prettier formatting checks.
- Linting and static analysis.
- Production builds for affected packages and apps.

The branch diff must contain no reward-ledger schema or migration after the redesign.

## Documentation

Update the engineering wiki with:

- The regular Live Quiz reset lifecycle.
- The distinction between disposable per-run data and permanent cumulative rewards.
- The distinction between aborting a running quiz and resetting an ended quiz.
- The permission and lifecycle constraints.

## Acceptance Criteria

The feature is complete when:

1. An activity owner or administrator can reset an ended regular Live Quiz.
2. Unauthorized users, assessment quizzes, and non-ended quizzes cannot use the regular reset path.
3. The same quiz returns to `DRAFT` with its ID, PIN, definition, course assignment, sharing, and permissions unchanged.
4. Responses, aggregate results, feedback, confusion feedback, `SESSION` leaderboard entries, temporary leaderboard entries, and old execution cache are removed.
5. Blocks are reset and their execution counters are incremented.
6. Course leaderboard points, participant XP, timeline entries, achievements, awards, participations, and all other cumulative rewards remain byte-for-byte unchanged by reset.
7. No reset-specific reward ledger, reward reconstruction, or reward rollback remains in the branch.
8. A failed transaction leaves all quiz state and run data unchanged.
9. Concurrent or repeated reset requests cannot produce two successful destructive resets.
10. The confirmation accurately describes deleted run data and preserved cumulative rewards.
11. Audit metadata contains no participant or response data.
12. Existing assessment reset behavior and authorization remain unchanged.
