# Correct citation page labels and PDF navigation

## Approval summary

The user approved this improvement after STG showed physical PDF page numbers
where readers expect the document's printed labels. Display labeled pages in
source cards, inline previews, and expanded retrieval passages. Use physical
pages only to navigate a public PDF. Missing labels remain absent. Investigate
unnamed documents and missing public URLs without inventing metadata.

Approval mode: executable batch. Authority: source changes, synthetic local
verification, configured reviews, commits, ordinary task-branch push and draft
PR. Terminal: verified draft PR with findings and browser evidence. Boundary
owner: self. Merge, deployment, production access and upstream data repair are
outside this batch. Pause only for unavailable capabilities or a material change
to scope, data exposure or authority. Semantic claim-support evaluation remains
in the evaluation submodule.

## Execution details

Worktree: `trees/codex/chat-answer-presentation`. Branch:
`rs/chat-citation-page-labels`. Target: `v3`, baseline
`42864be70b0a9059aaa1c81e265a153a842aac96`. Previous source work was merged in
[the citation reliability PR](https://github.com/uzh-bf/klicker-uzh/pull/5864).
Preserve the two pre-existing uncommitted project documents. This new cohesive
regression fix uses one PR. Full-path review applies because navigation and
retrieval metadata cross presentation seams.

### Contracts

Reuse source identity, numbering, grouping, URL validation and persisted tool
results. A numeric label such as 9 or Roman label such as IV is the displayed
page, regardless of physical page 13. Whitespace-only or absent labels produce
no page locator; never fall back to physical pages. Video timestamps retain
their existing semantics. A public URL positively identified as a PDF receives
its valid positive integer physical page in the fragment. Existing page
fragments must be updated without dropping unrelated fragment parameters or
query parameters. Non-PDF, private and absent URLs retain existing behavior.
No network lookup is needed to render a citation.

Trace title and URL fields through tool sanitization, normalization and display
before correcting a loss. Never derive a public URL from an opaque reference.
Unproven upstream metadata absence is recorded as an investigation limit, not
replaced with guessed data. No dependencies, schema changes, new provider calls
or ADR are expected: this restores existing field meanings.

### Ownership and checks

| Slice | Owner | Acceptance |
| --- | --- | --- |
| Trace metadata fields | explore | Source references explain field loss or upstream absence and branch differences |
| Correct label display and PDF links | main | Existing display/normalizer tests extended with synthetic labels and URL cases |
| Browser proof and delivery | main | Desktop/mobile source cards, preview, expanded passages, link targets, reload; applicable checks and reviews; draft PR |

The main session owns coupled URL/display semantics and integration. Retaining
that implementation locally avoids splitting a small shared helper across two
writers. Planning hardening, committed simplification and risk review, and
integrated final review remain independent configured passes.

Extend existing tests rather than adding parallel suites. Protect physical 13
versus label 9, Roman labels, missing/blank labels, invalid physical positions,
query strings and existing fragments, non-PDF and rejected/private URLs. Test
structured output and behavior, not prose. Extend the existing synthetic browser
source fixture to verify all three display surfaces and reload persistence.
Capture desktop/mobile evidence with actual interactions. Use container-native
checks and host browser tooling. No database reset or live model call is needed.

Update the chat guide only if inspection finds it documents the former incorrect
contract. Record missing upstream metadata in the existing findings document.
No evaluation-submodule changes are in scope.

## Progress

Remote fetch succeeded through host escalation. Old PR is confirmed merged.
New branch uses current v3; existing dirty files were preserved. A read-only
metadata investigation is running. Implementation and fresh checks are pending.

### Planning clarifications

Accepted first reviewer findings: identify PDFs only by a validated URL pathname
ending in `.pdf` case-insensitively, never by a title or generic document type.
Keep unrelated fragment bytes and opaque anchors intact; replace only a `page`
parameter or append it. Treat physical positions as positive one-based integers
as directed by the user; invalid positions do not change navigation.
Images use labeled pages; videos use timestamps first and a non-time label only
when no timestamp exists. Expanded chunks suppress a redundant time-shaped
label when a structured timestamp exists. Raw identity/grouping URLs remain
unchanged; only actual outbound navigation receives a page fragment.

Delegation Map: metadata trace belongs to `explore` independently. The main
implementation depends on the accepted plan, owns
`apps/chat/src/lib/sources/sourceDisplay.ts`, `sourceUrl.ts`,
`docQueryResult.ts`, the source card and expanded-result components, and existing
`source-display.test.ts` and `doc-query-result.test.ts`. Browser proof extends
`playwright/tests/Y-chat.spec.ts` synthetic tool results and depends on the
implementation. Missing-title findings go to
`project/2026-09-12-citation-metadata-findings.md`.

Run the existing Chat Vitest suites (`pnpm --filter @klicker-uzh/chat exec vitest
run`), Chat check/lint scripts, repository format/check gates and build inside
the exact managed runtime; host Playwright uses `pnpm playwright:host --` with
the focused source/expanded-passage tests. Require passing relevant checks,
simplifier and risk-review disposition, integrated final review, reviewed
synthetic desktop/mobile screenshots and a draft PR whose head matches the
verified source. Stop the exact runtime and verify provider state and zero
routes after the final runtime-dependent check. Broader failures must be
attributed with evidence and remain explicit if they block delivery.
