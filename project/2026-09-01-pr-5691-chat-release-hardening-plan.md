# Chat Release Hardening Plan

## Goal

Prepare one focused release-hardening PR against current `v3` that closes the
participant Chat exposure, makes GPT-5.6 Luna the unconditional zero-credit
fallback, and makes the first rollout compatible with the supported
complete-only Chat readers. The PR ends as a reviewed, verified open PR. It
does not deploy or migrate any environment.

## Settled contracts

- An actual chatbot user has a `Participation` in the chatbot's owning course.
  `Participation.isActive` does not affect Chat access.
- The participant-facing Chat bootstrap remains a same-origin Next.js backend
  for frontend route. GraphQL remains the course-listing API and does not gain a
  second bootstrap contract.
- The browser bootstrap contains only `modelSelection`, derived mode
  descriptions, and whether those descriptions are fallbacks. It never contains
  raw system prompts.
- When participant credits are exhausted, Chat always uses the registry's base
  fallback, GPT-5.6 Luna. The chatbot allow-list and selected usage class do not
  block that fallback.
- GPT-4.1 Mini is retired from active registries, deployment values, and local
  router configuration. Persisted allow-lists containing only retired models
  resolve to the narrow GPT-5.6 Luna base fallback until they are repaired.
- Lifecycle writers are off by default in the first rollout. R1 creates only a
  hidden `IN_PROGRESS` marker, and supported complete-only reads keep it away
  from readers. Normal requests are claimed once per thread and user-message
  parent; explicit regeneration remains the opt-in path for a sibling answer.

## Non-goals

- Do not merge, rebase, retarget, or edit the existing chatbot authoring stack.
- Do not add a GraphQL chatbot-bootstrap query.
- Do not rewrite historical usage-analysis snapshots or prior rollout records
  that mention GPT-4.1 Mini.
- Do not enable lifecycle attempt tracking, account-usage enforcement, or any
  feature flag in an environment.
- Do not add or edit a Prisma migration.
- Do not deploy, synchronize ArgoCD, establish cluster connectivity, run a
  production smoke test, or mutate GrowthBook, GitHub protection, or df-cloud.

## Plan identity and authority

- Plan path: `project/2026-09-01-pr-5691-chat-release-hardening-plan.md`
- Branch: `rs/chat-release-hardening`
- Target branch: `v3`
- Base: `origin/v3` at `72096fafe50827c3ea3f50465f0a76d492e0a4c2`
- Worktree: `trees/rs/chat-release-hardening`
- Delivery: PR #5691, one independent PR targeting `v3`
- Current authority: execution through review, local commits, and push/update
  of PR #5691
- Approval terminal: in-scope edits, repository checks, required reviews,
  conventional commits, push of this branch, and update of PR #5691
- Withheld actions: upstream integration, merge, deployment, migration
  execution, runtime flag activation, cluster writes, and production proof

## Current findings

- The published-chatbot metadata route validates publication but not the
  participant cookie or course `Participation`, and returns raw system
  prompts.
- The Chat page layout reads the published chatbot directly and has the same
  missing participation boundary.
- Existing Chat mutation routes already use the correct participation check,
  which deliberately ignores `Participation.isActive`.
- GPT-5.6 Luna is the sole registry fallback and base model, but the current
  selector filters fallback candidates by chatbot allow-list and usage class.
- The lifecycle migration is additive. The rollout risk is application-level:
  the first R1 implementation had no durable claim marker, so distinct client
  assistant IDs could both reach provider work and charge. Current Chat history
  readers already filter lifecycle status, so a hidden marker is safe for the
  supported R1 pod set without a new migration. Pre-lifecycle unfiltered
  readers must not be mixed into that rollout. A crash after claiming and
  before terminal completion can leave a hidden marker; R1 therefore needs a
  documented detection owner and recovery path before activation.
- Participant-credit debiting previously happened after message and owner-usage
  finalization. The correction now performs the participant debit in that same
  transaction, so a debit failure rolls back the completed message and owner
  charge and a duplicate finalization cannot debit twice.
- The exact current `v3` migration set has 182 migrations. Production history
  previously ended at 179, leaving the three reviewed Chat migrations as the
  release delta.

## Product and architecture decisions

- The affected primitive is participant access to one published chatbot. Its
  authority source remains `Participation(courseId, participantId)`.
- `Participation.isActive` remains a leaderboard preference, not enrollment
  or authorization.
- The same-origin Chat backend for frontend route owns participant-cookie
  authentication and the page bootstrap. Moving it to GraphQL would create a
  second public contract without improving authorization.
- Amend ADR 0020 because unconditional base fallback intentionally replaces its
  same-class fallback rule. Amend ADR 0041 because lifecycle writers become
  independent of usage enforcement and remain off for R1. No new ADR is needed.
- Record the participation invariant in the existing domain and Chat wiki
  pages. Do not create `CONTEXT.md`; the control checkout contains an
  unrelated untracked file at that path.

## Planning-stage review

- Reviewer: Sol planner `Hypatia`, read-only, on the exact current base.
- Verdict: `DONE_WITH_CONCERNS`.
- Accepted findings:
  - The initial writer-off R1 design could duplicate provider work under a
    concurrent retry. The later final review reproduced that path, and the
    correction now serializes normal claims with a hidden marker.
  - Both the route and layout need the same authorization because API paths do
    not inherit the page proxy's JWT checks.
  - A zero-content completion persists no assistant message and charges
    nothing.
  - Lifecycle writer configuration needs a chart-level false default that
    renders no environment key while false.
  - Preserve the already-landed course-language and grounding behavior and
    tests.
- Full disposition:
  `project/_local/reviews/2026-08-30-v3-release-hardening-planner.md`.
- The final review of PR #5691 at the prior head found a high-severity
  distinct-assistant-ID duplicate-charge path. The finding is accepted. Slice 4
  now adds a hidden marker, a thread-plus-parent advisory lock, and an explicit
  regeneration flag so normal retries are serialized while intentional reloads
  remain sibling branches. No new migration is needed because the existing
  lifecycle columns support the marker and current history reads are
  complete-only.

## Execution slices

### Slice 1: Commit the approved plan

Do:

- Incorporate the planning review and the user's final rulings.
- Commit only this plan after explicit plan approval.

Check:

- The plan names every external action that remains withheld.

Commit:

- `docs(project): plan chat release hardening`

### Slice 2: Close participant bootstrap exposure

Do:

- Reuse one server-side authentication and authorization path for the page
  layout and chatbot metadata route.
- Require a valid participant token, a published chatbot, and any matching
  course `Participation`; never filter by `isActive`.
- Return exactly `modelSelection`, server-derived mode descriptions, and the
  fallback-description indicator.
- Update the settings store to consume the safe response.
- Update the Chat and domain wiki contracts.

Check:

- Route and guard tests cover missing token, non-participant, inactive
  participation, unpublished chatbot, and valid participant.
- A response-shape test proves raw prompts are absent.
- Browser verification proves an enrolled participant can open Chat, an
  unenrolled participant cannot, and no prompt content appears in the network
  response.

Commit:

- `fix(chat): restrict chatbot bootstrap to participants`

### Slice 3: Make Luna the unconditional participant fallback

Do:

- Select the single validated base fallback independently of the chatbot
  allow-list and selected usage class when participant credits are exhausted.
- Meter and report the effective turn as base usage.
- Keep explicit model selection behavior unchanged while credits remain.
- Amend the two affected Chat ADR and wiki statements.

Check:

- Registry and route tests cover Advanced, Auto, and a chatbot allow-list that
  omits Luna; all exhausted-credit cases use GPT-5.6 Luna.
- Tests prove a stale allow-list containing only GPT-4.1 Mini resolves to GPT-5.6
  Luna in automatic mode.
- Registry parity still requires one base fallback with the Luna identifier.

Commit:

- `fix(chat): use Luna for exhausted participant credits`

### Slice 4: Add a mixed-version lifecycle writer gate

Do:

- Add a default-off `CHAT_TURN_LIFECYCLE_WRITES_ENABLED` runtime switch for
  lifecycle claim writes.
- Add the switch to `turbo.json` and
  `chat.lifecycleWritersEnabled: false` in chart defaults. Omit the Chat
  ConfigMap environment key while false; an explicit true override must render
  it for the later R2 change.
- In writer-off mode, create a hidden `IN_PROGRESS` assistant marker with a
  `null` lifecycle attempt ID before provider work. Existing complete-only
  readers do not expose it.
- Serialize normal claims by thread and user-message parent with a PostgreSQL
  transaction advisory lock. Explicit regeneration opts into a sibling claim.
- Finalize by atomically completing the claimed marker and charge both account
  and participant credits at most once. Failure or a successful zero-content
  completion removes the writer-off marker and charges nothing.
- Validate any unique-key collision against the expected role, thread, chatbot,
  and owner before treating it as a duplicate.
- Preserve same-key claim, reclaim, and failed-turn behavior when the switch is
  on, while invalidating stale sibling attempt tokens during a normal retry.
- Document the two-phase rollout and rollback floor.

Check:

- Integration tests observe no completed assistant row between a writer-off
  claim and finalization, then one non-empty `COMPLETED` row.
- Concurrent writer-off claims with distinct assistant IDs produce one marker,
  one provider-eligible claim, one completed message, and one charge; explicit
  regeneration still creates a sibling and its separate charge.
- Participant credit debit commits with the assistant message and owner usage,
  and duplicate finalization leaves the participant balance unchanged.
- A completed normal claim blocks a later normal claim with a distinct
  assistant ID without creating another message or charge.
- Zero-content completion and pre-terminal failure remove the hidden marker and
  create no completed row or charge.
- Writer-on claim, retry, stale callback, failure, and duplicate tests remain
  green.
- A database assertion proves the supported complete-only history reader does
  not expose the writer-off marker. Pre-lifecycle unfiltered readers are not a
  compatible R1 rollout target and must be excluded by the pod-revision gate.
- Helm checks prove false omits the key and an explicit true override renders
  it.
- The R1 rollout runbook names the stale-marker detection owner and accepts
  explicit reload as the recovery path, or schedules bounded cleanup as a
  separately reviewed follow-up before activation.

Commit:

- `fix(chat): gate lifecycle claims for mixed-version rollout`

### Slice 5: Verify, review, and update the PR

Do:

- Run focused Chat unit, route, and database integration tests.
- Run the existing course-language and grounding compiler tests.
- Run relevant package checks, `pnpm run check:all`, and the production build
  in the supported container environment.
- Complete required simplifier and risk-focused slice reviews on each
  substantive committed range.
- Complete one integrated final review on the exact final commit range.
- Inspect staged and published diffs for secrets, personal data, generated
  churn, and unrelated changes.
- Push this branch and update PR #5691 targeting `v3`.
- Update the affected wiki pages, ADRs,
  `.agents/skills/klicker-feature-design/SKILL.md`.

Check:

- Every review finding has a recorded disposition and accepted corrections are
  reverified.
- The PR describes source evidence only and makes no staging or
  production-runtime claim.

## Test portfolio

| Risk | Smallest observing check |
| --- | --- |
| Participant authorization | Guard and route tests using active and inactive participations |
| Prompt confidentiality | Bootstrap response-shape test and browser network inspection |
| Luna fallback | Registry and Chat route tests across usage classes and allow-lists |
| Duplicate charging | PostgreSQL integration test with concurrent finalization |
| Empty completion | Integration test proving no row and no charge |
| Mixed-version ghost row | Database assertion before and after writer-off finalization |
| Writer configuration | Helm render with false and explicit true values |
| User-visible Chat entry | Delegated-login browser checks for enrolled and unenrolled users |
| Integrated package | Chat/package tests, `check:all`, and build |

## Release and operational map

| Gate | Current state | Required action and authority boundary |
| --- | --- | --- |
| Release-hardening source | PR #5691 open; duplicate-charge correction committed | Complete fresh review and update this PR; merge is separately approved |
| Account-usage visibility | Ungated on `v3` | Land the sibling default-off flag PR |
| Production spread rules | Values do not render | Fully prequalify the sibling chart PR; its merge itself needs production-change authority because Argo auto-syncs `v3` |
| Authoring PR stack | Open and mergeable, review contexts unsettled | Resolve its own GitGuardian/final-review contexts, then integrate updated `v3` once with separate approval |
| Database delta | Three additive Chat migrations after production migration 179 | Rehearse 179 to 182, prove schema equivalence and lock behavior, then obtain backup and maintenance approval |
| Lifecycle rollout R1 | Hidden-marker claims, attempt tracking off | Deploy exact candidate with attempt tracking off and prove every Chat pod runs a complete-only reader |
| Lifecycle rollout R2 | Not prepared | Separate configuration PR and approval after R1 proof; R1 is the rollback floor |
| Client/API skew | New clients send explicit regeneration; cached old clients do not | Treat the new Chat client and route as one release unit; monitor 409s after rollout and do not claim old-client reload compatibility |
| Assessment drift | Argo previously Healthy but OutOfSync | Reconcile only after chart merge and explicit deployment approval |
| LiteLLM cost audit | Latest job failed because its cost source was unreachable | Diagnose endpoint ownership in df-cloud; no retry or write from this package |
| Chat availability | One ready replica and no PDB observed | Separate HA proposal for replicas, disruption budget, and spread |
| Branch protection | No required checks or reviews observed | Separate repository-governance mutation after owners select policy |
| Beta signup | Exists only on the broader `v3-ai` branch | Redesign as an audited, concurrency-safe, default-off feature before release |
| Model registry cleanup | GPT-4.1 Mini remains in active defaults and deployment values | Retire it in this release and preserve historical analysis records |
| Account enforcement | Default off | Inventory budgets and owners before a separately approved cutover |

R1 operational decision: a process or pod loss after a claim can leave a hidden
`IN_PROGRESS` marker and block an ordinary retry. Chat on-call owns detection of
markers older than the configured provider request timeout; the read-only check
is an `IN_PROGRESS` marker with a null attempt token whose `createdAt` exceeds
that threshold. After the provider timeout is confirmed, support can direct the
participant to use the explicit reload action, which creates a deliberate
regeneration sibling. Automatic stale-marker cleanup remains a separate
reviewed change because it must define a safe age threshold and avoid deleting a
live provider attempt. During rollout, monitor the conflict response rate for
cached clients whose reload action omits the new flag; this is an accepted
compatibility limitation, not an authorization or charging bypass.

## Production qualification sequence

1. Land the three independent source PRs and resolve the authoring stack without
   silently rebasing or retargeting it.
2. Freeze one exact `v3` candidate SHA and build its immutable artifacts.
3. Rehearse the production migration history from 179 through exactly 182 in an
   isolated PostgreSQL 17 database. Verify migration count, generated
   provenance, schema equivalence, idempotent status, and lock timing.
4. Run exact-candidate package, API, and browser acceptance locally or in an
   isolated environment. Do not call the newer `v3-ai` staging deployment an
   exact-candidate test.
5. Confirm backup or point-in-time recovery ownership, maintenance timing,
   migration observer, abort conditions, and rollback floor.
6. Deploy R1 with the lifecycle attempt key absent or false. Prove desired
   revision, image digest, migration completion, every Chat pod revision, and
   participant acceptance. Do not mix in pre-lifecycle unfiltered readers,
   because the hidden marker is visible to those readers.
7. Enable R2 only through a separate reviewed configuration change after R1 is
   stable. Roll back application code no further than R1 while lifecycle rows
   may exist.

## Pause conditions

- Stop if authorization would require `Participation.isActive`, a second
  enrollment source, or a public prompt-bearing response.
- Stop if writer-off finalization cannot prevent duplicate messages and charges
  atomically without a new migration.
- Stop if the implementation needs changes in the existing authoring stack,
  `v3-ai`, GrowthBook, df-cloud, or a live environment.
- Stop before upstream integration if `origin/v3` moves after implementation;
  report drift and request the one integration approval.

## Delegation and review ownership

- The main session owns implementation because participant authorization,
  browser privacy, charging, and rollout behavior are tightly coupled.
- No implementation slice is delegated.
- Each substantive committed slice receives the required simplifier and
  risk-focused slice review. One final reviewer covers the integrated branch.
- The main session verifies every finding and retains integration ownership.

## Progress

- [x] Refreshed remote refs and created a clean worktree at current `origin/v3`.
- [x] Revalidated participant, fallback, lifecycle, migration, and PR-stack findings.
- [x] Settled the product and rollout contracts with the user.
- [x] Disposition the independent planning review.
- [x] Receive one-time approval for this execution plan.
- [x] Commit the plan and complete the initial Slices 2 through 4.
- [x] Run the initial checks and reviews. The integrated final review used the
      documented main-session fallback after every child-reviewer provider
      route failed terminally; it found one accepted high-severity correction.
- [x] Implement and verify the distinct-assistant-ID claim correction with
      Chat unit, PostgreSQL integration, typecheck, and lint evidence.
- [x] Add direct coverage for post-completion distinct-ID blocking and route
      default-versus-explicit regeneration propagation.
- [x] Disposition the slice review: stale markers and cached-client reload
      behavior are documented as R1 operational gates; no automatic cleanup is
      added without a separate safety review.
- [x] Move participant credit debiting into the finalization transaction and
      verify one debit for a completed turn and no debit for its duplicate.
- [x] Record the duplicate-charge root cause and prevention contract in
      `docs/solutions/data/chat-turn-duplicate-charging.md`.
- [x] Re-run the required final-package review on the corrected exact head.
      The native GLM 5.3 Flash specialist route was unavailable, so the
      approved same-family GLM 5.3 continuity reviewer re-checked the atomic
      participant debit, PostgreSQL locking, ownership validation, duplicate
      behavior, migration scope, and prior review dispositions and returned
      PASS. The earlier simplifier and risk-slice gates remain recorded for the
      unchanged package; no additional specialist route was available under
      the routing continuity limit.
- [ ] Update PR #5691 and push the corrected branch. Merge, deployment, and
      runtime activation remain withheld.
