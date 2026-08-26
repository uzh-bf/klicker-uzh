# PR #5524 — trusted-pilot finalization hardening

## Status

Planner-reviewed proposal awaiting Gate 1 approval. No implementation, commit,
recascade, remote publication, runtime start, merge, deployment, live data
change, or enforcement activation is authorized by this document alone.

This plan supersedes the remaining execution contract of
[`2026-08-24-chatbot-u4-model-registry-policy-plan.md`](2026-08-24-chatbot-u4-model-registry-policy-plan.md)
for the final correction of PR #5524. It preserves the earlier U4 evidence and
does not rewrite the history of Phase 0 through U4.

Roadmap:
[`2026-08-20-chatbot-hitl-lecturer-configuration-roadmap.md`](2026-08-20-chatbot-hitl-lecturer-configuration-roadmap.md).

## Goal

Finalize the existing five-pull-request chatbot stack as a reviewed, CI-green
candidate for an operations-assisted trusted-pilot cutover. The candidate must
preserve legacy participant service while enforcement is disabled, create new
chatbots with a bounded Luna policy, keep budget writes under the existing
`ADMIN` role, make lifecycle reachability visible in Manage, reject invalid
runtime model registries before readiness, and exercise PostgreSQL usage
accounting in ordinary CI.

The terminal is code and pull-request readiness for a later controlled cutover.
It is not a live pilot and does not establish that any participant-facing
deployment is safe outside the separately allowlisted cohort and operational
controls.

## Non-goals

- No sixth pull request, second writer, stack reorder, unstacking, layer merge,
  or implementation on a lower layer.
- No merge, deployment, production or staging traffic, cluster access, database
  write, provider configuration, hard-cap write, cohort provisioning, or
  enforcement activation.
- No immutable chatbot revision, prompt snapshot, approval snapshot, funding
  schema, reservation ledger, actual routed-cost attribution, invoice model, or
  automatic refund.
- No participant-credit redesign, rate limiter, input/image size program,
  concurrency reservation, or broad production-readiness audit.
- No model removal, model-price refresh, Auto routing change, usage-class
  change, provider-failure fallback change, or change to the accepted Auto 1/5
  accounting estimate.
- No migration or bulk normalization of existing chatbot records. Global model
  registry validation and output ceilings still apply to all runtime entries.
- No change to provider-call idempotency or the existing five-step tool cap.
  Evidence already shows the turn is claimed before billable work and tool
  steps are bounded; a needed change there stops this package for replanning.
- No response-example, ground-truth, or ADR 0028–0036 work. That package is not
  part of this roadmap and must not be registered, scheduled, reconciled, or
  implemented here.

## Execution contract

- **Execution orchestrator and writer:** the current roadmap task is the sole
  topology owner and sole writer in
  `trees/feat-chatbot-lecturer-config-phase0`. Read-only specialists may review
  immutable ranges but may not edit the checkout or publish branches.
- **Boundary owner:** the active `rs-roadmap-orchestrator` owns stack identity,
  integration, review disposition, Phase 5 reconciliation, and the authority
  boundary after the candidate is published.
- **Gate 1 approval:** approval of this exact plan authorizes its plan commit,
  local recovery refs, a guarded local recascade of the exact five existing
  branches onto the then-current `origin/v3`, correction commits only in U4,
  repository-native checks, synthetic devrouter/browser/Playwright proof
  without provider use, configured read-only reviews, plan and roadmap
  `Progress` updates, and atomic force-with-lease publication only to the five
  existing remote branches listed below. It also authorizes observing one
  exact-head CI terminal for each changed stack head and updating existing PR
  descriptions from verified evidence.
- **Withheld:** merge; deployment; live database, provider, secret, cluster, or
  configuration writes; changing enforcement to true; staging or production
  smoke; a new pull request; PR closure; branch/worktree/runtime deletion; and
  broad Docker cleanup.
- **Terminal:** the same five open, ready pull requests preserve their order and
  identity; their exact published heads are current with `v3`; the U4
  correction has passed focused and integrated verification, synthetic browser
  proof, required reviews, and exact-head CI; the roadmap is reconciled without
  claiming a live pilot; and the exact task runtime is stopped with its routes
  released.
- **Pause:** stop before mutation if remote leases, branch heads, PR bases,
  ready states, writer ownership, or stack order differ. Stop during execution
  if recascade changes a lower-layer patch, a conflict requires a product or
  data-contract choice, a required review route ends unavailable, a check
  exposes wider scope, or completion would require a withheld action.

Gate 1 approval wording:

> Approve the reviewed trusted-pilot finalization plan. This authorizes
> committing the plan, creating local recovery refs, recascading the exact
> existing five-branch stack onto current `origin/v3`, making correction
> commits only in the top U4 layer, running repository checks and synthetic
> devrouter/browser/Playwright verification without provider usage, completing
> configured read-only reviews, updating plan and roadmap Progress, and
> atomically publishing only the five existing remote branches while
> preserving their PR identities and ready state, followed by exact-head CI
> observation. It does not authorize merge, deployment, live database,
> provider, secret, cluster, or configuration writes, enforcement activation,
> production smoke, a new PR, or branch/worktree cleanup.

## Identity and freshness baseline

The freshness gate ran on 2026-08-26. The task checkout is clean at
`1392f485870fe76ab25e25531c5b8ad3eb59e907` on
`rs/chatbot-u4-model-registry-policy`, with an exact upstream match. Fresh
`origin/v3` is `61a7f8108477a58595505d97618d68f3eeb35aff`. The stack contains
99 commits not on `v3` and is five current `v3` commits behind it. Those five
commits are release/deployment changes plus the unrelated course-duplication
timeout fix; this observation does not replace a fresh Gate 1 lease check.

| Layer | Existing PR | Base | Current remote head | State |
| --- | --- | --- | --- | --- |
| Phase 0 — lecturer configuration and publication gate | [#5460](https://github.com/uzh-bf/klicker-uzh/pull/5460) | `v3` | `a2b483ea33a7975f991f2403c8a4e7af80608d71` | Open, ready |
| U1 — account usage foundation | [#5475](https://github.com/uzh-bf/klicker-uzh/pull/5475) | Phase 0 | `8d6737aa535fe03d3112d5e9eea244c0fc36808d` | Open, ready |
| U2 — runtime usage charging | [#5480](https://github.com/uzh-bf/klicker-uzh/pull/5480) | U1 | `12daf07ac47486186f26e33d9b47a601de33e8ef` | Open, ready |
| U3 — lecturer usage lanes | [#5490](https://github.com/uzh-bf/klicker-uzh/pull/5490) | U2 | `703792be558d4179c722de85ca8f4ab616c62362` | Open, ready |
| U4 — registry and pilot hardening | [#5524](https://github.com/uzh-bf/klicker-uzh/pull/5524) | U3 | `1392f485870fe76ab25e25531c5b8ad3eb59e907` | Open, ready; current layer |

The four inter-layer parent links match; GitHub marks only the Phase 0 base as
needing rebase because the trunk has advanced. The trunk freshness gap still
requires a guarded five-layer recascade. The official `gh stack push --remote` path is the only planned publication
mechanism because it publishes the linked stack atomically with
force-with-lease protection. No `gh stack sync`, merge, queue, or unstack action
is part of this plan.

## Research and review findings

### Current implementation evidence

- `claimChatTurn` inserts the unique `IN_PROGRESS` assistant message before MCP
  discovery, image description, or provider generation. Duplicate lifecycle
  attempts therefore do not justify another idempotency implementation.
- `isStepCount(5)` already stops tool iteration. The review request for a tool
  ceiling is stale for the current head.
- Account availability is currently always fail-closed. A missing capability,
  missing budget, zero budget, or exhausted budget denies the turn before the
  claim.
- Finalization currently persists the assistant completion and increments the
  effective account row in one transaction. Reliable usage with no effective
  row throws and rolls back completion, so merely skipping the pre-check would
  not preserve legacy service.
- An empty chatbot model allow-list means every registry model. Automatic
  selection resolves to the configured primary, currently `Auto`, which is
  `ADVANCED`.
- New chatbot creation persists `DRAFT` but leaves model policy at schema
  defaults. It creates no MCP binding and leaves the prompt override null, which
  already resolves to the standard tutor prompt.
- Both registry consumers make `maxOutputTokens` optional and warn/fall back to
  built-ins when supplied JSON is invalid. Neither consumer is forced during
  server readiness.
- The account usage mutation accepts an account owner or `ADMIN`. Manage exposes
  owner-editable six-decimal inputs even though the trusted pilot requires
  operations-controlled budgets.
- Manage already queries chatbot status but does not render it. Chatbot details
  render a participant link regardless of status, while Chat correctly rejects
  every non-`PUBLISHED` bot.
- The PostgreSQL account-usage suite is guarded by
  `CHAT_ACCOUNT_USAGE_INTEGRATION=1`. Ordinary `test-chat` CI provides no
  PostgreSQL service and therefore skips the suite.
- The existing lifecycle migration backfilled old chatbots to `PUBLISHED`,
  while account authorization defaults false and usage rows start empty. This
  makes staged activation and inventory mandatory; it does not justify another
  schema migration in this correction.

### External and framework evidence

The official Next.js 16.2.9 instrumentation contract says `register()` runs
once when a server starts and completes before requests are handled. Next.js
awaits the registration promise and propagates a thrown registration error.
Chat can therefore validate its registry through the existing instrumentation
entry before telemetry's disabled early return. Production builds do not run
this startup registration, so parser tests and runtime startup proof remain
separate checks.

No price lookup is needed in this package. U4 already fixed and pinned the
dated Luna/direct-model rates and the user-approved Auto 1/5 approximation.

### User-supplied full-stack review disposition

The review inspected an older divergent head, so every finding was rechecked
against the current stack. Idempotency and tool-cap findings are stale. Staged
enforcement, safe creation defaults, budget ownership and copy, lifecycle
visibility, strict bounded registries, ordinary PostgreSQL CI, and later
operational cutover remain valid. The separate participant-credit race and the
wider reservation/funding/approval-revision program remain valid but are
deferred from today's candidate.

### Required planner pass

The read-only planner returned `DONE_WITH_CONCERNS` and found no unresolved
design question. This plan incorporates every required correction:

| Finding | Disposition |
| --- | --- |
| A default-off flag is not itself a trusted pilot | Terminal is a pilot cutover candidate; live cohort and cutover remain separate |
| Existing bots are affected by global registry rules | Records are not normalized, but the global 4096 ceiling and strict parser apply at runtime |
| “Team-controlled” needs an exact role | Use existing `ADMIN`; add no new role |
| Existing ADR 0020 records lecturer-controlled budgets | Add ADR 0041 and mark ADR 0020 superseded in part |
| `docs/log/` is reserved | Add no docs log; use the plan, ADR, wiki, and roadmap only |
| Per-model cap choice was ambiguous | Require one 4096 cap for every current registry entry |
| Startup validation could invite a new package | Keep both consumers and invoke their existing getters at their current startup seams |

## Resolved decisions

### D1 — candidate, not live pilot

This package prepares the current stack for a trusted-pilot cutover. It does not
make any bot safe merely because code is merged or deployed. Participant
reachability still depends on `PUBLISHED`, and existing published records are
not automatically restricted to the trusted cohort. The later operational
task owns inventory, allowlisting, normalization, provider limits, shadow
reconciliation, and the explicit activation decision.

### D2 — staged account enforcement

Add `CHAT_ACCOUNT_USAGE_ENFORCEMENT_ENABLED`. Missing, empty, or any value other
than the exact string `true` means disabled. The chart and devcontainer declare
false explicitly, and Turborepo includes the variable in its global environment
inputs. This correction never declares true in repository environments.

When disabled:

- skip account capability and budget availability denial;
- keep model-class resolution, participant-credit selection, and participant
  authorization unchanged;
- claim the assistant-message lifecycle before MCP discovery, image
  description, or provider generation;
- persist a completed assistant message even when no effective account usage
  row exists;
- increment a configured effective row when reliable provider usage exists,
  giving operations shadow-accounting evidence; and
- leave existing participant-credit deduction timing and idempotency unchanged.

When enabled, preserve the current fail-closed account capability and budget
pre-check and the current idempotent finalization charge. The monthly budget is
still a soft pre-check: one final turn and concurrent turns can overrun it.
Strict reservation, settlement, and actual routed-cost reconciliation remain
deferred.

### D3 — one bounded registry contract

Every registry entry must contain a positive integer `maxOutputTokens` no
greater than 4096. Every current built-in, STG, and PRD entry uses 4096. A
single invariant avoids unproven model-specific truncation policy; Luna's
low/medium new-bot reasoning policy supplies the tighter pilot default.

A missing external registry continues to use built-in defaults. A supplied
registry with invalid JSON, a missing or out-of-range cap, duplicate IDs,
invalid reasoning metadata, or a Luna/base/fallback policy violation throws in
every environment. Warning-and-fallback behavior is removed. Both built-in
copies must pass their consumer's own parser rather than bypassing it.

Chat invokes its existing getter during `instrumentation.register()` before the
telemetry-disabled return. Backend GraphQL exports and invokes its existing
getter before database migration and `listen`. The two consumers stay separate;
parity tests remain the drift control.

### D4 — safe defaults for new records only

New chatbots persist:

- `status = DRAFT`;
- `modelSelection = false`;
- `allowedModelIds = ['gpt-5.6-luna']`;
- `allowedReasoningEffortsByModel = { 'gpt-5.6-luna': ['low', 'medium'] }`;
- no prompt override, so the standard tutor prompt remains active; and
- no MCP configuration.

Creation must fail if the runtime registry cannot resolve the Luna base entry;
it must not persist an unusable policy. Existing chatbot rows are neither
migrated nor normalized. Owners retain the current post-creation model-policy
editor, so this is a safe default rather than an immutable policy. That mutable
contract is accepted only for the trusted cohort and remains a blocker for wide
participant rollout.

### D5 — ADMIN-controlled budgets with owner visibility

The existing `ADMIN` role is the operations-team authority. No new role or
administrative UI is added. The budget mutation requires `ADMIN` and an
explicit target owner ID; service-level authorization enforces the same rule so
direct calls cannot bypass GraphQL field auth. Account owners keep the existing
read query for their own two usage lanes.

Manage removes the mutation operation, Formik inputs, save button, six-decimal
validation, and success/error mutation copy. It keeps budget, estimated used,
estimated remaining, and reset-date cards. English and German copy says the
values are estimated, the budget is managed by the operations team, and the
displayed limit is not a guaranteed hard spending stop. A reached budget reads
as a planning target reached, not proof that disabled enforcement blocked a
turn.

### D6 — lifecycle status controls link visibility

Manage shows a localized stable label for every current chatbot status in list
and details views. A participant link renders only for `PUBLISHED`. Other states
show a concise explanation that participants cannot open the bot yet. This is
presentation of the existing server contract, not a new lifecycle transition.

Publication approval remains a mutable lifecycle and reachability review. The
owner can still edit model, prompt, knowledge, and tool-related configuration
after publication under current contracts. The UI and ADR must not imply that
publication creates an immutable approved revision.

### D7 — no database migration

No Prisma model changes are required. The final diff must contain zero new
migration directories and no schema-model cleanup. Existing published bots,
account authorization fields, and usage records remain untouched until the
separately authorized operational task.

### D8 — no provider proof in this package

Synthetic runtime proof uses the current Playwright provider mock and seeded
local records. It makes no OpenRouter, Azure OpenAI, or other model-provider
request, spends no credits, and persists no real participant or course data.
The earlier U4 Luna provider proof remains historical evidence, not a reason to
repeat billable traffic for UI and policy corrections.

## Primitive impact and ADR gate

| Primitive | Disposition |
| --- | --- |
| Account AI capability | Preserve the field; enforce it only when staged account enforcement is true |
| Monthly account usage budget | Change write ownership from lecturer to `ADMIN`; retain owner read visibility and soft pre-check semantics |
| Usage accounting | Preserve turn identity and selected-model credit calculation; allow shadow increments without making missing rows fatal while enforcement is off |
| Model registry | Require a 4096 ceiling, fatal supplied-config validation, startup invocation, and consumer parity |
| Chatbot model policy | Persist Luna-only low/medium defaults for new records; leave existing records and the mutable editor unchanged |
| Chatbot lifecycle | Expose existing status and hide participant links outside `PUBLISHED`; add no transition |
| Publication approval | Clarify that approval controls reachability but is not an immutable configuration approval |
| Participant credits | Preserve current behavior; defer the read/write race correction |

The changed staged-enforcement and budget-ownership decision conflicts with the
historical wording in ADR 0020. After rechecking all remote ADR names, 0041 is
the next collision-free identifier. Add
`docs/adr/0041-staged-chatbot-usage-enforcement-and-admin-budgets.md`, link it
from the ADR index, and mark ADR 0020 superseded in part. Do not rewrite ADR
0020 as if the original lecturer-budget decision never existed.

Update `CONTEXT.md`, `docs/chat-platform.md`, `docs/testing.md`, and the roadmap.
The updates must cover the new terms, startup failure behavior, CI service,
soft-budget limitation, mutable publication boundary, and operational cutover
separation. Add no `docs/log.md` or `docs/log/` artifact.

## Feature-wide test portfolio

| Consequential behavior | Test or proof |
| --- | --- |
| Enforcement absent/false does not deny an otherwise valid published participant turn | Route test with mocked provider and no account row |
| Disabled enforcement still claims before MCP, image, and provider work | Existing ordering assertions retained and extended only if needed |
| Disabled enforcement persists the assistant result when no effective usage row exists | PostgreSQL finalization integration test |
| Disabled enforcement increments a configured row from reliable provider usage | PostgreSQL shadow-accounting integration test |
| Enabled enforcement preserves disabled-account, missing-budget, zero-budget, and exhausted-budget denial | Focused route/service regressions |
| Duplicate lifecycle attempts still create one completion and one charge | Existing PostgreSQL idempotency and concurrency cases retained; no duplicate test |
| Participant credits change only for a newly completed finalization | Existing regression retained under both flag states |
| Every built-in, STG, and PRD registry entry has integer cap 4096 in both consumers | Extend registry parity test |
| Invalid JSON, missing cap, cap above 4096, duplicate ID, and base/fallback violation throw | Focused tests for both consumers |
| Chat and backend invoke validation before readiness | Bootstrap tests plus bounded invalid-registry startup proof |
| A new bot persists Luna-only, low/medium, standard-prompt, no-MCP defaults | GraphQL service test using the real Prisma client fixture where available |
| New-bot runtime automatic selection resolves to Luna | Focused registry/selection route test |
| Existing bot rows receive no migration or normalization | Zero-migration diff proof and an unchanged-record regression where the service test already has a fixture |
| Account owner cannot mutate budgets; `ADMIN` can mutate an explicit owner | GraphQL field-auth and direct service-context tests |
| Owners still read their own two lanes; unrelated owners and participants cannot | Existing query authorization regressions retained |
| Manage contains no budget controls and explains estimates/soft limits in English and German | Component/browser assertions and screenshots |
| Every lifecycle state renders a stable localized label | Component or focused data-driven UI test |
| Draft has no participant link and Published has exactly one valid link | Focused host Playwright flow plus browser proof |
| Published configuration remains editable without reapproval | Existing Manage model-policy regression retained and the limitation documented |
| Ordinary `test-chat` runs all PostgreSQL usage cases instead of skipping them | CI service/config inspection and exact-head job evidence |

No live pricing lookup, provider call, production content, or real lecturer or
participant record belongs in the test portfolio.

## Delegation map

| Workstream | Owner | Independence and acceptance |
| --- | --- | --- |
| Stack checkpoint, recascade, implementation, and integration | Main execution orchestrator | One writer and one topology owner; each committed slice passes its checks before the next |
| Plan construction | Native planner, read-only | Completed; all concerns dispositioned in this plan |
| Slice simplification | Dedicated simplifier, read-only | One pass for each substantive immutable slice; advice verified before any correction |
| Risk review | Dedicated slice reviewer, read-only | S1 covers data integrity and staged configuration; S2 covers architecture/startup; S3 covers authorization and participant reachability |
| Integrated readiness | Dedicated final reviewer, read-only | Full accepted stack after producing verification, before remote publication |

Implementation remains in the main session because the five-branch recascade,
account finalization semantics, duplicated registry boundary, GraphQL auth, and
final integration are one critical path. Delegating a write would add a second
writer to the active worktree and stack. Reviewer prompts contain only public
repository paths, synthetic identifiers, and values-free evidence.

## Slices and commits

### S0 — approved correction contract and guarded recascade

- Re-run the freshness gate and compare all five local, remote, and PR heads,
  bases, ready states, and stack order with the identity table.
- Commit this approved plan on the current U4 layer.
- Create local-only recovery refs for every recorded pre-recascade head under a
  task-specific `refs/rs/recovery/2026-08-26-chatbot-pilot/` namespace. Do not
  push the recovery refs.
- Recascade all five existing branches locally onto the fresh `origin/v3` in
  bottom-up order while preserving their linked PR bases.
- Use ancestry and range-diff to prove every Phase 0 through U3 patch is
  unchanged. U4 may differ only by the plan commit at this point.
- Stop on a conflict, lease mismatch, changed lower-layer patch, changed PR
  topology, or evidence of another writer.

Acceptance: the clean current worktree is the U4 tip of the same five-layer
stack on current `v3`; recovery refs resolve; lower-layer patches are unchanged;
and no remote ref moved.

Commit: `docs(project): plan chatbot trusted-pilot finalization`.

### S1 — staged account enforcement and ordinary PostgreSQL CI

- Add the default-off enforcement switch to the Chat runtime, chart defaults,
  devcontainer environment, and Turborepo environment inputs.
- Keep the existing lifecycle claim before billable work under both flag
  states.
- Let disabled enforcement persist completion without an effective usage row
  and shadow-increment a row when one exists. Preserve enabled fail-closed
  behavior and all participant-credit semantics.
- Add the PostgreSQL 15 service and explicit test database setup to
  `test-chat`. Run the Chat suite with the account integration gate enabled so
  the PostgreSQL file has zero skipped suite cases in ordinary CI.
- Update focused route and integration tests for both switch states, missing
  rows, configured rows, exhaustion, duplicate completion, and participant
  credits.

Acceptance: focused route tests and every PostgreSQL integration case pass; the
full Chat suite passes with the account suite enabled; no provider work occurs
before a claim; and no database schema or migration changes.

Commit: `fix(chat): stage account usage enforcement`.

Review: simplifier plus one data-integrity/configuration slice review over the
immutable S1 range.

### S2 — bounded registry and safe new-chatbot defaults

- Require integer `maxOutputTokens` in the range 1–4096 in both existing
  consumers. Set every built-in, STG, and PRD entry to 4096 and parse built-ins
  through the same schemas.
- Remove supplied-invalid-registry fallback. Preserve built-ins only for an
  absent external registry.
- Invoke Chat validation through its instrumentation startup before the
  telemetry early return. Export and invoke backend GraphQL's existing getter
  before migration and listen.
- Persist the Luna-only, selection-off, low/medium reasoning policy during new
  chatbot creation. Preserve the null standard-prompt override and empty MCP
  relation.
- Extend parity, invalid-config, startup, creation, and automatic-selection
  tests. Do not change model IDs, rates, classes, fallback choice, or routing.

Acceptance: both consumers reject each invalid registry case; bounded startup
proof shows neither service becomes ready with invalid supplied JSON; every
declared registry entry has 4096; a new bot persists and resolves the exact
safe policy; and existing rows remain untouched.

Commit: `fix(chatbot): apply bounded pilot model defaults`.

Review: simplifier plus one architecture/configuration slice review over the
immutable S2 range.

### S3 — ADMIN budgets and visible lifecycle boundaries

- Require `ADMIN` on the budget mutation and require an explicit target owner
  ID. Keep the service-layer role check and validate the target account.
- Preserve account-owner reads and the two existing usage lanes.
- Remove Manage's budget mutation operation, editor, validation, button, and
  mutation toasts. Regenerate GraphQL schema, typed operations, and persisted
  artifacts after the argument and client-operation changes.
- Retain the two cards with estimated values and add concise English/German
  explanation of operations ownership, soft targets, and possible in-flight
  overrun.
- Render localized status in chatbot lists and details. Render participant
  links only for `PUBLISHED`, with a non-live explanation for every other
  status.
- Add stable test IDs only where the browser contract needs them. Preserve the
  existing model-policy editor and explicitly test one published edit path.

Acceptance: owner writes fail at GraphQL and service layers; `ADMIN` can mutate
an explicit owner; owner reads remain authorized; no budget form or client
mutation ships; all lifecycle labels render; only Published exposes a
participant link; and English/German desktop and mobile proof has no console or
network errors.

Commit: `fix(manage): constrain chatbot pilot controls`.

Review: simplifier plus one authorization/participant-reachability slice review
over the immutable S3 range.

### S4 — durable decision and operating-boundary documentation

- Add ADR 0041 for staged enforcement, `ADMIN` budget ownership, soft-limit
  semantics, strict bounded registries, and the trusted-pilot cutover boundary.
- Mark ADR 0020 superseded in part and update the ADR index.
- Update `CONTEXT.md`, `docs/chat-platform.md`, and `docs/testing.md` with exact
  current contracts and CI behavior.
- Update this plan and the roadmap `Progress` without claiming merge,
  deployment, activation, or live pilot completion.
- Add no docs log and do not modify AGENTS.md.

Acceptance: terms are consistent across ADR, context, wiki, UI copy, and code;
historical ADR rationale remains readable; all links and Markdown formatting
pass; and no future package is accidentally activated by the roadmap update.

Commit: `docs(chatbot): document trusted-pilot boundary`.

### S5 — integrated proof, reviews, and guarded publication

- Reconcile the exact worktree through `devrouter ensure . --profile full`.
  Run pnpm, Prisma, codegen, checks, and builds inside that exact Node 24
  container. Use the full profile because one proof spans Manage and Chat.
- Run focused Chat and GraphQL tests, the PostgreSQL integration suite, registry
  parity, generated-artifact drift checks, affected package checks/builds,
  `pnpm run check:all`, and the full repository build. Account for an unrelated
  environment blocker without presenting it as a pass.
- Run the focused Playwright flow through the host-configured Playwright CLI
  against the exact devrouter routes. Use the seeded database and Chat provider
  mock. Run mandatory host `agent-browser` validation as a delegated lecturer
  in English and German at desktop and mobile widths.
- Capture the Manage usage copy, Draft/Published status, hidden/visible
  participant link, and safe new-chatbot policy. Capture Chat resolution to
  Luna without making a model-provider request.
- Run the required immutable slice reviews and one final reviewer over the full
  integrated range. Verify and disposition every finding. Apply only in-scope
  corrections and rerun affected checks and reviews.
- Update plan and roadmap `Progress` with producing-run evidence, review
  dispositions, exact candidate head, and explicit withheld actions.
- Re-read remote leases, PR bases, ready states, stack order, and current
  `origin/v3`. Publish only with `gh stack push --remote origin` when every
  identity remains exact. Preserve all five PR URLs, their order, and ready
  state.
- Use one watcher for the five changed exact heads. Require every applicable
  check to finish green or be explicitly accounted as an intentional skip.
  Update existing PR descriptions from exact evidence; do not create a PR.
- Stop the exact runtime with `devrouter stop .`, then verify provider state is
  stopped and the worktree has zero routes. Do not delete the DevPod, worktree,
  branch, or data.

Acceptance: repository checks, synthetic runtime/browser proof, all required
reviews, atomic publication, exact-head CI, PR evidence, clean worktree, and
stopped-runtime proof pass. Any required failure is a stop condition, not a
reason to weaken evidence.

Evidence commit after accepted producing checks and reviews:
`docs(project): record chatbot pilot finalization`.

## Verification matrix

Run Git, `gh`, `gh stack`, devrouter lifecycle, host Playwright, and
`agent-browser` on the host. Run repository Node/pnpm/Prisma commands inside the
exact DevPod.

| Area | Minimum producing check |
| --- | --- |
| Stack safety | fresh fetch, exact lease table, worktree list, ancestry proof, per-layer range-diff, clean status |
| Account runtime | focused route tests plus the complete PostgreSQL account-usage integration file under both switch states |
| Registry | both consumer unit suites, deployment parity, invalid-input matrix, bounded startup proof |
| GraphQL | chatbot creation and account authorization tests, `generate`, generated diff inspection, package check/build |
| Manage | package check/build, focused component assertions where present, host Playwright Draft/Published flow |
| Chat UI | existing focused Chat Playwright flow with provider mock and Luna resolution |
| Repository | formatting, lint, syncpack, `check:all`, full build, diff check, staged secret and personal-data inspection |
| Browser | delegated login; English/German; desktop/mobile; screenshots; console and failed-network inspection |
| Runtime | exact workspace/profile identity, readiness proof, final stop, stopped provider, zero routes |
| Delivery | immutable review reports, atomic stack publication, exact five PR identities, exact-head CI, refreshed PR evidence |

No new migration is expected. Before every commit, prove migration count is
unchanged, inspect staged generated files, run gitleaks through the configured
hook or equivalent, and verify no real names, emails, participant IDs, raw chat
content, secrets, connection strings, or provider keys are staged.

## Risks and stop conditions

- **Legacy published reachability:** old records were backfilled to Published.
  Code readiness is not cohort restriction. Keep enforcement false and defer
  live cutover until the operational inventory matches the allowlist.
- **Soft budget overrun:** enabled pre-checks do not reserve credits. UI and ADR
  must say so; provider hard caps belong to the cutover task.
- **Mutable published policy:** safe creation defaults can be edited. Accept
  only for trusted operations-assisted pilots; immutable approvals remain a
  wide-rollout blocker.
- **Registry startup outage:** strict parsing deliberately prevents readiness on
  bad supplied configuration. Helm/parity tests and a rollback to the last
  valid config are required before later activation.
- **Completion rollback:** disabled enforcement must not let a missing usage row
  undo an assistant completion. PostgreSQL proof is mandatory.
- **Stack rewrite:** recascade changes five published SHAs. Recovery refs,
  range-diff, exact leases, atomic force-with-lease publication, and a sole
  writer are mandatory.
- **Schedule:** completion today assumes conflict-free recascade, a healthy
  local runtime, terminal review routes, and healthy CI queues. A failure pauses
  the package rather than broadening scope or lowering evidence.

## Separate operational cutover task — proposed, not authorized

Start only after the five PRs are merged and the corrected code is deployed
with enforcement still false. This task requires its own explicit authority for
each environment and every write.

1. Perform a values-free inventory of currently Published chatbot owners,
   account capability, current-month usage rows, model policy, prompt override,
   and MCP bindings. Do not inspect participant text or provider payloads.
2. Select an explicit trusted cohort. Provision capability and current-month
   usage targets only for those owners. Normalize only allowlisted pilot bots to
   Luna, model selection off, low/medium reasoning, standard prompt, and no MCP.
3. Configure and verify a provider-level hard cap, then compare shadow usage
   against provider aggregates without exposing secret or participant data.
4. Stop on any inventory, normalization, funding, or provider mismatch. Keep
   enforcement false until the user separately authorizes the exact activation
   write.
5. After explicit activation authority, enable enforcement for the named
   environment, run a bounded synthetic smoke, and retain a rollback that sets
   the flag false without removing the publication gate.

Deployment, inventory reads, data normalization, provider-cap writes, flag
activation, and live smoke are distinct authority boundaries even when they are
performed in one later operational package.

## Deferred follow-up packages

| Package | Roadmap relationship | Why it stays out of this stack |
| --- | --- | --- |
| Immutable approved revisions for prompt, model, tools, and sources | M2 C1/C4 and M5 G2/G4 — compiler, publication UI, custom revisions, and review queue | Requires versioned data and approval semantics, not a safe default |
| Reservation and durable actual-cost reconciliation | New usage-accounting package after U2/U4 | Needed for strict spend control and Auto routed-cost truth; current provider usage is selected-model accounting |
| Funding ceilings, team budgets, per-bot allocations, forecast, and increase requests | New operating-model package after the trusted pilot | Requires product and finance contracts beyond two account lanes |
| Participant-credit atomic decrement plus input, image, rate, and concurrency bounds | New runtime-hardening package | Crosses data-integrity and abuse-control seams unrelated to pilot visibility |
| Wide participant rollout proof and release decision | After the preceding packages and M2/M5 | Requires immutable approval, strict spend control, load evidence, provider reconciliation, and an explicit release ruling |

These are proposed future tasks, not registered W-items and not implementation
authority. The active roadmap may reconcile them through its normal Phase 5
process only when their dependencies and user authority exist.

## Progress

- 2026-08-26: freshness established the clean U4 worktree at
  `1392f485870fe76ab25e25531c5b8ad3eb59e907`, exact upstream parity, the same
  five open ready PRs, and current `origin/v3` at
  `61a7f8108477a58595505d97618d68f3eeb35aff`. The stack is five trunk commits
  behind and requires a guarded recascade before implementation publication.
- 2026-08-26: the user-supplied review was rechecked against current code.
  Provider idempotency and the five-step tool cap are already present; staged
  enforcement, safe defaults, ADMIN budgets, lifecycle visibility, strict
  bounded registries, PostgreSQL CI, and a separate operational cutover remain
  valid.
- 2026-08-26: official Next.js 16.2.9 evidence confirms startup instrumentation
  completes before request handling and propagates registration errors. The
  read-only planner returned `DONE_WITH_CONCERNS`; all concerns are incorporated
  through the candidate-not-live terminal, ADR 0041, existing `ADMIN` role,
  global 4096 cap, existing-consumer startup seams, and reserved-docs handling.
- 2026-08-26: Gate 1 is pending. No plan commit, recovery ref, recascade, code
  change, runtime start, remote publication, merge, deployment, live write,
  provider call, enforcement activation, or cleanup has occurred under this
  proposal.
