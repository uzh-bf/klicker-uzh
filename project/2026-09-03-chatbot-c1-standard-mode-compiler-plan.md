# C1 — Standard-mode configuration and layered compiler

Status: active; S0-S3 accepted, S4 model policy and framing in progress
Revision: 2026-09-03
Repository: KlickerUZH
Target branch: `v3`
Base commit: `de7138715f7454e1ff0e794071b6c227bdfa0230`
Roadmap work item: C1 — standard-mode configuration and layered compiler
Boundary owner: `rs-roadmap-orchestrator`
Execution owner: the current main session in the dedicated C1 worktree

## Goal

Add a typed, constrained configuration for the Tutor, Explainer, and Quizzer
standard modes. Lecturers control the bounded persona context and mode
availability without receiving raw system-prompt access. The server persists
the configuration, exposes it through an owner-only GraphQL contract, and
compiles it over the existing non-removable platform scaffolding. Manage
provides a lecturer-facing editor inside the existing chatbot Setup workflow.

The extended C1 delivery ends at a committed, reviewed exact head pushed to the
existing draft pull request, with its leased local validation runtime retained.
It does not claim target-branch integration, merge, deployment, staging or
production acceptance, or live-model proof.

## Scope and non-goals

In scope:

- one additive, nullable typed configuration for Tutor, Explainer, and
  Quizzer;
- bounded course name, subject domain, language-of-instruction, and scope-note
  fields shared by Tutor and Explainer;
- explicit Tutor, Explainer, and Quizzer enablement; every new replacement
  keeps at least one of Tutor or Explainer enabled, while Quizzer remains an
  independent capability-gated option;
- owner-authorized full-replacement GraphQL mutation and normalized projection;
- effective-mode resolution and layered compiler integration;
- a lecturer-facing Manage Setup section with persisted mode controls and a
  publication-review summary;
- one short lecturer-authored framing note for the chatbot, stored through the
  existing constrained standard-mode configuration and compiled as data rather
  than prompt authority;
- an intuitive model policy editor whose default is Auto, whose participant
  choice switch says who controls the model, and whose fixed setting requires
  exactly one model plus one reasoning effort when that model supports it;
- UZH design-system controls, stable `data-cy` hooks, and English and German
  strings in a new Learning modes accordion section that does not become a
  publication-completeness prerequisite;
- characterization, authorization, migration, and injection-boundary tests;
- the ADR and engineering-wiki updates required by the implemented behavior.

Out of scope:

- practice flows, per-mode prompts, or custom-mode review;
- publication approval, account activation, or usage enforcement;
- response generation, citation-policy redesign, new runtime storage, or
  removal of the existing credit-safe base-model fallback;
- target-branch integration, marking the draft pull request ready, merging,
  deployment, cluster operations, and live-model acceptance.

## Authority and stop conditions

The approved package authorizes source edits in the C1 worktree, one
schema-aware additive Prisma migration, generated client and analytics sync,
repository-native checks, local commits, the required review passes, pushing
the exact reviewed head to `origin/rs/chatbot-c1-standard-modes`, and updating
the existing draft pull request description for the complete branch.
Migration generation and GraphQL integration tests may write only to a
disposable local development/test database. Shared development, staging,
production, and live-data database writes remain withheld, as do deployment,
runtime, cluster, and infrastructure changes.

The package stops after the reviewed exact head is pushed to the existing draft
pull request and the user-leased local runtime is reachable. Marking the pull
request ready, branch integration, merge, deployment, and cleanup are separate
actions requiring their own authority. If a required check needs a shared
database or another withheld effect, stop before that effect and report the
exact blocker.

## Evidence baseline

The refreshed `origin/HEAD` resolves to `origin/v3` at the base commit above.
The dedicated C1 worktree is clean and has no task changes. The current
schema stores legacy `systemPrompts` as untyped JSON and has no typed standard
configuration. The chat package already has platform-owned standard prompts,
localized descriptions, effective-mode resolution for legacy opt-outs and
MCP gating, and a layered compiler whose fixed scaffolding is covered by
tests. The POST route is the production compiler caller; the layout and
chatbot API route also consume effective mode options. The GraphQL Chatbot
object intentionally omits raw system prompts, while owner mutations already
enforce Catalyst, full access, ownership, and lifecycle status rules.

The governing decisions are in ADR 0021 (standard modes and non-removable
scaffolding), ADR 0019 (PostgreSQL authority and per-request compilation), ADR
0020 (separate capability and publication approval), and ADR 0041 (safe
new-chatbot defaults). `docs/chat-platform.md` is the current compiler wiki;
`docs/data-and-migrations.md` is the migration workflow reference.

## Product primitives and ownership

| Primitive                        | C1 decision                                                                                                                   | Owner and invariant                                                                                                                                                                                                 | Consumers and impact                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Chatbot mode/persona             | Extend the existing Chatbot configuration with constrained shared persona fields and Tutor, Explainer, and Quizzer flags.     | The lecturer owns the stored value through the chatbot; every new replacement enables at least one of Tutor or Explainer. Quizzer does not satisfy that invariant because its existing capability gate may hide it. | GraphQL owner API, Manage Setup editor, effective-mode resolver, compiler. |
| Chatbot model policy             | Extend the existing allow-list and participant-choice configuration with explicit fixed-versus-participant-choice invariants. | The lecturer chooses either one fixed model or the models participants may choose. Auto remains one selectable model policy; runtime availability and credit safety remain server-owned.                            | GraphQL owner mutation, Manage Advanced editor, Chat model resolver.       |
| Effective mode set               | Extend the existing server resolver with typed flags while preserving legacy and MCP policy.                                  | Server policy owns the visible/requestable set; a hidden standard mode cannot be selected by a crafted request.                                                                                                     | Chat layout, chatbot API route, chat POST route, future authoring UI.      |
| Prompt scaffolding               | Reuse the existing platform-owned layers and compose typed context below the platform contract.                               | Platform owns course scope/evidence, privacy and safety, non-disclosure, epistemic integrity, formatting, citations, and final language.                                                                            | Chat compiler and route tests; no new prompt authority.                    |
| Publication and AI authorization | Reuse existing lifecycle and account gates; change neither contract.                                                          | Publication approval and account capability remain separate and out of C1.                                                                                                                                          | Existing GraphQL authorization and publication flows.                      |

No separate product primitive is introduced for persona fields; they remain a
constrained part of Chatbot mode configuration.

The framing note also remains part of that configuration. It does not create a
prompt primitive or grant lecturers access to platform prompts.

## Frozen data contract

Persist one nullable `Chatbot.standardModeConfig Json?` field, annotated with
the repository's Prisma JSON type-generation convention. The shared canonical
shape is:

```text
{
  tutorEnabled: boolean,
  explainerEnabled: boolean,
  quizzerEnabled: boolean,
  courseName: string | null,
  subjectDomain: string | null,
  languageOfInstruction: Locale | null,
  scopeNote: string | null
}
```

`Locale` reuses the existing `en`/`de` domain. It describes persona context;
it does not override the compiler's final conversation-language policy.

The field is nullable to preserve untouched legacy rows. Null derives all three
mode flags from legacy `systemPrompts.<mode>.enabled:false` opt-outs and
otherwise enables them, with all persona fields blank. Existing rows are not
backfilled or normalized. A valid pre-S3 two-flag value remains readable: its
Tutor and Explainer flags and persona fields are retained, while only the
missing Quizzer flag is derived from the legacy opt-out/default behavior.

The shared interface belongs in `packages/types`. A dependency-free module in
`packages/util` provides two entry points over that interface:

- strict write validation trims values, converts empty text to null, requires
  all three flags and at least one of Tutor or Explainer to be enabled, accepts single-line course
  name and subject domain values up to 160 characters, normalizes a multiline
  scope note up to 1,000 characters, and returns `BAD_USER_INPUT` for malformed
  or overlong input;
- tolerant read normalization accepts null, treats malformed persisted JSON as
  absent, and falls back to legacy/default platform behavior without logging or
  exposing raw JSON.

A valid three-flag typed value is authoritative for Tutor, Explainer, and
Quizzer. A valid pre-S3 two-flag value is authoritative for Tutor and Explainer
and derives Quizzer only. Null or malformed typed data derives all standard
flags from legacy explicit opt-outs and otherwise defaults them enabled. Legacy
flags continue to govern custom modes. Tutor and Explainer never require a
knowledge base. Quizzer remains additionally hidden unless the existing safe
`doc_query` capability gate passes. Required-MCP filtering can still leave no
effective modes by approved policy; the at-least-one Tutor-or-Explainer rule
applies to every newly accepted typed replacement, not to legacy rows after
other policy filters.

## GraphQL contract

Add an owner-facing typed object and input plus a dedicated full-replacement
`updateChatbotStandardModeConfig` mutation. The mutation uses the existing
`asChatbotAuthor` schema gate and service-level owner check. It allows the same
free-knob statuses as metadata and model settings (`DRAFT`, `REJECTED`, and
`PUBLISHED`), rejects `PENDING_APPROVAL` and `PAUSED`, and performs an
owner-scoped lookup followed by a transactional status compare-and-set. A
concurrent lifecycle change returns `CHATBOT_EDIT_CONFLICT`.

S3 extends the existing owner-only
`updateChatbotStandardModeConfig` mutation; it does not introduce a second
write contract. The GraphQL response exposes a normalized owner setup value only; raw
`systemPrompts` remains absent. Its read path combines typed configuration with
legacy opt-outs so Manage displays the effective stored/default setting without
discarding valid pre-S3 persona fields. The existing `QGetChatbotsInfo`
operation remains unchanged so deployed persisted-operation hashes stay
compatible. Add the dedicated owner-scoped
`QGetChatbotsInfoWithStandardModes` read operation and the
`MUpdateChatbotStandardModeConfig` mutation operation for the three-mode
editor. Mode-only saves round-trip every persona field through the
full-replacement mutation. Regenerate all GraphQL artifacts, commit only the
tracked public SDL, and leave ignored generated outputs uncommitted.

Test the schema-level Catalyst/account-owner/full-access gate separately from
service-level owner, status, compare-and-set, invariant, malformed-input, and
no-write behavior.

S4 adds `updateChatbotModelPolicy` as the strict owner mutation and
`MUpdateChatbotModelPolicy` as its newly named client operation. The existing
`updateChatbotModelSettings` field and
`MUpdateChatbotModelSettings` operation remain behaviorally unchanged for
rolling deployments; an already deployed Manage client may still send empty or
multi-model fixed allow-lists plus reasoning entries for every reasoning model.
The new Manage editor uses only the strict field. Both mutations retain the
same authorization, lifecycle-status, owner lookup, and compare-and-set
behavior, and both return the existing Chatbot projection.

## Runtime and compiler contract

Wire the normalized configuration into all three effective-mode consumers:

- `apps/chat/src/app/[chatbotId]/layout.tsx`;
- `apps/chat/src/app/api/chatbots/[chatbotId]/route.ts`; and
- `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`.

Add explicit Prisma selections, fixture data, and compiler arguments where
the current relation include does not already provide the scalar value.

For Tutor and Explainer, the compiler order is fixed as follows:

1. server-owned course data;
2. legacy standard-mode guidance;
3. typed lecturer context;
4. the platform mode contract; and
5. the unchanged input, course-policy, output, citation, and final-language
   layers.

Typed persona values are serialized as one labelled JSON value with an
explicit data-never-instructions preamble. Server course identity wins over a
conflicting persona course label, and the final language contract wins over
language-of-instruction text. Quizzer capability gating, custom-mode
compilation, and existing legacy guidance remain unchanged.

S4 exposes `scopeNote` as a single optional “Chatbot framing” field in Manage.
Newly created or edited UI input is limited to 200 characters, while the
persisted parser keeps its existing 1,000-character compatibility ceiling so
older valid values remain readable. A 201–1,000-character legacy value loads
without truncation and survives a mode-toggle save unchanged; the UI requires
shortening it only when the lecturer edits the framing itself. The compiler
applies the complete typed persona projection to Tutor and Explainer. Quizzer
receives only `scopeNote`, so irrelevant course-name, subject-domain, and
language persona fields do not silently acquire new Quizzer semantics. Custom
modes remain unchanged. The authoritative course display name remains
server-owned; lecturers need not repeat it unless extra course framing is
useful.

## Model policy contract

The existing `modelSelection` field is presented as a user-control decision:

- off means the lecturer fixes one model for all participants;
- on means participants choose among the lecturer's allowed models;
- Auto is the default fixed choice for every newly created chatbot and delegates
  response routing to the existing Auto router;
- a fixed reasoning-capable model requires exactly one supported reasoning
  effort; Auto and non-reasoning models require none;
- participant choice requires at least one active model. Each enabled
  reasoning-capable model keeps one or more allowed reasoning efforts.

The new owner mutation validates these invariants server-side and is the sole
strict-write normalization authority. A fixed write accepts exactly one active
model. Auto and non-reasoning fixed models reject all reasoning entries. A
fixed reasoning model accepts exactly one entry for that model and exactly one
supported effort; entries for any other model are rejected. A
participant-choice write accepts one or more active model IDs. It rejects
reasoning entries for unselected or non-reasoning models, and requires at least
one supported effort for every selected reasoning model. The legacy owner
mutation deliberately keeps accepting and normalizing its existing payload
shapes so a rolling deployment cannot break an older client.

Existing records remain readable without a migration. A legacy fixed record
with zero or several active model IDs resolves through the existing
`CHAT_PRIMARY_MODEL_ID`-aware automatic resolver and is presented as that one
effective fixed model; its first model-settings save persists the canonical
single selection. A fixed legacy reasoning model with several allowed efforts
uses the runtime's existing deterministic default—medium when available,
otherwise the first supported effort—and its first model-settings save
persists that one effort. Participant-choice records with an empty allow-list
retain their established “all active models” read meaning; the editor displays
all active models selected and a subsequent save persists the explicit active
IDs. Retired-only allow-lists retain the existing Luna safety fallback.

The registry must contain exactly one `auto` model, classified as ADVANCED,
non-reasoning, and not the participant-credit fallback. Chatbot creation fails
before writing when that invariant is absent or malformed. Participant credits
and account-usage policy can still fall back from an unavailable advanced
choice to Luna; the UI describes that exceptional safety behavior without
presenting it as participant control.

Extend the required-MCP route coverage so a crafted request for a typed-
disabled mode returns 400 before MCP, thread, or provider work, and so the
canonical normalized configuration reaches compilation. Add adversarial
newline, heading, quote, and instruction-like persona values to prove the
single section boundary and retained platform policies.

## Execution slices and review topology

| Slice                                                     | Owner                                                                      | Dependency            | Acceptance boundary                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0 — reviewed plan commit                                 | Main session                                                               | This plan is approved | The plan, authority, stop conditions, primitive impact, ADR gate, test portfolio, Progress, and exact ownership are committed first.                                                                                                                                                                                                                                              |
| S1 — typed persistence and owner API                      | Main session                                                               | S0                    | Additive no-backfill migration; shared strict/tolerant tests; normalized owner projection; authorization, status, conflict, invariant, and no-write tests; tracked SDL verified.                                                                                                                                                                                                  |
| S2 — effective modes, layered compiler, and documentation | Main session                                                               | S1                    | Layout, API route, and POST route agree; crafted disabled requests fail before effects; compiler order and injection tests pass; legacy, custom, and Quizzer behavior remains; docs and ADR are reconciled.                                                                                                                                                                       |
| S3 — lecturer mode controls and Quizzer flag              | Native executor as the sole implementation writer; main session integrates | S1-S2                 | The owner read path preserves legacy and pre-S3 values; strict writes cover three flags while keeping Tutor or Explainer enabled; Manage Setup edits and reviews all three modes with pending locks and persona preservation; Chat honours a disabled Quizzer before capability filtering; focused API, unit, Playwright, and browser checks pass.                                |
| S4 — model policy and chatbot framing                     | Native executor as the sole implementation writer; main session integrates | Accepted S3           | New chatbots default to fixed Auto; server writes enforce fixed and participant-choice invariants; Manage uses design-system controls with conditional model and reasoning choices; a 200-character framing field saves, reloads, and reaches every standard-mode compiler path as untrusted data; focused service, compiler, Playwright, and English/German browser checks pass. |

S1 and S2 stayed in the main session because S1 crossed data, authorization,
and public-contract seams, while S2 owned prompt authority and was critically
coupled to S1. S3 and S4 are delegated serially to one bounded implementation
writer because each slice's schema, compatibility normalization, resolver, UI,
tests, and documentation form one tightly coupled public contract; no second
writer is introduced.
Each substantive slice receives one
`simplifier` pass and one combined-lens `slice-reviewer` pass in parallel when
the slice is committed. One integrated `final-reviewer` pass follows all
integration and verification. The required planner hardening transcript is
stored at `project/_local/reviews/2026-09-03-chatbot-c1-plan-hardening.md` and
is intentionally local review evidence, not a product artifact.

## Delegation map

| Work item                               | Writer                        | Dependency                               | Acceptance check                                                                   |
| --------------------------------------- | ----------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| S0 — reviewed plan                      | Main session                  | Approved initial plan                    | Committed reviewed plan before implementation.                                     |
| S1 — persistence and owner API          | Main session                  | S0                                       | Committed and slice-reviewed data/API contract.                                    |
| S2 — resolver, compiler, and docs       | Main session                  | S1                                       | Committed and slice-reviewed runtime contract.                                     |
| S3 — lecturer controls and Quizzer flag | One native `executor` role    | S1-S2 and this approved revision         | Main session verifies the exact diff and all checks before accepting the commit.   |
| S3 simplification and risk review       | Dedicated read-only reviewers | Immutable S3 commit                      | Simplifier and combined-lens reviewer run in parallel; main dispositions findings. |
| S4 — model policy and framing           | Same native `executor` writer | Accepted S3                              | Main session verifies the exact diff and all checks before accepting the commit.   |
| S4 simplification and risk review       | Dedicated read-only reviewers | Immutable S4 commit                      | Simplifier and combined-lens reviewer run in parallel; main dispositions findings. |
| Integrated finish gate                  | Dedicated final reviewer      | S4 corrections and verification complete | Complete package reviewed before delivery.                                         |

## Verification portfolio

Run checks inside the repository's supported container/toolchain and keep host
Git operations separate:

- Prisma schema-aware migration generation, client generation, and analytics
  sync against the disposable local database;
- shared type/util unit tests for canonicalization, limits, malformed reads,
  null legacy defaults, and the at-least-one invariant;
- GraphQL generation, schema drift checks, full local GraphQL tests, and the
  owner/status/concurrency authorization matrix;
- focused Chat effective-mode, compiler, required-MCP, and route tests, then
  the full Chat test suite;
- compatibility tests for pre-S3 two-flag values, strict three-flag writes, and
  the Tutor-or-Explainer invariant;
- owner/non-owner GraphQL read and mutation tests plus Chat tests for disabled,
  safely capable, and incapable Quizzer states;
- Manage typecheck and focused Playwright coverage for validation, persistence,
  review summary, persona preservation, and in-flight locks;
- service and route coverage for fixed Auto, fixed reasoning, participant
  choice, empty or unknown model rejection, and compatibility normalization;
- old-client/new-backend contract coverage proving the legacy mutation still
  accepts participant-choice empty allow-lists, fixed empty or multiple
  allow-lists, and irrelevant or multi-effort reasoning entries while the new
  strict mutation rejects the corresponding ambiguous writes;
- compiler coverage proving the short framing value reaches Tutor and
  Explainer inside their full persona projection, reaches Quizzer alone, remains
  JSON-escaped data, and never changes custom modes;
- compatibility coverage proving a 201–1,000-character framing value loads and
  survives a mode-only save unchanged;
- Manage and Playwright coverage for the model-policy branches, required single
  reasoning effort, 200-character framing limit, save locks, and reload;
- host-side focused Playwright and `agent-browser` screenshots of the changed
  Setup state in English and German;
- repository `check:all` and build checks as available;
- exact diff inspection, generated-output cleanliness, and staged secret/PII
  hygiene before every commit.

No live-model check is required. Browser verification is required because S3
and S4 change lecturer interactions, frontend operations, URL-addressable
Setup and Advanced state, and localized UI. The user-leased C1 runtime stays
running after the final check for manual validation.

## Documentation and ADR gate

Amend ADR 0021 for the three-mode typed shape, two-flag compatibility,
Quizzer's independent capability gate, and framing projection. Amend ADR 0041
for the fixed-versus-participant model policy, fixed Auto default, and explicit
fallback exception. Reconcile `docs/chat-platform.md` and
`docs/domain-model.md`; update `docs/data-and-migrations.md` or `CONTEXT.md`
only if their existing statements become inaccurate. Do not add a new ADR
unless the storage choice materially changes. Keep AGENTS.md high-level.

## Progress

| Date       | Status                                                        | Evidence and next action                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-03 | Plan hardening complete                                       | Refreshed v3 baseline is clean at the recorded SHA; planner round 1 findings were arbitrated and round 2 returned `VERDICT: APPROVED`. Claude advisor was unavailable due expired OAuth token. The next action is S0 after human approval.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-03 | S0 — reviewed plan commit                                     | Committed as `23c3d2d581a32aefd37860f755a835f746fa3066` on `rs/chatbot-c1-standard-modes`; implementation remains in this worktree and external delivery remains withheld.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-03 | S1 — typed persistence and owner API review                   | Simplifier returned `DONE_WITH_CONCERNS` with behavior-preserving surface reductions; the unused validation error class and GraphQL input alias were removed. Combined-lens slice review returned `DONE_WITH_CONCERNS` with one required follow-up: the analytics Prisma mirror was missing the new field. `util/sync-schema.sh` synchronized `apps/analytics/prisma/schema/chat.prisma`; container migration/client/codegen/test verification remains pending because the C1 devrouter runtime is unavailable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-09-03 | S2 — effective modes, compiler, and documentation assembled   | Effective-mode consumers now receive the nullable typed configuration; valid Tutor/Explainer flags override legacy opt-outs, malformed or absent values fall back, and typed context is serialized as data between legacy guidance and the fixed platform contract. Route fixtures cover disabled-mode preflight and bootstrap filtering; ADR/wiki/glossary docs are reconciled. Host-side Biome/Prettier and diff checks pass with only two pre-existing Chat route lint diagnostics; container migration/client/codegen/test verification remains pending because the C1 devrouter runtime is unavailable. The next action is the S2 simplifier and combined-lens slice review after the commit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-09-03 | S2 review complete with verification hold                     | The simplifier returned `DONE` with no justified reduction. The combined-lens slice review returned `DONE_WITH_CONCERNS` without a correctness, authorization, projection, injection, compatibility, or architecture finding; it confirmed the already-recorded container verification gap. Review receipts are stored under `project/_local/reviews/` and the head remains `1860a980af`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-09-03 | Container retry — runtime setup failure                       | An outside-sandbox `devrouter ensure . --json` passed process-identity setup but failed while starting Postgres: the sparse C1 checkout lacked the tracked `util/init.sql`, so Docker bind-mounted a directory at `/docker-entrypoint-initdb.d/init.sql` and Postgres exited with `could not read from input file: Is a directory`. The empty mount artifacts were removed and both tracked runtime files are now materialized; no committed source or remote state changed. `devrouter stop .` and the canonical workspace-name stop freed zero routes, and the exact compose project still has four dependency containers running.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-09-03 | Runtime reset approved and completed                          | `devrouter workspace down rs-chatbot-c1-standard-modes --keep-worktree` ran with approval. Devsy had cached a poisoned workspace result that resolved to the wrong cwd; a direct `devsy workspace up` healed the cached resolution, the sparse checkout was extended for the remaining runtime files, and the container bootstrap succeeded: all migrations including `20260903120000_chatbot_standard_mode_config` applied, Prisma in sync, seed data created, Hatchet token captured.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-03 | Container verification complete                               | Util tests 62/62 (incl. 4 chatbotStandardModeConfig). GraphQL codegen + schema-drift + typecheck green after a typed-JSON cast fix committed as `c70b85e9b6`. GraphQL vitest 722/723: the single failure (`assessmentRestrictions.test.ts` reset permission) is pre-existing and environmental — the same source passes on a `db push`-constructed database, the branch has zero diff in the test, live-quiz, and permission files, and the C1 migration is a purely additive JSONB column. Chat vitest 481 passed incl. model-registry parity (after sparse-adding `deploy/env-uzh-stg` and `deploy/env-uzh-prd`). `check:format`, `check:lint`, `check:syncpack` (after sparse-adding `.syncpackrc.mjs`), `check:agents-md`, `check:removed-doc-artifacts`, `check:prisma-sync`, `check:playwright-ci`, and `check:playwright-host` are all green, and the 20-package turbo typecheck/lint including every C1 package passed. Repo-wide typecheck of the six apps whose manifests were added to complete the syncpack workspace but whose sources remain outside the sparse checkout (analytics, auth, frontend-control, frontend-manage, frontend-pwa, office-addin) is unavailable locally; those apps carry zero C1 diff and CI covers them. External delivery (push, merge, deploy) remains withheld pending explicit authorization.                                                                                                                                                                             |
| 2026-09-03 | Integrated final review complete                              | The integrated final reviewer returned `VERDICT: DONE` over the full 34-file diff at head `e8f847d287`: contract, canonicalization, authorization, precedence, compiler order, migration provenance, analytics mirror, and documentation reconciliation all confirmed against the plan; one P3 advisory (locale domain duplicated as a literal set — derive from `Object.values(Locale)` when the frozen en/de contract is next touched), no required follow-up. Receipt stored under `project/_local/reviews/2026-09-03-chatbot-c1-final-review.md`. The portfolio is green and committed; the package is merge-ready at head `e8f847d287` with delivery (push, merge, deploy) explicitly withheld pending authorization.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-09-03 | S3 follow-up approved and plan hardened                       | The user approved lecturer-facing mode controls and clarified that a knowledge base is not globally required. Tutor and Explainer remain general modes with at least one enabled; Quizzer gains an independent typed toggle and keeps its safe `doc_query` capability gate. Planner review required two-flag compatibility and a legacy-aware owner read projection. The branch is clean at `9ea1989292e9196213e55ab900fb69724eeda03f`, 11 commits ahead and 10 behind `origin/v3`; upstream integration, push, merge, and deployment remain withheld. The next action is the single-writer S3 implementation and verification while retaining the user-leased runtime.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-09-04 | S3 lecturer mode controls implemented and source-reviewed     | The single executor implemented the three-mode owner contract and compact Setup accordion controls in `51f2cc46bd`. Planner-required GraphQL operation prefixes were corrected in `3c6852618`. The combined-lens slice reviewer found no correctness, authorization, projection, compatibility, architecture, or test-portfolio defect. The simplifier's duplicated persisted parser and two dead guards were removed in `466036dc98`; its proposed shared JSX renderer was declined because three fixed cards remain clearer than a new rendering abstraction. GraphQL generation and build, Manage/GraphQL/Chat typechecks, 7 util tests, and 60 Chat tests pass with the pinned Node 24.16.0 and pnpm 11.5.0 toolchain. The earlier exact implementation tree also passed 69 focused GraphQL tests; the later operation-name and internal-normalizer-only commits do not touch those server behaviors.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-09-04 | S3 browser verification blocked by the shared Docker provider | The seeded runtime previously rendered the English Learning modes accordion, all three mode cards, and one save action. The final accessibility change added associated labels and explicit enabled states, but the required final English/German toggle-save-reload proof and host Playwright run cannot start: both Manage and Auth currently time out, and an outside-sandbox `devrouter ensure . --json` blocks in Docker's `ps` call. The blocked ensure was stopped without touching other workspaces or data. The next action after Docker recovers is to ensure this exact workspace, run the focused host Playwright spec, capture English and German browser evidence, leave the user-leased runtime running, and then execute the integrated final review.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-09-04 | S3 integrated source review complete                          | The configured `combo/glm-5.3` final-reviewer failed before work with `unreadable_encrypted_agent_task`. The routing continuity ladder supplied the same independent read-only contract to native `gpt-5.6-sol` at xhigh effort with `generic-continuity` provenance. It found one required Playwright interceptor mismatch after the GraphQL operation-prefix correction; both comparisons now match `MUpdateChatbotStandardModeConfig` in `456ab1b48`, and exact-head Playwright TypeScript, Prettier, and diff checks pass. Its same-child correction pass returned `VERDICT: DONE` with no remaining source finding. The user goal remains open solely for the required host Playwright and English/German browser proof once the OrbStack Docker engine responds.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-09-04 | S3 local acceptance complete; runtime lease recovery pending  | Refreshed `origin/v3` is `7182adf2a1b821729a1ed238573c08cece15390d`; the clean local head `feaef323f54d564b54b35957885b2507bb0ec65f` is 17 commits ahead and 18 behind, and no upstream integration occurred. Devrouter 0.0.51 resumed the exact Devsy workspace `rs-chatbot-c1-standard-modes` with the full profile, ten routes, healthy base and optional services, both managed processes running, and no profile drift. English and German `agent-browser` verification proved accessible named switches, explicit enabled and disabled states, independent Quizzer control, the Tutor-or-Explainer invariant, save success, and reload persistence; the seeded values were restored after the mutation check. Host `pnpm playwright:host -- --project=chromium tests/T-chatbot-authoring.spec.ts` passed all 7 tests in 52.6 seconds, including delayed-request locks and the prefixed mutation interceptor. A clearly synthetic `Mode controls validation` draft was created through the lecturer UI after the test cleanup removed Benibot. The final inspired card layout is captured at `/tmp/c1-modes-validation-draft.png`. OrbStack subsequently stopped answering its Docker socket while still reporting `Running`, so all routes time out again; restarting OrbStack would affect unrelated local containers and remains separately approval-gated. The accepted source and browser/test evidence remain valid, but the goal stays open until the exact user-leased runtime is reachable and retained. |
| 2026-09-04 | S3 complete; user-leased validation runtime retained          | The user approved one `orbctl stop` and `orbctl start` cycle after OrbStack's Docker socket repeatedly timed out. The restart restored the provider, and `devrouter ensure` resumed only `rs-chatbot-c1-standard-modes` with the `full` profile. Its owner is present, its Devsy workspace is owned, all five optional and two base services are healthy, both managed processes run, there is no profile drift, and all ten routes are registered. The Auth catch-all was recompiled without a content change to restore its omitted development route. A fresh delegated login reached the synthetic `Mode controls validation` draft; the browser accessibility tree exposes named Tutor, Explainer, and Quizzer switches, and `/tmp/c1-modes-after-orbstack-restart.png` captures all three enabled cards and the single save action. Final direct probes return HTTP 200 for Manage and the Auth provider endpoint. The exact runtime remains running under the user's lease. The accepted source head `caa99b798fb2d3d16999f9443b4c6575104514a7` is 19 commits ahead and 25 behind refreshed `origin/v3` at `86fc70c77f756827d55ea9d0afc5cac3344630cf`. Upstream integration, push, merge, deployment, and runtime cleanup remain withheld.                                                                                                                                                                                                                                                                      |
| 2026-09-04 | S4 model policy and framing plan approved                     | The user added two connected authoring requirements: make fixed-versus-participant model control explicit with fixed Auto as the new-chatbot default, and expose a short lecturer-authored framing note without raw prompt access. Live code inspection confirmed that model selection off already resolves one server-authoritative model, but new chatbots currently default to Luna and the owner mutation accepts ambiguous empty or multi-model fixed configurations. Planner review froze server-authoritative legacy normalization, required Auto-registry invariants, preservation of existing 201–1,000-character framing values, and scope-note-only Quizzer projection. Its second round found a rolling-deployment break in tightening the existing mutation. The accepted correction preserves the legacy mutation and operation while adding a strict model-policy mutation and newly named client operation with old-client/new-backend contract tests. Round three returned `APPROVED`. Refreshed `origin/v3` is `3f79823404`; the local head `7b35f22769` is 20 commits ahead and 26 behind, while draft PR #5744 remains based on `v3`. No upstream integration occurred.                                                                                                                                                                                                                                                                                                                            |
