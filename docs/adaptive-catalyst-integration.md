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

## Diagnostic subcompetence sampling

IRT_V1 Diagnostic quizzes may publish with a total question cap below the
all-leaf minimum evidence (`enabled leaves × minQuestionsPerLeaf`). Readiness
then reports one `ADAPTIVE_SUBCOMPETENCE_SAMPLING` warning per sampled root
instead of the blocking minimum-evidence errors: each root keeps its
weight-based share of the cap, and each attempt covers as many leaf blocks
of `minQuestionsPerLeaf` as that share allows. It remains blocking
(`ADAPTIVE_SUBCOMPETENCE_SAMPLING_UNREACHABLE`) when a root cannot receive one
block. Research, Placement and IRT v2 readiness are unchanged.

This relies on Catalyst V1 routing `SEQUENTIAL_ROOTS_V3`, which reserves the
per-root shares and serves a per-attempt subset of leaf blocks. An engine
without it serves roots in tree order, so later roots can receive no questions.

Host breadth checks (root classification finalization and cohort "level
determined" counts) mirror only the engine's activation rule: sampling is
active when the summed `min(minQuestionsPerLeaf, eligible items)` over enabled
leaves exceeds the total cap. Under sampling, the sampled leaves are the
leaves that received responses, and each of them needs its minimum; an
engine-classified root is kept. Without sampling, every leaf still needs
`minQuestionsPerLeaf`. The share algorithm itself is not re-implemented on the
host (`adaptivePracticeQuizSamplingCoverage.ts`). Leaves without responses
in an attempt are "not tested": the student profile labels them so, and cohort
distributions count them in `notTestedCount`, never as level estimates.

### Leaf coverage status (engine contract)

Catalyst V1 routing `SEQUENTIAL_ROOTS_V5` adds `coverageStatus` to every
IRT_V1 `/adaptive/v1/decide` node estimate. Subcompetence (leaf) nodes carry
one of the following values; all other nodes, including the overall estimate,
carry `null`:

- `COVERED`: the leaf has at least `minQuestionsPerLeaf` answers.
- `OUT_OF_RANGE`: the leaf is excluded because none of its eligible items has
  a difficulty within the root's θ ± 1.96·SE. The engine reports this only
  after four or more root answers, and the status can change in later
  decisions.
- `SAMPLED_PENDING`: the leaf is required but still below its minimum.
- `NOT_SAMPLED`: subcompetence sampling did not choose the leaf.

The engine classifies a root (`CLASSIFIED`) when none of its leaves is
`SAMPLED_PENDING` and its interval lies within a single band. Each status
describes the decision it was returned with. IRT v2 and `/adaptive/v1/estimates`
do not carry the field.

The host client (`packages/adaptive-client/src/response.ts`) uses strict
schemas. It accepts the field as optional and nullable on IRT_V1 decision
estimates only, and rejects unknown values and non-null values on
non-subcompetence nodes. When an older engine omits the field, it parses as
`undefined`.

The host stores the status of the decision it persists in
`AdaptivePracticeQuizEstimate.coverageStatus`, a nullable
`AdaptiveLeafCoverageStatus` column. The CHECK `apqe_coverage_status_leaf_check`
allows a value on subcompetence rows only. Non-terminal steps update only the
nodes on the answered item's path. The terminal decision writes every node, so
the statuses of a completed attempt come from its final decision. Older
attempts and engines leave the column `NULL`.

Host breadth checks (`resolveAdaptiveV1EngineLeafBreadth`) use the status
whenever every relevant leaf has one. A leaf is required if and only if it is
`COVERED` or `SAMPLED_PENDING`. Breadth holds when at least one leaf is
required and none of the required leaves is `SAMPLED_PENDING`. An
engine-`CLASSIFIED` root is trusted. When any relevant leaf has no status, the
response-count rules above apply unchanged. The student profile labels an
unanswered `OUT_OF_RANGE` leaf "Not tested — outside your level range"; other
unanswered leaves keep "Not tested". Cohort distributions report
`outOfRangeCount` as a subset of `notTestedCount`.

**Deploy order:** merge and deploy the host change that accepts
`coverageStatus` before bumping the engine image tag to a `SEQUENTIAL_ROOTS_V5`
build. Otherwise the strict host schema rejects every IRT_V1 decision, and
adaptive quizzes fail with `ADAPTIVE_ENGINE_UNAVAILABLE`.

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
