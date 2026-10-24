# Opt-in cloud capacity for public Playwright validation

## Current roadmap: Actions-only bounded bursts (2026-10-22)

The operator selected Actions-only bounded bursts as the next delivery direction.
The outcome is practical, explicitly authorized queue relief using the existing
trusted Playwright execution envelope. A public admission endpoint, coordinator
deployment and database hosting are deferred. The coordinator source delivered
in [merged PR #6651](https://github.com/uzh-bf/klicker-uzh/pull/6651) remains
available but is not a prerequisite for this next stage. This decision does not
remove that code or establish live qualification.

### Contract and limits

- Decide cloud routing during trusted preparation. Preserve exact repository,
  run, attempt, head, base and trusted-control binding. Candidate code cannot
  authorize itself or receive privileged credentials. Ordinary routing remains
  the default when authorization is absent, invalid or expired.
- Authorize a finite set of validations and an expiry, with explicit concurrency
  and duration bounds covering the build and every consuming shard. A retry is
  a new attempt requiring new authorization. No blanket label or unbounded
  enabled flag substitutes for this finite scope.
- Treat concurrency and timeouts as workload controls, not a transactional
  currency guarantee. Repository variables, artifacts and caches are not an
  atomic spending ledger. GitHub billing controls do not establish WarpBuild
  spending limits.
- Require current operator-verified headroom and conservative whole-validation
  exposure before a batch. Reconcile complete provider charges before another
  batch; uncertain execution or missing billing retains the exposure. Keep
  financial evidence and operational identities private.
- Preserve submitted work. Automatic cancellation, paid retries, capacity
  removal and queue-triggered unattended allocation are outside this stage.

### Next steps and acceptance

| Stage | Deliverable | Acceptance |
| --- | --- | --- |
| Next: source design | Select the smallest Actions-native authorization path before preparation | Verify current concurrency/queue semantics, attempt replay protection, trust boundaries and finite-set enforcement; document cancellation/crash behavior without assuming transactional variable writes |
| Source delivery | Extend existing routing and workflow contracts only where needed | Synthetic positive and negative tests prove exact identity, expiry, unauthorized retry rejection, ordinary fallback and whole-validation concurrency; focused checks and current-head CI pass |
| Separately approved qualification | One explicitly authorized validation, initially sequential | Actual provider assignment, successful build, every consuming shard, matching artifact identities/digests, separate aggregate and complete job-linked charges |
| Useful relief | Repeat only within a newly approved finite batch after reconciliation | Demonstrate queue relief with comparable coverage and distinguish queue, execution and reporting time; document remaining operator work |
| Deferred | Unattended queue-triggered allocation or external coordinator | Revisit only if bounded operation proves insufficient and the stronger accounting or automation requirement is explicitly selected |

The immediate action is to resolve the Actions-native authorization mechanism;
the previous race of installing a ticket after preparation must not return.
Holding a lock for preparation alone does not bound the lifetime of paid work.
Do not claim the mechanism implemented until these cases are verified.

### Authority and historical status

The operator subsequently approved source execution and draft delivery. This
approval grants no deployment,
access or admission-variable write, new paid batch, cancellation, retry or reset
of expired operational limits. Exact live targets, finite bounds, success checks
and owned cleanup require a separate activation packet. Coordinator hosting
comparisons are parked; no Kubernetes, Container Apps or Container Instances
deployment is selected by this roadmap.

### Executable source package: workflow-number grants

Approval mode: executable batch, source only. Main session owns the full-path
package under the retained no-subagent restriction; integrated simplification
and review are self-performed and are not independent evidence. Target `v3`,
baseline `4a9305739a516480e2b1e948a1eda8f61c974749`, branch
`rs/warpbuild-actions-bursts`, retained worktree `trees/rs/warpbuild-burst-admission`.
Terminal: verified source, ordinary feedback disposition and a draft PR. Live
activation, spending, readiness and merge remain separately authorized.

Extend the existing authorization primitive with one optional repository-variable
grant for a particular workflow ID and run number, attempt one, exact PR/head/base/
trusted-control revisions and expiry. GitHub documents run numbers as unique per
workflow and unchanged by reruns. Preparation verifies the actual workflow ID,
run number, run ID, attempt, PR and single active preparation through read-only
GitHub calls, then constructs the existing exact-run ticket in memory. It performs
no shared-state write. An unrelated event taking the nominated number consumes
the opportunity rather than widening authorization; the run uses ordinary routing.
The operator may not replace a grant until prior exposure is reconciled. This is
one validation per grant, not a global monetary ledger or automatic rolling window.

Research: [GitHub variables](https://docs.github.com/en/actions/reference/workflows-and-actions/variables)
defines run-number identity. A manual environment gate was rejected because its
rejection fails the workflow. Git-ref claim storage was rejected because it adds
privileged writes and public claim state. Neither is needed for an exact workflow
number. The prospective grant must fail closed on API failures, malformed or
partial responses, duplicate preparations, changed source, expiry and reruns.
Existing manual exact-run tickets remain compatible; a configured prospective
grant never falls through to the external coordinator when denied.

One coherent implementation slice extends `playwright-route.cjs` and its existing
tests, `playwright-plan-metadata.cjs` and its integration tests, the existing
reusable workflow and its validator/mutation tests, plus the CI operations guide
and ADR 0052. No new helper, dependency, workflow or application runtime is needed.
All verification uses synthetic identities. No private operational evidence belongs
in this package. Existing artifact/aggregate/attempt guards remain mandatory.

Test portfolio: extend route tests for exact prospective admission and a table of
identity, replay, malformed grant, API failure and eligibility denials; extend the
metadata integration seam to prove plan validation precedes admission; extend the
workflow validator mutations to protect trusted grant/token wiring. Reuse existing
runner selection, fixed duration, artifact and aggregate tests. Run the affected
Node 24 contracts in an isolated container, format and secret/diff checks, and
review the integrated source. Current-head CI and live provider qualification are
distinct evidence layers.

Progress: prospective grants are implemented with the explicit missed-slot
tradeoff. A red/green route regression and 46 affected contracts pass in an isolated
Node 24 container. A broader 104-test portfolio passed; the separate profile-runtime
file was excluded, so this is not a full application or complete runtime check.
Focused formatting, Biome and diff checks pass. Scoped Opengrep checked three
executables with 200 applicable rules and no findings. The API binding requires
the immutable runner PR ref plus current PR data and rejects conflicting optional
run PR links. Main-session review covers authorization, malformed/partial evidence,
attempt replay, read-only transport and default-off behavior; it is self-review.

One grant admits at most one validation. Sequential operation across successive
grants remains an operator obligation, not a global concurrency lock. The source
preserves the existing PR lifecycle cancellation behavior rather than introducing
a cloud-wide queue that could cancel unrelated pending work. Live compatibility,
whole-wave provider acceptance and billing remain unqualified. Current-head hosted
CI and ordinary feedback are pending on
[draft PR #6675](https://github.com/uzh-bf/klicker-uzh/pull/6675). Original merged
branch is preserved. The package adds roughly 400 substantive source/test lines
in one cohesive existing admission path; it adds no service or new workflow.

The initial published head passed all eight required contexts and its actual
contract producers, hosted build, selected shard and separate aggregate. Canonical
partition and build-artifact digest consumption were verified; this was bounded
source CI, not cloud qualification. Ordinary draft review completed and published
two inline findings plus three summary advisories. The first correction strengthens
started-workload checks to include step state and every envelope job, proves zero
coordinator calls with its configuration enabled, restricts explicit token exposure
to preparation and flattens the test helper. The stale-job-state regression was
reproduced red before correction; all 46 affected contracts pass afterward.
Current-head CI must be re-established after publishing that correction.

The sections below preserve the prior source package and its verification
history. Their references to a next coordinator deployment, draft status or
pending merge are historical, not current instructions or renewed authority.

## Historical coordinator source package (2026-10-20)

The operator approved updating this roadmap and executing the next source
package on 2026-10-20. The earlier sections below are historical delivery
records; their pending states do not reopen merged work. Current source includes
the optional backend, preparation guards, required-status recovery and corrected
shard outcome reporting. Operational qualification and its limitations are
recorded privately. They establish no standing spending authority, comparative
speed claim or permission to remove fixed capacity.

The next outcome is a bounded burst that makes its admission decision during
trusted preparation, before the build or shards select runners. A periodic
operator inventory cannot reliably insert an exact ticket before preparation.
Keep the existing execution envelope and immutable ticket checks, and give
admission a private durable owner. The initial control is an operator-enabled
burst window; queue-triggered activation is a later phase.

### Authority and delivery

Approval mode: **executable batch, source only**. Main session owns design,
implementation, verification, simplification and integrated self-review. The
existing no-subagent instruction remains binding. Execution mode remains
standard with that explicit main-session override; self-review is not
independent evidence. Target `v3`, baseline
`c58e111ea3d606b3a99dd0664351b5df97fd90c8`, branch
`rs/warpbuild-burst-admission`, worktree
`trees/rs/warpbuild-burst-admission`. Published as
[draft PR #6651](https://github.com/uzh-bf/klicker-uzh/pull/6651).

The source terminal was a verified, self-reviewed draft. The operator subsequently
approved readiness, actual final review and normal squash merge after required
CI and applicable platform gates. Ordinary task commits and pushes are included.
Deployment of a
coordinator, its hosting and network exposure, credentials, live workflow
permissions/settings and paid qualification retain their
separate approval gates. Earlier finite pilot limits and cleanup obligations
are not reset by this source goal. No existing run is cancelled or retried.

### Admission design

- Use a small trusted coordinator with a private SQLite reservation database.
  It returns only an exact execution ticket; financial state stays outside
  repository variables, workflow logs and CI artifacts. Node's built-in SQLite
  avoids a new package or shared application database. A transaction must
  reserve the whole validation before a response can authorize cloud work.
- Authenticate preparation with GitHub OIDC, bound to the configured audience,
  repository, exact reusable workflow revision, run and attempt. Verify current
  PR eligibility and run identity through host `gh`. Candidate input alone
  cannot establish eligibility. Candidate build and shard jobs retain read-only
  permissions and never receive coordinator credentials or ledger access.
- Operator policy fixes the burst's expiry, allowed control revision, count,
  concurrency and monetary reservation limits. Fresh private headroom evidence
  includes unresolved liabilities. Concurrent admission and duplicate requests
  cannot spend a reservation twice. Restart preserves consumed submissions.
  Expired tickets and cancelled jobs do not release financial exposure without
  complete reconciliation.
- Keep the integration disabled when no endpoint is configured. Missing OIDC,
  denied admission, timeout or unavailable coordinator keeps ordinary routing.
  A lost response retains its reservation. Existing exact manual tickets remain
  compatible. Old callers without OIDC permission retain their normal behavior.
- Start with an explicit burst window and one admitted validation at a time.
  Policy may permit a second concurrent validation only under a later qualified
  activation packet. The repository variable is not an atomic account ledger,
  and the coordinator cannot control unrelated account spending.

The new persistent admission owner and workflow authentication boundary warrant
ADR 0052. Deployment location is intentionally not selected by source delivery.
The implementation must not assume a reachable endpoint or silently introduce
an application service, cluster resource or new credential.

### Delivery sequence and acceptance

| Phase                      | Outcome                                                                                  | Acceptance                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Current: bounded admission | Reserve and authenticate before backend selection; preserve ordinary fallback            | Durable concurrent reservation tests, authenticated synthetic request through route selection, exact workflow guards |
| Current: failure handling  | Preserve limits across duplicate requests, stale identity, unavailable state and restart | Negative cases deny cloud admission; unknown execution or billing retains exposure                                   |
| Later: live qualification  | Deploy to a separately approved owner and run a capped burst                             | Actual provider, build, every consumer, artifact digests, aggregate and complete job-linked billing                  |
| Later: useful relief       | Compare representative bursts with ordinary execution                                    | Separate preparation, queue, execution and reporting times; complete costs and declared coverage limitations         |
| Later: automatic trigger   | Activate on sustained pressure in the eligible pool                                      | Bounded threshold, cooldown, concurrency cap and verified return to ordinary routing                                 |

Existing CI-efficiency work remains complementary: reuse valid outputs and
avoid unnecessary work before expanding capacity. This package does not route
drafts, forks, bots, pushes, image publication or unrelated hosted checks.

### Source slices and test portfolio

1. Update this existing shared roadmap and record ADR 0052. Implement the
   private reservation owner in new `.github/scripts/warpbuild-admission.cjs`
   with its synthetic `warpbuild-admission.test.cjs`. Verify atomic admission,
   immutable identity, count/concurrency/exposure ceilings, restart and
   conservative reconciliation through the public reservation interface.
2. Implement the trusted transport in new
   `util/warpbuild-admission-server.cjs` and its synthetic test. Extend existing
   `playwright-route.cjs` and its tests to request admission before selection.
   Verify authentication, bounded network failure and fallback without a live
   credential, provider request or external service.
3. Extend the existing caller/reusable workflows and their policy validator
   and mutation tests. Wire the new tests into the existing check command;
   update the CI operations guide. Preserve canonical coverage, independent
   attempt guards, artifact consumption and separate aggregate reporting.
4. Run affected contracts in an isolated Node 24 container, syntax, formatting,
   focused static checks and staged privacy checks. Review the complete range
   for simplification, correctness, trust, persistence and compatibility; then
   publish the draft with honest remaining runtime gates.

The new tests protect previously absent persistent and authentication contracts.
Existing route and workflow suites are extended rather than duplicated. No UI,
application build, seeded data or local application runtime is required. All
fixtures use invented identities and amounts. Private pilot facts are excluded
from every source change and public description.

### Current progress

On 2026-10-21 the operator approved one further bounded correction round after
reassessment. Emergency disable now persists across backward clock changes
without relaxing the admission clock guard. Transaction failures preserve the
original error and quarantine the connection when rollback fails. Server startup
waits for binding and propagates bind errors through the fixed operator failure
path. Each defect has red/green regression evidence. All 45 focused tests pass,
including no-retry, redirect, metadata fallback, exact forge endpoints and private
file protection. Billing freshness still gates duplicate requests; refreshed
billing recovers the same unexpired ticket without allocating another hold.
Current strict freshness requires integration of `8ab99bd5fe` before delivery.
The previously approved ready/final-review/normal-merge sequence resumes after
current-head verification. Deployment and paid qualification remain separate.

The next ordinary-review round identified admission before the plan's skip
decision. Admission now runs in the existing metadata step after full plan
validation; initial route selection makes no request. Skipped and invalid plans
cannot reserve capacity. Workflow guards bind the later step's environment.
Suffixed forge workflow paths are accepted only for the same fixed workflow;
failed requests emit one fixed, non-sensitive warning. Issued tickets leave a
minute below the client lifetime ceiling, and the permission fixture no longer
depends on the test process umask. The new regressions failed before correction.
The complete portfolio now has 111 passing container checks plus its separate
passing host-only planner check. Scoped static analysis covers five executable
files with no findings. Main-session integrated review remains self-review.

Readiness follow-up: the client now gives admission its own bounded deadline,
with room for signing-key retrieval, both forge batches and ledger contention.
The regression failed before correction; all 30 focused admission tests pass
afterward. Existing route tests additionally protect manual-ticket precedence,
URL restrictions and the POST contract. The route uses one identity-field list.
Strict target freshness requires integration of `eccb64b4cb` before final gates.
Main-session review covers these corrections; hosted final review remains pending.

Roadmap review and source inspection are complete. The task worktree is based on
current `v3`; no live setting or paid execution has changed. Planning and trust
analysis are main-session self-review. The durable reservation slice passes
seven synthetic tests in network-isolated Node 24.21.0, including simultaneous
connections, restart, reconciliation, limits and private-file protection.
The first reservation and reconciliation checks failed before implementation.
Slice review is main-session self-review; no independent review is claimed.
The authenticated handler, existing route client and reservation owner pass 30
focused tests together. Synthetic signed tokens prove the trust claims; scoped
forge-response fixtures reject changed, draft or ambiguous executions. Endpoint
absence, legacy callers, outages and invalid tickets retain ordinary routing.
No live authentication or deployment is claimed. Workflow wiring and its
mutation guard pass, including the default-off endpoint and preparation-only
identity permission. The existing application actions and deployment files have
no diff. The package script adds tests only; dependency metadata and lockfile
are unchanged.

The complete Playwright CI portfolio has 109 passing checks in isolated Node
24.21.0 and one passing side-effect-free host Devrouter planning check. The
container command reports that one missing planner capability; it is not
recorded as a wholly passing container run. Twenty event-gate contracts also
pass. Initial verification needed executable temporary fixtures and the
existing read-only dependency mount; no application runtime was started.
Syntax, focused formatting, identity checks and staged secret scans pass.
Scoped static analysis found no findings in the changed executable surface;
the existing GitHub-expression lint warning remains unchanged.

Main-session integrated review added complete access-policy readback, denial
when job wrappers have started without step detail, and single-reservation
receipt use. Thirty affected admission/route/transport tests pass afterward.
The hardest decision is introducing a private persistent owner; a repository
variable cannot supply the required transaction. The least-proven boundary is
live OIDC/forge response compatibility and coordinator deployment. That remains
an explicit live qualification gate rather than synthetic-test acceptance.

Delivery remains one cohesive draft: the ledger, authenticated handler and
preparation client implement one admission contract, and an isolated layer
would not provide usable overload admission. No native stack topology is
created. Main-session simplification and final review covered the complete
committed range through `c888e7d3ac` across correctness, plan compliance,
maintainability, trust and persistence. No additional abstraction or dependency
was needed. The architecture decision remains ADR 0052; no application-domain
primitive changes. Focused static analysis of the corrected coordinator also
passed. Local verification replaces the application-wide hooks for this
CI-only package; no full application build/check is claimed.
Draft publication and initial hosted verification are complete at
`4cbe77d75697f4eecd7c635caa0c6f25687763a7`: all eight required contexts pass.
The actual check suite passes all 110 Playwright CI contracts; the hosted
shared build, all eight shared shard producers and separate aggregate pass.
This is ordinary source validation, not coordinator deployment qualification.
The draft review completed only part of its selected work and posted no
findings; retain that coverage gap. No independent final review is claimed.
The final-review workflow requires a non-draft PR. Readiness is not authorized
in this source package, so no ineffective command is posted while draft.
This final progress/link update changes documentation only and reuses the
passing executable-source evidence above; any new platform checks remain
required before later readiness or merge.
The package has 1,487 substantive added/deleted lines outside documentation,
including the synthetic persistence, authentication and workflow contracts.
The source-package terminal is a verified, self-reviewed published draft.
The next sequence is readiness and final review, then normal merge and a
separately approved deployment/qualification packet. The later packet must
name the coordinator owner, durable storage, approved HTTPS ingress, existing
forge-read capability, exact access and endpoint changes, finite burst limits,
success/failure proof and owned cleanup. No automatic pressure policy is active.

## Historical source package

## Approval summary

Prepare an operator-controlled WarpBuild backend for the existing public
Playwright execution envelope. This lets selected heavy validations use
ephemeral cloud runners while routine checks stay on GitHub-hosted runners.
The existing public runner pool remains the default and recovery option.

The source batch is approved: implement, verify, self-review, commit, push the
task branch and publish a draft pull request. Live access changes, paid
submissions, readiness, merge and infrastructure changes need a separate exact
operator packet. No account limit or credential change belongs to this batch.

Use the existing route selector, plan metadata and public build/shard jobs.
Admission names an exact run, attempt, pull request, candidate head, base and
trusted control revision, with a short expiry. At most three entries can be
configured. An absent, malformed, expired or mismatched entry buys no cloud
work. Independent paid-job attempt guards prevent failed-job reruns from
reusing an earlier admission. The chosen backend stays fixed for the wave.

Completion means focused contracts pass, the integrated diff is self-reviewed,
and a draft is published with a concrete rollout packet. Source evidence does
not establish burst throughput, cost savings or safe removal of fixed capacity.

## Execution details

### Context, ownership and scope

- Worktree: `trees/rs/warpbuild-overflow`; branch: `rs/warpbuild-overflow`.
- Target: `v3`, baseline `78100ba5e1febb248830d375be8c994976687051`.
- Approval mode: executable batch, source only. Boundary owner: main session.
- Full-path package. Explicit main-session ownership and no subagents override
  generic delegation. Planning, simplification and correctness passes are
  labeled self-reviews rather than independent evidence.
- The separate [draft-conversion fix](https://github.com/uzh-bf/klicker-uzh/pull/6615)
  remains independent. The closed trial is historical, not new spending authority.

No application product primitive changes. Extend the internal execution
admission contract and compose the existing coverage, artifact and status
contracts. The provider is separate from the `public-pr` trust lane. The ADR
gate is not armed for this bounded optional backend; a new automatic allocator,
budget service or changed trust boundary would require another decision.

### Binding behavior

1. Only an already eligible ready public same-repository PR can use WarpBuild.
   Pushes, drafts, forks, bots and the force-hosted override keep existing
   behavior. Caller route hints cannot request paid execution.
2. A repository admission variable contains at most three exact run/attempt
   tickets. Tickets expire within four hours of selection. The operator reserves
   each whole wave privately before installing its ticket; the variable is not
   an atomic monetary ledger or a strict invoice cap.
3. Reuse the public jobs with ARM8 build and ARM4 shards. Keep containers,
   services, artifact consumption, read-only candidate permissions, caches and
   canonical coverage unchanged. Cloud shards use one worker. Cloud jobs have
   a bounded timeout; existing self-hosted timeouts stay unchanged.
4. Derive runner selectors from a closed provider enum, never arbitrary labels
   supplied through configuration. Paid jobs independently compare their
   current attempt with the admitted attempt. Unadmitted work uses its existing
   backend; failed or incomplete admitted work cannot become a green status.
5. An admitted cloud wave executes rather than reusing another backend's proof.
   Preserve general result reuse elsewhere. Record the selected provider in
   existing route metadata and the summary. Actual assignment, producer success,
   artifact consumption and billed costs remain separate runtime evidence.

Already queued jobs cannot migrate by a variable edit. A later approved full
workflow rerun can name the next exact attempt only after its prior attempt is
terminal. Source publication alone submits no provider work.

### Research and applicability

The main session checked current official [WarpBuild runner documentation](https://www.warpbuild.com/docs/ci/cloud-runners)
and [GitHub runner selection](https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/use-in-a-workflow).
WarpBuild documents the Ubuntu 24.04 ARM8 and ARM4 labels and ephemeral runners.
GitHub combines group and label restrictions. The source uses an explicit group
and fixed labels; a later operator packet must verify its narrowly allowed
repository and reusable workflow revision. Reporting remains reconciliation,
not proof of an atomic spending limit. No new billing API credential is needed
for source delivery or operator-exported billing evidence.

### Test portfolio

| Consequential risk | Obligation and primary seam | Existing protection and distinct failure |
| --- | --- | --- |
| Unapproved paid allocation | Extend route tests through the execution selector | Existing trust eligibility; add exact ticket, malformed/expired/duplicate and mismatched identity rejection |
| Runner or attempt drift | Extend metadata, workflow policy and event-gate tests | Existing role/permission contracts; add closed selectors, independent attempt guards, legacy required-coverage refusal and output wiring |
| Reuse hides cloud validation | Extend workflow policy mutation coverage | Existing equivalent-result proof; ensure admitted cloud work bypasses optional reuse |
| Coverage or artifact regression | Reuse full CI contract suite | Existing canonical plan, build graph, services, caches, shard and required-status contracts |

### Sequence and verification

1. Commit this plan after a main-session planning challenge. Then implement the
   smallest exact-ticket route/metadata path with red/green synthetic cases.
2. Wire the existing public jobs and fail-closed policy assertions; document
   admission, withdrawal, reporting and runtime acceptance in the CI guide.
3. Run network-isolated Node 24 CI contracts, affected YAML/Bash syntax,
   formatting, focused static checks, diff and staged data hygiene. No local
   application runtime is necessary.
4. Commit and self-review the complete source range for correctness, security,
   architecture and maintainability. Publish a draft and monitor exact-head CI
   and feedback using the existing single task heartbeat.
5. Prepare the private operator packet naming access delta, exact candidate
   selection, finite paid reservations, stop/recovery branches and terminal
   evidence. Request only its still-withheld actions after independent source
   work is complete.

## Progress

### Approved required-status recovery

The operator approved a source-only follow-up for the failed CI gates and one
read-only Claude CLI review of the immutable merged correction. That review is
a replacement evidence route, not a hosted final-review workflow result. Main
session ownership remains binding for implementation and other review passes.

This follow-up uses `rs/ci-status-resilience`, targeting `v3`. Extend only the
existing staging image status evaluator and its tests. Retry transient job-list
server errors within the existing observation loop, with at most three failed
API observations. Authorization errors, malformed responses and failed producers
still block immediately. Exhausted or permanent observation failures publish a
source-bound failure receipt; partial or missing job evidence never passes.
Keep the current job, timeout, permissions, dependency set and successful-build
requirements unchanged. Do not rerun the historical image workflow.

The deployment parity gate remains strict. Its cross-branch alignment is a
separate decision; this source package changes no deployment values, comments,
branch promotion or guard behavior. Live configuration and ownership evidence
stay private, and no activation or cleanup follows from source checks.

Verification extends the existing evaluator seam: transient recovery requires
complete successful producer evidence; exhausted and permanent API failures
must leave a failing receipt, including a failed later pagination page. Reuse
the existing producer-failure and pending-job cases. Run these dependency-free
Node contracts, syntax, formatting, focused static checks and data hygiene.
No application runtime or full local application build is needed. Simplification
and integrated source review are main-session self-reviews. Terminal delivery
is a locally verified draft with current-head CI and feedback disposition;
readiness, merge, deployment alignment and live activation remain separate.

The transient API regression failed before correction. After correction, 72
image-status, selection, required-status, deployment-parity and event-gate
contracts pass in network-isolated Node 24.21.0. Syntax and focused formatting
checks pass. No dependency, workflow, deployment or application-runtime change
is included. Hosted exact-head CI and ordinary feedback remain pending.

### Earlier source delivery

- Planning challenge: main-session self-review accepted exact run/attempt tickets
  instead of an open-ended PR toggle. Added stale-prepare attempt protection and
  provider-independent trust routing. No independent review is claimed.
- Implementation uses existing public jobs, route/metadata scripts, policy
  validator, event-gate tests and the CI guide. No new executable file,
  dependency, workflow, service or application runtime was added.
- Compatibility review removed a proposed new caller input: a draft caller
  referencing the old `v3` reusable workflow would otherwise fail before merge.
  Existing callers now retain their input contract; a stale paid attempt
  invalidates the existing coverage output as well as the new reporter guard.
- Focused verification: 96 Playwright CI contracts and 19 event-gate contracts
  pass in network-isolated Node 24.21.0 with the existing Devrouter 0.5.1 planner.
  Full local application checks/build and paid runtime verification have not run.
- Scoped static scan: unchanged mutable action references were reported;
  embedded Bash analysis is partially unavailable. No new source finding.
- The initial source package was published and merged as
  [opt-in WarpBuild overflow](https://github.com/uzh-bf/klicker-uzh/pull/6620).
  The separate [draft-conversion fix](https://github.com/uzh-bf/klicker-uzh/pull/6615)
  was also merged. These source merges do not establish cloud runtime acceptance.

### Approved regression follow-up

The operator approved a corrective source package and its normal merge to `v3`
after CI and actual final review. The separately approved finite activation
sequence begins only after this correction is verified merged. Its access,
spending, reconciliation and recovery details remain in the private operator
record rather than public source artifacts.

- Worktree: `trees/rs/warpbuild-overflow-guards`; branch:
  `rs/warpbuild-overflow-guards`; baseline:
  `dc47fecf65ed5885cd63dcdb291cc84fdc30a6fe`.
- Main-session ownership and no subagents remain binding. The planning,
  simplification and integrated review passes are self-reviews; the normal
  forge final review remains required before merge.
- Preserve workflow execution, providers, selectors, tickets, permissions,
  service topology and coverage. Change only the existing policy validator,
  its mutation test and the existing equivalent-run wiring assertion.
- Extend the existing runner-policy seam to reject candidate commands,
  additional command lines, alternate shells and working-directory overrides
  on route/metadata preparation. Reject workflow/job directory defaults that
  could change the trusted command's execution context. Allowlist preparation
  environment keys at workflow, job and step scope, and require every route
  identity expression so environment overrides cannot change trusted execution.
- Require the complete no-cloud-reuse condition, including the existing
  lifecycle predicate and metadata preceding equivalent reuse. Correct the
  equivalent-run test's obsolete pre-provider assertion; its expected value
  remains the complete machine condition.
- Reproduce the guard failures before correction, then run both existing
  Playwright and CI/review contract portfolios, event-gate tests, formatting,
  focused static analysis and staged data hygiene. No application runtime is
  needed for these pure workflow contracts.
- Follow-up package is justified by defects introduced in the recently merged
  source. Terminal source evidence is passing exact-head CI, feedback disposition,
  actual final review, a guarded normal merge and verified merge contents.
  A failed source gate blocks only the dependent activation sequence.
- Planning self-review: the workflow already executes trusted commands; this
  correction strengthens regression enforcement without changing execution.
  Existing machine-contract tests are the narrow stable seams. No new helper,
  executable, workflow, dependency or test file is needed.
- Verification: the policy mutation test failed before correction. After the
  correction and target integration, 96 Playwright CI, 56 equivalent-run and
  20 event-gate contracts
  pass in network-isolated Node 24.21.0. JavaScript syntax, focused Biome,
  plan formatting and whitespace checks pass. Scoped Opengrep ran 200 applicable
  rules on the three executable files with no findings.
- The broader local CI/review batch encountered unavailable test tooling and
  linked-checkout metadata. Its passing hosted producer is still required;
  the focused counts above are not proof that the whole batch passed locally.
  No full local application build/check or cloud runtime validation ran.
- Main-session simplification and correctness review found no extra helper,
  runtime change or unrelated cleanup necessary. Self-review is not independent
  final-review evidence. Status: source correction verified locally; hosted CI,
  actual final review, guarded merge and conditional activation remain pending.
- Draft review follow-up extends the same mutation table for execution-affecting
  environment keys at four scopes, route identity drift and reordered reuse.
  Both environment and ordering defects failed before their respective guard
  corrections and pass afterward. These are regression enforcement gaps; the
  workflow already uses its trusted environment and current step order.
- A further verified draft finding extends this same contract to the complete
  preparation sequence. Require the existing run blocks, action inputs and
  order, reject extra steps and job containers/services, and allowlist every
  step environment. This closes alternate paths that could replace the plan
  or route around the previously checked commands. Step names, comments and
  summary display text remain outside the executable contract; test-owned
  display edits must pass while inserted expressions fail. Reject inline
  GitHub expressions before comment or display normalization. The existing
  mutation table remains the primary seam. No workflow or runtime change.
- Require the existing opt-in cache expression as well as its environment key;
  missing, constant and alternate gates must reject. Summary fixture rewrites
  assert their targets and prove the display mutation ran. The same mutation
  table covers each action input and reports the failing mutation's index and
  source. Fixture handling remains local; no new helper or runtime behavior.
