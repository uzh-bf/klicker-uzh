# Basic native FalkorDB retrieval for student chat

## Approval summary

Implement and verify a basic version of graph-assisted student chat, as authorized by the user on 2026-09-11. Use the existing native FalkorDB client; add no retrieval frameworks. Lecturers independently control the student concept map and graph-assisted document search. Improve the existing map with a focused, accessible exploration entry.

The basic retrieval path uses graph connections as search hints. It preserves the original document search, runs at most one additional search using related concept names, and combines returned document passages. Graph descriptions and extraction chunk references are not citations. This deliberately avoids pretending that the current producer-to-document passage mapping is complete. Direct edge-to-passage retrieval, semantic indexes, diffusion, community summaries and a quality pilot remain later work.

Authority: executable batch. The user's implementation request authorizes source changes, synthetic verification, local commits, ordinary task-branch push and draft PR delivery. No merge, deployment, production data access, graph rebuild, paid model benchmark or new provider is included. Terminal: a reviewed native implementation with focused tests, real local FalkorDB query proof, browser evidence, and draft delivery, or a concrete capability blocker after completing independent work. Boundary owner: self.

## Execution details

### Scope and baseline

Public repository `uzh-bf/klicker-uzh`, target `v3-ai` at `41038e8b5b5b46d8953017a697917613fa7170fc`. The graph package and viewer do not exist on the current `v3` target. Task branch `rs/student-chat-graphrag`, worktree `trees/rs/student-chat-graphrag`. A clean execution branch was needed because the prior planning branch diverges from `v3-ai`. Prior research artifacts remain in the planning worktree.

The public adapter composes the existing graph reader with an existing scoped MCP document tool. It introduces no ingestion, document corpus, embeddings, vector store, private engine or alternate answer generator. Document search stays in its provider. This is graph-guided query expansion, not full passage-level GraphRAG or a claim of improved answer quality. Only the established KB document tool is eligible; arbitrary third-party tools are untouched. Both chat engines receive the same wrapped tool contract.

The existing graph export contains concept names, descriptions and `RELATED` edges. `source_id` can contain LightRAG chunk identifiers; the current public viewer expects resource identifiers. Therefore graph text is never promoted to source evidence in this version. The source provider remains responsible for citation metadata. Results with incompatible document envelopes retain the unchanged original response.

### Product primitives and defaults

| Primitive                 | Change                                                 | Invariant                                                                                                                  |
| ------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Chatbot capability policy | Independent map and graph-search permission            | Lecturer-owned; disabling a feature is enforced server-side, not only hidden.                                              |
| KB published graph        | Reuse read-only publication and existing native client | No rebuild or graph mutation; retrieval declines stale builds, avoiding influence from removed sources.                    |
| Document grounding        | Compose original and graph-expanded document queries   | Only document-provider passages are evidence; original required-tool failure never becomes a successful graph-only answer. |
| Concept exploration       | Focused initial search and accessible related concepts | No automatic student message; existing lecturer preview remains compatible.                                                |

Preserve existing map access for old chatbots, default new chatbots to map off and retrieval off. Existing retrieval is always off until explicitly enabled. Use two dedicated boolean fields rather than overloading KB graph generation or pedagogical mode JSON. Carry these fields through authoring revisions and publication; old saved revisions inherit their live values. One schema-generated migration adds both fields. No separate policy writer bypasses the revision lifecycle.

### Retrieval behavior

1. Resolve chatbot permission and current enabled KB bindings on each tool execution, intersected with the existing server-authorized document KB scope. No model input chooses graph names or KB IDs. Decline ambiguous multi-KB mode until the pending plural-reader contract is integrated; retain document-only behavior.
2. Run the original document operation. Independently use bounded query terms to match graph concept names and relationship keywords/descriptions through fixed parameterized read-only Cypher. Select at most four seeds and a small one-hop neighborhood; no generated Cypher or recursive agent loop.
3. Return at most six safe concept names as expansion hints. Do not return raw graph properties, graph names, descriptions, private URLs or source IDs to the model. On stale/unavailable/timeout/no-match, use the original document result.
4. With a recognized successful document-result envelope, perform one additional document operation under exactly the same transport and KB scope, preserving input fields and execution options. Append only bounded related concept names to the query. Propagate abort; enforce a bounded graph and augmentation deadline. An augmentation failure preserves the original result.
5. Combine only compatible source-passage results. Deduplicate exact stable provider identities when supplied, otherwise exact source metadata plus content; never join chunks by filename or similar text. Keep original and expanded candidates balanced within a shared cap and deterministic order. Preserve document metadata and source grouping. Do not keep a provider-generated answer whose citations/order no longer match; the existing chat engine generates the final answer from passages. Unknown/answer-only result contracts fall back unchanged.

The supported merge contract is successful `mode: 'documents'` with `sources[]`, each source containing `chunks[]` with nonempty string `content`. Preserve all source and chunk metadata, including provider IDs, reference, display name, page and timestamp fields. Decode direct payload, JSON text, or the MCP envelope containing `structuredContent` and/or JSON text. Reconstruct one authoritative payload into both `structuredContent` and a single JSON-text content block. Do not merge other content-block types, answer mode, failed or unknown envelopes. Remove obsolete provider-generated answer/summary counts when rebuilding; emit current source/passage counts and apply existing source sanitization to the entire result. Tests must exercise both representations and demonstrate the extra graph-discovered passage.

No graph evidence payload is sent to the browser when the map is disabled. Operational proof records safe counts and fallback reasons, not query text. Deterministic query expansion adds at most one existing document-provider request; no additional model/provider dependency is added. Revalidate before dispatch and before return. The signed MCP transport scope is immutable: if access or enabled bindings no longer equal its original scope, abort and suppress both original and expanded results instead of narrowing or reusing that transport. Policy disablement alone can retain authorized original document results. A source/build change suppresses graph augmentation; the document provider still enforces source access.

### Ownership and sequence

### Delegation Map

| Slice                                                  | Owner and dependency                                | Owned paths and acceptance                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native graph hint reader and document-tool composition | main; integration waits for policy fields           | `packages/knowledge-graph/`, `apps/chat/src/services/{graphAssistedDocQuery,mcpClients}.ts`, `apps/chat/src/lib/server/knowledgeGraphRuntime.ts` and corresponding retrieval tests. Fixed read-only query, actual synthetic FalkorDB traversal, original-search preservation, scope and failure tests.                                                                                                                           |
| Lecturer policy and student map improvements           | executor after planner gate; no retrieval writes    | Chatbot Prisma model, `packages/types/src/chatbotAuthoringRevision.ts`, chatbot GraphQL service/schema/ops and revision tests, manage chatbot forms, `apps/chat` layout/bootstrap/assistant/graph-route and policy tests, shared graph viewer and associated de/en labels. Two independent controls through revisions, direct-route enforcement, focused accessible map. Main generates migration/client/SDL after source edits. |
| Integration and verification                           | receiving main session; both source slices complete | Generated migration/SDL/analytics mirror, synthetic integration/browser harness, plan/review artifacts. Both engines consume common tool seam; relevant tests, type checks, migration and browser proof; immutable source reviews and draft PR. No other writer owns these paths.                                                                                                                                                |

One cohesive basic feature package is proposed. Keep commits separable by policy and retrieval but do not publish independently unusable stack fragments. If implementation grows into independently functional provider or advanced retrieval packages, pause topology expansion rather than silently adding scope.

### Verification and gates

Use the repository's disposable managed container for installs/builds/unit tests and migration generation. Host browser tools verify the routed app. A task-specific Azurite host-port override avoids stopping another worktree's runtime. Real FalkorDB verification uses a disposable synthetic graph owned by the test harness; no retained graph/database mutation or broad cleanup. If no approved runtime can execute the native service, record that limitation and finish source/test work.

Test scope mismatch, disabled policy, stale graph, missing publication, no matches, unrelated graph hubs, malicious/oversized query values, result-envelope failures, augmentation timeout, cancellation, duplicate chunks, conflicting source metadata, and preservation of document citations after reload. Test only behavior/contracts, not translation wording. Observe a synthetic relationship whose neighbor concept causes an additional supporting passage to be retrieved, versus the original document query.

Browser checks cover lecturer save/revision behavior, student map off/on, direct route rejection, search/expand/keyboard interaction, mobile layout, English/German and thread preservation. Capture a synthetic screenshot gallery. Quality improvement and learning outcomes are not claimed from this deterministic proof.

Full-path reviews apply: planner before implementation, simplifier and focused risk review for committed implementation, one integrated final review. Existing Claude/AGY authentication failures are reusable routing evidence; use eligible continuity as required. Pause only for a material scope/data/authority change or a concrete unavailable capability. Finish independent authorized work first.

## Progress

- 2026-09-11: native-client choice approved by user; current graph branch and producer export inspected. Planner APPROVED after one correction pass specifying immutable-scope revocation, document-envelope reconstruction, and path ownership. Managed runtime starts with the supported Azurite port override. Source implementation proceeds while the container prepares dependencies; plan commit waits for repository-native checks rather than bypassing hooks.
- 2026-09-11 continuation: policy/UI executor returned DONE (source only) and was closed. Native retrieval, bounded document expansion and regression tests are written. Main review corrected concurrent augmentation and retained separate provider source groups so the existing first-chunk citation normalizer preserves added-page locators. Course identity is also retained and revalidated. No retrieval framework or dependency was added.

### Verification progress

- Recovered the existing managed runtime through canonical stop and execution.
  Canonical bootstrap completed, including package/backend builds, GraphQL
  generation, guarded disposable database reset/push and synthetic seeding.
- Generated migration `20260911214257_chatbot_knowledge_graph_policy` with
  Prisma 7.8.0. Removed generated unrelated baseline drift (two defaults and one
  index rename); retained only the two chatbot columns. Analytics schema synced.
- Graph package: 77 tests passed. Native FalkorDB v4.20.4 integration: one test
  passed against a disposable loopback-only server, then the server was stopped.
  Image digest: `sha256:adbddd418916c25618564ff8597a919b08bc76452ebeb74eb985c38d7281df62`.
- Chat retrieval/scope/route/client checks passed; layout test corrected to inspect
  returned React element props rather than expecting an unrendered child call.
- Lecturer management and authoring revisions: 76 tests passed after fixture
  cleanup. Redis services were unavailable during that run; repeat once the
  complete selected runtime is healthy.
- Chat typecheck caught the MCP SDK's unknown input, required execution options,
  and synchronous-or-promise result contract. Wrapper now preserves those generic
  contracts; recheck pending. Graph package typecheck passed.
- Main owns remaining coupled integration and final proof. The source executor
  is finished; no additional independent writable slice warrants redelegation.

Exact runtime: `/Volumes/HOME/Git/klicker/klicker-uzh/trees/rs/student-chat-graphrag`,
Devsy `rs-student-chat-graphrag`, provider UID `default-rs-ef739`.
A failed start rolled its generated config back to base services while the owner
record retained `chat,manage,mcp`. Restored the generated file only after proving
its exact SHA256 equals the recorded effective configuration, then invoked
canonical `ensure --repair`. No owner state or locks were edited.

Remaining: typechecks, healthy-runtime revision repeat, browser matrix and
screenshots, full applicable checks, committed simplifier/risk/final reviews,
ordinary task-branch push and draft PR. The task is not yet complete.

### 2026-09-12 source verification checkpoint

Chat, Manage, graph and GraphQL types now pass. The full container typecheck
completed 39/40 tasks; the two new intentionally invalid JSON fixtures caused
the remaining GraphQL error, then passed after explicit test-only annotations.
All seven lint tasks passed. Staged formatting, syncpack, schema synchronization,
agent/doc policy and local-KB checks passed. Host-only checks were split from
the container runner: CI contracts 69/69 and host launcher 32/32 passed on host.
GraphQL policy tests 76/76 passed with Redis services running. Staged gitleaks
scan found no leaks. Runtime bootstrap warnings are not clean build-type proof;
the dedicated typechecks above are the evidence.

Browser navigation reached delegated lecturer login and the management shell,
but full interaction evidence remains blocked: Traefik serves `TRAEFIK DEFAULT
CERT` for this workspace. Canonical repair fails host curl certificate validation
and rolls back the published routes. Supplying the existing mkcert CA did not
resolve the mismatch. No shared TLS configuration was changed. Do not claim
screenshots, policy save/reload, student graph interaction or answer persistence
verified. Browser gate remains open.

Automatic approval review rejected the proposed `HUSKY=0 git commit`, because
bypassing pre-commit hooks was not specifically approved. No bypass commit ran.
A normal hook-enabled commit is the supported alternative being checked.

The normal hook-enabled commit also failed before committing:
`ERR_PNPM_VERIFY_DEPS_BEFORE_RUN: Cannot check whether dependencies are outdated`.
The hook runs host pnpm, while this worktree's dependencies are container-owned.
No commit, push, source-review gate or draft PR has completed. The source changes
are staged; current progress updates may be unstaged until the final checkpoint.
Resume with explicit approval for the split host/container check commit method,
or a working normal hook environment. Independently, stable browser proof needs
shared Traefik certificate repair by its owner. The approved feature scope does
not include changing that shared router configuration.

Runtime release verified at 2026-09-12 00:06 Europe/Zurich: canonical stop
succeeded; `devsy workspace status rs-student-chat-graphrag` reports `Stopped`,
and `devrouter ls` contains zero routes for the exact source path. The disposable
FalkorDB test container is absent after its explicit stop. No data/worktree was
deleted. Unrelated primary-checkout untracked plans were preserved.

### 2026-09-12 approved continuation

User explicitly approved the split host/container commit method and required local
E2E. Commit `8136a5e60` records the basic implementation after the staged secret
scan and previously completed split checks. Native simplifier and slice review
completed; both simplifications accepted, the single concurrency finding rejected
because check and reservation have no intervening await. Reports are in the ignored
review directory.

Canonical `devrouter setup --repo <task> --yes` repaired missing workspace TLS
coverage while preserving existing certificate names. The task subsequently
reported ready, and host TLS validation succeeded. Its diagnostics also reported
an unrelated shared network issue; no network allocation or cleanup was done.
Lecturer graph settings saved independently and survived reload in the real UI.
Stable DOM selectors were necessary; initial browser references did not activate
the switches. Native FalkorDB-to-document integration now executes three tests
with synthetic documents, plus 15 wrapper regressions; all 18 pass. GraphQL
revision/type verification passes; 76 policy tests passed after the known seed
collision was cleaned by the test harness. Browser fixtures were then restored.

Current local native test service: task-owned `klicker-graphrag-e2e`, loopback
port 16389, pinned FalkorDB digest as above, no retained corpus. An ignored
`.local-kb-services.env` supplies this task connection. No paid model or production
provider calls were used. Remaining: student browser matrix, durable local test
instructions, final review and draft PR delivery.

Student browser proof now covers real graph search, concept selection, native
neighbor loading, map-disabled HTTP 403 and hidden navigation, desktop and
390px mobile layout. German lecturer labels were captured. Browser discovery
found clipped desktop details (fixed with min-width containment) and overlapping
expanded concepts (fixed by preserving radial insertion positions instead of
recentering a disconnected subset). Chat/shared-component typechecks and 37
access/client tests pass after correction. Full Biome check flags three pre-existing
viewer rules (React import, form search role, legend aria-label), verified in the
base; formatting and relevant package checks pass.

No paid model completion, production MCP retrieval or browser answer persistence
was exercised. Native integration verifies citation normalization after JSON
round-trip; this is narrower than an actual generated-answer reload. The basic
implementation is graph-guided query expansion with ordinary document grounding.

## Navigation extension approved 2026-09-12

The user approved overview on entry, autocomplete and return-to-overview, with
scalability and safety checks. This extends the existing full-path package and
draft PR 5912. Approval remains executable; no merge, deployment or data-model
change is included. The local runtime remains running for the user's manual tests.

Primitive impact: reuse the lecturer-controlled published graph and concept
identities. Compose its read operations into discoverable student navigation.
Student overview is a bounded sample, not a globally ranked or complete graph
when truncated. No new domain object, framework, index or model call is added.

| Slice | Owner | Acceptance |
| --- | --- | --- |
| Native query bounds and student admission/build contracts | main, coupled safety decisions | Native synthetic hub/sparse graph tests; admission, disabled map and stale-build rejection |
| Overview, suggestions and bounded viewer state | executor | Accessible combobox, serialized debounce, race rejection and 500-node/1000-edge canvas caps |
| Integrated proof and existing draft delivery | main | Native checks, host browser including lecturer compatibility, screenshots and scoped reviews |

Native browsing reads limit candidate nodes before degree projection and avoid
global degree sorting. Each read-only query has at most 1000ms database execution
budget; overview/neighbors have two sequential queries. This is not an end-to-end
latency guarantee. Substring search can still scan the graph and returns a
recoverable failure on timeout. Student admission is per process: eight active
reads, two per participant, 60 requests per participant per minute, at most 2000
tracked identities. Reject immediately with Retry-After rather than queueing.
Slots stay occupied until the underlying awaited read settles. Multi-replica
limits multiply; distributed admission and indexed search remain later work.

Student neighbor requests require the originating KB/build and a bounded decimal
node ID. Resolve authorization/current publication first; reject a changed build
before traversing. Refresh the overview rather than mixing builds. Lecturer
adapter remains compatible; the shared viewer also rejects changed-build
neighbor responses. Suggestions retain their source identity, never select by
refetching their label.

Suggestions wait 300ms after at least two characters, serialize requests, and
retain only the latest input. Keyboard, IME and pointer interaction must work;
Escape, blur, reset and data-source changes invalidate pending suggestions.
Typing never changes the canvas. Explicit submit supports one-character search.
Overview/search/selection invalidate older operations when starting. The canvas
keeps existing nodes first, admits new nodes only within its cap, and drops edges
with missing endpoints; replacement paths obey the same cap. Selecting a
suggestion starts a focused view so the selected concept always fits.

Planner round one requested explicit admission budgets, source-bound node IDs,
canvas overflow semantics and input/race cases. All were accepted; round two
approved this extension. Earlier optional AGY review failed required read access;
that route remains unavailable. Tests must cover high-degree hubs, sparse/no-match
search, edge reads, saturation/recovery, stale builds, delayed responses, keyboard
selection, reset, mobile layout and the existing lecturer viewer.

### Navigation verification progress

Navigation implementation is committed in `90373dbcb5bef08708d1e6e463b88e8625484050`;
accepted simplification is `9f4c37a7a8a4d92a0aff8a6ed53a0bcdc96db975`. Both are
pushed to the existing [draft PR](https://github.com/uzh-bf/klicker-uzh/pull/5912).
No new schema migration or dependency was added by navigation. The cohesive
package now contains 53 substantive paths, 4,146 additions and 161 deletions
(excluding project artifacts and generated SDL). Navigation remains in the same
package because viewer/request identity and server bounds form one working flow.

- Native graph package: 79 tests pass, including a disposable 5,000-neighbor hub,
  bounded edges, injection-shaped no-match search and timeout/recovery.
- Navigation admission/route/client/state: 72 tests pass. After simplification,
  33 state/client tests and chat typecheck pass. Root serial checks pass 40/40;
  lint passes 7/7; host workflow checks pass 123/123. Static scan: 210 rules on
  12 existing and two new files, zero findings/errors. Staged secret scans pass.
- Full production build passes 26/26. Initial failures came from concurrent
  Prisma generation and duplicate generated development/production Next types.
  Serial generation corrected the former; temporary isolation/restoration of
  generated development types corrected the latter without source changes.
- Host Playwright: all nine tests pass. One exercises real native endpoints,
  overview, keyboard selection/expansion, 403 policy, 409 build identity, mobile,
  Escape and reset. Eight use controlled browser responses for stale requests,
  blur/reset, serialization, IME, debounce cancellation, pointer and touch.
- Real agent-browser captures cover overview/autocomplete/focus/mobile and the
  existing lecturer preview. Visual inspection fixed competing layout animations
  and excessive automatic zoom. Five synthetic captures were published through
  host gh; PR readback and actual rendered images verified. Student graph labels
  retain the existing English-only defaults; German lecturer controls are earlier
  applicable evidence.

Lecturer verification initially found a missing nullable `KB.storageLimitMiB`
column in the disposable local database. Guarded schema diff showed only that
addition, two existing UUID defaults and an index rename. Non-destructive guarded
`prisma:push:raw` aligned it; lecturer overview/search/expansion then passed. No
retained/production database, corpus, or graph was touched by this repair.

Slice review: done — ignored report `project/_local/reviews/navigation-slice-review.md`,
all 20 navigation paths reviewed with no findings. Simplifier: two accepted
removals of unused state and unreachable branches, verified and committed.
Integrated final review passed on the complete committed range
`9cb4042334751fd80fde5b95319a6c41cdd4cdaa..9f4c37a7a8a4d92a0aff8a6ed53a0bcdc96db975`.
All 55 changed paths were covered with no exclusions and no P1/P2 findings.
The sole P3 finding was accepted: combined document envelopes now emit explicit
source and passage counts. The existing deduplication test now distinguishes
two source groups from three retained passages; all 15 retrieval tests and chat
typecheck pass. This additive metadata correction leaves navigation unchanged;
the browser and screenshot evidence remains applicable.
CLI Claude OAuth and AGY read-access failures from this package are reused;
GLM max continuity carries the full independent final-review contract. Exact-head
CI is running; hosted OCR previously failed provider HTTP 402 and is not a
passed review. No merge/readiness/deployment claim is made.

Runtime retained for the user's explicit local manual-testing request:
`/Volumes/HOME/Git/klicker/klicker-uzh/trees/rs/student-chat-graphrag`, Devsy
`rs-student-chat-graphrag`, UID `default-rs-ef739`; profiles `ai,chat,manage,mcp`.
The local FalkorDB fixture service `klicker-graphrag-e2e` remains on loopback16389.
Lease checkpoint: user's next manual-testing follow-up. No deletion is proposed.
Substring scans and per-process admission are bounded local protections, not a
measured multi-replica capacity guarantee. No paid-model answer quality or real
browser generated-answer persistence is claimed.

### Approved chat and graph composition extension

User requested an unobtrusive header icon, simultaneous chat and graph, fullscreen
and editable node/relation questions. The same draft package remains the delivery
unit. Planner challenge accepted bounded selection payloads, stable fullscreen
mounting, focus containment, and explicit close lifecycle; revised plan approved.

Primitive impact: compose the existing authorized graph selection with the
existing conversation draft. Chat thread identity, attachment ownership, lecturer
visibility and retrieval policy remain unchanged. No new product object, API,
dependency or migration; no new ADR because this reversible presentation does not
change the underlying graph/retrieval contract.

The panel is closed by default; legacy `/graph` opens it on entry. Toggling does
not navigate or remount the thread. Desktop uses a right dock; narrow viewports
stack graph above chat. Fullscreen keeps one graph instance, preserves viewport,
contains focus and makes background controls inert. Escape restores the dock;
close unmounts the graph, cancels pending work and returns focus to its toggle.
Reopening starts an overview. Asking restores composer access, appends an editable
localized prompt to the current draft, preserves attachments and never sends.
Only labels bounded to 200 characters per field are inserted, with generic
missing endpoint text instead of internal IDs. Mobile asking closes the graph
so the keyboard can use the remaining space.

Owners and acceptance:

- Executor: shared graph Viewer, Details, View and Labels files; optional typed
  Ask callback, contained details, viewport preservation and cleanup verification.
  Lecturer defaults remain unchanged.
- Main: assistant layout, existing three chat graph components and new
  `ChatKnowledgeGraphPanel.tsx`, both i18n message files, existing graph Playwright
  specification, chat platform guide and this plan. `thread.tsx` remains unchanged.
  Integrate via the installed assistant-ui composer draft API, then verify browser
  behavior, format/type/lint/build, reviews and the existing draft PR.

Test portfolio: extend existing browser coverage for unchanged URL/thread/draft
and attachments, node/relation insertion without submission, closed debounce and
late results, fullscreen focus/viewport, mobile and embed. Retain existing native,
access and request-race coverage; no new API/auth/DB tests for this presentation.
Desktop, mobile, embedded and localized captures replace superseded navigation
images in the same draft. Prior source reviews do not cover this extension.

Progress: dock implementation committed at c680f663; label-only simplification
at 4ae0002 removes duplicate Ask-label prop plumbing. All 12 host browser tests
pass, including native graph policy/build checks, an existing thread with draft
and image attachment, fullscreen focus, node/relation insertion without sending,
mobile embed and request cancellation. All 19 graph state/payload tests pass;
chat/shared types and lint pass. Split pre-commit checks pass: container typecheck
40/40, lint 7/7 and remaining policy/format checks; host CI-planning tests 71/71
and launcher tests 49/49. Production build passes 26/26 on the final label-only
source as well. Focused Opengrep reports zero findings across 210 rules
and 12 files, with its normal skipped/partial-analysis limitation.

Real browser evidence covers closed icon, desktop dock, node details, fullscreen,
prefilled draft, mobile embedded relation/draft and German controls. Eight
synthetic captures were published to the existing draft and all eight load in a
real browser. Existing inner viewer labels remain English. Screenshot provenance
and receipts are in ignored `project/_local/dock-gallery/`.

Runtime startup required its existing provider injection, exact profile and blob
port. An unintended Playwright seed reset removed the disposable demo chatbot;
scoped guarded fixture restoration recovered its course, enrollment, bot and
native graph. A subsequent MCP startup failure was traced to scoped-auth server
state paired with retained authenticated-fixture parameters. Restoring only the
two validated synthetic config parameter objects allowed canonical managed repair
to succeed. No production or retained external data was changed.

Simplifier completed; its redundant Ask-label path finding was accepted and
verified with focused checks and German draft insertion. Dock slice review passed after the correction below. The GLM CLI could not start because its launcher required an
unavailable admin token. The earlier native integrated reviewer was successfully
resumed for the new scope, preserving its full final-review contract and prior
source evidence. Integrated review passed after the correction below. The installed Codex CLI shim also
points to a missing backing executable; neither tool was reconfigured.

Runtime retained for the user's local-testing lease: exact checkout and
`rs-student-chat-graphrag` identity above, six healthy routes and synthetic native
graph. Lease checkpoint remains the user's next testing follow-up. No paid-model
completion was attempted; prior OpenRouter 402 remains a limitation. Merge,
readiness and deployment remain outside the approved terminal condition.


Dock review correction: both independent reviewers identified the same nested
Escape defect. The search input consumed every Escape; tooltip dismissal could
also mark the event prevented after focus moved. Commit 8b4de3a makes active
suggestions/debounce explicitly stop propagation, lets idle search Escape reach
the panel, and preserves composition handling. All 12 browser tests pass again,
including idle search and first-dismiss/second-exit sequences; 19 state tests,
chat/shared types and lint pass. Both reviewers accepted the correction. The final production build passes
26/26. Integrated review covers all 59 package paths with no exclusions and no
remaining findings. The draft is updated with eight verified native screenshot
attachments; exact-head hosted CI remains separate and pending.

### Approved retrieval evaluation extension (2026-09-12)

The user requested research followed by evaluation-led improvements using the
existing private evaluation framework. This is an executable batch within this
feature. The independent first slice makes retrieved passages observable to the
framework; the course comparison depends on naming the corpus and approving its
passages for the local model provider. The local four-document MCP fixture is
transport/diagnostic evidence, not a course-quality benchmark. No quality gain is
assumed, and expected answers remain evaluator-only.

Research supports a task-stratified comparison. [GraphRAG-Bench](https://arxiv.org/html/2506.05690v3)
evaluates graph construction, retrieval and generation separately and finds
varying benefits across question types. [HippoRAG 2](https://arxiv.org/html/2502.14802v1)
uses semantic passage/phrase linking and graph retrieval; its findings do not
validate our lexical one-hop expansion. [LightRAG](https://arxiv.org/abs/2410.05779)
combines entity and relationship retrieval with its indexing assumptions, which
our cleaned independently persisted graph does not inherit. [EA-GraphRAG](https://arxiv.org/abs/2602.03578)
proposes selective dense/graph retrieval and fusion; this preprint motivates an
experiment, not a course-quality claim. [Reciprocal rank fusion](https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf)
and [Lost in the Middle](https://aclanthology.org/2024.tacl-1.9.pdf) motivate
controlled ranking and equal context budgets. Native FalkorDB remains the
application retrieval engine; no new retrieval library is planned.

The pinned framework's Chat Completions client retains the completion ID but
ignores tool outputs. Its existing QA-file interface accepts retrieval_context.
Use that interface rather than adding ignored transport extensions or changing
private framework code. Preserve semantic similarity and its 0.5 threshold.
Add contextual precision, contextual recall and faithfulness as diagnostic
metrics at 0.7. Their scores need actual retrieved passages; missing, malformed
or incomplete evidence is ineligible, never a successful zero-context score.
See [evaluation instructions](../evaluation/README.md) for runnable commands and
artifact handling. The framework's primary gate also expects tool correctness;
this profile therefore reports individual metrics rather than claiming that
aggregate gate passed. Source-ID IR scoring is unsupported at this pin.

Ownership and acceptance:

1. Trusted mapper completed the private framework contract inspection. Main owns
   research, private-framework execution, corpus/provider selection, methodology,
   metric YAML, wrapper model alignment and its existing shell regression.
2. Executor owns the public local target, bounded evidence helper, QA enrichment
   CLI and their Node tests. No private framework or corpus content enters this
   external worker's scope. Default target output remains unchanged.
3. Main owns offline framework integration in
   evaluation/tests/test_graph_metric_contract.py. It must prove ordered passage
   consumption and metric selection/accounting using the pinned loader and
   runner, fake credentials and substituted judges without network or spend.
4. Main owns course comparison after corpus/provider selection, then candidate
   selection, integration and delivery. Data/method decisions keep this coupled
   work local. The first live smoke is at most six fixed-Luna target turns,
   three paired questions, one target attempt each, single-attempt judging and
   USD5 maximum. Do not start without observable bounded spend. Stop on any
   model/transport/capture/required-metric failure. Auto is a later separate arm.

Capture is opt-in through KLICKER_EVAL_EVIDENCE_DIR and a required run ID. It
binds the completion ID to run, requested/persisted model, mode and question/
answer hashes. Only recognized KB_doc_query document passage text is captured:
no arguments, reasoning, source URL fields or arbitrary metadata. Bounds are
64 passages, 256KiB UTF8 passage text, 2MiB input/capture, nesting depth five.
Preserve order and duplicates; overflow makes the whole case ineligible rather
than exporting a prefix. Failed/unknown/mixed document outputs also make the
case incomplete. Known empty differs from no document calls. Evidence writes
are exclusive 0600 files in private nonsymlink 0700 directories; unsafe paths,
IO failures and obvious credential/private-URL text fail opt-in capture. Text
filters do not replace corpus/provider permission. Enrichment checks exact
completion/run identity, hashes and model, refuses ambiguous/missing records
and overwrites, and validates all input before writing a private output.

Freeze 30–50 passage-grounded cases from one approved corpus, separating dev and
holdout by concept/evidence family, including translations. Fix Luna, mode,
prompt, reasoning effort, corpus/build and context budgets. Compare ordinary
RAG, current graph expansion and at most two candidates selected from dev
failures. A non-graph second-search control uses predeclared document terminology,
never gold answers or graph hints. If provider controls cannot equalize budgets
or expose that control, label the comparison end-to-end and retain the confound.
Persisted tool names do not reveal internal augmentation queries/call counts;
record them as unavailable unless an external synthetic MCP harness observes
execution. Capture hashes preserve evidence identity locally; manual source
coverage complements the framework's LLM-judged metrics.

Report paired answer correctness, retrieval coverage/order, faithfulness,
citation support, no-answer behavior, latency, failures and spend by question
stratum. Freeze candidates before one holdout evaluation; do not tune on its
results. Thirty to fifty cases are a pilot, not statistical proof. Existing
FineCo questions cite course pages but currently require a different tool than
the local KB fixture, so they cannot be relabeled as local goldens.

Progress: planner approved the frozen extension in round two after six method
and evidence-contract corrections. Framework pin
2a75632a98a8f8e8382a7f7ecaa4fda9f715e12b is unchanged. Implementation baseline
is da777c5e9f89c9b919ea64db62dfe0c3f93247ce. Independent harness work is complete;
corpus/provider selection is pending. No paid evaluation or retrieval-quality
improvement is claimed. Substantive implementation requires simplifier, bounded
risk review and integrated final review before ordinary task-branch delivery to
the existing draft [PR #5912](https://github.com/uzh-bf/klicker-uzh/pull/5912).

Independent evaluation slice committed at b98bb1dd. Verification: 22 adapter
tests and 10 enrichment tests passed; accepted simplification consolidates one
duplicate into the status matrix, leaving nine enrichment tests with the same
contract assertions. The synthetic capture → enrichment → pinned framework
loader/factory/runner check passes. Judges are substituted and no quality score
is claimed. Wrapper regression passes for Luna and Auto. Container types40/40,
lint7/7 and policy checks pass; host-only CI planning and launcher checks pass.
Direct staged-path formatting passes; lint-staged itself cannot resolve linked
Git metadata inside this container. The full build passes26/26; scoped Opengrep
and staged gitleaks report no findings. Framework remains at its existing pin.

The exact Devsy runtime remains retained for the user's local-testing lease: six
routes are registered as running; this route listing does not prove HTTP health.
Container checks execute successfully. Lease checkpoint remains the next manual
testing follow-up. Corpus/provider selection blocks live course evaluation and
candidate tuning; the draft retains that limitation.

The evaluation slice and integrated public package passed independent review
after replacing the retired-model browser expectation with outgoing Auto and
Luna request assertions. The full chat browser run completed all 96 tests:
95 passed, and an existing welcome assertion failed because it pinned the
default seed name instead of allowing the retained synthetic demo name. That
assertion now checks visibility of the chatbot context. The original run is not
a clean full-suite pass; focused rerun evidence is recorded in the draft PR.
Fresh container types (40/40), lint (7/7), policy checks and host checks (120/120)
pass. The local synthetic Auto/Luna policy was restored after test fixtures.
Hosted OCR at 8d4581c failed with provider HTTP 403 authentication errors and
provides no review verdict. Course-quality evaluation and retrieval tuning still
require the corpus/provider selection above; no paid quality run occurred.
