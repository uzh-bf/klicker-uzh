# PLAN — Discoverable beta feature enrollment

## Identity

- Plan path: `project/plans_wip/PLAN-beta-feature-enrollment.md`
- Branch: `rs/beta-feature-enrollment`
- Target: `v3`
- Baseline: `origin/v3` at `653ee18143d4abd51e656cab1ece443de7beaef4`
- Execution owner: this Codex task is the execution orchestrator. It owns
  decomposition, serialized child execution, integration, reviews,
  verification, plan progress, commits, and the authorized delivery layer.
- Delivery: one ordinary draft pull request against `v3`; pull request readiness,
  merge, GrowthBook changes, deployment, and production activation remain
  separate approval boundaries.
- Autonomy: after the single human plan approval, continue through all slices
  and the draft pull request without intermediate approval. Pause only for a
  material contract change, an unplanned external/destructive action, missing
  authority, an unavailable required review, or an evidenced blocker.

## Goal

Let eligible Catalyst account owners and full-access delegates find and manage
one account-level beta enrollment without exposing GrowthBook credentials or
making beta functionality visible by default.

The enrollment must be discoverable during first-login account setup, from the
Manage user menu while enrollment is open, and in persistent user settings.
Closing enrollment must stop new opt-ins without trapping existing members:
existing members can still find the setting and opt out.

Done means the behavior is implemented from the current `v3` baseline, covered
by service and browser-facing tests, verified in the local routed application,
documented with a production runbook, reviewed at each armed gate, committed,
pushed to `origin/rs/beta-feature-enrollment`, and opened as a draft pull
request against `v3`.

## Non-goals

- Do not add a per-feature picker. This is one general beta enrollment; each
  beta surface keeps its own feature flag.
- Do not add a Prisma field or migration. GrowthBook remains the cohort owner.
- Do not copy the GrowthBook management key into the browser, another service,
  repository configuration, logs, or GraphQL responses.
- Do not make a beta feature available solely because enrollment is open.
- Do not change participant Chat authorization, chatbot publication
  authorization, model routing, or `Participation.isActive` semantics.
- Do not deploy to staging or production, mutate GrowthBook, merge the pull
  request, or mark it ready for review in this package.
- Do not transplant the old `v3-ai` commit wholesale. Reapply the small
  behavior to current `v3` so generated files and diverged schemas are not
  carried across.

## Settled product and safety contracts

### One enrollment, two flags

- `beta-signup` is a new default-off rollout flag. It controls whether eligible
  Catalyst users can discover the enrollment entry points and opt in.
- `ai-beta` remains the access flag for released AI beta surfaces, including
  the account-usage UI already merged into `v3` by pull request 5693.
- The flags are not interchangeable. Gating the enrollment switch only with
  `ai-beta` would make the switch disappear before a user can join its target
  group.
- The backend must fail closed when enabling enrollment: `enabled: true` is
  rejected unless its own `beta-signup` evaluation succeeds. Browser flag
  evaluation is presentation only.
- Disabling enrollment remains allowed when `beta-signup` is false. The
  persistent settings entry remains visible to an existing member so opt-out
  stays available.
- Add the existing `catalyst` fact to the sanitized browser and backend
  feature-flag attributes. The production `ai-beta` rule must require both
  saved-group membership and Catalyst status, so removing Catalyst access
  revokes beta surfaces even before cohort cleanup completes.
- A feature flag never replaces authentication, Catalyst authorization, login
  scope, chatbot authorization, or a durable AI entitlement. The `v3-ai`
  `User.aiFeaturesEnabled` entitlement remains a separate future integration
  concern and is not introduced into `v3` by this pull request.

### Discoverability

- The existing full-screen first-login account-setup modal is the signup modal
  for this plan. Eligible users see the same enrollment control there without
  making it part of the mandatory profile form or blocking profile completion.
- User settings contain a dedicated, anchored Beta features section. It is the
  durable location for current members and the ordinary fallback after first
  login.
- While `beta-signup` is true, eligible Catalyst users also receive a direct
  Beta features item in the existing user dropdown. It links to the settings
  anchor. The normal Settings item remains unchanged.
- If enrollment is open but GrowthBook cannot report membership, the section
  remains findable and explains that it is temporarily unavailable. It must
  not guess a switch state.
- Non-Catalyst users and login scopes below full access see no enrollment
  control. Existing GraphQL authorization remains authoritative if a caller
  bypasses the UI.
- The settings and first-login controls consume one backend capability
  response with the caller's change eligibility, backend-evaluated signup
  availability, and membership as `true`, `false`, or unknown. The user-menu
  link combines the root `userScope` field added to the existing profile
  operation, its Catalyst fact, and the browser flag for navigation only; the
  destination and mutation rely on the backend response. A focused test proves
  that weaker login scopes never receive the menu entry.

### GraphQL and GrowthBook boundary

- The browser uses typed GraphQL operations only. The primary GraphQL backend
  is the sole GrowthBook Management API consumer.
- The query returns one enrollment capability object. It requires an
  authenticated User, avoids the Management API for login scopes below full
  access, and reports nullable membership, signup availability, and whether
  this caller may change the setting. Nullable membership means the external
  state is unknown, not that the user is opted out.
- The mutation requires authenticated User role and `FULL_ACCESS` scope. The
  existing scope hierarchy also permits the account owner. Enabling
  additionally requires current Catalyst status and `beta-signup`; disabling
  remains allowed for a former Catalyst member so eligibility loss cannot trap
  their identifier in the cohort.
- Membership is the stable pseudonymous Klicker `User.id`. No email, name,
  course data, participant data, or feature usage is sent to the saved group.
- A write failure is shown to the user and leaves the last confirmed switch
  state in place.
- Retain the compatible saved-group read/replace endpoint used by `v3-ai`, but
  serialize every application write with one saved-group-scoped Redis lock
  shared by all GraphQL replicas. Acquire it with a unique token and bounded
  expiry; configure a bounded GrowthBook critical-section deadline below the
  lease duration. Immediately before the replace request, atomically verify
  the token and require enough remaining lease time to exceed the bounded
  write-request deadline plus margin. Abandon the write and fail closed if the
  lease is missing, owned by another token, too short, contended, or Redis is
  unavailable. Release only the matching token through Lua. Tests cover lease
  loss before replace, insufficient remaining lease, and token-safe release.
  This prevents a stalled writer from writing after its lease has expired.
- The GraphQL service is the sole cohort writer. Rehearsal, monthly
  reconciliation, Catalyst/account cleanup, and any future operator tool must
  use the same lock helper. Direct GrowthBook UI/API edits are prohibited while
  Klicker owns the cohort. If an exceptional tool cannot take the lock, an
  approved maintenance window must block every application membership mutation
  for the entire read/write interval. Closing `beta-signup` alone is not such a
  block because post-closure opt-out remains available. A separately authorized
  rehearsal against the deployed GrowthBook version remains an activation gate.
- After a successful membership write, the service requests an immediate
  backend flag refresh and the control requests a browser refresh without
  cache. Membership success does not depend on either refresh succeeding. The
  control confirms that enrollment was saved and explains that beta access can
  take up to 120 seconds; a browser refresh failure keeps the saved membership
  visible and tells the user to retry or reload instead of claiming immediate
  access. Failure to converge within 120 seconds in the activation rehearsal
  blocks rollout.

## Klicker feature-design checklist

- **Domain vocabulary:** this stores beta cohort membership for a lecturer
  `User`. It does not involve `Participant`, `Participation`, activities,
  `Element`, or `ElementInstance`.
- **Layer footprint:** `packages/feature-flags`; GraphQL schema, service,
  operations, tests, and tracked public SDL; Manage components, page/header,
  English and German messages; Playwright fixtures/specs; Devcontainer,
  Turborepo, Helm values/templates; feature-flag and deployment documentation.
  Prisma, shared domain types, Hatchet, grading, and analytics are out of scope.
- **Authorization:** the query requires an authenticated User and reports no
  change capability or membership for scopes below full access. The mutation
  additionally requires full access. Opt-in also requires Catalyst and
  `beta-signup`; opt-out remains available to former Catalyst members. The
  backend continues to authorize every downstream feature independently.
- **Gamification:** no points, XP, achievements, or leaderboard effect.
- **Async:** no Hatchet task, queue, schedule, or background worker.
- **UI:** Manage only. Add English and German copy plus stable hooks for the
  section, unavailable state, switch, and menu entry.
- **Test level:** feature-flag contract test, focused GraphQL service tests,
  code generation and schema review, focused Manage Playwright coverage, and
  mandatory browser verification in both locales and responsive widths.
- **Seeds and fixtures:** use existing Catalyst and non-Catalyst Playwright
  users. Mock the public GrowthBook SDK response and browser GraphQL responses;
  do not put a management credential or live identifier in fixtures.

## Data-protection-by-design assessment

- **Transparency:** visible copy explains early-access volatility, suitability
  limits, that the account identifier joins the beta cohort, and that opt-out
  remains available in settings. Do not describe the toggle as legal consent.
- **Fairness and autonomy:** default off; no dark pattern; opt-in is optional;
  opt-out uses the same control and remains possible after enrollment closes.
- **Purpose limitation:** the saved group exists only to target beta feature
  flags. It must not become a mailing list or research dataset.
- **Data minimization:** only stable pseudonymous `User.id` values are stored.
- **Accuracy:** render only confirmed membership; distinguish unknown from
  false and refetch after mutation.
- **Storage limitation:** opt-out removes the identifier. Klicker has no
  lecturer self-deletion path to hook today. Retain membership only while the
  user remains Catalyst and the beta program has a defined purpose. Operations
  reconcile at least monthly and remove entries when Catalyst ends, an account
  is administratively deleted, the user opts out, or the beta program ends;
  each cleanup verifies absence through a values-free membership check.
  Automating cleanup is required if an account-deletion workflow is introduced.
- **Integrity and confidentiality:** management credentials stay in the
  backend-only external Secret; transport is HTTPS; logs contain status and
  configuration errors but never credentials or the saved-group member list.
- **Accountability:** GraphQL/service tests, stable browser tests, public
  technical documentation, and an activation/rollback runbook provide the
  evidence trail. Live GrowthBook changes remain separately approved and are
  recorded in the operational change process, not in source history.

Activation additionally requires the Klicker data controller to record the
applicable legal basis, controller and processor roles, retention owner, and
support contact in the existing governance system. The software must not label
the toggle as legal consent until that decision exists. Source implementation
may proceed, but `beta-signup` must remain false until this gate is evidenced.

## Primitive impact and architecture decisions

- **State:** one account-level membership fact remains owned by the existing
  GrowthBook saved group; no duplicate database state is introduced.
- **Actions:** read capability and set enrollment are typed GraphQL operations.
  Opt-in and opt-out are explicit user actions; profile submission is separate.
- **Policies:** User role, login scope, Catalyst status, `beta-signup`, and each
  downstream feature's own authorization compose without substituting for one
  another.
- **Events:** no durable domain event or async workflow is introduced. Safe
  operational logs record outcome class and status only, never member ids or
  group contents.

ADR 0008 already assigns feature-flag evaluation to GrowthBook and requires
server-side enforcement for protected operations. This plan reuses that
decision and the existing backend-only management credential boundary. The
Redis serialization is a reversible implementation detail using an existing
dependency, so no new ADR is required. A future move to database-owned beta
enrollment or GrowthBook revisions would cross the ADR gate.

Official GrowthBook documentation confirms stable saved-group update support
and newer revision add/remove/publish operations. The current deployed server
version is not proven in this source task, so the plan deliberately keeps the
compatible endpoint and blocks activation on a disposable-group rehearsal.
The newer revision workflow remains out of scope until its deployed support,
approval behavior, and conflict handling are verified.

## Delegation map and commit boundaries

| Slice owner | Scope and bounded paths | Dependency | Commit boundary |
| --- | --- | --- | --- |
| Main orchestrator — backend enrollment | `packages/feature-flags/**`; beta-enrollment schema, service, operations, and tests under `packages/graphql/**` except `QUserProfile.graphql`; `turbo.json`; `.devcontainer/docker-compose.yml`; GrowthBook fields in `deploy/**`; directly affected feature-flag docs | Approved plan | `feat(manage): add gated beta enrollment backend` |
| Manage enrollment executor — persistent settings | New enrollment component, `apps/frontend-manage/src/pages/user/settings.tsx`, and matching `packages/i18n/messages/{en,de}.ts` keys only | Backend commit and generated operations | `feat(manage): add beta enrollment settings` |
| Manage discovery executor — signup and menu | `SuspendedFirstLoginModal.tsx`, `Header.tsx`, `Layout.tsx`, `ManageFeatureFlagProvider.tsx`, a new Manage-specific profile operation under `packages/graphql/src/graphql/ops/`, and discovery-specific keys in `packages/i18n/messages/{en,de}.ts`; no Playwright paths | Persistent settings commit | `feat(manage): surface beta enrollment discovery` |
| Main orchestrator — integrated evidence and runbook | Playwright fixtures/spec, `docs/feature-flags.md`, `docs/ci-and-deployment.md`, plan progress, runtime evidence, and only fixes required by integrated review | All implementation commits | `test(manage): verify beta enrollment rollout` plus a metadata-only plan rename commit if a pull request id exists |

Only one writer uses the worktree at a time. Each executor receives a fresh,
self-contained scope, cannot delegate or publish, and returns changed paths,
verification, and residual risks. The main orchestrator inspects every result
before committing or integrating it.

## Implementation slices

### Backend enrollment contract and rollout gate

Implement the current-`v3` equivalent of the small `v3-ai` beta enrollment
service, then harden it with the independent `beta-signup` gate and full-access
authorization. Add the typed flag registry entry, GraphQL query/mutation,
service tests, configuration wiring for the non-secret saved-group id, tracked
SDL update, and the minimum feature-flag documentation needed to make the
ownership boundary accurate.

- Route: main session because the service, auth, personal-data boundary, and
  external write semantics are tightly coupled and require orchestrator
  judgment.
- Acceptance: default-off flag contract passes; unauthorized and non-Catalyst
  GraphQL callers cannot change membership; weaker login scopes receive no
  external membership read; opt-in fails closed without Catalyst or when
  `beta-signup` is false; opt-out remains possible after either condition
  changes; unknown external state is distinct from false; the distributed lock
  serializes writers and releases safely; add/remove/idempotence/error cases
  pass; GraphQL generation succeeds; Helm renders the id only when configured;
  no Prisma migration exists.
- Post-slice gates: simplifier and one slice reviewer covering authorization,
  personal-data handling, external-write integrity, and rollback behavior.

### Persistent settings enrollment

Build the reusable enrollment control and mount it in an anchored Beta features
section on the Manage user-settings page. Preserve current membership while a
mutation is pending, show actionable failure/unavailable states, and hide the
section only when signup is closed and confirmed membership is false.

- Route: the configured Manage enrollment executor owns exactly the bounded
  component, settings-page, and settings-copy paths after the backend contract
  is committed; the main session integrates and verifies.
- Acceptance: eligible users see confirmed on/off states; current members can
  opt out with signup closed; non-members do not see the section after closure;
  unavailable membership does not render a guessed switch; English and German
  copy and stable hooks are present; successful writes expose pending,
  converged, and refresh-failed states without claiming immediate access.
- Post-slice gates: simplifier; slice review only if implementation introduces
  a new security, privacy, or cross-contract risk beyond the reviewed backend
  contract.

### Signup and menu discovery

Reuse the same control in the first-login account-setup modal and add a direct
user-menu link while signup is open. The beta mutation is independent from the
Formik profile submission, so a GrowthBook failure cannot block completion of
mandatory first-login settings.

- Route: the configured Manage discovery executor owns exactly the bounded
  modal, header, layout, profile-operation, and discovery-copy paths after the
  reusable component is committed; the main session integrates and verifies.
- Acceptance: Catalyst users can discover enrollment during first login and
  from the menu; the menu link lands on the settings anchor; non-Catalyst users
  see neither entry; closing signup removes recruitment entry points but leaves
  enrolled users' settings opt-out available; profile setup still succeeds
  when enrollment is unavailable.
- Post-slice gates: simplifier; slice review only if the final composition
  changes the settled authorization or data boundary.

### Browser evidence and production runbook

Add focused Playwright coverage and verify the real Manage UI with
`agent-browser`. Update deployment and feature-flag documentation with the
configuration, activation, monitoring, and rollback sequence. No live
GrowthBook or cluster mutation occurs.

- Route: main session because runtime custody, evidence selection, and release
  gates span the integrated package. It owns every Playwright fixture and spec
  change; these paths are not delegated.
- Acceptance: focused E2E covers open enrollment, closed enrollment,
  post-closure opt-out, non-Catalyst invisibility, and signup-modal
  non-blocking behavior; screenshots cover settings and first login in English
  and German at desktop and narrow widths; `check:all`, relevant tests, build,
  codegen, Helm lint/render, and exact-diff inspection pass or have an explicit
  evidenced blocker.
- Post-slice gates: assertion-only follow-up does not require a simplifier;
  integrated final review covers correctness, security, data protection,
  architecture, UX, test sufficiency, and plan compliance.

## Operational activation plan

1. **Land inert source.** Merge and deploy only while `beta-signup` is absent or
   false. Confirm the primary GraphQL backend alone receives the management
   Secret and saved-group id. This source plan does not authorize that merge or
   deployment.
2. **Complete governance and retention gates.** Record the controller-approved
   legal basis, retention owner, monthly reconciliation, account/Catalyst
   removal procedure, and support contact. Keep self-service opt-out deployed
   until the saved group is verified empty before any source rollback. Require
   every reconciliation or cleanup writer to use the shared saved-group lock;
   prohibit direct GrowthBook edits outside a mutation-blocking maintenance
   window.
3. **Rehearse the exact Management API.** With separate approval, use a
   disposable list group on the exact deployed GrowthBook version. Capture
   values-free evidence for lock acquisition, add, direct read, removal,
   absence verification, propagation to browser/backend payloads within 120
   seconds, and restoration of the disposable baseline. Activation is blocked
   if any step fails or requires a different endpoint contract.
4. **Verify control-plane state.** Confirm `ai-beta` requires both the intended
   list saved group and Catalyst status, create `beta-signup` with a false
   default in each applicable environment, and verify browser and backend SDK
   connections receive equivalent definitions and attributes. Record
   identifiers in the operations system, not in chat or logs. These are
   separately approved GrowthBook writes.
5. **Run a production canary.** Since staging currently carries newer `v3-ai`
   state and cannot validate this `v3` candidate, target `beta-signup` to a
   small internal Catalyst cohort first. With a synthetic or approved internal
   account, verify menu/settings/signup discovery, opt-in, `ai-beta` access,
   account-usage visibility, reload persistence, and opt-out.
6. **Broaden deliberately.** Expand `beta-signup` only after the canary. Monitor
   GraphQL error rate and timeout logs for beta saved-group reads/writes,
   enrollment support reports, and unexpected cohort changes. Do not log or
   export member values for monitoring.
7. **Rollback in layers.** Set `beta-signup` false to stop new enrollment while
   preserving existing access and opt-out. Set `ai-beta` false to hide beta AI
   surfaces if the features themselves are unsafe. If lock, membership, or
   propagation behavior is unhealthy, close signup, reconcile the saved group
   through an approved operator action, and only then reopen. Do not remove the
   self-service opt-out until the saved group is verified empty. Revert source
   through an ordinary pull request only after that lifecycle is complete.

## Feature-wide test portfolio

- Feature-flag contract and sanitizer tests cover `beta-signup` default-off and
  the boolean Catalyst attribute for browser/backend targeting.
- Service tests cover unconfigured/unreachable GrowthBook, list-group
  validation, add, duplicate add, remove, write failure, Redis contention,
  lease loss before replace, insufficient remaining lease, token-safe release,
  and enable/disable flag semantics.
- Schema-level GraphQL tests cover anonymous, non-Catalyst, read-only,
  session-execution, full-access, and account-owner callers. They prove closed
  signup rejects enable while allowing an existing member to disable.
- Feature-flag adapter tests prove a fresh browser payload and the next backend
  refresh apply both grant and revocation; the integrated UI tests cover
  pending and refresh-failed messaging.
- Playwright covers open signup, closed signup, existing-member opt-out,
  non-Catalyst invisibility, direct-menu navigation, first-login discovery, and
  profile submission while enrollment is unavailable. A focused profile/menu
  test proves weaker login scopes cannot see the direct menu entry.
- Browser verification covers visible, unavailable, pending, and narrow-layout
  states in English and German. Helm checks prove the management secret remains
  backend-only and the non-secret group id renders only when configured.

## Verification matrix

- `pnpm --filter @klicker-uzh/feature-flags test`
- `pnpm --filter @klicker-uzh/feature-flags check`
- `pnpm --filter @klicker-uzh/graphql generate`
- `pnpm --filter @klicker-uzh/graphql test:local betaFeatures.test.ts`
- focused schema-level GraphQL authorization tests for beta enrollment
- `pnpm --filter @klicker-uzh/graphql check`
- focused Manage Playwright through host `pnpm playwright:host -- ...`
- `pnpm run check:all`
- `pnpm run build`
- Helm lint and staging/production template renders with checks for
  `GROWTHBOOK_BETA_SAVED_GROUP_ID`
- `npx agent-browser@0.32.2` against the exact worktree runtime, with captured
  screenshots and console/network review
- staged diff inspection plus gitleaks/data-hygiene review before every commit

## Planning-stage specialist review

- Same-provider planner hardening: three rounds on frozen drafts. Round 1 and
  round 2 returned `REVISE`; every accepted finding is incorporated. Round 3
  returned `APPROVED` with no findings on draft SHA-256
  `d71f424322a06b39e8c42bedebffffca2020338025e13c124c0a5234bb782ef5`.
- Architecture advisor: attempted through the required read-only Claude CLI
  route, but local authentication failed with `401 OAuth access token has been
  revoked`. No advisor result is claimed; the limitation is non-source and
  must be visible at the human plan gate.
- Opposing-provider challenge: attempted once because this plan changes an
  external personal-data write path, authorization, and public GraphQL/UI
  contracts. The same revoked Claude OAuth token prevented a structured
  result. This challenge is fail-open; the approved native planner remains the
  completion gate. The detailed transcript is retained under ignored
  `project/_local/reviews/`.

## Progress

- 2026-09-04: the settings slice GLM 5.3 Flash simplifier found one
  redundant query-to-state synchronization effect. The effect was removed;
  query membership now remains directly derived until the mutation returns a
  new confirmed value. This preserves the no-optimistic-update contract with
  less state synchronization. No slice reviewer was required because the UI
  composition introduced no new authorization, privacy, or external-write
  boundary beyond the reviewed backend contract.
- 2026-09-04: the persistent settings executor added the reusable enrollment
  control, anchored settings section, English and German copy, stable UI hooks,
  confirmed-state preservation, browser feature refresh, and distinct pending,
  saved, converged, refresh-failed, unavailable, and mutation-error states.
  The parent accepted the bounded diff and added explicit convergence evidence.
  The Manage typecheck and focused Biome check pass. The i18n package has no
  standalone `check` script, so its messages are covered by the consuming
  Manage typecheck and focused Biome check. Browser proof remains in the
  integrated evidence slice.
- 2026-09-04: backend commit `8e8bed22c` passed its GLM 5.3 Flash
  simplifier and risk-selected slice review with no Critical or Important
  correctness finding. Accepted the behavior-preserving URL normalization and
  required evaluator refresh contract. Clarified that `mayChange` preserves an
  eligible caller's unavailable UI state, and recorded that Management API
  configuration cannot be removed until the cohort is verified empty because
  unprovisioning would also disable self-service opt-out. The discovery slice
  now explicitly owns the Manage provider's Catalyst attribute and a new
  operation name; the deployed `QUserProfile` operation remains untouched.
- 2026-09-04: backend enrollment slice implementation and focused verification
  are complete before review. Added the default-off `beta-signup` contract,
  Catalyst targeting attribute, typed capability query/mutation, full-access
  and opt-in gates, nullable membership, serialized GrowthBook writes with
  lease validation, backend/browser refresh hooks, tracked SDL, environment
  wiring, and ownership documentation. Feature-flag tests pass (42 tests),
  focused service/schema tests pass (27 tests), both package typechecks pass,
  GraphQL generation succeeds, and staging/production Helm lint plus empty and
  configured saved-group-id renders pass. The package-level GraphQL test script
  ignored file arguments and started the full suite; it was interrupted after
  unrelated fixture/Redis failures, then replaced with direct focused Vitest.
  The repository-wide pre-commit equivalent completed all 25 typecheck tasks;
  its only failure was the untouched Analytics lint bootstrap timing out while
  downloading `pydantic-core`. The backend slice was committed as `8e8bed22c`.
- 2026-09-04: the GraphQL rolling-deployment rule requires a new operation name
  when adding `userScope`; the discovery slice will retain `QUserProfile` and
  introduce a Manage-specific profile operation instead of changing the
  deployed operation hash. This preserves the approved behavior without
  changing the public product contract.
- 2026-09-04: human plan approval recorded. Execution is active on the backend
  enrollment contract and rollout-gate slice. Remaining slices are persistent
  settings, signup/menu discovery, integrated browser evidence and runbook,
  final verification/review, push, and draft pull request.
- 2026-09-04: refreshed `origin/v3`; created
  `rs/beta-feature-enrollment` at `653ee18143d4abd51e656cab1ece443de7beaef4`.
- 2026-09-04: confirmed pull request 5693 is merged and the account-usage UI is
  already gated by `ai-beta` in current `v3`.
- 2026-09-04: mapped the existing Manage settings, user dropdown, first-login
  account-setup modal, GraphQL feature-flag helper, deployment configuration,
  and the reusable `v3-ai` beta enrollment implementation.
- 2026-09-04: drafted the two-flag enrollment contract, GraphQL-only browser
  boundary, data-protection controls, verification matrix, and operational
  activation/rollback plan. Implementation has not started.
- 2026-09-04: first planner round returned `REVISE`. Accepted the concurrency,
  propagation, retention, schema-test, capability-response, delegation,
  rehearsal, and plan-contract gaps. Replaced the accepted lost-update risk
  with Redis serialization; added a 120-second convergence gate, former-
  Catalyst opt-out, governance/retention activation gates, explicit ownership,
  and a complete test portfolio. Implementation remains unstarted.
- 2026-09-04: second planner round returned `REVISE`. Added lease-loss safety,
  a single-writer/maintenance contract, explicit `userScope` discovery wiring,
  and exact non-overlapping slice ownership. The final planner round returned
  `APPROVED` with no findings. The required Claude advisor and opposing-provider
  attempts were unavailable because the local OAuth token is revoked.
  Implementation remains unstarted pending the human plan approval.
- 2026-09-04: revalidated the live GitHub branch heads after the planning pause.
  `v3` remains `653ee18143d4abd51e656cab1ece443de7beaef4` and `v3-ai`
  remains `ecf12398dc5409ddcdfc85613c87570933cc5d6f`; the reviewed baseline is
  unchanged. SSH fetch was unavailable because the signing agent refused the
  key operation, so this freshness receipt came from the authenticated GitHub
  API without changing local refs.
