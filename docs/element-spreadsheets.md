---
type: Feature
title: Fixed Element Spreadsheets
description: Type-specific Excel authoring templates and the shared JSON/Excel import path.
timestamp: '2026-09-16'
tags:
  - elements
  - graphql
---

# Fixed Element Spreadsheets

The element library has one import dialog for the fixed Klicker Excel template,
JSON-only ZIP exports, or individual element and answer-collection JSON files.
Excel is an authoring template only: exports always use [JSON ZIP packages](./import-export-packages.md).
All formats use the same full-access/private-preview gates, private REVIEW
copies, duplicate skipping, durable artifacts and import receipts. Source tags,
permissions and activity data are never imported.

## Authored workbook contract

`Instructions!A1` contains `klicker-elements-3`. Earlier unreleased workbook
layouts are rejected. Keep worksheet names, guidance rows and English headers
unchanged regardless of UI language. The seven data tabs are `Single choice`,
`Multiple choice`, `Kprim`, `Numerical`, `Free text`, `Content` and `Flashcards`.
Selection and case study are supported through JSON only. Kahoot and Mentimeter
files are not supported.

Each tab contains plain-language instructions in rows 1–4, headers in row 6,
field help in row 7 and one complete editable example beginning at row 8.
A short Instructions tab explains the workflow. UZH colours and Aptos fonts
separate guidance, fields and examples.

The first row for a `ref` contains the question's settings. Additional answers
or solutions use another row on that same tab: repeat only the ref and fill the
answer/solution fields. References identify questions within this workbook;
they are not database IDs and cannot be reused across type tabs. Content and
flashcards each occupy one row. Delete unwanted example rows before uploading.

## Editing rules and upload validation

All seven tabs carry rules for the first 1,000 data rows. Dropdowns cover Boolean
settings, choice display mode and numerical solution mode. Grey cells do not
apply and must remain empty; orange cells flag missing, incompatible or invalid
values. Field selection displays the corresponding help text.

- Sample solutions enable correct-answer/solution fields. Answer feedback requires
  a sample solution and feedback for every choice.
- Single choice requires exactly one correct answer; multiple choice requires at
  least one. Kprim always requires four statements.
- Numerical questions choose exact solutions or ranges, never both. Bounds must
  be ordered and solutions must fit the question's bounds.
- Point multipliers, accuracy and maximum text length have numeric/integer checks.
- Flashcards require a back in `explanation`. Other types may also have explanations.
  Content and flashcards have no sample-solution or point-setting columns.
- Question settings belong only on the first row of each ref.

The server checks these rules again using the canonical element domain. Excel
checks are editing aids: paste operations can bypass them. Errors identify the
actual tab, row and field; an invalid question is excluded while unrelated valid
questions remain available to import. Macros, formula cells (even with cached
results), embedded images, external workbook links and unsupported values are
rejected. Limits are 5 MiB compressed, 20 MiB expanded, 100 questions and Excel's
32,767-character cell length. JSON is available for larger text fields.

## JSON inputs and public image references

A JSON-only ZIP contains a manifest, one JSON file per element and separate JSON
files for required answer collections. Users may instead select extracted JSON
files together; collection-dependent elements require their collection file.
The browser packages the selection into one bounded artifact so the receipt
binds every selected file. JSON limits are 2 MiB per file and 10 MiB per artifact.

All current import formats retain public first-party image URLs without fetching,
copying or creating media ownership. Retained references carry a source-dependency
warning: deleting the original blob can break the image later. Invalid or
non-first-party auto-loading URLs exclude the affected element. A well-formed
but unavailable first-party URL remains intact. New exports contain no media
binaries. Already accepted links remain editable even without a MediaFile row;
pending/cleanup lifecycle records remain forbidden.

## Duplicate and replay semantics

The common import path skips exact canonical matches in the importing owner's
non-deleted library and repeated content within the selected input. Equality
includes content, answers, grading and image references; name, tags and status do
not matter. Empty and absent explanations are equivalent. URL identity remains
separate from a verified media-content fingerprint.

Preview hints are advisory; commit recomputes identity from current database
content under a per-owner transaction lock. No existing element is overwritten.
`ElementImportReceipt.skippedElementRefs` stores the authoritative report, even
when every selected element is a duplicate. Completed receipt replay returns
the original outcome after content changes or artifact expiry. The browser
reports each skipped element by name and source row or JSON filename and retains
success when a subsequent library refresh fails.
