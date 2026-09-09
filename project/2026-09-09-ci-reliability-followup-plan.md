# Reliable review execution and selective-draft qualification

## Approval summary

Make CI failures diagnosable and preserve the evidence needed to reduce draft
Playwright work safely. Deliver two coherent draft PRs against `v3`: first keep
the review executable pinned and report process failures safely; then provide
offline qualification of selective draft plans against complete full runs.

The user requested independent execution through this roadmap with a new goal
and stacked PRs. That authorizes source changes, verification, reviews, ordinary
non-force pushes and draft publication. It does not authorize merges, releases,
runner or repository settings, canary activation, new infrastructure, increased
model budgets, or destructive local runtime recovery.

Full ready-PR and push coverage, runner repository/workflow restrictions, cache
trust boundaries, and current retry/time/token budgets stay unchanged. Raw OCR
stdout, stderr, credentials and configuration remain suppressed. The observed
review failure is consistent with an updater race, but its exact historical cause
cannot be proved because the failed run retained no process diagnostics.

Success means two independently verified source packages, per-layer Actions
evidence, and an honest qualification report. Fewer than ten eligible selective
comparisons means insufficient evidence, not permission to activate selection.
The privileged review workflow runs trusted `v3` code, so branch tests cannot
claim post-merge execution proof. The legacy Devrouter stop blocker remains a
separate, explicitly owned recovery item.

## Execution details

Boundary owner: self. Main owns integration, topology and delivery. Worktree:
`trees/ci-reliability-followup`. Initial branch `rs/ci-review-execution`, target
`v3`, exact baseline `cbcede79718e8e60ff04d3f8376ab6a3f4bb64ed`.
The primary checkout is unrelated, dirty and behind; do not modify it.
Artifacts root: `project/`. This is full-path source delivery. No product
primitive or irreversible architecture changes are proposed; no ADR is needed.

### Verified starting evidence

- [Merged activity retry fix](https://github.com/uzh-bf/klicker-uzh/pull/5835)
  landed at the baseline above. Reuse its recorded pre-merge verification only
  for the exact source and runtime it examined.
- [Post-merge push run](https://github.com/uzh-bf/klicker-uzh/actions/runs/34327702924)
  built on hosted infrastructure in 3m41s. All eight hosted shards started three
  to four seconds later. They were running at the initial observation.
- [Failed final review](https://github.com/uzh-bf/klicker-uzh/actions/runs/34326218356)
  printed OCR 1.11.0 successfully, then exited 127 before findings. It retained
  zero artifacts. The existing 113 review-helper tests pass despite this gap.
- Upstream [OCR launcher](https://github.com/alibaba/open-code-review/blob/v1.11.0/bin/ocr.js)
  starts its updater unless `OCR_NO_UPDATE` is set. The
  [updater](https://github.com/alibaba/open-code-review/blob/v1.11.0/scripts/update.js)
  installs registry latest globally. Isolated evaluation of those exact sources
  proved both behaviors; disabling the flag prevented updater launch. This proves
  the pinning defect, not the precise cause of the historical exit.
- A disposable no-network shell probe of the actual workflow produced exit 127,
  empty public diagnostic output and no summary when fake OCR failed. This is
  the deterministic regression boundary for diagnostic loss.

Historical plans remain unchanged: [CI throughput](2026-09-05-ci-throughput-roadmap-plan.md)
and [scheduling efficiency](2026-09-07-pr-5816-ci-scheduling-efficiency-plan.md).
This follow-up addresses the newly observed process failure rather than reopening
the merged activity-test package.

### Stack topology

Native GitHub stack support was verified. Use one worktree with serial branch
switching and main as the only topology owner. Publish through the non-force
`gh stack link` path with explicit `v3` base. Keep the lower head fixed once the
upper layer begins unless an actual correction requires deliberate integration.
Never run automatic sync, force-push, reorder, unstack or delete existing branches.

| Layer and branch | Base | Complete work package | Review audience | Size signal |
| --- | --- | --- | --- | --- |
| Review execution — `rs/ci-review-execution` | `v3` | Immutable OCR process, safe failure diagnosis and command-boundary regression coverage | CI/security maintainers; judgment-heavy | 150–300 human-authored lines in 3–5 files; no generated changes |
| Draft qualification — `rs/ci-draft-qualification` | `rs/ci-review-execution` | Offline comparison of shadow plans with complete, identity-bound full-run evidence | Test/CI maintainers; judgment-heavy | 150–350 human-authored lines in 3–5 files; no generated changes |

Both are safe independently: the first fixes execution determinism, the second
adds evidence assessment without changing test selection. They form one CI
evidence-reliability milestone; there is no invented code dependency between them.
Keep tests with behavior, not as another layer. Rerule package boundaries if
actual scope exceeds the estimates; do not split by commit count.

### Delegation map and acceptance

| Slice | Owner | Dependency and acceptance |
| --- | --- | --- |
| Immutable OCR execution and safe diagnostics | Main | Credential-boundary coupling; both workflow jobs preserve failure, cleanup and budgets |
| OCR process regression coverage | Executor | Settled shell boundary; actual workflow commands exercise success, failure, version drift and non-disclosure |
| Qualification seam mapping | Existing explore child | Exact helper/test paths and available provenance fields; no duplicate investigation |
| Offline cohort qualification | Executor | Main accepts mapped seam and parser; valid cohorts pass while mismatches, duplicates and missing reports cannot qualify |
| Real evidence, integration and draft delivery | Main | Per-layer checks, readiness report and separately owned runtime proposal |

#### Review executable and diagnostics

Set `OCR_NO_UPDATE=1` for both individual and stack review jobs before installation
verification or review. Validate the expected installed version before each
actual attempt, including resumes and incremental ranges. Do not upgrade the
package, change the provider or add another retry.

Capture process exit explicitly rather than allowing `set -e` to lose the
diagnostic. Emit only fixed stage identifiers, numeric exit status and bounded
numeric output sizes; never print raw version mismatch text, stdout, stderr,
provider responses, environment, configuration or arbitrary paths. Preserve the
original nonzero process exit before resume/publication. Version mismatch fails
closed. Existing cleanup and rejected-validation artifact policy remain intact.

Extend `.github/scripts/final-ai-review.test.js` at the actual workflow shell
boundary. Synthetic OCR exercises individual/full/resumed and stack/full/range/
resumed invocations. Secret sentinels in fake output must never enter diagnostics.
Do not assert prose. Update `docs/ci-and-deployment.md` with the pinned-tool and
diagnostic contract, without changing unrelated guidance.

#### Offline draft qualification

Do not modify production selector behavior. Freeze the helper/parser seam after
the existing mapping returns; a small new offline helper and its tests are
explicitly allowed if no reusable qualifier exists. Proposed paths are
`.github/scripts/playwright-shadow-qualification.cjs` and its adjacent test.
Return to the same planner before choosing an incompatible parser or broader
producer change. The existing Python timing parser rejects failing reports and
therefore cannot be reused unchanged for missed-failure evidence.

Bind repository/PR, actual event draft state, head/base/merge-base, trusted
control SHA, run/attempt and artifact provenance to canonical and shadow plans
and all eight full-run reports. The route's effective selector state is not the
actual event draft state. Operator-acquired GitHub metadata supplies provenance;
arbitrary local JSON is not an attestation. Bound inputs, reject unsafe paths
and XML entity/DTD inputs, and handle failures as data rather than dropping them.

Require ten unique eligible selective comparisons, with no unexplained omission.
Deduplicate reruns and repeated observations of the same candidate. Keep `v3`
and `v3-ai` populations distinct. Missing, expired, cancelled, partial or mixed-
attempt reports produce insufficient evidence. Full-fallback controls cannot
count toward the ten. Report spec-only, feature, shared, documentation, new/
deleted-spec and unknown-change controls separately as applicable: documentation
can skip and unknown/deleted specs can correctly fall back to full.

Recover any existing collector before starting monitoring; no second watcher,
manufactured runs, retries or new telemetry service. Report insufficiency after
the bounded current cohort assessment and preserve resumption evidence. Never turn a completed readiness
report into a claim that qualification passed.

### Test portfolio and delivery gates

| Risk | Obligation and primary seam | Required evidence |
| --- | --- | --- |
| Executable changes under a pinned workflow | Extend existing shell boundary tests | Update suppression spans installation/version/review; drift fails closed |
| Failed process hides evidence or leaks output | Extend same shell boundary | Original nonzero exit, safe structured summary, no sentinel leakage, no publication/resume after failure |
| Incomplete or mismatched cohorts look qualified | New offline evaluator test only where no existing seam exists | Complete synthetic coverage, duplicate/mismatch/partial rejection and missed-failure detection |
| Full coverage and trust regressions | Reuse existing policy/route tests | Ready/push full coverage and runner/cache/permission restrictions unchanged |

Use the existing pinned disposable Node 24.16.0 toolchain for dependency-free
checks; no application runtime, browser or database is needed. Run syntax,
focused Node tests, workflow policy, scoped formatting, secret scan and exact
diff inspection. Keep container-dependent tooling in a container. Do not bypass
Git hooks; report a missing verification capability honestly.

Commit the plan first, then coherent implementation/test slices. Run substantive
slice simplification and risk review, followed by an integrated final review.
Publish ordinary draft layers and verify their actual bases, heads and Actions.
Draft CI proves only the code it executes. Privileged workflow execution remains
a clearly named post-merge gate; do not post a fresh review on the merged PR.

Terminal: reviewed draft stack and exact-head verification/readiness evidence,
with externally gated actions reported separately. Pause only for a material
scope/trust/cost decision, failed required review capability, unsafe runtime
operation, or missing authority. Source revert is the rollback; no live changes
are included.

### Separate legacy runtime custody

The existing Devrouter task owns a data-preserving recovery proposal. Its
retained-exec work restores tool access only and does not solve the missing
stop baseline/config drift. Do not mutate, stop, restart, bootstrap or recreate
the legacy runtime from this CI stack. Record its unresolved custody separately
from CI runner performance and post-merge test success.

## Progress

New goal active. Worktree is clean at the merged `v3` baseline. Baseline review
tests: 113 passed. Upstream updater behavior and missing shell diagnostics are
reproduced. No source changes or PRs published yet. No new watcher has been
started; post-merge Playwright is running.

Planner round one requested explicit safe-exit coverage, a real qualification
seam, complete cohort definitions and fixed ownership. All were accepted.
Round two approved the plan, with parser compatibility and category accounting
retained as preimplementation conditions for the upper layer. Browser review
cannot cover unpublished local runtime evidence without separate destination
authority; the complete scope remains on the trusted native route. An optional
cross-provider challenge has not yet completed and is not a passed review.
