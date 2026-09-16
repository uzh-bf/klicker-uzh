---
type: Feature
title: Fixed Element Spreadsheets
description: Editable Klicker workbooks, with partial validation and authoritative duplicate skipping.
timestamp: '2026-09-05'
tags:
  - elements
  - graphql
---

# Fixed Element Spreadsheets

The element library's Excel dialog downloads a fixed Klicker template, exports
selected elements to that format, and imports Klicker workbooks.
It uses the same full-access, private-preview and assessment gates as
[element ZIP packages](./import-export-packages.md). Imported elements are
private copies in REVIEW, without source tags, permissions or activity data.

## Authored workbook contract

`Instructions!A1` contains `klicker-elements-2`; the reader also accepts the original
`klicker-elements-1` layout. Version 2 puts visible tab guidance in rows 1–4,
headers in row 6, column help in row 7, and data from row 8. Version 1 retains
row-1 headers and row-2 data. Import diagnostics use actual worksheet row numbers. Worksheet names and English
headers are fixed regardless of UI language. `Elements` covers all nine types;
`Choices`, `Solutions`, `Collections`, `Entries`, `SelectedItems`, `Criteria`,
`Cases` and `CaseSolutions` express repeated data and relationships. References
are workbook-local, never database IDs. Numeric ordering starts at zero.
The downloadable instructions explain how to populate each dependent table.
Templates and exports share a short quick-start page and visible explanations on
every data tab. The template contains nine editable, clearly named examples with
complete linked answers; uploading it unchanged previews those examples for
import. Exports contain only the selected user content. UZH colors distinguish
tab groups and headers. The first seven rows of each v2 data tab are guidance,
not imported content; keep them and the worksheet names unchanged.

Excel editing checks provide dropdowns, basic numeric bounds, and grey cells for
fields that do not apply to the selected element type. Orange cells mark values
that must be cleared after a type or sample-solution change. Checks cover supported
dropdown and numeric fields for 100 element rows and 1,000 rows on other checked
tabs, extending to all populated export rows. These are editing aids, not protection: pasted values
can bypass Excel validation, and upload validation remains authoritative. No
macros or worksheet locks are required.

Validation uses the existing canonical element domain. Invalid rows carry their
worksheet, row and field. An invalid required dependency excludes its consumer;
unrelated valid elements remain selectable. Formula caches, macros, embedded
Klicker images, external workbook links and unsupported cell values are rejected.
The compressed workbook limit is 5 MiB, with bounded decompression before
ExcelJS parsing, 100 elements and Excel's 32,767-character cell limit. ZIP is
available for content that exceeds spreadsheet cell limits.

Only the fixed Klicker workbook is supported. Kahoot quiz import templates and
result exports are not accepted. Mentimeter imports are also outside this scope.

## Public media references

Klicker spreadsheets preserve original public first-party image URLs, including
when another lecturer imports the workbook. Import never fetches or copies
these images, and creates no media ownership relation. Every retained reference
has a source-dependency warning: deleting the original blob can break it later.
Malformed or disallowed auto-loading URLs invalidate the element. An unavailable
but well-formed first-party URL remains intact; availability is not guessed from
a timeout. ZIP remains the independently copied media format.

## Duplicate and replay semantics

Spreadsheet imports automatically skip exact canonical matches in the importing
owner's non-deleted library and repeated content within the selected rows.
Equality includes authored content, answers, grading and image references;
name, tags and status do not matter. URL identity is separate from ZIP's
media-content fingerprint, which can omit unresolved media. A public URL is
never stored as if it were a verified content hash.

Preview hints are advisory; commit recomputes identities from current database
content under a per-owner transaction lock shared by spreadsheet imports. This
does not impose a uniqueness constraint on ordinary editing or ZIP imports.
No existing element is overwritten. ZIP retains its deliberate-copy behavior.

The existing signed artifact/token and leased receipt pipeline owns execution.
`ElementImportReceipt.skippedElementRefs` records the authoritative duplicate
decision alongside created IDs, including an all-duplicate success. The immutable
completed receipt permits retries to return the original result after elements
are changed or deleted. The schema migration updates the state constraint,
immutable trigger and database readiness contract together.

The browser reports created counts and each skipped element's name and source
row. It retains committed results even if refreshing the library fails.
