---
type: Operations
title: Import/Export Production Runbook
description: Protected migration, backfill, canary-recovery, rollback, rotation, and evidence procedures for element packages.
timestamp: '2026-07-14'
tags:
  - import-export
  - operations
  - release
---

# Import/Export Production Runbook

**The feature is not releasable while any owner, protected runner, external evidence locator, authenticated canary driver, observability link, or decision below is `TBD`. Repository scripts make the sequence executable; they do not prove a target was changed safely.**

This runbook never enables import/export. The repository provides fail-closed operation aliases but no workflow that sequences or approves them. Run them only from a reviewed checkout through an organization-approved, reviewer-gated change process on a network-capable runner with target secrets injected outside Git.

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

Operational stdout/stderr is one JSON object containing stable codes, booleans, bounded counts, and allowlisted schema metadata. Never print or attach:

- secret values, authorization headers, capabilities, SAS URLs, database URLs, or connection strings;
- authored element text, answer values, names, filenames, media refs, or solutions;
- user, element, collection, media, artifact, receipt, staging, token/JTI, or blob identifiers;
- raw exception messages or stacks;
- secret manifests, Kubernetes Secret YAML, base64 values, or environment dumps.

Machine inspection intentionally includes migration checksums and allowlisted SQL schema definitions. Exact recovery identifiers live only in mode-`0600` recovery/progress manifests stored in the approved protected evidence system. Do not paste those manifests into command lines, logs, issues, or this repository.

Store every target artifact outside Git. Record only this redacted metadata in the release/change record:

```json
{
  "schemaVersion": 1,
  "environment": "stg-or-prd",
  "databaseTarget": "normal-or-assessment",
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

## Exact aliases and target selection

All aliases force `NODE_ENV=production`, suppress the Infisical wrapper banner so stdout stays machine-readable, and use the existing wrapper. Use `:stg` or `:prd` exactly:

```bash
pnpm --silent --filter @klicker-uzh/graphql script:import-export-inspect:stg
pnpm --silent --filter @klicker-uzh/graphql script:import-export-preflight:stg
pnpm --silent --filter @klicker-uzh/graphql script:import-export-media-hash-backfill:stg
pnpm --silent --filter @klicker-uzh/graphql script:import-export-fingerprint-backfill:stg
pnpm --silent --filter @klicker-uzh/graphql script:import-export-validate-constraints:stg
pnpm --silent --filter @klicker-uzh/graphql script:import-export-backfill-verify:stg
pnpm --silent --filter @klicker-uzh/graphql script:import-export-cleanup-dry-run:stg
pnpm --silent --filter @klicker-uzh/graphql script:import-export-canary:stg
```

The default database target is `normal`. For `assessment`, set `IMPORT_EXPORT_DATABASE_TARGET=assessment` and inject `IMPORT_EXPORT_ASSESSMENT_DATABASE_URL` from the protected environment before invoking the alias. Never put the URL in a command line or log. Assessment import/export remains disabled; assessment is selected only for schema inspection, migration, backfill, deferred-constraint validation, and verification.

Backfills require `IMPORT_EXPORT_PROGRESS_MANIFEST_PATH` and accept `IMPORT_EXPORT_RESUME_MANIFEST_PATH`. Each process holds a PostgreSQL advisory lock, persists a protected cursor after every batch, and stops after `IMPORT_EXPORT_BACKFILL_MAX_BATCHES` (default 100; allowed 1–1000). Exit code `2` with `BACKFILL_BOUNDED_STOP` means “resume or rerun,” not success. A rerun without a resume manifest safely starts at the lowest remaining stale row.

Cleanup dry-run and canary verification require `IMPORT_EXPORT_RECOVERY_MANIFEST_PATH`. The manifest is strict, owner-bound, capped at 5,000 IDs per resource type, and exact-scoped. Foreign-owned records stop the operation. Dry-run performs no mutation. Canary `verify-clean` reports retained receipts separately and fails while any active element, collection, media, artifact, or staging residue recorded in the manifest remains.

## Stop conditions

Stop immediately, leave both gates off, preserve evidence, and escalate to the named owner when any of these occurs:

- a missing, duplicate-successful, running, rolled-back-without-explanation, or checksum-mismatched migration row;
- an unexpected column/default/type, index definition, invalid/not-ready index, unvalidated constraint, or waiting target-table lock;
- a selected migration branch that does not match the inspection and DBA record;
- backup/PITR or previous-image smoke is not attested by its owner;
- a backfill lock collision, bounded stop without a recoverable manifest, stale version after verification, or lock/statement timeout during validation;
- storage/Redis/Hatchet readiness failure, missing workflow, Azure timeout, CORS/lifecycle mismatch, or probe cleanup residue;
- a recovery manifest owner mismatch, unsafe target, cleanup failure/backlog, or canary residue;
- any raw secret, authored value, identifier, URL, exception message, or stack appears in output;
- any repository P1–P3 finding remains open, an evidence link/owner is `TBD`, or a soak clock is incomplete/reset.

## Migration: approved dark deployment

Prerequisites: reviewed immutable commit/image digests; both normal and assessment gates proven off; backup and PITR verified; exact before-inspection stored; migration branch chosen by a DBA; approved runner reachable; external Helm deploy owner identified.

The named release coordinator must record each approval before a named operator executes the following stop-safe order for normal and assessment databases. The normal target uses the existing `prisma:deploy:qa` or `prisma:deploy:prod` alias; assessment deployment requires the same immutable `prisma migrate deploy` command with the approved assessment database injected as `DATABASE_URL`. The repository does not automate this target mapping.

1. verify recorded approvals and runner versions;
2. inspect migration rows/checksums, sizes, columns, indexes, constraints, locks, and stale versions;
3. record exactly one DBA-selected branch: `measured-small`, `large-indexes-precreated`, or `partial-history-reconciled`;
4. run immutable `prisma migrate deploy` through the environment wrapper;
5. inspect both databases again;
6. require the previous-image ordinary Element/AnswerCollection/MediaFile read-write smoke attestation;
7. store redacted inspection/branch evidence even after failure.

The large and partial-history SQL branches remain DBA-controlled because concurrent index statements and reconciliation cannot be safely inferred automatically. Follow [Data & Migrations](./data-and-migrations.md#importexport-additive-migration), store exact SQL/locks/WAL output in protected evidence, then record the precondition. The operator must never run `migrate dev`, edit migration history, drop schema, or enable a feature gate as part of this procedure.

The repository still does not identify the external Helm release/namespace executor. Until the release owner fills those values, deployment is blocked. The command contract, once approved, is:

```bash
helm upgrade --install "$RELEASE" deploy/charts/klicker-uzh-v3 \
  --namespace "$NAMESPACE" \
  --values "deploy/env-uzh-${TARGET}/values.yaml" \
  --set importExport.enabled=false \
  --set importExport.privatePreviewOnly=true \
  --atomic --wait --timeout 15m
```

`TARGET`, `RELEASE`, and `NAMESPACE` must come from the protected change record, not ad-hoc shell history. Render the selected v3 chart with those exact values and retain the reviewed manifest before execution.

## Post-deploy dark operations

After migration and dark application/worker deployment, prepare a protected canary recovery manifest populated by the authenticated canary driver. The repository can initialize an empty manifest and verify exact cleanup, but it does not contain target credentials or a production-authenticated actor. Assigning that driver and recording every created identity is a release blocker.

Run the aliases from [Exact aliases and target selection](#exact-aliases-and-target-selection) individually in the approved change process. Set `IMPORT_EXPORT_PROGRESS_MANIFEST_PATH`, optional `IMPORT_EXPORT_RESUME_MANIFEST_PATH`, and `IMPORT_EXPORT_RECOVERY_MANIFEST_PATH` only to protected mode-`0600` files. The repository does not contain an orchestrating workflow, so the named operator must record every result and stop in this order:

1. inspect normal and assessment;
2. storage/token/SAS round-trip preflight on normal;
3. bounded media-hash backfill on normal and assessment;
4. bounded answer-collection/element fingerprint backfill on normal and assessment;
5. validate the four deferred constraints under a 5-second lock timeout and 60-second statement timeout;
6. verify migrations/checksums, indexes, constraints, locks, and zero stale versions;
7. exact record-scoped cleanup dry-run;
8. exact owner-scoped canary residue verification;
9. store protected evidence even after failure.

An incomplete backfill exits before constraint validation. Resume from its protected progress manifest or rerun until it reports `BACKFILL_COMPLETE`; do not skip to verification.

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
- HTTP headers 10 seconds, request 120 seconds, upload body 60 seconds;
- Azure metadata/properties/SAS 10 seconds and transfer/delete/backfill 60 seconds;
- maximum preview under 2 seconds and 128 MiB incremental memory;
- maximum import transaction under 15 seconds and 128 MiB WAL;
- constraint validation lock budget, migration locks/WAL/duration, and previous-image compatibility;
- cleanup heartbeat/backlog/unsafe-target/oldest-age and canary age/result;
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
3. Roll backend, worker, and Manage images to the recorded previous immutable digests with `IfNotPresent`.
4. Keep assessment off, additive schema in place, cleanup/maintenance running, and recovery manifests protected.
5. Run inspect, previous-image ordinary read/write smoke, cleanup dry-run, and exact residue verification.
6. Fire/test the rollback alert path and record the incident/change decision.

Once the external release coordinates are approved, use this contract:

```bash
helm upgrade "$RELEASE" deploy/charts/klicker-uzh-v3 \
  --namespace "$NAMESPACE" \
  --values "deploy/env-uzh-${TARGET}/values.yaml" \
  --set importExport.enabled=false \
  --set backendGraphql.image.tag="$PREVIOUS_BACKEND_TAG" \
  --set hatchet.workers.general.image.tag="$PREVIOUS_WORKER_TAG" \
  --set frontendManage.image.tag="$PREVIOUS_MANAGE_TAG" \
  --atomic --wait --timeout 15m
```

Exact value paths must be render-verified against the selected chart before execution. Because the external release coordinates and executor are `TBD`, the rollback drill is currently **BLOCKING**.

## Staged decision gates

- **Staging dark:** both databases inspected/migrated/verified; immutable app/worker/frontend deployed dark; preflight/backfills/constraints/cleanup/rollback green.
- **Staging private preview:** named lecturers only; authenticated canaries at T0/T24/T48; at least 48 continuous hours with no scoring, privacy, exactly-once, cleanup, storage, rate-limit-infrastructure, workflow, or alert-routing failure. Material changes reset the clock.
- **Production dark:** repeat every target/infrastructure/rollback proof with immutable digests and `IfNotPresent`.
- **Production private preview:** named lecturers only; daily canary and at least seven continuous days. Material changes reset the clock.
- **General availability:** product/domain, backend, SRE, DBA, privacy/security, and rollback owners sign the complete bundle and issue an explicit go decision.

As of this document timestamp, all target owner/evidence/soak fields are `TBD`; therefore import/export is **not production ready**.
