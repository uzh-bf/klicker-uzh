# HITL lecturer chatbot configuration roadmap

Revision: 2026-09-01. This is the current execution roadmap for the
`rs-roadmap-orchestrator` work. It sequences the work one horizon above
implementation. The M1 usage-funding stack is merged; its later trusted-pilot
finalization candidate was not published. The active planning transaction is a
live-state reconciliation and a bounded handoff into the remaining M2 work.

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
- [0041](../docs/adr/0041-chatbot-trusted-pilot-boundary.md) defines the
  staged trusted-pilot boundary, operations-owned budgets, and strict registry
  contract for the finalization stack.

## Goal, terminal condition, and authority

The current execution session reconciles this roadmap with the live repository
after the original five-PR M1 stack merged and defines the next M2 continuation.
Its terminal condition is a committed roadmap-only reconciliation, focused
Markdown and diff checks, a committed-diff final review, a pushed branch, and a
draft PR for senior review. It does not include code implementation, merging
any PR, deployment, account activation, live traffic, runtime startup, cleanup,
or mutation of another worktree.

The active orchestrator owns task IDs, stack order, child assignment, question
custody, roadmap `Progress`, and boundary verification. This transaction
authorizes only the clean roadmap branch, the exact live-state readback, this
roadmap edit, repository-native documentation checks, a committed-diff review,
and draft-PR delivery. Existing implementation PRs and worktrees retain their
owners. Merge, deployment, live traffic, account activation, cleanup, and
deletion remain withheld. The orchestrator must not silently widen the scope to
billing, student-content analytics, a new knowledge-base service, or live
operations.

## Current state and verified working context

| Item | State and next-session action |
| --- | --- |
| M1 implementation stack | PRs [#5460](https://github.com/uzh-bf/klicker-uzh/pull/5460), [#5475](https://github.com/uzh-bf/klicker-uzh/pull/5475), [#5480](https://github.com/uzh-bf/klicker-uzh/pull/5480), [#5490](https://github.com/uzh-bf/klicker-uzh/pull/5490), and [#5524](https://github.com/uzh-bf/klicker-uzh/pull/5524) merged in order on 2026-08-26. Their merge commits are `c8411c5679`, `fe63a9fb2d`, `cb1188f321`, `df5becfc06`, and `2d60516150`. | Treat M1 implementation as delivered; do not reopen or recreate the five-PR stack. |
| Trusted-pilot finalization | The recorded hashes `ed0bad640`, `18b3813df`, `2a6ac883`, `d48d03673`, and `2b1bb3ae` are unpublished Phase 0/U1/U2/U3/U4 candidate layer heads from the final recascade. They are not one-to-one S0–S4 commits, and the five merged PRs exclude them. | Preserve the history as an unpublished candidate; do not claim those corrections shipped or attempt the old publication path. |
| M2a authoring stack | [#5593](https://github.com/uzh-bf/klicker-uzh/pull/5593) → [#5614](https://github.com/uzh-bf/klicker-uzh/pull/5614) → [#5619](https://github.com/uzh-bf/klicker-uzh/pull/5619) are open, non-draft, and mergeable. [#5723](https://github.com/uzh-bf/klicker-uzh/pull/5723) is an open, draft guided-setup extension on #5619 and is currently conflicting with a `DIRTY` merge state. | Recognize this as the existing M2a stack. It partially delivers C2 and C4; it does not satisfy C1 or C3. Do not create a duplicate stack; the #5723 conflict belongs to its owning branch. |
| Roadmap worktrees | The prior clean roadmap-refresh worktree integrated current `origin/v3` at local commit `caf1f84d08`. This deliverable uses `trees/chatbot-hitl-roadmap-reconciliation` on `rs/chatbot-hitl-roadmap-reconciliation`, based directly on `origin/v3` at `72096fafe5`, so the review PR contains only the roadmap change. The dirty primary checkout and unrelated worktrees remain untouched. | Keep the new branch docs-only and use the refresh worktree only as integration evidence. |
| Target and freshness | `origin/v3` at `72096fafe50827c3ea3f50465f0a76d492e0a4c2` is the resolved target baseline. `origin/dev` is not the target and was not integrated. | Re-read the target and branch heads before publication of this documentation PR. |
| Historical execution plan | `project/2026-08-26-pr-5524-trusted-pilot-hardening-plan.md` describes the superseded M1 finalization transaction. | Treat it as historical evidence; the live reconciliation below is the current execution contract. |

The current `origin/v3` source contains the merged M1 lifecycle, account-usage,
registry, runtime-charging, and lecturer-usage foundations. This roadmap does
not claim that the default-off enforcement switch has been activated, that a
trusted pilot is live, or that any provider, secret, account, staging, or
production state changed.

## Live-state reconciliation and next-package boundary

The live readback closes the old M1 finalization transaction. The five M1 PRs
merged before the recorded local S0–S4 work could be published, so those local
candidate heads are not an alternative authoritative M1 history. The old
trusted-pilot plan must not be revived by replaying its force-with-lease or
runtime steps.

The next implementation work is already represented by the open M2a stack. Its
three non-draft layers provide the authoring contract, draft authoring UI, and
publication-request UI. The draft #5723 extension provides the guided setup
workspace. Together they remain an externally owned implementation sequence;
this roadmap PR does not edit their branches or PR bodies.

After M2a is merged or explicitly parked, the roadmap resumes with two
risk-selected M2 slices:

- **C1 — standard-mode typed fields and layered compiler:** add the bounded
  persona fields and mode toggles, compile them over non-removable platform
  scaffolding, and keep raw prompts out of the public GraphQL contract.
- **C3 — lecturer-owned test identity and analytics exclusion:** add the
  explicit owner-linked test-thread boundary, authorize it separately from
  participant access, charge the owning account according to the settled usage
  contract, and exclude it from participant history, ratings, and analytics.

C1 and C3 remain separate because C1 is a prompt-policy boundary while C3 is
an identity, authorization, persistence, and analytics boundary. Both preserve
the existing C2/C4 lifecycle contracts and require their own implementation
plan, risk review, and acceptance evidence. No second M2 stack starts during
this reconciliation.

The separately gated `v3-ai` entitlement-integration package from the M2a plan
also remains in force. It begins only after the owner or user integrates the
current `v3` into `v3-ai`; it is not superseded by this v3 roadmap change and
is not integrated here.

## Binding product and data decisions

These decisions are settled and must not be re-grilled during routine W-item
execution:

- AI usage authorization is account-level, requires an approved cost center,
  and covers both `BASE` and `ADVANCED` usage. It is separate from publication
  approval; it is not split into per-model approval.
- Registry entries carry the explicit usage class `BASE` or `ADVANCED`.
  `Auto` is `ADVANCED` for the MVP. Fallback stays within the selected class.
- Operations manages one account-wide monthly budget for each class through an
  `ADMIN`-only mutation with an explicit owner. Both configured limits belong
  to the chatbot owner's account and persist until an authorized `ADMIN`
  changes them; account owners retain read-only visibility. Only used credits
  reset to zero at the start of each calendar month in `Europe/Zurich`. Store
  usage as `Decimal(18,6)` credits; the atomic charge persistence is the single
  six-decimal rounding boundary.
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
| Account AI authorization | `User.aiChatbotPublishingEnabled` and `aiChatbotCostCenter` in `packages/prisma/src/prisma/schema/user.prisma:110-116` | Preserve the account approval and merged account-wide usage projection without a second approval model | Owner/admin only; no funding details to participant clients |
| Monthly usage budget | Merged M1 primitive: `ChatAccountUsage` stores one account + usage-class + Europe/Zurich month row with configured budget and used credits | Maintain the existing persistent configured limit and monthly used-credit reset; M2 adds no second budget primitive | One record per class and period; no hidden contribution fields |
| Usage class registry | Merged M1 primitive: `apps/chat/src/lib/server/chatModelRegistry.ts` and the GraphQL registry enforce explicit `BASE`/`ADVANCED` metadata and parity | M2 consumes the server-derived class; no new client-selected class or registry copy | `Auto` remains `ADVANCED`; class is server-derived, not client-selected text |
| Runtime charge | Merged M1 account-class availability, idempotent post-generation charging, and separate legacy participant credits | Lecturer test turns in C3 reuse the existing account-class lifecycle; any identity change requires its own data-integrity review | Charge only reliable provider usage; idempotent per turn lifecycle |
| Chatbot lifecycle | `ChatbotStatus` and publication mutations in `packages/graphql/src/services/chatbots.ts:633-825` | Reuse for creation, private testing, publication, and later custom review | Publication never doubles as AI usage authorization |
| Lecturer usage lanes | Merged M1 `ChatbotDetails` account summary and explicit-admin budget mutation | M2 preserves exactly two account-level read-only lanes and the hidden-contribution boundary | Never display the hidden base contribution |
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
- The current reconciliation plan used the permitted generic-continuity Sol
  route at xhigh effort after the configured planner rejected its unavailable
  model before work. It returned `VERDICT: APPROVED` after one revision round.

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

### M1 Gate 1 stack plan (historical)

Feature: chatbot usage-funding MVP. Provider: GitHub. Base: PR #5460 on
`feat/chatbot-lecturer-config-phase0`. Mode: guided because U1 introduces a
database migration, public registry metadata, and the account-budget contract.
The user validates the U1 foundation at Gate 2 before U2 starts.

This section records the original U1–U3 topology and acceptance contracts. The
stack has since completed that implementation sequence. The five implementation
PRs are merged; the later trusted-pilot finalization plan and its unpublished
candidate recascade are historical evidence only.

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
It does not mark a layer ready for review. Gate 3 separately required the user's
ruling before the historical M1 drafts became ready for review. M2–M5 remain
follow-up stacks, with the current M2a stack recorded above and outside this
roadmap-only transaction.

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

**Outcome.** Let an authorized lecturer view the two account-wide monthly
budgets and usage lanes without exposing the hidden base contribution;
operations sets the budgets through the administrative mutation.

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
date. Owner reads and explicit-admin writes are authorized; unrelated accounts
and participants are denied. Empty and exhausted states render
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
| A7 — correction publication | Whether the verified M1 review defects may reopen the ready stack and how corrected history is published | **Resolved 2026-08-23 for the then-authorized transaction:** one sequential writer, layer-owned commits, four-branch recascade, atomic force-with-lease publication, preserved ready state, exact-head CI, refreshed PR evidence, Ox Alpha reviews, and serialized Phase 5. The later five-layer candidate was not published; do not revive that path from this roadmap. |

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
- No merge, PR closure, deploy, Argo sync, live smoke, or worktree deletion is
  implied by this roadmap. The old finalization plan's guarded recascade and
  atomic force-with-lease publication are closed historical actions, not current
  authority. Ask at every other boundary.

## Reconciliation package acceptance

This documentation package is complete only when all of the following evidence
is recorded on the committed branch before it is pushed:

- The target and current branch heads are freshly read, and the exact M1 merge
  receipts and open M2a PR topology match the live GitHub state.
- The diff contains only the roadmap reconciliation file. Markdown formatting,
  `git diff --check`, and any repository-native focused documentation check pass.
- The staged diff is inspected for accidental secrets, credentials, personal
  data, generated bulk data, and unrelated cleanup.
- A read-only final reviewer inspects the immutable committed diff for factual
  reconciliation, roadmap dependencies, product-primitive ownership,
  authorization and data-protection boundaries, least-surprise scope, and
  acceptance completeness. Any finding is dispositioned before push.
- The exact committed branch is pushed and a draft PR is opened for senior
  review. The PR does not claim a merge, deployment, activation, runtime proof,
  or delivery of the unpublished trusted-pilot corrections.

## Orchestrator takeover checklist

If this work is resumed after a pause, the execution session should perform
these actions in order:

1. Run the freshness gate and re-read this roadmap, ADRs 0019–0022 and 0041,
   `CONTEXT.md`, and the current M1 and M2a PR state.
2. Verify that the M1 merge receipts remain authoritative and that the
   Phase 0/U1/U2/U3/U4 candidate hashes remain unpublished historical heads.
3. Keep the roadmap reconciliation branch isolated from the dirty primary and
   all implementation worktrees. Do not reopen the old finalization plan.
4. After the documentation checks pass, inspect the exact committed diff,
   obtain the required final review and disposition, then push the branch and
   open or update its draft PR.
5. Leave implementation, merge, deployment, account activation, live traffic,
   runtime startup, cleanup, and deletion withheld. Resume C1 or C3 only in a
   separately approved implementation plan after M2a is merged or parked.

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
| 2026-08-24 | M1-R1 — ready-for-review publication | Corrected-candidate serialized Phase 5 response `resp_11ea371920ab4d91a757a82b4c95eb48` routed to `stealth/ox-alpha` at maximum effort and returned `PR_READY` / `ACCEPT`, superseding the invalid empty response `resp_cde7d3b38a884f32a747422e3c4db98e`. The corrected implementation heads before this roadmap-only evidence commit are Phase 0 `d64425db2`, U1 `a92006db8`, U2 `09ec9948d`, and U3 `9ce1a684d`, atomically force-with-lease published on `v3` `b02c0c436`. PRs #5460, #5475, #5480, and #5490 are open, ready, and mergeable. Exact-head CI is terminal with Phase 0 at 44 passed plus the A5-preserved historical GitGuardian finding, U1 at 45 passed after one exact unchanged-head retry of unrelated duplicate Case Study fixtures, U2 at 39 passed, U3 at 43 passed, and zero pending. The redundant forbidden `docs/log/` evidence file was removed before publication; the removed-artifact check, 23/23 build, review chain, and stopped-runtime proof pass. | M1-R1 has achieved `pr_ready`. Await separate merge authorization; deployment, live traffic, PR closure, cleanup, and deletion remain withheld |
| 2026-08-24 | M1/U4 — final model registry policy | The fifth layer verifies every stored input/output rate, makes Luna the sole base model and current same-class fallback, and records the user-approved Auto estimate of 1/5 from the approximate 90% Luna / 10% Sol generation mix. Integrated Ox Alpha review returned `ACCEPT`; draft PR #5524 is published at implementation and review head `9c238e530` above #5490, with exact-head CI at 10 passed, 9 intentionally skipped, 0 failed, and 0 pending. Browser proof covers direct Luna selection, the synthetic `U4_LUNA_OK` turn, and enabled Base and Advanced monthly-budget controls for the seeded local synthetic account. The exact validation DevPod is stopped with zero routes. | U4 has reached its approved draft-delivery and validation terminal condition. Obtain explicit authorization before marking PR #5524 ready; merge, deployment, live traffic, PR closure, worktree cleanup, and deletion remain separate and withheld |
| 2026-08-26 | M1 trusted-pilot finalization — S0 through S4 | Gate 1 was approved for the existing five-PR stack. The local U4 layer was recascaded onto fresh `origin/v3` at `7515632f229`, with recovery refs and unchanged lower-layer patches. S1 staged default-off enforcement; S2 added bounded registry validation and Luna-only new-bot defaults, including the Edge-safe dynamic-import correction; S3 moved budget writes behind explicit `ADMIN` targeting, removed Manage budget editing, and exposed localized lifecycle boundaries with PUBLISHED-only participant links; S4 records the operating boundary in ADR 0041, CONTEXT, the Chat and testing guides, and both execution artifacts. The implementation commits are local at `08a18497b`, `fb395db9c`, `4ef7ee43a`, `2d6a985eb`, and `886c5b6c2`; no remote ref moved. Generic-continuity reviews replaced unavailable encrypted native routes and found no blocking issue across S1 through S3, including successful rereview of the two S3 copy/translation corrections. | Run the integrated checks, host Playwright and mandatory agent-browser proof, final review, exact-head publication, CI observation, and runtime stop. Merge, deployment, live traffic, enforcement activation, PR closure, cleanup, and deletion remain withheld |
| 2026-08-26 | M1 trusted-pilot finalization — final trunk recascade | The final pre-publication freshness read found `origin/v3` at `079dc722b6e2b61d9210aa785978f4e29e5d2bad`, beyond the earlier `1a55ce239` baseline through one staging deployment promotion. Phase 0 through U4 were recascaded in lower-boundary order from the recorded recovery refs without conflicts. Pre-evidence implementation heads are Phase 0 `ed0bad640b05a979957766d7e365ea5f3d04cefb`, U1 `18b3813df1e0e173ff091171723547d5d4daecc5`, U2 `2a6ac883c6ec6835b9da11076e41e33d7ad736ab`, U3 `d48d03673d2983b77e1ff4b1f9a5bee8228b7d3f`, and U4 `2b1bb3aeff6506e408f6254461d3ea2575a0989d`. Ancestry from the fresh trunk is proven and the complete 106-commit range-diff reports every patch unchanged; no remote ref moved. | Commit the S5 evidence, run the immutable integrated final review over the committed candidate, then perform the authorized exact-lease publication and CI gates. Merge, deployment, live traffic, enforcement activation, PR closure, cleanup, and deletion remain withheld |
| 2026-09-01 | Live M1 and M2a reconciliation | Live GitHub readback confirms the five M1 implementation PRs merged on 2026-08-26 in order. The five recorded Phase 0/U1/U2/U3/U4 hashes are unpublished candidate layer heads, not S0–S4 commits, and the old trusted-pilot finalization plan is historical. M2a remains the existing open stack #5593 → #5614 → #5619 with draft guided-setup extension #5723; these layers partially deliver C2/C4 and do not satisfy C1/C3. | Review this roadmap-only change, then open a draft PR. Do not recreate M1, duplicate M2a, integrate `origin/dev`, or begin the separately gated `v3-ai` entitlement package. |
| 2026-09-01 | Roadmap reconciliation branch | The clean roadmap-refresh worktree integrated current `origin/v3` at `caf1f84d08`; the review branch starts directly at `origin/v3` `72096fafe5` so its diff remains documentation-only. The dirty primary checkout and unrelated worktrees were not changed. The generic-continuity Sol planner returned `VERDICT: APPROVED` after one revision. | Run the committed-diff final review, push the exact branch, and open the senior-review draft PR. |

## Glossary

- **AI usage authorization**: account-level approval requiring an approved
  cost center and permitting both usage classes; it is not publication.
- **Publication approval**: per-chatbot approval making a bot reachable by
  students; it does not authorize account usage.
- **Usage class**: registry classification `BASE` or `ADVANCED`, independent of
  who covers usage.
- **Base model usage** and **advanced model usage**: the two visible UI lanes;
  the base contribution remains hidden and advanced receives no contribution.
- **Monthly usage budget**: operations-managed account-wide limit for one class
  that persists until an authorized `ADMIN` changes it; account owners can read
  it and its used-credit counter resets monthly.
- **Participant usage credits**: existing per-participant/per-chatbot legacy
  allowance, separate from account budgets.
- **Test thread**: lecturer-owned private conversation, excluded from student
  analytics.
- **Standard mode**: platform-maintained `tutor` or `explainer` mode using
  constrained persona fields.
- **Custom mode**: lecturer-authored persona layer reviewed before it reaches
  students.
- **Scaffolding**: non-removable platform prompt/policy layer.
