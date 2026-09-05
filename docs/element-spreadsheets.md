---
type: Feature
title: Fixed Element Spreadsheets
description: Editable Klicker workbooks and Kahoot quiz template imports, with partial validation and authoritative duplicate skipping.
timestamp: '2026-09-05'
tags:
  - elements
  - graphql
---

# Fixed Element Spreadsheets

The element library's Excel dialog downloads a fixed Klicker template, exports
selected elements to that format, and imports Klicker or Kahoot quiz workbooks.
It uses the same full-access, private-preview and assessment gates as
[element ZIP packages](./import-export-packages.md). Imported elements are
private copies in REVIEW, without source tags, permissions or activity data.

## Authored workbook contract

`Instructions!A1` contains `klicker-elements-1`. Worksheet names and English
headers are fixed regardless of UI language. `Elements` covers all nine types;
`Choices`, `Solutions`, `Collections`, `Entries`, `SelectedItems`, `Criteria`,
`Cases` and `CaseSolutions` express repeated data and relationships. References
are workbook-local, never database IDs. Numeric ordering starts at zero.
The downloadable instructions explain how to populate each dependent table.

Validation uses the existing canonical element domain. Invalid rows carry their
worksheet, row and field. An invalid required dependency excludes its consumer;
unrelated valid elements remain selectable. Formula caches, macros, embedded
Klicker images, external workbook links and unsupported cell values are rejected.
The compressed workbook limit is 5 MiB, with bounded decompression before
ExcelJS parsing, 100 elements and Excel's 32,767-character cell limit. ZIP is
available for content that exceeds spreadsheet cell limits.

Kahoot imports accept the official quiz XLSX layout with headers on row 8 and
authored questions from row 9, in its 120/75 and older 95/60 character variants.
One correct answer becomes SC; multiple correct answers become MC. Text is
escaped as plain text. Timers and worksheet images are omitted with explicit
warnings; the official workbook's decorative logo is allowed. Result exports
are not question templates. Mentimeter support is deferred because the reviewed
official XLSX export describes voting results, not authored interactive content.

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
