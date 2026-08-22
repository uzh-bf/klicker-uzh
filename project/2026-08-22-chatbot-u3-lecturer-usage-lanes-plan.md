# U3 — lecturer usage API and two-lane manage UI (execution plan)

Roadmap:
[`project/2026-08-20-chatbot-hitl-lecturer-configuration-roadmap.md`](2026-08-20-chatbot-hitl-lecturer-configuration-roadmap.md)
(M1 Gate 1 approved 2026-08-21; Gate 2 and continued roadmap execution
approved 2026-08-22). U1 and U2 are accepted, published draft stack layers.
U2's accepted implementation boundary is `367784db6`; its published branch
head is `e9bd25e80` with 27 passing and 9 intentionally skipped current-head
checks.

## Goal

Complete the lecturer-facing M1 usage-funding MVP. Add an authorized GraphQL
projection and atomic budget update for the current Europe/Zurich month, then
show exactly two account-wide usage lanes on lecturer user settings. Each lane
shows budget, used credits, non-negative remaining credits, and the reset date.
The visible labels are **base model usage** and **advanced model usage**. The
surface makes the live account authorization state clear without exposing a
base contribution, provider, funding source, cost center, settlement detail,
participant text, or a third lane.

## Non-goals

- No new Prisma model, migration, ledger, reservation, tariff, invoice,
  contribution field, historical report, per-chatbot budget, or participant-
  credit change.
- No account-authorization or cost-center intake/editor. U3 reuses the live
  `aiChatbotPublishingEnabled` capability and never makes publication approval
  appear to authorize usage.
- No model/deployment choice, Luna/provider naming, “unlimited” state, or
  “lecturer funded” language.
- No admin manage UI. The GraphQL service supports the roadmap's admin target
  contract, while the only U3 UI consumer is the account owner's settings page.
- No changes to custom modes, lecturer-test identity, response examples,
  ground-truth work, or ADRs 0028–0036.
- No ready marking, merge, rebase or force-push, deployment, live traffic,
  PR closure, cleanup, deletion, or second writer.

## Execution contract

- **Owner**: this roadmap task remains the M1 execution orchestrator and sole
  U3 writer in the existing worktree.
- **One-time approval**: the approved roadmap and the user's continued go-ahead
  authorize these in-scope edits, Node 24 DevPod lifecycle, repository-native
  checks, Ox Alpha review passes, scoped local commits, push of
  `rs/chatbot-u3-usage-lanes`, creation/update of one draft PR based on U2 PR
  #5480, additive append to GitHub stack #5476, CI observation, U3 Phase 5, and
  the final M1 stack review.
- **Withheld**: ready marking, merge, rebase or force-push, deployment, live
  traffic or smoke, PR closure, worktree/branch/runtime deletion, secrets, and
  every item outside M1.
- **Boundary owner**: this roadmap orchestrator owns stack mutation, roadmap
  `Progress`, Phase 5, and evidence integration. Reviewers are read-only and
  use the user-required Ox Alpha route.
- **Terminal**: U3 and the integrated M1 stack are locally and remotely
  verified, Ox Alpha reviewed, Phase 5 accepted, and published as three open
  draft M1 layers with current-head CI accounted for. Then stop before every
  withheld action and request the roadmap's Gate 3 ruling separately.
- **Pause**: only for a new cost-center workflow, new lane vocabulary or
  disclosure, different budget semantics, an authorization contract that
  cannot preserve owner/admin isolation, a reviewer route that cannot preserve
  the Ox Alpha requirement, or another withheld external action.

## Plan identity

- Plan: `project/2026-08-22-chatbot-u3-lecturer-usage-lanes-plan.md`
- Branch: `rs/chatbot-u3-usage-lanes`
- Worktree: `trees/feat-chatbot-lecturer-config-phase0`
- Accepted base: U2 published head
  `e9bd25e80e3ac4aed5e6318db49a08f4730aaf25`
- Parent layer: draft PR #5480, `rs/chatbot-u2-runtime-charging`
- Remote stack: GitHub stack #5476, PR #5460 → PR #5475 → PR #5480
- Prior plan: `project/2026-08-22-chatbot-u2-runtime-charging-plan.md`

## Grounding facts verified at the accepted base

- `ChatAccountUsage` already has the composite owner/class/month key and
  `Decimal(18,6)` budget/used values. A missing row means zero budget and zero
  usage. No U3 schema migration is needed.
- `getZurichMonthStart` and `getZurichMonthReset` already derive the persisted
  month key and exact next Zurich reset instant, including DST. U3 reuses them
  and accepts a service-only `now` seam for deterministic tests. The GraphQL
  API never accepts a caller-controlled clock.
- `parseChatUsageCredits` already validates finite, non-negative values with at
  most six decimals and fewer than 12 integer digits. U3 reuses it instead of
  adding a second credit contract.
- U2 reads and increments the current owner/class row. A budget write therefore
  upserts both current-month rows and changes only `budgetCredits`; it must
  preserve concurrent and existing `usedCredits`.
- `User.aiChatbotPublishingEnabled` is the live account capability. The
  cost-center value stays out of the API and UI.
- Pothos `asUser` admits USER and ADMIN roles. Field auth alone does not protect
  direct service calls, so U3 also checks role, login scope, and target identity
  in the service.
- `ACCOUNT_OWNER` is the only ordinary-user login scope allowed to read or
  write these account controls. `FULL_ACCESS`, `SESSION_EXEC`, `READ_ONLY`,
  participants, and temporary participants are denied.
- The manage user settings page already has Suspense-backed owner-only settings
  and reusable `Setting`, Formik, design-system number input, notification,
  translation, and locale formatter patterns.
- Manage GraphQL operations are persisted/hash-addressed in deployment. U3 adds
  new operation documents and commits generated outputs; it does not mutate an
  existing operation document.
- ADR 0020 already fixes the two-tier authorization, budget, visibility, and
  charging contracts. U3 implements that accepted decision and needs no new
  ADR.

## Resolved implementation decisions

### D1 — service target authorization

The query and mutation accept an optional `ownerId` for the admin API contract.
The service resolves the target before reading any target row:

- an ADMIN may target the explicit `ownerId`, or its own `sub` when omitted;
- a USER must have `ACCOUNT_OWNER` scope and may target only its own `sub`;
- every other role/scope, and a USER supplying another owner ID, receives one
  generic authorization failure before target lookup;
- a missing ADMIN target returns `null` without a distinct existence error.

The schema uses `asUser`, which rejects participant callers before resolution,
and the service repeats the role/scope check for forged service-context tests.
No branch reveals whether an unrelated owner ID exists.

### D2 — fixed current-month projection

The query returns one overview with the live `authorized` boolean and fixed
`baseModelUsage` and `advancedModelUsage` fields. Each lane contains:

- `usageClass` (`BASE` or `ADVANCED`);
- `budgetCredits`;
- `usedCredits`;
- `remainingCredits = max(budgetCredits - usedCredits, 0)`; and
- `resetAt`, the exact next Europe/Zurich month boundary.

Both lanes always project for an authorized caller, even when the capability
is false or a usage row is missing. Missing rows become zero/zero/zero. The
query returns only the current month; the service-only `now` parameter proves
next-month rollover without exposing a client-controlled clock.

The output uses GraphQL floats because the repository credit validator accepts
numbers and the manage input is numeric. Every Decimal is converted only at the
projection boundary. The service never rounds or repairs stored values.

### D3 — atomic two-budget mutation

One mutation accepts `baseBudgetCredits` and `advancedBudgetCredits`. It checks
caller authorization, validates both values through `parseChatUsageCredits`,
and reads the target's live capability before any write. A disabled capability
rejects the mutation; publication state is never consulted.

One database transaction upserts the target's current Zurich-month `BASE` and
`ADVANCED` rows. The update path changes only `budgetCredits`; the create path
sets the budget and leaves `usedCredits` at zero. Both lanes succeed or neither
does. Setting a budget below current usage is valid and produces an exhausted
lane with remaining zero; U2 denies its next request.

The mutation returns the same fixed overview projection after commit. It never
accepts or returns cost-center, contribution, provider, settlement, participant
credit, or per-model fields.

### D4 — owner settings UI

Add one `ChatAccountUsageSettings` section on `/user/settings`. Its new query
operation includes the overview needed by that section; its mutation operation
updates both budgets together. A `null` result hides the section for delegated
ordinary-user scopes. An account owner with `authorized = false` sees a clear
informational state and disabled/no budget editor, not a self-service approval
or cost-center control.

An authorized owner sees two responsive lane cards in stable BASE-then-ADVANCED
order. English uses the exact labels “Base model usage” and “Advanced model
usage”; German uses the fixed labels “Nutzung des Basismodells” and “Nutzung des
fortgeschrittenen Modells”. Each card visibly names budget, used, remaining,
and reset date. Exhaustion is communicated with text/status, not color alone.
One save action validates and submits both budget fields, then
updates/refetches the overview and reports success or failure without optimistic
funding claims.

Credit values use the active locale with up to six fraction digits. The reset
date uses the active locale and the existing application timezone. The mobile
layout stacks cards and fields without horizontal scrolling.

### D5 — rolling-safe GraphQL delivery

Add, rather than modify, `QGetChatAccountUsage.graphql` and
`MSetChatAccountUsageBudgets.graphql`. Generate and commit the public schema,
typed operations, persisted-operation maps, and every repository-native
generated artifact. The new frontend imports only the generated documents.

The server fields are additive and nullable at the outer overview boundary.
Old clients remain valid and deployed operation hashes do not change.

## Primitive impact

| Primitive | U3 disposition |
| --- | --- |
| Account AI authorization | Reuse live target capability; expose boolean only to owner/admin |
| Monthly usage budget | Read/upsert both current owner/class rows atomically |
| Used-credit counter | Read only; preserve on budget updates and concurrent charges |
| Usage class | Fixed BASE and ADVANCED projection; no client-defined class text |
| Participant credits | Unchanged and absent from this API/UI |
| Cost center/funding | Unchanged out-of-band workflow; absent from API/UI |
| Lecturer usage lanes | Add exact two-lane owner settings surface |
| Publication approval | Unchanged and never used as account authorization |

## Feature-wide test portfolio

| Consequential behavior | Evidence seam |
| --- | --- |
| ACCOUNT_OWNER reads own current-month lanes | PostgreSQL service test plus GraphQL schema execution |
| ADMIN reads/writes an explicit target | Service test with distinct admin and target identities |
| USER cannot target another account or learn whether it exists | Existing/non-existing target matrix with identical generic denial |
| FULL_ACCESS, SESSION_EXEC, READ_ONLY, participant, and temporary participant are denied | Forged service-context matrix plus schema-level participant denial |
| Disabled capability remains visible as authorization false but cannot be edited | Query projection and rejected mutation with unchanged rows |
| Missing rows project deterministic zero values | Service test with no current-month rows |
| Normal rows expose exact budget/used/remaining/reset fields | Service and GraphQL response assertions |
| Exhausted and overrun rows clamp remaining to zero | Service test with `usedCredits >= budgetCredits` |
| Next Zurich month ignores the prior month's rows | Service-only `now` test across a month boundary |
| Both budget rows create atomically | PostgreSQL mutation test |
| Updating budgets preserves used credits | PostgreSQL mutation test with non-zero counters |
| Invalid negative, over-precision, non-finite, or oversized inputs make no partial write | Service validation matrix |
| A failed second upsert rolls back the first | Transaction failure seam with owned synthetic rows |
| Concurrent U2-style used-credit increments are not overwritten by a budget update | Focused PostgreSQL concurrency test interleaving one two-budget update with `Promise.all` charge increments against the same synthetic row |
| API omits cost center, contribution, provider, participant, and per-model fields | Public schema/operation snapshot inspection and Ox Alpha review |
| UI fixes exactly two lanes and stable labels | Focused component/browser assertions |
| Save updates both inputs and rendered aggregates | Browser interaction against seeded synthetic account data |
| Normal, empty, exhausted, and next-month states are deterministic | Service tests for all four; browser evidence for normal, empty, and class-exhausted states |
| English/German desktop/mobile layouts remain readable and accessible | Mandatory agent-browser screenshots, keyboard/focus check, and console-error check |

DB-backed tests create only synthetic UUIDs and delete only their owned rows.
They never bulk-delete shared development data.

## Slices and commits

### P — plan checkpoint

- Files: this plan and its `Progress` only.
- Commit: `docs(project): add U3 usage lanes plan`.
- Run one read-only Ox Alpha planner pass before committing. Verify and apply
  accepted corrections; no implementation begins from an unreviewed plan.

### S1 — authorized GraphQL usage service and operations

- Add the smallest service under `packages/graphql/src/services/` for target
  authorization, current-month fixed projection, and atomic two-budget upsert.
- Extend `packages/graphql/src/schema/resource.ts` with the fixed overview/lane
  objects, `query.ts` with the optional-target query, and `mutation.ts` with the
  optional-target two-budget mutation.
- Add the two new operation documents under
  `packages/graphql/src/graphql/ops/` and run GraphQL generation. Do not modify
  an existing operation document or add a Prisma schema change.
- Extend focused account-usage tests for the full authorization, projection,
  validation, atomicity, rollover, and used-credit preservation portfolio,
  including forged contexts and GraphQL execution.
- Update `docs/chat-platform.md` with the owner/admin API, two-lane projection,
  missing-row behavior, authorization boundary, and absent funding details.
- Commit: `feat(graphql): add account usage budget API`.
- Review the immutable range in parallel with one Ox Alpha simplifier and one
  Ox Alpha slice reviewer covering authorization, account isolation, data
  integrity, Decimal projection, transactions, rolling deployment, and funding
  disclosure. Verify and disposition findings before S2.

### S2 — two-lane lecturer settings UI

- Add `ChatAccountUsageSettings.tsx` under the existing user settings
  components and mount it on `/user/settings` behind Suspense.
- Use the generated query/mutation documents, Formik, design-system numeric
  inputs/buttons/notifications, locale formatters, and the existing `Setting`
  pattern. Add no dependency or new settings framework.
- Add English and German strings for authorization status, exact lane labels,
  metrics, validation, save, success/failure, and exhaustion. Avoid provider,
  funding-source, contribution, and publication language.
- Expect browser evidence, not a committed Playwright regression, because the
  current suite has no seeded manage-settings usage-row seam. Add one focused
  regression only if S2 discovers an existing seam that protects owner save and
  two-lane display without model calls or a new test-only product API; otherwise
  add no speculative fixture machinery.
- Commit: `feat(manage): add chatbot usage settings`.
- Review the immutable range in parallel with one Ox Alpha simplifier and one
  Ox Alpha slice reviewer covering accessibility, responsive behavior,
  authorization-state UX, vocabulary, hidden-contribution boundary, GraphQL
  cache/update behavior, and generated-operation usage.

### S3 — integrated browser, verification, and M1 reconciliation

- Start/reconcile the exact DevPod with `devrouter ensure` and validate the
  manage URL before browser work. Use delegated seeded lecturer access and only
  synthetic usage rows; make no model request.
- Verify normal, empty, and class-exhausted account states in English and
  German at desktop and 390x844 mobile widths. Check keyboard focus, validation,
  save behavior, exact labels, no third lane or funding disclosure, responsive
  layout, console errors, and network errors. Save screenshots under the
  existing ignored `project/_local/screenshots/` path.
- Run focused GraphQL tests, generated-artifact drift checks, `check:all`, the
  GraphQL and manage builds, Playwright typecheck/discovery, and any committed
  focused browser test. Run the full repository build before publication.
- Stop the exact DevPod and verify zero active routes after the last runtime-
  dependent check. Preserve the workspace; deletion remains withheld.
- Run one read-only Ox Alpha integrated final review over the accepted U2 base
  through the verified U3 head. It covers U3 correctness and the complete U1 →
  U2 → U3 M1 contract. Apply only verified, in-scope corrections and rerun the
  affected checks.
- Reconcile U3 through roadmap Phase 5 using the immutable diff, review reports,
  local evidence, and exact-head state.
- Commit evidence-only documentation when required:
  `docs(chatbot): reconcile U3 accepted boundary`.

### S4 — draft publication and current-head proof

- Push `rs/chatbot-u3-usage-lanes` and create one draft PR based on
  `rs/chatbot-u2-runtime-charging`. Use an accurate conventional title and a
  full-branch evidence body.
- Append the draft as the top layer of GitHub stack #5476 without reordering,
  rebasing, force-pushing, readying, merging, closing, or deleting anything.
- Observe one current-head CI run through one watcher. Classify every terminal
  check, inspect logs before any rerun, and update the draft body from exact
  evidence.
- Run the exact-head U3 Phase 5 re-read if publication metadata or CI changes
  the acceptance evidence. Stop when U3/M1 is accepted and published as an
  open draft layer with current-head CI accounted for.

## Review routing

All reviewer passes use the user-required Ox Alpha model through the verified
`combo/ox-alpha` host route at maximum effort. Prompts include only repository
paths, commit ranges, accepted product contracts, synthetic test evidence, and
values-free metadata. They include no credentials, secrets, personal data,
real participant records, response bodies, or unrelated private material.

| Gate | Immutable scope | Acceptance |
| --- | --- | --- |
| Plan | Draft plan plus U3 roadmap contract | Implementation-ready or corrected before P commit |
| S1 simplifier | P..S1 commit | Behavior-preserving net simplification only |
| S1 slice review | P..S1 commit | Authorization, isolation, transaction, Decimal, schema disclosure, rolling safety |
| S2 simplifier | S1..S2 commit | Behavior-preserving net simplification only |
| S2 slice review | S1..S2 commit | Accessibility, UX states, vocabulary, generated ops, no hidden funding |
| Integrated final | `e9bd25e80..verified U3 head`, with U1/U2 dependency context | Complete U3 and M1 contract; no blocking findings |
| Phase 5 | Exact accepted U3 implementation boundary | `reviewed`, corrected, parked, or `NEEDS_CONTEXT` against the roadmap |

Review output is advice. The orchestrator verifies every finding against the
diff and evidence before changing code or acceptance state.

## Verification commands and evidence

Run repository-native commands inside the Node 24 DevPod when they require the
project toolchain or services. Run host Git, `gh`, `gh stack`, and devrouter
lifecycle commands on the host.

Minimum command set:

- `pnpm --filter @klicker-uzh/graphql generate`
- focused `@klicker-uzh/graphql` tests for account usage
- `pnpm --filter @klicker-uzh/graphql check`
- `pnpm --filter @klicker-uzh/frontend-manage check`
- `pnpm --filter @klicker-uzh/graphql build`
- `pnpm --filter @klicker-uzh/frontend-manage build`
- `pnpm run check:all`
- Playwright typecheck and focused discovery; a focused execution when a
  committed regression test is added
- `pnpm run build` before publication
- `git diff --check` and exact staged-content/data-hygiene inspection before
  every commit

Browser evidence records locale, viewport, synthetic state, URL, visible lane
labels/metrics, save result, focus behavior, console status, network status,
and screenshot path. Local screenshots and review reports stay ignored and
uncommitted.

## Delivery and authority boundaries

The plan may create local commits and one published draft U3 layer because the
approved roadmap names those actions. The PR remains draft. Passing local
checks, review, push, stack append, or CI does not authorize ready marking,
merge, deployment, live proof, PR closure, cleanup, branch deletion, worktree
deletion, or runtime deletion. The M1 terminal report asks for the separate
Gate 3 ruling and names every still-withheld action.

## Risks and fail-closed handling

- **Authorization drift**: schema auth and service auth both apply; forged
  contexts prove the service boundary.
- **Existence leak**: ordinary users cannot target another ID, and target
  lookup never precedes authorization.
- **Lost usage increment**: budget updates touch only `budgetCredits`; tests
  prove `usedCredits` preservation and transaction behavior.
- **Partial budget write**: both class upserts share one transaction.
- **Month/timezone drift**: reuse the existing Zurich helpers and test a fixed
  next-month instant.
- **Decimal mismatch**: reuse the shared six-decimal validator and project
  Decimal values only at the GraphQL output boundary.
- **Funding disclosure**: fixed object fields and exact UI vocabulary exclude
  cost center, contribution, provider, settlement, and participant data.
- **Rolling-operation breakage**: add new operation documents; never mutate an
  existing persisted operation.
- **UI ambiguity**: authorization and exhaustion use explicit text; no state
  relies on color or a funding inference.
- **Runtime residue**: stop the exact DevPod and verify routes after browser
  proof; preserve it until cleanup is separately approved.

## Progress

- 2026-08-22: U2 accepted implementation boundary `367784db6` and published
  head `e9bd25e80` both finished with 27 passing, 9 intentionally skipped, 0
  failed, and 0 pending checks. PR #5480 remains open, draft, mergeable, and
  based on U1; its evidence body is current.
- 2026-08-22: created `rs/chatbot-u3-usage-lanes` from the clean accepted U2
  published head in the existing worktree.
- 2026-08-22: Ox Alpha planning review returned `IMPLEMENTATION_READY` with no
  blocking findings. The required same-day freshness check confirmed
  `origin/rs/chatbot-u2-runtime-charging` remains at `e9bd25e80`; the U3 branch
  is 46 commits ahead and 2 commits behind current `origin/v3` through its
  approved stack ancestry. The plan now requires the concrete PostgreSQL
  concurrent-charge proof and records the accepted reviewer clarifications.
- 2026-08-22: S1 implements the owner/admin GraphQL projection and atomic
  two-budget update with additive persisted operations, generated artifacts,
  and the matching platform-wiki contract. The focused PostgreSQL/GraphQL file
  passes all 11 tests, including the authorization matrix, rollback, rollover,
  disabled capability, and deterministic concurrent-charge proof. GraphQL
  generation, package typecheck, and package build pass in the Node 24 DevPod;
  the build retains its known repository-wide Rollup TypeScript warnings.
- 2026-08-22: the S1 Ox Alpha simplifier requested one behavior-preserving
  Pothos `t.expose` cleanup, which was accepted. The parallel authorization and
  data-integrity review returned `ACCEPT` with no blockers. Its wiki-topology
  clarification was accepted, and its admin-scope suggestion was folded into
  the existing explicit-target read/write test. The broader helper split and a
  second-class concurrency variant were declined as unnecessary; the shared
  guard and column-scoped update already have direct evidence.
- 2026-08-22: S2 adds the owner-gated lecturer settings section with exactly
  two responsive usage lanes, localized metrics and status text, and one
  authorized two-budget editor backed only by the generated GraphQL documents.
  The manage package typecheck passes in the Node 24 DevPod. Its production
  build also passes when invoked with Next.js's expected production
  environment; the first attempt inherited the running development environment
  and stopped at duplicate generated `.next` type declarations before
  compilation.
- 2026-08-22: the S2 Ox Alpha slice review returned `DONE` with no actionable
  findings across authorization gating, accessibility, responsive structure,
  localization, generated-operation/refetch behavior, and the hidden-funding
  boundary. The parallel simplifier's one behavior-preserving recommendation
  was accepted: each lane card now owns its locale formatter instead of
  receiving two formatting callbacks from the parent. Broader abstraction or
  validation reductions were declined because they would reduce clarity or
  weaken the fixed contract.
- 2026-08-23: S3 browser verification covered normal, empty, BASE-exhausted,
  and unauthorized synthetic account states in English and German at desktop
  and 390x844 mobile widths. The two cards remained in stable order, saved
  values updated the visible budget and remaining totals, empty and exhausted
  states used explicit text, keyboard focus moved through both inputs and the
  save button, and the final clean reload had no console or GraphQL network
  errors. The screenshots remain under the ignored
  `project/_local/screenshots/` evidence path.
- 2026-08-23: the first browser save exposed that the design-system
  `FormikNumberField` stores text while the generated mutation requires
  GraphQL floats. Commit `47359d48a` now converts only the two validated values
  at the mutation boundary. Repeated browser save passed, and the correction's
  Ox Alpha simplifier returned `DONE` while its risk review returned `ACCEPT`
  with no required change.
- 2026-08-23: the final Node 24 verification passes: the focused PostgreSQL and
  GraphQL file has 11/11 passing tests; GraphQL generation has no drift;
  GraphQL and manage checks and production builds pass; `check:all` passes;
  the Playwright package typecheck passes and discovery lists 870 tests; and
  the full repository build passes 23/23 tasks. Known Rollup, Next.js,
  next-intl, and page-size warnings remain pre-existing and non-blocking. The
  exact DevPod is stopped and no active route references its workspace.
- 2026-08-23: the integrated Ox Alpha final review accepted exact range
  `e9bd25e80..47359d48a` with no blocking or required-correction finding. It
  confirmed the owner/admin isolation, fixed current-month projection, atomic
  two-budget mutation, concurrent U2 counter preservation, exactly two
  localized owner lanes, additive persisted operations, hidden-funding
  boundary, wiki accuracy, and the complete U1 -> U2 -> U3 M1 contract.
- 2026-08-23: local roadmap Phase 5 classified the immutable implementation
  boundary at `47359d48a` as required `reviewed` delivery with no blocking or
  required-correction finding. The accepted next action is S4 draft
  publication, additive append as the top layer of stack #5476, exact-head CI
  observation, and a publication-aware Phase 5 re-read. All withheld external
  actions remain unchanged.
- 2026-08-23: S4 published draft PR #5490 from
  `rs/chatbot-u3-usage-lanes` onto the accepted U2 branch and appended it as
  the fourth and top layer of stack #5476. Host read-back confirmed the draft
  state, exact branch/base pair, published head `fa7992b35`, whole-branch
  description, and unchanged lower-layer topology. Ready marking, merge,
  deployment, live traffic, closure, cleanup, and deletion remain withheld.
- 2026-08-23: the publication-aware Ox Alpha Phase 5 re-read classified exact
  published head `de35a4fe4` as `reviewed`. Native GitHub stack #5476 contains
  #5460 -> #5475 -> #5480 -> #5490 in the accepted order; #5490 is open,
  draft, and based on U2 head `e9bd25e80`. The complete registered exact-head
  check set passed: three dynamic CodeQL language jobs and GitGuardian.
  Ordinary pull-request workflows did not register for the stack-linked draft
  and are not represented as passing. The two post-boundary commits are
  evidence-only additions in the roadmap and plan. M1 has reached its terminal
  Gate 3 boundary with every withheld action unchanged.
