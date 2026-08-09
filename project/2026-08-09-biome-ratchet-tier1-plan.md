# Biome Tier 1 ratchet — noBlankTarget

Status: COMPLETE — current base refreshed; final review gates remain valid
Date: 2026-08-09
Branch: `rs/biome-ratchet-tier1` → target `v3`
Base: `b30585496` (`origin/v3`; includes merged Gitleaks hardening, the
staging-promotion commit, and the non-overlapping demo-question changes)
Worktree: `trees/biome-ratchet-tier1`
Related history: `project/2026-07-19-biome-knip-repo-quality.md`

## Research

- Baseline source: Biome 2.5.2 via the repository's installed dependency and
  current `biome.json`.
- Current baseline: 521 errors, 2,459 warnings, and 424 infos across 1,649
  checked files.
- Selected rule: `lint/security/noBlankTarget`, with 30 errors across 11
  source files in `apps/docs` and `apps/frontend-manage`.
- Existing convention: nearby links use `rel="noopener noreferrer"`,
  `rel="noreferrer"`, or `rel="noopener"`; the selected findings are external
  anchors with `target="_blank"` and no relationship attribute.
- Browser path: frontend changes require `agent-browser`. Manage is validated
  through the exact route reported by `devrouter ensure . --json`. Docs is
  outside the routed stack, so build it with `pnpm --filter
  @klicker-uzh/docs build:docs`, serve `apps/docs/build` on port 5500, and
  validate its `/`, `/catalyst`, and `/development` pages.

## Goal

Remove all current `lint/security/noBlankTarget` diagnostics by adding
`rel="noopener"` to the affected external links, without changing link
destinations, visible text, referrer behavior, routing, or formatter/linter
ownership.

## Problem

Biome lint is advisory and currently reports 30 security diagnostics for links
that open a new browsing context without an explicit opener-protection
relationship. Leaving this rule at a nonzero baseline keeps a concrete security
signal hidden in the general ratchet backlog.

## Decision

1. Fix all 30 current `noBlankTarget` findings in one rule-sized slice.
2. Add `rel="noopener"` to each affected anchor. This is the narrower safe fix
   recommended by the diagnostic and avoids changing referrer attribution.
3. Keep `lint/security/noBlankTarget` enabled and record a zero post-fix count.
4. Leave Prettier, ESLint, Knip, Biome configuration, dependency versions, and
   all unrelated Biome findings unchanged.

Do not apply broad Biome autofixes or suppressions. Do not remove Prettier or
ESLint as part of this slice.

## Risk

- The change is security-positive and should not alter navigation destinations
  or visible UI, but it touches links in two frontend applications.
- Browser validation is mandatory. If the manage runtime, docs build, static
  server, or browser path cannot be made available, pause the slice rather
  than substituting source-level checks.
- `noBlankTarget` is a security boundary, so an independent intermediate
  review is required before the integrated final review.

## Packaging

This is full-path work because it changes a security boundary. The substantive
implementation diff is 65 changed lines (58 additions and 7 deletions), so it
clears the 50-line packaging floor. It is a complete standalone rule-family
package: all current `noBlankTarget` findings are fixed, and no related changes
are needed to make the result independently reviewable.

## Slice 1 — close `noBlankTarget` baseline

### Do

- Update only the 11 affected TSX files identified by the baseline.
- Add `rel="noopener"` to all 30 flagged anchors.
- Keep the plan's Progress section current with baseline, implementation, and
  verification evidence.

### Check

- Run `biome lint --only lint/security/noBlankTarget .` before and after the
  change; the post-fix result must report zero diagnostics.
- Run root `pnpm run format:check`, `git diff --check`, and Gitleaks on the
  current tree and introduced commit range.
- Run `pnpm --filter @klicker-uzh/docs build:docs`.
- Run `pnpm --filter @klicker-uzh/frontend-manage check` and
  `pnpm --filter @klicker-uzh/frontend-manage lint`. Neither affected package
  defines a relevant repository-native test script.
- Use `devrouter ensure . --json` and `agent-browser` against the reported
  manage route. Validate the `/activities` creation flow and the
  group-activity, live-quiz, microlearning, and practice-quiz information
  links; confirm each affected anchor retains its destination and has
  `rel="noopener"`.
- Serve the built docs output on port 5500 and use `agent-browser` against `/`,
  `/catalyst`, and `/development`; confirm affected anchors retain their
  destinations and `rel="noopener"`, and capture screenshots for the changed
  frontend routes.
- Review the final diff for unrelated Biome fixes, destination changes,
  secrets, personal data, and formatter/linter churn.

### Commit

`fix(quality): ratchet noBlankTarget diagnostics`

## Review routing

- Planning stage: configured Codex Sol reviewer, read-only, exact draft plan.
- Intermediate gate: one bounded security review on the committed slice range;
  persist its report under `project/_local/reviews/`.
- Final gates: configured Sol integrated review, bounded security review, and
  `thermo-nuclear-code-quality-review` on the exact final range; persist each
  report under `project/_local/reviews/`. Rerun any affected gate if
  remediation changes reviewed behavior.
- Browser verification: repository `agent-browser` skill for frontend routes.

## Progress

- 2026-08-09: PR #5345 merged as `dbfe71bda`; new isolated branch created from
  current `origin/v3`. Primary checkout and merged Gitleaks worktree remain
  untouched.
- 2026-08-09: Fresh Biome baseline recorded as 521 errors, 2,459 warnings,
  and 424 infos. `noBlankTarget` selected as the first bounded Tier 1 slice:
  30 errors across 11 files.
- 2026-08-09: Sol planning review completed. Integrated mandatory browser
  gates with concrete docs/manage paths, executable package checks, the
  `rel="noopener"` decision, standalone packaging disposition, and exact
  committed-range review artifacts.
- 2026-08-09: `origin/v3` advanced from `dbfe71bda` to `6a400c75e` with a
  deployment-only staging-promotion commit. Merged that commit into the
  isolated branch; it does not overlap the selected source files.
- 2026-08-09: Added `rel="noopener"` to all 30 selected anchors in the 11
  baseline files. The targeted Biome rule now reports zero errors, with only
  the existing `biome.json` recommended-field deprecation info remaining.
  Root `pnpm run format:check` and `git diff --check` pass.
- 2026-08-09: The docs build, frontend-manage typecheck, and frontend-manage
  ESLint pass. The docs build retains existing broken-link, broken-anchor,
  CSS-selector, and Browserslist warnings; ESLint retains 27 existing React
  Hooks warnings and no errors.
- 2026-08-09: Browser verification passed on the isolated manage route for
  live quiz, microlearning, practice quiz, and group activity creation flows,
  and on the generated docs `/`, `/catalyst/`, and `/development/` pages.
  Follow-up coverage also passed on `/use_cases/live_quiz/`,
  `/use_cases/flipped_classroom/`, `/use_cases/group_activity/`,
  `/use_cases/learning_analytics/`, `/use_cases/ai_formative_feedback/`,
  `/use_cases/ai_practice_content/`, and `/use_cases/chatbot_tutoring/`.
  All affected rendered anchors retained their destinations and expose
  `rel="noopener"`; screenshots are in temporary storage. The existing
  Docusaurus config announcement-bar HTML string remains outside this JSX
  rule-family slice and was not changed.
- 2026-08-09: A current-tree Gitleaks scan found four ignored local/generated
  files created by the dev environment or docs build. No finding is in the
  tracked diff. The subsequent introduced commit-range scan passed with no
  leaks.
- 2026-08-09: Implementation committed as `47c0ea387`
  (`fix(quality): ratchet noBlankTarget diagnostics`). The full pre-commit
  `check:all` gate passed, and the CI-equivalent `origin/v3..HEAD` Gitleaks
  scan covered two introduced commits with no leaks.
- 2026-08-09: The intermediate bounded security review of
  `2e6015bf3..47c0ea387` returned one low-priority evidence finding: nine
  changed links in `apps/docs/src/constants.tsx` lacked browser coverage.
  The seven affected use-case routes were then verified and the finding is
  closed. Full report: `project/_local/reviews/2026-08-09-biome-ratchet-no-blank-target-intermediate-security.md`.
- 2026-08-09: Integrated final Sol review passed for
  `6a400c75e..3b0b9bc07` with no findings. Report:
  `project/_local/reviews/2026-08-09-biome-ratchet-no-blank-target-integrated-final.md`.
- 2026-08-09: Final `$security-review` passed for
  `6a400c75e..3b0b9bc07`; no high-confidence vulnerabilities were identified.
  Report: `project/_local/reviews/2026-08-09-biome-ratchet-no-blank-target-final-security.md`.
- 2026-08-09: Final `$thermo-nuclear-code-quality-review` passed for
  `6a400c75e..3b0b9bc07` with no maintainability findings. Report:
  `project/_local/reviews/2026-08-09-biome-ratchet-no-blank-target-final-maintainability.md`.
- 2026-08-09: After the final audit, `origin/v3` advanced from `6a400c75e`
  to `b30585496` through the non-overlapping GraphQL demo-question feature
  and its staging-promotion commit. The branch incorporated both in merge
  commit `a3744e668`; no selected source file changed. Focused verification
  against the current base passed: targeted Biome still reports zero errors,
  format checks pass, the docs build exits successfully, frontend-manage
  typecheck and ESLint pass, and the current-base introduced-range Gitleaks
  scan reports no leaks. The existing browser evidence and final review gates
  remain valid because the upstream merge changed neither the selected source
  files nor the package behavior under review.

## Finish state

The slice is complete when the reviewed plan is the first branch commit, all
30 `noBlankTarget` diagnostics are gone, the executable package checks pass,
the mandatory docs and manage browser evidence is captured, review reports
exist for the exact committed ranges, the branch is clean and committed, and
no PR is published from this goal.
