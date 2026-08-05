# Assessment Audit Logging Design

- **Status:** Approved design, awaiting written-spec review
- **Date:** 2026-08-04
- **Last updated:** 2026-08-05
- **Target branch:** `v3`
- **Related work:** [PR #4872](https://github.com/uzh-bf/klicker-uzh/pull/4872), [PR #4946](https://github.com/uzh-bf/klicker-uzh/pull/4946), [ClickUp task 86caazaea](https://app.clickup.com/t/86caazaea)

## Summary

KlickerUZH needs a provider-neutral audit mechanism for assessment LiveQuizzes. It must preserve evidence of assessment configuration, lecturer actions, participant interactions, authoritative submission processing, corrections, and privileged evidence access. The evidence is intended to reconstruct disputes such as “I submitted answer X” or “I did not delete that question.”

The production evidence store is Azure Table Storage. Runtime delivery is create-only and records are retained for one year. Exactly two human principals—the user and their supervisor, who own the Azure Resource Group—receive Azure data-plane read access. No Klicker account, role, permission, API, or UI grants evidence access. A canonical JSON bundle is the authoritative export; CSV is a human-readable projection.

The selected architecture is a transactional PostgreSQL outbox followed by asynchronous delivery through a provider-neutral evidence-store interface. Critical lecturer mutations and authoritative response state changes commit their business data and outbox event atomically. Azure availability is therefore removed from the request path without allowing committed business changes to escape auditing.

Azure Table Storage cannot independently prove that a privileged subscription administrator never rewrote history. Daily event-hash manifests and late-arrival addenda are therefore written to an Azure Blob container with locked immutable retention. The table remains the searchable evidence store; the blob manifests provide tamper detection.

## Goals

- Record every assessment-domain action that is material to reconstructing assessment content, access, submissions, grading, corrections, and deletion.
- Preserve exact normalized evidence values together with content versions and cryptographic hashes.
- Distinguish client-observed intent from authoritative server receipt and persistence.
- Make critical lecturer mutations and authoritative database changes inseparable from durable audit capture.
- Keep Azure outages outside the interactive assessment path while retrying delivery durably.
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
- Auditing non-assessment activities before they enter assessment scope.
- Proving actions that occurred solely in a browser but were never transmitted. Such gaps must be reported honestly.
- Reusing the existing sharing-domain `AuditLogEntry` as the assessment evidence store.
- Supporting multiple storage providers in the first production deployment. The boundary is provider-neutral; Azure is the only initial adapter.

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
- Assessment response code emits `create-audit-log-entry` Hatchet events containing unstructured strings. The current Hatchet task is a stub and can lose the gap between a business action and event publication. Some messages serialize request payloads into logs. These hooks must be replaced by typed events and forbidden-data checks, not treated as the durable solution.

PR #4872 and its child PR #4946 are design and implementation references, not stack bases. They remain unchanged until the replacement stacks are complete. Useful event ideas, Azure/Azurite setup, deployment work, and tests may be ported after review. Direct producer-to-Azure writes, the lossy in-memory queue, client-controlled evidence fields, provider-specific domain contracts, and an additional public Hono service are deliberately excluded.

## Architecture

### Components

1. **Audit contract package**

   - Owns event types, runtime validation, normalization, redaction rules, canonical JSON serialization, payload hashing, event hashing, and provider-neutral interfaces.
   - Contains no Azure SDK types or credentials.

2. **Audit scope service**

   - Determines whether a LiveQuiz is under sticky assessment coverage.
   - Builds the activation baseline and exposes helpers for effective assessment references.

3. **Transactional audit producer**

   - Accepts server-derived actor and scope context plus a typed payload.
   - Inserts `AuditOutboxEvent` through the caller's Prisma transaction for critical mutations.
   - Generates the server event ID, authoritative receipt time, idempotency key, canonical payload, and hashes.

4. **Durable response ingress**

   - Records an authenticated assessment submission receipt and `SUBMISSION_RECEIVED` audit event before the response API returns success.
   - Relays pending ingress records to Hatchet after commit and retries relay failures.
   - Allows the processor to atomically persist the response, update ingress state, and append the corresponding processing event.

5. **Outbox dispatcher**

   - Polls committed outbox rows, leases work safely across replicas, and calls the configured append provider.
   - Retries transient errors with backoff and jitter.
   - Retains and alerts on invalid, conflicting, or oversized records rather than discarding them.
   - Uses Hatchet for scheduling and execution, but PostgreSQL remains the durable delivery source.

6. **Azure evidence adapter**

   - Maps canonical records to Azure Table entities and uses create-only insertion.
   - Sends create conflicts to a separately authorized conflict verifier because the append identity cannot query existing rows.
   - Treats an existing row with the same event and hash as successful idempotent replay; a different hash is a critical integrity incident.
   - Splits large payloads into deterministic evidence chunks.

7. **Manifest sealer**

   - Creates immutable daily hash manifests in Azure Blob Storage.
   - Creates chained immutable addenda for events delivered after the daily manifest is sealed.

8. **Evidence verification and export tool**

   - Runs locally for an operator authenticated through Azure Entra ID.
   - Relies exclusively on Azure data-plane authorization; it has no Klicker login, API endpoint, or hosted UI.
   - Queries evidence, verifies manifests, and writes CSV plus canonical JSON bundles to an operator-selected local path.
   - Records reads and exports through Azure Storage data-plane diagnostic logs and includes the authenticated Azure principal in the export receipt.

9. **Retention worker**
   - Uses a separate delete-capable identity.
   - Removes complete expired logical time buckets and their manifests only after the one-year boundary.
   - Writes a deletion receipt containing counts and final hashes into the current audit period.

### Data flow

```text
lecturer mutation ── business row + AuditOutboxEvent in one transaction ─┐
                                                                         │
response API ── durable ingress + SUBMISSION_RECEIVED in one transaction ├─→ PostgreSQL outbox
                                                                         │
response processor ── response state + processing event in one tx ──────┘

participant selection ── authenticated ingestion ──→ PostgreSQL outbox
       └─ network unavailable: persistent local queue, ordered replay, gap signal

PostgreSQL outbox ──→ dispatcher ──→ provider-neutral append interface
                                      ├─→ Azure Table Storage (create-only evidence)
                                      └─→ immutable Azure Blob hash manifests

Azure evidence owner ── Entra-authenticated operator tool ──→ verify manifests
                                                           ├─→ local CSV report
                                                           └─→ local canonical JSON evidence bundle
```

The “audit service” is a logical service boundary implemented initially as focused packages and a worker. It is not a new publicly reachable microservice. Participant ingestion uses existing authenticated server boundaries; only server-side code can append to the outbox.

## Canonical event model

Every record has the following common envelope:

| Field              | Meaning                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------- |
| `eventId`          | Server-generated random UUID; reused for delivery retries.                                               |
| `schemaVersion`    | Version of the event envelope and payload schema.                                                        |
| `eventType`        | Stable assessment event name.                                                                            |
| `evidenceClass`    | `AUTHORITATIVE`, `SERVER_OBSERVED`, or `CLIENT_OBSERVED`.                                                |
| `receivedAt`       | Authoritative server timestamp in UTC.                                                                   |
| `clientOccurredAt` | Optional untrusted browser timestamp retained as context.                                                |
| `actor`            | Server-derived `User`, `Participant`, service, or system reference.                                      |
| `scope`            | Course, LiveQuiz, block, ElementInstance, source Element, and Participation references where applicable. |
| `correlationId`    | Connects one user intent across API, worker, and persistence events.                                     |
| `causationId`      | Optional preceding event that caused this record.                                                        |
| `clientSequence`   | Optional monotonic sequence for client-observed state changes.                                           |
| `producer`         | Trusted server component and deployment version.                                                         |
| `outcome`          | Stable success, rejection, failure, duplicate, or recovery code.                                         |
| `payload`          | Exact normalized event-specific evidence.                                                                |
| `payloadHash`      | SHA-256 of the canonical payload.                                                                        |
| `eventHash`        | SHA-256 of the canonical envelope excluding `eventHash`.                                                 |
| `idempotencyKey`   | Server-derived key preventing duplicate evidence for one business transition.                            |

Canonical JSON follows RFC 8785 JSON Canonicalization Scheme (JCS). Domain normalization fixes answer option ordering and represents dates as UTC ISO 8601 strings before JCS serialization. Numbers, nulls, Unicode, object key ordering, answer option ordering, and date formatting have test vectors. Hash algorithm and canonicalization versions are part of the manifest so a one-year-old bundle remains verifiable after code upgrades.

Payloads contain exact normalized values, not only hashes. Hashes establish integrity; the values establish what happened.

## Event catalogue

### Scope and baseline

- `ASSESSMENT_AUDIT_STARTED`
- `ASSESSMENT_BASELINE_RECORDED`
- `ASSESSMENT_MODE_CHANGED`
- `ASSESSMENT_COURSE_ASSIGNMENT_CHANGED`
- `ASSESSMENT_DELETED`
- `ASSESSMENT_AUDIT_RETENTION_STARTED`

### Lecturer and content mutations

- LiveQuiz metadata and settings changed.
- ElementBlock created, updated, reordered, activated, closed, or deleted.
- ElementInstance added, updated, reordered, removed, or deleted.
- Referenced source Element changed, including whether effective assessment content changed.
- Options, solutions, restrictions, points, timing, and access settings changed.
- Permissions or participant access changed.
- LiveQuiz scheduled, published, started, ended, graded, cancelled, reset, copied, or imported.

Each mutation records the operation, exact normalized before and after values, field-level difference, content versions and hashes, actor permission context, and correlation ID. A deletion records the full pre-delete snapshot. Bulk operations record a root manifest and per-item outcomes.

### Authentication and access

- Authentication succeeded or failed.
- Assessment access succeeded or failed.
- Assessment opened or resumed.
- ElementInstance viewed.
- Assessment session ended.

Failures use stable reason codes. Events never contain passwords, tokens, cookies, magic links, PINs, raw submitted usernames, or full request headers.

### Participant interaction

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

### Authoritative submission and processing

- `SUBMISSION_RECEIVED`
- `SUBMISSION_VALIDATED`
- `SUBMISSION_VALIDATION_FAILED`
- `SUBMISSION_DUPLICATE`
- `SUBMISSION_REJECTED`
- `SUBMISSION_PERSISTED`
- `SUBMISSION_PROCESSING_FAILED`
- `SUBMISSION_PROCESSING_RECOVERED`
- `SUBMISSION_SCORED`

`SUBMISSION_ATTEMPTED` proves only a browser action. `SUBMISSION_RECEIVED` proves that an authenticated server durably accepted the evidence. `SUBMISSION_PERSISTED` proves that it became the authoritative response. Rejection and failure events preserve exact reason codes and the last durable stage.

### Corrections and destructive actions

- Points corrected, with old value, new value, reason, and responsible User.
- Response modified or deleted, with full before and after snapshots and reason.
- Results recomputed.
- Assessment reset.
- Participant removed from the assessment Course.
- Bulk destructive operation, with input manifest and per-item result.

The business change and evidence event are committed atomically.

### System, delivery, and privileged access

- Scheduled lifecycle transition.
- Block aggregation, grading, or finalization.
- Audit delivery delayed, conflict detected, quarantined, or recovered.
- Manifest sealed, addendum sealed, or manifest verification failed.
- Retention cleanup started, completed, or partially failed.

Evidence reads and exports are not Klicker-produced audit events. Azure Storage data-plane diagnostics provide the external access trail for queries, including the Entra principal and operation metadata, while the operator tool creates an export receipt covered by the bundle's root hash. Direct and break-glass resource operations are additionally covered by Azure control-plane logs.

## Trust, privacy, and authorization

- Actor identities, server times, event IDs, permissions, and authentication outcomes come from trusted server context. Clients cannot override them.
- `receivedAt` is authoritative. `clientOccurredAt` is contextual and is checked for unreasonable clock skew.
- Azure stores stable pseudonymous database references, not names or email addresses. Evidence export does not call Klicker APIs or use Klicker permissions. Any separate identity resolution is outside this feature and requires independently authorized database access.
- Exact assessment answers are retained because they are the subject of potential disputes. Unrelated personal data is excluded.
- Stack traces are reduced to stable error codes and sanitized component metadata before audit insertion.
- The normal runtime identity can append but cannot query, update, or delete evidence.
- The conflict-verifier identity can read one addressed entity through a narrowly scoped service path but cannot append, update, or delete.
- A dedicated Azure Entra group containing exactly the user and their supervisor is the only human principal granted Table and manifest data-plane read access. Resource Group ownership alone is not treated as implicit data-plane authorization; the assignment is explicit and tested.
- No Klicker `UserRole`, Course permission, participant session, service endpoint, or frontend route grants evidence read access.
- The operator tool uses the invoking evidence owner's Azure token and has no shared export credential.
- The retention identity is separate, disabled outside its scheduled job window, and its code accepts only buckets beyond the retention boundary. Azure cannot enforce event age within a table credential, so immutable manifests and control-plane alerts remain the independent detection mechanism for misuse of this privileged identity.
- Required non-human identities are limited to append delivery, single-row conflict verification, manifest sealing, diagnostics, and retention. They do not establish a human access path.
- Blob immutability administration and any direct or break-glass storage access are restricted to the same two Azure evidence owners and monitored through Azure control-plane and Storage data-plane logs.
- Export artifacts are written locally to an operator-selected path. Klicker does not host them, issue download links, or retain copies.

No event contains raw credentials, JWTs, session cookies, magic links, PINs, authorization headers, connection strings, or Infisical values. Representative forbidden-data fixtures are scanned in automated tests.

## Failure semantics

### Critical lecturer mutations

The business mutation and outbox insert execute in the same Prisma transaction. If event validation, canonicalization, hashing, or outbox insertion fails, the entire mutation fails. Azure delivery is not in the transaction. An Azure or dispatcher outage leaves the committed outbox event pending and does not roll back or block the assessment.

### Participant selections

The PWA assigns monotonic client sequence numbers and retains unsent meaningful changes in persistent browser storage. It replays them in order after reconnecting. Browser shutdown, storage clearing, capacity exhaustion, or irrecoverable sequence discontinuity is represented by `AUDIT_GAP_DETECTED` when communication becomes possible. The UI remains usable; it must not claim that every local selection is authoritative.

### Participant submissions

The response API does not return a successful submission acknowledgement until the authenticated request, normalized response evidence, and `SUBMISSION_RECEIVED` outbox event are durable. A relay starts or retries Hatchet processing from that durable ingress record. The processor atomically commits the response state, ingress state, and processing evidence. Duplicate client retries resolve through the server idempotency key and generate a deterministic duplicate outcome rather than a second response.

### Delivery

- Transient provider failures retry without a finite drop limit.
- Outbox rows are not eligible for cleanup until Azure confirms insertion and manifest inclusion is scheduled.
- A create conflict is handed to the read-only conflict verifier. The expected hash is successful idempotency; a different hash is a critical incident.
- Invalid or unrepresentable rows remain durably quarantined and alert immediately.
- Successfully delivered outbox rows may be removed from PostgreSQL after seven days; PostgreSQL is a delivery record, not the one-year evidence store.
- Operational state exposes queue depth, oldest pending age, delivery latency, retry count, quarantine count, and recovery status.

The absence of an authoritative server event during a verified coverage interval supports a statement that Klicker has no evidence of receiving that action. The absence of a client-observed selection event never proves that the participant did not select it locally.

## Azure append-only and integrity design

Azure Table Storage is organized by assessment, UTC day, and deterministic shard. Root and chunk rows for one event share a partition. The exact Azure key mapping belongs to the adapter and is not exposed to producers. It supports bounded queries by assessment and time without a cross-account scan.

The adapter stores payloads up to 48 KiB of UTF-8 evidence per chunk. Larger canonical payloads are split deterministically. The root row stores total byte length, chunk count, complete payload hash, and ordered chunk hashes. Export reconstruction rejects missing, reordered, duplicated, or altered chunks.

Normal delivery uses only create operations. No upsert path exists. Deployment verification attempts create, query, update, and delete operations with each identity and fails unless the effective permissions match the intended matrix.

At 02:00 UTC, the manifest sealer writes a base manifest for each previous-day assessment bucket. Events delivered after sealing create immutable chained addenda after a 15-minute quiet period. Each manifest contains its schema version, assessment and time scope, sorted row identities and event hashes, preceding manifest hash, creation time, and manifest hash. The Blob container uses locked time-based immutability for at least the evidence retention period.

An export is verified only when every selected table row is covered by a valid manifest or addendum and every covered row expected in the selected scope exists with the expected hash. Events delivered less than 15 minutes before export may be reported as awaiting sealing; older unmanifested rows fail verification.

## Export and retention

Either authorized Azure evidence owner may run the repository's operator tool and filter evidence by assessment, time range, pseudonymous actor reference, correlation ID, event category, or outcome. The tool obtains an Entra token from the invoking operator and fails before querying if the principal lacks Azure data-plane read permission. There is no Klicker export API or UI.

The CSV is a readable timeline containing pseudonymous actor references. It is not the canonical integrity artifact.

Local export files are created with owner-only filesystem permissions, are never uploaded by the tool, and are not overwritten without explicit confirmation. Their later storage and deletion remain the evidence owner's responsibility.

The canonical JSON bundle contains:

- Canonical event records and payload chunks.
- Export filters, coverage start, generation time, and schema versions.
- Event count and sorted event hashes.
- Referenced manifests and addenda.
- File hashes and one root hash covering the complete bundle.
- Integrity status, warnings, and any detected coverage gap.
- A verification command or documented verifier version.

Each table event expires one calendar year after the end of its authoritative UTC day. Manifests and addenda are retained at least through the corresponding evidence boundary. The retention worker deletes all entities in a complete expired logical bucket using bounded Azure batches, verifies that the bucket is empty, and then allows its expired manifest blobs to be removed according to their immutable retention policy. Partial deletion is an alerted failure, not success.

The retention receipt records the bucket, event count, final manifest hash, start and completion times, responsible service identity, and outcome in the current audit period.

## Layer footprint

Expected implementation areas are:

- `packages/prisma`: durable audit scope, outbox, response-ingress state, and migrations; analytics schema sync where required.
- A new `packages/audit` workspace: canonical contract, normalization, hashing, provider-neutral interfaces, isolated provider adapters, and the Entra-authenticated operator export command. Azure types never cross its core interfaces.
- `packages/graphql`: scope resolution, baseline capture, lecturer mutations, participant ingestion, and generated operations where the active API architecture requires them. No evidence-read operation is exposed.
- `packages/hatchet`: outbox delivery, manifest, response relay, and retention task declarations.
- `apps/hatchet-worker-general`: delivery, sealing, and retention execution.
- `apps/response-api`: authenticated durable submission receipt.
- `apps/hatchet-worker-response-processor`: authoritative validation, persistence, scoring, and recovery evidence.
- `apps/frontend-pwa`: meaningful selection capture, persistent local queue, and gap reporting.
- `packages/prisma-data` and Playwright fixtures: synthetic assessment, lecturer, and participant evidence scenarios without real personal data.
- Deployment configuration: Azure Table, immutable Blob container, separate identities, environment configuration, dashboards, and alerts.
- `docs/` and relevant repository skills: architecture, operations, verification, and incident guidance.

GraphQL is the current protected application API boundary. At the start of the relevant stack layer, participant ingestion uses whichever protected API boundary has become the repository standard after the in-flight GraphQL-to-tRPC migration. Evidence reads bypass application APIs entirely and use Azure Entra authorization. The audit package and outbox contract remain transport-neutral.

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
- Provider conformance against an in-memory adapter and Azurite.
- Infrastructure permission tests for append, read, update, and delete denial/allowance.
- Transaction tests proving critical business changes cannot commit without outbox evidence.
- Response tests for attempted, received, validated, rejected, duplicate, persisted, scored, failed, and recovered stages.
- Failure injection for Azure, Hatchet, process, manifest, duplicate, malformed-event, and delayed-delivery failures.
- Authorization tests proving that no Klicker identity can retrieve evidence, infrastructure assertions proving that the evidence-owner group is the only human data-plane assignment, and a negative access test using a representative unauthorized Entra principal.
- Playwright complaint scenarios generate participant submission, lecturer deletion/modification, and correction evidence; the operator CLI then verifies and exports the resulting timeline outside the browser.
- Load tests demonstrating that audit capture does not materially degrade assessment submissions.

### Operational gates

- Dashboards expose outbox depth, oldest event, delivery latency, quarantine, client gaps, manifest age, denied storage access, and retention failures.
- Alerts have an owner and runbook.
- Schema readers remain compatible with every schema version retained for one year.
- Staging proves the separate Azure permission identities and immutable retention policy.
- A recovery exercise demonstrates delivery after an extended Azure outage.

### Rollout order

1. Deploy the dormant contract and outbox.
2. Deploy Azure delivery and generate synthetic evidence.
3. Deploy and verify Azure-owner export and retention.
4. Enable assessment capture in staging.
5. Run complaint-reconstruction, failure, privacy, and load scenarios.
6. Enable one controlled production assessment and record its explicit coverage start.
7. Independently verify its evidence export and operational metrics.
8. Expand only after both Azure evidence owners and operations sign off.

## Stacked PR topology

This feature uses two sequential native GitHub stacks so reviewer attention is not spread across one long chain. Every intermediate layer is green and feature-gated. One worktree and one topology owner are used per complete stack.

### Stack A: evidence platform

1. **Canonical contract and transactional outbox**
   - Event contract, validation, hashing, redaction, scope/outbox schema, transaction helper, and tests.
2. **Azure delivery and immutable manifests**
   - Provider adapter, dispatcher, retries, chunking, conflicts, quarantine, manifests, telemetry, deployment, and conformance tests.
3. **Azure-owner evidence export and retention**
   - Entra-authenticated operator tool, Azure role assignments, CSV/JSON bundles, verifier, Storage diagnostics, separate workload identities, one-year cleanup, and runbooks. No Klicker read API or UI is added.

Stack A is complete when a synthetic event survives an Azure outage, reaches Table Storage, is sealed into an immutable manifest, verifies successfully, and can be exported by either of the two Azure evidence owners but by no other human principal.

### Stack B: assessment coverage

Stack B starts only after Stack A is stable.

1. **Activation and baseline**
   - Scope resolver, readiness check, sticky coverage, rollout-current-state handling, and complete baseline.
2. **Lecturer mutations**
   - Exact before/after evidence for settings, blocks, instances, source references, lifecycle, permissions, corrections, reset, and deletion.
3. **Authoritative submissions**
   - Durable response ingress, server receipt, relay, validation, persistence, scoring, failure, recovery, and load evidence.
4. **Participant interactions**
   - Access/session events, meaningful selections, persistent PWA queue, sequence/gap semantics, authenticated ingestion, and browser tests.
5. **Production hardening and controlled rollout**
   - End-to-end dispute scenarios, failure recovery, privacy and authorization evidence, dashboards, alerts, runbooks, and pilot gate.

Stack B is complete when either Azure evidence owner can reconstruct lecturer and participant disputes from a verified export without relying on ordinary application logs.

The source branches for PRs #4872 and #4946 remain untouched until the union of both replacement stacks is compared with their complete diffs. Every deliberate omission is documented before maintainers decide whether to close the old PRs.

## Acceptance criteria

- Assessment activation cannot commit without its coverage marker and complete baseline outbox evidence.
- Every approved critical lecturer mutation either commits with evidence or does not commit.
- A successful assessment-submission acknowledgement has a durable authenticated server receipt.
- Persisted, rejected, duplicate, failed, recovered, and scored submission states are correlated and distinguishable.
- Client-only observations are labeled and cannot be mistaken for authoritative server evidence.
- Azure downtime accumulates a durable backlog and recovery delivers it without duplicates or silent loss.
- The append-delivery credential cannot query, update, or delete Table evidence.
- Table changes, missing rows, unexpected rows, and chunk corruption are detected through immutable manifests.
- Exactly the two designated Azure evidence owners—and no Klicker role or other human principal—can query Table evidence and manifests or run a successful export.
- A CSV and canonical JSON bundle can reconstruct a representative complaint and pass independent hash verification.
- Forbidden credentials and unrelated direct identifiers are absent from stored and exported canonical events.
- Evidence and manifests expire according to the approved one-year rule, with verified deletion receipts.
- Intermediate PR layers remain independently testable and production capture stays gated until the final rollout layer.
