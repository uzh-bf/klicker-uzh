# Scientific visuals for authored content and Chat

Status: replacement workspace approved and created on 2026-09-09; chemistry source remains uncommitted; fresh runtime startup is blocked by Docker address-pool exhaustion; visual persistence decisions remain unresolved

Current authority: the user's repository instructions authorize ordinary scoped
commits, non-force task-branch pushes, draft pull requests, and necessary target
integration after their applicable checks and reviews. Earlier agent-authored
restrictions on those routine delivery steps below are superseded. This does
not authorize merging, publishing releases, deploying, changing data ownership,
or deleting resources. The former cache-preserving runtime recovery assumed
retained containers; fresh September 9 evidence instead shows `NotFound`.
The user now explicitly authorizes a separate replacement worktree and fresh
synthetic runtime while preserving the original runtime records, caches and
volumes. This supersedes the recreation approval blocker, not the unresolved
scientific persistence decisions or authority for network cleanup/configuration.

## Outcome and current execution scope

Lecturers should create molecule, reaction, peptide, and short DNA/RNA visuals
inside the Markdown editor. Participants should see accessible static previews.
Chat should generate, explain, and revise those visuals using their stored
structured source. Formula notation remains a complementary capability.

Following the first experiments, the user approved working through this plan
with a new tracked goal on 2026-09-05. Continue local implementation, verification,
and required reviews without a new approval round at routine slice boundaries.
Start chemistry notation parity while a separate isolated experiment resolves
Ketcher initialization and native biology export. Neither track substitutes for
the full authored-visual and Chat outcomes below.

The main risks are biology rendering coverage, source/preview disagreement,
heavy editor assets, and persistence across deletion or interrupted uploads.
Use synthetic inputs and local storage for verification. Local source edits,
required dependency changes, checks, reviews and scoped commits are authorized.
Live data, external inference, cloud mutations, upstream integration, publication,
deployment and production migration remain withheld. The goal remains active
through the authorized plan, with independently verified local implementation
as the delivery layer; a completed prototype alone is not completion.

Production contracts below remain proposals until the corresponding experiments
support them. Passing a local experiment does not certify production isolation,
scientific correctness, retention, or application compatibility.

## Plan identity

- Evidence: repository `/Users/rschlae/Git/klicker/klicker-uzh`.
- Evidence: planning worktree `/Users/rschlae/Git/klicker/klicker-uzh/trees/latex-chemistry-investigation` on `rs/latex-chemistry-investigation` at `7f55d17e03035a54d966f80655d90a6f2282f22a`.
- Evidence: target branch `v3`; remote refs refreshed on 2026-09-05. `origin/v3` is `fbc5f4fcc2ffa1c8d25695679823134985c5a8d8`. The planning branch has zero commits ahead and 40 behind its upstream `origin/v3`. Read current upstream with `git show`; no upstream integration is authorized.
- Decision: final plan path is `project/plans_wip/2026-09-03-scientific-visuals-plan.md`.
- Evidence: investigation report is `project/2026-09-02-latex-chemistry-investigation.md`.
- Decision: this is one epic governed by one shared plan and delivered through two sequential GitHub stacks. The plan lands with the first implementation layer, never as a plan-only pull request.
- Evidence: GitHub stacked pull requests are enabled for `uzh-bf/klicker-uzh`; `gh stack` is installed. No stack has been created.
- Evidence: open PR #5676, `feat(chat): make conversation history server-authoritative`, already owns server-side branch reconstruction and message-history trust on branch `rs/chat-authoritative-history`. Stack B treats its merged contract as a predecessor and does not create a competing history layer.

## Goal

- Problem: lecturers can write mathematical LaTeX, but chemistry formula macros do not render and there is no structured molecule or biomolecule authoring experience.
- Problem: Chat can display uploaded images and persisted tool parts, but it has no safe scientific-visual tool, dedicated visual card, or exact cross-turn source replay.
- Decision: add three complementary capabilities:
  - KaTeX `mhchem` formula and reaction notation on every Markdown surface.
  - A versioned `ScientificVisual` value embedded in authored Markdown, edited with Ketcher in Manage, and shown elsewhere as an accessible static preview.
  - A first-party Chat tool that validates, depicts, persists, displays, explains, and immutably revises supported scientific visuals from authoritative structured source.
- Check: a lecturer authors and reopens a molecule, reaction, peptide, and short DNA or RNA visual; a participant sees the same accessible preview without downloading Ketcher or Indigo WebAssembly.
- Check: Chat generates one visual, reloads it, uses its exact structured source in a later turn, and creates an immutable revised visual without trusting client-supplied source or preview URLs.

## Non-goals

- Decision: the first release supports small molecules, reactions, peptides, and short DNA/RNA structures or sequence layouts only.
- Decision: pathway diagrams, plasmid maps, cells, anatomy, experimental setups, arbitrary scientific illustrations, and 3D protein structures are separate future renderer kinds.
- Decision: no general `chemfig` or full TeX execution service.
- Decision: no raw model-authored SVG, HTML, JavaScript, arbitrary remote image URL, or unrestricted renderer response.
- Decision: no image-to-structure recognition in the first release. Uploaded screenshots remain images unless a later confidence-gated import is designed.
- Decision: no participant-facing Ketcher editor in the first Chat release. Chat revisions use natural language and create new immutable tool results.
- Decision: no reusable visual library, standalone `ScientificVisual` database entity, or participant-to-course ownership transfer in this epic.
- Decision: no claim that parser success or deterministic depiction proves scientific correctness.

## Execution contract

- Boundary owner: self.
- Authority: the latest 2026-09-05 user approval authorizes the main session as execution orchestrator to work through this plan with a tracked goal, including local implementation, required reviews and scoped local commits after the relevant package prerequisites pass.
- Authority: isolated prototype dependency installation, bounded local containers, synthetic checks, browser verification, required specialist dispatches, and uncommitted artifacts are authorized. Use the repository's managed runtime only for experiments requiring the actual application; standalone rendering uses a disposable container with no repository secrets or application services.
- Authority: dependency choices remain provisional until measurements are recorded and the production plan is reviewed and approved.
- Authority: approval of the post-prototype reviewed plan may authorize the execution orchestrator to reuse the named worktree, create its named stack branches, edit in-scope files, run repository-native checks and local synthetic browser verification, dispatch plan-required specialists, update `Progress`, and create local commits through the approved terminal condition.
- Authority: upstream integration, remote stack creation, pushes, pull requests, GrowthBook administration, infrastructure apply, deployment, non-disposable migrations, live data, merge, and worktree deletion remain withheld. Reuse the named task branch for the first local layer; do not initialize a remote stack.
- Terminal: complete authorized local layers with their verification and required reviews, recording unresolved later-layer prerequisites. A prototype, commit, or intermediate review is not a goal terminal. Stop only at a material decision, an unavailable required capability, or the explicit external boundary needed for the next dependent layer; report incomplete work accurately.
- Pause: return to the user before implementation if the senior review changes initial biology scope, introduces a new data owner/provider, selects a renderer with external egress, cannot preserve atomic Chat message/preview persistence, requires a migration beyond the one scoped `MediaFile` state migration in Stack A and one scoped `ChatAttachment` migration in Stack B, or PR #5676 is abandoned or materially changes its authoritative-history contract.
- Pause: return before any push, pull request creation, upstream integration, GrowthBook feature creation or enablement, infrastructure apply, deployment, merge, or worktree cleanup unless a later approved plan explicitly grants that exact action.

## Research

- Evidence: the complete source-backed investigation, alternatives, external references, and limitations are recorded in `project/2026-09-02-latex-chemistry-investigation.md`.
- Evidence: Overleaf's examples use `mhchem` for formulae and reactions and `chemfig` for structural drawings. KaTeX supports `mhchem`, but not a general `chemfig` execution path.
- Evidence: `@klicker-uzh/markdown` uses `remark-math` and `rehype-katex` with sanitize-before-render and `allowDangerousHtml: false`; the package does not directly depend on KaTeX.
- Evidence: Manage, PWA, and Control load KaTeX CSS `0.16.4` from a CDN, while the current dependency graph resolves KaTeX `0.16.22`. Chat imports local KaTeX `0.16.22` CSS and uses its own assistant-ui Markdown pipeline.
- Evidence: `apps/docs/docusaurus.config.ts` has a separate `rehypeKatex` pipeline and KaTeX `0.16.4` stylesheet. It is a first-class Markdown surface and must register `mhchem` and align assets rather than merely showing literal author-help examples.
- Evidence: Manage's `ContentInput` serializes Slate through `slateMdConversion.ts`. It knows text, headings, lists, links, and images but has no opaque custom block contract. Scientific source must therefore be represented by an explicit Slate node and conversion rule, not pasted into an unsupported node and assumed to survive.
- Evidence: current Ketcher documentation supports React integration through `ketcher-react`, offline client operations through `StandaloneStructServiceProvider` and Indigo WebAssembly, KET in micro- and macromolecule modes, imports including MOL/RXN/SMILES/FASTA/HELM, and programmatic PNG generation. Standalone mode has a larger bundle and requires WebAssembly/static resource deployment.
- Evidence: course media uploads already obtain a write-only SAS URL and persist a lecturer-owned `MediaFile`. PNG is supported by both the Manage dropzone and backend MIME map.
- Evidence: Chat uses AI SDK `7.0.52`, assistant-ui `0.15.1`, a custom SSE parser, direct Prisma route handlers, and participant/thread authorization through `withChatbotAuth`.
- Evidence: `mapAssistantStepContent` persists completed tool calls and safe error projections in `ChatMessage.content`; `AssistantMessageParts` renders tool calls through a dedicated `toolUI` or the generic fallback.
- Evidence: `useChatResponse.serializeMessageContent` sends only text parts on every later request. Persisted tool results therefore remain visible after reload but are absent from model context.
- Evidence: `ChatAttachment` currently stores message-level images and previews, has no tool-call correlation, and only supports the `IMAGE` enum value. User attachments are persisted separately from assistant lifecycle finalization.
- Evidence: `finalizeChatTurn` atomically completes an assistant message, charges account and participant credits, and updates the thread inside one Prisma transaction. Scientific preview rows must join this transaction or remain unpersisted.
- Evidence: Chat currently accepts a client-supplied branch message list and injects prior image descriptions after a thread-scoped attachment query. Exact scientific source must be recovered from participant-owned database messages, not trusted from a new client field.
- Evidence: open PR #5676 adds server-owned request parsing and authoritative parent-chain reconstruction with branch validation, tests, and ADR 0044. Its live status was open on 2026-09-03 with one Playwright shard failing and final AI review pending; this plan neither assumes it is merge-ready nor duplicates it.
- Updated 2026-09-05: standalone Ketcher and Python Indigo experiments have run; see the [execution results](../2026-09-05-scientific-visuals-prototype-results.md). Molecule/reaction rendering passes the small synthetic cases, but editor readiness and biological presentation remain unresolved. Next.js compatibility, deployed WebAssembly paths, and production rendering performance remain unproven.
- Limitation: Context7 reflected current upstream Ketcher documentation but did not prove the exact package versions that fit this repository's React 19 and build constraints.

### Research questions and ownership

- Do: the execution orchestrator runs the Manage prototype because it is on the critical path and tightly coupled to the final block contract.
- Check: the prototype proves dynamic React loading, standalone Indigo WebAssembly asset loading under a linked-worktree route, KET import/export, PNG generation, source-size measurement, editor round-trip, keyboard modal behavior, and production build compatibility.
- Do: a bounded executor may investigate server depiction candidates after a no-secrets dispatch preflight; the main session owns the decision because it changes deployment and trust boundaries.
- Check: the server prototype compares an in-process Node-compatible path with a pinned separate Indigo service under enforced egress denial using identical synthetic inputs. It records cold/warm latency, memory, image bytes, timeout behavior, output determinism, egress distinction, license, image architecture, and local/CI/deployment footprint.
- Do: the main session prototypes the scientific media saga with synthetic local Blob storage and disposable database state because ownership, erasure, and external-object/database races are critical-path data-integrity decisions.
- Check: the media prototype covers reservation, staging-only SAS, validation, create-only final publication, SHA-256/ETag persistence, element-transaction failure, retry, stale cleanup, server-flag bypass, generic-media filtering, ownership transfer, and erasure-before-user-delete at every crash boundary.
- Do: the main session re-inspects the exact merged result of PR #5676 before Stack B starts and maps only the scientific-value extension points plus assistant finalization tests.
- Check: the map confirms that the merged authoritative-history path reconstructs an ordered parent chain from the authorized thread and persisted trigger, validates role and parent continuity, and rejects omitted, reordered, sibling, foreign, and missing ancestors. Scientific visuals extend that path; they do not accept a client-selected source list.

## Resolved product decisions

- Decision: “biology” means biomolecular structures and short peptide/RNA/DNA sequence layouts in the first release. Nightingale, Mol*, SBGN, plasmid, anatomy, and general-image renderers remain future registry entries.
- Decision: `ScientificVisual` is a versioned value object, not an independently owned entity. Course content embeds a copy; Chat persists a copy in the owning message.
- Decision: KET is the authoritative Ketcher edit/render source. SMILES, MOL/RXN, FASTA, and HELM are validated import and model-interchange formats; no interchange format is assumed lossless for every Ketcher feature.
- Decision: every value carries `schemaVersion`, `kind`, bounded authoritative source, compact model context, preview reference, required alternative text, optional caption, provenance, warnings, and a server-computed digest.
- Decision: course content and Chat use the same semantic schema but different preview ownership. Course content references a lecturer-owned `MediaFile`; Chat references a participant-owned message attachment.
- Decision: static previews are immutable. Editing or regenerating creates a new value and preview; historical element snapshots and chat branches continue to resolve their original preview.
- Decision: the shared display renderer never loads Ketcher or Indigo WebAssembly. Unsupported versions and malformed values show a bounded accessible fallback without breaking surrounding Markdown.
- Decision: formula notation and visual blocks are separate. `mhchem` handles compact prose notation; Ketcher handles depicted structures.
- Decision: authoring and Chat generation are separately fail-closed behind typed GrowthBook flags. Static display and formula rendering are not flag-gated, so already-published content remains viewable if authoring is disabled.
- Decision: the first-party Chat tool reserves the name `scientific_visual`. A conflicting MCP tool name is rejected or renamed during tool aggregation; external MCP output never substitutes for the first-party contract.
- Decision: citations remain independent from visual provenance and scientific correctness. Only authorized normalized source IDs render as citations.

## Primitive impact

| Product primitive | Disposition | Contract delta | Compositions and consumers | Evidence or ruling |
| --- | --- | --- | --- | --- |
| Markdown content | Extend | Adds `mhchem` notation and one versioned opaque `klicker-visual` block | Element descriptions, explanations, options, flashcards, content elements, previews | Existing strings and snapshot behavior remain; no content migration |
| `ScientificVisual` | Create as value object | Defines supported kinds, source, model context, preview, accessibility, provenance, digest, and warnings | Shared Markdown, Manage authoring, Chat tool/card/context | Must remain owner-neutral and side-effect free |
| ContentInput visual node | Compose | Holds the value atomically and opens a lazy Ketcher modal | Lecturer authoring and reopen | Converter must preserve source byte-for-byte after canonicalization |
| MediaFile | Extend | Owns immutable course preview PNG plus durable scientific reservation/finalization state under lecturer ownership | Manage and participant Markdown surfaces | One generated Stack A migration; existing general media backfills to finalized and never references Chat storage |
| ChatMessage | Extend | Persists validated scientific tool results and immutable derivation links | Streaming, reload, branches, replay, cancellation | Existing JSON content is the semantic owner |
| ChatAttachment | Extend | Stores assistant-generated scientific preview and correlates it to one tool call | Live card, history hydration, zoom/download | Requires one generated migration and atomic finalization |
| ChatThread branch | Reuse | Natural-language revision creates a new assistant value linked by digest | Revision history and retry | Never mutates an old message or attachment |
| Citation source | Reuse unchanged | Visual result may carry normalized authorized source IDs | Citation chips/cards and provenance panel | Citation does not certify depiction correctness |
| Renderer registry | Create | Maps allow-listed visual kind/source pairs to bounded validator and renderer adapters | Manage prototype, Chat server, future biology renderers | Starts with Ketcher/Indigo-compatible kinds only |

## ADR gate

- Decision: the boundary passes the ADR gate because owner-neutral embedded values, separate course/Chat preview ownership, immutable derivation, and a network-isolated renderer service are expensive to reverse, surprising without context, and chosen over genuine entity/service alternatives.
- Do: before implementation code, create the next available ADR in `docs/adr/` with proposed status. It records only the boundary decision and rejected cross-owner entity/raw-SVG/external-renderer alternatives; the plan retains implementation detail.
- Do: update `docs/adr/README.md` only because this repository currently maintains direct ADR links there.
- Check: senior review confirms the next number at execution time; do not reserve a number in this draft.
- Risk: selecting an external renderer provider, promoting visuals into a reusable library, or allowing participant-to-course promotion materially changes the decision and re-arms product, privacy, and security review.

## Architecture contracts

### Authored Markdown contract

#### Value and display

- Decision: serialize the value as a fenced `klicker-visual` block containing canonical compact JSON. The block is opaque to ordinary rich-text operations.
- Do: add a shared parser/validator module that enforces the schema version, kind/source pairing, source byte limit, string lengths, digest shape, preview scheme, and required alternative text before rendering.
- Do: add a dedicated Slate element and conversion rules. The node behaves as one block, cannot be partially formatted, and round-trips through Markdown without escaping or reordering semantic data.
- Decision: one runtime-neutral shared canonicalizer owns the semantic byte representation and digest algorithm. Manage may compute a provisional digest for local state, but the GraphQL service recomputes and returns the authoritative digest before a value can be saved.
- Do: the digest covers canonical semantic source and renderer-relevant options, not the preview URL, caption, alt text, or mutable labels. Client and server share conformance fixtures so runtime differences fail before rollout.
- Limitation: a source digest plus a PNG byte hash proves the identity of two artifacts, not that the image depicts the source. The rendering experiment must compare both outputs from the same renderer operation, and include a deliberately mismatched pair in validation fixtures. Production must either generate the final preview from accepted source at a trusted boundary or explicitly treat the pair as an author-supplied assertion. This is an unresolved production decision; the prototype does not silently select a new service for Manage.
- Do: keep exact KET and its revision digest as the authoritative stored value. An exported SMILES/FASTA/HELM projection is exact only for the features demonstrated by round-trip checks; unsupported or lossy export must be reported, never described as exact replay. A later tool resolves a prior revision on the server; the model does not reconstruct KET from a caption or abbreviated projection.
- Do: require useful alternative text before save. Caption is optional and may differ from alt text.
- Do: render the preview through the shared package using an ordinary image/modal primitive with explicit dimensions where available. Preserve adjacent prose and all existing Markdown sanitization.
- Decision: one visual carries at most 64 KiB of canonical UTF-8 source. One Markdown field carries at most eight visual blocks and 512 KiB of encoded visual JSON; one element carries at most 16 visual blocks and 1 MiB of encoded visual JSON across all fields. Server-side element validation enforces both count and byte totals before persistence; the renderer applies the same read limits before parsing untrusted or historical text.
- Check: over-limit create/update fails atomically with a localized validation error and leaves pending uploads eligible for cleanup. Existing prose still renders when one historical block is invalid or unsupported; the fallback never parses beyond the bound.
- Risk: existing `remark-slate` behavior may not preserve fenced blocks. The prototype must prove the custom node conversion before the schema and dependency are committed.
- Current upstream seam: `packages/markdown/src/plainText.ts` now projects ordinary fenced code bodies into question-library excerpts. Extend this projection with the visual block's bounded accessibility summary so embedded KET JSON does not appear in excerpts. Verify at that pure projection seam when the display package is implemented.

#### Media reservation, immutable publication, and erasure

- Decision: add `MediaFile` purpose, upload state, expected semantic digest, staging object key, final byte SHA-256, and final ETag fields in one generated Stack A migration. Existing/general media are backfilled as `GENERAL` and `FINALIZED`; scientific rows move through `PENDING`, `FINALIZING`, `FINALIZED`, and cleanup-only `DELETING` states.
- Do: an owner-scoped scientific reservation mutation validates/canonicalizes the source server-side, creates a `SCIENTIFIC_VISUAL/PENDING` row, and returns media ID, authoritative digest, staging object URL, and a 15-minute write-only SAS for that staging object. The final URL never receives browser write credentials.
- Do: the element create/update path conditionally claims a matching row as `FINALIZING`, reads and validates the staging object, and publishes identical bytes server-side to the row's final first-party URL using create-only semantics. It records byte SHA-256 and ETag. A retry accepts an existing final object only when its bytes match; a mismatch is a hard integrity failure.
- Do: persist the element content and transition `FINALIZING` to `FINALIZED` in one database transaction. Delete staging after commit. A crash before the transaction leaves a retryable `FINALIZING` row; the final URL remains safe because retries verify its stored bytes and no client has write authority.
- Do: the scheduled cleanup owner atomically claims `PENDING` or stale `FINALIZING` rows older than 24 hours as `DELETING`. It idempotently deletes staging and any matching final object, then the row. Finalization cannot win after `DELETING`, and a cleanup crash retains its row as the retry record.
- Do: enforce `scientific-visual-authoring` in the GraphQL reservation and element create/update services, not only Manage. When false, reject reservations and any new, duplicated, or semantically changed visual block; allow unchanged historical values, surrounding prose edits, and visual removal. Static read/render remains available.
- Do: filter every generic media query and insertion path to exclude scientific rows unless `FINALIZED`. Direct media retrieval still applies owner authorization and exact first-party URL checks.
- Decision: finalized scientific previews cannot be individually deleted in the first release because Markdown and element snapshots need immutable URLs. They follow the existing lecturer-owner account lifecycle; account erasure must delete both Blob and row. Course removal behavior is documented rather than guessed.
- Do: account erasure first transitions all owned scientific rows, including `FINALIZED`, to `DELETING`. It blocks user-row deletion until staging and exact stored final URLs are idempotently deleted; only then may the existing user cascade remove retry rows. A crash leaves the user and `DELETING` rows available for retry rather than orphaning blobs.
- Do: content transfer changes authorization ownership only. Cleanup and erasure use stored object URLs/keys rather than deriving a container from `ownerId`; tests cover transferred media before and after erasure.
- Evidence: current `origin/v3` adds request-based course deletion in `packages/graphql/src/services/courses.ts`; retained live quizzes detach while other activities cascade. `MediaFile` still belongs to User, not Course. Course removal cannot be treated as permission to delete all previews appearing in that course.
- Open production proof: a worker that loses its finalization claim must not publish after cleanup removes its row. A staging write credential may also outlive a deletion attempt. Prototype those schedules, retain retry identity until writers and credentials are fenced or expired, and specify the actual storage/database protocol before implementing the proposed state fields. State names alone are not race protection.
- Required protocol before production: track each attempt and its object keys durably; stop issuing write grants once deletion is claimed; retain cleanup identity beyond every issued grant plus clock skew and until stale server publishers cannot recreate objects. A database lease by itself cannot revoke a worker's Blob credentials. The experiment must expose that distinction rather than assume a lease implements storage fencing.
- Required ownership ruling before production: course deletion retains User-owned media that may still be referenced by retained content. Whole-account content transfer preserves stored object keys and must serialize with erasure. Individual element transfer cannot blindly reassign a shared media row: determine whether another element or snapshot retains it, then choose copy-on-transfer or explicit shared retention. This choice is outside the disposable experiment and blocks the media implementation package, not rendering research.
- Check: after finalization, the expired or replayed staging SAS cannot write the final URL, a create-only overwrite attempt fails, and byte SHA-256/ETag still match on reload. Crash tests cover every external-object/database boundary, retry, finalization/cleanup race, and account-erasure retry.
- Pause: visual persistence stays disabled until a prototype proves immutable publication, historical preview retention, account erasure, cleanup retry ownership, transfer behavior, and documented course removal. If owner-lifecycle retention is unacceptable or Blob deletion cannot be proved, choose an explicitly related immutable asset model, revise the ADR/migration/topology, and obtain data-owner review before enabling authoring.

### Formula contract

- Do: add the resolved KaTeX version as a direct dependency of `@klicker-uzh/markdown`, load `katex/contrib/mhchem` once before `rehype-katex`, and preserve `trust: false` plus sanitize-before-render.
- Do: align local JavaScript and CSS versions on Manage, PWA, Control, and Chat. Prefer bundled package CSS over three version-pinned CDN links unless build measurements show a material regression.
- Do: register `mhchem` in the Docs Docusaurus pipeline, align its direct KaTeX dependency and stylesheet with the application version, and render the author-help examples through the real Docs build.
- Do: retain KlickerUZH delimiters: repeated dollar delimiters on one line for inline formulas and delimiter-only lines for centered display formulas. Do not introduce a second auto-render parser.
- Check: representative `\ce` and `\pu` inputs render KaTeX HTML and MathML with no `.katex-error`; malformed input remains a bounded error and ordinary currency stays prose.

### Authoritative Chat-history predecessor

- Evidence: PR #5676 ([`feat(chat): make conversation history server-authoritative`](https://github.com/uzh-bf/klicker-uzh/pull/5676)) already implements the intended server-owned request/parent-chain boundary and ADR 0044. It remains a live predecessor, not code owned by this epic.
- Gate: Stack B starts only after the behavior is merged into `v3` and its exact-head tests and contracts are re-inspected. A green source review, old handoff, or locally stale worktree is not merge/runtime proof.
- Do: extend the merged request-to-model conversion so stored scientific tool results contribute bounded canonical source and digest in branch order. Preserve its client-tampering rejection, trigger-message identity, parent continuity, role validation, and authorization.
- Check: omit/reorder client messages, choose a sibling or foreign message, provide a missing parent/source/attachment, and tamper with scientific source. Every case must fail or reconstruct from stored state exactly as the merged authoritative-history contract specifies.
- Pause: if PR #5676 is abandoned, replaced, or merged with materially different seams, revise and review this plan before any Stack B implementation. Do not cherry-pick, rebase, update, or otherwise integrate its branch under this plan's authority.

### Chat tool and persistence contract

- Decision: a route-owned `scientific_visual` tool accepts only allow-listed kind/source pairs and produces a typed result. Initial inputs are molecule/reaction via SMILES or MOL/RXN and peptide/DNA/RNA via FASTA or HELM. KET input remains disabled until parser and size bounds are proven.
- Do: validate and normalize input, produce canonical KET plus compact model context, compute the digest, and stage a preassigned attachment ID plus bounded PNG bytes in request memory.
- Do: stream only a safe live projection to the client. It may contain a bounded preview data URL for the in-flight card; the persisted tool result strips image bytes and retains the attachment ID, dimensions, metadata, source, digest, provenance, and warnings.
- Do: extend `finalizeChatTurn` so completed or aborted assistant content and exactly the referenced staged attachment rows commit in the same transaction as lifecycle completion and credit accounting. Failed/unused staged previews never reach the database.
- Decision: extend `ChatAttachment` with nullable server-owned `toolCallId` and a `SCIENTIFIC_VISUAL` type. Add a compound uniqueness constraint on `(messageId, toolCallId)`: legacy and ordinary `IMAGE` rows keep `toolCallId = null`, while each successful scientific tool call owns exactly one preview row.
- Do: persist the preassigned `attachmentId` in the safe tool result and require its `toolCallId` to match the containing tool part before finalization. Generate one migration with the schema-aware tool; run `pnpm run prisma:sync` unconditionally and verify the analytics schema is equivalent.
- Do: add a by-ID preview route that scopes attachment ID through participant, chatbot, thread, message, type, and tool-call ownership before returning bytes. The existing message attachment route remains backward-compatible for ordinary `IMAGE` rows and must not guess which scientific preview belongs to a card.
- Do: preserve duplicate-finalization idempotency. A retry neither creates duplicate attachment rows nor charges credits twice.
- Do: after PR #5676 is merged, extend its authorized server-reconstructed parent chain with persisted scientific parts. Replace any client-supplied scientific source, attachment ID, or tool result with the stored validated projection before building model messages.
- Do: convert exact compact source and digest into model context. Do not resend preview pixels unless a later feature explicitly needs vision.
- Do: reserve the first-party tool name before merging MCP tools and include its stable schema in prompt-cache identity and telemetry without logging source payloads.
- Decision: one assistant turn may persist at most four scientific tool results, four scientific attachment rows, 128 KiB of canonical source, 64 KiB of compact model projection, and 3 MiB of full preview bytes. The complete reconstructed model context may carry at most eight scientific projections, 128 KiB, and 32,000 estimated tokens; these limits are additional to PR #5676's message-row limit.
- Do: enforce aggregate Chat limits server-side before rendering, before the finalization transaction, and before model conversion. Return a typed `scientific_visual_limit` result for a tool-step overflow. If exact required branch context exceeds its bound, reject the later request with a recoverable error rather than silently truncating, reordering, or trusting a client summary.
- Risk: the route has a 60-second ceiling. The server prototype must leave enough bounded budget for model response. If p95 warm depiction cannot fit the agreed route budget, this epic pauses for an asynchronous pending/ready message contract rather than hiding a background job behind the synchronous result.

### Chat display and revision contract

- Do: register a dedicated assistant-ui tool card for `scientific_visual`; never expose successful raw JSON through `ToolFallback`.
- Do: show bounded loading, success, invalid-input, renderer-failure, cancellation, and connection-loss states. Completed cards include preview, caption, generated/course-derived badge, warnings, zoom, download, and accessible source summary.
- Do: after reload, use the persisted tool call's exact `attachmentId` and `toolCallId` to hydrate the full image only for zoom/download through the new by-ID authorization guard. Multiple visuals in one message must never cross-hydrate.
- Do: a natural-language revision calls the tool with the prior digest/source recovered server-side. The new result records `derivedFromDigest` and receives a new attachment ID; the old card remains immutable.
- Do: preserve assistant-ui branch/retry semantics and current stopped/error markers. Direct Ketcher editing in Chat is a later package.
- Check: a text-only model can explain and revise an existing supported visual from authoritative source; models without image support do not need preview pixels.

## Rollout and operational contract

- Decision: add typed flags `scientific-visual-authoring` and `scientific-visual-chat`, both default false. Static formula, block, and card read paths are permanent compatibility behavior and are never flag-gated.
- Do: Manage browser evaluation uses stable pseudonymous user ID plus actor type and role. When authoring is false, hide the insertion action; an existing visual node remains readable, but reopen/regenerate controls are disabled with a localized explanation.
- Do: the GraphQL server evaluates the same authoring flag with the authenticated stable pseudonymous user ID plus actor type and role on reservation and persistence. Adopt its Node evaluator and deployment secret reference; the browser check is presentation, while the server check controls capability.
- Do: Chat server evaluation uses stable pseudonymous participant ID plus actor type before adding the first-party tool. When false, generation and revision are unavailable while historical cards and downloads remain readable. Adopt the existing optional shared GrowthBook evaluator environment through the Chat deployment secret reference; `GROWTHBOOK_ENV` is already registered in `turbo.json` and needs no source change.
- Do: document both typed contracts, targeting attributes, cold/unconfigured and cached behavior, Chat Node adoption, deployment secret reference, and exact hide/disable behavior in `docs/feature-flags.md`.
- Do: do not create or enable GrowthBook features as part of source implementation. The Klicker product/release owner, identified by name before activation, creates both definitions in each environment and enables only a synthetic/internal pilot after merged-result deployment and runtime checks.
- Risk: flags are rollout controls, not authorization. Existing lecturer ownership and participant/thread guards remain mandatory when enabled.
- Check: cold or unconfigured GrowthBook evaluation leaves authoring and generation off. A refresh outage may retain the last usable cached payload, so authorization, renderer limits, and telemetry minimization remain correct while an enabled cached evaluation persists.
- Decision: before the first persisted visual, rollback may revert source. After first persistence, rollback means turn both creation flags off and retain all schema, parser, renderer/card, authorization, and download read paths until stored content is migrated or deleted under a separately approved lifecycle plan.
- Check: telemetry records only kind, source format, success/failure class, renderer version, duration, and byte counts. It never records KET, SMILES, sequences, captions, course content, or participant text.

## Data-protection contract

- Decision: visuals serve the existing educational authoring and Chat-response purpose. Before either flag is enabled, the product/data owner verifies that current notices and legal basis cover generated scientific previews and their structured source; a changed purpose pauses rollout.
- Decision: this epic creates no analytics, model-training, evaluation-dataset, retrieval-index, or cross-course reuse purpose. Raw scientific source, captions, prompts, and renderer input/output are excluded from telemetry and operational logs.
- Decision: store only the bounded canonical source needed to reopen or explain a visual, one static preview, required accessibility text, provenance, renderer version, warnings, and integrity identifiers. Do not retain transient provider responses, duplicate previews, intermediate files, or source-bearing debug logs.
- Decision: ownership and authorization follow the existing lecturer content owner or participant Chat message owner. No new third-party data recipient or cross-owner visual entity is introduced.
- Do: label Chat output contextually as generated, record whether it is course-derived, show provenance separately from citations, and state that depiction has not been scientifically validated. Do not turn every visual into a blocking consent prompt.
- Pause: authoring and Chat creation remain disabled until retention and erasure tests prove that media blobs, `MediaFile` rows, `ChatAttachment` rows, and copied semantic values follow their owning account/course/thread lifecycle. If the existing lifecycle cannot satisfy this contract, obtain a data-owner ruling and revise the design before implementation continues.
- Check: tests and manual inspection prove source values do not appear in logs, metrics, traces, URL parameters, public asset paths, or unauthorized attachment responses.

## Delivery topology

- Decision: use two sequential stacks because authored content and Chat have different runtime models, reviewers, rollout controls, and failure domains. Stack B starts from `v3` only after Stack A merges; no six-layer long-lived stack.
- Decision: each layer targets its parent until predecessors merge. Each remains independently buildable, reviewable, and safe with its flag defaults.
- Decision: these layers are provisional until all three prototypes pass. Before any production branch is created, revise and re-review this plan to freeze exact package/image versions, runtime owner, resource and network policy, touched-file set, measured limits, and final topology. Merge a foundation with its first consumer if the prototype cannot show an independently usable supported API.
- Decision: branch names below are proposals. Creating them or initializing the stack requires later explicit authority.
- Dependency: Stack B also waits for PR #5676 to merge into `v3` or for equivalent authoritative-history behavior to become available. Re-inspect the exact merged contract; never integrate or modify that PR under this plan's authority.

### Stack A: authored scientific content

1. `enhance/chemistry-notation-parity` targets `v3`.
   - Outcome: `mhchem` formulae and aligned KaTeX assets work on all Markdown surfaces.
   - Size signal: 7-12 files and 180-350 human-authored lines. If it exceeds 14 files or 450 lines, split documentation only if independently reviewable; otherwise revise the plan.
   - Reviewer audience: Markdown/frontend compatibility and accessibility.
   - Activation: always on as backward-compatible notation support.
   - Dependency: none.
2. `feat/scientific-visual-display-contract` targets layer 1.
   - Outcome: the versioned value schema, canonicalizer, Markdown/Slate parser, accessible static renderer, bounded fallbacks, and inert visual fixtures form a stable package API without Ketcher or media persistence in participant bundles.
   - Size signal: 5-9 files and 300-600 human-authored lines. Schema, parser, canonicalizer, and renderer remain one public compatibility contract.
   - Reviewer audience: Markdown/frontend, domain/ADR, security, and accessibility.
   - Activation: read path always on, but no supported authoring producer exists until layers 3-4.
   - Dependency: layer 1 only for final Markdown integration.
3. `feat/scientific-visual-media-lifecycle` targets layer 2.
   - Outcome: a false-default, owner-scoped server API reserves staging uploads, publishes immutable final previews, binds them transactionally to element content, cleans abandoned states, and completes scientific Blob deletion before account erasure.
   - Size signal: 10-18 files and 700-1,300 human-authored lines across Prisma/analytics, GraphQL, Blob service, lifecycle task, integration tests, ADR, and wiki. This over-threshold data-lifecycle package remains separate from UI so data, security, and operations reviewers receive one coherent state machine.
   - Reviewer audience: Prisma/data integrity, GraphQL authorization, Blob lifecycle, privacy/erasure, operations, and domain/ADR.
   - Activation: server authoring flag false; no user-visible producer. Generic media queries expose only finalized rows.
   - Dependency: layer 2 semantic contract, passing immutable-publication/erasure prototype gates, and one generated migration plus synchronized analytics schema.
4. `feat/scientific-visual-authoring` targets layer 3.
   - Outcome: flagged Manage Ketcher modal can create, upload, insert, reopen, edit-as-copy, and preview supported visuals.
   - Size signal: 12-20 files and 700-1,300 human-authored lines. This is an approved over-threshold vertical UI slice only if prototype evidence shows the authoring flow cannot be divided without an unusable half-feature; otherwise split editor integration from finalized upload/save.
   - Reviewer audience: Manage frontend, server API integration, accessibility, performance, and localization.
   - Activation: false-default authoring flag; existing read path remains active.
   - Dependency: prototype gate and layer 3 lifecycle API.

### Stack B: Chat scientific visuals

1. `feat/chat-scientific-renderer-boundary` targets `v3` after Stack A.
   - Outcome: a pinned network-isolated renderer service exposes a stable internal validation/depiction API with health, limits, deterministic results, and declarative runtime policy; Chat server-side flag readiness is present but the tool remains unavailable.
   - Size signal: 10-18 files and 500-1,000 human-authored lines, plus generated lockfile data. This infrastructure boundary remains separate for platform/security review; if it has no independently callable, tested internal API after the prototype, merge it into layer 2 and re-review topology.
   - Reviewer audience: platform/runtime, architecture, security, licensing, performance, and Chat integration.
   - Activation: deployed but not externally reachable; tool flag remains false and no user path calls it.
   - Dependency: server renderer prototype, merged shared value contract, and an approved declarative ownership model.
2. `feat/chat-scientific-visual-tool` targets layer 1.
   - Outcome: flagged tool generation streams a dedicated read-only card and atomically persists the safe result plus private preview across completion, abort, retry, and reload.
   - Size signal: 18-28 files and 1,000-1,800 human-authored lines. This is an over-threshold vertical data-integrity slice; keep one PR only if migration, transaction, typed tool result, and card cannot be reviewed safely as separate deployable behavior. The post-prototype topology review must rule explicitly.
   - Reviewer audience: Chat backend/frontend, Prisma/data integrity, authorization, accessibility, and AI tool contract.
   - Activation: false-default server flag; historical read path always on after first persistence.
   - Dependency: layer 1, merged PR #5676 contract, and one generated migration plus synchronized analytics schema; no exact later-turn revision promise yet.
3. `feat/chat-scientific-visual-revisions` targets layer 2.
   - Outcome: the merged authoritative-history path receives exact stored scientific source, and immutable natural-language revisions work after reload with provenance/citation separation and complete browser evidence.
   - Size signal: 8-14 files and 400-800 human-authored lines. It must extend PR #5676's seams rather than reproduce branch reconstruction; otherwise stop and revise.
   - Reviewer audience: authoritative Chat history, security, AI context integrity, branch UX, and citation honesty.
   - Activation: same false-default Chat flag for creation/revision; old cards remain readable.
   - Dependency: layer 2 persisted contract and the exact merged authoritative-history implementation.

### Delegation Map

The execution orchestrator owns integration, architecture, safety rulings, external boundaries, and final evidence. Delegation below assigns each independently verifiable item exactly once; it does not authorize dispatch or implementation before plan approval.

| Work item | Owner | Dependency | Acceptance returned to main |
| --- | --- | --- | --- |
| Manage Ketcher/WASM experiment | `main` | Authorized local phase | Answered, disproved, or inconclusive from synthetic imports, KET/PNG/reopen, assets, keyboard and screenshots; standalone evidence does not prove Manage integration |
| Scientific media lifecycle experiment | `main` | Authorized local phase | Answered, disproved, or inconclusive from synthetic late-writer, cleanup, erasure and transfer schedules; adapter evidence only after the state model holds; no production proof |
| Server depiction/fidelity experiment | `main` | Authorized local phase | Answered, disproved, or inconclusive per kind/format from pinned local imports, KET/PNG/reopen, fidelity and measured timings; no production budget certification |
| Post-prototype production recommendation | `main` | All three experiment outcomes | Revised plan, measured limits, unresolved production rulings, and next package recommendation; qualification remains separate |
| Stack A chemistry notation parity | native `executor` for registration/tests; `main` for assets, dependencies, integration and verification | Approved concrete chemistry package | Scoped commit, focused tests/builds, bundle evidence, docs, and diff receipt |
| Stack A scientific display contract | `main` | Chemistry layer | ADR, canonical schema/parser/renderer, bounded fallbacks, package/browser tests, and scoped commit |
| Stack A scientific media lifecycle | `main` | Display contract and passing immutable-publication/erasure gates | Generated migration/sync, server flag, staging/final state machine, authorization, cleanup/erasure tests, and scoped commit |
| Stack A lecturer authoring | native `executor` | Media lifecycle API and passing Ketcher gate | Lazy editor/upload UI, tests, browser evidence, performance measurements, and scoped commit |
| Stack B renderer boundary | native `executor` | Stack A merged and runtime ownership approved | Pinned service/API, declarative isolation, benchmarks, tests, health proof, and scoped commit |
| Stack B tool, attachment lifecycle, and card | `main` | Renderer boundary and merged PR #5676 | Generated migration/sync, atomic lifecycle, authorization, UI, tests, browser proof, and scoped commit |
| Stack B exact scientific replay and immutable revisions | native `executor` | Persisted tool and exact merged authoritative-history seams | Context-integrity tests, branch/revision UI and Playwright evidence, and scoped commit |
| Per-layer simplification | native `simplifier` | Immutable substantive committed layer | Proportionate simplifications for main-session disposition |
| Per-layer risk review | native `slice-reviewer` | Immutable risk-bearing committed layer | Findings with verified dispositions before delivery |
| Integrated stack verification | `main` | Complete stack and current exact head | Producing commands and final evidence matrix |
| Integrated final review | native `final-reviewer` | Complete verified committed stack | Findings and readiness recommendation for main-session disposition |

## Feature-wide test portfolio

| Consequential behavior or risk | Existing evidence | Obligation | Primary stable seam | Distinct failure detected | Owner |
| --- | --- | --- | --- | --- | --- |
| Existing Markdown, currency, math and sanitization remain compatible | Markdown package has server-render tests but no chemistry cases | Extend existing | `packages/markdown` pure render test | Parser/security regression or changed ordinary text | Stack A layer 1 |
| `mhchem` renders consistently on every surface | Chat has streaming-math tests; shared renderer has no math portfolio | Add focused package cases and one Chat streaming case | shared render HTML plus Chat streaming scanner | Extension/CSS drift and incomplete streamed chemistry | Stack A layer 1 |
| Visual JSON and digest are bounded, versioned, and runtime-neutral | None | Add new | shared parser/canonicalizer conformance tests in browser and server runtimes | malformed source, digest mismatch, runtime drift, unsupported version, unsafe URL, oversized value | Stack A layer 2 |
| Slate round-trip preserves one opaque visual node | Existing converter has no dedicated tests for this node | Add new | conversion utility pure tests | source loss, escaping, node fragmentation | Stack A layer 2 |
| Authored content rejects aggregate visual amplification | No visual limits | Add new | bounded read parser plus GraphQL element validation | many valid blocks exceed field/element count or bytes | Stack A layers 2-3 |
| Participant bundles render static previews without authoring engine | Existing builds only | Add bundle/build assertion plus browser evidence | package dependency graph and PWA page | accidental Ketcher/WASM shipment | Stack A layers 2-4 |
| Lecturer create/reopen/edit-as-copy is accessible | No component-test layer | Add Playwright flow; browser screenshots | Manage real-stack element form | upload race, modal focus, stale source, missing alt | Stack A layer 4 |
| Upload finalization binds source, owner, and immutable historical preview | Current media lifecycle not yet verified | Add new or stop according to prototype finding | owner-scoped staging/finalization plus element snapshot, transfer, and erasure e2e | failed-upload orphan, foreign media, digest mismatch, overwrite, deleted preview, lost retry record | Stack A layer 3 |
| Server renderer is deterministic and bounded | None | Add new | renderer adapter contract tests | egress, timeout, oversized output, nondeterminism | Stack B layer 1 |
| Tool name and prompt-cache identity stay stable | Existing MCP/prompt-cache tests | Extend existing | tool aggregation and cache builder tests | collision, unstable cache, tool unavailable when flag on | Stack B layers 1-2 |
| Assistant result and preview are atomic/idempotent | Account usage lifecycle integration suite exists | Extend existing | `finalizeChatTurn` transaction tests | orphan, duplicate, lost abort result, double charge | Stack B layer 2 |
| Chat rejects aggregate visual amplification | PR #5676 caps history rows only | Add new | tool-step, attachment transaction, and model-context limit tests | many valid visuals exceed count, bytes, preview, or token budget | Stack B layers 2-3 |
| Card never dumps raw payload and reloads identically | Existing tool fallback/history tests | Extend existing plus Playwright | persisted content conversion and dedicated card | JSON leakage, missing preview, inaccessible state | Stack B layer 2 |
| Correct scientific preview hydrates among multiple attachments/tool calls | Existing guarded message-level attachment route | Add by-ID integration/e2e | attachment and tool-call correlation query scope | cross-card hydration, cross-participant/thread/chatbot access | Stack B layer 2 |
| Later turn receives exact stored source, not client tampering | PR #5676 provides the predecessor authoritative-history seam if merged | Extend merged seam | server model-message builder pure/integration test | forgotten, reordered, sibling, foreign, or forged KET/SMILES/FASTA/HELM | Stack B layer 3 |
| Revisions are immutable and branch-correct | PR #5676 branch tests are predecessor evidence if merged | Extend existing plus Playwright | merged parent-chain reconstruction and visible branch | mutation, wrong ancestor, digest mismatch, duplicate reconstruction | Stack B layer 3 |
| Citation badge remains honest | Existing source normalization/citation tests | Extend existing only where new source IDs enter | source registry normalization | raw URL citation or implied validation | Stack B layer 3 |
| Cold/unconfigured flags fail closed and cached enabled state stays safe | Feature-flag adapters have tests | Extend existing | typed contracts and browser/server adopting roots/routes | direct API bypass, accidental broad exposure, or unsafe last-known enabled behavior | Stack A layers 3-4 and Stack B layer 1 |

## Slice plan

### Preliminary gate: prove authoring, immutable media, and server depiction

- Current execution order: perform the three bounded experiments below, then reconcile this plan. The subsequent numerical checks are production qualification targets, not requirements to build production infrastructure during a disposable experiment.

| Experiment | Question and observable result | Deliberate omissions and inconclusive result |
| --- | --- | --- |
| Rendering and source fidelity | Can pinned Indigo produce a visible PNG and reopenable KET for synthetic molecule, reaction, peptide, DNA, and RNA inputs? Record exact versions, per-kind import/export/render results, dimensions, timings, and repeated-output identity. Include malformed input and a mismatched source/preview pair. | No model calls, real content, service deployment, capacity certification, or biological correctness claim. Unsupported formats are a useful negative result; an unavailable local engine is inconclusive. |
| Editor integration | Can pinned Ketcher lazily open, import the same synthetic structures, export KET/PNG, and reopen without loss? First prove a minimal React page, then the actual Manage seam only if the candidate succeeds. Record assets, keyboard behavior, screenshots, and visible differences between chemical and sequence layouts. | The standalone page cannot prove Next/Slate integration. An unavailable managed app runtime is recorded as that specific gap, not a renderer failure. |
| Media lifecycle | Do the proposed transitions preserve retry identity and prevent late publication under synthetic interleavings? First run a small state model covering finalizer/cleanup, late staging writes, and erasure/transfer; use local Blob/database adapters only after the state model holds. | A state model can refute the design, not prove Azure or PostgreSQL behavior. A counterexample ends the experiment with the required protocol correction; it does not authorize a production repair. |

- Ownership: main owns these tightly coupled first experiments because source fidelity and lifecycle decisions are unresolved. A bounded executor may build an isolated mechanical part once its acceptance contract is settled. The independent planner reviews the revised execution contract.
- Artifact: standalone experiments live under `/private/tmp/klicker-scientific-prototype-*`; retain runnable evidence while this goal is active. Record paths and results under `project/_local/` and summarize findings in this plan. Install dependencies inside the isolated prototype container; mount only the synthetic experiment directory. Package acquisition may use the network; renderer execution uses `--network none`.
- Completion: report each experiment as answered, disproved, or inconclusive with its producing command and limits. Do not replace an unsupported biological kind with an unrelated illustration or claim that a successful small-molecule render proves biology support.
- Capability matrix: report molecule, reaction, peptide, DNA, and RNA separately. For each tested format/layout record import, KET export, PNG depiction, KET reopen, and model projection fidelity. Untested pairs remain unknown; only passed pairs can be proposed for production. KET byte identity includes drawing coordinates and is not synonymous with chemical equivalence; report both exact bytes and feature-level losses where relevant.
- Dependency: the real Chat request/history experiment waits for the merged authoritative-history prerequisite. Its absence does not block the local renderer or editor experiments or the authored-content recommendation. Record Chat as a separate deferred integration obligation.
- Production qualification: retain the following safety and resource bounds for evaluating a later production candidate. A measured miss prompts an explicit recommendation; no target is silently relaxed. Only the evidence relevant to the next production package must pass before that package is approved.
- Problem: upstream capability claims do not establish compatibility, payload size, latency, or lifecycle behavior in this monorepo.
- Do: run the Manage, scientific media lifecycle, and server prototypes defined under Research using synthetic structures and local disposable storage/data only. Keep disposable code out of commits unless it becomes the smallest production implementation.
- Check: Manage accepts at most 64 KiB of UTF-8 canonical source, 512 atoms, 16 reaction components, or 2,000 peptide/nucleotide symbols. Alt text is at most 500 characters and caption at most 1,000. The generated PNG is at most 1.5 MiB and 1,600 by 1,200 pixels.
- Check: before the editor opens, the Manage route gains no Ketcher/Indigo/WASM request and at most 25 KiB compressed JavaScript for the action and loader. The lazy editor transfers at most 15 MiB compressed, becomes interactive within 5 seconds cold at 10 Mbps with four-times CPU throttling, and reopens within 1.5 seconds warm. A production build must resolve every WASM/static path under primary and linked-worktree routes.
- Decision: production qualification uses a versioned synthetic corpus with at least 20 cases: four molecules covering aromaticity, charge, stereochemistry, and isotopes; four reactions covering agents, mapping, multiple components, and products; three peptides; three DNA/RNA or HELM cases; two valid near-limit cases; and four malformed, oversized, or unsupported cases. The preliminary experiment uses the smaller per-kind set above. Commit accepted synthetic fixtures only with their approved production layer.
- Check: the server accepts the same semantic limits, emits at most one 750 KiB PNG no larger than 1,200 by 800 pixels, enforces a 5-second hard depiction timeout, and receives an absolute request deadline. It refuses to start when fewer than 8 seconds remain and always leaves at least 3 seconds after its own timeout for final stream/error persistence.
- Check: run the pinned production image under a 1-vCPU/1-GiB cgroup on every target deployment architecture. After ten warmup corpus passes, measure 100 valid renders at concurrency four; warm p95 must be at or below 1.5 seconds. For cold behavior, start five fresh containers and require every health-to-first-success interval to be at or below 4 seconds while reporting all five values, median, and maximum rather than an invalid small-sample p95. Per-worker steady RSS is at most 512 MiB and per-render RSS growth is at most 256 MiB.
- Decision: production defaults to a separate internal renderer service with ingress limited to Chat and default-deny egress enforced by declarative network policy. An in-process candidate can prove that its code makes no network calls, but that is not egress isolation because Chat itself needs outbound model access; it is rejected unless the revised plan adds an equivalent OS-level sandbox and receives architecture/security approval.
- Check: the renderer rejects oversized/malformed input before depiction, has a bounded concurrency/queue policy, performs no DNS or outbound connection under an active egress-deny test, emits identical semantic digest and PNG bytes for repeated pinned-version fixtures, and reports only non-content metrics.
- Check: after PR #5676 is merged, run a synthetic end-to-end Chat prototype with deterministic model fixtures through request parsing, authoritative branch reconstruction, tool streaming, renderer, atomic finalization, private by-ID hydration, reload, second-turn exact-source replay, and immutable revision. Record timestamps at each boundary, assert the renderer deadline contract, and prove aggregate limits before Stack B topology is frozen.
- Check: record baseline and measured bundle size, screenshots, exact package/image/WASM versions and hashes, licenses, runtime architecture, resource requests/limits, file inventory, and a decision table in this plan's `Progress` section.
- Pause: any exceeded numeric limit, unsupported CPU architecture, non-deterministic output, external egress requirement, incompatible license, missing retention proof, or unusable accessibility path rejects that candidate. Do not relax a limit or choose asynchronous rendering implicitly.
- Pause: after the local experiments, revise the affected plan sections and obtain the relevant planning review. Production implementation requires approval of a concrete next package with selected dependencies, ownership, limits, touched files, and topology. Chat qualification can remain deferred while an independently useful authored-content package is considered.
- Commit: none for discarded experiments; accepted setup lands in its owning production layer.

### Stack A layer 1: chemistry notation parity

- Current package: pin the already-resolved KaTeX `0.16.22` directly in Markdown, Docs, Manage, PWA and Control; retain Chat's matching version. Register `katex/contrib/mhchem` in the shared, Chat and Docs pipelines. Keep existing math delimiters and disabled trust. Use each app's root CSS entry and Docs `customCss` for local KaTeX fonts/styles, removing only obsolete KaTeX CDN links.
- Owned paths: `packages/markdown/package.json`, `packages/markdown/src/Markdown.tsx`, focused Markdown render tests; `apps/chat/src/components/markdown-text.tsx` and `apps/chat/test/streaming-math.test.ts`; each of Manage/PWA/Control's `package.json`, `src/pages/_app.tsx`, and `src/pages/_document.tsx`; Docs `package.json`, `docusaurus.config.ts`, and `docs/tutorials/element_management.mdx`; `pnpm-lock.yaml`, `docs/frontend-conventions.md`, and this plan. A focused existing Chat browser spec may be extended for paused chemistry streaming. No media, Prisma, editor schema or Chat-history code belongs in this layer.
- Size disposition: the repeated app dependency/CSS roots may exceed the earlier 14-file diagnostic. They are one compatibility change; keep them together and report actual substantive size. Do not add a shared abstraction just to reduce file count.
- Route: native executor for the shared Markdown/Chat registration and focused tests; main for app asset wiring, package integration, documentation and final verification because those share the lockfile and build/runtime seam.
- Acceptance: package render tests prove HTML plus MathML for valid chemistry, bounded malformed errors, unchanged currency/math and sanitization. Chat scanning and a paused browser stream prove incomplete formulas remain hidden until complete. App/Docs builds and desktop/narrow screenshots prove matching local styles/fonts and no obsolete KaTeX CDN request. Keep full-browser evidence distinct from pure scanner tests.
- ADR disposition: formula notation adds no ownership or persistence boundary, so the visual-value ADR remains due before the scientific display layer, not this dependency/registration layer.
- Do: implement the formula contract, focused renderer tests, Chat streaming regression, and user/engineering documentation.
- Check: package tests, Chat tests, filtered checks, production builds for affected surfaces including `apps/docs`, and browser examples on Manage/PWA/Control/Chat plus one rendered Docs author-help example at desktop and narrow viewport.
- Check: inspect generated bundles/assets for one KaTeX version and no trust-enabled macros.
- Commit: `enhance(markdown): add chemistry notation support`.

### Stack A layer 2: safe visual display contract

- Do: create the owner-neutral value schema, shared canonicalizer/digest fixtures, fenced-block parser, shared static renderer, accessible fallbacks, and Slate atomic node conversion.
- Do: create the ADR and update `docs/frontend-conventions.md`, `docs/domain-model.md` only for the new value ownership language, and `docs/testing.md` only if a new test seam is introduced.
- Check: pure parser/render/conversion tests, Markdown package build/size limit, shared-components check, affected app builds, and fixture browser display.
- Check: prove Ketcher and Indigo packages are absent from participant app dependency chunks.
- Commit: `feat(markdown): add scientific visual display contract`.

### Stack A layer 3: immutable scientific media lifecycle

- Do: add the generated `MediaFile` state/digest/object-identity migration, synchronize the analytics schema, and implement the server-side authoring flag, reservation, staging validation, create-only final publication, transactional element binding, generic-media filtering, cleanup, transfer, and account-erasure contracts.
- Do: update the ADR and `docs/domain-model.md`, `docs/feature-flags.md`, privacy/retention guidance, media service guidance, and test documentation for the finalized lifecycle.
- Check: migration provenance, unconditional `pnpm run prisma:sync`, schema equivalence, server-flag bypass tests, aggregate element validation, generic-media filtering, object overwrite rejection, persisted hash/ETag, and crash/retry/finalization-cleanup/transfer/account-erasure integration tests.
- Check: use only synthetic Blob objects and disposable local database state. No cloud/storage mutation is authorized by this plan phase.
- Commit: `feat(media): add immutable scientific visual lifecycle`.

### Stack A layer 4: lecturer authoring

- Do: add the false-default browser flag, lazy Ketcher modal, standalone provider assets, create/reopen/edit-as-copy flow, staging upload/finalization calls, alt/caption fields, localized errors, and stable test hooks.
- Do: preserve ordinary `ContentInput` behavior and make the visual toolbar action available only in full-toolbar contexts that support media.
- Check: Manage check/build, i18n parity, feature-flag tests, Playwright create/save/reopen/edit flow, and mandatory agent-browser before/after screenshots at desktop/mobile.
- Check: network inspection shows no KET or structure data leaves the browser except the existing Klicker GraphQL/blob endpoints; Ketcher loads only after the modal opens.
- Commit: `feat(manage): author scientific visuals with Ketcher`.

### Stack B layer 1: bounded server renderer

- Do: implement the selected adapter, immutable image/version pin, egress denial, time/output/source bounds, safe error taxonomy, non-content telemetry, test fixtures, local runtime wiring, and declarative deployment wiring.
- Do: add Chat server feature-flag configuration but do not expose the tool.
- Check: deterministic fixture hashes or explicit renderer-version snapshots, timeout/size/error tests, Chat build, container health, architecture compatibility, and a network test proving renderer egress is unavailable.
- Pause: infrastructure ownership and deployment changes still require explicit approval before apply.
- Commit: `feat(chat): add bounded scientific renderer`.

### Stack B layer 2: generated visual card with atomic persistence

- Do: add the reserved first-party tool, live/persisted projection split, nullable server-owned tool-call correlation, compound uniqueness, generated migration, by-ID retrieval guard, lifecycle transaction changes, dedicated card, history hydration, localized accessibility states, and fail-closed flag check.
- Do: update `docs/chat-platform.md`, `docs/domain-model.md`, and the relevant Chat testing guidance in the same change.
- Check: Chat unit/integration suites, Prisma generated-migration provenance, unconditional `pnpm run prisma:sync`, analytics-schema equivalence, Chat check/build, and Playwright loading/success/error/abort/reload plus multiple-tool/multiple-attachment flows.
- Check: verify another participant receives 404 for the private preview and logs contain no structured source or participant text.
- Commit: `feat(chat): persist and display scientific visuals`.

### Stack B layer 3: exact replay and immutable revisions

- Do: extend PR #5676's merged server-reconstructed branch context with stored scientific tool parts, reject tampered/missing tool and attachment IDs, feed exact compact source to the model, and implement derivation links plus revision presentation. Do not add a second branch-reconstruction path.
- Check: pure model-message tests cover source fidelity and tampering; authoritative-history tests cover omitted, reordered, sibling, foreign, missing-ancestor, missing-source, and role/parent discontinuity cases; Playwright generates, reloads, revises twice, switches branches, and returns to every original card.
- Check: text-only model fixture receives structured source but no pixels; citation tests prove source references and generated status remain separate.
- Commit: `feat(chat): support scientific visual revisions`.

## Verification and review gates

- Do: run application pnpm, Prisma, tests, and builds inside the validated managed container. Run Playwright through the repository's host wrapper and Git/GitHub CLI on the host. Standalone prototype dependencies and checks run in their isolated container.
- Do: use `klicker-testing-verification` for focused-to-broad checks and `agent-browser` for every changed human-facing state. Add Playwright only for consequential full-stack workflows listed in the portfolio.
- Do: for each substantive committed layer, run the configured simplifier. Run a slice reviewer in parallel where the layer crosses architecture, data-integrity, security, or infrastructure boundaries. Verify and disposition every finding before push.
- Do: run one integrated final reviewer for each stack after all layers and merged-result checks are current. Stack B final review covers the complete epic contract.
- Do: inspect every staged diff for unrelated changes, credentials, real participant data, source payload fixtures from real courses, and generated lockfile/migration churn before commit.
- Do: before each push or PR update, verify stack topology with `gh stack list`; use `gh stack submit` only after explicit push/PR authority.
- Check: required CI and current merged-result evidence pass at the exact candidate head. Green CI is not deployment or runtime acceptance.
- Check: final source verification includes root `check:all`, affected package tests/builds, migration checks, both stack Playwright flows, static accessibility, responsive screenshots, bundle inspection, and renderer security bounds.
- Check: runtime acceptance after an authorized deployment reads back the deployed revision, confirms both flags off, validates renderer health without content, and runs only synthetic pilot content after explicit flag-enable authority.

## Documentation contract

- Do: Stack A updates author help in `apps/docs` with `mhchem` examples, supported visual kinds, accessibility requirements, import formats, and explicit unsupported cases.
- Do: Stack A updates `docs/frontend-conventions.md` and the new ADR; update `docs/domain-model.md` for embedded value/preview ownership.
- Do: Stack B updates `docs/chat-platform.md` with tool ownership, live/persisted projections, atomic preview lifecycle, exact replay, flag and telemetry contracts; update `docs/domain-model.md` for Chat attachment ownership.
- Do: update `docs/feature-flags.md` with both typed flag definitions, browser and Node adoption, pseudonymous targeting attributes, cold/unconfigured versus cached behavior, exact hidden/disabled states, deployment secret reference, named rollout ownership requirement, and phase-aware rollback.
- Do: update the relevant privacy/retention documentation with purpose, data minimization, generated-output labeling, log exclusions, media/message lifecycle, and verified erasure behavior before activation.
- Do: update `.agents/skills/klicker-frontend-ui/SKILL.md` or `klicker-testing-verification/SKILL.md` only when implementation introduces a durable procedure not already covered. Do not add ceremonial skill text.
- Check: run the wiki validator and Prettier on changed Markdown in the devcontainer; verify every path/symbol citation against source.

## Manual evidence expected in pull requests

- Check: Stack A shows formula, molecule, reaction, peptide, and DNA/RNA create/reopen/display states in English and German, including narrow viewport and keyboard focus restoration.
- Check: Stack A reports the lazy Ketcher chunk and WebAssembly sizes and confirms participant bundles omit them.
- Check: Stack B shows loading, generated visual, warning/error, reload, zoom/download, and two immutable revisions on separate branch history.
- Check: Stack B includes renderer cold/warm timing, output bytes, timeout cap, egress proof, and attachment authorization test receipt using synthetic data.
- Check: every PR description names its parent, target, exact verification commands, review status, activation phase, phase-appropriate rollback, compatibility paths that must remain after persistence, and withheld deployment/merge actions.

## Alternatives and reopen triggers

- Decision: use Ketcher plus a static preview rather than loading RDKit.js/Ketcher on participant displays. Reopen only if the static contract cannot represent a required interaction.
- Decision: use KaTeX `mhchem` rather than MathJax replacement or full TeX. Reopen only if an approved requirement needs unsupported notation that cannot be represented as a visual value.
- Decision: keep course and Chat previews under their current owners rather than create a cross-owner entity. Reopen for a reusable library or lecturer-authorized promotion feature.
- Decision: use route-owned typed output rather than MCP/raw SVG. Reopen MCP placement only if a trusted internal MCP can provide the same authorization, atomicity, no-egress, and version guarantees without changing the data boundary.
- Decision: use synchronous depiction only if the prototype fits the route budget. Otherwise stop and design an explicit pending/ready asynchronous contract as a separate plan revision.
- Decision: use two sequential stacks. Reopen only if prototype evidence removes the renderer/infrastructure boundary enough to make one shorter stack independently reviewable.

## Planning-stage specialist review

- Senior review outcome: Archimedes approved the corrected local experiment package in round 3 on 2026-09-05. Round 2 corrected the remaining Delegation Map mismatch. This is approval of experimental execution only. Full findings and dispositions are in `project/_local/reviews/2026-09-05-scientific-visuals-senior-review.md`.
- Senior pass 2026-09-05: native planner Archimedes returned `REVISE` on the original draft. Accepted separation of local experiments from production qualification, source/preview equivalence checks, explicit writer-fencing obligations, and per-kind biology evidence. Accepted the transfer ambiguity but rejected automatic reassignment of all referenced media as a universal fix: shared snapshots can still require the original owner's preview. That production ruling remains explicit and blocked; local experiments need no ownership decision.
- Evidence: native planner Helmholtz completed three hardening rounds. Each returned `REVISE`; all 15 findings were accepted and applied. The final round added staging-only writes, create-only immutable publication, server-side flag enforcement, erasure-before-user-delete, and the separate media-lifecycle layer.
- Evidence: the required Claude CLI rival pass was attempted because this plan introduces a scientific renderer, two scoped migrations, infrastructure isolation, and cross-app public contracts. It exited before review with `401 OAuth access token has expired`; no cross-provider findings or verdict exist, and no client reauthentication was attempted.
- Limitation: the corrected post-round-3 draft has no automated approval verdict. It is ready for the senior-engineer review requested by the user, not implementation approval.
- Evidence: full findings, dispositions, draft hashes, and the rival failure are preserved under `project/_local/reviews/2026-09-03-scientific-visuals-plan-hardening.md`.

## Progress

- Review closure checkpoint 2026-09-10: pushed b3bbbcb374 (review-fix commit) to the PR branch. Both reviewer-flagged verification gaps are closed with fresh evidence on the chat-profile runtime: the Chat streaming chemistry e2e passes against the routed stack (paused mock stream shows only the prefix, complete ce formula renders with MathML and zero KaTeX errors on release; the test needed chunkDelayMs to select the mock's pausing fetch-interception branch - a test bug, not a product bug), and a Docs production build renders three chemistry expressions in the tutorial page with zero katex-error occurrences. Container check:all passes 25/25 on the corrected tree; the full host dev-runtime suite passes with the readiness deadline re-verified (90.2 s, not skipped). Correction to the preceding entry: docs katex stays at the policy-required tilde dev range (the first exact-pin attempt failed the existing dev-dep semver rule in check:all); the syncpack katex version group is therefore scoped to the five exact production surfaces (markdown, chat, three frontend apps), and the lockfile was regenerated back to a no-diff state. Exact-head CI green (Analyze x3, GitGuardian, trusted_policy, resolve_lock, ocr-review clean with zero findings on this head). The standing-authorized /final-review comment was posted (gh comment 5610321830); the platform final-ai-review run is in progress. The managed runtime was stopped cleanly after verification (zero containers, zero routes).
- PR and review checkpoint 2026-09-10: pushed 4cd179ed61 to origin/rs/scientific-visuals-isolated and opened draft PR uzh-bf/klicker-uzh#5870 (base v3). Platform CI green except the intentionally pending final-ai-review status. ocr-review completed with 4 low/medium findings, all verified real and fixed in the working tree pending commit: gate DEV_BUILD_FILTERS computation on the dev profile, skip dependency preparation on the stale-cache repair restart, scope the leaked DEVROUTER_PROFILE=manage export in the test script, and harden the fake helper capability probe (position-independent help-flag detection plus a probe-exercised assertion). Simplifier gate: three subagent dispatches (Nietzsche, Cicero, Averroes) all errored 429 Too Many Requests; per continuity ladder the main session substituted the pass with evidence-backed findings only (P2/P3, no code changes warranted), recorded in project/_local/reviews/2026-09-09-scientific-visuals-simplifier.md. Slice reviewer Kuhn (01a0882d-9b4b-7841-aa49-853a6f59640a) completed DONE_WITH_CONCERNS; findings and dispositions in project/_local/reviews/2026-09-09-scientific-visuals-slice-review.md: (1) chat/docs rendering verification gap - remediation in progress via chat-profile runtime plus the new Playwright streaming case and a docs build grep; (2) scope bundling of runtime helpers - confirmed intended delivery scope, documented in the PR body rather than a history rewrite; (3) syncpack katex alignment gap - added a strict katex version group and pinned docs to exact 0.16.22 with lockfile regeneration; (4) docs single-dollar example inconsistent with editor guidance - switched rendered examples to double-dollar delimiters; (5) readiness test hard-binds port 3010 - now skips cleanly with an explanatory message when the managed stack owns the port. Full host dev-runtime suite passes (readiness deadline re-verified at 90.2 s, not skipped).

- Fresh-runtime verification 2026-09-09: after the user's full OrbStack reset, `devrouter ensure <replacement> --profile manage --json` succeeded: fresh install, turbo dependency build, Prisma reset/push, and seed all passed; managed runtime reported `ready` with zero drift for apps api/auth/manage on Compose project `default-rs-71b2e`. Markdown package tests pass (42/42, including `ChemistryRender.test.ts`), Chat suite passes (475 passed, 49 files, 1 skipped file), and container `pnpm run check:all` passes 25/25 turbo tasks after fixing docs' katex to `~0.16.22` for syncpack. Browser acceptance on the fresh stack: Manage content element with `$$\ce{2 H2 + O2 -> 2 H2O}$$` and `$$M(\ce{H2O}) = 18.02 \pu{g/mol}$$` renders 2 KaTeX expressions with MathML and zero KaTeX errors in edit preview and saved display view; at 390x844 the edit modal preview is visible with rendered chemistry and no content overflow (page-level shell nav overflow is pre-existing, out of scope). Single-dollar `$...$` math stays intentionally disabled (`singleDollarTextMath: false`); `$$...$$` is the supported delimiter. Verification artifacts: `/private/tmp/sci-preview-desktop.png`, `/private/tmp/sci-edit-modal-390.png`, `/private/tmp/sci-display-desktop-final.png`, `/private/tmp/sci-display-390-final.png`. Tooling notes: agent-browser DOM-level fills do not update Slate state in the element editor, so persistent synthetic content required real keystrokes (per-line `type` + `press Enter`) followed by a live-DOM Save click; DB content was verified directly via `psql` in `default-rs-71b2e-postgres-1`. Pre-commit hooks cannot run on the host (no host node_modules in this worktree), so the repo-sanctioned container check substitution applies and the commit uses `--no-verify` with the container checks above as evidence.
- Release recheck 2026-09-09: networking owner reports published Devrouter 0.0.65. Verified the tagged `upgrade-prompts/0.0.65.md` through GitHub CLI: automatic allocation requires an operator-installed daemon-bound policy and repository opt-in; OrbStack remains diagnostics-only until guest routes are qualified. Live host reports Docker context `orbstack` and installed CLI 0.0.64. Therefore installing 0.0.65 alone does not resolve this runtime blocker. Context7 did not find this project's documentation; the tagged first-party prompt is the source. A follow-up to networking task `01a08647-bd04-7970-b76b-dc895776d8ed` failed because it is archived; no message was delivered. No runtime, network, policy, installation, or data mutation was attempted. Source diff whitespace checks pass. Next dependency remains a supported OrbStack capacity recovery procedure or separately approved exact network change; preserve both runtime identities and all surviving data.
- Replacement execution checkpoint 2026-09-09: user approved a new isolated worktree/runtime and continuation under the existing scientific-visuals goal. Active checkout is now `/Users/rschlae/Git/klicker/klicker-uzh/trees/scientific-visuals-isolated`, branch `rs/scientific-visuals-isolated`, baseline `452513a6ea08ade57521e1ae93d90055b14db217`. Fresh fetch resolves target/default `origin/v3`; original branch is one commit ahead and 80 behind. No integration performed. Copied the scoped chemistry edits, adopted runtime fixes, and two research artifacts with patch application. Original checkout and its pre-existing transactional-output deletions remain untouched; those deletions were not copied. Primary checkout has unrelated user changes and was not edited.
- Isolation: replacement Compose uses project-scoped pnpm storage instead of the shared external cache. Database and dependency volumes remain project-scoped; only the existing routing network is shared. Configuration verification passed five checks before startup. Provider identity is `rs-scientific-visuals-isolated`, Compose project `default-rs-71b2e`, distinct from original `default-rs-fa80c`. No original runtime records were edited.
- Producing startup result: installed Devrouter 0.0.64 `ensure <replacement-path> --profile manage --json` failed creating `default-rs-71b2e_default`: `all predefined address pools have been fully subnetted`. No replacement containers or project-labeled volumes exist; bootstrap and browser tests did not run. Exact replacement `devrouter stop` returned `stopped: true`, `freedRoutes: 0`; subsequent exact route readback is empty and Devsy reports `NotFound`. This is an absent runtime after failed creation, not a running or successfully provisioned stack.
- Networking owner confirms there is no released supported allocation recovery. Its source is under independent review and OrbStack remains diagnostics-only. No more startup retries or cleanup are justified by unchanged capacity. Next owner step is values-free destination/route/capacity proof; any proposed explicit subnet requires separate exact-target approval. Do not use the account-testing subnet `172.30.240.0/24`. Both chemistry identities, records and surviving data are preserved.
- Goal bookkeeping: the existing scientific-visuals goal is still marked blocked. Available goal tools provide no resume operation; do not replace or mark the unfinished goal complete. Current user approval authorizes execution but does not itself change the tool's recorded status.

- Guard ownership checkpoint 2026-09-09: the Devrouter task (`01a07859-1f4e-7283-a66f-7a9150341226`) explicitly took ownership of the general absent-runtime stop/recovery guard and requested no further ensure/repair or record edits. The already-submitted canonical stop finished after 130 seconds in the provider queue, exit 1: `Managed stop cannot prove the complete retained service population`. No lifecycle command or child remains active here. Await the owner's supported recovery path; user authorization for recreation and scoped verification remains valid.
- Targeted network recovery 2026-09-09: user explicitly authorized old-network cleanup. Removed only `enhance-ground-truth_klicker` (Docker ID `9641dbb3b48048cb8998d447b57abc2c844cfd0ce7cdd2b6705291fbd3f86c5c`) after fresh zero-endpoint proof; its sole referencing LiteLLM container was exited and remains preserved with all volumes. Legacy Compose must recreate its network before next use. No active network, container, volume, shared configuration, or peer runtime was changed. The Devrouter Networking task was informed and retains the general network-capacity fix.
- New lifecycle blocker: ordinary ensure and explicit repair both fail before provider dispatch with `Lifecycle transition is blocked`. Installed 0.0.62 reliability state records manual policy, `stopped-by-user`, phase `stopping`, interrupted/drained ensure, no worker, and incomplete stop proof. This follows canonical stop rejecting the absent service population. Main sent the exact reproducer to the Devrouter task, which owns the general lifecycle implementation. Do not edit reliability records or bypass managed lifecycle. Chemistry remains absent with zero routes; bootstrap/browser verification is unperformed.
- Recovery attempt 2026-09-09: approved canonical `devrouter ensure <exact-worktree> --profile manage --json` exited 1 before container creation or bootstrap. Docker rejected `default-rs-fa80c_default` with `all predefined address pools have been fully subnetted`. Host metadata shows 31 bridge networks. Exact project network, containers, and project-labeled volumes remain absent; Devsy reports `NotFound`. No database reset/seed, cache clear, network deletion, or shared-host reconfiguration ran. Canonical `devrouter stop <exact-worktree> --json` also exited 1 because it cannot prove a complete retained service population. Report this as absent/incomplete recovery, not a successful stopped-runtime proof. Shared network capacity is the new blocker; do not repeatedly retry unchanged startup or prune peer networks.
- Source assessment disposition 2026-09-09: Singer completed and was closed. Relevant upstream overlap is concentrated in package versions/Next updates, Docs help, the expanded Chat browser spec, and the lockfile; reconcile those deliberately before delivery, preserving chemistry hunks. Core chemistry renderer/CSS changes remain non-overlapping. Main verified Docs lacks an explicit trust option and the existing test table covers formulas, units, reactions, and ordinary math. An explicit Docs trust option can be considered in the next tested edit; extra charge/isotope cases are not automatically required because upstream library syntax breadth alone does not justify expanding the test portfolio. Reuse earlier checks for unchanged local content; rerun affected checks after actual integration, not merely because refs were refreshed. No required review gate is satisfied by this mapping result.
- Recovery approval 2026-09-09: user explicitly approved recreating only this chemistry worktree's local runtime, bootstrapping a fresh synthetic database, preserving surviving caches/volumes, then continuing verification and reviews. Stop before deleting existing data. Preflight finds no `default-rs-fa80c` project volumes; the shared pnpm store remains and must be reused. The ignored cache-preservation marker is enabled before canonical startup. This supersedes the preceding recreation approval blocker, not unresolved scientific persistence decisions.
- Resume checkpoint 2026-09-09: user authorized continuation. Remote fetch succeeded; this task remains at `452513a6ea08ade57521e1ae93d90055b14db217`, one commit ahead and 75 behind upstream/target `origin/v3` at `cbcede79718e8e60ff04d3f8376ab6a3f4bb64ed`. No integration or source commit occurred. Existing chemistry edits, adopted runtime fixes, and pre-existing transactional-output deletions remain preserved. Fresh `git diff --check` and runtime-shell syntax checks pass; application tests were not rerun.
- Runtime blocker 2026-09-09: installed devrouter is 0.0.62. Exact-source workspace listing resolves `rs-latex-chemistry-investigation`, owner present, zero routes. Devsy registry confirms the same source and UID `default-rs-fa80c`; `devsy workspace status rs-latex-chemistry-investigation --result-format json --timeout 20s` returns `NotFound`. All eight previously recorded container IDs are absent in Docker context `orbstack`, and no volume matches the old Compose project label. The persisted devrouter `ready/manage` record from September 5 is stale, not readiness evidence. Cache-preservation marker is absent. No startup, repair, stop, recreation, deletion, seed, or cache clear ran during this resume.
- Coordination: the Devsy Issues task is archived, so the ownership-handback message could not be delivered. Its final checkpoint records no active lifecycle operation; no competing repair was started here. Recreation is outside the previous retained-container recovery boundary. Obtain an explicit ruling for exact-workspace recreation and synthetic bootstrap before running canonical startup; preserve any surviving source caches or volumes and stop if replacement/deletion is required.
- Independent source assessment: native explore child Singer (`01a08608-d251-7481-ab03-0d167d240d4a`) owns chemistry/upstream overlap mapping only; main owns runtime reconciliation and final acceptance. Its result must be dispositioned before source integration or delivery.

- Current checkpoint 2026-09-05: chemistry registration, local CSS/fonts, focused tests and Docs help are implemented but uncommitted. The only new commit is the approved plan at `452513a6ea08ade57521e1ae93d90055b14db217`; its root `check:all` passed through normal hooks. Reuse this branch and worktree. No source slice or final review has started, no child remains active, and no external delivery is authorized.
- Verified: 42 Markdown tests pass; Chat has 475 passing and 21 skipped unit tests. Markdown and Chat type checks pass. Docs and all four affected app production builds pass. The serial Turbo retry completed 13 tasks (eight cached) in 11 minutes 55 seconds with `NODE_OPTIONS=--max-old-space-size=4096` and `--concurrency=1`. The first attempt was killed in unchanged GraphQL Rollup with exit 137 and runtime counters showed an OOM kill. No host resources were changed. Tracked GraphQL SDL has no diff. Native formatting and `git diff --check` pass.
- Build limitations: unchanged GraphQL type warnings, large page data, Manage's 2.83 MB app chunk exceeding service-worker precache size, and QR-page missing-message diagnostics remain. Markdown's installed `@uzh-bf/design-system@4.1.8` declares absent `types/index.d.ts` while `dist/index.d.ts` exists; the dependency is unchanged. Frozen-lockfile recovery after `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` passed with pnpm 11.5.0. Only 15 lockfile lines for five direct KaTeX importers are added. The `--offline` install still ran registry-backed supply-chain policy checks.
- Browser blocker: Manage desktop before/after proves two rendered chemistry expressions with MathML, no KaTeX errors and local fonts. At 390 pixels the element modal clips and the preview is not visible, so narrow acceptance remains open. The focused Chat test never ran. After a first queue-canceled attempt, the pinned-Node host launcher started the runtime but Auth repeatedly reported `TurbopackInternalError: Cell ... no longer exists ... <EsmAssetReference as ModuleReference>::resolve_reference`. Auth readiness requests kept timing out. `util/dev-runtime.sh` makes 90 attempts of up to 15 seconds despite its 90-second error message. The second launcher was canceled after identifying that compiler failure. The suspected Devsy Postgres label mismatch was disproved. Next action is a bounded Auth runtime repair decision, then browser verification, scoped commit and required reviews; no cache purge, Auth source change or framework upgrade was performed.
- Release/checkpoint state: `devrouter stop` completed for this exact task worktree. Fresh source-path workspace readback has zero routes, the known runtime container is `exited` with `Running=false`, and no service in compose project `default-rs-fa80c` is running. The synthetic browser draft was closed without saving and browser session `chemistry-parity` is closed. Three bootstrap-regenerated transactional HTML outputs were returned to their pre-existing deleted state and remain unstaged. Normal and escalated rs-handoff writes both failed under `~/.handoffs/klicker-uzh/`; no new handoff or index entry exists. This plan and the results document preserve the checkpoint until that write capability is restored.
- Ketcher follow-up: native executor Planck completed the isolated experiment. A missing browser `global` stopped Redux before `onInit`; a prototype-only `globalThis.global = globalThis` shim restores readiness. Molecule, reaction, AGF peptide, ACGT DNA and ACGU RNA reopen and produce native PNGs. Biology KET strings are stable for those samples; molecule/reaction strings change. Screenshots show usable editor diagrams but much smaller plain static previews without proven sequence-direction semantics. This does not select production dependencies or qualify Manage integration, fidelity, cold-open budget, erasure, or transfer. Receipt: `/private/tmp/klicker-scientific-prototype-ChOK6F/followup-20260905-receipt.json`. Prototype browser closed and container reported stopped.
- Runtime history: the chemistry package used the managed runtime for `/Users/rschlae/Git/klicker/klicker-uzh/trees/latex-chemistry-investigation`; the no-managed-runtime note below describes only the first experiment checkpoint. The current stopped-state receipt above is authoritative.
- Continued execution 2026-09-05: user approved working through the plan with a new goal. Native planner Lagrange approved the concrete chemistry notation package; accepted its sole advisory finding by aligning the delegation map with the detailed split. Planck completed and closed the isolated prototype follow-up. Verification status is recorded above.
- Historical 2026-09-03: inspected `origin/v3` at `afba9120512cdd6d6ba43cc87997520a3a0d0a1a`; superseded by the September 5 receipt below.
- Done: investigated Overleaf chemistry syntax, KaTeX/`mhchem`, Ketcher, biology renderer options, existing Markdown/Slate/media seams, and Chat streaming/persistence/attachment seams.
- Done: verified current Ketcher upstream documentation through Context7.
- Done: selected initial biology scope, owner-neutral value semantics, static display, route-owned Chat tool, immutable revision model, and two-stack delivery proposal for review.
- Done: completed the three-round native hardening budget and applied all 15 findings.
- Done with limitation: attempted the cross-provider rival review; Claude authentication was expired, so the pass produced no review.
- Done: identified open PR #5676 as the authoritative-history predecessor and removed competing branch-reconstruction work from this epic.
- Done 2026-09-05: user-authorized review improvements and first local execution package. Native planner Archimedes (`01a071d9-fc54-7ba1-8f29-c7cc4f929b94`) approved the local plan; production and external delivery remain outside current authority.
- Verified: `origin/v3` is `fbc5f4fcc2ffa1c8d25695679823134985c5a8d8`; branch remains 40 behind, zero ahead. [Authoritative Chat history prerequisite](https://github.com/uzh-bf/klicker-uzh/pull/5676) is still open with no merge commit. Three pre-existing deletions under `packages/transactional/out/` remain untouched.
- Review findings: separate local feasibility from production qualification; distinguish byte identity from source/preview equivalence; verify lossless projections per kind; exercise late writers and deletion retries; account for the new course deletion request path.
- Capability limitation: Claude advisor exited before review with `Failed to authenticate: OAuth session expired and could not be refreshed`. No advisor opinion exists; no reauthentication was attempted.
- Evidence: [first execution results](../2026-09-05-scientific-visuals-prototype-results.md) record commands, versions, outcomes and limitations. Synthetic Indigo molecule/reaction KET and PNG round-trips pass. Peptide/DNA/RNA import and document reopen pass with a pinned monomer library, but generic depiction is not a qualified sequence presentation. FASTA symbols survive; headers normalize. Independent source/image hashes do not prove depiction equivalence.
- Experiment outcome: the abstract lifecycle model disproves deletion of retry rows while stale publishers or staging grants can still write. Production needs actual storage fencing and shared-reference/transfer semantics before the proposed fields and migration are accepted; no Blob/database adapter was built after this counterexample.
- Experiment outcome: Ketcher 3.18.0 builds with `events` and `process` browser shims in the temporary React page. The main lazy chunk is about 8.44 MB gzip, so its transfer alone exceeds the proposed five-second cold-open target at 10 Mbps. The page mounts but editor readiness remains inconclusive. No Manage/Slate/Next, keyboard, mobile or macromolecule export success is claimed.
- Next recommended production package: chemistry notation parity; it is independently useful but does not replace visual molecules or biology. Continue the visual experiment with the Ketcher readiness and native macromolecule export seam, then resolve source/preview trust and lifecycle ownership before proposing visual persistence implementation. Current tests do not select production dependencies or relax a budget.
- Runtime: standalone prototype containers only; no managed repository runtime was touched. Browser session closed and its loopback editor container stopped. Renderer/lifecycle/setup/build containers exited; retained files and images are local evidence, not deployed resources.
