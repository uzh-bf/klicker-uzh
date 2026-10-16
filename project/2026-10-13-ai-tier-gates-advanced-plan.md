# Gate advanced chat models on the AI subscription tier

## Approval summary

`User.aiSubscriptionTier` (`BASE` or `ADVANCED`, from #6046) is display-only
today. Class admission opens `BASE` models with `aiFeaturesEnabled` and
`ADVANCED` models with a non-blank `aiChatbotCostCenter`; nothing reads the
tier. The user ruled on 2026-10-13 that:

- the tier gates `ADVANCED` models;
- Auto stays a `BASE` model, so Auto remains the sanctioned way for
  `BASE`-tier owners to reach some Sol;
- setting a cost center also sets the tier to `ADVANCED`;
- the lecturer model picker must stop offering models the owner cannot use.

After this change, an `ADVANCED` model is admitted only when the owner has AI
features enabled, tier `ADVANCED`, and a non-blank cost center. The cost
center stays required because `ADVANCED` usage is billed to it. `BASE`
admission is unchanged. Deployed registries already classify Auto and GPT-6
Luna as `BASE` and the Sol models as `ADVANCED`; no registry or deployment
value changes.

Completion: one draft PR to `v3-ai` covering admission, the admin rule, a
data backfill, the lecturer model picker, tests and docs, with green hosted CI
and browser captures of the picker and the usage page. Merge, staging checks
on deployed data, and release stay separately authorized.

## Execution details

Target: `v3-ai` at `af292fde06`. Branch: `enhance/chat-tier-gates-advanced`.
Worktree: `trees/chat-tier-gate`. Artifact root: `project/`. One package and
one PR: every part serves one rule, and splitting would ship admission without
the picker that keeps owners from configuring bots that refuse turns. The main
session implements it in two slices.

### Slice 1: server rule

1. `packages/util/src/chatUsage.ts`: `isChatUsageClassEntitled` takes
   `aiSubscriptionTier` and admits `ADVANCED` only for tier `ADVANCED` plus a
   non-blank cost center. Update its doc comment.
2. Load and pass the tier at every caller:
   - `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
   - `apps/chat/src/app/api/manage/chatbots/[chatbotId]/preview/chat/route.ts`
   - `apps/chat/src/services/accountUsage.ts`
   - `packages/graphql/src/services/chatAccountUsage.ts` (both overview
     builders already select the tier; pass it into `entitledFor`)
3. Cost center implies the tier, in `setAiFeatures`
   (`packages/graphql/src/services/accounts.ts`). When a call sets a non-blank
   cost center and names no tier, the tier becomes `ADVANCED`. When a call
   clears the cost center and names no tier, the tier becomes `BASE`, since
   `ADVANCED` without a cost center grants nothing. An explicitly passed tier
   still wins. The admin page only toggles AI features; tier and cost center
   are set through the GraphQL mutation, so this server rule covers every
   path.
4. Backfill as a data-only Prisma migration (no schema change): set tier
   `ADVANCED` for every user whose cost center is non-blank. This preserves
   advanced access for existing accounts with a cost center when the tier
   check is introduced. Create it with `prisma migrate dev --create-only` in
   the container; it holds one `UPDATE`.
5. Saving a chatbot revision rejects a newly added `ADVANCED` model when the
   bot's owner is not entitled to it (`normalizeRevisionModelPolicy` /
   `saveChatbotRevision` in `packages/graphql/src/services/chatbots.ts`).
   Models the current configuration already allows stay saveable, so an owner
   whose entitlement was withdrawn can still edit the bot and remove them.

### Slice 2: lecturer model picker

`apps/frontend-manage/src/components/resources/chatbots/ChatbotDetails.tsx`
offers every registry model in the fixed-model choice and in the
participant-choice checkboxes. Change it to:

- add `usageClass` to `QGetChatModelRegistry.graphql` (the field already
  exists on the type) and read the owner's entitlement from the existing
  `GetChatAccountUsage` query (`advancedModelUsage.entitled`);
- disable `ADVANCED` models the owner is not entitled to, with a short hint
  naming the requirement (advanced subscription with a cost center);
- keep an already-saved non-entitled model visible with a warning so the
  owner can remove it.

Copy: new en/de strings for the picker hint and warning. Change the usage
page's `chatAccountUsageAdvancedCostCenter` hint to name both requirements.

### Docs

Amend ADR 0020 with a dated section recording the tier gate, the cost-center
implication and the Auto ruling. Update the admission paragraphs in
`docs/chat-platform.md` and the "AI usage authorization" entry in
`CONTEXT.md`.

### Test portfolio

| Risk | Obligation | Seam |
| --- | --- | --- |
| `BASE`-tier owner with cost center still reaches Sol | Extend existing test | `isChatUsageClassEntitled` cases: tier × cost center × class |
| A route ignores the tier | Adjust existing route tests | Participant and preview routes: refused for `BASE` tier with cost center; admitted for `ADVANCED` |
| Auto or Luna regress for `BASE` owners | Reuse existing tests | `BASE` admission cases unchanged |
| Setting a cost center leaves the tier `BASE` | Extend existing test | `setAiFeatures` in `packages/graphql/test/chatAccountUsage.test.ts`: set → `ADVANCED`, clear → `BASE`, explicit tier wins |
| Owner saves a model they cannot use | New service test | `saveChatbotRevision` rejects an added non-entitled Sol and keeps an existing one saveable |
| Picker still offers Sol | Browser check | Local stack with a `BASE` and an `ADVANCED` owner, both colour schemes |

Chat and util suites run in the offline `node:24` container. GraphQL suites
need a live database and run in hosted CI. The migration is checked by applying
it to the guarded local test database. Picker and usage-page captures follow
the repository's browser and screenshot rules.

### Rollout

The backfill migration ships with the code, so no manual tier change is
needed. Each environment's release keeps its own authorization. After the
staging deploy, rerun the earlier model-choice check: Sol admitted for an
`ADVANCED` owner. Checking the refusal for a `BASE` owner on staging needs a
staging data change, asked for separately.

## Progress

- 2026-10-13: plan drafted. Revised the same day: the picker and the
  cost-center implication were added at the user's request, and a migration
  replaced the manual production backfill. Approved and implemented in draft
  PR #6491.
- Verified: affected chat suites in the offline container (120 tests), GraphQL
  codegen and typecheck, the migration applied twice to a throwaway Postgres,
  and the picker in a browser for a base-tier and an advanced-tier owner.
- The built-in registries keep Auto `ADVANCED` (deployed registries override it
  to `BASE`), so the CI and local stacks treat Auto as advanced. The seeded
  `lecturer` therefore receives the advanced tier and a synthetic cost center,
  keeping the authoring e2e flow that adds Auto valid.
- Open: hosted CI for the GraphQL DB suites and Playwright; the account usage
  hint was not seen in a browser because its section is flag-gated on the
  local stack.
