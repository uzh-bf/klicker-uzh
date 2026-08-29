# Personal elements: backend boundary and Chat simplification plan

## Goal and status

Correct the existing student-generated practice-elements stack so that the
backend owns personal-element business rules and Chat calls those rules through
generated GraphQL operations.

This plan also removes language-specific retrieval and presentation heuristics,
reduces the Chat route and supporting modules, and keeps one small extension
seam for future personal-element types.

Status: S1 through S6 and the 2026-08-29 grounded-generation follow-up are
complete and published on pull request #5483. S7 is approved and in progress on
the existing top worktree. No deployment, migration, or stack integration is
authorized.

## Plan identity and prior decisions

This is a corrective execution plan for the existing stack:

| Layer | Branch | Pull request | Purpose |
| --- | --- | --- | --- |
| A | `rs/student-generated-practice-elements-a` | #5481 | Personal-element schema, services, and GraphQL API |
| B | `rs/student-generated-practice-elements-b` | #5482 | Student practice experience |
| C | `rs/student-generated-practice-elements-plan` | #5483 | Retrieval-backed card planning and generation in Chat |

The product contract remains in
`project/2026-08-21-pr-5481-student-generated-practice-elements-plan.md`.
This plan supersedes the backend-boundary and retrieval-policy decisions in
`project/2026-08-24-student-generated-practice-elements-simplification-plan.md`.
In particular, Chat must no longer import a server-only GraphQL package entry,
and `retrievalPolicy.ts` must not remain shared infrastructure.

The Sol planner report is recorded locally at
`project/_local/reviews/2026-08-27-personal-elements-backend-boundary-planner.md`.

## Execution contract

The original S0 through S6 authority and stack state are historical and remain
recorded in Progress. They do not govern the proposed S7 follow-up.

One approval of this reviewed S7 plan authorizes the package execution
orchestrator to:

- edit only the existing top worktree and update generated GraphQL artifacts;
- reuse the already running Infisical-backed local runtime, staging doc-query
  tunnel, seeded synthetic account, and external model for one bounded browser
  generation check;
- run focused and repository-native verification, required reviews, and plan
  Progress updates;
- create local conventional commits on
  `rs/student-generated-practice-elements-plan`;
- push the exact reviewed head to
  `origin/rs/student-generated-practice-elements-plan` and update pull request
  #5483 to describe the whole branch.

Approval does not authorize upstream integration, another stack cascade, a
physical database migration, non-synthetic or production data, merge,
deployment, release publication, branch or worktree deletion, or a broader
external model evaluation. The current branch head is
`cce6e445134f6130b0a32d5dcb4e9f826c8354dd`, matches its upstream, and is
nineteen commits behind and one hundred sixty-seven commits ahead of
`origin/v3`. S7 must pass on this base first; any later integration remains a
separate decision.

The terminal condition is the reviewed S7 behavior committed and pushed at one
exact head, pull request #5483 updated, deterministic checks passing, the single
bounded synthetic staging browser run recorded, and the existing local runtime
left available for user testing. A provider or tunnel failure is reported as
delivery-pending evidence rather than hidden or replaced with a mocked claim.

## Review findings

### Standards review

The implementation violates the intended layer boundary:

- Chat imports `@klicker-uzh/graphql/dist/server` and calls backend services
  directly.
- `cardGeneration.ts`, `cardDecisions.ts`, and `lease.ts` assemble durable
  personal-element state and enforce product rules inside Chat.
- the Chat route remains a large integration surface even after extraction;
- generation and revision repeat retrieval, source, and structured-output
  logic;
- the type discriminator is a useful extension seam, but the surrounding
  workflow is more general and more distributed than the current feature
  needs.

### Specification review

The current behavior also misses approved contracts:

- retrieval is suppressed through hardcoded English and German phrase lists;
- generated candidate payloads are serialized into later model context even
  though unsaved-candidate revision was deferred;
- the aggregate source-size limit is enforced only when saving, so an invalid
  candidate can render before the backend rejects it;
- title duplicates are screened in Chat even though the authoritative saved
  set and the final write both live in the backend.

### Additional language-specific logic

Deleting only `retrievalPolicy.ts` would leave the same design problem in
other files. The correction must also remove language-specific intent patterns
and provenance-disclaimer filters from Chat contracts, backend validation, and
candidate presentation. Generated content is validated structurally, not by
matching English or German sentences.

## Product primitives and scope

| Concept | Decision | Impact |
| --- | --- | --- |
| Personal element | Keep the existing participant-owned course item. | No replacement model or parallel content table. |
| Card plan | Keep it as transient conversation state. | Do not persist a new plan domain object. |
| Generated card | Keep it as a transient tool result until Save. | Do not add a candidate table. |
| Save and Discard | Keep the existing durable lifecycle. | The backend is the sole authority and Discard remains persistent. |
| Generation lease | Keep it as operational coordination. | Do not expose it as a user-facing product concept. |
| Element type | Keep one `type` discriminator with `FLASHCARD` now. | Future types add one backend validator and one renderer, not a workflow framework. |
| Source material | Reuse the external course resource as the referenced object. | Do not copy its body or make Klicker a second source-material store. |
| Element source reference | Extend the existing bounded personal-element source metadata into one durable, element-owned value per source material. | Persist source identity, a display snapshot, exact locator spans, and internal chunk lineage; render it as a citation. |
| Citation | Compose the element source reference with the existing source-preview UI. | It provides generation context, not correctness, entailment, availability, or lecturer review. |

S7 adds no database model, column, enum, or physical migration. It changes the
typed value stored in the existing `PersonalElement.sources` JSON field from
one flat entry per chunk to one grouped element source reference per source
material. A reader-side compatibility normalizer keeps already saved prototype
rows usable: the GraphQL service boundary accepts old flat entries and new
grouped references, returns the grouped shape, and writes only the grouped
shape. The later lecturer slice is expected to add Element-owned storage and
will own its separately reviewed migration.

## Target architecture

### Backend ownership

The GraphQL service layer owns:

- participant, chatbot, course, message, and personal-element authorization;
- course participation, feature eligibility, and course language;
- the complete list of saved card titles;
- title normalization, plan-level duplicate screening, per-candidate
  similarity checks, and the final save-time duplicate check;
- plan lineage, active-plan validation, candidate identity, source limits, and
  type-specific payload validation;
- generation claim, completion, abort, retry, and reload state;
- Save and Discard idempotency and concurrency behavior;
- saved-element revision, version conflicts, and scheduling effects;
- interpretation of the persisted Chat tool result used by Save and Discard.

The final duplicate check runs in the same serializable transaction as Save so
that two accepted candidates cannot pass a stale read and create duplicates.

### Chat ownership

Chat owns:

- model selection, tool invocation, response streaming, credits, and generic
  message and thread persistence;
- the `doc_query` call and raw retrieved chunks;
- checking that every cited source identifier belongs to that card's current
  retrieval result;
- rendering plans, candidates, Markdown, references, and individual Save or
  Discard actions;
- conversation branch selection and generic AI history projection.

Raw retrieval chunks stay inside the Chat/model boundary. GraphQL receives only
the compact candidate payload and bounded element source references needed to
validate and save the result. No excerpt or source body is copied into the
generated-card tool result, GraphQL payload, or PersonalElement.

Chat must not query or mutate `PersonalElement`, `PersonalElementDiscard`, or
`CardGenerationLease` through Prisma. It must not import internal GraphQL
services or reconstruct backend lifecycle state from several service calls.

### GraphQL outcome surface

Keep the existing personal-element list, practice response, and delete
operations. Add only the outcome-oriented operations required by Chat:

| Outcome | Required backend result |
| --- | --- |
| Prepare a card plan | Authorize the context; return course language and the complete saved-title list; assign stable candidate identities; reject duplicates within the proposal and against saved items. |
| Claim generation | Validate the accepted active plan; atomically claim or reclaim its lease; return the current saved, discarded, and retry state needed for this attempt. |
| Validate a candidate | Validate the type payload, current title similarity, bounded sources, and candidate linkage before Chat renders it. |
| Settle generation | Complete or abort only the caller's current lease attempt and preserve partial-result semantics. |
| Load generation state | Return durable saved and discarded outcomes for reload without exposing raw database rows. |
| Save a candidate | Load the persisted candidate by linkage, revalidate it, repeat duplicate checks in the write transaction, and create one personal element idempotently. |
| Discard a candidate | Persist the negative decision idempotently from candidate linkage without persisting candidate content. |
| Revise a saved item | Apply the existing expected-version and scheduling contract to an already saved personal element. |

Do not introduce a generic workflow mutation, service registry, strategy
hierarchy, or action enum to reduce operation count. Separate operations make
authorization, idempotency, and failure behavior explicit.

The complete title list is read-only model context required by the approved
product behavior. Chat applies a deterministic local similarity pre-filter to
the proposed plan so the model does not re-propose near-duplicate titles
(accepted deviation, requested by the product owner); the backend remains
authoritative and still screens the proposed plan, validates every candidate
against current data, and repeats the check inside Save.

After all callers use generated operations, remove
`packages/graphql/src/server.ts`, its build entry, and every
`@klicker-uzh/graphql/dist/server` import.

### Server-to-server authentication

After `withChatbotAuth` succeeds, Chat mints a standard participant token for
that server request with a five-minute expiry. It contains only the participant
subject, the `PARTICIPANT` role, and expiry metadata, and it is signed inside
the existing application trust boundary. Minting fails closed when `APP_SECRET`
is absent. The token stays server-only, is used only in the GraphQL
authorization header, and is never returned, persisted, or logged.

GraphQL derives the participant solely from the authenticated token. Chat does
not send an authoritative participant ID. Every operation revalidates the
published chatbot, course participation, message ownership, candidate linkage,
and personal-element ownership relevant to that outcome.

Do not add a new token-purpose claim or authentication middleware in this
package. Revisit that only if the token later leaves the trusted Chat-to-GraphQL
server path.

## Language-neutral retrieval protocol

Delete `apps/chat/src/lib/server/retrievalPolicy.ts`. Do not replace its phrase
lists with translated lists, regex expansion, language detection, or a model
classifier.

Use protocol state instead:

1. For every non-empty text or image turn where `doc_query` exists, expose only
   and force `doc_query` first.
2. Unlock normal course-grounded response tools and card-plan proposal only
   after retrieval succeeds.
3. Do not unlock evidence-dependent planning after empty or failed retrieval.
4. An explicitly approved plan enters generation directly because each
   candidate performs its own fresh forced retrieval.
5. If no retrieval tool exists, evidence-dependent planning and generation are
   unavailable rather than silently falling back to model knowledge.

This removes language from the gate and prevents uncited prose from being
treated as a generated candidate. The material trade-off is a retrieval call,
with its latency and usage cost, even for a greeting or another turn that
ultimately does not need course context. This is accepted as the smaller
deterministic first implementation; optimize only from measured cost and
latency later.

The main model may decide, after successful retrieval, whether the user wants a
normal grounded answer or a card plan. System instructions must require the
plan tool for card creation and forbid emitting candidate cards as ordinary
assistant prose. No locale-specific intent classifier is added.

## Candidate contract and presentation

Use type-specific structural fields for Flashcards: a plan title, front, and
back. Behind the backend's exhaustive type switch, map the plan title to the
persisted `name`, front to `content`, and back to `explanation`. Do not ask the
model to produce a generic explanation field, and do not detect or hide
grounding disclaimers with sentence lists.

Before a candidate becomes visible, require:

- a non-empty front and back within existing length limits;
- at least one source and no more than the approved maximum;
- every source identifier to belong to that card's current retrieval result;
- aggregate source metadata within the existing byte limit;
- no current title duplicate according to the backend policy;
- valid plan, candidate, message, participant, course, and chatbot linkage.

Candidate content and sources render through the repository Markdown and
reference components. The accepted plan remains visible and is labelled as
accepted, not replaced. Each candidate exposes its own Save or Discard action,
and both outcomes survive reload.

Remove generated candidate JSON from future model history. Keep only generic
conversation content and the minimal tool state needed to show the completed
turn. Saved-element revision remains an explicit operation and does not depend
on replaying an unsaved candidate through the model context.

## Module simplification

### Backend

Keep `packages/graphql/src/services/personalElements.ts` as the owner of saved
personal-element behavior. Extract at most one adjacent generation workflow
service if the current file cannot retain a clear single responsibility after
the GraphQL move. That service may own plan, candidate, lease, and disposition
outcomes; it must not become a general workflow engine.

Use one exhaustive type switch for type-specific validation. `FLASHCARD` is the
only branch in this package.

### Chat

Keep one generated GraphQL adapter and one small personal-element orchestration
module. The route passes authenticated context and generic AI dependencies to
that module; it does not contain product state transitions.

Delete or fold the current modules whose only purpose is duplicated business
logic:

- `retrievalPolicy.ts`;
- Chat-local personal-element lease and decision services;
- Chat-local title-similarity policy;
- language-specific candidate-presentation filtering;
- the internal GraphQL server import layer.

Do not use an arbitrary route line-count target as the acceptance criterion.
The criterion is responsibility: the route owns generic Chat transport and
streaming only, while the backend owns personal-element decisions.

## ADR and wiki impact

Update the existing records instead of creating a new product model:

- ADR 0027: replace the English/German retrieval allowlist with the forced
  retrieval protocol and record its latency/cost trade-off;
- `docs/chat-platform.md`: document GraphQL-only personal-element access and
  the retrieval state machine;
- `docs/graphql-api-layer.md`: document the public Chat outcomes and remove the
  internal service-import path;
- `docs/domain-model.md`: move duplicate and lifecycle authority to the
  backend and retain the single type discriminator;
- relevant Klicker GraphQL, data-model, Chat, testing, and runtime skill pages:
  update only behavior that changed.

ADR 0026 remains valid because `PersonalElement` stays the durable participant-
owned primitive. Create no new ADR unless execution discovers a new long-lived
decision outside ADR 0027's retrieval and generation contract.

## Stack amendment and slices

### S0 — reconcile the stack once

**Problem.** The current stack trunk has moved and overlaps stack files.

**Decision.** With explicit authority, update A onto current `origin/v3-ai`,
then cascade B and C using the repository's native stack workflow. Do not merge
`origin/dev` directly.

**Acceptance.** The stack view is coherent, each branch has the expected base,
and no semantic conflict is resolved without evidence from both sides.

### S1 — expose backend planning and candidate validation on A

**Outcome.** GraphQL authorizes plan preparation, returns course context and the
complete title list, screens proposed titles, and validates each generated
candidate before rendering. The backend owns the structural Flashcard contract
and source bounds. No schema change is made.

**Primary ownership.** `packages/graphql`, focused GraphQL tests, generated
operations, and the matching API/domain documentation.

**Acceptance.** Chat no longer needs backend imports for language, titles,
duplicate policy, or candidate validation. Oversized or ungrounded candidates
are rejected before presentation.

**Commit.** `refactor(graphql): centralize personal element validation`

### S2 — complete backend lifecycle outcomes on A

**Outcome.** GraphQL owns generation claim and settlement, reload state, Save,
Discard, and saved-item revision. Save performs the final duplicate check in
its serializable transaction. The internal server export is removed.

**Primary ownership.** Personal-element services, GraphQL schema and generated
operations, concurrency and authorization tests, and GraphQL documentation.

**Acceptance.** No external package imports the personal-element services.
Claim/reclaim, partial failure, retry, Save/Discard races, idempotency, and
version conflicts are protected at the backend boundary.

**Commit.** `refactor(graphql): expose personal element workflows`

### S3 — cascade B without adding business logic

**Outcome.** Rebase the practice UI layer onto A. Change B only where the
generated GraphQL contract or persisted type shape requires it.

**Primary ownership.** Stack metadata and demonstrably affected PWA files.

**Acceptance.** Lecturer elements and personal elements still enter the
existing practice runner, and no generation business rule is introduced into
the PWA.

**Commit.** No new commit unless a real compatibility edit is required.

### S4 — replace direct service access in Chat on C

**Outcome.** Chat authenticates once, mints the short-lived participant token,
and calls generated GraphQL operations through one server-only adapter. Remove
direct Prisma and GraphQL-service access for personal-element workflow state.

**Primary ownership.** Chat authentication helper, GraphQL adapter, route
wiring, and focused adapter/authentication tests.

**Acceptance.** Repository search finds no Chat import from
`@klicker-uzh/graphql/dist/server` and no Chat query or mutation of the three
personal-element workflow models. Account, guest, and embedded sessions work;
cross-participant, cross-course, cross-chatbot, and cross-message requests
fail closed.

**Commit.** `refactor(chat): use graphql for personal elements`

### S5 — replace lexical retrieval with protocol state on C

**Outcome.** Every eligible non-empty turn forces retrieval first. Card plans
and card generation are available only from valid retrieval state. Flashcards
use structural front/back output and no language-specific intent or disclaimer
lists.

**Primary ownership.** Chat tool assembly, step policy, card-generation module,
contracts, and focused protocol tests.

**Acceptance.** Arbitrary-language text and image turns follow the same state
machine. Only a backend-validated generation tool result linked to an accepted
plan can render as a candidate, be saved, or enter practice. Missing, empty,
or failed retrieval cannot produce an evidence-dependent plan.

**Commit.** `refactor(chat): make course retrieval deterministic`

### S6 — simplify history and candidate presentation on C

**Outcome.** Remove candidate JSON from future model context, delete duplicate
business modules, and keep only Markdown, references, plan status, and per-card
actions in the presentation layer.

**Primary ownership.** Chat history projection, candidate components, route
composition, Chat tests, ADR 0027, and Chat documentation.

**Acceptance.** The accepted plan remains visible with accepted status; card
fronts and backs render Markdown; actual references appear on each card; Save
and Discard persist across reload; no language-specific presentation filter
remains.

**Commit.** `refactor(chat): simplify generated card presentation`

### S7 — fail closed and persist useful personal-element citations on C

**Observed defect.** The exact local thread returned chunk-level
`page_number`, `labeled_page_number`, and content from the staging doc-query
service. Chat read the page only from the parent source and reduced candidate
references to source and chunk identifiers, so the UI lost page and preview
context. The nested generator also required a card-shaped object and therefore
had no valid way to abstain when retrieved evidence did not support the planned
card. It produced an unusable card that discussed the retrieval container
instead.

**Generation outcome.** A generator returns either a ready, self-contained
Flashcard or a structured `insufficient_evidence` outcome with no generated
prose. Abstentions reuse the existing bounded card failure and never enter the
visible candidate list. Ready cards cite only retrieved chunk identifiers. A
narrow deterministic guard rejects exact cited chunk identifiers and reserved
protocol delimiters if they leak into user-facing card content; generic domain
terms such as “source” or “retrieval” remain valid content.

**Durable reference.** Introduce one shared `ElementSourceReference` value per
source material and use it in the existing typed `PersonalElement.sources`
JSON. Each value contains:

- the provider source identity, source kind, immutable display-title snapshot,
  and an optional safe canonical URL that contains no ephemeral credentials;
- the exact cited chunk identifiers as internal lineage, not participant-facing
  labels;
- ordered, disjoint locators: physical page spans with publisher-labelled
  endpoints for documents, or exact provider-supplied anchors for websites.

One canonical parser at the GraphQL service boundary accepts the prototype's
old flat per-chunk entries and the new grouped references, returns only the
grouped domain shape, and writes only that grouped shape. It preserves the
existing chunk-count and aggregate-byte limits and adds explicit bounds for
reference count and locator spans. Chat verifies cited chunk, page, and anchor
membership against the raw retrieval. GraphQL validates grouped shape, bounds,
participant ownership, and immutable candidate linkage without claiming it can
reconstruct raw retrieval evidence.

Chat reads numeric and labelled pages from each chunk, using parent values only
as a legacy fallback. It groups cited chunks by source material, sorts them by
physical page, and collapses adjacent pages while retaining disjoint spans such
as `p. 1–4, 7–9`. Display leads with publisher-labelled pages and includes the
physical PDF page only when it differs. Each disjoint page span or website
anchor is its own open action: a public PDF action targets that span's first
physical page, and a website action uses only the exact anchor supplied by the
provider. A filename or stale URL remains a useful snapshot but does not become
an authorized link.

No excerpt or source body is copied into the generated-card tool result,
GraphQL payload, or PersonalElement. Candidate hover and focus previews use the
source title and exact locators. A link is active only when an existing
authoritative resolver proves current access or the target is demonstrably
public; persisted URLs and PersonalElement ownership are never authorization.
A removed or unauthorized source keeps its title and locators, is labelled
unavailable, and has no active action.

References are system-managed. Participants cannot add, edit, or remove one
independently, but may delete the whole card. Manual card edits retain the label
“Sources used to generate this card.” A successful AI revision atomically
replaces content and the complete reference set; abstention or failure leaves
both unchanged.

**Presentation.** Chat candidate review and personal-card management show the
full citations. Active-recall practice hides them until the answer is revealed,
then shows them through the existing source-preview component. The same rule
applies on reload. Multiple chunks from one source render as one citation, not
as implementation-level chunk rows.

**Primary ownership.** Shared source-reference types, GraphQL validation and
serialization, Chat generation and retrieval normalization, candidate and
saved-card source normalization, personal-card GraphQL operations and PWA
presentation, focused tests, `CONTEXT.md`, ADRs 0027 and 0042, and the Chat,
GraphQL, and domain-model wiki pages.

**Acceptance.** Runtime-shaped fixtures prove per-chunk pages and labels win;
structured abstention and mixed batches emit no unusable candidates, including
intermediate streams; exact protocol leakage fails closed without rejecting
legitimate generic terminology; source grouping retains exact disjoint spans;
labelled and physical page targets do not drift; each disjoint span has its own
action; only authorized public targets or provider-supplied web anchors become
links; serialization tests prove no excerpt or source body enters the generated
tool result, GraphQL payload, or PersonalElement; durable references survive
Save, reload, manual edit, and source unavailability; successful revision
replaces them atomically; candidate, management, and post-reveal practice
surfaces render the same citations. Deterministic tests gate abstention and
reference behavior. One fresh synthetic staging browser run then proves the
integrated ready-card citation, exact locator action, persistence, and
hidden-before-reveal flow without exposing real course content. Any observed
abstention is supplementary evidence, not a browser acceptance gate.

**Non-goals.** No physical database migration, ingestion or doc-query change,
lecturer Element schema change, semantic LLM judge, new evaluation dependency,
or persisted source excerpt. The private DeepEval submodule remains
uninitialized; deterministic contract tests and one synthetic real-model/browser
run are proportionate for this defect. Chapter support requires a later
ingestion and doc-query contract that emits a structured section locator; S7
does not accept or fabricate one.

**Delivery after approval.** Implement and review S7, commit it on the existing
top branch, push that exact head to `origin/rs/student-generated-practice-elements-plan`,
and update pull request #5483. Do not integrate upstream, merge, deploy,
release-publish, or delete branches or worktrees.

### Later lecturer composition — mapped, not authorized in S7

Lecturer-generated elements reuse the same `ElementSourceReference` value.
When a `GeneratedElementDraft` is saved, the transaction copies its content and
complete reference snapshot onto the resulting `Element`. The Element-owned
snapshot is authoritative for participant-facing citations, duplication, and
full-fidelity export; internal chunk lineage stays out of public export shapes.
The generation record remains workflow state and is not the durable citation
owner.

Lecturer manual edits retain “Sources used to generate this Element”; a
successful generated revision replaces the reference set atomically. Adoption
of a personal element copies its references even when a source is unavailable;
the unavailable snapshot remains visible without an open action and does not
become a correctness or review claim. Lecturer management shows citations
wherever the Element is reviewed, while participant practice follows the same
post-reveal rule as personal elements.

That later slice owns the Element schema migration, generated-draft transfer,
duplication and export projections, and cleanup of content-bearing generation
records. It must choose and enforce a bounded retention duration before release,
after proving durable transfer. No new generation-audit entity is planned:
content and references live on the Element, and required cost facts must be
preserved through the existing accounting ledger before their generation build
can be removed. Rejected, failed, or abstained workflow detail may expire. A
concrete compliance or support requirement would trigger a separate decision
before adding a receipt model.

## Delegation and review map

| Slice | Execution route | Review gate | Acceptance evidence |
| --- | --- | --- | --- |
| S0 | Main orchestrator | Stack diff inspection | Correct A/B/C ancestry and conflict disposition |
| S1 | Backend executor with exclusive GraphQL ownership | Simplifier plus architecture/data-integrity slice review | Focused service and GraphQL tests, generated schema/operations |
| S2 | Same backend executor after S1 acceptance | Simplifier plus authorization/concurrency slice review | Database-backed race and lifecycle tests |
| S3 | Main orchestrator | Review only if semantic PWA code changes | PWA focused checks and existing practice proof |
| S4 | Chat executor with exclusive adapter/auth ownership | Simplifier plus architecture/auth slice review | Generated-client and denial-path tests |
| S5 | Chat executor after S4 acceptance | Simplifier plus retrieval/AI-contract slice review | Deterministic protocol-state and tool tests |
| S6 | Chat executor after S5 acceptance | Simplifier plus UI/history slice review | Component tests and browser evidence |
| S7 | Main orchestrator; generation, durable references, and presentation are one coupled evidence contract | Simplifier plus AI/data-boundary slice review | Focused contract tests, source-body-free persistence regression, Chat and PWA browser proof |
| Integrated stack | Main orchestrator | Native `final-reviewer`, with model and provider selected through model routing | Exact-head full verification and stack diff |

Executors are not given secret values, real participant data, or unrelated
workspace material. The main orchestrator owns stack changes, integration,
generated artifacts, product decisions, authentication design, and final proof.

## Feature-wide verification portfolio

### Backend contracts

- authorize account, guest, and embedded participants while denying another
  participant, course, chatbot, message, candidate, or personal element;
- prove the five-minute participant token expires, fails closed without
  `APP_SECRET`, and is never returned, persisted, or logged;
- return the complete saved-title set and reject duplicates within a plan,
  against saved items, at per-candidate validation, and again during Save;
- prove the save-time duplicate race with database-backed concurrency evidence;
- prove active-plan, newer-plan, candidate-linkage, and plan-evidence checks;
- prove lease claim, conflict, expiry reclaim, completion, abort, partial
  terminal failure, and retry ownership;
- reject missing sources, foreign source identifiers, excessive source count,
  and excessive aggregate source metadata before rendering;
- validate the grouped reference shape, unique chunk identifiers, reference and
  locator bounds, safe URLs, ownership and candidate linkage, and the absence
  of excerpts or source bodies;
- prove Save and Discard idempotency, mutual exclusion, reload state, expected
  version, and scheduling behavior.

### Chat contracts

- force `doc_query` for arbitrary non-empty text and image turns without phrase
  or locale fixtures;
- keep planning locked after missing, failed, or empty retrieval;
- require fresh retrieval for every candidate in an approved plan;
- emit a structured abstention without a candidate when evidence cannot support
  both sides of a card;
- group only cited chunks into exact page spans, keep labelled and physical page
  positions distinct, and reject fabricated locators or foreign anchors;
- prove that ordinary assistant prose cannot be interpreted, rendered, or
  saved as a generated candidate;
- keep raw chunks inside Chat while sending only bounded candidate/source data
  to GraphQL;
- exclude unsaved candidate JSON from subsequent model messages;
- persist plan, candidate, source, Save, and Discard states across reload.

### UI and end-to-end proof

- reach personal and lecturer practice from each course's practice area;
- run saved personal cards through the same navigation and interaction contract
  as an ordinary practice quiz;
- show an accepted plan as accepted while preserving its final contents;
- render front and back Markdown without visible source syntax artifacts;
- render one citation per source material with exact disjoint labelled spans,
  and target safe links to the cited PDF page or supplied website anchor;
- show citations in candidate review and personal-card management, hide them
  before active-recall reveal, and show them after reveal;
- retain an unavailable citation snapshot without offering a stale or
  unauthorized link;
- Save or Discard each card independently and retain both outcomes on reload;
- verify relevant locales, mobile and desktop layouts, keyboard use, and focus.

### S7 primary test matrix

| Contract              | Primary seam                                               | Required evidence                                                                                                 |
| --------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Insufficient evidence | Nested generation result parser                            | Structured abstention emits no candidate in partial or final tool output.                                         |
| Legacy compatibility  | GraphQL personal-element source parser                     | Old flat entries normalize to grouped references; every new write uses only the grouped shape.                    |
| Exact grouping        | Chat retrieval adapter                                     | Only cited chunks contribute; adjacent pages collapse and disjoint spans remain distinct with labelled endpoints. |
| Source-body exclusion | Tool-result, GraphQL-request, and Prisma-write serializers | No excerpt, raw content, or transient preview field crosses any of the three boundaries.                          |
| Atomic revision       | GraphQL service transaction                                | Success replaces content and all references; failure or abstention changes neither.                               |
| Link authorization    | Source-reference presenter                                 | Public exact targets open; protected, signed, stale, or unproven targets stay unavailable.                        |
| Recall timing         | Personal practice runner                                   | Citations are absent before reveal, present after reveal, and remain correct across navigation and reload.        |

Delete brittle tests that assert phrase lists, copied title algorithms, or
presentation disclaimers. Consolidate evidence at the backend service boundary,
the thin GraphQL adapter, the retrieval state machine, and observable UI seams.

## Verification sequence

Run repository-native commands inside the managed devrouter container:

1. regenerate the GraphQL schema, operations, and client artifacts;
2. run focused GraphQL service and integration tests, then GraphQL check and
   build;
3. verify A at its exact head after S1 and S2;
4. run B's focused checks and build at its exact head after S3, even when the
   cascade required no compatibility edit;
5. run focused Chat and PWA tests, then their checks, lint, and builds, and
   verify C at its exact head after S4 through S7;
6. run root formatting, type, lint, sync, test, and build gates appropriate to
   the final diff;
7. verify Prisma schema equivalence, analytics synchronization, and that the
   stack still contains exactly the intended single migration;
8. inspect the exact stack diff and staged data for unrelated changes,
   credentials, personal data, and generated-file drift.

For frontend proof, reuse the already running exact-worktree runtime and use
`agent-browser` with seeded synthetic users. Capture the changed Chat and PWA
states across relevant viewports and locales. If the runtime or existing tunnel
requires restart or re-establishment, record browser proof as
`delivery_pending` and stop; S7 approval does not authorize a new connection.

An Infisical/OpenRouter-backed model run is a separate external-provider and
secret-use boundary and is not required for the local S5 gate. If authorized,
use only seeded synthetic course material and verify the producing run's tool
calls, retrieval result, citations, candidate validation, persistence, and
reload state. A local component render or mocked test is not live AI proof.

## Risks and stop conditions

| Risk | Control | Stop condition |
| --- | --- | --- |
| GraphQL move changes authorization semantics | Standard participant token plus backend ownership checks | Any account, guest, or embed mode cannot be represented without broadening privilege. |
| Always-retrieve adds unacceptable latency or cost | Name the trade-off and measure one synthetic run | Measured behavior exceeds an agreed product limit; do not add a lexical fallback. |
| Candidate validation requires raw chunks in GraphQL | Keep membership checks in Chat and bounded metadata in GraphQL | A backend invariant cannot be proven without crossing the raw-content boundary. |
| Current schema cannot express an invariant | Reuse existing lease, discard, and personal-element rows first | A new migration appears necessary; revise the plan before editing Prisma. |
| Stack reconciliation changes product behavior | Integrate once, inspect conflicts, rerun affected reviews | A conflict requires a new product or security decision. |
| Operation count encourages a generic workflow API | Keep outcomes explicit and feature-scoped | Proposed abstraction serves only hypothetical future types. |
| Prompt compliance still allows a semantic paraphrase of retrieval mechanics | Combine structured abstention with exact protocol-marker checks and a synthetic browser run | A hard semantic guarantee is required; stop for a product decision before adding a model judge. |
| Citation context becomes a source-body copy | Persist only identity, display snapshot, structured locators, and chunk lineage | Any excerpt or source body enters the generated-card tool result, GraphQL payload, or PersonalElement. |
| A stored link bypasses current source authorization | Persist only safe canonical public targets; resolve protected access at request time and disable unavailable links | A signed, ephemeral, or unauthorized URL enters the durable reference. |

## Rollback

Each slice is a separate commit on its existing stack layer. Before push, a
failed slice can be corrected or reverted without rewriting other layers. After
push, use normal follow-up commits unless the user explicitly authorizes stack
history rewriting. No schema rollback is planned because this correction adds
no migration.

## Progress

- [x] Refreshed remote refs and inspected the current stack topology and drift.
- [x] Reviewed the full backend, Chat, GraphQL, persistence, documentation, and
  candidate presentation boundaries.
- [x] Completed separate Standards and Specification reviews.
- [x] Completed the Sol planner pass and correction for deterministic retrieval
  and minimal server-to-server authentication.
- [x] Recorded the language-specific policy as a stack-wide removal, not an
  isolated file edit.
- [x] Obtain approval for this execution plan.
- [x] Obtain separate authority for the one-time stack integration onto current
  `origin/v3-ai`.
- [x] S0 — reconciled the stack onto `origin/v3-ai`: A `56cda8379`, B
  `866e4e2de`, C `0d8f2c56d`; all zero behind `origin/v3-ai`; ancestry
  verified; conflicts were additive (response-example and personal-element
  schema/doc sections) and resolved with both sides retained.
- [x] S1 — implemented on A: `9505eca9c` centralizes plan preparation and
  candidate validation in GraphQL (participant-authed mutations, ported
  title-similarity policy, zod bounds, disclaimer heuristics removed);
  `b2cb52f89` aligns the generated schema with codegen order; `052bf3c74`
  aligns the exported input types with the wire contract. Verified at exact
  head in the plan container: GraphQL check, 27/27 personal-elements tests,
  and build pass; the two activitySharing failures are pre-existing
  test-isolation flakes in a file the stack does not touch. GraphQL package
  byte-identical across A/B/C after cascade.
- [x] S1 review gates — simplifier and architecture/data-integrity slice
  review both returned PASS_WITH_CONCERNS (disclosed fallback route after
  provider credit exhaustion). Dispositions committed on A as `1e55b7adb`:
  `validateCardCandidate` now returns `Boolean!` (result wrapper removed),
  `CardPlanEntryInput.type` uses the `ElementType` enum, plan preparation
  authorizes and loads language in one query, docs/JSDoc no longer overclaim
  a save-transaction duplicate check (S2 implements it), and tests added for
  the 64 KiB aggregate bound, non-FLASHCARD type, and >5-card plans (30/30
  pass). GraphQL check and build pass at the new head; package byte-identical
  across A/B/C.
- [x] S2 — implemented on A: `7f7d0edaa` exposes the full lifecycle as
  participant-authed GraphQL mutations (claim/complete/abort lease, Save,
  Discard, revision) with the final title-similarity duplicate check inside
  the save transaction; `8af4a8677` aligns the generated schema; `d8b5d0eb3`
  aligns the workflow input types with the wire contract and retries Prisma 7
  serialization conflicts (DriverAdapterError TransactionWriteConflict) so
  the concurrent-save race resolves to PERSONAL_ELEMENTS_DUPLICATE_TITLE.
  Verified at exact head in the plan container: GraphQL check, 36/36
  personal-elements tests (including the DB-backed save race and lease
  lifecycle), and build pass. GraphQL package byte-identical across A/B/C
  after cascade; the docs/domain-model.md conflict during the C cascade was
  resolved keeping the S2 lifecycle paragraph and the Chat-side
  CardGenerationLease paragraph.
- [x] S2 review gates — simplifier and authorization/concurrency slice
  review both returned PASS_WITH_CONCERNS (disclosed fallback route after
  provider credit exhaustion). Dispositions committed on A as `0ea1edf9d`
  (saved-title fetches consolidated into one helper, mixed-batch duplicate
  bypass fixed by screening only missing candidates, explicit null source
  fields normalized before persistence, shared lease-settlement schema,
  abort refuses expired leases, dedicated candidate-batch constant, inline
  CardGenerationLease ref, serialization-conflict comment) plus `06d98b06c`
  and `6390149ec` (null normalization and key omission so persisted Json
  matches the parsed shape). Three regression tests added (mixed-batch
  duplicate screen, expired-lease abort, null update fields). Verified at
  exact head in the plan container: GraphQL check, 39/39 personal-elements
  tests, and build pass; the two activitySharing failures are the
  pre-existing test-isolation flakes. GraphQL package byte-identical across
  A/B/C after cascade.
- [x] S3 — cascaded B onto the new A head twice (disposition and
  null-normalization commits). B's PWA content is byte-identical to the
  previously reviewed head `33291fb8a` (zero diff outside the GraphQL
  package, which is identical across the stack), so no compatibility edit
  and no new B commit were required. B head `df8a465af` is an ancestor of
  C; C's unique commits were replayed onto it.
- [x] S4 — implemented on C: `fc22dff76` replaces direct service access in
  Chat with a server-only GraphQL adapter (graphqlClient.ts: five-minute
  participant JWT via signJWT, persisted-query calls with Bearer, CSRF,
  and origin headers, typed wrappers for the seven generated operations)
  and rewires lease, card-decision, tool, and generation modules plus the
  personal-elements route to it. Three Prisma-backed read helpers stay
  inside the adapter (getGenerationLeaseState,
  listDiscardedCandidateIds, listCompletedGenerationLeaseAttemptTokens)
  because the GraphQL surface exposes no read operations for those states;
  both reviewers accepted this deviation. The adapter pins
  PersonalElementOrigin.AiGenerated and compactElement tolerates an
  optional nextDueAt. Verified at exact head in the plan container: 71/71
  Chat tests across the six touched files, Chat check and lint pass, GraphQL
  check and build pass; the two modelRegistryParity failures are
  pre-existing.
- [x] S4 review gates — slice review and simplifier both returned
  PASS_WITH_CONCERNS (disclosed fallback route after provider credit
  exhaustion). Dispositions committed on C as `4788f6dc5`: compactElement
  now passes nextDueAt through as the wire string instead of calling
  toISOString() on it (regression test added with a non-null string),
  unused getGraphqlEndpoint and PersonalElementGraphQLError exports
  dropped, and the adapter test now asserts the persisted-query hash plus
  CSRF and origin headers. The empty packages/graphql/src/server.ts and
  its rollup input were removed on A (`fa1161556`, `38fe7a033`) and
  cascaded through B (`508fa4821`) to C (`c6852d140`); the GraphQL package
  is byte-identical across the stack and no @klicker-uzh/graphql/dist/server
  import remains. Verified at exact head in the plan container: 27/27
  affected Chat tests, full Chat suite 88/90 (two pre-existing
  modelRegistryParity failures), Chat check and lint pass, GraphQL check
  and build pass.
- [x] S5 — implemented on C: `7b917d61a` deletes retrievalPolicy.ts and
  replaces the lexical policy with deterministic protocol state:
  retrievalRequired = hasImage || non-empty text; doc_query is forced first
  and only doc_query; propose_card_plan and grounded tools unlock only after
  a chunked retrieval result; the terminal course_retrieval_unavailable
  tool fires after two failed attempts; the isCardGenerationRequest intent
  classifier and its four regexes are gone; stopWhen ends on
  propose_card_plan whenever generation is eligible; the saved-title list
  loads lazily through the plan tool; generationCandidateSchema is
  structural type/title/front/back/citedChunkIds with the boundary mapping
  title-to-name, front-to-content, back-to-explanation; isGroundingDisclaimer
  and the disclaimer refine are removed from contracts. Verified at exact
  head in the plan container: 52/52 focused tests, full Chat suite 88/90
  (two pre-existing modelRegistryParity failures), Chat check and lint pass.
- [x] S5 review gates — simplifier and retrieval/AI-contract slice review
  both returned PASS_WITH_CONCERNS with no P1 (disclosed fallback route
  after provider credit exhaustion). Dispositions committed on C as
  `3c125b575`: the eager saved-title fetch (a new per-turn GraphQL call
  that could 500 ordinary Q&A) is removed in favor of the lazy getter the
  plan tool already used, the duplicateCheckRequired alias is inlined, and
  two focused tests added (non-eligible stopWhen, no-doc_query-tool
  lockout). Verified at exact head in the plan container: 54/54 focused
  tests, Chat check and lint pass.
- [x] S6 — implemented on C: `07098905d` removes the generatedCards
  extraction from serializeMessageContent so tool-call candidate JSON no
  longer enters future model messages (only text parts serialize), deletes
  candidatePresentation.ts and its test (the only language-specific
  presentation filter), and renders candidate.explanation unconditionally
  through the existing Markdown component. Docs corrected in the same
  commit: ADR 0027 replaces the EN/DE retrieval allowlist with the forced
  retrieval protocol and adds the latency/cost consequence; chat-platform
  and graphql-api-layer drop the stale allowlist, boilerplate-rejection,
  and direct-service-import claims. Verified at exact head in the plan
  container: 10/10 focused test files (91 tests), full Chat suite 825
  passed with only the two pre-existing modelRegistryParity failures,
  Chat check pass, Biome findings on the touched files byte-identical to
  the parent baseline.
- [x] S6 review gates — simplifier returned PASS_WITH_CONCERNS and the
  UI/history slice review returned PASS (disclosed fallback route after
  provider credit exhaustion). The single P2 (chat-platform overstating
  GraphQL-only access while the adapter keeps participant-scoped Prisma
  reads for lease and discard state) was verified against graphqlClient.ts
  and fixed in `4ce51cc86`; the two P3s (boilerplate can now render as a
  card back, redundant local variable) are accepted as intended
  consequences of removing the language-specific filter.
- [x] Integrated final review — native final-reviewer returned
  PASS_WITH_CONCERNS at exact top head `d0026dbbd` (disclosed fallback
  route after provider credit exhaustion). Dispositions: the retained
  Chat-side title-similarity pre-filter is recorded as an accepted
  deviation in the target architecture (product-owner-requested; the
  backend stays authoritative); a regression test was added asserting
  generate_cards tool-call parts serialize to text only (12/12 hydration
  tests pass); the Progress item for S1-S6 execution is ticked. The
  remaining P2 (browser evidence for the UI/e2e portfolio items) is
  deferred to the exact-head verification step, which is still open.
- [x] Exact-head browser verification — the plan container was running a
  stale Turbopack module graph (chat dev server started before S6 landed),
  so the dev stack was restarted through `devrouter ensure` and the
  database was reseeded (it had been reset without seed data). With the
  seeded synthetic users, agent-browser verified at exact head
  `cd9a586c7`: participant login (testuser1), the course page AI tutor
  link, the chat disclaimer flow, the loaded Benibot chat workspace with
  Tutor mode and conversation starters, the practice area with per-course
  "Lecturer elements" and "Own elements" buttons, and the own-elements
  practice route. Screenshots recorded under
  `~/.codex/visualizations/2026/08/21/01a02362-f0f4-7510-b35b-d98fb79ae7c9/s6-browser-evidence/`.
  A live AI generation run remains a separate external-provider boundary
  and is not part of this gate.
- [x] Execute S1 through S6 with their review gates and local commits.
- [x] Complete exact-head verification and the integrated native
  `final-reviewer` gate.
- [x] Obtain separate authority for push and pull-request updates.
- [x] 2026-08-29 local AI and browser follow-up — the Chat path now forces a
  language-neutral response selection after grounded retrieval, forces the
  interactive plan for card-generation requests, sends the strict shared
  `doc_query` `question` input, keeps failed plans non-approvable, and waits for
  the persisted assistant message before enabling durable Save or Discard
  actions. The PWA Finish action now returns from the personal-card runner to
  its overview. In the managed runtime, 68 focused Chat tests pass and the Chat
  and PWA type checks pass. Authenticated browser proof against the staging
  doc-query tunnel shows retrieval, an accepted final plan, generated Markdown,
  card-local references, immediately enabled actions, and a discarded decision
  surviving reload. The personal practice runner submits a rating and Finish
  returns to its overview. The user requested that this exact runtime remain
  available for further testing.
- [x] Commit the follow-up and complete integrated final review —
  `89ed57724` contains the grounded workflow and PWA Finish corrections;
  `7526371ca` resolves the review's repeated-title key and wiki-accuracy
  findings. The native final-reviewer launch failed before work because the
  harness attempted an unsupported GLM reasoning configuration, so the
  configured continuity route used GPT-5.6 Sol xhigh. Its correction pass
  returned `DONE` with no remaining material issue.
- [x] Push the exact head and update pull request #5483 — reviewed application
  head `0f3d117c2` is published, and the pull-request body now covers the
  grounded retrieval and browser follow-up with current verification and stack
  blockers. The local development runtime remains available for user testing.
- [x] 2026-08-29 S7 investigation — the exact failing thread proves the staging
  doc-query response already includes numeric page, labelled page, and content
  on every chunk. Chat currently discards those fields and the generator cannot
  abstain. The corrected slice was challenged by the planner and aligned with
  current AI SDK structured-output error handling.
- [x] 2026-08-29 citation domain grill — settled one durable element source
  reference per source material, exact disjoint labelled locator spans, safe
  physical-page or provider-anchor targets, source-body-free snapshots,
  unavailable-source retention, post-reveal practice display, and atomic
  replacement on generated revision. ADR 0042 records that saved Elements own
  copied references so content-bearing generation records can expire. The S7
  prototype remains PersonalElement-only; the later lecturer migration,
  transfer, export, and cleanup work is mapped but not authorized here.
- [x] Obtain approval for S7 implementation, local commit, push to the existing
  remote branch, and pull-request #5483 update.
- [ ] Implement S7, run its focused and browser checks, complete the slice and
  integrated review gates, push the exact reviewed head, and leave the local
  runtime available for user testing.
