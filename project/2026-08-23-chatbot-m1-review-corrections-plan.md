# M1 chatbot usage review corrections

Status: Approved at Gate 1 on 2026-08-23
Execution owner: roadmap orchestrator task
`01a025c3-ba1c-7013-90cf-a5ff78651c3b`; it is the sole writer
Delivery target: the existing four open, ready GitHub pull requests, ending at
the ready-for-review handoff
Withheld: merge, deployment, live traffic, pull-request closure, cleanup,
deletion, secrets, and every roadmap item outside M1

## Goal and terminal condition

Restore a truthful M1 ready-for-review stack after the full-stack Claude Opus
review found three change-introduced defects. Configured BASE and ADVANCED
limits persist until a lecturer changes them, only used credits reset at each
Europe/Zurich month boundary, participant credits are deducted only for a
successfully created finalization, and the ADR index is complete.

The package is complete only when all four corrected branches are linear,
locally verified at their own heads, accepted by the required Ox Alpha reviews,
atomically republished under exact force-with-lease guards, proven by exact-head
CI, reflected in the existing pull-request evidence, and accepted through
serialized Phase 5. The pull requests remain open and ready; no landing or live
action is part of this plan.

## Freshness and controlling evidence

The 2026-08-23 freshness gate fetched `origin` before this plan was written.
The task worktree was clean on `rs/chatbot-u3-usage-lanes`. `origin/v3` was
`ee5712399fcda479422a61b78004a1cb3b0636e9`; the top branch was 59 commits
ahead and 2 behind. The current published leases are:

| Layer | Branch | Published head | Pull request |
| --- | --- | --- | --- |
| Phase 0 | `feat/chatbot-lecturer-config-phase0` | `d55996d82590cdeaf3335ca32be8b5be853d9441` | #5460 |
| U1 | `rs/chatbot-u1-usage-foundation` | `b29c628edef80ea028367db7ea8610ad4db1ac29` | #5475 |
| U2 | `rs/chatbot-u2-runtime-charging` | `930f927465dfcae8939a09205f303a11c6266f4c` | #5480 |
| U3 | `rs/chatbot-u3-usage-lanes` | `d386d1644c1b85e35e962ea15992656a4b320181` | #5490 |

The two new `v3` commits are explicitly dispositioned. `e2f1bee2c` adds the
assessment participant-invitation feature and changes generated GraphQL
manifests, shared translations, manage-app surfaces, and Prisma inputs that
intersect files or generators used by this stack. `ee5712399f` is its deploy-
only staging promotion. Therefore execution must first recascade Phase 0
through U3 onto this exact `origin/v3`, verify the old-to-refreshed range diffs,
and regenerate affected GraphQL outputs before applying a correction. The
published lease expectations remain the frozen heads in the table.

The accepted findings are recorded in
`project/_local/reviews/2026-08-23-m1-full-stack-claude-opus-final.md`.
The Ox Alpha planning cross-check returned `DONE_WITH_CONCERNS`. Its Phase 0
documentation concern is covered by the user's corrective authority. Its
suggested browser waiver is rejected because this change alters a
lecturer-visible GraphQL state and repository rules require browser evidence.

Current Prisma documentation confirms that a compound primary key can use a
database-native PostgreSQL upsert, and that arithmetic updates should use
atomic number operations. The implementation must still prove the generated
Prisma 7.8 behavior with the concurrent PostgreSQL integration test; a unique
constraint race is handled by one bounded retry only if that proof shows the
client-side upsert path.

## Binding decisions and product contract

The affected product primitive is the existing monthly usage budget. It is
clarified, not replaced:

- The lecturer-configured BASE and ADVANCED limits are durable settings. Each
  persists until an authorized lecturer changes it.
- Usage periods remain Europe/Zurich calendar months. `usedCredits` starts at
  zero in a new month while the latest configured limit carries forward.
- An owner and usage class with no configuration history has an effective
  limit of zero and remains fail-closed before provider work.
- The current-month row, when present, is authoritative for both limit and
  usage. Otherwise the latest earlier row supplies only the limit; effective
  usage is zero.
- Participant credits are decremented if and only if finalization returns
  `outcome: created` with positive, non-null rounded credits. Duplicate,
  conflict, and failed finalization never deduct participant credits.

No background reset job, new configuration table, migration, backfill, new
usage class, or new provider/funding surface is introduced.

## Stack plan

```yaml
feature: M1 chatbot usage review corrections
provider: github
base: v3
mode: progressive

layers:
  - id: phase0
    name: feat/chatbot-lecturer-config-phase0
    work_package: Correct the governing monthly-budget contract and ADR index
    responsibility: ADR 0020, shared context, and complete ADR discovery
    depends_on: v3
    reviewer: chatbot architecture and documentation maintainers
    attention: judgment-heavy
    reviewer_focus:
      - Does the written contract distinguish durable configured limits from monthly usage reset?
      - Does the ADR index list every existing record and document all duplicate numbers?
    validation:
      - repository Markdown formatting
      - exact diff and link/path inspection
    activation: complete
    risk: low
    size_signal: about 20 human-authored lines across 3 files

  - id: u1
    name: rs/chatbot-u1-usage-foundation
    work_package: Provide one shared effective-month resolver without changing storage
    responsibility: latest-limit carry-forward, current-month precedence, and schema comment accuracy
    depends_on: phase0
    reviewer: Prisma and data-integrity maintainers
    attention: judgment-heavy
    reviewer_focus:
      - Is one indexed latest-row lookup sufficient and fail-closed for never-configured lanes?
      - Can both PrismaClient and transaction clients consume the helper without a new abstraction layer?
    validation:
      - focused resolver tests
      - Prisma package generate, check, and build
      - Chat package test and check for the helper consumer test
    activation: inert
    risk: medium
    size_signal: about 100 human-authored lines across 5 files

  - id: u2
    name: rs/chatbot-u2-runtime-charging
    work_package: Enforce carried limits and make finalization charging outcome-safe
    responsibility: runtime precheck, race-safe first-period materialization, and participant deduction invariant
    depends_on: u1
    reviewer: Chat runtime, concurrency, and data-integrity maintainers
    attention: judgment-heavy
    reviewer_focus:
      - Does the precheck still fail before provider work and deny never-configured lanes?
      - Do concurrent first charges preserve the configured limit and sum every charge exactly once?
      - Can any duplicate, conflict, or finalization error still deduct participant credits?
    validation:
      - focused route unit tests
      - opt-in PostgreSQL account-usage integration tests
      - Chat test, check, and production build
    activation: complete
    risk: high
    size_signal: about 140 human-authored lines across 4 files

  - id: u3
    name: rs/chatbot-u3-usage-lanes
    work_package: Project the carried limits consistently to the lecturer and close the package evidence
    responsibility: GraphQL projection, rollover tests, manage-browser proof, wiki, plan, roadmap, and review evidence
    depends_on: u2
    reviewer: GraphQL authorization, manage UI, and roadmap maintainers
    attention: judgment-heavy
    reviewer_focus:
      - Do both lanes show the latest configured limit with zero new-period usage and the correct reset date?
      - Do mutation, rollover, authorization, and hidden-funding boundaries remain intact?
      - Does the final evidence identify exact heads and preserve every withheld boundary?
    validation:
      - focused PostgreSQL and GraphQL tests
      - GraphQL generation with zero drift
      - GraphQL and manage checks/builds
      - mandatory delegated-login browser proof in English and German at desktop and mobile widths
      - repository check, build, formatting, and Playwright discovery
    activation: complete
    risk: medium
    size_signal: about 160 human-authored lines across 7 files, plus regenerated operations only if generation changes

follow_up_stacks: []
```

The topology is unchanged. The small Phase 0 and U1 corrections remain real
work packages because they own governing documentation and the shared data
semantics respectively; folding either upward would leave a lower reviewed
layer incorrect. Tests stay with the behavior they protect. No correction-only
fifth layer is allowed.

## Implementation design

### Effective-month resolver

Add one small exported data-access helper to `@klicker-uzh/prisma`. It accepts a
Prisma client or transaction client, owner, usage class, and an injected month
start. It selects the latest row at or before that month using the existing
compound primary-key prefix. It returns the exact row unchanged when its month
matches. For an earlier row it returns the carried `budgetCredits` with zero
effective `usedCredits`. With no row it returns no effective configuration.

Keep Europe/Zurich date calculation in `@klicker-uzh/util`; the helper accepts
the already-derived month boundary. Update the Prisma source include/export and
the existing schema comment, but do not edit the model or migration.

### Runtime precheck and finalization

The runtime precheck retains the live account-capability check and then reads
the effective window. It returns false for a missing owner, disabled capability,
missing configuration, zero limit, or exhausted effective window. The route
still performs this check before thread, image, MCP, or provider work.

Inside the existing finalization transaction, read the carried limit and use a
compound-key upsert for the current month. Its update path atomically increments
only `usedCredits`. Its create path writes the carried limit and the first
rounded charge. Concurrent creation must resolve through PostgreSQL
`INSERT ... ON CONFLICT DO UPDATE`; the integration test is the acceptance
proof. If Prisma 7.8 does not emit that native path, catch only the compound-key
unique race and retry one current-row atomic increment. Do not broaden retries
to message-id conflicts or unknown failures.

Initialize route-level participant credits to no charge. Assign them only when
finalization returns `created`; keep them unset for `duplicate` and every
exception. The existing positive-value guard remains the last decrement gate.

### GraphQL projection and mutation

Resolve the authorized owner first, then use the same helper for BASE and
ADVANCED. Projection preserves the current outer-null, authorization, reset
date, non-negative remaining balance, and hidden-funding contracts. The budget
mutation remains a two-row current-month transaction and continues to preserve
current-month `usedCredits`; writing a new month naturally becomes the newest
configured value.

No UI component or persisted operation shape changes. The lecturer-visible
values do change at rollover, so browser validation seeds only synthetic local
prior-month rows, leaves the current month absent, and proves both lanes carry
their limits with zero used credits and the expected reset date. Restore the
synthetic state after capture.

## Execution slices and commit boundaries

1. **S0 — plan and control reconciliation.** Keep this plan on U3, add the
   M1-R1 correction transaction to the roadmap by compare-and-swap, map control-
   ledger rulings `M1-Q3` and `M1-A7` to roadmap decisions A6 and A7, and obtain
   the exact-file Ox Alpha planning verdict plus Gate 1 approval. Commit only
   after approval.
2. **S1 — base refresh and Phase 0 contract correction.** Create recovery refs,
   recascade the unmodified four-layer stack onto the exact current
   `origin/v3`, and prove each refreshed patch by range-diff. Then check out
   Phase 0, update ADR 0020, `CONTEXT.md`, and `docs/adr/README.md`, format and
   inspect, and commit `docs(chatbot): clarify monthly usage budgets`.
3. **S2 — U1 shared effective window.** Recascade U1 onto corrected Phase 0,
   add and export the resolver, correct the schema comment, add focused tests,
   verify, run Ox Alpha simplifier and data-integrity review, apply verified
   fixes, then commit `fix(chatbot): carry usage budgets across months`.
4. **S3 — U2 runtime correction.** Recascade U2, update precheck, finalization,
   and route deduction gating with their focused tests, prove the PostgreSQL
   race, verify the package, run Ox Alpha simplifier and risk review, apply
   verified fixes, then commit `fix(chatbot): preserve rollover charging`.
5. **S4 — U3 projection and evidence.** Recascade U3, invert the stale
   prior-month test, add rollover/mutation coverage, update the wiki and plan
   Progress, run generated-operation and package checks, complete mandatory
   browser proof, run Ox Alpha simplifier and risk review, apply verified fixes,
   then commit `fix(chatbot): project persistent usage budgets`.
6. **S5 — integrated verification and review.** Run the repository matrix in
   the exact DevPod, stop and prove the runtime stopped, then obtain one Ox
   Alpha integrated final review over the complete corrected stack range.
   Correct findings in their owning layers and repeat affected checks/reviews.
7. **S6 — serialized Phase 5 and publication.** Review Phase 0, U1, U2, and U3
   in dependency order against their frozen pre-correction heads. Record the
   accepted compare-and-swap results in one top-layer roadmap Progress commit.
   Re-fetch, verify exact remote leases and unchanged pull-request bases, then
   atomically force-with-lease publish all four branches. Preserve ready state,
   refresh each pull-request description from verified evidence, observe every
   exact-head CI result with one watcher at a time, and publish one final
   evidence-only top commit only if required. Account for that commit's own CI
   before restoring the ready-for-review handoff.

Only the orchestrator task writes. Ox Alpha planning, simplification, risk,
final, and Phase 5 passes are read-only and serialized around immutable commit
ranges.

## Test portfolio and verification

Add only tests that protect the newly clarified behavior:

- Resolver: current row wins; latest prior row carries only the limit; no
  history stays unconfigured; an injected Zurich boundary is deterministic.
- Runtime PostgreSQL: prior-month limit allows a current-month turn; first
  materialization starts from zero usage; concurrent first charges sum exactly;
  no configuration fails closed; message and account charge remain atomic.
- Route: created finalization may deduct; duplicate, conflict, and a generic
  finalization error never deduct participant credits.
- GraphQL: the former "ignore prior month" assertion becomes carry-forward;
  both lanes reset usage; mutation in a later month replaces the carried limit
  without exposing funding or changing authorization.

Use the repository's Node 24 toolchain inside the exact devcontainer. The
focused commands are resolved from the affected package scripts at execution
time. The minimum full matrix is Prisma generate/check/build, Chat focused and
full tests/check/build, GraphQL focused tests/generation/check/build, manage
check/build, `pnpm run check:all`, `pnpm run build`, format check, and Playwright
typecheck/discovery. Any already-recorded environment exception must be
reproduced and identified; it cannot be relabeled as a pass.

Browser proof uses `agent-browser`, delegated local credentials, synthetic
data only, and the exact worktree route. Capture the rollover state in English
and German across desktop and mobile widths. Confirm both lane limits, zero
used credits, full remaining credits, the current reset date, no console error,
and unchanged owner-only controls. Stop the exact runtime afterward.

## Review and evidence gates

- Data-integrity risk review is mandatory for S2 and S3. GraphQL authorization
  and lecturer-visible semantics arm the S4 risk review.
- Each substantive committed code slice gets a separate Ox Alpha simplifier.
- One Ox Alpha integrated final review runs only after all layers and the full
  local matrix are immutable.
- Native encrypted child delivery is not a valid Ox Alpha result in this task.
  Use the already-qualified plaintext local OpenCodex route, record the routed
  model, scope, effort, immutable range, verdict, and any fallback explicitly.
- Phase 5 acceptance requires exact contract, result, evidence, scope-drift,
  open-question, and dependency reconciliation for each layer. An elapsed wait,
  green top layer, or successful push never substitutes for a layer verdict.

## Publication and rollback

Before the first correction commit, create local recovery refs for the four
published heads listed above. Before publication, fetch again and read remote
heads with `git ls-remote`; every lease must still equal the frozen value. Verify
linear ancestry and range-diff each layer against its prior published patch.

Publish all four named branches in one `git push --atomic` with one explicit
`--force-with-lease=<branch>:<old-head>` per branch. Abort before any remote
mutation if a lease, base, pull-request state, stack membership, or local range
diff differs. A post-push failure does not authorize an automatic rollback;
report exact remote heads and request authority if restoring published history
becomes necessary.

## Exclusions and stop conditions

Out of scope: registry changes, schema migrations, backfill, participant-credit
migration, cost-center or provider surfaces, new analytics, A5 fixture-history
rewrites, merge, deploy, live proof, closure, and cleanup.

Return to the user only for a topology change, a changed public contract, an
unresolvable stack conflict, a failed exact lease, a new external effect, or a
review finding whose correction exceeds this plan. Ordinary layer corrections,
reviews, recascade, approved publication, CI observation, PR evidence refresh,
and Phase 5 proceed without another approval.

## Progress

- 2026-08-23: Draft created from the verified Opus findings, the user's control-
  ledger rulings M1-Q3 and M1-A7 mapped to roadmap decisions A6 and A7, current
  remote heads, current Prisma guidance, and the Ox Alpha construction pass.
  The exact-file Ox Alpha review returned `PASS_WITH_CORRECTIONS` and
  `DONE_WITH_CONCERNS`; its A7 traceability, literal `--atomic`, and base-drift
  disposition corrections are incorporated. No implementation, branch
  rewrite, push, or pull-request mutation has started.
- 2026-08-23: The user approved the exact plan. A fresh fetch confirmed
  `origin/v3` remains `ee5712399f`; all four local and remote branch heads still
  equal their frozen leases; PRs #5460, #5475, #5480, and #5490 remain open,
  ready, and mergeable with unchanged bases. S0 commit and the approved base
  recascade are next.
