# Opt-in cloud capacity for public Playwright validation

## Current roadmap and executable source package

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
`trees/rs/warpbuild-burst-admission`. No PR exists yet.

The approved terminal is a verified, self-reviewed source package published as
a draft PR. Ordinary task commits and pushes are included. Deployment of a
coordinator, its hosting and network exposure, credentials, live workflow
permissions/settings, paid qualification, readiness and merge retain their
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

Roadmap review and source inspection are complete. The task worktree is based on
current `v3`; no live setting or paid execution has changed. Planning and trust
analysis are main-session self-review. The durable reservation slice passes
seven synthetic tests in network-isolated Node 24.21.0, including simultaneous
connections, restart, reconciliation, limits and private-file protection.
The first reservation and reconciliation checks failed before implementation.
Slice review is main-session self-review; no independent review is claimed.
The active slice is authenticated preparation and bounded failure fallback.
Integrated verification and draft delivery remain open. The native goal owns
continuation; a checkpoint is not source-package completion.

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
