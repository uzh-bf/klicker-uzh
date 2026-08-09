# PR #5348 — Biome Tier 1 ratchet

Status: IN PROGRESS — widened from the noBlankTarget slice
Date: 2026-08-09
Branch: rs/biome-ratchet-tier1 → target v3
PR: https://github.com/uzh-bf/klicker-uzh/pull/5348
Base: b30585496 (origin/v3)
Worktree: trees/biome-ratchet-tier1
Related history: project/2026-07-19-biome-knip-repo-quality.md

## Problem

PR #5186 already merged the Biome + Knip + Gitleaks migration. PR #5348
initially closed only the 30 noBlankTarget findings, which is a complete
rule-sized slice but not the full Tier 1 repo-quality package requested by the
user. The existing draft PR remains the delivery path; widen it rather than
opening another rule-sized PR.

## Research

- Biome version: 2.5.2, selected by the repository lockfile.
- Current post-noBlankTarget baseline: 491 errors, 2,461 warnings, and 425
  infos across 1,651 checked files.
- After the core correctness and suspicious slice, 366 error-severity
  diagnostics remain: 189 useExhaustiveDependencies, five
  useHookAtTopLevel, 111 accessibility diagnostics, and 61 noArrayIndexKey
  diagnostics. The filtered core gate now exits successfully.
- The 491 errors span 32 rules and 200 files: 236 correctness diagnostics,
  144 suspicious diagnostics, and 111 accessibility diagnostics.
- Largest error families are correctness/useExhaustiveDependencies (189),
  suspicious/noArrayIndexKey (61), a11y/noStaticElementInteractions (30),
  a11y/useKeyWithClickEvents (29), correctness/noSwitchDeclarations (21),
  suspicious/noThenProperty (32), suspicious/noDoubleEquals (19), and the
  already-closed security/noBlankTarget family (30).
- Knip remains noise-heavy: 112 unused files, 139 dependency findings, about
  2,000 export/type findings, and additional enum, duplicate-export, and
  configuration findings. It is not ready for blocking enforcement in this
  package.
- The current origin/v3 SHA is b3058549622534a23dd0ee274e1432709a4d3323.
  The branch is currently nine commits ahead of origin/v3 and two commits
  ahead of the published PR branch; it has no base divergence.
- The original migration remains the source of truth for formatter ownership:
  Biome owns code; Prettier owns Markdown/YAML and Playwright/Cypress; ESLint
  remains the Next.js safety net.

## Goal

Reach a zero error-severity Biome baseline for the current configured scope,
then make that error gate blocking locally and in CI. Every current error gets
one of:

1. a small, behavior-preserving fix;
2. a verified semantic fix with package, test, and browser checks where needed;
3. a narrow, documented configuration decision for a demonstrated false
   positive or non-runtime template surface.

Warnings and infos remain visible but advisory. Knip remains advisory until its
per-workspace entry model is trustworthy. Prettier and ESLint stay in parallel;
this package does not remove, replace, or broaden either tool's ownership.

## Decision

- Package the complete current Biome Tier 1 error baseline in PR #5348.
- Preserve the completed noBlankTarget changes as the first slice.
- Keep rule-family commits separate inside the one PR so the large branch is
  reviewable without splitting delivery.
- Remove continue-on-error from the Biome CI steps only after the error count is
  zero.
- Add Biome lint to the local check:all gate at the same point. The default
  Biome command may continue to print warnings; error-level diagnostics must
  make the command fail.
- Do not use broad suppressions, broad autofixes, or a global severity
  downgrade to manufacture a zero.

## Risks and stop conditions

- This is broad: 491 errors across 200 files. The one-PR requirement is
  satisfied by coherent rule-family commits, exact per-family checks, and one
  integrated final review.
- Hook dependency changes can alter render, request, subscription, and
  mutation behavior. Triage them manually; do not apply a broad unsafe fix.
- Accessibility and key changes can alter interaction semantics. Use stable
  domain identifiers and verify changed routes in a real browser.
- A rule that cannot reach zero without changing a public contract, weakening
  tests, or lowering severity globally requires a user ruling. Keep the
  exception narrow and documented if approved.
- The existing noBlankTarget review reports cover only that earlier slice.
  They are evidence for that slice, not the final review of the widened range.

## Packaging

This is full-path work. The final substantive size must be computed from
v3...HEAD excluding lockfiles, generated output, and project-artifact docs.
The PR description must state the result and name the package as the complete
Biome Tier 1 ratchet, not as a noBlankTarget follow-up.

No new PR or stack is created. All implementation, plan updates, review
reports, and verification remain on PR #5348.

## Slice 1 — preserve and recontract the existing work

### Do

- Keep the 30 noBlankTarget fixes and their completed browser evidence.
- Replace the previous noBlankTarget-only contract with this full milestone.
- Update project/2026-07-19-biome-knip-repo-quality.md to record the user's
  one-PR packaging ruling and the new enforcement target.

### Check

- Confirm the current base remains b30585496.
- Record the 491-error baseline from the current tree.
- Review the plan and PR text for stale “next slice” and “standalone rule”
  language.

### Commit

docs(project): expand PR 5348 to Biome Tier 1

## Slice 2 — resolve core correctness and suspicious errors

### Do

- Address baseline-flagged non-hook correctness and suspicious errors in
  .github/scripts, apps, packages, email templates, and util.
- Keep hook dependency findings, accessibility findings, and noArrayIndexKey
  findings for the later slices.
- Inspect every diagnostic before editing. Prefer the smallest fix that
  preserves the public behavior.
- For HTML/email/demo templates, either make the markup valid and accessible or
  document a narrow scope/configuration decision with the exact path and reason.

### Check

- Run the selected rule families with biome lint --only before and after.
- Run affected workspace checks, lint, and focused tests.
- Run git diff --check and inspect the semantic diff separately from formatting.

### Commit

fix(quality): resolve core Biome errors

## Slice 3 — resolve React hook diagnostics

### Do

- Triage all 189 useExhaustiveDependencies errors and five
  useHookAtTopLevel errors manually.
- Add missing dependencies only when the closure contract requires them.
- Remove unnecessary dependencies only after checking callback identity,
  request/subscription behavior, and component lifecycle.
- Keep intentionally stable values documented in the local code pattern rather
  than weakening the rule globally.

### Check

- Run the hook rules with biome lint --only and require zero errors.
- Run affected app/package checks, focused tests, and the relevant browser
  flows for changed UI behavior.
- Check for request loops, stale closures, and changed loading/error states.

### Commit

fix(quality): resolve React hook diagnostics

## Slice 4 — resolve accessibility and list-identity diagnostics

### Do

- Address the 111 accessibility errors, including static-element interaction,
  keyboard interaction, button type, anchor content, alt text, semantic-role,
  iframe-title, lang, and related findings.
- Address all 61 noArrayIndexKey errors with stable domain identifiers. Do not
  invent unstable keys or use array position as a substitute.
- Keep existing visual design and user-facing text unless the diagnostic
  requires a real accessible name or semantic element.

### Check

- Run the a11y and key rules with biome lint --only and require zero errors.
- Run affected app/package checks and focused tests.
- Use the repository agent-browser path for changed frontend routes and states;
  capture before/after screenshots where the UI or interaction semantics
  changed.

### Commit

fix(quality): resolve accessibility and key diagnostics

## Slice 5 — enforce the zero-error baseline

### Do

- Remove Biome continue-on-error from .github/workflows/check.yml and
  .github/workflows/check-lint.yml.
- Add lint:biome to the root check:all script so the local pre-commit gate
  enforces the same error baseline.
- Keep Knip continue-on-error and keep the existing ESLint step blocking.
- Update docs/getting-started.md, docs/ci-and-deployment.md,
  .agents/skills/klicker-testing-verification/SKILL.md, and add a dated
  docs/log entry describing the enforced-vs-advisory boundary.

### Check

- biome lint . reports zero errors; warnings and infos may remain.
- pnpm run check:all passes.
- pnpm run format:check, pnpm run lint, pnpm run check, syncpack, Prisma-sync,
  AGENTS validation, tests, and the full build pass in the pinned runtime.
- Gitleaks and opengrep run on the final range; classify new findings.
- CI passes on the widened PR.

### Commit

ci(quality): enforce Biome lint

## Review routing

- Planning stage: Codex Sol planner review completed for the widened package;
  concerns and sequencing are incorporated above.
- Intermediate review: use one bounded review if a hook, accessibility, or
  public-contract change creates a risk that needs independent judgment.
- Final gates: rerun the configured integrated Sol review, code-level security
  review, and thermo maintainability review on the exact widened range. Persist
  reports under project/_local/reviews/. Existing noBlankTarget reports do not
  close these final gates.
- Browser verification: use .agents/skills/agent-browser/SKILL.md for every
  frontend-facing slice.

## Progress

- 2026-08-09: PR #5186's six-phase Biome + Knip + Gitleaks migration is already
  merged into v3. This branch is follow-up ratchet work, not a replay of that
  migration.
- 2026-08-09: The original plan selected noBlankTarget as a standalone slice.
  User corrected the package boundary: finish the complete Tier 1 error
  milestone in PR #5348.
- 2026-08-09: The noBlankTarget slice closed all 30 diagnostics across 11 files.
  Its targeted checks, browser evidence, security review, maintainability
  review, and integrated review are recorded in the existing gitignored
  project/_local/reviews/ reports.
- 2026-08-09: Current post-slice Biome baseline is 491 errors, 2,461 warnings,
  and 425 infos across 1,651 files. Errors cover 200 files.
- 2026-08-09: Planning review recommended all current error-severity
  diagnostics as the one-PR package, with warnings, infos, Knip, Prettier, and
  ESLint remaining outside enforcement changes.
- 2026-08-10: The pinned DevPod was restored through devrouter. Its full
  check:all path passed, and the chat suite passed with 29 files and 226
  tests. The GraphQL local suite remains blocked because the DevPod image does
  not contain the Docker CLI required by its local runner; this is an
  environment gap, not a code failure.
- 2026-08-10: Core correctness and suspicious diagnostics were resolved in
  commit 241b7459d. The host pre-commit gate passed all typecheck, format,
  lint, syncpack, agent-doc, and Prisma-sync checks. Five nullable type issues
  found by that gate were fixed before the commit landed.
- 2026-08-10: A fresh full Biome error gate reports exactly 366 remaining
  errors, all in the planned hook, accessibility, and stable-key slices.

## Finish state

The goal is complete only when the widened plan and implementation are on the
same clean branch, the current configured Biome scope reports zero errors, the
local and CI Biome gates are blocking, warnings/infos and Knip remain explicitly
advisory, affected checks and browser evidence pass, final review reports cover
the exact integrated range, the PR body reports the complete package and
computed substantive size, and PR #5348 is updated without creating a second
delivery path.
