# Playwright resource sampling

## Approval summary

The user approved bounded in-job resource sampling to explain broad self-hosted
test slowdown. Add a dependency-free command wrapper to existing build and shard
actions and upload numeric samples with existing telemetry artifacts. Keep job
exit status, full coverage, cache policy, runner count, permissions, and group
restrictions unchanged. No host configuration or new service is required.

Approval mode: executable batch. Authority: implementation, focused verification,
ordinary push and draft PR. No merge, runner mutation or canary activation.
Terminal: verified source package and draft PR; trusted reusable workflow runtime
proof remains a post-merge gate. Boundary owner: self.

## Execution details

Owner: main, following the user's no-subagent instruction. Planning and review
are main-session checks, not claimed independent specialist passes.
One cohesive package on `rs/playwright-resource-sampling`, targeting `v3` at
`42864be70b0a9059aaa1c81e265a153a842aac96`.

Sample every ten seconds, at most 361 rows per command. Read numeric CPU counters,
available memory and pressure stall totals from Linux procfs. These are host-wide
observations visible inside the job container, not job-exclusive usage. Missing
metrics remain null. CPU guest counters must not be double-counted. Pressure
totals permit interval pressure calculations without enumerating disk devices.
Do not read environment contents, command lines, process lists or network data.
No new privilege or host mount. Preserve command exit and forward cancellation
to the wrapped process group; no detached sampler survives command completion.
Sampling errors must not fail otherwise successful tests.

Wrap Prisma build, application build, and service-readiness/test execution.
Keep their separate bounded files in the existing seven-day telemetry artifact.
Tests cover numeric parsing, missing data, nonzero child exit, sample bounds and
termination. Verify action wiring and syntax, inspect the full diff and scan
staged content. No app runtime is needed for this diagnostic wrapper.

This extends the earlier operator telemetry with an in-job timeline after actual
measurements showed start/end snapshots could not explain the slowdown. It does
not imply the prior host configuration needs another apply. No product primitive
or hard-to-reverse architecture decision changes; no ADR is needed.

## Progress

Implemented sampler and existing artifact wiring. Four focused Node tests pass:
numeric parsing, missing counters, child failure with unavailable output, and
cancellation forwarding. The one-hour cap is inspected in source; a full-hour
runtime test has not been run. Formatting and diff checks pass. Main-session
review covers bounded output, no secret collection, missing metrics, and unchanged
exit behavior; no independent review is claimed under the user's override.
Full monorepo builds are not claimed. Existing primary and runner-operations
worktree changes are untouched. Remote CI and Linux runtime evidence are pending.
