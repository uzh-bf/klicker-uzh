# Chat Account Usage Feature Flag Plan

## Goal

Prepare one independent PR against current `v3` that releases the existing
account-usage settings UI safely behind a typed, default-off feature flag. Both
the browser surface and the GraphQL read path must fail closed, and flag changes
must reach long-running backend processes without a restart.

## Settled contracts

- Feature key: `chat-account-usage`.
- The default is false in every environment.
- When false, the settings page does not mount the account-usage component and
  sends neither of that component's login-scope or usage GraphQL queries.
- After normal caller and owner authorization, the GraphQL account-usage read
  returns `null` without querying usage data when the evaluator is absent,
  uninitialized, stale, or evaluates false.
- Account owners and administrators retain their existing authorization rules
  after the feature gate passes.
- Administrative budget mutation, internal metering, and account enforcement
  are not disabled by this visibility flag.
- Backend flag data refreshes through bounded polling with the existing
  GrowthBook dependency. Do not add an EventSource dependency or a production
  force-on escape hatch.
- The Node evaluator accepts only a valid HTTPS SDK host. Missing, malformed,
  or cleartext hosts are unconfigured and cause no feature-payload request.
- The default refresh interval is 30 seconds and a payload becomes unusable
  after 120 seconds without a successful refresh.

## Non-goals

- Do not change account budgets, credit calculations, metering, or enforcement.
- Do not add the `v3-ai` beta-signup mutation or its user-state fields.
- Do not port the broad `v3-ai` AI feature surface, forced-on flags, element
  generation runtime, or unrelated GraphQL context changes.
- Do not mutate GrowthBook configuration or enable the flag.
- Do not add a Prisma migration.
- Do not deploy or modify the existing chatbot authoring stack.

## Plan identity and authority

- Plan path: `project/2026-08-30-pr-5693-chat-account-usage-flag-plan.md`
- Branch: `rs/chat-account-usage-flag`
- Target branch: `v3`
- Base: `origin/v3` at
  `afba9120512cdd6d6ba43cc87997520a3a0d0a1a`
- Worktree: `trees/rs/chat-account-usage-flag`
- Delivery: update PR #5693 targeting `v3` at the exact passing branch head
- Current authority: the approved implementation, one integration of current
  `origin/v3`, in-scope corrections, checks, required reviews, conventional
  commits, a normal push of this branch, and PR evidence reconciliation
- Completed authority boundary: current `origin/v3` was integrated once in
  merge commit `0c56eefb1adb6c91cba61f0cf10990f4145eb511`
- Withheld actions: another upstream integration, force push, merge,
  deployment, GrowthBook mutation or feature activation, and cluster or
  staging changes

## Current findings

- The settings page mounts `ChatAccountUsageSettings` unconditionally.
- The component first queries login roles and then loads account usage for an
  account owner.
- The feature-flag package has one typed browser/server contract and a
  fail-closed initial state, but `v3` does not instantiate its Node evaluator
  in the GraphQL backend.
- The GraphQL read enforces owner/admin scope but has no feature gate.
- The Node client exposes manual refresh but has no polling lifecycle or stale
  payload bound.
- Official GrowthBook guidance requires an additional EventSource dependency
  for Node streaming. Bounded polling uses the existing SDK and is sufficient
  for this default-off release control.

## Product and architecture decisions

- The affected primitive is a capability-gated visibility surface, not a new
  account or billing model.
- Browser gating prevents discovery and unnecessary requests. Server gating is
  the authority boundary and prevents direct GraphQL access.
- Reuse the existing feature-flag package and selectively align its Node
  lifecycle with `v3-ai`; do not copy `v3-ai` forced-on behavior.
- No ADR is required because this applies the existing feature-flag contract
  without changing domain ownership.
- Update `docs/feature-flags.md` and the GraphQL API wiki. Avoid the Chat wiki
  to keep this sibling PR independent from release hardening.

## Planning-stage review

- Reviewer: Sol planner `Hypatia`, read-only, on the exact current base.
- Verdict: `DONE_WITH_CONCERNS`.
- Accepted findings:
  - GraphQL context may expose an optional evaluator to avoid broad fixture
    churn, but both real HTTP and WebSocket context builders must supply the
    process-level client.
  - Authorization stays before feature evaluation, and feature evaluation stays
    before owner usage reads.
  - Administrative mutation, metering, publishing capability, and enforcement
    remain independent.
- No planning concern requires another product decision.

## Execution slices

### Slice 1: Commit the approved plan

Do:

- Incorporate the planning review and final user rulings.
- Commit only this plan after explicit approval.

Commit:

- `docs(project): plan account usage feature gate`

### Slice 2: Make the server evaluator long-lived and fail closed

Do:

- Add the typed `chat-account-usage` contract with a false default.
- Give the Node flag client a bounded polling lifecycle, a maximum payload age,
  request deduplication, and cleanup.
- Retain the last successful payload only within the freshness bound; evaluate
  false before initialization, after the bound, or after destruction.
- Instantiate and fail-closed initialize one backend evaluator before serving,
  then pass it through HTTP and subscription GraphQL contexts.
- Shut it down with the backend process.

Check:

- Package tests cover successful initialization, refresh, transient failure,
  stale fail-closed behavior, overlapping refreshes, and cleanup.
- Existing browser-client tests remain green.
- No new dependency or force-on environment variable appears in the diff.

Commit:

- `fix(feature-flags): refresh backend evaluations safely`

### Slice 3: Gate the GraphQL read and settings UI

Do:

- Add one reusable fail-closed GraphQL feature-gate helper.
- Preserve caller and owner/admin authorization, then evaluate
  `chat-account-usage` before any account-usage data query. Return `null`
  when the gate is unavailable or false.
- Gate the settings component before it mounts.
- Keep administrative budget mutation, metering, and enforcement paths
  unchanged.
- Update the feature-flag and GraphQL wiki contracts.
- Update the relevant GraphQL/frontend skill guidance.

Check:

- GraphQL tests prove a missing, false, or stale evaluator returns `null`
  before the service reads usage data; a true evaluation preserves owner/admin
  behavior.
- Cross-owner access remains forbidden even when the flag is false.
- Tests prove administrative mutation remains available under its existing
  authorization.
- Frontend tests prove the false path does not issue the usage query.

Commit:

- `feat(manage): gate chat account usage settings`

### Slice 4: Browser proof, integrated review, and draft PR

Do:

- Start only the supported local runtime needed for browser verification.
- Use delegated login and synthetic seeded users.
- Capture the settings page with the flag false and true, and inspect requests
  to prove the usage query is absent when false.
- Stop and verify the exact runtime after browser checks.
- Run package tests, GraphQL tests, frontend checks, `pnpm run check:all`, and
  the production build.
- Complete required simplifier, risk-focused slice, and final reviews.
- Inspect for secrets, personal data, generated churn, and unrelated changes.
- Push this branch and open one draft PR targeting `v3`.

Check:

- The draft PR contains source and local browser evidence only.
- GrowthBook remains unchanged and the production default remains false.

## Test portfolio

| Risk | Smallest observing check |
| --- | --- |
| Unknown flag or missing evaluator | Feature package and GraphQL unit tests |
| Stale true payload | Fake-timer Node client test crossing the freshness bound |
| Context omission | HTTP and subscription context construction tests or direct schema execution |
| Direct GraphQL bypass | Service/query test proving null before usage data access |
| Authorization concealment | Cross-owner request remains forbidden while false |
| Hidden UI still queries | Component test and browser request inspection |
| Existing administration breaks | GraphQL mutation authorization regression test |
| User-visible states | Delegated-login browser screenshots with false and true payloads |

## Rollout contract

1. Before deployment, have the secret owner confirm without exposing values
   that `GROWTHBOOK_API_HOST` is a valid HTTPS SDK endpoint, the environment and
   client key match, and `GROWTHBOOK_REFRESH_INTERVAL_MS` is not zero unless
   expiry to a fail-closed state is intentional.
2. Merge and deploy source with `chat-account-usage` absent or false. This PR
   has no Prisma schema or migration and needs no database rollout step.
3. Prove backend evaluator health and that the UI/query remain hidden. Treat an
   unconfigured, unhealthy, or stale evaluator as a release hold for enabling
   the flag, while the default-off source deployment remains safe.
4. Create the GrowthBook flag and target a bounded internal cohort through a
   separately approved configuration change.
5. Prove browser visibility and GraphQL access for the cohort, and fail-closed
   behavior outside it.
6. Expand targeting only after usage data, support ownership, and rollback are
   confirmed. Turning the flag off is the first rollback.

The current staging environment is not release evidence for this package
because it carries a newer `v3-ai` state. Use exact-head CI for source proof and
reserve environment smoke tests for a separately approved deployment whose
deployed revision can be read back. The inherited GitGuardian finding in the
unchanged upstream GraphQL fixture remains a security-owner dashboard
disposition; branch-range Gitleaks is the source-content gate for this PR.

## Beta-signup follow-up

The beta-signup implementation exists only on `v3-ai` and changes durable user
state through a broader GraphQL mutation. Before release it needs a separate
plan that defines audit history, idempotence, concurrency behavior, eligibility,
administrator visibility, and a default-off server gate. This PR deliberately
does not present a UI whose backend state transition is not yet settled.

## Pause conditions

- Stop if the UI cannot be gated before mounting or still sends usage queries
  while false.
- Stop if direct GraphQL access can bypass the evaluator.
- Stop if fresh flag evaluation requires a new runtime dependency, a force-on
  escape hatch, or unrelated `v3-ai` code.
- Stop before another upstream integration if `origin/v3` moves again; report
  drift and request a new integration approval only if the movement blocks the
  normal push or materially overlaps this PR.

## Delegation and review ownership

- The main session owns implementation because one small contract crosses the
  feature package, backend context, GraphQL authorization, and Manage UI.
- No implementation slice is delegated.
- Substantive slices receive simplifier and architecture/privacy slice reviews.
  One final reviewer covers the integrated branch.
- The main session verifies every finding and retains integration ownership.

## Progress

- [x] Refreshed remote refs and created a clean worktree at current `origin/v3`.
- [x] Revalidated frontend, GraphQL, and feature-flag seams.
- [x] Confirmed bounded polling avoids a new EventSource dependency.
- [x] Disposition the independent planning review.
- [x] Received one-time approval for this execution plan and its named normal
  branch push and PR update.
- [x] Committed the plan and completed the server, GraphQL, and Manage UI
  slices.
- [x] Captured the false browser state before upstream integration. A local
  true-state capture requires a GrowthBook instance and remains outside the
  approved mutation boundary; 19 GraphQL service and schema tests covered the
  true path on the pre-integration head.
- [x] Opened PR #5693 and pushed the pre-integration implementation.
- [x] Integrated `origin/v3` at
  `afba9120512cdd6d6ba43cc87997520a3a0d0a1a` once in merge commit
  `0c56eefb1adb6c91cba61f0cf10990f4145eb511`. The only conflict was the shared
  GraphQL test helper; the resolution preserves both feature-gate tests and the
  upstream chatbot-publication test.
- [x] Corrected valid PR review findings in commit `2a2e0b386`: malformed
  refresh intervals now warn and use the default, failed initialization is no
  longer logged as ready, and duplicate Turbo environment entries are removed.
- [x] Passed the feature-flag package suite with 36 tests, backend typecheck,
  full repository pre-commit checks, 57 Playwright policy tests, 9 Playwright
  host tests, and staged Gitleaks scans. Host checks used Node 26.8.1 while the
  repository pins Node 24, so CI remains the authoritative toolchain check.
- [x] Added a Playwright regression in commit `64362ce22` that proves the
  default-false settings page does not mount the account-usage section or send
  `GetChatAccountUsage`. Static Playwright checks pass; browser execution stays
  delegated to CI because the local runtime cannot start.
- [x] Completed the corrective-slice simplifier and integrated final review.
  The final reviewer closed its one low frontend-test finding after the
  correction pass and reported no new or remaining findings.
- [x] Passed the final clean-tree checks, the 36-test feature-flag suite, the
  23-task production build, and a Gitleaks scan over the full branch range.
  The approved normal push and current hosted CI state are recorded on PR
  #5693 because they occur after this committed plan snapshot.
- [x] Diagnosed two failures on the first integrated CI run as newly inherited
  `v3` defects: its two evaluation-target files were not Biome-formatted, and
  its `.test.mjs` suite registered tests with `node:test` while the Chat package
  runs Vitest. Formatting the two files and registering the ten tests with
  Vitest makes both focused reproducers and the full Chat suite pass with 484
  tests passing and 21 database-backed integration tests intentionally skipped.
- [x] Diagnosed the eight Playwright shard failures before test execution. The
  build compiled the feature-flag package, but the public route executed the
  trusted `v3` composite action, whose artifact omitted that new runtime path.
  The backend test process then failed with `ERR_MODULE_NOT_FOUND`; later
  Hatchet and PostgreSQL messages were teardown noise. The backend bundle now
  embeds the feature-flag adapter and GrowthBook runtime inside the existing
  transferred service artifact, so the candidate no longer depends on changing
  its own trusted artifact allowlist.
- [x] Accepted the transport-integrity part of CodeRabbit's review while
  rejecting its credential-leak framing: SDK client keys are public
  identifiers, but cleartext transport can still alter rollout definitions.
  The Node evaluator now rejects malformed and non-HTTPS hosts without fetching.
- [x] Documented the final reviewer's low-severity operational finding: a zero
  refresh interval disables polling, so the one startup payload expires after
  120 seconds and all evaluations then fail closed.
- [x] Passed the corrected local gate: 38 feature-flag tests, full repository
  `check:all`, the 21-task test build, the 23-task production build, and static
  inspection of the generated backend entry. The entry contains the
  feature-flag and GrowthBook runtimes and retains no import of those packages.
  The documentation validator still reports only the repository's existing
  26 conformance errors and 41 warnings; the new solution page adds none.
- [ ] Require exact-head pinned-Node-24 CI to run the database-backed GraphQL
  suite and the new browser test before merge. Three supported Devrouter starts
  were blocked before runtime startup because Docker could not resolve
  `index.docker.io` and the required Node image is not cached. The exact
  workspace is stopped. This is a merge gate, not a normal-push blocker.
