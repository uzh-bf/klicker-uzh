# Retro review: PR #4953 — Display name in lecturer cockpit (2026-07-07)

Reviewer: Roland (via Claude Code review session). PR merged 2025-10-15 (`display-name-lecturer-cockpit` → v3), so this is a retrospective quality check, not a merge gate. Scope: 2 files, `apps/frontend-manage/src/components/liveQuiz/cockpit/LiveQuizTimeline.tsx` and `apps/frontend-manage/src/pages/quizzes/[id]/cockpit.tsx`.

## Verdict

Sound, low-risk change. The `displayName` prop threading is correct and type-safe (`displayName` is non-nullable on the quiz model in the Prisma schema, so the required `quizDisplayName: string` prop cannot receive null). The i18n label reuses the existing `manage.activityWizard.displayName` key, so both locales are covered. No action required; three small follow-ups worth batching into a future cockpit touch-up.

## Follow-ups (non-blocking, batch with the next cockpit change)

1. **No `data-cy` on the new display-name heading** (`LiveQuizTimeline.tsx`, the new `<H4>`): E2E tests cannot assert the display name is shown. Add `data-cy="live-quiz-display-name"` alongside the existing `data-cy="live-quiz-pin"` pattern.
2. **No test coverage added**: neither the cypress nor the playwright live-quiz suite asserts the display name in the cockpit header. One-line assertion in `playwright/tests/O-live-quiz.spec.ts` once (1) is done.
3. **Visual regression surface**: the header rework removed `m-0 text-xl` from the `H1` (now default H1 size) and re-centers the header column on small screens; the action buttons switch between `grid grid-cols-2` and flex depending on `assessmentMode`. Nobody attached before/after screenshots to the PR. If lecturers report cockpit layout oddities on narrow screens, this commit (`PR #4953`) is the first place to look. Going forward: UI-facing PRs should include screenshots per the repo's agent-browser verification rule.
