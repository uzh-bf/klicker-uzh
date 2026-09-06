# PR 4920: evaluation metadata and active-block reveal controls

## Approved follow-up

The user requested usable solution and explanation controls while a block runs,
and resolution of the remaining merge blockers. Active questions initialize both
controls off on their first render regardless of saved closed-block settings or
URL flags. An explicit reveal survives polling and navigation back to the same
running question, but does not carry to another question or newly running block.
Closed-block URL behavior, unpublished-content protection, and the separate
results-confirmation overlay remain unchanged.

Authority: implement, verify, commit and push this package to the existing
[evaluation PR](https://github.com/uzh-bf/klicker-uzh/pull/4920), including one
integration of current `v3` and ordinary/final review handling. Merge, approval,
force-push and deployment remain excluded. Retain the exact activity-info-on-eval
runtime for user testing through the next checkpoint.

Route: the executor owns evaluation UI and existing Playwright expectations;
the main session owns HMAC validation, its regression, upstream integration and
final evidence. The HMAC boundary stays with the main session because it is
security-sensitive. Manage startup feedback is addressed by upstream's profile
guard; verify rather than duplicate it.

Acceptance: active controls are enabled and initially off, actual rendered
solutions and explanations follow manual toggles across polling and navigation,
and closed-block behavior still works. Invalid HMAC requests perform only an
identity lookup and never load evaluation relations or cache results. Valid signed
DRAFT/SCHEDULED requests retain metadata-only responses. Tests use a restored,
synthetic APP_SECRET. Run focused GraphQL and host Playwright/browser checks,
applicable package checks and full build in the managed container, then slice
simplification and security review, integrated final review and current-head CI.
Stop only at a real capability, authority or semantic conflict boundary.

The older scope below records the original pre-start fix. This follow-up
supersedes its no-UI-change restriction. No new schema, dependencies, production
data or authorization model is introduced.

Progress: the worktree was fast-forwarded to the pushed head `6484e56bc6`.
The old runtime lacks devrouter's required waitFor configuration, so the single
authorized v3 integration precedes runtime verification. The sole startup-script
conflict retains the working /AddResponse endpoint and upstream GrowthBook host.
The planner's five findings were accepted: explicit reveal-state lifetime,
updated behavioral Playwright coverage, query-order regression, full warmup
guard verification, and the existing review gates.

Planner: APPROVED after accepting the five findings and preserving upstream's
course-visibility filter. The optional Gemini challenge confirmed the need to
define active-to-closed precedence; use existing closed-state behavior. Its URL
rewriting, pre-lookup HMAC validation and narrower metadata proposals are rejected:
URL flags remain meaningful for closed blocks, signing requires the stored
namespace, and activity/course metadata is the explicitly approved feature.
No new rate-limiting layer is part of this bounded correction.

Verification checkpoint (2026-09-06): the authorized integration is committed
as `21f05ef5c`. Root `check:all` and the full build pass in the exact managed
container. The isolated evaluation GraphQL suite passes all five tests, including
invalid-HMAC lookup order and DRAFT/SCHEDULED signed metadata. Redis connection
warnings remain in that mocked-cache suite; this is not response-processing proof.
Browser screenshots confirm enabled, default-off active controls even with both
URL flags true, actual rendered solution/explanation after manual reveal, and
preserved selections after reload. Closed-block manual reveal also works.
The obsolete active-block disabled assertions now check enabled controls,
manual selections, reload persistence and hiding again. The serial Playwright
workflow remains CI-only because its cleanup would erase the retained manual-test
database. Independent reviews and publication are still pending. Keep the exact
activity-info-on-eval runtime running for user testing.

The user requested a fresh v3 integration for devrouter 0.0.55 reliability.
Commit `cffc2cdfb` contains fetched v3 `27f2474547`; no target commits remain
missing at that check. The first ensure overlapped this commit and failed the
runtime-input guard. A subsequent repair exposed a separate preparation failure:
the default Turbo build left an orphan git process in its process group. A
bounded `--no-daemon` probe exited without remaining children. Managed preparation
now uses that flag, and `bash util/test-dev-runtime.sh` passes in the exact
container using temporary fixtures. Runtime recovery must finish before claiming
the retained manual-testing environment is ready again. The evaluation slice
review has no blocking findings; integrated final review and push remain pending.

## Goal

Show the LiveQuiz name, publication status, and course name on a valid signed
evaluation embed before the quiz starts, using the existing unavailable-state
notification.

## Non-goals

- Do not expose ElementInstance content, choices, explanations, feedback, or
  result data before publication.
- Do not change evaluation behavior after publication or ending.
- Do not add UI strings, schema fields, persisted operations, seeds, or
  database changes.

## Design

- Domain: `LiveQuiz` activity metadata is safe to display; `ElementInstance`
  snapshots and evaluation results remain unavailable while the activity has a
  non-published `PublicationStatus`.
- Layers: change only `packages/graphql` service behavior and its focused
  service test. The existing `frontend-manage` query and
  `EvaluationUnavailableNotification` already render the returned metadata.
- Auth: the public embed path still requires the existing HMAC over the
  LiveQuiz namespace and id. Invalid or absent credentials continue to return
  `null`; authenticated no-HMAC reads keep their existing READ permission
  check.
- Payload boundary: for a valid HMAC and a DRAFT or SCHEDULED LiveQuiz, return
  activity/course/status metadata with `results: []`. Do not compute or return
  block or element evaluation data.
- Gamification: no impact. Leaderboards, points, and XP are unchanged.
- Async: no impact. Publication scheduling and Hatchet workers are unchanged.
- UI/i18n: no component or translation changes; the existing unavailable state
  is populated by the newly available metadata.
- Fixtures: use the existing seeded draft LiveQuiz in the GraphQL service test
  and the existing local Calendar Live Quiz 2 for browser verification.

## Slices

1. Change the existing draft-HMAC regression to require safe metadata and an
   empty result list.
2. Confirm the test fails against the current status-filtered query.
3. Load the LiveQuiz before status filtering, validate the HMAC, and suppress
   all evaluation results for signed non-published requests.
4. Run the focused GraphQL test/check and repeat the signed browser flow before
   starting the quiz.

## Progress

- 2026-08-26: Reproduced the missing metadata on Calendar Live Quiz 2 and
  captured the pre-fix screenshot.
- 2026-08-26: Traced the null payload to the HMAC-only PUBLISHED/ENDED Prisma
  filter in `getLiveQuizEvaluation`; confirmed the frontend needs no change.
- 2026-08-26: Added the metadata-only HMAC regression and confirmed it fails
  against the previous status-filtered lookup (`null` instead of metadata).
- 2026-08-26: Updated the service to validate the HMAC and return early with
  `results: []` for non-published signed requests.
- 2026-08-26: Focused GraphQL evaluation suite passes (4/4), GraphQL package
  check and build pass, and the signed browser view shows the Draft activity,
  course, and status metadata while retaining the unavailable notice.
