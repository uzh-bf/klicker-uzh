# Assessment Audit Logging Design

- **Status:** Approved design (revision 2 after joint design review), awaiting written-spec review
- **Date:** 2026-08-04
- **Last updated:** 2026-08-05 (revision 2: two-lane emission, Hatchet Lane 2, independent client ingress, trimmed integrity machinery, five-stack topology)
- **Target branch:** `v3`
- **Related work:** [PR #4872](https://github.com/uzh-bf/klicker-uzh/pull/4872), [PR #4946](https://github.com/uzh-bf/klicker-uzh/pull/4946)

## Summary

KlickerUZH needs a provider-neutral audit mechanism whose first delivery covers assessment LiveQuizzes. The contract, queue, and evidence store are designed as a **platform-wide audit backbone**; assessment-mode evidence is the only domain implemented in this program. The evidence must reconstruct disputes such as "I submitted answer X" or "I did not delete that question."

The production evidence store is Azure Table Storage. Runtime delivery is create-only and records are retained for one year. Exactly two human principals—the user and their supervisor, who own the Azure Resource Group—receive Azure data-plane read access. No Klicker account, role, permission, API, or UI grants evidence access. A canonical JSON bundle is the authoritative export; CSV is a human-readable projection.

The selected architecture uses **two emission lanes converging into one delivery pipeline**:

- **Lane 1 (transactional outbox).** Producers whose business action is itself a PostgreSQL transaction—GraphQL lecturer mutations and authoritative response persistence—insert the audit outbox row inside that same Prisma transaction. Atomicity between action and evidence is exact, and these processes connect to PostgreSQL anyway because their business writes live there.
- **Lane 2 (durable queue).** Producers whose action is not a PostgreSQL write—the auth app, stateless workers, the response API, and future services—emit typed audit events to Hatchet. A dedicated audit-append task in `hatchet-worker-general` writes them into the same outbox. Emitters carry **no application-database coupling** for auditing.

Both lanes land in the PostgreSQL outbox, which one dispatcher drains asynchronously into Azure Table Storage through a provider-neutral append interface. Azure availability is therefore never on any request path, and committed business changes cannot escape auditing.

Client-observed events from the PWA enter through an **independent, stateless audit-ingress service** with its own Azure Storage Queue, so evidence capture keeps working during a main-stack outage—exactly when submission disputes spike.

Azure Table Storage cannot independently prove that a privileged subscription administrator never rewrote history. Daily event-hash manifests are therefore written to an Azure Blob container with locked immutable retention. The table remains the searchable evidence store; the blob manifests provide tamper detection.

## Decision log

These rulings were fixed in a joint design review on 2026-08-05 and are the contract for this document. Changes to any of them reopen the design.

| #   | Ruling                                                                                                                                                                                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Platform-wide audit backbone; assessment coverage is the only implemented domain in this delivery.                                                                                                                    |
| 2   | Two-lane emission: same-transaction outbox where the action is a Prisma transaction; durable queue everywhere else. Both lanes converge into one dispatcher pipeline.                                                 |
| 3   | Lane 2 rides Hatchet events; an audit-append task in `hatchet-worker-general` writes them into the outbox. Emitters have no app-DB coupling.                                                                          |
| 4   | Per-event-type criticality flag: `CRITICAL` fails closed with its mutation; `STANDARD` fails open with a durable gap marker and alert. Invariant: `CRITICAL` events exist only in Lane 1.                             |
| 5   | Lane-2 emitters degrade to a bounded in-process retry buffer; per-producer sequence numbers turn detected loss into `AUDIT_GAP_DETECTED`. Lane 2 never blocks a user action.                                          |
| 6   | The Hatchet submission event the response API already pushes is the durable submission receipt; the processor commits response, `SUBMISSION_RECEIVED`, and `SUBMISSION_PERSISTED` in one Lane-1 transaction.          |
| 7   | An independent stateless audit-ingress service (stateless JWT validation, Azure Storage Queue sink) is the primary front door for client-observed events.                                                             |
| 8   | Integrity machinery is trimmed: daily immutable manifests, JCS + SHA-256, chunking; late arrivals join the next day's manifest; create-conflicts resolve by hash comparison (identical hash = idempotent replay, differing hash = quarantined integrity incident). No addenda chains, no separate conflict-verifier identity. |
| 9   | Two-owner Entra access model confirmed. The retention worker is a tracked follow-up due before month 12; the bucket layout is designed for cheap deletion from day one.                                               |
| 10  | Tiered event catalogue: the dispute-core set ships in v1; view, scheduled-lifecycle, bulk-manifest, and recomputation events are reserved contract names for fast-follow.                                             |
| 11  | This document is revised in place in PR #5311 and merges as the approved spec. PRs #4872/#4946 stay open as references until the replacement stacks are diff-compared, then close with documented omissions.          |
| 12  | Five stacks: A contract and outbox core; then B delivery and evidence store in parallel with C Lane 2 and ingress; then D export/verification CLI; then E assessment coverage ending in the pilot gate.               |

## Goals

- Provide one audit backbone—contract, lanes, delivery, store, integrity—usable by every current and future Klicker domain.
- Record every assessment-domain action that is material to reconstructing assessment content, access, submissions, grading, corrections, and deletion.
- Preserve exact normalized evidence values together with content versions and cryptographic hashes.
- Distinguish client-observed intent from authoritative server receipt and persistence.
- Make critical mutations and authoritative database changes inseparable from durable audit capture, without coupling non-transactional producers to PostgreSQL.
- Keep audit-store and queue outages outside every interactive path while retrying delivery durably.
- Keep capturing client-observed evidence during a main-stack outage.
- Prevent normal application identities from updating, deleting, or querying audit evidence.
- Provide the two authorized Azure evidence owners with verified CSV and canonical JSON evidence exports through an operator tool authenticated by Azure Entra ID.
- Retain evidence and integrity manifests for one year.
- Keep domain producers independent of Azure SDK types, table keys, credentials, and error codes.
- Roll out progressively, with explicit coverage start times and no claims about historical actions that were never captured.

## Non-goals

- General-purpose observability or application logging.
- Mouse movements, keystrokes, focus changes, route changes, performance telemetry, or unchanged autosaves.
- A lecturer- or participant-visible audit history.
- Automatic adjudication of complaints. The feature exports facts and provenance; the two Azure evidence owners interpret them.
- Auditing non-assessment activities before they enter assessment scope. The backbone accepts them later without redesign, but no non-assessment producer is instrumented in this program.
- Proving actions that occurred solely in a browser but were never transmitted. Such gaps must be reported honestly.
- Reusing the existing sharing-domain `AuditLogEntry` as the assessment evidence store.
- Supporting multiple storage providers in the first production deployment. The boundary is provider-neutral; Azure is the only initial adapter.
- Shipping the retention worker in v1 (deferred follow-up; see Export and retention).

## Domain vocabulary and boundary

- A lecturer or administrator is a `User`.
- A student is a `Participant`, connected to a `Course` through `Participation`.
- The audited activity is a `LiveQuiz` with `isAssessmentEnabled`, normally derived from assignment to a `Course` with `isAssessmentEnabled`.
- An `Element` is the versioned source question. An `ElementInstance` is the effective snapshot placed in a LiveQuiz `ElementBlock`.
- Responses, scoring, point corrections, lifecycle changes, and effective assessment content are in scope. Gamification behavior is not changed; awarded points and XP are only recorded as evidence.

Audit coverage starts when either condition first becomes true:

1. Assessment mode is enabled for the LiveQuiz.
2. The LiveQuiz is attached to an assessment-enabled Course.

Activation performs an audit-readiness check and atomically records `ASSESSMENT_AUDIT_STARTED` plus a complete baseline of the LiveQuiz, blocks, ElementInstances, referenced source Elements, settings, course relationship, permissions, and versions. A durable audit-scope marker stores `coverageStartsAt` independently of the mutable assessment flag.

Coverage is sticky. Disabling assessment mode, detaching the quiz, ending it, or deleting eligible draft data does not silently stop auditing. For assessments already active when the feature is rolled out, the baseline is marked `ROLLOUT_CURRENT_STATE`; exports state explicitly that coverage begins at that timestamp and make no claim about earlier history.

An update to a source Element referenced by an audited assessment is recorded as contextual provenance. The event says whether the effective ElementInstance snapshot changed. Refreshing an ElementInstance from its source is a separate effective-content mutation with exact before and after snapshots.

## Existing code and PR relationship

Current `v3` already contains two unrelated or incomplete audit concepts:

- `AuditLogEntry` in the sharing domain records catalog, permission, and ownership history in PostgreSQL. It remains separate because its schema, access model, retention, and evidentiary guarantees do not satisfy assessment auditing.
- Assessment response code emits `create-audit-log-entry` Hatchet events containing unstructured strings. The current Hatchet task is a stub. These hooks are replaced by the typed Lane-2 contract—the transport idea survives; the untyped payloads, stub consumer, and missing durability semantics do not.

PR #4872 and its child PR #4946 are design and implementation references, not stack bases. They remain unchanged until the replacement stacks are complete. Useful event ideas, Azure/Azurite setup, deployment work, and tests may be ported after review. The dedicated frontend-facing audit API from #4872 is deliberately **revived in adapted form** as the independent client ingress (ruling 7)—stateless, schema-enforcing, durable—while its flaws (lossy in-memory queue, client-controlled evidence fields, direct provider coupling in producers) remain excluded.

## Architecture

### Emission model

Every audited action is classified by where its business effect is persisted:

- **Lane 1 — the action is a Prisma transaction.** The producer calls the transactional audit helper inside its existing transaction. Business row and `AuditOutboxEvent` commit or roll back together. Producers: `packages/graphql` lecturer mutations, and `apps/hatchet-worker-response-processor` authoritative response persistence.
- **Lane 2 — the action is not a Prisma transaction.** The producer pushes a typed audit event to Hatchet through the emitter SDK. The audit-append task in `apps/hatchet-worker-general` validates it and inserts it into the outbox. Producers: `apps/response-api`, `apps/auth`, worker-internal steps, and any future stateless service.
- **Client-observed events** reach the backbone only through the independent audit-ingress service; browsers never talk to Hatchet or PostgreSQL.

The criticality invariant binds the lanes to the failure policy: `CRITICAL` event types may only be emitted through Lane 1, because only a transaction can honor fail-closed semantics. Lane 2 is `STANDARD`-only by construction, enforced by the contract at compile time and by the append task at runtime.

### Components

1. **Audit contract package** (`packages/audit`)

   - Owns event types, criticality flags, runtime validation, normalization, redaction rules, canonical JSON serialization, payload hashing, event hashing, and provider-neutral interfaces.
   - Owns the Lane-1 transaction helper and the Lane-2 emitter SDK (bounded buffer, backoff, sequence numbers).
   - Contains no Azure SDK types or credentials.

2. **Audit scope service**

   - Determines whether a LiveQuiz is under sticky assessment coverage.
   - Builds the activation baseline and exposes helpers for effective assessment references.

3. **Lane-1 transactional producer**

   - Accepts server-derived actor and scope context plus a typed payload.
   - Inserts `AuditOutboxEvent` through the caller's Prisma transaction.
   - Generates the server event ID, authoritative receipt time, idempotency key, canonical payload, and hashes.

4. **Lane-2 emitter and append task**

   - Emitters push typed events to Hatchet with per-producer monotonic sequence numbers; delivery failures go to a bounded in-process retry buffer with backoff.
   - A producer is identified as application + instance + boot session, so sequence counters legitimately restart on every deploy without producing false gaps.
   - Emitters send a periodic lightweight heartbeat carrying the last emitted sequence number, so a terminal tail loss (process death or scale-in with a non-empty buffer) is detectable, not only holes between received events.
   - The append task in `hatchet-worker-general` validates envelope and schema, rejects `CRITICAL` types by quarantining them with an alert (never dropping them), persists per-producer high-water marks in PostgreSQL, and inserts accepted events into the outbox.
   - Gap detection is serialized per producer via a Hatchet concurrency key (mirroring the existing per-instance concurrency pattern in the response processor), applies a bounded reordering grace period before declaring a gap, and marks a gap record superseded when the missing events later arrive.

5. **Independent client ingress** (`apps/audit-ingress`)

   - A minimal stateless HTTP service, deployable outside the main cluster (for example as a container app in another region), accepting only `CLIENT_OBSERVED` event types.
   - Validates the participant JWT statelessly (signature and expiry; no database, no session store), enforces the contract schema, stamps `receivedAt`, and never trusts client identity fields.
   - The participant session token is an httpOnly cookie scoped to the platform cookie domain, so the ingress hostname must live inside that cookie domain while using an independent DNS record and edge path. This survives cluster, backend, and Hatchet outages; it does not survive a platform-wide DNS or edge outage, which is accepted and documented.
   - The ingress holds a verification-only credential (an asymmetric public key or a dedicated audit-audience verification key), never the symmetric token-minting secret; a compromise of the ingress must not enable session forgery. Introducing that verification-only key is in scope for Stack C.
   - Writes accepted batches to an Azure Storage Queue as its durable sink—independent of Hatchet and PostgreSQL, so capture works during a full main-stack outage. The queue is configured with infinite message time-to-live (the Azure default of seven days silently expires messages during a long outage); the ingress splits batches below the per-message size ceiling, and drain failures use dequeue-count-based poison-message quarantine.
   - The append task drains the queue into the outbox whenever the stack is healthy; the drain is idempotent and does not assume queue ordering.

6. **Outbox dispatcher**

   - Polls committed outbox rows, leases work safely across replicas, and calls the configured append provider.
   - Retries transient errors with backoff and jitter.
   - Retains and alerts on invalid, conflicting, or oversized records rather than discarding them.
   - Uses Hatchet for scheduling and execution, but PostgreSQL remains the durable delivery source.

7. **Azure evidence adapter**

   - Maps canonical records to Azure Table entities and uses create-only insertion.
   - On a create conflict, point-reads the existing entity and compares `eventHash`: an identical hash is a benign idempotent replay (the retry path after an ambiguous Azure response) and is marked delivered without an alert; a differing hash is quarantined and alerts as an integrity incident. The delivery identity may therefore point-read individual addressed entities but cannot enumerate, update, or delete; no separate conflict-verifier identity exists.
   - Splits large payloads into deterministic evidence chunks. The chunk size is derived from the Azure Table string-property limit (which is expressed in UTF-16 code units, not UTF-8 bytes); the exact value is fixed in Stack B behind a conformance test against real Azure, not assumed.

8. **Manifest sealer**

   - Creates immutable daily hash manifests in Azure Blob Storage.
   - Events delivered after a day's manifest is sealed are included in the next day's manifest and flagged as late arrivals; no chained addenda are produced.
   - A missed sealing run (worker or Azure outage) is caught up by the next run, which seals every uncovered completed day; a manifest-age alert fires when the newest manifest is older than one sealing interval.

9. **Evidence verification and export tool** (own stack, `packages/audit` operator command)

   - Runs locally for an operator authenticated through Azure Entra ID.
   - Relies exclusively on Azure data-plane authorization; it has no Klicker login, API endpoint, or hosted UI.
   - Queries evidence, verifies manifests, and writes CSV plus canonical JSON bundles to an operator-selected local path.
   - Records reads and exports through Azure Storage data-plane diagnostic logs and includes the authenticated Azure principal in the export receipt.

10. **Retention worker** (deferred follow-up)
    - Not part of v1. Nothing becomes deletable until one year after the first captured event; the worker, its separate delete-capable identity, and deletion receipts are a tracked follow-up due well before month 12.
    - The Table partition layout (assessment and UTC day buckets) is designed from day one so complete expired buckets are cheaply deletable.

### Data flow

```text
Lane 1 (action is a Prisma transaction)
  lecturer mutation ──── business row + AuditOutboxEvent in one tx ────┐
  response processor ── response + RECEIVED + PERSISTED in one tx ─────┤
                                                                       │
Lane 2 (no transaction; STANDARD only)                                 ├─→ PostgreSQL outbox
  response API / auth / workers ── typed Hatchet event ─→ append task ─┤
       └─ Hatchet unreachable: bounded buffer, backoff, gap marker     │
                                                                       │
Client-observed (browser)                                              │
  PWA ── batched events + client sequence ─→ audit-ingress ─→ Azure    │
       └─ ingress unreachable: persistent      Storage Queue ─→ append task
          browser buffer, replay, gap marker

PostgreSQL outbox ──→ dispatcher ──→ provider-neutral append interface
                                      ├─→ Azure Table Storage (create-only evidence)
                                      └─→ immutable daily Azure Blob hash manifests

Azure evidence owner ── Entra-authenticated operator tool ──→ verify manifests
                                                           ├─→ local CSV report
                                                           └─→ local canonical JSON evidence bundle
```

The audit backbone is a logical service boundary implemented as packages, worker tasks, and one small ingress service. Only the ingress is a new deployable, and it is not part of the main cluster. Only server-side code can append to the outbox.

## Canonical event model

Every record has the following common envelope:

| Field              | Meaning                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `eventId`          | Server-generated random UUID; reused for delivery retries.                                               |
| `schemaVersion`    | Version of the event envelope and payload schema.                                                        |
| `eventType`        | Stable event name from the catalogue.                                                                    |
| `criticality`      | `CRITICAL` (Lane 1 only, fail-closed) or `STANDARD` (fail-open with gap semantics).                      |
| `evidenceClass`    | `AUTHORITATIVE`, `SERVER_OBSERVED`, or `CLIENT_OBSERVED`.                                                |
| `lane`             | `TRANSACTIONAL_OUTBOX`, `HATCHET_QUEUE`, or `CLIENT_INGRESS`; recorded for provenance.                   |
| `receivedAt`       | Authoritative server timestamp in UTC, stamped by the first trusted server component.                    |
| `clientOccurredAt` | Optional untrusted browser timestamp retained as context.                                                |
| `actor`            | Server-derived `User`, `Participant`, service, or system reference.                                      |
| `scope`            | Course, LiveQuiz, block, ElementInstance, source Element, and Participation references where applicable. |
| `correlationId`    | Connects one user intent across API, worker, and persistence events.                                     |
| `causationId`      | Optional preceding event that caused this record.                                                        |
| `clientSequence`   | Optional monotonic sequence for client-observed state changes.                                           |
| `producerSequence` | Monotonic per-producer sequence for Lane-2 emitters; basis for gap detection.                            |
| `producer`         | Trusted server component and deployment version.                                                         |
| `outcome`          | Stable success, rejection, failure, duplicate, or recovery code.                                         |
| `payload`          | Exact normalized event-specific evidence.                                                                |
| `payloadHash`      | SHA-256 of the canonical payload.                                                                        |
| `eventHash`        | SHA-256 of the canonical envelope excluding `eventHash`.                                                 |
| `idempotencyKey`   | Server-derived key preventing duplicate evidence for one business transition.                            |

Canonical JSON follows RFC 8785 JSON Canonicalization Scheme (JCS). Domain normalization fixes answer option ordering and represents dates as UTC ISO 8601 strings before JCS serialization. Numbers, nulls, Unicode, object key ordering, answer option ordering, and date formatting have test vectors. Hash algorithm and canonicalization versions are part of the manifest so a one-year-old bundle remains verifiable after code upgrades.

Payloads contain exact normalized values, not only hashes. Hashes establish integrity; the values establish what happened.

## Event catalogue

The catalogue is defined in full in the contract package so names, envelopes, and criticality flags are fixed once. Implementation is tiered: **Tier 1** ships in this program; **Tier 2** names are reserved and validated in the contract but produce no events until a fast-follow instruments them.

### Scope and baseline (Tier 1, CRITICAL)

- `ASSESSMENT_AUDIT_STARTED`
- `ASSESSMENT_BASELINE_RECORDED`
- `ASSESSMENT_MODE_CHANGED`
- `ASSESSMENT_COURSE_ASSIGNMENT_CHANGED`
- `ASSESSMENT_DELETED`
- `ASSESSMENT_AUDIT_RETENTION_STARTED` (Tier 2, STANDARD—emitted by the retention worker, not a Lane-1 producer; arrives with the retention follow-up)

Every catalogue entry carries an explicit criticality in the contract; unlisted categories default to `STANDARD`. Only Lane-1 producers may declare `CRITICAL` types.

### Lecturer and content mutations (Tier 1, CRITICAL)

- LiveQuiz metadata and settings changed.
- ElementBlock created, updated, reordered, activated, closed, or deleted.
- ElementInstance added, updated, reordered, removed, or deleted.
- Referenced source Element changed, including whether effective assessment content changed.
- Options, solutions, restrictions, points, timing, and access settings changed.
- Permissions or participant access changed.
- Points corrected, response modified or deleted, assessment reset, participant removed—each with old value, new value, reason, and responsible User.
- LiveQuiz published, started, ended, graded, cancelled, reset, copied, or imported.

Each mutation records the operation, exact normalized before and after values, field-level difference, content versions and hashes, actor permission context, and correlation ID. A deletion records the full pre-delete snapshot. The business change and evidence event are committed atomically (Lane 1).

Tier 2 in this category: bulk-operation root manifests with per-item outcomes, results recomputed, scheduled lifecycle transitions.

### Authentication and access (Tier 1, STANDARD, Lane 2)

- Authentication succeeded or failed.
- Assessment access succeeded or failed.
- Assessment opened or resumed.
- Assessment session ended.

Tier 2: ElementInstance viewed.

Failures use stable reason codes. Events never contain passwords, tokens, cookies, magic links, PINs, raw submitted usernames, or full request headers.

### Participant interaction (Tier 1, STANDARD, client ingress)

- `RESPONSE_SELECTION_CHANGED`
- `RESPONSE_SELECTION_CLEARED`
- `SUBMISSION_ATTEMPTED`
- `SUBMISSION_AUTO_TRIGGERED`

Selection records are `CLIENT_OBSERVED` supporting evidence. The PWA emits meaningful debounced state changes, not keystrokes or unchanged autosaves. It stores the exact normalized answer and the ElementInstance content hash seen by the participant:

- SC, MC, and KPRIM: selected option IDs plus the option content/version shown.
- Free text: exact submitted string.
- Numerical: normalized value, unit, and applicable restriction context.
- Selection and case study: normalized structured selection.
- Content: explicit read or acknowledgement state when one exists.

### Authoritative submission and processing (Tier 1)

- `SUBMISSION_RECEIVED` (CRITICAL, recorded by the processor from the durable Hatchet event)
- `SUBMISSION_VALIDATED` / `SUBMISSION_VALIDATION_FAILED` (STANDARD)
- `SUBMISSION_DUPLICATE` (STANDARD)
- `SUBMISSION_REJECTED` (STANDARD)
- `SUBMISSION_PERSISTED` (CRITICAL)
- `SUBMISSION_PROCESSING_FAILED` / `SUBMISSION_PROCESSING_RECOVERED` (STANDARD)
- `SUBMISSION_SCORED` (STANDARD, in the persistence transaction where scoring is computed there)

`SUBMISSION_ATTEMPTED` proves only a browser action. `SUBMISSION_RECEIVED` proves that an authenticated server durably accepted the evidence. `SUBMISSION_PERSISTED` proves that it became the authoritative response. Rejection and failure events preserve exact reason codes and the last durable stage.

### System, delivery, and privileged access (Tier 1 where the subsystem ships, all STANDARD)

- `AUDIT_GAP_DETECTED` (Lane-2 or client sequence discontinuity, buffer overflow, or process loss).
- Audit delivery delayed, conflict detected, quarantined, or recovered.
- Manifest sealed or manifest verification failed.
- Retention events (Tier 2, with the retention follow-up).

Evidence reads and exports are not Klicker-produced audit events. Azure Storage data-plane diagnostics provide the external access trail for queries, including the Entra principal and operation metadata, while the operator tool creates an export receipt covered by the bundle's root hash. Direct and break-glass resource operations are additionally covered by Azure control-plane logs.

## Trust, privacy, and authorization

- Actor identities, server times, event IDs, permissions, and authentication outcomes come from trusted server context. Clients cannot override them.
- `receivedAt` is authoritative. `clientOccurredAt` is contextual and is checked for unreasonable clock skew.
- The audit-ingress service validates participant JWTs statelessly and derives actor identity exclusively from the verified token, never from the event body.
- Azure stores stable pseudonymous database references, not names or email addresses. Evidence export does not call Klicker APIs or use Klicker permissions. Any separate identity resolution is outside this feature and requires independently authorized database access.
- Exact assessment answers are retained because they are the subject of potential disputes. Unrelated personal data is excluded.
- Stack traces are reduced to stable error codes and sanitized component metadata before audit insertion.
- The normal runtime identity can append and point-read individually addressed entities (required for conflict hash comparison) but cannot enumerate, update, or delete evidence.
- A dedicated Azure Entra group containing exactly the user and their supervisor is the only human principal granted Table and manifest data-plane read access. Resource Group ownership alone is not treated as implicit data-plane authorization; the assignment is explicit and tested.
- No Klicker `UserRole`, Course permission, participant session, service endpoint, or frontend route grants evidence read access.
- The operator tool uses the invoking evidence owner's Azure token and has no shared export credential.
- Required non-human identities are limited to append delivery, storage-queue ingestion, manifest sealing, and diagnostics; the delete-capable retention identity arrives with the retention follow-up. They do not establish a human access path.
- Blob immutability administration and any direct or break-glass storage access are restricted to the same two Azure evidence owners and monitored through Azure control-plane and Storage data-plane logs.
- Export artifacts are written locally to an operator-selected path. Klicker does not host them, issue download links, or retain copies.

No event contains raw credentials, JWTs, session cookies, magic links, PINs, authorization headers, connection strings, or Infisical values. Representative forbidden-data fixtures are scanned in automated tests.

**Data-subject erasure.** Participants can delete their Klicker account today, but assessment evidence is retained for the full year regardless: the retention basis is the legitimate interest in defending assessment disputes, evidence is keyed to pseudonymous references, and the create-only store has no erasure capability in v1 by design. This position must be explicitly approved by the responsible data-protection contact before the controlled production assessment in the rollout (step 7); the approval is a named precondition of the pilot gate, not an implicit assumption.

## Failure semantics

### Lane 1: transactional mutations

For `CRITICAL` event types, the business mutation and outbox insert execute in the same Prisma transaction; a failure in event validation, canonicalization, hashing, or outbox insertion fails the entire mutation. The evidence guarantee outranks availability for corrections, deletions, resets, and authoritative submission persistence.

`STANDARD` events emitted from Lane-1 producers are written **after** the business transaction commits, in their own short transaction. This is a PostgreSQL constraint, not a preference: a failed statement aborts the whole surrounding transaction, and Prisma exposes no savepoint API, so fail-open semantics cannot be honored by an insert inside the business transaction. If the post-commit insert fails, a durable gap marker plus alert is produced. In-transaction insertion is reserved for `CRITICAL` types.

Azure delivery is never in any transaction: an Azure or dispatcher outage leaves committed outbox events pending and does not roll back or block anything.

### Lane 2: queue emission

Lane 2 never blocks a user action. If Hatchet is unreachable at emit time, events enter a bounded in-process retry buffer with backoff. Process death or buffer overflow loses buffered events; the combination of per-producer sequence numbers (holes between received events) and the emitter heartbeat carrying the last emitted sequence (terminal tail loss) lets the append task record `AUDIT_GAP_DETECTED` for the affected window. Gap evaluation is serialized per producer, waits out a bounded reordering grace period, and supersedes a gap record when the missing events later arrive. Because `CRITICAL` events cannot travel Lane 2, no fail-closed guarantee is ever silently violated.

### Participant submissions

The response API acknowledges a submission only after the push of the typed submission event to Hatchet succeeds; the event carries the server-stamped `receivedAt` and is durable in Hatchet's own PostgreSQL-backed store. A failed push means no acknowledgement, and the client retries—no evidence is owed for an unacknowledged submission.

This is an explicit behavior change to the current code, in scope for Stack E: today a failed push is caught, logged, and still answered with a success acknowledgement, and the Redis-based duplicate short-circuit acknowledges without any Hatchet push. Under this design the failed-push path returns an error, and the duplicate path emits a `SUBMISSION_DUPLICATE` Lane-2 event referencing the original receipt, so no success-class acknowledgement exists without corresponding evidence.

The response processor then commits the authoritative response, `SUBMISSION_RECEIVED`, and `SUBMISSION_PERSISTED` in one Lane-1 transaction; processor crashes are covered by Hatchet redelivery. If a `CRITICAL` Lane-1 insert still fails when Hatchet retries are exhausted, the run lands in a dead-letter state with an immediate operator alert and a defined replay procedure—an acknowledged submission must never be silently dropped because its audit insert failed. Duplicate client retries resolve through the server idempotency key and generate a deterministic duplicate outcome rather than a second response. Between acknowledgement and processing, receipt durability rests on Hatchet's store; this window is monitored (oldest unprocessed submission age) and accepted by design.

### Participant selections (client-observed)

The PWA assigns monotonic client sequence numbers and retains unsent meaningful changes in a bounded persistent browser buffer (IndexedDB), replaying them after reconnecting to the audit-ingress service. Because the ingress is deployed independently of the main stack, capture continues during a main-stack outage. Browser shutdown, storage clearing, capacity exhaustion, or irrecoverable sequence discontinuity is represented by `AUDIT_GAP_DETECTED` when communication becomes possible. The UI remains usable; it must not claim that every local selection is authoritative.

### Delivery

- Transient provider failures retry without a finite drop limit.
- Outbox rows are not eligible for cleanup until Azure confirms insertion and manifest inclusion is scheduled.
- A create conflict quarantines the row and alerts as a potential integrity incident; the two evidence owners investigate using their own read access.
- Invalid or unrepresentable rows remain durably quarantined and alert immediately.
- Successfully delivered outbox rows may be removed from PostgreSQL after seven days; PostgreSQL is a delivery record, not the one-year evidence store.
- Operational state exposes queue depth, oldest pending age, delivery latency, retry count, quarantine count, storage-queue depth, and recovery status.

The absence of an authoritative server event during a verified coverage interval supports a statement that Klicker has no evidence of receiving that action. The absence of a client-observed selection event never proves that the participant did not select it locally.

## Azure append-only and integrity design

Azure Table Storage is organized by assessment, UTC day, and deterministic shard. Root and chunk rows for one event share a partition. The exact Azure key mapping belongs to the adapter and is not exposed to producers. It supports bounded queries by assessment and time without a cross-account scan, and makes complete expired buckets cheaply deletable for the retention follow-up.

Large canonical payloads are split deterministically into chunks sized against the Azure Table string-property limit (expressed in UTF-16 code units; the exact chunk size is fixed in Stack B behind a real-Azure conformance test). The root row stores total byte length, chunk count, complete payload hash, and ordered chunk hashes. Export reconstruction rejects missing, reordered, duplicated, or altered chunks.

Normal delivery uses only create operations. No upsert path exists. Deployment verification attempts create, query, update, and delete operations with each identity and fails unless the effective permissions match the intended matrix.

At 02:00 UTC, the manifest sealer writes a base manifest for each previous-day assessment bucket. Events delivered after their day's manifest is sealed are included in the next day's manifest, marked as late arrivals with a reference to their original authoritative day. A missed sealing run is caught up by the next run, which covers every completed but unsealed day; a manifest-age alert fires when the newest manifest is older than one sealing interval. Each manifest contains its schema version, assessment and time scope, sorted row identities and event hashes, late-arrival references, preceding manifest hash, creation time, and manifest hash. The Blob container uses locked time-based immutability for at least the evidence retention period.

Manifest coverage is keyed on **delivery time**, not authoritative day: a row is expected in the first manifest sealed after its delivery. An export is verified only when every selected table row is covered by a valid manifest and every covered row expected in the selected scope exists with the expected hash. Rows delivered after the last sealing run are reported as awaiting sealing; rows delivered before the last sealing run but absent from every manifest fail verification. This keeps routine late delivery verifiable while preserving the tamper signal.

## Export and retention

Either authorized Azure evidence owner may run the repository's operator tool and filter evidence by assessment, time range, pseudonymous actor reference, correlation ID, event category, or outcome. The tool obtains an Entra token from the invoking operator and fails before querying if the principal lacks Azure data-plane read permission. There is no Klicker export API or UI.

The CSV is a readable timeline containing pseudonymous actor references. It is not the canonical integrity artifact.

Local export files are created with owner-only filesystem permissions, are never uploaded by the tool, and are not overwritten without explicit confirmation. Their later storage and deletion remain the evidence owner's responsibility.

The canonical JSON bundle contains:

- Canonical event records and payload chunks.
- Export filters, coverage start, generation time, and schema versions.
- Event count and sorted event hashes.
- Referenced manifests.
- File hashes and one root hash covering the complete bundle.
- Integrity status, warnings, and any detected coverage gap.
- A verification command or documented verifier version.

Each table event expires one calendar year after the end of its authoritative UTC day. Manifests are retained at least through the corresponding evidence boundary. **The retention worker is deliberately deferred**: nothing is deletable until one year after the first captured event, so the delete-capable identity, scheduled cleanup, verification, and deletion receipts ship as a tracked follow-up due well before month 12. The v1 obligation is structural only—the bucket layout must make complete expired buckets cheaply and safely deletable, and this property is tested in v1.

## Layer footprint

Expected implementation areas are:

- `packages/prisma`: durable audit scope and outbox schema plus migrations; analytics schema sync where required.
- A new `packages/audit` workspace: canonical contract, criticality flags, normalization, hashing, provider-neutral interfaces, Lane-1 transaction helper, Lane-2 emitter SDK, isolated provider adapters, and the Entra-authenticated operator export command. Azure types never cross its core interfaces.
- `packages/graphql`: scope resolution, baseline capture, lecturer mutations, and generated operations where required. No evidence-read operation is exposed.
- `packages/hatchet`: audit-append, outbox delivery, storage-queue drain, and manifest task declarations. The package currently imports the Prisma client at module scope; a client-only entry point (subpath export or separate emitter module) is required before the Lane-2 emitter SDK may depend on it, or the stated emitter decoupling is void.
- `apps/hatchet-worker-general`: append, delivery, drain, and sealing execution.
- `apps/response-api`: server-stamped receipt metadata in the existing submission event push; typed Lane-2 events replacing the `create-audit-log-entry` stubs; the acknowledgement-semantics change (error on failed push, evidence-bearing duplicate path) described under Failure semantics. No new PostgreSQL usage.
- `apps/hatchet-worker-response-processor`: authoritative validation, persistence, scoring, and recovery evidence in Lane-1 transactions. The current authoritative write is a bare create with interleaved Redis writes and event pushes; introducing the interactive transaction is in scope, and atomicity covers the PostgreSQL rows only—Redis markers and Hatchet pushes are explicitly outside the transactional boundary.
- A new `apps/audit-ingress`: the independent stateless client ingress with its Azure Storage Queue sink, containerized and deployable outside the main cluster.
- `apps/auth`: a server-side Hatchet client emitting Lane-2 authentication and access events.
- `apps/frontend-pwa`: meaningful selection capture, bounded persistent browser buffer, sequence and gap semantics, batched delivery to the audit ingress.
- `packages/prisma-data` and Playwright fixtures: synthetic assessment, lecturer, and participant evidence scenarios without real personal data.
- Deployment configuration: Azure Table, immutable Blob container, Storage Queue, separate identities, ingress hosting, environment configuration, dashboards, and alerts.
- `docs/` and relevant repository skills: architecture, operations, verification, and incident guidance. Two ADRs are recorded in `docs/adr/` as their subject first lands: the two-lane emission model with the criticality invariant (Stack A) and the external create-only evidence store with immutable manifests (Stack B).

GraphQL is the current protected application API boundary for lecturer mutations. Client-observed events use the independent audit ingress; authoritative submissions keep the existing response-api path. Evidence reads bypass application APIs entirely and use Azure Entra authorization. The audit package and outbox contract remain transport-neutral.

## UI, gamification, and fixtures

- There is no Klicker evidence-search or export UI. Assessment participants, lecturers, and Klicker administrators cannot browse audit evidence through the product.
- No new evidence-access translations or frontend routes are required.
- No points, XP, achievements, leaderboards, or grading algorithms change. Their existing outputs and corrections are recorded as evidence.
- Tests use synthetic lecturer Users, Participants, an assessment-enabled Course, a LiveQuiz, and ElementInstances covering SC, MC, KPRIM, free-text, numerical, selection, case-study, and content behavior.
- No real course, roster, response, name, email, or student identifier may be committed.

## Verification and rollout

### Automated verification

- Canonical serialization and hash test vectors.
- Schema compatibility, normalization, redaction, chunking, and forbidden-data tests.
- Contract tests enforcing the criticality invariant (`CRITICAL` types rejected on Lane 2 at compile time and by the append task at runtime).
- Provider conformance against an in-memory adapter and Azurite.
- Infrastructure permission tests for append, read, update, and delete denial/allowance.
- Transaction tests proving critical business changes cannot commit without outbox evidence.
- Lane-2 tests proving emission never blocks, buffers bound correctly, and sequence gaps produce `AUDIT_GAP_DETECTED`.
- Ingress tests proving stateless JWT validation, schema enforcement, queue durability, and drain idempotency—including capture while the main stack is stopped.
- Response tests for attempted, received, validated, rejected, duplicate, persisted, scored, failed, and recovered stages.
- Failure injection for Azure, Hatchet, process, manifest, duplicate, malformed-event, and delayed-delivery failures.
- Authorization tests proving that no Klicker identity can retrieve evidence, infrastructure assertions proving that the evidence-owner group is the only human data-plane assignment, and a negative access test using a representative unauthorized Entra principal.
- Playwright complaint scenarios generate participant submission, lecturer deletion/modification, and correction evidence; the operator CLI then verifies and exports the resulting timeline outside the browser.
- Load tests demonstrating that audit capture does not materially degrade assessment submissions.

### Operational gates

- Dashboards expose outbox depth, oldest event, delivery latency, quarantine, Lane-2 buffer losses, client gaps, storage-queue depth, oldest unprocessed submission, manifest age, and denied storage access.
- Alerts have an owner and runbook.
- Schema readers remain compatible with every schema version retained for one year.
- Staging proves the separate Azure permission identities and immutable retention policy.
- A recovery exercise demonstrates delivery after an extended Azure outage, and client capture during a simulated main-stack outage.

### Rollout order

1. Deploy the dormant contract, outbox, and Lane-2 append path.
2. Deploy Azure delivery and generate synthetic evidence.
3. Deploy the client ingress and verify outage-time capture.
4. Deploy and verify Azure-owner export.
5. Enable assessment capture in staging.
6. Run complaint-reconstruction, failure, privacy, and load scenarios.
7. Enable one controlled production assessment and record its explicit coverage start.
8. Independently verify its evidence export and operational metrics.
9. Expand only after both Azure evidence owners and operations sign off.

## Stack topology

This feature uses five native GitHub stacks with distinct reviewer audiences and runtime models. Every intermediate layer is green and feature-gated. One worktree and one topology owner are used per stack. Stacks B and C may proceed in parallel once Stack A is merged.

The gate is a single environment variable per concern—`AUDIT_CAPTURE_ENABLED` for producers and `AUDIT_DELIVERY_ENABLED` for the dispatcher and sealer—owned by the deployment configuration and referenced by rollout steps 1–5; the pilot gate in step 7 audits exactly these switches. Because the audit tasks run in `hatchet-worker-general`, deployments must keep `HATCHET_WORKFLOWS` unset (or update it in lockstep) so a pinned workflow list cannot silently disable audit delivery.

### Stack A: contract and outbox core

1. Canonical contract: envelope, criticality flags, full catalogue names (both tiers), validation, JCS, hashing, redaction, test vectors.
2. Outbox schema, migrations, Lane-1 transaction helper, and transaction tests.

### Stack B: delivery and evidence store (after A)

1. Outbox dispatcher: Hatchet tasks, leasing, retries, quarantine, telemetry.
2. Azure Table adapter: create-only mapping, chunking, conflict quarantine, Azurite conformance.
3. Daily immutable manifests: sealer, late-arrival handling, Blob immutability, deployment configuration.

### Stack C: Lane 2 and client ingress (after A, parallel to B)

1. Lane-2 emitter SDK and audit-append task: bounded buffer, sequences, gap detection; replace `create-audit-log-entry` stubs with typed events.
2. `apps/audit-ingress`: stateless service, verification-only token key, Storage Queue sink (infinite TTL, batch splitting, poison handling), drain task, containerization and independent deployment inside the participant cookie domain.

### Stack D: export and verification CLI (after B)

1. Entra-authenticated operator tool: query, manifest verification, CSV and canonical JSON bundles, export receipts, Storage diagnostics wiring, runbooks.

### Stack E: assessment coverage (after A–D)

1. Activation and baseline: scope resolver, readiness check, sticky coverage, `ROLLOUT_CURRENT_STATE`, complete baseline.
2. Lecturer mutations: exact before/after evidence for the Tier-1 critical set.
3. Authoritative submissions: receipt metadata in response-api, processor Lane-1 evidence, duplicate and recovery semantics, load evidence.
4. Participant interactions: access/session events from auth, PWA capture with persistent buffer and gap semantics, ingress integration, browser tests.
5. Production hardening and controlled rollout: end-to-end dispute scenarios, failure recovery, privacy and authorization evidence, dashboards, alerts, runbooks, pilot gate.

The source branches for PRs #4872 and #4946 remain untouched until the union of all replacement stacks is compared with their complete diffs. Every deliberate omission is documented before maintainers decide whether to close the old PRs.

## Acceptance criteria

- Assessment activation cannot commit without its coverage marker and complete baseline outbox evidence.
- Every `CRITICAL` mutation either commits with evidence or does not commit; `CRITICAL` event types cannot be emitted through Lane 2.
- Lane-2 emission never blocks a user-facing action; induced Hatchet outages produce bounded buffering and honest `AUDIT_GAP_DETECTED` markers, never silent loss.
- A successful assessment-submission acknowledgement implies a durable server-stamped receipt in Hatchet's store, and processing produces correlated `SUBMISSION_RECEIVED` and `SUBMISSION_PERSISTED` evidence atomically with the response.
- Client-observed events keep flowing to the independent ingress during a simulated main-stack outage.
- Client-only observations are labeled and cannot be mistaken for authoritative server evidence.
- Azure downtime accumulates a durable backlog and recovery delivers it without duplicates or silent loss.
- The append-delivery credential cannot query, update, or delete Table evidence.
- Table changes, missing rows, unexpected rows, and chunk corruption are detected through immutable daily manifests, with late arrivals covered by the next manifest.
- Exactly the two designated Azure evidence owners—and no Klicker role or other human principal—can query Table evidence and manifests or run a successful export.
- A CSV and canonical JSON bundle can reconstruct a representative complaint and pass independent hash verification.
- Forbidden credentials and unrelated direct identifiers are absent from stored and exported canonical events.
- The Table bucket layout is demonstrably deletable per expired bucket, and the retention worker follow-up is tracked with a due date before month 12.
- Intermediate PR layers remain independently testable and production capture stays gated until the final rollout layer.
