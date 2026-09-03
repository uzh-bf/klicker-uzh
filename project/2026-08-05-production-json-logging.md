# Production JSON Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit privacy-safe production NDJSON from every in-scope Klicker Node
runtime and correlate HTTP requests with the Hatchet work they publish.

**Architecture:** A thin server-only `@klicker-uzh/logging` package owns the
record contract, request identifiers, Pino defaults, and Edge-compatible
serialization. Framework adapters stay with their apps; callers pass child
loggers and request context explicitly. The work ships as five independently
green branches in one native GitHub stack.

**Tech Stack:** Node.js 24, TypeScript 6, Pino 9.14.0, pino-pretty 13.1.3,
Vitest 3.2.4, Next.js 16, Express, GraphQL Yoga, Hatchet SDK 1.9.4, pnpm 11,
Turborepo, native `gh stack`.

## Global Constraints

- Production writes newline-delimited JSON to stdout; applications never send
  logs directly to Loki.
- Pin `pino` to `9.14.0` and `pino-pretty` to `13.1.3`; do not introduce Pino
  10 in this feature.
- Required record fields are Unix-millisecond `time`, string `level`, stable
  `service`, dot-separated `event`, and conventional `msg`.
- Omit Pino `pid` and `hostname`; Kubernetes owns process placement metadata.
- Accept diagnostic IDs only when they match `[A-Za-z0-9._-]{1,128}`; generate
  a UUID for a missing or invalid request ID and make a missing or invalid
  correlation ID fall back to that request ID.
- A new operation defaults `correlationId` to `requestId`; responses echo
  `x-request-id`; internal publishers propagate both IDs where applicable.
- Diagnostic IDs are never trusted for authorization, deduplication, or
  business behavior.
- HTTP records may contain only method, parameterized route, status code, and
  duration. Never fall back to a raw URL, raw pathname with entity IDs, or query
  string.
- Log `Error` values as `{ err }` at the owning boundary. Do not spread,
  stringify, interpolate, or repeatedly log the same error.
- Normalize third-party failures that can include URLs, headers, or client
  configuration to a new application-owned safe `Error` before logging.
- Never log authorization/cookie headers, tokens, passwords, secrets,
  connection strings, bodies, Hatchet payloads, profiles, answers, generated
  content, names, emails, matriculation identifiers, IPs, raw URLs, query
  strings, or arbitrary client/error configuration.
- Browser logging, Python analytics, Office Add-in, static docs, OpenTelemetry
  span generation, Sentry replacement, Prisma, public GraphQL schema/codegen,
  auth permissions, gamification, i18n, and seeds are outside this plan.
- Hatchet inputs gain an optional
  `loggingContext: { requestId?: string; correlationId?: string }` so consumers
  can deploy before publishers and old queued inputs stay valid. The envelope
  must not reuse the assessment payload's existing business field named
  `correlationId`.
- Do not add `AsyncLocalStorage`, global exception handlers, or a monorepo-wide
  browser `no-console` rule.
- Every stack layer must pass its targeted tests, check, lint, and build before
  the next layer begins.

## Stack map

| Layer | Branch                             | PR title                                           | Tasks |
| ----: | ---------------------------------- | -------------------------------------------------- | ----- |
|     1 | `feat/logging-foundation`          | `feat(logging): add shared Pino foundation`        | 1–3   |
|     2 | `feat/logging-hatchet-correlation` | `feat(logging): correlate Hatchet task logs`       | 4–5   |
|     3 | `feat/logging-core-apis`           | `feat(logging): instrument core API ingress`       | 6–8   |
|     4 | `feat/logging-auth-integrations`   | `feat(logging): secure auth and integration logs`  | 9–10  |
|     5 | `feat/logging-server-apps`         | `feat(logging): complete server-side app adoption` | 11–13 |

## Runtime service names

| Runtime                    | `service` value                                   |
| -------------------------- | ------------------------------------------------- |
| General worker             | `HATCHET_WORKER_NAME ?? 'hatchet-worker-general'` |
| Response worker standard   | `hatchet-worker-response-processor`               |
| Response worker assessment | `hatchet-worker-response-processor-assessment`    |
| Response API standard      | `response-api`                                    |
| Response API assessment    | `response-api-assessment`                         |
| Backend standard           | `backend-graphql`                                 |
| Backend assessment         | `backend-assessment`                              |
| Auth / LTI / OLAT / chat   | `auth`, `lti`, `olat-api`, `chat`                 |
| PWA standard / assessment  | `frontend-pwa`, `frontend-assessment`             |
| Manage / control           | `frontend-manage`, `frontend-control`             |

### Task 0: Move the stack into its repository-local worktree

**Files:**

- Verify: `.gitignore`
- Update during execution: `project/plans_wip/PLAN-production-json-logging.md`

**Interfaces:**

- Consumes: clean `feat/logging-foundation` at the approved design commit.
- Produces: one topology-owned worktree at `trees/logging-stack` with all five
  branches registered against `v3`.

- [ ] **Step 1: Verify branch, worktree, and ignore state**

Run from the current workspace:

```bash
git status --short
git branch --show-current
git worktree list --porcelain
rg -n '^trees/$' .gitignore
```

Expected: clean status, branch `feat/logging-foundation`, the current worktree
listed once, and `.gitignore` containing `trees/`.

- [ ] **Step 2: Relocate branch ownership without changing commits**

```bash
git switch --detach
git worktree add trees/logging-stack feat/logging-foundation
cd trees/logging-stack
git status --short
git log -1 --oneline
```

Expected: clean repository-local worktree whose tip contains the approved
logging design commit. If the initial status is not clean, stop and report the
files instead of detaching.

- [ ] **Step 3: Initialize the native stack**

```bash
gh stack init --base v3 \
  feat/logging-foundation \
  feat/logging-hatchet-correlation \
  feat/logging-core-apis \
  feat/logging-auth-integrations \
  feat/logging-server-apps
gh stack view
```

Expected: bottom-to-top order exactly matches the stack map. Do not submit or
publish the stack in this task.

### Task 1: Build the request and Node logging contracts

**Files:**

- Create: `packages/logging/package.json`
- Create: `packages/logging/tsconfig.json`
- Create: `packages/logging/rollup.config.js`
- Create: `packages/logging/vitest.config.ts`
- Create: `packages/logging/src/request.ts`
- Create: `packages/logging/src/node.ts`
- Create: `packages/logging/test/request.test.ts`
- Create: `packages/logging/test/node.test.ts`
- Modify: `pnpm-lock.yaml`
- Modify: `turbo.json`

**Interfaces:**

- Produces:
  `RequestContext`, `normalizeDiagnosticId(value)`,
  `resolveRequestContext(headers, generateId?)`, `propagationHeaders(context)`,
  `createLogger(options, destination?)`, `AppLogger`, and
  `toSafeError(message)`.
- Consumes: Pino 9.14.0 and global Web Crypto UUID generation available in
  Node 24 and Edge runtimes.

- [ ] **Step 1: Create the package manifest and build configuration**

Use these public exports:

```json
{
  "name": "@klicker-uzh/logging",
  "version": "3.4.0-alpha.64",
  "license": "AGPL-3.0",
  "type": "module",
  "files": ["dist"],
  "exports": {
    "./node": {
      "types": "./dist/node.d.ts",
      "default": "./dist/node.js"
    },
    "./request": {
      "types": "./dist/request.d.ts",
      "default": "./dist/request.js"
    }
  },
  "dependencies": {
    "pino": "9.14.0"
  },
  "devDependencies": {
    "@rollup/plugin-node-resolve": "~15.3.1",
    "@rollup/plugin-typescript": "~12.1.4",
    "@types/node": "^24.10.1",
    "cross-env": "~7.0.3",
    "npm-run-all": "~4.1.5",
    "pino-pretty": "13.1.3",
    "rollup": "~4.34.9",
    "typescript": "~6.0.3",
    "vitest": "~3.2.4"
  },
  "scripts": {
    "build": "cross-env NODE_ENV=production rollup -c",
    "check": "tsc --noEmit --tsBuildInfoFile dist/tsconfig.check.tsbuildinfo",
    "test": "vitest run",
    "test:run": "vitest run",
    "test:watch": "vitest"
  },
  "engines": { "node": "=24" },
  "volta": { "extends": "../../package.json" }
}
```

Configure Rollup with `src/node.ts` and `src/request.ts` as separate ESM inputs,
declarations enabled, `entryFileNames: '[name].js'`, and `pino`, `pino-pretty`,
Node built-ins, and workspace packages external. Task 2 adds the Edge input and
export in the same commit as its implementation.

- [ ] **Step 2: Write failing request-context tests**

Cover exact pass-through, missing IDs, invalid characters, arrays, length 129,
correlation fallback, and propagation headers:

```ts
it('replaces untrusted ids and defaults correlation to request id', () => {
  const ids = ['generated-request', 'generated-correlation']
  const context = resolveRequestContext(
    { requestId: 'bad id', correlationId: undefined },
    () => ids.shift()!
  )

  expect(context).toEqual({
    requestId: 'generated-request',
    correlationId: 'generated-request',
  })
  expect(propagationHeaders(context)).toEqual({
    'x-request-id': 'generated-request',
    'x-correlation-id': 'generated-request',
  })
})
```

Run:

```bash
pnpm --filter @klicker-uzh/logging test -- request.test.ts
```

Expected: failure because the request entry point does not exist.

- [ ] **Step 3: Implement the runtime-neutral request contract**

Use this signature and behavior:

```ts
export const DIAGNOSTIC_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/

export interface RequestContext {
  requestId: string
  correlationId: string
  traceId?: string
  spanId?: string
}

export type DiagnosticHeader = string | string[] | null | undefined

export function normalizeDiagnosticId(
  value: DiagnosticHeader
): string | undefined {
  return typeof value === 'string' && DIAGNOSTIC_ID_PATTERN.test(value)
    ? value
    : undefined
}

export function resolveRequestContext(
  headers: {
    requestId?: DiagnosticHeader
    correlationId?: DiagnosticHeader
    traceId?: DiagnosticHeader
    spanId?: DiagnosticHeader
  },
  generateId: () => string = () => globalThis.crypto.randomUUID()
): RequestContext {
  const requestId = normalizeDiagnosticId(headers.requestId) ?? generateId()
  const correlationId =
    normalizeDiagnosticId(headers.correlationId) ?? requestId
  const traceId = normalizeDiagnosticId(headers.traceId)
  const spanId = normalizeDiagnosticId(headers.spanId)
  return {
    requestId,
    correlationId,
    ...(traceId ? { traceId } : {}),
    ...(spanId ? { spanId } : {}),
  }
}

export function propagationHeaders(context: RequestContext) {
  return {
    'x-request-id': context.requestId,
    'x-correlation-id': context.correlationId,
  }
}
```

Run the request test again; expected: pass.

- [ ] **Step 4: Write failing Pino contract and privacy tests**

Capture a writable stream and assert one parsed record has string `level`,
`service`, `event`, `msg`, child IDs, serialized `err`, and no `pid` or
`hostname`. Write unique fake canaries into every configured redaction path and
assert no output contains them. Also prove test-default silence and development
pretty-print opt-in.

Run:

```bash
pnpm --filter @klicker-uzh/logging test -- node.test.ts
```

Expected: failure because `createLogger` does not exist.

- [ ] **Step 5: Implement the Node factory**

The public surface is:

```ts
import pino, {
  type DestinationStream,
  type Logger,
  type LoggerOptions,
} from 'pino'

export type AppLogger = Logger

export interface CreateLoggerOptions {
  service: string
  level?: string
  environment?: string
  pretty?: boolean
}

export function toSafeError(message: string): Error {
  return new Error(message)
}

export function createLogger(
  options: CreateLoggerOptions,
  destination?: DestinationStream
): AppLogger {
  const environment =
    options.environment ?? process.env.NODE_ENV ?? 'development'
  const pretty =
    options.pretty ??
    (environment !== 'production' &&
      environment !== 'test' &&
      process.env.PINO_PRETTY !== 'false')
  const level =
    options.level ??
    process.env.LOG_LEVEL ??
    (environment === 'test' ? 'silent' : 'info')

  const loggerOptions: LoggerOptions = {
    level: level.toLowerCase(),
    base: { service: options.service },
    formatters: {
      level(label) {
        return { level: label }
      },
    },
    serializers: { err: pino.stdSerializers.err },
    redact: {
      censor: '[REDACTED]',
      paths: [
        'authorization',
        'cookie',
        'headers.authorization',
        'headers.cookie',
        'req.headers.authorization',
        'req.headers.cookie',
        'accessToken',
        'refreshToken',
        'idToken',
        'token',
        'password',
        'secret',
        'connectionString',
      ],
    },
  }

  if (destination) return pino(loggerOptions, destination)
  if (!pretty) return pino(loggerOptions)
  return pino(
    loggerOptions,
    pino.transport({
      target: 'pino-pretty',
      options: {
        colorize: true,
        singleLine: true,
        translateTime: 'SYS:standard',
      },
    })
  )
}
```

Pino's default timestamp supplies Unix milliseconds. Supplying only
`{ service }` as `base` suppresses default `pid` and `hostname`.

- [ ] **Step 6: Add `LOG_LEVEL` to Turborepo and sync the lockfile**

Add `LOG_LEVEL` and `PINO_PRETTY` once to `turbo.json` `globalEnv`, then run:

```bash
pnpm install
pnpm --filter @klicker-uzh/logging test
pnpm --filter @klicker-uzh/logging check
pnpm --filter @klicker-uzh/logging build
pnpm run check:syncpack
```

Expected: all pass and `pnpm-lock.yaml` contains Pino 9.14.0.

- [ ] **Step 7: Commit the contract**

```bash
git add packages/logging turbo.json pnpm-lock.yaml
git diff --cached --check
git commit -m "feat(logging): add shared record contract"
```

### Task 2: Add the Edge-compatible logger

**Files:**

- Create: `packages/logging/src/edge.ts`
- Create: `packages/logging/test/edge.test.ts`
- Modify: `packages/logging/package.json`
- Modify: `packages/logging/rollup.config.js`

**Interfaces:**

- Consumes: `RequestContext` from `@klicker-uzh/logging/request`.
- Produces: `createEdgeLogger({ service, level?, sink? })` with
  `trace/debug/info/warn/error/fatal` methods and `child(bindings)`.

- [ ] **Step 1: Write failing Node/Edge parity tests**

Use an injected `sink(level, line)` and assert that every call receives exactly
one complete JSON string with `time`, string `level`, `service`, `event`, `msg`,
and child bindings. Assert thresholds work and `Error` becomes only a safe
`{ type, message }` object; the Edge adapter must not include an arbitrary
third-party stack.

Run:

```bash
pnpm --filter @klicker-uzh/logging test -- edge.test.ts
```

Expected: failure because the Edge entry point does not exist.

- [ ] **Step 2: Implement the Edge adapter without Node imports**

Use an explicit numeric level table, immutable child bindings, and this call
shape:

```ts
export interface EdgeLogFields {
  event: string
  requestId?: string
  correlationId?: string
  traceId?: string
  spanId?: string
  http?: {
    method?: string
    route?: string
    statusCode?: number
    durationMs?: number
  }
  err?: Error
  outcome?: string
}

export type EdgeSink = (level: EdgeLogLevel, line: string) => void

export interface EdgeLogger {
  child(bindings: Omit<EdgeLogFields, 'event' | 'err'>): EdgeLogger
  trace(fields: EdgeLogFields, msg: string): void
  debug(fields: EdgeLogFields, msg: string): void
  info(fields: EdgeLogFields, msg: string): void
  warn(fields: EdgeLogFields, msg: string): void
  error(fields: EdgeLogFields, msg: string): void
  fatal(fields: EdgeLogFields, msg: string): void
}
```

The default sink dispatches the already serialized string to the matching
`console` method. The auth middleware will be the only allowed direct consumer
of this exception.

Add `src/edge.ts` to the Rollup inputs and add this package export:

```json
"./edge": {
  "types": "./dist/edge.d.ts",
  "default": "./dist/edge.js"
}
```

- [ ] **Step 3: Verify and commit**

```bash
pnpm --filter @klicker-uzh/logging test
pnpm --filter @klicker-uzh/logging check
pnpm --filter @klicker-uzh/logging build
git add packages/logging/src/edge.ts packages/logging/test/edge.test.ts
git commit -m "feat(logging): add edge-compatible logger"
```

### Task 3: Adopt the foundation in the general Hatchet worker

**Files:**

- Modify: `apps/hatchet-worker-general/package.json`
- Modify: `apps/hatchet-worker-general/src/logger.ts`
- Modify: `apps/hatchet-worker-general/src/index.ts`
- Modify: `pnpm-lock.yaml`
- Create: `docs/adr/0002-standardize-server-logging-on-pino.md`
- Create: `docs/observability.md`
- Modify: `docs/index.md`
- Modify: `docs/adr/README.md`
- Modify: `docs/log.md`

**Interfaces:**

- Consumes: `createLogger` and `AppLogger` from the new package.
- Produces: the first production canary using the shared defaults and stable
  event names.

- [ ] **Step 1: Replace the local Pino configuration**

Keep `src/logger.ts` as the application-owned root and reduce it to:

```ts
import { createLogger } from '@klicker-uzh/logging/node'

export const logger = createLogger({
  service: process.env.HATCHET_WORKER_NAME ?? 'hatchet-worker-general',
})

export default logger
```

Move `pino` and `pino-pretty` out of the app manifest and add
`@klicker-uzh/logging: workspace:*`.

- [ ] **Step 2: Give lifecycle calls stable events**

Convert startup, workflow selection, readiness, and fatal process-owner calls
to the Pino object-first form. For example:

```ts
logger.info(
  {
    event: 'hatchet.worker.started',
    workerName: HATCHET_WORKER_NAME,
    workflowCount: workflows.length,
  },
  'Hatchet worker is ready'
)
```

Keep the existing app-owned `unhandledRejection` and `uncaughtException`
shutdown behavior; do not move those handlers into the shared package. Use a
new `toSafeError('Unhandled rejection')` or
`toSafeError('Uncaught exception')` at these global boundaries so an unknown
third-party error, rejection object, URL, or client configuration is not
serialized.

- [ ] **Step 3: Document the architectural decision and operating contract**

ADR 0002 records: shared Pino package, stdout-only production delivery,
explicit context instead of `AsyncLocalStorage`, Edge adapter exception, and
why direct Loki transports/custom frameworks were rejected.

`docs/observability.md` documents the field table, level policy, privacy
allowlist, service names, event naming, HTTP/Hatchet propagation, local pretty
logging, and examples:

```logql
{service_name="response-api"} | correlation_id="logging-canary-20260805"
{service_name="backend-graphql"} | level="error"
```

Link the page and ADR from their indexes and add a dated `docs/log.md` entry.

- [ ] **Step 4: Verify layer 1 and commit**

```bash
pnpm install
pnpm --filter @klicker-uzh/logging test
pnpm --filter @klicker-uzh/hatchet-worker-general check
pnpm --filter @klicker-uzh/hatchet-worker-general build
pnpm run check:all
git add apps/hatchet-worker-general pnpm-lock.yaml docs
git diff --cached --check
git commit -m "feat(logging): adopt shared logger in general worker"
```

Expected: layer 1 is independently green and emits valid NDJSON when built with
`NODE_ENV=production`.

### Task 4: Add optional Hatchet correlation and a task-boundary wrapper

**Files:**

- Create: `packages/hatchet/src/logging.ts`
- Create: `packages/hatchet/test/logging.test.ts`
- Modify: `packages/hatchet/src/index.ts`
- Modify: `packages/hatchet/package.json`
- Modify: `packages/types/src/hatchet.ts`
- Modify: `packages/hatchet/rollup.config.js`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: `AppLogger`; Hatchet SDK `Context.workflowRunId()` and
  `Context.taskRunId()` from version 1.9.4.
- Produces:
  shared `HatchetLoggingContext` from `@klicker-uzh/types`,
  `LoggableHatchetInput { loggingContext?: HatchetLoggingContext }`, and
  `withHatchetTaskLogging({ logger, taskName, handler })`.

- [ ] **Step 1: Check out layer 2 and write failing wrapper tests**

```bash
gh stack checkout feat/logging-hatchet-correlation
```

Add `@klicker-uzh/logging: workspace:*` to runtime dependencies, add
`vitest: ~3.2.4` to dev dependencies, and add `test`, `test:run`, and
`test:watch` scripts matching `packages/logging`. Export the wrapper through
`packages/hatchet/src/index.ts` so consumers use one public entry point.

Test a successful call, a thrown `Error`, an old input without correlation,
and a non-Error rejection. A successful task produces exactly
`hatchet.task.started` and `hatchet.task.completed`; a failure produces one
`hatchet.task.failed` record and rethrows the original failure.

```ts
function fakeHatchetContext({
  workflowRunId,
  taskRunId,
}: {
  workflowRunId: string
  taskRunId: string
}) {
  return {
    workflowRunId: () => workflowRunId,
    taskRunId: () => taskRunId,
  }
}

const wrapped = withHatchetTaskLogging({
  logger,
  taskName: 'publish-scheduled-live-quiz',
  handler: async () => ({ success: true }),
})

await expect(
  wrapped(
    {
      loggingContext: {
        requestId: 'request-1',
        correlationId: 'correlation-1',
      },
    },
    fakeHatchetContext({ workflowRunId: 'workflow-1', taskRunId: 'task-1' })
  )
).resolves.toEqual({ success: true })
```

Run:

```bash
pnpm --filter @klicker-uzh/hatchet test -- logging.test.ts
```

Expected: failure because the wrapper is not defined.

- [ ] **Step 2: Implement the wrapper**

Use this contract:

```ts
import type { Context } from '@hatchet-dev/typescript-sdk'
import { toSafeError, type AppLogger } from '@klicker-uzh/logging/node'
import type { HatchetLoggingContext } from '@klicker-uzh/types'

export interface LoggableHatchetInput {
  loggingContext?: HatchetLoggingContext
}

export function withHatchetTaskLogging<
  TInput extends LoggableHatchetInput,
  TOutput,
  TContext extends Pick<Context<TInput>, 'workflowRunId' | 'taskRunId'>,
>({
  logger,
  taskName,
  handler,
}: {
  logger: AppLogger
  taskName: string
  handler: (input: TInput, context: TContext) => Promise<TOutput> | TOutput
}) {
  return async (input: TInput, context: TContext): Promise<TOutput> => {
    const taskLogger = logger.child({
      ...(input.loggingContext?.requestId
        ? { requestId: input.loggingContext.requestId }
        : {}),
      ...(input.loggingContext?.correlationId
        ? { correlationId: input.loggingContext.correlationId }
        : {}),
      workflow: taskName,
      workflowRunId: context.workflowRunId(),
      taskRunId: context.taskRunId(),
    })
    const startedAt = performance.now()
    taskLogger.info({ event: 'hatchet.task.started' }, 'Hatchet task started')
    try {
      const result = await handler(input, context)
      taskLogger.info(
        {
          event: 'hatchet.task.completed',
          durationMs: Math.round(performance.now() - startedAt),
        },
        'Hatchet task completed'
      )
      return result
    } catch (error) {
      taskLogger.error(
        {
          event: 'hatchet.task.failed',
          durationMs: Math.round(performance.now() - startedAt),
          err: toSafeError('Hatchet task failed'),
        },
        'Hatchet task failed'
      )
      throw error
    }
  }
}
```

- [ ] **Step 3: Make task inputs additive and optional**

Define `HatchetLoggingContext` in `packages/types/src/hatchet.ts`, where it is
already re-exported by `packages/types/src/index.ts`. Import that type into the
wrapper. Add `loggingContext?: HatchetLoggingContext` to every
`PreparedHatchetTasks` input, including scheduled publication, expiration,
aggregation, and audit tasks. Mirror those input types in
`packages/hatchet/src/index.ts`. Keep the assessment response's existing
`correlationId` and audit message fields unchanged because they have existing
business semantics. Do not make `packages/types` depend on `packages/hatchet`
or `packages/logging`, and do not change handler business arguments or public
GraphQL types.

Change `prepareHatchetTasks` to accept `logger?: AppLogger`. When present, wrap
each task handler; when absent, execute the existing handler unchanged. This
preserves backend compatibility until layer 3.

- [ ] **Step 4: Verify and commit the Hatchet contract**

```bash
pnpm install
pnpm --filter @klicker-uzh/types check
pnpm --filter @klicker-uzh/hatchet test
pnpm --filter @klicker-uzh/hatchet check
pnpm --filter @klicker-uzh/hatchet build
git add packages/hatchet packages/types pnpm-lock.yaml
git commit -m "feat(logging): add Hatchet task context"
```

### Task 5: Instrument both response-processing worker modes

**Files:**

- Create: `apps/hatchet-worker-response-processor/src/logger.ts`
- Modify: `apps/hatchet-worker-response-processor/src/index.ts`
- Modify: `apps/hatchet-worker-response-processor/src/processors/processor.ts`
- Modify: `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts`
- Modify: `apps/hatchet-worker-response-processor/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: root Pino logger and `withHatchetTaskLogging`.
- Produces: distinct standard/assessment service names and correlated task
  boundary records while accepting queued inputs without `loggingContext`.

- [ ] **Step 1: Create the mode-aware root logger**

```ts
import { createLogger } from '@klicker-uzh/logging/node'

export const logger = createLogger({
  service:
    process.env.ASSESSMENT_MODE === 'true'
      ? 'hatchet-worker-response-processor-assessment'
      : 'hatchet-worker-response-processor',
})
```

Add `@klicker-uzh/logging: workspace:*` to the app.

- [ ] **Step 2: Wrap every declared task/workflow boundary**

Wrap `processAnonymousResponseTask`, `processAuthenticatedResponseTask`, the
assessment durable task, assessment failure hook, and aggregation task. Bind
only `input.loggingContext`; standard inputs will receive it from response-api
in layer 3. Extend the worker's local standard message input and assessment
workflow generic with optional `HatchetLoggingContext` from
`@klicker-uzh/types`. The existing assessment `input.correlationId` remains the
Redis deduplication key and must never be promoted to the diagnostic log field.

Keep Hatchet's SDK logger untouched. Klicker task records use the Pino root;
Hatchet's own platform records remain SDK-owned.

- [ ] **Step 3: Semantically migrate worker log calls**

Use stable events rather than copying prose. The minimum event map is:

| Existing meaning         | Event                              | Level   |
| ------------------------ | ---------------------------------- | ------- |
| Worker boot/readiness    | `hatchet.worker.started`           | `info`  |
| Missing/invalid response | `response.rejected`                | `info`  |
| JWT absent/invalid       | `response.authentication.rejected` | `info`  |
| Redis/Prisma unavailable | `dependency.unavailable`           | `error` |
| Block already closed     | `response.block_closed`            | `info`  |
| Response stored/graded   | `response.processed`               | `info`  |
| Aggregation completed    | `response.aggregation.completed`   | `info`  |
| Unexpected owned failure | task wrapper `hatchet.task.failed` | `error` |

Never include `message.response`, `cookie`, parsed JWT, solutions,
restrictions, participant identity, or audit payload text. Internal UUIDs such
as instance/live-quiz IDs are allowed only on the reviewed operational events
above and remain record metadata.

- [ ] **Step 4: Verify layer 2 and commit**

```bash
pnpm --filter @klicker-uzh/hatchet-worker-response-processor check
pnpm --filter @klicker-uzh/hatchet-worker-response-processor build
pnpm --filter @klicker-uzh/hatchet test
pnpm run check:all
git add apps/hatchet-worker-response-processor pnpm-lock.yaml
git commit -m "feat(logging): correlate response worker logs"
```

Expected: old inputs compile because `loggingContext` remains optional, and the
two deployment modes emit different `service` values.

### Task 6: Add safe request logging to response-api

**Files:**

- Create: `apps/response-api/src/logger.ts`
- Create: `apps/response-api/src/requestLogging.ts`
- Create: `apps/response-api/test/requestLogging.test.ts`
- Modify: `apps/response-api/src/index.ts`
- Modify: `apps/response-api/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: request helpers and `AppLogger`.
- Produces:
  `beginNodeRequest(req, res, route): { context, log, complete }`, response
  `x-request-id`, and Hatchet messages carrying an optional diagnostic
  `loggingContext`.

- [ ] **Step 1: Check out layer 3 and write request-adapter tests**

```bash
gh stack checkout feat/logging-core-apis
```

Add `@klicker-uzh/logging: workspace:*` to runtime dependencies,
`vitest: ~3.2.4` to dev dependencies, and `test`, `test:run`, and `test:watch`
scripts. With stub request/response headers and a capture logger, test
valid/invalid IDs, echoed response ID, parameterized route, one completion
record, health-route suppression, status-to-level mapping, and absence of URL,
query, body, headers, cookie, and response content.

Run:

```bash
pnpm --filter @klicker-uzh/response-api test -- requestLogging.test.ts
```

Expected: failure because the adapter is absent.

- [ ] **Step 2: Implement the Node HTTP request adapter**

The adapter receives the route string from the matched branch; it never parses
a route from `req.url` for logging. It resolves headers, sets `x-request-id`,
creates a child logger, and returns an idempotent `complete(statusCode)` closure.

```ts
export function beginNodeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  root: AppLogger,
  route: '/AddResponse' | '/healthz' | '/'
) {
  const context = resolveRequestContext({
    requestId: req.headers['x-request-id'],
    correlationId: req.headers['x-correlation-id'],
  })
  const log = root.child(context)
  const startedAt = performance.now()
  res.setHeader('x-request-id', context.requestId)
  let completed = false

  return {
    context,
    log,
    complete(statusCode: number) {
      if (completed || route === '/healthz' || route === '/') return
      completed = true
      const level = statusCode >= 500 ? 'error' : 'info'
      log[level](
        {
          event: 'http.request.completed',
          http: {
            method: req.method,
            route,
            statusCode,
            durationMs: Math.round(performance.now() - startedAt),
          },
        },
        'HTTP request completed'
      )
    },
  }
}
```

Wire completion from `sendJson`/error ownership so every request records once.

- [ ] **Step 3: Replace unsafe response-api logging and propagate context**

Create the root with `response-api` versus `response-api-assessment`. For every
Hatchet response event, add:

```ts
loggingContext: {
  requestId: request.context.requestId,
  correlationId: request.context.correlationId,
}
```

Keep the existing assessment business `correlationId` hash unchanged on the
payload for queued-work and Redis compatibility. Alias it locally to
`assessmentSubmissionId` when reading it for deduplication or safe operational
events; it must never replace the diagnostic ID or expose the source token.

Replace payload/audit prose with these safe events:

| Boundary                      | Event                     | Safe fields                           |
| ----------------------------- | ------------------------- | ------------------------------------- |
| Accepted response             | `response.accepted`       | event name, internal message ID       |
| Duplicate assessment response | `response.duplicate`      | assessment submission ID, instance ID |
| Validation/auth rejection     | `response.rejected`       | reason code only                      |
| Hatchet publish failure       | `response.publish.failed` | safe `err`                            |
| Redis startup                 | `dependency.connected`    | dependency name                       |
| Service ready                 | `service.started`         | port, assessment boolean              |

Delete every log/audit message that contains `req`, payload, response, cookie,
correlation token, participant ID, or full Hatchet message. Preserve the
existing client responses and status codes.

- [ ] **Step 4: Verify and commit response-api**

```bash
pnpm install
pnpm --filter @klicker-uzh/response-api test
pnpm --filter @klicker-uzh/response-api check
pnpm --filter @klicker-uzh/response-api build
git add apps/response-api pnpm-lock.yaml
git commit -m "feat(logging): instrument response API ingress"
```

### Task 7: Bind backend and GraphQL request context

**Files:**

- Create: `apps/backend-docker/src/logger.ts`
- Create: `apps/backend-docker/src/requestLogging.ts`
- Create: `apps/backend-docker/test/requestLogging.test.ts`
- Modify: `apps/backend-docker/src/app.ts`
- Modify: `apps/backend-docker/src/index.ts`
- Modify: `apps/backend-docker/src/migration.ts`
- Modify: `apps/backend-docker/package.json`
- Modify: `packages/graphql/src/lib/context.ts`
- Modify: `packages/graphql/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Produces internal GraphQL context fields
  `requestContext: RequestContext` and `log: AppLogger`.
- Consumes the same request contract as response-api; no public GraphQL schema
  or generated operation changes.

- [ ] **Step 1: Write backend adapter tests**

Add `@klicker-uzh/logging: workspace:*` to runtime dependencies,
`vitest: ~3.2.4` to dev dependencies, and `test`, `test:run`, and `test:watch`
scripts. Test Express middleware with stubbed request/response objects. Assert
safe parameterized `/api/graphql`, response header, health suppression, one
finish record, standard/assessment service selection, and no raw `originalUrl`,
body, cookies, authorization, operation variables, or result.

Run:

```bash
pnpm --filter @klicker-uzh/backend-docker test -- requestLogging.test.ts
```

Expected: failure until the adapter and test script are added.

- [ ] **Step 2: Install request middleware before authentication**

Create the backend root as `backend-graphql` or `backend-assessment`. The
middleware stores these fields without replacing `req.locals.user`:

```ts
declare global {
  namespace Express {
    interface Locals {
      user?: unknown
      requestContext: RequestContext
      log: AppLogger
    }
  }
}
```

Have JWT middleware add only `user`; on verification failure record
`auth.jwt.rejected` at `info` with no token, origin, cookie, URL, or raw JWT
library error. Set GraphQL Yoga `logging: false` because the owned HTTP boundary
now records completion/failure.

- [ ] **Step 3: Extend internal GraphQL context**

Add `requestContext` and `log` to `Context` in
`packages/graphql/src/lib/context.ts`. `enhanceContext` reads them from
`req.locals`; WebSocket `onSubscribe` creates a context from the upgrade
request's allowed headers and a child of the backend root. Pass the root logger
to `prepareHatchetTasks({ logger })` in `apps/backend-docker/src/index.ts`.

- [ ] **Step 4: Propagate correlation to GraphQL-published tasks**

For each scheduling/publishing call in these files, add this to its existing
input:

```ts
loggingContext: {
  requestId: ctx.requestContext.requestId,
  correlationId: ctx.requestContext.correlationId,
}
```

- `packages/graphql/src/services/groups.ts`
- `packages/graphql/src/services/liveQuizzes.ts`
- `packages/graphql/src/services/microLearning.ts`
- `packages/graphql/src/services/practiceQuizzes.ts`

Scheduled work initiated by scripts or a cron and therefore lacking a request
context omits correlation rather than generating a misleading one.

- [ ] **Step 5: Verify and commit request context**

```bash
pnpm install
pnpm --filter @klicker-uzh/backend-docker test
pnpm --filter @klicker-uzh/graphql check
pnpm --filter @klicker-uzh/backend-docker check
pnpm --filter @klicker-uzh/backend-docker build
git add apps/backend-docker packages/graphql/src/lib/context.ts \
  packages/graphql/src/services/groups.ts \
  packages/graphql/src/services/liveQuizzes.ts \
  packages/graphql/src/services/microLearning.ts \
  packages/graphql/src/services/practiceQuizzes.ts \
  packages/graphql/package.json pnpm-lock.yaml
git commit -m "feat(logging): bind GraphQL request context"
```

### Task 8: Migrate production GraphQL service logs

**Files:**

- Modify: `packages/graphql/src/services/accounts.ts`
- Modify: `packages/graphql/src/services/activities.ts`
- Modify: `packages/graphql/src/services/chatbots.ts`
- Modify: `packages/graphql/src/services/courses.ts`
- Modify: `packages/graphql/src/services/email.ts`
- Modify: `packages/graphql/src/services/groups.ts`
- Modify: `packages/graphql/src/services/liveQuizzes.ts`
- Modify: `packages/graphql/src/services/microLearning.ts`
- Modify: `packages/graphql/src/services/notifications.ts`
- Modify: `packages/graphql/src/services/participants.ts`
- Modify: `packages/graphql/src/services/practiceQuizzes.ts`
- Modify: `packages/graphql/src/services/sharing.ts`
- Modify: `packages/graphql/src/services/templates.ts`
- Modify only when a call is operational rather than validation flow:
  `packages/graphql/src/lib/validateCaseStudyOptions.ts`,
  `validateElementInputs.ts`, `validateFreeTextOptions.ts`,
  `validateKPRIMOptions.ts`, `validateMCOptions.ts`,
  `validateNumericalOptions.ts`, `validateSCOptions.ts`,
  `validateSelectionOptions.ts`, and `validateSharedChoicesFields.ts`

**Interfaces:**

- Consumes: `ctx.log` and `ctx.requestContext` from Task 7.
- Produces: no production `console.*` in GraphQL request/service paths; CLI
  scripts retain their terminal output.

- [ ] **Step 1: Classify every production call before changing it**

For each file above, mark the call as one of:

1. remove because the caller already owns/logs the failure;
2. convert to `ctx.log` because the service recovers or records a distinct
   operational event;
3. convert to a returned/throwing validation result with no log;
4. retain only if it is unreachable production scaffolding, then delete the
   commented scaffold instead of creating an exception.

Do not touch `packages/graphql/src/scripts/**`; those are operator CLI output
and outside the server-console guard.

- [ ] **Step 2: Apply the semantic conversion**

Use object-first Pino calls:

```ts
ctx.log.warn(
  {
    event: 'activity.schedule.failed',
    activityType: 'practice_quiz',
    err: toSafeError('Scheduling failed'),
  },
  'Activity publication could not be scheduled'
)
```

Never include entity names, participant/user identifiers, email transport
configuration, notification payloads, template content, GraphQL variables, or
raw third-party errors. Validation helpers should normally return their current
error result without logging expected invalid input.

- [ ] **Step 3: Prove only operator scripts retain consoles and commit**

```bash
rg -n "console\.(log|info|warn|error|debug)" packages/graphql/src \
  --glob '!scripts/**' --glob '!**/scripts/**'
pnpm --filter @klicker-uzh/graphql test
pnpm --filter @klicker-uzh/graphql check
pnpm --filter @klicker-uzh/graphql build
pnpm run check:all
```

Expected: the `rg` command has no active production matches; commented example
code is removed. Then:

```bash
git add packages/graphql
git commit -m "refactor(logging): migrate GraphQL service events"
```

### Task 9: Secure auth logging across Node and Edge

**Files:**

- Create: `apps/auth/src/lib/server/logger.ts`
- Create: `apps/auth/src/lib/edgeLogger.ts`
- Create: `apps/auth/src/instrumentation.ts`
- Modify: `apps/auth/src/middleware.ts`
- Modify: `apps/auth/src/lib/helpers.ts`
- Modify: `apps/auth/src/lib/util.ts`
- Modify: `apps/auth/src/pages/api/auth/[...nextauth].ts`
- Modify: `apps/auth/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Node, request, and Edge logging entry points.
- Produces: request-scoped auth outcome records and an echoed request ID without
  logging auth profiles, identity data, redirects, cookies, or query values.

- [ ] **Step 1: Check out layer 4 and add auth roots**

```bash
gh stack checkout feat/logging-auth-integrations
```

`src/lib/server/logger.ts` exports `createLogger({ service: 'auth' })`.
`src/lib/edgeLogger.ts` exports `createEdgeLogger({ service: 'auth' })`.
`src/instrumentation.ts` logs `service.started` only when
`process.env.NEXT_RUNTIME === 'nodejs'`. Add the workspace logging dependency.

- [ ] **Step 2: Replace middleware diagnostics with safe outcome events**

At middleware entry, resolve IDs from headers and create an Edge child. Add a
single helper that attaches `x-request-id` to every returned `NextResponse`.
Replace detailed URL/referer/search/cookie logs with the following allowlist:

| Outcome                        | Event                          | Fields                   |
| ------------------------------ | ------------------------------ | ------------------------ |
| PWA redirect                   | `auth.redirect.selected`       | target kind `pwa`        |
| Lecturer/student route         | `auth.audience.selected`       | audience only            |
| Invalid redirect               | `auth.redirect.rejected`       | audience and reason code |
| Redirect cookie set/cleared    | `auth.redirect_cookie.updated` | action and audience      |
| Callback parameters normalized | `auth.callback.normalized`     | audience only            |

Do not log `request.url`, pathname query, referer, host, callback URL, redirect
URL, cookie values, participant parameter, or serialized `NextRequest`.

- [ ] **Step 3: Thread a Node child through NextAuth callbacks**

In `[...nextauth].ts`, replace the ad hoc request ID with
`resolveRequestContext` from incoming headers, set `x-request-id`, and create a
child logger. Change `getAuthContext(req, requestId)` to
`getAuthContext(req, log)`; it records only the selected audience and decision
source enum.

Use these event families:

- `auth.sign_in.accepted` / `auth.sign_in.rejected`
- `auth.token.updated`
- `auth.redirect.accepted` / `auth.redirect.rejected`
- `auth.account.linked` / `auth.account.created`
- `auth.invitation.accepted`

Allowed fields are audience, provider kind, decision source, outcome, and
counts. Delete profile dumps, `sub`, email arrays, affiliation values,
invitation email lists, raw errors from OIDC/NextAuth/Axios, callback URLs, and
request URLs. Normalize third-party failures with `toSafeError`.

- [ ] **Step 4: Verify privacy by source scan and production build**

```bash
rg -n "console\.(log|info|warn|error|debug)" \
  apps/auth/src/middleware.ts \
  apps/auth/src/lib/helpers.ts \
  apps/auth/src/lib/util.ts \
  'apps/auth/src/pages/api/auth/[...nextauth].ts'
rg -n "profile|email|cookie|callbackUrl|redirectTo|request\.url|req\.url" \
  apps/auth/src --glob '*.ts'
pnpm --filter @klicker-uzh/auth check
pnpm --filter @klicker-uzh/auth build
```

Expected: the first scan is empty, and every second-scan hit is application
logic rather than a log argument. The shared Edge adapter is outside these scan
paths. Commit only after manually inspecting each hit:

```bash
git add apps/auth pnpm-lock.yaml
git commit -m "feat(logging): secure auth request logs"
```

### Task 10: Instrument LTI and OLAT integrations

**Files:**

- Create: `apps/lti/src/logger.ts`
- Modify: `apps/lti/src/index.ts`
- Modify: `apps/lti/package.json`
- Create: `apps/olat-api/src/logger.ts`
- Create: `apps/olat-api/src/requestLogging.ts`
- Create: `apps/olat-api/test/requestLogging.test.ts`
- Modify: `apps/olat-api/src/index.ts`
- Modify: `apps/olat-api/src/services.ts`
- Modify: `apps/olat-api/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Produces stable `lti` and `olat-api` services, safe Express completion
  records, and no launch token, public key, account identifier, or API key logs.

- [ ] **Step 1: Replace LTI launch diagnostics**

Create the `lti` root. Migrate startup, registration, launch, redirect, and
failure logs to:

- `service.started`
- `lti.platform.registered`
- `lti.launch.accepted`
- `lti.launch.rejected`
- `lti.redirect.selected`

Delete logs containing `res.locals.token`, userInfo, names, email, user ID,
launch payloads, public key material, redirect URLs, database configuration, or
raw ltijs errors. `/info` continues returning its existing response; logging it
is unnecessary.

- [ ] **Step 2: Add OLAT request completion and safe dependency events**

Create the `olat-api` root and an Express adapter equivalent to Task 7 with
explicit route templates:

```text
/api/configuration/courses
/api/configuration/activityTypes
/api/configuration/course/:courseID/activityTypes
/api/configuration/course/:courseID/:activityTypeKey
/openapi.yaml
```

Suppress `/health`. Replace route catch logs with `http.request.failed` at the
request owner and `dependency.read.failed` for the local activity-type file.
Do not log API keys, provider account IDs, course IDs, response data, bodies, or
raw file/client configuration.

- [ ] **Step 3: Add an OLAT request-logging adapter test**

With stubbed Express request/response objects and a capture destination, assert
a successful request has one completion record with a parameterized route and
that invalid/missing API keys never appear in output. Use the unique fake key
canary `fake-olat-key-logging-canary-20260805`. Keep the existing containerized
integration test unchanged; the new test runs within its existing Vitest
command.

- [ ] **Step 4: Verify layer 4 and commit**

```bash
pnpm install
pnpm --filter @klicker-uzh/lti-service check
pnpm --filter @klicker-uzh/lti-service build
pnpm --filter @klicker-uzh/olat-api check
pnpm --filter @klicker-uzh/olat-api build
pnpm --filter @klicker-uzh/olat-api test
pnpm run check:all
git add apps/lti apps/olat-api pnpm-lock.yaml
git commit -m "feat(logging): instrument LMS integrations"
```

### Task 11: Instrument chat route handlers

**Files:**

- Create: `apps/chat/src/lib/server/logger.ts`
- Create: `apps/chat/src/lib/server/requestLogging.ts`
- Create: `apps/chat/test/request-logging.test.ts`
- Modify: `apps/chat/src/instrumentation.ts`
- Modify: `apps/chat/src/lib/server/apiGuards.ts`
- Modify all route handlers under: `apps/chat/src/app/api/**/route.ts`
- Modify: `apps/chat/src/services/mcpClients.ts`
- Modify: `apps/chat/src/lib/server/chatModelRegistry.ts`
- Modify: `apps/chat/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Consumes: Node request logger and existing chat instrumentation hook.
- Produces: `withRouteLogging(request, routeTemplate, handler)` for Node route
  handlers; health remains suppressed.

- [ ] **Step 1: Check out layer 5 and write route-wrapper tests**

```bash
gh stack checkout feat/logging-server-apps
```

Test request IDs, response header, one completion record on success/throw,
parameterized route, 4xx/5xx level policy, and absence of tokens, request body,
messages, prompt text, model output, attachment content, raw URL, and query.

Run:

```bash
pnpm --filter @klicker-uzh/chat test:run -- request-logging.test.ts
```

Expected: failure because the wrapper is absent.

- [ ] **Step 2: Extend instrumentation and add the request wrapper**

Keep existing optional Langfuse/OpenTelemetry setup intact. At Node
instrumentation registration, initialize the `chat` logger and record one
`service.started`. The route wrapper resolves headers, invokes the existing
handler, adds `x-request-id` to the returned `NextResponse`, and logs completion
without consuming/cloning the body.

- [ ] **Step 3: Migrate all chat server logs semantically**

Wrap every route under `apps/chat/src/app/api`. Use route templates written in
source, such as:

```text
/api/chatbots/:chatbotId/chat
/api/chatbots/:chatbotId/threads/:threadId/messages
/api/chatbots/:chatbotId/threads/:threadId/messages/:messageId/attachments
```

Use these event families for non-completion milestones:

- `chat.authentication.rejected`
- `chat.authorization.rejected`
- `chat.configuration.failed`
- `chat.message.persist.failed`
- `chat.stream.failed`
- `chat.credit.deduction.failed`
- `chat.mcp.connection.failed`

Never log participant/chatbot/thread/message UUIDs unless a reviewed event needs
one for operational diagnosis; never log prompt/messages, generated text,
images/attachments, decrypted API keys, upstream URLs/headers, model client
configuration, JWT errors, or raw AI/MCP provider errors. Convert providers to
safe app-owned errors before logging.

- [ ] **Step 4: Verify and commit chat adoption**

```bash
rg -n "console\.(log|info|warn|error|debug)" \
  apps/chat/src/app/api apps/chat/src/lib/server apps/chat/src/services
pnpm --filter @klicker-uzh/chat test:run
pnpm --filter @klicker-uzh/chat check
pnpm --filter @klicker-uzh/chat build
git add apps/chat pnpm-lock.yaml
git commit -m "feat(logging): instrument chat server routes"
```

Expected: no active server console calls; client components/hooks/stores are
not part of this scan.

### Task 12: Complete Next server adoption and add the console guard

**Files:**

- Create: `apps/frontend-manage/src/lib/server/logger.ts`
- Create: `apps/frontend-manage/src/instrumentation.ts`
- Create: `apps/frontend-pwa/src/lib/server/logger.ts`
- Create: `apps/frontend-pwa/src/instrumentation.ts`
- Modify: `apps/frontend-pwa/src/lib/apollo.ts`
- Create: `apps/frontend-control/src/lib/server/logger.ts`
- Create: `apps/frontend-control/src/instrumentation.ts`
- Modify server-error branches in `apps/frontend-pwa/src/pages/**` that export
  `getServerSideProps`
- Modify: `apps/frontend-manage/package.json`
- Modify: `apps/frontend-pwa/package.json`
- Modify: `apps/frontend-control/package.json`
- Create: `util/check-server-console.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Produces mode-aware PWA service startup and a guard scoped only to
  unambiguous server-owned paths.

- [ ] **Step 1: Add Node-only instrumentation roots**

Each instrumentation hook returns unless `NEXT_RUNTIME === 'nodejs'`, then
dynamically imports its server logger and writes `service.started`.
PWA selects `frontend-assessment` when `ASSESSMENT_MODE === 'true'`; manage and
control use fixed names.

- [ ] **Step 2: Migrate PWA server-side rendering failures**

In pages that export `getServerSideProps`, dynamically import the server logger
inside the server function and use a child resolved from `ctx.req.headers`.
Migrate only the server catch branches, including:

- `apps/frontend-pwa/src/pages/editProfile.tsx`
- `apps/frontend-pwa/src/pages/course/[courseId]/chatbot/[chatbotId].tsx`
- `apps/frontend-pwa/src/pages/course/[courseId]/index.tsx`
- `apps/frontend-pwa/src/pages/course/[courseId]/practice.tsx`
- `apps/frontend-pwa/src/pages/course/[courseId]/liveQuizzes/overview.tsx`
- `apps/frontend-pwa/src/pages/createAccount.tsx`
- `apps/frontend-pwa/src/pages/course/[courseId]/practiceQuizzes/[id].tsx`
- `apps/frontend-pwa/src/pages/course/[courseId]/practiceQuizzes/overview.tsx`
- `apps/frontend-pwa/src/pages/course/[courseId]/microLearnings/overview.tsx`
- `apps/frontend-pwa/src/pages/course/[courseId]/microLearnings/[id]/index.tsx`
- `apps/frontend-pwa/src/pages/join/[shortname].tsx`

Use `ssr.request.failed`, a static parameterized page route, and safe `err`.
Do not log `ctx`, query/params values, destination URLs, Apollo errors that may
contain request configuration, cookies, or participant data. Leave client-side
console behavior unchanged in shared page/component modules.

For SSR-to-GraphQL calls, pass the same resolved `RequestContext` into
`initializeApollo`. Extend the server-side Apollo link to add only
`propagationHeaders(requestContext)` alongside its existing cookie/auth headers.
Do not send these headers to browser-side GraphQL calls or external providers.
This makes the frontend ingress error and backend GraphQL request share one
diagnostic operation ID.

- [ ] **Step 3: Add a narrowly scoped console guard**

`util/check-server-console.mjs` scans only these paths:

```js
const serverRoots = [
  'apps/backend-docker/src',
  'apps/response-api/src',
  'apps/hatchet-worker-general/src',
  'apps/hatchet-worker-response-processor/src',
  'apps/auth/src/lib/server',
  'apps/auth/src/pages/api/auth',
  'apps/auth/src/middleware.ts',
  'apps/lti/src',
  'apps/olat-api/src',
  'apps/chat/src/app/api',
  'apps/chat/src/lib/server',
  'apps/chat/src/services/mcpClients.ts',
  'apps/frontend-manage/src/lib/server',
  'apps/frontend-pwa/src/lib/server',
  'apps/frontend-control/src/lib/server',
  'packages/logging/src',
  'packages/graphql/src/services',
]
```

Allow exactly `packages/logging/src/edge.ts` as the Edge serialization sink and
exclude operator `scripts` directories. Parse text line-by-line and fail with
`path:line` for active `console.log/info/warn/error/debug` calls; ignore comments
only after stripping block and line comments with a small deterministic scanner
rather than a fragile global regex.

Add `check:server-console` to root scripts and to `check:all`.

- [ ] **Step 4: Verify and commit Next adoption**

```bash
pnpm install
pnpm run check:server-console
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/frontend-pwa check
pnpm --filter @klicker-uzh/frontend-control check
pnpm --filter @klicker-uzh/frontend-manage build
pnpm --filter @klicker-uzh/frontend-pwa build
pnpm --filter @klicker-uzh/frontend-control build
git add apps/frontend-manage apps/frontend-pwa apps/frontend-control \
  util/check-server-console.mjs package.json pnpm-lock.yaml
git commit -m "feat(logging): complete Next server adoption"
```

### Task 13: Run final verification and publish draft stack metadata

**Files:**

- Modify: `docs/observability.md`
- Modify: `docs/testing.md`
- Modify: `docs/ci-and-deployment.md`
- Modify: `docs/log.md`
- Modify: `project/plans_wip/PLAN-production-json-logging.md`
- Create locally, do not commit: verification screenshots under a temporary
  evidence directory outside the public repository.

**Interfaces:**

- Consumes: all five layers and the separate cloud plan.
- Produces: reproducible verification evidence and five draft PRs with bases
  chained bottom-to-top.

- [ ] **Step 1: Update final operating and testing documentation**

Document local pretty output, production NDJSON, service/event names,
correlation propagation, privacy review checklist, health suppression, the
server-console exception, and staging LogQL queries. Explicitly state that JSON
transport already works without the linked cloud MRs; they add `service_name`
and structured metadata.

- [ ] **Step 2: Run mechanical verification at the stack tip**

```bash
pnpm run check:all
pnpm run test:run
pnpm run build
opengrep scan --config auto
git status --short
```

Expected: all checks pass and only intentional documentation/progress changes
remain. Summarize opengrep findings; resolve relevant findings or record a
specific rationale in the WIP plan.

- [ ] **Step 3: Run production-output smoke checks**

Start only the logging unit fixture or a built canary with
`NODE_ENV=production`, capture stdout, parse every application line with `jq`,
and assert no pretty text. Repeat with `NODE_ENV=development` and confirm pretty
output. Use fake privacy canaries only.

- [ ] **Step 4: Run browser smoke verification through devrouter**

```bash
devrouter ensure .
```

Using delegated login (`lecturer` / `abcd`), verify:

1. lecturer auth redirect and manage landing;
2. participant login and PWA landing;
3. control session page;
4. chat landing and one authenticated API request;
5. assessment auth redirect/cookie behavior.

Capture desktop screenshots for auth, manage, PWA, control, and chat, plus a
mobile PWA viewport. No visible difference is expected. Store evidence outside
the public repo and attach it to the affected PR descriptions/comments.

- [ ] **Step 5: Commit final docs and progress**

```bash
git add docs project/plans_wip/PLAN-production-json-logging.md
git commit -m "docs(logging): add production operations runbook"
```

- [ ] **Step 6: Review the union and every intermediate layer**

For each branch from bottom to top, run:

```bash
for branch in \
  feat/logging-foundation \
  feat/logging-hatchet-correlation \
  feat/logging-core-apis \
  feat/logging-auth-integrations \
  feat/logging-server-apps; do
  gh stack checkout "$branch"
  pnpm run check:all
  git diff --check
done
```

Run the repository-required thermo-nuclear maintainability review at the stack
tip. Resolve findings or record explicit, scoped deferrals. Compare the union
against old PRs #4918 and #4750 and note that only the approved Pino/correlation
concepts were retained; no unsafe profile/URL logging or custom framework was
copied.

- [ ] **Step 7: Submit the five PRs as drafts**

```bash
gh stack top
gh stack submit --auto
gh stack view
```

Expected: five draft PRs, each targeting the branch below it, with the titles in
the stack map. Update each PR body so it describes that branch against its
actual target, its tests, assumptions, deployment order, and reviewer audience.
Do not mark ready, merge, reorder, unstack, or close old PRs without explicit
user approval.

- [ ] **Step 8: Stage acceptance after the cloud parent MR is deployed**

Deploy bottom-up, execute one standard and one assessment response, and verify:

```logql
{service_name="response-api"} | correlation_id="logging-canary-20260805"
{service_name="hatchet-worker-response-processor"} | correlation_id="logging-canary-20260805"
{service_name="backend-graphql"} | level="error"
```

Confirm non-JSON/third-party logs remain, assessment variants have distinct
service names, fake privacy canaries are absent everywhere, and request IDs are
structured metadata rather than labels. Check Loki stream cardinality and log
volume before production promotion.

## Completion conditions

- All five draft PRs are independently green and the stack union covers every
  in-scope runtime.
- Both linked infrastructure MRs have passed their own plan and the parent has
  passed its staging preview.
- Browser, staging, privacy, cardinality, and cross-Hatchet correlation evidence
  is recorded.
- Old PRs #4918 and #4750 receive a superseding link and are closed only after
  the user explicitly approves that action.
- Production promotion and all merges remain human-controlled.
