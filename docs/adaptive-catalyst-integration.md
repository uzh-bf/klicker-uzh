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

### CI seed profiles

`seed:test` keeps the complete adaptive fixtures and requires a real configured
engine. `seed:test:core` explicitly excludes adaptive quiz fixtures for unrelated
service smoke tests such as lecturer MCP; it does not fabricate adaptive results.
GraphQL adaptive integration tests continue to fail if their engine is unavailable.
They must run against a provisioned service; public transport fixture tests alone
are not a substitute for this integration coverage.
