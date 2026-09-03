# PLAN — Pino and Hatchet dual-destination task logging

## Goal

Adjust the existing five-PR production-logging stack so that application code
inside a Hatchet task uses the Hatchet execution context as its single logging
entry point. One safe task log call must:

1. appear in the Hatchet task-run log UI with its level, message, and metadata;
2. be emitted by the worker's singleton Pino logger as NDJSON on container
   stdout; and
3. carry the same validated diagnostic `correlationId` in both destinations so
   an operator can associate the Hatchet run with the corresponding container
   and Grafana/Loki records.

At the end, each PR in the native GitHub stack contains only the source,
configuration, tests, and durable documentation owned by that layer. Fixes that
currently accumulated in the top PR are relocated to their owning lower layer.

## Corrected architectural decision

The existing plan's statement that Klicker Pino task logs run "alongside" an
independent Hatchet SDK logger is superseded.

### Logger ownership

- Every running Node process creates exactly one application Pino root logger.
- HTTP and GraphQL boundaries may create lightweight Pino child loggers to bind
  request metadata; GraphQL application code continues to use `ctx.log`.
- Hatchet task code uses the SDK-provided `ctx.logger` (`ctx.log()` is deprecated
  in the pinned TypeScript SDK 1.9.4).
- The Hatchet client is initialized with its supported custom logger factory.
  For task-context calls, that adapter sends Hatchet's structured metadata to
  the process Pino root. Hatchet independently persists the same call against
  the task run.
- Hatchet SDK-internal channels remain SDK-owned. The adapter must not turn
  arbitrary third-party SDK diagnostics or raw third-party errors into owned
  application records.
- No resolver, response handler, or task handler calls `createLogger()`.
- No task handler derives a Pino child from every response payload. Remove
  `loggerForInput(message)` and the root-logger fallback in course duplication.

### Resulting flow

```text
HTTP request
  -> request Pino child (`ctx.log` in GraphQL)
  -> container stdout
  -> Alloy/Loki

request-triggered Hatchet input
  -> loggingContext { requestId?, correlationId? }
  -> Hatchet task `ctx.logger`
       -> Hatchet task-run log + structured metadata
       -> Hatchet Pino adapter
            -> worker process Pino root
            -> container stdout
            -> Alloy/Loki
```

The Hatchet and container representations need not be byte-identical. The
logical event must match: same `event`, `correlationId`, safe operational
fields, level, and message. Pino additionally owns the portable container
record fields such as `time` and `service`; Hatchet owns task-run association.

### Correlation contract

- Continue propagating the optional additive envelope:

  ```ts
  loggingContext?: {
    requestId?: string
    correlationId?: string
  }
  ```

- Validate both values with the existing diagnostic-ID rules before including
  them in either sink.
- The assessment payload's existing top-level `correlationId` remains a
  business/deduplication key. It must never be promoted to diagnostic log
  metadata.
- Request-triggered work receives the incoming diagnostic correlation ID.
  Cron, scheduled, and legacy queued work without an envelope does not invent
  one. Its Hatchet `workflowRunId` and `taskRunId` still appear in container
  records and provide the task-run association.

## Non-goals

- Sending non-Hatchet application logs through Hatchet.
- Rendering raw Pino JSON as the Hatchet log message.
- Replacing Hatchet's task-run log storage or making applications write
  directly to Loki.
- Adding OpenTelemetry spans or using correlation IDs for business decisions.
- Changing GraphQL schema, Prisma, auth, i18n, gamification, response-processing
  behavior, retry policy, or task payload semantics beyond the optional
  diagnostic envelope.
- Logging responses, answers, cookies, tokens, participant identity, audit text,
  raw errors, or arbitrary Hatchet payload data.
- Requiring new cluster secrets or environment variables.

## Feature-design checklist

- **Domain vocabulary:** process root logger, GraphQL request logger, Hatchet
  task context logger, diagnostic correlation ID, assessment business
  correlation ID, Hatchet run ID, container stdout, and Hatchet task-run log.
- **Layer footprint:** `packages/logging`, `packages/hatchet`,
  `packages/types`, both Hatchet workers, response/backend publishers, GraphQL
  context and Hatchet handlers, focused CI packaging, and observability docs.
  Auth/integration and remaining server-app layers should change only where
  they adopt the common Pino contract.
- **Auth:** unchanged. Diagnostic IDs remain untrusted observability metadata.
- **Gamification:** no impact on points, XP, grading, or leaderboards.
- **Async:** additive diagnostic propagation remains backward compatible;
  consumers continue to support queued inputs without `loggingContext`.
- **UI:** no product UI or i18n change. Hatchet's operator UI is an acceptance
  surface, not an application UI implementation.
- **Seeds/fixtures:** none.
- **Test level:** unit contract tests, worker checks/builds, a real local Hatchet
  task smoke, stack-wide checks/build, exact-head CI, and staging observation.

## Implementation design

### 1. Adapt Hatchet task logging to the process Pino root

In `packages/hatchet`, add a small Hatchet `Logger` adapter/factory using the
SDK's public custom-logger interface:

- accept an existing `AppLogger`; never call `createLogger()` in the adapter;
- reuse one adapter per process logger rather than constructing a Pino child per
  task or response;
- translate Hatchet `debug`, `info`, `green`, `warn`, and `error` levels to the
  corresponding Pino method;
- preserve Hatchet-provided task metadata (`workflowRunId`, `taskRunId`, retry
  count, workflow name) and validated application metadata;
- never serialize the SDK's raw `Error` argument; task call sites supply only
  application-owned safe fields; and
- delegate non-task SDK channels to Hatchet's normal logger unless a channel is
  explicitly reviewed and allowlisted.

Refactor the Hatchet client module to expose a factory that accepts an optional
process logger. Each application creates its Hatchet client once at module
startup. Worker processes pass their singleton root logger; scripts and tests
that do not execute worker tasks can retain default SDK logging. Remove any
eager shared client construction that would create a second client when the
configured worker client is used.

### 2. Make the task wrapper context-owned

Change `withHatchetTaskLogging` so it no longer accepts an `AppLogger` and never
calls `logger.child(...)`. It must log lifecycle records exclusively through
the provided Hatchet context:

- `hatchet.task.started` before the handler;
- `hatchet.task.completed` with `durationMs` after success; or
- one privacy-safe `hatchet.task.failed` with `durationMs`, followed by
  rethrowing the original error.

Every lifecycle call includes validated diagnostic metadata from
`input.loggingContext`. Tests must cover the exact metadata shape required by
SDK 1.9.4 for `info`, `warn`, and `error`, because its error-level API wraps
structured metadata differently from its info-level API.
Inner task helpers merge the validated attempt fields into their `ctx.logger`
calls as well, so Hatchet's task-run metadata and the Pino line carry the same
correlation identifiers.

### 3. Restore context logging throughout both workers

For `apps/hatchet-worker-response-processor`:

- retain one mode-aware root Pino logger for process startup and dependency
  initialization outside task execution;
- configure the worker's Hatchet client with that root;
- remove `loggerForInput` completely;
- convert all response-processing and assessment-processing events back to
  `await ctx.logger.<level>(message, metadata)` while retaining the newer safe
  event names and allowlisted fields;
- cover anonymous, authenticated, assessment, aggregation, and on-failure
  handlers; and
- do not restore historical messages that contained cookies, JWTs, responses,
  participant identifiers, audit payloads, or stringified errors.

For `apps/hatchet-worker-general` and GraphQL-owned task handlers:

- configure the Hatchet worker client with its existing singleton root;
- keep task operational events on `executionCtx.logger` so they reach Hatchet
  and container logs through the same call;
- remove `logger?: AppLogger` from `prepareHatchetTasks` and
  `HatchetHandlerGlobalContext` once the wrapper is context-owned;
- remove the `createLogger({ service: 'graphql' })` fallback from course
  duplication; and
- when a Hatchet handler invokes code requiring GraphQL's object-first
  `Context.log` contract, use one narrow compatibility facade backed by that
  task's `executionCtx.logger`. The facade forwards into Hatchet and does not
  own a Pino instance or transport. Do not use it where `executionCtx.logger`
  can be passed or called directly.

### 4. Keep publishers responsible only for propagation

`response-api` and backend/GraphQL request paths continue to:

- resolve and validate HTTP request/correlation IDs once;
- emit their own Pino request/application logs directly to container stdout;
- add the optional `loggingContext` envelope to request-triggered Hatchet
  messages; and
- keep the assessment business correlation key separate.

They do not send their ordinary HTTP or GraphQL logs to Hatchet.

## Native PR-stack ownership

Keep the approved five-layer topology and existing PR bases.

| PR | Final ownership | Required Hatchet correction |
| --- | --- | --- |
| [#5316](https://github.com/uzh-bf/klicker-uzh/pull/5316) `logging-foundation` | Shared Pino/Edge/request contracts, singleton general-worker process logger, required CI packaging, ADR and base observability contract | Update architecture/docs to say Hatchet task context is the single task entry point; do not add task wrappers here |
| [#5317](https://github.com/uzh-bf/klicker-uzh/pull/5317) `logging-hatchet-correlation` | Hatchet logger adapter/client factory, optional envelope types, context-owned wrapper, both worker integrations and worker-focused tests | Remove `loggerForInput`, restore all safe response-task events to `ctx.logger`, remove optional global Pino injection/fallbacks |
| [#5318](https://github.com/uzh-bf/klicker-uzh/pull/5318) `logging-core-apis` | Response/backend HTTP logging, GraphQL `ctx.log`, request-to-Hatchet propagation, core API tests | Ensure all publishers pass the envelope; adapt course-duplication worker-side compatibility without creating a root/child Pino logger |
| [#5319](https://github.com/uzh-bf/klicker-uzh/pull/5319) `logging-auth-integrations` | Auth, LTI, and OLAT logging and their packaging/tests | No Hatchet implementation; retain only integration-owned Pino changes |
| [#5320](https://github.com/uzh-bf/klicker-uzh/pull/5320) `logging-server-apps` | Chat and remaining Next server logging, final server-console guard, final operations evidence | No worker, Hatchet package, types, core GraphQL, LTI, or OLAT implementation hunks |

### Misplaced-change relocation audit

Before restacking, classify every current top-layer hunk. At minimum relocate:

- `packages/logging/**` corrections to #5316;
- `packages/hatchet/**`, Hatchet envelope types, both worker Dockerfiles, and
  response-worker changes to #5317;
- backend Docker/runtime, GraphQL context/service, and response API corrections
  to #5318;
- Auth/LTI/OLAT runtime and Dockerfile corrections to #5319; and
- retain only Chat/frontend/final-guard changes in #5320.

Regenerate `pnpm-lock.yaml` independently at every affected layer. A later PR
must not contain a lockfile repair for a dependency introduced in an earlier
PR. Consolidate cross-stack design/progress documents in #5316; later PRs may
change `docs/observability.md` only for behavior introduced by that layer.

For every layer, compare `merge-base(parent, head)..head` and require that each
changed file has an explicit owner in the table above. Remove generated output,
unrelated formatting, test-fixture churn, merge-conflict residue, and
verification-only edits that do not support the feature. Preserve unrelated
upstream/user work by restacking rather than reverting it.

## Verification and acceptance gates

### Unit and package contracts

1. `@klicker-uzh/logging` retains its Pino record, level, redaction, and
   diagnostic-ID tests.
2. `@klicker-uzh/hatchet` proves one context lifecycle call reaches:
   - the Hatchet context logger spy exactly once; and
   - the Pino capture destination exactly once through the configured adapter.
3. Test success and failure lifecycle paths, all mapped levels, invalid IDs,
   missing legacy context, and the assessment business-ID separation.
4. Add a source/behavior regression asserting response task handlers no longer
   call `loggerForInput` or `createLogger` and do call their supplied
   `ctx.logger`.
5. Run focused checks, tests, and builds for logging, types, Hatchet, both
   workers, response API, backend, and GraphQL as each layer changes.

### Real local Hatchet integration smoke

Use the repository-supported local Hatchet environment and synthetic data:

1. start the response API plus both workers with the existing local profile;
2. submit one synthetic response carrying a unique validated canary
   correlation ID;
3. confirm the response API container record contains the canary;
4. confirm the response-worker container emits valid Pino JSON containing the
   same canary plus `workflowRunId` and `taskRunId`;
5. open the matching Hatchet task run and confirm its log metadata contains the
   same canary and logical event;
6. verify each expected event appears once per destination, with no duplicate
   parallel Pino call; and
7. verify a legacy task without `loggingContext` still succeeds and does not
   fabricate a correlation ID.

Record sanitized command output and screenshots/observations without including
response payloads or credentials.

### Stack and staging gates

- Per layer: targeted tests/check/build, `git diff --check`, and exact PR CI.
- Stack tip: `pnpm run check:all`, `pnpm run build`, relevant unit suites, and
  the existing server-console guard. The acknowledged scroll-height flaky test
  may be reported separately but cannot mask another failure.
- Confirm every PR remains linearly based on the previous PR, is mergeable, and
  contains only its owned files before requesting review.
- After normal deployment to staging, perform observation-only validation:
  search Loki by the canary `correlationId`, then inspect the corresponding
  Hatchet run. Confirm matching service/event IDs, no privacy canaries, no
  duplicate records, and unchanged processing outcomes.
- No manual cluster configuration should be required beyond the already
  deployed stdout collection/structured-metadata pipeline and existing Hatchet
  connectivity.

## Rollback

The adapter and context-owned wrapper are application-only changes. Rolling
back worker images restores the previous logging path without changing Hatchet
payload compatibility. The optional envelope remains safe for old consumers.
No Loki, Hatchet database, Kubernetes Secret, or schema rollback is required.

## Progress

- 2026-09-03: supervisor feedback clarified the intended contract: the same
  Hatchet task logger call should appear in Hatchet and container logs; Pino is
  the structured JSON formatter for the container destination.
- 2026-09-03: verified against `@hatchet-dev/typescript-sdk` 1.9.4 that
  `ctx.logger` invokes the configured logger and Hatchet `putLog`, while
  `ctx.log()` is deprecated.
- 2026-09-03: compared the stack with `v3`: the response processor previously
  had 29 `ctx.logger` calls and the current stack has zero; these were replaced
  by the parallel `loggerForInput` path and must be corrected.
- 2026-09-03: mapped the correction and current misplaced top-layer files to
  the five existing PR owners. Implementation and runtime verification remain
  pending.
