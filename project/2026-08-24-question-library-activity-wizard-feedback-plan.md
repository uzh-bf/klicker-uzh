# Question library activity choices and wizard feedback plan

## Goal

Give every standard activity choice visible canonical guidance before wizard
entry. Use correct English and German singular/plural labels for element-
selection actions, and show the existing empty-block validation reason beside a
disabled final Create action.

ADR-0037 is authoritative: Practice Quiz, Microlearning, and Group Activity are
standard full-access capabilities. All four formats remain enabled and
uncrowned regardless of Catalyst entitlement.

## Non-goals

- Do not change Activity or Element identity, ownership, permissions, lifecycle,
  mutations, selection behavior, or creation results.
- Do not change Catalyst entitlement, availability, or authorization. Do not
  add Catalyst crowns, status copy, disabled states, gating, or Catalyst links
  to standard activity creation.
- Do not change the Formik/Yup validation schema or make an empty activity
  invalid when the current schema permits it; only explain an existing empty
  block.
- Do not redesign the mobile library, activity hierarchy, cancellation flow,
  wizard layout, or any concern outside this package's approved seams.
- Do not add dependencies, component-test infrastructure, forced clicks, waits,
  or locator workarounds for the resolved wizard/library overlap.
- Do not change devrouter, devcontainer, local-origin, environment, or Turborepo
  routing configuration.
- Do not push, create or update a PR, submit a stack, merge, deploy, write live
  state or secrets, change cluster state, clean up worktrees or branches, or
  delete runtime data.

## Execution contract

- Current authority is this explicitly approved replacement execution in the
  existing checkout.
- Ox Alpha owns replacement S1, plan `Progress`, repository-native checks,
  local commits, integration, and required native review gates. Native
  specialists are review gates, not slice owners.
- Pause conditions: the Ox Alpha route fails terminally; a required native
  reviewer is unavailable; devrouter cannot prove the exact checkout and fancy
  domains; acceptance needs a file outside owned seams; or implementation would
  change a product, data, security, architecture, entitlement, routing, or
  release contract.

## Plan identity

- Contract: ADR-0037-aligned replacement S1, followed by the already specified
  ICU/selector/empty-block slice and the narrowed documentation slice.
- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`.
- Reused checkout:
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/ux-review-question-library`.
- Branch: `rs/question-library-activity-wizard-feedback`.
- Current base:
  `d8e964c2847108d0f10fb2f3f696b37378619db8` (`origin/v3`, which accepts
  ADR-0037).
- Historical/superseded evidence: old base
  `7ea45772be3b177978de52e3ede7c95e34cec0b1`; old plan commit
  `a1c9853312907c923127ce81664f06890dd35c6e`; obsolete S1 commit
  `420ec8f2228594f1becb7dfaa11e4c229d95a280`; obsolete correction
  `e0340816e8bacd10b6408a7f7a404a04522343dd`.
- Material-change planner task
  `01a03490-059c-7381-adb8-91b77e89f5f9` accepted rebuilding S1 without
  Catalyst signaling because ADR-0037 makes the three formerly gated formats
  standard full-access capabilities.
- Pull request: none; all remote and publication actions are withheld.
- Authoritative roadmap:
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/question-library-feedback-recovery/project/2026-08-23-question-library-ux-audit-and-roadmap.md`
  on `rs/question-library-feedback-recovery` at `5d7c0284890db55a93da1cb66a1ca87ab03f2e0d`.

## Assumptions and resolved questions

- The existing step-one `liveQuizUseCase`, `microlearningUseCase`,
  `practiceQuizUseCase`, and `groupActivityUseCase` messages are canonical.
  This package reuses their full rich-text copy and links rather than shorter
  competing descriptions.
- Activity help must be visible before entry and available without hover. A
  composed choice region provides visible rich description text and programmatic
  association to its enabled button without nesting interactive controls.
- All four buttons remain enabled and uncrowned. Descriptions are visible
  rather than hover-only and remain outside their interactive buttons.
- Count labels select ICU `one` or `other` from the displayed selection count.
  The one-container action pluralizes its element count; the one-container-per-
  element action pluralizes its container count.
- The inline Create reason applies only when at least one live-quiz block has no
  elements. It reuses `minOneElementPerBlock`, stays adjacent to the final
  action, and disappears when the existing invariant becomes valid.
- The two selected-element actions in `AddStackButton` need distinct stable
  `data-cy` values so tests and assistive inspection can distinguish their
  different outcomes.
- The code has no dependency on the separate recovery branch. Rebuilding on the
  ADR-0037-bearing `origin/v3` preserves one PR-sized package and prevents the
  obsolete entitlement implementation from surviving branch history.

## Primitive impact and ADR gate

| Product primitive | Disposition | Contract delta | Affected composition | Evidence or ruling |
| --- | --- | --- | --- | --- |
| Activity type | Reuse | None | Four lecturer creation choices compose existing use-case guidance before wizard entry. | This package fixes presentation only. |
| Catalyst entitlement | Reuse | Standard activities leave its surface. | Creation choice guidance contains no Catalyst query, crown, status, disabled state, gating, or Catalyst link. | ADR-0037 supersedes ADR-0006's activity-entitlement statement. |
| Element selection | Reuse | None | Existing add-to-container and create-container actions gain precise count labels and unique selectors. | No selection behavior changes. |
| Activity wizard validation | Reuse | None | Existing empty-block invariant is surfaced beside final Create. | Existing Yup message and submit behavior remain authoritative. |

No primitive is created, retired, or extended. No new ADR is required. Re-arm
the ADR gate if implementation proposes a new help framework, entitlement or
availability semantics for standard activities, a shared validation
architecture, a persistent state change, or a different activity-creation
lifecycle.

## Skill routing

- `$rs-sliced-development-workflow` governs package ceremony, slice commits,
  verification cadence, native reviews, correction budget, and final delivery.
- `$rs-model-routing` governs specialist independence and review-gate routing.
  Exact Ox Alpha identity is binding; no implementation fallback.
- `$rs-product-primitives` records the primitive disposition above.
- Repository skills: `klicker-feature-design`, `klicker-frontend-ui`,
  `klicker-playwright-e2e`, `klicker-testing-verification`,
  `klicker-wiki-maintenance`, and `devrouter`.
- `$rs-local-runtime-lifecycle` governs runtime lifecycle boundaries. This
  task reuses the already-running exact checkout and must not start, stop, or
  repair it.
- The established repository plan format and the fully read sliced-workflow
  contract provide this plan's durable format.

## Research and current code evidence

- `CreationButton.tsx` currently renders an enabled button and has no
  description channel. It must not add Catalyst state or entitlement queries.
- `SuspendedCreationButtons.tsx` owns all four choice labels and click
  behavior, so it can supply each existing use-case description without
  changing wizard entry.
- The four information steps already render the canonical use-case message and
  link. They remain read-only contract sources.
- `AddStackButton.tsx` and `PasteSelectionButton.tsx` interpolate counts into
  fixed plural nouns. Existing message catalogs contain established ICU plural
  patterns in both locales.
- `AddStackButton.tsx` currently assigns the same `add-stack-with-selected`
  selector to two actions with different outcomes.
- `LiveQuizQuestionsStep.tsx` already receives Formik values, validity, and
  errors. `WizardNavigation.tsx` owns the final Create button and currently has
  no adjacent explanation channel.
- `B-feature-access.spec.ts` already covers free users opening all four
  wizards and enabled checks for lecturer/Catalyst accounts at the choice
  boundary.
- Existing live-quiz and microlearning Playwright journeys already reach their
  block/stack selection steps. Extend those journeys in S2 instead of adding a
  duplicate end-to-end creation flow.
- `docs/solutions/test-failure/playwright-activity-wizard-overlaps-element-library.md`
  records the shared layout fix. This package must not hide a layout regression
  with timing or locator changes.
- Upstream changes since the old audit base `ee5712399` include the accepted
  ADR-0037 standard-format contract; current origin/v3 does not gate these
  choices behind Catalyst.
- Devrouter fancy-domain/browser proof remains blocked by the known lifecycle-
  lock identity issue. Non-container checks must not fall back to host pnpm,
  localhost/fixed ports, or routing/configuration workarounds.
- Configured Gemini S1 reviewers failed before work with HTTP 402. Existing
  continuity reports cover only the superseded S1 and do not validate this
  replacement.
- The current execution route is Ox Alpha itself; no separate launch marker is
  applicable to this explicitly authorized in-place run.

## Planner review and disposition

The historical native planner returned `DONE_WITH_CONCERNS` for the old
contract.

Accepted findings:

- Use visible rich descriptions with programmatic button association; do not
  make tooltips or Catalyst status the explanation mechanism.
- Preserve all primitive, validation, mutation, and layout contracts.
- Split choice guidance, wizard feedback, and durable documentation into
  independently reviewable slices.
- Preserve upstream free-user coverage of all four wizards and extend it for
  four descriptions/links, enabled buttons for free and Catalyst users, and
  absence of Catalyst signaling.
- Treat the current devrouter route-lock identity error as a proof blocker, not
  permission to use localhost or modify routing configuration.

Historical disposition: the earlier planner rejected rebasing the separate
recovery branch. The accepted material-change planner later approved this
exact-base branch rewrite because ADR-0037 changed the product contract and the
obsolete S1 implementation must not survive branch history.

Historical planner provenance: original native planner task
`01a033f7-d98b-7261-94e6-ce85891e7913`; accepted material-change planner task
`01a03490-059c-7381-adb8-91b77e89f5f9`.

## Delegation map

| Workstream | Slices | Owner | Dependency | Acceptance boundary |
| --- | --- | --- | --- | --- |
| Activity guidance | Replacement S1 | Ox Alpha, sole writer | committed corrected plan | Four visible descriptions/links, stable associations/hooks, enabled paths, no Catalyst signaling, and non-browser checks pass. |
| Count and validation feedback | Replacement S2 | Ox Alpha, sole writer | accepted replacement S1 | Block and stack labels plus empty-block reason pass focused flow checks; browser proof remains gated. |
| Durable convention | Replacement S3 | Ox Alpha, sole writer | accepted replacement S1 and S2 | `docs/frontend-conventions.md` validates and matches verified behavior. |
| Reviews | replacement S1, S2, final | configured native specialists, review gates only | immutable commits | Findings are verified and dispositioned independently of Ox Alpha. |

No parallel implementation writer is permitted because both UI slices share
activity creation, Playwright coverage, and the same exact runtime.

## Feature-wide test portfolio

| Behavior or risk | Test obligation | Primary seam | Distinct realistic failure protected against | Owning slice |
| --- | --- | --- | --- | --- |
| All four choices explain the activity before entry | extend existing | `B-feature-access.spec.ts` | Enabled choices remain unexplained or rich links disappear. | Replacement S1 |
| Choices preserve full access | extend existing | same spec | Any account sees disabled controls or Catalyst signaling. | Replacement S1 |
| Choice help is visible, not hover-only, and not nested-interactive | static association assertions now; browser/accessibility proof remains blocked | composed choice region | Help becomes hover-only or interactive controls nest. | Replacement S1 |
| Block labels select correct singular/plural | extend existing | `O-live-quiz.spec.ts` step-four journey | One element renders plural, or many containers render singular. | Replacement S2 |
| Stack labels select correct singular/plural | extend existing | `P-microlearning.spec.ts` stack journey | Shared component's stack branch remains unverified and regresses. | Replacement S2 |
| Selection actions have unique stable selectors | extend existing | block/stack action assertions | Tests select the wrong one of two semantically different buttons. | Replacement S2 |
| Empty block explains disabled Create and recovers | extend existing | `O-live-quiz.spec.ts` existing empty-block state | Create stays opaque, reason persists after fill/delete, or validity changes. | Replacement S2 |
| Shared wizard/library layout remains usable | browser regression when the gate is resolved | desktop and narrow view | New description height causes clipping, overlap, or intercepted controls. | Replacement S1/S2 |
| Paired EN/DE copy and ICU syntax | existing catalogs remain unchanged; browser evidence when the gate is resolved | both message files | Missing locale key, malformed ICU, or locale-divergent meaning. | Replacement S1/S2 |
| Durable frontend convention | none | verified documentation only | No executable behavior introduced. | Replacement S3 |

No new component-test layer is added. If extending the microlearning journey in
S2 cannot assert the stack branch without a duplicate expensive flow, stop and
return the exact test-seam evidence rather than silently weakening coverage.

## Slices

### Replacement S1 — explain standard activity choices

Owned files:

- `apps/frontend-manage/src/components/activities/creation/CreationButton.tsx`
- `apps/frontend-manage/src/components/activities/creation/SuspendedCreationButtons.tsx`
- `playwright/tests/B-feature-access.spec.ts`
- this plan for `Progress` only.

Implementation and acceptance:

- Starting from origin/v3's standard-format implementation, add each existing
  canonical `manage.activityWizard.*UseCase` rich description and its exact
  information-step link below the corresponding button.
- Associate each rendered description with its button through
  `aria-describedby` and expose a stable distinct
  `description-<button-data-cy>` hook.
- Keep links outside the button, preserve all four enabled click paths and
  unrelated comments/behavior, and add no UserProfile/Catalyst query, crown,
  Catalyst prop/copy/link, disabled state, entitlement check, or i18n key.
- Preserve upstream free-user open/cancel coverage and extend it for four
  descriptions/links, enabled standard buttons for free and Catalyst users, and
  absence of Catalyst status hooks/signaling in the choice region.
- Run only the authorized non-browser checks through the already-running exact
  container: changed-file Prettier, Biome for source files, Manage check,
  Playwright TypeScript check, and `git diff --check`.
- Commit: `enhance(manage): explain activity creation choices`.

Post-slice gate: run the configured native simplifier and slice reviewer over
the immutable replacement-S1 range when available. Apply only verified findings;
record unavailable reviewers as blockers rather than substituting another
provider silently.

### Replacement S2 — correct selection labels and explain disabled Create

Owned files:

- `apps/frontend-manage/src/components/activities/creation/AddStackButton.tsx`
- `apps/frontend-manage/src/components/activities/creation/PasteSelectionButton.tsx`
- `apps/frontend-manage/src/components/activities/creation/WizardNavigation.tsx`
- `apps/frontend-manage/src/components/activities/creation/liveQuiz/LiveQuizQuestionsStep.tsx`
- count and validation message regions in `packages/i18n/messages/en.ts`
- matching regions in `packages/i18n/messages/de.ts`
- `playwright/tests/O-live-quiz.spec.ts`
- `playwright/tests/P-microlearning.spec.ts`
- this plan for `Progress` only.

Implementation and acceptance:

- Convert `newBlockSelected`, `newStackSelected`,
  `pasteSelectionElements`, `pasteSingleElementsBlock`, and
  `pasteSingleElementsStack` to ICU `one`/`other` messages that describe the
  actual result for one and many selections.
- Give the one-container and one-container-per-element actions distinct stable
  selectors while preserving their behavior.
- Add a narrow optional disabled-reason channel to `WizardNavigation`; render it
  adjacent to final Create and programmatically associate it with the action.
- In the live-quiz final step, supply the existing localized
  `minOneElementPerBlock` reason only while at least one block is empty. Do not
  change validation, submission, zero-block behavior, or other activity wizards.
- Extend existing block and stack journeys for one/many labels and selectors.
  Extend the existing live-quiz empty-block assertion to cover visible reason,
  disappearance after recovery, and unchanged Create validity.
- Check changed-file formatting, Manage typecheck, Playwright type/list checks,
  focused O and P tests, paired ICU catalogs, and bilingual browser states when
  the browser gate is resolved.
- Commit: `fix(manage): clarify activity wizard actions`.

Post-slice gate: run the configured native simplifier and slice reviewer in
parallel over the immutable replacement-S2 range. Lenses are exact count
semantics, shared
navigation compatibility, accessibility association, Formik/Yup preservation,
test stability, and strict scope.

### Replacement S3 — record the reusable frontend convention

Owned files:

- `docs/frontend-conventions.md`
- this plan for `Progress` only.

Prohibited files: `docs/index.md`, `docs/log.md`, and `docs/log/` under
current AGENTS.md.

Implementation and acceptance:

- Document that domain-specific choices expose visible linked explanations
  before commitment, count labels use ICU on the displayed count, distinct
  actions use unique selectors, and disabled final actions expose their
  recoverable reason nearby.
- Cite verified symbols, preserve the existing overlap solution, and avoid a
  general tooltip or validation abstraction claim.
- Validate the wiki, format/check changed Markdown, inspect links and cited
  symbols, and audit the documentation diff against implemented behavior.
- Commit: `docs(frontend): document activity choice feedback`.

No separate slice reviewer is required for replacement S3 because it only
records verified behavior and introduces no executable risk.

## Runtime, browser evidence, and final verification

Runtime contract:

- Use the already-running exact checkout runtime and run repository checks with
  its exact-path `devrouter exec` form. Do not start, stop, repair, or
  reconfigure the runtime.
- Run repository checks through
  `devrouter exec <absolute-checkout-path> -- ...` inside the exact DevPod.
  Do not use host pnpm, bare DevPod/Docker lifecycle commands, manual routes,
  localhost fixed ports, or another checkout's runtime.
- Browser validation uses only the fancy namespaced origins:
  `https://manage.klicker.rs-ux-review-question-library.localhost` and
  `https://api.klicker.rs-ux-review-question-library.localhost`.
- The known lifecycle-lock identity issue blocks fancy-domain/browser proof.
  Do not alter routing config or claim browser/release readiness without it.

Browser evidence matrix:

| State | Locale and viewport | Required evidence |
| --- | --- | --- |
| All choices | EN and DE, 1440×900 | Four visible descriptions/links and unchanged enabled actions for every account. |
| Live quiz block actions | EN and DE, 1440×900 | One/many labels, unique actions, empty-block reason beside disabled Create, and cleared reason after recovery. |
| Microlearning stack actions | EN and DE, 1440×900 | One/many stack labels and distinct outcomes. |
| Narrow layout regression | EN and DE, 390×844 | No new clipping, horizontal overflow, wizard/library overlap, or blocked controls; W8 mobile redesign remains out of scope. |
| Keyboard semantics | desktop width | Description links are focusable, help is not hover-only, and no nested interactive controls exist. |

Fresh final checks, all produced by the exact runtime unless stated otherwise:

1. Changed-file Prettier and source Biome checks through the exact container.
2. Manage and Playwright TypeScript checks through the exact container.
3. Complete base-to-head diff accounting, staged secret/PII scan, and
   comment/diff-scope audit.
4. Fancy-domain request evidence remains blocked by the lifecycle-lock issue.

## Integrated review and delivery

- After all slice commits and fresh verification, dispatch one configured
  native `final-reviewer` over the complete committed package range when
  available.
- Review lenses: correctness, plan compliance, user workflow, bilingual i18n,
  accessibility, shared navigation compatibility, test sufficiency,
  maintainability, bounded frontend security, and diff scope.
- Verify every finding before applying it. One integrated correction round is
  available; rerun every materially affected check.
- Finalize plan `Progress` in a local commit and report commits, checks,
  review disposition, blocked browser/runtime proof, and remaining withheld
  actions. No push, PR, merge, deploy, cleanup, or deletion follows without
  separate authority.

## Risks and stop conditions

- A visible description can increase the activity-choice row height. Treat
  clipping, overflow, overlap, and displaced controls as a product regression,
  not a test timing problem.
  overflow, overlap, or displaced controls as a product regression, not a test
  timing problem.
- Interactive links must stay outside buttons. Stop if valid focus order and
  programmatic association need a new abstraction or dependency.
- Shared `WizardNavigation` serves all activity types. Keep the new reason
  optional and prove unaffected callers compile and render unchanged.
- ICU syntax errors can fail at runtime despite typechecking. Replacement S1
  reuses existing catalogs unchanged; actual EN/DE rendering proof for S2
  counts remains gated.
- If exact Ox Alpha execution becomes unavailable, stop. Do not silently use
  another provider for implementation.
- If current upstream changes touch an owned seam before the first commit,
  rerun mapping and planner review instead of implementing against stale facts.

## Manual evidence expected at end

- Command/result ledger for targeted non-container checks, diff hygiene, native
  reviews when available, and unresolved fancy-domain/browser blockers.

## Progress

- Status: replacement S1 implemented and committed; S2/S3 remain after it.
- Completed: exact-base history rewrite to ADR-0037-bearing `origin/v3`;
  corrected plan restored from the old plan commit and rebuilt without obsolete
  Catalyst signaling requirements; no new worktree and no runtime/config/routing
  changes occurred.
- Blockers: fancy-domain/browser proof remains blocked by the known devrouter
  lifecycle-lock identity issue. Fresh configured native simplifier and
  slice-reviewer attempts for replacement S1 both failed before work with
  provider HTTP 402. The approved no-substitution review gate therefore blocks
  S2. Generic continuity reports exist only for superseded S1 and do not
  validate this replacement.
- Current S1 evidence: four canonical rich descriptions with exact links added
  below each standard creation button; each button uses `aria-describedby` to
  its distinct `description-<data-cy>` region; all click paths remain enabled;
  no Catalyst query/crown/status/disabled behavior or i18n change was added.
  Upstream free-user open/cancel coverage was preserved and extended with
  description/link/enabled/no-Catalyst-signaling assertions for free and
  lecturer/Catalyst checks. Prettier, package-scoped Biome,
  frontend-manage check, Playwright TypeScript check, and `git diff --check`
  passed through the exact container. A mistaken repo-wide Biome run touched
  unrelated tracked files; all were restored to committed state before staging,
  and only the three owned files plus this Progress update are in scope now.
- Remaining: native simplifier/slice review when available, S2, narrowed S3,
  integrated review when available, fancy-domain/browser proof behind the
  lifecycle-lock gate, and final Progress evidence.
- Withheld: push, PR or stack mutation, merge, deployment, live or secret writes,
  cluster changes, cleanup, deletion, and publication claims.
- Next action: run available native reviews over the committed S1 range, then
  proceed to replacement S2 without runtime/browser/publication actions.
