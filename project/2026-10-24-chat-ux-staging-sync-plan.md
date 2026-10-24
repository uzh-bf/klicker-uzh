# Carry the merged chat UX through the integration branches

## Approval summary

Continue the executable batch approved in chat: resolve the maintained
[v3 to v3-ai sync](https://github.com/uzh-bf/klicker-uzh/pull/6694), verify
it, mark it ready and merge with a normal merge commit. Then update the
[v3-ai to adaptive-learning sync](https://github.com/uzh-bf/klicker-uzh/pull/6692),
verify its current head and merge it the same way. Observe the existing
automatic staging promotion and verify the deployed revision, migration hook
and synthetic chat controls where access and fixtures permit.

Preserve both branches' approved behavior. In particular, the lecturer answer
preferences flag joins the target's existing revision save, preview and approval
path; the removed direct policy mutation stays removed. Older stored revisions
inherit the live flag when absent. Student preferences remain browser-local,
and the server applies defaults while the lecturer disables them. Preserve
custom modes, embedded host controls, authentication and document retry evidence.
No additional chatbot inference, dependency upgrade, production deployment, infrastructure
change, force push, human-review request or deletion is included.

Passing source checks and a release ref do not establish runtime acceptance.
A required failing check or human review blocks its merge; missing staging
connectivity, known synthetic fixtures or authorized inference leaves that
acceptance boundary incomplete. Continue independent work and report the exact
blocked boundary. Use one supported watcher for each long CI run; one diagnosed
infrastructure retry per failed run, at most two recoveries in this package.

## Execution details

Execution mode: standard (runtime does not report an allowlisted model ID).
Artifacts root: existing project/. Main owns integration writes and external
actions; a read-only explorer owns staging evidence mapping, planner owns plan
hardening, and scoped review roles own committed-source review.

Baseline: source aa387a8fb01581dcc09823233f7a63e2a6fb9c61, target v3-ai
ee0d01f15fcc690edd8d1b6a454a11f7aba31c27, adaptive target
219464b81f443588f6a3add80b1a0026288274b6. Source has four commits absent
from target. Worktree: trees/sync/v3-into-v3-ai-5f8257b2a1, branch
sync/v3-into-v3-ai-5f8257b2a1; primary remains inspection-only.

1. Harden this plan, then merge the frozen target into the existing sync branch.
   Resolve the 19 previewed conflicts and inspect automatic merge results. Keep
   candidate-manifest pnpm selection plus target CI tests. Combine chat settings,
   custom modes, context freshness and retry cleanup. Preserve both Prisma flags
   and the existing single additive answer-preferences migration.
2. Carry the flag through existing revision types, parser, live snapshot, model
   policy input, normalization, approval projection, GraphQL fragment and UI
   revision-value helper. Update owner preview to compile the saved flag. Delete
   the obsolete direct mutation operation. Extend existing GraphQL behavioral
   tests for staged flag changes, approval, missing legacy flags and omission
   preservation. Update affected browser fixtures to the revision save contract.
   Keep current embedded toolbar/actions while integrating answer controls in its
   existing component file; exercise single/multiple modes and disabled settings.
3. Verify in a checkout-scoped disposable devrouter runtime: schema mirror and
   generated SDL/codegen, chat unit/type checks, GraphQL tests serialized, manage
   check, repository checks/build and focused CI Node contracts. Use the host
   Playwright launcher for consequential browser flows with synthetic fixtures.
   Capture desktop/phone and locale evidence using the screenshot gallery skill.
   No real-user data or paid inference. Stop and verify the exact runtime after
   its final dependent check. No new application source file is planned.
4. Commit the integration after staged data hygiene. Inspect both-parent and
   remerge diffs. Simplification and risk review cover the immutable integration;
   final review covers the complete target-to-final-head range, including every
   changed path. Correct accepted findings with one focused same-reviewer round.
   Ordinary-push the existing sync branch; the controller owns its full PR body.
   Settle exact-head CI/feedback, then mark ready, run eligible repository final
   AI review under AGENTS.md standing authority and merge normally with a matching head. Required human review is
   reported to the user without requesting reviewers or bypassing protection.
5. Refresh the existing downstream sync after the first merge; preserve ancestry
   and resolve any new conflicts on its sync branch. Review/verify any new edits;
   unchanged verification is reusable. Settle its exact-head checks and merge
   normally after its applicable final review, ready-state readback, source ancestry
   proof and absence of unresolved controller source-conflict notices. Observe
   exact-candidate selected-source push qualification, image receipts and the
   checksum-verified promoter receipt with successful ref readback.
   Verify stg-release contains the selected candidate and distinguish this from
   deployed revision, migration success and synthetic browser acceptance. Use
   only already authorized connectivity; unavailable access is a concrete blocker.

### Verification portfolio

- Extend existing GraphQL revision tests for staged preference disablement,
  approval, unauthorized writes, omitted input and missing legacy snapshot flags.
- Reuse existing answer-style/compiler/route, document recovery/hydration and
  on-device dictation tests; update mocks only to combine both branches' contracts.
- Verify existing additive migration against disposable data, Prisma analytics
  mirror and generated GraphQL SDL. No second migration or new test file.
- Reuse hosted pnpm/cache and Playwright CI contract tests.
- Exercise existing authoring and chat browser specs, plus real local synthetic
  responsive/locale captures. Keep local, intercepted and actual staging proof
  explicitly distinct.

### Delegation Map

| Work | Owner | Depends on | Acceptance |
| --- | --- | --- | --- |
| Plan and first-hop integration (steps 1–4) | Main | Planner approval | Reviewed source, exact-head checks and normal merge |
| Staging evidence map | Existing read-only explorer | Frozen public baseline | Exact source pointers and access/fixture gaps |
| Downstream integration (step 5) | Main | First merge | Reviewed current sync, required checks and normal merge |
| Runtime acceptance (step 5) | Main | Downstream merge and evidence map | Candidate receipt, deployed revision, migration and scoped smoke |

Staging smoke requires lecturer toggle save/reload, student control visibility and
local persistence, disabled-policy defaults, document parse/recovery and dictation
capability states. These controls can be checked without inference. Actual
provider-backed retry remains blocked without a separately authorized inference
budget; intercepted retry proves only browser behavior. Simulated recognition
does not prove actual on-device dictation or microphone acceptance.

## Progress

- Live source and target heads reconciled after fetch; existing sync PRs attached.
- Planner approved draft 2 after clarifying standing review authority and strengthening
  downstream ancestry, receipt and smoke acceptance. Optional AGY rival unavailable
  due to authentication/sandbox errors; no setup change attempted.
- Main retains coupled integration writes because each policy change crosses
  shared revision/API/UI seams; the explorer owns independent staging mapping.
- Source-only staging mapping is in progress. No merge started.
- Existing source CI is evidence for the merged feature source only. Integration
  checks, final review, merge and staging acceptance remain pending.
