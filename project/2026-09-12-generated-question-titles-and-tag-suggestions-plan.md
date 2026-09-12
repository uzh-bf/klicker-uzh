# Descriptive question titles and reviewable tag suggestions

## Approval summary

Generated questions should arrive with a short descriptive title and useful tag
suggestions. Lecturers can edit the title, choose existing tags, accept new tag
proposals, or keep no tags. New tags are created only with a successful save.

The KG generation service will produce a title and up to five topic labels in
its existing question-generation calls. Klicker will match those labels against
the reviewing owner's existing tags and show existing matches before new
proposals. Suggested tags and selected tags remain separate. The review flow
will persist selections and preserve edited titles across reloads and retries.
An explicit Save draft action persists edits before reload; unsaved edits remain
visibly marked and require confirmation before leaving the editor.

Recommendation: start with exact, normalized and conservative token matching
inside Klicker. This adds no embedding service or model call and does not send
the owner's tag collection to a model. It misses some synonyms and translations;
manual tag search remains available. Matching normalization never merges tags
or changes their existing owner-and-exact-name identity.

Completion requires compatible old/new generation outputs, atomic and
owner-scoped saves, preserved edits on replay, and browser proof of selection,
save and reload in English and German. The user approved implementation on
2026-09-12 after merging PR #5910. Approval authorizes these source changes,
tests, reviews and ordinary draft PR/MR delivery. Merge, deployment, historical data
rewrites and live provider quality runs remain separate actions.

## Scope and ownership

Approval mode: executable batch. Boundary owner: self.

The parent owns the generation contract, user-control decisions, integration
and verification. After those contracts are fixed, delegate the service
producer slice and the Klicker selection/persistence slice to separate workers
with disjoint repositories; integrate before the UI slice. Reviewers remain
independent of writers. Authority derives from the user's approval, not this file.

| Product primitive | Change | Invariant |
| --- | --- | --- |
| Generated question draft | Add advisory metadata and persisted selections | User edits win over generation replay |
| Owner's tag | Reuse existing identity | Owner plus exact name; no automatic merges |
| Keep generated element | Compose selection with existing atomic save | Element, tags and draft linkage commit or roll back together |

Question formats in scope: SC, MC and KPRIM. Preserve flashcard behavior.
No migration is expected because draft content already uses JSON and elements
already relate to tags. Reassess before adding schema or changing tag identity.

## Evidence and affected contracts

Evidence baseline: Klicker PR [#5910](https://github.com/uzh-bf/klicker-uzh/pull/5910),
head `0b8cf089d2`, against `v3-ai`; service checkout
`trees/rs/graph-bundle-source-provenance`, head `02d6dcecf4da`.
The PR's graph-filter change remains a separate repair package.

- `packages/graphql/src/services/questionGenerationArtifacts.ts`: the optional
  title falls back to the stem, truncated to 120 graphemes; normalized questions
  currently have no tag proposals.
- Service `lightrag_research/questions_generation/two_stage.py`: final question
  construction lacks descriptive metadata. Trace generation, repair and resume
  paths together; use the existing recipe/checkpoint version mechanism.
- `packages/graphql/src/schema/elementGeneration.ts`: question draft views
  return `tags: []`. `questionGenerationDrafts.ts` and the question editable type
  lack persisted tag selection; both canonical Keep and accepted-draft recovery
  must be covered.
- `packages/graphql/src/services/elements.ts` and Prisma `Tag`: existing tag
  creation uses owner/exact-name connect-or-create. Preserve this identity.
- `docs/solutions/best-practice/generated-element-keep-is-one-transaction.md`
  defines the save invariant. Related planning lives in
  `project/2026-08-29-pr-5667-question-generation-ux-audit-and-roadmap.md` and
  `project/2026-09-04-pr-5777-generation-lifecycle-contracts-plan.md`.

Before implementation, refresh both remotes and inspect overlapping open work.
Klicker targets `v3-ai`; the service's configured remote default is `main`.
Resolve any service MR-specific base before creating its task branch. Use one
coherent draft per repository; do not introduce a stack without approval.

## Execution sequence

### 1. Generate and ingest compatible metadata

Add optional `title` and `suggested_tags` to service question outputs and carry
them through all supported formats, validation, repair, serialization and resume.
Generate metadata within existing calls. Titles should describe the assessed
concept or operation in the requested generation language, roughly 3–10 words,
without exposing the answer. Preserve the generated-name limit of 120 graphemes.
Bound proposals to five short labels, at most 60 graphemes each.

Add tolerant optional readers in Klicker types and artifact ingestion. Missing
suggestions become empty. Invalid advisory metadata must not invalidate an
otherwise valid question; malformed titles use the existing stem fallback,
including titles that become empty after markup removal. Preserve strict answer
and provenance validation. Store generated metadata separately from edited
draft content and initialize defaults only once.

Acceptance: old banks still ingest, new metadata survives service repair and
checkpoint paths, and replay does not replace reviewed content.

### 2. Match, select and persist tags

Resolve suggestions using only the authenticated owner's tags. Rank exact
matches first, then case/whitespace-normalized matches, then conservative token
overlap. Do not present weak matches merely to fill a quota. Return at most five
existing recommendations and five new proposals; do not preselect them.

Preserve IDs and canonical names for existing selections, and names for new
proposals. Add optional structured selection to draft JSON and generation
save/update inputs; retain legacy string-tag input compatibility and reject
ambiguous requests supplying both. Validate selected existing IDs against the
owner inside the save transaction and connect by ID at the actual element write;
do not translate existing IDs back into name-based connect-or-create. Renamed
tags retain their identity and display the current name after refresh. Deleted selections require reselection,
rather than silently recreating a deleted tag.

Omitted selection on draft updates and Keep preserves the stored selection;
an explicitly empty selection clears it. Explicit legacy `tags` replaces the
selection using the established string-name semantics, while an omitted legacy
field preserves it. Reject requests specifying both old and new fields, but
accept old-client updates to new-format drafts without losing stored selections.

Resolve a new proposal to an exact-name owner tag if it was created meanwhile.
Deduplicate exact names and IDs; never use fuzzy matching as a persistence key.
Keep selection canonicalization stable for exact retries. Both Keep and
accepted-unsaved recovery must persist the same selections and preserve revision
fences. Handle concurrent exact-name creation without orphan tags or duplicate
elements. Add at most three attempts of the entire save transaction for the
specific owner/name tag uniqueness conflict, re-resolving the name each time;
propagate other errors and an exhausted conflict without partial writes. Store
the normalized requested selection intent separately from resolved tag IDs in
draft JSON, so the same request remains an exact retry after a proposed new tag
becomes existing. Do not use resolved names or IDs to rewrite that request intent.

Acceptance: cross-owner IDs fail, discarded proposals create nothing, stale
edits fail without side effects, successful retries return the same element,
and explicit empty selections survive reload.
Include existing-tag rename/deletion between validation and write, legacy-client
omission/clear semantics, and two builds concurrently accepting the same new tag
followed by identical Keep retries: one tag and one element per draft.

### 3. Review UI and integrated verification

Extend `GeneratedElementReview.tsx` and the existing tag editor minimally. Show
existing matches and clearly labeled new suggestions with independent selection
and removal; retain manual tag search and entry. A selected suggestion becomes
part of editable state; refreshing suggestions never resets dirty form fields.
Refresh owner tag data after successful creation.

Wire an explicit Save draft action to the revision-checked draft update for
title and selected tags. On success, replace the local revision with the server
revision and mark the editor saved. On failure, keep local edits visible and
unsaved; on a revision conflict, require reload/reconciliation instead of
overwriting remote edits. Preserve dirty state when refreshing suggestions.
Only successfully saved drafts promise server-backed reload preservation;
warn before navigation with unsaved changes. Keep still atomically saves the
currently visible edits and selections without requiring a prior Save draft.

Extend existing tests at contract boundaries: service output and repairs,
artifact compatibility, draft persistence, completion replay, owner-scoped save,
rollback and concurrency. Use synthetic fixtures and structured assertions;
do not snapshot generated prose. Run affected repository checks in their
supported environments and regenerate GraphQL outputs where required.

Browser acceptance: edit title, choose existing and new tags, remove suggestions,
Save draft, reload, discard, Keep, reopen the saved element, and retry a completed save.
Capture English/German desktop and narrow layouts with the screenshot-gallery
workflow and embed verified screenshots in the draft PR. Assess descriptive
quality with a small synthetic matrix across supported formats and languages.
Any live model run needs a named provider, bounded input set and spend approval.

## Rollout and recovery

Deliver additive Klicker readers/save support before enabling service metadata
and the suggestion UI. Verify new-reader/old-producer and old-reader/new-producer
compatibility explicitly. Source delivery is separate from deployment.

Rollback stops producer emission and suggestion presentation while retaining
readers for already persisted metadata and selections. Historical banks and
reviewed drafts receive no automatic backfill. Existing graph rebuild behavior
is unrelated to this metadata change.

Terminal: reviewed source packages with passing relevant checks and actual
browser evidence, delivered as draft PR/MRs once implementation is approved.
Pause for a new provider/data boundary, schema migration, tag identity change,
overwriting reviewed work, or separately gated deployment.

## Progress

- Planning construction completed by independent native planner Gibbs on
  2026-09-12; parent verified the title fallback, empty draft-tag view and exact
  owner/name persistence contracts.
- Round 1 native planner challenge: accepted four findings covering explicit
  draft persistence, ID-based writes under rename/deletion, omitted-field
  compatibility, and cross-build uniqueness retries. The plan now specifies
  each mechanism and acceptance check. Round 2 returned APPROVED.
- Optional AGY/Gemini review was blocked by automatic approval review because
  the payload/destination lacked explicit egress approval. No optional review
  was sent; native review remains the planning gate.
- Implementation approved; Klicker worktree `trees/rs/question-titles-tags`
  starts at merged `529bd0cf64`; service worktree of the same branch name
  starts at `origin/main` `7480c7f`. Producer worker owns only the service;
  parent owns Klicker integration, persistence and verification.
- Backend implementation now includes tolerant metadata ingestion, structured
  selection, exact-ID writes, legacy omission/clear behavior, and bounded
  transaction retries. Real Prisma 7 concurrency exposed adapter-specific
  constraint metadata; the retry predicate now recognizes the observed shape
  and rejects unrelated or unidentified conflicts.
- Local verification on the uncommitted task tree: GraphQL TypeScript check
  passed after rebuilding shared types; artifact normalization 77/77;
  completion/replay integration 26/26; tag helper and persistence integration
  29/29. Expanded persistence coverage then passed 11/11, including identical
  retries after concurrent creation and accepted-unsaved recovery.
- Runtime: exact checkout `trees/rs/question-titles-tags`, managed `manage`
  profile, isolated blob port 10193. Delegated local login passed. Runtime is
  active for ongoing browser verification and must be stopped at completion.
- Producer and UI workers hit terminal provider gateway errors mid-work.
  Partial edits were preserved; trusted generic-continuity workers own only
  their original disjoint scopes. UI, producer tests, committed reviews and
  draft PR/MR delivery remain incomplete; no deployment or live provider run.

- Resumed integration: service pipeline suite passes 66/66 in ephemeral
  `ghcr.io/astral-sh/uv:python3.12-bookworm-slim` with pytest 8.3.5, httpx
  0.28.1, python-dotenv 1.1.0 and NumPy 2.2.6. Source mounted read-only;
  no model calls. This resolves the earlier missing-environment blocker.
- Browser proof on synthetic local fixtures: Save draft preserves selected
  existing/new tags across reload; edited title persists; Keep creates the
  element and canonical library editor shows title and both tags; discard
  changes draft state. Found and fixed modal loading unmounting the form
  during save. The shared editor now stacks preview below form on narrow
  screens. English/German desktop/mobile captures live in ignored
  `project/_local/question-titles-tags/`. Initial pointer automation did not
  activate handlers reliably; observed DOM clicks were used for interactions.
- Latest frontend-manage TypeScript check passes. Required committed reviews,
  full checks and draft publication remain pending. STG is unchanged.
