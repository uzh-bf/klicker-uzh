# Reliable local startup and staging verification

## Approval summary

The local primary checkout cannot start while its PostgreSQL publication and
the shared router both claim loopback port 5432. The recommended fix is to give
the primary database a random loopback port, matching linked worktrees. Keep
the stable routed database hostname for compatible clients. Host Playwright
requires a direct published port today, so removing publication entirely would
break an existing workflow.

Validate the change with the current host CLI and Devsy, preserve the primary
checkout's unrelated changes, and prove the already-merged process-liveness
guard with healthy and early-exiting synthetic processes. Controller reporting
after a refused startup belongs to the existing Devrouter task. A misleading
phase is a credible concern; automatic restart and leaked capacity remain
hypotheses requiring upstream evidence.

The scope preserves application behavior, tenant isolation, citation display,
production data, and release policy. It introduces no database migration or
dependency. Changing the primary direct database endpoint is the compatibility
tradeoff; automatic port discovery and updated instructions address it.

This request authorizes review and this plan. Proposed implementation approval
covers the port/documentation package to `v3`, the liveness-test package to
`v3-ai`, focused checks, bounded synthetic local Devsy verification, commits,
review, and draft PRs on those two targets. It does not authorize
merges, branch integration, deployment, global CLI installation, shared-router
reconfiguration, destructive cleanup, or changes in the Devrouter repository.
Completion requires the two source packages and passing local acceptance,
stopped test runtimes, and an explicit disposition of upstream findings. If a
runtime check is unavailable, source-only draft delivery remains useful but
verification-incomplete. Staging
observation is independent and does not block the local source package.

## Execution details

### Working context and authority

- Plan status: proposed executable batch; implementation has not started.
- Planning branch: `rs/runtime-reliability-plan`, based on `origin/v3` at
  `02aaaa87b14c2d27db8ceb9a8e617ec5a5875fef` after a successful fetch on 2026-09-20.
  Worktree: `trees/rs/runtime-reliability-plan`; artifact root: `project/`.
- Owner and boundary owner: main task. Keep the new plan uncommitted while it
  is under discussion, then include it in the runtime implementation package.
  No new task, runtime, or monitor is created by planning.
- Liveness target: `v3-ai` at the observed baseline
  `545a6ef746c2d6585e7e06424c0bd03ec96da096`; create its task branch from the
  refreshed owning line when executing slice 2. The packages have different
  bases and are independent PRs, not a stacked branch integration.
- Primary checkout: `v3` at `86fc70c77f756827d55ea9d0afc5cac3344630cf`, 137 commits
  behind fetched `origin/v3`, with unrelated tracked and untracked work. Leave
  those files, its branch, database, and runtime untouched. A current task
  worktree supplies source freshness without synchronizing this dirty checkout.
- Material pauses: an actual dependency on a legacy fixed-port client; a need
  to mutate another task's runtime; unavailable exact-owner stop/readback; a
  required provider or process-helper contract change. Continue independent
  source and documentation work when one runtime check is blocked.

### Review findings and corrections

| Area | Verified evidence | Disposition |
| --- | --- | --- |
| PostgreSQL collision | `.devcontainer/docker-compose.localhost.yml` publishes `127.0.0.1:5432:5432`; the prior live reproduction found the shared router already holding it. The linked overlay publishes `127.0.0.1::5432`. | Change only primary database publication to an ephemeral loopback port. Reproduce on current source before claiming current runtime failure. |
| Host consumers | `util/run-playwright-host.mjs` resolves the checkout's PostgreSQL container, calls `docker port ... 5432/tcp`, and builds a loopback database URL. | Preserve publication. This overturns the earlier recommendation to drop it. |
| Stop result | Prior stop returned `stopped:false`, `freedRoutes:0`; subsequent state was stopped-by-user/idle with no active resources. | Consistent with an idempotent no-op. Preserve the distinction between no work performed and failed stop. |
| Refused ensure | Prior validation failure left desired running, phase stable, and no active resources. | Confirm the controller's phase contract with the upstream owner. Retained user intent can be valid; phase naming alone does not establish automatic restart or leaked capacity. |
| CLI selection | Current `v3` requires `0.0.72`; the dirty primary declares `0.0.51`. `util/devrouter-cli.mjs` selects a host executable, logs installed/required versions, accepts versions at or above the minimum, and supports `KLICKER_DEVROUTER_BIN`. | This is a minimum-version contract, not an exact pin. Record the actual binary and version. Do not downgrade to 0.0.51 or propose obsolete 0.0.52 as an upgrade. |
| Liveness guard | PR [#6170](https://github.com/uzh-bf/klicker-uzh/pull/6170), merge `ff94697eb870aa6dfb6f65cd9913e508188de063`, is on `v3-ai` and `v3-audit`, but absent from fetched `v3`. | Test the existing guard on its owning line; do not duplicate or silently pull the entire integration branch into `v3`. |
| Liveness coverage | `verify_managed_process_alive` checks the state-file PID and non-zombie process status twice. Its existing harness uses a helper returning success without a state file. | Missing-state failure is covered. Death during the grace interval and healthy survival need behavioral evidence. The separate worker ancestry/cwd/cmdline check does not prove this guard's PID identity. |
| Staging promotion | The trusted default-branch workflow already wakes on successful quality-workflow completions, including Playwright. The promoter tests protect latest evidence selection, stale candidates, concurrent updates, and ref readback. | Retract the claim that only a new build or manual dispatch can reconsider a candidate. Preserve existing policy and tests. |
| Key prerequisite | PR [#6174](https://github.com/uzh-bf/klicker-uzh/pull/6174) is merged at the fetched `v3` head. | The stale checkbox is closed. No key rotation, new secret, or duplicated correction is planned. |

The GLM 5.3 Flash/max consultation is advisory evidence. Accepted: keep routed
hostnames, qualify state reporting, verify liveness, and distinguish promotion
from deployment. Revised: preserve direct publication for Playwright and treat
the version declaration as a minimum. Deferred: scheduled auditor, new receipt
fields, PID birth-identity changes, and a capacity-leak fix without a reproducer.
The earlier reply incorrectly used the old checkout's worker check to dismiss
PID reuse in the new guard; that claim is withdrawn.

The prior observation that sandboxed status could not inspect routes supports
an unknown-observation diagnosis, not proof of route drift. Do not erase state
or infer ownership from empty routes. The relationship between the capacity
ledger error and port admission is still unknown.

### Decisions and alternatives

Retain the shared TCP route and use random direct loopback publication for
both checkout types. Reject removing the route because it breaks namespaced
database access. Reject removing all publication because the current host
launcher depends on it. Alternate fixed ports or loopback addresses are reserved
for an identified compatibility requirement, not added preemptively.

The scoped consumer search also found fixed localhost access in
`util/backup/prepare_local_prod.sh`. At the recorded baseline it changes to the
repository root and invokes the separate root Compose stack, which publishes
its own database port. It does not select the managed primary overlay. Leave
this production-dump restoration workflow unchanged and unexecuted; it is not
a dependency of this change.

Reuse CLI selection and existing health contracts. Record CLI path, installed
version, repository minimum, selected runtime (Devsy), revision, and checkout
for each runtime result. Do not install or configure a provider during testing.

No product primitive changes are proposed. The work preserves the existing
local topology; no new ADR is required. Reopen the ADR decision if execution
would alter shared routing ownership, persistence, or release policy.

### Verification portfolio

| Consequential behavior | Existing protection | Planned evidence and test obligation |
| --- | --- | --- |
| Primary startup coexists with shared TCP routing | Linked overlay already uses ephemeral publication | Test obligation: none. Render the merged Compose configuration; verify only loopback exposure and no fixed database host port. Then exercise primary-overlay startup with the router present in an isolated synthetic checkout. |
| Host Playwright and routed clients reach the correct database | `util/run-playwright-host.test.mjs` covers published-port parsing, workspace URLs, container discovery, and CLI selection | Test obligation: none. Reuse these tests and verify synthetic DB connections through both the discovered direct port and retained routed hostname, in primary-overlay and linked modes. A newly reproduced failure requires explicit portfolio reassessment before adding coverage. |
| Liveness succeeds for a survivor and fails for an early exit | `util/test-dev-runtime.sh` covers missing state; readiness tests cover bounded HTTP checks | Test obligation: extend existing. On the line containing #6170, extend the harness for real test-process exit during grace. Assert nonzero exit and no readiness pass, rather than matching error prose. Run healthy and failing cases through the delivered helper in a disposable Devsy runtime. |
| Refused startup has correct state and accounting | Prior live reproduction; upstream contracts not yet revalidated | Test obligation here: none; upstream owner determines regression coverage. Validate conflict refusal, successful ensure, and stop, with no workload/routes after refusal and correct reservation ownership at each boundary. Do not assume every transient reservation must be zero. |
| Release evidence distinguishes progress from failure | `.github/scripts/stg-release-promoter.test.js` already protects ancestry, races, evidence identity, and readback | Test obligation: none. Read candidate CI, latest promotion receipt, and release ref together; mark deployment/runtime unknown unless separately observed. |

### Ownership and dependencies

| Work | Owner | Dependency and completion check |
| --- | --- | --- |
| Port package | Main task | Current `v3`; direct and routed database acceptance plus stopped runtime. |
| Liveness package | Main task | Owning `v3-ai` contains #6170; behavioral harness and real-helper acceptance. Independent of the port package on a linked runtime. |
| Controller disposition | Main task for evidence; existing Devrouter task for upstream implementation | Existing owner result; confirmed issues or explicitly open hypotheses recorded. Messages remain subject to coordination authority. |
| Staging observation | Main task | Candidate CI completion; source, promotion, deployment, and runtime evidence labeled separately. Independent of both local packages. |

### Delivery sequence

1. **Restore collision-free database access.** In this worktree, change
   `.devcontainer/docker-compose.localhost.yml` and the affected primary-access
   instructions in `.devcontainer/README.md` and `docs/getting-started.md`.
   Keep `util/run-playwright-host.mjs` unchanged unless the consumer check
   exposes a concrete discovery defect. Preserve unrelated ports and aliases.
   First prove the effective Compose configuration and existing host-runner
   tests. Finish with synthetic runtime evidence for primary-overlay and linked
   startup, direct and routed database access, and stop. Source changes and documentation form
   one cohesive commit/package targeting `v3`.

2. **Close the liveness evidence gap.** Reuse the existing #6170 implementation
   on a clean checkout of its owning integration line. Add only the missing
   grace-interval behavior checks to `util/test-dev-runtime.sh`. Do not introduce
   a second process supervisor or modify the helper-owned state schema.
   Record healthy/failing adapter evidence and confirm failure exits before
   readiness. Deliver the test changes in a separate focused draft against
   `v3-ai`, recording its refreshed baseline; do not silently bundle unrelated
   `v3-ai` changes into the `v3` port fix. Bringing the guard into `v3` is a
   separate integration decision.

3. **Disposition controller findings with the existing owner.** The Devrouter
   task (`01a095a9-2307-76d3-8ce8-2dcd14b52da0`) owns failed-ensure phase,
   observation uncertainty, capacity accounting, and helper identity semantics.
   Read its latest result before duplicating investigation. Supply the bounded
   reproduction when coordination is authorized. Require tested upstream
   evidence before marking those items fixed. These findings do not prevent
   the independent Klicker port change from being delivered.

4. **Verify staging independently.** Refresh source/release refs and the exact
   candidate's CI once, then inspect the resulting controller receipt after CI
   completes through an authorized supported watcher. A pending or failed gate
   explains lag. Investigate a missing controller run only when all required
   evidence is successful. Do not dispatch promotion to manufacture a green
   result. Link the evidence in this plan and return to chatbot acceptance when
   the required revision is deployed; infrastructure cleanup does not redefine
   the original Doc Query task.

Container-dependent checks run in the selected Devsy container; host Playwright
runs through `pnpm playwright:host`. For the primary-overlay test, use a fresh
disposable primary checkout outside the dirty control checkout with a distinct,
verified runtime identity. Check shared aliases and fixed ports before starting;
if it cannot coexist safely, record this specific coverage gap and stop only
that test. The affected package remains verification-incomplete; a source-only
draft may be delivered, but runtime acceptance and completion stay blocked.
Never stop another workspace to obtain the port. Stop and verify
every runtime started by these tests; preserve artifacts and volumes pending
separate deletion authority. Use only synthetic data, with no external LLM call.

### Staging snapshot and optional improvements

At the planning refresh, `origin/v3-audit` was
`55efc535a6b6d31643b8670e6eaff9e97911a971` and `origin/stg-release` was
`19c5da241191ac72ed25d39e167a640f214b72aa`. Playwright run `35501900380`, attempt 2,
reported queued. This snapshot is not a deployment-health claim or a forecast.

The promotion receipt already includes candidate, controller, previous/applied
release revisions, workflow evidence, image digests, and scan evidence. Its
`verified` readback concerns the release ref. GitOps adoption, running images,
and browser acceptance remain separate checks. See
[the controller plan](2026-09-04-stg-release-controller-plan.md) and
[CI/deployment documentation](../docs/ci-and-deployment.md).

An observed source-head field could improve explanations of intentional
ancestor promotion, but is not needed for the port or liveness fix. Consider
it only after a concrete operator ambiguity survives the existing evidence.
A scheduled auditor is deferred until a repeated missed-event problem or an
explicit monitoring request justifies another workflow and its API usage.
Do not treat every head/release difference as an incident.

## Progress and review

- Completed: current remote refresh; source/consumer/test review; correction
  of earlier GLM discussion conclusions; PR #6170/#6174 and CI snapshot checks;
  isolated planning worktree created.
- Slice 1 delivered: commit `a4cc7f23c9` (ephemeral PostgreSQL loopback port
  plus the affected primary-access instructions) on
  `rs/runtime-reliability-plan`, draft PR [#6176](https://github.com/uzh-bf/klicker-uzh/pull/6176)
  to `v3`. Evidence: effective Compose render for both overlays; `node --test
  util/run-playwright-host.test.mjs` 39 pass / 0 fail; synthetic containers for
  both overlays started while the router held `:5432` and answered through the
  discovered direct port and the devnet aliases; both test projects stopped
  with volumes preserved.
- Slice 2 delivered: commit `e2b4e6f840` (grace-interval death and survivor
  cases in `util/test-dev-runtime.sh`, coverage note in `docs/testing.md`) on
  `rs/runtime-liveness-guard-tests` from the refreshed `origin/v3-ai`
  `545a6ef746c2d6585e7e06424c0bd03ec96da096`, draft PR
  [#6177](https://github.com/uzh-bf/klicker-uzh/pull/6177) to `v3-ai`. The full
  harness passed twice outside the sandbox; a restricted sandbox cannot inspect
  processes and that attempt is not counted as evidence.
- Slice 3 disposition: the existing Devrouter task reports 0.1.1 released, with
  a refused `ensure` now surfaced as `start-refused` plus `devrouter doctor
  <repo>` remediation that names the conflicting binding and its holder,
  verified live against a synthetic fixture publishing `127.0.0.1:5432` while
  the router held it. The checkout pin is a minimum contract, not an exact pin,
  so adopting 0.1.1 is a separate source decision and is not part of this plan.
  The upstream owner still asks for the before/after `status --json` pair around
  the `{"stopped": false, "freedRoutes": 0}` observation; that reproduction
  needs a disposable managed runtime and stays recorded as open here rather
  than claimed as verified.
- Slice 4 evidence (independent of the source packages; execution-time
  snapshot): candidate
  `55efc535a6b6d31643b8670e6eaff9e97911a971` (`v3-audit`) passed Playwright run
  `35501900380` attempt 2, and the promotion controller woke for the candidate
  (`35506556527`, queued at snapshot). `stg-release` resolved to
  `19c5da241191ac72ed25d39e167a640f214b72aa`, so the result is recorded as
  promotion-pending evidence: no deployment or runtime-health claim is made and
  no promotion was dispatched.
- Active slice: none; the two source packages are delivered as drafts, the
  upstream disposition is recorded, and staging observation continues from the
  controller receipt.
- Existing history: [Doc Query canary plan](2026-09-04-doc-query-canary-activation-proof-plan.md)
  and [host Playwright plan](2026-08-30-playwright-profile-runtime-plan.md).
  Preserve their historical evidence rather than rewriting completed plans.
- Review provenance: prior GLM consultation reused and independently checked
  against current source. Planner `01a0be6b-563f-7d30-8bed-d53d9c73f3d1`
  approved the corrected plan after one revision round. Its five findings
  clarified delivery targets, ownership, test obligations, runtime completion,
  and the resolved backup-script boundary. This is planning review, not
  implementation approval or runtime evidence. The full disposition is in
  `project/_local/reviews/2026-09-20-local-runtime-reliability-plan-hardening.md`.
  Markdown formatting and all four local document links pass; no application
  runtime was started for this documentation-only work.
- Required delivery now: reviewed project plan. Proposed later delivery:
  focused source PR(s) and bounded local acceptance, with upstream concerns
  tracked explicitly and no claim of release completion.
- Next action after implementation approval: apply the primary random-port
  change and focused checks in the current planning worktree.
