# Slice 8 verification — 2026-07-11

Branch: `feature/upgrade-next-react`
Verified SHA before evidence commit: `f409ae5fa`

## Environment

- Fresh DevPod: `klicker-upgrade-next-react-slice8`
- Workspace slug: `upgrade-next-react-slice8`
- New database, node_modules, and Hatchet volumes
- Node `24.16.0`; pnpm `11.5.0`
- `CI=true pnpm install --frozen-lockfile`: passed

## Automated evidence

- Clean production build: `NODE_ENV=production pnpm exec turbo run build --concurrency=4 --force` — 21/21 tasks passed, zero cached.
- Test build: `TURBO_CONCURRENCY=4 pnpm run build:test` — 19/19 tasks passed.
- Fresh-container typecheck: 23/23 tasks passed. Container lint could not run unchanged analytics lint because the devcontainer lacks `uv`.
- Git-aware host `pnpm run check:all`: passed under pinned Node/pnpm.
- Chat Vitest: 9 files, 40 tests passed.
- `git diff --check origin/v3...HEAD`: passed.
- Repository-wide Opengrep: completed with 607 baseline findings. Security review's scoped scan of changed runtime/config files: zero findings/errors.

## Build artifacts

- All five apps built with Next `16.2.9 (webpack)`.
- Chat standalone server: `apps/chat/.next/standalone/apps/chat/server.js`.
- Control/manage/PWA: `sw.js`, Workbox chunk, and custom worker emitted in each `public/` directory.
- Development PWA registration count: zero. Dev logs report PWA disabled.

## Browser evidence

- Auth: login surface rendered.
- Manage: delegated login returned to manage library; seeded elements rendered.
- PWA: participant login returned home; seeded course and microlearning rendered.
- Control: authenticated course selector rendered.
- Chat: `/noLogin` rendered login-required surface.
- Mobile: PWA home captured with iPhone 14 emulation.
- Next dev resources returned 200 after adding development-only `allowedDevOrigins` for recursive `**.klicker.localhost` worktree hosts.

Screenshots: `auth.png`, `manage-authenticated.png`, `pwa-authenticated.png`, `pwa-mobile.png`, `control.png`, `chat-no-login.png`.

## Reviews

- Security review: no high-confidence branch-introduced findings.
- Thermo-nuclear maintainability review: no findings.
- Independent branch review: no code findings; stale plan status fixed with this evidence update.

## Residual gates

- Authenticated chat content remains unverified: seeded stack exposes no known chatbot URL and lacks Langfuse/OpenAI configuration.
- Full live-quiz Cypress spec remains blocked at the documented legacy response-state boundary.
- Production PWA registration/update/offline browser behavior remains unverified; production artifacts are verified, development correctly disables registration.
- AMD and ARM image jobs require replacement PR CI; no remote checks exist before push.

## Slice 10 revision-bound verification — 2026-07-18

Implementation SHA: `76301b9416de5e80528e7862b6fd288e72adc3ff`

Environment: Node `24.16.0`; pnpm `11.5.0`.

Automated evidence rerun after the implementation commit:

- `CI=true pnpm install --frozen-lockfile --offline`: passed.
- `pnpm run check:all`: passed, including 23/23 typecheck tasks, 6/6 lint tasks, formatting, syncpack, AGENTS validation, and Prisma sync.
- `pnpm --filter @klicker-uzh/auth --filter @klicker-uzh/chat --filter @klicker-uzh/frontend-control --filter @klicker-uzh/frontend-manage --filter @klicker-uzh/frontend-pwa run build:test`: all five Turbopack test builds passed.
- `pnpm run build`: passed 21/21 tasks. Auth and chat used Turbopack; control, manage, and PWA used Webpack for production service-worker compatibility.
- Auth standalone `/` returned HTTP 200; chat standalone `/api/health` returned HTTP 200.

Build artifacts:

- Standalone servers exist for all five apps under `apps/<app>/.next/standalone/apps/<app>/server.js`.
- Control emitted `public/sw.js` and `public/worker-17b771828705222f.js`.
- Manage emitted `public/sw.js` and `public/worker-17b771828705222f.js`.
- PWA emitted `public/sw.js` and `public/worker-b5a6b2ba8c13cceb.js`.

Browser evidence from the implementation tree committed as the SHA above:

- PWA `/login` and chat `/noLogin` rendered from same-origin `localhost` Turbopack development servers.
- `agent-browser errors` returned no errors for either page.
- PWA development registered zero service workers, preserving the development contract.

Reviews:

- Independent slice review found no runtime, package, PWA, security, scope, or ADR defect.
- Independent simplification review findings were integrated: unrelated lockfile edges were restored, superseded documentation was clarified, stale next steps were removed, and standalone verification now covers all five apps.
- Code-level security review found no high-confidence vulnerabilities.
- Strict maintainability review found no structural regression or simpler safe design.

Clean-install follow-up:

- Rebuilding `node_modules` from the frozen lockfile exposed four Pages Router typecheck failures because their `<style jsx global>` blocks depended on styled-jsx's React type augmentation.
- Each block only defined `:root` font variables, so auth, control, manage, and PWA now use native `<style>` tags with the same global CSS behavior.
- All four focused typechecks and all four Turbopack `build:test` commands passed after the change.
- The Turbopack `styled-jsx/style.js` module warning is no longer present.
- PWA `/login` rendered with both font variables set to the generated Next font token, no browser errors, and zero service-worker registrations.
- Full `pnpm run check:all` and `pnpm run build` passed with the fixed worktree.
- Independent review and simplification found no issues with the native style change.

Playwright artifact follow-up:

- Current-head CI built all test artifacts, but every Playwright shard timed out because PWA `/` returned HTTP 500 before tests started.
- The downloaded CI artifact reproduced the same HTTP 500 locally: `next-intl-*` could not resolve `use-intl` after direct artifact upload dereferenced Turbopack's `.next/node_modules` symlink.
- The locally built artifact returned HTTP 200 with `.next/cache` removed, ruling out the cache exclusion.
- Tarring the `.next` tree before transfer preserved its dependency symlinks; the extracted artifact returned HTTP 200 in the same `next start` and curl loop.
- The workflow now tars all five `.next` trees before upload and extracts them in each Playwright shard.
- Independent review found no issue; simplification removed the now-stale hidden-file upload option.
- Current-head CI restored the tarred artifact successfully in all eight shards. Seven shards passed; shard 5 reached tests but repeatedly navigated into a catalog collection while opening its action dropdown, detaching the delete modal before the test could cancel it.
- The dropdown trigger was nested in the row's navigation target without its own event boundary. The row now ignores its marked action subtree while preserving the Dropdown button and portal behavior.
- Focused manage typecheck and Turbopack `build:test` passed. Independent review and simplification found no issue. Local browser verification is blocked because Docker cannot create another branch-local DevPod network: `all predefined address pools have been fully subnetted`; the focused Playwright shard remains the browser gate.
- CI verified the catalog fix: shard 5 passed 102 tests in 4.5 minutes, and the formerly failing catalog permission test passed in 7.4 seconds. Seven of eight shards passed.
- Shard 8 then exposed a separate submit race in the serial instance-update suite. Activity wizard callbacks were declared async but did not return their `submit*Form` promises, so Formik cleared `isSubmitting` before the mutation completed and test navigation could abort the update. The first failure left the old single-choice title; two later failures cascaded from that stale state.
- All four activity wizards now return their existing submit-helper promise. The serial Playwright spec waits for the shared completion action before navigating away after each final submit. Focused manage typecheck, Playwright TypeScript, and Turbopack `build:test` pass.
- CI verified the activity fix: shard 8 passed 117 tests in 9.8 minutes, and the formerly failing single-choice and second-instance update test passed in 17.4 seconds.
- The Office Add-in package manifest is restored byte-for-byte to `v3` as an explicit non-goal. Its existing React 19.1 runtime remains isolated through a second peer graph in the shared lockfile and a four-dependency, package-scoped Syncpack exception; the Next applications and shared frontend packages remain on React 19.2.7.
- The Office Add-in's frozen filtered install, typecheck, production build, repository-wide `check:all`, and 21-task production build passed under Node 24.16.0 / pnpm 11.5.0. Independent correctness and simplification reviews found no blocker or smaller canonical lock representation. Focused security review found no high-confidence vulnerability; strict maintainability review found no structural regression or missed simpler implementation.
- The Office Add-in correction was published as `e2dc412d5`. GitHub accepted the head, the current-head production build completed successfully, and all eight Playwright shards entered execution. The PR remains draft while those checks run.

Ready-for-review follow-up:

- Marking the PR ready started the full Docker, package-test, Playwright, CodeQL, and Sonar matrix on final head `94b4311ad`.
- Sonar reported a B reliability rating because the catalog dropdown propagation wrapper had an `onClick` handler without keyboard semantics. The row now ignores a data-marked action subtree instead, preserving the verified navigation fix without making the wrapper interactive.
- Sonar's remaining PWA maintainability finding is addressed by explicitly marking the login component props read-only.
- Focused formatting, frontend-manage and frontend-pwa typechecks, and both app lint commands pass under Node 24.16.0. The lint commands report only the branch's existing warnings.
- The Sonar quality gate passed on `5653a14e1` with zero new issues. All Docker builds, package checks, GraphQL tests, and all eight Playwright shards passed; Greptile reviewed the same head at 5/5 with no blocking issues.
- CodeRabbit's whole-branch review found three valid final corrections: use the configured trusted PWA origin for assessment return targets, honor Playwright's student credential overrides, and supersede two stale single-Webpack documentation statements. These corrections are prepared for final-head verification.

Known non-blocking warnings:

- Existing Pages Router `next-intl`, workspace package export, manage missing-message, large-page-data, and missing local chat-provider warnings remain.
