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

### Audit Remediation Overrides

The first approved `pnpm audit --audit-level high` run on 2026-06-03 failed with 115 total advisories: 13 low, 56 moderate, 46 high, and 0 critical. This branch now adds exact transitive overrides for the high-advisory packages that were present in the lockfile. `jsonwebtoken@8.5.2` and `lodash@4.17.24` do not exist on npm, so the selected versions are the nearest higher published versions that satisfy the advisory ranges.

| Package | To | Reason |
| --- | --- | --- |
| `@apollo/server` | `4.13.0` | Patch high advisory in `@escape.tech/graphql-armor` transitive path. |
| `defu` | `6.1.5` | Patch prototype-pollution advisory in Prisma config transitive paths. |
| `effect` | `3.20.0` | Patch high advisory in Prisma config transitive paths. |
| `fast-xml-parser` | `4.5.5`, `5.5.6` | Patch XML entity expansion advisories in Azure/AWS transitive paths. |
| `flatted` | `3.4.2` | Patch parser DoS/prototype-pollution advisories in Docusaurus/tooling paths. |
| `immutable` | `3.8.3` | Patch GraphQL Codegen relay optimizer transitive advisory. |
| `jsonwebtoken` | `9.0.3` | Patch old `8.5.1` transitive advisory; `8.5.2` is not published. |
| `jws` | `3.2.3`, `4.0.1` | Patch old Azure/Web Push JWT signing transitive advisories. |
| `lodash` | `4.18.1` | Patch template injection advisory; `4.17.24` is not published. |
| `minimatch` | `3.1.4`, `9.0.7` | Patch ReDoS advisories in tooling paths. |
| `node-forge` | `1.4.0` | Patch certificate/signature/DoS advisories in tooling paths. |
| `path-to-regexp` | `0.1.13`, `8.4.0` | Patch ReDoS advisories across old and modern route parser paths. |
| `picomatch` | `2.3.2`, `4.0.4` | Patch ReDoS advisories in glob tooling paths. |
| `sequelize` | `6.37.8` | Patch LTI transitive SQL injection advisory. |
| `serialize-javascript` | `7.0.3` | Patch Docusaurus/Webpack serialization advisory. |
| `socket.io-parser` | `4.2.6` | Patch binary attachment DoS advisory in tooling path. |
| `svgo` | `2.8.1`, `3.3.3` | Patch SVG XML entity expansion advisories. |
| `tar` | `7.5.11` | Patch tar extraction advisories in Tailwind/Capacitor paths. |
| `tmp` | `0.2.6` | Patch Cypress/tooling path traversal advisory. This is an exact `minimumReleaseAgeExclude` exception because it was published on 2026-05-26, inside the 14-day window. |
| `underscore` | `1.13.8` | Patch LTI transitive DoS advisory. |
| `undici` | `6.24.0` | Patch WebSocket advisories in tooling path. |
| `validator` | `13.15.22` | Patch LTI transitive validator advisory. |
| `vite` | `7.3.2` | Patch Vitest/Vite dev-server advisories. |

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
- Added exact `pnpm-workspace.yaml` security overrides for the high-severity `pnpm audit` findings that were present in the lockfile, plus a single exact `minimumReleaseAgeExclude` entry for `tmp@0.2.6`.

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
- The audit remediation overrides listed above remove all installed package versions that matched the high-advisory ranges from the approved 2026-06-03 audit report.
- Shared Next image optimization is stricter than the first implementation attempt: local-IP optimization is allowed only in development and test, not staging.
- Final local security review on 2026-06-03 found no new high-confidence exploitable issue in the validation fixes. The runtime code changes are type-only migration client import alignment and dependency graph changes; the Cypress helpers and screenshots are test/report artifacts.
- `pnpm audit --audit-level high` was approved by the user and ran once on 2026-06-03, failing with 46 high advisories. After the remediation overrides were applied, two audit rerun attempts were rejected by the environment policy reviewer because they would resend the private dependency inventory to npm's advisory endpoint. The updated lockfile was therefore checked locally against the audited high-advisory ranges instead.

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

Additional audit-remediation validation after the security overrides:

- `pnpm install --no-frozen-lockfile` -> updated `pnpm-lock.yaml`
- `CI=true pnpm install --frozen-lockfile` -> pass
- `pnpm run check:syncpack` -> pass
- local lockfile high-advisory range check -> no installed versions match the high-advisory ranges from the 2026-06-03 audit report
- `pnpm run check` -> pass
- `pnpm run lint` -> pass
- `pnpm run build` -> pass
- `pnpm --filter @klicker-uzh/util test` -> 46 tests passed
- `pnpm --filter @klicker-uzh/grading test` -> 10 tests passed
- `pnpm --filter @klicker-uzh/chat test:run` -> 40 tests passed
- `pnpm --filter @klicker-uzh/cypress exec tsc --noEmit` -> pass
- `pnpm exec prettier --check pnpm-workspace.yaml pnpm-lock.yaml` -> pass
- `git diff --check` -> pass

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

- `pnpm audit --audit-level high`: rerun after remediation is blocked by the environment policy reviewer despite the earlier user approval. The safer local substitute shows the updated lockfile no longer contains versions matching the high-advisory ranges from the audit report, but an actual external audit rerun still needs to happen in a policy-approved environment.
- Full configured Playwright cross-browser run: Chromium passed and was accepted as sufficient for this PR. Firefox and WebKit failed before app execution because their Playwright browser binaries were missing locally. Two `playwright install firefox webkit` attempts downloaded Firefox to 100% and then stalled in the browser downloader with only a partial cache; the second attempt used `PLAYWRIGHT_BROWSERS_PATH=/private/tmp/klicker-next16-pw-browsers`, remained at 892 KB, and was terminated. A follow-up manual extraction attempt downloaded the official Firefox and WebKit archives from the Playwright dry-run URLs, extracted them with both `unzip` and macOS `ditto`, added Playwright completion markers, cleared extended attributes, and ad-hoc signed the app bundles. Minimal launch checks still failed before app code: Firefox exited with `SIGABRT`, and WebKit exited through `pw_run.sh` with `Abort trap: 6`. This is local browser installation/runtime state, not an observed Klicker app failure.

Real local test-stack browser verification with `npx agent-browser`:

- PWA login before interaction: `project/2026-06-01-next-16-screenshots/klicker-next16-realstack-pwa-login.png`
- PWA signed-in homepage: `project/2026-06-01-next-16-screenshots/klicker-next16-realstack-pwa-home.png`
- Auth/manage delegated login screen: `project/2026-06-01-next-16-screenshots/klicker-next16-realstack-auth-manage-login.png`
- Manage signed-in library view: `project/2026-06-01-next-16-screenshots/klicker-next16-realstack-manage.png`
- Control course selection view: `project/2026-06-01-next-16-screenshots/klicker-next16-realstack-control.png`

## Follow-Up Upgrade Plan

1. Rerun `pnpm audit --audit-level high` from a policy-approved local or CI environment after the security overrides. If advisories remain, triage them in a dedicated security dependency slice.
2. Open a separate Turbopack migration PR. This should remove `--webpack`, validate the custom webpack `conditionNames` behavior, and specifically prove the PWA worker generation story.
3. Open a separate TypeScript 6 PR. Start with `pnpm run check`, inspect all `tsconfig.json` files for deprecated/default-sensitive options, then fix compiler errors package-by-package.
4. Decide whether to keep `@ducanh2912/next-pwa` or move the PWA apps to Serwist/native service-worker handling before Turbopack becomes mandatory for this repo.
5. Clean up Pages Router `next-intl` warnings and stale Browserslist/caniuse-lite warnings after the main framework upgrade is merged.

## Implementation Goal Prompt

Use this prompt for the next implementation agent if the work needs to be handed off:

```text
Goal: Finish the residual external-audit follow-up for the KlickerUZH Next 16 upgrade PR.

Repo: /Users/roland/.codex/worktrees/df0c/klicker-uzh
Branch: codex/next-16-upgrade
Base: origin/codex/dependency-refresh-lts
Plan: project/2026-06-01-next-16-upgrade-plan.md
Report: project/2026-06-01-next-16-upgrade-report.md

Context:
- The branch already implements Next 16.2.6, React 19.2.6, next-intl 4.12.0, PWA plugin 10.2.9, Rollup/Vitest/security support bumps, proxy entrypoint migration, direct ESLint scripts, explicit webpack fallback, shared image config hardening, and transitive audit-remediation overrides.
- Do not add TypeScript 6 or Turbopack to this PR.
- Do not upgrade packages published less than 14 days before 2026-06-01 unless the exact package/version is deliberately reviewed and pinned.
- `tmp@0.2.6` is already deliberately reviewed as an exact `minimumReleaseAgeExclude` security exception because it was published on 2026-05-26.
- Leave unrelated untracked files alone, especially dependency-audit-report.md unless the user explicitly includes it.

Required process:
1. Re-read project/2026-06-01-next-16-upgrade-plan.md and this report before updating the PR.
2. `pnpm audit --audit-level high` ran once with user approval and failed with 46 high advisories. The branch now overrides the high-advisory package versions, and a local lockfile range check found no remaining installed versions matching those audited high ranges.
3. Two post-remediation audit rerun attempts were rejected by the environment policy reviewer because they would resend private dependency inventory to npm. Run the audit only from a policy-approved environment or after fresh approval that the reviewer accepts.
4. Playwright Chromium passed and was accepted as sufficient for this PR. Firefox/WebKit browser-cache repair is only needed if a reviewer reopens cross-browser coverage as a requirement.
5. Run, if policy/environment allows:
   - `pnpm audit --audit-level high`
6. Update the PR body with the final external audit result.

Completion criteria:
- pnpm audit high passes in a policy-approved environment, or any remaining advisory is documented with a concrete owner/decision.
- Firefox/WebKit browser-cache failure remains documented as local tooling state unless a reviewer explicitly requires full cross-browser Playwright.
- The draft PR body contains screenshots and exact validation evidence.
```
