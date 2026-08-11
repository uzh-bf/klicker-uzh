---
type: Architecture
title: Assessment Audit Evidence
description: Assessment evidence contract, PostgreSQL outbox, append-only Azure delivery, verification, and operator export.
timestamp: '2026-08-11'
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

`@klicker-uzh/audit` now contains the Layer 1 contract and Layer 2 evidence-store
path. It defines the complete event registry, validates and canonicalizes
envelopes, derives stable event identities, persists exact canonical bytes in a
transactional PostgreSQL outbox, dispatches leased rows through a
provider-neutral append-sink port, and implements the Azure Table adapter and
owner CLI. The dedicated worker and monitoring resources are dormant by default
until their Pulumi-provisioned staging identity and endpoints are supplied.
Assessment producers, activation, baselines, Hatchet materialization, and media
capture arrive in the next layer; the manifest sealer and retention worker
remain fast-follow work.

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

The byte-oriented Blob adapter in this layer is deliberately restricted to
bounded manifest artifacts. It uses content-addressed conditional creates,
verifies identical replays, operates on the returned version identity, and
applies or extends a locked version-level immutability policy. It exposes no
content update or delete operation. The next layer adds a bounded-memory stream
path for media capture; media must not be loaded into this byte-oriented API.

## Operations

The dedicated audit Hatchet worker runs the dispatcher and monitor once per
minute under its own Pulumi-owned Kubernetes service account and Azure workload
identity. The ordinary general worker excludes those task keys by default and
receives no audit-storage permission. Workflow selection is identity-class
fail-closed: the privileged worker accepts only audit tasks and the ordinary
worker cannot opt into them. The audit deployment accepts account-root Table
and Blob HTTPS endpoints only; storage keys, SAS URLs, and connection strings
are not configuration options.

The monitor logs a metadata-only snapshot and marks its Hatchet run failed for
critical backlog, stale dispatcher heartbeat, quarantine, or different-hash
conflict signals. `/metrics` exposes only aggregate backlog, heartbeat,
quarantine, conflict, and unsealed-byte gauges. A `ServiceMonitor` scrapes it;
a separate `PrometheusRule` detects a stale/absent monitor metric or unavailable
deployment and routes the critical metadata through the owner-only alert label.
The media-horizon, Hatchet-submission, and projected-capacity signals are added
with the producers and media capture in the next layer.

## Verification

The audit package has pure contract/storage/operator tests, PostgreSQL
integration tests, and a provider-conformance test through the real Azure
Tables SDK against pinned Azurite. The table test covers multi-entity chunk
reconstruction, identical replay, partial-write recovery, and different-content
conflict detection. Production Azure RBAC and service behavior remain staging
exit gates because Azurite does not emulate managed identity or every Azure
service constraint. The PostgreSQL integration suite refuses non-local database
hosts and covers atomic commit and
rollback, deletion survival, idempotent retry and conflict, concurrent disjoint
claims, lease recovery, database checks, and the absence of audit-table foreign
keys.

```bash
pnpm --filter @klicker-uzh/audit check
pnpm --filter @klicker-uzh/audit test
pnpm --filter @klicker-uzh/audit build
```

The test command needs a disposable local PostgreSQL database with all Prisma
migrations applied and the pinned Azurite service. Both are part of the
devcontainer and `.github/workflows/test-graphql.yml` CI job.
