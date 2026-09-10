# Preserve question-generation review decisions and transitions

## Approval summary

Lecturers approve or reject generated question designs and plans before the
workflow continues. Decision recording and the resulting build updates currently
live beside provider dispatch in one orchestration service. Existing tests cover
several retries and conflicts with mocked database calls. They do not establish
which concurrent decision wins or which stale writes PostgreSQL rejects.

This package groups the existing decision insert and two review build updates
behind explicit service functions, then proves their current behavior with a
synthetic disposable database. Provider searches and dispatch remain in the
orchestrator. Both design and plan gates retain their current decisions, warning
acknowledgement rules, recovery window, errors and returned build behavior.

This is a behavior-preserving extraction, not a claim of exactly-once provider
execution. The decision insert currently has no atomic build-owner/status guard;
the later build updates do. Polling also has a narrower outer failure handler
than those updates. Tests must expose both limitations rather than silently
strengthen the rules. A required behavior or policy correction pauses extraction
for a separate decision. No schema, dependency, provider policy, cancellation,
expiry or accounting change is proposed. Reviews create no new spend.

Approval authorizes implementation and synthetic tests in an independent guarded
disposable runtime, native verification, required reviews, local commits, an
ordinary task-branch push and a draft PR against v3-ai. The package finishes with
reviewed source, honest CI status, roadmap reconciliation and the runtime stopped.
Merge, ready conversion, deployment, retained-data reset and deletion remain
separate actions. The user approved implementation on 2026-09-09 and reaffirmed
continuation after the runtime repair merged.

## Execution details

### Working context and ownership

Baseline: origin/v3-ai at 39571575b720328c9756dd9e4bef4950a4eeced0, including
[PR #5849 — incomplete publication transitions](https://github.com/uzh-bf/klicker-uzh/pull/5849).
Repository: /Volumes/HOME/Git/klicker/klicker-uzh.
Worktree: trees/rs/question-review-transitions.
Branch: rs/question-review-transitions; target: v3-ai.
Artifacts root: project/. Full-path package because database integrity and
provider recovery cross a service boundary. One cohesive ordinary PR; no stack
or new generic state-machine abstraction is needed.

This is a bounded part of W4 — lifecycle services. The active roadmap is
project/2026-09-03-v3-ai-pre-release-improvement-roadmap.md in the worktree for
rs/v3-ai-production-readiness. This main consolidation task owns the roadmap
boundary. KB/KG, response-example, participant-practice and release owners retain
their work. The previous publication package is merged; its source ownership
is separate from the design/plan review protocol here.

Authority: implementation approved; execute the sequence below.
Terminal: reviewed implementation, ordinary push and draft PR, stopped runtime,
and roadmap receipt; CI pending is reported separately from merge readiness.
Boundary owner: main consolidation session.
Pause: baseline behavior contradicts the contracts below; preserving it needs a
new product/security/data decision; provider, schema or accounting changes become
necessary; or guarded disposable-runtime proof is unavailable. Routine check
failures and in-scope review corrections remain execution work.

### Existing writes and binding contracts

All three writes currently live in packages/graphql/src/services/questionGeneration.ts.

| Writer | Contract to retain |
| --- | --- |
| reviewQuestionGenerationGate decision insert | Insert id, buildId, gate, decision, reviewerId, normalized warningsAcknowledged, pinned artifact and reviewedAt. The database supplies createdAt. Preserve unique(buildId, gate), UUID/time generation and P2002 propagation to the existing reconciliation branch. This insert does not atomically recheck build owner or status. |
| dispatchQuestionReviewLeased recovered FAILED/CANCELLED branch | Match build id, owner, gate-specific waiting status and lease token. Write FAILED/failed, WORKFLOW_FAILED or WORKFLOW_CANCELLED, the existing message, non-retryable flag and completion time. A miss remains a silent no-op. |
| dispatchQuestionReviewLeased normal advance | Match the same id/owner/waiting-status/token predicates. APPROVE moves DESIGN to GENERATING_ITEMS/stems and PLAN to FINALIZING/finalizing, clearing completedAt. REJECT moves either gate to REJECTED/rejected and sets completedAt. A miss throws CONCURRENT_MODIFICATION. |

Move these writes to packages/graphql/src/services/questionReviewLifecycle.ts
with named functions for recording the decision, recording recovered workflow
failure and advancing the reviewed build. Move the existing pure gate/decision
state mapping alongside them if needed to keep one authoritative mapping; do
not duplicate it or introduce a generalized transition framework. Use narrow
existing Prisma/context types without importing orchestration back into the new
module. Preserve call order, return/throw behavior and every mutation field.

Keep preview access, question-type/owned-build lookup, accounting eligibility,
artifact/summary checks, warning acknowledgement and repeated/conflicting decision
reconciliation in reviewQuestionGenerationGate. Existing APPROVE decisions
normalize acknowledgement to true; REJECT retains its supplied flag. The unique
constraint resolves competing inserts. Repeated equivalent decisions reuse the
stored review id; conflicting decisions throw REVIEW_CONFLICT. Preserve the
existing P2002 reload behavior, including rethrow when no matching review appears.

Keep questionReviewEvent, provider lookup, dispatch identity (build and review id),
recovery timing and uncertainty classification in orchestration. A fresh stored
review on a retry does not immediately redispatch; allowNewDispatch permits the
initial dispatch. A recovered failed/cancelled run takes the failure branch;
other recovered results and successful dispatch take the normal advance. Leave
resumeQuestionReviewDispatch lease acquisition and token-scoped cleanup unchanged.

The direct review mutation and getQuestionGenerationBuild polling share the
leased dispatcher but have different outer error behavior. Direct mutation
propagates a CONCURRENT_MODIFICATION after cleanup. Polling catches it and can
write FAILED using only id and lease token. Owner/status changes with the same
token can therefore reject the advance yet permit that outer failure; replacement
tokens block both and are not cleared by old cleanup. Owner changes can also
make the final owned-build reload return QUESTION_GENERATION_BUILD_NOT_FOUND.
Characterize transition and public caller outcomes separately. The outer polling
catch, other synchronization writers and start/final-save services stay unchanged.

ADR 0017 keeps reviews on the existing generation build without new spend. Assert
spend rows, quota, drafts and source graph pointers remain unchanged through all
review paths, including rejection and recovered workflow failure. Do not introduce
settlement or release because a state sounds terminal.

### Delegation Map and sequence

| Slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| 1 — characterize and extract review transitions | executor | Main provisions and proves the independent guarded runtime first; approved plan committed. | Finite database matrix passes against unchanged source, then after extraction; existing relevant suites stay green; exact diff preserves contracts. |
| 2 — verify, review and deliver the package | main | Accepted executor output and immutable implementation commit. | Native checks and required reviews pass; exact runtime stops; draft PR readback and roadmap receipt reflect the complete package. |

Executor owns questionGeneration.ts, new questionReviewLifecycle.ts and
packages/graphql/test/questionReviewLifecycle.integration.test.ts. Changes to
questionGenerationLifecycle.test.ts are limited to consequential missing coverage
or required import adjustments. The executor may not delegate, publish or alter
runtime ownership. Main retains integration, policy decisions, runtime identity
and external delivery because those are coupled authority boundaries.

### Verification and execution boundary

Use createDisposableTestPrismaClient and existing synthetic fixture patterns.
Main proves the restricted login and marked task database before mutations,
using the smallest devrouter profile sufficient for GraphQL database suites.
Read the current runtime/database skills at execution time. Keep cleanup scoped
to test-owned records; do not reset retained databases. Mock external runtime and
preview configuration only, keeping real database predicates and accounting state.
All barriers/interceptors belong to tests; private orchestration stays private.

Characterize through public design/plan mutations and polling before production
edits. Reuse current mocked recovery tests instead of copying them into another
mock-only suite. The database matrix covers these distinct boundaries:

- Both gates and both decisions: correct next status/stage and completedAt;
  review identity, artifact and acknowledgement persisted; warning rejection
  creates no decision or provider effect. Existing identical decisions reuse
  the persisted id; conflicting decisions retain it and reject the newcomer.
- Competing insertions: force both callers past the no-review read, then use
  real unique-constraint arbitration for equivalent and conflicting decisions.
  Assert one decision row and caller/provider results; do not assume one caller
  alone owns the lease or that provider execution is globally exactly-once.
- Stale input at insert: change owner/status after the checked read and before
  insert. Record the current persisted-row and subsequent reload/lease outcomes;
  do not turn read-time checks into a new atomic insert guard during extraction.
- Leased writes: replace owner, waiting status or token immediately before each
  SQL update. Prove matched updates, no-op recovered failures and failed advances.
  Cover both direct mutation and pending-review polling where outcomes differ.
  Verify finally cleanup cannot clear a replacement token. Shared predicate
  matrices need not be repeated for every gate when both mappings are covered.
- Dispatch recovery: pre-existing review/run, fresh retry without a run, expired
  retry, uncertain dispatch followed by recovered run or still unknown result,
  and recovered FAILED/CANCELLED. Exercise provider mocks through public callers
  and assert retained review identity and the exact caller/database outcome.

Use controlled provider promises or Prisma query interception at the relevant
post-check/pre-write seam. Timeouts are harness failures; release barriers in
finally blocks. Preserve existing tests for non-P2002 errors and invalid inputs;
add only gaps established by the coverage inventory. Assert accounting and draft
invariance across the matrix with minimal test-owned data, not seed contents or
prose. Baseline and post-extraction receipts must be distinct.

Confirm exact Vitest file selection with list --filesOnly. Run the new suite and
existing questionGenerationLifecycle, elementGenerationLease, accounting,
dispatch, and relevant completion/start-failure suites. Use the GraphQL package's
existing test command without an extra -- separator. Generate/build serially,
run package types and repository-required checks/builds, and confirm tracked SDL
and schemas stay unchanged. Container-owned toolchain work stays in the exact
container; Git and host validators stay on the host. Do not start a browser:
this package changes no UI, GraphQL operation, auth or redirect contract.

Commit the cohesive implementation slice after verification, then run simplifier
and one data-integrity/service-seam slice review in parallel. Disposition findings
and rerun affected checks. Stop the exact runtime and verify source-matched
provider Stopped plus zero routes. Run the integrated final review on the committed
package. Ordinary push and draft PR follow passed gates, including whole-branch
body/readback and accurate local versus hosted CI evidence. Main reconciles the
roadmap while preserving other owners. No automatic merge, ready conversion,
deployment, cancellation/expiry implementation or runtime deletion follows.

## Progress

2026-09-09: User authorized preparation of this concrete plan after the publication
package merged. Created the task worktree at 39571575b7. Main mapped the three
writes and public callers; a read-only explorer owns the existing coverage matrix.
No application source edited, runtime started or database accessed. Native planner
review precedes plan presentation; human implementation approval remains pending.

Native planner round 1: APPROVED, no blocking revisions. Main accepted the
review: the baseline writer contracts, caller asymmetry, finite test seams and
dependency direction agree with source. This is technical review only.
The optional external Gemini opinion was not run: automatic approval review
rejected sending the unpublished plan/source to that provider without explicit
payload/destination authorization. Required native planning review is complete.
Human implementation approval remains pending.

Coverage inventory completed: existing DESIGN claim ordering, recovered re-entry
and opposing P2002 loser cases use mocked database writes. The new matrix fills
the real review-specific concurrency and recovery gaps. Main rejected expanding
it to a full Cartesian product or introducing accounting settlement; corrected
command guidance preserves file arguments without an extra -- separator.
Evidence: project/_local/reviews/2026-09-09-question-review-coverage.md.
The approved contract is unchanged; no second planner round is required.

### Execution start blocked — 2026-09-09

The user approved execution and an active goal now records the approved scope.
Before any source or database change, the exact task runtime startup command was
rejected by automatic approval review: its gate reported a provider usage limit
resetting at Sep 15th, 2026 7:42 AM. No workaround was attempted.

Current state: worktree trees/rs/question-review-transitions is clean at
39571575b720328c9756dd9e4bef4950a4eeced0, tracking origin/v3-ai, with only this
uncommitted plan and review records. Runtime rs-question-review-transitions was
not started; no disposable database was accessed; no baseline characterization,
extraction, verification or publication occurred. The native planner approval
and coverage inventory remain valid for this unchanged plan.

Next action on capability recovery: start the exact runtime through the managed
lifecycle with escalation, prove the restricted disposable database identity,
commit the plan, and dispatch the approved executor slice. Then continue the
plan's verification, reviews, runtime shutdown, draft delivery and roadmap steps
without re-opening settled decisions. A hard spend limit before then still
requires checkpoint, notify and stop rather than consuming the remaining window.

### Resume evidence — 2026-09-10

User confirmed prompt-catalog exclusion and agreed to defer experimental
participant practice. The consolidation roadmap and blocker matrix record the
reduced RC scope; the approved lifecycle package remains next.

Canonical host-side devrouter startup reached Devsy but failed because Azurite
could not bind 127.0.0.1:10003. The exact provider workspace is
rs-question-review-transitions; compose project default-rs-95240. Canonical stop
reported remaining workloads. Source-matched workspace listing proves zero
routes; Docker metadata shows seven residual dependency containers running.
No application edits or database characterization ran. Do not claim the runtime
is stopped or bypass lifecycle ownership with raw Docker mutations. Resume needs
managed residual-workload cleanup and a collision-free supported startup.

### Managed recovery diagnosis — 2026-09-10

Installed devrouter 0.0.64. Exact Devsy provider reports Busy; the app and Azurite
containers are Created, while seven dependencies remain Running. CLI source
inspection found the no-baseline stop path checks stopProjects for running
containers and throws `Workspace workloads remain running after stop.`
The failed initial startup did not establish the retained managed baseline.

The Compose overlay supports KB_GRAPH_BLOB_HOST_PORT. A retry with the
11003 override and a subsequent explicit `ensure --repair` both terminate
with `Lifecycle admission is blocked.` The override has not been applied;
11003 availability has not been qualified. Remote fetch succeeded. No raw
Docker mutation, lifecycle-state edit, runtime deletion or database test ran.

Next: repair the owning devrouter no-baseline recovery path in its own scope,
then use canonical stop and source-matched proof before retrying startup with
a verified available Blob port. Application implementation remains gated on
the approved real-database baseline characterization.

### Recovery qualified — 2026-09-10

Published devrouter 0.0.67 installed with Volta. Two remaining defects repaired
in https://github.com/rschlaefli/devrouter/pull/80 (draft): journal subcommand
parsing and ownership-proven stop before the first retained baseline. Local
repair is installed at /Users/roland/.local/bin/devrouter. Use that exact binary
for this runtime until upstream ships the fix: the published Volta binary
cannot read newer upstream journal fields written by the repair baseline.
No PATH configuration changed.

Canonical stop, ensure with KB_GRAPH_BLOB_HOST_PORT=11003, and exec node --version
all passed. Full startup reported healthy services, running processes and no
drift. Final stop removed 11 routes; fresh Devsy status Stopped and zero running
containers for this task. All volumes retained. Local repair verification:
2094 tests pass, typecheck/build pass. Independent review pending after malformed
first reviewer output. No generation application extraction has started.

Resume with the exact local repaired CLI and Blob port override; verify the
guarded disposable database before the approved baseline characterization.

Recovery closeout: independent review approved source through 3576daa; current
PR #80 head a23fb84 has passing CI. Runtime remains Stopped with zero routes.
Use /Users/roland/.local/bin/devrouter and KB_GRAPH_BLOB_HOST_PORT=11003.

### Execution resumed — 2026-09-10

Devrouter PR #80 merged as d87f36d; published CLI 0.0.68 installed. Resume
uses the managed manage profile and KB_GRAPH_BLOB_HOST_PORT=11003. New target
commits do not change questionGeneration.ts or the lifecycle test contracts.
The earlier planning approval remains applicable; runtime qualification precedes
baseline database characterization.


Published devrouter 0.0.68 now replaces the temporary repair in both existing
host installations. Canonical ensure succeeds for this exact source path with
manage selected and no drift. createDisposableTestPrismaClient completed with
DISPOSABLE_DATABASE_GUARD_OK before any fixture mutation.

The root check requires a host/container split: its installed-Devrouter contract
cannot run inside the managed consumer image. Container check, lint, syncpack,
agent guidance, Git-identity tests, removed-artifact and Prisma-sync checks pass.
Host workflow/runtime tests pass (68 tests); host launcher tests pass (31 tests)
with host access for workspace discovery. No application source has changed.

### Implementation and integration evidence — 2026-09-10

Committed extraction: 529c0ea1d; unused fixture bookkeeping removed in dbbb28fd9.
The three review writers now live in questionReviewLifecycle.ts. No test hook,
schema change, accounting write, provider policy or public API was introduced.
Before extraction, 39 tests passed through public review/polling service callers.
After extraction, 109 tests pass across review, lease, accounting, dispatch,
completion and start-failure suites. The fixture type corrections retain the
same tested behavior; GraphQL check and unchanged tracked SDL pass.

GLM produced the initial test harness, then failed terminally with HTTP503,
no available targets for glm-5.3-flash. Main completed the bounded implementation.
Simplifier reviewed b41e0946e..529c0ea1d and found only the unused cleanup set;
main verified and applied that removal. Independent integrity review continues
on a trusted Luna fallback, preserving the same complete scope.

Target integration uses origin/v3-ai at 352f47fd7443d93aa5720e863d6285b801cceebe
because final verification must include the newer chatbot/schema and CI changes.
The merge has no conflicts. Canonical runtime reconciliation reports no drift;
109 lifecycle tests and 99 host tests pass on the integrated tree. All 40 package
checks pass with concurrency 1. The existing parallel check launches Prisma build
and check generation together and hit EEXIST; serial execution removes that race
without changing repository configuration. The pre-integration full build passed
all 26 tasks. Integrated checks, lint, validators and the full 26-task build
also pass. The normal target merge is committed as 161b6dea7.
Source verification is complete; independent integrity/final review and hosted
CI remain pending before completed delivery can be claimed.
