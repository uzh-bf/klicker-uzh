---
type: Architecture
title: Assessment Audit Evidence
description: Provider-neutral assessment evidence contract, canonical event identity, and transactional PostgreSQL outbox foundation.
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

`@klicker-uzh/audit` is the provider-neutral Layer 1 foundation. It defines the
complete event registry, validates and canonicalizes envelopes, derives stable
event identities, persists exact canonical bytes in a transactional PostgreSQL
outbox, and exposes lease-based claiming plus a provider-neutral append-sink
port. No assessment producer, dispatcher, Azure adapter, export CLI, manifest
sealer, or retention worker is active in this layer.

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
                              future dispatcher + append-sink adapter
                                                     │
                                                     ▼
                                      Azure append-only evidence
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
state path available in Layer 1 is `PENDING` → `LEASED` →
`DELIVERED_UNSEALED`, with retry release or quarantine; sealing arrives in the
fast-follow layer.

## Verification

The audit package has pure contract tests and PostgreSQL integration tests. The
integration suite refuses non-local database hosts and covers atomic commit and
rollback, deletion survival, idempotent retry and conflict, concurrent disjoint
claims, lease recovery, database checks, and the absence of audit-table foreign
keys.

```bash
pnpm --filter @klicker-uzh/audit check
pnpm --filter @klicker-uzh/audit test
pnpm --filter @klicker-uzh/audit build
```

The test command needs a disposable local PostgreSQL database with all Prisma
migrations applied. CI runs it in `.github/workflows/test-graphql.yml` after the
workflow database setup.
