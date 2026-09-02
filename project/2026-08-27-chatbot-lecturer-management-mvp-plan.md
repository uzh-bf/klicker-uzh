# Lecturer chatbot management MVP

## Status

- **Decision gate:** Stack Gate 1 approved by the user on 2026-08-27
- **Roadmap position:** Urgent M2a delivery slice. This does not complete the roadmap's full C2 authoring or C4 test-and-publication scope.
- **Authoritative base:** `origin/v3` at `34e21ff0fa820b0f9187926e5809384b80eed14e`
- **Planning worktree:** `/Users/rschlae/Git/klicker/klicker-uzh/trees/chatbot-lecturer-management-mvp`
- **Plan path:** `project/2026-08-27-chatbot-lecturer-management-mvp-plan.md`
- **Current branch:** `rs/chatbot-draft-authoring-ui`
- **Target:** A three-layer GitHub stack into `v3`
- **Execution owner:** This roadmap orchestration session owns decomposition, integration, verification, reviews, progress updates, commits, and draft PR delivery through the gates below.
- **Boundary owner:** The user owns decisions to merge, deploy, change production data, integrate `v3` into `v3-ai`, or activate accounts.

## Goal

Deliver the smallest complete lecturer flow after the account-level AI gate:

1. Create a course-bound draft chatbot.
2. Edit its name, description, existing safe model settings, and the lecturer-editable disclaimer title and introduction.
3. Preview the disclaimer exactly as participants will see it, including the fixed platform text.
4. Submit a complete draft for publication and see its review state.

Participants continue to see only published chatbots. Publication remains a separate administrator decision.

## Current state and reusable work

- `v3` already has the chatbot lifecycle, owner-scoped create and update services, model-policy editing, publication requests, and administrator approve or reject services.
- Manage currently lists chatbots and exposes model settings, but it has no create, metadata editing, disclaimer authoring, or publication-request UI.
- No parallel branch inspected contains a reusable implementation of those missing flows.
- The existing Slate editor is reusable through `ContentInput` and `EditorField`; the MVP should extend it with a constrained toolbar preset instead of introducing another editor.
- `v3-ai` already contains the AI beta route gate and administrator enable action. Knowledge-base management and chatbot binding also exist there, but remain a separate composable feature.
- Response-example and ground-truth work is unrelated and remains outside this plan.

## Binding product and lifecycle decisions

| Area | MVP contract |
| --- | --- |
| Account access | On current `v3`, Catalyst/full-access lecturers can prepare drafts. Publication submission continues to require live `aiChatbotPublishingEnabled`. After this stack reaches `v3`, a required separate `v3-ai` integration package makes `aiFeaturesEnabled` and `aiChatbotPublishingEnabled` one atomically managed account approval. |
| Course | The lecturer selects one owned course at creation. The course is immutable afterward. |
| Metadata | The lecturer can edit name and description. Avatar authoring is deferred. Existing model settings remain available. |
| Disclaimer | The platform owns the fixed responsibility, data-protection, consent, and consequence sections. The lecturer can edit only the disclaimer title and introduction. |
| Slate subset | The basic editor supports paragraphs, bold, italic, and ordered or unordered lists. It omits links, images, video, math, code, quotes, and raw HTML. The existing full editor remains the default everywhere else. |
| Disclaimer identity | A changed disclaimer is saved as a new row and linked to the chatbot. The old row remains historical. A normalized no-op does not create a row. This makes participant re-acceptance follow the existing disclaimer-ID contract. |
| Disclaimer validation | Normalize CRLF or CR to LF and trim surrounding whitespace. The normalized title must contain 1-160 characters; the normalized introduction must contain 1-10,000 characters. Both bounds are enforced at the GraphQL service boundary after normalization. |
| Publication completeness | Submission requires a linked, non-empty disclaimer in addition to the existing use case, expected student count, and proposed credit inputs. |
| Rejection | The review comment is visible. A rejected chatbot becomes editable and can be resubmitted. |
| Publication | Submission changes the chatbot to `PENDING_APPROVAL`; it never auto-publishes. |

### Server-enforced lifecycle matrix

| Status | Metadata and model policy | Disclaimer | Publication action |
| --- | --- | --- | --- |
| `DRAFT` | Editable | Editable | Can submit when complete and authorized |
| `REJECTED` | Editable | Editable | Can resubmit when complete and authorized |
| `PENDING_APPROVAL` | Read-only | Read-only | None |
| `PUBLISHED` | Metadata and model policy remain editable under ADR 0041 | Read-only in this MVP | None |
| `PAUSED` | Read-only | Read-only | None |

These rules are enforced in GraphQL services, not only in the UI.

## Primitive impact

| Primitive | Change in this MVP |
| --- | --- |
| Actor | Lecturer authoring and submission; administrator review remains existing behavior |
| Resource | Existing `Chatbot` plus versioned `ChatbotDisclaimer` rows |
| State | Existing lifecycle only; no new status |
| Capability | Prepare a draft before publication authorization; submit only after authorization |
| Policy | Owner checks, lifecycle guards, mandatory disclaimer, and stale-write protection |
| Evidence | Service tests, generated schema, Manage checks, browser and Playwright proof |

## Non-goals

- No new administrator review queue, budget enforcement, deployment, or production-data changes.
- No standard-mode prompt compiler, custom or raw prompt editing, or lecturer test-chat flow.
- No knowledge-base, MCP, multi-course, avatar, media, pause, or delete UI.
- No response-example or ground-truth work.
- No editing of a published chatbot's disclaimer. That requires a later revision workflow.
- No storage of Microsoft Forms submissions in Klicker.

## Stack topology

The stack is sequential. Each layer is independently reviewable and leaves the application in a coherent state.

### Layer 01: `rs/chatbot-authoring-contract`

**Purpose:** Complete the disclaimer and publication-safe GraphQL foundation.

**Scope:**

- Expose the editable disclaimer projection and publication fields required by Manage.
- Add a save-disclaimer mutation using copy-on-write replacement.
- Require the caller's expected current disclaimer ID and reject stale saves.
- Create the replacement, compare the expected current ID, and link the chatbot in one transaction so a stale save cannot leave an orphan row.
- Preserve non-editable disclaimer name, description, and media fields when replacing a row.
- Normalize line endings and surrounding whitespace, enforce title length 1-160 and introduction length 1-10,000 at the GraphQL service boundary after normalization, and treat normalized unchanged content as a no-op.
- Enforce the lifecycle matrix for metadata, model-policy, and disclaimer mutations.
- Require a linked non-empty disclaimer before publication submission.
- Make accepted-participant counts compare against the chatbot's current disclaimer ID instead of counting any historical acceptance.
- Add focused service tests, schema output, wiki updates, and the disclaimer-identity ADR.

**Activation completeness:** Complete. The API is safe to consume without hidden UI-only invariants.

**Risk and review:** High data-integrity and authorization risk. Review covers GraphQL contracts, ownership, lifecycle enforcement, concurrency, historical acceptance, and migration absence.

**Acceptance:** GraphQL generation, focused GraphQL tests, GraphQL typecheck, repository checks, and the risk-boundary slice review pass.

**Estimated review size:** About 300-450 human-authored lines across 8-12 files, plus generated output. The public invariant is kept in one package rather than split across dependent server layers.

### Layer 02: `rs/chatbot-draft-authoring-ui`

**Purpose:** Let a lecturer create and prepare a draft in Manage.

**Scope:**

- Add handwritten client operations for create, metadata update, and disclaimer save.
- Extend `QGetChatbotsInfo` with `publicationUseCase`, `expectedStudentCount`, `reviewComment`, `publishedAt`, and editable disclaimer fields.
- Add a creation dialog with owned-course selection and select the newly created chatbot.
- Add lifecycle-aware name and description editing while keeping the chosen course read-only after creation.
- Add `toolbarPreset="full" | "basic"` to `ContentInput`, defaulting to `full`; the new disclaimer editor uses `basic`.
- Remount the Slate input by chatbot and current disclaimer ID so selection changes cannot retain stale editor state.
- Preview lecturer content together with the same localized fixed `chat.disclaimer.*` sections used by the participant modal.
- Add focused localization, component, browser, and end-to-end coverage.

**Activation completeness:** Complete for draft preparation. No incomplete create path is exposed.

**Risk and review:** Medium UI, localization, accessibility, and stale-state risk.

**Acceptance:** GraphQL generation, Manage typecheck, repository checks, focused Playwright coverage, and browser proof in English and German at desktop and mobile widths.

**Estimated review size:** About 400-600 human-authored lines across 10-16 files. It remains one work package because create, selection, editing, and preview form one usable authoring path.

### Layer 03: `rs/chatbot-publication-ui`

**Purpose:** Complete the lecturer handoff into the existing publication review lifecycle.

**Scope:**

- Add the publication-request client operation.
- Add use case, expected student count, and proposed credit inputs with server errors surfaced clearly.
- Show whether the account may submit while still allowing unauthorized lecturers to prepare drafts.
- Show pending, rejected with review comment, published, and paused states consistently with the lifecycle matrix.
- Prevent duplicate or invalid submissions in the UI while retaining server enforcement.
- Add focused localization, browser, and end-to-end coverage.

**Activation completeness:** Complete. Submission produces a visible pending state and never implies publication.

**Risk and review:** Medium lifecycle and product-contract risk.

**Acceptance:** GraphQL generation, Manage typecheck, repository checks, Playwright coverage of authorized and unauthorized states, and final browser proof.

**Estimated review size:** About 250-400 human-authored lines across 6-10 files.

## Required sequential `v3-ai` integration package

This package is required before staging can demonstrate the intended external-request and manual-approval flow. It is not part of the `v3` stack because it has a different base.

- **Proposed branch:** `rs/chatbot-ai-entitlement-integration`
- **Start condition:** The user or repository owner has integrated current `v3` into `v3-ai`.
- **Required behavior:** Preserve `assertManageAiEnabled` on every authoring operation; add one generated backfill migration setting `aiChatbotPublishingEnabled=true` for existing accounts where `aiFeaturesEnabled=true`; make every later administrator `setAiFeatures` action write both flags atomically. Disabled accounts cannot access authoring. Enabled accounts can author and submit, while each chatbot still requires the separate existing publication approval.
- **Request path:** Add the public Microsoft Forms URL to the AI unavailable state. Form responses remain external, and administrators enable approved accounts manually.
- **Missing input:** The public Microsoft Forms URL. Its absence blocks final `v3-ai` browser proof, not this `v3` stack.
- **Withheld actions:** This plan does not authorize merging `v3` into `v3-ai`, changing live accounts, or deploying either branch.

## Implementation slices, route, and acceptance

| Slice | Route and owner | Owned paths | Acceptance check |
| --- | --- | --- | --- |
| Server contract | Main execution orchestrator because authorization and disclaimer identity are judgment-heavy and on the critical path | `packages/graphql`, focused tests, `docs/adr`, affected wiki page | Lifecycle matrix, copy-on-write/no-op/stale-save behavior, mandatory disclaimer, and current-ID acceptance counts all pass focused tests and schema generation |
| Draft authoring UI | One native executor, integrated and verified by the main session | `apps/frontend-manage`, handwritten GraphQL ops, shared `ContentInput`, i18n, focused e2e | Create/select/edit/preview works with synthetic data; the constrained editor does not change existing editor defaults |
| Publication UI | One native executor after the draft UI is integrated | `apps/frontend-manage`, handwritten GraphQL op, i18n, focused e2e | Unauthorized preparation, authorized submission, pending read-only, and rejected correction/resubmission are proven |
| Entitlement reconciliation | Separate proposed task on future integrated `v3-ai`; no writer is launched by this plan | `v3-ai` admin gate, one generated backfill migration, unavailable screen, tests | Disabled accounts cannot author; enabled accounts can author and submit; per-chatbot publication remains separate; the external request link is browser-proven |

There is one writer per worktree and no parallel code mutation. Executor patches are reviewed and integrated by the execution orchestrator.

## Feature-wide test portfolio

| Existing evidence | Test obligation | Stable seam | Distinct failure protected | Owning slice |
| --- | --- | --- | --- | --- |
| Existing chatbot service tests cover ownership, publication transitions, and model-policy validation | Extend the service suite across all lifecycle states; copy-on-write, no-op, stale-ID and transaction behavior; normalization and bounds; mandatory disclaimer; current-ID acceptance counts | GraphQL service functions with a controlled Prisma test database | Unauthorized or invalid writes, orphan disclaimer rows, missed re-acceptance, and incomplete publication | Layer 01 |
| Current schema generation and handwritten Manage operations compile | Regenerate the public schema and client types; compile every new operation against it | Generated GraphQL contract | UI and server silently drifting on field names, nullability, or mutation inputs | Layers 01-03 |
| Existing Manage checks cover the application baseline | Run focused Manage checks and repository `check:all`; inspect formatting and generated diffs for scope | TypeScript and repository-native static checks | Stale types, invalid component composition, or unrelated formatter churn | Each owning layer |
| Existing chatbot Playwright coverage proves list, detail, and model settings | Prove create/select/edit/preview/reload plus enabled submission, pending lock, rejected correction and resubmission | Host Playwright against the exact devrouter worktree URLs and seeded database | A visually plausible UI that fails as a complete persisted workflow | Layers 02-03 |
| The participant modal defines the current disclaimer rendering | Prove English and German desktop and mobile states, including fixed template text and Slate toolbar restrictions | Host agent-browser against the exact devrouter worktree URLs | Lecturer preview diverging from participant presentation or inaccessible responsive states | Layers 02-03 |
| `v3-ai` has separate AI and publication flags today | Prove generated backfill, atomic dual writes, disabled denial, enabled authoring/submission, form link, and separate chatbot approval | Account service tests plus host browser proof on future integrated `v3-ai` | Existing enabled users losing access or account approval being confused with chatbot publication | Separate `v3-ai` package |

Tests are added only at consequential service and user-flow seams. Existing tests are extended where they already own the behavior.

## Runtime and verification

- Use `devrouter ensure .` for the exact implementation worktree. Run application code generation, typechecks, unit and service tests, Prisma commands, and repository checks inside its managed devcontainer.
- Run Playwright on the host against the exact devrouter worktree URLs. Run the mandatory agent-browser proof on the host against the same URLs.
- Use only seeded or synthetic local data.
- Use the existing delegated local lecturer account and agent-browser for the required frontend proof.
- If a reset is necessary, use the repository's explicit local reset, push, and seed commands only inside the devcontainer.
- Stop the exact runtime and verify it stopped after the final runtime-dependent check unless the user explicitly asks to keep it running.

## Documentation and ADR disposition

- Create the next available ADR for immutable disclaimer identity, copy-on-write replacement, and participant re-acceptance.
- Reference existing ADR 0020 for the publication lifecycle and ADR 0041 for published model-policy editing; do not restate or rewrite those decisions.
- Update the affected chatbot and Manage wiki pages in the same stack layer as the behavior.
- Record this delivery as urgent M2a in the active roadmap. Leave the original standard-mode compiler and lecturer test-chat items open.

## Approval and delivery boundaries

Approval of this Gate 1 plan authorizes:

- Moving the existing planning worktree to the exact approved `origin/v3` base, then creating the three named sequential stack branches in that one worktree.
- In-scope edits, repository-native checks, runtime verification, configured executor and review passes, progress updates, and local commits.
- Pushing the three named branches and opening or updating draft PRs into `v3`, because those delivery actions are named explicitly here.

Execution pauses at:

- **Stack Gate 2:** After Layer 01 is committed, reviewed, verified, and its draft PR is opened. The user reviews the server contract before UI layers continue.
- **Stack Gate 3:** After all layers are committed, reviewed, verified, and their draft PRs are open. The user reviews the final stack before any merge action.

This plan does not authorize merging, queueing, deploying, promoting to staging or production, changing production data, activating accounts, integrating `v3` into `v3-ai`, or deleting branches, worktrees, or runtimes.

## Material pause conditions

Return to the user before continuing if:

- The disclaimer contract unexpectedly requires a database schema migration.
- Product scope expands to editing published disclaimers, standard modes, test chat, or knowledge-base authoring in this stack.
- The required `v3-ai` integration base or gate behavior changes before that separate task begins.
- Verification exposes a conflict between preserving historical acceptances and the current participant modal contract.

The missing Microsoft Forms URL is tracked as an input for the later `v3-ai` task and does not pause the current `v3` stack.

## Progress

- [x] Fresh authoritative `origin/v3` established at `34e21ff0fa820b0f9187926e5809384b80eed14e`.
- [x] Existing GraphQL, Manage UI, Slate, lifecycle, and parallel branches inventoried.
- [x] Product boundary and urgent M2a scope defined.
- [x] Initial planner review dispositioned into this plan.
- [x] Stack Gate 1 approved by the user on 2026-08-27.
- [x] Layer 01 GraphQL authoring contract implemented without a database migration.
- [x] Layer 01 focused GraphQL verification: 59 tests passed against the dedicated synthetic `klicker-qa` database. The repository `test:local` bootstrap could not run inside the current profile image because that image has no Docker CLI, so the same two Vitest specs used the running devcontainer's Postgres, Redis, and Hatchet services with temporary local Redis forwards.
- [x] Current `origin/v3` at `1e7308d67ced9645ed9f93dc0a0f37bce9fa0463` merged cleanly into Layer 01; its only new diff was the staging image-pin update.
- [x] Layer 01 repository `check:all` passed in the exact managed devcontainer. The focused GraphQL check and all 59 focused integration tests also passed after the simplifier adjustments.
- [x] Slice review: done — the configured external reviewer routes failed before work with `unreadable_encrypted_agent_task`, so the approved generic-continuity route used native GPT-5.6 Luna at max effort over plaintext. The independent risk review returned `DONE` with no actionable findings. The simplifier returned `DONE_WITH_CONCERNS`; two behavior-preserving cleanups were accepted, while the proposed accepted-count query rewrite was rejected because the existing composite key keeps the chatbot/disclaimer pair explicit without a large dynamic `OR` filter.
- [x] Layer 01 implemented, reviewed, verified, and published as draft PR [#5593](https://github.com/uzh-bf/klicker-uzh/pull/5593).
- [x] Stack Gate 2 approved by the user on 2026-08-27.
- [x] Layer 02 executor pass completed with GPT-5.6 Luna at max effort after both the configured native executor and its same-provider plaintext continuity route failed before work with `unreadable_encrypted_agent_task`. The user selected Luna for execution; it delivered the draft authoring UI and focused generation, type, lint, Playwright compile/list, formatting, and diff checks. The execution orchestrator owns integration, browser proof, review gates, and delivery.
- [x] Current `origin/v3` was merged once into Layer 02 as approved. Later `v3` movement remains unintegrated until the layer is otherwise ready, following the stack integration cadence.
- [x] Layer 02 review findings were dispositioned: native accessible toolbar buttons, localized live error messages, stable draft creation, and simpler Slate remounting are committed. The configured specialist routes again failed before work with `unreadable_encrypted_agent_task`; independent GPT-5.6 Luna continuity reviewers covered the same risk and simplification lenses.
- [x] Layer 02 verification passed on exact head: repository `check:all` under the pinned Node 24 devcontainer; Playwright TypeScript and formatting checks; and the focused host Chromium authoring flow, including keyboard toolbar activation, persisted formatted disclaimer content, chatbot switching, and reload.
- [x] Layer 02 browser proof passed with delegated synthetic lecturer access on the exact devrouter URL. English and German desktop and 390x844 mobile states show draft creation, editable metadata, the constrained Slate toolbar, the fixed participant disclaimer template, and persisted content after reload. Screenshots remain local under the ignored `project/_local/screenshots/` evidence directory.
- [x] Approved post-verification integration of current `origin/v3` (`d0eab767345`) merged cleanly into Layer 01 and propagated to Layer 02. Upstream touched only docs, CI/devcontainer policy (including the host-only Playwright launcher from #5610), an unrelated chat disclaimer contrast fix, and staging values; no `packages/graphql` source changed. Post-merge repository `check:all` passed in a freshly recreated pinned container and the focused host Chromium authoring spec passed through `pnpm playwright:host`.
- [x] Both layer heads pushed after verification: `rs/chatbot-authoring-contract` at `eec5c966ed3` and `rs/chatbot-draft-authoring-ui` at `a3b2b38d4e`. The host pre-push build hook was skipped for these pushes because it ran on unpinned host Node 26 instead of the pinned Node 24 toolchain where the identical context had already been fully verified.
- [x] PR [#5593](https://github.com/uzh-bf/klicker-uzh/pull/5593) description updated for the whole layer including the v3 integration merge, and draft PR [#5614](https://github.com/uzh-bf/klicker-uzh/pull/5614) opened for Layer 02 against the Layer 01 branch.
- [x] Layer 02 implemented, reviewed, verified, and published as draft PR [#5614](https://github.com/uzh-bf/klicker-uzh/pull/5614).
- [ ] Layer 03 publication UI implemented, reviewed, verified, and published as a draft PR on top of `rs/chatbot-draft-authoring-ui`.
- [ ] Integrated final review and Stack Gate 3.
- [ ] Separate `v3-ai` integration package planned and executed after its start condition is met.
