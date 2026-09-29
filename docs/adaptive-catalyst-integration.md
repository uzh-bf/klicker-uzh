---
type: Integration Guide
title: Adaptive Catalyst Integration
description: Host-owned adaptive UI and persistence with an authenticated Catalyst calculation service.
---

# Adaptive Catalyst integration

Klicker owns adaptive authoring, UI, GraphQL orchestration, permissions, grading,
persistence and migration history. Catalyst owns the IRT engine and simulations.
The public application uses `@klicker-uzh/adaptive-client` to request numerical
calculations over authenticated HTTP. It must not import the private kernel or
require private repository credentials during installation or builds.

The service migration is still under verification. Do not treat the presence of
the client or a successful kernel test as evidence that the complete integration
is ready to deploy.

## Service boundary

The backend and relevant workers require `ADAPTIVE_ENGINE_URL` and
`ADAPTIVE_ENGINE_TOKEN`. The token is server-only and must have at least 32
characters. Configure matching credentials on Catalyst. Never expose either
through `NEXT_PUBLIC_*` variables. The service has no access to Klicker's database.

Klicker authorizes access and grades submitted answers before sending explicit
numeric snapshots: item parameters, competence identifiers, policy settings and
correctness evidence. Question content, solutions, participant identities and
calibration criterion labels are excluded. Responses are validated before use.
An unavailable or incompatible engine fails explicitly; there is no local
calculation fallback.

Decision, estimate, runtime-validation and batched posterior endpoints share
bounded requests and execution deadlines. Shadow comparison is deferred until
after the response transaction commits. Calibration batches use request-local
subject indices rather than retained subject pseudonyms.

## Host packages

`packages/adaptive-contract` contains public DTO types, configuration constants,
authoring helpers and display mappings. It contains no IRT likelihood,
estimation or item-selection implementation. `adaptive-server` provides host
orchestration and schema factories; `adaptive-persistence` supplies Prisma
fragments, migrations and synthetic seed support. The manage/PWA UI, translations
and browser scenarios live in their corresponding public `adaptive-*` packages.

Next transpiles the UI source packages. The GraphQL Rollup build bundles the
server source package. Host typechecking remains required independently of the
Rollup transform.

## Database composition

`packages/prisma/prisma.config.ts` composes host schema files with
`packages/adaptive-persistence` into an ignored sibling `.adaptive-schema`
directory. Composition does not access the database. The initial adaptive
bootstrap replaces local-only development history; no shared deployment had
applied it. Once deployed, migration names and SQL bytes must remain unchanged. Collisions and unknown generated migrations
fail instead of deleting files.

Promote newly generated host migrations into the host source migration directory
before recomposing. Adaptive migrations belong in the public persistence package.
The migration and analytics images copy these public fragments directly; neither
needs a private checkout.

## Verification boundaries

Private engine tests verify calculations. Public tests verify authorization,
persistence, transport, grading and presentation. HTTP contract fixtures verify
host behavior but cannot establish numerical estimator accuracy on their own.
Require both engine parity tests and real service integration checks.

Before merge, verify a clean public build without the private repository,
disposable-database migration rehearsal, failure behavior and authenticated
lecturer/student browser flows. Existing seeded demo or imported user data must
not be reset to perform these checks. The manual migration rehearsal now uses
public source only and needs no Catalyst repository token.

The student charts present equally sized categorical level bands. Estimates and
uncertainty endpoints are remapped consistently for display; numerical level
boundaries and classifications are unchanged. Equal visual spacing does not
claim equal distances on the underlying ability scale.

### CI seed profiles and engine-backed tests

The engine is private, so public pull-request CI runs without it. Tests that
reach it are gated on `ADAPTIVE_ENGINE_URL` and `ADAPTIVE_ENGINE_TOKEN`:

- GraphQL suites mark engine-dependent cases with `itWithAdaptiveEngine`
  (`packages/adaptive-server/test/adaptiveEngineTestEnv.ts`); they are reported
  as skipped, not passed, when the engine is absent. Transport and readiness
  tests that fake the engine keep running.
- `seed:test` seeds the adaptive quiz fixtures only when both variables are set
  and otherwise logs that it skipped them. `seed:test:core` always excludes them
  for unrelated service smoke tests such as lecturer MCP. Neither fabricates
  adaptive results.
- The adaptive Playwright specs in `packages/adaptive-e2e` skip unless the
  runner sees `ADAPTIVE_ENGINE_URL` (the same URL the backend under test uses).

Skipped PR runs are not integration coverage. Trusted `test-graphql` runs on
pushes to `v3*` branches check out `uzh-bf/klicker-uzh-catalyst` (ref from the
`CATALYST_REF` repository variable, default `main`) with the
`CATALYST_REPO_TOKEN` secret, start the engine with a per-run token, and run the
gated suites against it. Pull-request code never receives the Catalyst source
or that secret. An engine-backed Playwright run is not wired yet; the shard
action is pinned to `v3`.

### Deployment configuration

The chart can run the engine next to Klicker as a cluster-internal service:
`adaptiveEngine.enabled` renders a Deployment and ClusterIP Service on port
3017 from the private image `ghcr.io/uzh-bf/klicker-uzh-catalyst/adaptive-engine`,
pinned to the immutable `<catalyst-commit>-arm` tag in `adaptiveEngine.image.tag`.
Never expose it through an ingress: callers authenticate with a bearer token over
plain HTTP.

- The engine, the backend and the general Hatchet worker all read
  `ADAPTIVE_ENGINE_TOKEN` from the backend secret, so the token has one source.
  The worker's reference is optional; a missing key fails adaptive jobs, not the
  worker.
- The pod pulls with `<fullname>-registry-secret-adaptive-engine`, a
  `kubernetes.io/dockerconfigjson` Secret provisioned by df-cloud from the
  Infisical key `ADAPTIVE_ENGINE_DOCKER_AUTH` (a read-only GHCR credential).
- When the chart's engine is enabled, `ADAPTIVE_ENGINE_URL` defaults to its
  Service. Set `backendGraphql.adaptiveEngine.url` only for an engine hosted
  elsewhere; with neither, adaptive quizzes stay unconfigured and existing
  releases are unchanged.

Staging runs the chart's engine; production does not yet.
