# U1 — account usage foundation (execution plan)

Roadmap:
[`project/2026-08-20-chatbot-hitl-lecturer-configuration-roadmap.md`](2026-08-20-chatbot-hitl-lecturer-configuration-roadmap.md)
(approved M1 stack, Gate 1 approved 2026-08-21). Item contract:
`b8c5854231d94bec11b6015ea7f5a6baace4849797b1ee6677b4938e743264f0`.
Planner pass complete 2026-08-21 (report:
`project/_local/reviews/2026-08-21-chatbot-u1-usage-foundation-planner.md`).

## Goal

Store one account-scoped monthly budget and used-credit counter per usage
class (BASE, ADVANCED) with a deterministic Europe/Zurich month boundary,
complete registry classification of every serving model source, focused
tests, and the affected `docs/chat-platform.md` documentation. Inert until
U2 charges and U3 exposes the lecturer lanes.

## Non-goals

- No runtime charging, GraphQL/manage usage UI, historical backfill,
  participant-credit migration, hidden contribution fields, per-chatbot
  allocation, tariffs, ledgers, refunds, invoices, another approval model,
  provider-specific user-facing vocabulary, or changes to the deployed
  QGetChatModelRegistry manage operation.

## Execution contract

- **Owner**: this task (execution orchestrator), autonomous through U1's
  terminal condition after the single plan-approval ruling.
- **Authority granted**: in-scope edits in the named worktree, local runtime
  use, repository-native checks, review dispatch, plan/progress updates,
  scoped local commits.
- **Withheld**: branch switching, stack topology, push, PR creation/update,
  ready marking, merge, deployment, live traffic/proof, PR closure, cleanup,
  deletion, secret writes.
- **Boundary owner**: `rs-roadmap-orchestrator` (roadmap Progress and
  Phase 5 are orchestrator-owned; this task updates only its plan Progress).
- **Terminal**: clean, locally committed, fully verified and reviewed U1
  candidate with required delivery `reviewed`; return `BOUNDARY_CANDIDATE`
  packet to the orchestrator.
- **Pause**: only for a fresh contract question, the execution-plan approval,
  a missing required capability, or evidence the accepted U1 contract cannot
  be reached safely.

## Plan identity

- Plan: `project/2026-08-21-chatbot-u1-usage-foundation-plan.md`
- Branch: `rs/chatbot-u1-usage-foundation`
- Worktree: `trees/feat-chatbot-lecturer-config-phase0`
- Base: `feat/chatbot-lecturer-config-phase0` at
  `d84140434dbfa25ca5e92333a139f7d61063d02c` (PR #5460)
- Roadmap commit: `76e6a7f972db345434442ac23917a1b728785ae4` (HEAD)
- Prior plan (history): `project/2026-08-20-chatbot-hitl-phase0-pr-5460-plan.md`

## Grounding facts (verified 2026-08-21)

- Schema area: `packages/prisma/src/prisma/schema/chat.prisma`
  (ChatUsageCredits, ChatThread, ChatMessage, Chatbot; Decimal fields use
  `@db.Decimal(18, 6)`); `user.prisma` holds `User` with
  `aiChatbotPublishingEnabled`/`aiChatbotCostCenter`. Analytics mirror in
  `apps/analytics/prisma/schema/` (sync copies all but js/datasource).
- Migrations: `packages/prisma/src/prisma/schema/migrations/` (naming
  `YYYYMMDDHHMMSS_name`; reference
  `20260820151622_chatbot_lifecycle_and_ai_capability`).
- Registry: `apps/chat/src/lib/server/chatModelRegistry.ts` (server) and
  `packages/graphql/src/services/chatbots.ts` (backend copy), both zod
  validated, cacheable via `CHAT_MODEL_REGISTRY_JSON`.
- Deployment copies: `deploy/env-uzh-stg/values.yaml` and
  `deploy/env-uzh-prd/values.yaml` `chat.modelRegistry` lists; chart
  templates `cm-chat.yaml`/`cm-backend-graphql.yaml` feed both pods from
  the same source. Not covered by the current parity test (documented).
- Parity test: `apps/chat/test/modelRegistryParity.test.ts` (built-in
  defaults only); root package declares `yaml ~2.6.1` (devDependency).
- Wiki: `docs/chat-platform.md` "Model registry and credits" section;
  current repo skill requires no index/log edits (removed in PR #5450) —
  update only the affected page in the same PR.

## Resolved decisions (from planner pass; D1–D5)

- **D1** Account-usage storage: new `ChatUsageClass` enum (BASE, ADVANCED)
  and `ChatAccountUsage` model with `monthStart DateTime @db.Date` (first
  calendar day of the month, Postgres DATE, per the repo's date-identity
  convention in analytics.prisma/response.prisma), `budgetCredits Decimal
  @default(0) @db.Decimal(18, 6)`, `usedCredits Decimal @default(0)
  @db.Decimal(18, 6)`, composite primary key
  `@@id([ownerId, usageClass, monthStart])` and no surrogate `id`,
  consistent with the sibling `ChatUsageCredits` composite key
  (chat.prisma:54); owner relation to `User` via
  `ownerId String @db.Uuid` (onDelete Cascade), consistent with
  `Chatbot.ownerId`. The database stores the calendar key, not a UTC
  instant: the shared util derives the Europe/Zurich start/reset instants
  from the month key deterministically (incl. DST).
- **D2** No GraphQL change in U1: usageClass added to the internal
  registry types (server + backend) but not to the public Pothos
  `ChatModelCapability` (U3 owns the API projection; GraphQL generation
  only if types are touched — they are not).
- **D3** Registry classification: `usageClass: 'BASE' | 'ADVANCED'` on
  every registry entry (built-in + deployment YAML). Auto is ADVANCED.
- **D4** Parity test extends to parse the two values.yaml modelRegistry
  lists and assert every entry resolves a class and matches the shared
  chat/backend parse functions.
- **D5** Deterministic missing-row behavior: no row in a month → budget 0,
  used 0 (defaults); no backfill at migration cutover.

## Primitive impact (from roadmap)

| Primitive | Disposition |
| --- | --- |
| Monthly usage budget | Create (account + class + month record) |
| Usage class registry | Extend with explicit classification |
| Account AI authorization | Reuse existing capability; no second approval model |
| Runtime charge / lecturer UI | Deferred to U2/U3 |

## Test portfolio

| Consequential risk | Obligation | Primary seam |
| --- | --- | --- |
| Migration is additive/expand-only and rollback-aware | Focused migration test | Prisma migrate + SQL inspection |
| Composite primary key rejects duplicate owner/class/month rows | New test | Two direct ChatAccountUsage creates, second rejected |
| Validation rejects negative/malformed budgets | New test | Zod/validation test in util |
| Month boundary deterministic in Europe/Zurich (incl. DST) | New test | util month-boundary test |
| Every registry copy + deployment config classified, parity | Extend parity test | modelRegistryParity.test.ts |
| Missing row → deterministic zero/default | New test | util/registry test |
| Participant queries never expose the counter | No new API surface | Diff review (no participant query changes) |

## Slice list

### S1 — Prisma schema + migration (data-integrity boundary)

- Route: main. Acceptance: migration additive, composite primary key
  `PRIMARY KEY ("ownerId", "usageClass", "monthStart")` created, counters
  zero at cutover, no participant query exposure.
- Files: `packages/prisma/src/prisma/schema/chat.prisma` (+ user relation),
  new migration under `schema/migrations/`.
- Verify: `pnpm --filter @klicker-uzh/prisma generate`, `pnpm run
  prisma:sync`, focused Prisma test.
- Commit: `chore(prisma): add account usage foundation`

### S2 — Registry classification + parity

- Route: main (registry is seam + config parity). Files:
  `apps/chat/src/lib/server/chatModelRegistry.ts`,
  `packages/graphql/src/services/chatbots.ts`, values.yaml x2,
  `apps/chat/test/modelRegistryParity.test.ts`.
- Verify: `pnpm --filter @klicker-uzh/chat test:run -- modelRegistryParity.test.ts`,
  `pnpm --filter @klicker-uzh/graphql check`, `pnpm --filter @klicker-uzh/chat check`.
- Commit: `enhance(chat): classify model registry usage`

### S3 — Documentation + integrated verification

- Files: `docs/chat-platform.md` (usage classes, month boundary,
  missing-row defaults, deferral note), focused docs edits.
- Verify: `pnpm run check:all`, `pnpm run build` (chat/graphql), wiki
  validation.
- Commit: `docs(chat): document account usage foundation`

## Delegation map

| Slice | Owner | Acceptance |
| --- | --- | --- |
| S1 | main (data-integrity boundary) | migration + tests |
| S2 | main (registry + config parity) | parity tests pass |
| S3 | main (docs + integration) | check:all + build |

## Progress

- Current: planning complete, reviewed, awaiting the orchestrator's
  execution-plan approval ruling (single question below).
- Next: on approval, run S1–S3 with reviews (S1/S2 slice review via
  `slice-reviewer` for data-integrity + simplifier where substantive;
  integrated `final-reviewer` on the complete package), runtime lifecycle
  per `$rs-local-runtime-lifecycle`.
- Delivery: `reviewed` (required); orchestration of Phase 5 and draft PR
  publication stays with the roadmap orchestrator.
