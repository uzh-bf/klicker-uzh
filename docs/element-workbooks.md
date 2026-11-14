---
type: Feature
title: Element Workbooks
description: Excel import and export of elements in the lecturer UI and the operator script; private blob transfer, duplicate identity, image copies and limits.
timestamp: '2026-11-09'
tags:
  - elements
  - graphql
  - storage
---

# Element Workbooks

Lecturers import and export elements through the fixed KlickerUZH Excel
template. The manage UI and the operator script `script:element-import`
(`packages/graphql/src/scripts/importElementWorkbook.ts`) share one parser and
one duplicate rule in `packages/graphql/src/lib/elementWorkbook/`.

## Template contract

`parse.ts` owns the contract: seven tabs (SC, MC, KPRIM, Numerical, Free text,
Content, Flashcards), headers in row 6, data from row 8, no version marker.
`templateFields.ts` maps template fields to those headers; a unit test fails if
a generated label ever differs from `ELEMENT_WORKBOOK_HEADERS`. Selection and
case-study elements have no tab and are reported as unsupported on export.

Export proves its own output: `export.ts` parses the generated file again and
leaves out every element whose re-parsed identity differs, so an exported file
re-imports as exact duplicates instead of silently changed copies.

## Transfer through private storage

Workbooks never pass through GraphQL. They live in the private container
`element-workbooks` of the configured storage account (`storage.ts`):

- Import: `prepareElementWorkbookUpload` returns a 15-minute **create-only**
  signed link for `imports/<userId>/<uploadId>.xlsx`. Preview and import read
  that path with the account key, so a user can only ever reach their own
  uploads. The upload is deleted after a successful import.
- Export: the server writes `exports/<userId>/<uuid>.xlsx` and returns a
  15-minute **read-only** link that sets `Content-Disposition`.
- Each upload or export prunes the caller's own workbook files older than 24
  hours. Operators should add an Azure lifecycle rule deleting blobs in
  `element-workbooks` after one day as the backstop for users who never return.
- The storage account's Blob CORS must allow `PUT` from the manage origin, as
  for media-library uploads.

`BLOB_STORAGE_ACCOUNT_URL` is the browser-facing account URL and
`BLOB_STORAGE_INTERNAL_ACCOUNT_URL` the backend-facing one; both default to
`https://<account>.blob.core.windows.net`. `getBlobStorageAccountUrl` in
`@klicker-uzh/util` is kept byte-identical with `v3-ai`, where the devcontainer
provides Azurite. `v3` has no local blob storage, so the workbook flows need a
`v3-ai`-based checkout (or real storage credentials) to run locally.

## Duplicates

`plan.ts:elementIdentity` hashes type, content, explanation, scoring and
type-specific options; titles, tags, status and choice ids are ignored, and
content and flashcards ignore their unused scoring fields. Identities are
computed from the library on every preview, never stored. Rows matching the
library are skipped, as are repeats within one file. `executeImport` refuses to
write when the library changed since the preview token was issued.

## Images

On import, `media.ts` copies images that live in another lecturer's media
library into the importer's container and rewrites the links. A link is copied
only when it is a **registered `MediaFile` whose owner is the container it
points into**: a user-id container and a single file name. The account key can
read every container, so any other link (private containers, unregistered
blobs, path tricks) is never dereferenced and keeps its original URL. External
images are never fetched. Copies record the source link in
`MediaFile.originalId`; the duplicate identity maps copies back to their source,
so re-importing the same file still matches.

## Limits

5 MB per file, 25 MB of unpacked XML (ExcelJS holds the whole workbook in
memory), 2,000 elements, and 30 workbook operations per lecturer per minute
(Redis key `element-workbook:rate:<userId>`). A 2,000-element import takes a
few seconds; the import transaction allows 120 seconds.
