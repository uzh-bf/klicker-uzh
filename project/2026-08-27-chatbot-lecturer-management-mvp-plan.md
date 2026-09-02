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
- [x] Layer 03 executor pass completed with GPT-5.6 Luna at max effort on `rs/chatbot-publication-ui`: publication request op, lifecycle-gated submission UI using the existing `GetChatAccountUsage.authorized` flag (fails closed), EN/DE i18n, docs sentence, and three new Playwright scenarios covering authorized submission to pending, rejected correction/resubmission, and incomplete unauthorized preparation.
- [x] Layer 03 final review returned one blocking finding (publication fields stayed editable while the mutation was in flight). Fixed by disabling all three inputs during submission and protecting the behavior in the pending Playwright scenario with a delayed mutation route; independent GPT-5.6 Sol review otherwise verified lifecycle, authorization fail-closed behavior, i18n, scope, data hygiene, and zero migrations.
- [x] Layer 03 verification passed on exact head: repository `check:all` exit 0 in the pinned container and focused host Chromium suite 4/4 passed.
- [x] Layer 03 implemented, reviewed, verified, and published as a draft PR on top of `rs/chatbot-draft-authoring-ui`.
- [x] Integrated final review completed across all three layers. It found five concrete issues: FULL_ACCESS lecturers were coupled to the metered-usage query, unsupported disclaimer Markdown was not rejected server-side, save-in-flight fields remained editable, raw GraphQL length limits rejected some valid normalized values, and the plan retained a stale PR #5608 wiki-log reference.
- [x] All five integrated-review findings were corrected in their owning layers: a purpose-specific publishing-capability query now covers FULL_ACCESS lecturers, the server enforces the disclaimer Markdown subset and normalized lengths, metadata and Slate inputs lock during pending saves with delayed-response coverage, and the stale plan reference was removed.
- [x] Post-correction verification passed on the integrated top layer: repository `check:all`; focused Manage typecheck; the isolated GraphQL suites with 40 and 16 passing tests; and the exact host Chromium authoring flow with all five lifecycle scenarios passing. Running both stateful GraphQL suites in one Vitest process exposed their pre-existing shared-database ordering assumption, while each suite passed independently.
- [x] Mandatory agent-browser proof passed on the exact authenticated devrouter URL at 1440x1000: draft creation, metadata editing, the constrained Slate disclaimer editor, participant preview, publication form, model settings, and chatbot selection all rendered. The page still reports pre-existing global header nested-button hydration noise and the design-system `Modal` component's missing Radix description hook; neither affected the authoring workflow and both remain outside this MVP stack.
- [x] The follow-up correction review found three additional gaps: Catalyst authoring did not require a sufficient login scope, math nodes bypassed the disclaimer Markdown allowlist, and create/model controls remained interactive during pending requests. Layer 01 now requires Catalyst plus `FULL_ACCESS` or `ACCOUNT_OWNER` and rejects math syntax at `46da9d6ef`; Layer 02 locks the remaining pending controls at `aebe64bed`. The isolated authorization, account-usage, and chatbot suites passed with 8, 16, and 42 tests; repository `check:all` passed with 25 tasks; and the exact host Chromium authoring suite passed all 6 scenarios.
- [x] The correction commits were propagated through the local stack without rebasing. The integrated Layer 03 head is `b2cc617cf`. Current `origin/v3` is `0892b61dc`, one post-baseline CI-only commit beyond the already-integrated `86e8ac2e1`; it remains deliberately unintegrated because no new upstream-integration pass was authorized.
- [x] 2026-08-28 approved integration pass: current `origin/v3` (`0892b61dc`, trusted-policy CI fix and devcontainer runtime profiles) merged into Layer 01 with the single plan-file conflict resolved using v3's removed-artifact wording; propagated cleanly through Layers 02 and 03. New heads: Layer 01 `c984960a4`, Layer 02 `564d1deca`, Layer 03 `0500466d5`. Focused checks passed on Layer 03: `check:removed-doc-artifacts`, Prettier on the resolved plan file, `syncpack lint`, and the exact pre-push turbo build (23/23 tasks). All three branches pushed. `/final-review` posted on PR [#5593](https://github.com/uzh-bf/klicker-uzh/pull/5593) and `/final-review-stack` on PR [#5619](https://github.com/uzh-bf/klicker-uzh/pull/5619); the comment-triggered runs failed at startup in the review CLI (repo-wide workflow defect, stderr discarded), so an unrelated workflow fix was merged to `v3` as PR [#5638](https://github.com/uzh-bf/klicker-uzh/pull/5638) (`7ea3f8ba6`). The user recorded PR #5593's GitGuardian finding as a false positive.
- [x] 2026-08-28 review rerun on final heads: Layer 03 tip is `a6a2582a1` (Progress evidence commit). `/final-review` and `/final-review-stack` were re-posted once on this final head after the first stack snapshot raced the bookkeeping push; the earlier failure verdicts are the workflow's CLI-startup defect, not review findings against this stack.
- [x] 2026-08-29 superseding exact-head CI receipt: Layer 01 is `c984960a4`, Layer 02 is `564d1deca`, and Layer 03 is `d06201a5f`. Layer 01 Playwright run `33200767163` passed after an exact-head rerun of its infrastructure-flaky shard. Layer 02 Playwright run `33200766189` passed. Layer 03 run `33236930038` passed all three public ARM64 shards and its aggregate status; shard 3 proves the deterministic request-gated publication pending lock. Layer 03 repository checks, builds, GraphQL tests, CodeQL, SonarCloud, and GitGuardian also passed. PR #5593's separate GitGuardian result remains the user-dispositioned false positive.
- [ ] 2026-08-29 final-review blocker: the real `review_stack` job in run `33238855330` froze the verified stack through `d06201a5f` and then failed every OpenCodeReview request with provider-class HTTP 404 before analysis. It produced neither review evidence nor code findings. The GitHub `OPENROUTER_API_KEY` metadata still has `updated_at=2026-08-24T19:19:27Z`; replace or repair that credential, then run `/final-review-stack` on PR #5619 and `/final-review` on PR #5593 sequentially and verify the actual review jobs and exact-head status contexts. The individual review was deliberately not retriggered after the stack provider failure.
- [ ] Current upstream drift remains unintegrated: the published Layer 03 head is 44 commits ahead of and 9 commits behind `origin/v3`. No further merge or rebase is authorized by this receipt.
- [ ] Integrated correction review, exact-head pushes, terminal CI, and Stack Gate 3.
- [ ] Separate `v3-ai` integration package planned and executed after its start condition is met.
- [x] 2026-08-30 paid native Claude Opus stack review completed through the trusted workflow at `e8410360680a5ebb96c9e8108ecece52f9923a36`. The frozen layer heads were `c984960a4`, `564d1deca`, and `1ac27b5f2`; run `33294439210`, review `fsr-a04dd5fe8e4066677ff2923f`, and the [published review](https://github.com/uzh-bf/klicker-uzh/pull/5619#pullrequestreview-5060047286) produced nine findings. Seven were accepted, `sfr-bda42b2c1bad5a39` had a false design-system input-type premise but received a safe numeric-input hardening, and `sfr-acc05ac1b4ed2cec` was rejected because GraphQL.js distinguishes an omitted optional argument from explicit `null` and the existing service test protects that contract.
- [x] 2026-08-30 corrections are committed in their owning layers and propagated without rebasing. Layer 01 `f5c716ecf` makes both guarded chatbot edits transactional and preserves unexpected publication-request failures. Layer 02 `604a5b999` tolerates an omitted courses list and waits for the post-create refetch. Layer 03 `d7370ed11` replaces the two multi-state nested conditionals and accepts the actual string-or-number form value safely. The accepted findings are `sfr-f1ef2ec51a4f17d6`, `sfr-cd04969e5ea28da9`, `sfr-259e819066679444`, `sfr-75d0f6cdd2a3b704`, `sfr-7d0271a3c33a014c`, `sfr-d8e71f032387661f`, and `sfr-076abc8b0d8f3a4c`.
- [x] 2026-08-30 correction verification passed. Layer 01 passed its GraphQL check and both focused service suites with 71/71 tests. Layer 02 passed Manage and Playwright TypeScript checks and the focused host Chromium authoring flow with 2/2 scenarios. Layer 03 passed focused Biome, Manage and Playwright TypeScript checks, the focused host Chromium authoring/publication flow with 6/6 scenarios, and the normal pre-commit gitleaks plus repository `check:all` hooks. The agent-browser screenshot route remained unable to clear Next's persistent `data-next-hide-fouc` guard despite a rendered React tree and live HMR, so no agent-browser screenshot proof is claimed; the host Playwright run is the completed browser-interaction evidence. The exact feature runtime was stopped afterward and has zero remaining routes.
- [ ] The corrected Layer 03 head and this Progress receipt still need publication, terminal exact-head CI, machine-readable review-finding disposition, and the separately approved incremental final reviews. Merge remains outside this plan's current authority.
- [ ] GitHub reports `v3` at `6135b55c56e3f25ff56d178c11e8ac184aea587f`; no further upstream integration is authorized. The local SSH agent refused the latest fetch, so current upstream evidence is API readback rather than a refreshed local tracking ref.
