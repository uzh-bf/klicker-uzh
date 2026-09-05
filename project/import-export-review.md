# Import/export review and design interview

Status: accepted spreadsheet scope implemented and locally verified; not committed or pushed.
Date: 2026-09-05
PR: https://github.com/uzh-bf/klicker-uzh/pull/4984
Branch: `import-export-elements`
Worktree: `trees/import-export-elements`
Source heads: import/export `406787da4`; fetched `v3` `fbc5f4fcc`.
Local merge commit: `53a43877f` (not pushed).

## Existing behavior

The current feature transfers authored elements through a version-3 Klicker ZIP
package. It supports nine element types, linked answer collections, bounded
first-party media, review before import, advisory owner-scoped duplicate hints,
and durable import receipts. Imports create private copies in REVIEW. Participant
responses, activity history, psychometric observations, permissions, and personal
tags are excluded. This is element reuse, not a course backup or synchronization.

Evidence: `docs/import-export-packages.md`,
`packages/graphql/src/lib/importExportPackageContract.ts`, and
`packages/graphql/test/elementImportExportAllTypesRoundTrip.test.ts`.
The existence of tests is not evidence that they passed after this merge.

## Improvement candidates

1. **State a package longevity policy before first release.** The parser accepts
   only the current version. Decide how long an exported package remains usable,
   retain representative released fixtures, and test supported upgrades. Versions
   1/2 should not automatically be supported merely because version 3 exists;
   first establish whether those formats were distributed.
2. **Give conversion losses an explicit review contract.** Package-level warning
   enums are insufficient to explain which question lost feedback, formatting,
   media, or grading semantics. Use server-owned codes tied to a source item and
   field, and require a clear decision for unsupported content. Do not silently
   truncate questions or invent correct answers.
3. **Clarify scope and limits in product copy.** The current format transfers
   elements, caps a package at 100 elements, and allows at most 5 MiB per bundled
   media file. Present this as reusable teaching content, not a complete backup.
4. **Keep a full-fidelity native format and add a narrow external adapter first.**
   The neutral element-domain validator is reusable, but package parsing and
   execution currently consume the native contract directly. Convert an external
   format into validated candidates before the existing preview/commit boundary.
   Do not build a plugin registry or generalized synchronization engine before a
   concrete adapter demonstrates the need.
5. **Consider HTTP MIME interoperability if external clients become supported.**
   The upload endpoint deliberately accepts only the exact ZIP MIME type and its
   tests explicitly reject MIME parameters. The existing browser uses that exact
   type, so this is not an observed first-party bug; it is a contract to revisit
   for broader client compatibility.

## External format evidence

- [Kahoot spreadsheet import](https://support.kahoot.com/hc/en-us/articles/115002812547-How-to-import-questions-from-a-spreadsheet-to-your-kahoot)
  accepts its XLSX template for quiz questions. The current guide specifies
  95-character questions, 60-character answers, at least two answers, a fixed
  set of time limits, and numbered correct answers. This is a feasible limited
  export target and a possible source format when users already possess such
  spreadsheets. It does not establish a lossless export of an existing kahoot.
  The actual downloadable template inspected on 2026-09-05 differs from this
  article: row 8 uses 120/75-character question/answer headers, and timer choices
  include 15, 45, 90, 180, and 240 seconds. Accept both fixed header variants;
  use the actual workbook layout as evidence, not the stale article limits.
- [Mentimeter Excel exports](https://help.mentimeter.com/en/articles/410566-export-results-to-excel)
  contain voting results, including individual voters' answers, and require a
  paid plan. A results workbook is not an authored question-bank interchange
  contract and must not be treated as one by default.
- [Mentimeter presentation import](https://help.mentimeter.com/en/articles/1840512-import-a-presentation-file-from-your-computer)
  converts presentation slides to static images. It does not recreate interactive
  question behavior. A generic promise of editable bidirectional compatibility
  is therefore unsupported by the documented paths reviewed here.

Agreed direction: native packages for Klicker reuse, plus fixed Klicker and
Kahoot spreadsheet templates for migration into Klicker. Defer a Mentimeter
adapter until an actual supported, sanitized source artifact demonstrates which
content and semantics can be recovered. No scraping or unofficial API dependency
is proposed.

## Decision tree

Q1 (accepted): Prioritize migration into Klicker, starting with one supported
spreadsheet format and explicit review of conversion losses. The user accepted
this recommendation on 2026-09-05.

Q2 (resolved by user): Accept uploaded Excel sheets compliant with Klicker and
Kahoot templates. Consider Mentimeter only if a usable format can be verified.

Q3 (accepted): Require fixed templates; arbitrary-sheet column mapping is outside
the initial scope.

Q4 (user direction): Support all nine Klicker element types if feasible. A
multi-tab workbook is implemented, with related tables for answer collections
and case-study details. See `docs/element-spreadsheets.md`.

Q5 (accepted): Klicker spreadsheets represent images through existing Azure Blob
Storage links; Kahoot spreadsheet imports have no image support. Embedded Excel
images are outside scope. Keeping an original URL retains a dependency on the
original blob; it does not itself create an independently owned media copy.

Q6a (accepted): Preserve original public Klicker image URLs when a workbook is
imported, including by another lecturer. Do not copy blobs or transfer media
ownership. The review should explain that images remain dependent on the source
blobs. ZIP packages remain the independent-copy option.

Q6b (accepted pragmatic choice): Preserve well-formed but unavailable image
references with a warning; block malformed or disallowed references until they
are corrected or explicitly removed. A verification timeout is not proof that
an image is invalid. This replaces the earlier blanket-blocking recommendation.

Q7 (accepted): Allow an explicit "Import valid elements" action when a workbook
is partially valid. Show errors by tab and row. Exclude elements whose required
answer collections or case-study data are invalid; never silently skip rows.

Q8 (accepted, supersedes recommendation): Exact duplicates must be skipped
automatically, without an option to import another copy. Notify the user which
elements were not imported because they are duplicates. Cover matches in the
importing user's library and repeated elements within the same workbook. Do not
overwrite existing elements.

The existing ZIP workflow retains advisory duplicate hints and allows deliberate
copies. Spreadsheet commits enforce skipping independently under a per-owner
transaction lock, including repeated rows and concurrent spreadsheet imports.

Q9 (accepted): A title-only change still counts as an exact duplicate
when authored content, answers, grading settings, and image
references match; ignore title, tags, and workflow status. The precise identity
contract must be preserved when reusing current fingerprints: those fingerprints
can omit unavailable media and normalize grading-equivalent solution sets.

Kahoot's fixed quiz template maps to SC/MC, with explicit timer/image omission
warnings. Tags and organization are excluded. Native package-version longevity
remains a release-policy recommendation beyond this spreadsheet implementation.

The accepted spreadsheet scope is recorded in
`project/2026-09-05-element-spreadsheets.md`. The agreed element-import-template term is recorded
in CONTEXT.md. Record an ADR only for an accepted, consequential tradeoff.

## Merge verification boundary

The independent reviewer identified missing production worker registrations and
missing draft-PR test selector entries; both were fixed and statically checked.

Static source parsing, SDL validation, YAML/JSON parsing, shell syntax, profile
assignment and shard planning have been inspected. The user authorized an
isolated runtime; package builds, GraphQL/frontend typechecks, generated SDL and
targeted database tests now pass. Desktop/mobile browser verification in EN/DE
passes for partial imports, duplicate reports, real Excel export/re-import,
Kahoot warnings, empty/invalid files, case-study preview and ZIP export UI.
No production operation or remote push is part of this pass.

## Implementation checkpoint

The codec, exporter, Kahoot adapter, URL-sensitive equality, GraphQL operations
and UI are integrated. A generated migration, applied only to this task's
synthetic database, updates receipt state/immutability and readiness inspection.
Tests verify all nine types, owner scoping, concurrent duplicate prevention,
all-duplicate completion and replay after deletion. Independent review findings
on readiness and image omission have been addressed. The actual official Kahoot
workbook passes the loader and adapter, including its decorative logo and ZIP
data descriptors. Final source checks and browser verification passed; the
implementation remains local and uncommitted. Evidence and runtime details are
recorded in `project/2026-09-05-element-spreadsheets.md`.
