# PR 5315 production-readiness evidence

Date: 2026-08-25

## Scope

This report records the local verification of PR 5315, which exposes per-element
received and processed response counts in the live-quiz cockpit. The readiness
fixes cover regular and assessment response processing, replay safety, cockpit
count degradation, response-tracking cleanup, and cockpit icon alignment.

The local audit branch was refreshed against the current `origin/v3` before
this verification. It also
contains the approved counter and replay-claim redesign described below.
No remote merge, deployment, or production-data access was performed.

## Changes verified

- Regular and assessment aggregation build Redis commands locally, then use one
  atomic Lua script that validates command targets before mutation, claims a
  bounded replay identifier, applies the batch, and increments the numeric
  processed counter only after every command succeeds. Concurrent retries and
  lost replies therefore cannot apply a successfully completed aggregation
  twice within the replay horizon. Preflight and first-command failures release
  the claim and are retryable; a later failure retains the claim and returns
  `reconciliation_required` so non-idempotent writes are not retried.
- New ingress writes a numeric received counter. The legacy received set is
  read-only compatibility input, and the cockpit adds its cardinality while
  old response-api instances drain.
- The processing script captures per-command Redis errors with `redis.pcall`.
  A failure before any aggregation command succeeds releases the replay claim,
  returns `aggregation_failed`, and the worker throws so Hatchet can retry. A
  later failure retains the claim, returns `reconciliation_required`, and the
  worker acknowledges and logs the message for reconciliation instead of
  retrying already-applied non-idempotent updates. Connection-level failures
  still throw so the worker can retry.
- Cockpit response-count resolution degrades all response counts to `null`
  when its count pipeline fails; the rest of the authorized cockpit query
  remains available.
- Numeric counters and age-trimmed replay claims use bounded retention.
  `endLiveQuiz` starts retention on instance-info keys before expiring leftover
  tracking keys, so late responses cannot recreate persistent tracking keys.
- Deployment must publish GraphQL before new ingress and drain old processors
  before initializing processed counters. Old processors do not increment the
  new processed counter. The current staging values roll all fifteen
  components together, so this ordering is a release gate rather than an
  ordinary promotion behavior. Do not promote this cutover until mixed-version
  workers are counter-compatible or an explicit rollout provides that order.
- The persisted-operation manifest retains the previous `GetCockpitQuiz` hash
  while old Manage bundles drain. GraphQL generation rebuilds that compatibility
  entry through `packages/graphql/scripts/merge-persisted-query-compatibility.mjs`.
- Cockpit status, participant, external-link, and response-count icons use fixed
  inline or flex boxes so their optical alignment is stable.
- The response API records when received-response tracking is skipped because
  the instance-info key is missing, awaits tracking with a 250ms deadline before
  enqueueing the Hatchet event, and assessment cleanup propagates Redis failures
  for Hatchet retry. A slow tracking attempt can delay the request by up to
  250ms; timeout and failure paths are caught at ingress.

## Local evidence

| Check                                        | Result                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Response-processor typecheck                 | Passed                                                                                                                                                                                                                                                                                                                                             |
| Response-processor unit tests                | 9 passed across regular and assessment processors, including atomic script calls, replay guards, partial-failure handling, reconciliation acknowledgement, and connection-level failure propagation                                                                                                                                                |
| Util tests                                   | 54 passed across the real-Redis integration suite, including command preflight, replay retention, and same-message partial-failure deduplication                                                                                                                                                                                                   |
| GraphQL cockpit count tests                  | 3 passed; compatibility reads, scheduled nulls, and pipeline-failure degradation are covered                                                                                                                                                                                                                                                       |
| Cockpit Redis fault-injection test           | Passed; a failed count pipeline returned the cockpit with `null` response counts                                                                                                                                                                                                                                                                   |
| GraphQL code generation                      | Passed; generated outputs rebuilt and the legacy `GetCockpitQuiz` hash was preserved                                                                                                                                                                                                                                                                |
| GraphQL typecheck                            | Passed                                                                                                                                                                                                                                                                                                                                             |
| Response-api ingress tracking tests          | Passed; 5 direct tests cover missing-instance skips, active-instance increments, invalid tracking responses, and the 250ms timeout rejection contract                                                                                                                                                                                              |
| Syncpack check                               | Passed                                                                                                                                                                                                                                                                                                                                             |
| Repository build                             | Passed; 23 of 23 Turbo tasks succeeded                                                                                                                                                                                                                                                                                                             |
| Redis integration contract test              | Passed with `LIVE_QUIZ_REDIS_INTEGRATION=true`; concurrent replay applied one result, counters stayed exact, claims and counters mirrored bounded TTLs, missing-info retention was one day, first-command failures released the claim without incrementing the processed counter, and mixed partial failures retained the claim for reconciliation |
| GraphQL code generation and repository build | Passed; generated outputs rebuilt, the legacy `GetCockpitQuiz` hash was preserved, and 23 of 23 Turbo build tasks succeeded                                                                                                                                                                                                                         |
| Browser verification                         | The manage cockpit route passed locally with delegated lecturer login. At 360×640 the corrected card measured 176px, the long element label wrapped, and the response-status pill remained a single 79.94px line with aligned icons. A separate desktop capture was blocked by the local Chrome MachPort permission error.                         |
| Diff whitespace check                        | Passed                                                                                                                                                                                                                                                                                                                                             |

The browser run used the direct local app-container address because the
`devrouter ensure` lifecycle lock could not be acquired for this worktree.
The manage cockpit rendered `Test Live Quiz 3` with its scheduled and active
blocks and the live-quiz controls. The narrow post-patch capture verified the
alignment change without altering shared Redis state. A separate headed
desktop Chrome attempt terminated with macOS MachPort/Crashpad permission
errors, so no desktop screenshot claim is made and the planned desktop UI-
verification terminal remains incomplete.

## Conditions and blockers

- `pnpm run check:all` reached the analytics lint step but could not build
  `pandas==2.2.2` because the container has no C compiler (`cc`, `gcc`, or
  `clang`). This is an environment prerequisite blocker, not a reported
  TypeScript or application failure.
- A fresh full GraphQL-suite attempt could not provide valid Hatchet
  credentials in the self-contained runtime and produced unrelated
  `UNAUTHENTICATED: invalid auth token` failures. The focused GraphQL cockpit
  suite passed with local test-only configuration; no production credential was
  used or exposed.
- The local response-processor worker repeatedly hit the existing Hatchet SDK
  heartbeat logger error (`this.logger[message.type] is not a function`). The
  modified processor tests and typecheck pass; this unrelated local runtime
  compatibility issue was not changed in this scope.
- A separate desktop post-patch browser capture could not be completed because
  headed Chrome terminated with macOS MachPort/Crashpad permission errors. The
  narrow 360×640 capture is the available visual evidence for the alignment
  change; the planned desktop UI-verification terminal remains incomplete.
- No production or deployed Redis, worker, GraphQL, or browser-health evidence
  is claimed here. CI, reviewer approval, and the normal release/deployment
  gates remain required before production use.

## Verdict

**Ready with conditions for PR review and CI.** The requested icon alignment,
bounded counters, replay protection, partial-failure semantics, count
degradation, and local cockpit behavior have direct automated evidence.
Production readiness is not independently certified until the CI environment
satisfies its analytics toolchain requirement and the normal deployment,
rollout-order, and live-health gates are completed.
