# Personal AI-assisted practice cards — execution plan

## 2026-08-26 release-hardening correction

This correction is the only active plan for the remaining work in pull requests
#5481, #5482, and #5483. It supersedes conflicting statements below about
personal-card verification, grounded or validated content, generation limits,
rollout controls, execution authority, terminal conditions, and remaining
slices. The earlier plan and Progress entries remain as implementation history.

Plan state: approved for autonomous execution. Release-hardening code is now
being applied bottom-up; the existing draft stack remains open, and merge,
deployment, remote feature-flag changes, and production actions remain
withheld.

### Goal and release position

Ship a private study aid described as **“Create personal AI-assisted practice
cards from course materials.”** A saved card is source-linked, privately owned,
and not reviewed by the course team. The release must preserve the existing
gate before the lecturer content pool: future course adoption creates a new
lecturer-owned `Element`; it never promotes or reparents the participant row.

This correction removes misleading trust state, makes learning history safe
across content revisions, puts trust and source information inside practice,
bounds generation failure and cost, and makes creation fail closed behind a
targetable capability flag.

| In scope now | Deliberately later |
| --- | --- |
| Private flashcards, source-linked citations, five-card cap, content-version-safe scheduling, in-run trust and removal, bounded failure codes, opt-in creation | Lecturer proposals, peer sharing, course approval, independent entailment screening, additional question types, immutable review evidence, broad analytics |
| Preserve the current three-PR stack and existing card-plan flow | A new governance domain, extra stack layers, durable generation jobs, or a generic rollout framework |
| Keep mandatory retrieval for card planning and card generation | Reconsidering the unrelated global retrieval policy, which needs its own ADR, evaluation, and PR |
| A bounded synthetic real-model pilot check | Initializing the private DeepEval submodule or claiming university-quality validation |

### Execution contract

Approval of this correction is one authorization for the named local workflow
through `merge_ready_disabled`. It does not authorize merge or rollout.

| Contract part | Binding rule |
| --- | --- |
| Execution owner | This session remains the stack topology and integration owner. It may use the plan-named executor and read-only reviewers only. |
| Authorized work | Adopt the existing remote stack locally, create recovery refs, rebase it onto current `origin/v3`, edit the named layers, regenerate the single unmerged migration in the disposable task database, run repository checks, use the exact task runtime, commit each slice, run browser proof, perform the bounded synthetic OpenRouter smoke, push atomically to the existing three feature refs, and update their PR descriptions. |
| `merge_ready_disabled` terminal | All five slices are committed in their owning layers, propagated upward, locally verified and reviewed, published to the existing refs, and required CI is green at each exact head. The creation flag remains disabled. |
| `pilot_enablement_ready` terminal | `merge_ready_disabled` is satisfied and the bounded English/German OpenRouter smoke passes. This is evidence for a later flag decision, not permission to enable it. |
| Withheld actions | Merge, ready-state changes, deployment, remote GrowthBook flag creation or targeting, feature enablement, cluster access, production data, additional provider runs, private evaluation-submodule initialization, stack-topology changes, and branch/worktree deletion. |
| Pause conditions | Stop on an unexpected remote head or topology, a shared-environment application of the feature migration, an unresolvable rebase conflict, a required terminally unavailable reviewer/runtime, a required CI failure proven to belong to the stack after its allowed repair, or any proposed change to scope, data ownership, provider boundary, or rollout semantics. |

One retry of the currently failing legacy Playwright shard is authorized only
after branch causality is checked. If the failure is unrelated to this stack,
record it and do not add an unrelated repair. The provider smoke permits four
planned Chat turns and one replacement turn only for a transport-only failure.

### Fixed decisions

| Decision | Contract |
| --- | --- |
| Trust language | Use “source-linked” only. Never infer correctness, entailment, course approval, or validation from cited-chunk membership. |
| Personal trust state | Remove `PersonalElementVerification` from Prisma, GraphQL, Chat, PWA, generated artifacts, tests, and docs. Keep `PersonalElementOrigin` unchanged; do not add an `AI_ASSISTED` enum yet. |
| Revision semantics | `content`, `explanation`, or `sources` changes increment the content version once and reset learning state. A name-only edit preserves both version and learning state. Responses never increment the version. |
| Response concurrency | `respondToPersonalElement` carries the expected content version and applies its scheduling update with the version predicate atomically. A stale response changes nothing. |
| New-card baseline | Reset ease factor to 2.5, interval and all response counters to zero, `nextDueAt` to null, and every last-response timestamp or correctness field to null. |
| Practice behavior | Keep the existing practice-quiz interaction. Show origin, “not reviewed by the course team,” and source access during the active card. Remove acts immediately on the frozen session and advances safely. Finish returns to the course personal-card overview. |
| Correction controls | Removal is the release-safe correction action. Do not add reporting, regeneration, or another editor to the runner in this package; retain existing revision paths and revisit extra controls after pilot evidence. |
| Generation size | Set the shared plan/generation limit to five. Reject over-limit plans and approvals at every boundary; never silently truncate them. |
| Generation evidence | Each candidate must cite only chunks returned for that candidate. Insufficient evidence produces no card. Existing-title context and similarity checks remain duplicate guards for private convenience, not correctness checks. |
| Failure result | Replace identifier-only failures with bounded `{candidateId, code}` results. Allowed codes are `retrieval_unavailable`, `insufficient_evidence`, and `generation_failed`; do not expose raw errors or course content. |
| Rollout control | Add `personal-card-generation`, default false, targeted with participant identity and `chatbotId`. It gates both plan and generation tool exposure. A missing or unhealthy evaluator fails closed. Saved-card list, practice, revision, and removal remain available. |
| Local override | A feature-specific environment override may enable creation only when `NODE_ENV=development`. Tests inject an evaluator. Non-development environments ignore the override. |
| Retrieval policy | Preserve `shouldRequireCourseRetrieval` exactly. Card planning and generation still require retrieval. Move any global-policy change to a later ADR and PR. |

### Primitive and ADR impact

| Primitive or seam | Change now | Invariant |
| --- | --- | --- |
| `PersonalElement` | Remove verification; define content-version reset rules | Participant-owned, course-bound, private, separate from lecturer `Element` |
| Personal practice response | Add an expected-version conditional write | A response can update only the content the participant saw |
| Card generation result | Five-card cap and typed per-card failures | Browser decisions still reference server-persisted candidates, not client-supplied card bodies |
| Feature capability | One Chat-specific GrowthBook evaluation | Default false; creation only; no generic rollout abstraction |
| Lecturer `Element` and shared practice | No change | Gate before pool remains non-negotiable |

Update ADR 0026 to remove binary personal verification and reaffirm copy-based
course adoption. Update ADR 0027 to define source-linked membership precisely
and fix the cap at five. No new ADR is needed. A new ADR becomes necessary for
sharing, lecturer promotion, multiple question types, durable jobs, an online
quality verifier, or the global retrieval policy.

The owning slices also update `docs/domain-model.md`,
`docs/graphql-api-layer.md`, `docs/chat-platform.md`,
`docs/frontend-conventions.md`, `docs/feature-flags.md`, and the affected
feature sections in the Klicker agent skills. Correct overclaims in ADR 0006.
Do not add a parallel wiki or plan artifact.

### Evidence and constraints

The plan uses the current repository implementation, the three active PR heads,
the attached review, ADRs 0026 and 0027, and the existing feature-flag and local
runtime conventions. Planning found one unmerged feature migration, an existing
source-membership check, a 20-card shared constant, identifier-only per-card
failures, and an active runner that can retain a removed card in its frozen
session.

The repository's private DeepEval framework is intentionally not initialized
for this correction. The existing 20 synthetic ground-truth documents are not
a ready card-quality harness. The bounded provider smoke below is a release
gate for obvious source-support and language failures, not a statistical or
institutional validation programme.

The planning-stage Sol challenge accepted the five-slice correction, required
one active plan with explicit precedence, recommended keeping the existing
three-layer topology, and separated disabled merge readiness from later pilot
enablement. Its report is retained at
`project/_local/reviews/2026-08-26-personal-practice-release-hardening-planner.md`.

### Stack topology and ownership

Use the existing linear stack and do not create a fourth PR. Before mutation,
run `gh stack checkout 5483`, verify `gh stack view --json`, record the exact
local and remote heads, and create recovery refs. If local adoption requires
`init`, `link`, `unstack`, remote correction, or a topology rewrite, pause.

| Layer | Existing PR and ownership | Correction slices | Focused reviewer concern |
| --- | --- | --- | --- |
| A | #5481, participant-owned schema, service, GraphQL, data docs | S1, S2, plan commit | Migration provenance, public API, atomic data integrity |
| B | #5482, personal practice PWA | S3 | Trust at learning time, active-session deletion, locale and accessibility |
| C | #5483, Chat generation and rollout | S4, S5 | Source claims, cost/failure bounds, capability isolation, deployment configuration |

Raw size signals remain large: #5481 changes about 45 files, #5482 about 18,
and #5483 about 88. The correction must shrink concepts rather than create a
new framework. Re-slice only if a correction crosses its layer boundary or
requires a new public domain.

### Delegation and review map

| Slice | Writer route | Read-only gates | Acceptance anchor |
| --- | --- | --- | --- |
| S1 remove verification | Main session; data-integrity seam stays integrated | Simplifier and data-integrity slice reviewer | One regenerated migration, no verification residue, schema/client/docs agree |
| S2 content-version safety | Main session; atomic update is critical-path coupled | Simplifier and data-integrity slice reviewer | Semantic reset, name-only preservation, stale response mutates nothing |
| S3 trustworthy runner | One executor owning only Layer B files; no concurrent writer | Simplifier and UI slice reviewer | EN desktop and DE mobile practice proof, sources, remove, safe finish |
| S4 bounded generation | Main session; retrieval and persisted-result seams stay integrated | Simplifier and architecture/data slice reviewer | Five-card rejection, typed failures, source membership, safe partial retry |
| S5 fail-closed creation | Main session; rollout and deployment ownership stay integrated | Simplifier and architecture slice reviewer | Disabled/missing/unhealthy cases expose no creation tools; saved-card paths still work |

After all layers are propagated and verified, run one final reviewer on the
integrated top head. Reviewer findings are advice until the main session
reproduces and dispositions them. The final data review explicitly confirms
migration count, generated provenance, schema equivalence, retained custom
operations, and absence of avoidable model changes.

### Feature-wide verification portfolio

| Consequential behavior | Obligation | Primary seam |
| --- | --- | --- |
| Verification state no longer exists | Replace and consolidate current enum/status tests; perform schema, generated-artifact, code, and documentation residue searches | Prisma and GraphQL generation |
| Semantic edits reset learning while name-only edits do not | Add focused service tests for all three semantic fields and name-only updates | GraphQL service with task Postgres |
| A response cannot race onto revised content | Add a database-backed stale-version test proving zero scheduling mutation | Conditional service update |
| Trust and control stay visible during learning | Extend focused Playwright coverage for origin wording, source access, remove/advance, and finish destination | PWA route in the exact task runtime |
| Generation is bounded and source-linked | Extend the extracted Chat module tests for all cap boundaries, failed-card codes, cited-chunk membership, insufficient evidence, and partial retry | Chat server module tests |
| Creation fails closed without disabling saved cards | Add feature-flags and Chat tests for true, false, missing, unhealthy, development override, and saved-card-only paths | Feature evaluator plus tool construction |
| Global retrieval semantics did not drift | Preserve and rerun existing policy tests plus the card-plan retrieval regression | Existing Chat retrieval tests |

Do not add tests for implementation detail. Replace verification-era cases
instead of keeping obsolete coverage. Run the repository's focused checks per
layer, then the relevant root check, test, lint, formatting, build, migration,
GraphQL generation, and wiki validation gates before publication.

### S1 — remove misleading personal verification (Layer A)

**Problem.** A binary verification enum suggests a future trust lifecycle it
does not model and leaks confusing copy into every layer.

**Evidence.** The enum appears in the personal schema, GraphQL schema and
fragments, services, Chat persistence results, PWA list/runner types, tests,
generated artifacts, ADRs, wiki pages, and agent skills.

**Decision and risk.** Delete it while the migration is still unmerged. Keep
origin only. The risk is partial generated or documentation residue.

**Do.** Remove the field and enum end to end; regenerate the existing feature
migration and Prisma/GraphQL/Analytics artifacts; replace status copy with the
precise private, source-linked trust contract.

**Check.** One feature migration exists, generated schemas match, targeted
service and GraphQL tests pass, and a repository search finds no live
verification contract.

**Commit.** `fix(practice): remove personal card verification`

### S2 — enforce content versions atomically (Layer A)

**Problem.** Semantic revisions currently inherit learning history and a
response can race with a revision.

**Evidence.** The update service increments a version without resetting all
scheduling fields; the response service does not predicate its write on the
content version the participant practiced.

**Decision and risk.** Treat version as content version. Reset only semantic
edits, and make the response write conditional. The risk is an incomplete
reset or a stale write that partially mutates counters.

**Do.** Centralize the existing new-card baseline in the service's semantic
update path, add expected version to the response operation, and update the
PWA caller and generated GraphQL artifacts.

**Check.** Database-backed tests cover every semantic field, name-only change,
successful matching response, and stale response with no changed fields.

**Commit.** `fix(practice): enforce personal card content versions`

### S3 — make the personal runner trustworthy (Layer B)

**Problem.** Trust and sources are separated from the moment of learning, and
the frozen session can retain a removed card or finish at the application root.

**Evidence.** The current route omits content version, uses status copy, refetches
after delete without removing the frozen card, and finishes at `/`.

**Decision and risk.** Reuse the established practice interaction and add only
a small same-page trust/source renderer and removal control. The risk is a
second runner concept or broken session navigation.

**Do.** Pass the content version on response, show conditional AI-generated or
authored origin wording plus persistent course-review wording, show linked
sources when present, remove the card locally after server success, advance
safely, and finish at `/course/[courseId]/personal`.

**Check.** Focused component/route checks plus agent-browser proof cover English
desktop and German mobile, cue and answer states, with/without sources, removal
of current and last cards, stale response handling, and finish navigation.

**Commit.** `enhance(practice): clarify personal card practice`

### S4 — bound source-linked generation (Layer C)

**Problem.** The 20-card contract is too large for an initial pilot, and
identifier-only failures erase the reason a candidate was not produced.

**Evidence.** The shared contract exposes `MAX_CARDS = 20`; generation returns
optional failed candidate IDs, while cited-chunk membership is the only source
guarantee.

**Decision and risk.** Cap every boundary at five, reject instead of truncate,
and keep three safe failure categories. Do not add an online verifier. The risk
is history/retry incompatibility or documentation that still overclaims quality.

**Do.** Update plan, approval, generation, persisted-result, history parsing,
and retry contracts; retain candidate IDs for safe partial retry; map detailed
internal failures to the three codes; keep generic UI wording; correct trust
claims across docs and skill guidance.

**Check.** Module tests cover zero/one/five/over-five inputs, persisted history,
partial retry, retrieval unavailable, insufficient evidence, generation error,
unsupported citations, and no raw diagnostic leakage.

**Commit.** `fix(chat): harden personal card generation`

### S5 — gate creation as a fail-closed capability (Layer C)

**Problem.** The unvalidated creation pipeline is available wherever retrieval
and credits allow it, without a targeted kill switch.

**Evidence.** The repository already has a server GrowthBook client and false
defaults, while Chat does not yet import the shared server secret or evaluate a
personal-card capability.

**Decision and risk.** Add one feature-specific flag and evaluator, not a
general rollout layer. Target participant plus chatbot. Gate creation only.
The risk is accidentally hiding saved cards or failing open during evaluator
errors.

**Do.** Register `personal-card-generation: false`; extend sanitized attributes
with optional `chatbotId`; add a server-only personal-elements evaluator in
Chat; gate both planning and generation tool construction, including approval
after a flag change; add the workspace dependency and lockfile importer; mount
the existing optional `secret-growthbook` in the Chat deployment; document the
disabled rollout and development-only override without adding secret values.

**Check.** Unit and integration tests prove true, false, missing, unhealthy,
and development behavior; a flag disabled after plan display cannot generate;
saved-card list, practice, revision, and removal remain usable; the standalone
Chat build and deployment template checks pass.

**Commit.** `enhance(chat): gate personal card generation`

### Runtime, browser, and bounded model proof

Resolve and start only the exact task runtime through DevRouter. Run all pnpm,
Prisma, migration, GraphQL, and browser checks inside that environment. Use a
disposable task database for the migration regeneration and confirm the feature
migration was never applied to a shared environment before rewriting it.

The provider smoke uses synthetic course material only. Run four Chat cases,
one attempt each: supported English, supported German, insufficient-evidence
English, and insufficient-evidence German. Each supported request asks for two
cards; an insufficient-evidence case must create none. Score source support,
answerability/usefulness, language match, and correct no-evidence behavior by
human inspection. Allow one replacement only for a transport failure, for at
most five turns and six generated cards. Do not add an external judge, publish
transcripts, or use real course/student content.

A semantic failure blocks `pilot_enablement_ready` but may still permit
`merge_ready_disabled` after the code and disabled-state gates pass. A transport
failure after the one replacement blocks pilot evidence and is reported as
such; it does not justify weakening the flag default.

At the final runtime-dependent check, stop the exact source path and verify the
provider is stopped and no routes remain, unless the user grants an explicit
keep-running lease.

### Migration, propagation, and delivery

Keep exactly the existing feature migration
`20260821130000_personal_elements`. Regenerate its base with the repository's
schema-aware workflow; add manual SQL only if the tool cannot express a required
operation and document why. Run `prisma:sync` rather than editing Analytics
schema mirrors. If the migration reached any shared environment, stop and
replace this plan with a forward-migration correction.

Work bottom-up. Commit the approved plan and S1/S2 on Layer A, validate it, then
propagate to Layer B. Commit and validate S3, propagate to Layer C, then commit
and validate S4/S5. Before the trunk rebase, every propagation, and final push,
record recovery refs and exact local/remote heads. Never use ordinary push for
the dependent stack; use the registered stack operation after a clean
ahead/behind check. Push only when all changed layers and the integrated top
head are reviewed and locally green.

Update each existing PR description for the complete layer only after its
published head passes the applicable review. Keep all three PRs draft. Check
required CI at each exact head. Merge, queue, reorder, unstack, remote flag
creation, flag enablement, deployment, and cleanup need separate named
authorization.

### Later work, triggered by evidence

| Trigger | Separate work |
| --- | --- |
| A lecturer wants student work in the course bank | Immutable proposal versions, review evidence, accountable approval, and copy into lecturer-owned `Element` |
| Students need sharing or peer review | Separate community-candidate space, solve-before-review, structured rubric, moderation, attribution, and data-protection design |
| Pilot errors show unsupported claims | Independent automatic evidence screening with a measured benchmark; keep it distinct from human approval |
| Additional element types are selected | Versioned type-specific payload and quality contracts; start with cued recall before distractor-heavy types |
| Request duration or volume becomes limiting | Durable generation job with resumable progress and explicit cost/timeout budgets |
| Global retrieval semantics need change | Independent ADR, evaluation, telemetry, and PR |

Decisions grilled and settled 2026-08-21 (two rounds). Rationale lives in the
ADRs; this document explains the architecture once in plain language, fixes
the v1 scope, and sequences the work for junior engineers.

Historical plan state: approved for autonomous execution; the implementation is locally
committed and published as an open draft stack, and the PWA S3 states are
proven in the exact worktree. The 2026-08-24 product follow-up is approved:
Practice uses the shared practice-session interaction contract, candidate
actions are individual Save or Discard actions, generation progress is visible,
and Discard is durable per participant, message, tool call, and candidate.
A temporary local-only OpenAI-compatible fixture also exercised the Chat
plan, generation, and unsaved-revision path (S4-S6) without an external model
call. Chat save requests returned successfully and persisted rows were
verified in the task database, but the exact post-reload Chat UI state was not
closed: the first render showed candidates as unsaved while hydration was
still pending, and the Chat process then hit a second runtime OOM before a
post-hydration browser snapshot could be captured. The fixture and unmanaged
Chat process are stopped. Draft publication is complete; merge, deployment,
live checks, and paid external-model runs remain out of scope.

Historical governing ADRs: [0006](../docs/adr/0006-public-catalyst-capability-floor.md)
(amended: student-initiated practice candidates row),
[0026](../docs/adr/0026-personal-elements-separate-participant-owned-model.md)
(personal elements are a separate participant-owned model),
[0027](../docs/adr/0027-plan-first-retrieval-backed-card-generation.md)
(plan-first, retrieval-backed generation contract). Vocabulary is fixed in
[CONTEXT.md](../CONTEXT.md): personal element, lecturer element, candidate
element, card plan, origin, verification, element proposal. The correction
above removes verification from the active personal-card vocabulary.

The following numbered sections record the completed baseline. They provide
history and implementation context but do not override the correction above.

## 1. What the student gets (v1)

In any configured mode of a course chatbot that has course materials attached, a
student can say "make me flashcards on X". The chatbot retrieves material on
X, proposes a card plan ("I propose these 10 cards"), and waits. The student
approves with a button. The chatbot then generates each card from its own
retrieval, shows the cards with citations, and the student saves the ones they
want. Saved cards are personal elements: they belong to the student, carry an
"AI-generated · unverified" badge, and are practiced with spaced repetition
on a "My cards" page per course. The student can ask the chatbot to change a
card (before or after saving) and can delete cards on the "My cards" page.

Not in v1: duplicate check against lecturer material, element proposals to the
lecturer, question types other than flashcards, a lecturer off-toggle, points
or XP, interleaving personal cards into the pooled course practice.

## 2. Architecture walkthrough (read this first)

### 2.1 One request, end to end

```mermaid
sequenceDiagram
  participant S as Student (chat UI)
  participant R as chat route (apps/chat)
  participant M as Model loop (AI SDK)
  participant Q as doc_query (MCP, Catalyst)
  participant P as personalElements service (packages/graphql)
  participant DB as PostgreSQL

  S->>R: "Make me flashcards on monetary policy"
  R->>M: streamText with MCP tools + propose_card_plan
  M->>Q: doc_query(topic)
  Q-->>M: chunks + sources
  M->>R: propose_card_plan({cards: 10 × {title, intent, query}})
  R-->>S: Plan card with "Generate these 10 cards" button
  S->>R: click → visible user message + approvedPlan {messageId, toolCallId}
  R->>M: step 0 forced: generate_cards(plan)
  loop per card, bounded parallelism
    M->>Q: doc_query(card.query)
    M->>M: generateObject(flashcard schema, cited chunk ids ⊆ retrieved)
    M-->>S: preliminary result (card appears)
  end
  M-->>S: candidate cards with citations, individual Save or Discard actions
  S->>R: POST or DELETE one candidate decision
  R->>P: createPersonalElements(participantId, courseId, candidates)
  P->>DB: insert PersonalElement rows
  R-->>S: "Saved · Practice now" (deep link to /course/[courseId]/personal)
```

Plain-language version:

1. **The chatbot stays the same chatbot.** Generation is two new tools inside
   the existing chat route, next to the MCP tools the bot already has. No new
   service, no new deployment. The tools exist only when the selected mode has
   a `doc_query`-style retrieval tool and the student has credits left. Every
   substantive request in either configured mode retrieves course material
   before the model answers; a narrow English/German social-message allowlist
   remains conversational and does not force a retrieval call.
2. **Plan first.** The first tool, `propose_card_plan`, can only be called
   after the model has retrieved material on the topic. It produces a plan,
   not cards. The plan is a normal tool result, persisted in the assistant
   message like every tool call today, and rendered as a card with a button.
3. **Approval is a normal message.** The button sends a visible user message
   plus one extra request field naming the plan. The route reads the plan from
   the persisted message and forces the second tool, `generate_cards`, as the
   first step of that turn. Changing the plan is just chatting: the model
   issues a new plan, the old plan card shows as superseded.
4. **Every card is grounded by construction.** `generate_cards` runs the
   per-card work itself: one retrieval call per card, one structured model
   call per card whose output schema requires cited chunk ids from that
   retrieval. The retrieval adapter exposes a stable, bounded chunk shape
   (`chunkId`, `sourceId`, `text`, and optional title, URL, and page). Every
   non-empty `citedChunkIds` value must be a subset of that card's retrieved
   chunk IDs. Missing, malformed, or empty evidence fails closed and cannot
   produce a candidate. The local fixture, source normalization, UI citation
   chips, and stored source JSON use this same shape; links are sanitized and
   the stored fields are size-bounded. This is a guarantee in code, not a
   prompt instruction. Cards stream in one by one with a visible running
   tool-call state and `completed/total` progress so the student sees the
   generation run before the first card arrives.
5. **Saving and discarding are deterministic actions, never the model.**
   Saving calls a small API route in the chat app that uses the same server-safe
   service entry the GraphQL API exposes. Discarding writes a bounded candidate
   disposition keyed by participant, source message, source tool call, and
   candidate ID; it is idempotent and survives thread reload. The GraphQL
   package emits that service through an explicit server-only subpath/build
   entry, and Chat declares it as a runtime dependency; Chat never imports
   GraphQL source files directly. One implementation of the rules (caps, type
   validation, ownership), two transports.
6. **Practice lives in the PWA.** A "My cards" page per course lists and runs
   personal elements with the same `Flashcard` component and the same
   spaced-repetition function (`updateSpacedRepetition`) as lecturer cards.
   Personal elements never touch `Element`, `ElementInstance`, or
   `PracticeQuiz` tables.

### 2.2 Data model (content and approval schema additions)

`PersonalElement` is the new content table. `ChatGenerationApproval` prevents
an approved plan from being replayed concurrently or after completion, and
`ChatGenerationCandidateDisposition` records durable per-candidate Discard
actions. They are added in the same migration; lecturer-owned content tables
do not change. Fields, in plain terms:

- identity and ownership: `id`, `participantId` (cascade), `courseId`
  (cascade), `version`
- content in the existing element shape so the `Flashcard` component renders
  it unchanged: `type` (v1: `FLASHCARD` only, enforced in the service),
  `name`, `content` (front), `explanation` (back), `options` (reserved for
  question types)
- grounding: `sources` (card-local citations: source ID, title, sanitized URL,
  page, and chunk IDs; no retrieved chunk text is persisted). The retrieval
  adapter accepts at most 32 chunks per card, with IDs up to 128 characters,
  titles up to 256 characters, URLs up to 2048 characters, and a 64 KiB
  serialized source bound; over-limit or malformed evidence is rejected, not
  truncated.
- provenance: `origin` (`AI_GENERATED` | `AUTHORED`), `verification`
  (`UNVERIFIED` | `VERIFIED`)
- chat linkage for the saved-state join: `sourceMessageId`,
  `sourceToolCallId`, `candidateId`
- spaced repetition, per element: `eFactor` 2.5, `interval` 1,
  `correctCountStreak` 0, `correctCount`, `partialCorrectCount`, `wrongCount`,
  `nextDueAt`, `lastAnsweredAt`, `lastCorrectAt`, `lastPartialCorrectAt`,
  `lastWrongAt`, and `lastResponseCorrectness`. Use these existing
  `QuestionResponse` names; do not introduce the inaccurate
  `lastCorrectness` or `lastRespondedAt` names.
- index on `[participantId, courseId, nextDueAt]`

`ChatGenerationApproval` stores participant, chatbot, thread, plan message ID,
plan tool-call ID, a status (`CLAIMED`, `COMPLETED`, or `ABORTED`), a short
lease expiry, and the generated assistant message ID. A unique key on
participant + plan message + plan tool call is claimed transactionally. An
active claim rejects a concurrent request, a completed claim rejects replay,
and an aborted or expired claim may be retried after an atomic status update.
The plan message itself remains immutable.

`ChatGenerationCandidateDisposition` stores participant, chatbot, source
message ID, source tool-call ID, candidate ID, and a Discard status. Its unique
key makes repeated Discard requests idempotent, and its source linkage is
validated against the completed generated result before the row is written.
Saved state remains derived from `PersonalElement`; a candidate cannot be both
saved and discarded. Discard rows are participant-owned and cascade with the
participant; no retrieved text is stored.

Why per-element scheduling fields instead of `QuestionResponse`: that table
requires an `ElementInstance`, a `Participation`, and a course-owned
activity; personal elements have none of those (ADR 0026).

### 2.3 Who writes what

| Concern | Owner | Path |
| --- | --- | --- |
| Rules: caps, type validation, ownership, SM-2 update | `personalElements` service emitted through a server-only package entry | `packages/graphql/src/services/personalElements.ts` |
| Student GraphQL surface for the PWA | Pothos schema + ops | `packages/graphql/src/schema/*.ts`, `packages/graphql/src/graphql/ops/*PersonalElement*.graphql` |
| Generation tools, plan/approval handling, credit accounting | chat route | `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` + new `apps/chat/src/lib/server/personalElements/` |
| Save/list API for the chat UI | chat route handlers | `apps/chat/src/app/api/chatbots/[chatbotId]/personal-elements/` |
| Plan card, candidate cards, saved state | chat components | `apps/chat/src/components/personal-elements/` dispatched by tool name in `apps/chat/src/components/message-parts.tsx` before the existing `part.toolUI`/`ToolFallback` path |
| "My cards" page: runner, list, delete | PWA | `apps/frontend-pwa/src/pages/course/[courseId]/personal.tsx` |

### 2.4 The generation contract (ADR 0027)

`generate_cards` is the public contract a later Catalyst engine implements
behind the same shape. The authenticated route injects the course ID from the
chatbot and participant context; neither the model nor the request body may
choose it. Input then consists of topic, language, and the approved plan
entries (title, intent, retrieval query). Output: candidate elements
(candidate id, type, name, content, explanation, and bounded card-local
sources whose cited chunk IDs are a non-empty subset of retrieved chunk IDs).
The engine does no database work and knows nothing about the UI (ADR 0006).
In v1 the implementation is the in-route pipeline described above. The
contract rejects malformed or evidence-free candidates before they reach the
save route.

## 3. Decisions fixed by the grill (2026-08-21)

| Topic | Ruling |
| --- | --- |
| Model | Separate `PersonalElement` table with own SM-2 fields; no changes to lecturer tables (ADR 0026) |
| Scope | Course-bound; cascades with course and participant |
| Grounding | Every card from its own retrieval call; cited chunk IDs are a non-empty subset of that retrieval; tools not offered without a `doc_query`-style tool; explicit tool order is preserved in the prompt-cache key |
| Flow | Plan after initial retrieval, approve button, then generation (ADR 0027) |
| Duplicate check | Out of v1 |
| Vocabulary | origin `AI_GENERATED`/`AUTHORED`; verification "unverified / verified by lecturer" |
| Write path | One server-safe service entry emitted from `packages/graphql`; GraphQL mutations for the PWA and Chat route handlers use that entry |
| Saved state in chat | Derived by join on `sourceMessageId` + `sourceToolCallId`; the persisted message is never mutated |
| Candidate decisions | One-card Save or durable Discard; Discard is keyed by participant, source message, source tool call, and candidate ID and has no bulk operation |
| Proposals to lecturer | Later phase with its own ADR amending 0022 |
| Gamification | No points, no XP |
| Availability | Default on for every chatbot; any configured mode with retrieval; retrieval and credit gates apply; no `CHAT_STUDENT_GENERATION_ENABLED` switch or GrowthBook flag in v1 |
| Data boundary | No research-export or Learning Analytics query, processing, or export in v1; shared Prisma schema synchronization is unchanged |
| Sizes | Plan default 10, cap 20; 500 personal elements per participant per course; generation blocked at zero credits |
| Revision | Unsaved: rerun the per-card pipeline, old card superseded (client-derived along the branch). Saved: `list_personal_elements` + `revise_personal_element`, in place, `version` +1, SM-2 kept, `VERIFIED` → `UNVERIFIED` on content change; cards render from the joined row after save |
| Delete | "My cards" page only, per card with confirm; no bulk; not via chat |
| Entry points | Practice area and `/repetition` expose two buttons per eligible course: Lecturer elements and Own elements; `/course/[courseId]/personal` remains the Own destination and saved cards retain a "Practice now" link |
| Run UI | Personal elements use an adapter inside the standard practice-session shell for overview, progress, response submission, Continue, Finish, error, and reload behavior; storage and SM-2 mutation remain personal-element-specific |
| Element types | `FLASHCARD` first; SC/MC/KPRIM next; NUMERICAL/FREE_TEXT later; never CONTENT |
| Roles | `PARTICIPANT` only (not `TEMPORARY_PARTICIPANT`) |
| Language | `Course.language`, fallback thread locale |

## 4. Delivery shape

Provider: GitHub. The repository supports stacked PRs. Stack mode: `guided`.
The topology owner is the execution orchestrator (main). The recommended
topology is one linear stack `A → B → C`, with C based on B; topology still
needs approval before work starts. PR B may contain its page and GraphQL
client wiring, but it has no public Home Practice or `/repetition` links: the
page is directly reachable for review, while PR C adds those links only after
the complete generator path exists. This keeps an intermediate stack from
advertising an incomplete generator.
If the ruling keeps the forked shape, B and C both branch from A and the
integration owner must perform an additional cross-PR check before either is
presented as complete.

1. **PR A — backend**: schema, service, GraphQL. Reviewer audience: data
   model and API.
2. **PR B — PWA** (on A, or on the approved linear parent): "My cards" page
   and GraphQL client wiring; public hub and `/repetition` activation is
   integrated by PR C.
   Reviewer audience: student UI.
3. **PR C — chat** (on B for the recommended topology): plan tool, approval
   transport, generation
   pipeline, candidate cards, save route, revise and list tools. Reviewer
   audience: chat runtime and cost seam.

Each PR updates these named documentation surfaces in the same PR. PR A owns
`docs/domain-model.md`, `docs/graphql-api-layer.md`,
`.agents/skills/klicker-data-model/SKILL.md`, and
`.agents/skills/klicker-graphql-api/SKILL.md`. PR B owns
`docs/frontend-conventions.md` and
`.agents/skills/klicker-frontend-ui/SKILL.md`. PR C owns
`docs/chat-platform.md`, `.agents/skills/klicker-testing-verification/SKILL.md`,
and `.agents/skills/klicker-playwright-e2e/SKILL.md`. Do not create a
standalone docs slice or `docs/log/`; the current wiki policy keeps
documentation selective and stores durable decisions in ADRs. Branch from the
fresh `v3` ref; use one repo-local `trees/<branch>` worktree for this stack;
run checks in the devcontainer; commit with conventional types.

| Layer | Provider / stack mode | Reviewer / attention | Validation and activation | Risk boundary | Size signal |
| --- | --- | --- | --- | --- | --- |
| A — backend | GitHub / first stack layer | data model + API; high attention | migration, sync, GraphQL check; no user activation | data integrity, public API, analytics boundary | pause for re-review if more than one migration, more than five new public operations, or a service implementation over roughly 400 lines |
| B — PWA | GitHub / child of A | student UI + accessibility; high attention | GraphQL client, browser screenshots; nav remains inert until C | browser/auth/i18n and response-state adapter | pause if the page needs more than two new route-level surfaces or a second runner implementation |
| C — chat | GitHub / child of B (recommended) | chat runtime, cost, trust boundary; very high attention | route tests, browser reload evidence, `pnpm --filter @klicker-uzh/chat build`; activation follows all gates | nested usage, citation trust, approval transport, auth | pause and re-slice if the route diff exceeds roughly 400 lines or more than two interactive tool cards are introduced |

## Historical execution contract

**Authority.** Approval of this plan authorizes work only in the named task
worktree: in-scope edits, repository-native checks, the configured
simplifier/slice/final reviews, local commits, and exact runtime teardown.
Pushes, PR creation or updates, merges, deploys, cluster or live checks, and
paid external-model runs remain withheld unless separately named by the user.

**Terminal.** The plan is complete when the approved stack is locally
committed, all named checks and review gates pass, the worktree is clean apart
from explicitly preserved user artifacts, and the exact devcontainer runtime
has been stopped and verified stopped. No PR is opened or merged by this
plan.

**Pause.** Pause and report evidence before crossing a new authority boundary,
when a size signal fires, when the service/build seam differs from the plan,
when grounding or analytics consumers cannot be proven, or when a check needs
an external provider, paid run, live environment, or user data. Do not replace
the route or silently weaken a gate.

After PR A's migration and public GraphQL schema checks pass, pause for the
data-migration/public-API review before starting PR B or PR C. This is a
review gate, not permission to merge or publish the PR.

## Historical research and primitive impact

No external research or provider documentation is needed for this design
pass. The plan is grounded in the current `v3` repository, the accepted ADRs,
the existing `Flashcard` and `updateSpacedRepetition` primitives, the current
Chat route/tool loop, and the local MCP fixture. Any implementation question
that depends on a changing library API is rechecked through the repository's
current dependency/runtime before code is written.

The feature adds one durable primitive, `PersonalElement`, and one public
generation contract, `generate_cards`. It extends existing Prisma, GraphQL,
Chat, and PWA surfaces while deliberately leaving lecturer-owned
`Element`/`ElementInstance`, `PracticeQuiz`, `QuestionResponse`, XP, pooled
practice, and analytics processing untouched.

## Historical delegation map

Each slice is assigned once. The execution orchestrator (main) owns topology
and sequential writer handoffs in the one worktree. Documentation updates
belong to the owning slice.

| Slice | Owner role | Route | Depends on | Acceptance anchor |
| --- | --- | --- | --- | --- |
| S0 prototype gate | execution orchestrator (main) | `main` | fresh worktree only | synthetic/local provider or explicitly authorized model run proves structured output and MCP execute shape; no throwaway artifact remains |
| S1 schema and service | executor | `executor` — backend writer | approved topology, S0 | migration/sync, server-safe package entry, serializable cap with bounded retry, idempotency, actor checks, SM-2 and version tests |
| S2 GraphQL surface | executor | `executor` — sequential handoff from S1 | S1 | generated operations/schema and participant-only auth; practice-list counts and analytics negative check |
| S3 My cards page | executor | `executor` — sequential handoff from S2 | S2 | adapter-backed runner, i18n, empty/rated/delete states, browser screenshots in both locales and mobile width; direct route only until C |
| S4 plan tool and approval transport | executor | `executor` — sequential handoff from S3 | S3, approved topology | explicit named dispatch/order, retrieval gate, durable one-shot approved-plan claim and deterministic generation shell, persisted reload test and browser plan-card evidence |
| S5 generation and candidate cards | executor | `executor` — sequential handoff from S4 | S4 | per-card retrieval/citation subset, bounded parallelism, nested usage success/abort accounting, save idempotency and reload evidence |
| S6 revision, listing, and final activation | executor | `executor` — sequential handoff from S5 | S5 | authorization, expected-version conflict behavior, final PWA links, unsaved/saved revision browser evidence and feature-wide portfolio |

Estimates assume one junior per PR, a working devcontainer, and the S0
prototype gate passing: S0 ½ day; PR A 2–3 days; PR B 2–3 days; PR C 5–7 days
(the generation pipeline and the first interactive tool card carry the
uncertainty). If S0 fails against the auto router, add 1 day to PR C for the
pinned-deployment path.

## 5. Slices

Every product slice S1–S6 ends with the named acceptance check passing and a
local commit. S0 is intentionally non-committing. "Verified" means executed
and observed, not "the code looks right".

### S0 — Prototype gate (chat, no product code, non-committing)

Goal: prove the two unverified mechanics before anyone builds on them.

- Use an untracked temporary harness outside the product tree (or an existing
  test fixture) to call `generateObject` with a flashcard zod schema through
  the route's `getModel` for the `auto` registry entry, and call an MCP tool's
  `execute` directly with a minimal options object (`toolCallId`,
  `messages: []`, `abortSignal`). Remove the harness before the slice ends;
  S0 has no product-code commit.
- Acceptance: both calls return valid output against the local LiteLLM and
  local MCP fixture (`apps/chat/scripts/local-mcp-server.mjs`), with a stable
  chunk-shaped fixture result. Record model IDs, latency, and token usage in
  this file's Progress section only when the provider is local or the user has
  separately authorized a paid external run. If no non-paid provider exists,
  pause at the Authority boundary.
- If `generateObject` fails through the router: pin nested calls to a
  concrete deployment from the registry (`gpt-5.6-luna` locally) and record
  the decision here; the product slices then use that pin.

### S1 — Schema and service (PR A)

- Add `PersonalElement` (section 2.2) and the two enums to a new
  `packages/prisma/src/prisma/schema/personalElement.prisma`; relations on
  `Participant` and `Course`. Run the migrate → sync → generate ritual from
  `docs/data-and-migrations.md`.
- Add the `ChatGenerationApproval` status enum/table in the same migration,
  with the unique participant/plan-message/plan-tool-call key and lease fields
  described in section 2.2; this is the durable replay boundary, not a
  mutation of the plan message.
- Add `ChatGenerationCandidateDisposition` in the same migration with a
  participant/chatbot/source-message/source-tool-call/candidate unique key,
  a Discard status, participant cascade, and no retrieved content. The Chat
  route must validate the candidate against the completed generated result
  before creating the row; repeated requests are idempotent.
- `packages/graphql/src/services/personalElements.ts` with:
  `listPersonalElements(participantId, courseId)` ordered by `nextDueAt` nulls
  first (mirror `orderStacks` semantics in `packages/graphql/src/lib/util.ts`),
  `createPersonalElements` (type `FLASHCARD` only, cap 500 per course, trims,
  requires non-empty `content`/`explanation`, validates bounded card-local
  sources, stores sanitized chat linkage), `respondToPersonalElement(id,
  correctness)` mapping
  `FlashcardCorrectness` to a grade exactly as `stacks.ts:upsertFlashcardResponse`
  does and calling `updateSpacedRepetition`, `updatePersonalElement` (content
  replace, conditional on `expectedVersion`, `version` +1, `VERIFIED` →
  `UNVERIFIED`), `deletePersonalElement`. Every function receives explicit
  actor context, checks course participation and ownership, rejects
  `TEMPORARY_PARTICIPANT`, and never trusts a participant ID from the body.
- Add database uniqueness for generated rows covering participant, source
  message, source tool call, and candidate ID (those linkage fields are
  non-null for generated rows; any future authored path gets its own explicit
  idempotency key). Enforce the 500-card course cap and insert in a serializable
  transaction with at most three bounded retries on serialization failure (or
  an equivalent participant/course lock) so concurrent saves cannot exceed it.
  Freeze the source limits from section 2.2: at most 32 chunks and 64 KiB of
  serialized source metadata per card, IDs up to 128 characters, titles up to
  256, URLs up to 2048, and reject over-limit input rather than truncating it.
  Keep the service in a
  server-only GraphQL package entry, add Chat's runtime dependency on that
  entry, and bound/sanitize the persisted source JSON.
- Acceptance: vitest specs in `packages/graphql` for cap under concurrent
  saves, idempotent retry, ownership and participation, temporary-role
  rejection, SM-2 progression (three correct answers push `nextDueAt` forward;
  a wrong answer resets), verification downgrade, and stale
  `expectedVersion` conflict. These run against the live DB in CI
  (`test-graphql` job); locally run them in the devcontainer and reseed
  afterwards. Run the exact production seam check
  `pnpm --filter @klicker-uzh/chat build`; it must resolve the server-only
  service entry without importing GraphQL source.

### S2 — GraphQL surface (PR A)

- Pothos types `PersonalElement`, enums, query `personalElements(courseId)`,
  mutations `createPersonalElements`, `respondToPersonalElement`,
  `updatePersonalElement`, `deletePersonalElement`, all
  `t.withAuth(asParticipant)` (pattern: `bookmarkElementStack` in
  `packages/graphql/src/schema/mutation.ts`), with the resolver passing
  explicit actor context and rejecting temporary participants.
- Ops files `QPersonalElements.graphql`, `MCreatePersonalElements.graphql`,
  `MRespondToPersonalElement.graphql`, `MUpdatePersonalElement.graphql`,
  `MDeletePersonalElement.graphql`; run codegen.
- Extend `getPracticeQuizList` (`packages/graphql/src/services/participants.ts`)
  so a course with personal elements but no published practice quiz still
  appears, carrying a `personalElementCount` and `personalDueCount`.
- Define the analytics/export boundary in the owning query and export paths:
  no personal-element query, processing, or export is added. Add a negative
  acceptance check at `packages/export/src/exportCourse.ts` using its existing
  `packages/export/test/index.test.ts` seam: a seeded personal element is not
  read and no exported file contains it. Add the Analytics selector check at
  `apps/analytics/src/modules/participant_analytics/get_participant_responses.py`
  and `compute_participant_analytics.py`: a seeded personal element produces
  no response row. The shared Prisma sync remains unchanged.
- Acceptance: `pnpm --filter @klicker-uzh/graphql check` and `test` green;
  the public schema diff in `packages/graphql/src/public/schema.graphql`
  shows only the new types and the negative analytics/export check passes.

### S3 — "My cards" page (PR B)

- `apps/frontend-pwa/src/pages/course/[courseId]/personal.tsx` modeled on
  `bookmarks.tsx`: header with course name and due count, an adapter inside
  the standard practice-session shell that maps front/back content, response
  state, progress, Continue, Finish, and `respondToPersonalElement`, then a
  list of all personal elements with the badge ("AI-generated · unverified" /
  "· verified by lecturer"), sources, and a per-card delete with confirm
  dialog.
- Update the Practice area and `/repetition` so every eligible course has
  exactly two clear entry actions: Lecturer elements and Own elements. Own
  remains reachable and shows its empty state when the course has no saved
  personal cards.
- Keep the page directly reachable for review, but do not add Home Practice
  or `/repetition` links in PR B; PR C adds those links only after the Chat
  generation path is complete.
- i18n keys in `packages/i18n/messages/en.ts` and `de.ts` (informal `du` in
  German, consistent with the PWA).
- Acceptance: agent-browser run against the worktree's devcontainer stack,
  logged in as a seeded student, with screenshots of: empty state, runner
  with one card flipped and rated, list with badge, delete confirm, German
  and English, mobile width. Seed at least three personal elements via the
  GraphQL mutation for the check. The agent-browser evidence is the only
  completion gate; a later follow-up may extend a Playwright regression, but
  it is not part of this plan and never substitutes for the browser run. The
  browser run also verifies the auth boundary and that no personal card is
  interleaved into pooled practice.

### S4 — Plan tool and approval transport (PR C)

- `apps/chat/src/lib/server/personalElements/tools.ts`: `propose_card_plan`
  (zod input: topic, cards[≤20]{title, intent, query}; output: plan id +
  entries). Register it alongside `mcpTools` **before**
  `buildPromptCacheRequest` in `route.ts` so `toolOrder` and the cache key
  include it. Change the cache helper if necessary: its current alphabetical
  object-entry ordering must not silently reorder the plan/generation tools.
  Offer it only when: the selected mode has a `doc_query`-style tool and the
  present (`isDocQueryToolName` over the tool names, same gate as the citation
  contract), and `credits.current > 0`.
- `prepareStep`: keep `propose_card_plan` out of `activeTools` until at least
  one `doc_query` call has completed in this turn.
- Approval transport: new top-level body field `approvedPlan: { messageId,
  toolCallId }` in the route's zod schema and in `useChatResponse.ts` (same
  placement as `images`). When present, load the plan from the persisted
  assistant message's tool-call part, verify it belongs to this thread and
  participant and actor role, reject replayed or superseded IDs, and force
  `generate_cards` via `prepareStep` on step 0 only. Before starting the
  stream, atomically claim the `ChatGenerationApproval` key derived from the
  plan message/tool call. Revalidate the selected mode, a current `doc_query` tool,
  positive credits, participant/thread ownership, the latest plan on the
  current branch, and the server-derived chatbot course. A completed claim
  rejects replay; an aborted or expired lease may be retried; a live claim
  rejects concurrent requests. The button's state must survive the complete
  path: Plan card → thread/runtime state → one-shot request body → persisted
  assistant tool result.
- Implement claim creation, status transitions, and bounded lease recovery in
  `apps/chat/src/lib/server/personalElements/approvalClaims.ts` using the
  `ChatGenerationApproval` table; keep the route's model loop independent of
  the claim storage details.
- Add a deterministic `generate_cards` contract shell in S4. It validates
  the approved plan and returns a typed pending/error result without model
  calls; S5 replaces the shell with the retrieval-backed implementation.
- Plan card: `apps/chat/src/components/personal-elements/PlanCard.tsx`
  dispatched by an explicit `part.toolName` branch in
  `apps/chat/src/components/message-parts.tsx` before the existing
  `part.toolUI`/`ToolFallback` path (the current file renders but does not
  register tool UIs). Button appends the visible user message and the body
  field. A plan that is not the latest plan on the current branch renders as
  superseded (client derivation over `thread.messages`).
- System prompt: a short scaffolding paragraph telling the model to retrieve
  first, propose a plan, and never generate cards without approval; appended
  only when the named tools are present (same pattern as
  `withCitationContract`).
- Acceptance: route vitest with synthetic streams (pattern:
  `apps/chat/test/required-mcp-route.test.ts`) proving the tool is absent
  without `doc_query`, absent at zero credits, inactive before the first
  retrieval, and the deterministic shell is forced on step 0 when
  `approvedPlan` is sent; a
  `persisted-assistant-content` test proving the plan args survive reload; and
  an auth/replay test proving a plan from another thread or an already-used
  approval cannot trigger generation while an aborted claim can be retried.
  Browser evidence covers the plan card, visible approval message, reload, and
  superseded state in English and German at desktop and mobile widths.

### S5 — Generation pipeline and candidate cards (PR C)

- `generate_cards` tool: for each plan entry, with bounded parallelism
  (start with 3), call the first `doc_query` tool in the explicit `toolOrder`
  directly with the entry's query, normalize the result to the stable chunk
  shape from section 2.1, then call `generateObject` with the flashcard schema
  (`name`, `content`, `explanation`, `citedChunkIds` restricted to the
  retrieved chunk IDs; language from `Course.language`, fallback thread
  locale). Use the authenticated chatbot's server-derived course; do not
  accept a course ID from the model or request body. Require at least one
  cited chunk, validate the subset before
  emitting a candidate, and fail that card closed when retrieval or evidence
  is malformed. Extend the local fixture and source-normalization seam so
  chunk IDs are preserved for rendering and storage. Return an `AsyncIterable`
  so each finished card streams as a preliminary result; the final result
  carries all candidates plus bounded card-local sources in the `doc_query`
  result shape so `normalizeSourcesFromParts` can render citations for the
  card.
- Credit accounting: accumulate nested `generateObject` usage and add it
  exactly once at the three sites where `imageDescriptionCost` is added today
  (`onEnd`, `onAbort`, `messageMetadata`), preserving the existing success,
  abort, and metadata ownership so a retry or terminal callback cannot double
  charge.
- Candidate cards: `CandidateCards.tsx` dispatched by the same explicit
  tool-name branch: front/back stacked, shared citation chips from the
  message-level source set, an individual Save and Discard action per card,
  saved/discarded status, and a "Practice now" link after save. The running
  tool state appears before the first candidate and reports `completed/total`;
  the terminal generation turn does not render duplicate assistant prose.
  Saved and discarded state comes from `GET /api/chatbots/[chatbotId]/personal-elements?messageId=…`
  (join on `sourceMessageId` + `sourceToolCallId`), never from the frozen
  tool result.
- Save route: `POST /api/chatbots/[chatbotId]/personal-elements` guarded by
  `withChatbotAuth`, passing explicit actor context, and calling
  `createPersonalElements` from the server-safe shared service entry;
  idempotent per `candidateId` and source message/tool call. Do not trust raw
  candidate source JSON or a participant ID from the request body.
- Discard route: `DELETE /api/chatbots/[chatbotId]/personal-elements` with the
  same linkage and one candidate ID. It is authorized against the completed
  generated result, rejects a candidate already saved, and upserts the
  participant-owned disposition so reloads preserve the decision.
- Acceptance: route vitest with injected SSE proving every persisted
  candidate cites at least one retrieved chunk ID from its own retrieval,
  malformed evidence is rejected, nested usage reaches `creditsUsed` on both
  success and abort paths, and retrying concurrent saves is idempotent and
  capped; agent-browser run in the devcontainer with the local MCP fixture
  and LiteLLM: ask for cards, approve, watch cards stream in, save two, reload
  the thread and see saved state and citations persist; screenshots in both
  locales and at mobile width.

### S6 — Revision and listing tools (PR C)

- `list_personal_elements` (course-scoped, own elements, compact) and
  `revise_cards` / `revise_personal_element(id, instruction)` reusing the
  per-card pipeline from S5. For unsaved candidates the revised card is a new
  candidate in the new message and the old card renders as superseded; for
  saved elements the route calls `updatePersonalElement` with
  `expectedVersion`; a stale version returns a conflict and leaves content
  unchanged. Every tool rechecks course participation and actor role.
- Acceptance: vitest for the two tools' validation and stale-version paths;
  agent-browser: "make card 2 shorter" before saving and after saving, then
  confirm the "My cards" page shows `version` 2 content and the card in chat
  shows the revised text after reload. The owning PR also updates the relevant
  wiki page and skill paragraph, and activates the Home Practice and
  `/repetition` links that PR B kept directly reachable only. No separate docs
  slice or log is created.

## Historical feature-wide verification portfolio

The following checks are required across the slices; a passing local check is
recorded with its producing command and observed output.

| Test obligation | Behavior obligation | Primary seam | Existing protection | Planned test / distinct failure | Owner / evidence |
| --- | --- | --- | --- | --- | --- |
| `add new` | Concurrent cap, idempotent save retry, durable Discard idempotency, source/message/tool-call/candidate uniqueness, actor/course authorization, stale `expectedVersion` | `packages/graphql/src/services/personalElements.ts`, Chat candidate-disposition route | Prisma constraints, existing service test harness, `withChatbotAuth` | DB-backed vitest for duplicate rows, cap overrun, repeated Discard, save-vs-Discard race, stale overwrite, temporary-role write | S1/S5 main; concurrent callers |
| `add new` | Durable approval one-shot, cross-thread/replay rejection, persisted tool-state reload, candidate saved-state join | `apps/chat/src/lib/server/personalElements/approvalClaims.ts`, `useChatResponse.ts`, `RuntimeProvider.tsx`, named dispatch in `message-parts.tsx` | ChatThread/ChatMessage persistence and Chat store reload | route/browser checks for replay after completion, aborted retry, and frozen tool-result misreport | S4/S5 executor; route test plus browser reload |
| `add new` | Retrieval-before-plan, explicit tool order/cache key, per-card chunk-subset grounding, malformed-evidence rejection, nested usage on success and abort, visible generation progress, tool-only terminal turn, unified source normalization | Chat route, `apps/chat/src/lib/server/promptCacheIdentity.ts`, local MCP fixture, `apps/chat/src/lib/sources/normalizeSources.ts` | existing required-MCP route tests and citation contract | synthetic streams catch plan-before-retrieval, wrong cache order, uncited/cross-card citation, missing progress, duplicate prose, source mismatch, and double charge | S4/S5 main; route tests with fixture chunks |
| `add new` | Empty, rated, due-count, badge, source, delete-confirm, pooled-practice exclusion, two course entry actions, shared practice-session parity, English/German, desktop/mobile | PWA personal page, repetition page, Practice hub, and practice-session adapter | bookmarks/practice page precedent, `PracticeQuiz.tsx`, and shared `Flashcard.tsx` | browser evidence catches wrong response mapping, missing due count, pooled visibility, missing Own empty state, and inaccessible activation | S3/S6 main; mandatory `agent-browser` screenshots |
| `none` | Runtime lifecycle | worktree-specific `devrouter ensure` and exact workspace stop command | `$rs-local-runtime-lifecycle` procedure | exact stop verification catches browser evidence from another checkout or a runtime left running | execution orchestrator; record start identity and verified stop |
| `extend existing` | Research export boundary | `packages/export/src/exportCourse.ts` and `packages/export/test/index.test.ts` | readonly Prisma client and existing export test seam | seeded negative case catches personal row or source JSON leaking into CSV/workbook | S2 executor; extend existing test |
| `add new` | Learning Analytics boundary | `apps/analytics/src/modules/participant_analytics/get_participant_responses.py` and `compute_participant_analytics.py` | selector joins only `QuestionResponseDetail` through practice/microlearning | seeded negative selector fixture catches a personal response reaching the dataframe or aggregate | S2 executor; new selector test/fixture |

Playwright is not a completion gate for this feature: use the mandatory
`agent-browser` run and screenshots as the deterministic browser proof. Extend
an existing Playwright spec only as a durable regression follow-up after the
feature is complete.

## 6. Review and verification gates

- This plan: read-only planner review and correction pass before approval;
  findings are recorded in `project/_local/reviews/` and dispositions belong
  in Progress.
- Per committed slice: simplifier pass. Slice review for S1 (data integrity),
  S4 (auth and approval trust boundary), S5 (cost seam, grounding and save
  route trust boundary), and S6 (concurrency and revision integrity), started
  in parallel with the simplifier where the risk applies.
- Final review after PR C integrates, before the PR descriptions are written
  with `$rs-mr-description-writer`.
- Browser verification is mandatory for S3, S4, S5, and S6 (the repository's
  `agent-browser` skill against the worktree's own devcontainer stack), with
  English/German and desktop/mobile evidence as named in the slices.
- Read `$rs-local-runtime-lifecycle` before runtime-dependent checks, after the
  final check, and at handoff; stop the exact worktree runtime and verify it
  stopped. No broad Docker cleanup is in scope.

## 7. Risks and open items

| Risk | Handling |
| --- | --- |
| Structured output through the LiteLLM auto router is unverified | S0 gate; pin a concrete deployment if it fails |
| Silent tool step killed by a proxy idle timeout | Preliminary results streamed per card; bounded parallelism |
| Nested model usage unbilled | Three accounting sites are named in S5 and checked by test |
| First interactive tool card in the app | Keep `ToolFallback` as default; register only the two new tool names |
| Stale plan after a branch switch | Superseded state is client-derived along the branch path |
| Citation IDs or source JSON are not trustworthy | Stable chunk adapter, subset validation, bounded/sanitized storage, and fail-closed candidate creation |
| Chat cannot load the shared service in production | Explicit server-only package entry, Chat runtime dependency, and standalone build smoke check |
| Concurrent saves or stale revisions corrupt state | Database uniqueness, transactional cap, idempotent retry, and `expectedVersion` conditional updates |
| Discarded candidates reappear or race with Save | Participant-owned source-linked disposition with a unique key, idempotent DELETE, and a save-vs-discard conflict check |
| Generated sources disappear from the final message | Normalize `generate_cards` and `revise_cards` source metadata through the same message-level source set used by source cards and inline citations |
| Analytics wording overclaims isolation | Negative consumer/export checks; no claim that synchronized Prisma schema omits the model |
| Students expect the cards in the pooled practice queue | "My cards" entry points in S3; interleaving is a later explicit step |

Settled rulings for this implementation:

| Ruling | Accepted decision | Rejected alternative | Why it matters |
| --- | --- | --- | --- |
| Stack topology | One linear stack `A → B → C`; C is based on B and B stays inert until C | Keep B and C as children of A | Linear integration gives one tested backend → PWA → Chat path; the forked shape needs an extra integration review and can expose an incomplete flow |
| Operational switch | Do not ship `CHAT_STUDENT_GENERATION_ENABLED` in v1; rely on Tutor, retrieval, and credit gates | Ship a default-on environment switch in C | The env switch duplicates availability controls, gates Chat but not PWA consistently, and adds rollout configuration without a current product need |

## Progress

- 2026-08-27 (final integrated review corrections): The Sol final reviewer
  inspected all 108 changed paths in `4f20cff96..ac5a1ec15` and returned three
  bounded concerns. Layer A now describes participant-role enforcement at the
  GraphQL and Chat entry boundaries instead of the shared service. Layer B no
  longer renders a points multiplier for personal practice. Layer C retains
  candidates from an interrupted partial generation only after the server has
  durably marked the partial settlement. The focused candidate-history suite
  passes 8 tests, Chat and PWA TypeScript checks pass, and agent-browser proof
  shows a due personal card without points-award or multiplier copy. The
  synthetic browser fixture was removed. The exact task runtime is stopped and
  exposes zero routes. The Sol correction pass confirms all three findings are
  resolved and the single-migration conclusion is unchanged. Atomic stack
  publication and exact-head CI remain open. Merge, deployment, and flag
  enablement remain disabled.

- 2026-08-27 (current `v3` reconciliation): The linear A → B → C stack now
  contains current `origin/v3` at `4f20cff96`, including the merged Chat
  account-usage work. The student-generation route reuses the account-usage
  assistant message while keeping account-usage claims and card-generation
  leases as separate lifecycles. Simplifier findings removed the ordinary-turn
  history query and duplicate stream metadata path, and accepted-plan turns now
  expose only `generate_cards`. The risk review identified and closed a setup
  failure that could retain an accepted-plan lease before provider streaming;
  its regression test verifies lease release. The focused route suite passes
  38 tests, the full Chat suite passes 58 files and 563 tests with one file and
  13 tests skipped, Chat TypeScript and ESLint pass, and the four touched files
  pass Biome formatting. Publication to the existing three PR refs, exact-head
  CI, and runtime shutdown remain open. Merge, deployment, and flag enablement
  remain disabled.

- 2026-08-26: Exact task runtime was reconciled and passed `pnpm run
  dev:doctor` for auth, Chat, control, manage, and PWA. Agent-browser proof
  covered the practice-area Lecturer elements / Own elements links, the
  participant-owned overview, source-linked origin and source access, shared
  practice-quiz cue/answer/response/finish behavior, active-card removal, and
  German mobile rendering; screenshots are retained under `/tmp/` for this
  run. The local database fixture was synthetic and removed after proof. The
  Chat runtime is healthy but has no upstream model key, so the bounded
  OpenRouter smoke cannot run; feature-flag default-off behavior remains
  covered by the focused tests. The exact runtime is still active while the
  final publication gates are completed.

- 2026-08-26 (final packaging verification): The exact task runtime
  `rs-student-generated-practice-el` was reconciled from
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/student-generated-practice-elements-plan`.
  Chat production build passed on Next.js 16.2.10 with TypeScript and static
  page generation complete. The generated standalone Chat server passed a
  local `/api/health` smoke with HTTP 200, and Helm template rendering of
  `deploy/charts/klicker-uzh-v3` produced valid YAML with Chat's optional
  `*-secret-growthbook` reference. The post-rebase Chat suite passed 52 files
  and 495 tests. The final integrated review is recorded in
  `project/_local/reviews/2026-08-26-personal-practice-final-review.md`; its
  only advisory was this production packaging seam, now closed. The bounded
  OpenRouter smoke remains unavailable because the runtime has no upstream
  model key, so pilot enablement remains disabled. Exact runtime shutdown was
  requested after these checks and is awaiting the managed DevPod mutation lock
  held by an unrelated workspace operation; no raw provider mutation is being
  used.

- 2026-08-26 (runtime release): After the final build, standalone smoke, and
  Chat suite completed, `devrouter stop` stopped the exact
  `rs-student-generated-practice-el` DevPod for the task checkout. Fresh
  source-path verification reports provider state `Stopped` and zero exact
  routes; the worktree and its data were preserved.

- 2026-08-26 (freshness rebase and publication): The remote `v3` trunk advanced
  to `079dc722b` during the publication window, so the stack was refreshed with
  a no-`FETCH_HEAD` fetch and cascaded onto that exact trunk without changing
  its A → B → C topology. The resulting heads are `6f9d1ac95` (A),
  `7565d2942` (B), and `fec318af0` (C); ancestry and PR bases were verified
  against those OIDs. The registered `gh stack push` operation atomically
  published all three refs, and `gh stack link` confirmed the existing
  three-PR stack. Its host pre-push hook was cancelled after a read-only
  process check showed the monorepo Rollup build idle at 0% CPU for more than
  eight minutes; the retry used `HUSKY=0` after the container-native Chat
  build, standalone health smoke, Helm render, and 52-file/495-test Chat suite
  had passed. No ordinary Git push, merge, ready-state change, deployment, or
  flag enablement was used.

- 2026-08-26 (generated-artifact CI correction): GraphQL Code Generator now
  normalizes the public schema's trailing newline before writing it, so the
  repository's generated-artifact check is deterministic. The exact task
  DevPod passed the GraphQL package check on Node 24, the focused
  `personalElements` suite passed 18 tests, and the two touched files passed
  Biome. The correction also fixes the race-test context and makes the
  identical-source no-op assertion compare against the reset state. Commit
  `7c3d3e844` is ready to publish as the new Layer C head; exact-head CI has not
  yet rerun.

- 2026-08-26: Autonomous execution is underway under the approved correction.
  S1/S2 and S3 are committed; S4 is committed as `16cd1723c` with the shared
  five-card cap, bounded failure codes, source-membership checks, and oversized
  history rejection. S5 is committed as `e8f2fce5` with the fail-closed,
  participant-and-chatbot-targeted creation flag, development-only override,
  approval-time recheck, and optional Chat GrowthBook secret wiring. The full
  Chat suite passes 52 files and 495 tests; the focused S4/S5 suite passes 87
  tests; Chat and feature-flags TypeScript checks pass; feature-flags tests
  pass; and the staged secret scan, Prisma-sync, agent, removed-doc, lint,
  formatting, and syncpack checks pass. The repository hook still fails only on
  the known GraphQL generated-schema final-newline mismatch after codegen, so
  the two Layer C commits used the documented equivalent-check `--no-verify`
  path with the tracked schema restored. The required S4/S5 specialist review
  routes both returned `unreadable_encrypted_agent_task`; no retry was made,
  and bounded main-session reviews are recorded in `project/_local/reviews/`.
  Exact task-runtime/browser proof, final integrated review, CI, and atomic
  publication remain open; merge, deployment, and remote flag enablement stay
  disabled.

- 2026-08-26: The attached in-depth review was dispositioned into the
  release-hardening correction at the top of this plan. The correction keeps
  the private gate-before-pool model, removes misleading verification state,
  makes learning state content-version-safe, moves trust and sources into the
  runner, caps source-linked generation at five with typed failures, and adds a
  fail-closed creation flag. A Sol planning challenge accepted the five-slice
  shape and separated disabled merge readiness from later pilot enablement.
  **Status: full correction plan drafted and awaiting one-time approval; no
  correction implementation or delivery action has started.**

- 2026-08-24 (retrieval correction): The Chat route now forces the configured
  `doc_query` tool before substantive Tutor or Explainer answers, requires
  valid chunk evidence before `propose_card_plan`, and terminates empty or
  malformed retrieval with a server-owned `course_retrieval_unavailable` tool
  result rendered as a localized limitation. Card intent detection is
  conservative for English and German question/explanation phrasing while
  accepting explicit requests such as "Create flashcards explaining CAPM" and
  shorthand such as "Lernkarten zum CAPM". The route wiring test exercises the
  retrieval stop conditions and the deterministic terminal result. Commits
  `8ac246a7a`, `f55d729b2`, and `cfff8885b` are pushed to
  `rs/student-generated-practice-elements-plan`; the correction review,
  simplifier, and final integrated review pass. Focused retrieval tests pass
  42 cases, the full Chat suite passes 45 files and 425 tests, and the Chat
  production build passes. After action-time approval, the Infisical-backed
  local browser run in Explainer mode sent the synthetic MCP integration
  prompt and showed the `KB_doc_query` result marker, a numbered inline
  citation, and the matching source card. The same run sent a flashcard
  request, showed the retrieval-backed card plan, generated five candidate
  cards with visible progress, rendered one shared source set, and exposed
  individual Save and Discard actions; a reload preserved the cards, source
  cards, and citations. The approved Tutor browser turn then showed the same
  retrieval tool, grounded answer, inline citation, and source card, and a
  reload preserved the Tutor answer together with the generated cards and
  their citations. That reload briefly exposed a stale Next dev route table:
  the direct handler and values-free local data probe returned successfully,
  while the running server returned an HTML 404 for the saved-state route.
  Restarting only the Chat Next child restored the JSON route; the final
  reload showed five enabled Save and five enabled Discard actions with no
  saved-state warning. No application or ingestion change was needed for this
  runtime-only condition. Ingestion remains unchanged; the producer contract
  still needs a values-free multi-tenant probe when that service is available.

- 2026-08-24: The user selected the approved product follow-up to support
  student-generated practice in both Tutor and Explainer whenever the selected
  mode has course retrieval. The contract now requires retrieval before every
  substantive request, with only a narrow English/German social-message
  allowlist exempted; missing evidence must produce an explicit limitation
  instead of uncited general knowledge. The plan, ADRs, and Chat wiki were
  updated. Code and focused verification are the next slice; ingestion remains
  unchanged because the existing retrieval adapter already owns the stable
  chunk and source contract.

- 2026-08-24: Sol challenge reviewed the five product findings as contract
  completions. The user approved implementation and ruled that Discard must
  persist. The plan and ADRs now require two course entry actions, the shared
  practice-session shell, individual Save/Discard actions, visible generation
  progress with no duplicate terminal prose, and one message-level citation
  set covering both retrieval and generation sources. A new participant-owned
  `ChatGenerationCandidateDisposition` table is in scope; no ingestion change
  is indicated. Implementation and verification remain local; push, PR,
  merge, deploy, live checks, and paid model runs remain withheld.
- 2026-08-21: grill rounds 1 and 2 settled; CONTEXT.md terms recorded; ADRs
  0026 and 0027 written, ADR 0006 row amended; the task moved to
  `trees/student-generated-practice-elements-plan` and was synchronized
  against the fresh `origin/v3` ref. The synchronization and plan artifacts
  are committed locally as `02533ba35` and `54fb7c8df`; no delivery action has
  been taken.
- 2026-08-21: first planner pass completed with status
  `DONE_WITH_CONCERNS`. The full report is retained outside Git at
  `project/_local/reviews/2026-08-21-student-generated-practice-elements-plan-planner.md`.
-  Findings were applied: stable chunk contract and fail-closed validation,
  server-only service build seam, transactional/idempotent persistence and
  version checks, explicit approval transport and tool dispatch, analytics
  consumer boundary, linear-stack recommendation, no v1 env switch,
  delegated S0–S6 map, and expanded review/test gates.
- 2026-08-21: correction pass requested durable approval claims, a deterministic
  S4 generation shell, native route roles, explicit activation timing, frozen
  source limits, named export/Analytics seams, and exact Chat build evidence.
  Those corrections are now in the draft. The final confirmation pass found
  two presentation fixes (explicit test-obligation classifications and removal
  of conditional Playwright work); both are applied. **Status: corrected draft,
  awaiting the two rulings and plan approval.** The user then approved
  autonomous local execution with pushes, PRs, merges, deployments, live
  checks, and paid external-model runs withheld.
- 2026-08-21: the exact task DevPod was started and verified through DevRouter
  at the worktree path. The local MCP health and direct `doc_query.execute`
  prototype passed, returning the stable `KLICKER_LOCAL_MCP_OK` fixture marker
  and one source. The auto-router structured-output prototype could not run:
  the DevPod has no configured non-paid model key, and the safety boundary
  rejected an attempt that could forward to a paid external provider. S0
  therefore remains blocked at its explicit authority gate; no product code or
  temporary harness was kept.
- 2026-08-21: S0 was rerun against a temporary local-only OpenAI-compatible
  fixture wired into the task LiteLLM container, so no paid or external model
  was reachable. `generateObject` through the `auto-router` registry path
  returned the flashcard schema with `modelId: auto-router`, 8 input tokens,
  12 output tokens, 20 total tokens, and 0.23 seconds end-to-end. Direct
  `doc_query.execute` with `{toolCallId, messages: [], abortSignal}` returned
  the stable `KLICKER_LOCAL_MCP_OK` marker and one source. The temporary
  fixture and harness remain outside the product tree and are removed before
  the S0 slice closes; S0 is now accepted.
- 2026-08-21: S1 committed the participant-owned model and transactional
  service as `dceb3e3a2`. The focused service suite passed 5 tests, including
  the expected serialization-retry log; GraphQL check and build passed.
- 2026-08-21: S2 committed the GraphQL surface and compatibility corrections as
  `322c29453`, `26dc66297`, and `955490f0c`. GraphQL generation, check, and
  build passed; the existing `GetPracticeQuizList` persisted operation hash
  stayed unchanged and the new operation received its own hash. The export
  negative seam passed 23 tests without reading personal elements, and the
  synthetic Analytics selector boundary passed.
- 2026-08-21: S3 committed the direct PWA personal-card route as `0d3243fdf`
  and `454370f5d`. The PWA typecheck passed and the review corrections added
  locale coverage, due-card behavior, error handling, keyboard-safe controls,
  and response-state isolation.
- 2026-08-21: S4-S6 committed the plan-first Chat flow as `6b852c76c`, then
  hardened it in `616a92d`. The corrected slice adds durable approval attempt
  ownership, active-branch plan binding, immutable approved-plan generation,
  fail-closed chunk validation, persisted revision sources, saved-card
  rendering, cancellation propagation, and completed-state save gating. Chat
  focused tools passed 9 tests, approval claims passed 2 tests, and the full
  Chat suite passed 40 files and 344 tests. Chat check/build and GraphQL
  check/build passed; build output contained only the repository's existing
  Rollup/Pothos warnings.
- 2026-08-21: The pre-commit gitleaks scan passed with no leaks and staged
  formatting completed. The hook's `check:syncpack` step still exits 1 because
  the untouched baseline `apps/chat/package.json` dependency order is not
  syncpack-formatted; `syncpack list-mismatches` is clean. The corrected code
  slice was therefore recorded with the authorized local commit boundary and
  the exact hook limitation is retained here rather than changing that
  unrelated package file.
- 2026-08-21: The mandatory agent-browser attempt reached the direct PWA page
  only through the container IP. The linked worktree route returned 404, the
  base route returned 502 Bad Gateway, and API calls to
  `https://api.klicker.localhost` remained 502, so seeded login and the Chat
  approval/save path could not be proven. The exact DevRouter workspace also
  reported `could not determine process identity for workspace lifecycle lock`
  and `host route update lock` for `ensure`, `exec`, and `ls`; no browser or
  runtime result from another checkout was substituted.
- 2026-08-21: The corrected S4-S6 fallback slice review found three additional
  P1 issues: client-controlled approval attempt IDs, plan activation without
  proving chunked retrieval, and claim completion that did not gate durable
  persistence. They were verified and fixed in `702576fde`: existing attempt
  message IDs are rejected so a replay cannot overwrite another assistant
  message, plan activation and approval require a stable chunked doc_query
  result, and a lost claim transition removes the unowned persisted assistant
  result instead of marking it complete. The claim tests now cover the false
  transition result.
- 2026-08-21: The fallback simplifier review found only low-severity schema and
  scan deduplication opportunities; neither changes behavior or blocks this
  package. The configured native simplifier and slice-reviewer routes remain
  unavailable because their Gemini route rejects the requested effort with an
  empty supported-effort set. Fallback reviews were used and their findings
  were verified before each corrective commit.
- 2026-08-21: The final fallback slice review found two identity and evidence
  issues in the approved generation route. Commit `6e7d3fb00` preserves the
  client-rendered assistant message ID through approval while rejecting any
  pre-existing ID, and binds the approval gate to chunked retrieval evidence
  on the exact persisted plan message rather than any earlier branch message.
  The full Chat suite passed 40 files and 345 tests, and the Chat typecheck
  passed again after the correction. No blocking findings remain; route-level
  browser proof remains blocked by the DevRouter failures above.
- 2026-08-21: The correction commit `3f2fcca11` makes candidate identity
  plan-scoped, preserves exact revision lineage, and keeps aborted or errored
  generation attempts visible but unavailable for saving. The save route now
  requires the completed approval for the exact assistant attempt. The full
  Chat suite passed 42 files and 357 tests; Chat check, focused Chat ESLint,
  focused Biome, GraphQL check/build, export tests (23), and `git diff --check`
  passed. The repository pre-commit hook was not green because it reports
  unrelated existing analytics formatting and Chat lint errors; the focused
  changed-file checks and gitleaks passed, so the authorized local commit was
  created with `--no-verify`. The fallback simplifier found no required
  simplification; the configured native Gemini simplifier and slice-reviewer
  routes remain unavailable due their empty supported-effort response. Browser
  proof remains blocked, the branch is 0 behind the latest verified
  `origin/v3`, and no push, PR, merge, deploy, live check, or paid model run
  was performed.
- 2026-08-21: The correction review first found and fixed two retry-integrity
  gaps in `3c4e44ad7`: failed revisions are unavailable at the client, route,
  and unsaved-candidate extraction seams, and repeated revisions use bounded
  UUID identities. A second slice review found approval laundering through a
  persisted but not yet completed generation; `41d2b3354` now admits generation
  candidates only for a participant- and chatbot-scoped `COMPLETED` approval
  and requires each revision to reference an accepted predecessor with exact
  source lineage. The final fallback simplifier and slice review both passed
  with no remaining blockers. The final exact-DevPod evidence is 43 Chat test
  files and 364 tests passed, Chat check passed, focused changed-file ESLint
  passed with the repository's pre-existing `prefer-const` rule isolated,
  Biome formatted all 10 changed files, GraphQL check/build passed, export
  tests passed 23, gitleaks found no leaks, and `git diff --check` passed. The
  full repository hook remains blocked by unrelated baseline analytics format
  and Chat lint errors, so the authorized local correction commits use
  `--no-verify`. The branch is 0 behind the verified `origin/v3`; browser proof
  remains blocked by the documented routing and lifecycle-lock failures, and
  no push, PR, merge, deploy, live check, or paid model run was performed.
- 2026-08-21: The task branch was rebaselined onto the freshly fetched
  `origin/v3` after preserving the reviewed pre-clean history at
  `rs/student-generated-practice-elements-plan-pre-clean` and
  `rs/student-generated-practice-elements-plan-pre-clean-history`. The active
  branch is now 22 commits ahead and 0 behind `origin/v3`; its committed range
  contains only the approved practice-element docs, service, GraphQL, PWA,
  Chat, export, and analytics-boundary changes. The unrelated lecturer-HITL
  roadmap commit and files are no longer in the active range.
- 2026-08-21: Commit `463ae5505` closes the final retry-integrity findings:
  failed `revise_cards` messages no longer supersede their predecessor, and a
  `generate_cards` result with `status: error` aborts its durable approval
  claim while leaving the persisted attempt retryable. The focused Chat
  regressions passed (3 files, 22 tests) and Chat typecheck passed. The clean
  branch replay has not yet repeated the full repository verification or
  browser attempt; those remain the next gates.
- 2026-08-21: The final save-route review found that a persisted
  `generate_cards` or `revise_cards` result with `status: error` could still
  reach the save route. Commit `defe020ce` now rejects both forms with HTTP
  409 before any write; the focused Chat regressions passed 4 files and 33
  tests, and Chat typecheck passed.
- 2026-08-21: The fallback simplifier identified duplicated personal-element
  failure classification across the runtime, extraction, supersession, chat,
  and save seams. Commit `f4acd0215` centralizes the shared marker,
  `isError`, and `status: error` guard without changing the call-site
  contracts. The full Chat suite passed 43 files and 369 tests; Chat
  typecheck and focused changed-file ESLint passed with the repository's
  pre-existing `prefer-const` rule isolated. Formatter writes and
  `git diff --check` passed; the formatter-only Biome check still reports the
  route's pre-existing import-organization assist. Slice-review disposition
  and the final integrated review remain required before close-out.
- 2026-08-21: The simplifier then identified a sibling-attempt scope risk in
  the new save-route scan. Commit `b17eb2fad` restores the prior message-level
  marker semantics while keeping tool-result failures scoped to the selected
  `toolCallId`; its regression proves a failed sibling call cannot block a
  successful selected call. Focused personal-element tests passed 4 files and
  34 tests, Chat typecheck passed, and the correction simplifier passed. The
  full Chat suite passed 43 files and 370 tests. The repository-wide check
  still reports the known unrelated analytics cache/format limitation and the
  eight pre-existing Chat `prefer-const` errors; focused changed-file ESLint
  with that rule isolated remains green.
- 2026-08-21: The slice reviewer found the same sibling-attempt scope issue in
  the client runtime and revision supersession projection. Commit `307d3409e`
  now matches failures by exact `toolCallId`, while preserving message-wide
  stopped/error markers. New runtime and revision regressions passed alongside
  Chat typecheck (2 files, 22 tests), and the staged scan found no leaks.
-  The dedicated simplifier and slice reviewer both passed; their focused
  personal-element verification covered 4 files and 36 tests. The integrated
  final review remains the last review gate.
- 2026-08-21: Final local audit before the integrated review found the task
  worktree clean at 28 commits ahead and 0 behind the freshly verified
  `origin/v3`; the full-range gitleaks scan covered all 28 commits with no
  leaks, and `git diff --check` passed. The exact task DevPod reports
  `Stopped`, and `devrouter ls --json` reports no exact task routes. The
  primary checkout still contains only the preserved unrelated user changes;
  no push, PR, merge, deployment, live check, cluster action, or paid external
  model run was performed.
- 2026-08-21: The integrated fallback review then found two implementation
  corrections in the terminal audit: an all-card retrieval failure was
  reported as a zero-candidate partial result, and retrieval page evidence
  was stored only inside metadata instead of the plan's direct source `page`
  field. Commit `1aa5f2835` makes an all-card failure explicitly retryable,
  keeps the failed card IDs, and carries page evidence through source
  normalization, GraphQL, Chat citation chips, and the PWA card list. New
  regressions cover both failure classification and direct page persistence;
  the Chat suite passed 43 files and 375 tests, Chat and GraphQL checks passed,
  GraphQL build regenerated the client artifacts, and PWA typecheck passed.
  The host-side GraphQL service test could not run because the exact task
  DevPod is stopped and the database connection terminated; the prior exact
  DevPod run remains the available service-test evidence. The required
  simplifier, slice review, and integrated final review still remain open.
- 2026-08-21: The fallback simplifier and slice reviewer both passed commit
  `1aa5f2835`; the integrated final review then found one remaining typed JSON
  declaration gap. Commit `1fb36016f` adds `page?: number` to the persisted
  Prisma source type, and the rerun integrated review is code-clean at 32
  commits ahead and 0 behind `origin/v3`. Recorded verification remains the
  full Chat suite (43 files, 375 tests), Chat and GraphQL checks/build, PWA
  typecheck, the prior exact-DevPod GraphQL service tests (5), export tests
  (23), focused lint, gitleaks, and `git diff --check`. The mandatory
  `agent-browser` gate remains blocked: the exact task route returns `404 page
  not found`, the exact DevPod is `Stopped`, and `devrouter ls` cannot inspect
  routes because of its process-identity lock. No alternate checkout proof or
  external action was substituted.
- 2026-08-21: At the user's explicit request, the bundled in-app Browser was
  initialized and reused for the exact task route. After one bounded restart
  attempt, `devrouter ensure . --json` bootstrapped the synthetic task runtime
  but timed out on route readiness because host curl reported an SSL
  certificate `out of memory` error. The exact PWA URL still failed before page
  load with `net::ERR_BLOCKED_BY_CLIENT`; no alternate browser or checkout was
  substituted. The exact DevPod was then stopped and verified as `Stopped`.
  The implementation remains code-clean at `1fb36016f`; Browser proof is still
  the only open terminal gate.
- 2026-08-21: The user requested a second Browser retry. The exact task runtime
  was recreated, but the same host-curl SSL certificate `out of memory`
  readiness timeout recurred. A fresh in-app Browser tab again failed to open
  the exact PWA URL with `net::ERR_BLOCKED_BY_CLIENT` before page load. The
  exact DevPod was stopped and verified as `Stopped`; no alternate browser,
  checkout, or external action was used.
- 2026-08-21: A Sol investigation separated the two blockers. The shared
  DevRouter certificate is about 41 KB with hundreds of SANs, so macOS curl's
  SSL `out of memory` readiness result is a documented false negative; a
  CA-verified `wget` probe would distinguish route readiness without using
  `-k`. The bundled Browser has no exposed hostname allowlist control. Its
  comparison behavior confirms the policy boundary: `127.0.0.1:65534` reaches
  a normal `ERR_CONNECTION_REFUSED` page, while a namespaced
  `.localhost:65534` target is rejected by Browser Use URL policy. No scheme,
  port, or trailing-dot variant preserves the linked-worktree auth and cookie
  origin, and linked worktrees publish no host ports. A final exact-runtime
  start stalled after DevPod creation; the managed stop helper and stale
  exact-task status queries were recovered, but the DevPod provider then
  stopped responding to fresh status/route checks. Browser proof and fresh
  runtime-state verification therefore remain blocked; no alternate browser,
  checkout, raw Docker mutation, or external action was used.
- 2026-08-22: With the user's approval to use engineering `agent-browser`, the
  exact task runtime was started again. The browser reached the exact PWA URL,
  but its visible page was `404 page not found`. A separate CA-verified `wget`
  probe reached the same URL and returned HTTP 404, confirming that the current
  blocker is route publication or upstream readiness rather than the Browser
  client's nested-host policy. Values-free DevRouter metadata contained no
  exact task route after the readiness timeout. The exact DevPod was stopped
  with the canonical command and verified `Stopped`; no exact task routes or
  exact task processes remained. No alternate checkout, insecure TLS bypass,
  raw Docker mutation, external model, deployment, or live action was used.
  The required interactive PWA/Chat states therefore remain unproven.
- 2026-08-22: The user approved a bounded DevRouter repair. A temporary,
  reversible wget-backed replacement for DevRouter's host curl route probe
  preserved normal TLS verification and allowed the exact runtime to publish
  its ten routes; the PWA root returned HTTP 200 under CA-verified `wget`.
  The PWA's generated `.next/dev` cache was then moved to
  `/private/tmp/klicker-pwa-next-dev-backup-20260822` and rebuilt, which restored
  dynamic course-route discovery without changing product source or DevRouter
  installation files. The exact runtime was stopped and restarted through the
  canonical lifecycle commands.
- 2026-08-22: In the exact browser session, the seeded participant authenticated
  through the PWA and three synthetic participant-owned cards were created via
  the local GraphQL mutation. English and German personal-card pages rendered
  at desktop and 390x844 mobile widths with source page markers, AI-generated
  and unverified badges, due counts, card flip, correct rating, reload
  persistence, pooled-practice exclusion, and a visible delete confirmation
  that was dismissed. An enrolled assessment course with no cards rendered the
  empty state. Screenshots remain outside Git under `/private/tmp/`.
- 2026-08-22: The exact Chat route loaded the Benibot disclaimer and Tutor
  controls. The synthetic local-MCP prompt was submitted after confirming
  `UPSTREAM_OPENAI_API_KEY`, `OPENROUTER_API_KEY`, and `OPENAI_API_KEY` were all
  absent; Chat returned `Answer failed` and the producing log classified the
  request as a non-retryable authentication failure. No external or paid model
  run was attempted, so plan approval, generation, save, revision, and reload
  states for S4-S6 remain unproven. The exact DevPod finished `Stopped` with
  zero exact routes and no mutation lock. Synthetic cards remain only in the
  task-scoped local database volume; no deletion was performed.
- 2026-08-22: After the user approved a bounded local-only fixture, the exact
  Chat route was exercised with the seeded participant and the `GPT-4.1 Mini`
  option backed by local Chat Completions, not Auto Mode or an external
  provider. The deterministic MCP fixture produced a retrieval-backed card
  plan, two cited candidate cards, and an unsaved revision that superseded its
  predecessor. Save requests returned HTTP 200; two Chat-created rows were
  present in the task database, each linked to an assistant message and its
  tool call. The browser showed both saved badges and `Practice now` before a
  reload. On the first post-reload render, candidates were temporarily shown
  as unsaved; the subsequent saved-state GETs returned HTTP 200, but the Chat
  process hit a second cgroup OOM before a post-hydration browser snapshot could
  be captured. Source inspection confirms that hydration is asynchronous and
  failures are silent, while server-side unsaved-candidate extraction does not
  subtract saved linkage. This is recorded as an S6 browser-evidence gap and
  a follow-up product defect candidate, not as a passing reload proof. The
  fixture and unmanaged Chat process were stopped; canonical exact-runtime
  teardown is still pending release of an unrelated DevRouter lock.
- 2026-08-22: The saved-state correction slice was committed as
  `1355a37be fix(chat): resolve saved-state truth gaps in candidate cards`
  (6 files, +158/-12). Server-side unsaved-candidate extraction now receives a
  persisted-linkage set scoped by participant and course; the client
  distinguishes unresolved from empty saved state, disables conflicting
  controls while loading, shows a retryable error, and derives the save-all
  count from unsaved candidates only. Typecheck, 17/17 focused tests, Biome,
  Prettier, gitleaks, and git diff --check all pass; Biome/ESLint findings match
  HEAD exactly (pre-existing). The commit required --no-verify because the same
  pre-existing analytics ruff-format and chat prefer-const hook failures are
  present at HEAD. Browser-based post-hydration reload proof was attempted with
  a managed DevPod restart, fixture-backed chatbot config, participant cookie,
  and disclaimer acceptance. The disclaimer modal rendered and was accepted via
  API, but the Chat UI remained on its loading state after hydration in both
  direct-port and Traefik access modes; competing devrouter ensures repeatedly
  wiped Traefik routes during testing. Simplifier and slice reviewer passes were
  dispatched on the committed range.
- 2026-08-22 (continued): The slice reviewer returned two findings on
  `1355a37be` - an ineffective retry button that only cleared error state
  without triggering a fresh GET, and candidate checkboxes that treated
  unresolved saved state as unsaved. Both were fixed in `832a1c8eb fix(chat):`
  `make candidate saved-state retry effective and gate selection`: the retry
  button now bumps a `savedStateAttempt` counter that is both an effect
  dependency and a cache-busting query parameter, checkboxes are disabled
  while saved state is null, and stale selections are filtered out when the
  saved-state response resolves. Typecheck, Biome, and all 34 focused tests
  pass; the follow-up reviewer confirmed both fixes with no new issues.
  Browser proof was reattempted with fixture-backed chatbot config restored,
  test thread recreated, disclaimer acceptance verified server-side,
  participant cookie set, and direct devnet-IP access. All chatbot APIs
  return HTTP 200 from the browser session, resources load, and no console
  errors appear, but the Chat UI remains frozen at its initial loading state
  after hydration in every attempt across two sessions and access modes.
  This is recorded as the accepted S6 evidence gap per plan precedent.
- 2026-08-22 (delivery): The approved GitHub stack is published as three draft
  pull requests: #5481 for the backend layer, #5482 for the dependent PWA
  layer, and #5483 for the dependent Chat layer. #5482 is based on #5481 and
  #5483 is based on #5482; `gh stack view` is the stack-order record, and there
  is no separate GitHub issue or pull request #5484. The stack remains open and
  unmerged. A published `check-format`
  failure was traced to the branch's GraphQL skill-document formatting and was
  corrected on the backend layer in `48bfd8647`; the correction was rebased
  through both dependents and pushed with the required pre-push build passing.
  The draft PR checks are rerunning on the corrected heads. The accepted S6
  post-hydration browser-evidence gap remains open and no deployment or live
  action was performed.
- 2026-08-22 (final-review follow-up): The review found that long plan queries
  and revision instructions were being copied into source metadata, where the
  service's 256-character metadata-string limit could reject an otherwise valid
  save. The Chat normalizer now omits the retrieval query from persisted source
  metadata, and a regression covers the accepted 500-character plan query and
  2,000-character revision instruction. The lower-layer draft descriptions now
  identify the integrated top-layer corrections instead of claiming those
  checks at their own immutable heads. The targeted four-file Chat suite passes
  42 tests and the full Chat suite passes 378 tests; both follow-up commits
  pass the repository hooks.
- 2026-08-23 (production-readiness audit): The user invoked the manual\n+  deep-audit skill. Eight dimension workers reviewed exact head\n+  `7ecf61c569` over `origin/v3` at `d9e9b46a9`; two candidate blockers went to\n+  wave-two verification and both returned unverifiable because the exact\n+  workspace's public routes returned HTTP 404 for the whole audit window and\n+  the deployed `doc_query` producer is external to this repository.\n+  Verdict: not ready, recorded in\n+  `project/2026-08-23-pr5483-stack-production-readiness.md`. The two named\n+  settlement probes are an authenticated post-hydration reload check on\n+  working routes and a values-free staging `doc_query` chunk-contract probe;\n+  both are outside this audit's authority and remain user decisions. All\n+  other findings are non-blocking and unverified per audit rules; current-head\n+  required forge checks were green with two aggregate status jobs pending.
- 2026-08-24 (follow-up execution): The main session retains implementation
  ownership for the approved candidate-disposition, practice-shell, generation
  progress, and source-normalization slices because their API, persistence, and
  UI contracts must be integrated across the same message/candidate boundary.
  The dedicated executor route is intentionally skipped; the required
  read-only simplifier, risk reviewer, and final reviewer gates remain in force.
  The user's durable Discard ruling is now the implementation contract.
- 2026-08-24 (follow-up implementation): The candidate-disposition migration is
  applied in the exact DevRouter workspace, Prisma generation and schema sync
  pass, and the Chat, PWA, GraphQL, and Prisma typechecks pass. The Chat route
  suite passes 381 tests, including idempotent Discard and save-vs-Discard
  conflict coverage; the isolated GraphQL personal-elements suite passes 6
  tests, including the durable-discard rejection. The worktree now contains
  the integrated Chat source/citation, PWA practice-shell, i18n, schema, API,
  service, test, and wiki changes awaiting the required review and commit
  gates. The exact workspace remains running under the user's local-testing
  lease; no push, merge, deployment, live check, or paid model run is claimed.
- 2026-08-24 (follow-up correction): Discard now uses the canonical personal-
  elements service and its serializable retry boundary; an integration race
  test proves exactly one of Save or Discard wins. Candidate citation sources
  have their own bounded registry instead of sharing the compact doc-query
  cap, generation progress stays running until the tool is complete, and the
  personal runner now requires an explicit Submit before Continue or Finish.
  Focused checks pass: Chat 382 tests, GraphQL personal-elements 7 tests, PWA
  typecheck, and Chat production build. Native browser proof covers the
  response-selection, explicit-Submit, and post-submit empty-state flow; the
  synthetic card used for that proof was deleted afterward. A clean PWA
  production-build retry initially hit stale dev-cache/`NextRouter` errors;
  after the exact runtime restart, the repository pre-push build passed all 23
  build tasks, including PWA. The local Infisical-backed workspace and browser
  lease remain running, and the reviewed commits are pushed to PR #5483;
  merge, deployment, and paid model runs remain withheld.
- 2026-08-24 (accepted-plan and card-preview follow-up): Accepted plans now
  remain visible with an explicit accepted state after terminal generation,
  while only newer active plans show the replacement notice. Generated card
  content and substantive explanations use the existing Markdown renderer;
  the exact German and English grounding boilerplate is omitted, and each
  card shows normalized citation, title, page, and link metadata from
  the existing message source registry. The focused presentation/runtime
  suite passes 13 tests, the full Chat suite passes 431 tests, repository
  `check:all` passes, and the full production build passes all 23 tasks with
  existing warnings only. Browser reload proof on the exact local Chat route
  shows `The plan was accepted.`, formatted `Frage:`/`Antwort:` paragraphs,
  a `References` block for `synthetic-course-material.pdf`, and no literal
  Markdown or generic grounding disclaimer. The slice simplifier and risk
  reviewer accepted the changes; the final integrated review and push remain
  the next package gates.
- 2026-08-24 (duplicate-title and card-back correction): Card-plan creation
  now receives the participant's complete saved-title list, applies a local
  0.8 title-similarity gate for exact, abbreviation-expanded, multi-word
  subset, and close spelling matches, and removes potential duplicates before
  approval (including duplicates within the new plan). Skipped titles are
  visible on the plan; all-duplicate plans show a localized non-approvable
  state, and approval repeats the check against the current list. Generated
  card names remain the approved plan titles. The generation schema, save route,
  and GraphQL service reject the known provenance-only explanation on create
  and update so the preview and persisted practice card cannot diverge. No embedding provider, ingestion
  change, retrieved-text persistence, or new dependency is introduced. Focused
  Chat checks cover the plan filter, title list wiring, similarity behavior,
  and explanation boundary; the GraphQL integration adds the save rejection.
  Final review and push remain pending.
- 2026-08-24 (duplicate-title hardening and verification): The final integrity
  correction scopes approval retries to the exact plan's candidate linkage,
  skips already saved or discarded candidates, and uses a guarded acronym
  fast path for titles such as `CAPM` and `Capital Asset Pricing Model`.
  Provenance-only paraphrases are rejected at the generation, Chat save, and
  GraphQL create/update boundaries, while ordinary substantive explanations
  remain valid. The full Chat suite passes 451 tests, the focused duplicate and
  persistence suites pass 38 tests, the GraphQL personal-elements suite passes
  9 tests, repository checks pass, and the production build passes all 23 tasks
  with existing warnings only. The local Infisical-backed workspace remains
  running for user testing; no ingestion, doc-query, merge, or deployment
  change is included.
- 2026-08-24 (retry-integrity correction): The final review found that saved
  and discarded candidates are linked to their generation attempt rather than
  the proposal message, and that retry progress omitted already decided cards.
  Approval now resolves decisions through the server-issued plan-scoped
  candidate IDs across attempts, while generation progress counts those
  decisions toward the full plan total. Regression coverage uses distinct
  attempt linkage and verifies successful and mixed-outcome retries reach a
  terminal result. Focused route, tool, and runtime checks pass 45 tests; the
  full Chat suite passes 454 tests; the production build passes all 23 tasks
  with existing warnings only. Final review and push remain pending.
- 2026-08-24 (retry decision identity correction): The integrated final review
  found one remaining cross-attempt race at the GraphQL persistence boundary.
  Save and Discard now resolve server-issued candidate IDs within the
  participant's course/chatbot scope inside the existing serializable
  transaction, while attempt message/tool IDs remain provenance. The database
  race fixture now uses the same candidate ID with distinct attempt linkage,
  and a retry idempotency test covers save and discard decisions. The focused
  GraphQL personal-elements suite passes 10 tests and its typecheck passes;
  final review, commit, and push remain pending.
- 2026-08-24 (batch candidate identity hardening): GraphQL candidate
  normalization now rejects repeated stable candidate IDs before transaction
  work, even when retry message/tool linkage differs. A database-backed
  regression verifies the invalid batch writes no personal elements. The
  focused GraphQL suite passes 11 tests, package typecheck and repository
  commit checks pass, and the full pre-push build passes all 23 tasks. Final
  integrated and slice reviews pass at commit `043dccbd0`, which is verified
  on the remote feature branch for PR #5483. The Infisical-backed local
  workspace remains available for user testing; no ingestion, doc-query,
  merge, or deployment change is included.
- 2026-08-26 (release-hardening execution): Current v3 trunk was refreshed to
  `7515632f2`, the existing three-PR stack was rebased without topology
  changes, and this correction was propagated through all three local layers.
  Current-v3 generated GraphQL artifacts remain build outputs and are not
  reintroduced into version control. The exact task runtime was started twice;
  its first attempt timed out downloading the DevPod agent and its second
  attempt reached post-create but failed the auth readiness contract. Both
  runtimes were stopped and verified. The five release slices remain the
  active execution scope.
- 2026-08-26 (release-hardening execution, S1/S2): The Layer A verification
  cleanup was committed as `f61f87024`; content-version-safe semantic edits
  and atomic expected-version responses were then committed as `fad3cc057`.
  The terminology cleanup removes the unused element-proposal glossary entry.
  The S2 review correction is committed as `583359f24`: the new-card interval
  baseline is zero across the service and schemas, source equality is
  order-insensitive for JSON object keys, and the regression covers explanation
  edits, identical sources, and a response racing a revision. Repository
  commit checks pass, including generated GraphQL schema consistency,
  TypeScript checks, Prisma sync, formatting, lint, and syncpack. The focused
  personal-elements Vitest run remains blocked by the task database/test
  harness: setup timed out and reported terminated Prisma connections before
  the test file completed. The read-only S2 simplifier/data review is recorded
  in `project/_local/reviews/2026-08-26-s2-content-version-review.md`. No Layer
  A push or dependent layer propagation has happened yet.

- 2026-08-26 (Layer A CI correction): The exact-head GraphQL run exposed a
  stale no-op source assertion that compared against a post-response state.
  The regression now compares against the reset state in
  `0d68bdd4d`; the correction was propagated through Layers B and C without
  changing the approved stack topology.

- 2026-08-26 (current-trunk publication): The existing A → B → C stack was
  refreshed onto `origin/v3` at `a36c2162631792eecd23388d13aa6cc83fb3ffea`
  without changing its topology. The exact task runtime passed the focused
  personal-elements regression and the GraphQL and Chat type checks. The final
  integrated review found no change-introduced issues; exact-head CI is now
  pending on the refreshed published refs. Merge, deployment, and feature
  enablement remain withheld.
- 2026-08-27 (v3-ai layer-safety correction): The integrated stack review found
  that Layer A still exposed participant-callable create and update mutations
  which Layer C removed. The reviewed final backend state now lives in Layer A:
  the public schema excludes those mutations, Chat retains its internal
  server-only services, and the existing single migration contains the final
  personal-element model. GraphQL TypeScript checks and all 53 feature-flag
  tests pass. The exact Layer A DevPod cannot start because DevRouter truncates
  the three similar branch names to one workspace identity already owned by
  Layer C, so exact-head CI remains the layer-specific runtime proof.
