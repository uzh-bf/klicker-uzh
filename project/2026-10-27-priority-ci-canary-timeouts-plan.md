# Finite priority-canary job timeouts

## Approval summary

Approval mode: executable batch. Ceremony tier: full path.

Add an optional duration limit for a fully pinned priority canary. Apply it to
all paid compute jobs while preserving ordinary routing, existing defaults and
canonical test coverage. The human approved source preparation after the
preflight showed that existing job limits could exceed a finite trial ceiling.
This batch ends with verified source and a draft PR targeting `v3`.

Authority covers implementation, focused verification, configured reviews,
ordinary task commits and nonforce pushes, and draft creation or updates.
Live controls, labels, access, paid submissions, retries, readiness, merge and
deployment need their separate named authority. Existing operational packages
remain closed. Financial and operational evidence stays outside this repository.

## Execution details

### Contract and ownership

Branch: `rs/priority-ci-canary-timeouts`. Artifact root: `project/`.
Baseline: `80885112ac9889dc67b4dea1820ffa89c9cd08eb`. Related source history:
[priority routing plan](2026-10-26-priority-ci-plan.md).
Main session owns all writes, integration and acceptance. Independent supplied-
artifact plan critique and integrated source review use the configured trusted
Claude route. No parallel implementation owners or native subagents are needed:
the action, generated executors and caller pins form one coupled contract.

Extend the existing execution-assignment primitive; no new service, dependency,
provider, topology or persistent ledger. The ADR gate is not armed: existing
routing and executor ownership remain intact. Reopen design if the change needs
account-wide enforcement or changes the admission owner.

`PRIORITY_CI_CANARY_JOB_TIMEOUT_MINUTES` is optional. When set, it must be a
canonical integer from 1 through 15, and exact PR, head, base and future expiry
controls must all match. Invalid or incomplete controls deny priority before API
reads. Recheck expiry after admission evidence is collected. Emit an empty
`job_timeout` on denial or when unset, and the validated duration on admission.
The upper bound cannot increase any existing paid job timeout.

Canonical workflows and generated executors consume the duration for checks,
secret scanning, unit, GraphQL, OLAT, both translation legs and every selected
image build. Playwright passes the same validated output through its existing
route and metadata into its build and every selected shard. Carry an explicit
priority-origin marker and reject malformed or non-priority timeout metadata. Preserve hosted limits and existing paid defaults
when the override is absent. Preserve required names, matrix selection, artifact
checks, attempt guards and non-cancelling concurrency.

A duration limit is a compute bound, not an account spending limit or a success
guarantee. A future activation must inspect the exact selected matrix, runner
rates, billing rounding and margin. It must also verify that the frozen candidate,
trusted helper and all pinned executors support this control. Older workflow
revisions cannot acquire a new control retroactively. No reduced-coverage trial
is substituted for the requested acceptance.

## Verification and delivery

| Consequential risk                                   | Evidence seam                                                                                                                                 |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Unpinned or malformed control permits paid admission | Synthetic router API tests; denial before any API call, plus expiry during evidence collection                                                |
| One paid consumer retains its longer default         | Discover all jobs using priority runner outputs and evaluate their actual canonical and generated timeout expressions against baseline limits |
| Playwright drops or broadens the duration            | Priority route to plan metadata to actual build/shard expressions; invalid and hosted metadata rejected                                       |
| Existing execution changes when unset                | Router and consumer compatibility cases, existing affected CI contracts                                                                       |
| Pinned executor differs from canonical source        | Existing generator and actual published immutable executor parity checks                                                                      |

First useful proof is a failing synthetic canary regression followed by a passing
route-to-consumer duration check. Run focused Node 24 contracts, installed
formatters, diff and staged secret scans. Compare scoped static-scan findings
with baseline. Workflow-only source changes need no application runtime or
browser captures. No full application build or live paid acceptance is claimed.
Extend the strict public-workflow validator with the exact trusted timeout-output
mapping and its existing mutation tests. Update the priority section of
`docs/ci-and-deployment.md` with the optional
contract and version prerequisite. No agent skill changes are required.

One cohesive implementation slice follows this plan commit. Publish canonical
and generated executor content first, then update caller pins to that real
published commit and verify actual parity. This two-commit publication sequence
is necessary because a caller cannot pin its own future commit. Inspect exact
source and configured review findings before draft delivery. Fix verified
in-scope findings within one bounded correction pass; reassess substantive new
requirements. Stop at a concrete capability or authority blocker, never bypass
checks. A source revert is the recovery for an incorrect implementation.

Research: current primary runner documentation confirms that job durations and
selected runner counts matter; source verification cannot prove billed cost or
available capacity. No research-derived private values belong in this plan.

### Plan critique

One independent supplied-artifact critique completed on Claude Opus 5.5 high.
Accepted: verify every paid consumer against its baseline, discover consumers
from runner-output use, and carry an explicit priority-origin discriminator into
Playwright metadata. The supplied packet omitted workflow YAML; main inspection
confirms the minimum existing paid timeout is 15 minutes.

Rejected: requiring a different merge strategy or post-merge repin. Published
immutable executor commits remain the established contract, and the generator
fetches exact objects even outside squash ancestry. Actual published parity is
a required verification. Deferred: a new maximum expiry horizon or date syntax
policy; the existing future-expiry check and separately approved finite operator
packet remain authoritative. Rechecking expiry at admission completion is added.

## Progress

Approved source batch; implementation and focused checks complete, publication
and integrated review pending. Root acceptance is one bounded
priority-canary qualification, which remains blocked on source acceptance and a
separate exact activation packet. This source batch proves the missing duration
control only. Independent plan critique is dispositioned above. Five new
regressions failed on the baseline and passed after implementation; parsed
consumer checks also pass. The strict workflow mapping was extended alongside
its new trusted output. The existing build-shell sampler fixture failure also
reproduces on the untouched baseline and remains an explicit limitation.

Next: publish immutable executor content, update caller pins, verify actual
parity and finish integrated review and draft CI. Main-session simplification
keeps the existing output path and defaults; no new module or dependency was
introduced. Static scan: no findings or errors in the five changed source files.
Draft CI and source review remain required; no live action follows automatically.
