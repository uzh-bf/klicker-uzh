# Chat Release Hardening Plan

## Goal

Prepare one focused release-hardening PR against current `v3` that closes the
participant Chat exposure, makes GPT-5.6 Luna the unconditional zero-credit
fallback, and makes the first rollout compatible with older Chat readers. The
PR ends as a reviewed, verified draft PR. It does not deploy or migrate any
environment.

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
- GPT-4.1 Mini remains selectable only for compatibility in this release. Its
  complete retirement is a separate cleanup.
- Lifecycle writers are off by default in the first rollout. New readers and
  complete-only writes must coexist safely with older readers.

## Non-goals

- Do not merge, rebase, retarget, or edit the existing chatbot authoring stack.
- Do not add a GraphQL chatbot-bootstrap query.
- Do not remove GPT-4.1 Mini from every registry or historical configuration.
- Do not enable lifecycle claims, account-usage enforcement, or any feature
  flag in an environment.
- Do not add or edit a Prisma migration.
- Do not deploy, synchronize ArgoCD, establish cluster connectivity, run a
  production smoke test, or mutate GrowthBook, GitHub protection, or df-cloud.

## Plan identity and authority

- Plan path: `project/2026-08-30-chat-release-hardening-plan.md`
- Branch: `rs/chat-release-hardening`
- Target branch: `v3`
- Base: `origin/v3` at
  `acf56b5331a24d4f53729046d9784d4aed006f65`
- Worktree: `trees/rs/chat-release-hardening`
- Delivery: one independent draft PR targeting `v3`
- Current authority: planning and reversible local preparation only
- Approval terminal: in-scope edits, repository checks, required reviews,
  conventional commits, push of this branch, and creation of the draft PR
- Withheld actions: upstream integration, merge, deployment, migration
  execution, runtime flag activation, cluster writes, and production proof

## Current findings

- The published-chatbot metadata route validates publication but not the
  participant cookie or course `Participation), and returns raw system
  prompts.
- The Chat page layout reads the published chatbot directly and has the same
  missing participation boundary.
- Existing Chat mutation routes already use the correct participation check,
  which deliberately ignores `Participation.isActive`.
- GPT-5.6 Luna is the sole registry fallback and base model, but the current
  selector filters fallback candidates by chatbot allow-list and usage class.
- The lifecycle migration is additive. The rollout risk is application-level:
  current writers insert an empty `IN_PROGRESS` assistant row that older
  readers do not filter.
- The exact current `v3` migration set has 182 migrations. Production history
  previously ended at 179, leaving the three reviewed Chat migrations as the
  release delta.

## Product and architecture decisions

- The affected primitive is participant access to one published chatbot. Its
  authority source remains `Participation(courseId, participantId)).
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
  - Writer-off R1 may duplicate provider work under a concurrent retry, but
    exactly one non-empty answer may persist and charge. The concession ends
    when R2 enables claims.
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
- Tests prove GPT-4.1 Mini is never selected as a fallback.
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
- In writer-off mode, preserve the production-compatible behavior: validate the
  thread without creating an assistant row before provider work.
- Finalize with an atomic complete-message insert-or-duplicate transaction and
  charge both account and participant credits at most once. Failure before
  finalization leaves no assistant row.
- Persist no row and charge nothing for a successful zero-content completion.
- Validate any unique-key collision against the expected role, thread, chatbot,
  and owner before treating it as a duplicate.
- Keep the current claim, reclaim, and failed-turn behavior unchanged when the
  switch is on.
- Document the two-phase rollout and rollback floor.

Check:

- Integration tests observe no assistant row between a writer-off claim and
  finalization, then one non-empty `COMPLETED` row.
- Concurrent writer-off finalizations create one message and one charge.
- Zero-content completion and pre-terminal failure create no row and no charge.
- Writer-on claim, retry, stale callback, failure, and duplicate tests remain
  green.
- A mixed-version contract test or equivalent database assertion proves an
  older unfiltered reader cannot observe an empty row from writer-off code.
- Helm checks prove false omits the key and an explicit true override renders
  it.

Commit:

- `fix(chat): gate lifecycle claims for mixed-version rollout`

### Slice 5: Verify, review, and open the draft PR

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
- Push this branch and open one draft PR targeting `v3`.
- Update the affected wiki pages, ADRs,
  `.agents/skills/klicker-feature-design/SKILL.md`.

Check:

- Every review finding has a recorded disposition and accepted corrections are
  reverified.
- The draft PR describes source evidence only and makes no staging or
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
| Release-hardening source | Not implemented | Land this PR after review; merge is separately approved |
| Account-usage visibility | Ungated on `v3` | Land the sibling default-off flag PR |
| Production spread rules | Values do not render | Fully prequalify the sibling chart PR; its merge itself needs production-change authority because Argo auto-syncs `v3` |
| Authoring PR stack | Open and mergeable, review contexts unsettled | Resolve its own GitGuardian/final-review contexts, then integrate updated `v3` once with separate approval |
| Database delta | Three additive Chat migrations after production migration 179 | Rehearse 179 to 182, prove schema equivalence and lock behavior, then obtain backup and maintenance approval |
| Lifecycle rollout R1 | New readers, writer gate absent | Deploy exact candidate with writers off and prove every Chat pod runs R1 |
| Lifecycle rollout R2 | Not prepared | Separate configuration PR and approval after R1 proof; R1 is the rollback floor |
| Assessment drift | Argo previously Healthy but OutOfSync | Reconcile only after chart merge and explicit deployment approval |
| LiteLLM cost audit | Latest job failed because its cost source was unreachable | Diagnose endpoint ownership in df-cloud; no retry or write from this package |
| Chat availability | One ready replica and no PDB observed | Separate HA proposal for replicas, disruption budget, and spread |
| Branch protection | No required checks or reviews observed | Separate repository-governance mutation after owners select policy |
| Beta signup | Exists only on the broader `v3-ai` branch | Redesign as an audited, concurrency-safe, default-off feature before release |
| Deferred model cleanup | GPT-4.1 Mini remains selectable | Remove it in a separate compatibility cleanup |
| Account enforcement | Default off | Inventory budgets and owners before a separately approved cutover |

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
6. Deploy R1 with the lifecycle writer key absent or false. Prove desired
   revision, image digest, migration completion, every Chat pod revision, and
   participant acceptance.
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
- [ ] Receive one-time approval for this execution plan.
- [ ] Commit the plan and complete Slices 2 through 4.
- [ ] Run required checks and reviews.
- [ ] Push and open the draft PR.
