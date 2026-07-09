---
type: Feature
title: Element Import/Export Packages
description: Portable element ZIP packages, advisory duplicate fingerprints, bundled media, and production rollout requirements.
timestamp: '2026-07-08'
tags:
  - graphql
  - elements
  - deployment
---

# Element Import/Export Packages

**Import/export duplicate detection is advisory, not authoritative.** The backend computes internal fingerprints for elements and answer collections to show duplicate warnings, but imports still create the selected elements and their required package dependencies. Users decide by selecting or deselecting preview rows.

## Package format

Element packages are strict ZIP archives produced and parsed by `packages/graphql/src/lib/zip.ts:createZip` and `packages/graphql/src/lib/zip.ts:parseZip`. The parser accepts only root `manifest.json`, declared element JSON files, declared answer collection JSON files, and declared media files. It rejects directory entries, macOS metadata, path traversal, duplicate files, unsupported compression methods, data descriptors, CRC mismatches, unexpected files, and oversized compressed or uncompressed payloads.

The package manifest type is `klicker-element-package` and the current version is `3`, configured in `packages/graphql/src/lib/importExportPackageConfig.ts:IMPORT_EXPORT_PACKAGE_VERSION`. Answer collections carry a `version`; missing imported versions default to `1` for older packages.

## Duplicate fingerprints

Fingerprints are internal fields on `Element.importFingerprint` and `AnswerCollection.importFingerprint` (`packages/prisma/src/prisma/schema/element.prisma:Element`, `packages/prisma/src/prisma/schema/resources.prisma:AnswerCollection`). They are indexed with `ownerId` and are deliberately non-unique so users can import duplicate authored content when they choose.

`packages/graphql/src/services/importExportFingerprints.ts:computeElementImportFingerprint` hashes authored element fields: name, content, type, normalized options, point settings, explanation, exported/source status, normalized tags, linked answer collection payload, selected answer collection entry values, and media identity. It excludes package refs, file paths, DB IDs, `originalId`, owners, timestamps, and generated blob metadata.

`packages/graphql/src/services/importExportFingerprints.ts:computeAnswerCollectionImportFingerprint` hashes name, description, version, and sorted entry values. Entry order and refs are excluded.

On regular element/resource mutations, service code refreshes fingerprints via `refreshElementImportFingerprint` and `refreshAnswerCollectionImportFingerprint`. Imported media URLs are normalized back to their `import-media:<sha256>` identity during DB recomputation, so a refreshed imported element still matches the authored package media payload.

## Media behavior

Export scans element content, explanations, and nested option strings for URLs in `packages/graphql/src/services/elementImportExport.ts:collectElementUrls`. Only Klicker-owned blobs from the configured Azure storage account are eligible for bundling. External media and inaccessible first-party media stay as URLs and produce preview warnings. The server never fetches arbitrary external URLs.

Packaged media uses package-local `klicker-package-media://...` references and includes content type, byte size, SHA-256, and file path in the manifest. Import verifies size and hash before staging media into the importer-owned blob container. Supported media content types are centralized in `packages/graphql/src/lib/mediaContentTypes.ts`; unsupported media is not bundled on export and is rejected on import.

## Runtime requirements

Production startup calls `apps/backend-docker/src/app.ts:prepareApp`, which invokes `assertImportExportPackageStorageConfig` and `assertImportExportTokenSecretConfig`. Required production secrets/config:

- `IMPORT_EXPORT_TOKEN_SECRET`: dedicated HMAC secret for import preview tokens; production fails fast when missing.
- `IMPORT_EXPORT_PACKAGE_STORAGE=azure`: local package storage is test/development only.
- Azure blob credentials: `BLOB_STORAGE_ACCOUNT_NAME` and `BLOB_STORAGE_ACCESS_KEY`.
- Optional limits/rate controls: `IMPORT_EXPORT_PACKAGE_EXPORT_RATE_LIMIT`, `IMPORT_EXPORT_PACKAGE_UPLOAD_RATE_LIMIT`, `IMPORT_EXPORT_PACKAGE_VALIDATE_RATE_LIMIT`, `IMPORT_EXPORT_PACKAGE_IMPORT_RATE_LIMIT`, `IMPORT_EXPORT_PACKAGE_RATE_LIMIT_WINDOW_SECONDS`, and `IMPORT_EXPORT_PACKAGE_TTL_HOURS`.

The v3 Helm chart expects backend secrets to be provisioned externally under the `secret-backend-graphql` and `secret-backend-assessment` names referenced by `deploy/charts/klicker-uzh-v3/templates/deployment-app.yaml` and `deploy/charts/klicker-uzh-v3/templates/deployment-assessment.yaml`. The v2 chart templates expose `importExport.tokenSecret` for self-hosted values.

## Rollout checklist

- Run the production preflight after secrets and storage are configured: `pnpm --filter @klicker-uzh/graphql script:import-export-preflight:stg` or `pnpm --filter @klicker-uzh/graphql script:import-export-preflight:prd`.
- Backfill fingerprints after deploying the Prisma migration: `pnpm --filter @klicker-uzh/graphql script:import-export-backfill:stg` or `pnpm --filter @klicker-uzh/graphql script:import-export-backfill:prd`.
- Configure Azure container lifecycle cleanup for the import/export package container and verify blob CORS for browser SAS upload/download from the manage frontend origin.
- Deploy the Hatchet cleanup task from `packages/hatchet/src/index.ts` and monitor logs/metrics emitted by `packages/graphql/src/services/elementImportExport.ts:logImportExportPackageEvent`.
- Keep package size/count/error-code/rate-limit metrics visible before GA; duplicate warnings are UX hints, not import enforcement.
