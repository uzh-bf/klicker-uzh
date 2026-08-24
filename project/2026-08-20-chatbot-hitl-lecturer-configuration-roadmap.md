# HITL lecturer chatbot configuration roadmap

Revision: 2026-08-21. This is the approved execution roadmap for the active
`rs-roadmap-orchestrator` run. It sequences the work one horizon above
implementation. The active transaction is milestone M1 only.

The goal is a small, reviewable lecturer configuration beta: an approved
account can use two explicit model-usage classes, configure a chatbot with
safe standard modes, test it privately, request publication, and later observe
it without exposing student-authored content in manage.

Governing ADRs:

- [0019](../docs/adr/0019-chatbot-config-postgresql-authoritative.md) keeps
  PostgreSQL authoritative and makes runtime compilation per-request.
- [0020](../docs/adr/0020-two-tier-chatbot-approval.md) separates account AI
  usage authorization from per-chatbot publication approval.
- [0021](../docs/adr/0021-templated-standard-modes-reviewed-custom-modes.md)
  defines standard-mode fields, fixed scaffolding, and custom-mode review.
- [0022](../docs/adr/0022-no-student-text-in-manage.md) keeps
  student-authored text out of the lecturer-facing manage surface.
- [CONTEXT.md](../CONTEXT.md) is the vocabulary contract for the two usage
  lanes and hidden base contribution.

## Goal, terminal condition, and authority

The next execution session should produce draft stacked PRs based on PR #5460,
with each layer independently reviewable and green under the repository's
native checks. The execution terminal condition is the published draft stack
set and its evidence, not merge, deployment, live traffic, or closing a
superseded PR.

The active orchestrator owns task IDs, stack order, child assignment, question
custody, roadmap `Progress`, and boundary verification. The M1 goal authorizes
repo-local worktrees and branches, local commits, pushes, and draft PR
publication for U1 through U3. A child owns exactly one W-item and must return
the acceptance evidence for that item. Merge, deployment, live traffic, PR
closure, cleanup, and deletion remain withheld. The orchestrator must not
silently widen the scope to billing, student-content analytics, a new
knowledge-base service, or live operations.

## Current state and verified working context

| Item | State and next-session action |
| --- | --- |
| Phase 0 base | PR [#5460](https://github.com/uzh-bf/klicker-uzh/pull/5460) is open at `d84140434dbfa25ca5e92333a139f7d61063d02c`, based on current `v3`; it is reviewed and CI-complete except for a known historical GitGuardian fixture finding. Do not rewrite it. |
| Phase 0 scope | Lifecycle, account capability, publication mutations, prompt compile seam, and approval foundations are present. Account usage counters and usage-lane UI are not implemented. |
| Superseded plan PR | PR [#5453](https://github.com/uzh-bf/klicker-uzh/pull/5453) is fully incorporated into #5460 and is now closed. The closure happened outside this orchestration run. |
| Stack capability | GitHub stack support is enabled, but #5460 is not currently in a stack. The next session must create or adopt stack metadata only when it begins the named PR work. |
| Worktree | Reuse repo-local `trees/feat-chatbot-lecturer-config-phase0`, now on `rs/chatbot-u1-usage-foundation`. The primary checkout contains unrelated user changes and is read-only control state. |
| Freshness | At the last gate, the task branch was clean, fetched, and 29 commits ahead of `origin/v3` with no commits behind. The next session must fetch again after the session boundary. |
| Runtime | No devcontainer, dev server, database reset, tunnel, watcher, or browser session is being left running by this planning pass. Start only the runtime needed for a future W-item and stop it after the final runtime-dependent check. |
| Existing plan | `project/2026-08-20-chatbot-hitl-phase0-pr-5460-plan.md` records the delivered Phase 0 plan. This roadmap owns the follow-up topology; do not create a second plan root. |

The last CI run was green for builds, tests, CodeQL, SonarCloud, checks, and
all Playwright shards. GitGuardian still reports the known historical
synthetic fixture incident `36437584` in
`packages/graphql/test/courseChatbots.test.ts`; the orchestrator must carry
that as a base-PR disposition, not misreport it as a new usage-feature defect.

## Binding product and data decisions

These decisions are settled and must not be re-grilled during routine W-item
execution:

- AI usage authorization is account-level, requires an approved cost center,
  and covers both `BASE` and `ADVANCED` usage. It is separate from publication
  approval; it is not split into per-model approval.
- Registry entries carry the explicit usage class `BASE` or `ADVANCED`.
  `Auto` is `ADVANCED` for the MVP. Fallback stays within the selected class.
- The lecturer defines one account-wide monthly budget for each class. Both
  budgets belong to the chatbot owner's account and reset at the start of the
  calendar month in `Europe/Zurich`. Store usage as `Decimal(18,6)` credits;
  the atomic charge persistence is the single six-decimal rounding boundary.
- The manage surface has exactly two lanes named **base model usage** and
  **advanced model usage**. Each lane shows configured budget, used credits,
  remaining credits, and reset date.
- The teaching center's limited base contribution is internal. Its amount,
  covered usage, remaining contribution, and settlement are never shown to
  lecturers or participants. Do not use the terms Luna, unlimited model,
  lecturer funded, free allowance, or subsidy balance in product text.
- The MVP pre-checks availability and charges reliable provider usage after
  generation with atomic counters. Bounded final-turn and concurrent overruns
  are accepted. Missing reliable provider usage is not charged and remains a
  manual-correction case.
- Lecturer test turns consume the owning account's selected usage class. Bind
  idempotency to the assistant-message ID within its account, chatbot, and
  thread; a completed key cannot initiate a second billable generation.
- Existing participant usage credits remain the separate per-participant,
  per-chatbot legacy allowance. They are not migrated into account budgets and
  cannot cause a cross-class fallback.
- Class exhaustion disables only that class and returns a stable,
  class-specific participant boundary error. It never silently switches to the
  other class.
- Standard modes (`tutor`, `explainer`) use constrained persona fields layered
  over non-removable platform scaffolding. Raw compiled prompts remain hidden.
- Custom mode text is review-gated on publication and on edits to a published
  bot. The last approved custom revision remains active while a new revision
  is pending; draft snapshots are not part of the first implementation.
- Manage shows quantitative aggregates only. It never shows student-authored
  text, paraphrases, transcripts, or topic aggregation.
- A chatbot remains bound to one course in v1. Lecturer tests use an explicit
  owner-linked test-thread identity, never a synthetic participant, and are
  excluded from participant history, ratings, and analytics.

## Product primitive impact

| Primitive | Existing seam | Planned extension | Boundary |
| --- | --- | --- | --- |
| Account AI authorization | `User.aiChatbotPublishingEnabled` and `aiChatbotCostCenter` in `packages/prisma/src/prisma/schema/user.prisma:110-116` | Reuse the account approval; add account-wide class budgets and usage projection without a second approval model | Owner/admin only; no funding details to participant clients |
| Monthly usage budget | No account counter today | New account + usage-class + month record with configured budget and used credits | One record per class and period; no hidden contribution fields |
| Usage class registry | `apps/chat/src/lib/server/chatModelRegistry.ts:4-65,107-180` | Add explicit `BASE`/`ADVANCED` metadata and parity checks for every registry copy and repository-declared deployment configuration value | `Auto` remains `ADVANCED`; class is server-derived, not client-selected text |
| Runtime charge | Participant `ChatUsageCredits` and decrement service in `apps/chat/src/services/credits.ts:18-132` | Add account-class pre-check and atomic post-generation charge while preserving legacy participant credits | Charge only reliable provider usage; idempotent per turn lifecycle |
| Chatbot lifecycle | `ChatbotStatus` and publication mutations in `packages/graphql/src/services/chatbots.ts:633-825` | Reuse for creation, private testing, publication, and later custom review | Publication never doubles as AI usage authorization |
| Lecturer usage lanes | `ChatbotDetails` usage summary in `apps/frontend-manage/src/components/resources/chatbots/ChatbotDetails.tsx:362-434` | Add exactly two account-level lanes and budget controls | Never display the hidden base contribution |
| Test thread | `ChatThread` and current participant-scoped access | Add explicit lecturer-owned test identity/flag | Never synthesize a student participant; exclude from student analytics |
| Feedback | Nullable `ChatMessage.rating` and feedback route | Preserve current semantics first; add a table in M3 | No student text enters manage |
| Knowledge | External KB MCP/resource lifecycle | Adapt the existing KB resource/binding API when verified | No parallel source model or retrieval-control UI in Klicker |

## Research evidence for the next session

The following evidence was re-checked while preparing this roadmap. A child
must begin from these seams rather than rediscovering the whole repository:

- `packages/prisma/src/prisma/schema/chat.prisma:18-55,116-168` defines
  lifecycle state, legacy participant credits, model policy, prompts, and
  owner/course relationships.
- `packages/graphql/src/schema/mutation.ts:1407-1491` and
  `packages/graphql/src/services/chatbots.ts:418-825` define the current model
  settings, create, publication request, and conditional approve/reject
  seams.
- `apps/chat/src/lib/server/chatModelRegistry.ts:4-65,107-260` owns registry
  validation, defaults, environment loading, allowlist filtering, and the
  current zero-credit fallback.
- `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts:829-887,
  1305-1373,1429-1498` selects models, records provider usage, and decrements
  legacy participant credits; this is the critical runtime seam for U2.
- `apps/frontend-manage/src/components/resources/chatbots/ChatbotDetails.tsx:1-24,
  362-434,536-708` is the current lecturer manage surface and model-control
  seam.
- `apps/chat/src/services/credits.ts:18-132` is the existing atomic
  participant-credit implementation, not the account-budget implementation.
- `docs/chat-platform.md:114-141,176-203` documents published-only access,
  registry parity, Auto routing, the approved usage follow-up, and the
  fallback gotcha.
- Existing focused tests include
  `apps/chat/test/chatModelRegistry.test.ts`,
  `apps/chat/test/modelRegistryParity.test.ts`,
  `packages/graphql/test/manageChatbots.test.ts`,
  `packages/graphql/test/chatbotPublication.test.ts`,
  `packages/graphql/test/courseChatbots.test.ts`, and
  `playwright/tests/Y-chat.spec.ts`.

Planning-stage specialist status:

- The native planner role was unavailable on this collaboration surface. A
  fallback Sol consultation was run with `gpt-5.6-sol` at ultra effort and
  returned `DONE_WITH_CONCERNS`; its recommendations are incorporated below.
- The native explore role was unavailable and its DeepSeek fallback could not
  read the encrypted task. The main session performed the evidence mapping
  directly. This is a routing limitation, not evidence that the repository was
  unexplored.

## Stacked milestone topology

The active `rs-roadmap-orchestrator` creates one stack at a time, keeps each stack
at four or fewer layers, and starts the next stack only after the preceding
stack lands or is explicitly parked. Every layer remains draft until the Gate
3 user ruling marks it ready for review; merge remains separately withheld.

| Stack | Bottom-up layers | Base and dependency |
| --- | --- | --- |
| M1 — usage-funding MVP | U1 usage classes and monthly budget/counter schema; U2 runtime pre-check, idempotent atomic charge, and same-class fallback; U3 account GraphQL API and exact two-lane manage UI | PR #5460; U1 is the first implementation transaction |
| M2 — lecturer configuration beta | C1 typed standard-mode fields/toggles and layered compiler; C2 manage tabs plus create/edit; C3 lecturer-owned test-thread authorization and analytics exclusion; C4 test-chat plus publication/rejection UI | M1 |
| M3 — feedback and evidence loop | E1 feedback-table migration and reason tags; E2 DB-only KPI API/UI | M2 |
| M4 — knowledge self-service | K1 adapter over the existing KB resource/binding lifecycle; K2 upload, re-ingest, delete, and status UI | M2 and A3; may run separately from M3 once unblocked |
| M5 — approval and advanced modes | G1 admin queue for existing publication requests; G2 versioned custom-mode revision/compiler; G3 lecturer author/test UI; G4 custom-mode review queue | M2; normally after M3/M4 |

The stack names are planning identifiers, not branch names. The active
orchestrator uses explicit `rs/` branch names that include the W-item
identifier, for example `rs/chatbot-u1-usage-foundation`, and records the actual
GitHub stack IDs in its control ledger. It must not use one long chain for all
phases or attach unrelated open PRs to this stack.

### M1 Gate 1 stack plan

Feature: chatbot usage-funding MVP. Provider: GitHub. Base: PR #5460 on
`feat/chatbot-lecturer-config-phase0`. Mode: guided because U1 introduces a
database migration, public registry metadata, and the account-budget contract.
The user validates the U1 foundation at Gate 2 before U2 starts.

One stack lives in the existing repo-local worktree
`trees/feat-chatbot-lecturer-config-phase0`. The orchestrator is the sole
topology owner. Exactly one item task writes this worktree at a time: U1 first;
after its clean committed boundary, draft PR publication, Phase 5 acceptance,
and Gate 2 ruling, ownership passes to U2; after the equivalent U2 boundary,
ownership passes to U3. Read-only review may overlap, but no second writer or
worktree may mutate this stack.

| Layer | Branch and work package | Reviewer audience and focus | Validation and activation | Risk and size signal |
| --- | --- | --- | --- | --- |
| U1 | `rs/chatbot-u1-usage-foundation`: account-class monthly budget/counter schema, registry metadata/parity, and documentation | Prisma/data-integrity and model-registry maintainers; review additive migration, unique period key, Decimal semantics, and complete registry classification | Focused Prisma/registry tests, GraphQL generation if touched, `pnpm run check:all`; inert until U2 charges and U3 exposes controls | High; about 250–400 human-authored lines across 8–12 files, plus generated schema/migration artifacts. One work package because schema, parity, and deterministic defaults are one independently safe foundation |
| U2 | `rs/chatbot-u2-runtime-charging`: class availability, atomic idempotent post-generation charge, and same-class fallback | Chat runtime and concurrency maintainers; review lifecycle identity, abort/tool/retry behavior, atomicity, and no cross-class fallback | Focused route/service tests and registry parity, `pnpm run check:all`, chat build; complete runtime enforcement with no manage UI dependency | High; about 350–550 human-authored lines across 6–10 files. Threshold-crossing but one work package because the charge service and route lifecycle integration must land together to be independently safe |
| U3 | `rs/chatbot-u3-usage-lanes`: authorized account usage API and exact two-lane lecturer UI | GraphQL authorization and manage-UI maintainers; review account isolation, hidden-contribution boundary, lane vocabulary, and empty/exhausted/reset states | GraphQL generation, focused resolver tests, `pnpm run check:all`, mandatory English/German desktop/mobile browser evidence; complete lecturer-facing M1 capability | High; about 350–550 human-authored lines across 10–16 files, plus generated operations. Threshold-crossing but one work package because the narrow API projection and its only consumer form one independently functional lecturer outcome |

Draft PR publication means pushing the layer branch and creating a draft PR.
It does not mark a layer ready for review. Gate 3 separately requires the
user's ruling before any M1 draft becomes ready for review. M2–M5 remain
follow-up stacks outside the active authority.

Gate 1 approval: approved by the user on 2026-08-21.

## W-items and acceptance contracts

Each W-item is one independently reviewable PR layer. The child must keep its
changes within the owned paths, return the listed evidence, and report any
`NEEDS_CONTEXT` condition instead of inventing a cross-system contract.

### U1 — account usage foundation

**Outcome.** Store an account-scoped monthly budget and used-credit counter for
each explicit usage class, with registry metadata and a documented period
boundary. Start counters at zero at migration cutover; do not backfill
historical messages or participant credits.

**Owned paths.** Prisma schema and migration, server/client registry metadata,
focused schema/registry tests, and the relevant `docs/chat-platform.md` page.

**Dependencies.** PR #5460 and A1. Do not add a second account approval model.

**Must not.** Add hidden contribution fields, per-chatbot allocations,
tariffs, ledgers, refunds, invoices, participant-credit migration, or a
provider-specific model name to the user-facing contract.

**Acceptance.** The migration is additive and rollback-aware; the unique key
prevents two rows for one account/class/month; budget validation rejects
negative or malformed values; both classes reset used credits at the chosen
boundary while the latest configured limits persist until changed; all
registry copies and repository-declared deployment configuration pass a parity
test; a class with no configuration history has deterministic fail-closed zero
behavior; no participant query returns the counter.

**Checks.** Focused Prisma and registry tests, GraphQL generation if types are
touched, `pnpm run check:all` in the devcontainer, and staged diff/data
hygiene review.

**Boundary candidate.** Return `BOUNDARY_CANDIDATE` when the migration, period
timezone, decimal unit/rounding, or repository-declared registry configuration
source differs from this contract.

### U2 — runtime class enforcement and charging

**Outcome.** Charge reliable provider usage to the owning account and class
after a generation, with an availability pre-check, atomic updates, one charge
per billable turn lifecycle, same-class fallback, and stable class exhaustion
errors. The charge service is caller-kind agnostic: future lecturer test turns
use the same account/class contract, while C3 supplies and proves their
explicit thread identity.

**Owned paths.** Chat route/model registry runtime, account usage service,
focused route/service tests, and the runtime section of
`docs/chat-platform.md`.

**Dependencies.** U1. The current participant-credit flow remains a separate
legacy operation.

**Must not.** Silently cross from base to advanced or vice versa, charge an
unreliable provider usage estimate, expose funding details, or alter the
participant-credit migration boundary.

**Acceptance.** Tests prove duplicate callbacks charge once, concurrent
distinct turns update atomically, missing provider usage charges nothing,
bounded final/concurrent overruns are accepted, a class exhaustion denial is
stable, and exhaustion never selects the other class. The first turn in a new
Zurich month materializes the latest configured limit with a zero-based usage
counter. Participant credits are deducted only when finalization creates the
assistant message; duplicate, conflict, and failed finalization never deduct.
Tool/abort paths use one turn-lifecycle identity. `Auto` remains advanced. The
runtime resolves the owning account and class without branching on participant
versus future lecturer-test identity. Participant errors contain availability
state only, never cost-center or contribution details.

**Checks.** Focused route and service tests covering normal, abort, tool, retry,
duplicate, and concurrent paths; registry parity; `pnpm run check:all`; full
build if the chat app boundary changes.

**Boundary candidate.** Return `BOUNDARY_CANDIDATE` if provider usage cannot be
identified reliably, if a fallback would cross class, or if the future C3
test-thread path would require different account/class charging semantics.

### U3 — lecturer usage API and two-lane manage UI

**Outcome.** Let an authorized lecturer view and set the two account-wide
monthly budgets and see the two usage lanes without exposing the hidden base
contribution.

**Owned paths.** GraphQL account query/mutations and generated operations,
`apps/frontend-manage` usage components, translations, focused GraphQL tests,
and browser evidence.

**Dependencies.** U1 and U2. Reuse the existing account authorization fields;
do not invent a self-service approval intake.

**Must not.** Show Luna, “unlimited,” “lecturer funded,” contribution amounts,
settlement, participant text, or a third funding lane. Do not make publication
approval appear to authorize usage.

**Acceptance.** The UI uses the exact labels **base model usage** and
**advanced model usage**. Each lane shows budget, used, remaining, and reset
date. Owner/admin authorization checks hold for reads and writes; unrelated
accounts and participants are denied. Empty and exhausted states render
deterministically. In a new month, each lane carries the latest configured
limit, shows zero used credits and full remaining credits, and advances the
reset date. The authorization status is clear; cost-center editing remains the
approved account workflow rather than a new per-model control.

**Checks.** GraphQL generation, focused resolver tests (including forged
service-context cases), `pnpm run check:all`, and mandatory `agent-browser`
verification with English/German desktop and mobile screenshots for normal,
empty, and class-exhausted lanes.

**Boundary candidate.** Return `BOUNDARY_CANDIDATE` if product owners require a
new cost-center intake/edit flow, a different lane vocabulary, or exact
coverage disclosure.

### M1-R1 — reopened full-stack review correction transaction

**Outcome.** Correct the three verified M1 full-stack review findings without
adding a fifth pull-request layer: clarify the Phase 0 contract and ADR index,
add the shared U1 effective-month rule, correct U2 rollover/finalization
charging, and project the same rule through U3.

**Ownership.** This is an orchestration transaction over the existing Phase 0,
U1, U2, and U3 work packages, not a new product capability or PR layer. The
roadmap orchestrator is the only writer. Each correction and its tests remain
on the layer that owns the affected contract.

**Dependencies.** The verified Claude Opus report, resolved A6 and A7 rulings,
the exact published heads recorded in Progress, and the approved execution plan
`project/2026-08-23-chatbot-m1-review-corrections-plan.md`.

**Acceptance.** Phase 0, U1, U2, and U3 are recascaded and independently green;
the corrected full range passes Ox Alpha simplification, risk, integrated final,
and serialized Phase 5 reviews; all four exact leases publish atomically; each
pull request remains open and ready with current evidence and exact-head CI
accounted for.

**Must not.** Add a layer, migration, backfill, background reset job, new usage
class, funding/provider surface, merge, deployment, live traffic, closure,
cleanup, or deletion.

### C1 — standard-mode configuration and layered compiler

**Outcome.** Add typed persona fields and mode toggles for `tutor` and
`explainer`, compile them over non-removable scaffolding, and enforce at least
one active mode.

**Owned paths.** Chatbot Prisma fields, GraphQL types/resolvers, compiler and
characterization tests, and ADR/wiki updates only where behavior changed.

**Dependencies.** M1 and A2. Phase 0's replacement-semantics seam is the
starting point, not proof that standard modes are complete.

**Must not.** Expose raw prompts, allow an empty mode set, remove citation,
grounding, safety, or tutoring scaffolding, or add custom-mode review here.

**Acceptance.** Both standard modes retain scaffolding; fields validate and
compile deterministically; at least one mode is active; raw prompts are absent
from GraphQL; existing tutor behavior remains characterized; non-owners
cannot mutate fields.

**Checks.** Prisma/GraphQL/compiler tests, generated operations, full check,
and a focused chat route test proving the compiled request behavior.

**Boundary candidate.** Return `BOUNDARY_CANDIDATE` if the compiler must be
implemented twice for another runtime or if a new persona field changes the
approved ADR 0021 contract.

### C2 — manage creation and editing

**Outcome.** Provide lecturer-owned create/edit tabs for name, description,
avatar, one course binding, standard persona fields, mode toggles, limits, and
publication preparation.

**Owned paths.** GraphQL manage operations, `apps/frontend-manage` chatbot
components, translations, and focused tests.

**Dependencies.** C1 and U3.

**Must not.** Add course-wide multi-course binding in v1, expose provider/MCP
configuration, or let manage display student text.

**Acceptance.** The owner can create a non-published bot bound to one course,
edit the allowed fields, and keep one mode active. Non-owners cannot edit.
Knowledge is status-only until M4. Publication is not performed by this PR.

**Checks.** GraphQL generation, manage tests, `pnpm run check:all`, and
`agent-browser` screenshots for create/edit/error states in English and German.

**Boundary candidate.** Return `BOUNDARY_CANDIDATE` if product requires
multi-course binding or an immediate live-edit snapshot model.

### C3 — lecturer-owned test-thread authorization and analytics exclusion

**Outcome.** Give the owner a private test-thread identity for unpublished and
published bots, without synthesizing a student participant or leaking test
turns into student history, ratings, or aggregate KPIs.

**Owned paths.** `ChatThread`/access model, chat guards, test-thread service,
analytics filters, and focused authorization tests.

**Dependencies.** C2 and A2.

**Must not.** Treat existing embed mode as sufficient authorization, create a
fake student, or allow another lecturer to use an unpublished bot.

**Acceptance.** Owner test access works for an unpublished bot; participant
access remains published-only; non-owner access is denied; test threads are
marked and excluded from student history, ratings, and usage aggregates; no
student identity is created.

**Checks.** Chat guard/service tests, database authorization tests, and
`agent-browser` owner/non-owner smoke tests with an unpublished bot.

**Boundary candidate.** Return `BOUNDARY_CANDIDATE` if the existing thread
schema requires a participant relation or if the analytics exclusion cannot be
made without a separate event model.

### C4 — test chat and publication/rejection UI

**Outcome.** Add the lecturer test-chat entry point and the in-app publication
request/rejection loop on top of the existing conditional lifecycle service.

**Owned paths.** Manage access/publication UI, chat launch route, generated
operations, and browser tests.

**Dependencies.** C3, existing Phase 0 mutations, and account AI capability.

**Must not.** Publish automatically, authorize usage through publication, or
show raw prompt/provider/MCP controls.

**Acceptance.** “Open test chat” reaches the owner test thread; an owner can
submit use case, expected students, and legacy participant-credit proposal;
the bot enters `PENDING_APPROVAL`; rejection shows the reviewer comment;
participants still receive published-only access. Browser evidence covers
normal, pending, rejected, and unauthorized states.

**Checks.** GraphQL generation, publication tests, full checks, and mandatory
desktop/mobile browser screenshots.

### E1 — feedback storage and reason tags

**Outcome.** Add thumbs-down reason tags while preserving current nullable
rating and retraction semantics.

**Owned paths.** Feedback route/schema, migration, tests, and ADR 0002
supersession record if a table is actually introduced.

**Dependencies.** M2.

**Must not.** Delete or reinterpret existing ratings, expose student text, or
make the feedback table a transcript store.

**Acceptance.** Migration preserves current opinions and retractions; reason
tags use the approved vocabulary; authorization is participant-safe; manage
receives counts only.

**Checks.** Feedback route/service migration tests, backward-compatible API
tests, full checks, and a data-hygiene review of fixtures.

### E2 — database-only KPI overview

**Outcome.** Add aggregate conversations/messages over time, thumbs ratio,
reason-tag counts, credits consumed, and knowledge-source status.

**Owned paths.** Aggregate queries/services, manage overview, and tests.

**Dependencies.** E1 and M4 status data when available.

**Must not.** Add topics, paraphrases, student text, evaluator confidence, or
resolution-rate claims.

**Acceptance.** Aggregates exclude test threads, are owner-scoped, and return
stable empty periods. The overview never contains a student-authored payload.

**Checks.** Resolver/service aggregate tests, authorization tests, full checks,
and browser screenshots.

### K1 — knowledge adapter over the existing KB lifecycle

**Outcome.** Adapt the verified external KB resource/binding lifecycle for
upload, re-ingest, delete, and status without creating a parallel source model.

**Owned paths.** Only the existing integration seam and its contract tests;
no new KB service in this repository.

**Dependencies.** M2 and A3.

**Must not.** Assume the external API, expose chunking/graph/retrieval knobs,
or add a second `KBResource`-like model.

**Acceptance.** With a public synthetic fixture, prove upload → processing →
ready, re-ingest, delete/exclusion from retrieval, owner authorization, and
SSRF controls. If the authenticated API contract is absent, return
`NEEDS_CONTEXT` and park K1 rather than implementing a speculative adapter.

**Checks.** Contract/integration tests with synthetic data, security-focused
URL validation tests, and full checks where the repo boundary is touched.

### K2 — knowledge manage UI

**Outcome.** Add source upload, re-ingest, delete, and `Ready`/`Processing`/
`Stale` status to the Knowledge tab.

**Owned paths.** Manage Knowledge components, generated operations, translations,
and browser tests.

**Dependencies.** K1.

**Must not.** Show raw MCP wiring, retrieval parameters, or student content.

**Acceptance.** Owner-only actions reflect each status transition and deletion;
errors are recoverable; no source text is copied into unrelated manage
aggregates.

**Checks.** GraphQL generation, focused manage tests, full checks, and
mandatory browser screenshots.

### G1 — admin queue for existing approvals

**Outcome.** Give admins a queue for account authorization intake if an intake
record exists, publication requests, and approve/reject/comment actions using
the existing conditional services.

**Owned paths.** Admin GraphQL/manage surface, authorization tests, and docs.

**Dependencies.** C4 and A4.

**Must not.** Invent a persistent account-approval intake when operations still
uses an external form, or let a queue action bypass the capability guard.

**Acceptance.** Non-admin denial, pending listing, approve/reject/comment loop,
and race-safe transitions are proven. Account authorization remains out-of-
band unless A4 approves a new intake model.

**Checks.** GraphQL/service authorization and race tests, full checks, and
browser evidence for admin/non-admin states.

### G2 — versioned custom-mode revision and compiler

**Outcome.** Add a custom-mode revision boundary that preserves the last
approved revision while a new revision is pending, and compiles custom persona
text over the same scaffolding.

**Owned paths.** Custom-mode schema/compiler, publication transition service,
and tests.

**Dependencies.** C1, C4, G1, and A4.

**Must not.** Allow an unreviewed live edit to reach students or require full
draft/publish snapshots beyond the narrow last-approved revision boundary.

**Acceptance.** New custom modes are freely editable before publication;
published edits create a pending revision; students keep the last approved
revision; rejection leaves it active; the compiler retains scaffolding.

**Checks.** Migration/compiler/race tests, GraphQL generation, and full checks.

### G3 — custom-mode author and test UI

**Outcome.** Let lecturers author up to two custom modes, test them privately,
and see the review state and comment.

**Owned paths.** Manage custom-mode tabs, generated operations, translations,
and browser tests.

**Dependencies.** G2 and C3.

**Must not.** Display raw compiled prompts or let non-owners test unpublished
custom modes.

**Acceptance.** Owner-only authoring and test access work; cap two is enforced;
pending/rejected/approved states are clear; participants cannot reach pending
or rejected revisions.

**Checks.** Manage tests, full checks, and browser screenshots across lifecycle
states and locales.

### G4 — custom-mode review queue

**Outcome.** Extend the admin queue to review custom-mode revisions with
approve/reject comments while preserving the last approved live revision.

**Owned paths.** Admin review UI/service tests and docs.

**Dependencies.** G1, G2, and G3.

**Must not.** Add automated content evaluation, student-content review, or
silent publication.

**Acceptance.** Admin-only review, conditional approve/reject races, comments,
and last-approved-live behavior are proven end to end.

**Checks.** Focused service/GraphQL tests, full checks, and browser evidence.

## A-item decision gates

The orchestrator owns these gates. A child must stop with `NEEDS_CONTEXT` when
its work crosses one instead of making a silent product or cross-repository
decision.

| Gate | Required ruling | Recommended initial ruling |
| --- | --- | --- |
| A1 — budget semantics | Account owner, credit unit/rounding, monthly boundary/timezone, whether test turns charge, and duplicate-charge identity | **Resolved 2026-08-21:** owning account; `Europe/Zurich` calendar month; `Decimal(18,6)` credits with one persistence rounding boundary; test turns charge; assistant-message ID scoped to account/chatbot/thread is the idempotency key |
| A2 — course and test identity | Phase 1 says courses, while the current `Chatbot` has one `courseId` and `ChatThread` is participant-scoped (`packages/prisma/src/prisma/schema/chat.prisma:57-71,116-168`) | **Resolved 2026-08-21:** one course in v1; explicit owner-linked lecturer-test thread identity; no synthetic participant; exclude test threads from participant history, ratings, and analytics |
| A3 — knowledge dependency | Exact merged KB base, authenticated API, resource/binding ownership, status mapping, and deletion semantics | Reuse `KBResource` and its binding lifecycle; park K1 with `NEEDS_CONTEXT` if the external contract is not verified |
| A4 — custom/admin scope | Whether account approval has persistent intake and how live custom edits remain reviewed without full snapshots | Keep account authorization out-of-band until an intake model is approved; keep the last approved custom revision active while a new revision is pending |
| A5 — base disposition | How the historical GitGuardian fixture finding on #5460 is represented in the base stack | Preserve the existing history and record the CI disposition in the base PR; do not broaden U1 to rewrite fixtures |
| A6 — monthly limit persistence | Whether BASE and ADVANCED configured limits expire with each monthly usage counter or remain lecturer settings | **Resolved 2026-08-23:** configured limits persist until changed; only `usedCredits` resets at each Europe/Zurich month boundary |
| A7 — correction publication | Whether the verified M1 review defects may reopen the ready stack and how corrected history is published | **Resolved 2026-08-23:** one sequential writer, layer-owned commits, four-branch recascade, atomic force-with-lease publication, preserved ready state, exact-head CI, refreshed PR evidence, Ox Alpha reviews, and serialized Phase 5; every withheld action remains withheld |

## Traps and implementation notes

- The chat app is an island with direct Prisma route handlers; do not assume
  every chat change needs GraphQL operations. Conversely, manage changes do
  need code generation when their operations change.
- The current registry has separate server and repository-declared deployment
  configuration parity surfaces. A local registry test alone does not prove
  those declared values.
- The current zero-participant-credit fallback can bypass an allowlist and may
  cross a future usage class. U2 must replace it deliberately and test the
  fallback contract.
- Current feedback updates a nullable rating directly. Preserve current
  opinion/retraction behavior before adding reason-tag storage.
- Existing embed mode does not authorize lecturer access. C3 must establish an
  explicit owner test identity and analytics exclusion.
- The external KB service is not this repository's implementation target.
  K1 must reuse its resource/binding lifecycle or stop at `NEEDS_CONTEXT`.
- `docs/chat-platform.md` is the engineering wiki source in this branch;
  `docs/index.md` is absent. Behavior-changing PRs must update the relevant
  wiki/ADR, not grow `AGENTS.md`.
- Tests and browser runs use synthetic/seeded data only. Never commit real
  course rosters, raw chat exports, credentials, or provider keys.

## Verification and review contract

Every W-item follows `$rs-sliced-development-workflow`:

- Run the repository-native focused tests, GraphQL generation where applicable,
  `pnpm run check:all`, and the relevant build before presenting the layer.
- UI layers must use `agent-browser` with delegated local access and capture
  changed states in English and German at desktop and mobile widths.
- A risk-crossing layer gets the required slice reviewer and simplifier gates;
  the integrated stack gets one final reviewer before it is presented as ready.
- Reviewers inspect the immutable layer range, not a dirty working tree. The
  orchestrator verifies every child report against the diff and test output.
- A `BOUNDARY_CANDIDATE` packet must name the W-item, current evidence, the
  proposed boundary, and the smallest ruling needed. A `NEEDS_CONTEXT` packet
  must identify the missing external contract and the safe parked state.
- No merge, rebase/force-push, PR closure, deploy, Argo sync, live smoke, or
  worktree deletion is implied by this roadmap. Ask at the exact boundary.

## Orchestrator takeover checklist

The next session should perform these actions in order:

1. Run the freshness gate and re-read this roadmap, the Phase 0 plan, ADRs
   0019–0022, `CONTEXT.md`, and the current #5460 checks.
2. Reuse the task worktree, carry the reconciled base-PR GitGuardian
   disposition under A5, and maintain the orchestrator control ledger without
   changing #5460.
3. Apply the recorded A1 and A2 rulings during U1/C3 implementation. Resolve
   A3–A4 only when their dependent milestone becomes current; park work with
   the exact `NEEDS_CONTEXT` packet if a contract is missing.
4. Create the M1 stack only: U1 → U2 → U3, with one child per W-item and
   draft PRs based on #5460. Do not start M2–M5 implementation in parallel.
5. Stop this orchestration run after M1 is accepted or explicitly parked. A
   later, separately authorized run may begin M2 from the accepted top layer.

## Progress

| Date | Scope | State | Next action |
| --- | --- | --- | --- |
| 2026-08-21 | Phase 0 / PR #5460 | Reviewed, CI-complete except known historical GitGuardian fixture finding; open and not merged | Keep as the immutable base; carry A5 disposition |
| 2026-08-21 | Roadmap | Updated with Sol review, five milestone stacks, W-item contracts, A-item gates, evidence, and orchestrator takeover procedure | Active orchestrator commits the ruling revision and starts M1/U1 only |
| 2026-08-21 | Stacked PRs | Not created; #5460 is not currently part of a GitHub stack | Create/adopt stack metadata for M1 after the roadmap commit and U1 reservation |
| 2026-08-21 | M1 orchestration | Active; A1, A2, and Gate 1 resolved by the user; A5 reconciled against #5460 at `d84140434dbfa25ca5e92333a139f7d61063d02c`; worktree switched to `rs/chatbot-u1-usage-foundation`; no item task or reservation exists yet | Commit the roadmap on U1, then reserve and launch U1 exactly once |
| 2026-08-22 | M1/U1 — account usage foundation | Phase 5 accepted required `reviewed` delivery at `a2d01fad67fba5b780a343e61284a5df28ecb15d`: inert additive schema, registry, tests, and docs published as draft PR #5475 in stack #5476; simplifier and slice gates passed, Ox Alpha final and exact-head re-read passed, and current-head CI finished with 27 passed, 15 intentionally skipped, 0 failed, and 0 pending after unchanged-head retries for two transient failures. U1 remains unmerged with no deployment or live proof | Obtain the Gate 2 user ruling before U2; PR readiness, merge, deployment, live traffic or proof, PR closure, cleanup, and deletion remain withheld |
| 2026-08-22 | M1/U2 — runtime class enforcement and charging | Phase 5 accepted required `reviewed` delivery at `367784db6dd6696256a756b3d4c7f8f50edf2d10`: atomic availability and finalization, same-class allow-listed fallback, stable class-specific errors, one charge per normal, tool, or abort lifecycle, neutral zero-credit copy in English and German, wiki guidance, and corrected browser expectations published as draft PR #5480 in stack #5476. Simplifier, slice, correction, integrated Ox Alpha, and refreshed Phase 5 reviews passed with no reportable findings. The focused matrix passed 37 cases including 6 PostgreSQL cases; the Chat suite passed 369 with 6 expected skips; Node 24 `check:all` passed 25/25; the production build passed; browser checks covered English and German desktop, settings, and mobile surfaces without errors; exact-head CI passed 27 with 9 intentional skips, 0 failures, and 0 pending, including all 8 Playwright shards. U2 remains unmerged with no deployment or live proof | Proceed to U3 under the roadmap; PR readiness, merge, deployment, live traffic or proof, PR closure, cleanup, and deletion remain withheld |
| 2026-08-23 | M1/U3 — lecturer usage API and two-lane manage UI | Phase 5 accepted required `reviewed` delivery at `47359d48a8cc0fc6befb22222dda7f419f8de5b7`, published as draft PR #5490 at the top of stack #5476. The authorized account usage query, atomic two-budget mutation, exactly two localized owner settings lanes, additive persisted operations, hidden-funding boundary, and complete U1 through U3 M1 integration are verified. Plan-planner, slice and correction reviews, integrated Ox Alpha final review, and publication-aware Ox Alpha Phase 5 re-read passed with no blocking finding. The focused PostgreSQL/GraphQL file passes 11/11 including concurrent charging; generation drift is clean; Node 24 `check:all`, package and repository builds, Playwright typecheck and discovery pass; browser evidence covers normal, empty, exhausted, and unauthorized states in English and German at desktop and mobile widths. Exact-head CI registered four completed passing checks: three dynamic CodeQL language jobs and GitGuardian. Ordinary pull-request workflows did not register for this stack-linked draft and are not represented as passing. The exact DevPod is stopped | M1 terminal reached: U1, U2, and U3 are published as three open draft layers with current-head CI accounted for. Request the separate Gate 3 ruling. Ready marking, merge, deployment, live traffic, PR closure, cleanup, and deletion remain withheld |
| 2026-08-23 | M1 Gate 3 base refresh | The user approved Gate 3 and the exact current-`v3` recovery. Stack #5476 was rebased locally onto `2dc517aed`, preserving the shared and chatbot context, the combined chat-platform documentation, and both util exports. The corrected local layer heads are Phase 0 `7eb4c50ef`, U1 `02061e204`, U2 `3252d0a6f`, and U3 `0953f96a6`. Node 24 verification passes: the repository build completes 23/23 tasks; all 29 non-analytics packages pass 31 typecheck/lint tasks; formatting and GraphQL generation have no drift; util passes 58 tests; Chat passes 369 with 6 expected skips; the focused PostgreSQL/GraphQL file passes 11/11; and Playwright discovery lists 872 tests. The root `check:all` analytics lint remains environment-blocked because uv selected Python 3.14 and the image lacks a C compiler for pandas. Host route readiness also hit a local curl certificate error after the applications reached their ports. The exact DevPod is stopped with zero routes. | Complete the Ox Alpha rebase review, then atomically force-with-lease publish all four corrected heads and mark U1, U2, and U3 ready bottom-up after exact-head CI. Merge, deployment, live traffic, PR closure, cleanup, and deletion remain withheld |
| 2026-08-23 | M1 Gate 3 promotion refresh | The final pre-publication fetch found `v3` had advanced to `1ad0124a9` through deploy-only staging promotion commit #5494. Recovery refs preserve the first corrected stack. Phase 0 through U3 recascaded without conflicts, and per-layer range-diff shows every commit unchanged. The refreshed local heads before this evidence commit are Phase 0 `d55996d82`, U1 `b29c628ed`, U2 `930f92746`, and U3 `69d63dd01`; linear ancestry from current `v3` is proven and the worktree remains clean. The earlier Node 24 checks still apply to the unchanged stack patches; the new base delta touches only `deploy/env-uzh-stg/values.yaml`. | Complete a focused formatting check and fresh Ox Alpha review, then re-run the exact remote lease gate before the authorized atomic publication. Merge, deployment, live traffic, PR closure, cleanup, and deletion remain withheld |
| 2026-08-23 | M1 Gate 3 ready-for-review promotion | Ox Alpha accepted the recascaded stack with no blocking finding. The exact Phase 0 `d55996d82`, U1 `b29c628ed`, U2 `930f92746`, and U3 `147967f6f` heads were atomically force-with-lease published, and PRs #5475, #5480, and #5490 were marked ready bottom-up with unchanged bases. Phase 0 has 44 passing checks and one intentional skip; its only failure is the documented historical GitGuardian fixture finding. U1 has 61 passing rollup entries, U2 has 58 after one successful unchanged-head retry of an unrelated elements-sharing Playwright flake, and U3 has 62; all current Playwright matrices pass with no unresolved failure or pending job. All four PRs are open and mergeable. | Publish this evidence-only top-layer commit and account for its exact-head CI. M1 then remains at the ready-for-review handoff; merge, deployment, live traffic, PR closure, cleanup, and deletion require separate authorization |
| 2026-08-23 | M1-R1 — full-stack review corrections | Claude Opus found three change-introduced defects after the ready handoff. Main-session verification accepted all three. The user resolved A6 in favor of persistent configured limits and authorized A7's single-writer correction/publication path. The current published heads remain Phase 0 `d55996d82`, U1 `b29c628ed`, U2 `930f92746`, and U3 `d386d1644`; no correction commit or remote mutation exists. The execution plan is `project/2026-08-23-chatbot-m1-review-corrections-plan.md`. Its Ox Alpha construction pass returned `DONE_WITH_CONCERNS`; both concerns were dispositioned by existing authority and mandatory browser rules. The exact-file Ox Alpha review then returned `PASS_WITH_CORRECTIONS` / `DONE_WITH_CONCERNS`; its A7 traceability, literal `git push --atomic`, and two-commit `v3` drift dispositions are incorporated, and it found no remaining user decision. The user approved the exact plan at Gate 1 on 2026-08-23; a fresh fetch preserved the recorded leases and pull-request topology. | Commit S0, freeze the four recovery refs, and recascade the unchanged stack onto current `v3` before the sequential corrections. Merge, deployment, live traffic, PR closure, cleanup, deletion, and unrelated roadmap work remain withheld |
| 2026-08-24 | M1-R1 / Phase 0 — monthly-budget contract correction | Serialized Phase 5 accepted required `reviewed` delivery at local head `69455376c`. `CONTEXT.md`, ADR 0020, and the ADR index now state the A6 carry-forward contract without changing runtime or schema behavior. Review response `resp_060d827c10fe4c05a63071821dbfb66a` routed through an Ox Alpha host at maximum effort and returned `REVIEWED` / `ACCEPT`; the complete corrected stack's integrated Ox Alpha `PASS` remains standing. The published Phase 0 head is still `d55996d82`, so publication, ready-state evidence, and exact-head CI are not claimed. | Reconcile U1 against corrected Phase 0, then continue the serialized Phase 5 sequence. Atomic publication, merge, deployment, live traffic, PR closure, cleanup, and deletion remain withheld until their named gates |
| 2026-08-24 | M1-R1 / U1 — effective usage-month foundation | Serialized Phase 5 accepted required `reviewed` delivery at local head `e82c84011`, directly on accepted Phase 0 `69455376c`. The shared resolver carries the latest configured class budget into a later injected Zurich month with zero used credits, preserves an exact current row, rejects future or cross-owner/class data, and keeps source and analytics Prisma comments identical. Review response `resp_61d2d0332cac45979c192632f5777db8` routed to `stealth/ox-alpha` at maximum effort and returned `REVIEWED` / `ACCEPT`; U1 simplification, data-integrity, focused database, and integrated reviews all pass. The published U1 head remains `b29c628ed`, so no remote delivery is claimed. | Reconcile U2 against accepted U1, then continue the serialized Phase 5 sequence. Atomic publication, ready evidence, merge, deployment, live traffic, PR closure, cleanup, and deletion remain withheld |
| 2026-08-24 | M1-R1 / U2 — rollover-safe runtime charging | Serialized Phase 5 accepted required `reviewed` delivery at local head `ef7704660`, directly on accepted U1 `e82c84011`. Runtime precheck now consumes the shared effective month, finalization atomically materializes and charges the carried budget, and only a newly created finalization may deduct participant credits. Review response `resp_747176da75f6405f8991551cb21b395f` routed to `stealth/ox-alpha` at maximum effort and returned `REVIEWED` / `ACCEPT`; focused route, 9/9 PostgreSQL integration, simplifier, risk, and integrated reviews pass. The published U2 head remains `930f92746`, so no remote delivery is claimed. | Reconcile U3 against accepted U2, then close the prepublication serialized Phase 5 sequence. Atomic publication, ready evidence, merge, deployment, live traffic, PR closure, cleanup, and deletion remain withheld |
| 2026-08-24 | M1-R1 / U3 — persistent lecturer usage lanes | Serialized Phase 5 accepted required `reviewed` delivery at local head `6453a94ce`, directly on accepted U2 `ef7704660`. Both fixed GraphQL lanes now project the shared effective month, later configured values supersede carry-forward, and the lecturer wiki matches the runtime contract. Review response `resp_89beb21605714ab7b73fe13b4ccac8a7` routed to `stealth/ox-alpha` at maximum effort and returned `REVIEWED` / `ACCEPT`; corrected risk rereview, 15/15 focused tests, patch-equivalent bilingual desktop/mobile browser proof, integrated Ox Alpha `PASS`, and stopped-runtime proof all stand. The published U3 head remains `d386d1644`, so no remote delivery is claimed. | Commit the four serialized Phase 5 results on U3, re-read current `v3`, frozen leases, pull-request bases, and ready states, then perform the authorized atomic force-with-lease publication only if every identity remains exact. Merge, deployment, live traffic, PR closure, cleanup, and deletion remain withheld |

## Glossary

- **AI usage authorization**: account-level approval requiring an approved
  cost center and permitting both usage classes; it is not publication.
- **Publication approval**: per-chatbot approval making a bot reachable by
  students; it does not authorize account usage.
- **Usage class**: registry classification `BASE` or `ADVANCED`, independent of
  who covers usage.
- **Base model usage** and **advanced model usage**: the two visible UI lanes;
  the base contribution remains hidden and advanced receives no contribution.
- **Monthly usage budget**: lecturer-defined account-wide budget for one class,
  reset monthly.
- **Participant usage credits**: existing per-participant/per-chatbot legacy
  allowance, separate from account budgets.
- **Test thread**: lecturer-owned private conversation, excluded from student
  analytics.
- **Standard mode**: platform-maintained `tutor` or `explainer` mode using
  constrained persona fields.
- **Custom mode**: lecturer-authored persona layer reviewed before it reaches
  students.
- **Scaffolding**: non-removable platform prompt/policy layer.
