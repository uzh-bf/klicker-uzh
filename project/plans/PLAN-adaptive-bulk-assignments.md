# Bulk assignment from competence trees

## Goal

Let a tree owner add batches of ready library Elements to an editable CompetenceTree, choosing a leaf subcompetence and expected level. Preserve all existing assignments, including multiple leaf mappings. Keep the element-editor route.

## Scope

Reuse GetUserElements (search, type, tag, bounded pages) and the existing atomic replaceCompetenceTree save. No schema, GraphQL contract, scoring, gamification, scheduling or student changes. Owner-only editing; used trees keep their existing duplicate-before-edit rule. Selection spans pages; filter changes clear it. All-matching selection resolves bounded pages before changing form state; failures preserve the previous selection. Saving revalidates access and answer eligibility. Existing API limit: 10,000 assignments.

## Verification

Focused helper tests for deduplication, preserving existing mappings, coverage and parameter calculation, plus a thousands-item batch. Frontend typecheck. Real browser checks: filters, cross-page selection, select all, preview, add, save/reload, locked tree, empty results and German/mobile layout. Screenshots must contain only synthetic fixture content for the public PR.

## Progress

- Inspected existing picker, tree save and lock rules.
- Implemented bulk picker in the assigned-elements tab using design-system controls.
- Typecheck and browser validation completed; full repository CI remains outside this follow-up verification.
- Added deterministic element-ID ordering after the existing library sort to avoid offset-page ties; bulk collection rejects duplicate/missing records or count drift. This does not provide snapshot isolation against concurrent library edits.
- Frontend typecheck passed. 65 focused tests passed (4 batch tests, 61 existing tree-helper tests).
- Browser: 60 synthetic elements selected across six pages, assigned and saved through the UI; reload retained all 60.
- Browser: selected all 1,000 CEFR synthetic questions, saved in one tree update, reloaded and confirmed 1,060 total assignments (the original 60 preserved).
- Browser: changing the type filter clears the selection; an incompatible search/type combination displays the empty state. Checkbox labels are now linked to the visible element names.
- Independent review completed; pagination consistency and accessible-label findings fixed. Native explorer/reviewer used; external executor/simplifier skipped because this checkout has no external-model opt-in.
- Captured before/after, saved-count and German mobile screenshots with synthetic fixture names only. The new picker stays inside a 390px viewport; existing page-shell overflow is outside this change.
- Browser: B1 tag narrowed 4,894 results to 845; synthetic element preview loaded correctly. New code has no schema or GraphQL-document changes, so no codegen outputs changed.
- Browser: a tree already used by a quiz exposes Duplicate and does not render the bulk picker.
