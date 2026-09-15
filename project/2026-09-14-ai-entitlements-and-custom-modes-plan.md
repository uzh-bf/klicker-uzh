# AI subscription tiers, enforcement activation, and custom chat modes

## Approval summary

**Why and what changes?** Three things must be true before the AI features can
open beyond today's manually approved cohort. First, entitlement has to stop
being one switch: cost-free model classes need only a feature flag, while
cost-carrying classes need a cost center. Second, usage enforcement is built
but default-off, and cannot be switched on safely yet. Third, lecturers need to
author their own chat modes, with platform limits, and those modes must be
reviewed before participants can select them.

The work ships as two stacked pull requests on `v3-ai`. The first introduces a
two-dimensional AI subscription (tier plus optional cost center), gives every
newly entitled account a small monthly base budget, adds the operations path
that backfills existing accounts, pins the Manage assistant to the base class,
and turns usage enforcement on for a named environment with a rollback switch.
The second adds a typed, platform-limited custom-mode contract, teaches both
chat routes to advertise approved custom modes, and adds the authoring and
submission surface in Manage. Custom modes ride the existing chatbot revision
approval, so they need no separate review queue.

**What stays unchanged?** Model selection stays independent of mode, so a
custom mode does not gain a per-mode model policy in this change. Knowledge-base
attachment stays one bot to one knowledge base. Knowledge-graph and element
generation keep their existing cost model and their separate quota ledger. The
platform prompt contract remains non-removable and is still appended after any
lecturer text, so a custom mode cannot override it.

**What could change the decision?** Enforcement activation is a live operational
cutover, not a code change: switching it on before the budget backfill runs
makes every account without a budget row unable to answer. The plan therefore
sequences the backfill ahead of the flag and keeps the flag per environment.
Everything else is reversible source work. No unresolved product choices remain;
the monthly period and the small-version handling of the mode authoring work
are ruled.

**How will we know it is done?** A base-tier lecturer with the flag but no cost
center completes a participant turn and it is charged to the monthly base
budget; the same account cannot reach an advanced class; a lecturer authors and
submits a custom mode inside the limits, cannot publish it alone, and sees it
appear for participants only after approval.

**What does approval authorize?** Draft pull requests stacked on `v3-ai`, local
commits, ordinary pushes to `rs/` branches, and the repository's configured
reviews. Previewing the enforcement and telemetry values in `deploy/` counts as
source delivery; **applying** them to any cluster, PRD promotion, merge, and
release remain separately gated and are not requested here.

## Execution details

### Verified evidence and binding contracts

- Entitlement today is `User.aiFeaturesEnabled` plus `User.betaEnabled` plus the
  GrowthBook `ai-beta` flag, and it already gates every AI surface:
  `apps/chat/src/lib/server/featureFlags.ts:42-80`,
  `packages/graphql/src/services/knowledge.ts:36`,
  `packages/graphql/src/services/questionGenerationGraph.ts:157-161`.
- `User.aiChatbotCostCenter String?` exists in the schema and in exactly one
  migration, and no service reads or writes it
  (`packages/prisma/src/prisma/schema/user.prisma:113`). It is the intended
  carrier for the advanced entitlement.
- `User` also holds `catalystInstitutional`, `catalystIndividual`, and
  `catalystTier`, and `catalyst` is already passed to GrowthBook
  (`featureFlags.ts:30-37`).
- Classes are already separate: `enum ChatUsageClass { BASE, ADVANCED }` with one
  `ChatAccountUsage` row per owner, class, and Zurü month
  (`packages/prisma/src/prisma/schema/chat.prisma:41-44,95-109`). Class is a
  property of the registry entry, not of the mode.
- Enforcement is a pre-check that reads
  `isChatAccountUsageAvailable` and requires a row with
  `budgetCredits > 0`; the column default is `0`, and the only writers are seeds,
  tests, and the ADMIN-only `setChatAccountUsageBudgets`
  (`apps/chat/src/services/accountUsage.ts:95-121`,
  `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts:846`).
- `Chatbot.standardModeConfig Json?` is the existing typed lecturer-config
  precedent: types in `packages/types/src/chatbotStandardModeConfig.ts`, strict
  parse plus limits in `packages/util/src/chatbotStandardModeConfig.ts:7-9`.
- Revision approval is a compare-and-set on `Chatbot.revisionVersion`. The
  snapshot is stored in `draftConfig`, materialized into live columns by
  `revisionLiveData` on approval, and cleared afterwards
  (`packages/graphql/src/services/chatbots.ts:900-977,1681-1700`).
- The runtime already resolves custom modes: stored mode keys are offered unless
  explicitly disabled, lecturer text compiles through
  `lecturer-custom-persona`, and the platform mode contract plus the
  course-policy, output-format, citation, and language sections are appended
  after it (`apps/chat/src/lib/server/effectiveChatModes.ts:190-225`,
  `apps/chat/src/lib/server/systemPromptCompiler.ts:70,74-84,133-146`).
- `selectManageAssistantModel` returns the first registry entry with
  `fallback: false` (`apps/chat/src/services/manageAssistantRuntime.ts:73-82`).
  Both `stg` and `prd` list `id: auto` first, and `auto` is `usageClass:
  ADVANCED`, so the Manage assistant is billed against the advanced class today.
  This is the confirmed deviation from the intended base-class behaviour.
- Knowledge-graph and element generation do not use chat credits at all; they
  reserve and settle against `KBGraphQuota` keyed by `(ownerId, semesterKey)`
  (`packages/graphql/src/services/kbGraphQuota.ts:23-87`,
  `packages/graphql/src/services/elementGenerationAccounting.ts:14-19`).

### Binding contracts

- **Subscription dimensions.** Tier and cost center answer different questions:
  the tier decides whether the account may use cost-free classes; the cost
  center decides whether it may also use cost-carrying classes. A tier value
  without the flag stays inert, so withdrawal remains a single switch.
- **Class gate.** Any request whose selected registry entry is `BASE` requires
  the flag. Any request whose selected entry is `ADVANCED` additionally requires
  a present cost center. The gate is evaluated per candidate model, including
  after a fallback is selected, never once per turn.
- **The class gate is chat admission only.** The tier and cost-center split
  applies to chatbot class admission and nowhere else. `isManageAiEnabled` and
  `getManageAiCapability` remain the single shared lecturer gate for the Manage
  assistant, Knowledge-graph generation, and element generation, and they stay
  free of any cost-center condition so those surfaces remain free within their
  own quota. A negative assertion over those two files is part of S1.
- **Preview class admission.** Owner preview resolves models through the same
  policy as the participant route but does not pass the account-availability
  pre-check. Class admission therefore applies to preview too, so a base-only
  account cannot preview an advanced entry. Preview remains owner-funded: it
  creates no usage row and charges no budget.
- **Monthly base budget.** A base-class budget is granted per Zurü month. The
  default applies to newly entitled accounts and is backfilled for existing
  ones; it never silently raises a budget an administrator has already set.
- **Backfill safety.** The backfill may only create missing rows. It writes
  `usageClass: BASE` rows for the current Zurü month with duplicate skipping
  and never touches past months, because `getEffectiveChatAccountUsage` carries
  the most recent earlier row forward into later months. A past-month row would
  therefore leak a budget into every future month, and an upsert would clobber a
  value an administrator already set. The existing `setAiFeatures` `0 | 1 | 2`
  return contract and its Manage caller are unchanged.
- **Revision snapshots must carry custom modes.** `ChatbotAuthoringRevision`
  currently allowlists only the standard-mode and live setup fields and
  explicitly excludes custom prompts, so a new chatbot column alone would never
  be materialized by approval. The snapshot type, `parseStoredRevision`,
  `buildRevisionFromLive`, and `revisionLiveData` must all carry the field, or
  approval silently drops it.
- **The field is required in the snapshot type, and revision validation
  strict-parses it on write.** The snapshot is rebuilt by spreading the incoming
  revision, so an optional property would be silently dropped between save and
  approval. `validateCompleteRevision` validates the standard-mode section the
  same way and must gain the matching custom-mode branch.
- **The write path is the section-patch mutation.** `saveChatbotRevision`
  patches only the sections declared in `ChatbotRevisionSaveInput`; without a
  custom-mode section there, the authoring UI has no way to persist a mode at
  all, and approval has nothing to materialize. This is the GraphQL entry point
  that the authoring surface already uses.
- **Generated keys are minted server-side inside the save transaction.** The
  revision compare-and-set takes a row lock before it validates the expected
  version, so a stale version throws before any write. The key is therefore
  minted where the section patch is applied and validated, which keeps one
  source of truth and needs no client-side generation. Existing chatbots carry
  no custom modes, so no key backfill is required.
- **Reads are tolerant, approval is explicit.** A malformed stored custom-mode
  value must not brick the whole revision, so parsing on read normalizes rather
  than rejects, consistent with the standard-mode reader; strict rejection stays
  on the write path.
- **Withdrawal and rejection never touch the live column of a published
  chatbot.** For a chatbot that is not yet `PUBLISHED`, the save and submit paths
  do write the live columns from the snapshot; that is the existing draft
  behaviour and is safe because participants cannot reach an unpublished
  chatbot. Once a chatbot is `PUBLISHED`, only approval writes the live
  configuration, and withdrawal and rejection update status and the draft
  snapshot alone. A mode approved in an earlier revision therefore stays live
  until an approval replaces it, which is deliberate: a withdrawal cannot
  silently disable a mode participants already have.
- **The predicate reads the live approved column, not the draft.** The revision
  snapshot helper prefers the draft whenever one exists, so the runtime
  predicate must not reuse it; it reads the chatbot's live approved
  configuration. Using the draft would expose a mode that is still awaiting
  approval.
- **Custom-mode limits.** Name 60 characters, description 160, persona text
  1000, at most 5 modes per chatbot. Names must not collide with the standard
  modes or with each other, and parsing is strict on write and tolerant on read.
- **Mode identity.** The stored key is generated once, is immutable, and is what
  persists on messages and matches MCP bindings; the 60-character name is
  display text and may change without touching history. Renaming never rewrites
  a stored key.
- **Approval.** A custom mode is participant-visible only when the chatbot is
  `PUBLISHED` and the mode is approved and enabled. A mode that is drafted,
  withdrawn, or rejected is never offered to participants, which closes the
  latent exposure in the current "anything not explicitly disabled" rule.
- **The approval predicate lives in the shared resolver.**
  `resolveEffectiveChatModeOptions` has five callers, so the predicate belongs
  inside it with an approval flag supplied by each caller rather than in the two
  routes. Participant callers pass the strict approved-and-enabled state; the
  owner preview callers stay lenient so an owner can preview a draft. Any route
  left unthreaded would let an unapproved mode reach a participant prompt.
- **Platform prompt.** Lecturer persona text compiles before the non-removable
  platform contract and the platform sections; this ordering is unchanged.

### Non-goals

- No per-mode model or reasoning policy; custom modes inherit the chatbot's
  existing model policy.
- No new admin approval queue; approval uses the existing revision mutations.
- No changes to the Knowledge-graph or element-generation cost model.
- No PRD promotion, no release cut, and no cluster mutation in this package.
- PR #5668 and its immutable prompt catalog are not integrated here; its
  retargeting onto `v3-ai` is a later, separate decision.
- The Manage assistant is not given usage accounting in this package. It stays
  free and records no class; only its resolved model is corrected.

### Delivery topology

Two stacked pull requests on `v3-ai`, bottom-up, each a coherent capability.

- **L1 — AI subscription tiers and monthly base budget.** Adds the tier and
  wires the dormant cost center, grants and backfills the base budget, pins the
  Manage assistant to the base class, previews the enforcement and telemetry
  values, and documents the cutover.
- **L2 — Custom chat modes.** Adds the typed, limited custom-mode contract on
  top of the approved revision flow, the runtime advertisement of approved
  modes, and the authoring and submission surface in Manage.

L2 branches from L1 and is retargeted to `v3-ai` as L1 merges. If L2 grows past
one reviewable package, the authoring UI splits into its own layer on the same
stack; it never becomes an unstacked change.

### Test portfolio

| Risk or behaviour | Obligation | Primary seam | Existing protection | Distinct failure |
| --- | --- | --- | --- | --- |
| Base class allowed on flag alone while advanced is refused without a cost center | extend existing | GraphQL service test over the accounting helpers | `packages/graphql/test/chatAccountUsage.test.ts` | An account buys advanced traffic with a base entitlement |
| Enforcement refuses rather than silently allows when no budget row exists | extend existing | Chat route test with the flag on | `apps/chat/test/account-usage-route.test.ts` | Activation ships an outage for unbudgeted accounts |
| Backfill grants a monthly base budget once and never overwrites a set value | add new | Prisma backfill script test | none | Re-running the backfill resets an administrator's decision |
| The shared lecturer gate stays free of any cost-center condition | add new | Negative assertion over the gate files | none | KG or element generation becomes cost-center gated against the ruling |
| Custom-mode limits and strict parse reject over-long and colliding input | add new | Util unit test | none | Unbounded lecturer text reaches a participant prompt |
| An unapproved custom mode is not advertised to participants but is visible in owner preview | extend existing | Effective-mode resolver and route tests | `apps/chat/test/effective-chat-modes.test.ts`, `apps/chat/test/owner-preview-route.test.ts` | A draft mode becomes participant-selectable |
| An unapproved mode is absent from the public participant chatbot payload | extend existing | Public chatbot bootstrap route test | `apps/chat/test/chatbot-bootstrap-route.test.ts` | The public read leaks a draft mode |
| Approval materializes custom modes and keeps the platform contract last | extend existing | Revision service test | `packages/graphql/test/chatbotRevisions.test.ts`, `apps/chat/test/system-prompt-compiler.test.ts` | Approved modes never reach the runtime, or override platform text |
| Manage assistant resolves the base-class model | extend existing | Manage assistant runtime test | `apps/chat/test/manage-assistant-runtime.test.ts` | Lecturer assistant keeps resolving the advanced entry |

### Delegation map

| Workstream | Slices | Owner | Dependency | Acceptance boundary |
| --- | --- | --- | --- | --- |
| L1 entitlement | S1, S2, S3 | executor for S1 and S3; main for S2 | `v3-ai` | Focused GraphQL, chat, and script tests; flag preview only |
| L1 activation | S4 | main | S3 merged | Documented cutover with backfill proven on STG-shaped data |
| L2 custom modes | S5, S6 | executor for S5; main for S6 | L1 approved | Util, revision, and runtime tests; approval-then-visibility behaviour |
| L2 authoring | S7 | executor | S6 | Browser proof via screenshot gallery |

### Slices

- **S1 — Subscription tier and class gate.** Add the tier to the Prisma schema
  with the analytics mirror and one migration, extend the GraphQL user type, the
  ADMIN mutation, the account-usage read projection and its op, and the Manage
  settings surface, and gate `ADVANCED` candidates on a present cost center in
  both chat routes. *Route:* executor. *Acceptance:* extended
  `chatAccountUsage` tests, the participant and preview route tests, and a
  negative assertion that the shared lecturer gate files are unchanged.
  *Files:* `packages/prisma/src/prisma/schema/user.prisma`,
  `apps/analytics/prisma/schema/user.prisma`,
  `packages/graphql/src/services/accounts.ts`,
  `packages/graphql/src/schema/user.ts`,
  `packages/graphql/src/services/chatAccountUsage.ts`,
  `packages/graphql/src/graphql/ops/QGetChatAccountUsage.graphql`,
  `apps/frontend-manage/src/components/user/ChatAccountUsageSettings.tsx`,
  `apps/chat/src/services/accountUsage.ts`,
  `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`,
  `apps/chat/src/app/api/manage/chatbots/[chatbotId]/preview/chat/route.ts`.
- **S2 — Base budget on entitlement and backfill.** Grant the monthly base
  budget when an administrator enables the flag, and add the idempotent
  backfill for existing entitled accounts. *Route:* main, because it defines the
  idempotency contract. *Acceptance:* new script test passes and the backfill is
  proven to leave an existing budget untouched. *Files:*
  `packages/graphql/src/services/accounts.ts`,
  `packages/prisma-data/src/scripts/2026-09-14_backfill_chat_base_budget.ts`.
- **S3 — Manage assistant pins the base class.** The Manage assistant contains
  no usage accounting at all, so today's behaviour is that it streams on `auto`
  while recording nothing. Resolve an explicit base-class identifier instead of
  the first non-fallback entry, and cover it with the existing runtime test.
  *Route:* executor. *Acceptance:* the runtime test proves the resolved entry
  satisfies the registry's base-class policy for both the `stg` and `prd`
  registry orderings; the billing claim is explicitly out of scope. *Files:*
  `apps/chat/src/services/manageAssistantRuntime.ts`,
  `apps/chat/test/manage-assistant-runtime.test.ts`.
- **S4 — Enforcement and telemetry cutover.** Document and preview the flag
  values: enforcement and lifecycle writes as separate switches, the ordered
  backfill-then-flag procedure, the rollback, and the PRD telemetry value.
  *Route:* main. *Acceptance:* backfill proven on synthetic STG-shaped rows and
  the runbook recorded. The runbook must also cover the partial-failure state:
  with enforcement on, finalization throws for an owner that has no budget row
  **after** the provider response, so the turn is charged by the provider but not
  persisted. Recovery is recorded as a named step, not left implicit. *Files:*
  `deploy/env-uzh-stg/values.yaml`,
  `deploy/env-uzh-prd/values.yaml`, `docs/chat-platform.md`.
- **S5 — Custom-mode contract.** Add `customModeConfig` to the chatbot with the
  analytics mirror and one migration; add the types and the strict parse with
  the ruled limits and the immutable generated key; thread it through
  `ChatbotAuthoringRevision`, `parseStoredRevision`, `buildRevisionFromLive`,
  `revisionLiveData`, and the owner mutation, and regenerate GraphQL ops. The
  analytics schema is produced by the repository's schema sync, not by hand.
  *Route:* executor. *Acceptance:* new util tests plus extended revision tests
  prove an approved mode survives approval and a rejected one does not.
  *Files:* `packages/prisma/src/prisma/schema/chat.prisma`,
  `apps/analytics/prisma/schema/chat.prisma`,
  `packages/types/src/chatbotCustomModeConfig.ts`,
  `packages/types/src/chatbotAuthoringRevision.ts`,
  `packages/util/src/chatbotCustomModeConfig.ts`,
  `packages/graphql/src/services/chatbots.ts`,
  `packages/graphql/src/schema/resource.ts`,
  `packages/graphql/src/schema/mutation.ts`,
  `packages/graphql/src/graphql/ops/FChatbotAuthoringRevisionData.graphql`,
  `packages/graphql/src/graphql/ops/QGetChatbotsInfoWithKnowledgeBases.graphql`.
  The save op itself needs no edit because it forwards the whole input object;
  regenerating the GraphQL artefacts is the mandatory step.
- **S6 — Approved modes reach the runtime.** Apply the approval predicate inside
  `resolveEffectiveChatModeOptions`, thread the approval flag from all five
  callers, keep the owner preview lenient and the participant paths strict,
  advertise descriptions, and keep the platform contract last. *Route:* main,
  because it is the authorization-adjacent seam. *Acceptance:* runtime
  mode-option tests prove an unapproved mode is absent from participant and
  public chatbot payloads but present in owner preview, and an approved one is
  present with correct casing. *Files:*
  `apps/chat/src/lib/server/effectiveChatModes.ts`,
  `apps/chat/src/lib/server/systemPromptCompiler.ts`,
  `apps/chat/src/app/[chatbotId]/layout.tsx`,
  `apps/chat/src/app/preview/[chatbotId]/page.tsx`,
  `apps/chat/src/app/api/chatbots/[chatbotId]/route.ts`,
  `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`,
  `apps/chat/src/app/api/manage/chatbots/[chatbotId]/preview/chat/route.ts`.
- **S7 — Manage authoring and submission.** Add the custom-mode editor with
  limits and counters, include it in the revision review display, and keep
  submission on the existing revision flow, which the authoring surface already
  uses through the section-patch save mutation. *Route:* executor.
  *Acceptance:* browser proof of author, submit, reject, and approve states.
  *Files:* `apps/frontend-manage/src/components/resources/chatbots/ChatbotAuthoring.tsx`,
  `apps/frontend-manage/src/components/resources/chatbots/chatbotRevision.tsx`.

### Verification

- Per slice, the repository's own runners: `pnpm --filter @klicker-uzh/graphql test`,
  `pnpm --filter @klicker-uzh/chat test`, `pnpm --filter @klicker-uzh/util test`,
  then `pnpm run check:all` and the repository build before each push.
- Migrations are generated with the repository's schema-aware tool and reviewed
  for count and provenance; the backfill runs against synthetic rows only.
- S7 carries `$rs-build-screenshot-gallery` evidence for the authoring and
  review states.
- The enforcement cutover is proven on STG before it is considered done; PRD
  activation is not part of this package.

### Working context

- Branch `rs/ai-entitlements` in worktree `trees/rs/ai-entitlements`, based on
  `origin/v3-ai` at `764ae2effc`. Target `v3-ai`; STG follows through
  `stg-release`, and PRD only through a later release cut.
- Plan file committed as the branch's first commit after approval.

## Progress

| Date | Scope | State | Next action |
| --- | --- | --- | --- |
| 2026-09-14 | Plan drafted | `review_deadlock` — three planner rounds, no APPROVED verdict | Present to the user with the reviewer's round-3 assessment disclosed |
| 2026-09-15 | User approved the plan; S3 committed, S1/S2/S4 implemented and verified locally | In progress | Commit S1, then S4, then S2; continue with L2 |

### Slice progress

| Slice | State | Evidence |
| --- | --- | --- |
| S1 subscription tier and class gate | Committed | Tier column plus one generated migration and the analytics sync; class gate applied per selected model in both chat routes; `entitled` and `subscriptionTier` projected through the read; Manage settings show the plan and closed classes; focused GraphQL, chat, and util tests pass |
| S2 base budget on entitlement and backfill | Committed | `setAiFeatures` grants the monthly base default in the same transaction only when no base row exists at or before the current month; backfill script and its disposable-DB test pass; dry run and apply proven on synthetic STG-shaped rows |
| S3 Manage assistant pins the base class | Committed | `21d0af6764`; runtime test proves the resolved entry satisfies the registry base policy for both deployed orderings |
| S4 enforcement and telemetry cutover | Committed | `deploy/env-uzh-stg/values.yaml` and `deploy/env-uzh-prd/values.yaml` carry the two switches with PRD explicit-off; `docs/chat-platform.md` records the ordered cutover, rollback, and the partial-failure recovery |

Backfill evidence on synthetic STG-shaped rows (`bf-*` accounts created for this
check only, in the local disposable database): the dry run reported 2 entitled
accounts, 1 already configured, 1 without a base budget, and 0 rows written. The
`--apply` run reported 1 row created. Read-back shows `bf-entitled-new` at
`2026-09-01` with budget 1 and used 0, and `bf-entitled-configured` still at
`2026-08-01` with budget 7 and used 2, so the administrator's earlier value and
its usage survived. The `bf-unentitled` account received no row.

### Planner round 1 disposition

The configured `planner` route failed terminally before work with an account
usage limit, so the pass ran as one generic continuity child on `gpt-5.6-sol` at
`xhigh` (`generic-continuity` provenance). Two blocking and four material
findings were raised and independently verified in source before being folded
in:

| Finding | Disposition |
| --- | --- |
| Approval cannot carry custom modes because the revision snapshot allowlists fields | Accepted; S5 now owns the snapshot type and all four revision functions |
| The approval predicate needs to sit in the shared resolver, not two routes | Accepted; contract added and S6 now names all five callers |
| The Manage assistant records no usage at all, so the billing claim was wrong | Accepted; S3 acceptance rewritten to a base-class resolution assertion |
| The shared lecturer gate must stay free of cost-center conditions | Accepted; contract and test row added |
| Preview is a cross-class path with no class check | Accepted; preview named in the contract and S1 file list |
| Backfill idempotency did not survive the admin upsert | Accepted; duplicate-skipping, base-class, current-month-only contract added |
| Mode key stability was unspecified | Accepted; immutable generated key contract added |
| S1 omitted the read projection, op, and settings surface | Accepted; added to S1 |
| Test seams and ops lists were inaccurate | Accepted; portfolio rows and S5 file list corrected |
| `finalizeChatTurn` also writes usage | Accepted; recorded as a minor correction |
| Reversibility caveat for enforcement | Accepted; added to S4 |

| Round 2 found the revision snapshot and mutation ownership only half-fixed and
| corrected its own round-2 op guidance in round 3; all findings were verified in
| source before being folded in. Round 3 raised four corrections, all applied:
| the correct authoring query, the bootstrap test as the public-payload seam, the
| live-write qualification and live-column predicate source, and this disposition
| record. It confirmed no slice, contract, file-set, or ordering change was
| required.

The reviewer separately confirmed as correct: the entitlement gate composition,
the dormant cost center and its single migration, the class and monthly-row
model, the enforcement pre-check and its positive-budget dependency, the revision
compare-and-set flow, prompt ordering, the separate Knowledge-graph quota, the
registry ordering, the publication gate, the cutover mechanics, and the two-PR
ordering.

## Review provenance

Planner gate: `review_deadlock`. Three rounds ran and all three returned REVISE,
so no APPROVED verdict exists for this draft. The configured `planner` route
failed terminally before work on an account usage limit, so the loop ran as one
generic continuity child on `gpt-5.6-sol` at `xhigh`
(`generic-continuity` provenance, not a native role pass). The three-round cap
was reached with round 3's four corrections applied and no open blocking or
material finding: round 3 stated that the plan was "one edit pass away from
approvable" and that no slice, contract, file-set, or ordering change was
required. Round 1's blocking findings were structural and were fixed; round 2's
were ownership gaps, fixed; round 3's were text corrections, applied here.

Because approval was never issued, this draft is presented to the user for a
ruling with the deadlock disclosed rather than being treated as an approved
plan. Slice and final reviews are recorded under `project/_local/reviews/` as
they complete.
