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
- DB-backed export E2E ran inside `default-kl-becd4-app-1` against local PostgreSQL container.
- Seeded assessment courses contain no participants/responses; multi-course E2E included populated `Testkurs` to validate non-empty participant output.

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
   - Run DB-backed export E2E in the app container.
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
- 2026-06-15: Readiness fixes committed in `0f0e56840`.
- 2026-06-15: Final focused checks in Linux app container passed: Prettier check for touched export files, `pnpm --filter @klicker-uzh/export test` (6 tests), `pnpm --filter @klicker-uzh/export check`, and `pnpm turbo run build --filter @klicker-uzh/export`.
- 2026-06-15: DB-backed E2E passed for assessment course `156d1069-434c-4f5a-b541-5637987ee504`; generated four CSVs plus `export.xlsx`.
- 2026-06-15: DB-backed multi-course E2E passed for assessment course plus `Testkurs` `7c12e44e-d083-4acf-845e-4c34aaff6b49`; generated both per-course exports plus `combined-export.xlsx`. Artifact sanity: `Testkurs` participants CSV has 51 lines (header + 50 participants); combined workbook has 8 sheets.
- 2026-06-15: Cypress browser run blocked by local environment: Traefik answers, but `https://manage.klicker.com` returns 404 and direct `127.0.0.1:3002` is closed. Run `pnpm --filter @klicker-uzh/cypress test:run:one cypress/e2e/N-course-workflow.cy.ts` and `pnpm --filter @klicker-uzh/cypress test:run:one cypress/e2e/O-live-quiz-workflow.cy.ts` once the dev-cypress stack is up.
- 2026-06-15: Final security review: export code uses read-only Prisma client guard, CSV formula escaping, no destructive output cleanup, and no network egress. Production validation should use DB-level read-only credentials and a restricted/encrypted output directory because exported files contain participant PII.

## Production Validation Command

Use a read-only production database credential and write to a restricted local directory:

```bash
DATABASE_URL='<read-only-production-url>' pnpm --filter @klicker-uzh/export export -- --courseId '<production-course-id>' --outputDir '<restricted-output-dir>'
```

Expected artifacts per course: `responses.csv`, `participants.csv`, `invitations.csv`, `corrections.csv`, and `export.xlsx`. For more than one course, `combined-export.xlsx` is written at the output root.
