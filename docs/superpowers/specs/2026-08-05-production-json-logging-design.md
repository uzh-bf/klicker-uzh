# Production JSON Logging Design

- **Status:** Approved for implementation planning
- **Date:** 2026-08-05
- **ClickUp:** [Klicker: Setup clean approach for JSON logging in production](https://app.clickup.com/t/86c5ajadd)

## Decision summary

Klicker will standardize production application logs on a small,
server-only `@klicker-uzh/logging` package built on Pino. Node processes emit
newline-delimited JSON to stdout. Kubernetes and Grafana Alloy collect stdout,
parse the common fields, and forward the original record to Loki. Applications
do not connect directly to Loki.

The milestone includes structured logging and request/correlation propagation.
It does not introduce distributed tracing, a browser-log ingestion service, or
a replacement exception-tracking system.

The application work ships as one native GitHub stack of five PRs. A separate
GitLab MR updates Alloy because collector configuration lives in another
repository and has an independent deployment lifecycle.

## Context

The current repository has Pino only in `hatchet-worker-general`; other
production runtimes mainly use ad hoc `console.*` calls. Several existing calls
log overly broad objects such as URLs, authentication profiles, tokens, cookies,
and response payloads.

Two older draft PRs informed this design:

- [PR #4918](https://github.com/uzh-bf/klicker-uzh/pull/4918) proves that Pino
  works in the auth app, but it is auth-only and contains unsafe logging of
  URLs, profiles, and participant data. Its concepts should be reimplemented,
  not merged wholesale.
- [PR #4750](https://github.com/uzh-bf/klicker-uzh/pull/4750) contains useful
  request/correlation concepts, but implements a large custom logging framework
  instead of relying on Pino. Only the correlation and request-context ideas
  should be retained.

The current Alloy pipeline discovers Kubernetes pods and forwards their output
directly to Loki. It does not parse application JSON, promote an application
service name, or expose correlation fields as structured metadata. Therefore,
application and collector changes are both required for the ClickUp outcome.

## Goals

- Emit production-safe NDJSON from every in-scope Node server runtime.
- Apply one field contract, level policy, and privacy policy across apps.
- Make a request traceable through HTTP ingress and Hatchet processing by a
  stable correlation identifier.
- Make logs queryable in Loki by service, level, request ID, correlation ID, and
  event without creating high-cardinality labels.
- Keep local logs readable with `pino-pretty`.
- Preserve third-party and non-JSON logs during collector rollout.
- Migrate incrementally through independently buildable and reviewable PRs.

## Non-goals

- Full OpenTelemetry tracing or new span generation.
- Browser log transport or browser error telemetry.
- Replacing Sentry or deciding the long-term exception-alerting strategy.
- Logging request/response bodies, participant answers, or audit-event payloads.
- Replacing Hatchet SDK-internal logging.
- Structured logging for the Python analytics service.
- Logging changes for the Office Add-in or static documentation site.
- A broad cleanup of existing Kubernetes labels unrelated to application JSON.
- Prisma, public GraphQL schema, authorization, gamification, i18n, or seed
  changes.

## Scope

The Pino stack covers all production TypeScript/JavaScript server runtimes where
Pino applies:

| Runtime                                                                       | Stack layer |
| ----------------------------------------------------------------------------- | ----------- |
| `hatchet-worker-general`                                                      | 1           |
| `hatchet-worker-response-processor`, including assessment                     | 2           |
| `response-api`, including assessment                                          | 3           |
| `backend-docker`, including assessment GraphQL                                | 3           |
| `auth`, including Edge middleware                                             | 4           |
| `lti` and `olat-api`                                                          | 4           |
| Server-side `chat`, `frontend-manage`, `frontend-pwa`, and `frontend-control` | 5           |

Browser modules in the frontend applications remain browser-console territory.
`apps/analytics` is Python and is explicitly excluded. `apps/office-addin` and
`apps/docs` have no persistent Node server runtime in the core deployment and
are also excluded.

Assessment deployments share application code but must emit distinct service
names. Each app passes a required service name when creating its process logger
and derives the assessment variant from the existing assessment-mode
configuration.

## Alternatives considered

### Shared Pino package and stdout collection — chosen

A thin package centralizes the contract and safety defaults while leaving Pino
visible to callers. Stdout remains the only production destination, so logging
does not add application credentials, retries, buffering, or a network failure
dependency.

### Independent Pino configuration in every app

This has slightly less initial package work but allows service names, redaction,
levels, and serializers to drift. PR #4918 already demonstrates that risk.

### Direct Loki transports or a custom logging framework

Direct transports couple applications to collector availability. A custom
framework duplicates Pino's serializers, redaction, child loggers, transports,
and ecosystem at substantially greater maintenance cost, as PR #4750 shows.

## Architecture

```text
Application runtime
  -> @klicker-uzh/logging
  -> NDJSON on stdout
  -> Kubernetes container log
  -> Grafana Alloy JSON processing
  -> Loki
```

Production has no Pino transport: Pino writes NDJSON to stdout. Development uses
`pino-pretty`; tests are silent unless a test supplies a capture destination.
Health and readiness endpoints are not logged at `info`.

The implementation pins the latest Pino 9 release across the workspace rather
than introducing a Pino 10 major upgrade as part of this feature. At the time of
design, that means Pino `9.14.0`; `pino-pretty` remains pinned at `13.1.3`.

## Component boundaries

### `@klicker-uzh/logging`

The new dedicated package is server-only. It is not placed in `packages/util`,
which is also consumed by browser code.

It exposes three small entry points:

- `@klicker-uzh/logging/node`: Pino factory, shared logger types, serializers,
  base redaction, and child-logger helpers.
- `@klicker-uzh/logging/request`: runtime-neutral request/correlation ID
  validation and context types.
- `@klicker-uzh/logging/edge`: a minimal Edge-compatible JSON logger with the
  same record contract for middleware that cannot load Node/Pino APIs.

The Edge adapter serializes one complete record to a JSON string before writing
it to `console`; it never relies on a runtime-specific rendering of a JavaScript
object.

The package is framework-neutral. GraphQL, Node HTTP, Next.js, and Hatchet each
receive a small adapter close to the owning application. The first iteration
does not add `AsyncLocalStorage`, a universal HTTP middleware, or hidden global
request context. Callers pass child loggers explicitly through GraphQL context,
request handlers, and task inputs.

### Application integrations

Every long-lived process creates one root logger with an explicit stable service
name. Request and task boundaries create child loggers. Application code logs
operational events through those children and never mutates shared context.

The general worker's current local Pino configuration moves into the shared
package. Hatchet SDK logs remain independent; Klicker task logs use the shared
logger alongside them.

### Grafana Alloy

The companion cloud MR adds a `loki.process` stage between Kubernetes log
collection and Loki writing. It:

- parses JSON without rewriting the original line;
- maps `service` to the stable `service_name` label;
- exposes `level`, `event`, `requestId`, `correlationId`, and real trace/span IDs
  as structured metadata rather than high-cardinality labels;
- uses the application `time` when valid and otherwise retains the container
  timestamp; and
- forwards non-JSON lines unchanged.

Existing Kubernetes labels are preserved during this rollout to avoid breaking
queries. Their broader cardinality cleanup is a separate concern.

## Log record contract

```json
{
  "time": 1785926400000,
  "level": "info",
  "service": "response-api",
  "event": "response.accepted",
  "msg": "Response queued for processing",
  "requestId": "3c4fe278-40fc-4a7e-8cd3-c093251f5d53",
  "correlationId": "3c4fe278-40fc-4a7e-8cd3-c093251f5d53",
  "http": {
    "method": "POST",
    "route": "/responses",
    "statusCode": 202,
    "durationMs": 18
  }
}
```

| Field                | Rule                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| `time`               | Pino's Unix-millisecond timestamp                                      |
| `level`              | String: `trace`, `debug`, `info`, `warn`, `error`, or `fatal`          |
| `service`            | Required stable runtime name, distinct for assessment variants         |
| `event`              | Stable dot-separated machine name such as `http.request.completed`     |
| `msg`                | Short, mostly static human explanation; dynamic data belongs in fields |
| `requestId`          | One HTTP request; optional outside request work                        |
| `correlationId`      | One cross-service operation; optional outside correlated work          |
| `http`               | Allowlisted method, parameterized route, status, and duration only     |
| `err`                | Pino-serialized `Error`; never an arbitrary request/client object      |
| `traceId` / `spanId` | Optional only when a real existing trace context supplies them         |

The record omits Pino's default `pid` and `hostname`; Kubernetes already owns
pod, container, and node metadata. It keeps Pino's conventional `msg` key and
uses a level formatter to emit string level names.

Routes must be parameterized route names. If a framework cannot provide a safe
route template, the adapter omits the route unless the handler supplies one. It
never falls back to a raw URL, pathname containing entity IDs, or query string.

## Context propagation

### HTTP

Ingress accepts `x-request-id` and `x-correlation-id` only when they match
`[A-Za-z0-9._-]{1,128}`. Missing or invalid values are replaced with UUIDs. A
new operation defaults `correlationId` to `requestId`. The response returns
`x-request-id`; internal outbound requests propagate both IDs.

These identifiers are diagnostic only. No authorization, deduplication, or
business decision may trust their uniqueness or provenance.

Request adapters create a child logger with the IDs and record one completion
event. Expected client validation failures remain `info`; unexpected degradation
is `warn`; server failures are `error`.

### GraphQL

The internal GraphQL context gains a request child logger. This is an internal
type change, not a public schema change, so GraphQL code generation is not
required. The request boundary owns completion/error logging; services log an
error only when they fully handle it or add a distinct operational event.

### Hatchet

Shared event types gain an additive optional `correlationId`. Consumers are
deployed before publishers. A task child logger binds correlation, workflow,
task, and run identifiers. Already-queued payloads without correlation remain
valid and use task/run context without inventing a false cross-service ID.

## Error and level policy

Errors are passed as `{ err }` so Pino applies its standard serializer. They are
not spread, stringified, or interpolated into `msg`. An error is logged once at
the boundary that owns the failure; lower layers either propagate it or log only
when they recover from it. The package does not install global
`uncaughtException` or `unhandledRejection` handlers. Existing process owners
remain responsible for controlled shutdown and fatal-log flushing.

Third-party errors whose messages or stacks can contain request URLs, headers,
or client configuration are converted to an application-owned safe error shape
before logging. The raw third-party error is not logged at any level.

| Level   | Meaning                                                              |
| ------- | -------------------------------------------------------------------- |
| `fatal` | The process cannot safely continue                                   |
| `error` | The owned operation failed                                           |
| `warn`  | The operation recovered with degradation, retry, or unexpected input |
| `info`  | Lifecycle, request completion, and meaningful business milestones    |
| `debug` | Diagnostic detail disabled by default in production                  |
| `trace` | Highly detailed local diagnosis only                                 |

`LOG_LEVEL` controls the threshold and is declared in `turbo.json`. Production
defaults to `info`; development may opt into `debug`; tests default to silence
unless they are explicitly testing output.

## Privacy and data minimization

Logging is allowlist-first. Central Pino redaction is a defense in depth, not a
substitute for safe call sites, because it cannot remove a secret already
interpolated into a string.

The following are prohibited from application logs:

- authorization and cookie headers;
- access, refresh, ID, magic-link, LTI, API, and session tokens;
- passwords, secrets, connection strings, and encryption keys;
- raw request/response bodies and Hatchet payloads;
- Edu-ID or NextAuth profiles;
- participant answers and generated content;
- names, email addresses, matriculation identifiers, and IP addresses; and
- raw URLs, query strings, and arbitrary error/client configuration objects.

Serializers expose only approved HTTP fields. Redaction removes known credential
paths as a backstop. Internal entity UUIDs may be logged only by a specifically
reviewed operational event and remain metadata, never labels.

Migration is manual and semantic: each existing `console.*` call is reviewed,
removed, demoted, or rewritten. A bulk syntactic replacement is not acceptable.
PR 5 adds automated `console.*` protection only to unambiguous server-only
paths; it does not impose a brittle monorepo-wide browser `no-console` rule.

## Repository layer footprint

- New `packages/logging` package and tests.
- `packages/types` only for additive Hatchet correlation fields.
- `packages/hatchet` and both Hatchet worker apps for task context.
- `backend-docker` and internal `packages/graphql` context types; no public
  schema or operation changes.
- `response-api`, auth, LTI, OLAT, chat, and server-side frontend integrations.
- `turbo.json`, relevant package manifests, and the pnpm lockfile.
- Helm configuration only where a deployment needs an explicit distinct service
  name or log level.
- An ADR, observability wiki page, query/runbook examples, and `docs/log.md`
  entry during implementation.

There are no Prisma, seed, authorization, permission, gamification, i18n, or
user-visible UI changes.

## PR and MR topology

### Infrastructure companion MR

Repository: `df-cloud-klickeruzh`

- Branch: `feat/klicker-structured-logging`
- Target: `stg`
- Title: `feat(logging): process Klicker structured logs in Alloy`
- Production follows the repository's normal `stg` to `prd` promotion.

### Klicker native GitHub stack

The stack is based on `v3`. Each PR targets the branch immediately below it and
is submitted as a draft.

| Layer | Branch                             | Title                                              | Incremental outcome                                                     |
| ----- | ---------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| 1     | `feat/logging-foundation`          | `feat(logging): add shared Pino foundation`        | Package, contract tests, configuration, docs, and general-worker canary |
| 2     | `feat/logging-hatchet-correlation` | `feat(logging): correlate Hatchet task logs`       | Optional async context and worker consumers                             |
| 3     | `feat/logging-core-apis`           | `feat(logging): instrument core API ingress`       | Response API, backend, GraphQL context, and correlation publishers      |
| 4     | `feat/logging-auth-integrations`   | `feat(logging): secure auth and integration logs`  | Auth/Edge, LTI, OLAT, and sensitive-log cleanup                         |
| 5     | `feat/logging-server-apps`         | `feat(logging): complete server-side app adoption` | Chat, remaining Next server surfaces, guardrails, and final docs        |

One repository-local worktree under `trees/` owns the complete stack. Native
`gh stack` support is verified before creating the stack. PRs are reviewed and
merged bottom-up only with explicit user approval. If implementation scope no
longer fits these five reviewable layers, newly discovered scope becomes a
follow-up stack rather than a sixth oversized layer.

Once the replacement foundation is visible, PRs #4918 and #4750 receive a
superseding link and are closed with user approval.

## Verification

### Automated

- Capture-destination unit tests for valid NDJSON, string levels, base fields,
  child bindings, `Error` serialization, redaction, and Node/Edge parity.
- Request helper tests for valid, missing, malformed, and oversized IDs.
- Adapter tests for response headers, parameterized routes, one completion
  record, status-based levels, and exclusion of bodies, headers, and queries.
- Async integration tests for optional correlation propagation and old payloads.
- Privacy tests using unique fake tokens, cookies, emails, and response content.
- Targeted package/app checks on every layer.
- At the stack tip: root type checks, tests, formatting, linting, static analysis,
  and production build.

### Browser

Because auth and frontend server code are touched, delegated-login browser smoke
tests run through devrouter. They verify redirects, cookies, manage, PWA,
control, and chat behavior even though there is no visible UI change. Evidence
is attached to the affected PRs.

### Staging and Loki

After the Alloy MR is deployed to staging:

1. Confirm existing non-JSON and third-party logs remain queryable.
2. Deploy the complete Klicker stack.
3. Execute a response through `response-api` and its Hatchet worker.
4. Find both records with the same `correlationId`.
5. Query every covered deployment by `service_name`, including assessment
   variants.
6. Verify level and event filtering.
7. Send only fake redaction canaries and prove none occur anywhere in Loki.
8. Check stream cardinality and log volume; request/correlation IDs must not be
   labels.

## Rollout and rollback

The Alloy MR reaches staging before the application stack's staging acceptance
test. It is backward compatible with non-JSON output. Application layers then
deploy bottom-up: consumers before correlation publishers, followed by the
remaining ingress apps.

Each application layer is independently revertible. Correlation fields are
additive, so old queued work remains valid. `LOG_LEVEL` can reduce volume without
a rebuild. If collector parsing is defective, the Alloy change can be reverted
without changing application output because the raw NDJSON line remains valid.

Production promotion follows the normal release paths only after staging
acceptance. The rollout monitors log volume, error rate, and Loki stream
cardinality before the ClickUp task is closed.

## Acceptance criteria

The milestone is complete when:

- every in-scope Node server runtime uses `@klicker-uzh/logging`;
- production output is valid NDJSON and development output is pretty;
- standard and assessment deployments have distinct service names;
- one operation is queryable across HTTP ingress and Hatchet execution by one
  correlation ID;
- Loki supports documented service, level, event, request, and correlation
  queries;
- no validation canary or prohibited sensitive field appears in Loki;
- non-JSON logs continue to work;
- remaining `console.*` calls are limited to documented browser, script,
  third-party, or Edge-adapter exceptions;
- browser smoke tests show no auth, cookie, or redirect regression;
- the ADR, wiki page, runbook/query examples, and change log are current; and
- the two superseded logging PRs are closed after approval.

## References

- [Pino 9.14 API](https://github.com/pinojs/pino/blob/v9.14.0/docs/api.md)
- [Pino 9.14 production and pretty-printing guidance](https://github.com/pinojs/pino/blob/v9.14.0/docs/pretty.md)
- [Published Pino versions](https://www.npmjs.com/package/pino?activeTab=versions)
- [Grafana Loki label guidance](https://grafana.com/docs/loki/latest/get-started/labels/bp-labels/)
- [Grafana Loki structured metadata](https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/)
- [Grafana Alloy `loki.process`](https://grafana.com/docs/alloy/latest/reference/components/loki/loki.process/)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
