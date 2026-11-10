# Reliable local developer commands

## Approved outcome and authority

Make local verification, Playwright command discovery and contributor onboarding
reliable in one coherent package. The user approved this batch on 2026-11-01 in
message `msg_01a19805-ccd9-7c60-90c5-19c37810e527`. The unchanged approval input and
historical realignment material are retained in ignored local evidence at
`project/_local/dx-implementation/approved-proposal.md`.

Owner: the existing execution session. Branch:
`docs/developer-experience-realignment`; target: `v3`. Source baseline:
`e6d813a530f1d9d148ca90e299a54beca0fdba0e`. This is a full-path package because
its developer command contracts change. No product primitive, data model,
application UI, dependency, platform configuration or release behavior changes.

Approval covers the named source/documentation changes, a task-scoped tooling
container built from the existing devcontainer Dockerfile, exact container cleanup,
checks, local commits, a normal task-branch push and one draft PR to `v3`.
It excludes marking ready, merge, protected pushes, deployment, provider
reconfiguration, production access and manually initiated paid inference.

## Contracts and scope

1. `check:all` calls the existing whole-tree `format:check`. The staged-only
   `check:format` escape hatch remains. The pre-commit hook itself is unchanged:
   it inherits whole-tree formatting only when its existing dependency guard
   executes the aggregate. Missing and filtered host installs keep their skip.
   Both formatting paths remain check-only; no duplicate hook step is added.
2. Launcher `--help` and `--version` return before executable probes,
   host-boundary enforcement, installs, environment resolution, runtime markers,
   writes or lifecycle operations. Values of other options are not treated as
   flags. Invalid launcher options retain their nonzero, effect-free rejection.
   Help describes launcher options without duplicating the full Playwright help.
   Version reads metadata in the Playwright workspace; absent or unreadable
   installed metadata, it labels the declared package requirement and distinguishes
   a missing installation from an unavailable version.
   Ordinary test, list, report, print-env and CI-runtime behavior stays intact.
3. README navigation reaches the existing setup, feature and testing guides.
   The obsolete response/LTI paths point to `apps/response-api`,
   `apps/hatchet-worker-response-processor` and `apps/lti`. Setup places host
   prerequisites before startup and uses `.devrouter.yml` as the version source.
   The Playwright guide explains direct Node help and the guarded pnpm wrapper.

The write set is `package.json`, `util/run-playwright-host.mjs`,
`util/run-playwright-host.test.mjs`, `README.md`, `docs/getting-started.md`,
`playwright/README.md`, affected command descriptions in `AGENTS.md`, and this plan.
Extend the existing test file; add no production module or test-only application
code. Preserve lockfiles, hooks, formatter configs, CI and devcontainer sources.
No ADR is warranted; reconsider only if platform or application architecture grows.

## Sequence and acceptance

One owner integrates the small shared command seam. First prove dependency-free
information through the real executable, then change and qualify formatting,
finish onboarding and complete repository checks before publication.

| Contract                   | Required evidence                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Informational function     | Cold/warm help/version, optional prefix delimiter, valid launcher prefixes, invalid options and flag-as-value cases. Zero command, install, version-probe, write/remove/mkdir or runtime-plan effects.                                                                                                                                                                                     |
| Executable entry           | Real pinned-Node processes from a cold snapshot without node_modules, with external commands unavailable; successful informational output and unchanged filesystem. Manual host smoke supplements the function harness.                                                                                                                                                                    |
| Package wrapper            | Help/version through `pnpm run playwright:host` in a supported installed host state. Cold/stale wrapper rejection is the existing pnpm guard, not permission to auto-repair. Use only the supported filtered host install in a disposable verification copy when needed; never install a full host tree for hooks.                                                                         |
| Whole-tree aggregate       | Actual `check:all` in a disposable verification copy: a valid but incorrectly formatted committed JSON fixture with a clean index must fail in the formatting subtask. Repair the fixture and require the aggregate to pass. No fixture enters the task-branch commit.                                                                                                                     |
| Timing                     | One first-run and three warm timings for staged-only versus whole-tree formatting, with identical toolchain/cache and recorded file scope. Compare aggregate before/after on the same host-prepared staged change. Time the actual host hook separately and identify execution versus skip. Only claim full-install host-hook overhead when an already supported full host install exists. |
| Onboarding and integration | Resolve every touched destination and walk README through prerequisites, startup, focused verification and cleanup. Inspect warn-only AGENTS smoke output. Run format:check, check:all, build and focused launcher tests.                                                                                                                                                                  |

Use the pinned Node/pnpm/uv tools inside the approved tooling container for
installs, checks and builds. All Git/gh operations and synthetic fixture commits
remain on the host; container checks may read the mounted Git metadata. Do not run
the entire host Git hook inside the container or mistake its skip for full checks.
Use existing frozen inputs, isolated dependency/cache mounts and no app services,
devcontainer lifecycle hooks, database reset/seed, secret injection or browser run.

Tests protect observable effects and metadata contracts rather than help prose.
Existing ordinary launcher coverage remains; no new maintained formatting-script
wording or documentation tests are required. Reuse passing evidence when source,
toolchain and environment match. Negative/positive controls justify their paired
runs. No screenshots or application E2E are applicable to this nonvisual change.

## Delivery, recovery and review

Terminal: one verified draft PR with the complete candidate, in-scope CI and
feedback reconciled, and the exact tooling container stopped/removed. Report source
checks, hosted CI, review, publication and cleanup separately. No merge-readiness,
deployment or production acceptance claim follows from this package.

A missing tool or daemon blocks only dependent proof. Preserve the first failure,
distinguish baseline issues from regressions, and apply one evidence-backed
correction before changing the diagnosis. Do not weaken full-tree checks or expand
into dependency upgrades, unrelated formatting, host repairs or data operations.
Source revert is the ordinary rollback. A materially prohibitive timing result
requires an explicit alternative, not an invented speed threshold. Preserve
unaffected verification after corrections.

Keep one owned tooling container and one CI watcher; never prune shared resources.
Remove only that exact container and its task-owned anonymous dependency volumes
after verification, preserving local evidence. Downloads use local disk/bandwidth;
CI and configured draft review use existing project allowances. No budget increase
or new cloud resource is approved. Stop at a hard usage/provider limit. Required
human review still blocks merge; do not request reviewers or notify people.

The independent native planner critiqued the complete proposal, required separate
container-aggregate and guarded host-hook evidence, then approved the correction.
The detailed advice and original approved proposal remain in ignored local review
records. Integrated final review is by the main session unless an actual
consequential risk, unresolved finding or explicit repository rule requires an
independent implementation review. Meaningful complexity, not a commit alone,
arms simplification. Standing platform reviews remain a separate evidence layer.

## Progress

Source is complete at the recorded baseline, equal to fetched `origin/v3`.
The candidate contains 224 substantive changed lines across the task definition,
launcher and its existing tests; documentation and this plan are excluded from
that calculation. One cohesive package remains appropriate.

Verification passed: 47 launcher tests, cold direct and installed host-wrapper
information, all touched documentation links, zero AGENTS smoke warnings,
whole-tree formatting, all 35 aggregate tasks and the full 23-task build.
The focused Opengrep scan ran 200 rules against the two changed JavaScript files
with zero findings. Main-session diff review found no out-of-scope hunks.

The disposable-copy controls passed: the previous aggregate accepted a formatted
staged fixture; the updated aggregate rejected a committed formatting defect with
a clean index, then passed after repair. Timings were 70.1 seconds before,
13.7 seconds for rejection and 29.7 seconds after repair; different cache states
prevent a speed comparison. Warm formatter medians were 0.45 seconds for the
staged-only empty index and 10.4 seconds for the whole tree. Actual missing and
filtered host-hook paths passed in 0.20 and 0.12 seconds, both skipping the
aggregate as designed; no full-install host-hook timing is claimed.

Frozen installation and checks used the existing pinned tooling image with
isolated dependencies. Initial aggregate failures exposed missing CI planner
tooling and concurrent package generation; the existing pinned CI planner and
package prebuilds resolved these environment prerequisites without source changes.
No application service was started. Source checks do not prove hosted CI.

The first candidate was published as [draft PR #6786](https://github.com/uzh-bf/klicker-uzh/pull/6786).
Hosted CI passed all eight required contexts on `b4596bf398`. Automated feedback
found one reproducible low-severity defect: incomplete or unreadable installed
metadata made version inspection fail. The correction falls back to the declared
requirement without preparation and labels that version as unavailable. Its new
regression test passes; the corrected aggregate and focused scan passed again.

The report-artifact formatter finding was not reproduced. Pinned Prettier 3.3.3
honors root `.gitignore`: synthetic HTML reports and result JSON are ignored,
blob ZIPs have no inferred parser, and the actual directory check passes with
these artifacts present. Formatter configuration stays unchanged. The public
PR description carries this disposition without an additional comment.

The original tooling container was stopped and removed with its anonymous
volumes. A correction-only container uses the same pinned image and owned
verification copy's existing isolated dependencies; no app service was started.
The full build and unchanged formatting-control evidence remain applicable.

The next automated review found a macOS fixture-path defect and a missing
no-probe assertion. The process test reproduced the macOS failure; canonicalizing
its temporary path fixes the entry-point mismatch. Both informational harnesses
now reject Devrouter resolution. All 47 tests pass on macOS and Linux; the focused
scan passes. The suggested prose-label assertions are declined under the
repository's content-independent testing rule; actual output was checked manually.

Remaining delivery: commit and normal push of the test correction, followed by
current-candidate hosted CI and feedback reconciliation. All owned tooling
containers are removed. No application source changed after the passing build
and aggregate; their evidence remains applicable.
Review remains by the main session under the risk ruling above. Detailed logs,
control fixtures and terminal verification remain ignored local evidence.
