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

Native graph package: 79 tests pass, including a disposable 5,000-neighbor hub,
query timeout and recovery. Admission/route/client/state checks: 72 pass. Root
checks passed lint and 37/40 type tasks; a concurrent Prisma generate race and
an ES2022-incompatible test helper caused the remaining failures. The client was
regenerated serially and Prisma/chat checks pass; Playwright check passes after
replacing the helper. Full production build passes 26/26 with conflicting generated
development types temporarily isolated and restored. Host policy checks pass 123/123.

Real browser captures show overview, autocomplete, keyboard selection and compact
details. Inspection corrected overlapping layout animations and excessive automatic
zoom. Native browser smoke passed; the expanded delayed-response/IME/pointer/touch
suite is running. Lecturer preview remains a required compatibility check. Source
reviews, final integrated review, commit and draft update remain pending.

No schema or dependency change was added by navigation. The local runtime stays
running at the user's request for manual testing. Substring scans and per-process
admission are bounded local protections, not measured multi-replica capacity.
