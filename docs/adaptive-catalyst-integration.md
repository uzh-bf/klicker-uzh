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

### Classification tolerance (engine contract)

Catalyst V1 routing `SEQUENTIAL_ROOTS_V6` adds an optional IRT_V1 request
setting `settings.classificationToleranceBands`, an integer from 0 to 5. A node
is classified when θ ± z·SE lies within bands k−t … k+t around the band k that
contains θ, clipped at both ends of the scale. The reported level stays k. The
rule applies to root stopping, leaf classification and engine `CLASSIFIED`.
When the setting is 0 or absent, the engine uses the exact rule. IRT v2
requests that carry the setting are rejected, and engines older than V6 reject
it as invalid. V6 also carries a routing prior across roots, which needs no
host change.

`PracticeQuizAdaptiveConfig.classificationToleranceBands` stores the setting.
It defaults to 0 and has a CHECK for 0–5. The authoring UI ("classification
precision") offers exact, ±1 and ±2. New and existing quizzes both default to
exact, because a tolerance requires the upgraded engine. For scales with ten
or more levels the UI recommends ±1. With t = 1, about 80% of root estimates
classify within ±1 sublevel on a 16-level scale. With t = 2, more than 99%
classify, but the stated band then covers roughly a whole main level.

- **Configuration.** Values must be whole numbers from 0 to 5, and only IRT_V1
  configurations may use a value above 0
  (`ADAPTIVE_CLASSIFICATION_TOLERANCE_INVALID` / `_UNSUPPORTED`).
- **Publication.** An IRT_V1 publication freezes the value in
  `evidenceMinimumSnapshot.classificationToleranceBands`. Older publications
  don't have the key, so they read as 0. IRT_V1 has no separate config
  fingerprint, so the immutable publication snapshot is what pins this
  stopping input.
- **Engine requests.** The value is sent only when it is above 0
  (`v1EngineSettings`). Exact-rule quizzes therefore keep the request shape of
  older engines.
- **Publication guard.** Publishing a quiz with t > 0 first validates a
  synthetic snapshot against the engine, once without the setting and once
  with it. An engine that rejects only the setting fails with
  `ADAPTIVE_CLASSIFICATION_TOLERANCE_UNSUPPORTED` and a clear message.
- **Host rules.** The readiness band planning count, host root classification,
  cohort "level determined" counts and the student result all use the same
  rule, `intervalWithinToleranceBands` in `adaptive-contract`. The student
  result and the cohort also share one determination
  (`adaptivePracticeQuizLevelDetermination.ts`). A student therefore sees a
  determined level only when the lecturer cohort would count it, not whenever a
  level id exists. Classified levels under t > 0 read "B1.2 (±1 level)".
- **Readiness advisory.** When no band of a root is classifiable at t = 0,
  readiness adds the advisory warning
  `ADAPTIVE_CLASSIFICATION_TOLERANCE_SUGGESTED` (IRT_V1 only).

Results also mark the edges of the measurable range. When the bands below the
lowest band with published elements (or above the highest) have no elements, an
estimate at or beyond that band reads "A2.1 or below (below the measurable
range)", not the name of an unmeasured band.

**Deploy order:** merge and deploy the host change that accepts
`coverageStatus` before bumping the engine image tag to a
`SEQUENTIAL_ROOTS_V5`/`V6` build. Otherwise the strict host schema rejects
every IRT_V1 decision, and adaptive quizzes fail with
`ADAPTIVE_ENGINE_UNAVAILABLE`. Don't publish a quiz with a classification
tolerance above 0 until the engine runs `SEQUENTIAL_ROOTS_V6`. The publication
guard refuses it before then.

### Retake context (engine contract)

Catalyst V1 routing `SEQUENTIAL_ROOTS_V7` adds an optional IRT_V1 decision
field `retake` with `startingEstimates` (`{ nodeId, theta }` per root) and
`seenPoolItemIds`. A root with a starting estimate routes from
N(previous θ, 1) instead of N(0, 1) or the V6 carried prior. Inside the chosen
leaf, an unseen item within one level of the routing level is preferred, and a
seen item is served only when no such item is left. Root and leaf choice, range
exclusion and the reported estimates are unchanged. Engines older than V7 and
IRT v2 requests reject the field.

- **Configuration.** `PracticeQuizAdaptiveConfig.retakeStartFromPreviousResult`
  (default on), `retakeStartMaxAgeDays` (default 30, CHECK 1–365) and
  `retakePreferNewQuestions` (default on). The authoring UI shows them next to
  "Retake after (days)" for presets that allow retakes.
- **Publication.** An IRT_V1 publication freezes the three values; they are
  off when only the first attempt counts (`FIRST_COMPLETED`). Publications
  created before the columns existed default to off, so their attempts keep
  the earlier behaviour. IRT v2 keeps them off and uses its own
  `priorAttemptPoolItemIds` preference.
- **Attempt snapshot.** `loadAdaptiveRetakeContext` builds the context when an
  attempt starts (start, retake or start over). It uses the per-competence θ
  of the latest completed attempt on the quiz when that attempt completed
  within the age limit, and the current pool items whose assignment and
  element the learner answered in any earlier attempt, in any publication and
  any element version. The context is stored as
  `AdaptivePracticeQuizAttempt.retakeContext` and sent unchanged with every
  decision of that attempt (start, advance, time-limit completion, estimate
  backfill), so replay stays deterministic. A first attempt stores null and
  sends no field.
- **Publication guard.** Publishing a quiz with either setting on (and
  retakes allowed) first decides a synthetic snapshot without and then with a
  retake context. An engine that rejects only the context fails with
  `ADAPTIVE_RETAKE_CONTEXT_UNSUPPORTED`.

**Deploy order:** deploy the `SEQUENTIAL_ROOTS_V7` engine image before the
host change. New quizzes default to the retake settings, so with an older
engine the publication guard refuses to publish them until the settings are
turned off.

## Attempt concurrency

Participant attempt commands (start, resume, restart, submit, abandon and
time-limit expiry) run at READ COMMITTED in `withAdaptiveAttemptTransaction`,
not SERIALIZABLE. Under SSI, predicate locks on the shared attempt, response
and estimate tables are page- or relation-granular, so attempts of different
participants aborted each other with SQLSTATE 40001 when a class worked on one
quiz together. Correctness instead comes from one lock order: course, quiz and
config `FOR SHARE`, then a per-participant-and-quiz transaction advisory lock,
then the attempt `FOR UPDATE`, then (IRT v2 only) the publication exposure rows
`FOR UPDATE`. The one-in-progress and response-order unique indexes are the
backstop. The advisory lock serializes one participant's commands on one quiz,
so double submits and duplicate starts stay safe. IRT v2 selections of one
publication queue on the exposure lock to keep the exposure ceiling exact.
Read-mostly snapshots such as cohort results keep `withSerializableRetry`.
New attempt writers must take the same locks in that order.

Each start and submit calls the engine inside that transaction, so engine
capacity bounds a class burst. One engine pod computes at most four requests
at once and answers 503 beyond that; the limit is hard-coded in the Catalyst
runner, not an environment knob, so capacity scales with
`adaptiveEngine.replicaCount` (two on staging). The host adds three measures:

- `prepareLoadedAdaptiveEstimator` validates a published bank once per API
  process (`adaptiveEngineValidationCache.ts`). The key is the engine URL, the
  engine build (`ADAPTIVE_ENGINE_REVISION`, set by the chart from the engine
  image tag), the publication id and a SHA-256 of the exact validation request,
  so republishes and engine upgrades revalidate. Successes are kept for at most
  10 minutes in a 256-entry LRU, failures are never cached, and concurrent cold
  callers share one request.
- `@klicker-uzh/adaptive-client` retries 503/429 answers and refused
  connections with equal-jitter backoff: four requests and at most 1.5 s of
  backoff, within the call deadline. Deadline aborts and other 4xx answers are
  not retried. The retries run while the attempt transaction holds its locks,
  which adds at most 1.5 s. The locks involved are the participant's own
  advisory and attempt locks, the shared course, quiz and config `FOR SHARE`
  locks (which only delay admin writers), and, for IRT v2, the publication
  exposure rows.
- Sustained overload surfaces as `ADAPTIVE_ENGINE_BUSY`, and other engine
  failures as `ADAPTIVE_ENGINE_UNAVAILABLE`, including from validation. The PWA
  then shows a "quiz is busy" message with a retry button instead of a
  generic error.

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
