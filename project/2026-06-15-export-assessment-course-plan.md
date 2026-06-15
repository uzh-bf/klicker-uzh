# Export Assessment Course Plan

Goal: make `export-assessment-course` current with `v3`, merge-ready, e2e-checked, safe for first production-course validation.

Branch: `export-assessment-course`
Target: `v3`
Worktree: `trees/export-assessment-course`
Plan path: `project/2026-06-15-export-assessment-course-plan.md`
MR/PR: unknown

## Non-Goals

- No public UI.
- No production data export in this session unless user supplies course id/env approval.
- No dependency major upgrades.

## Evidence

- `origin/v3` fetched 2026-06-15.
- `origin/v3` merged via `e00989fa7`.
- Conflicts resolved in `AGENTS.md`, `pnpm-lock.yaml`; lock regenerated with `pnpm install --lockfile-only --ignore-scripts`.
- Context7 checked: ExcelJS workbook/CSV write APIs, Prisma Client read queries/select/include.

## Risks

- Export touches production course data. Need read-only DB credentials preferred; code has Prisma read-only extension guard but DB user should also be read-only.
- CLI parsing must fail closed on malformed args.
- Existing branch carried Cypress flake hardening; must ensure no TS merge artifact remains.
- Local shell currently exposes Node `v26.3.0`; repo wants Node 20. Use Volta-managed commands where possible.

## Slices

1. Merge + Plan
   - Done: new worktree, latest `v3`, conflict resolution.
   - Check: `git diff origin/v3...HEAD`, lock no conflict markers.
   - Commit: merge commit already done; plan commit next.

2. Readiness Fixes
   - Fix GraphQL test helper duplicate type alias from merge.
   - Align `packages/export` version with current release.
   - Harden export CLI arg parsing and usage errors for production validation.
   - Add tests for CLI parser / export edge case if cheap.
   - Check: focused `@klicker-uzh/export` tests + typecheck.

3. Verification
   - Run `pnpm --filter @klicker-uzh/export check`.
   - Run `pnpm --filter @klicker-uzh/export test`.
   - Run `pnpm --filter @klicker-uzh/export build`.
   - Run `pnpm run check:syncpack` or targeted version/dependency check.
   - Run Cypress export-adjacent workflow if local env/DB available; otherwise document exact blocker and production validation command.

4. Final Gate
   - Security review: read-only guard, formula injection, output path behavior, PII handling.
   - Confirm branch diff only expected files.
   - Write next steps for production-course validation.

## Progress

- 2026-06-15: Worktree created. Latest `v3` merged. Lock regenerated.
- 2026-06-15: Review found duplicate `TestInitializationResult` type in `packages/graphql/test/helpers.ts` and stale export package version.
- 2026-06-15: Plan committed in `d4a2bcfbd`.
- 2026-06-15: Readiness fixes applied: duplicate type removed, export version aligned to alpha.62, CLI parser hardened, export row DTOs added for Prisma relation typing, quiz-name fallbacks added.
- 2026-06-15: Checks so far: `pnpm --filter @klicker-uzh/export check` passed; `pnpm --filter @klicker-uzh/export test` passed (6 tests); `pnpm --filter @klicker-uzh/export build` passed; `pnpm run check:syncpack` passed. Local pnpm uses standalone Node v26.3.0 and reports repo engine warnings; Volta Node 20.19.4 is installed.
- Next: commit readiness fixes, run final focused checks, then Cypress/export validation.
