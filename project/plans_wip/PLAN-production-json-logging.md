# Production JSON logging

## Goal

Standardize every in-scope Klicker TypeScript/JavaScript server runtime on
production-safe Pino NDJSON, propagate request and correlation identifiers
through HTTP and Hatchet boundaries, and make the resulting records efficiently
queryable in Loki.

The approved design is
[`project/2026-08-05-production-json-logging-design.md`](../2026-08-05-production-json-logging-design.md).
Implementation is split into two independently deployable plans:

- [`project/2026-08-05-production-json-logging.md`](../2026-08-05-production-json-logging.md)
  owns the five-layer native GitHub stack in `klicker-uzh`.
- [`project/2026-08-05-production-json-logging-infrastructure.md`](../2026-08-05-production-json-logging-infrastructure.md)
  owns linked GitLab MRs in the `azure-helpers` submodule and its
  `df-cloud-klickeruzh` parent.

## Non-goals

- Full OpenTelemetry tracing or generated spans.
- Browser log ingestion or replacement of browser consoles.
- Sentry replacement or exception-alerting strategy.
- Request bodies, response bodies, answers, profiles, tokens, cookies, emails,
  or raw URLs in logs.
- Python analytics, Office Add-in, or static docs logging.
- Prisma, public GraphQL schema/codegen, auth permission, gamification, i18n,
  or seed changes.
- Loki storage, retention, capacity, authentication, or schema migration.

## Feature-design answers

### Domain vocabulary

This is an observability change, not a domain-model change. The relevant
operation boundaries are HTTP requests, GraphQL requests, Hatchet workflow/task
runs, and the existing standard versus assessment runtime variants.

### Layer footprint

- New `packages/logging` package.
- `packages/types` and `packages/hatchet` for additive optional Hatchet
  correlation.
- Both Hatchet workers, `response-api`, `backend-docker`, internal GraphQL
  context, auth, LTI, OLAT, chat, and server-only paths in manage/PWA/control.
- Root environment/build configuration and lockfile.
- Helm only if implementation discovers a runtime whose existing
  `app.kubernetes.io/component` or `ASSESSMENT_MODE` cannot provide the approved
  service name. No Helm change is currently expected.
- ADR, observability wiki/runbook, and wiki log.
- Alloy/Loki Pulumi helpers and a config regression test in the
  `azure-helpers` submodule, followed by its pointer update in the cloud parent.

### Auth

No authentication or authorization behavior changes. Diagnostic IDs are
untrusted metadata and may never influence an auth, deduplication, or business
decision. Auth logs record allowlisted outcomes only, never identity profiles,
tokens, cookies, email addresses, callback URLs, or query strings.

### Gamification

No points, XP, leaderboard, or grading behavior changes.

### Async impact

Existing Hatchet inputs gain an optional
`loggingContext: { requestId?: string; correlationId?: string }`. The envelope
does not collide with the assessment response's existing business/deduplication
field named `correlationId`. Consumers ship before publishers so already queued
payloads remain valid. Task logs bind Hatchet workflow/task run IDs, and do not
invent a diagnostic correlation ID when an old payload has no logging context.

### UI surface and i18n

There is no visible UI or copy change and no i18n work. Because auth redirects,
cookies, chat route handlers, and PWA server-side rendering are touched, browser
smoke verification is required even though screenshots should show no visual
difference.

### Test level and evidence

- Unit: record contract, levels, redaction, request ID validation, Edge parity,
  request adapters, Hatchet wrapper, and cloud Alloy config.
- Package/app: targeted tests, checks, lint, and builds at each layer.
- Stack tip: root `check:all`, `test:run`, build, and `opengrep scan --config
  auto`.
- Browser: delegated login plus manage, PWA, control, chat, redirects, and
  cookies through devrouter.
- Staging: cross-service correlation query, assessment service names, non-JSON
  preservation, fake privacy canaries, stream cardinality, and log volume.

### Seeds and fixtures

No seed or fixture changes. Existing local delegated-login credentials and
already seeded response flows are sufficient.

## Work packages and stack boundaries

| Order | Branch | Reviewable outcome |
| ---: | --- | --- |
| 1 | `feat/logging-foundation` | Shared package, contract tests, root configuration, docs, general-worker canary |
| 2 | `feat/logging-hatchet-correlation` | Optional correlation contract and both worker consumers |
| 3 | `feat/logging-core-apis` | Response API, backend/GraphQL request context, and correlation publishers |
| 4 | `feat/logging-auth-integrations` | Auth Node/Edge, LTI, OLAT, and sensitive-log removal |
| 5 | `feat/logging-server-apps` | Chat and remaining Next server adoption, guardrail, final verification/docs |

The cloud change is a cross-repository dependency chain, not a sixth layer in
the GitHub stack: an `azure-helpers` MR targets `infra-2025`, then a
`df-cloud-klickeruzh` MR advances that helper commit and targets `stg`.

## Worktree ownership

At implementation start, the complete GitHub stack moves into
`trees/logging-stack` in this repository. The external Codex worktree currently
owns `feat/logging-foundation`; the execution preflight detaches it only after a
clean status check, then checks that branch out in the repository-local stack
worktree. Record the final worktree audit in this file before publishing.

The cloud parent uses its own repository-local worktree at
`trees/klicker-structured-logging`. Inside it, initialize the `azure-helpers`
submodule and create the helper branch from `infra-2025`; never edit the source
checkout's unrelated untracked files.

## Progress

- 2026-08-05: ClickUp task, old PRs, current runtimes, Helm labels, and Grafana
  collector configuration investigated.
- 2026-08-05: Architecture, privacy contract, runtime scope, five-layer GitHub
  stack, and companion cloud delivery approved.
- 2026-08-05: Written design committed as `bb0931e89`.
- 2026-08-05: Corrected collector ownership: `service_name` comes from
  `app.kubernetes.io/component`; JSON `service` remains an application field.
- 2026-08-05: Namespaced Hatchet diagnostic IDs under optional
  `loggingContext` because assessment already owns `correlationId` as a Redis
  deduplication key.
- 2026-08-05: Split infrastructure delivery into linked helper and parent MRs
  because `azure-helpers` is a Git submodule with default branch `infra-2025`.
- 2026-08-05: Detailed implementation plans written; implementation has not
  started.
- 2026-08-05: Plans self-reviewed against exact repository paths, current package
  contracts, and official Grafana Alloy/Loki behavior; formatting and diff checks
  pass.
- 2026-08-05: Moved the design and detailed execution plans from the engineering
  wiki tree into the repository's canonical `project/` planning area before
  implementation.
- 2026-08-05: The wiki skill's documented external OKF validator was unavailable
  locally; repository formatting, AGENTS, link-reference, and diff checks are the
  verification fallback for this move.
- 2026-08-05: Created `trees/logging-stack`, initialized the five native GitHub
  stack branches against `v3`, and checked out `feat/logging-foundation` for
  layer-one implementation.
- 2026-08-05: Implemented the shared request, Node/Pino, and Edge logging seams
  test-first; the general Hatchet worker is the first application canary.
- 2026-08-05: Layer 1 committed as `0e623fbe6` after 15 logging tests, focused
  package and worker typechecks/builds, repository-wide `check:all`, the full
  23-target production build, production NDJSON and development-pretty smoke
  tests, and an OpenGrep scan with zero findings. Local Gitleaks remains
  unavailable; CI will enforce the secret scan.
- 2026-08-05: Layer 2 implements optional Hatchet diagnostic context, validated
  task-boundary records, general-worker handler wrapping, and standard versus
  assessment response-worker roots. Sensitive SDK/console diagnostics in the
  response processors were replaced with stable allowlisted application
  events.
- 2026-08-05: Layer 2 committed as `792a26727` after five wrapper tests,
  package/app checks and builds, repository-wide `check:all`, standard and
  assessment production-service smoke records, a source privacy guard, and an
  OpenGrep scan with zero findings.
- 2026-08-05: Layer 3 implements safe request ownership for standard and
  assessment response/backend APIs, HTTP and WebSocket GraphQL context,
  request-to-Hatchet correlation, stable service events, and a semantic cleanup
  of every production GraphQL `console.*` call. Adapter tests, focused checks,
  all three production builds, and repository-wide `check:all` pass. The raw
  GraphQL suite requires its database-backed environment; its host run reached
  4 passing files before 23 database suites failed with sandbox `EPERM`.
- 2026-08-05: The layer-three diff-aware OpenGrep scan reported zero new
  findings. A devrouter retry was attempted for the database suites but the
  fresh container build stopped when Docker's credential helper canceled the
  GHCR request. Core API code was committed as `1c16d74d6`; local Gitleaks is
  unavailable and remains CI-enforced.
- 2026-08-05: Layer 4 replaces sensitive auth Node/Edge diagnostics with
  request-scoped categorical outcomes, adds stable LTI lifecycle events, and
  gives OLAT fixed-template Express request ownership plus safe dependency
  errors. Auth, LTI, and OLAT checks/builds, two OLAT privacy tests,
  repository-wide `check:all`, source guards, and targeted OpenGrep passed; code
  was committed as `46a139e1a`.
- 2026-08-05: Browser smoke remains blocked before container startup by the
  Docker credential helper canceling the GHCR base-image request. The legacy
  OLAT container harness also failed before its test phase while rebuilding the
  unrelated shared `util` package for Linux; its focused socket-free adapter
  tests pass on the restored host toolchain.
- 2026-08-05: Layer 5 wraps every Chat Node API route with fixed-template
  request ownership, removes the previous prompt/tool/provider diagnostic dump,
  adds safe stream and MCP milestones, and verifies 45 Chat tests plus the
  production build. Chat was committed as `c3f76b7b3`.
- 2026-08-05: Manage, standard/assessment PWA, and Control now have Node startup
  roots. PWA SSR failures use safe request children and propagate diagnostic
  headers only to internal GraphQL. The deterministic server-console guard is
  part of `check:all`; all three production builds and compiled NDJSON service
  smoke checks passed. This slice was committed as `5aa3d63b0`.
- 2026-08-05: The linked cloud helper worktree is
  `/Users/paldov/Documents/df-cloud-klickeruzh/trees/klicker-structured-logging`
  on parent/helper branch `feat/klicker-structured-logging`. Alloy and Loki
  helper commits `0b04794` and `1bb9fa4` pass the full Node 20/pnpm 9 build, all
  six Node tests, formatting, targeted OpenGrep, and strict maintainability
  review. Draft helper MR [!23](https://gitlab.uzh.ch/uzh-bf/cloud/azure-helpers/-/merge_requests/23)
  targets `infra-2025`; it remains unmerged pending explicit approval, so the
  parent gitlink MR has not been created.
