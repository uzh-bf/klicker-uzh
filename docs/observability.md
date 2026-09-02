---
type: Observability Guide
title: Observability
description: The production JSON logging contract, privacy boundary, correlation model, and Loki query conventions.
timestamp: '2026-08-05'
tags:
  - logging
  - observability
  - backend
---

# Observability

**Loki's `service_name` is infrastructure-owned, not application-owned.** The
application emits a portable `service` field, while Grafana Alloy derives the
indexed `service_name` label from the Kubernetes
`app.kubernetes.io/component` pod label. Never turn request IDs, correlation
IDs, user input, or arbitrary JSON fields into Loki stream labels.

The architectural rationale is [ADR-0002](./adr/0002-standardize-server-logging-on-pino.md).
The initial canary is `apps/hatchet-worker-general/src/logger.ts:logger`; shared
contracts live in `packages/logging/src/node.ts:createLogger`,
`packages/logging/src/request.ts:resolveRequestContext`, and
`packages/logging/src/edge.ts:createEdgeLogger`.

## Record contract

Owned application records use these fields:

| Field               | Requirement | Meaning                                            |
| ------------------- | ----------- | -------------------------------------------------- |
| `time`              | required    | Unix milliseconds                                  |
| `level`             | required    | lowercase Pino level string                        |
| `service`           | required    | stable runtime component name                      |
| `event`             | required    | stable dot-separated event name                    |
| `msg`               | required    | short human-readable description                   |
| `requestId`         | optional    | one validated HTTP request                         |
| `correlationId`     | optional    | one operation across process boundaries            |
| `traceId`, `spanId` | optional    | existing real tracing identifiers only             |
| `http`              | optional    | method, parameterized route, status, duration only |
| `err`               | optional    | Pino-serialized application-owned error            |

Pino's default `pid` and `hostname` fields are omitted because Kubernetes owns
process placement metadata. Event names are stable query keys; `msg` may improve
without breaking queries.

## Output modes

- Production: newline-delimited JSON on stdout; no application sends directly to
  Loki.
- Development: pretty single-line output by default. Set `PINO_PRETTY=false` for
  raw JSON locally.
- Tests: silent by default. Contract tests inject a capture destination.
- `LOG_LEVEL` controls the threshold and defaults to `info` outside tests.

The package pins Pino 9.14.0 and constrains `pino-pretty` to `~13.1.3`. Pino 10
adoption is a separate dependency change.

## Correlation contract

Diagnostic IDs match `[A-Za-z0-9._-]{1,128}`. A missing or invalid request ID is
replaced with a UUID. A missing or invalid correlation ID defaults to that
request ID. HTTP responses echo `x-request-id`; internal publishers propagate
`x-request-id` and `x-correlation-id` where applicable.

Hatchet inputs use an additive optional envelope:

```ts
loggingContext?: {
  requestId?: string
  correlationId?: string
}
```

The envelope stays separate from business payloads. In particular, the
assessment response pipeline already has an MD5-derived business field named
`correlationId` for Redis deduplication. That existing field is not diagnostic
context and must never be bound to application log correlation.

Every wrapped Hatchet task emits `hatchet.task.started` and either
`hatchet.task.completed` or `hatchet.task.failed`. These records bind the task
name plus Hatchet workflow/task run IDs. Old queued inputs remain valid and do
not receive invented request or correlation identifiers.

Response-worker outcome events include `response.rejected`,
`response.authentication.rejected`, `response.block_closed`,
`response.processed`, `response.aggregation.completed`, and
`dependency.unavailable`. The assessment payload's business `correlationId`
and participant identifiers are deliberately excluded from diagnostic fields.

The response API binds this context to every accepted Hatchet response event.
The GraphQL backend binds it to HTTP and WebSocket contexts and passes the same
envelope to activity publication, completion, and aggregation jobs scheduled by
a request. Jobs started without a request omit the envelope.

## Owned HTTP boundaries

`response-api` and `backend-docker` each own one request-completion record. The
adapter accepts a parameterized route from the matched route branch; it never
derives a log field from the raw URL. It validates incoming diagnostic headers,
echoes `x-request-id`, suppresses health-probe completion records, and records
method, route, status, and duration only.

The GraphQL request child logger is exposed internally as `ctx.log` together
with `ctx.requestContext`. GraphQL Yoga's built-in logger is disabled to avoid a
second, unowned record. Service-level recovery signals use stable events; normal
validation failures remain return values and do not create log noise. Operator
scripts under `packages/graphql/src/scripts/` keep their terminal output.

Auth uses the same validated request context in both Next middleware and the
NextAuth Node handler. Middleware logs only categorical audience, redirect, and
cookie actions; NextAuth adds categorical sign-in, token, account, affiliation,
and invitation outcomes. Responses echo `x-request-id`. Profiles, identities,
URLs, referrers, query values, cookies, and raw provider errors are excluded.

LTI records verified launch acceptance, target rejection/selection, platform
registration, and lifecycle events without emitting the launch token, public
key, user information, or redirect target. OLAT owns Express request records for
an explicit route-template allowlist and suppresses `/health`; API keys,
provider/course identifiers, bodies, response data, and raw dependency errors
are excluded. Local configuration-file reads have separate
`dependency.read_failed` events while the HTTP boundary owns
`http.request.failed`.

Chat's Edge proxy propagates validated diagnostic IDs and records categorical
invalid-token outcomes; every Node API route uses a hard-coded parameterized
template. It owns one immediate HTTP completion record and separate once-only
stream outcome events. Prompts, messages, model output, model/deployment
identifiers, MCP server and tool names, upstream URLs, API keys, and provider
errors never become log fields. MCP and model milestones use counts and
categorical outcomes only.

Manage, PWA, assessment PWA, and control emit Node startup records. PWA
`getServerSideProps` failures use a request child with a parameterized page
route, and the same validated request/correlation context is propagated only to
the internal server-side GraphQL call. Browser-side GraphQL requests and
external providers do not receive these headers. Browser console behavior is
outside this server logging contract.

## Privacy boundary

Logging is allowlist-first. Do not log:

- authorization or cookie headers;
- access, refresh, ID, magic-link, LTI, API, or session tokens;
- passwords, secrets, connection strings, or encryption keys;
- raw request/response bodies or Hatchet payloads;
- Edu-ID or NextAuth profiles;
- participant answers or generated content;
- names, email addresses, matriculation identifiers, or IP addresses;
- raw URLs, query strings, or arbitrary client/error configuration.

Central Node redaction removes common credential, header, body, and payload
paths as defense in depth. It cannot make an interpolated string safe. The Edge
adapter copies only its explicit field allowlist and drops unknown fields.

Use `{ err }` for an application-owned `Error`. Log it once at the boundary that
owns the failure. When a third-party error can contain a URL, headers, request
configuration, or payload, log a new safe error rather than the original.

## Level policy

| Level   | Use                                                        |
| ------- | ---------------------------------------------------------- |
| `fatal` | process cannot safely continue                             |
| `error` | owned operation failed                                     |
| `warn`  | operation recovered with degradation or retry              |
| `info`  | lifecycle, request completion, meaningful milestone        |
| `debug` | local diagnostic detail, disabled in production by default |
| `trace` | highly detailed local diagnosis                            |

Expected client validation and authorization rejections are normally `info`, not
`error`. Health probes are suppressed at owned HTTP completion boundaries.

## Runtime service names

Service values match Kubernetes component names: `backend-graphql`,
`backend-assessment`, `response-api`, `response-api-assessment`,
`hatchet-worker-general`, `hatchet-worker-response-processor`,
`hatchet-worker-response-processor-assessment`, `auth`, `lti`, `olat-api`,
`chat`, `frontend-manage`, `frontend-pwa`, `frontend-assessment`, and
`frontend-control`.

## Loki queries

After the companion Alloy/Loki configuration is deployed, structured metadata
supports queries such as:

```logql
{service_name="response-api"} | correlation_id="logging-canary-20260805"
{service_name="backend-graphql"} | level="error"
```

The collector preserves the original JSON line and non-JSON third-party output.
It stores level, event, request, correlation, and trace/span identifiers as
structured metadata rather than indexed labels.

Application deployment does not depend on the companion cloud MRs: the existing
collector already forwards container stdout, so production NDJSON is available
immediately as raw Loki lines. The cloud changes add Kubernetes-derived
`service_name`, application timestamp parsing, and queryable structured
metadata; they do not establish or replace log transport.

## Server console guard

`pnpm run check:server-console` rejects active
`console.log/info/warn/error/debug` calls in the server-owned path allowlist. It
strips comments with a deterministic scanner and reports `path:line`. Shared
browser/server pages are deliberately excluded; operator scripts keep terminal
output. The sole sink exception is `packages/logging/src/edge.ts`, where the
Edge adapter serializes its already-allowlisted record to the runtime console.

Add a new server-owned path to the guard when it adopts the shared logger. Do
not add file exceptions for migrations; convert the call or keep truly
interactive output under an operator `scripts/` directory.

## Staging acceptance and rollback

After both application and cloud changes reach staging:

1. query every standard and assessment component by `service_name`;
2. locate `logging-canary-20260805` across response API, GraphQL, and Hatchet
   records using `correlation_id`;
3. confirm `level` and `event` filtering without adding them as stream labels;
4. verify existing non-JSON/third-party lines remain present and unchanged;
5. send fake token, cookie, email, body, and URL canaries through test paths and
   prove none appear in Loki;
6. inspect stream cardinality and volume, confirming diagnostic IDs are
   structured metadata rather than labels.

Application rollback is an ordinary image rollback. Collector enrichment rolls
back by reverting the `df-cloud-klickeruzh` submodule-pointer commit; raw NDJSON
continues through the existing transport in either case.
