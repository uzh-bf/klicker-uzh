# TypeScript 6 Migration Plan

Problem: migrate repo from TypeScript 5.6 to 6.0 on branch `codex/next-16-upgrade`, PR `#5111`.
Target: `codex/dependency-refresh-lts`.
Plan path: `project/2026-06-03-pr-5111-typescript-6-migration-plan.md`.
History: `project/2026-06-01-next-16-upgrade-plan.md`.

## Goal

Do: upgrade TypeScript to `~6.0.3`, keep Node 24 baseline, keep GraphQL stack stable.
Do: fix TS 6 config breakages with minimal config/code changes.
Do: verify install, syncpack, typecheck, lint, build, audit.

## Non-Goals

Skip: GraphQL/Pothos/Yoga/codegen major upgrades unless TS 6 cannot compile without them.
Skip: Node 25 / `@types/node@25`.
Skip: broad Docusaurus, ESLint, Prisma, or frontend modernization.
Skip: runtime UI changes unless type fixes require touching UI code.

## Research

Evidence:
- TypeScript 6.0 release notes: `types` default now `[]`; `rootDir` default now tsconfig dir; `baseUrl`, `target: es5`, old `node`/`classic` module resolution, `outFile`, false interop flags deprecated; TS 7 removes TS 6 deprecations.
- TypeScript 6.0 announcement: TS 6 is bridge release before native TS 7.
- `@typescript-eslint/parser@8.59.4` and `@typescript-eslint/eslint-plugin@8.59.4`: peer `typescript >=4.8.4 <6.1.0`; Node range includes Node 24.
- Docusaurus 3.10: new TS 6 sites still need `"ignoreDeprecations": "6.0"` for now.
- Docusaurus issue #11893: `@docusaurus/tsconfig` still exposes TS 6 `baseUrl` deprecation.

Local:
- `typescript ~5.6.3` appears in root and workspaces.
- `@types/node ^24.10.1` appears in root and Node-aware workspaces.
- `@typescript-eslint/* ~8.35.1` only direct in `apps/office-addin`.
- `baseUrl` appears in most tsconfigs.
- `target: "es5"` appears in `apps/frontend-control`, `apps/frontend-manage`, `apps/frontend-pwa`.
- Explicit `types` only in Cypress, Playwright, GraphQL tests, Grading tests.

Sources:
- https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html
- https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
- https://typescript-eslint.io/users/dependency-versions
- https://docusaurus.io/blog/releases/3.10
- https://github.com/facebook/docusaurus/issues/11893

## Skill Routing

Use: `$dependency-upgrade` for staged dependency bump.
Use: `$sliced-development-workflow` for plan/progress/slice commits.
Use: `$caveman` basic form for this plan.
Use: `$verification-before-completion` before final done claim.
Use: review + simplification pass per slice where practical.

## Progress

Current: Slice 3 ready to commit.
Status: Slice 0 committed as `3ebddb7a8`.
Status: Slice 1/2 committed together as `39e6f164e`.
Evidence: pre-commit ran `check:all`; syncpack, lint-staged, turbo check/lint hook tasks passed.
Evidence: bumped TS to `~6.0.3`, Node types to `^24.12.4`, Office TS-eslint tooling to TS 6-compatible versions.
Evidence: `pnpm install --frozen-lockfile` passed; `pnpm run check:syncpack` passed.
Evidence: `pnpm --filter @klicker-uzh/prisma generate` passed with `prisma-json-types-generator@3.6.0` under TS 6.
Evidence: `pnpm peers check` still fails only on pre-existing non-TS peer mismatches; TS-specific peer failures removed.
Evidence: `pnpm run check` passed after TS 6 config compatibility changes and after rebuilding Prisma declarations.
Evidence: `pnpm --filter @klicker-uzh/prisma build` passed without TS4094 after post-generating public null-sentinel annotations for `internal/prismaNamespace.ts`.
Evidence: `pnpm --filter @klicker-uzh/graphql check` and `pnpm --filter @klicker-uzh/backend-docker check` passed against rebuilt Prisma `dist` declarations.
Evidence: `pnpm --filter @klicker-uzh/frontend-pwa check` passed after replacing stale bare `public/rank*.svg` imports with relative public asset imports.
Evidence: `pnpm --filter @klicker-uzh/frontend-pwa build` passed with existing next-intl, Browserslist, and large page-data warnings.
Evidence: `pnpm --filter @klicker-uzh/frontend-manage check` passed after replacing stale bare `public/img/rank*.svg` imports with relative public asset imports.
Evidence: `pnpm --filter @klicker-uzh/frontend-manage build` passed with existing next-intl missing-message and large page-data warnings.
Evidence: `pnpm -w build` passed: 19/19 tasks successful.
Evidence: `pnpm audit --audit-level high` passed; npm audit returned 48 low/moderate vulnerabilities and no high/critical findings.
Evidence: `pnpm run lint` passed after Slice 3 import fixes.
Review: local review only; multi-agent spawning requires explicit user request. No scope creep found. Narrow override added for Prisma generator stale TS peer.
Decision: Slice 1 and Slice 2 will be committed together because dependency-only TS 6 state did not typecheck.
Decision: Slice 3 fixes only stale public asset import resolution exposed by the Next/TS build path; no GraphQL upgrades added.
Next: run explicit Prettier check for edited files, then commit Slice 3.

## Slices

### Slice 0: Plan Commit

Do:
- Add current plan file.
- Commit only plan file.

Check:
- `git status --short`.

Commit:
- `docs(project): add TypeScript 6 migration plan`

### Slice 1: Dependency Tracer Bullet

Do:
- Bump all direct `typescript` entries to `~6.0.3`.
- Bump direct `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` in `apps/office-addin` to `~8.59.4`.
- Bump direct `@types/node` entries to latest Node 24 line, `^24.12.4`.
- Run `pnpm install` to update lockfile.

Check:
- `pnpm install --frozen-lockfile`.
- `pnpm run check:syncpack`.

Commit:
- `chore(deps): upgrade TypeScript to 6.0`

### Slice 2: TS 6 Config Compatibility

Do:
- Run `pnpm run check`.
- Add explicit `types` only where TS 6 reports missing globals.
- Remove or replace `baseUrl` where straightforward.
- Use `"ignoreDeprecations": "6.0"` only for third-party inherited config or short-lived Docusaurus gap.
- Raise ES5 frontend targets to ES2015 if TS 6 reports deprecation errors.
- Fix local TS errors with minimal code/config changes.

Check:
- `pnpm run check`.
- Targeted workspace checks for changed packages when needed.

Commit:
- `chore(tsconfig): align configs with TypeScript 6`

### Slice 3: Build, Lint, Tests, Audit

Do:
- Run broader verification.
- Fix only regressions caused by TS 6 migration.
- Keep GraphQL dependency upgrades out unless unavoidable.

Check:
- `pnpm run lint`.
- `pnpm run build`.
- Targeted tests if code changes happen.
- `pnpm audit --audit-level high`.

Commit:
- If fixes needed: conventional commit by scope.
- If no fixes: no extra commit.

### Slice 4: Final Review + PR Update

Do:
- Update plan `Progress`.
- Run final security/best-practice review for dependency/config change.
- Update PR #5111 body if TS 6 migration lands in same PR.

Check:
- Fresh `git status --short`.
- Fresh summary of verification results.

Commit:
- `docs(project): record TypeScript 6 migration completion`

## Risks

Risk: generated GraphQL/Prisma types expose TS 6 errors.
Decision: fix local code/config first; avoid GraphQL stack upgrades.

Risk: `baseUrl` removal changes import resolution.
Decision: only remove where paths make behavior explicit; otherwise use temporary deprecation ignore.

Risk: Docusaurus config inherits deprecated `baseUrl`.
Decision: prefer local `ignoreDeprecations` over broad Docusaurus upgrade unless build/check requires more.
