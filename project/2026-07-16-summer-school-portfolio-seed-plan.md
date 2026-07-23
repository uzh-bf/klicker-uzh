# Summer School 2026 Portfolio Seed Plan

## Goal

Prepare and dry-run a safe production seed for Summer School 2026 portfolio-game points and the existing `Portfolio Professional` achievement.

## Non-goals

- Do not replay previously awarded Swiss Quiz, Escape Room, or business-simulation points.
- Do not execute production writes without a fresh explicit approval.
- Do not process or commit names, emails, or other personal data.

## Identity

- Plan: `project/2026-07-16-summer-school-portfolio-seed-plan.md`
- Branch: `codex/summer-school-portfolio-seed`
- Target: `v3`
- PR: not created

## Evidence and decisions

- Sanitized source: ignored root-checkout workbook `project/_local/20260716_SS_Participants.xlsx`.
- Portfolio input: 36 participants, 25,700 point/XP delta, three awards.
- Production achievement: ID 21, `Portfolio Professional`, participant/global scope.
- Prior July seed payload: 36,592 points for completed activities; never reuse it for this run.
- Production dry-run anomaly: one participant has an inactive course participation; another has no participation row but has the expected prior 900-point course leaderboard state and participant ID from the prior payload.
- Decision: add a separate portfolio-only script and ignored input file.
- Decision: default to dry-run, require existing course leaderboard state for all participants, and require a matching before-state snapshot before writes.
- ADR: none; one-off operational safety change, not a durable architecture trade-off.

## Skill routing

- `spreadsheets`: inspect and correct the ignored workbook.
- `df-safe-database-scripting`: dry-run, comparison, double-dump, and replay safeguards.
- `klicker-data-model`: seed-data conventions.
- `klicker-wiki-maintenance`: document new seed command and safety contract.
- `verification-before-completion`: fresh evidence before completion claims.

## Research

- Repository and production inspection completed directly; no external research needed.
- Independent agents omitted because session policy prohibits delegation.

## Slices

### Slice 1: Correct and validate sanitized source

- Fix two Klicker username cells in ignored workbook.
- Generate ignored portfolio-only input.
- Check: 36 unique usernames, 25,700 points, three awards, zero formula errors.
- Commit: none; inputs remain ignored and local.

### Slice 2: Add safe portfolio seed

- Add portfolio-only script and production command.
- Add runtime validation, case-insensitive matching, prior course-state check, exact achievement validation, comparison CSV, before snapshot, replay lock, atomic mutation, and after verification.
- Update data/migration wiki and log.
- Check: format, typecheck, static review.
- Commit: `chore(prisma-data): prepare portfolio seed`

### Slice 3: Production dry-run

- Run production command with default dry-run.
- Check: 36 matches, 25,700 points, three awards, before dump written, zero database writes.
- Stop before `DRY_RUN=false`.
- Commit: plan progress only if evidence changes tracked state.

## Progress

- Active: complete.
- Done: repository/history discovery; sanitized workbook correction and validation; ignored portfolio-only input generation; safe script and documentation; production dry-run; approved production write.
- Production result: 36 successes, zero mismatches; leaderboard score +25,700; XP +25,700; three requested portfolio achievements; ignored after-state dump written.
- Final review hardening: bind snapshots to the exact validated payload, refuse to overwrite a changed before snapshot, and treat the after dump as a completed-run receipt.
- PR review hardening: reject unsupported input properties so unexpected columns, including PII fields, cannot pass validation silently.
- Final gates: thermo-nuclear maintainability review found the replay-lock gap above; it is resolved with no remaining blockers. Security review found no high-confidence vulnerabilities in the operator-only Prisma workflow.
- Verification: independent production read-back matched all 36 after-state records with zero mismatches. Targeted strict TypeScript and Prettier checks passed. Package ESLint could not run because this package has no ESLint v9 config; the production `tsx` execution compiled and completed. The final pre-push production build passed all 21 tasks.
- Next: retain the ignored before/after dumps locally for operational audit; no further seed action required.
