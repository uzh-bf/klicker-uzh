# Edit multiple chatbot knowledge-base attachments

## Approval summary

September 12 delivery update: the reader foundation merged into `v3-ai` in
[PR #5879](https://github.com/uzh-bf/klicker-uzh/pull/5879), commit
`1f139428d506cb6a647a9021f9830eb65f983c13`. The user approved a compatibility
transition before the requested plural-only cleanup. First deliver readers
accepting both `kb_id: id` and `kb_ids: [id]`, without changing stored rows or
writers. After those readers are deployed, backfill managed configurations,
switch writers, and remove singular support. The final application contract
uses plural fields; the singular compatibility descriptions below apply only
during the transition. JWT claim compatibility remains a separate service
contract. No deployment or live backfill is authorized by source approval.

The compatibility follow-up is on `rs/chatbot-kb-scope-transition`. The
unpublished cleanup is preserved in `trees/rs/chatbot-multiple-kb`; do not apply
its strict reader or migration before the deployment prerequisite is proven.

Let chatbot owners add and remove existing authorized knowledge bases in the
Knowledge tab. Zero attachments remains valid; up to 32 may be active. Adding
one preserves the others. Detaching never deletes a knowledge base or resources.
Retrieval uses one combined document scope across the attached KBs.

Deliver two dependent layers: first make every reader compatible with multiple
attachments while retaining today's single-attachment writes; then enable
additive editing, update both attachment interfaces, and remove the database's
single-attachment restriction. Keep component extraction limited to the
Knowledge pane. No new KB service, ingestion redesign, graph tools, response
examples, or general editor redesign belongs here.

Attachment changes remain live and separately authorized, outside pending
settings-approval revisions. The UI must explain that they affect the next
retrieval immediately. Legacy singular fields return a KB only when exactly
one is attached. Multiple graph-enabled attachments require an explicit choice
in the graph viewer; that choice never changes document retrieval or creates
a primary graph. The user approved these compatibility choices on September 9.

Success means both editing surfaces preserve 0→1→2→1→0 changes after reload,
preview and student retrieval use exactly the authorized set, and concurrent
changes cannot exceed the cap or leave stale scope. Source rollback to old
singleton writers is unsafe after multiple attachments exist.

The user approved this plan on September 9. That approval permits the named
local source work, disposable synthetic tests, reviews, commits and draft stack
delivery after the revision dependency is ready. The first public-contract
layer requires human foundation review before the second. Merge, deployment,
live data changes and production promotion remain separately authorized.

## Execution context and dependencies

Audience: the maintainer approving the outcome, then an execution agent that
reads this complete plan. Main owns decisions, integration and final evidence;
one executor owns each sequential source slice. Other tasks retain their files.

Source baseline, refreshed September 9, 2026:
`origin/v3-ai` = `7a4648aa931dab207146dd06a54131581ab0a63c`;
`origin/v3` = `236ecd4fef9c9fddb6f4e6dd252e7e2f2226ddc4`.
Contract inspection used `a4adca18a47e3d325f77f9ee48cf21ae894882b8`.
The subsequent translation-context integration has no changes in the mapped
attachment, editor, preview, graph or schema seams; its movement does not
invalidate this planning review.
[PR #5851 — upstream integration](https://github.com/uzh-bf/klicker-uzh/pull/5851)
is merged into `v3-ai`. No additional integration or promotion PR is proposed.
The editor and scoped-attachment foundations are already merged; do not replay
their branches.

[PR #5771 — cost controls and authoring revisions](https://github.com/uzh-bf/klicker-uzh/pull/5771)
is open against `v3-ai` at `fabf3673a01e18b44293d37aa428869cebfa7f07`.
Its [ADR 0043 — review chatbot revisions before activation](https://github.com/uzh-bf/klicker-uzh/blob/fabf3673a01e18b44293d37aa428869cebfa7f07/docs/adr/0043-review-chatbot-revisions-before-activation.md)
excludes KB/MCP bindings from revision snapshots and keeps preview
on live configuration. Wait for that contract to merge into `v3-ai` before
editing shared source. Re-read the landed contract with its existing owner;
if it changes attachment authority, return for a decision rather than adding
a writer to that branch. Planning and existing rollout monitoring can continue.

Keep this plan in `trees/rs/chatbot-editor-delivery/project/`. That retained
planning checkout is at `6b803dddf627aa99c350b6a2c677397a568f3f2c`, its remote
branch is gone, and it is 161 ahead/12 behind the current remote default `v3`.
Read current contracts from remote refs. Preserve its unrelated `CONTEXT.md`
and editor-delivery Progress changes; do not use it for new implementation.

After approval and dependency resolution, audit worktrees, reuse an existing
matching task if present, otherwise create `trees/rs/chatbot-multiple-kb` from
fresh `origin/v3-ai`. Use one stack worktree: lower branch
`rs/chatbot-kb-readers`, upper branch `rs/chatbot-multiple-kb`.
The lower PR targets `v3-ai`; the upper targets the lower branch. Resolve live
bases before mutation. Ordinary non-force draft publication is allowed after
approval; rebases, force-pushes and aggregate branch promotion are not.

## Binding product contracts

The accepted zero/32/combined-document-scope decisions are not reopened.
No per-mode KB assignment or student document-scope chooser is added. Existing
ranking and content-generation graph selection stay unchanged. Graph tools
remain future work and will explicitly target a graph.

| Product primitive                | Disposition | Contract and consumers                                                                                                                                                     |
| -------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Knowledge base                   | Reuse       | Existing owner, resource lifecycle, publication and deletion rules remain authoritative                                                                                    |
| Chatbot KB attachment            | Extend      | Unique KB/chatbot relation; several enabled links coexist. Both the chatbot editor and KB-side binding panel support additive attach and individual detach                 |
| Document retrieval scope         | Compose     | Exactly the enabled, undeleted authorized attachment set; persisted MCP configuration and signed request scope agree in preview and participant chat                       |
| Published configuration revision | Reuse       | KB/MCP bindings remain live outside the saved revision. Attachment operations neither submit nor approve settings, change revision versions, nor grant participant credits |
| Graph browsing                   | Extend      | Browse one explicitly selected attached graph when several are available; no implicit newest, primary graph, aggregation or effect on document retrieval                   |

### Attachment and retrieval consistency

Reuse `KBChatbot`; preserve the unique KB/chatbot pair and existing history.
Attach is additive and idempotent. Detach affects exactly the requested pair
under the existing lifecycle convention; it never removes KB resources.
Retain current owner authorization and authoring eligibility at every mutation.
Reject foreign/deleted KBs and unauthorized chatbots server-side.

Serialize attach, detach and KB deletion using the existing KB-before-chatbot
order. Deletion locks affected chatbots in sorted ID order. After taking a
chatbot lock, do not acquire more KB locks while recomputing its scope; read
the remaining bindings within the transaction. Prove concurrent deletions and
attaches converge. A required different lock order needs explicit review.
Check the cap after serialization; an already-enabled attach succeeds even at
32, while a new 33rd attachment fails without changing scope or other links.

Use one transaction-local scope reconciliation path for attach, detach and
deletion. Derive sorted distinct IDs from enabled, undeleted relations. Store
`kb_id` for one and `kb_ids` for 2–32. For zero, disable managed Doc Query
configurations and remove both stale scope keys; never expose unscoped search.
Rewrite scope consistently across all applicable managed Doc Query rows,
including existing enabled rows outside Tutor/Explainer. Preserve unrelated
servers, tools, settings and mode availability. Avoid one remaining singleton
row conflicting with plural rows. Failure rolls back relations and config.

Scopes are snapshots for requests already admitted. A completed detach must
exclude that KB from subsequent requests; this work does not cancel in-flight
model/tool calls. Any different revocation guarantee needs a separate decision.

### Public readers and graph browsing

Expose plural binding summaries and migrate every repository consumer. Keep
deprecated singular fields temporarily: one KB for exactly one attachment,
null for zero or several. Never use the singular compatibility projection for
authorization or retrieval. Existing object-returning mutations gain plural
state. Preserve `detachKbFromChatbot: Boolean!` and its existing operation;
refetch authoritative plural state after detaching. Keep the existing replacement warning truthful until additive writes
actually land, then remove it from both English and German interfaces.

The participant scope resolver already supports the plural protocol. Remove
preview's `take: 1` and use the same complete scope contract and validation;
do not introduce an unvalidated fallback from binding IDs to broader config.
Zero KBs must remain usable without document tools where the existing mode
policy permits it. Keep preview stateless and preserve saved model/mode policy.
Preview billing parity is a separate rollout issue, not part of this package.

Graph reads retain current participant access guards. With zero graph-enabled
attachments, retain the existing unavailable state. With one, retain automatic
direct browsing and its published/queued/failed status. With several, show an
explicit graph selector before reading a graph; never choose by update time.
Extend the existing graph read API with an optional validated KB ID and an
authenticated selection-required response containing only eligible ID/name
choices. Every overview/search/neighbors request revalidates that selection
against current enabled, undeleted graph bindings. Foreign or detached IDs
must not return graph data or private storage information.

Keep the selected graph in viewer state. Switching it clears graph-local
search/neighbors/cache state and ignores stale responses. If it is detached,
clear it and ask for a valid choice. Old clients without a choice fail closed
for multiple graphs. Owner preview does not gain a new graph UI or participant
authorization path. Content generation retains its existing explicit choice.

### Lecturer interfaces

Use existing design-system controls, authorized KB catalog and pagination.
The Knowledge tab shows attached KBs, navigation, individual detach actions,
and an add selector excluding current attachments. Keep zero/empty, loading,
error, cap and pending states clear. Each operation saves separately and
refreshes authoritative server state. Disable conflicting controls while
pending; distinguish a saved mutation from a failed refresh.

Update `packages/kb-management/src/components/KnowledgeBaseChatbotBindings.tsx`
as part of the same feature. Its linked-chatbot list must use plural membership,
so multi-KB chatbots remain visible and detachable from each KB page.
Show that attachments apply immediately even while a settings revision is
pending. Do not discard another tab's unsaved form or reuse its revision-save
action. Extract the Knowledge pane from `ChatbotDetails.tsx` only as needed;
retain the current tabs and existing save/validation ownership.

## Delivery layers and Delegation Map

This is one feature in a two-layer native GitHub stack, not a plan-only PR or
an addition to the merged editor package. The lower layer must be independently
safe with singleton writes. Never enable multi-KB persistence before its
readers are deployed. Main alone owns stack topology and integration.

| Layer and owner                                                                               | Included seams                                                                                                                                                                                                          | Acceptance and boundary                                                                                                                                                                                                                                        |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reader compatibility; `executor`, first commit/review slice                                   | GraphQL knowledge/chatbot services, schemas, binding/chatbot operations and public SDL; KB-management reverse panel; Manage Knowledge projection; Chat preview, graph server/route/API client/viewer and existing tests | Plural consumers work with current 0/1 data. Graph-choice contracts work with synthetic multi-binding mocks. Singleton index and replacement writes remain unchanged. Reviewed draft foundation; pause for human public-contract review before the upper layer |
| Additive attachment editing; `executor`, second commit/review slice after foundation approval | One Prisma migration; attachment/detachment/deletion reconciliation; Knowledge pane and KB-side additive behavior; affected translations and existing tests                                                             | Complete additive lifecycle and exact retrieval-scope proof, both authoring surfaces, cap and failure tests. No first-result assumptions remain. Reviewed draft feature above the foundation                                                                   |
| Integrated delivery; main                                                                     | Dependency integration, focused checks, review disposition, documentation and both PR descriptions                                                                                                                      | Draft stack with current-head checks accounted for, independent final review, migration/rollback notes and browser receipts; no ready marking, merge or deploy                                                                                                 |

Reader files include `packages/graphql/src/services/knowledge.ts`,
`services/chatbots.ts`, `schema/knowledge.ts`, `schema/resource.ts`,
`src/graphql/ops/QGetKbChatbotBindings.graphql`, both `QGetChatbotsInfo*`
operations, binding mutation operations and `src/public/schema.graphql`.
Chat seams include `apps/chat/src/services/mcpScope.ts`,
`src/lib/server/knowledgeGraph{,Runtime}.ts`, the existing knowledge-graph
route/client/components, and the owner-preview route. Enumerate exact changed
files before delegation; do not hand the same paths to concurrent writers.

Planning estimates, not measured diffs:

| Layer                       | Estimated size signal                                                                           | Threshold ruling                                                                                                                                                                                             |
| --------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Reader compatibility        | 500–800 human-authored changed lines across 18–25 files, plus roughly 30–80 generated SDL lines | Expected to exceed 400 lines. Keep one compatibility contract: every consumer must understand plural data before writers change. Its graph-access seam makes this judgment-heavy, so review it independently |
| Additive attachment editing | 350–600 human-authored changed lines across 10–16 files, including one short migration          | May exceed 400 lines. Relation writes, scope reconciliation and both authoring interfaces must agree; splitting them would expose inconsistent attachment behavior                                           |

Measure human-authored and generated size signals before publication against
the 400-line/25-file thresholds. Revisit these cohesion rulings if the actual
diff materially exceeds estimates; do not silently add layers or split off
tiny documentation PRs.

## Migration and rollback

Use one minimal migration dropping only
`KBChatbot_one_enabled_per_chatbot_key`. It is a custom partial index from
`20260825190000_kb_management_foundation/migration.sql`, absent from Prisma's
model declaration. Use the schema-aware create-only workflow; when it cannot
express that index removal, document the limitation and add only that DROP.
Do not manufacture a model change. Preserve pair uniqueness, rows and resource
data. Synchronize analytics only if schema models actually change.

Use a marked disposable synthetic database and shadow database with the
repository's restricted test role. Never reset a retained workspace database.
Apply the migration to empty and populated fixtures and compare preserved
relations/resources and remaining constraints. Deployment is separate from
generating and testing the migration locally.

Before any later STG rollout, prove plural readers in Manage, Chat and API are
running before additive writers become available. The upper-layer rollout must
prevent attachment edits and KB deletion while old and new writer replicas
coexist; old singleton writers can otherwise remove links or preserve stale
scope. The environment owner must name and obtain approval for the bounded
write-quiescence procedure before deployment. Resume writes only after all
writer replicas run the new version. If the existing release process cannot
provide that guarantee, return for a rollout decision before landing the upper
layer. Do not invent a flag framework or silently change cluster strategy.
Require clients with old replacement controls to reload through the existing
release process before resuming attachment edits.

Before any source rollback, inventory attachment cardinality and persisted
scope. Once plural data exists, old detach/deletion code can leave a removed KB
in signed retrieval scope. Keep the plural-capable writer or use a reviewed
forward fix. Never recreate the index or disable links automatically. Any
required temporary write pause or data conversion needs explicit live approval.

## Verification portfolio

Reuse and extend existing suites; do not duplicate scope-resolver coverage or
assert translation prose, seed wording or incidental counts.

| Risk                                     | Smallest maintained proof                                                                                                                                                                                                                                                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Relations, authorization and scope drift | Extend `packages/graphql/test/knowledge.test.ts`: additive/idempotent attach, 0/1/many, cross-owner rejection, exact stored scope fed into the existing MCP scope resolver, partial/last detach and deletion, unrelated config preservation and transaction rollback                                                |
| Concurrency and migration                | Same integration suite: two attaches from 31 never exceed 32, concurrent attach/detach/delete converge, mixed singleton/plural managed rows normalize together. Disposable migration fixtures prove existing enabled/disabled rows, unique pairs and resources survive                                              |
| Reader and revision compatibility        | Existing chatbot-authoring/service suites protect plural/legacy responses, validation of the unchanged Boolean detach operation, and no revision-state/credit side effects. `apps/chat/test/owner-preview-route.test.ts` covers 0/1/many exact scope, mismatches failing closed, and preserved policy/statelessness |
| Graph access and viewer state            | Existing `knowledge-graph-route`, `knowledge-graph-api-client` and `knowledge-graph-state` suites: 0/1/many, omitted/foreign/detached choices, publication states, graph switches and stale-response exclusion                                                                                                      |
| Real editing flow                        | Extend host `playwright/tests/T-chatbot-authoring.spec.ts` and the existing KB-binding journey where needed: both surfaces support 0→1→2→1→0, reload, pending controls, errors, retained resources and immediate-live messaging; desktop/mobile EN/DE and keyboard screenshots                                      |

Build affected dependencies before checks in the container. Confirm package
scripts and runner forwarding on the fresh baseline; use GraphQL's existing
knowledge/authoring suites and Chat's focused preview/graph Vitest files.
Regenerate GraphQL artifacts and check tracked SDL. Run host
`pnpm playwright:host -- test tests/T-chatbot-authoring.spec.ts` against the
isolated runtime; never run browser tooling inside the container.
Use `rs-build-screenshot-gallery` for real synthetic browser captures and
`rs-mr-description-writer` for inline screenshot tables in both affected PRs.
Record capture provenance, interactions and any missing locale/viewport proof;
publish through the same project's authenticated forge CLI only.

Use deterministic synthetic MCP/graph responses for local contract proof;
this approval does not authorize paid upstream traffic or live course content.
If a real upstream check is later approved, use the host Infisical operator,
an exact synthetic scope and a call budget. No copied keys or provider changes.
Apply the local-runtime lifecycle rules and stop the exact validation runtime
after its final use unless the user explicitly keeps it running.

Each substantive slice receives its configured simplifier and applicable
authorization/data-integrity/architecture review; main verifies findings.
The integrated committed stack receives one independent final review after
affected checks. Reuse unchanged passing evidence and rerun only affected
checks after dependency integration. Record CI gaps rather than treating
skipped/cancelled tests or status-only jobs as execution proof.

Update `docs/domain-model.md` for additive attachments and
the public compatibility rule. Reference ADR 0019 for authoritative config
and the landed `docs/adr/0043-review-chatbot-revisions-before-activation.md`
for revision exclusions; no broader ADR rewrite or
unrelated glossary edit is part of this plan.

## Success, pauses and later work

The implementation terminal is the verified, reviewed draft stack and its
evidence, after the required foundation approval. Pause for a changed revision
contract, unsafe migration/locking, incompatible scope behavior, failed required
review, unavailable safe test database, or a necessary topology change.
Routine in-scope test failures get corrected without renewed approval.

After separately authorized merge/deployment, accept STG using exact image and
migration receipts plus synthetic multi-KB retrieval, both editor directions,
cross-owner denial and detached-KB exclusion on the next request. Production
promotion needs that acceptance and explicit authority. Broader component
restructuring, preview accounting, graph tools and research analytics stay with
their own work packages.

## Progress

September 8: initial source mapping and native planning rounds identified
deletion recomputation, preview truncation and graph browsing. The user accepted
zero-to-32 attachments and combined document retrieval, and rejected a primary
graph. Those decisions remain binding.

September 9: refreshed `v3-ai` and the pending revision contract. Claude advisor
identified the reverse KB binding panel, mixed-scope configurations, graph
selection, deployment ordering and unsafe singleton rollback. The final draft
incorporates these concerns. Native plan hardening returned `REVISE` in round
one and `APPROVED` in round two. Accepted corrections preserve the Boolean
detach API, name the execution owners and identify the revision ADR precisely.
Layer size estimates and cohesion rulings are recorded above.

The optional Gemini challenge was blocked by the host approval reviewer because
it would send the unpublished plan to an external provider. No request ran,
and no fallback or workaround was attempted. This is an unavailable optional
opinion, not a passed review. The required native review is complete.
Review evidence: `_local/reviews/2026-09-09-multiple-kb-plan-hardening.md`.

Status: execution resumed September 10 under the existing approval and an active native goal.
PR #5771 (https://github.com/uzh-bf/klicker-uzh/pull/5771) merged into
`v3-ai`; the landed ADR 0043 preserves the approved KB exclusions.
The reader layer starts at `352f47fd7443d93aa5720e863d6285b801cceebe`
on `rs/chatbot-kb-readers` in `trees/rs/chatbot-multiple-kb`.
Earlier dependency and checkout observations above are historical.

Main owns integration and delivery. A bounded read-only Luna executor maps the
reader consumers while main prepares verification. OpenCodex transport health
passed but readiness failed; Luna is the trusted continuity route.
Main drafted the preview route and its existing test suite: all enabled,
undeleted owner attachments are loaded, the shared scope resolver validates
configuration, and mismatched attachment sets fail before discovery. Synthetic
zero/one/many and stale-scope cases are added but have not run. Initial GraphQL
plural projections and newly named read operations are also drafted. Existing
operation documents remain unchanged for persisted-query compatibility.
The bounded Luna UI executor completed Manage plural query/type/refetch adoption
and the KB reverse-panel membership projection. Main inspected its diff and
preserved the existing link test hooks. Singleton replacement writes and their
warning remain unchanged. Main also drafted explicit graph selection in the
server, route and client, including eligible-choice errors, selection-bound
requests, viewer resets and stale-error suppression. Synthetic route/client
tests cover valid, missing, foreign and detached choices; these have not run.
Generated SDL, formatting, checks, browser proof and reviews remain unfinished.
Source remains uncommitted until verification is possible.
Human foundation review remains required before additive writes.

September 10 continuation: fresh fetch leaves this branch one plan commit ahead
of `origin/v3-ai` and zero behind (181 ahead/one behind remote default `v3`,
which is not this layer's target). `git diff --check` passes. The earlier
read-only mapper has not returned usable evidence; the settled UI subset used
a separate trusted executor while main retained the cross-system graph and
preview seams. No source commit, push, migration, model request or PR exists yet.

Verification environment: startup with `chat,manage` failed because the
configured Azurite loopback port 10003 is occupied. The existing
`KB_GRAPH_BLOB_HOST_PORT=10013` override avoids that port, but admission now
refuses both ensure and repair while lifecycle state is `stopping` with
desired `stopped-by-user`. Two exact-workspace stop attempts returned
`Workspace workloads remain running after stop`. No raw Docker workaround,
data deletion, or unrelated runtime mutation was performed. Owned Redis,
Postgres and Hatchet services remained running at the last status read;
the primary app and Azurite were stopped, and no app routes were active.
Runtime identity: `rs-chatbot-kb-readers`, Compose project `default-rs-73efc`.
A further canonical exact-path stop failed with the same workload error.
Fresh workspace inventory still shows the exact owner and zero routes; this
does not establish stopped services. Values-free failure evidence was sent to
the existing Devrouter task for a supported recovery recommendation, not runtime
mutation or deletion. Container builds, codegen, integration tests and browser
acceptance are blocked pending that recovery. Do not bypass lifecycle state.
The plan-only commit is `0631b05b82`; generated Husky hooks were absent before
dependency bootstrap, so that commit has diff validation but no hook-run proof.

September 10 verification: the workspace now accepts canonical Devrouter exec
commands and serves the routed authentication page. Earlier recovery details
are not re-certified by these checks. No paid model calls were made.
Codegen succeeded. The focused Chat suite passed 75 tests and the GraphQL
knowledge suite passed 63 tests. Chat, Manage and GraphQL package typechecks
passed, as did all seven lint tasks. Root typechecking completed 39 of 40 tasks;
the remaining schema guard reports only this layer's intended unstaged SDL.
The 68 host-only CI contract tests passed on the host; running them inside the
container fails because Devrouter is intentionally host-owned.
The integration suite removes disposable test accounts during cleanup. Restored
the local seed fixtures without a database reset before browser verification.
Changed TypeScript files were formatted with repository Biome. Browser captures,
full build, committed slice reviews and draft foundation delivery remain pending.

September 10 browser/build continuation: the full container root build passed
(26 successful tasks, 17 cached; 2m29s). Delegated synthetic lecturer login,
Knowledge-tab attachment rendering, navigation to the KB, and reverse-panel
membership passed in the browser. Local screenshots and limitations are in
`_local/screenshots/multiple-kb-readers/manifest.json`. Graph selection and
German coverage remain pending. A Luna executor owns the additional mocked
zero/one/many GraphQL reader tests; its resumed run is still in progress.
The repository's shared Git configuration changed to `core.bare=true` during
verification. Ordinary worktree Git commands now fail; explicitly supplying
this worktree's git-dir and work-tree permits read-only diff validation.
Shared configuration was not changed by this task. Source remains uncommitted;
slice reviews and draft foundation PR remain outstanding.

The reader-test executor returned `DONE_WITH_CONCERNS`: the new
`packages/graphql/test/chatbotKnowledgeBaseReaders.test.ts` covers zero, one
and many projected attachments, legacy null behavior and query filtering. Its
mock rejects relation truncation without removing the singleton index.
Biome and explicit-worktree diff checks passed; Vitest remains unrun because
Devrouter rejects the checkout after the shared Git configuration change.
The same rejection prevents the canonical exact-path runtime stop. The browser
session was closed; runtime shutdown is unverified. Resolve shared Git ownership
before configuration changes, then run the focused test and resume delivery.

September 10 recovery: the user explicitly authorized restoring `core.bare=false`.
Normal Git and Devrouter commands now work. All three mocked reader tests passed
in the container (Vitest 3.2.4), covering both projections with zero/one/many
attachments. Fresh target `039e7e1753` adds only Langfuse service-name source and
tests; it does not overlap this layer. Full-build evidence above remains valid
for this unchanged reader implementation. Source review and draft publication
are the next delivery steps; human foundation approval is still outstanding.

Reader foundation is published as draft
[PR #5879](https://github.com/uzh-bf/klicker-uzh/pull/5879), remote head
`d5146fa0a3`. The simplifier's single-response-parse improvement passed all
13 graph-client tests and Biome. Slice risk review is running after its missing
manifest was resent; final review and multiple-graph browser proof remain pending.
The complete pre-integration checks passed: 40 container tasks and 102 host
contract tests, with staged secret scanning. Hooks were replaced by equivalent
checks across the required host/container boundary.

Local merge `3bc1607138` integrates `v3-ai` at `5cb1e445df` for its frontend
dependency upgrade. Frozen-lockfile installation passed. The integrated full
build is not green: PWA and Manage generated dev/production validators collide;
Manage also reports TS5097 for existing test imports. Only stale PWA generated
dev types were reversibly moved to `/tmp/kb-readers-pwa-dev-types-20260910` in
the container. No upstream source/config repair has been made. Do not reuse
the earlier full-build pass as proof for this new dependency state. The local
merge has not yet been pushed. Browser proof owner remains the resumed reader
executor; the main session owns integration repair and delivery.

September 10 recovered continuation: `core.bare=false` is verified. Current
`v3-ai` supplied the exact production TypeScript import fix at `1d85533a65`.
Merged that concrete build dependency without rebase into `9f41ecb7ff` and
pushed the head to the existing draft foundation PR. Unrelated primary-checkout
changes remain untouched. The full integrated build now passes all 26 tasks
(22 cached, 1m18s). Stale generated Manage dev types were reversibly moved to
`/tmp/kb-readers-manage-dev-types-20260910` inside the container. All 75 focused
Chat graph/preview tests and three GraphQL plural-reader tests pass on the
integrated dependencies. Exact-head CI has started; it is not yet terminal.

Slice review completed with one accepted verification gap: directly prove that
an earlier delayed graph-selection response cannot override a newer selection.
Report: `_local/reviews/2026-09-10-multiple-kb-readers-slice-review.md`.
The existing `reader_projection_tests` executor still owns browser graph proof;
main owns integrated checks and final delivery. Final review and human
foundation approval remain pending. No additive writer or migration has started.

The integrated package check also passed all 40 tasks, and lint passed all seven
tasks. The first remote failure is OpenCodeReview run `34492672357`: its provider
returns HTTP 402, all 22 file requests fail, and zero token/tool usage is reported.
This is not a completed review and was not retried. The existing slice reviewer
is checking a remote claim about tool-free preview behavior before any scope
validation change. The query-prefix comment also remains undispositioned.

The same slice reviewer rejected the preview finding: optional managed KB rows
are invalid under the shared scope contract; genuinely absent KB configuration
remains tool-free in both routes. Preserve this validation rather than adding
a preview-only fallback. The browser executor returned BLOCKED after a Zen CUA
inspection hung for 734.5 seconds. No browser journey ran, no files changed and
no shell process was left. Main must resume graph-selection/stale-response proof
through the repository's host engineering-browser route; no replacement child
is needed. Browser screenshots currently cover only earlier singleton flows.

Next goal continuation verified host agent-browser starts successfully and
Devrouter resumes the exact chat/manage runtime. The delegated-login page is
reachable. Auto-review rejected entry of the repository's public synthetic
lecturer credentials because command arguments persist. No login workaround
was attempted. Authenticated browser proof now needs an approved fixture-login
method or human login. The same executor owns offline regression-test seam
selection only; no application or database changes are authorized by that task.

Offline seam assessment returned NEEDS_CONTEXT with no changed files. There is
no installed React component-test layer or existing graph-workspace Playwright
journey. Use the authenticated full Chat seam in `playwright/util/chat.ts` for
the remaining test after the login boundary is resolved; do not introduce a new
component-testing dependency. The worker is terminal and main owns continuation.
The login restriction has persisted across three goal continuations. Local
runtime and browser were stopped, and no credential workaround was attempted.
Required next input: authorize the public local-only fixture login or provide
human-authenticated browser access. External OpenCodeReview also needs its HTTP
402 resolved. Final review and human foundation approval still precede writers.

September 10 slice-proof continuation: the accepted verification gap now has a
deterministic browser test. `playwright/tests/Y-chat.spec.ts` gained a
"Chatbot Knowledge Graph Selection" suite. The initial request offers two
graphs; the request for the first choice resolves 1.5s late with a second
selection-required response while the participant selects the second choice;
the test then asserts the choice text, the loaded node label and the mounted
viewer all survive that late response. It renders the workspace from the
`/{id}/graph` route alone and intercepts every graph response, so no knowledge
base, graph build or FalkorDB instance is required. Assertions were checked
against the component and viewer source: the workspace drops the viewer when it
clears a selection, and the loaded-nodes list renders a node label only after a
successful load, so both assertions discriminate a stale reset.

Local verification of that test is not yet possible in this worktree: root
`node_modules` is empty, the devrouter runtime recorded for
`rs-chatbot-kb-readers` is stopped, and the sandbox denies Git metadata writes,
so the commit hook's `check:all` cannot run here. Prettier was run directly on
the spec. The Playwright suite in CI is the verification of record for this
test.

Exact-head state at `9f41ecb7ff`: every check passes except
`test-playwright-execution / test-playwright-hosted (8, 8)`, which fails only
in `tests/V-template.spec.ts` on a student password-login timeout with a
sibling test marked flaky. That file and the PWA are outside this diff, which
touches only chat, manage, GraphQL, i18n and kb-management. The failed job
cannot be retried while run `34492674396` remains in progress; its
`test-playwright-status` gate has been queued on `ubuntu-latest`. The separate
`ocr-review` failure is the external provider's HTTP 402 and needs billing or
an owner decision. The repository has no self-hosted runners registered, and
many other branches are competing for hosted runners.
