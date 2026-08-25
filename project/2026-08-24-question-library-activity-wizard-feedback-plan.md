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
- Except for the official devrouter 0.0.37 consumer version pin and generated
  guidance prerequisite, do not change devrouter, devcontainer, local-origin,
  environment, application routes, or Turborepo routing configuration.
- Do not push, create or update a PR, submit a stack, merge, deploy, write live
  state or secrets, change cluster state, clean up worktrees or branches, or
  delete runtime data.

## Execution contract

- Current authority is this explicitly approved replacement execution in the
  existing checkout.
- Ox Alpha owns replacement S1, plan `Progress`, repository-native checks,
  local commits, integration, and required review gates. Configured native
  specialist roles remain preferred and are review gates, not slice owners.
- The user's 2026-08-24 ruling authorizes independent read-only alternate review
  agents when those configured roles are unavailable: Luna for simplification
  and a separate Sol agent for correctness, risk, and integrated final review.
  Reviewers remain independent of Ox Alpha execution.
- This alternate-review authorization covers replacement S1, S2, and the
  integrated final review. It changes no runtime, browser, routing, lifecycle,
  publication, or cleanup boundary.
- The user's current explicit authority additionally covers the official
  devrouter 0.0.37 shared-readiness consumer prerequisite, canonical exact W2
  revalidation, and the final non-destructive exact-runtime stop. It does not
  authorize manual route, TLS, or certificate changes.
- Pause conditions: the Ox Alpha route fails terminally; an authorized alternate
  reviewer is unavailable after a configured-role failure; a material review
  finding remains unresolved; devrouter cannot prove the exact checkout and
  fancy domains; acceptance needs a file outside owned seams; or implementation
  would change a product, data, security, architecture, entitlement, routing,
  or release contract.

## Plan identity

- Contract: ADR-0037-aligned replacement S1, followed by the already specified
  ICU/selector/empty-block slice and the narrowed documentation slice.
- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`.
- Reused checkout:
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/ux-review-question-library`.
- Branch: `rs/question-library-activity-wizard-feedback`.
- Current base:
  `4d8d654b2c6e85b72fe89b4bfc68c7dd9f934c93` (the current rebased
  ADR-0037-bearing branch base). The latest fetched `origin/v3` is
  `1d19ad9efc6e7af57cff2b805255b4746de25c29`; its three newer CI,
  deployment, and documentation commits do not overlap W2 paths. The clean
  branch is 14 commits ahead and 3 behind; no third rebase was performed.
- Historical/superseded evidence: old base
  `7ea45772be3b177978de52e3ede7c95e34cec0b1`; old plan commit
  `a1c9853312907c923127ce81664f06890dd35c6e`; obsolete S1 commit
  `420ec8f2228594f1becb7dfaa11e4c229d95a280`; obsolete correction
  `e0340816e8bacd10b6408a7f7a404a04522343dd`.
- Material-change planner task
  `01a03490-059c-7381-adb8-91b77e89f5f9` accepted rebuilding S1 without
  Catalyst signaling because ADR-0037 makes the three formerly gated formats
  standard full-access capabilities.
- Draft PR #5546 exists, and normal pushes are complete. PR merge, mark-ready,
  deployment, publication, cleanup, and deletion remain withheld.
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
  exact runtime is stopped; canonical devrouter ensure/exec and the final
  non-destructive exact stop are authorized after the official 0.0.37
  adaptation. Manual route, TLS, and certificate repair remain withheld.
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
- Historical canonical exact-checkout HTTPS readiness failed with curl error
  60. The committed devrouter 0.0.37 consumer adaptation resolved the W2
  readiness path, and exact-domain browser proof later passed without
  localhost/fixed ports or routing/configuration workarounds.
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
- Treat canonical exact-checkout HTTPS readiness failure as a proof blocker,
  not permission to use localhost or modify routing configuration.

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
| Count and validation feedback | Replacement S2 | Ox Alpha, sole writer | accepted replacement S1 | Block and stack labels plus empty-block reason pass focused static and exact-domain browser flow checks; repository Playwright execution remains environment-blocked. |
| Durable convention | Replacement S3 | Ox Alpha, sole writer | accepted replacement S1 and S2 | `docs/frontend-conventions.md` validates and matches verified behavior. |
| Reviews | replacement S1, S2, final | configured native specialists preferred; authorized Luna simplification and separate Sol correctness/risk/final alternates when unavailable | immutable commits | Read-only findings are verified and dispositioned independently of Ox Alpha; unavailable alternates or unresolved material findings stop progression. |

No parallel implementation writer is permitted because both UI slices share
activity creation, Playwright coverage, and the same exact runtime.

## Feature-wide test portfolio

| Behavior or risk | Test obligation | Primary seam | Distinct realistic failure protected against | Owning slice |
| --- | --- | --- | --- | --- |
| All four choices explain the activity before entry | extend existing | `B-feature-access.spec.ts` | Enabled choices remain unexplained or rich links disappear. | Replacement S1 |
| Choices preserve full access | extend existing | same spec | Any account sees disabled controls or Catalyst signaling. | Replacement S1 |
| Choice help is visible, not hover-only, and not nested-interactive | static association assertions and exact-domain browser/accessibility proof passed | composed choice region | Help becomes hover-only or interactive controls nest. | Replacement S1 |
| Block labels select correct singular/plural | extend existing | `O-live-quiz.spec.ts` step-four journey | One element renders plural, or many containers render singular. | Replacement S2 |
| Stack labels select correct singular/plural | extend existing | `P-microlearning.spec.ts` stack journey | Shared component's stack branch remains unverified and regresses. | Replacement S2 |
| Selection actions have unique stable selectors | extend existing | block/stack action assertions | Tests select the wrong one of two semantically different buttons. | Replacement S2 |
| Empty block explains disabled Create and recovers | extend existing | `O-live-quiz.spec.ts` existing empty-block state | Create stays opaque, reason persists after fill/delete, or validity changes. | Replacement S2 |
| Shared wizard/library layout remains usable | exact-domain desktop and narrow browser evidence completed; existing later-step W8 fixed-width debt recorded separately | desktop and narrow view | New description height causes clipping, overlap, or intercepted controls. | Replacement S1/S2 |
| Paired EN/DE copy and ICU syntax | five existing paired keys use ICU `one`/`other`; bilingual exact-domain rendering passed | both message files | Missing locale key, malformed ICU, or locale-divergent meaning. | Replacement S1/S2 |
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
the immutable replacement-S1 range when available. If either configured role is
unavailable, use an independent Luna alternate for simplification and a separate
Sol alternate for correctness and risk under the user's 2026-08-24 ruling.
Apply only verified findings; unavailable alternates or unresolved material
findings stop progression.

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
parallel over the immutable replacement-S2 range. If either configured role is
unavailable, use an independent Luna alternate for simplification and a separate
Sol alternate for correctness and risk. Lenses are exact count semantics,
shared navigation compatibility, accessibility association, Formik/Yup
preservation, test stability, and strict scope. Unavailable alternates or
unresolved material findings stop progression.

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

- The official devrouter 0.0.37 consumer version pin and generated guidance are
  the only authorized configuration changes. Canonical exact-checkout
  verification and the final non-destructive exact stop are complete.
- Verification used `devrouter ensure`, exact-path `devrouter exec`, and
  `devrouter stop`. It did not use bare DevPod/Docker lifecycle commands,
  manual routes, localhost fixed ports, or another checkout's runtime.
- Browser validation uses only the fancy namespaced origins:
  `https://manage.klicker.rs-ux-review-question-library.localhost` and
  `https://api.klicker.rs-ux-review-question-library.localhost`.
- Historical canonical exact-checkout HTTPS readiness failed with curl error
  60. The committed devrouter 0.0.37 adaptation resolved that readiness path;
  the exact-domain browser matrix passed without routing changes.

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
4. Exact-domain readiness and browser evidence passed after the devrouter
   0.0.37 consumer adaptation; the earlier curl error 60 remains historical
   diagnostic evidence.

## Integrated review and delivery

- After all slice commits and fresh verification, dispatch the configured native
  `final-reviewer` over the complete committed package range when available. If
  that role is unavailable, use an independent Sol alternate under the user's
  2026-08-24 ruling.
- Review lenses: correctness, plan compliance, user workflow, bilingual i18n,
  accessibility, shared navigation compatibility, test sufficiency,
  maintainability, bounded frontend security, and diff scope.
- Verify every finding before applying it. One integrated correction round is
  available; rerun every materially affected check. An unavailable Sol
  alternate or an unresolved material finding stops delivery.
- Finalize plan `Progress` in a local commit and report commits, checks,
  review disposition, browser/runtime evidence, and remaining withheld actions.
  No push, PR, merge, deploy, cleanup, or deletion follows without separate
  authority.

## Risks and stop conditions

- A visible description can increase the activity-choice row height. Treat
  clipping, overflow, overlap, and displaced controls as a product regression,
  not a test timing problem.
- Interactive links must stay outside buttons. Stop if valid focus order and
  programmatic association need a new abstraction or dependency.
- Shared `WizardNavigation` serves all activity types. Keep the new reason
  optional and prove unaffected callers compile and render unchanged.
- ICU syntax errors can fail at runtime despite typechecking. Exact-domain EN/DE
  rendering proved the S2 count labels after the paired catalog changes.
- If exact Ox Alpha execution becomes unavailable, stop. Do not silently use
  another provider for implementation.
- If current upstream changes touch an owned seam before the first commit,
  rerun mapping and planner review instead of implementing against stale facts.

## Manual evidence expected at end

- Command/result ledger for targeted checks, diff hygiene, reviews, exact-domain
  browser evidence, and the environment-blocked repository Playwright run.

## Progress

- Status: W2 is locally complete through its authorized terminal condition.
  Implementation, checks, exact devrouter proof, independent review, evidence,
  and non-destructive shutdown are complete. The current HEAD before this
  review-disposition commit is
  `3b0b2704f2fdb3d5d9f9bbbd36d6f03a121c477e`.
- Freshness: before this plan edit, the branch was clean, 17 commits ahead and
  4 behind `origin/v3`. The four upstream-only commits remain limited to CI,
  deployment, and documentation paths with no W2 overlap; no further rebase
  was performed.
- Independent Sol integrated final review of HEAD `b4c5e516d` found one
  actionable P3: the dynamically changing empty-block validation reason lacked
  a polite live region. All other package lenses were accepted, including W2
  scope, devrouter 0.0.37, the Playwright runtime-blocker disclosure, and the W8
  debt classification. The finding was verified against the current Web
  Interface Guidelines rule that asynchronous validation updates need
  `aria-live="polite"`.
- Correction commit `eefb977d5b449a8b5c4f645727e8fcc09605660d` keeps the
  final-step reason mounted as a stable `aria-live="polite"` region, preserves
  conditional `aria-describedby` only while a reason exists, and extends the O
  journey across invalid and recovery transitions.
- Correction checks passed: Biome format/check, Prettier, frontend-manage
  check, Playwright check, O-spec collection with 81 tests, `git diff --check`,
  full commit hooks, staged secret/credential/PII audit, and a clean worktree.
- Independent Sol correction readback reviewed immutable HEAD
  `3b0b2704f2fdb3d5d9f9bbbd36d6f03a121c477e` over `origin/v3...HEAD` and
  returned ACCEPTED with zero P0-P3 findings. It verified that the prior P3 is
  fully resolved by the stable `aria-live="polite"` region, conditional
  `aria-describedby`, repeated O-spec recovery assertions, exact EN/DE
  fancy-domain proof, and canonical zero-route shutdown evidence.
- Current-base static verification passed sequentially: feature-flags build;
  GraphQL build with warnings only; frontend-manage check; Playwright check; B,
  O, and P collection with 154 tests in 3 files; Biome format for all 8 changed
  non-Playwright TS/TSX/i18n files; Prettier for all 7 changed
  Markdown/YAML/Playwright files; base-to-head `git diff --check`; and a clean
  worktree before this evidence update.
- Correction-specific exact devrouter proof passed on the current HEAD after
  one transient 502 attempt and one discarded invalid container-origin probe.
  Fancy-domain HTTPS is host-facing; the producing run used only host-side
  exact namespaced URLs, and the discarded container curl error 7 is not a
  product or runtime failure. Three consecutive producing rounds returned
  Manage 200, Auth 200, PWA 200, and API 404. Required processes were present,
  and bounded logs contained no relevant crash, OOM, kill, Turbo failure, or
  compile error.
- Final current-base exact-domain smoke passed through the exact Auth route with
  the documented seeded local lecturer account at
  `https://manage.klicker.rs-ux-review-question-library.localhost/`. EN and DE
  each showed all four visible descriptions, enabled creation actions, exact
  canonical use-case links opening in a new tab, matching
  `aria-describedby` associations, and zero Catalyst text, links, hooks, or
  crown icons. Ox visual readback found no apparent clipping or overlap at
  1440x900.
- Final screenshots are gitignored at
  `project/_local/evidence/w2-runtime-2026-08-25/current-base-home-en-1440x900.png`
  and
  `project/_local/evidence/w2-runtime-2026-08-25/current-base-home-de-1440x900.png`.
- Earlier exact-domain browser evidence on the equivalent implementation passed
  the four-choice region in EN and DE at 1440x900 and 390x844. All four actions
  remained enabled, explanation links were independent rather than nested, and
  desktop keyboard order reached both creation controls and links correctly.
- Live quiz EN and DE browser flows passed singular/plural labels, distinct
  outcome actions, one-block-per-element placement, the empty-block disabled
  reason and `aria-describedby` association, recovery after deleting the empty
  block, and draft cancellation without submission.
- The final accessibility proof showed the same stable reason DOM node in EN
  and DE. In the valid state it was empty, Create was enabled, and
  `aria-describedby` was absent. An empty block produced the localized reason,
  disabled Create, and associated Create with the reason. Recovery left the
  same node empty, re-enabled Create, and removed `aria-describedby`; both
  unsaved flows were cancelled.
- Correction screenshots are gitignored at
  `project/_local/evidence/w2-runtime-2026-08-25/activity-validation-reason-en-invalid-1440x900.png`
  and
  `project/_local/evidence/w2-runtime-2026-08-25/activity-validation-reason-de-invalid-1440x900.png`.
- Microlearning EN and DE browser flows passed singular/plural labels, distinct
  existing-stack, new-stack, and one-stack-per-element outcomes, expected
  placement/removal behavior, and draft cancellation without submission.
- Narrow later-step checks exposed existing global/fixed-width W8 debt outside
  the W2 choice-region scope: live-quiz blocks and microlearning stacks require
  horizontal document scrolling, and the German global navigation overlaps.
  This is recorded debt, not a W2 regression, a claimed W2-complete mobile
  redesign, or a reason to weaken the passing choice-region evidence.
- Focused repository B/O/P Playwright runtime execution remains locally blocked
  because the exact container lacks a complete Chromium/headless-shell payload.
  The producing attempt passed 1 cleanup test and had 7 browser-launch failures.
  Subsequent repository-native installation attempts timed out and left partial
  or corrupt browser artifacts without tracked source, package, or lockfile
  changes. Exact agent-browser coverage supplies the completed user-path proof;
  repository Playwright runtime success is not claimed.
- The repository Playwright browser-payload blocker and existing W8 later-step
  narrow-layout debt remain exactly as disclosed. Neither is a W2 defect or a
  passing-runtime claim.
- Historical readiness failures are resolved for W2 by the committed devrouter
  0.0.37 consumer adaptation: the prior CA-validated 755-SAN path failed with
  curl error 60 while OpenSSL accepted it and an exact served-leaf pin returned
  HTTP 204. Current exact namespaced domains work, and readiness preserves CA,
  hostname, SNI, and HTTP-status checks against the served leaf without `-k`.
  Append-only SAN growth remains unresolved, including the observed 295 stale
  SANs; no manual route, TLS, certificate, or SAN change was made.
- Final lifecycle after the current-HEAD proof is complete: the browser session
  was closed and absent; canonical stop freed 10 routes; provider state was
  `Stopped`; route state was absent; and the exact W2 route count was 0. No new
  worktree or manual Docker, DevPod, route, TLS, certificate, or lock edit
  occurred.
- Delivery state: draft PR #5546 exists, and its separately authorized normal
  branch pushes are complete. PR merge, mark-ready, deployment, publication,
  cleanup, and deletion remain withheld.
- Final-review closure at `fb86b209a`: the prior committed Progress predates
  `b1d7b730a` and `fb86b209a`. `b1d7b730a` stabilized O/P activity-wizard
  selection coverage, and branch-owned CI Playwright shards 1 and 3 passed. The
  unchanged shard-8 cleanup test `MA-elements-operations.spec.ts` failed twice
  in cleanup; the branch does not touch that test, and no further retry is
  authorized or appropriate. `fb86b209a` removed empty-state layout height while
  preserving the mounted polite live region. Exact namespaced devrouter/browser
  proof measured the visible reason at 20px with `gap-1` and the empty region at
  0px without `gap-1` or `aria-describedby`; Create changed from disabled to
  enabled as the block became valid. That proof used devrouter workspace
  `rs-ux-review-question-library` and canonical
  `https://manage.klicker.rs-ux-review-question-library.localhost`. The focused
  frontend-manage type check and Biome passed, the pre-push full build passed,
  and runtime shutdown left zero routes and no exact-workspace containers.
  Independent final review at `fb86b209a` found no code defects and only this
  stale Progress record. At the time of this record, current-head CI had 16
  successes, 13 intentional skips, 0 failures, and 3 pending checks (Playwright,
  OpenCodeReview, and Final AI review); terminal CI is not claimed. Merge,
  mark-ready, deployment, deletion/cleanup, and screenshot attachment remain
  withheld. PR delivery remains gated on terminal required CI/reviews and
  screenshot attachment.
- OpenCodeReview correction `PRRT_kwDOBXNwx86cPzOy`: the parent gap in
  `WizardNavigation.tsx` now uses `lastStep && disabledReason`, matching the
  mounted feedback condition. `devrouter exec . -- pnpm exec biome check
  apps/frontend-manage/src/components/activities/creation/WizardNavigation.tsx`
  passed, and `devrouter exec . -- pnpm --filter
  @klicker-uzh/frontend-manage run check` passed. Browser proof at
  `https://manage.klicker.rs-ux-review-question-library.localhost` showed the
  invalid final state with a 4px gap, 20px polite live feedback, disabled
  Create, and `aria-describedby`; the valid final state kept an empty mounted
  polite live region at 0px, with no gap, enabled Create, and no
  `aria-describedby`. Screenshots are
  `/private/tmp/pr5546-final-disabled-reason-visible.png` and
  `/private/tmp/pr5546-final-disabled-reason-empty.png`. The synthetic quiz
  was canceled.
- Sol final review found one P3: Progress still described push and PR creation
  as future after draft PR #5546 and its normal branch pushes were complete.
  The pending normal merge reconciliation brings `origin/v3` at
  `b8ce110513a65dc5f882f3adc3676a489cfdeb94` into branch head `f4d061e48`.
  Its only conflict, `.devrouter.yml`, keeps upstream's profile-scoped
  configuration and comments. Config validation rejected `profiles` with the
  staged 0.0.37 pin; official devrouter 0.0.38 is installed and now pinned.
  The merge and plan changes are staged but uncommitted and unpushed.
  Post-merge CI, browser, and devrouter validation remain pending and are not
  claimed. PR merge, mark-ready, and deployment remain withheld.
- Post-merge proof used official devrouter CLI and config 0.0.38. `doctor`
  reported 23 ok, 3 unrelated warnings, 0 errors, and a valid `repo.config`.
  `ensure --profile manage` returned profile `manage` and only the canonical
  API, Auth, and Manage routes; the runtime log started exactly
  `backend-docker`, `auth`, and `frontend-manage`. The frontend-manage check
  passed. Browser proof at
  `https://manage.klicker.rs-ux-review-question-library.localhost` measured the
  invalid final state with a 4px gap, 20px polite live region, disabled Create,
  and `aria-describedby`; the valid state kept the polite live region mounted
  and empty at 0px, used the normal gap with no added gap, enabled Create, and
  omitted `aria-describedby`. Screenshots are
  `/private/tmp/pr5546-merge-final-disabled.png` and
  `/private/tmp/pr5546-merge-final-valid.png`. The synthetic activity was
  canceled, the browser was closed, and the workspace was stopped with zero
  routes and no exact `default-rs-315ff` containers. CI and reviews after push
  remain pending; PR merge, mark-ready, and deployment remain withheld.
- Official devrouter 0.0.38 default-profile verification after merge commit
  `5d1c41417109bf7592a7959d73ea10e8084d084a` also passed. `ensure . --json`
  returned profile `full`; all readiness contracts passed; and all 10 canonical
  namespaced routes were present: `api`, `auth`, `pwa`, `manage`, `control`,
  `olat-api`, `response-api`, `db` over TCP/Postgres, `lti`, and `chat`. The
  exact workspace stop freed 10 routes; follow-up verification found zero
  matching routes and no `default-rs-315ff` containers.

### Historical execution evidence before final runtime proof

- The ADR-0037 history rewrite, S1 through S3, and the bounded correction were
  accepted by their independent Luna and Sol review passes. Configured native
  review roles and later configured Gemini attempts failed before work with
  upstream HTTP 402; the user-authorized alternate-review route supplied the
  recorded independent dispositions without changing implementation ownership.
- Before devrouter 0.0.37, three canonical exact-checkout ensures failed during
  HTTPS readiness. The third attempt returned curl error 60 for all nine probes
  even though internal Manage returned 200, and the failed ensure rolled the W2
  routes back to zero. This is historical failure evidence, not current W2
  readiness status.
- Historical diagnostics found a 52,538-byte shared certificate with 755 DNS
  SANs and 458 running routes. SAN/route scale was only a plausible cause. The
  deterministic synthetic result and the 295 stale SAN count established the
  readiness and append-only-growth concerns without proving one root cause.
- Installed and repository devrouter 0.0.37 static checks passed before runtime
  revalidation. The adaptation fixed the readiness probe path but did not claim
  SAN pruning, and no manual route, TLS, certificate, or runtime workaround was
  used.
