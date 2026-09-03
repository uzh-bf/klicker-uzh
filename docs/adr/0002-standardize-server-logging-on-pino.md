# 2. Standardize server logging on Pino

- **Status:** Accepted — 2026-08-05
- **Context:** ClickUp task `86c5ajadd`; supersedes the approaches explored in
  GitHub PRs #4750 and #4918

## Context

Klicker server runtimes used a mixture of `console.*`, application-local Pino
configuration, and Hatchet SDK logging. Production records were inconsistent,
often difficult to correlate, and some call sites included request payloads,
identity data, cookies, or raw third-party errors. Kubernetes already transports
container stdout to Loki, so the missing boundary is a safe application record
contract rather than another log transport.

## Decision

Use a thin server-only `@klicker-uzh/logging` package. Node runtimes use Pino
9.14.0; Edge middleware uses a dependency-free serializer with the same record
shape. Production writes newline-delimited JSON to stdout, development may use
`pino-pretty`, and tests are silent unless they explicitly capture output.

Request and correlation context is passed explicitly through request adapters,
GraphQL context, and an additive Hatchet `loggingContext` envelope. We do not use
`AsyncLocalStorage`. Applications retain ownership of framework adapters,
lifecycle handlers, and process shutdown. The shared package owns only the
record contract, diagnostic-ID validation, safe defaults, and defense-in-depth
redaction.

Grafana Alloy derives `service_name` from the trusted Kubernetes
`app.kubernetes.io/component` label. It does not promote the application JSON
`service` field into an indexed label. Request, correlation, event, level, and
real trace/span identifiers become Loki structured metadata rather than stream
labels.

## Considered options

**Direct Loki transport from each app.** Rejected because stdout is already the
reliable Kubernetes transport. Application-owned network transports add failure,
buffering, retry, and credential ownership to every process.

**A custom logging framework.** Rejected in favor of a deliberately thin Pino
configuration package. Framework-specific request handling remains local to the
app so the shared module stays small and testable.

**`AsyncLocalStorage` for implicit context.** Rejected because Klicker crosses
HTTP, GraphQL, Edge, WebSocket, and Hatchet process boundaries. Explicit context
makes propagation visible and keeps queued-message compatibility testable.

**Full OpenTelemetry tracing.** Deferred. Existing real trace/span identifiers
may be carried, but this decision does not create spans or replace exception
tracking.

## Consequences

- Every owned production event has stable `service`, `event`, `level`, `time`,
  and `msg` fields.
- Privacy is allowlist-first at call sites; central redaction is only a backstop.
- Errors are logged once at their owning boundary as `{ err }`. Unsafe
  third-party failures are normalized to application-owned errors first.
- Diagnostic IDs are untrusted metadata and never influence authorization,
  deduplication, or business behavior.
- Browser logs, Python analytics, the Office Add-in, and static documentation are
  outside this decision.
