---
type: Reference
title: Import/Export Error Contract
description: Closed server-owned error and warning codes, localized recovery behavior, regression ownership, and telemetry privacy.
timestamp: '2026-07-16'
tags:
  - graphql
  - elements
  - security
  - frontend
---

# Import/Export Error Contract

**A package cannot choose what the UI says.** Import/export exposes only server-owned error and warning enums. Authored ZIP text, storage/database errors, filenames, URLs, paths, blob names, hashes, stack messages, and raw exceptions must never become user-visible messages or telemetry dimensions.

## Contract boundary

`packages/graphql/src/lib/importExportErrors.ts` is the source of truth for `ImportExportErrorCode` and `ImportExportWarningCode`. `ImportExportDomainError` keeps an internal cause, while `toImportExportGraphQLError` emits only `Import/export request failed.` and a stable `extensions.code`. Unknown or uncoded failures become `IMPORT_EXPORT_INFRASTRUCTURE_FAILURE`. The Pothos enums in `packages/graphql/src/schema/elementImportExport.ts` expose the same closed sets.

Package manifests may contain only known warning codes. The importer caps and parses that list for wire compatibility, then discards it and derives warnings again from validated package contents. A package therefore cannot forge warning text or recovery guidance.

`apps/frontend-manage/src/lib/importExportErrors.ts` accepts only generated enum members. `useElementImportWorkflow.ts` maps import errors and warnings, while `DownloadModal.tsx` maps export errors and warnings, to EN/DE strings with an operation-appropriate generic fallback. `UploadModal.tsx` renders only the safe hook state. Feature components never render `Error.message`, raw Apollo messages, or unknown codes. The shared Apollo transport remains feature-agnostic and emits detailed server-provided GraphQL/network diagnostics only during server-side execution; browser consoles never receive those raw messages or extensions.

## Error vocabulary and recovery

| Boundary                             | Stable codes                                                                                                                                                                                     | User recovery contract                                                                                                                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capability and authorization         | `IMPORT_EXPORT_DISABLED`, `ELEMENT_EXPORT_PERMISSION`, `ANSWER_COLLECTION_EXPORT_PERMISSION`                                                                                                     | Keep gate details and object identity private. Ask the user to retry later, remove unauthorized selections, or obtain administrator/owner permission.                                             |
| Export selection and source validity | `TOO_MANY_ELEMENTS`, `EXPORT_AGGREGATE_LIMIT`, `EXPORT_PACKAGE_TOO_LARGE`, `ELEMENT_NOT_PORTABLE`                                                                                                | Split the selection, reduce media/complex content, or correct the legacy source element. Never expose which hidden object failed authorization.                                                   |
| Concurrent export stability          | `EXPORT_SOURCE_CHANGED`                                                                                                                                                                          | Reopen preview and retry from a fresh source snapshot. Do not publish an archive assembled from mixed source versions.                                                                            |
| Rate and concurrency control         | `IMPORT_EXPORT_RATE_LIMITED`, `IMPORT_EXPORT_RATE_LIMIT_UNAVAILABLE`                                                                                                                             | For a user limit, wait for the window and retry. For unavailable Redis/control-plane state, report a temporary service failure; never mislabel it as user misuse.                                 |
| Upload and artifact lifecycle        | `IMPORT_UNSUPPORTED_FILE_TYPE`, `IMPORT_UPLOAD_TOO_LARGE`, `IMPORT_ARTIFACT_QUOTA_EXCEEDED`, `IMPORT_PACKAGE_NOT_FOUND`, `IMPORT_PACKAGE_EXPIRED`                                                | Select a bounded ZIP, wait for quota to expire, or upload again. Never echo a filename or storage target.                                                                                         |
| Package trust boundary               | `IMPORT_INVALID_PACKAGE`, `IMPORT_MANIFEST_NOT_AT_ROOT`, `IMPORT_UNSUPPORTED_PACKAGE`, `IMPORT_INVALID_OPTIONS`, `IMPORT_UNSAFE_REFERENCE`, `IMPORT_AGGREGATE_LIMIT`, `IMPORT_PACKAGE_TOO_LARGE` | Use a fresh current KlickerUZH export, compress the package contents at the root, split/shorten the package, or correct the source. Parser details, paths, refs, and authored data stay internal. |
| Capability and exactly-once import   | `IMPORT_TOKEN_INVALID`, `IMPORT_TOKEN_EXPIRED`, `IMPORT_REPLAY_MISMATCH`, `IMPORT_IN_PROGRESS`, `IMPORT_PACKAGE_CHANGED`, `IMPORT_INVALID_SELECTION`                                             | Revalidate/upload, wait for the active lease, or reopen a fresh preview. A committed/replayed import is never reported as failed merely because post-commit refresh or cleanup warns.             |
| Internal dependency failure          | `IMPORT_EXPORT_INFRASTRUCTURE_FAILURE`                                                                                                                                                           | Retry later and then contact support. Never call an unknown storage/database/parser failure an invalid user package.                                                                              |

## Warning vocabulary

Warnings are non-blocking, deduplicated, and localized. The UI may continue only after showing the consequence.

| Stable warning                       | Contract                                                                                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `IMPORT_STATUS_NORMALIZED_TO_REVIEW` | Imported elements are private copies in `REVIEW` and require lecturer review before use.                                                       |
| `IMPORT_EXTERNAL_MEDIA_NOT_PACKAGED` | External auto-loading media is not copied and is replaced by a visible locale-neutral placeholder; ordinary user-activated links remain links. |
| `IMPORT_MEDIA_NOT_INCLUDED`          | Inaccessible, unsupported, unsafe, or oversized first-party media is omitted and replaced consistently in preview and import.                  |
| `IMPORT_UNUSED_MEDIA`                | Declared but unreferenced package media is ignored; the warning is derived from validated exact media closure.                                 |
| `IMPORT_CLEANUP_PENDING`             | The import committed, but post-commit cleanup is pending. Refresh later; do not retry the import.                                              |

Tags are outside the package contract and therefore have no import/export warning or error semantics.

## Observability privacy floor

`packages/graphql/src/lib/importExportTelemetry.ts:emitImportExportTelemetry` emits a versioned `import_export_operation` envelope. It allowlists operation, outcome, service, environment, a UUID correlation ID, stable uppercase code, backlog state, and bounded non-negative integer metrics. Invalid codes become `UNCLASSIFIED`; invalid identifiers are replaced. Emission is fail-soft and cannot change a request result.

Telemetry may contain duration, limits, counts, bytes, retry/replay/cleanup outcomes, and rate-window values. It must not contain authored names/content/explanations/solutions, URLs, filenames, package paths, blob names, tags, participant data, tokens, JTI values, hashes, raw exceptions, or credentials. Target dashboard, alert-routing, retention, and on-call evidence remain deployment gates in the [production runbook](./import-export-production-runbook.md), not missing application behavior.

## Regression ownership

- Closed enums, fallback redaction, and telemetry sanitization: `packages/graphql/test/importExportErrors.test.ts` and `importExportTelemetry.test.ts`.
- Export authorization, snapshot stability, portability, sizing, and storage ordering: `elementImportExport{Database,DatabaseSecurity,Security}.test.ts`, `elementExport{PackageService,PreviewService,PublicationGuard,SnapshotConsistency,SnapshotStorageOrdering}.test.ts`, `portableExport*.test.ts`, and `importExportPackageStorage.test.ts`.
- ZIP/package parsing, exact closure, aggregate limits, and option validation: `elementImportExport{Validation,PackageBoundaries}.test.ts`, `importExportPackageContract.test.ts`, `elementDomain.test.ts`, and `zip.test.ts`.
- Tokens, durable artifacts, media staging, leases, replay, and exactly-once behavior: `elementImportToken.test.ts`, `elementImportExactlyOnce.test.ts`, `elementImportDurableTransaction.test.ts`, `elementImportReceipt{Heartbeat,Orchestration,Persistence}.test.ts`, `elementImportPackagedMedia.test.ts`, `importExport{ArtifactPersistence,Concurrency,MediaHashPersistence,MediaPersistence}.test.ts`, and `importExportFingerprintPersistence.test.ts`.
- HTTP upload/download masking and body limits: `apps/backend-docker/test/*.test.ts`.
- Localized end-user recovery, permission boundaries, request blocking, and commit/refresh behavior: `playwright/tests/MA-import-export.spec.ts` and its modules under `playwright/tests/import-export/`.

Test-file ownership does not claim a command passed. Target evidence and the current release verdict belong in the owner/evidence gates of the [production runbook](./import-export-production-runbook.md).
