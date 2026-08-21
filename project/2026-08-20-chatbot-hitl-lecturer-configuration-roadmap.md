# HITL lecturer chatbot configuration roadmap

Decisions grilled and settled 2026-08-20. Rationale lives in the ADRs — this
document sequences the work and fixes the v1 scope; it does not restate the
why. Companion decisions from the same session that are feedback- rather than
configuration-shaped (thumbs reason tags, milestone lecturer feedback form)
are listed in phase 3.

Governing ADRs: [0019](../docs/adr/0019-chatbot-config-postgresql-authoritative.md)
(config store), [0020](../docs/adr/0020-two-tier-chatbot-approval.md)
(approval model), [0021](../docs/adr/0021-templated-standard-modes-reviewed-custom-modes.md)
(mode tiers and prompt compilation), [0022](../docs/adr/0022-no-student-text-in-manage.md)
(data boundary in manage).

## Baseline (verified 2026-08-20)

- Chatbots are seed-provisioned only; no create/delete flow or mutation exists.
  The single lecturer mutation is `updateChatbotModelSettings`
  (`packages/graphql/src/schema/mutation.ts`, `services/chatbots.ts`).
- `systemPrompts[mode].prompt` fully **replaces** the built-in default at
  request time (`apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`);
  only `tutor` has a built-in default (`apps/chat/src/lib/config/prompts.ts`).
- Credits, disclaimer, MCP config are read-only in manage; `systemPrompts` is
  not even queried by the manage UI.
- Retrieval/ingestion is an external RAG MCP service referenced by
  `ChatbotMCPServer`; this repo has no upload or ingest API.
- An embed mode for the chat app already exists (basis for the lecturer test
  chat).

## Knob classification (the contract)

| Knob | Lecturer v1 | Gate |
| --- | --- | --- |
| Name, description, avatar, course binding | Edit freely | — |
| Standard-mode persona fields (course name, subject domain, language, scope note) | Edit freely | — |
| Mode toggles (min 1 active) | Edit freely | — |
| Few-shot examples (capped, fixed tags) | Edit freely | — |
| Knowledge sources (upload / re-ingest / delete) | Edit freely (phase 4) | — |
| Participant usage-credit configuration | Propose | Approved with publication request; separate from account-wide usage budgets |
| Model allowlist / reasoning efforts | Edit freely within the shared account AI authorization and monthly budgets | — |
| Custom mode (name, description, persona text) | Author freely pre-publication | Reviewed at publication; edits on a live bot re-enter review |
| Publication (students can reach the bot) | Request | Per-bot approval + account AI capability flag |
| Raw compiled prompt | Not shown | — |
| Disclaimer/legal text | Not editable | Ours |
| OpenAI key/base URL, MCP wiring, chunking/retrieval parameters | Never exposed | Ours |
| Confidence / resolution metrics | Not shown (no evaluator exists) | Build evaluator first |

## Phase 0 — schema and approval foundations

Everything else hangs off this; it is backend-only and shippable without UI.

- `Chatbot` gains a status machine (`DRAFT`, `PENDING_APPROVAL`, `PUBLISHED`,
  `PAUSED`, `REJECTED` with reviewer comment), owning-lecturer semantics, and
  publication-request fields (use case, expected student count, proposed
  participant usage-credit configuration).
- Account-level AI capability flag (separate from Catalyst; Catalyst reveals
  the features, the AI flag permits publication requests). One approved cost
  center authorizes both base and advanced usage. Account-wide budget counters
  and usage lanes are an implementation follow-up, not part of this Phase 0
  PR.
- Mutations: `createChatbot`, `updateChatbot` (free knobs),
  `requestChatbotPublication`, admin `approveChatbotPublication` /
  `rejectChatbotPublication`.
- Prompt **compile seam** preserving today's replacement behavior in Phase 0;
  later phases add scaffolding, standard-mode fields, examples, and
  custom-mode persona text according to ADR 0021. Characterization tests keep
  this first extraction behavior-preserving.
- Approval operations v1 is ops-shaped: status flips via script/Prisma Studio;
  ops watches `PENDING_APPROVAL` manually. Team notification and the admin
  queue UI are deferred to later phases.

### Approved usage-funding MVP (implementation follow-up)

- The shared account AI authorization requires an approved cost center for both
  model classes; lecturers choose models without a new approval per model.
- Registry entries carry explicit `BASE` or `ADVANCED` metadata. `Auto` is
  `ADVANCED` until routed usage is attributable, and fallback never crosses
  classes.
- Lecturers define one monthly base budget and one monthly advanced budget for
  the account. Both reset monthly. The UI has exactly two usage lanes — base
  model usage and advanced model usage — each showing budget, used, remaining,
  and reset date.
- The teaching center's limited base contribution is internal and hidden. It
  is not a third lane, is not shown as an allowance, and does not reclassify
  base usage. Advanced usage receives no teaching-center contribution.
- The pragmatic first implementation pre-checks availability and charges
  reliable provider usage after generation with atomic counters. It accepts
  bounded final/concurrent overruns and defers strict reservations, immutable
  ledgers, automated refunds, invoice generation, per-chatbot allocations,
  tariff versioning, Auto attribution, and participant-credit migration.

## Phase 1 — creation flow and standard-mode fields in manage

- Create-chatbot form: name, description, avatar, bound courses (required,
  from the lecturer's own courses), initial mode set. Knowledge attaches later
  on its own tab.
- Detail page reorganized into tabs (mockup-inspired): Overview, Persona &
  modes, Knowledge (status-only until phase 4), Limits & model (existing
  controls), Access/publication.
- Standard-mode persona fields editable per mode; mode toggles with min-1
  enforcement.
- Lecturer test chat: "Open test chat" via the existing embed mode with a
  test-thread flag on `ChatThread` — excluded from student-facing analytics,
  ratable, and the later capture source for examples. Unpublished bots are
  reachable only this way.
- In-app publication request form (flips to `PENDING_APPROVAL`); rejected
  state shows the reviewer comment.

## Phase 2 — examples studio (v1-minimal)

The primary self-service steering lever (ADR 0021).

- `ChatbotExample` model: chatbot + mode scoped, student-turn text, ideal
  reply text, optional source reference, fixed tag enum (`HINT_NOT_ANSWER`,
  `WRONG_ANSWER_RECOVERY`, `OFF_TOPIC_REDIRECT`, `CITATION_STYLE`), order,
  in-prompt flag. Hard cap: 4 in-prompt, ~1k token budget shown in UI.
- Manual add + capture-from-chat, sourcing **only the lecturer's own test
  threads** (consistent with ADR 0022).
- Compile step injects in-prompt examples per mode.
- Explicitly out: compare sets, re-run-against-bot, import/export — that is
  the phase-7 eval harness.

## Phase 3 — overview KPIs and the feedback loop

- Overview tab shows DB aggregates only (ADR 0022): conversations/messages
  over time, thumbs ratio, reason-tag counts, credits consumed, per-source
  ingest status (once phase 4 lands).
- Thumbs-down reason tag for students (same vocabulary as example tags plus
  `SOURCE_MISSING`): migrates the `rating` column to a small feedback table —
  supersedes part of ADR 0002; record that supersession when implementing.
- Milestone lecturer product-feedback form (1 week after publication and after
  ~100 student messages), pre-filled with the bot's aggregates; hosted form →
  ClickUp for the beta, embedded later only if the question set stabilizes.

## Phase 4 — knowledge self-service

Mandatory for beta scale; dependent on the KB service (kb-poc line) exposing
upload + per-source status + delete over HTTP. Assumption from the grill: that
API mostly exists (ingest-button restore is already on the KB roadmap) —
verify first; if not, the API work joins this phase.

- Knowledge tab actions: upload source, re-ingest, delete; per-source
  `Ready` / `Processing` / `Stale` status.
- Chunking, graph, and retrieval parameters are never exposed.

## Phase 5 — custom modes

- Author name, description, persona text; compiled as a layer (ADR 0021),
  cap 2 per bot.
- New/edited custom modes on a published bot re-enter review (ADR 0020);
  pre-publication they are freely editable and testable in the test chat.

## Phase 6 — admin approval queue

- Admin-only manage page listing pending account approvals, publication
  requests, and custom-mode reviews with approve/reject + comment. Promote
  early if beta volume reaches double-digit bots per semester — the
  rejected-with-comment loop needs a surface lecturers can see.

## Phase 7 and later (explicitly deferred)

- Eval harness: compare sets, re-run examples against the bot, starter-question
  smoke tests as per-course eval sets (pairs with deepeval plans).
- Draft/publish snapshots for editing live bots (only if live-editing pain
  materializes; ADR 0020 consequence).
- Structured persona fields beyond the four (only if example steering proves
  insufficient).
- Aggregate topics / any student-content exposure — learning-analytics track
  governance only (ADR 0022, learning-analytics ADR 0005).
- Embedded live-preview pane inside manage (test chat via embed mode covers
  v1).
- Confidence / resolution-rate metrics — require an evaluator; do not fake.

## Configuration glossary

Usage and funding terms are defined in the repository [CONTEXT.md](../CONTEXT.md).

- **Account AI capability**: The per-account approval (cost center recorded,
  feature flag enabled) that permits publication requests. Distinct from
  Catalyst, which only reveals the configuration features. _Avoid_: beta flag.
- **Publication**: The per-chatbot approved transition that makes a bot
  reachable by students. _Avoid_: go-live, activation.
- **Publication request**: The in-app form on a bot (use case, expected
  students, proposed participant usage-credit configuration) that puts it into
  review. This legacy allowance is separate from account-wide usage budgets.
  _Avoid_: access form (that is the account-level external form).
- **Standard mode**: A platform-maintained mode (`tutor`, `explainer`) aimed
  via constrained persona fields. _Avoid_: default mode.
- **Custom mode**: A lecturer-authored mode whose persona text is reviewed at
  publication. _Avoid_: custom prompt.
- **Persona field**: A constrained standard-mode input (course name, subject
  domain, language, scope note) compiled into the prompt. _Avoid_: prompt
  field.
- **Scaffolding**: The non-removable platform prompt base (citations,
  grounding, safety, stance) that lecturer content layers onto. _Avoid_: base
  prompt.
- **Example**: A tagged student-turn/ideal-reply pair steering a mode, capped
  in count and tokens. _Avoid_: few-shot, exemplar.
- **Test thread**: A lecturer-owned conversation with their own (possibly
  unpublished) bot, excluded from student-facing analytics and the only
  capture source for examples. _Avoid_: preview chat.
