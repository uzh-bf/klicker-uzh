# PR 5315 production-readiness evidence

Date: 2026-08-24

## Scope

This report records the local verification of PR 5315, which exposes per-element
received and processed response counts in the live-quiz cockpit. The readiness
fixes cover regular and assessment response processing, replay safety, cockpit
count degradation, response-tracking cleanup, and cockpit icon alignment.

The local audit branch was refreshed against the current `origin/v3` at
`09257efb71027d478ed2c418fd007a60900b34ea` before this verification. It also
contains the approved counter and replay-claim redesign described below.
No remote merge, deployment, or production-data access was performed.

## Changes verified

- Regular and assessment aggregation build Redis commands locally, then use one
  atomic Lua script that claims a bounded replay identifier, applies the batch,
  and increments the numeric processed counter only after every command
  succeeds. Concurrent retries and lost replies therefore cannot apply
  aggregation twice within the replay horizon.
- New ingress writes a numeric received counter. The legacy received set is
  read-only compatibility input, and the cockpit adds its cardinality while
  old response-api instances drain.
- The processing script captures per-command Redis errors with `redis.pcall`.
  Partial failures retain the replay claim, return `aggregation_failed`, and
  leave the processed counter unchanged because some commands may already have
  applied. Connection-level failures still throw so the worker can retry
  safely.
- Cockpit response-count resolution degrades all response counts to `null`
  when its count pipeline fails; the rest of the authorized cockpit query
  remains available.
- Numeric counters and replay claims use bounded retention. `endLiveQuiz`
  starts retention on instance-info keys before expiring leftover tracking keys,
  so late responses cannot recreate persistent tracking keys.
- Deployment must publish GraphQL before new ingress and drain old processors
  before initializing processed counters. Old processors do not increment the
  new processed counter.
- Cockpit status, participant, external-link, and response-count icons use fixed
  inline or flex boxes so their optical alignment is stable.
- The response API records when received-response tracking is skipped because
  the instance-info key is missing; repeated end calls retry failed retention,
  and assessment cleanup propagates Redis failures for Hatchet retry.

## Local evidence

| Check | Result |
| --- | --- |
| Response-processor typecheck | Passed |
| Response-processor unit tests | 7 passed across regular and assessment processors, including atomic script calls, replay guards, partial-failure handling, and connection-level failure propagation |
| Util tests | 53 passed in the default suite; the real Redis contract test passed separately with integration enabled |
| GraphQL cockpit count tests | 2 passed; compatibility reads, scheduled nulls, and pipeline-failure degradation are covered |
| Cockpit Redis fault-injection test | Passed; a failed count pipeline returned the cockpit with `null` response counts |
| GraphQL code generation | Passed; generated output was unchanged |
| GraphQL typecheck | Passed |
| Response-api ingress tracking tests | Passed; 3 direct tests cover missing-instance skips, active-instance increments, and invalid tracking responses |
| Syncpack check | Passed |
| Repository build | Passed; 23 of 23 Turbo tasks succeeded |
| Redis integration contract test | Passed with `LIVE_QUIZ_REDIS_INTEGRATION=true`; concurrent replay applied one result, counters stayed exact, claims and counters mirrored bounded TTLs, missing-info retention was one day, and partial command errors retained the claim without incrementing the processed counter |
| GraphQL code generation and repository build | Passed; generated output was unchanged and 23 of 23 Turbo build tasks succeeded |
| Browser verification | The manage cockpit route passed locally with delegated lecturer login before the final icon patch; the seeded live quiz rendered its blocks and activation controls, and activating the first block completed the local active-block lifecycle. A post-patch icon capture was blocked by the local Chrome session. |
| Diff whitespace check | Passed |

The browser run used the direct local app-container address because the
`devrouter ensure` lifecycle lock could not be acquired for this worktree.
The manage cockpit rendered `Test Live Quiz 3` with its scheduled and active
blocks and the live-quiz controls before the final icon patch. A fresh headed
Chrome attempt after the patch terminated with macOS MachPort/Crashpad
permission errors, so no post-patch visual claim is made. The focused Redis
fault-injection test is the authoritative count-degradation evidence because
the browser runtime was not used to alter shared Redis state.

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
- A final post-patch browser capture could not be completed because headed
  Chrome terminated with macOS MachPort/Crashpad permission errors. The icon
  alignment change is covered by the fixed-size layout boxes in the component,
  but not by a fresh screenshot in this run.
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
