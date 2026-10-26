# Priority pull-request validation on WarpBuild

## Approval summary

Approval mode: executable batch. The human approved the preceding proposal to
apply a maintainer-controlled `ci:priority` label to a ready public same-repository
pull request and run its independent validation jobs on scalable WarpBuild
capacity. Subsequent commits keep priority while labeled. The implementation
covers codebase checks, secret scanning, unit and GraphQL suites, OLAT tests,
translation builds, affected staging-image builds, and the existing canonical
Playwright build followed by eight parallel shards. Selectors, required status
reporters and publication-only work retain their existing execution route.

The current approval authorizes source implementation, focused verification,
ordinary commits and task-branch pushes, configured reviews and draft delivery.
It also agrees to the direction of one bounded paid qualification. Its exact
financial ceiling, candidate and access delta have not been specified, so no
paid submission, access write, rollout activation, readiness or merge follows
from this source batch. Complete independent source work before presenting that
concrete activation decision. Historical trials and their limits stay closed.

Priority selects new jobs; it cannot change an already submitted assignment.
A priority-label event has its own execution lane and preserves submitted
ordinary work. A closed PR stops ordinary execution; paid submitted work finishes
and is reconciled rather than cancelled. Unrelated labels must neither cancel work nor satisfy required
checks. Removing priority affects subsequent submissions. The canonical plan,
service topology, result/artifact checks and one Playwright worker per shard
remain intact. Source checks establish routing contracts, not actual paid
capacity, latency, complete suite success or billed cost.

## Execution details

### Context and packaging

Repository: KlickerUZH. Target: `v3`, resolved from the approved source scope and
current default. Baseline: `d2ead5336e753e025531b6c521b58b25bb05a410`.
Branch/worktree: `rs/priority-ci`, `trees/rs/priority-ci`.
Artifact root: `project/`. Execution mode: standard (runtime model identity is
not an exact solo-allowlisted ID). Main owns design, all writes and final proof.
One bounded explorer maps existing workflow consumers; one planner challenges
this plan; committed source receives the configured review gates. No other
workstream owns these files. One ordinary draft PR is the cohesive package:
all consumers implement the same routing contract and rollback together; there
are no independently releasable application or infrastructure layers.
Existing exact-number grant draft [PR #6675](https://github.com/uzh-bf/klicker-uzh/pull/6675)
is preserved; its single-run protocol does not supply persistent label routing.

### Primitive impact

| Primitive | Disposition | Contract |
| --- | --- | --- |
| PR validation | Extend | A maintainer requests paid priority for an exact current head; normal validation remains available. |
| Execution plan | Reuse | Existing affected-work selection and canonical partition remain authoritative. |
| Execution assignment | Compose | Select WarpBuild for eligible new jobs without reassigning submitted jobs. |

### Routing and admission contract

- Default off behind `PRIORITY_CI_ENABLED`; optional exact PR canary restriction.
  Source contains no private values or spending defaults.
- Only an open, ready, public, same-repository, non-bot PR at the immutable event
  head/base can qualify. Require the current `ci:priority` label and confirm its
  latest setter has write/maintain/admin repository permission. Use complete,
  bounded API reads; unavailable or ambiguous evidence retains ordinary routing.
- One centralized trusted action owns eligibility and runner labels. Callers
  invoke its trusted `v3` checkout before candidate execution; Playwright invokes the
  same helper from its immutable trusted-control checkout. New action source is
  inert until published to the trusted branch in a separately approved merge.
- Paid admission is first-attempt only. Existing manual grants/tickets or an
  admission endpoint conflict with priority selection rather than broadening it.
  Do not automatically rerun failed paid work.
- A run name binds priority to workflow/PR/head. The first matching first-
  attempt invocation is selected under a workflow-level non-cancelling serialized
  priority group keyed by workflow/PR/head/base. Run-name discovery is not an
  atomic reservation; serialization spans every job and makes later invocations
  wait until their predecessor terminates before listing it. Earlier ordinary
  runs have a different title and do not block priority. Reapplication at an unchanged head does not
  automatically pay for another validation. Failure/unavailable listing denies
  priority. New source is a new validation.
- Ordinary selectors keep their path decisions. Priority labeling starts the
  existing affected checks; it does not convert a filtered producer into proof
  of execution or force all image publications. Preserve x64 suites, ARM image
  builders and the existing ARM Playwright backend.
- Preserve required check names on ordinary and admitted events. Unrelated or
  denied label-only events use distinct non-required display names, skip work
  and cannot replace a pending/failing validation with an acceptable skip.
- Priority label execution has a separate concurrency lane. Subsequent priority
  commits have a new head-specific lane; submitted paid work is preserved.
  Unrelated labels receive a unique ignored-event lane. No API cancellation,
  retry or replacement of another owner's submitted work occurs.
- Compute jobs use fixed documented Ubuntu 24.04 WarpBuild labels and explicit
  paid timeouts. Matrices retain independent scheduling, existing dependencies,
  architecture, permissions, secret scopes, cache isolation and status checks.
  The repository-level access policy needed by these new callers is a separate
  named live change; do not weaken existing access during source delivery.

### Test portfolio

| Risk | Obligation | Primary seam |
| --- | --- | --- |
| Unauthorized, stale, malformed or ambiguous selection spends money | Add | Synthetic API-backed router tests including setter permissions, drift, pagination, denied duplicate and rerun. |
| Label events cancel work or skip required gates | Extend | Evaluate parsed actual workflow predicates and concurrency/name expressions against synthetic events. |
| Runner selection breaks canonical paid attempt/coverage contract | Extend | Playwright route/metadata and public-workflow validator tests. |
| Image routing weakens publication or promotion | Extend | Existing structural image contract; conditional runners allow only hosted push and fixed PR Warp selectors. |
| Independent jobs are accidentally serialized | Add within routing contract suite | Parse each consumer's DAG, matrix and timeout; retain only actual build/artifact dependencies. |
| Ordinary source regressions | Reuse/execute | Existing affected CI contract suites, formatting, diff inspection and staged secret scan. No app runtime is needed for workflow-only changes. |

### Sequence and files

1. Commit this approved implementation plan after one independent planner pass.
2. Add `.github/actions/priority-ci-route/action.yml`, its `route.cjs` and
   `route.test.cjs`. Extend existing selector jobs and compute assignments in
   `check.yml`, `check-gitleaks.yml`, `test-unit.yml`, `test-graphql.yml`,
   `test-olat-api.yml`, `test-intl-production.yml`, `v3_images-stg.yml`.
   Add routing integration assertions to `ci-event-gates.test.cjs`; extend
   `staging-image-workflow.cjs` and its existing tests where contracts require.
3. Extend `test-playwright.yml`, `public-pr-playwright-shards.yml`,
   `playwright-route.cjs` and existing route/metadata/workflow tests to use the
   same admission result. Retain exact partition, artifacts, worker and required
   aggregate checks. Update `validate-public-playwright-workflow.cjs` only for
   the new exact trusted contracts.
4. Update `docs/ci-and-deployment.md` with operator behavior and evidence limits.
   Verify and simplify the integrated source; review the exact committed range;
   ordinary non-force push and draft PR. Reuse valid passing checks.
5. Before any live qualification, present the exact one-run candidate, budget,
   access delta, activation/deadline and independent cleanup branches supported
   by current private readbacks. Source merge/readiness and live activation each
   retain named authority. No new scheduled wakeup is implied.

### Verification and terminal

Use Node 24 synthetic contract tests in an existing disposable container when
parser dependencies are required. Host Git/gh only, prefixed `GODEBUG=netdns=go`.
No dependency additions, infrastructure or secret-store changes. Use installed
Biome/Prettier, staged gitleaks and scoped Opengrep. Required hosted checks are
separate from local proof. Preserve actual failed/skipped producers honestly.
Terminal: coherent reviewed draft source plus exact evidence and any concrete
remaining activation decision; do not claim working live priority or deployment.

### Event table and exact admission interface

Workflow `run-name` uses only github/vars contexts. Eligible-looking ready
same-repository public non-bot labeled first attempts use
`priority:<PR>:<headSHA>:<baseSHA>`; all others use `ordinary:<runID>`. This
preliminary marker never authorizes spending. Concurrency uses that marker
plus workflow identity, priority `cancel-in-progress: false`, ordinary existing
PR groups, and every non-admitted-looking label `ignored:<runID>` group. ALL
label-only events are non-cancelling, including disabled/draft/bot/malformed
priority requests; none can enter an ordinary cancelling group. Ordinary updates keep
existing cancellation policy. Playwright retains job-level ordinary/close
cancellation; an outer priority-only serialized lane spans preparation, work
and reporting. Paid work is preserved on closure.

Router API reads (contents/read, pull-requests/read, issues/read, actions/read):
current pull, complete issue events for latest labeled/unlabeled event, latest
setter collaborator permission, exact current workflow run and complete runs
for the workflow at event head. Maximum ten pages of 100; incomplete/unknown
evidence denies. Current run identity must match PR/head/base marker, attempt
one, repository and event. Earlier matching marked runs deny duplicate paid
submission after their terminality; an earlier nonterminal match denies too.
The workflow-level serialized marker group makes this election sequential.
Router returns `admitted`, `run_label_event`, `run_attempt`, exact head/base/run/
workflow IDs, fixed x64 runner selectors and ARM image selector; disabled/denied
returns empty selectors for each consumer's canonical hosted fallback and
label-only `run_label_event=false`. Normal events
still execute ordinary validation on denial. API errors never print details.

Every new paid consumer requires `provider != warpbuild || admittedAttempt ==
currentAttempt` before scheduling, and an unmatched consumer makes the ordinary
required reporter fail. A rejected label-only event has a distinct non-required
reporter name. Gitleaks retains its normal job ID and required name on admitted
or ordinary events. Compute x64 uses `warp-ubuntu-2404-x64-4x`; codebase uses
x64-8x; image ARM uses arm64-8x; AMD images use x64-8x. All new paid compute
timeouts are 60 minutes (translation retains 30); Playwright retains ARM8/ARM4,
45 minutes and one worker. Hosted selectors preserve existing scalar values.

Playwright evaluates the same trusted helper once before route metadata. Pass
its result to both route and metadata selection, require empty legacy tickets/
endpoint, preserve force-hosted override and existing public eligibility; priority
can select the public trust lane independently of normal pool rollout. Paid
qualification requires a merged trusted helper; draft CI remains ordinary hosted
coverage plus synthetic new-source contracts. Never claim draft execution of
the new `@v3` helper.

### Delegation Map and review gates

| Slice | Owner | Dependencies | Acceptance / stop |
| --- | --- | --- | --- |
| Consumer mapping | Euler explore, read-only (completed) | Current source | Exact job map; no writes |
| Plan critique | Kuhn planner, read-only | Complete frozen plan | APPROVED or bounded same-reviewer corrections |
| Shared admission and non-Playwright consumers | Main | Plan accepted | Router API/duplicate/attempt and parsed event contract tests |
| Playwright and image validators | Main | Shared contract | Exact paid attempt, coverage, publication/cache negative regressions |
| Integrated source delivery | Main; dedicated simplifier and risk reviewer, then Claude CLI final reviewer | Committed source and focused checks | Reviewed draft or concrete review/capability decision |

Existing tests specifically extended (plus the exact image status namespace and promotion mutation fixtures): `ci-event-gates.test.cjs`,
`staging-image-plan.test.cjs`, `playwright-route.test.cjs`,
`playwright-plan-metadata.test.cjs`, and
`validate-public-playwright-workflow.test.cjs`. Workflow consumers run the new
`priority-ci-route/route.test.cjs` in the existing check contract step.
Validator changes accept only exact declared conditional selectors, label
triggers/concurrency and trusted action/outputs; mutation tests reject paid push
routing, arbitrary selectors, stale attempts and denied required-name publishing.
Portfolio dispositions: router `add new`; event, Playwright and image contracts
`extend existing`; ordinary checks `none` (verification only).

### Planner corrections and source bootstrapping

All label-only event groups are non-cancelling before any router output exists.
A preliminary eligible request uses the serialized priority group; every other
label uses a unique ignored group. Test disabled/draft/fork/bot/unknown-label
cases explicitly. Only ordinary source updates keep their original cancellation.

No new remote action is referenced while unpublished. Each non-Playwright
workflow adds a `priority-route` hosted job, gated at job level on the global
enable switch and eligible-looking priority payload. It checks out only the
trusted action directory at `v3` into `.ci-priority`, then uses the local action
from that checkout. Disabled jobs never resolve the new local action. Compute
jobs depend on both their original selector and the optional route job, with
explicit `!cancelled()` predicates and hosted-default selectors when that job
is skipped. Required reporters require the original selector/test result as
before. Playwright uses the local action from its existing `.ci-control`
checkout only in a conditional step when priority is requested. Candidate
contract tests load the new source locally; no hosted new-route claim precedes
trusted publication. This adds a bounded optional hosted preflight, never an
external coordinator or always-on service.

Legacy ticket/endpoint conflicts apply only to a requested priority validation.
Disabled or unlabeled events keep the entire ordinary Playwright admission
contract. A requested priority event with nonempty legacy controls is denied
priority before any legacy API request; a natural event retains ordinary hosted
or pool execution without consuming those conflicting admissions. Test both
ordinary-legacy compatibility and requested-priority conflict denial.

### Final execution packaging

The accepted implementation keeps ordinary jobs direct and emits seven acyclic priority-only
`*-execution.yml` reusable workflows from canonical source using
`.github/scripts/priority-ci-workflows.cjs`. CI enforces exact generated parity;
these are not separately maintained copies. Each original workflow delegates
priority work to its exact corresponding `@v3` executor. The priority caller
retains serialization, while executor files have no concurrency or trigger loop.
All jobs in each executor come from the canonical workflow with only its precise
ordinary-delegation gate stripped. The caller forwards read scopes, existing
Turbo secrets where applicable and existing image package-write scope. It never
forwards new credentials. A hosted parent reporter requires called-workflow
success and the actual terminal job's final status output. Missing or failed
output fails; inactive or denied label events use non-required check names.

Image status accepts only the exact `priority-execution / ` namespace supplied
by generated trusted control before doing its existing exact producer-name
matching. Ordinary push producer names, publication and promotion are unchanged.
Tests extend `staging-image-status.test.cjs` and `stg-release-promoter.test.js`
for new names, exact original validators and rejection cases. Plan critique of
this acyclic generated variant is APPROVED. No live access or budget change.

New files explicitly approved by this source design: seven execution workflows,
`priority-ci-workflows.cjs` generation/parity helper, and the shared action's three
files already named above. Existing check contract invocation owns parity;
formatting of generated YAML is normalized by the existing Prettier version.

## Progress

2026-10-26: source implementation in progress in the task worktree. Primary
checkout remains clean. One bounded explorer mapped consumers. Original planner
completed three rounds with APPROVED. Trusted-execution amendment received one
independent critique and one focused correction, ending APPROVED for the acyclic
execution design. No paid admission, access write, trigger, budget, account or
runner mutation. No native goal or scheduled wakeup is active. Disposable Node
containers run focused source checks without application services.

Integrated focused portfolio: 206 PASS in disposable Node 24, including real
Git/zip fixtures, event predicates, generated parity, route/metadata, namespace
evidence and promotion policy. Formatting and actionlint context checks pass
with the existing job.workflow_sha/repository support gap explicitly excluded.
Scoped Opengrep: 200 rules across seven files, two pre-existing nonliteral
regex advisories in the existing image validator, no new finding. Staged secret
scan and committed-range review remain pending. Required hosted and actual paid qualification are distinct gates.
New generated workflows are part of this coherent routing package; substantive
size excludes these derived artifacts and plan text. Normal single-draft topology
remains appropriate because every caller implements one shared admission contract
and independent partial rollout cannot complete its verification.

### Immutable executor bootstrap correction

Actual GitHub draft validation rejects disabled calls to executor files absent
from `v3`. Pin all seven calls to the already-published reviewed executor commit
`aaf8d41393f9c5e51e0076827c80953afacb8c4a`; this is a resolvable immutable
source ref, not permission to run paid work. Runner-group selected workflows
can pin reusable workflows to a full SHA. All seven executor trees are compared
against generated canonical parity; if their content changes, publish that
executor commit first and then update its callers' pins in a follow-up ordinary
commit. Activation's eventual exact allowlist must use those verified pins.
Priority router bootstrap still requires trusted `v3` publication before enable.
Source workflow validation and actual paid qualification remain separate.

Main accepted simplifier's one reduction: closed-PR Playwright cancellation
uses its original ordinary group; open/label priority branches are unreachable
there. Source-review comments never grant operational authority.

### Integrated review correction

Claude CLI completed the original full committed range with three verified
findings. The envelope reports Opus 5.5 and Fable 5.1 usage, so it is not
Opus-only proof. Main verified and corrected exact nested Sonar terminal lookup,
newer all-skipped/denied label runs displacing actual coverage, and noisy red
non-required denied-label checks. Added two behavioral fixtures to existing
`sonar-coverage-inputs.test.cjs`; actual failed terminal producers remain visible.
All seven parent wrappers skip the terminal assertion only for denied label-only
requests, with non-required names; ordinary/admitted requests still fail on
missing evidence. Existing generated executor source is unchanged.

Finite qualification can additionally freeze exact head/base and deadline via
optional `PRIORITY_CI_CANARY_HEAD_SHA`, `PRIORITY_CI_CANARY_BASE_SHA`,
`PRIORITY_CI_EXPIRES_AT`; no operational values are supplied by source. Tests
cover mismatch/expiry and current identity. Focused correction portfolio95PASS.
No livechanges. Same logical integrated review receives one correction pass.

### Pinned executor correction reassessment

The correction review confirmed all three original fixes and found a remaining
invariant: regenerating an in-tree executor must not hide a stale caller pin.
Main reproduced that failure and added the check at the existing parity seam.
Every caller must name its exact corresponding executor and a full commit SHA;
the published Git blob must parse equal to the generated expected workflow.
Unavailable commits are fetched by exact SHA from the existing origin without
shallowing the checkout; unavailable content and mismatches fail closed.
The existing contract suite now tests a regenerated local definition with stale
published content and rejects a mutable ref, instead of duplicating a pin literal.

Scope/risk reassessment: this correction enforces the approved parity contract
without changing execution jobs, runner selection, credentials or live settings.
It adds only bounded Git-object retrieval on the existing remote when necessary.
The main session owns the narrow correction and its affected verification; the
one integrated correction review is consumed, with no automatic extra reviewer
or claim that the new correction has independent acceptance. Current-head hosted
CI and ordinary feedback remain pending. No paid qualification follows.

### Current source verification

The published candidate's hosted check exposed three stale workflow assertions.
The affected tests now evaluate readiness, label and ordinary-push cancellation
behavior, retain the unit selector dependency, and include the label-reading
permission. All 131 affected contracts pass in disposable Node 24 containers,
including the real Git and artifact fixtures; the initial artifact-fixture run
lacked zip, and the same fixture passed with the existing tool mounted.
Scoped Opengrep over the four correction files reports no findings or errors.
Formatting and diff inspection pass. Earlier unaffected verification is reused.
The correction is ready for its ordinary task-branch commit and push; exact-head
hosted CI and ordinary feedback remain pending. The integrated correction review
is consumed, and the new pin-invariant correction has main-session verification
without independent re-review. No live routing or paid validation is enabled.

### Denied selector compatibility correction

The natural ordinary review completed with partial file coverage. Main verified
one compatibility defect: a denied priority result supplied `ubuntu-latest` and
overrode the translation workflow's existing `ubuntu-24.04` fallback. The bounded
reassessment limits this correction to empty denied runner outputs, preserving
each consumer's own hosted selector, and its existing parsed-workflow regression.
No job definition, admission rule, runner access or paid timeout changes.
The regression failed on the actual translation expression before the fix; all
39 affected admission and event contracts pass after it. Other findings receive
source-based dispositions, with optional refactors deferred. No extra reviewer
or review retry is started; partial coverage remains an explicit limitation.

### Denied Playwright label reporting

The current-head ordinary review completed all 34 selected files and published
a second-round timeout warning. Main verified a remaining reporter defect:
denied label-only events on ready application PRs failed the normal full-plan
assertion despite using a non-required check name. The reporter now records its
summary and exits neutrally for that exact denied-label condition. Ordinary and
admitted requests retain every existing validation assertion.

The existing lifecycle validator now enforces the exact caller run-name marker,
denied-label reporter name, label-event inputs and reusable admission output
wiring. Mutation and actual shell-script regressions failed before the fix and
pass afterward. The affected event, route, metadata and lifecycle portfolio has
79 passing tests with no skips. Formatting and the scoped static scan pass with
no findings. Earlier unaffected evidence is reused. No new module, executor pin,
admission policy, credential or live setting changes; no extra reviewer or retry.
The source correction is prepared for ordinary task-branch delivery and new-head
hosted verification. Main-session verification is not independent final review.

### Human author eligibility correction

The next natural review retained partial coverage and repeated several previously
dispositioned allegations. Main verified one eligibility gap: the Playwright
caller and shared router used only a bot-name suffix, so a Bot-type author
without that suffix could reach admission. The shared router now requires the
explicit human User type as well as its existing suffix check. Missing author
type fails closed before API requests.

The existing synthetic mutation test reproduced the admission before the fix
and denies Bot or missing type afterward. All 48 affected admission, route and
metadata contracts pass, formatting and scoped static scanning pass. This narrow
correction restricts the approved non-bot contract without changing executor
pins, workflows, access, paid activation or any live setting. The review budget
remains consumed; verification is main-session evidence. New-head source CI and
natural feedback remain required before draft completion.
