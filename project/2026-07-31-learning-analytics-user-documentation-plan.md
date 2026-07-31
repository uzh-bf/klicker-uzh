# Learning Analytics user documentation

## Plan identity

- Plan path: `project/2026-07-31-learning-analytics-user-documentation-plan.md`
- Branch: `claude/la-user-documentation`
- Target branch: `codex/learning-analytics-opt-out-plan` (head of [PR #5198](https://github.com/uzh-bf/klicker-uzh/pull/5198))
- PR ID: not yet created — sixth PR on the learning analytics stack
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
- Enabling the rollout gate or changing any LA behaviour.
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
- `Decision:` Both pages carry a beta notice reading, in substance, that
  Learning Analytics is available on request for users at UZH.

## Research findings

- `Evidence:` LA eligibility in
  `apps/analytics/src/modules/learning_analytics_eligibility.py:21` requires all
  of: course enabled, participation status `INCLUDED`, acknowledged disclosure
  version equal to the current constant, `includedFrom` set, and
  `activity_at >= included_from`. Aggregates additionally suppress below five
  contributing students.
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
- `$security-review` and `$thermo-nuclear-code-quality-review` at the finish gate.
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
  dashboards, what lecturers can and cannot see, the five-student suppression
  rule, per-report pseudonyms, export, the obligation not to re-identify, and
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
- `Check:` Docs build, focused test suites, `$security-review`,
  `$thermo-nuclear-code-quality-review`, independent review of the full range.
- `Commit:` PR creation with whole-branch summary and screenshots.

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
- `Evidence:` R1 partially retired. The three lecturer-facing screenshots under
  `apps/docs/static/img/learning_analytics/` carry no personal data and the
  performance dashboard already uses `Student 1`-style pseudonyms.
  `la_students_dashboard.png` is a captioned thesis figure of the student view,
  not a product screenshot, and is not reused.
- `Risk:` The database-backed check (pipeline run against the seeded data)
  is outstanding and is batched into S5 with the browser verification so the
  environment is started once.
- S2 implemented. The participant disclosure now carries a sentence linking the
  student and lecturer documentation pages, in both locales, rendered as
  external links inside the existing info notification. The German string names
  the documentation as English. The disclosure version was deliberately not
  bumped; see the S2 decision.
- `Evidence:` `pnpm --filter @klicker-uzh/frontend-pwa check` and its unit
  tests pass; prettier clean.
- Next action: S3 — lecturer documentation page.

## Next steps

- The `/development` page LA section remains stale and is tracked outside this
  branch.
- Legal review of the disclosure text is a separate stakeholder gate; if legal
  changes wording, the disclosure version bumps again.
