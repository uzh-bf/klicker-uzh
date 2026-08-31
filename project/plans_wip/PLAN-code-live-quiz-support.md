# PLAN: CODE elements in Live Quizzes

## Goal

Allow lecturers to place one CODE question in a Live Quiz block and let an authenticated course participant submit it through the existing asynchronous CodeAPI receipt lifecycle. A receipt is bound to the exact Live Quiz block execution so delayed grading remains idempotent across block closure and reruns.

## Product boundaries

- A Live Quiz block may contain exactly one CODE element and no siblings.
- Practice Quiz and Microlearning behavior remains unchanged.
- Group Activities and activity templates continue to reject CODE.
- The first slice requires a course-linked Live Quiz, a permanent participant account, and an active course participation. Temporary participants and course-less Live Quizzes receive an explicit unavailable state instead of a broken submit action.
- CODE submissions do not use `/AddResponse`; they keep the dedicated GraphQL receipt, Hatchet grading, polling, and subscription path.
- Participant projections expose public tests only. Instructor evaluation keeps public and hidden aggregate counts without exposing hidden execution output.

## Domain model

`Element` remains the authored source and `ElementInstance` the immutable activity placement. Live Quiz placements belong to an `ElementBlock`, whose `execution` increments when a quiz run is reset. `CodeSubmission` therefore belongs to exactly one of Practice Quiz, Microlearning, or Live Quiz; Live Quiz receipts also snapshot `elementBlockExecution` and use `createdAt` as the accepted response timestamp.

## Authorization and availability

- Authoring continues through the existing Live Quiz write permission checks.
- Submission requires the existing participant GraphQL scope, the requested active course participation, a published course-linked Live Quiz, the matching active block and current execution, and a CODE instance in that block.
- Readback and subscription remain participant-scoped by receipt id and participant id.
- A receipt accepted while the block is active may finish after closure; a new receipt cannot be created once the block is inactive or expired.
- Submission locks the Live Quiz lifecycle row before accepting a receipt, so
  block closure and receipt creation cannot cross unnoticed. Ending a quiz is
  rejected while a block is active or a CODE receipt is still pending/running.

## Async finalization and scoring

- Claiming, retry, rate-limit deferral, failure, and receipt publication reuse the existing CodeSubmission worker.
- Live Quiz finalization writes exactly one `LiveQuizResponse` per participant, instance, and block execution and increments CODE test aggregates exactly once.
- Correctness is the server-computed `pointsPercentage`. Base, correctness, bonus, and XP follow the Live Quiz settings captured through the activity and instance at submission/finalization time; timing uses the receipt creation timestamp rather than CodeAPI completion time, with bonus decay anchored to the first correct response for the instance and execution.
- Active cockpit results are updated in the appropriate Live Quiz Redis namespace. The projection verifies the captured block execution before any Redis write, so a delayed worker from an earlier run cannot affect a reset quiz; a missing or mismatched marker keeps the receipt recoverable instead of completing without projection. Closure aggregation understands CODE so it does not replace finalized test aggregates with an empty result.
- Resetting a Live Quiz increments execution and removes prior activity receipts through the Live Quiz relation.

## Frontend behavior

- Manage accepts CODE in Live Quiz selection, paste, and drag/drop, while applying the shared one-CODE-only rule in Yup and at each interaction boundary.
- The participant PWA renders the existing CODE editor, submits through `useCodeSubmission`, persists a participant/execution-scoped receipt, shows pending/running/completed/failed state, and marks the question answered only after completion.
- Authenticated receipt subscriptions use the participant cookie or an explicit `graphql-ws` bearer connection parameter to establish the same principal as the submission mutation; when supplied, the current bearer takes precedence over potentially stale browser cookies. Polling remains the recovery fallback.
- Failed grading leaves the editor retryable while the block remains active. Unsupported identity/course states show a clear notification.

## Verification

- Policy tests: Live Quiz CODE-only accepted; mixed/two-CODE blocks rejected; Group Activity/template rejection retained.
- Database lifecycle tests: active execution eligibility, inactive/expired/foreign rejection, receipt convergence, delayed finalization after closure, duplicate delivery, failed retry, exactly-once `LiveQuizResponse`, CODE aggregates, hidden-test projection, and execution isolation.
- Typecheck and focused unit/integration tests for Prisma, GraphQL, Manage, PWA, and Playwright.
- Focused verification: the 26-test GraphQL CODE submission suite and the
  22-test export suite pass; Prisma, GraphQL, Manage, PWA, util, and Playwright
  package checks pass. The deterministic Playwright journey creates, adds,
  starts, joins, submits through the real receipt mutation, closes the active
  block, runs the production finalizer, and observes a completed CODE question,
  and typechecks,
  but its focused local launch is blocked because the devcontainer has no
  Playwright browser binary.
- Routed browser proof: created a CODE element, verified the Visibility/Weight
  hit areas, created a Live Quiz with the CODE-only block, started it, joined as
  seeded participant `testuser1`, and rendered the active participant CODE
  editor with public tests. The final click did not create a local receipt, and
  the stack subsequently became unavailable behind its route. `CODE_API_URL` is
  not configured locally, so remote execution completion remains unverified in
  this browser run rather than being inferred from the integration tests.
- Update `docs/domain-model.md`, `docs/graphql-api-layer.md`, `docs/async-and-workers.md`, `docs/frontend-conventions.md`, and the CODE notes in affected repository skills.

## Risks and mitigations

- Block-closure race: serialize receipt acceptance against closure with the Live
  Quiz row lock, retain the captured execution for finalization, and reject quiz
  end while grading is in flight.
- Reruns: include execution in receipt identity and database uniqueness.
- Double delivery: keep the claim lock plus the unique Live Quiz response key and update aggregates only in the winning transaction.
- Redis/DB drift: database writes are authoritative for assessment/history; Redis is an active-cockpit projection, verifies the execution marker atomically before writing, and closure aggregation has an explicit CODE branch.
- Hidden-test leakage: reuse participant-safe GraphQL CODE projections and receipt feedback containing public results only.
