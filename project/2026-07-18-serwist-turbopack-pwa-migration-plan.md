# Serwist Turbopack PWA Migration Plan

## Goal

Move `frontend-control`, `frontend-manage`, and `frontend-pwa` from
`@ducanh2912/next-pwa` to `@serwist/turbopack` without changing the visible PWA
contract. After the migration, all five Next apps use Turbopack for development,
test builds, and production builds.

## Non-goals

- No new offline product behavior or broader cache policy.
- No App Router migration for existing pages.
- No Next.js, React, TypeScript, or Office Add-in upgrade.
- No removal of Capacitor push-notification behavior.
- No deployment outside the normal image and release workflow.

## Plan identity

- Plan: `project/2026-07-18-serwist-turbopack-pwa-migration-plan.md`
- Proposed branch: `feature/serwist-turbopack-pwa`
- Target: `v3` after [PR #5166](https://github.com/uzh-bf/klicker-uzh/pull/5166)
  and its stacked TypeScript upgrade have landed.
- PR: none yet.
- History:
  [`project/2026-07-10-next-react-upgrade-takeover-plan.md`](./2026-07-10-next-react-upgrade-takeover-plan.md)

This plan is recorded with PR #5166 at the maintainer's request. Execution
belongs on its own branch. The implementation branch must update `Progress`
with its actual branch, base SHA, PR link, versions, and verification evidence.

## Decisions and assumptions

- Use the stable Serwist line available when execution starts. Research on
  2026-07-18 found `@serwist/turbopack@9.5.11`, `serwist@9.5.11`, and optional
  `esbuild` support. Pin exact versions and re-check them before editing.
- Keep the three existing Pages Router applications. Add the narrow App Router
  route-handler surface required to serve Serwist files.
- Register `/serwist/sw.js` from the existing Pages Router `_app.tsx` trees.
- Disable browser worker registration in development and test environments.
- Preserve `skipWaiting`, current start-navigation behavior, generated manifest
  coverage, and the absence of service-worker registration in tests.
- Treat cache contents and update behavior as a compatibility contract. Do not
  copy Serwist defaults without comparing them with the generated current worker.
- Keep Capacitor APNS/FCM registration separate from browser service-worker
  registration.
- No ADR is required yet. The migration is reversible and follows an upstream
  compatibility constraint rather than creating a new platform boundary.

## Research

### Verified facts

- `@ducanh2912/next-pwa@10.2.9` depends on `workbox-webpack-plugin` and declares a
  Webpack peer. Its open
  [Turbopack issue #174](https://github.com/DuCanhGH/next-pwa/issues/174)
  documents the Next 16 production-build failure and `--webpack` workaround.
- Next 16 does not support Webpack plugins in Turbopack. It supports explicit
  mixed bundlers while a migration is incomplete.
- `@serwist/turbopack` avoids Webpack plugins. Its official example uses
  `withSerwist`, `createSerwistRoute`, `SerwistProvider`, a `src/app/sw.ts` worker,
  and `esbuild`.
- The current apps use Pages Router `_app.tsx`; only the Serwist route handler
  needs an App Router surface.
- Current Docker images copy `.next/standalone`, `.next/static`, and `public/`.
  Serwist route output may remove the need to copy generated worker files from
  `public/`, but that must be proved before changing Dockerfiles.

### Research questions for execution

1. Inventory current `sw.js`, Workbox chunk, registration script, precache URLs,
   runtime cache routes, cache names, navigation fallback, and update behavior.
2. Confirm that a route handler can coexist with each Pages Router app without a
   root App layout or route collision.
3. Decide whether native `esbuild` or `esbuild-wasm` is the smaller production
   image contract; verify license, platform, and ARM/AMD behavior.
4. Map current `dynamicStartUrlRedirect` behavior to an explicit Serwist rule or
   prove it is unnecessary for these authenticated apps.
5. Confirm how `/serwist/sw.js` and its chunks are included in standalone output
   and whether Docker `public/` copies can stay unchanged.
6. Test service-worker replacement for users who already have `/sw.js`
   registered. Define unregister, takeover, cache cleanup, and rollback behavior.

## Slices

### Slice 0 — Freeze the current PWA contract

Do:

- Build all three apps with the current Webpack path in a clean environment.
- Save machine-readable inventories of generated worker assets and precache URLs.
- Add focused browser checks for registration URL, scope, controller takeover,
  reload, update, cached navigation, and offline fallback.
- Record behavior for an existing `/sw.js` installation before changing code.

Check:

- Production build emits `sw.js`, Workbox chunk, and registration worker.
- Browser evidence covers desktop and mobile widths.
- Existing cache names and critical routes are listed without committing generated
  bundles.

Commit: `test(pwa): capture service-worker migration contract`

### Slice 1 — Prove one Serwist tracer app

Use `frontend-control` as the smallest tracer.

Do:

- Add pinned Serwist and esbuild packages.
- Add `withSerwist`, `src/app/serwist/[path]/route.ts`, and `src/app/sw.ts`.
- Wrap the existing Pages Router app with `SerwistProvider` or an equivalent
  client registration component without changing its provider order. Register
  only in production.
- Match the current cache, update, scope, and offline behavior.
- Keep authentication, GraphQL, and private API traffic network-only unless the
  frozen contract proves an existing narrower exception.
- Switch control production build to Turbopack.

Check:

- Frozen install, typecheck, lint, production build, and standalone server pass.
- `dev`, `dev:offline`, `dev:test`, and `build:test` use Turbopack; development
  and test pages load without registering a worker.
- `/serwist/sw.js` has the expected content type and service-worker scope.
- Fresh install, update from `/sw.js`, reload, cached navigation, offline fallback,
  and rollback all pass in a real browser.
- Control AMD and ARM images build and run.

Commit: `build(pwa): prove Serwist Turbopack integration`

### Slice 2 — Extend the verified pattern to manage

Do:

- Reuse the tracer structure without creating a shared abstraction unless the
  repeated code has a stable contract.
- Match manage routes, authenticated start navigation, media-library assets, and
  current cache exclusions.
- Switch manage production build to Turbopack.

Check:

- Same automated and browser matrix as control.
- Manage `dev`, `dev:offline`, `dev:test`, and `build:test` use Turbopack without
  registering a worker.
- Delegated login, authenticated reload, worker update, and offline navigation do
  not loop through auth or cache private API responses.
- Manage AMD and ARM images build and run.

Commit: `build(manage): move PWA output to Serwist`

### Slice 3 — Extend the verified pattern to participant PWA

Do:

- Apply the verified Serwist route and registration pattern.
- Preserve localforage live-quiz behavior and Capacitor push registration.
- Verify participant login, course routes, assessment routes, embedded routes,
  and mobile install behavior.
- Switch PWA production build to Turbopack.

Check:

- Same automated and browser matrix as control.
- PWA `dev`, `dev:offline`, `dev:test`, and `build:test` use Turbopack without
  registering a worker.
- No browser worker registration runs inside native Capacitor flows unless
  explicitly intended and verified.
- Live-quiz stored responses survive refresh/update and are not replaced by stale
  cached HTML or API data.
- PWA AMD and ARM images build and run.

Commit: `build(pwa): complete Serwist Turbopack migration`

### Slice 4 — Remove Webpack PWA compatibility and finish docs

Do:

- Remove `@ducanh2912/next-pwa`, shared `getNextPWAConfig`, stale generated-file
  ignores, and PWA-only `--webpack` scripts.
- Keep custom Webpack config only if a non-PWA consumer still needs it; otherwise
  remove it after a separate parity check.
- Update frontend, testing, CI/image, and local-development wiki pages and the
  relevant Klicker skills.
- Record final artifact paths and rollback steps.

Check:

- `rg` finds no old PWA plugin imports or unexplained PWA Webpack flags.
- Frozen install, `pnpm run check:all`, production and test builds pass.
- Full Playwright CI, targeted legacy Cypress, security review, strict
  maintainability review, and independent branch review pass.
- All three PWA images pass AMD and ARM builds and standalone smoke tests.

Commit: `docs(pwa): document Serwist runtime contract`

## Verification matrix

| Surface | Required proof |
| --- | --- |
| Build | clean Turbopack build, typecheck, lint, frozen lockfile |
| Worker | URL, MIME type, scope, precache manifest, runtime routes |
| Install | first registration, controller claim, reload |
| Update | old `/sw.js` to new worker, skip-waiting behavior, cache cleanup |
| Offline | shell and intended navigation fallback; API failures stay explicit |
| Auth | no cached private responses or redirect loops |
| Storage | localforage live-quiz state remains valid |
| Native | Capacitor push flow remains separate |
| Image | standalone start plus AMD and ARM builds |
| Rollback | prior image restores a usable worker and cache state |

## Rollback

- Keep old and new workers compatible for at least one release transition.
- Do not delete old caches until the new worker controls the page and the cleanup
  rule is verified.
- Roll back with a new immutable image built from the prior code; do not reuse an
  existing tag.
- If one app fails, revert that app to Webpack and `next-pwa` without blocking the
  other tracer slices.
- Keep a browser test for rollback from the new worker to the old image until the
  migration has survived production rollout.

## Progress

- [x] Need identified from PR #5166 Turbopack investigation.
- [x] Upstream blocker and stable Serwist alternative verified on 2026-07-18.
- [x] Maintainer approved a separate Serwist migration plan.
- [ ] Create implementation branch from current `v3` after dependency PRs merge.
- [ ] Re-check package versions and upstream compatibility.
- [ ] Run Slice 0 contract capture.
- [ ] Execute one reviewed slice and commit at a time.
- [ ] Complete final verification, review, PR update, and rollout evidence.

## Next steps

1. Merge the dependency stack after its existing gates clear.
2. Create `feature/serwist-turbopack-pwa` from the then-current `v3`.
3. Update this plan identity and start Slice 0 before changing dependencies.
