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

## Progress

2026-10-26: source baseline and consumers inspected; primary checkout clean.
Task worktree created. No live setting, runner, trigger, subscription or budget mutation. No native
goal is active. Independent planner review APPROVED after two focused corrections. Implementation next; no runtime services started.

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
returns hosted selectors and label-only `run_label_event=false`. Normal events
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

Existing tests specifically extended: `ci-event-gates.test.cjs`,
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
