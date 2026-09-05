# Course Header Overflow Actions Plan

## Goal

Reduce the course overview header's seven peer actions to a clear hierarchy:
make the contextual course action primary, keep only frequent actions visible,
move low-frequency actions into the existing design-system dropdown, and remove
the primary treatment from Learning Analytics.

The change stays on the existing `course-duplication` branch and is folded into
PR #4954. It does not change course duplication semantics or any backend
contract.

## Plan identity

- Plan path: `project/2026-08-10-pr4954-course-header-overflow-plan.md`
- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`
- Worktree: `trees/course-duplication`
- Branch: `course-duplication`
- Pull request: https://github.com/uzh-bf/klicker-uzh/pull/4954
- Target branch: `v3`
- Base checked after fetch: `origin/v3` at `0d7b4e46126f2f01931f07deccbd719ad0c163a5`
- Starting head: `e2cb394c811c96717e6761d63e528aec2af5f88f`
- Starting divergence: 9 commits behind and 31 commits ahead of `origin/v3`
- Planning review: Sol completed a read-only planning pass and returned
  `DONE_WITH_CONCERNS`; the concerns below are implementation gates.

## Approved product decision

Use the contextual hierarchy recommended by Sol.

| Course type | Primary action | Visible secondary actions | More course actions |
| --- | --- | --- | --- |
| Ordinary course with an eligible join action | Join course | Modify course, View Comments | Share course, Duplicate course, Learning Analytics, LTI Links |
| Assessment course | Assessment results | Modify course, View Comments | Share course, Duplicate course, Learning Analytics, Point Corrections, LTI Links |

If no contextual primary action is eligible, leave the row without a primary
fallback. Learning Analytics is never a fallback primary.

The overflow trigger is a labelled ellipsis control with the localized name
`More course actions`. It must retain an accessible name, semantic button
behavior, visible focus, keyboard navigation, Escape dismissal, and focus return.
The action grouping is the same at every viewport; the reduced row may wrap,
but it must not render duplicate breakpoint-specific controls.

## Non-goals

- No GraphQL, Prisma, API, database, permission-model, or course-duplication
  behavior changes.
- No new dependency, component-test layer, branch, or pull request.
- No merge, push, deployment, or PR publication in this task.
- No change to existing feature-flag or role conditions.

## Evidence and constraints

- `apps/frontend-manage/src/components/courses/CourseOverviewHeader.tsx`
  currently renders up to seven sibling actions; Learning Analytics is the only
  `primary` action.
- The existing design-system `Dropdown` already supports React-node triggers,
  submenu items, Radix keyboard behavior, and focus restoration.
- `QRCodePopover` currently has only `basic` and `button` trigger styles. The
  approved Join-course primary treatment therefore needs a small, local trigger
  style extension or an equivalent design-system composition.
- `docs/frontend-conventions.md` is the owning wiki page for frontend
  conventions, i18n, and design-system usage. Its timestamp and a dated log
  entry must be updated with the behavior change.
- The branch is stale relative to `origin/v3`; synchronization is approved but
  must be completed before implementation. Preserve unrelated working-tree
  changes if they appear.

## Implementation slices

### Slice 1: plan checkpoint

Files:

- `project/2026-08-10-pr4954-course-header-overflow-plan.md`

Do:

- Commit this reviewed execution contract before code changes.

Check:

- Stage only the plan file and inspect the staged diff for secrets, personal
  data, and unrelated changes.

Commit:

- `docs(project): plan course header overflow actions`

Completion criterion: the plan is committed on `course-duplication` and the
worktree contains no pre-existing unrelated changes.

### Slice 2: synchronize the implementation base

Do:

- Fetch `origin` and rebase the branch onto the verified `origin/v3` ref.
- Resolve only conflicts caused by the existing branch history; stop and report
  any conflict that changes the approved scope.
- Re-check the PR head relationship after the rebase. Do not force-push or
  update the PR without separate authorization.

Check:

- `git status --short --branch`
- `git rev-list --left-right --count origin/v3...HEAD`
- `git diff --stat origin/v3...HEAD`

Completion criterion: the branch is based on the current `origin/v3`, the
working tree is clean, and the existing course-duplication changes remain
intact.

### Slice 3: implement the header hierarchy

Files:

- `apps/frontend-manage/src/components/courses/CourseOverviewHeader.tsx`
- `apps/frontend-manage/src/components/courses/QRCodePopover.tsx`
- `packages/i18n/messages/en.ts`
- `packages/i18n/messages/de.ts`
- `docs/frontend-conventions.md`
- `.agents/skills/klicker-frontend-ui/SKILL.md`
- `docs/log/2026-08-10-course-header-overflow.md`

Do:

- Use the existing `Dropdown` and ellipsis icon for the overflow trigger.
- Add localized `manage.course.moreCourseActions` text in both catalogs.
- Keep existing action test hooks for moved actions, including
  `course-share-button`, `course-duplicate-button`,
  `course-learning-analytics-link`, and `course-lti-links`.
- Add `course-actions-menu` to the trigger and a stable selector for any new
  assessment-results menu/visible action as needed.
- Preserve manager, preview, and assessment conditions.
- Keep LTI copy-link items in the existing submenu.
- Give Join course and Assessment results the approved primary treatment while
  keeping the rest of the visible actions secondary.
- Make the reduced action row wrap cleanly without duplicating controls by
  viewport.
- Record the new action-hierarchy convention in the frontend wiki/skill and add
  the required dated wiki log entry.

Completion criterion: the header exposes the approved grouping in both locales,
all existing permissions and action handlers remain attached, and the new menu
trigger has a localized accessible name and stable test hook.

### Slice 4: update feature-wide e2e seams

Files:

- `playwright/util/actions.ts`
- `playwright/util/fixtures/manage.ts`
- `playwright/tests/N-course.spec.ts`
- `playwright/tests/W-activity-log.spec.ts`
- `playwright/tests/X-review.spec.ts`

Do:

- Add shared helpers to open the course action menu and select a moved action.
- Update duplication, sharing, analytics feature-availability, and permission
  flows to open the menu before asserting or clicking moved items.
- Add focused coverage for ordinary and assessment action hierarchy.
- Assert the trigger's accessible name, menu item availability, keyboard open,
  Escape dismissal, and focus return.
- Assert Learning Analytics is a menu item rather than a standalone primary
  action.
- Keep the existing duplication/share workflows as the behavioral tests; do not
  add a parallel component-test suite.

Completion criterion: all existing selectors resolve through the new menu and
the focused tests cover grouping, permissions, keyboard behavior, and LTI
submenu continuity.

### Slice 5: verification and integrated review

Run, in order:

1. `pnpm run check:all`
2. `pnpm run build`
3. Playwright type/list checks and targeted Chromium coverage for
   `N-course.spec.ts`, `W-activity-log.spec.ts`, and `X-review.spec.ts`.
4. `npx agent-browser@0.32.2` against the existing DevPod at 1280x720 and
   390x844, in English and German.

Browser routes:

- Ordinary course:
  `/courses/a65886b2-1dd5-4658-9a4a-56b52c35e7ae`
- Assessment course:
  `/courses/156d1069-434c-4f5a-b541-5637987ee504`

Browser evidence must cover closed/open menu states, keyboard dismissal and
focus return, no horizontal overflow, primary styling, localized labels, and
the unchanged duplication entry point. Capture before/after screenshots for
the existing PR only after the final review and separate PR-update authority.

The integrated exact-head result must receive one separate read-only Sol review
before the change is presented as complete or added to PR #4954.

Completion criterion: repository checks, targeted e2e, browser evidence, and
the required integrated review all pass, or every remaining gap is recorded
with its exact cause and boundary.

## Risks and stop conditions

- If rebasing produces conflicts outside the approved UI/test/docs scope, stop
  and report them before resolving.
- If the primary treatment makes Join course visually dominant in a way that
  conflicts with the live product context, stop at browser review and ask for a
  revised hierarchy rather than adding a second responsive variant.
- At 390px, stop if the header horizontally scrolls, overlaps, or becomes an
  unusably tall action block; adjust the single grouping before considering any
  breakpoint-specific design.
- Existing PR CI, GitGuardian, and deployment state are not claimed green by
  local checks. Read them separately after an authorized push.

## Progress

- [x] Live UI and current branch/PR state revalidated.
- [x] Sol planning-stage review completed.
- [x] Option A approved by the user.
- [x] Branch synchronization approved by the user.
- [x] Commit the reviewed plan.
- [x] Synchronize with current `origin/v3`.
- [x] Implement header, i18n, docs, and tests.
- [x] Run repository, e2e, and browser verification.
- [x] Complete integrated final review.

## Verification notes

- The manage typecheck, changed-component ESLint run, Playwright typecheck, and
  isolated `@klicker-uzh/util` Rollup build pass. The util build emits only its
  existing circular-dependency and unused-import warnings.
- The focused ordinary-course and assessment-course Playwright tests pass
  through the linked HTTPS route. The ordinary-course test covers the primary
  Join-course trigger, labelled overflow menu, LTI submenu, Escape dismissal,
  and focus return; the assessment test covers primary Assessment Results,
  secondary Point Corrections, and duplication continuity.
- `pnpm run check:all` remains red outside this change: analytics cannot build
  `pandas==2.2.2` because the image has no C compiler, and the existing
  `CourseDuplicationModal.tsx` `react-hooks/refs` rule reports three errors.
  `pnpm run build` reaches and passes `@klicker-uzh/util`, then stops at the
  unrelated existing `@klicker-uzh/olat-api` Rollup parse error at
  `apps/olat-api/src/index.ts:24` (`'const' declarations must be initialized`).
- Browser verification with `agent-browser` passes in English and German at
  desktop and narrow viewports. The exact linked DevPod remains running for
  manual verification.
- Sol’s integrated read-only review approved the scope with one low-severity
  concern about duplicated ordinary-course assertions. The redundant block was
  removed, the dedicated test remains, and the Playwright typecheck passes.

## Follow-up: responsive course-header action grouping

### Problem

The participant count currently shares the responsive flex item with the action
cluster. That reserves roughly 100px before the four controls can lay out and
causes the ellipsis trigger to become an orphaned second row.

### Evidence

- At effective CSS width 594px, the header content is 562px wide. Modify,
  Comments, and Join fit on the first action row, while the 32px overflow
  trigger moves to a second row.
- At CSS width 1024px, the md-level equal-flex layout gives the action area
  roughly half the header. Modify and Comments occupy the first row; Join and
  the overflow trigger occupy the second.
- At CSS width 390px, the current layout places the participant count beside
  the action rows instead of beside the course title, producing a tall and
  visually fragmented header.
- The supplied screenshots are retained as evidence at:
  `/var/folders/24/j7k2mlqn42l_dhq64jpqslxh0000gp/T/codex-clipboard-386f0bf5-8a23-419e-bfd6-356b50d7eb99.png`
  and
  `/var/folders/24/j7k2mlqn42l_dhq64jpqslxh0000gp/T/codex-clipboard-464c665f-09ae-4cd3-bd63-6dadc746cdd4.png`.

### Planning review

Sol’s read-only planning review approved the conservative layout approach with
no findings. Accepted decisions:

- Split the header into a flexible title/participant group and a direct action
  cluster.
- Keep Modify and Comments visible and labelled on mobile, using the lighter
  basic secondary treatment used by `ActivityActions`.
- Keep Join or Assessment Results as the only primary action.
- Use a full-width wrapping action row below `lg`, and an intrinsic-width,
  non-growing action cluster at `lg` and above.
- Do not introduce icon-only mobile controls, responsive duplicate menu items,
  grid layout, or arbitrary width caps.

### Test portfolio

| Risk | Test obligation | Primary seam | Evidence |
| --- | --- | --- | --- |
| Premature wrapping or an orphaned ellipsis | None | Browser geometry | Screenshots and bounding boxes at 390px, 594px, 1024px, and 1280px |
| Ordinary/assessment action hierarchy | None | Existing browser interactions | Preserve selectors, conditions, menu contents, and primary styling in both variants |
| Overflow accessibility | None | Existing menu interaction | Verify accessible name, keyboard open, Escape dismissal, focus return, and no horizontal overflow |

### Approved follow-up slices

#### Slice A — responsive grouping

Problem: metadata and actions compete in the same flex item.

Decision: Create sibling title/metadata and action groups. Below `lg`, give the
action cluster the full row. At `lg` and above, let the title/metadata group
remain flexible while the action cluster uses its intrinsic width.

Do: Edit only the header structure and responsive classes in
`apps/frontend-manage/src/components/courses/CourseOverviewHeader.tsx`.
Preserve every action condition, callback, selector, menu item, label, and
accessible trigger name.

Check: Run formatter, manage typecheck, and changed-file lint. Verify that all
four ordinary-course actions share one row at 594px and 1024px; at 390px,
Modify plus Comments share the first action row and Join plus the ellipsis share
the second. Capture desktop and narrow screenshots.

Commit: `fix(manage): improve course header action wrapping`

#### Slice B — secondary-action hierarchy

Problem: the current bordered secondary buttons remain visually heavy after the
layout is given enough room.

Decision: Keep Modify and Comments visible and labelled, but use the basic
secondary styling from `apps/frontend-manage/src/components/activities/overview/ActivityActions.tsx`.
Keep Join or Assessment Results primary and the ellipsis as the overflow trigger.

Do: Apply the minimal button-style change in the same header component. Do not
change action membership or duplicate actions in the overflow menu.

Check: Re-run formatter, manage typecheck, changed-file lint, and the browser
checks at 390px, 594px, 1024px, and 1280px in English and German. Verify the
ordinary and assessment variants where fixtures permit, including menu
contents, focus behavior, and primary/secondary contrast.

Commit: `enhance(manage): clarify course header action hierarchy`

#### Slice C — final verification and review

Do: Run fresh targeted checks and inspect the final diff for incidental layout
complexity. Leave the linked DevPod running for manual verification.

Check: Run the repository-native targeted checks, browser screenshots, and the
required exact-head Sol final review. Record unrelated root-check blockers
without broadening this UI-only scope.

Commit: update the existing package only; no push, merge, or PR update.

### Exact scope and non-goals

Scope: `apps/frontend-manage/src/components/courses/CourseOverviewHeader.tsx`
only. Existing element/activity action components are read-only references.

Non-goals: GraphQL, database, translations, QRCodePopover internals, action
conditions, overflow-menu contents, responsive duplicate controls, icon-only
mobile actions, new dependencies, automated layout tests, and unrelated PR
[PR #4954](https://github.com/uzh-bf/klicker-uzh/pull/4954) behavior.

### Follow-up progress

- [x] User approved the Sol-reviewed responsive layout plan.
- [x] Sol planning-stage review completed; no findings.
- [x] Plan extension recorded before implementation.
- [x] Commit Slice A plan checkpoint.
- [x] Implement and verify Slice A responsive grouping.
- [x] Implement and verify Slice B secondary-action hierarchy.
- [x] Complete Slice C final verification and exact-head review.

Slice A evidence: at 390px, 594px, 1024px, and 1280px the course-header
controls remain inside the content width. At 594px and 1024px all four current
actions share one row; at 390px Modify plus Comments share the first action row
and Join plus the ellipsis share the second. The document-level 678px scroll
width at 390px comes from the existing global navigation, not the course-header
action cluster and remains outside this slice.

Slice B evidence: Modify course and View Comments now use the compact basic
secondary treatment while Join course retains the primary treatment. The
authenticated Playwright capture passed at 390px, 594px, 1024px, and 1280px in
English and at 594px in German. The focused ordinary-course action test passed
with the existing labelled overflow trigger, menu interactions, and action
selectors. Manage typecheck, changed-file ESLint, Biome formatting, and
`git diff --check` passed; the temporary capture harness is not part of the
change.

Slice C evidence: Sol's exact-head read-only review of `e90387208..77aa32726`
returned approve with concerns and found no implementation issue. The only
finding was a low-severity evidence gap for assessment-course visuals and
German widths beyond 594px. The existing assessment-course action test had
already passed for the primary Assessment Results action, secondary Point
Corrections action, and duplication continuity. A temporary assessment visual
capture was attempted, but Chromium first returned `ERR_NAME_NOT_RESOLVED` for
the linked route. After the existing DevPod was reconciled, its container was
running but `devrouter exec` remained held by the lifecycle owner (PID 17910),
and the in-app browser rejected the same route with `ERR_BLOCKED_BY_CLIENT`.
Assessment-course visual geometry and German 390px, 1024px, and 1280px
screenshots are therefore not claimed as passed; the limitation is recorded
instead of being treated as implementation evidence. The DevPod remains
running for manual verification.
