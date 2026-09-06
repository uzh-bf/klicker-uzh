# Staging Fix Plan: URL Extraction Must Use Content, Not a Default PDF Filename

- Date: 2026-08-27
- Status: Draft for review. No implementation, merge, deploy, or canary is authorized by this document.
- Target repository: `/Users/rschlae/Git/ai/doc-processing`
- Deployed staging baseline: image `latest-099a5630` (= `origin/main` commit `099a5630`, verified live)

## Goal

Website URLs without a file extension are extracted by their real content
instead of being saved as `source.pdf` and parsed by the PDF engine. After
deployment, a knowledge-graph build over a URL-only knowledge base must
succeed end to end on staging.

## Evidence (current staging state, values-free)

- Failed graph build `c5948ccc-0dd1-4be2-b408-6fe97f222300` for KB
  `6d83ffb8-0b5a-411b-9799-6e319b731891` failed in
  `course-kg-ingestion:prepare-course-inputs` after 58s.
- The build's only source snapshot is `KBGraphBuildSource` type `URL` for
  `https://www.gbl.uzh.ch/` with no blob name.
- A HEAD request from the staging graph worker returns `200` with
  `content-type: text/html`.
- Doc Processing extract job `7e25c90e9dcd4db8b4011f818ac21cc3` failed with
  `ConversionError ... source.pdf ... PDFium: Data format error`.
- Deployed code at `099a5630`:
  `src/doc_processing/extract_service.py` `_filename_from_url` returns
  `source.pdf` when the URL path has no filename, and the extraction
  pipeline is selected by file suffix. `src/doc_processing/api.py`
  `_source_filename_from_url` has the same default for job metadata.
- The Klicker side already sends and accepts `text/html` (PR #5588), so the
  defect is isolated to Doc Processing's filename handling.

## Non-goals

- No changes to the kg-content-generation worker or its client.
- No change to allowlist, SSRF pinning, size limits, or cache behavior.
- No production deployment in this plan; staging first.

## Design

Derive the working filename after download, in the operative extraction path
(`ExtractService._download_source_url`):

1. If the URL path's filename already carries a supported suffix, keep it
   (direct file links keep working unchanged).
2. Otherwise sniff the downloaded bytes: a leading `%PDF-` maps to `.pdf`;
   leading `<` with HTML markers (`<!doctype html`, `<html`) maps to
   `.html`; plain printable text classifies as `.txt` and, because plain
   text is not among the pipeline's supported input formats
   (`SUPPORTED_INPUT_FORMATS` in `src/doc_processing/processor.py` at the
   `099a5630` baseline lists PDF, IMAGE, DOCX, PPTX, HTML, MD, ASCIIDOC,
   CSV, XLSX, LATEX, XML_JATS), it is served to the extraction pipeline as
   `.md` (a supported format) with `.txt` kept only in job metadata.
3. If sniffing is inconclusive, fall back to the response Content-Type
   header (`application/pdf` -> `.pdf`, `text/html` -> `.html`,
   `text/plain` -> `.txt`).
4. If still undetermined, fail with `ExtractSourceError` naming the
   unsupported content type instead of guessing `.pdf`.

Rationale: magic-byte sniffing is deterministic and testable; the header is
only a fallback because proxies can omit or lie about it. Sniffing reads at
most the first few kilobytes already held in memory; no new network surface.
The API-side `_source_filename_from_url` stays untouched in this slice; it
only labels job metadata, and the failed staging path ran through the extract
service for both the extract-jobs and jobs flows.

## Work items

1. Fresh worktree from `origin/main` (primary checkout is dirty with unrelated
   files; leave it alone): `trees/fix-extract-url-content-type`, branch
   `fix/extract-url-content-type`.
2. Implement the filename derivation above in
   `src/doc_processing/extract_service.py` with a small pure helper.
3. Add unit tests: PDF magic kept as `.pdf`; root-URL HTML becomes `.html`
   and extracts to at least one text page; plain text becomes `.txt`;
   unknown binary fails with a clear error; explicit `.pdf` URL still wins.
   The plain-text case asserts the pipeline-facing suffix is `.md` while the
   recorded job metadata keeps `.txt`.
4. Add one regression test that reproduces the staging failure: HTML bytes
   with a `source.pdf`-style default no longer reach the PDF pipeline.
5. Run the repo's configured test suite, formatter, and linter; keep the diff
   to the helper, its call site, and tests.
6. Commit: `fix(extract): derive URL filename from content when the path has none`.
7. MR to `main` with the staging evidence above; keep it draft until checks pass.

## Deployment and verification (separately authorized, in order)

1. Merge only after the repo's CI passes on the exact head.
2. STG rollout of `doc-processing` follows the repo's immutable release
   identity discipline; Argo sync is a separate approval.
3. Post-deploy canary: re-run the graph build for KB
   `6d83ffb8-0b5a-411b-9799-6e319b731891` from the manage UI.
4. Success: `prepare-course-inputs` completes, markdown pages contain real
   text, `KBGraphBuild` row reaches `SUCCEEDED`, and the FalkorDB graph is
   published. Capture the worker log line and ledger row as evidence.

## Risks

- Suffix/content mismatch policy is decided above (bytes win for extensionless
  URLs, explicit suffixes win otherwise); document it in the MR body.
- Extract cache is content-hash keyed, so no cache purge is needed; failed
  attempts were never cached as successes.

## Approval asks

1. Authorize implementation and the MR in `ai/doc-processing`.
2. Separately authorize the STG deploy after merge.
3. Separately authorize the live graph-build canary.
