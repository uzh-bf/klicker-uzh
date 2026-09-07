# Show retrieved chunks and reliable source references

## Approval summary

The Chat tool badge currently reports an empty search when retrieval returned material that cannot become a citation card. Participants also cannot inspect all retrieved chunks. The proposed repair separates retrieval status from citation availability and shows readable chunks grouped by source, with full-text disclosure, a document name, an available original URL, and each chunk's supplied page or timestamp.

Existing numbered citations must keep their meaning after reload. Previously excluded sources will therefore appear as unnumbered chunk groups, not enter the historical citation sequence. Missing names receive a neutral label. Missing public origins remain explicitly unavailable; links are never inferred from document text or internal ingestion addresses. Supplied website anchors remain intact. PDF and video jump links require verified locator semantics.

This is one source-only package against `v3`. It changes no model provider, database schema, authorization, source ownership, or corpus. Approval permits isolated implementation, focused tests, synthetic local browser verification, independent reviews, commits, an ordinary task-branch push, and a draft PR. It does not permit merging, release promotion, deployment, staging data repair, or cluster changes.

Success means the reproduced false-empty case is fixed; every returned chunk remains inspectable; supplied origins are preserved safely; and existing citation associations survive local persistence and reload. The terminal condition is a verified draft PR. Missing upstream metadata will be reported separately, not disguised as a successful provenance repair.

## Execution details

### Working context and authority

- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`.
- Worktree: `trees/rs/rag-chunk-display`; branch: `rs/rag-chunk-display`.
- Target: `v3`, selected by the repository declaration and the preceding isolated Chat repair scope. No existing PR selects a different base.
- Baseline: `b8a3e9f04d02b90165c4647c52a179c1ab7c632a`, equal to fetched `origin/v3` when created.
- Compared staging source: `654621094c63b977937202269c210edc0af1e8c2`; its source normalizer matches the target baseline.

The primary checkout has unrelated changes and is 29 commits behind `origin/v3`; leave it and all older citation worktrees untouched. In particular, the dirty `rs/citation-origin-v3` worktree is not this package. Its historical plan provides context, not permission to move its files.

Authority: the user approved the full expanded-display sequence and requested an active goal on 2026-09-07. Terminal: verified source-only draft PR. Boundary owner: self. Pause for a changed citation contract, new data access or provider, unavailable required verification/review, or separately gated external action. Ordinary implementation delivery is not a new approval gate.

### Findings and reproduction

1. **False empty result:** `getDocQueryChipState` in `apps/chat/src/components/tool-fallback.tsx` counts `normalizeSourcesFromParts` output. The normalizer drops an internal-reference source without a usable title. A synthetic exact-deployed-source Node harness returned one retrieved source and one chunk, zero normalized sources, and `doneEmpty`. The user-visible staging conversation shows the same contradictory badge beside an answer citing retrieved material.
2. **Missing origin and chunk detail:** documents-mode normalization reads `reference` but not `source_url`. A second synthetic fixture with an internal reference, public `source_url`, and two chunks loses the public URL and retains only the first excerpt. Both direct and structured MCP envelopes parse in this reproduction. The current expanded panel shows a query and source hint, not a chunk list. Its argument reader recognizes only `query`; verify producer argument aliases before widening it.

These checks isolate consumer defects. They do not prove that the current indexed staging record contains a public origin. The scoped ingestion-source investigation remains separate from live metadata and corpus repair.

### Primitive impact

| Product primitive | Disposition | Contract and consumers |
| --- | --- | --- |
| Chat source citation | Reuse | Preserve derivation from persisted tool parts, eligibility, identity, deduplication, and message-wide numbering. |
| Retrieved course material | Compose | Expose already returned chunks and metadata in the tool panel without changing retrieval or access. |
| KB resource | Reuse | Display an accepted public origin when supplied; never convert an upload gateway into participant access. |

No new durable product object is introduced. ADR 0004 remains unchanged because derivation and persistence do not change. Update `docs/chat-platform.md`: its existing expanded-panel contract becomes inaccurate.

### Result, identity, and link contracts

Use one result interpretation for badge and panel: running, explicit failure, recognized successful payload, explicitly empty source collection, or unknown/unreadable. A nonempty collection containing unreadable entries must not become an empty search. Bound decoding of direct, JSON-string, text-envelope, and structured-envelope forms; preserve envelope and payload errors. Support `question` and the existing `query` argument. Keep non-RAG tools unchanged.

Do not use the deduplicated, capped global citation list as the retrieval count or chunk list. Preserve legacy citation eligibility and identity even when improving display labels or navigation. Previously excluded groups stay unnumbered. Associate numbered groups with existing message-context citation IDs; never start a new citation sequence inside each tool call. Results beyond the citation cap remain inspectable without invented numbers.

Use stable tool-call/source/chunk occurrence identity for presentation when canonical identifiers are absent. Never use a translated fallback title as identity. Retain each chunk's own content and locator; source-level first-chunk metadata does not describe later chunks.

Prefer a validated external `source_url` over a safe external `reference` for navigation only. Reject unsafe schemes, credentials, internal/private transport targets, and ingestion endpoints. Preserve the submitted URL's query and fragment. Do not derive origins or trusted names from chunk body text. Show an explicit unavailable state for missing provenance.

Show supplied page labels and timestamp ranges. `page_number` must have verified physical, one-based semantics before it generates a PDF jump link; otherwise display the supplied locator without claiming navigation. Use structured `start_sec`/`end_sec` as seconds only under the supported retrieval contract. Generate PDF or video jump links only for known media and supported locators, separately from the original source link. Do not overwrite an authoritative website anchor. Unknown semantics degrade to display-only metadata, not guessed deep links.

Render chunk bodies as escaped plain text with readable wrapping and disclosure for long passages. Full text must remain available. Avoid raw JSON and internal endpoints in participant-facing RAG fallback/error states. Preserve keyboard disclosure, collapsed-panel inertness, focus visibility, reduced motion, and bounded initial rendering for large results.

### Delegation and implementation slice

| Slice | Owner | Bounded assistance | Acceptance |
| --- | --- | --- | --- |
| Repair retrieval status and expose complete chunks | Main | Trusted explore maps producer metadata; executor owns the chunk component and its behavior checks after main supplies settled inputs. Main retains normalization, identity, safe links, and integration because those contracts are coupled. | Focused suites, Chat build/check, synthetic browser matrix and reload, committed-range simplification and risk review, integrated final review. |

One cohesive slice and one draft PR; do not create separate checkpoint PRs. Use the existing Chat components, translations, and test tooling without dependencies. Read the applicable assistant-ui, browser, testing, and runtime-lifecycle instructions before implementation or runtime use. Stop the exact local runtime after verification unless explicitly retained by the user.

### Verification portfolio

| Consequential behavior | Obligation and primary seam |
| --- | --- |
| Retrieved material is not classified empty because citation metadata is absent | Extend `apps/chat/test/tool-fallback-doc-query.test.ts`: success, explicit empty, unknown, running, error precedence, supported envelopes, and query aliases. |
| Origins and identities remain safe and stable | Extend `apps/chat/test/normalize-sources.test.ts`: missing titles, distinct uploads, supplied origin versus internal reference, mixed named/unnamed sources and multiple calls without citation shifts. |
| Chunk-specific locators yield only supported links | Extend `apps/chat/test/source-display.test.ts`: physical/printed pages, seconds/ranges, original queries/fragments, unavailable metadata, unsafe/internal URLs. |
| All chunks are inspectable and retain citation associations through reload | Extend the existing `Chatbot Source Citations` block in `playwright/tests/Y-chat.spec.ts`. Reuse its synthetic persisted-message helpers in an isolated local test database; widen the documents fixture for optional titles, origins, and timestamp ranges. Verify disclosure/full text, multiple chunks/calls, citation cap, unnamed groups, and reload. |

Use the existing Playwright block for mounted behavior instead of adding a DOM test environment or duplicate fixture. Browser acceptance covers mobile/desktop, EN/DE, long text, keyboard expansion/collapse, focus, and reload. Local tests prove reconstruction from locally persisted synthetic messages, not model-generated persistence or deployed staging behavior. No live model calls or staging database writes are required.

Run package-native focused tests and Chat build/check in the configured container; run Playwright on the host against that exact test runtime. Inspect the final diff for unrelated edits and data hygiene. Commit the substantive slice, run simplifier and a risk review covering identity/URL exposure, then integrate corrections and run the final independent review before draft publication.

### Research and limitations

This is a repository-contract repair, not an external framework migration. Main-source probes and a trusted read-only producer map supply the implementation evidence. Consult current framework documentation only when implementation depends on framework-specific APIs. Missing producer metadata may require a separately scoped upstream repair or reingestion; this package does neither.

### Review and progress

Native planner reviewed draft v1 and requested explicit historical numbering, result validity, identity/locator semantics, and existing browser seams. All findings were accepted in v2. The planner approved v2 with the existing Playwright fixture instead of a new mounted-test fixture. The optional opposing-provider challenge failed before work because the CLI rejected its required model/effort selection; it is not a passed review.

Investigation and plan review are complete for the Chat correction. The user approved execution and the goal is active. Source implementation and isolated-runtime preparation are next; verification, reviews, and draft publication remain. Staging acceptance remains pending a separately authorized deployment.
