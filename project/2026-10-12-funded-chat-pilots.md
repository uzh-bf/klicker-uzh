# Admit funded chat pilots without a billing cost center

## Approval summary

An AI-enabled account with an explicit advanced-model allowance currently cannot use that allowance unless it also has a billing cost center. Platform-funded pilots intentionally have no cost center. Reuse the operations-managed monthly allowance as their funding grant, preserving the account AI approval and all participant/course access checks.

Extend advanced-class entitlement to accept either a nonblank cost center or an explicit positive advanced allowance. For a pilot without a cost center, always check that allowance has remaining credit before inference, including when general account-usage enforcement is disabled. Preserve existing billed-account and base-class rollout behavior, monthly carry-forward, usage accounting, and participant-credit fallback. No schema, billing identifier, default advanced grant, usage reset, or new configuration is needed. This remains admission checking, not a reservation: final-turn and concurrent overruns and missing-usage accounting limitations remain as documented in ADR 0041. Unmetered owner preview retains its existing cost-center requirement; funded pilots use the metered course/student route. Opening advanced owner preview requires a separate accounting change and is outside this correction.

The user authorized platform-funded pilots, a scoped allowance update, the video PR merge after CI, production release, and full student-flow verification. This correction supports that approved sequence. Source review and required CI remain blocking. Completion requires admission and denial regressions, consistent account projection, the qualified production release, and a synthetic student conversation through the deployed route. Existing test-spend limits remain binding and are separate from account allowances.

## Execution details

Baseline: `b35104f97aab070388559c65da0ffdf1455dc70b`, target `v3-ai`.
Worktree: `trees/release-alpha87`, branch `fix/funded-chat-pilots`.
Execution mode: standard. Full path because admission crosses an entitlement and spending boundary. Main session owns the coupled policy, release effects and live proof; independent reviewers own plan challenge and source review. No additional executor is needed for the small coupled policy edit; it spans one shared predicate and its three consumers.

### Primitive impact

| Product primitive | Disposition | Contract delta | Consumers / evidence |
| --- | --- | --- | --- |
| Account AI approval | Reuse | Required for every class | User flag, usage service and chat route |
| Monthly account allowance | Compose | Existing operations-only advanced grant funds an unbilled pilot; remaining allowance required for each admission | Effective monthly usage, chat route, account overview |
| Billing cost center | Reuse | Identifies billed accounts; intentionally absent for funded pilots | Shared entitlement predicate and account projection |

### Implementation and verification

One substantive slice changes `packages/util/src/chatUsage.ts`, `apps/chat/src/services/accountUsage.ts`, `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`, `packages/graphql/src/services/chatAccountUsage.ts`, `apps/chat/test/account-usage.test.ts`, `apps/chat/test/account-usage-route.test.ts`, `packages/graphql/test/chatAccountUsage.test.ts`, and the affected policy paragraphs in `docs/chat-platform.md`. Use a default-false explicit allowance parameter in the shared entitlement predicate. Derive it from a positive effective allowance, never from subscription tier or the account AI flag alone. The existing synchronous class rejection must move behind the async availability decision: the route checks usage whenever enforcement is enabled or the shared predicate cannot admit the class without a funding grant. The earlier AI approval guard remains. Availability uses the effective positive allowance and remaining credits and denies on lookup failure. Cost centers use the same trimmed interpretation throughout. An AI-disabled account is denied before tools, persistence, or inference.

| Risk | Test obligation | Primary seam / acceptance |
| --- | --- | --- |
| Funded pilot is still blocked | extend existing | Service and route admit advanced use with positive remaining allowance and no cost center, enforcement both on/off |
| Unfunded or exhausted pilot incurs charges | extend existing | Missing, zero or exhausted allowance, failed lookup and withdrawn AI approval deny before tools/inference |
| Existing accounts regress | extend existing | Billed advanced and base behavior retain enforcement-switch semantics; participant fallback uses effective selected class |
| Account UI disagrees with runtime entitlement | extend existing | GraphQL projection exposes advanced entitlement with positive allowance while remaining credit independently reflects exhaustion |
| Carry-forward or usage counters change | none | Effective usage and finalization tests remain passing; no mutation to those implementations |

### Delegation Map

Main owns the single coupled implementation slice above. Acceptance is the following test portfolio and exact diff review; stop before unqualified source merge, unmetered preview expansion or a new billing/storage concept. Plan and immutable-source reviewers have read-only scopes.

Run `pnpm --filter @klicker-uzh/util build`, then `pnpm --filter @klicker-uzh/chat exec vitest run test/account-usage.test.ts test/account-usage-route.test.ts test/owner-preview-route.test.ts` and the GraphQL `test/chatAccountUsage.test.ts` via its disposable test database in the existing exact-path managed runtime. Run chat/util/GraphQL typechecks. Extend existing cases for whitespace cost centers, lookup failure with enforcement off, carried-forward grants and newer zero grant precedence; the existing GraphQL test file already exercises effective usage. Owner-preview source at `apps/chat/src/app/api/manage/chatbots/[chatbotId]/preview/chat/route.ts` and `apps/chat/test/owner-preview-route.test.ts` are read-only regression evidence for the intentional unmetered-preview limitation. Browser verification uses synthetic users and the actual student route; no visible component changes require a new screenshot gallery for this policy slice. Retain the video renderer gallery from its own PR. Review the immutable slice for data integrity, fail-closed admission, compatibility and maintainability. Generate release versions only with the repository release scripts after source integration and required CI.

Rollback uses an ordinary source revert and the prior release pins. Reverting the policy blocks unbilled pilots again but does not alter allowances or counters. Readiness never implies provider calls or live rollout succeeded; capture those receipts separately in private execution notes.

## Progress

- Native planner approved round 2 after clarifying ordering, preview scope, executable coverage and budget limitations. Optional AGY plan challenge also approved.
- Implemented and simplified in `31f9207acf` and `3bd4b56d72`: allowance availability directly combines AI approval, positive budget and remaining credit. Scope is 9 public source/test/doc paths; no live account data committed.
- Verification: 85 focused chat/preview tests, 22 disposable GraphQL database tests, all 42 repository typecheck tasks, seven repository lint tasks and 40 host launcher tests pass. Chat tests and types passed again after simplification. Staged data-hygiene scan found no leaks.
- Scoped Opengrep findings and Biome import-order/warnings are pre-existing; unrelated formatter changes were restored. Host hooks could not resolve checkout-local tooling and used an older devrouter; equivalent checks ran explicitly in the container and on the host. Hosted image builds remain required.
- Independent slice review found no defects. Final Claude review of `b35104f97a..3bd4b56d72` found no code defects and requested only this progress update. Source reviews do not establish deployed acceptance.
- [Draft PR #6488](https://github.com/uzh-bf/klicker-uzh/pull/6488) targets `v3-ai`. Required CI, video integration, release and live student-flow acceptance remain pending. Video PR CI is queued for an unavailable runner; the existing production Argo login is expired.
- Exact runtime stopped, provider `Stopped`, zero task routes verified; synthetic browser closed. Next action after CI capability is restored: qualify both source changes, complete the approved release chain and verify the deployed student flow.
