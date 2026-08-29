# W3 — authoritative chat history and turn ownership (execution plan)

Source roadmap: `rs/chat-codeapi-roadmap`,
`project/2026-08-23-klicker-chat-codeapi-roadmap.md`, W3. That roadmap was
written against `ee5712399` on 2026-08-23 and has no PR. This plan reconciles
W3 with current `origin/v3` before implementation.

Planning review completed on 2026-08-29 with `DONE_WITH_CONCERNS`. The native
planner route failed before launch, so the read-only pass used the one allowed
trusted `generic-continuity` route, GPT-5.6 Sol at xhigh. Its corrections are
recorded in
`project/_local/reviews/2026-08-29-chat-authoritative-history-planning-stage.md`
and incorporated below.

## Goal

Make PostgreSQL, rather than browser-composed history, authoritative for each
chat turn. Persist or exactly validate the triggering user message in the
participant-owned thread, reconstruct and validate its active parent chain,
send only a bounded server projection to the model, and bind the existing
assistant lifecycle to that exact user message.

Apply the same authority to current image attachments. New local images become
current-message bindings; explicitly reselected persisted images are copied
only after server-side ownership checks; regeneration reuses immutable
bindings. This gives later CodeAPI files and generated assets a proven branch
and ownership seam without introducing their storage models early.

## Non-goals

- No CodeAPI client, Python tool, execution, output, JWT, object storage,
  general-file attachment, generated plot, or download route.
- No speculative four-execution or 20-asset production helper before W4 and W5
  define the persisted execution and asset shapes.
- No replay of generic persisted MCP tool payloads into model history. Text
  replies remain the only persisted assistant content replayed in W3.
- No Prisma schema change or migration. `ChatMessage.parentId`, lifecycle
  fields, and `ChatAttachment` remain the existing models.
- No GraphQL, Hatchet, model-registry, prompt-policy, credit-policy,
  gamification, visible UI, copy, or i18n change.
- No secret access, external model call, production data read, push, PR, merge,
  rebase, deployment, live proof, cleanup, worktree removal, or branch deletion.

## Execution contract

- **Owner**: the current main session is the execution orchestrator and sole
  writer. History validation, persistence, route integration, and lifecycle
  fencing stay together because they share one data-integrity boundary.
- **Approval boundary**: approval of this reviewed plan authorizes its plan
  checkpoint commit, in-scope local edits, the exact worktree's devcontainer
  lifecycle, repository-native checks, host browser smoke with synthetic data,
  required read-only reviews, scoped local commits, plan `Progress`, and a
  dated local reconciliation receipt in the CodeAPI roadmap worktree.
- **Withheld**: push, PR creation or update, ready marking, merge, upstream
  integration beyond the accepted base, migration, secret access, external
  model use, deployment, live traffic, cleanup, and deletion.
- **Boundary owner**: this main session owns implementation, review
  disposition, verification, and roadmap reconciliation. Reviewers are
  read-only and cannot broaden the package.
- **Terminal**: the plan and all implementation slices are locally committed;
  focused and integrated checks pass; the exact committed range has passed its
  required slice and final reviews; runtime state is restored; and the roadmap
  has a dated superseding receipt. Achieved layer: `locally_committed`.
  Formal `pr_ready` remains `delivery_pending` until push and PR creation are
  separately authorized.
- **Pause**: stop for a required schema or migration, a new participant-visible
  behavior, evidence that existing valid branches cannot satisfy the proposed
  edge contract, an attachment rule that would expose another participant's
  data, a required secret/external provider, or an unresolved review blocker.

## Plan identity

- Plan: `project/2026-08-29-chat-authoritative-history-plan.md`
- Branch: `rs/chat-authoritative-history`
- Worktree: `trees/chat-authoritative-history`
- Accepted base: `f0659e1301254320b2f67a0a4be752ebf6a41c0f`
- Upstream at planning: `origin/v3` at the same commit, 0 ahead and 0 behind
- Roadmap item: W3, “Make conversation branches and assistant ownership
  authoritative”
- Delivery layer granted after plan approval: local commits only

## Grounding facts verified at the accepted base

- The participant chat route accepts a browser-composed `messages` array and a
  separate `parentId`. It uses that array for model context, prior image
  descriptions, prompt telemetry, and late user-message persistence.
- `useChatResponse` serializes historical text and filters marker-only
  assistant rows. It hydrates persisted images back to full base64 and resends
  those bytes to the chat route.
- The browser stores one active branch in `messages` and all thread rows in
  `allMessages`. `getPathToLeaf` and `findBranchLeaf` follow `parentId` without
  cycle protection.
- Merged runtime-charging work already creates an `IN_PROGRESS` assistant row
  before MCP, image-description, or provider work. It finalizes that row on
  success and abort, marks it `FAILED` on handled stream errors, fences attempts
  with `lifecycleAttemptId`, charges once, and hides incomplete rows from
  history. W3 must preserve this implementation, not recreate it.
- The assistant claim currently checks owner, chatbot, and thread, but not the
  participant or the existence of the completed parent user row. A failed row
  can be reclaimed with another parent, and finalization can rewrite
  `parentId`.
- `ChatMessage.id`, thread IDs, participant IDs, chatbot IDs, and attachment
  IDs are UUIDs. `parentId` has an index but no self-relation. A foreign,
  missing, or cyclic parent path can therefore exist and must fail closed at
  the read boundary.
- `ChatAttachment` is the current image primitive. Its full image, preview, and
  description are message-owned. The ownership-checked hydration route proves
  that persisted attachment IDs are sufficient for server-side reselection.
- AI SDK 7 model history represents a completed tool exchange as an assistant
  tool call followed by a matching tool-role result. The current single JSON
  `tool-call` persistence shape is suitable for rendering but not safe to
  replay generically without a tool-specific projection.
- No CodeAPI execution or general asset persistence type exists on current
  `v3`. Implementing those projections now would produce unconsumed contracts
  whose fields could diverge from W4 and W5.

## Roadmap reconciliation before implementation

The original W3 contract cannot be marked complete unchanged:

1. Assistant pending-row ownership and terminal lifecycle are already present
   from merged work. W3 tightens their participant and parent fencing.
2. Current image authority belongs in W3 because the image model already
   exists and exhibits the exact client-byte trust problem later files would
   inherit.
3. The four-execution projection remains a blocking W4 acceptance obligation.
   W4 cannot claim multi-turn Python context until it implements and tests the
   roadmap's newest-four, per-entry, chronological, and 8 KiB limits over the
   W3 active path.
4. The 20-entry, current-first, 8 KiB general asset catalog remains a blocking
   W5 acceptance obligation. W5 cannot claim file or generated-asset scope
   until it implements that projection over W3-owned bindings.
5. The original W3 execution/asset fixtures are therefore **deferred**, not
   passed or skipped. The dated Phase 5 receipt will state this explicitly.

Approval of this plan approves that superseding W3 boundary. It does not
approve W4, W5, or their storage and execution decisions.

## Resolved implementation decisions

### D1 — canonical trigger request with a bounded compatibility adapter

The canonical POST request carries one user trigger: UUID, nullable parent
UUID, text, and an ordered maximum-three attachment list. It also carries the
existing UUID thread and assistant IDs plus selected model, mode, and reasoning
effort. The server supplies the `user` role; the client cannot choose it.

Each attachment is either a genuinely new image with raw bytes or a persisted
attachment UUID selected by the participant. A trigger is valid with non-blank
text, at least one attachment, or both, preserving image-only messages.

For one deployment window, the route also accepts the old `messages` body used
by an already-open browser tab. It extracts only the final user item and the
separate parent hint. Earlier items are ignored for authorization, context,
attachment lookup, telemetry, and persistence. The adapter returns the same
canonical internal trigger and is documented for removal in the roadmap
receipt; it does not preserve client-history authority.

All identifier fields use UUID validation. Malformed bodies receive the
existing generic request error without database or provider work.

### D2 — immutable triggering message and row-bounded ancestor path

After participant/chatbot/model/account checks, but before MCP, image
description, or provider work, one transaction:

1. verifies the participant-owned chatbot thread;
2. creates a new completed user trigger or exactly validates an existing one
   against thread, user role, parent, and normalized persisted text;
3. creates the new trigger's attachment bindings under D5;
4. walks the parent chain from the trigger through one bounded PostgreSQL
   recursive CTE; and
5. validates and projects the closest 64 rows before committing.

An existing trigger is immutable. A different parent, content, role, thread,
or attachment mutation under the same ID is a generic conflict, not an update.
Edit creates a new user ID. Regenerate reuses the existing user ID and its
bindings.

The CTE follows globally unique IDs so a parent in another thread is visible as
invalid rather than indistinguishable from absence. It orders by parent-chain
depth, never `createdAt`, and returns at most the closest 256 rows. Validation
rejects a repeated ID, a missing ancestor before the depth boundary, a row in
another thread, a non-completed row, an invalid user/assistant edge, or an
assistant at a true database root.

If row 256 still points to an older parent, the oldest in-memory row becomes an
effective root and the branch is accepted as truncated. That effective root may
have either role. The server marks truncation in its internal result and
values-free telemetry; it does not claim that the full thread was validated or
send identifiers to logs. A newly inserted trigger rolls back when structural
validation fails.

The limit is row-bounded, not token- or byte-bounded. Sibling branches cannot
consume the 256-row allowance because the query follows only the selected
parent chain.

### D3 — server-projected model history

The same transaction fetches full content only for the closest 64 validated
branch rows, then reorders them from effective root to trigger. It fetches only
attachment descriptions for prior user rows. It never loads prior raw image or
preview bytes into model-history construction.

User and assistant text is normalized from persisted content. Reasoning,
client data markers, generic MCP calls, and tool results are not replayed.
Marker-only assistant rows remain part of structural validation but are omitted
from the model request, preserving current provider compatibility. The current
user row receives its own server-resolved images as multimodal input.

The provider request, prior-image context, language history, and telemetry all
use this projection. Prompt telemetry hashes only the persisted current trigger
text and records bounded counts/truncation booleans; it does not hash the full
conversation or log message and attachment IDs.

### D4 — exact assistant ownership across every lifecycle transition

The assistant claim runs after successful branch validation and before MCP,
image-description, or provider work. It requires the participant-owned thread
and the exact completed user parent. New and reclaimed rows use that parent.

Duplicate recognition and failed-attempt reclaim require the same participant,
chatbot, owner, thread, assistant role, and parent user ID. A retry never
changes parent. `failChatTurn` and `finalizeChatTurn` receive and compare the
same parent. Finalization no longer writes `parentId`; ownership was fixed by
the claim. Attempt-ID fencing, one-time account charging, current abort
handling, and independent participant-credit decrement stay unchanged.

History continues to expose only completed rows. A failed assistant remains a
terminal hidden lifecycle row for later reconciliation; no new participant
error persistence or copy is introduced in W3.

### D5 — authoritative current image bindings

The ordered request attachment list is resolved before model work:

- A new raw image is validated under the existing count and data-URL limits.
  The server creates its preview and persists one current-message binding.
- A persisted attachment UUID is accepted only when it is unique in the
  request and belongs to a completed user message in the same
  participant/chatbot/thread scope. The server copies its raw image, preview,
  and safe description into a new binding for the new trigger.
- Omitted source IDs stay omitted from the new binding set. This implements
  attachment removal on edit without mutating or deleting the source message.
- A newly edited trigger may mix retained persisted selections and new raw
  images up to the existing total of three.
- An existing trigger ignores legacy raw-image replay and uses only its own
  immutable bindings. Canonical attempts to add or substitute attachments
  under an existing trigger ID fail as conflicts. Regeneration never deletes,
  replaces, copies, or redescribes the source bindings.

The route loads current raw bytes from PostgreSQL after the transaction. It
generates or updates a description only on a new current binding whose
description is missing. It never updates the source attachment selected for an
edit. Prior branch rows contribute descriptions only. Foreign, duplicate,
assistant-owned, removed, missing, or cross-thread attachment IDs fail before
assistant claim or provider work.

This retains the existing per-message image-copy storage pattern while moving
the copy boundary from browser-provided bytes to an ownership-checked server
operation. General files and generated assets must adopt an object-storage
version of this binding rule in W5.

### D6 — shared branch semantics without browser authority

A small dependency-free branch module owns cycle-safe parent walking over
message headers. The server separately validates persisted role edges and
applies the complete structural contract to the CTE rows. Browser helpers use
the shared walker so a corrupt cycle or missing parent cannot loop forever or
silently manufacture a path.

The browser may choose which owned branch the participant is viewing, but its
path remains a presentation hint. Only the server transaction authorizes the
turn. Existing history-rail behavior for orphan and consecutive-role display
remains a rendering concern; W3 does not erase or hide rows from the loaded
transcript merely because a future turn would reject an invalid branch.

### D7 — explicit downstream projection obligations

W3 exposes the validated active-path rows and current-message bindings needed
by later packages. It does not introduce unused DTOs for non-existent models.

- W4 must map its own persisted `execute_python` tool parts into an AI SDK 7
  assistant tool call plus matching tool-role result or a separate bounded
  execution summary. It owns the newest-four, Python/summary, chronological,
  omission-marker, and 8 KiB tests before multi-turn Python is accepted.
- W5 must map ready active-path assets into the current-first, newest-prior,
  20-entry, 8 KiB catalog. An older asset re-enters only through D5-equivalent
  explicit reselection and a new current-message binding.
- Generic MCP payloads stay render-only until a future tool-specific contract
  proves safe replay. W3 does not convert untrusted retrieval or tool output
  into platform instructions.

## Layer footprint

| Layer | W3 disposition |
| --- | --- |
| Prisma | Reuse current models and indexes; no schema or migration |
| Chat server | Canonical trigger parser, authoritative history transaction, attachment resolver, lifecycle fencing |
| Chat client | Send trigger plus ordered new/reference attachments; stop hydrating persisted images solely to resend bytes |
| Shared chat logic | Cycle-safe parent walker and structural validation |
| GraphQL / types / codegen | No change |
| UI / i18n | No visible change and no new string |
| Hatchet / gamification / seeds | No change |
| Wiki / ADR | Record the authority, bounds, compatibility window, and downstream obligations |

## Primitive impact

| Primitive | Disposition |
| --- | --- |
| Conversation branch | PostgreSQL parent chain becomes authoritative; browser branch is a hint |
| Triggering user message | Create once or validate exactly; never mutate under the same ID |
| Assistant attempt | Preserve existing row/attempt lifecycle and bind it to one exact parent |
| Image attachment | Resolve persisted IDs server-side and create immutable current-message bindings |
| Model history | Closest 64 validated rows; persisted text and bounded image context only |
| Execution context | Deferred as a blocking W4 acceptance obligation |
| General asset catalog | Deferred as a blocking W5 acceptance obligation |

No new domain term is introduced, so no `CONTEXT.md` glossary is required.

## ADR gate

The ADR gate is **yes**. PostgreSQL-owned branch context, the 256-row effective
root, the 64-row model window, immutable attachment rebinding, and the decision
not to replay generic tool payloads are hard to reverse after CodeAPI assets
depend on them. They are surprising without context and result from real
security, compatibility, latency, and data-minimisation trade-offs.

Immediately before creation, rescan all local refs for reserved ADR numbers.
At planning time `0043` is the next free number; the proposed file is
`docs/adr/0043-postgresql-owned-chat-context.md`. Keep the ADR concise and add
it to `docs/adr/README.md`. If `0043` becomes occupied, renumber without
changing the decision.

## Data protection by design and by default

W3 changes processing of participant conversation text and images, which are
personal data. It does not change the tutoring purpose or introduce a new
recipient, data category, retention period, export, or access role.

- **Amount**: no new field or copy. The server fetches at most 64 rows of
  content, only prior image descriptions, and current raw images. Persisted
  image reuse eliminates browser byte round-trips.
- **Extent**: only the participant-owned active branch reaches the model.
  Siblings, rows older than the 64-row window, prior raw images, and generic
  tool payloads remain outside automatic processing.
- **Period**: messages and image bindings keep the existing thread retention
  and deletion behavior. W3 adds no cache, soft-delete period, backup rule, or
  external storage.
- **Accessibility**: existing participant/chatbot/thread checks remain and are
  extended to every trigger, parent, assistant attempt, and attachment source.
  No public URL or new reader exists.

Transparency and lawfulness remain under the existing chatbot purpose and
notice because W3 reduces rather than expands the external-model data flow.
Fairness improves because edit, regenerate, reload, and sibling branches use
the same persisted facts. Purpose limitation and minimisation are enforced by
the active-path/window checks. Accuracy comes from immutable stored messages
instead of browser reconstruction. Storage limitation is unchanged. Integrity
and confidentiality gain fail-closed ownership and structural checks.
Accountability comes from the ADR, wiki, focused negative tests, and bounded
telemetry. No new controller decision or DPIA trigger is assumed by this plan.

## Feature-wide test portfolio

| Consequential behavior | Evidence seam |
| --- | --- |
| Normal new trigger persists once and supplies root-to-leaf model text | Server helper unit test plus route test |
| Existing trigger is exact and immutable | Transaction test for matching retry and parent/content/role/thread conflicts |
| Valid path longer than 256 is accepted at an effective root | Synthetic PostgreSQL recursive-history test |
| Closest 64 rows win independently of timestamps and siblings | Pure projection plus PostgreSQL test with misleading timestamps and sibling rows |
| Missing parent, cycle, cross-thread row, non-completed row, and invalid edge fail before claim/provider work | CTE integration matrix plus route-order assertions |
| Client history cannot inject or replace model content | Legacy-adapter and canonical-route tests with forged earlier messages |
| Marker-only assistant rows stay structural but are omitted from model history | Focused model-projection regression test |
| Assistant duplicate, reclaim, fail, and finalization require participant and exact parent | Existing account-usage unit/integration suites extended with parent and participant cases |
| New raw images become ordered current bindings with server previews | Attachment resolver and route tests |
| Edit removal and mixed retained/new images produce only the new selected binding set | Attachment transaction test and client request test |
| Older same-thread image returns only by explicit UUID reselection and new binding | Positive ownership/rebinding integration test |
| Foreign, cross-thread, assistant-owned, duplicate, missing, or mutated attachment references fail before provider work | Negative attachment and route-order matrix |
| Regeneration loads its own immutable bindings and does not delete, replace, copy, or redescribe them | Retry/regenerate integration and route tests |
| Abort, handled stream failure, duplicate callbacks, and reload preserve current lifecycle and charging behavior | Existing route/lifecycle suites plus exact-parent regression assertions |
| Browser parent walking terminates on cycles/missing parents without making the browser authoritative | Shared helper and chat-store tests |
| Compatibility adapter ignores every historical item except the final user trigger | Focused request-parser/route test |

DB-backed tests use synthetic UUIDs and clean up only rows they create. They do
not bulk-delete shared development data or read real conversations.

The original roadmap's four-execution and 20-asset fixtures are recorded as
deferred W4/W5 obligations. They are not counted as W3 evidence.

## Slices and commits

### P — approved plan checkpoint

- Files: this plan and its `Progress` only. The ignored planning report remains
  local evidence and is not committed.
- Commit after approval: `docs(project): add authoritative chat history plan`.
- No implementation starts before the user approves this reviewed plan.

### S1 — authoritative text history and lifecycle

- Add the shared cycle-safe parent walker and the server-only trigger/history
  transaction.
- Add the canonical trigger request and one-window legacy adapter for text-only
  turns. Persist or validate the trigger, run the depth-ordered CTE, project the
  closest 64 rows, and replace every client-history consumer in the route.
- Tighten claim, fail, and finalize to participant-owned thread plus exact
  completed user parent. Preserve attempt fencing and charging.
- Update browser path helpers to use the shared safe walker without changing
  transcript rendering or branch choice.
- Add pure, route, lifecycle, and opt-in PostgreSQL tests for the S1 rows of the
  portfolio.
- Commit: `feat(chat): enforce authoritative conversation history`.
- Review the immutable slice with one `simplifier` and one `slice-reviewer` in
  parallel. The slice reviewer covers authorization, structural integrity,
  raw-SQL safety, idempotency, concurrency, lifecycle, and compatibility.
  Verify and disposition findings before S2.

### S2 — authoritative current images

- Change the client request to send ordered new-image or persisted-attachment
  inputs. Remove send-time hydration that exists only to resend stored bytes;
  retain hydration for participant-visible full-image display.
- Extend the trigger transaction with ownership-checked binding creation for
  new triggers and immutable-binding reuse for existing triggers.
- Move current image loading, preview generation, description updates, and
  prior-description projection to server-owned rows under D5.
- Add edit, removal, retained/new mix, explicit older reselection, foreign and
  duplicate ID, retry, regeneration, and source-immutability tests.
- Commit: `feat(chat): make image bindings server authoritative`.
- Review the immutable slice with one `simplifier` and one `slice-reviewer` in
  parallel. The slice reviewer covers participant scope, raw-byte handling,
  binding immutability, duplicate/retry behavior, data minimisation, and
  compatibility. Verify and disposition findings before S3.

### S3 — decision record, wiki, and integrated evidence

- Rescan ADR reservations, create the concise PostgreSQL-owned chat-context
  ADR, and register it in `docs/adr/README.md`.
- Update `docs/chat-platform.md` with canonical/compatibility request behavior,
  authoritative path and image binding rules, exact lifecycle ownership,
  truncation semantics, generic-tool replay exclusion, and W4/W5 obligations.
- Update this plan's `Progress` with exact commits, checks, review dispositions,
  browser evidence, and residual gaps.
- Commit: `docs(chat): record authoritative conversation context`.
- Run the complete verification portfolio and one integrated `final-reviewer`
  over the exact P-through-S3 committed range. Documentation-only S3 does not
  get a separate simplifier or slice reviewer.
- Append a dated superseding receipt to the local CodeAPI roadmap. It must name
  achieved source/review evidence separately from withheld push, PR, CI,
  desired state, runtime, live proof, cost, and publication.

## Delegation map

| Slice | Route | Reason | Acceptance |
| --- | --- | --- | --- |
| P | `main` | Approval checkpoint and authority record | Plan-only local commit |
| S1 | `main` | Critical coupling across raw SQL, route authority, and lifecycle charging | Text path and lifecycle portfolio pass |
| S2 | `main` | Same route plus participant image ownership and raw bytes | Image authority portfolio pass |
| S3 | `main` | Integrates verified behavior into ADR/wiki and roadmap receipt | Docs match exact code and evidence |

The optional external `explore` route failed before launch because this task's
loaded role surface substituted an incompatible injected model/effort. Source
mapping stayed in the trusted main session. No implementation executor is used:
the only candidate slices cross authorization, participant data, architecture,
or integration decisions and are not clean leaf contracts.

Required read-only reviews:

| Gate | Route | Acceptance |
| --- | --- | --- |
| S1 simplification | `simplifier` | No behavior-preserving net simplification left unassessed |
| S1 risk review | `slice-reviewer` | No unresolved authorization/data-integrity blocker |
| S2 simplification | `simplifier` | Image path remains proportionate and reusable |
| S2 risk review | `slice-reviewer` | No unresolved participant-scope/raw-byte blocker |
| Integrated review | `final-reviewer` | Exact committed package satisfies plan and applicable lenses |

If a configured review role fails terminally, apply the routing continuity
ladder once. A required independent gate blocks completion when no equivalent
trusted route preserves its contract.

## Verification

All Node and pnpm commands run inside the exact Node 24 devcontainer. Host Git,
devrouter lifecycle commands, and agent-browser stay on the host. Read
`rs-local-runtime-lifecycle` before starting or resuming the runtime and again
at the final lifecycle boundary.

Startup and identity:

```bash
devrouter ensure . --json
devrouter exec . -- node --version
devrouter exec . -- pnpm --version
```

Focused S1 checks, using final test filenames:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/chat test:run -- conversation-branch
devrouter exec . -- pnpm --filter @klicker-uzh/chat test:run -- authoritative-history
devrouter exec . -- pnpm --filter @klicker-uzh/chat test:run -- account-usage-route
devrouter exec . -- pnpm --filter @klicker-uzh/chat test:run -- account-usage
devrouter exec . -- env CHAT_CONVERSATION_HISTORY_INTEGRATION=1 pnpm --filter @klicker-uzh/chat test:run -- authoritative-history.integration
```

Focused S2 checks:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/chat test:run -- attachment-state
devrouter exec . -- pnpm --filter @klicker-uzh/chat test:run -- chat-response-hydration
devrouter exec . -- pnpm --filter @klicker-uzh/chat test:run -- authoritative-attachments
devrouter exec . -- env CHAT_CONVERSATION_HISTORY_INTEGRATION=1 pnpm --filter @klicker-uzh/chat test:run -- authoritative-history.integration
```

Integrated checks:

```bash
devrouter exec . -- pnpm --filter @klicker-uzh/chat test:run
devrouter exec . -- pnpm --filter @klicker-uzh/chat check
devrouter exec . -- pnpm run check:all
devrouter exec . -- pnpm --filter @klicker-uzh/chat build
```

The test filters may follow their final purpose-based filenames without
changing the evidence obligations. The PostgreSQL suite is opt-in, synthetic,
and scoped; it proves the recursive query and transaction rather than mocking
their most important behavior.

Because `apps/chat` client and route code change, run a host
`npx agent-browser@0.32.2` smoke with delegated local credentials and seeded or
synthetic content. Capture desktop and mobile evidence that thread history and
branch navigation still load, persisted images still display on demand, and a
send failure retains the existing localized recovery state. When no local
upstream model key is already available under an authorized runtime, stop at
that evidence and report edit/regenerate answer generation as unproven. Do not
access Infisical or an external model merely to turn this gate green. Unit and
synthetic PostgreSQL tests, not a no-key browser error, prove server authority.

Restore runtime state after the final runtime-dependent check. If this plan
started the workspace:

```bash
devrouter stop .
devrouter ls
```

Require the exact workspace to be stopped and its routes absent. If it was
already running for user work, follow `rs-local-runtime-lifecycle` to restore
the recorded prior state rather than assuming ownership of unrelated runtime
use.

Report passed, failed, skipped, and blocked checks separately. A source build
does not prove CI, deployment, runtime routing, CodeAPI, or live model behavior.

## Risks and failure shields

- **Client authority**: no code path may read earlier legacy `messages` items
  for model context, attachments, telemetry, persistence, or authorization.
- **Recursive query**: use parameterized Prisma SQL, follow primary-key parent
  links, cap recursion at 256, and exercise the real PostgreSQL query. Do not
  substitute 256 sequential database calls or an unbounded thread load.
- **Effective root**: reject assistant only at a true database root. Do not
  reject a valid long branch because the in-memory row-256 root has a parent or
  assistant role.
- **Immutability**: a message ID fixes role, thread, parent, text, and its own
  attachment bindings. Edit means a new user message; regenerate never mutates
  the trigger.
- **Lifecycle**: participant and parent checks apply to claim, fail, finalize,
  reclaim, and duplicate recognition. Finalization never rewrites parent.
- **Attachment scope**: persisted selections must belong to a completed user
  row in the same participant/chatbot/thread. Never authorize by attachment ID
  alone or by client-supplied bytes.
- **Raw bytes**: current images may reach the configured model under existing
  behavior; prior images contribute descriptions only. Never load sibling or
  older raw bytes while building history.
- **Compatibility**: keep the legacy adapter narrow and temporary. It is not a
  second history contract and must not outlive the dated removal follow-up.
- **Historical anomalies**: fail closed without revealing whether a missing or
  wrong row exists elsewhere. Do not repair or rewrite historical data in W3.
- **Tool replay**: do not reinterpret persisted generic MCP JSON as AI SDK tool
  history. W4 and W5 own tool-specific safe projections.
- **Delivery**: local source, reviews, and checks do not imply CI, desired
  state, deployed revision, runtime health, live proof, cost approval, or
  publication.

## Progress

- 2026-08-29: the user approved starting W3 planning and the one-time current
  `origin/v3` incorporation. Remote refs were refreshed. A fresh repo-local
  worktree and `rs/chat-authoritative-history` branch were created directly at
  `f0659e130`, exactly matching `origin/v3`. The dirty, 125-behind primary
  checkout remains untouched.
- 2026-08-29: source inspection found that merged runtime-charging work already
  supplies the pending assistant row, attempt fence, terminal success/abort,
  failed status, history filtering, and one-time charging. W3 is reconciled to
  tighten this lifecycle rather than duplicate it.
- 2026-08-29: current AI SDK documentation confirmed that safe tool replay
  requires explicit assistant tool-call and matching tool-role result messages.
  Generic persisted MCP results remain excluded.
- 2026-08-29: the configured `explore` and `planner` roles failed before launch
  because this running task substituted its injected
  `combo/glm-5.3-flash` / `max` route. Read-only OpenCodex diagnosis found
  correct role files, a healthy/ready service, and a provider map that does
  advertise `max`; no configuration changed. The trusted one-child continuity
  planner completed with `DONE_WITH_CONCERNS` and all findings are incorporated
  above.
- 2026-08-29: the user approved this reviewed plan and local execution through
  the stated terminal condition. The standalone plan checkpoint is active. No
  implementation, devcontainer runtime, test, browser session, ADR, roadmap
  receipt, push, PR, migration, deployment, or live call has occurred.
- 2026-08-29: plan checkpoint `b82396a95` is committed. S1 is active. The next
  step is the authoritative text-history transaction, exact assistant-parent
  lifecycle fencing, shared cycle-safe branch walking, and focused tests.
- 2026-08-29: S1 now creates or exactly validates the immutable user trigger,
  validates one parent branch through a bounded recursive PostgreSQL query,
  projects only persisted history, and fences every assistant lifecycle change
  to the participant, thread, and exact parent. The compatibility adapter
  ignores browser-supplied history; S2 still owns transactional image bindings.
- 2026-08-29: the focused S1 portfolio passes: 20 pure/history/request tests,
  33 route and lifecycle tests, 9 synthetic PostgreSQL history tests, and 14
  synthetic PostgreSQL account-lifecycle tests. Chat TypeScript checking,
  focused Biome checks, and `git diff --check` also pass. The temporary
  devcontainer provisioning shim was removed after the synthetic database was
  prepared; full app readiness remained unavailable because auth did not become
  ready within the two managed 90-second attempts.
- 2026-08-29: the container dependency volume was repaired from the unchanged
  lockfile after an interrupted check exposed missing installed modules. The
  rerun passed all 25 repository typecheck tasks, syncpack, Prisma sync, staged
  formatting, the host-launcher tests, and focused S1 ESLint. The aggregate
  `check:all` remains blocked outside W3 because analytics lint attempts to
  build pandas without a C compiler in this devcontainer; the already-failed
  run was stopped after its independent evidence completed.
- 2026-08-29: S1 source and tests are committed at `4cc4b97fe`. The native
  simplifier and slice-reviewer routes failed before launch because the task's
  injected `combo/glm-5.3-flash` / `max` route could not start, so the routing
  continuity ladder used two independent trusted GPT-5.6 Sol xhigh reviews of
  the immutable `b82396a95..4cc4b97fe` range. The simplifier reported zero
  blockers and three optional reductions; the risk review blocked on
  identifier-associated history telemetry and an incomplete authorization and
  concurrency test matrix. All five findings were accepted.
- 2026-08-29: the S1 review adjustment removes redundant lifecycle thread
  queries, narrows the browser branch walker to its consumed path result,
  removes the unused authoritative trigger ID, isolates history counts in a
  request-ID-only event, and fills the PostgreSQL trigger and lifecycle matrix.
  The adjusted portfolio passes 48 focused unit/route tests, 13 authoritative
  history PostgreSQL tests, 14 account-lifecycle PostgreSQL tests, chat
  TypeScript checking, and `git diff --check`. The adjustment is ready for its
  scoped commit before S2 begins.
- 2026-08-29: the accepted S1 review adjustments are committed at
  `5c959a83b`. S2 now sends only ordered new-image or persisted-image trigger
  inputs, resolves and copies persisted sources inside the participant-owned
  transaction, creates bounded previews with the existing Sharp helper, and
  treats every current-message binding as immutable. The route describes and
  updates only a newly created binding; an existing trigger reuses its own raw
  images and server metadata without browser hydration or source mutation.
- 2026-08-29: current Sharp documentation confirmed the existing bounded
  preview helper's buffer, inside-fit, no-enlargement, auto-orientation, and
  JPEG-output behavior. The S2 portfolio passes 29 route/lifecycle tests, 31
  client/parser/helper tests, 17 synthetic PostgreSQL history and image tests,
  and the unchanged 14-test PostgreSQL account-lifecycle suite. The full Chat
  suite passes 49 files and 445 tests, with two files and 31 tests explicitly
  skipped; Chat TypeScript checking, focused formatting, focused ESLint, and
  `git diff --check` also pass.
- 2026-08-29: the required browser smoke is blocked, not passed. The managed
  workspace lost its Chat/Auth processes and Redis dependencies after stopped
  service containers disappeared, and `devrouter ensure . --json` now fails
  with `could not determine process identity for workspace lifecycle lock`.
  The runtime lifecycle contract forbids bypassing that lock through raw Docker
  repair. No Infisical access, external model call, or browser proof occurred.
  S2 is ready for its scoped commit and immutable slice reviews.
- 2026-08-29: S2 source, tests, and the evidence above are committed at
  `cbe000086`. The native simplifier and slice-reviewer routes again failed
  before launch because the task substituted the unsupported
  `combo/glm-5.3-flash` / `max` route, so two independent trusted GPT-5.6 Sol
  xhigh continuity reviews inspected the immutable `5c959a83b..cbe000086`
  range. The simplifier approved with one minor and two optional reductions;
  the risk review required one major correction and reported one minor and one
  optional concern.
- 2026-08-29: the accepted S2 adjustments let a retry conditionally fill a
  still-null description on its own current binding without overwriting an
  existing description, load the current binding set once after optional
  creation, and remove unreachable null branches from the successful client
  path. Strict source-UUID provenance for byte-identical retry inputs was
  declined because W3 stores immutable current bindings rather than source
  pointers: such an input cannot replace a binding or change provider-visible
  content, while a new pointer would require the migration this plan excludes.
  Optional fixture and bounded-projection churn was also declined.
- 2026-08-29: the adjusted S2 checks pass 30 route/lifecycle tests, 31
  client/parser/history tests, 17 authoritative-history PostgreSQL tests, Chat
  TypeScript checking, and `git diff --check`. The full Chat suite passes 49
  files and 446 tests, with two files and 31 tests explicitly skipped. The
  production Chat build also passes without an upstream model key. Focused
  OpenGrep reports only two pre-existing February logging-format warnings and
  no new S2 finding. The adjustment is ready for its scoped local commit before
  S3.
- 2026-08-29: the reviewed S2 adjustments are committed at `7e5034245`; S2 is
  complete. A scan across all local refs found two separate `0042` ADR
  reservations and an existing `0043` reservation, so S3 uses the next free
  number, `0044`, for the PostgreSQL-owned chat-context decision.
- 2026-08-29: ADR 0044 and `docs/chat-platform.md` now record the canonical
  trigger, compatibility window, 256-row validation and 64-row projection,
  immutable current image bindings, exact assistant-parent lifecycle,
  generic-tool replay exclusion, and the deferred W4 execution and W5 asset
  projections. Changed Markdown is formatted, direct links exist, cited source
  symbols resolve, and `git diff --check` passes. The deterministic OKF core
  validator remains blocked by 26 repository-wide conformance errors, including
  its requirement for frontmatter on every existing ADR despite this
  repository's established ADR format; no unrelated bundle rewrite was made.
  S3 is ready for its documentation commit.
- 2026-08-29: the S3 documentation checkpoint is committed at `56196c3d2`
  (renumbered to `fa414beb6` by the one-time integration onto then-current
  `origin/v3` at `bb495a1b2`, which moved only devcontainer/CI/docs paths).
- 2026-08-29: the integrated final review over the exact pre-rebase range
  `f0659e130..56196c3d2` (trusted Sol xhigh continuity route; the configured
  `final-reviewer` failed before launch on the substituted
  `combo/glm-5.3-flash` / `max` route) returned CHANGES_REQUIRED with two
  majors: a parent cycle closing exactly at the 256-row truncation boundary
  was accepted, and image-description completion threw on a losing concurrent
  conditional update while treating a persisted empty description as
  unrecoverable. One minor plan-wording finding was also accepted.
- 2026-08-29: the corrections are committed at `16ff69e92`. The boundary walk
  now rejects when the oldest walked row's parent already appears in the
  collected path; description completion falls back on blank model output,
  matches null or empty values, reads back a concurrently persisted winner
  fenced by the trigger's own message, fails closed only on a still-blank
  read-back, and projects the persisted value. Regressions: a synthetic
  PostgreSQL boundary-cycle test and route tests for the concurrent winner and
  empty-description recovery. Recheck evidence on this exact tree: full Chat
  suite 448 passed and 32 skipped, 466 passed and 14 skipped with the opt-in
  PostgreSQL flag, Chat typecheck pass, Biome formatting applied, and
  `git diff --check` clean. Final status: correction-range recheck pending
  (both reviewer routes returned transient provider 429s); tracked as the
  only open review gate.
- 2026-08-29: runtime lifecycle closed. The exact workspace
  `rs-chat-authoritative-history` is stopped with fresh provider-state
  verification after the last container check; the devrouter route listing
  carries no route for this checkout. The `browser smoke blocked` and
  `check:all blocked` evidence gaps above remain as recorded. Roadmap receipt
  added to the local CodeAPI roadmap.
