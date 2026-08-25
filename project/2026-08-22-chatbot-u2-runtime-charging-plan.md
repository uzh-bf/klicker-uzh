# U2 — runtime class enforcement and charging (execution plan)

Roadmap:
[`project/2026-08-20-chatbot-hitl-lecturer-configuration-roadmap.md`](2026-08-20-chatbot-hitl-lecturer-configuration-roadmap.md)
(M1 Gate 1 approved 2026-08-21; Gate 2 approved 2026-08-22). U2 item
contract: `391c2e122a3e9483e7535eaec4042139a1599fb21b2034dc03998e0bd49d916d`.
Planning review completed 2026-08-22 with `DONE_WITH_CONCERNS`; its verified
corrections are recorded in
`project/_local/reviews/2026-08-22-chatbot-u2-runtime-charging-planner.md`.

## Goal

Enforce the owning account's live authorization and monthly availability for
the selected `BASE` or `ADVANCED` usage class before provider work. After a
turn, atomically persist one assistant-message lifecycle result and charge its
reliable provider usage once to the owner/class/Zurich-month counter. Preserve
participant usage credits as a separate legacy operation, restrict their
fallback to the selected class and chatbot allow-list, and return stable
class-specific availability errors without funding details.

## Non-goals

- No GraphQL or manage usage API/UI, lecturer budget editor, hidden base
  contribution field, tariff, invoice, refund, immutable ledger, reservation,
  historical backfill, participant-credit migration, or per-chatbot budget.
- No new model or deployment choice. In particular, U2 does not nominate an
  `ADVANCED` fallback where the registry currently has none.
- No changes to publication workflow, future lecturer-test identity, response
  examples, ground-truth work, or ADRs 0028–0036.
- No merge, PR readiness, deployment, live traffic, PR closure, cleanup,
  deletion, or second writer.

## Execution contract

- **Owner**: this task remains the M1 execution orchestrator and sole U2
  writer in the existing worktree.
- **One-time approval**: approval of this plan authorizes its in-scope edits,
  Node 24 devcontainer lifecycle, repository-native checks, Ox Alpha review
  passes, scoped local commits, push of
  `rs/chatbot-u2-runtime-charging`, creation/update of one draft PR based on
  U1 PR #5475, additive append to GitHub stack #5476, CI observation, and U2
  Phase 5 reconciliation.
- **Withheld**: ready marking, merge, rebase or force-push, deployment, live
  traffic or smoke, PR closure, worktree/branch/runtime deletion, secrets, and
  any response-example work.
- **Boundary owner**: this roadmap orchestrator owns stack mutation, roadmap
  `Progress`, and Phase 5. Reviewers are read-only.
- **Terminal**: U2 is locally and remotely verified, Ox Alpha reviewed,
  Phase 5 accepted, and published as one open draft stack layer with current
  head CI accounted for. Then continue to U3 under the roadmap; do not merge or
  deploy.
- **Pause**: only for a new product/data/architecture ruling, inability to
  identify reliable usage, a fallback that would cross class, a provider or
  reviewer route that cannot preserve the Ox Alpha requirement, or a withheld
  external action.

## Plan identity

- Plan: `project/2026-08-22-chatbot-u2-runtime-charging-plan.md`
- Branch: `rs/chatbot-u2-runtime-charging`
- Worktree: `trees/feat-chatbot-lecturer-config-phase0`
- Accepted base: U1 at
  `bfcb4e837b271958ae9c97d562ed231d828e5589`
- Parent layer: draft PR #5475, `rs/chatbot-u1-usage-foundation`
- Remote stack: GitHub stack #5476, currently PR #5460 → PR #5475
- Prior plan:
  `project/2026-08-21-chatbot-u1-usage-foundation-plan.md`

## Grounding facts verified at the accepted base

- The participant POST route in
  `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` already derives a
  client-supplied `assistantMessageId`, resolves the chatbot and model, creates
  image descriptions, persists user/assistant messages, aggregates tool-step
  usage, handles abort, and decrements legacy participant credits.
- The route currently uses participant credits to select one global fallback.
  `getAutomaticModelId` and `getModelsForChatbot` can admit the fallback even
  when it is outside `allowedModelIds`; the only configured fallback is
  `gpt-4.1-mini` (`BASE`). This can switch an `ADVANCED` turn to `BASE`.
- `onAbort` sets `sawAbort`, charges its aggregated step usage, and prevents a
  following `onEnd` from charging again. `onEnd` treats absent final provider
  usage as unchargeable. Tool calls remain within one terminal lifecycle.
- `ChatAccountUsage` is keyed by owner, usage class, and Zurich calendar month;
  its budget and used values are `Decimal(18,6)`. A missing row means budget
  and usage zero. `ChatMessage.id` is globally unique, includes `threadId`, and
  already stores nullable `creditsUsed Decimal(18,6)`.
- `User.aiChatbotPublishingEnabled` is the live account authorization flag.
  Cost-center approval remains out of band; the runtime neither reads nor
  returns the cost-center value.
- `ChatThread` joins an assistant message to one chatbot, whose `ownerId`
  supplies the owning account without using the caller kind. C3 can reuse the
  same finalizer when it supplies an owner-linked lecturer-test thread.
- ADR 0020 fixes the U2 behavior: pre-check before generation, reliable
  post-generation charge, atomic counters, bounded final/concurrent overrun,
  no cross-class fallback, no unreliable charge, and no funding disclosure.
  ADR 0019's actual file is
  `docs/adr/0019-chatbot-config-postgresql-authoritative.md`. No new ADR is
  needed.

## Resolved implementation decisions

### D1 — availability and participant boundary

The effective model and its registry `usageClass` are resolved first. The
account pre-check then reads the live owner authorization plus the current
owner/class/Zurich-month row. Authorization disabled, row missing, budget zero,
or `usedCredits >= budgetCredits` all deny before image description, message
persistence, or streaming. They map to HTTP `403` and one of:

- `CHAT_MODEL_UNAVAILABLE_BASE`
- `CHAT_MODEL_UNAVAILABLE_ADVANCED`

The response says only that the usage class is unavailable. It never exposes
budget, used credits, cost center, contribution, provider, or settlement data.
Account exhaustion never invokes fallback and never disables the other class.

### D2 — same-class participant-credit fallback

Participant credits remain a separate legacy input and decrement. When they
require fallback, the runtime may choose only a registry entry with
`fallback: true` that has the same `usageClass` as the already selected primary
and is inside the chatbot's explicit allow-list (or the unrestricted empty
allow-list). If none exists, the same class-specific `403` is returned even if
another class has a fallback or available account budget.

The current registry has no `ADVANCED` fallback. Therefore a zero-participant-
credit `ADVANCED` turn is denied rather than silently changing model class or
inventing a new paid fallback. This is the direct fail-closed consequence of
the approved contract. A later explicit model/deployment decision may add an
advanced fallback without changing the charge service.

The participant credits endpoint and registry helpers stop replacing the
client's selected/automatic class merely because participant credits reached
zero. POST remains authoritative for same-class fallback or denial. The GET
response continues to expose participant credits and model capabilities only;
it gains no account budget or funding fields.

### D3 — assistant-message idempotency without a new ledger

No Prisma schema change is required. Final assistant-message persistence is
moved behind one small account usage finalizer. In one `ReadCommitted`
transaction it:

1. creates the assistant message for the supplied `assistantMessageId` and
   thread;
2. when reliable usage exists, atomically increments the existing
   owner/class/month `usedCredits` by the same rounded decimal; and
3. updates the thread timestamp.

The transaction rolls back all three writes together. Successful creation is
the idempotency claim. A duplicate unique-key result charges nothing and is a
valid no-op only after a read proves the existing message belongs to the same
owner, chatbot, and thread. A matching completed key cannot start another
generation. A key collision outside that scope returns the same generic HTTP
`409` completed-turn response, without confirming where the key exists.

The first terminal result wins. A missing-usage result still persists the
assistant message with `creditsUsed = null`, so a later duplicate cannot turn
the uncharged lifecycle into a second charge; it remains a manual-correction
case. This uses an existing business record as the claim, not a reservation or
ledger.

### D4 — reliable usage and decimal boundary

The route collects raw provider costs across the terminal result and any image
descriptions. Reliable main-stream usage is required before the turn is
chargeable; if it is absent, the full turn charges nothing. When present, image
description cost is added before one Decimal conversion and six-decimal
rounding at finalization. The exact same rounded value is written to
`ChatMessage.creditsUsed`, incremented into `ChatAccountUsage.usedCredits`, and
returned as message metadata.

An availability pre-check is not a reservation. A final turn or concurrent
distinct turns may take `usedCredits` above budget; the finalizer never clamps
or rejects that accepted bounded overrun. The next pre-check denies the class.

### D5 — separate failure domains

The account finalizer accepts `ownerId`, `chatbotId`, `threadId`, class, turn
ID, assistant content/metadata, and reliable amount. It never accepts or
branches on participant versus lecturer-test caller identity.

`CreditsService.decrementCredits(participantId, chatbotId, amount)` remains a
separate legacy operation after the account finalization attempt. It does not
participate in the account transaction and cannot affect usage class or
fallback across classes. Failures remain independently observable and
manual-correctable; one balance is never used as proof that the other write
succeeded.

## Primitive impact

| Primitive                 | U2 disposition                                                               |
| ------------------------- | ---------------------------------------------------------------------------- |
| Account AI authorization  | Reuse live DB-row capability in pre-check                                    |
| Monthly usage budget      | Read owner/class/current Zurich month                                        |
| Runtime charge            | Add atomic, idempotent post-generation finalizer                             |
| Turn lifecycle identity   | Reuse assistant-message ID, scoped and verified through thread/chatbot/owner |
| Participant usage credits | Preserve decrement; restrict fallback to same class and allow-list           |
| Usage class registry      | Reuse explicit class and Auto=ADVANCED invariant; no new model               |
| Lecturer usage UI         | Deferred to U3                                                               |

## Feature-wide test portfolio

| Consequential behavior                                                                                         | Evidence seam                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Live authorization, missing row, zero budget, and exhausted row deny before provider work                      | Focused pre-check service tests plus route test proving no image generation, user-message persistence, or stream start           |
| Stable participant errors reveal class availability only                                                       | Route response assertions for BASE and ADVANCED, including identical external response for authorization and budget causes       |
| Reliable normal turn charges exact rounded amount                                                              | Finalizer integration test against PostgreSQL plus route callback assertion                                                      |
| Missing terminal usage charges nothing and closes the key                                                      | Finalizer/route test with `creditsUsed = null`, unchanged counter, persisted message, and duplicate no-op                        |
| Duplicate terminal callbacks charge once                                                                       | PostgreSQL integration test calls the finalizer twice for the same scoped assistant ID and proves one message plus one increment |
| Collision outside the scope never becomes a no-op or leaks scope                                               | Finalizer and route `409` tests with a foreign thread/key                                                                        |
| Concurrent distinct turns do not lose increments                                                               | PostgreSQL integration test runs two finalizers concurrently against one account row and proves the exact sum                    |
| Bounded final/concurrent overrun is accepted                                                                   | Integration test starts below budget, charges above remaining, and proves `usedCredits > budgetCredits`; next pre-check denies   |
| Account exhaustion never falls back                                                                            | Route test proves denial even when the other class has a configured fallback and budget                                          |
| Participant fallback stays in class and allow-list                                                             | Registry/route matrix: same-class allowed fallback selected; out-of-class or omitted fallback denied                             |
| Zero participant credits cannot silently change an ADVANCED turn to BASE                                       | Automatic and explicit model route tests; participant credits GET/store regression test preserves the selected class             |
| Auto remains ADVANCED                                                                                          | Existing registry parity plus focused selection/charge assertion                                                                 |
| Tool loop charges once at terminal completion                                                                  | Route lifecycle test with multi-step provider usage                                                                              |
| Abort charges summed reliable partial steps once and suppresses late end                                       | Route lifecycle test preserving `sawAbort` behavior                                                                              |
| A retry with a new assistant ID is a separate billable lifecycle; a completed ID is rejected before generation | Route/finalizer tests                                                                                                            |
| Participant decrement remains separate                                                                         | Route test proves it is still called for reliable usage and never enters account finalizer inputs or class selection             |
| Caller kind is absent from account service                                                                     | Type/unit contract accepts owner/thread identity only; no participant ID in pre-check/finalizer API                              |

DB-backed tests use only synthetic UUIDs and clean up only their owned rows.
They do not bulk-delete shared development data.

## Slices and commits

### P — approved plan checkpoint

- Files: this plan and its `Progress` only.
- Commit after approval: `docs(project): add U2 runtime charging plan`.
- No implementation starts before the approval ruling.

### S1 — account availability and atomic turn finalizer

- Add the smallest runtime service under `apps/chat/src/services/` for live
  owner/class/month availability and atomic assistant-message finalization.
- Reuse `getZurichMonthStart`, Prisma Decimal, the existing account row, and
  `withTransaction`; do not add a model, migration, table, reservation, or
  ledger.
- Add focused pure tests and a real-PostgreSQL integration seam for scoped
  idempotency, collision, concurrency, missing usage, and bounded overrun.
- Commit: `feat(chat): add account usage finalization`.
- Review immutable range with one Ox Alpha simplifier and one Ox Alpha slice
  reviewer covering data integrity, authorization, idempotency, concurrency,
  and participant data disclosure. Verify and disposition findings before S2.

### S2 — model selection and route lifecycle integration

- Update the registry selection helpers, participant credits GET behavior,
  and POST route so participant credits never cause cross-class or allow-list-
  bypass fallback.
- Resolve owner/class, check availability before provider/message work, reject
  a completed turn key before generation, and route both normal and abort
  terminal results through the finalizer.
- Preserve tool aggregation, `sawAbort`, message metadata, and the independent
  participant decrement.
- Add focused route/registry/store tests for the full matrix in the test
  portfolio. No account budget values enter the participant response.
- Commit: `feat(chat): enforce usage class at runtime`.
- Review immutable range with one Ox Alpha simplifier and one Ox Alpha slice
  reviewer covering architecture, security/error surface, fallback, lifecycle,
  and legacy participant-credit separation. Verify and disposition findings.

### S3 — wiki and integrated evidence

- Replace the U1 deferral/fallback passages in `docs/chat-platform.md` with the
  implemented pre-check, class errors, atomic finalizer, idempotency,
  missing-usage, bounded-overrun, same-class fallback, Auto attribution, and
  participant-credit separation contracts.
- Record that no `ADVANCED` fallback is currently declared and that runtime
  denies rather than crosses class. Do not expose or describe hidden funding
  amounts.
- Correct the pre-existing participant zero-credit copy in English and German
  so it no longer promises a smaller-model fallback that U2 cannot provide.
  Keep the change informational: it must not imply that every model remains
  available or alter selection, charging, or denial behavior.
- Update the focused Playwright expectations and agent-facing E2E guidance,
  then verify desktop, automatic-selection settings, and mobile surfaces in
  both locales in a real browser.
- Commit: `fix(chat): clarify zero-credit model availability`.
- Run the complete verification portfolio, then an Ox Alpha integrated final
  review of the exact U2 range. Any implementation correction reopens the
  affected focused checks and exact-head final review.

### S4 — draft publication and Phase 5

- Review staged content for credentials, secrets, personal data, and unrelated
  hunks before every commit and push.
- Push only `rs/chatbot-u2-runtime-charging`; create/update one draft PR with
  base `rs/chatbot-u1-usage-foundation`; append it additively to stack #5476.
- Observe one current-head CI run without launching a second watcher. Keep the
  PR draft.
- Reconcile the U2 item through roadmap Phase 5 using the reviewed diff, local
  verification, CI, PR, and stack evidence. Commit/push only the resulting
  accepted roadmap `Progress` update, then re-check current-head CI if changed.
- Stop before ready marking, merge, deployment, live traffic, closure, cleanup,
  or deletion. Continue to U3 only after U2 is accepted.

## Delegation and review routing

| Work                                 | Owner / route                                                                               | Acceptance                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| S1–S4 implementation and integration | Main session; one writer because route, persistence, and concurrency are critically coupled | Exact plan behavior and scoped commits       |
| S1 simplification + risk review      | Two read-only Ox Alpha passes through verified `combo/ox-alpha`, maximum effort             | Findings verified and dispositioned          |
| S2 simplification + risk review      | Two read-only Ox Alpha passes through verified `combo/ox-alpha`, maximum effort             | Findings verified and dispositioned          |
| Integrated final review              | One read-only Ox Alpha pass through verified `combo/ox-alpha`, maximum effort               | Exact final range has no unresolved blocker  |
| Phase 5 item review                  | One read-only Ox Alpha pass through verified `combo/ox-alpha`, maximum effort               | Accept, correct, or park against U2 contract |

No native collaboration child is used while its encrypted task delivery is
incompatible with Ox Alpha. No non-Ox model or provider substitutes for a
required child or reviewer.

## Verification

Run all toolchain commands inside the exact Node 24 devcontainer. The main
session will read `klicker-testing-verification` before execution and use
`rs-local-runtime-lifecycle` to start, prove, stop, and verify zero routes for
the exact worktree.

Focused checks:

```bash
pnpm --filter @klicker-uzh/chat test:run -- accountUsage
pnpm --filter @klicker-uzh/chat test:run -- chatUsageRoute
pnpm --filter @klicker-uzh/chat test:run -- chatModelRegistry
pnpm --filter @klicker-uzh/chat test:run -- settings-store-credits
pnpm --filter @klicker-uzh/chat check
pnpm --filter @klicker-uzh/util test -- chatUsage
```

Integrated checks:

```bash
pnpm --filter @klicker-uzh/chat test:run
pnpm run check:all
pnpm --filter @klicker-uzh/chat build
```

The test file filters may be adjusted to their final repository names without
changing the evidence obligations. A Prisma schema or migration command is not
planned. If implementation evidence proves a schema change is necessary, stop
with `BOUNDARY_CANDIDATE` before editing Prisma.

Browser verification was not part of the initial scope because the runtime
implementation changed no visible surface. S3 then found inaccurate existing
zero-credit copy and armed the plan's scope boundary. After the user's narrow
approval, the browser gate covers the corrected English and German desktop,
automatic-selection settings, and mobile surfaces. The existing settings-store
contract retains its focused regression test.

## Risks and failure shields

- **Atomicity**: never increment the account counter separately from the first
  assistant-message persistence. A logging-only failure between those writes
  is not accepted evidence.
- **Idempotency**: never treat a global message-ID collision as a valid
  duplicate without verifying owner, chatbot, and thread inside the database
  boundary; never return the foreign scope.
- **Availability**: check live authorization and current monthly row before
  image description or provider streaming. The check is not a reservation.
- **Decimal**: round once after all reliable turn costs are summed; reuse that
  exact value for message metadata and both persisted fields.
- **Fallback**: intersect class, `fallback: true`, and allow-list. Never pick
  the other class, bypass the allow-list, or silently designate a new model.
- **Legacy separation**: do not remove participant decrement or make its
  balance the account counter. Do not use participant ID in the account
  service.
- **Rollout**: U1 missing rows default to zero and existing owners may have the
  live capability disabled. This intentionally fails closed; operational
  authorization/budget seeding is a later deployment preflight, not a U2 data
  backfill.
- **Scope**: preserve unrelated worktree state and never touch the independent
  response-example design.

## ADR and wiki disposition

- Reuse accepted ADR 0020. No new forward-looking decision is introduced.
- Reference actual ADR 0019 filename where needed; do not edit ADR 0019.
- Update `docs/chat-platform.md` in S3 because U2 changes runtime behavior.
- Keep `AGENTS.md` and `CONTEXT.md` unchanged unless implementation proves an
  existing statement inaccurate. The approved vocabulary already covers U2.

## Progress

- 2026-08-22: Gate 2 approved. Branch created from accepted U1 at
  `bfcb4e837`; no U2 implementation, push, PR, or remote stack mutation exists.
- 2026-08-22: Ox Alpha planning review completed with
  `DONE_WITH_CONCERNS`. Main-session verification corrected the idempotency,
  live-authorization, fallback, participant endpoint, and reliable-usage
  details above.
- 2026-08-22: the user approved this execution plan with “proceed working
  through the plan.” U2 is active under its named local, review, draft
  publication, and Phase 5 authority; merge, deployment, live traffic,
  closure, cleanup, and deletion remain withheld.
- 2026-08-22: the exact devcontainer reports Node `v24.16.0`, and
  `pnpm run check:all` passed before implementation. The first
  `devrouter ensure` route proof timed out because host curl reported an SSL
  certificate “out of memory” error for every HTTPS route; direct container
  execution remains healthy, and the route proof remains open for the final
  lifecycle gate.
- 2026-08-22: S1 account availability and atomic turn finalization are
  implemented with focused Decimal tests and an opt-in real-PostgreSQL seam.
  Chat type-checking passed, the default suite passed with 357 tests and six
  expected integration skips, and all six enabled PostgreSQL cases passed.
- 2026-08-22: S1 was committed at `02f1fabbf`. Its Ox Alpha simplifier and
  data-integrity risk review both returned `PASS` for
  `124a1faf6..02f1fabbf`; no correction was required.
- 2026-08-22: S2 implementation and local verification are complete. The
  registry and credits response preserve the selected class, participant
  fallback is strict by class and allow-list, account availability and turn-key
  checks precede provider/message work, and normal plus aborted terminal paths
  share the atomic finalizer while participant decrement remains separate.
  The focused matrix passed 37 checks; the complete Chat suite passed 369
  tests with six expected integration skips; all six enabled PostgreSQL cases
  passed; and Node 24 `pnpm run check:all` passed.
- 2026-08-22: S2 was committed at `30544d6f5`. Its Ox Alpha simplifier and
  risk review both returned `PASS` for `02f1fabbf..30544d6f5`; no code
  correction was requested. The risk reviewer independently reran 21 focused
  tests and the Chat package type-check successfully.
- 2026-08-22: S3 grounding found that the existing participant zero-credit
  notice still promises that new messages use a smaller model. U2 now correctly
  denies zero-credit `ADVANCED` turns because the registry has no allowed
  same-class fallback, so that visible notice would become inaccurate. The
  plan's browser-gate clause therefore arms: pause before changing i18n or UI,
  obtain a narrow scope update, then verify the corrected notice in a real
  browser before accepting S3.
- 2026-08-22: the user approved the narrow participant notice and browser-
  verification scope update. The correction uses neutral model-availability
  copy in both locales, updates the existing desktop/mobile expectations and
  agent-facing Playwright guidance, and does not change model, fallback,
  funding, account, or lecturer-lane behavior.
- 2026-08-22: the complete Chat suite passed again after the copy correction
  with 369 tests and six expected skips. The Playwright project type-check and
  test discovery passed, listing 870 tests. The two focused browser tests could
  not launch because the DevPod lacks Playwright's Chromium headless-shell
  binary; no product assertion ran or failed.
- 2026-08-22: `agent-browser` verified the seeded participant at zero credits
  on the English and German desktop, lecturer-managed automatic-selection
  settings, and 390-by-844 mobile surfaces. All showed 0 / 100 and the neutral
  availability copy, with no browser errors. Screenshots are retained under
  ignored `project/_local/screenshots/`.
- 2026-08-22: the rebuilt runtime, migration, and synthetic seed completed.
  Managed route proof still failed on host curl's SSL certificate “out of
  memory” error, but exact proxy-route reconciliation registered Chat, PWA,
  API, and Auth and enabled successful HTTPS browser verification.
- 2026-08-22: the repository-wide OKF validator reported 18 pre-existing
  metadata errors in unrelated ADR and solution pages. It reported no error
  for the changed `docs/chat-platform.md` page.
- 2026-08-22: the final Node 24 `pnpm run check:all` passed all 25 repository
  checks, and the Chat production build completed successfully. Its expected
  local warning states that model requests need a key; no model call was part
  of this browser-copy verification.
- 2026-08-22: S3 was committed at `0e0cef7f7`. The complete local portfolio
  passed, the integrated Ox Alpha review accepted the full U2 range, and the
  first Phase 5 review accepted that boundary. The resulting roadmap-only
  reconciliation was committed at `3ab84a050` and published to draft PR #5480.
- 2026-08-22: current-head CI then exposed one stale Playwright expectation:
  the participant credits GET and settings store now intentionally preserve
  the selected `BASE` model at zero participant credits, but the test still
  expected the legacy Mini replacement. The expectation was narrowed to
  require GPT-4.1 and exclude GPT-4.1 Mini, with no product-code change, and
  committed at `367784db6`.
- 2026-08-22: the correction's narrow Ox Alpha review and the refreshed
  integrated Ox Alpha final review both passed. Exact-head CI at `367784db6`
  finished with 27 passed, nine intentionally skipped, zero failed, and zero
  pending; all eight Playwright shards passed, including the corrected case in
  shard 5. The refreshed Phase 5 review accepted `367784db6` as the exact U2
  implementation boundary and authorized a documentation-only reconciliation
  before proceeding to U3.
- 2026-08-25: the latest review follow-up preserves assistant lifecycle closure
  when cost rounding rejects unusable provider usage, leaving the turn
  uncharged, and now finalizes empty terminal step arrays instead of skipping
  persistence and reliable charging. The rebased focused route suite passes
  15/15 in the exact Node 24 DevPod. Both corrections passed their simplifier
  and lifecycle-integrity reviews.
- Current state: U2 is ready for stack-aware publication at its rebased head.
  Merge, deployment, live traffic or proof, closure, cleanup, and deletion
  remain withheld.
