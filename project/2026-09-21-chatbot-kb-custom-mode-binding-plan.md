# Chatbot knowledge-base binding for custom modes and MCP de-exposure

## Approval summary

A knowledge base (KB) attached to a chatbot that offers only a custom chat
mode suppressed every mode, so participants saw "Für diesen Chatbot ist derzeit
kein Chatmodus verfügbar" on live PRD. Two causes combine: `attachKbToChatbot`
provisions the required `doc_query` retrieval binding only for `tutor` and
`explainer`, and the effective-mode resolver hides any offered mode that has no
required binding whenever the chatbot declares one anywhere.

This package fixes both halves and removes the internal MCP vocabulary from the
lecturer surface:

1. KB attachment provisions the required retrieval rows for Tutor and Explainer
   and derives eligible custom-mode keys from the approved `customModeConfig`;
   approved custom modes inherit the standard binding, so a newly approved mode
   needs no re-attachment.
2. Mode availability is resolved per mode. A mode keeps serving when it carries
   no retrieval binding; a mode that declares a required binding still fails
   closed when that binding cannot be resolved at request time.
3. The lecturer-visible "Technische Integrationen" MCP panel and its MCP copy
   are removed, and the MCP read projection leaves every query and the manage
   UI; the public field stays in the schema marked deprecated instead of being
   removed. Lecturers see only "Wissensbasis".

Unchanged: the Tutor-or-Explainer invariant of `standardModeConfig`, the
capability-gated Quizzer inheritance rules, the request-time fail-closed
`REQUIRED_MCP_UNAVAILABLE` response, the one-server/one-scope KB invariants, and
all participant surfaces.

Material decisions: deprecating the public `Chatbot.mcpConfigurations` field
rather than removing it, and accepting that a mode without a retrieval binding
serves without retrieval rather than being hidden. Both are recorded with
alternatives in Decision 3 and Decision 1.

Acceptance evidence: focused package tests proving a custom-mode-only bot keeps
its custom mode offered and scoped with an attached KB, plus real browser
captures of the manage chat-usage and knowledge views showing no MCP surface.

Approval authorizes the plan commit, the slices below, local commits, an
ordinary non-force push to `fix/chatbot-kb-custom-mode-binding`, a draft pull
request, and `/final-review` at the finish gate. Merging, deployment, marking
ready, PRD writes, and publishing the ethics bot's draft revision remain
withheld.

## Execution details

### Problem and evidence

Problem: bot `1c6dec49-066b-4599-aa10-a18a89d1fe0f` ("Ethik-Rollenspiel",
custom mode `ethik-rollenspiel`, standard modes disabled, `standardModeConfig`
NULL, PUBLISHED) lost every available mode for participants as soon as a KB was
attached.

Evidence: `attachKbToChatbot` (`packages/graphql/src/services/knowledge.ts:1181`)
loops `KB_MCP_CHAT_MODES = ['tutor', 'explainer']` (`:76`) and creates required
rows with `parameters { required: true, toolAlias: 'doc_query', kb_id }`.
`resolveEffectiveChatModeOptions`
(`apps/chat/src/lib/server/effectiveChatModes.ts:213`) computes `hasRequiredMCP`
globally (`:222`) and drops every mode whose effective configurations contain no
required binding (`:238`). With the two standard modes disabled, the only
offered mode is the unbound custom mode, so the resolver returns zero modes.
Reproduction is deterministic and is recorded in the handoff.

Second seam: `resolveMcpScope` (`apps/chat/src/services/mcpScope.ts:216`)
requires the selected mode's effective KB configuration to be exactly one and
matching (`assertEffectiveConfigurationMatchesScope`); a mode with no KB
configuration currently fails closed with `scope_violation` (503). Any design
that offers an unbound mode must also resolve its scope, or the mode would be
offered and then fail at request time.

Third seam: `attachKbToChatbot` never disables obsolete KB retrieval rows; it
only upserts the modes it enumerates. A removed or renamed custom mode leaves
an enabled row bound to the previous KB, and `resolveMcpScope`'s
`assertOneScope` over all enabled KB rows rejects every mode with
`scope_violation` (503). Attachment therefore has to reconcile the row set, not
only add to it.

### Decision 1 — Mode availability is resolved per mode

Mode availability is a property of the mode. The cross-mode rule "any required
binding makes every unbound mode unavailable" is removed. After the change a
mode is offered when its standard-mode flags allow it, its own enabled
configuration can serve it (with the Quizzer capability gate unchanged), and it
is not explicitly disabled.

Consequence accepted: a mode that carries no retrieval binding serves without
retrieval instead of disappearing. For KB-attached chatbots this rarely arises,
because approved custom modes inherit the standard required binding at request
time, so a custom mode added after the KB was attached stays grounded without a
re-attachment (October 12 reconciliation). Request-time fail-closed behaviour
is unchanged for a mode that does declare a required binding.

Rejected alternative: keep a cross-mode required policy but scope it to the
mode's own bindings ("drop a mode that has no required binding"). It leaves the
live incident broken wherever the KB rows are disabled or absent for the custom
mode, and it keeps the same hidden-mode surprise. Another rejected alternative:
provision bindings only and leave the resolver untouched. That fixes future
attachments but leaves every already-attached custom-mode-only chatbot broken
until an operator re-attaches, and leaves the coupling latent.

### Decision 2 — KB attachment reconciles rows with the approved modes

`attachKbToChatbot` provisions the required `doc_query` rows for `tutor` and
`explainer` only, and reconciles the chatbot's other KB rows against the
approved mode set. The eligible exact custom keys come from the normalized
approved live `customModeConfig` — never the legacy `systemPrompts` map and
never a pending revision. Enabled rows for the KB server whose mode is outside
`tutor`, `explainer`, an approved custom mode, and `quizzer` are disabled in
the same transaction; `quizzer` rows are never disabled and never created.

The `quizzer` handling is load-bearing in both directions. Attachment never
creates a `quizzer` row, and the Quizzer binding stays inherited from the `tutor`
row under ADR 0021. `resolveEffectiveMCPConfigurations` builds its
`exactByServer` map from every `quizzer` row regardless of `isEnabled`, and
presence in that map suppresses Tutor inheritance
(`effectiveChatModes.ts:118-150`). An existing disabled exact `quizzer` row is
therefore an intentional override and stays untouched: disabling or deleting it
would expose Quizzer through inheritance. An existing enabled exact `quizzer`
binding is reconciled to the new KB, because leaving it on
the previous KB would make `assertOneScope` reject every request for every mode.

Approved custom modes do not store a per-mode row. They inherit the required
Tutor or Explainer `doc_query` binding at request time, retagged to the selected
mode key, so a custom mode approved after the attachment is grounded without
another attachment and no re-attachment is needed. The stored standard rows stay
independent of a mode's current `enabled` flag: the upsert still (re)enables the
Tutor and Explainer rows, because availability is resolved per request and a
later re-enable must still find its grounding. The upsert and the reconciliation
stay idempotent, so removing a custom mode key cannot leave a stale binding
behind.

The derivation and the resolver must agree on what a standard mode key is. A
shared standard-mode key list lives in the existing
`packages/util/src/chatbotStandardModeConfig.ts` and is consumed by both
`knowledge.ts` and `effectiveChatModes.ts`. The drift assertion — that the
shared list equals the chat runtime's prompt registry keys — lives in the
`apps/chat` test suite, because the runtime registry (`DEFAULT_PROMPT` in
`apps/chat/src/lib/config/prompts`) is not importable from the utility package;
util tests cover key derivation, including blank keys and exact custom-key
casing.

### Decision 3 — The lecturer MCP surface is retired and the public field is deprecated

The "Technische Integrationen" accordion in `ChatbotDetails.tsx` (the only
lecturer-visible MCP surface) and the MCP i18n keys are removed. The existing
knowledge view already presents the bound "Wissensbasis" and links to KB
management, so no replacement panel is added.

The read projection leaves every consumer: `mcpConfigurations` selections are
dropped from the four chatbot ops, and the service stops loading the rows, so
the field resolves to an empty list. The public `Chatbot.mcpConfigurations`
field stays in the schema with a `deprecationReason`, following the
`enabledKnowledgeBase` precedent (`packages/graphql/src/schema/resource.ts:587`).
Its `ChatbotMcpConfigurationSummary` object type is retained unchanged, because
the deprecated field still references it and GraphQL deprecation applies to
fields and enum values, not object types.

Rejected alternative: remove the field and its type outright. Both hardening
reviewers flagged it as a breaking public-schema change: an already-loaded
manage bundle or any external caller that still selects the field fails query
validation until it reloads or updates, and removal buys nothing
product-visible once no in-repo consumer remains. Deprecation keeps the API
compatible while lecturers see only "Wissensbasis"; removal can follow in a
later release once the deprecated field is confirmed unused. The tracked SDL
snapshot is regenerated either way.

### Decision 4 — Selected-mode scope resolution tolerates an unbound mode

`resolveMcpScope` returns "no KB scope" when the selected mode has no enabled KB
configuration, instead of raising a scope violation. This is required for
Decision 1 to be coherent: an offered mode without a KB binding must serve
without retrieval. The isolation guarantees stay: the one-server/one-scope
checks over the chatbot's enabled KB configurations remain, a selected mode
that does have a KB configuration must still match the resolved scope exactly,
and an unbound mode produces no scope token and no KB server, so no retrieval
is reachable from it.

### Ownership and sequence

Boundary owner: self. The main session owns the runtime contract, the attach
flow, and integration; source edits stay in the task worktree. Review roles are
read-only and separate.

| Workstream | Slices | Owner | Dependency | Acceptance boundary |
| --- | --- | --- | --- | --- |
| Runtime mode and scope | 1 | main | none | `@klicker-uzh/chat` tests green on the slice commit |
| KB attach flow | 2 | main | Decision 2 contract; Decision 1 not required for the slice tests | `@klicker-uzh/graphql`, `@klicker-uzh/util`, and `@klicker-uzh/chat` tests green |
| Lecturer surface and API retirement | 3 | main | slice 1 for the browser evidence | graphql codegen clean, `check:all` green, browser captures |
| Documentation and ADR | 4 | main | slices 1-3 | docs consistent with the shipped contract |

Route: `main` for every slice. Execution-tier skip reason: overhead greater
than work and a single-writer seam across three coupled layers; subagent
workspaces provide no diff-return channel to this worktree. The required
planner pass and the review gates are still dispatched per `$rs-model-routing`.

### Slices

#### Slice 1 — `fix(chat): scope required retrieval to each chat mode`

Files: `apps/chat/src/lib/server/effectiveChatModes.ts`,
`apps/chat/src/services/mcpScope.ts`, `apps/chat/test/effective-chat-modes.test.ts`,
`apps/chat/test/required-mcp-route.test.ts`,
`apps/chat/test/mcp-clients-scope-token.test.ts`.

Acceptance: the resolver offers an unbound mode while another mode holds a
required binding; a custom-mode-only chatbot with an attached KB keeps its
custom mode in `modeOptions`; a mode whose required binding is unavailable still
fails closed; scope resolution returns no scope for an unbound selected mode and
still rejects a mismatched one. Replacements: `effective-chat-modes.test.ts`
"hides modes that cannot satisfy the chatbot required-tool policy" is replaced
by the per-mode availability cases; `required-mcp-route.test.ts:448` "hides a
mode without its required MCP binding" is replaced by a case asserting the
legacy custom-only request is accepted, so an unbound mode serves while a mode
that declares an unavailable required binding still fails closed; the
`mcp-clients-scope-token.test.ts` "the selected mode is not bound" fail-closed
case is replaced by a case asserting no scope token and no KB server target for
an unbound mode. The route test mocks MCP discovery, so it cannot itself prove
token or discovery isolation; that obligation stays at the MCP-client seam.
Check: `pnpm --filter @klicker-uzh/chat test`.

#### Slice 2 — `enhance(graphql): reconcile knowledge-base retrieval rows with the declared chat modes`

**October 12, 2026 — superseded provisioning:** the reconciled contract
provisions Tutor and Explainer only and derives eligible custom keys from the
approved `customModeConfig`; approved custom modes inherit the standard
binding. The acceptance below records the September implementation.

Files: `packages/util/src/chatbotStandardModeConfig.ts`,
`packages/util/test/chatbotStandardModeConfig.test.ts`,
`packages/graphql/src/services/knowledge.ts`,
`packages/graphql/test/knowledge.test.ts`,
`apps/chat/src/lib/server/effectiveChatModes.ts`,
`apps/chat/test/effective-chat-modes.test.ts`.

Acceptance: attaching to a chatbot with custom mode keys upserts one required
`doc_query` row per declared key — the two standard rows plus every non-blank
non-standard `systemPrompts` key — and disables enabled KB rows whose mode key
is outside that set; a chatbot with no custom modes keeps exactly the two
standard rows; a mode's `enabled` flag and a legacy NULL `standardModeConfig`
do not change which rows are provisioned; re-attaching is idempotent and repairs
pre-change rows; a removed custom mode followed by a re-attach leaves no stale
binding, so every remaining enabled binding resolves to the new KB; and an exact
`quizzer` row keeps its enabled state, with an enabled one reconciled to the new
KB so Quizzer and Tutor both resolve the replacement scope while a disabled one
keeps suppressing Tutor inheritance; nothing is created for `quizzer`. The
chat package test asserts the shared standard-mode key list equals the runtime
prompt registry keys. Check: `pnpm --filter @klicker-uzh/graphql test`,
`pnpm --filter @klicker-uzh/util test`, and
`pnpm --filter @klicker-uzh/chat test`.

#### Slice 3 — `enhance(manage): show knowledge bases without the MCP integration panel`

Files: `apps/frontend-manage/src/components/resources/chatbots/ChatbotDetails.tsx`,
`packages/i18n/messages/de.ts`, `packages/i18n/messages/en.ts`,
`packages/graphql/src/schema/resource.ts`,
`packages/graphql/src/services/chatbots.ts`, the four chatbot ops under
`packages/graphql/src/graphql/ops/`,
`packages/graphql/test/chatbotKnowledgeBaseReaders.test.ts`, and the
regenerated `packages/graphql/src/public/schema.graphql`. Dropping the
`mcpConfigurations` selection makes the generated query result no longer
satisfy the full `Chatbot` entity, so the list and workspace helpers take
declared subsets instead: `Chatbots.tsx`, `ChatbotItem.tsx` (new exported
`ChatbotListItem`), `ChatbotList.tsx`, and `chatbotWorkspace.ts` (new
`ChatbotWorkspaceFacts`).

Acceptance: the chat-usage view renders no technical-integrations panel and no
MCP wording; the knowledge view still lists the bound knowledge base;
`Chatbot.mcpConfigurations` is marked deprecated and resolves to an empty list
without loading rows; codegen and `pnpm run check:all` are clean; real browser
captures (`$rs-build-screenshot-gallery`) cover the usage and knowledge views in
`de` and `en`.

#### Slice 4 — `docs(chat): record per-mode retrieval scope and KB attachment`

Files: `docs/chat-platform.md`, `docs/domain-model.md`, `CONTEXT.md`,
`docs/adr/0021-templated-standard-modes-reviewed-custom-modes.md`, and the new
`docs/adr/0050-per-mode-retrieval-scope-and-kb-attachment.md`.

Acceptance: the mode seam and the KB attachment contract match the shipped
behaviour; the new ADR records the policy delta, the row reconciliation, and the
deprecation, and references ADR 0021; ADR 0021 carries a status pointer instead
of a silent divergence.

### Delegation Map

| Slice | Workstream | Owner | Route | Acceptance |
| --- | --- | --- | --- | --- |
| 1 | Runtime mode and scope | main | main | `@klicker-uzh/chat` tests |
| 2 | KB attach flow | main | main | `@klicker-uzh/graphql`, `@klicker-uzh/util`, `@klicker-uzh/chat` tests |
| 3 | Lecturer surface and API retirement | main | main | codegen + `check:all` + browser captures |
| 4 | Documentation and ADR | main | main | docs consistent with shipped contract |

Required gates: one read-only planner pass before presentation; `simplifier` on
each substantive slice; `slice-reviewer` on each slice that crosses the runtime
semantics, data-write, or public-contract boundary; one integrated
`final-reviewer` pass at the finish gate.

### Verification

Runtime and attach behaviour is verified by focused `vitest` runs in the touched
packages, using the deterministic resolver seams rather than a live bot. The
manage UI change requires real browser verification: the devcontainer stack
(`devrouter ensure`) with delegated lecturer login, capturing the chat-usage and
knowledge views before and after, in `de` and `en`, with interaction checks that
the knowledge view still shows and links the bound KB.

Not verified in this package: participant retrieval quality and the ethics
bot's KB contents. A live PRD re-check is a post-deployment action and stays
separately gated, as does re-attaching the ethics bot's KB.

### Working context

Worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/chatbot-kb-custom-mode-binding`,
branch `fix/chatbot-kb-custom-mode-binding`, tracking `origin/v3-ai` and
originally based on `5eaf18ccbe`; it was rebased onto `171c3e96cb`, and
`origin/v3-ai` now points at `d48bd2a08ed53ca0b4dd810be9f83d69b4884899` (the
October 12 reconciliation target). Target branch: `v3-ai`. The KB feature (`services/knowledge.ts`,
`packages/kb-management`, `attachKbToChatbot`) exists only on `v3-ai`, not on
`v3`, so a `v3`-based branch could not contain this fix.

The worktree has no `node_modules` and the sandbox cannot run `devrouter`; the
focused `vitest` runs and the browser capture both execute in the devcontainer
(`devrouter ensure`) driven from a host shell. Stop conditions are separate. If
the container itself is unavailable, every test-dependent acceptance stays
blocked and no slice closes. If only the delegated lecturer login is
unavailable, slices 1, 2, and 4 still complete on their focused test runs,
while slice 3's browser acceptance and the plan's screenshot evidence stay
explicitly incomplete rather than being replaced by static checks.

### ADR gate

The package changes the policy stated in ADR 0021 ("the server may hide any mode
that cannot satisfy the chatbot's required-MCP policy") and deprecates a public
GraphQL field: hard to reverse at the API boundary, surprising without context,
and a real availability-versus-grounding trade-off. A new ADR records the
per-mode retrieval policy, the row reconciliation, and the deprecation of the
MCP read projection, and ADR 0021 gains a status pointer to it. Rationale is not
restated in the plan.

Re-arm trigger: any later step that reintroduces a chatbot-wide retrieval
requirement, removes the deprecated `mcpConfigurations` field, or restores its
populated projection, changes this decision and needs its own ADR update.

### Primitive impact

| Product primitive | Disposition | Contract delta | Affected compositions and consumers | Evidence or open ruling |
| --- | --- | --- | --- | --- |
| Effective mode set | extend | A mode's availability no longer depends on another mode's required binding; an unbound mode is offered | Chat bootstrap API, participant layout, owner preview, request validation | Handoff incident reproduction; slice 1 tests |
| Knowledge-base binding ("Wissensbasis") | extend | Attachment provisions only the Tutor and Explainer rows and derives eligible custom keys from the approved `customModeConfig`; approved custom modes inherit the standard binding, disabled exact overrides stay untouched, and "Wissensbasis" stays the only lecturer-visible retrieval concept | KB attach/detach mutations, KB management bindings page, chatbot knowledge view | Slice 2 tests; live PRD incident; October 12 reconciliation |
| Standard-mode configuration | reuse | None | Unchanged | ADR 0021 invariant preserved |
| MCP configuration (internal) | retire (lecturer projection and op selections only) | Runtime policy and stored rows keep working; the public read field is deprecated and resolves empty | Manage chat-usage view, four chatbot ops, public SDL | Slices 1-3 tests and codegen |

### Test portfolio

The attachment rows below record the September implementation; the October 12
reconciliation above states the current contract.

| Risk or behaviour | Obligation | Primary seam | Existing protection | Distinct failure | Owning slice |
| --- | --- | --- | --- | --- | --- |
| A required binding on one mode no longer hides unrelated modes | replace/consolidate | `resolveEffectiveChatModeOptions` unit | `effective-chat-modes.test.ts` "hides modes that cannot satisfy the chatbot required-tool policy" asserts the defect | an unbound mode missing from `modeOptions` | 1 |
| An unbound offered mode is accepted at request time | replace/consolidate | required-MCP route test | `required-mcp-route.test.ts:448` asserts the removed suppression | the legacy custom-only request rejected with "Unsupported chat mode" | 1 |
| A custom-mode-only bot with an attached KB keeps its custom mode | add new | resolver plus chat route | none | zero `modeOptions`, the live incident | 1 |
| Fail-closed behaviour for a mode whose required binding is unavailable | extend existing | required-MCP route test | present | silent ungrounded answer where retrieval was required | 1 |
| Scope resolution for an unbound selected mode | replace/consolidate | `resolveMcpScope` unit | `mcp-clients-scope-token.test.ts` "the selected mode is not bound" asserts the removed violation | 503 on a mode that has no KB | 1 |
| No scope token or KB server target for an unbound mode | add new | MCP-client scope-token test | bound-mode cases exist; the route test mocks discovery | retrieval reachable from an unbound mode | 1 |
| Attachment binds every declared mode key | extend existing | `attachKbToChatbot` integration test | asserts only tutor and explainer | custom mode attached but without retrieval | 2 |
| Attachment reconciles obsolete rows | add new | `attachKbToChatbot` integration test | none | stale `kb_id` trips `assertOneScope` for every mode | 2 |
| Attachment leaves a disabled exact `quizzer` override in place | add new | `attachKbToChatbot` integration test | none | removing the suppression exposes Quizzer through Tutor inheritance | 2 |
| Attachment reconciles an enabled exact `quizzer` binding to the new KB | add new | `attachKbToChatbot` integration test plus `resolveMcpScope` | none | the stale KB keeps `assertOneScope` rejecting every mode | 2 |
| Shared standard-mode key contract | add new | `apps/chat/test` registry assertion | none | attach and resolver disagree on standard keys | 2 |
| Deprecated `mcpConfigurations` resolves empty | no new test | schema and service seam | none | a deprecated field still loads MCP rows | 3 |
| MCP surface absent from lecturer UI | replace/consolidate | browser capture plus existing knowledge-view selector | none | MCP copy still rendered | 3 |

### Research

No external research is required. Every seam is in-repository, and the runtime
contract is fixed by ADR 0021, `docs/chat-platform.md`, and the existing test
suite.

### Skill routing

`$rs-sliced-development-workflow` owns packaging and slices; `$rs-model-routing`
owns role dispatch; `$rs-build-screenshot-gallery` produces the manage UI
captures; `$rs-mr-description-writer` writes the pull-request body with the
screenshot table.

## Progress

### October 12 reconciliation (current contract)

Approved on 2026-10-12. It supersedes the per-declared-key provisioning design
recorded further below, and every statement that a newly added custom mode stays
ungrounded until a re-attachment. Decision 1 and Decision 2 are updated in
place; the Slice 2 acceptance and the attachment rows of the test portfolio
remain as the September implementation record, and the status records further
below date from the September 2026 package work through the finish-gate
documentation at `d380bcc680`.

Scope: reconcile the KB attachment contract, the approved-mode visibility, and
the documentation set (`docs/adr/0050-per-mode-retrieval-scope-and-kb-attachment.md`,
`docs/adr/0021-templated-standard-modes-reviewed-custom-modes.md`,
`docs/chat-platform.md`, `docs/domain-model.md`, `CONTEXT.md`, and this plan).
Owner: main owns the source, tests, integration, review, commits, and push; the
documentation reconciliation lives in this worktree. Current target:
`d48bd2a08ed53ca0b4dd810be9f83d69b4884899` (`origin/v3-ai` head at
reconciliation time). The current integration uses a normal merge; the
September baseline was rebased onto `171c3e96cb`.

Current contract:

- Participants see only the approved live `customModeConfig`; the owner preview
  may additionally offer saved draft modes.
- Availability stays per mode. A selected mode with no enabled `KB`
  configuration yields no scope, no scope token, and no KB server target, and a
  mode whose declared required binding is unavailable still fails closed.
  Quizzer keeps its capability gate, and a disabled exact Quizzer row still
  suppresses Tutor inheritance.
- Approved custom modes inherit the required Tutor or Explainer `doc_query`
  binding, retagged to the selected mode key.
- `attachKbToChatbot` provisions only the Tutor and Explainer rows. It
  derives the eligible exact custom binding keys from the normalized approved
  live `customModeConfig` — never from legacy `systemPrompts` or a pending
  revision — disables stale enabled `KB` rows outside Tutor, Explainer,
  approved custom modes, and Quizzer, and repoints already-enabled exact custom
  and Quizzer rows to the replacement KB. It creates no custom or Quizzer rows
  and never re-enables a disabled exact override. A custom mode approved after
  the attachment inherits automatically, so no re-attachment is needed.
- The lecturer MCP surface stays retired, and the deprecated
  `Chatbot.mcpConfigurations` field resolves to an empty list.

Acceptance: the documentation matches the shipped source contract under static
consistency review in this worktree; the source behavior is verified by main
through the package tests recorded here.

Approved actions: the reconciled source, test, and documentation edits in this
worktree; the configured reviews; local commits; and a non-force push to the
task branch, all owned by main. Merge, deployment, marking the PR ready, PRD
writes, and publishing the ethics bot's draft revision remain withheld.

Verification reported by main on 2026-10-12: `@klicker-uzh/util` 9 focused
cases; `@klicker-uzh/chat` 146 cases (one stale prose assertion updated to
machine mode keys); `@klicker-uzh/graphql` `knowledge.test.ts` 71 cases and the
approval, revisions, and manage suites 111 cases (a disabled-scope fixture
corrected). Monorepo type/schema checks passed (42 tasks), and focused Opengrep on the
four changed retrieval source files found no issues. Five refreshed browser
captures cover EN/DE Usage and Knowledge plus compact DE Knowledge; the
bound KB link navigates successfully. At 390px the existing header and tab
strip overflow horizontally; the Knowledge controls fit. This UI limitation
remains outside the retrieval reconciliation.

Status: reconciliation committed and pushed normally as `738d9ab2aa`; the draft
[PR #6247](https://github.com/uzh-bf/klicker-uzh/pull/6247) is mergeable. Mandatory
hooks, the 27-task full build, and the 337 focused cases passed. The slice
review and final integrated review found no defects. The simplifier's optional
single-caller helper reduction was deferred: the existing pure helper protects
approved-key normalization without adding application structure. Reports in `project/_local/reviews/`:
`2026-10-12-kb-reconciliation-simplifier.md`,
`2026-10-12-kb-reconciliation-slice-review.md`, and
`2026-10-12-kb-reconciliation-final-result.json`.

Hosted type, unit, GraphQL, translation, security, and the full Playwright
run passed on that source head. The follow-up head's CI and the repository's
final AI review remain pending.
Forge feedback's new test import uses the configured alias in this follow-up;
its application source is unchanged, so the recorded browser, behavior, and
independent-review evidence remains applicable. The two optional OCR
maintainability suggestions are deferred: the binding payload has only local
transaction callers, and relocating the standard-mode list would expand the
normalizer/module scope without correcting observed behavior.

Next action: finish exact-head CI and the final AI review, verify runtime
shutdown, and refresh the draft description. Merge, deployment, marking ready,
PRD writes, and ethics-bot draft publication remain gated.
Packaging: one cohesive repair of the existing retrieval/lecturer surface
contract; the previously approved single-PR topology is retained.

### Planning-stage review

One read-only planner pass ran the hardening loop (cap 3 rounds) plus one armed
cross-provider rival pass. Rounds 1-3 returned REVISE with 12 findings total;
every finding was verified against the repository and accepted, and none was
rejected. The cap was reached on round 3 with two residual findings accepted but
unverified by a fourth round — recorded as review_deadlock. Details and
dispositions: `project/_local/reviews/2026-09-21-chatbot-kb-custom-mode-binding-plan-hardening.md`.

Residual findings at the cap: (1) an existing enabled exact `quizzer` binding
must be reconciled to the new KB or `assertOneScope` rejects every mode, while a
disabled one stays untouched; (2) the `quizzer` portfolio row must state the two
directions separately. Both are applied in Decision 2, Slice 2, and the test
portfolio.


- Status: implemented, at the finish gate. Active slice: none.
- Completed slices: 1 runtime, 2 KB attach, 3 lecturer surface, 4 docs/ADR.
- Remaining slices: none.
- Latest verified commit: `c0d53549e6` on `fix/chatbot-kb-custom-mode-binding`,
  six commits ahead of `origin/v3-ai` (`171c3e96cb`). Commits: `df59394769`
  plan, `4d5c440fa4` slice 1, `78f45999c6` slice 2, `ac3e43aa65` slice 3,
  `4193cb4259` slice 4, `c0d53549e6` progress.
- Base repair: the branch began on `2c1533f5d2`, whose `KnowledgeGraphPanel.tsx`
  passed `publishedBuildId` into a `string | null` prop because the introducing
  commit's CI run was cancelled, so `check:all` failed and no commit could land.
  A local `?? null` repair unblocked the slices; upstream then landed the
  equivalent fix as #6246 (`171c3e96cb`), which the final rebase onto
  `origin/v3-ai` adopted, dropping the local duplicate. The branch carries no
  base-repair commit of its own.
- Verification evidence: `@klicker-uzh/util` 10 focused cases; `@klicker-uzh/graphql`
  `knowledge.test.ts` 71 and `chatbotKnowledgeBaseReaders.test.ts` 3; `@klicker-uzh/chat`
  `effective-chat-modes`, `required-mcp-route`, `mcp-clients-scope-token` 65 cases.
  Slice 3 browser evidence: seven captures in
  `project/_local/screenshots/chatbot-kb-custom-mode-binding/` (before/after usage
  in `en`/`de`, knowledge in `en`/`de`, compact) with interaction checks; the
  bound-KB link navigates to `/resources/knowledgeBases/<id>`.
- Required gates: planner pass (rounds 1-3 REVISE, 12 findings accepted, cap
  reached with two applied residual findings), simplifier and slice review per
  slice, integrated final review at the finish. Slice 1+2 slice review
  (`f166bd6bee`, pre-rebase SHA) returned one test-contract finding
  (the unbound-mode test asserted a 503 rather than proceeding past discovery),
  applied as a fixup; the rebased slice 1 is `4d5c440fa4`. Slice 3 slice review
  returned no findings; simplifier none.
- Integrated final review on the then-head `c07eab6317` returned
  `status: findings` with five low-severity items, all verified and applied:
  a dead `Chatbot` type import in `ChatbotList.tsx`; a rejected ADR option that
  read as the accepted decision; the four narrowed manage files missing from the
  slice-3 file list; a promised-but-absent deprecated-field test (portfolio row
  corrected to `no new test`, since the field is a one-line `?? []` with no
  remaining producer); and two util assertions that restated the constants'
  literals. The reviewer confirmed both product requirements, the isolation path,
  and the security-relevant invariants.
- Final review refreshed on the exact pushed head `c0d53549e6` after the base
  advanced to `171c3e96cb`: `status: pass`, no findings. The configured Claude
  CLI route failed terminally (`api_error` 429, session limit), so the review ran
  through the `$rs-model-routing` continuity ladder on AGY Gemini 3.8 Flash high
  with the complete final-review contract; the returned JSON validates against
  `~/.agents/schemas/cross-provider-review.schema.json`. AGY provenance is
  recorded because it is substitution evidence, not the configured route.
- Delivery layer: branch pushed; `origin/fix/chatbot-kb-custom-mode-binding` is at
  `c0d53549e6`. Draft PR
  [#6247](https://github.com/uzh-bf/klicker-uzh/pull/6247) against `v3-ai`, with
  the seven captures attached and rendered inline (receipt:
  `project/_local/screenshots/chatbot-kb-custom-mode-binding/uploads.json`).
- Environment note: the devcontainer database was migrated but unseeded, so the
  delegated lecturer login failed until `pnpm --filter @klicker-uzh/prisma run
  prisma:seed:raw` loaded the disposable dev seed.
- Next action: none inside this package; it is complete at the draft-PR boundary.
  Merge, deployment, marking ready, PRD writes, and publishing the ethics bot
  draft revision remain withheld.
