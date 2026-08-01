# Learning Analytics user documentation

## Plan identity

- Plan path: `project/2026-07-31-pr-5265-learning-analytics-user-documentation-plan.md`
- Branch: `claude/la-user-documentation`
- Target branch: `codex/learning-analytics-opt-out-plan` (head of [PR #5198](https://github.com/uzh-bf/klicker-uzh/pull/5198))
- PR ID: [PR #5265](https://github.com/uzh-bf/klicker-uzh/pull/5265) — documentation follow-up with supporting UI-link, seed, and constant changes after the five-PR learning analytics implementation stack, kept as draft
- Worktree: `trees/la-user-docs`
- History: continues the LA portfolio governed by
  `project/2026-07-23-pr-5198-learning-analytics-opt-out-plan.md` and
  `project/2026-07-23-learning-analytics-production-plan.md`

## Goal

- Ship lecturer-facing and student-facing Learning Analytics documentation on the
  public docs site, illustrated with screenshots captured from a genuinely
  LA-enabled seeded environment.
- Link the lecturer page from the in-app participant disclosure so students can
  see exactly what a lecturer sees before making their choice.
- Close the documentation gap that currently blocks merging the LA stack.

## Non-goals

- German documentation pages. The docs site is English-only; the operative
  bilingual disclosure stays in-app.
- Enabling the rollout gate or changing LA eligibility, computation, or production behaviour.
- Editing the already-reviewed milestone-5 diff on `codex/learning-analytics-opt-out-plan`.
- Rewriting the `/development` page. Tracked separately; the user ruled it
  non-critical for this PR.

## Decisions

Ruled by the user before planning:

- `Decision:` Documentation is English-only. Both locales of the in-app
  disclosure link to the same English pages.
- `Decision:` New `Lecturer - Analytics` sidebar group rather than appending to
  an existing lecturer group. LA spans all activity types.
- `Decision:` Validate the existing screenshots first; add LA seed data so the
  dashboards can be verified and captured for real.
- `Decision:` Ship as a separate PR stacked on `codex/learning-analytics-opt-out-plan`,
  keeping the reviewed milestone-5 diff untouched.
- `Decision:` PR #5265 is a documentation follow-up outside the five ordered
  implementation PRs. Its supporting disclosure link, deterministic development
  and QA seed safeguards, and behavior-preserving constant relocation are included
  for verification. It is stacked on #5198 solely for review; after #5198 lands,
  retarget or rebase it to the resulting target before its own merge. It is not a
  sixth implementation milestone and does not alter the reviewed milestone-5 diff.
- `Decision:` Both pages carry a beta notice reading, in substance, that
  Learning Analytics is available on request for users at UZH.

## Research findings

- `Evidence:` LA eligibility in
  `apps/analytics/src/modules/learning_analytics_eligibility.py:21` requires all
  of: course enabled, participation status `INCLUDED`, acknowledged disclosure
  version equal to the current constant, `includedFrom` set, and
  `activity_at >= included_from`. Report-specific minimum-sample suppression is
  implemented in the analytics read and aggregation paths, but the activity
  performance and quiz paths currently derive some counts course-wide; see the
  parent-stack effective-N blocker below.
- `Evidence:` No existing seed sets `learningAnalyticsStatus`,
  `learningAnalyticsDisclosureVersion`, or `Course.isLearningAnalyticsEnabled`.
  `Course.isLearningAnalyticsEnabled` defaults to `false` and
  `Participation.learningAnalyticsStatus` defaults to `UNDECIDED`, so LA
  dashboards render empty or fully suppressed against current seed data.
- `Decision:` The seed derives the disclosure version from
  `LEARNING_ANALYTICS_DISCLOSURE_VERSION` rather than hardcoding it. This makes
  seeding order-independent with respect to the version bump and keeps the seed
  valid across future disclosure edits.
- `Evidence:` Four LA screenshots already exist under
  `apps/docs/static/img/learning_analytics/`. Three are referenced from
  `apps/docs/src/constants.tsx`; `la_students_dashboard.png` is unreferenced.
  All four predate the privacy rework and require validation.
- `Evidence:` The docs site is English-only. `apps/docs` has no `i18n/`
  directory; the DE/EN legal pages are hand-maintained sibling files.
  Site URL is `https://www.klicker.uzh.ch` with `baseUrl: '/'`.
- `Evidence:` Precedent exists for linking in-app text to the docs site:
  `packages/i18n/messages/en.ts:498` links to `/terms_of_service` and
  `/privacy_policy`. The `learningAnalytics` i18n block currently has no
  outbound link.
- `Evidence:` Editing the disclosure bumps
  `LEARNING_ANALYTICS_DISCLOSURE_VERSION` and re-prompts participants who
  already chose. The rollout is disabled and no participant has chosen, so the
  bump is free now and a re-consent event after rollout.

## ADRs

No new ADR expected. This branch documents decisions already recorded in
ADR 0001, ADR 0002, and ADR 0003; it does not make new architectural choices.
Revisit if the beta/availability policy turns out to be a durable trade-off
rather than a rollout detail.

## Skill routing

- `$rs-sliced-development-workflow` owns slices, review, and the PR finish.
- `$agent-browser` for in-app link verification and any screenshot capture,
  per the repository's mandatory frontend verification rule.
- `$security-review` at the stack-level finish gate and
  `$thermo-nuclear-code-quality-review` for this branch's finish gate.
- `$rs-mr-description-writer` for the PR body.

## Slices

### S1 — LA seed capability

- `Problem:` LA dashboards cannot be verified or screenshotted because no seeded
  course or participant is eligible.
- `Do:` Extend the seed so `Testkurs` has `isLearningAnalyticsEnabled = true`,
  and at least five (target ~20) of `testuser1-50` have
  `learningAnalyticsStatus = INCLUDED`, `learningAnalyticsDisclosureVersion`
  read from the shared constant, and `learningAnalyticsIncludedFrom` backdated
  before the timestamps produced by `seed:interactions`.
- `Check:` Run the analytics pipeline; confirm participant, aggregate, and quiz
  results are non-empty and not k-suppressed. Confirm eligibility directly
  against the database.
- `Risk:` The seed is recorded as unreliable in the milestone-5 handoff. If the
  pipeline cannot be run, fall back to validated existing screenshots, mark the
  slice partially verified, and report it rather than downgrading silently.
- `Commit:` `chore(prisma-data): seed learning analytics participation`

### S2 — Disclosure links and version bump

- `Do:` Add documentation links to the `learningAnalytics` block in
  `packages/i18n/messages/en.ts` and `de.ts`, both pointing at the English
  lecturer and student pages.
- `Decision:` Do **not** bump `LEARNING_ANALYTICS_DISCLOSURE_VERSION`, reversing
  the planned bump. The addition is a pointer to supplementary documentation; it
  changes nothing about which data is used, who sees it, or what participants
  may do, so it does not warrant invalidating consent.
- `Evidence:` The version literal is additionally hardcoded in ten analytics
  SQL and Python files plus their fixtures, so a bump is a coordinated
  multi-file edit across the reviewed milestone-4 computation code. Reserve that
  churn for a substantive disclosure change, such as one required by legal
  review.
- `Check:` Typecheck the PWA and run its unit tests.
- `Commit:` `feat(i18n): link learning analytics documentation from the disclosure`

### S3 — Lecturer documentation page

- `Do:` Add `apps/docs/docs/tutorials/learning_analytics.mdx` and a
  `Lecturer - Analytics` group in `apps/docs/sidebars.js`. Cover what LA is,
  enabling it per course (default-off, course managers only), the three
  dashboards, what lecturers can and cannot see, the report-specific
  minimum-sample privacy rule, per-report pseudonyms, export, the obligation not
  to re-identify, and
  separation from research consent. Include the beta notice.
- `Check:` Docs build; internal links resolve; every screenshot audited for
  identifiable data before inclusion.
- `Commit:` `docs(docs): add lecturer learning analytics documentation`

### S4 — Student documentation page

- `Do:` Add `apps/docs/docs/student_tutorials/learning_analytics.mdx` explaining
  the choice, what changes when opting out, that course and chatbot access are
  unaffected, and linking prominently into the lecturer page. Include the beta
  notice. Register it in the `Student - Application` sidebar group.
- `Check:` Docs build; links resolve in both directions.
- `Commit:` `docs(docs): add student learning analytics documentation`

### S5 — Finish

- `Do:` Verify the in-app disclosure links in a browser at desktop and mobile
  widths, in both locales. Run the finish gate.
- `Check:` Docs build, focused test suites,
  `$thermo-nuclear-code-quality-review`, and independent review of the full
  range. The separate security review is deferred to the stack-level gate by
  user decision.
- `Commit:` PR update with whole-branch summary and verified screenshots.

## Risks

- `Risk:` Screenshot privacy. The existing images predate the privacy rework. An
  image showing identifiable names rather than `Student 1` labels would
  contradict the privacy claims of the page it illustrates, in public docs under
  legal review. Every image is audited before publish, reused or regenerated.
- `Risk:` Pipeline execution depends on Infisical dev secrets, a seeded
  database, and the Python analytics worker. See S1 fallback.
- `Risk:` These pages publish documentation for a feature that ships dark.
  Mitigated by the beta notice.
- `Risk:` The stack rebases beneath this branch. Re-verify the base before
  opening the PR.

## Progress

- Base: `d5a21f3b90` on `codex/learning-analytics-opt-out-plan`.
- S1 implemented. `LEARNING_ANALYTICS_DISCLOSURE_VERSION` moved to
  `@klicker-uzh/util` (re-exported from the GraphQL lib) so the seed can reach
  it without a GraphQL dependency. `Testkurs` now seeds with LA enabled;
  `testuser1-35` are `INCLUDED`, `testuser36-45` `EXCLUDED`, `testuser46-50`
  `UNDECIDED`, all backdated to 2018-12-01 so every interaction from
  `seed:interactions` (window 2025-09-15 to 2026-04-18) falls inside the
  inclusion period.
- `Evidence:` `pnpm --filter @klicker-uzh/{util,prisma-data,graphql} check`
  clean; `@klicker-uzh/graphql` builds and the bundle resolves the constant
  through the util import; prettier clean on all changed files.
- `Evidence:` R1 first pass. The three lecturer-facing screenshots under
  `apps/docs/static/img/learning_analytics/` carry no personal data and the
  performance dashboard already uses `Student 1`-style pseudonyms.
  `la_students_dashboard.png` is a captioned thesis figure of the student view,
  not a product screenshot, and is not reused.
- S2 implemented. The participant disclosure now carries a sentence linking the
  student and lecturer documentation pages, in both locales, rendered as
  external links inside the existing info notification. The German string names
  the documentation as English. The disclosure version was deliberately not
  bumped; see the S2 decision.
- `Evidence:` `pnpm --filter @klicker-uzh/frontend-pwa check` and its unit
  tests pass; prettier clean.
- S1 follow-up committed. The nested `learningAnalyticsChoiceEvents` create
  never ran: `prepareParticipant` already creates the participations through
  `courseIds`, so the participation upsert always took its update branch. The
  choice history is now rebuilt explicitly after the participation loop.
  `Evidence:` against the seeded database, every decided participation carries
  exactly one choice event, and the eligible participation count is 35.
- `Evidence:` full local verification loop established. The DevPod workspace
  `claude-la-user-documentation` runs the apps; `seedInteractions` supplies
  1105 responses for `Testkurs`; the Python analytics pipeline ran in the
  container (`uv sync --no-install-package hdbscan`, then scripts 0-9, 13, 14,
  11, 99 — script 10 needs a C compiler the container lacks) and marked the
  course analytics valid. All three dashboards render real data.
- `Problem:` `turbo dev` aborted in the container on `@klicker-uzh/hatchet:build`
  with `Expected '{', got 'type'`. `Evidence:` the host build had left
  `packages/hatchet/dist/tsconfig.tsbuildinfo` in the mounted worktree, so the
  incremental TypeScript compiler emitted nothing and Rollup parsed raw `.ts`.
  Clearing every `*.tsbuildinfo` outside `node_modules` fixed it.
- S3 and S4 implemented as one commit. `Decision:` the two pages cross-link each
  other, so splitting them would leave an intermediate commit whose Docusaurus
  build fails on a broken link.
- `Decision:` the lecturer page does not use `CatalystTitle`. Its badge reads
  "Available for UZH & KlickerUZH Catalyst", which contradicts the approved
  beta/on-request-at-UZH positioning. The beta admonition is the single
  availability statement.
- `Evidence:` R1 retired. All three stored screenshots were stale, not only the
  performance one: the activity capture predates the switch from `Week N` to
  date axis labels and shows real UZH course names, and the quiz capture shows
  `Student Feedback (N = 1)`, which is inconsistent with the approved
  minimum-sample privacy boundary and would have contradicted the page text.
  The activity, performance, and quiz captures were replaced with fresh
  captures from the synthetic `Testkurs` fixture; the student-performance
  capture was added. The course-setting capture is omitted until the
  parent-stack effective-N blocker is resolved. No image carries personal data.
- `Evidence:` the two rate views agree. `ActivityPerformance.totalErrorRate` for
  `Practice Quiz Demo` is 0.642 and both the Performance Rates bar chart and the
  Quiz Dashboard donut render it as the error rate; the donut's data order is
  `[success, partial, error]`, which is what makes a flat text dump of it look
  inverted against its legend.
- `Evidence:` `pnpm --filter @klicker-uzh/docs build:docs` succeeds. The only
  broken link is the pre-existing `/tutorials/gamification/` from
  `getting_started/core_concepts`; both new pages and all their cross-links
  resolve. Both pages were rendered from the built site and checked visually.
- `Evidence:` browser verification of S2 in the running PWA. Both documentation
  links render inside the disclosure notice with the correct absolute URLs, in
  English and German, at 1280px and 390px.
- `Evidence:` base re-verified before publishing. `origin/codex/learning-analytics-opt-out-plan`
  and the GitHub head of PR #5198 are both `d5a21f3b90`, which is this branch's
  base, so R4 (stack rebase beneath the branch) did not materialise. The local
  `codex/learning-analytics-opt-out-plan` ref sits on the abandoned parallel
  session's line at `1c38238539`; every file that line touches is already present
  at this branch's HEAD, so nothing needs integrating.
- S5 implementation is complete for the corrective range ending at
  `b3525c527`. Pre-push `pnpm run build` passed (22/22 tasks). Draft
  [PR #5265](https://github.com/uzh-bf/klicker-uzh/pull/5265) is open against
  `codex/learning-analytics-opt-out-plan`; the local corrective commits are
  ahead of the live PR head pending publication.
- `Evidence:` the authorized maintainability and independent whole-branch
  reviews found documentation claims that overstated anonymity and coverage,
  omitted approved privacy exclusions, overpromised chatbot access, and a seed
  rebuild that could rewrite unrelated Testkurs choice history. The fixes align
  both pages with ADR 0002 and the chatbot boundary in ADR 0001, scope the seed
  rebuild to `PARTICIPANT_IDS`, make it atomic, and document the deterministic
  fixture in the engineering wiki.
- `Evidence:` the final authorized maintainability, specification/privacy, and
  standards reviews of `d5a21f3b90...b3525c527` passed with no
  branch-introduced findings at the reporting threshold. The parent effective-N
  defect remains a separate release blocker, and the security review remains
  deferred to the stack-level gate by user decision.
- `Evidence:` `pnpm --filter @klicker-uzh/prisma-data check` passes; the
  Docusaurus build passes with only the pre-existing broken links and anchors
  elsewhere in the site; Prettier passes on all changed files; and browser
  verification passes for both documentation pages at desktop and 390x844 with
  no horizontal overflow. The wiki validator runs but still reports one
  pre-existing frontmatter error in an unrelated solution note plus existing
  hygiene warnings.
- `Risk:` the separate security review is intentionally deferred to the
  stack-level review by user decision. The PR remains draft until the corrected
  branch is published and the parent privacy boundary is corrected or
  explicitly approved; legal, release, and rollout gates remain separate.
- `Risk:` The parent-stack activity-level effective-N path currently uses the
  course-wide included-participant count for some activity performance and quiz
  results. This documentation branch does not change the milestone-5
  implementation. The docs must remain draft until the parent stack corrects or
  explicitly approves that privacy boundary; the pages do not claim a
  contributor-level five-student guarantee.
- Next action: update the draft PR with the exact corrective-range evidence and
  publish the local branch without marking it ready or merging it. Resolve or
  obtain explicit approval for the parent-stack effective-N blocker before
  release readiness.

## Next steps

- The `/development` page LA section remains stale and is tracked outside this
  branch.
- Legal review of the disclosure text is a separate stakeholder gate; if legal
  changes wording, the disclosure version bumps again.
