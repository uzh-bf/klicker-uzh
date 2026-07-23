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
- 2026-07-23: Slice 1 implementation done. Preserved remote review `c389b4ee8d`, merged `v3` at `c8de9c8978`, retained the contextual Q&A rail alongside the new embedded-practice behavior, combined participant discussion and credential relations, regenerated GraphQL artifacts, and mirrored the discussion schema into analytics after the pre-commit sync guard exposed the missing generated files. Verification passed with Node `24.16.0` and pnpm `11.5.0`: Prisma check, Prisma sync guard, GraphQL check, PWA check, Manage check, and `git diff --check --cached origin/v3`. Next: commit the sync, run independent review and simplification, then integrate accepted findings before the merge-blocker slice.
- 2026-07-23: Slice 1 review done for merge commit `3b8d18485`. Independent review found no merge-introduced defects and confirmed the combined Prisma, analytics, generated GraphQL, and embedded/contextual UI behavior. Simplification review removed unnecessary memoization for primitive discussion URLs and nullable expiry-clock state. Runtime browser evidence remains a required finish-gate item after the merge blockers and pre-rollout fixes are complete.
- 2026-07-23: Slice 2 active. Fix the three verified merge blockers: provide the GraphQL discussion tests with a non-production `APP_SECRET`, append cursor pages instead of replacing the first page, and localize the remaining English-only Q&A strings.
- 2026-07-23: Slice 2 implementation done. PWA and Manage focused ESLint and type checks, GraphQL type checking, Prettier, and `git diff --check` pass. The PWA has no unit-test harness for the Apollo merge callback; verify pagination with more than 20 threads in the mandatory browser slice. The discussion integration suite still requires an isolated local test database and will run with the runtime verification environment.
- 2026-07-23: Slice 2 review found no CI, translation, ICU, or accessibility defects. Accepted pagination findings: extra pages now stop background polling, overlapping page requests are guarded and deduplicated, and upvote mutations rely on Apollo normalization instead of refetching the first page. Thread and reply creation still refresh intentionally to surface newly created content. Browser coverage will verify pagination, polling stability, and repeated-click behavior.
- 2026-07-23: Slice 3 active. Enforce lecturer-only write access for the aggregated discussion overview and fail both vote mutations closed when either the rollout or runtime course Q&A gate is disabled. Add integration assertions for participant overview denial and both gate combinations.
- 2026-07-23: Slice 3 implementation done. GraphQL type checking, Prettier, and `git diff --check` pass. Added integration assertions but runtime execution is pending: devrouter created an isolated database, then its Postgres bootstrap stalled during temporary-server shutdown and the local OrbStack Docker API stopped responding to inspection calls. Do not use another worktree's database; retry the isolated runtime before the finish gate.
- 2026-07-23: Slice 3 review done for `25fcdeebb`. Independent authorization/security review found no regression. Accepted one simplification: the rollout/runtime gate now has a single predicate reused by all seven discussion entry points. Kept the two integration scenarios self-contained instead of adding a fixture abstraction for two uses. GraphQL type checking and Prettier pass; isolated runtime execution remains pending.
- 2026-07-23: Slice 4 active. Preserve mathematical comparison text, reject content beyond the existing 4,000-character client limit instead of silently truncating it, and atomically cap stored replies at the 50 replies that the API can return.
- 2026-07-23: Slice 4 implementation done. GraphQL type checking and the three new integration scenarios pass against the isolated devrouter PostgreSQL/Redis services, including two concurrent replies racing for slot 50. The full discussion file reaches 13/16 passing; three pre-existing v3-drift failures remain in the microlearning fixture, PostgreSQL catalog type handling, and missing derived-permission recomputation. Devrouter bootstrap itself still fails earlier on the unrelated `@klicker-uzh/hatchet` Rollup parser, so tests run inside the isolated app container with temporary test-only Redis forwards.
- 2026-07-23: Slice 4 review found that reply deletion still recomputed `replyCount` from a stale snapshot, which could undercount during concurrent creation and later permit an invisible reply 51. The adjustment uses guarded atomic create/decrement operations on the same thread row and extends the integration scenario to cover concurrent create/delete plus exact creation/deletion event counts.
- 2026-07-23: Slice 5 active. Repair the three v3-drifted discussion integration scenarios without changing product behavior: explicitly seed an empty microlearning stack, cast PostgreSQL catalog `name` values for Prisma's driver adapter, and recompute owner permissions before creating an embed link.
- 2026-07-23: Slice 5 implementation done. The test now explicitly enables anonymous posting for its anonymous external-block case as well. GraphQL type checking passes and all 16 discussion integration scenarios pass against the isolated worktree PostgreSQL/Redis services.
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
