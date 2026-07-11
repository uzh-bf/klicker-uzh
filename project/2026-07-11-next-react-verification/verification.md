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
