---
type: Operations
title: Import/Export Production Runbook
description: Protected migration, backfill, canary-recovery, rollback, rotation, and evidence procedures for element packages.
timestamp: '2026-07-22'
tags:
  - import-export
  - operations
  - release
---

# Import/Export Production Runbook

**The feature is not releasable while any owner, protected runner, external evidence locator, authenticated canary driver, observability link, or decision below is `TBD`. Repository scripts make the sequence executable; they do not prove a target was changed safely.**

This runbook never enables import/export. The repository provides fail-closed operation aliases and one local wrapper that sequences only the historical media and fingerprint backfills plus their invariant check; it does not approve a release or sequence migrations, infrastructure checks, or canaries. Run it only from a reviewed checkout through an organization-approved, reviewer-gated change process on a network-capable runner with environment secrets injected outside Git.

## Release-control ledger

Every row is mandatory. A role without a named person and protected evidence locator is a release blocker.

| Responsibility                    | Named owner | Protected evidence locator | State        |
| --------------------------------- | ----------- | -------------------------- | ------------ |
| Release/change coordinator        | TBD         | TBD                        | **BLOCKING** |
| Database owner/DBA                | TBD         | TBD                        | **BLOCKING** |
| Azure storage owner               | TBD         | TBD                        | **BLOCKING** |
| Hatchet/worker owner              | TBD         | TBD                        | **BLOCKING** |
| Observability/on-call owner       | TBD         | TBD                        | **BLOCKING** |
| Privacy/security reviewer         | TBD         | TBD                        | **BLOCKING** |
| Authenticated canary owner/driver | TBD         | TBD                        | **BLOCKING** |
| Rollback commander                | TBD         | TBD                        | **BLOCKING** |
| Staging 48-hour decision          | TBD         | TBD                        | **BLOCKING** |
| Production seven-day decision     | TBD         | TBD                        | **BLOCKING** |

The approved runner and reviewer boundary, backup/PITR evidence, previous-image smoke harness, authenticated target canary driver, dashboard/alerts, Azure policy evidence, ingress edge probes, staging soak, and production soak are external dependencies. Until each has a real artifact and owner, the answer to “production ready?” remains **no**.

## Privacy and evidence rules

Each underlying operation emits one JSON object containing stable codes, booleans, bounded counts, and allowlisted schema metadata. The local backfill wrapper emits those objects in order and, after a bounded stop, one constant rerun command. Never print or attach:

- secret values, authorization headers, capabilities, SAS URLs, database URLs, or connection strings;
- authored element text, answer values, names, filenames, media refs, or solutions;
- user, element, collection, media, artifact, receipt, staging, token/JTI, or blob identifiers;
- raw exception messages or stacks;
- secret manifests, Kubernetes Secret YAML, base64 values, or environment dumps.

Machine inspection intentionally includes migration checksums and allowlisted SQL schema definitions. Exact recovery identifiers live only in mode-`0600` recovery/progress manifests stored in the approved protected evidence system. Do not paste those manifests into command lines, logs, issues, or this repository.

Store every target artifact outside Git. The following release-record envelope remains schema version 1 and is distinct from the protected canary recovery manifest, whose executable schema is version 2. Record only this redacted metadata in the release/change record:

```json
{
  "schemaVersion": 1,
  "environment": "stg-or-prd",
  "databaseTarget": "normal",
  "ownerRole": "named-role",
  "owner": "TBD-blocking",
  "changeId": "protected-change-record-key",
  "commitSha": "reviewed-revision",
  "imageDigests": ["immutable-digest-reference"],
  "commandAlias": "script:import-export-inspect:stg",
  "startedAt": "RFC-3339 timestamp",
  "finishedAt": "RFC-3339 timestamp",
  "artifactLocator": "TBD-protected-locator-blocking",
  "artifactSha256": "sha256-of-protected-artifact",
  "result": "PASS-or-FAIL",
  "decision": "GO-or-NO-GO"
}
```

Expected protected bundle groups are `00-repo-gates`, `10-helm-and-secret-contract`, `20-migration`, `30-azure-and-edge`, `40-hatchet`, `50-backfills-and-cleanup`, `60-canary`, `70-dashboards-alerts-redaction`, and `80-soak-and-signoff`.

## Exact commands and environment selection

All aliases force `NODE_ENV=production`, suppress the Infisical wrapper banner so stdout stays machine-readable, and use the existing Infisical wrapper. They resolve only the selected environment's standard `DATABASE_URL`. The retired `IMPORT_EXPORT_DATABASE_TARGET=assessment` selector is rejected; `IMPORT_EXPORT_ASSESSMENT_DATABASE_URL` is not read.

Run the historical backfill through exactly one of these commands (**config-derived**):

```bash
./util/import-export-backfill.sh stg
./util/import-export-backfill.sh prd
```

The local wrapper accepts no other arguments. It creates `~/.klicker/import-export-backfill/<environment>` at mode `0700`, keeps the media and didactic progress manifests at mode `0600`, and refuses repository-local or symlinked manifest paths. It runs media classification with one fingerprint-only invalidation of every active element, a full active-element-and-collection didactic rescan, and active-resource invariant verification in that order. The invalidation changes only `importFingerprint` and `importFingerprintVersion`; it preserves authored `Element.version` and `updatedAt`. `IMPORT_EXPORT_BACKFILL_MAX_BATCHES` retains the existing default of 100 and allowed range of 1–1000; URLs and secrets are never command arguments.

The lower-level aliases remain available for the other reviewed operations:

```bash
pnpm --silent --filter @klicker-uzh/graphql script:import-export-inspect:stg
pnpm --silent --filter @klicker-uzh/graphql script:import-export-readiness:stg
pnpm --silent --filter @klicker-uzh/graphql script:import-export-preflight:stg
pnpm --silent --filter @klicker-uzh/graphql script:import-export-validate-constraints:stg
pnpm --silent --filter @klicker-uzh/graphql script:import-export-cleanup-dry-run:stg
pnpm --silent --filter @klicker-uzh/graphql script:import-export-canary:stg
```

Use the matching `:prd` alias for production. `inspect` is diagnostic and can exit successfully while individual readiness checks are false. `readiness` is the release gate: it emits `TARGET_NOT_READY` with an `incomplete` outcome and exits `2` unless every migration-history, schema, constraint, trigger, fingerprint, and lock check passes while the master gate is off.

Each media backfill, didactic backfill, and constraint-validation process acquires the same rollout advisory mutex through `packages/graphql/src/lib/importExportOperations/database.ts:withAdvisoryLock` on one dedicated PostgreSQL session. The session remains pinned for the operation, connection loss is checked before subsequent persistence, and unlock is verified before a successful exit; this keeps the three mutation phases from overlapping even though the local wrapper launches separate processes. A backfill persists its protected cursor after every batch and exits `2` with `BACKFILL_BOUNDED_STOP` when it reaches the invocation bound. The wrapper propagates that non-success status and prints the exact safe rerun command; rerunning resumes from the protected manifest. Completed evidence is rescanned from the lowest active IDs, so a failed final invariant check can be repaired by rerunning. Exit `0` is success; any other nonzero status is a hard stop. Assessment import/export remains disabled and is not an operations database target.

Cleanup dry-run and canary verification require `IMPORT_EXPORT_RECOVERY_MANIFEST_PATH`. `packages/graphql/src/lib/importExportOperations/runtime.ts:ImportExportRecoveryManifestSchema` defines strict recovery-manifest schema version 2: it is owner-bound, capped at 5,000 IDs per resource type, and exact-scoped. Initialization requires a valid `BLOB_STORAGE_ACCOUNT_NAME` and records both `databaseIdentity` (a SHA-256 context fence over the current database name, server address, and server port) and `storageIdentity` (a SHA-256 context fence over that Azure storage-account name). Dry-run and `verify-clean` recompute both identities before any resource query and reject a mismatch; foreign-owned records also stop the operation. These hashes are context fences, not restore epochs: an in-place PITR/restore or proxy repoint can preserve the same tuple. After any restore, database repoint, or storage-configuration change, stop, preserve the old manifest as protected evidence, have the named recovery owner reconcile its recorded scope, and initialize a new manifest even if the automatic identity check would still pass. Dry-run performs no mutation. Canary `verify-clean` reports retained receipts separately and fails while any active element, collection, media, artifact, or staging residue recorded in the manifest remains.

## Stop conditions

Stop immediately, leave both gates off, preserve evidence, and escalate to the named owner when any of these occurs:

- a missing, duplicate-successful, running, rolled-back-without-explanation, or checksum-mismatched migration row;
- an unexpected column/default/type, index definition, invalid/not-ready index, unvalidated constraint, or waiting target-table lock;
- a selected migration branch that does not match the inspection and DBA record;
- backup/PITR or previous-image smoke is not attested by its owner;
- a backfill lock collision, bounded stop without a recoverable manifest, stale version after verification, or lock/statement timeout during validation;
- storage/Redis/Hatchet readiness failure, missing workflow, Azure timeout, CORS/lifecycle mismatch, or probe cleanup residue;
- a recovery manifest owner/context mismatch, restore/repoint with an unreconciled manifest, unsafe target, cleanup failure/backlog, or canary residue;
- any raw secret, authored value, identifier, URL, exception message, or stack appears in output;
- any repository P1–P3 finding remains open, an evidence link/owner is `TBD`, or a soak clock is incomplete/reset.

## Migration: approved dark deployment

Prerequisites: reviewed immutable commit/image digests; the normal feature gate proven off and assessment mode still disabled; backup and PITR verified; exact before-inspection stored; migration branch chosen by a DBA; approved runner reachable; external Helm deploy owner identified.

The named release coordinator must record each approval before a named operator executes the following stop-safe order against the selected environment's standard database. Use the existing `prisma:deploy:qa` or `prisma:deploy:prod` alias; import/export does not provide an assessment database mapping.

1. verify recorded approvals and runner versions;
2. inspect migration rows/checksums/step counts (including failed or duplicate active attempts), exact required column shapes, structural index definitions, CHECK/FK column shapes plus migration-sealed canonical CHECK expressions, ownership/immutability trigger event/update-column bindings plus repository-matched function bodies, locks, and stale versions, including the immutable `20260716085603_import_export_fingerprint_repair_indexes` migration and its `20260722100000_import_export_null_fingerprint_repair_indexes` follow-up, all four ready/valid repair-scan indexes (including the two active-null partial indexes), and `Element_answer_collection_deleted_id_idx`;
3. record exactly one DBA-selected branch: `measured-small`, `large-indexes-precreated`, or `partial-history-reconciled`;
4. run immutable `prisma migrate deploy` through the environment wrapper;
5. inspect the database again;
6. require the previous-image ordinary Element/AnswerCollection/MediaFile read-write smoke attestation;
7. store redacted inspection/branch evidence even after failure.

The large and partial-history SQL branches remain DBA-controlled because concurrent index statements and reconciliation cannot be safely inferred automatically. Follow [Data & Migrations](./data-and-migrations.md#importexport-additive-migration), including concurrent pre-creation and exact ready/valid definition checks for `AnswerCollection_repair_fpv_deleted_id_idx`, `Element_repair_fpv_deleted_id_idx`, `AnswerCollection_repair_null_fp_id_idx`, `Element_repair_null_fp_id_idx`, and `Element_answer_collection_deleted_id_idx`; store exact SQL/locks/WAL output in protected evidence, then record the precondition. The operator must never run `migrate dev`, edit migration history, drop schema, or enable a feature gate as part of this procedure.

The repository still does not identify the external Helm release/namespace executor. Until the release owner fills those values, deployment is blocked. Record immutable `NEXT_BACKEND_TAG`, `PREVIOUS_MANAGE_TAG`, and `NEXT_MANAGE_TAG` values before rendering either phase. Backend/Manage compatibility is directional: the next backend serves both Manage protocols, while the previous backend cannot execute the next Manage upload/finalization operations. Do not combine their image changes in one Helm upgrade, even while the feature gate is dark.

The command contract, once approved, is the following two-phase deployment. Phase 1 deploys the dark backend/application/worker release while retaining the previous Manage image:

```bash
helm upgrade --install "$RELEASE" deploy/charts/klicker-uzh-v3 \
  --namespace "$NAMESPACE" \
  --values "deploy/env-uzh-${TARGET}/values.yaml" \
  --set importExport.enabled=false \
  --set importExport.privatePreviewOnly=true \
  --set backendGraphql.image.tag="$NEXT_BACKEND_TAG" \
  --set backendGraphql.image.pullPolicy=IfNotPresent \
  --set frontendManage.image.tag="$PREVIOUS_MANAGE_TAG" \
  --set frontendManage.image.pullPolicy=IfNotPresent \
  --atomic --wait --timeout 15m

kubectl --namespace "$NAMESPACE" rollout status deployment \
  --selector "app.kubernetes.io/instance=$RELEASE,app.kubernetes.io/component=backend-graphql" \
  --timeout 15m
```

Require the backend rollout to complete, prove every ready backend pod runs `NEXT_BACKEND_TAG`, and exercise the legacy Manage media-upload path against the new backend. A partial rollout or any old backend pod is a hard stop. Only then render, review, and execute phase 2, retaining the next backend explicitly while changing Manage:

```bash
helm upgrade "$RELEASE" deploy/charts/klicker-uzh-v3 \
  --namespace "$NAMESPACE" \
  --values "deploy/env-uzh-${TARGET}/values.yaml" \
  --set importExport.enabled=false \
  --set importExport.privatePreviewOnly=true \
  --set backendGraphql.image.tag="$NEXT_BACKEND_TAG" \
  --set backendGraphql.image.pullPolicy=IfNotPresent \
  --set frontendManage.image.tag="$NEXT_MANAGE_TAG" \
  --set frontendManage.image.pullPolicy=IfNotPresent \
  --atomic --wait --timeout 15m

kubectl --namespace "$NAMESPACE" rollout status deployment \
  --selector "app.kubernetes.io/instance=$RELEASE,app.kubernetes.io/component=frontend-manage" \
  --timeout 15m
```

Require every ready Manage pod to run `NEXT_MANAGE_TAG`, then exercise the finalization-aware upload path while the feature remains dark. `TARGET`, `RELEASE`, and `NAMESPACE` must come from the protected change record, not ad-hoc shell history. Render both selected v3 chart phases with those exact values and retain both reviewed manifests before execution. Confirm that the rendered normal general-worker `HATCHET_WORKFLOWS` contains all required maintenance keys: `refreshImportExportFingerprints`, `repairImportExportFingerprints`, and `cleanupImportExportPackages`. A production worker missing any key must fail startup; do not remove the repair or cleanup workflows merely because the user-facing gate is dark. Assessment workers must contain none of these keys.

## Post-deploy dark operations

After migration and dark application/worker deployment, prepare a protected canary recovery manifest populated by the authenticated canary driver. The repository can initialize an empty manifest and verify exact cleanup, but it does not contain target credentials or a production-authenticated actor. Assigning that driver and recording every created identity is a release blocker.

Confirm every previous application and worker image that can commit version-1/null didactic state has drained before starting the version-2 backfill. Run the commands from [Exact commands and environment selection](#exact-commands-and-environment-selection) in the approved change process. The named operator must record every result and stop in this order:

1. inspect the environment database;
2. run the storage/token/SAS round-trip preflight;
3. rerun `./util/import-export-backfill.sh stg|prd` until its media → didactic → invariant sequence exits `0`;
4. validate the four existing deferred constraints under a 5-second lock timeout and 60-second statement timeout;
5. run the strict readiness alias and require every migration/checksum/step-count, column, index, constraint, trigger, fingerprint, and lock check to pass;
6. run the exact record-scoped cleanup dry-run;
7. run exact owner-scoped canary residue verification;
8. store protected evidence even after failure.

An incomplete backfill exits before the next phase. Rerun the same wrapper command until both backfills report `BACKFILL_COMPLETE` and the final verifier reports `FINGERPRINT_INVARIANT_VERIFIED`. Progress manifests are bound to a privacy-safe hash of the current database name, server address, and server port, so a changed tuple is rejected automatically. That tuple can remain unchanged across an in-place restore or a repoint behind the same proxy; after any restore or repoint, preserve the old progress manifests as evidence and restart the media → didactic → invariant sequence from zero with new manifests. The verifier checks one database snapshot and requires every active element and answer collection to have the current didactic version plus a valid lowercase SHA-256 fingerprint and every media row to have a current classification. It is narrower than release readiness: run `script:import-export-readiness:<environment>` after constraint validation and require exit `0`. Keep the feature disabled unless both the invariant verifier and strict readiness gate pass.

The non-null active-resource database constraint is intentionally not part of this rollout. Add and validate it only in a later migration after the selected environment is backfilled and previous-image compatibility is no longer required.

The scheduled `repair-import-export-fingerprints` workflow is only a post-deploy safety net for unexpected drift. It runs every 15 minutes with a ten-minute execution timeout, stops new work cooperatively after eight minutes, and processes no more than 500 answer collections followed by 500 elements per invocation. Separate version-stale and active-null repair indexes keep its zero-backlog probes indexed. It uses the next cron rather than immediate Hatchet retries, so one run cannot consume multiple cadence windows. It does not classify historical media, hold the rollout advisory lock, persist a rollout progress manifest, or prove the initial corpus was backfilled. Never replace the wrapper and strict-readiness steps with a wait for the scheduled repair.

Before proceeding to private preview, capture at least one successful scheduled-repair execution from the deployed normal worker and one cleanup execution within its 45-minute timeout. Cleanup must stop new work by its 40-minute cooperative budget, leaving any remaining record-scoped ledger backlog for the next hourly run. Its observability must distinguish hard failures from a budget stop. Verify that repair and cleanup each enforce one active run with `CANCEL_NEWEST`; a duplicate cron must be cancelled without interrupting the active run. The repair payload may contain only `processedAnswerCollections`, `processedElements`, `answerCollectionBacklogRemaining`, `elementBacklogRemaining`, and optional `stoppedEarly`; it must not contain IDs or authored values. The flags are fresh database rechecks after bounded processing, not estimates based on whether the final batch was full. A cancelled repair emits no successful payload and starts no backlog queries; its next cron performs the fresh recheck. A backlog flag that remains true across successive invocations, a missing execution beyond the task's cadence allowance, a cleanup run that reaches its Hatchet timeout instead of stopping cooperatively, overlapping maintenance runs, or a hard task failure is a stop condition and must page the named Hatchet/observability owner.

## Authenticated canary and recovery

The external authenticated driver must use a dedicated environment-specific lecturer and the supported application/API operations. It must cover all nine element types, shared media and collections, tag absence, `REVIEW`, private ownership/permissions, didactic equivalence, gradable scoring equivalence, exactly-once replay, and absence of participant/psychometric history. It writes every created element, collection, media, artifact, receipt, and staging ID into the protected recovery manifest before the next operation.

On success or interruption:

1. retire active elements/collections through supported user operations;
2. run exact artifact/media cleanup for only recorded targets;
3. preserve receipts/audit rows until documented retention expiry;
4. run `cleanup-dry-run` and `canary` `verify-clean` against the same manifest;
5. require zero active recorded resource/blob residue and separately record retained receipt count/expiry;
6. leave the manifest in `clean` or `recovery-required` state in protected evidence.

The database verifier cannot prove blob absence by itself. Azure-list evidence for exactly the recorded blob targets and a zero-residue assertion from the external driver are mandatory. The current authenticated driver, owner, and target evidence locator are `TBD`, so this remains **BLOCKING**.

## Frozen budgets and edge evidence

The release record must attach measured evidence for:

- maximum archive and upload size 10 MiB, aggregate media/reference/parser work limits, and rejected over-limit/slow-body cases;
- upload concurrency capped at one live body per user and four globally by default, including fail-closed Redis acquisition/renewal evidence and bounded-memory measurements;
- import concurrency capped at one live execution per user and four globally by default, including fail-closed Redis acquisition/renewal and PostgreSQL receipt-fencing evidence;
- feature-owned upload-body deadline 60 seconds; global server and ingress
  header/request budgets remain platform controls and are not mutated by the
  import/export feature;
- Azure metadata/properties/SAS 10 seconds and transfer/delete/backfill 60 seconds;
- Hatchet fingerprint refresh 5 minutes with a 4-minute cooperative work
  budget, scheduled repair 10 minutes with an 8-minute cooperative work budget
  on a 15-minute cadence, and cleanup 45 minutes with a 40-minute cooperative
  work budget on an hourly cadence; all three use zero immediate retries;
- maximum preview under 2 seconds and 128 MiB incremental memory;
- maximum import transaction under 15 seconds and 128 MiB WAL;
- constraint validation lock budget, migration locks/WAL/duration, and previous-image compatibility;
- fingerprint-repair cadence, processed counts, per-resource backlog flags, cleanup heartbeat/backlog/unsafe-target/oldest-age, and canary age/result;
- exact/max/over-limit and slow-client HAProxy/controller probes.

Repository defaults are requirements, not target proof. Missing or exceeded evidence is a no-go.

## Token-secret rotation

Rotation is fail-closed and uses a new high-entropy secret from the external secret manager. Never display old/new values.

1. Set the master gate false and verify the UI and all user operations are unavailable.
2. Drain active import/export operations; keep maintenance/cleanup and worker health enabled.
3. Wait at least the longest issued import token lifetime (one hour) plus clock allowance, or formally accept that old signed tokens will reject after rotation. Upload/download capabilities are bounded to 15 minutes plus five seconds.
4. Rotate the external secret and roll every normal backend/worker consumer; assessment must not receive the token secret.
5. Prove old capabilities/tokens reject, newly issued capabilities work, worker readiness is green, and exact cleanup remains observable.
6. Run preflight, cleanup dry-run, and the authenticated canary before any private-preview re-enable decision.

Reloader annotations may restart consumers, but actual restart/reload evidence is mandatory. A partial consumer rollout is a stop condition.

## Rollback

Rollback never drops the additive schema, reverses immutable migrations, deletes evidence, or stops record-scoped cleanup.

1. Set `importExport.enabled=false` in the protected values source and deploy it first.
2. Verify capability/UI fail-closed behavior and drain in-flight requests.
3. Roll Manage back first while pinning the current feature-compatible backend, then require every previous-Manage pod to be ready. Only after the next-client protocol has drained may the backend roll back. Never change both images in one Helm upgrade. Pin the current maintenance-capable general-worker digest throughout; a pre-feature worker does not register the required repair and record-scoped cleanup workflows.
4. Keep assessment off, additive schema in place, the pinned maintenance worker healthy, cleanup/maintenance running, and recovery manifests protected. Do not select a previous worker digest until every recorded artifact/staging target is clean and an explicit follow-up rollback decision has removed the feature workflow allowlist.
5. Run inspect, previous-image ordinary read/write smoke, cleanup dry-run, and exact residue verification.
6. Fire/test the rollback alert path and record the incident/change decision.

Once the external release coordinates are approved and the gate-off deployment from step 1 is verified, record `CURRENT_BACKEND_TAG`, `PREVIOUS_BACKEND_TAG`, and `PREVIOUS_MANAGE_TAG`. First roll Manage back while retaining the current backend:

```bash
helm upgrade "$RELEASE" deploy/charts/klicker-uzh-v3 \
  --namespace "$NAMESPACE" \
  --values "deploy/env-uzh-${TARGET}/values.yaml" \
  --set importExport.enabled=false \
  --set backendGraphql.image.tag="$CURRENT_BACKEND_TAG" \
  --set backendGraphql.image.pullPolicy=IfNotPresent \
  --set hatchet.workers.general.image.tag="$ROLLBACK_MAINTENANCE_WORKER_TAG" \
  --set hatchet.workers.general.image.pullPolicy=IfNotPresent \
  --set frontendManage.image.tag="$PREVIOUS_MANAGE_TAG" \
  --set frontendManage.image.pullPolicy=IfNotPresent \
  --atomic --wait --timeout 15m

kubectl --namespace "$NAMESPACE" rollout status deployment \
  --selector "app.kubernetes.io/instance=$RELEASE,app.kubernetes.io/component=frontend-manage" \
  --timeout 15m
```

Require every ready Manage pod to run `PREVIOUS_MANAGE_TAG`. Then roll the backend back while retaining the previous Manage and maintenance-capable worker:

```bash
helm upgrade "$RELEASE" deploy/charts/klicker-uzh-v3 \
  --namespace "$NAMESPACE" \
  --values "deploy/env-uzh-${TARGET}/values.yaml" \
  --set importExport.enabled=false \
  --set backendGraphql.image.tag="$PREVIOUS_BACKEND_TAG" \
  --set backendGraphql.image.pullPolicy=IfNotPresent \
  --set hatchet.workers.general.image.tag="$ROLLBACK_MAINTENANCE_WORKER_TAG" \
  --set hatchet.workers.general.image.pullPolicy=IfNotPresent \
  --set frontendManage.image.tag="$PREVIOUS_MANAGE_TAG" \
  --set frontendManage.image.pullPolicy=IfNotPresent \
  --atomic --wait --timeout 15m

kubectl --namespace "$NAMESPACE" rollout status deployment \
  --selector "app.kubernetes.io/instance=$RELEASE,app.kubernetes.io/component=backend-graphql" \
  --timeout 15m
```

`ROLLBACK_MAINTENANCE_WORKER_TAG` is the reviewed current feature-capable worker digest, not the pre-feature worker tag. Require every ready backend pod to run `PREVIOUS_BACKEND_TAG`, then repeat the previous-client ordinary upload smoke. Exact value paths and both rendered rollback manifests plus the maintenance workflow allowlist must be verified against the selected chart before execution. Because the external release coordinates and executor are `TBD`, the rollback drill is currently **BLOCKING**.

## Staged decision gates

- **Staging dark:** the environment database inspected/migrated/verified; immutable app/worker/frontend deployed dark; preflight/backfills/constraints/cleanup/rollback green.
- **Staging private preview:** named lecturers only; authenticated canaries at T0/T24/T48; at least 48 continuous hours with no scoring, privacy, exactly-once, cleanup, storage, rate-limit-infrastructure, workflow, or alert-routing failure. Material changes reset the clock.
- **Production dark:** repeat every target/infrastructure/rollback proof with immutable digests and `IfNotPresent`.
- **Production private preview:** named lecturers only; daily canary and at least seven continuous days. Material changes reset the clock.
- **General availability:** product/domain, backend, SRE, DBA, privacy/security, and rollback owners sign the complete bundle and issue an explicit go decision.

As of this document timestamp, all target owner/evidence/soak fields are `TBD`; therefore import/export is **not production ready**.
