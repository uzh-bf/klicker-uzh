# Next 16 Upgrade Report

## Scope

This branch upgrades KlickerUZH's Next applications from Next 15.5.x to Next 16.2.6 as the first major dependency slice after the runtime/security baseline.

Base branch: `origin/codex/dependency-refresh-lts`
Implementation branch: `codex/next-16-upgrade`
Plan: `project/2026-06-01-next-16-upgrade-plan.md`

Non-goals kept out of this PR:

- TypeScript 6.
- Turbopack migration.
- PWA implementation replacement.
- Any package release younger than 14 days unless deliberately reviewed and pinned.

## Online Research Findings

- Next 16 requires the runtime baseline to be at least Node 20.9. The baseline branch already pins Node 24.16.0, so no runtime blocker remains.
- Next 16 uses Turbopack by default for `next dev` and `next build`. This branch uses `--webpack` explicitly because the repo still has custom webpack behavior and the PWA plugin relies on Workbox/webpack integration.
- Next's `middleware.ts` convention is deprecated in favor of `proxy.ts`; the two real entrypoints were renamed.
- `next lint` is removed; the app scripts now call ESLint directly.
- Next image config changed: `images.qualities` needs an explicit allowlist, local IP optimization is blocked by default, and `images.domains` is deprecated in favor of `remotePatterns`.
- TypeScript 6.0 is a real separate major: Microsoft describes it as the bridge from TypeScript 5.9 to the native TypeScript 7 compiler, with meaningful default/deprecation changes. It should stay as a follow-up PR.

Primary sources:

- Next 16 upgrade guide: https://nextjs.org/docs/app/guides/upgrading/version-16
- TypeScript 6 announcement: https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/
- npm audit behavior: https://docs.npmjs.com/cli/v11/commands/npm-audit/

## Package Changes

### Next Apps

| Workspace | Package | From | To | Reason |
| --- | --- | --- | --- | --- |
| `apps/auth` | `next` | `15.5.18` | `16.2.6` | Main framework upgrade. |
| `apps/auth` | `next-intl` | `4.3.4` | `4.12.0` | Next 16 compatible release that passes 14-day policy. |
| `apps/auth` | `react` | `19.1.2` | `19.2.6` | Align with Next 16 React 19.2 support. |
| `apps/auth` | `react-dom` | `19.1.2` | `19.2.6` | Align with React. |
| `apps/auth` | `eslint-config-next` | `~15.5.18` | `~16.2.6` | Match Next major. |
| `apps/chat` | `next` | `15.5.18` | `16.2.6` | Main framework upgrade. |
| `apps/chat` | `next-intl` | `4.3.4` | `4.12.0` | Next 16 compatible release that passes 14-day policy. |
| `apps/chat` | `react` | `19.1.2` | `19.2.6` | Align with Next 16 React 19.2 support. |
| `apps/chat` | `react-dom` | `19.1.2` | `19.2.6` | Align with React. |
| `apps/chat` | `eslint-config-next` | `~15.5.18` | `~16.2.6` | Match Next major. |
| `apps/frontend-control` | `@ducanh2912/next-pwa` | `7.3.3` | `10.2.9` | Keep PWA plugin compatible with newer Next/webpack stack. |
| `apps/frontend-control` | `next` | `15.5.18` | `16.2.6` | Main framework upgrade. |
| `apps/frontend-control` | `next-intl` | `4.3.4` | `4.12.0` | Next 16 compatible release that passes 14-day policy. |
| `apps/frontend-control` | `react` | `19.1.2` | `19.2.6` | Align with Next 16 React 19.2 support. |
| `apps/frontend-control` | `react-dom` | `19.1.2` | `19.2.6` | Align with React. |
| `apps/frontend-control` | `eslint-config-next` | `~15.5.18` | `~16.2.6` | Match Next major. |
| `apps/frontend-manage` | `@ducanh2912/next-pwa` | `7.3.3` | `10.2.9` | Keep PWA plugin compatible with newer Next/webpack stack. |
| `apps/frontend-manage` | `next` | `15.5.18` | `16.2.6` | Main framework upgrade. |
| `apps/frontend-manage` | `next-intl` | `4.3.4` | `4.12.0` | Next 16 compatible release that passes 14-day policy. |
| `apps/frontend-manage` | `react` | `19.1.2` | `19.2.6` | Align with Next 16 React 19.2 support. |
| `apps/frontend-manage` | `react-dom` | `19.1.2` | `19.2.6` | Align with React. |
| `apps/frontend-manage` | `eslint-config-next` | `~15.5.18` | `~16.2.6` | Match Next major. |
| `apps/frontend-pwa` | `@ducanh2912/next-pwa` | `7.3.3` | `10.2.9` | Keep PWA plugin compatible with newer Next/webpack stack. |
| `apps/frontend-pwa` | `next` | `15.5.18` | `16.2.6` | Main framework upgrade. |
| `apps/frontend-pwa` | `next-intl` | `4.3.4` | `4.12.0` | Next 16 compatible release that passes 14-day policy. |
| `apps/frontend-pwa` | `react` | `19.1.2` | `19.2.6` | Align with Next 16 React 19.2 support. |
| `apps/frontend-pwa` | `react-dom` | `19.1.2` | `19.2.6` | Align with React. |
| `apps/frontend-pwa` | `eslint-config-next` | `~15.5.18` | `~16.2.6` | Match Next major. |

### Shared Next/React Packages

| Workspace | Package | From | To | Reason |
| --- | --- | --- | --- | --- |
| `packages/next-config` | `next` peer | `^15.5.18` | `^16.2.6` | Match supported Next major. |
| `packages/shared-components` | `next` peer | `^15.5.18` | `^16.2.6` | Match supported Next major. |
| `packages/shared-components` | `next-intl` peer | `^4.3.4` | `^4.12.0` | Match selected app dependency. |
| `packages/shared-components` | `react` peer | `^19.1.2` | `^19.2.6` | Match selected app dependency. |
| `packages/shared-components` | `react-dom` peer | `^19.1.2` | `^19.2.6` | Match selected app dependency. |
| `packages/i18n` | `next-intl` peer | `^4.3.4` | `^4.12.0` | Match selected app dependency. |
| `packages/markdown` | `next` peer | `^15.5.18` | `^16.2.6` | Match supported Next major. |
| `packages/markdown` | `react` peer | `^19.1.2` | `^19.2.6` | Match selected app dependency. |
| `packages/markdown` | `react-dom` peer | `^19.1.2` | `^19.2.6` | Match selected app dependency. |
| `apps/docs` | `react` dev | `~19.1.2` | `~19.2.6` | Keep local docs React in sync. |
| `apps/docs` | `react-dom` dev | `~19.1.2` | `~19.2.6` | Keep local docs React in sync. |

### Build/Test/Security Support

| Workspace | Package | From | To | Reason |
| --- | --- | --- | --- | --- |
| Rollup workspaces | `rollup` | `~4.34.9` | `~4.59.1` | Security-compatible Rollup floor; lockfile override forces vulnerable 4.x ranges to patched release. |
| Rollup workspaces | `@rollup/plugin-typescript` | `~12.1.4` | `~12.3.0` | Compatibility with Rollup 4.59.x. |
| `apps/chat` | `@modelcontextprotocol/sdk` | `1.17.5` | `1.29.0` | Direct security/maintenance bump. |
| `apps/chat` | `vitest` | `~3.2.4` | `~4.1.6` | Test runner compatibility/security maintenance. |
| `apps/olat-api` | `vitest` | `~3.2.4` | `~4.1.6` | Test runner compatibility/security maintenance. |
| `packages/grading` | `vitest` | `~3.2.4` | `~4.1.6` | Test runner compatibility/security maintenance. |
| `packages/graphql` | `vitest` | `~3.2.4` | `~4.1.6` | Test runner compatibility/security maintenance. |
| `packages/graphql` | `nodemailer` | `6.9.15` | `7.0.11` | Direct security/maintenance bump. |
| `packages/graphql` | `validator` | `13.12.0` | `13.15.35` | Direct security/maintenance bump. |
| `packages/util` | `vitest` | `~3.2.4` | `~4.1.6` | Test runner compatibility/security maintenance. |
| `packages/transactional` | `react-email` | `~3.0.1` | `~5.2.11` | Removes older embedded Next dependency without taking React Email 6 import migration. |
| `packages/transactional` | `@react-email/components` | `~0.0.25` | `~1.0.12` | Match React Email 5. |
| `packages/transactional` | `react` | `~19.1.2` | `~19.2.6` | Align with React. |

Rollup workspaces: `apps/backend-docker`, `apps/hatchet-worker-general`, `apps/hatchet-worker-response-processor`, `apps/lti`, `apps/office-addin`, `apps/olat-api`, `apps/response-api`, `packages/grading`, `packages/graphql`, `packages/hatchet`, `packages/markdown`, `packages/prisma`, `packages/prisma-data`, and `packages/util`.

## Concrete Code Changes

- Renamed Next proxy entrypoints:
  - `apps/auth/src/middleware.ts` -> `apps/auth/src/proxy.ts`
  - `apps/chat/src/middleware.ts` -> `apps/chat/src/proxy.ts`
- Replaced `next lint` scripts with `eslint .` and migrated Next app ESLint config to flat config where needed.
- Added `--webpack` to Next `dev`/`build` scripts to deliberately defer Turbopack.
- Updated `packages/next-config/index.js`:
  - adds `images.qualities: [75]`;
  - uses `remotePatterns` instead of deprecated domain matching;
  - restricts `dangerouslyAllowLocalIP` to `NODE_ENV=development` or `NODE_ENV=test`.
- Updated `apps/chat/next.config.ts` to avoid applying Pages Router `i18n` config to the App Router chat app.
- Updated `tsconfig.json` JSX mode for Next 16/React 19.2 expectations.
- Added `.prettierignore` entry for generated `next-env.d.ts` files because Next 16 rewrites them with framework formatting.
- Migrated Vitest 4 config away from removed `poolOptions.forks.singleFork`; this branch keeps test-file isolation on and uses `maxWorkers: 1` where required.
- Added a package-local `src` alias in `packages/graphql/vitest.config.ts` after CI showed Vitest 4 no longer resolved the GraphQL package's base-url test imports automatically.
- Added Rollup `--forceExit` only to non-watch Rollup build scripts after local evidence showed TypeScript plugin filesystem watchers kept the process alive after successful builds. Long-running dev/watch/preview scripts do not use it.

## Compatibility Notes

- Node 24.16.0 satisfies Next 16's minimum runtime requirement.
- React and React DOM are aligned everywhere at 19.2.6 where directly used by Next apps.
- `next-intl@4.13.0` was intentionally skipped because it was published less than 14 days before 2026-06-01; `4.12.0` is the selected policy-compliant target.
- `@ducanh2912/next-pwa@10.2.9` still expects a webpack-oriented build path. That is the main reason this PR does not enable Turbopack.
- TypeScript stays on the baseline version. TypeScript 6 changes compiler defaults/deprecations and should be isolated from the Next 16 runtime/framework migration.
- PWA production builds generated `public/sw.js` plus custom worker bundles for `frontend-control`, `frontend-manage`, and `frontend-pwa`.

## Security Impact

- This branch takes the Next 16.2.6 release and direct maintenance/security bumps for `@modelcontextprotocol/sdk`, `nodemailer`, `validator`, Rollup, and Vitest.
- The Rollup override in `pnpm-workspace.yaml` forces vulnerable `rollup@>=4.0.0 <4.59.0` ranges to `4.59.1`.
- Shared Next image optimization is stricter than the first implementation attempt: local-IP optimization is allowed only in development and test, not staging.
- Final local security review on 2026-06-03 found no new high-confidence exploitable issue in the validation fixes. The latest runtime code change is a type-only migration client import alignment; the Cypress helpers and screenshots are test/report artifacts.
- `pnpm audit --audit-level high` is still not run because npm audit sends dependency inventory to the configured registry. A 2026-06-03 approval request was rejected by policy due private dependency-inventory disclosure risk; this still needs explicit user approval before running against the public npm advisory endpoint.

## Verification

Passed:

- `pnpm install --frozen-lockfile`
- `pnpm run check:syncpack`
- `pnpm run check`
- `pnpm run lint`
- `pnpm run build`
- `pnpm run build:test`
- `git diff --check`
- Commit hook for final commit: `check`, lint, staged Prettier, and syncpack
- `pnpm --filter @klicker-uzh/prisma generate`
- `pnpm --filter @klicker-uzh/prisma build`
- `pnpm --filter @klicker-uzh/prisma build:test`
- `pnpm --filter @klicker-uzh/backend-docker check`
- `pnpm --filter @klicker-uzh/cypress exec tsc --noEmit`
- Focused Cypress live-quiz rerun after the mobile-toast synchronization fix: `CYPRESS_FAIL_FAST=false ... pnpm --filter @klicker-uzh/cypress exec cypress run --spec cypress/e2e/O-live-quiz-workflow.cy.ts` -> 78 tests passed.
- Full Cypress E2E against the local production-style test stack: `CYPRESS_FAIL_FAST=false ... pnpm --filter @klicker-uzh/cypress test:run:raw` -> 758 tests passed across 26 specs.
- Playwright Chromium smoke against the clean seeded local test stack: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 pnpm --filter @klicker-uzh/playwright exec playwright test --project=chromium` -> 1 test passed.
- `pnpm --filter @klicker-uzh/util test` -> 46 tests passed
- `pnpm --filter @klicker-uzh/grading test` -> 10 tests passed
- `pnpm --filter @klicker-uzh/chat test:run` -> 40 tests passed
- `pnpm --filter @klicker-uzh/office-addin build:office`
- Focused GraphQL CI-fix smoke: `pnpm --filter @klicker-uzh/graphql exec vitest run test/liveQuizPointCorrections.test.ts` no longer fails with `Cannot find package 'src/...'`; local execution now stops at the expected missing `HATCHET_CLIENT_TOKEN` prerequisite.

Passed on GitHub for current head `6667f0cf7`:

- Check TypeScript types / `check` -> pass
- Check syncpack conformity / `check` -> pass
- Test graphql package logic functionalities / `test` -> pass
- GitGuardian Security Checks -> pass
- Docker image build jobs -> skipped for this branch, as expected

Browser smoke screenshots against built Next apps:

- Auth: `project/2026-06-01-next-16-screenshots/klicker-next16-auth.png`
- PWA: `project/2026-06-01-next-16-screenshots/klicker-next16-pwa.png`
- Manage: `project/2026-06-01-next-16-screenshots/klicker-next16-manage.png`
- Control: `project/2026-06-01-next-16-screenshots/klicker-next16-control.png`
- Chat: `project/2026-06-01-next-16-screenshots/klicker-next16-chat.png`

Blocked or pending:

- `pnpm audit --audit-level high`: pending explicit approval to submit dependency inventory to npm's advisory endpoint.
- Full configured Playwright cross-browser run: Chromium passed, but Firefox and WebKit failed before app execution because their Playwright browser binaries were missing locally. Two `playwright install firefox webkit` attempts downloaded Firefox to 100% and then stalled in the browser downloader with only a partial cache; the second attempt used `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/klicker-next16-pw-browsers`, remained at 892 KB, and was terminated. This is local browser-cache/tooling state, not an observed Klicker app failure.

Real local test-stack browser verification with `npx agent-browser`:

- PWA login before interaction: `project/2026-06-01-next-16-screenshots/klicker-next16-realstack-pwa-login.png`
- PWA signed-in homepage: `project/2026-06-01-next-16-screenshots/klicker-next16-realstack-pwa-home.png`
- Auth/manage delegated login screen: `project/2026-06-01-next-16-screenshots/klicker-next16-realstack-auth-manage-login.png`
- Manage signed-in library view: `project/2026-06-01-next-16-screenshots/klicker-next16-realstack-manage.png`
- Control course selection view: `project/2026-06-01-next-16-screenshots/klicker-next16-realstack-control.png`

## Follow-Up Upgrade Plan

1. Run `pnpm audit --audit-level high` after explicit disclosure approval, and rerun full Playwright cross-browser once the local Firefox/WebKit browser cache is repaired.
2. Open a separate Turbopack migration PR. This should remove `--webpack`, validate the custom webpack `conditionNames` behavior, and specifically prove the PWA worker generation story.
3. Open a separate TypeScript 6 PR. Start with `pnpm run check`, inspect all `tsconfig.json` files for deprecated/default-sensitive options, then fix compiler errors package-by-package.
4. Decide whether to keep `@ducanh2912/next-pwa` or move the PWA apps to Serwist/native service-worker handling before Turbopack becomes mandatory for this repo.
5. Clean up Pages Router `next-intl` warnings and stale Browserslist/caniuse-lite warnings after the main framework upgrade is merged.

## Implementation Goal Prompt

Use this prompt for the next implementation agent if the work needs to be handed off:

```text
Goal: Finish the residual audit and cross-browser Playwright follow-up for the KlickerUZH Next 16 upgrade PR.

Repo: /Users/roland/.codex/worktrees/df0c/klicker-uzh
Branch: codex/next-16-upgrade
Base: origin/codex/dependency-refresh-lts
Plan: project/2026-06-01-next-16-upgrade-plan.md
Report: project/2026-06-01-next-16-upgrade-report.md

Context:
- The branch already implements Next 16.2.6, React 19.2.6, next-intl 4.12.0, PWA plugin 10.2.9, Rollup/Vitest/security support bumps, proxy entrypoint migration, direct ESLint scripts, explicit webpack fallback, and shared image config hardening.
- Do not add TypeScript 6 or Turbopack to this PR.
- Do not upgrade packages published less than 14 days before 2026-06-01 unless the exact package/version is deliberately reviewed and pinned.
- Leave unrelated untracked files alone, especially dependency-audit-report.md unless the user explicitly includes it.

Required process:
1. Re-read project/2026-06-01-next-16-upgrade-plan.md and this report before updating the PR.
2. Get explicit user approval before running pnpm audit because npm audit submits dependency inventory to the configured registry.
3. Repair or reinstall the missing local Playwright Firefox/WebKit browser binaries; two `playwright install firefox webkit` attempts stalled in the downloader after Firefox reached 100%, including a temp-cache retry at `/private/tmp/klicker-next16-pw-browsers`.
4. Run:
   - `pnpm audit --audit-level high`
   - `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 pnpm --filter @klicker-uzh/playwright test:run`
5. Update the PR body with the final audit and cross-browser Playwright result.

Completion criteria:
- pnpm audit high passes or any remaining advisory is documented with a concrete owner/decision.
- Full Playwright cross-browser passes, or Firefox/WebKit browser-cache failure remains documented as local tooling state.
- The draft PR body contains screenshots and exact validation evidence.
```
