# Citation metadata investigation

## Confirmed behavior

The STG browser test on 2026-09-12 produced inline citations and retained them
after reload. It also showed unnamed documents and physical PDF page numbers.
The expanded retrieval result reported that the original source URL was unavailable.

## Required correction

- Source cards, citation previews, and expanded retrieval passages must display
  the labeled page number only. Do not substitute the physical PDF page when
  the label is missing.
- Public PDF links must use the physical page number for their page fragment.
  Preserve the distinction between document labels and PDF navigation positions.
- Trace missing document titles and public URLs through the retrieval response
  and its sanitization before changing title fallbacks. Do not infer a public
  URL from an opaque internal document reference.

## Source evidence

`apps/chat/src/lib/sources/sourceDisplay.ts` currently prints `source.page`
before optionally appending `source.labeledPage`. The expanded passage renderer
in `apps/chat/src/components/doc-query-results.tsx` does the same.

`apps/chat/src/components/sources-section.tsx` uses `source.url` directly as
the card href. `sourceUrl.ts` validates public URL shape but does not add PDF
page navigation. Inline citation chips intentionally target the local source card.

The current v3-ai normalizer reads document titles from `title`, `display_name`,
or `file_name`, and chunk labels from `labeled_page_number`. A sanitized opaque
document reference can yield a generic document title. The observed unnamed
source alone does not establish which upstream field was lost.

## Acceptance cases and remaining evidence

Use synthetic cases where physical page 13 has label 9, and where a physical
page has a Roman numeral label. Verify labels in all three display surfaces,
physical page fragments in public PDF hrefs, missing-label behavior, and reload
persistence. Verify absent or private URLs remain unlinked.

Implementation and browser validation of these corrections remain pending.
Claim-source support evaluation belongs to the evaluation submodule and is
outside this display and metadata investigation.

## Source trace on 2026-09-12

Compared fetched `origin/v3` (`42864be70b`) and `origin/v3-ai`
(`9cb4042334`). The latter's `apps/chat/src/services/docQueryResult.ts`
recursively preserves fields and replaces matching ingestion URL strings with
opaque document references. Ordinary title, label, and public URL strings are
not removed. The MCP wrapper applies this before model context and persistence.
Its normalizer supplies a generic document title for sanitized references with
chunks. These observations do not prove that the producer supplied a title or
public URL in the observed STG result. No upstream repair is justified yet.

The producer is outside this repository. Investigating its actual output remains
necessary to distinguish missing producer metadata from another transport loss.
Do not replace opaque references with inferred public links. A separate possible
identity issue is that hashing a full signed URL may vary with its query string;
this is unproven without producer evidence and is outside the page-display fix.
