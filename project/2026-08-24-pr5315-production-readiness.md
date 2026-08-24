# PR 5315 production-readiness evidence

Date: 2026-08-24

## Scope

This report records the local verification of PR 5315, which exposes per-element
received and processed response counts in the live-quiz cockpit. The readiness
fixes cover regular and assessment response processing, replay safety, cockpit
count degradation, response-tracking cleanup, and cockpit icon alignment.

The implementation changes verified here are committed at
`1f0a92c36bbc758f5c34aa3eb59e81e4d5577149` on branch `audit-pr5315-fixes`.
The final freshness merge is `214d6c2bd3fb299dfdb063fcf78048ea1d80cde0`,
which incorporates `origin/v3` at `ae9bc7ea526b32cdc964057c00f1b1e8e7d045ee`.
It changed no in-scope application implementation paths. The application
checks below were completed before that merge; the Redis integration contract
test and its CI service were added and passed afterward.
No push, merge, deployment, or production-data access was performed.

## Changes verified

- Regular and assessment aggregation build Redis commands locally, then use one
  atomic Lua script that claims the processed marker before applying them.
  Concurrent retries and lost replies therefore cannot apply aggregation twice.
- The processing script captures per-command Redis errors with `redis.pcall`,
  logs and accepts them after claiming the marker, and lets connection-level
  failures throw so the worker can retry safely.
- Cockpit response-count resolution degrades all response counts to `null`
  when its count pipeline fails; the rest of the authorized cockpit query
  remains available.
- Response-tracking sets use the instance-info retention boundary. `endLiveQuiz`
  starts retention on instance-info keys before removing leftover tracking keys,
  so late responses cannot recreate persistent tracking sets.
- Cockpit status, participant, external-link, and response-count icons use fixed
  inline or flex boxes so their optical alignment is stable.
- The response API records when received-response tracking is skipped because
  the instance-info key is missing.

## Local evidence

| Check | Result |
| --- | --- |
| Response-processor typecheck | Passed |
| Response-processor unit tests | 8 passed across regular and assessment processors, including atomic marker ordering, replay guards, per-command error acceptance, and connection-level failure propagation |
| Util tests | 54 passed |
| GraphQL tests | 604 passed across 37 files |
| Cockpit Redis fault-injection test | Passed; a failed count pipeline returned the cockpit with `null` response counts |
| GraphQL code generation | Passed; generated output was unchanged |
| GraphQL typecheck | Passed |
| Syncpack check | Passed |
| Repository build | Passed; 23 of 23 Turbo tasks succeeded |
| Redis integration contract test | Passed with `LIVE_QUIZ_REDIS_INTEGRATION=true`; concurrent replay applied one result, active and bounded retention mirrored TTLs, missing-info retention was one day, and per-command errors retained the marker |
| Redis processing-script smoke test | Passed; sequential replay produced one aggregation, and a missing instance-info key applied the one-day tracking TTL |
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

**Ready with conditions for PR review and CI.** The requested failure handling,
replay protection, count degradation, and local cockpit behavior have direct
automated evidence. Production readiness is not independently certified until
the CI environment satisfies its analytics toolchain requirement and the
normal deployment and live-health gates are completed.
