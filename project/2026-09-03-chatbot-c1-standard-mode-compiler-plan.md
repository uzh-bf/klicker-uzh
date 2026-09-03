# C1 — Standard-mode configuration and layered compiler

Status: proposed for execution after one human approval
Revision: 2026-09-03
Repository: KlickerUZH
Target branch: `v3`
Base commit: `de7138715f7454e1ff0e794071b6c227bdfa0230`
Roadmap work item: C1 — standard-mode configuration and layered compiler
Boundary owner: `rs-roadmap-orchestrator`
Execution owner: the current main session in the dedicated C1 worktree

## Goal

Add a typed, constrained configuration for the Tutor and Explainer standard
modes. Lecturers can eventually control the bounded persona context and mode
availability without receiving raw system-prompt access. The server persists
the configuration, exposes it through an owner-only GraphQL contract, and
compiles it over the existing non-removable platform scaffolding.

The first C1 delivery ends at a locally committed, reviewed, source-complete
boundary candidate. It does not claim a pushed branch, merged change,
deployment, runtime acceptance, or live-model proof.

## Scope and non-goals

In scope:

- one additive, nullable typed configuration for Tutor and Explainer;
- bounded course name, subject domain, language-of-instruction, and scope-note
  fields shared by both standard modes;
- explicit Tutor and Explainer enablement with an at-least-one invariant on new
  accepted replacements;
- owner-authorized full-replacement GraphQL mutation and normalized projection;
- effective-mode resolution and layered compiler integration;
- characterization, authorization, migration, and injection-boundary tests;
- the ADR and engineering-wiki updates required by the implemented behavior.

Out of scope:

- the Manage UI or a future authoring editor;
- Quizzer controls, practice flows, or custom-mode review;
- publication approval, account activation, or usage enforcement;
- response generation, citation-policy redesign, or new runtime storage;
- branch integration, pushing, pull-request changes, merging, deployment,
  cluster operations, and live-model/browser acceptance.

## Authority and stop conditions

The approved package authorizes source edits in the C1 worktree, one
schema-aware additive Prisma migration, generated client and analytics sync,
repository-native checks, local commits, and the required review passes.
Migration generation and GraphQL integration tests may write only to a
disposable local development/test database. Shared development, staging,
production, and live-data database writes remain withheld, as do deployment,
runtime, cluster, and infrastructure changes.

The package stops at a reviewed local source boundary and reports
`BOUNDARY_CANDIDATE` to `rs-roadmap-orchestrator`. Push, pull-request creation
or readiness changes, branch integration, merge, deployment, and cleanup are
separate actions requiring their own authority. If a required check needs a
shared database or another withheld effect, stop before that effect and report
the exact blocker.

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

| Primitive | C1 decision | Owner and invariant | Consumers and impact |
|---|---|---|---|
| Chatbot mode/persona | Extend the existing Chatbot configuration with constrained shared persona fields and Tutor/Explainer flags. | The lecturer owns the stored value through the chatbot; every new replacement enables at least one standard mode. | GraphQL owner API, future Manage editor, effective-mode resolver, compiler. |
| Effective mode set | Extend the existing server resolver with typed flags while preserving legacy and MCP policy. | Server policy owns the visible/requestable set; a hidden standard mode cannot be selected by a crafted request. | Chat layout, chatbot API route, chat POST route, future authoring UI. |
| Prompt scaffolding | Reuse the existing platform-owned layers and compose typed context below the platform contract. | Platform owns course scope/evidence, privacy and safety, non-disclosure, epistemic integrity, formatting, citations, and final language. | Chat compiler and route tests; no new prompt authority. |
| Publication and AI authorization | Reuse existing lifecycle and account gates; change neither contract. | Publication approval and account capability remain separate and out of C1. | Existing GraphQL authorization and publication flows. |

No separate product primitive is introduced for persona fields; they remain a
constrained part of Chatbot mode configuration.

## Frozen data contract

Persist one nullable `Chatbot.standardModeConfig Json?` field, annotated with
the repository's Prisma JSON type-generation convention. The shared canonical
shape is:

```text
{
  tutorEnabled: boolean,
  explainerEnabled: boolean,
  courseName: string | null,
  subjectDomain: string | null,
  languageOfInstruction: Locale | null,
  scopeNote: string | null
}
```

`Locale` reuses the existing `en`/`de` domain. It describes persona context;
it does not override the compiler's final conversation-language policy.

The field is nullable to preserve untouched legacy rows. Null means both
standard modes are enabled unless a legacy `systemPrompts.<mode>.enabled:false`
opt-out applies, with all persona fields blank. Existing rows are not
backfilled or normalized.

The shared interface belongs in `packages/types`. A dependency-free module in
`packages/util` provides two entry points over that interface:

- strict write validation trims values, converts empty text to null, requires
  at least one of Tutor or Explainer to be enabled, accepts single-line course
  name and subject domain values up to 160 characters, normalizes a multiline
  scope note up to 1,000 characters, and returns `BAD_USER_INPUT` for malformed
  or overlong input;
- tolerant read normalization accepts null, treats malformed persisted JSON as
  absent, and falls back to legacy/default platform behavior without logging or
  exposing raw JSON.

A valid non-null typed value is authoritative for Tutor and Explainer flags.
Null or malformed typed data derives those flags from legacy explicit opt-outs
and otherwise defaults them enabled. Legacy flags continue to govern Quizzer
and custom modes. Required-MCP filtering can still leave no effective modes by
approved policy; the at-least-one rule applies to every newly accepted typed
replacement, not to legacy rows after other policy filters.

## GraphQL contract

Add an owner-facing typed object and input plus a dedicated full-replacement
`updateChatbotStandardModeConfig` mutation. The mutation uses the existing
`asChatbotAuthor` schema gate and service-level owner check. It allows the same
free-knob statuses as metadata and model settings (`DRAFT`, `REJECTED`, and
`PUBLISHED`), rejects `PENDING_APPROVAL` and `PAUSED`, and performs an
owner-scoped lookup followed by a transactional status compare-and-set. A
concurrent lifecycle change returns `CHATBOT_EDIT_CONFLICT`.

The GraphQL response exposes the normalized typed object only; raw
`systemPrompts` remains absent. The existing `QGetChatbotsInfo` operation is
unchanged in C1 so deployed persisted-operation hashes remain compatible. C1
adds no frontend operation consumer. Regenerate all GraphQL artifacts to
verify schema and type consistency, commit only the tracked public SDL at this
SHA, and leave ignored generated outputs uncommitted.

Test the schema-level Catalyst/account-owner/full-access gate separately from
service-level owner, status, compare-and-set, invariant, malformed-input, and
no-write behavior.

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

Extend the required-MCP route coverage so a crafted request for a typed-
disabled mode returns 400 before MCP, thread, or provider work, and so the
canonical normalized configuration reaches compilation. Add adversarial
newline, heading, quote, and instruction-like persona values to prove the
single section boundary and retained platform policies.

## Execution slices and review topology

| Slice | Owner | Dependency | Acceptance boundary |
|---|---|---|---|
| S0 — reviewed plan commit | Main session | This plan is approved | The plan, authority, stop conditions, primitive impact, ADR gate, test portfolio, Progress, and exact ownership are committed first. |
| S1 — typed persistence and owner API | Main session | S0 | Additive no-backfill migration; shared strict/tolerant tests; normalized owner projection; authorization, status, conflict, invariant, and no-write tests; tracked SDL verified. |
| S2 — effective modes, layered compiler, and documentation | Main session | S1 | Layout, API route, and POST route agree; crafted disabled requests fail before effects; compiler order and injection tests pass; legacy, custom, and Quizzer behavior remains; docs and ADR are reconciled. |

Both implementation slices stay in the main session because S1 crosses data,
authorization, and public-contract seams, while S2 owns prompt authority and
is critically coupled to S1. Each substantive slice receives one
`simplifier` pass and one combined-lens `slice-reviewer` pass in parallel when
the slice is committed. One integrated `final-reviewer` pass follows all
integration and verification. The required planner hardening transcript is
stored at `project/_local/reviews/2026-09-03-chatbot-c1-plan-hardening.md` and
is intentionally local review evidence, not a product artifact.

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
- repository `check:all` and build checks as available;
- exact diff inspection, generated-output cleanliness, and staged secret/PII
  hygiene before every commit.

No browser or live-model check is required: C1 changes no UI, frontend
operation, authentication redirect, or runtime deployment. If implementation
later crosses one of those boundaries, stop and reclassify the verification
before starting it.

## Documentation and ADR gate

Amend ADR 0021 if the concrete typed shape, precedence, malformed-read
behavior, or compiler placement changes its approved standard-mode behavior;
otherwise link the implementation without creating a duplicate decision. Do
not add a new ADR unless the storage choice materially changes the approved
contract. Reconcile `docs/chat-platform.md`, `docs/domain-model.md`,
`docs/data-and-migrations.md`, and a concise `CONTEXT.md` term with the final
behavior. Keep AGENTS.md high-level.

## Progress

| Date | Status | Evidence and next action |
|---|---|---|
| 2026-09-03 | Plan hardening complete | Refreshed v3 baseline is clean at the recorded SHA; planner round 1 findings were arbitrated and round 2 returned `VERDICT: APPROVED`. Claude advisor was unavailable due expired OAuth token. The next action is S0 after human approval. |
| 2026-09-03 | S0 — reviewed plan commit | Committed as `23c3d2d581a32aefd37860f755a835f746fa3066` on `rs/chatbot-c1-standard-modes`; implementation remains in this worktree and external delivery remains withheld. |
| 2026-09-03 | S1 — typed persistence and owner API review | Simplifier returned `DONE_WITH_CONCERNS` with behavior-preserving surface reductions; the unused validation error class and GraphQL input alias were removed. Combined-lens slice review returned `DONE_WITH_CONCERNS` with one required follow-up: the analytics Prisma mirror was missing the new field. `util/sync-schema.sh` synchronized `apps/analytics/prisma/schema/chat.prisma`; container migration/client/codegen/test verification remains pending because the C1 devrouter runtime is unavailable. |
| 2026-09-03 | S2 — effective modes, compiler, and documentation assembled | Effective-mode consumers now receive the nullable typed configuration; valid Tutor/Explainer flags override legacy opt-outs, malformed or absent values fall back, and typed context is serialized as data between legacy guidance and the fixed platform contract. Route fixtures cover disabled-mode preflight and bootstrap filtering; ADR/wiki/glossary docs are reconciled. Host-side Biome/Prettier and diff checks pass with only two pre-existing Chat route lint diagnostics; container migration/client/codegen/test verification remains pending because the C1 devrouter runtime is unavailable. The next action is the S2 simplifier and combined-lens slice review after the commit. |
| In progress | S2 finish gate | Commit the assembled S2 slice, run the required review passes, then complete the container-dependent verification if the runtime becomes available; otherwise record `delivery_pending` and report the local boundary candidate with the runtime gap and external delivery withheld. |
