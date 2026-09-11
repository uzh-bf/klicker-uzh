---
type: Architecture
title: Assessment Audit Evidence
description: Assessment evidence contract, PostgreSQL outbox, append-only Azure delivery, verification, and operator export.
timestamp: '2026-08-12'
tags:
  - audit
  - assessment
  - backend
  - prisma
---

# Assessment Audit Evidence

The assessment audit system records durable evidence about assessment state
changes and submission processing. Its binding product and operational decisions
live in the [approved design](../project/2026-08-04-assessment-audit-logging-design.md),
and the delivery order lives in the
[Stack 1 implementation plan](../project/2026-08-10-assessment-audit-stack-1-implementation-plan.md).

## Current implementation boundary

`@klicker-uzh/audit` now contains the Layer 1 contract, Layer 2 evidence-store
path, and Layer 3 baseline/media primitives. It validates and canonicalizes
envelopes, persists exact bytes in a transactional PostgreSQL outbox, dispatches
leased rows through a provider-neutral append-sink, and implements Azure Table,
immutable-media, owner-CLI, and media-policy adapters. GraphQL owns assessment
snapshot mapping, two-phase activation, rollout accounting, automatic
`all`-mode creation coverage, atomic reopening, and start-time readiness. The
dedicated deployments remain dormant by default until their Pulumi-provisioned
staging identities and endpoints are supplied. Lecturer/system producers and
Hatchet submission materialization arrive in Layers 4 and 5; the manifest
sealer and retention worker remain fast-follow work.

The older Hatchet `create-audit-log-entry` workflow and `AuditLog` model remain
unchanged. They are not the new evidence store and must not be presented as
providing the guarantees described here.

## Data flow

```text
authoritative mutation ─┐
                       ├─ same Prisma transaction ─ emitAuditEvents
Hatchet materializer ──┘                              │
                                                     ▼
                                  AssessmentAuditOutboxEvent
                                  (exact canonical JSON text)
                                                     │
                                           lease-based claim
                                                     │
                              dispatcher + append-sink adapter
                                                     │
                                                     ▼
                             Azure Table append-only evidence

assessment snapshot → stream/lock owned media → verify snapshot again
                                                │
                                                └─ scope + root/parts + outbox
                                                   in one Prisma transaction
```

The transactional lane uses `runInAuditTransaction`, which owns the Prisma
transaction callback and supplies an opaque audit capability beside the normal
transaction client. `emitAuditEvents` accepts only that capability; passing the
full Prisma client is rejected both by TypeScript and at runtime. The capability
cannot be created by callers. `recordStandaloneAuditEvents` is restricted to
standard, server-observed facts that have no business mutation to commit with;
critical or authoritative evidence must share the business transaction.

Hatchet submission materialization remains a separate emission lane, but it
ultimately writes the same event contract and outbox. The browser-observed
Stack 2 lane uses the same registry later through the independent audit ingress.

## Contract and identity

`packages/audit/src/contract/event-registry.ts:EVENT_REGISTRY` is the single
registry for stable event names and their delivery tier, emission path, evidence
class, criticality, allowed recorder, producer owner, durability point, and
runtime payload schema. Delivery tiers are `LAUNCH`, `FAST_FOLLOW`, and
`STACK_2`; Layer 1 constructors admit only launch events. Callers cannot enable
deferred tiers. A later stack layer must deliberately add its trusted producer
path before those events can be constructed.

`createCanonicalAuditEvent` derives registry-owned metadata, including the
payload schema version, instead of trusting the producer to supply it. Every
event uses an explicit, normalized payload allowlist; raw Prisma records and
arbitrary JSON blobs are not contract values. Strict Zod schemas reject unknown
fields, and a second guard rejects secret-bearing names and values such as
tokens, cookies, authorization headers, passwords, private keys, and SAS query
strings. Participant evidence retains the stable participant UUID; it does not
copy participant profile data into the evidence contract.

Payload schemas are retained and dispatched by `(eventType,
payloadSchemaVersion)`, so a future schema version can be added without making
retained version-1 evidence unverifiable. Entity events also fail closed when
their canonical scope, target ID, or before/after snapshot identities disagree.
Course changes use the assigned or removed course as their required canonical
course scope; block and ElementInstance events require their applicable block,
instance, and source-element scope dimensions.

The allowlists use Klicker's real assessment identifiers and values: blocks,
ElementInstances, and LiveQuiz responses use integer IDs; assessment, course,
participant, user, baseline, and submission identities use UUIDs. Effective
element content and scoring are explicit per element type, including selection
collections and case-study structure. Media evidence accepts only query-free
HTTPS source references and content-addressed immutable blob names, and its
stable MediaFile UUID must agree with the affected entity ID. Client events
reserve both occurrence and seven-day replay-expiry timestamps, although their
Stack 2 constructors remain disabled in this layer.

Canonicalization follows RFC 8785/JCS through the pinned `canonicalize` package.
Dates are normalized to millisecond UTC strings, selected answer option IDs are
sorted and deduplicated, and non-JSON or non-finite values fail closed. The
outbox stores canonical JSON as PostgreSQL `TEXT`, not `JSONB`, because JSONB
may rewrite the byte representation.

The stable idempotency tuple is:

```text
["klicker-assessment-audit", 1, eventType, liveQuizId,
 lifecycleEpoch, producerOperationId]
```

Its SHA-256 digest is the idempotency key, and UUIDv5 over the same tuple is the
event ID. Repeating the same operation with exactly the same canonical bytes is
idempotent; reusing an identity with different evidence is a conflict and rolls
back the transaction.

Evidence classes are deliberately different claims:

- `AUTHORITATIVE`: committed Klicker business state.
- `SERVER_OBSERVED`: what Klicker or Hatchet observed at a server boundary.
- `CLIENT_OBSERVED`: what the assessment client later reports through Stack 2.
- `ADMINISTRATIVE`: evidence-owner actions such as holds and annotations.

None of these classes proves a person's unobservable intent.

## PostgreSQL foundation

`packages/prisma/src/prisma/schema/assessmentAudit.prisma` owns three models:

- `AssessmentAuditScope` records sticky coverage, baseline identity, lifecycle
  epoch, and the completion/cancellation/deletion retention anchor.
- `AssessmentAuditRolloutInventory` accounts durably for every LiveQuiz seen by
  a rollout scan, including terminal exclusions and stable failure reasons.
- `AssessmentAuditOutboxEvent` stores the exact canonical envelope, hashes,
  query dimensions, delivery state, retry count, and lease metadata.

The models intentionally contain scalar UUIDs and no Prisma relations or
foreign keys to `LiveQuiz`, `Course`, `User`, or `Participant`. Evidence and
rollout accounting therefore survive deletion of mutable business data.
Database checks protect coverage/baseline consistency, retention anchors,
canonical byte length, lowercase hashes, timestamps, retry counts, and every
valid outbox delivery-state shape.

## Assessment activation and rollout

Audit coverage is sticky per `(liveQuizId, lifecycleEpoch)`. Activation first
loads and canonicalizes an explicit assessment snapshot, discovers and streams
its owned media into immutable content-addressed blobs, and then opens a second
database transaction. That transaction reloads the snapshot, rejects any
concurrent change, and atomically writes the scope, baseline root and parts,
activation event, and rollout-inventory outcome. Exact retries are idempotent;
different evidence for an already activated scope fails closed.

The baseline includes effective quiz configuration, ordered blocks and element
instances, effective element content and scoring, active participant UUIDs,
effective permissions, immutable media references, and explicit limitations. It
does not copy participant profiles, PINs, or other authentication material.
Baseline parts are independently hashed, and the root commits to each part key
and full canonical-part hash. Snapshot comparison uses that incremental root
aggregate rather than canonicalizing the complete assessment as one object.

Rollout modes are `disabled`, `pilot`, and `all`. Pilot mode requires one
configured LiveQuiz UUID. A scan receives an operator-supplied stable scan ID,
creates `PENDING` inventory before activation work, records terminal quizzes as
excluded, and records every success or stable failure. Rerunning the same scan
resumes pending entries and preserves already-recorded failures instead of
hiding or duplicating a gap. The owner CLI supports dry-run discovery and
explicit quiz IDs; apply mode refuses to run without a scan ID. In `all` mode,
newly created assessment quizzes are automatically selected for activation.
Creation is teaching-available: an activation failure does not undo the quiz,
but the failed gap is durably recorded for a later repair scan.

Starting an assessment remains teaching-available and emits a stable warning if
the latest lifecycle epoch is not covered. Reopening is stricter because it
creates a new evidence lifecycle: owned media is staged first, then the business
reset, incremented lifecycle epoch, new baseline, and activation evidence commit
in one transaction. If that preparation or commit fails, reopening is blocked
without partially resetting the quiz.

Outbox workers claim with `FOR UPDATE SKIP LOCKED`, a two-minute recoverable
lease, at most 100 events, and an 8 MiB canonical-byte target per claim. The
first oversized event is still claimable so it cannot block the queue. The
state path is `PENDING` → `LEASED` →
`DELIVERED_UNSEALED`, with retry release or quarantine; sealing arrives in the
fast-follow layer.

## Azure delivery and verification

The dispatcher claims at most 100 rows and 8 MiB per PostgreSQL lease batch,
processes up to eight deliveries concurrently, and stops after 20 batches per
Hatchet run. It recomputes and validates the complete canonical envelope against
the denormalized outbox columns before delivery. Schema/canonical corruption and
different-value append conflicts are quarantined with stable reason codes;
ordinary storage failures return to `PENDING` with full-jitter exponential
backoff from two seconds to five minutes. Successful rows remain
`DELIVERED_UNSEALED`; this layer never deletes them.

Canonical bytes are stored as deterministic 48 KiB `Edm.Binary` chunks. The
event root, locator, and retention-index rows contain hashes and query metadata.
Participant UUID is an ordinary property, never a partition or row key. Normal
delivery uses only Table entity create and read: an Azure `409` counts as an
idempotent replay only after the existing entity is byte-for-byte equivalent.
Update, merge, upsert, and delete are absent from the adapter.

The table layout is:

```text
AuditEvidence
  PK v1|<quiz>|<epoch>|<UTC-day>|<event-shard>
  RK c|<event>|<chunk-index> or e|<event>
AuditLocator
  PK v1|<event-shard>, RK <event>
AuditRetentionIndex
  PK v1|<quiz>|<epoch>|<event-shard>, RK event|<event>
```

`klicker-audit verify --event-id <uuid>` resolves the locator, reconstructs the
chunks, and validates byte length, content hash, event hash, canonical JSON,
schema, and identity. `klicker-audit export --live-quiz-id <uuid> --output
<path>` verifies and exports all epochs, with optional epoch and stable
participant UUID filters. Evidence never goes to stdout. The CLI creates a
same-directory `0600` temporary file, flushes it, installs it atomically, and
refuses replacement unless `--force` is explicit. Until the sealer lands,
exports explicitly report `UNSEALED`; an empty query reports
`NO_ROLLOUT_RECORD`, not proof that an unknown pre-instrumentation assessment
did or did not exist, and carries the explicit
`PRE_INSTRUMENTATION_DELETION_UNKNOWABLE` limitation. A participant export
keeps shared assessment context, excludes events scoped to other participants,
and reports whether any target-participant evidence was found. Evidence without
a baseline reports `BASELINE_MISSING`; it never claims covered status.

Owned assessment media is copied through a bounded-memory stream path. Source
URLs must be query-free HTTPS URLs on the configured Blob account, and every
copy is hashed while streaming. The destination name is content addressed;
conditional creation plus metadata verification makes identical retries safe
and a differing replay a hard conflict. Capture locks the returned blob version
with a version-level immutability policy and never exposes content update or
delete operations.

`AuditRetentionIndex` contains an append-only reverse index from immutable media
versions to the assessment scopes that reference them. The daily media-policy
worker streams active scope references from baseline-part outbox evidence and
extends each version's locked policy to the current semester retention horizon.
It never shortens an existing policy. Terminal-scope extension is added when
the lifecycle producers write the completion anchor in Layer 4.

## Operations

Privileged audit work is split by capability. The dispatcher deployment runs
the dispatcher and monitor once per minute with the Table-data identity. The
media-policy deployment runs the daily renewal workflow with the Blob-data
identity. The GraphQL backend has a separate Blob identity only for baseline
media capture. The ordinary general worker excludes all privileged audit task
keys and receives no audit-storage permission. Workflow selection is
identity-class fail-closed: each privileged deployment accepts only its exact
task set, and the ordinary worker cannot opt into either class. Configuration
accepts account-root Table and Blob HTTPS endpoints only; storage keys, SAS
URLs, and connection strings are not options.

The monitor logs a metadata-only snapshot and marks its Hatchet run failed for
critical backlog, stale dispatcher heartbeat, quarantine, or different-hash
conflict signals. `/metrics` exposes aggregate backlog, heartbeat, quarantine,
conflict, unsealed-byte, media-policy success, and media-horizon gauges, all
labeled by environment and worker role. Separate `ServiceMonitor` targets and
role-filtered alerts detect unavailable workers, stale heartbeats, and a media
policy horizon below 30 days. Owner-only alert routing remains an infrastructure
exit gate. Hatchet-submission and projected-capacity signals arrive with their
producer layers.

The staged rollout command is:

```bash
# inspect without mutations
pnpm --filter @klicker-uzh/graphql script:stg -- \
  src/scripts/activateAssessmentAudit.ts --dry-run

# activate the configured pilot/all selection and make the scan resumable
pnpm --filter @klicker-uzh/graphql script:stg -- \
  src/scripts/activateAssessmentAudit.ts --scan-id <stable-operator-uuid>
```

Explicit `--quiz-id <uuid>` flags override configuration for a bounded repair.
The operator must archive the scan output, verify that no entry remains pending
or failed, export and independently verify the pilot evidence, and check both
worker metric sets before expanding rollout. Empty or pre-instrumentation
results retain the explicit limitations documented above.

## Verification

The audit package has pure contract/storage/operator tests, PostgreSQL
integration tests, and provider-conformance tests through the real Azure SDKs
against pinned Azurite. The storage tests cover multi-entity chunk
reconstruction, identical replay, partial-write recovery, different-content
conflict detection, streamed media capture, locked-version verification, and
retention extension that never shortens. Production Azure RBAC and service
behavior remain staging exit gates because Azurite does not emulate managed
identity or every Azure service constraint. The PostgreSQL integration suite
refuses non-local database hosts and covers atomic commit and rollback,
deletion survival, idempotent retry and conflict, concurrent disjoint claims,
lease recovery, database checks, and the absence of audit-table foreign keys.
GraphQL's database-backed tests additionally cover activation commit/rollback,
exact retry versus changed snapshots, rollout resumption and gap accounting,
automatic all-mode activation, and atomic reopening.

```bash
pnpm --filter @klicker-uzh/audit check
pnpm --filter @klicker-uzh/audit test
pnpm --filter @klicker-uzh/audit build
pnpm --filter @klicker-uzh/graphql exec vitest run \
  test/assessmentAuditBaseline.test.ts \
  test/assessmentAuditActivation.test.ts \
  test/assessmentAuditRollout.test.ts
```

The test command needs a disposable local PostgreSQL database with all Prisma
migrations applied and the pinned Azurite service. Both are part of the
devcontainer and `.github/workflows/test-graphql.yml` CI job.
