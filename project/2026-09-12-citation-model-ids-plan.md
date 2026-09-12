# Explicit Chat citation identifiers

## Approval summary

Chat sometimes receives one document group containing many passages, then emits
citation numbers that belong to no displayed source. Give the model explicit
application-owned citation indices derived from the same normalizer as the UI.
Apply this projection only to the next model request, not to streamed or stored
tool results. Existing chats, source grouping, source links and invalid-marker
fallback remain unchanged.

The user approved this executable batch. Authority covers scoped implementation,
local checks, review, ordinary task-branch commits and pushes, and draft PR
delivery. It excludes merge, deployment, reingestion, production, new credentials,
and changes to document metadata. Terminal: a verified, reviewed draft PR to
`v3`, with browser compatibility evidence and explicit runtime limitations.
Boundary owner: self. Pause only for a changed data/product/authority boundary or
an unavailable required verification/review capability.

Explicit indices remove an ambiguity, but cannot guarantee model obedience.
They add a small amount of prompt text, not extra model calls. Invalid citations
must still render literally rather than point to a different source.

## Execution details

Worktree: `trees/rs/citation-model-ids`; branch: `rs/citation-model-ids`.
Baseline: `42864be70b0a9059aaa1c81e265a153a842aac96` (`origin/v3`).
Package tier: full path; one cohesive bug-fix PR, no stack.

### Primitive impact and compatibility

Reuse the existing message-local citation: its identity is the normalized source
identity; its owner is the assistant message. UI cards, inline markers and the
model projection consume that same mapping. No new domain object or persisted
representation is introduced. ADR 0004 remains authoritative; update only its
obsolete statement about manually mirroring numbering, plus the matching Chat
platform guide. No new ADR is needed for this reversible implementation.

Keep document groups intact and use their first-chunk locator as today. Preserve
all passage content and metadata. Number eligible unique sources in call order,
not asynchronous completion order. Repeated identities retain their number,
including after the cap; new overflow or invalid entries receive null. Numbering
resets for each generated assistant message, never from historical messages.

### Implementation and ownership

| Slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| S1 | main | Hardened plan | Model indices equal UI indices and raw results stay unchanged |
| S2 | main | S1 | Checks, browser reload proof, reviews and draft delivery |

S1 paths: `apps/chat/src/lib/sources/normalizeSources.ts`,
`apps/chat/src/lib/server/citationInstructions.ts`,
`apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`,
`apps/chat/src/prompts/citation-contract.hbs`, and corresponding normalizer,
citation-model-output and account-usage-route tests in `apps/chat/test/`.
S2 paths: `docs/chat-platform.md`, `docs/adr/0004-chat-citations-from-tool-call-parts.md`,
`playwright/tests/Y-chat.spec.ts`, this plan and ignored review evidence.

S1 — Main owns the shared mapping and model-only projection, route wiring and
prompt. Route: main; coupling between SDK ordering, canonical normalization and
persistence prevents a disjoint writer. Reuse `normalizeSourcesFromParts` and
`mapAssistantStepContent` rather than duplicate their rules. Project by
`toolCallId` in `prepareStep`; preserve initial forced retrieval and all provider,
accounting, cache and stop policies. Canonical structured payload wins over a
conflicting MCP text representation. Overwrite upstream `citation_index` values.
Preserve unrelated and non-text output blocks; leave failed/unparseable and
unrelated results without any application-assigned valid indices. Never mutate
historical messages, raw SDK steps, streamed data or persistence.
Repeated projection is idempotent: replace current-generation annotations by
toolCallId rather than accumulating them. Failed/unparseable results with forged
upstream citation fields never gain application-owned valid indices.

S2 — Main owns integrated verification and draft delivery. Required independent
simplifier and mapping-consistency slice review cover the committed S1 range;
final reviewer covers the integrated package after verification. Review outputs
stay in ignored `project/_local/reviews/`. No ingestion work is delegated here.

### Test portfolio and acceptance

Extend the existing normalizer tests for source-position mapping and reuse their
existing eligibility, identity, marker-bounds and URL-policy coverage. Add a
single synthetic SDK projection suite as the primary integration seam: one
group/many chunks, parallel calls completing out of order, repeated sources over
multiple steps, cap/overflow, invalid/error payloads, FastMCP wrappers and
conflicting text/structured payloads. Assert model indices against canonical UI
normalization, unchanged raw results, and independent generation reset. Tests
also repeat projection against already-projected messages.
must use test-owned fixtures and structured assertions, not prompt wording.

Extend the existing route suite only to prove first-step forced retrieval and
later-step projection wiring. Run focused tests before the complete Chat suite;
then applicable container build, typecheck, formatting and lint checks. Reuse
the existing host Playwright source fixture to prove valid links and invalid
literal markers before/after reload. No visible layout changes are planned;
The browser fixture must contain one group with 20 chunks: `[1]` targets that
group, while `[6]` and `[7]` remain literal without links before and after reload.
capture browser compatibility evidence, not a redesign gallery. Live model
obedience is distinct from synthetic request-shape proof and remains an explicit
post-deployment check, without claiming deployment in this package.

Current SDK documentation and installed `ai@7.0.52` support model-message
replacement in `prepareStep`. Avoid completion-time counters in tool converters.
Planning and execution must confirm the installed SDK output shape before edits.

## Progress

Planning construction completed by planner `01a0952c-cbb2-7390-ae2f-bf273ee625b8`.
Frozen-draft hardening approved in round 2; all three round-1 findings accepted.
Optional AGY review was blocked by the approval check; no disclosure occurred.
Baseline normalizer, citation and SDK streaming checks pass: 52 tests.
Implementation is present: full Chat suite 640 passed/21 skipped, then the added
multimodal test passed in the 11-test focused suite. Chat typecheck, lint (only
existing warnings), and production build passed. Chromium's one-group/20-chunk
reload test passed after correcting its expected in-page citation link.
Root check:all requires split execution: its host-launcher tests reject running
inside the container. Both host suites passed (64 and 48 tests); the remaining
container checks passed (35 Turbo tasks). Staged secret scanning passed.
Required implementation reviews and draft delivery remain pending.
Runtime startup for this exact worktree completed
with Devrouter 0.0.73, profile `chat`; no model key injected.
Stop and verify the exact runtime after the last check or real pause.
