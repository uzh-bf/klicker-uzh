# PR #5072 Integrated Course Q&A Plan

## Identity

- Plan: `project/2026-06-01-pr-5072-integrated-course-qa-plan.md`
- Branch: `codex/course-qa-takeover` (updates remote `course-qa`)
- Target: `v3`
- PR: [#5072](https://github.com/uzh-bf/klicker-uzh/pull/5072)
- Prior checkpoint: local `course-qa` at `cc0c8cf29a`; remote review at `c389b4ee8d`

## Goal

- Problem: Course Q&A exists as separate page/link. User wants contextual integration beside content on desktop, sheet-style on mobile.
- Do: Reuse existing Course Q&A behavior inside existing learning surfaces.
- Outcome: Q&A visible next to course content where useful; `/qa` route remains fallback/deep link/embed target.

## Non-Goals

- No schema redesign unless required by UI.
- No new dependencies.
- No full Manage redesign in first slice.
- No delete/upvote backend hardening in this UX slice; tracked as prior review finding.

## Constraints

- Repo: Next.js Pages Router, Apollo, Tailwind, UZH design system.
- Verification: run focused TypeScript/build checks where feasible; browser screenshots required for UI changes.
- Context7: unavailable in current MCP tool set after discovery attempt. Use local code patterns and fetched web interface guidelines.
- Dev env: Manage port 3002 occupied locally, use alternate port plus backend origin override if screenshots need Manage.

## Research

- Source: Vercel web interface guidelines fetched 2026-06-01.
- Relevant: contextual state should reflect URL, links for navigation, forms need labels, focus states, long user content needs wrapping, dates should use `Intl.DateTimeFormat`.
- Applicability: Directly relevant to PWA/Manage UI polish; no external product research needed for first integration slice.

## Progress

- 2026-07-23: Takeover started in repo-local worktree `trees/course-qa-takeover`; legacy worktree preserved.
- 2026-07-23: Slice 1 active. Reconcile remote review and seven unpublished UX commits, sync current `v3`, resolve conflicts, regenerate derived GraphQL files, and establish a fresh verification baseline.
- 2026-06-01: Plan committed as `a1b2df084`. Pre-commit `check:all` passed with existing Node engine warnings.
- 2026-06-01: Slice 1 done. Extracted `CourseDiscussionPanel`; `/qa` route is wrapper. Checks: `pnpm --filter @klicker-uzh/frontend-pwa check` passed, `git diff --check` clean, browser screenshot `/private/tmp/course-qa-integrated-screenshots/01-slice1-qa-route-refactored.png`.
- 2026-06-01: Slice 2 done. Mounted stack-scoped `CourseDiscussionPanel` as sticky desktop rail in `ElementStack`; kept stack action controls in the content column and mobile discussion link fallback. Checks: `pnpm --filter @klicker-uzh/frontend-pwa check` passed, `git diff --check` clean, screenshots `/private/tmp/course-qa-integrated-screenshots/02-slice2-practice-stack-desktop-rail.png` and `/private/tmp/course-qa-integrated-screenshots/04-slice2-practice-stack-mobile-link.png`.
- 2026-06-01: Slice 3 done. Replaced course overview Q&A button with integrated course-scoped `CourseDiscussionPanel`; desktop uses right rail, mobile stacks below selected tab content. Checks: `pnpm --filter @klicker-uzh/frontend-pwa check` passed, screenshots `/private/tmp/course-qa-integrated-screenshots/05-slice3-course-overview-desktop-panel.png` and `/private/tmp/course-qa-integrated-screenshots/06-slice3-course-overview-mobile-panel.png`.
- 2026-06-01: Slice 4 done. Replaced microlearning evaluation stack discussion links with in-page stack selector and contextual `CourseDiscussionPanel`; desktop uses right rail, mobile stacks below evaluation. Checks: `pnpm --filter @klicker-uzh/frontend-pwa check` passed, screenshots `/private/tmp/course-qa-integrated-screenshots/07-slice4-microlearning-evaluation-desktop-panel.png`, `/private/tmp/course-qa-integrated-screenshots/08-slice4-microlearning-evaluation-selected-stack.png`, and `/private/tmp/course-qa-integrated-screenshots/09-slice4-microlearning-evaluation-mobile-panel.png`.
- 2026-06-01: Slice 5 done. Reordered Manage course Q&A tab so discussion triage is primary, moved the embed generator into a collapsible secondary section, and added an affordance/description for the collapsed state. Checks: `pnpm --filter @klicker-uzh/frontend-manage check` passed, screenshots `/private/tmp/course-qa-integrated-screenshots/10-slice5-manage-discussions-overview.png` and `/private/tmp/course-qa-integrated-screenshots/11-slice5-manage-embed-expanded.png`.
- 2026-06-01: Slice 6 done. Hardened integrated Q&A UI with locale-aware dates, long-text wrapping, form names/autocomplete, decorative icon hiding, reduced-motion-safe hover transforms, and clearer collapsible focus affordance. Checks: `pnpm --filter @klicker-uzh/frontend-pwa check` passed, `pnpm --filter @klicker-uzh/frontend-manage check` passed. Final screenshots saved under `/private/tmp/course-qa-integrated-screenshots/final-*.png`.

## Slices

### Slice 1: Reusable Discussion Panel

- Do: Extract Q&A UI/query/mutation logic from `apps/frontend-pwa/src/pages/course/[courseId]/qa.tsx` into reusable component.
- Files: new component under `apps/frontend-pwa/src/components/course/`, existing `/qa` page wrapper.
- Behavior: Existing `/qa` route unchanged visually enough; component accepts `courseId`, `scopeKey`, `embedded`, optional `compact`.
- Check: focused `pnpm --filter @klicker-uzh/frontend-pwa check` if feasible; browser screenshot of `/qa`.
- Commit: `refactor(course-qa): extract reusable discussion panel`.

### Slice 2: Practice Stack Desktop Rail

- Do: Mount discussion panel beside `ElementStack` on desktop for stack scope.
- Files: `apps/frontend-pwa/src/components/practiceQuiz/ElementStack.tsx`, extracted panel props if needed.
- Behavior: Desktop shows content + sticky Q&A rail; mobile uses compact button/link fallback first if sheet would be too broad.
- Check: browser screenshots desktop and mobile practice quiz stack.
- Commit: `feat(course-qa): integrate stack discussions beside practice content`.

### Slice 3: Course Overview Integration

- Do: Replace top separate Course Q&A button with integrated compact panel/summary in course overview.
- Files: `apps/frontend-pwa/src/pages/course/[courseId]/index.tsx`, panel component.
- Behavior: Latest course-level threads and composer visible in existing course page.
- Check: browser screenshot course overview desktop/mobile.
- Commit: `feat(course-qa): surface course discussions in overview`.

### Slice 4: Microlearning Evaluation Context

- Do: Replace repeated navigation links with scope-selecting discussion panel/sheet.
- Files: `apps/frontend-pwa/src/pages/course/[courseId]/microLearnings/[id]/evaluation.tsx`.
- Behavior: Stack rows can open/update discussion panel without leaving evaluation.
- Check: browser screenshot evaluation with selected stack discussion.
- Commit: `feat(course-qa): integrate microlearning stack discussions`.

### Slice 5: Manage Triage Polish

- Do: Make discussion overview primary; move embed generator into secondary/collapsible area; add clearer filters if low-risk.
- Files: `apps/frontend-manage/src/components/courses/CourseDiscussionOverview.tsx`.
- Behavior: Lecturer sees discussion triage first; embed link generator no longer dominates.
- Check: browser screenshot Manage Course Q&A tab.
- Commit: `feat(course-qa): improve manage discussion overview`.

### Slice 6: Final Hardening

- Do: Address low-risk UX/accessibility issues found during slices: long text wrapping, date formatting, reduced-motion, focus-visible if missing.
- Files: touched components only.
- Check: focused checks, browser screenshots, final review.
- Commit: `fix(course-qa): polish integrated discussion ux`.

## Finish

- Run final focused checks.
- Capture final screenshots for all changed surfaces.
- Run final security/best-practices review.
- Update PR/MR body with screenshots if requested.
