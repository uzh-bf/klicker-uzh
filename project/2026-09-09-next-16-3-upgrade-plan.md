# Next.js 16.3.4 and compatible frontend dependency upgrade

## Approval summary

Upgrade the five Next.js applications from 16.2.11 to 16.3.4 and align their shared dependencies. The user selected 16.3.4 after registry verification found it newer than the originally requested 16.3.3. Include React 19.2.8, matching React type updates, Sharp 0.35.4, next-intl 4.13.7 and the compatible CSS-tooling versions below. Registry ranges are compatible; runtime behavior remains to be tested. Deliver one tested draft PR against v3.

Keep Node 24.16.0, pnpm 11.5.0, TypeScript 6.0.3, ESLint 9, authentication contracts, database schemas, and existing production bundlers. Do not adopt new Next.js experimental features. Application behavior must remain equivalent; narrowly reproduced compatibility fixes belong in this package.

Next.js 16.3.4 was published August 31 and is inside the repository's 14-day release-age window. Approval explicitly permits exact package/version exceptions for its required release train, reviewed from registry metadata; it does not permit disabling or broadly weakening the policy. Sharp 0.35 changes AVIF quality tuning and limits input images to five channels by default. Approval accepts those library defaults; test standard images and record this boundary rather than silently relaxing it. Localization APIs currently used by Chat become deprecated but remain supported. CSS output, image optimization, service workers, hydration and routing are the main regression risks.

Success requires a synchronized frozen lockfile, native checks, production builds, browser evidence, existing focused end-to-end tests, and independent review. Use only a new task-owned disposable local database with repository guards and synthetic fixtures. Approval permits implementation, those guarded fixtures, local runtime start/stop, ordinary task-branch commits/push, and a draft PR. Stop before merge, marking ready, publishing releases/images, deployment, production access or paid AI-provider calls. Main session owns execution through this terminal condition.

## Execution details

### Baseline and package boundary

Repository: /Volumes/HOME/Git/klicker/klicker-uzh.
Worktree: /Volumes/HOME/Git/klicker/klicker-uzh/trees/rs/next-16-3-upgrade.
Branch: rs/next-16-3-upgrade. Target: v3.
Fetched baseline: 5a95cf2d58357a9db833c041e7a05f605f403310 on September 9, 2026.
Primary checkout v3 was 0 ahead and 12 behind origin/v3; its unrelated untracked production-readiness report is preserved.

One cohesive full-path dependency package, not a stack. This is an independently reviewable framework refresh; broader major upgrades remain separate. No product primitive, schema, infrastructure owner, or durable architecture decision changes. No ADR is needed unless investigation discovers a materially different contract.

### Version selection

Registry inventory checked 270 unique external direct dependencies across 31 manifest paths without lookup errors. Full raw inventory is an ignored local review artifact. The inventory informs scope; this PR does not update every package.

| Family | Existing declarations | Proposed target | Reason |
| --- | --- | --- | --- |
| Next.js runtime and shared peer/dev declarations | 16.2.11 | 16.3.4 | User-selected latest stable patch; fixes AVIF optimization and additional regressions |
| eslint-config-next and transitive Next lint plugin | 16.2.10 | 16.3.4 | Match framework release |
| React and React DOM | 19.2.7 | 19.2.8 | Compatible same-line patch; align all consumers and peers |
| React types | 19.2.17 / DOM 19.2.3 | 19.2.18 / DOM 19.2.5 | Age-eligible matching 19.2 types |
| Sharp | 0.33.5 | 0.35.4 | Align app-local image runtime with Next 16.3.4 optional dependency |
| next-intl | 4.13.0 | 4.13.7 | Age-eligible compatible patch |
| Tailwind CSS and PostCSS plugin | 4.1.11 | 4.3.3 | Compatible stable frontend tooling refresh; visual verification required |
| Direct PostCSS | 8.4.47 | 8.5.26 | Age-eligible stable 8.x; preserve Next's own pinned 8.5.23 |

Retain repository semver conventions (exact production, tilde dev, caret types/peers), with exact lockfile resolutions. Do not add global transitive overrides merely to deduplicate. Update existing shared peer/dev declarations wherever syncpack requires them. Include React/CSS consumers in apps/docs and React consumers in transactional email and shared packages; do not update unrelated Office Add-in or docs-site dependencies.

Preserve next-auth 4.24.15 (already current), Next PWA integration, Node/pnpm pins, TypeScript, ESLint major, Babel, Prisma, AI SDK, deployment files, existing overrides and release-age settings. Further unrelated dependency refreshes are follow-up candidates, not automatic implementation authority.

Official release notes and registry constraints were checked for Sharp, Tailwind/PostCSS and next-intl. Verify actual peer/native compatibility during installation and testing. If any proposed update requires behavior changes beyond a compatible upgrade, defer that family and report the reason; do not invent a substitute or broaden scope. If it is required for Next compatibility, pause for the material decision.

### Delegation map

Durable plan path after planner approval: project/2026-09-09-next-16-3-upgrade-plan.md.

| Item | Owner and owned paths | Depends on | Acceptance |
| --- | --- | --- | --- |
| Integration inventory | explore; manifest/config/test reads | Fetched baseline | All five apps and shared contracts covered |
| Compatibility comparison | researcher; official public sources only | Target versions | Source-backed risks for Sharp/CSS/localization |
| Baseline | main; isolated runtime and ignored evidence | Unchanged tree | Exact runtime identity and producing checks recorded |
| Manifest edits | executor; listed app and shared package.json files only | Approved plan and compatibility dispositions | Exact selected versions, existing range policy, scoped diff |
| Policy and lockfile | main; pnpm-workspace.yaml and pnpm-lock.yaml | Manifest edits | Exact approved age exceptions, frozen install, graph checks |
| Verification and delivery | main; checks, reports, narrow reproduced fixes, Git/PR | Resolved graph | Required checks/reviews and tested draft PR |

### Compatibility findings

Sharp 0.35.0 drops Node18 (Node24 already satisfies it), removes its install script in favor of opt-in source builds, changes lossy AVIF quality tuning and defaults limitInputChannels to5. Removed failOnError, paletteBitDepth, old sharpen properties and format.jp2k have no matching direct application use in the scoped search. apps/chat/src/lib/server/imagePreview.ts directly uses Sharp, so run its relevant image-preview tests (which mock Sharp) as well as native Sharp and optimized-image smoke. Sources: https://github.com/lovell/sharp/releases/tag/v0.35.0 and npm sharp0.35.4 metadata.

Tailwind4.2 deprecates start/end positioning aliases;4.3 fixes their valueless CSS output. Keep existing classes unless a reproduced regression requires a scoped adjustment; do not run migration codemods. Sources: https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.2.0 and https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.0.

next-intl4.13.5 deprecates setRequestLocale;4.13.6 deprecates getRequestConfig requestLocale. Both are used in the shared request configuration and Chat layout. Deprecation alone does not justify rewriting locale routing in this PR. Verify English/German navigation and reload behavior. Sources: https://github.com/amannn/next-intl/releases/tag/v4.13.5 and https://github.com/amannn/next-intl/releases/tag/v4.13.6.

These findings establish engine/peer compatibility, not build or runtime success.

### Release-age exception contract

Next 16.3.3 is age-eligible, but the selected 16.3.4 is not. Explicitly list next@16.3.4, eslint-config-next@16.3.4, @next/env@16.3.4, @next/eslint-plugin-next@16.3.4 and every selected @next/swc platform package at 16.3.4 in minimumReleaseAgeExclude as required by resolution. Add only exact same-train dependencies with verified release timestamps. Independently selected other families must meet the 14-day age threshold. If an unexpected young transitive is unavoidable, stop and identify it before requesting a further exception. Preserve all existing exception entries and policy booleans.

### Ownership and sequence

The main session owns version/risk decisions, lockfile integration, local runtime identity, final proof and publication. The explore child owns the read-only integration/test inventory. The researcher owns official-source compatibility comparison for Sharp, Tailwind/PostCSS and next-intl. The trusted executor owns the finite manifest updates after this plan is approved while the main session prepares verification; it may not publish, change runtime configuration or weaken policy. The planner challenges this complete plan before presentation.

1. Record a baseline with the unchanged dependency tree. Start this exact new worktree through devrouter with the supported manage,chat,live-quiz profile union, verify synthetic disposable database provisioning and lockfile drift, run relevant checks, and capture baseline screenshots. Initialization may resolve dependencies; restore only task-generated incidental drift before comparing upgraded results. Existing passing evidence applies only to the source/toolchain it actually tested.
2. Commit the approved plan, update the listed manifest/peer declarations and exact release-age exceptions, then regenerate the lockfile with pnpm 11.5.0 inside the task container. Stop the managed application processes before changing their dependency tree and reconcile through devrouter; application dependency installation stays inside the container; the repository host Playwright launcher may manage its own filtered host dependencies and prerequisites; never bypass lifecycle locks. Inspect all resolved changes, peer diagnostics, duplicate React runtimes and native Sharp/SWC selections. Commit manifests, policy and lockfile together after applicable checks.
3. Verify production builds and browser contracts below. Diagnose one reproduced hypothesis at a time. Make the smallest in-scope compatibility fix; keep test support in harnesses, never application-only test branches. Commit any required source fix with appropriate checks. Run the risk-selected slice review on the complete dependency update; native simplification is skipped for purely mechanical manifests/lockfile and activated only for substantive source complexity.
4. Stop and verify the task runtime, complete integrated final review with correctness, dependency security and plan-compliance lenses, address findings, then ordinarily push the task branch and create/update a draft PR describing the whole package and evidence. Verify forge head and report CI status separately. Do not claim pending CI has passed. The terminal condition is the tested, reviewed draft PR and precise residual CI/coverage limitations, not merge or deployment.

### Verification portfolio

Reuse existing tests. Add a test only if a reproduced consequential compatibility regression has no existing observable coverage; never test dependency-version prose or snapshots of content.

| Risk | Acceptance evidence | Test obligation |
| --- | --- | --- |
| Resolution and shared peer divergence | pnpm install --frozen-lockfile; syncpack; inspect exact Next/React/Sharp graph and age exceptions | No new test |
| Type/lint/build incompatibility | Repository check:all, selected unit tests, full production build and docs build when touched | Existing native checks |
| Auth and navigation regression | Existing A-login and Y-chat access/navigation tests on guarded synthetic setup; desktop/mobile browser screenshots of affected apps | Existing e2e and browser checks |
| CSS/hydration regression | Before/after screenshots of Manage, PWA, Control, Auth and Chat; verify interactive hydration, mobile layout and localized navigation; docs render if CSS changes | Existing browser checks |
| Image and production packaging regression | Local synthetic image optimization returns decodable output; Sharp native load and AVIF encode/decode; production standalone startup, static asset serving and generated PWA worker files | Focused runtime smoke; no production content |

Container commands use devrouter exec <worktree> -- <command>. Run pnpm install --frozen-lockfile, pnpm run check:all, pnpm run build, pnpm run build:test, and pnpm --filter @klicker-uzh/docs run build:docs if the actual package name matches its manifest. Run apps/chat's test:run and other test:run targets selected by the touched integration graph; do not blindly run root test:run because GraphQL shares serialized disposable DB state.

Run Playwright from the host only: pnpm playwright:host -- --runtime-profile manage,chat,live-quiz tests/A-login.spec.ts tests/Y-chat.spec.ts --project=chromium, using the repository launcher's actual argument contract and this exact routed runtime. Verify the launcher selects the correct worktree and guarded test database before setup. Run relevant subset first; broaden within these specs if it resolves an uncovered risk. Use deterministic local chat mocks, without model-provider credentials or requests. Browser verification uses the mandatory agent-browser workflow with before/after screenshots. Inspect production standalone artifacts and generated workers before build:test overwrites build outputs. Confirm production worker generation and startup separately from development-mode browser proof. Test builds exercise Turbopack in all five apps; production retains Turbopack for Auth/Chat and Webpack for Control/Manage/PWA. Build all five Next apps using their existing bundler flags; do not adopt Turbopack for Webpack/PWA apps as part of this update.

Use the runtime's source-path identity throughout. At completion or genuine pause run devrouter stop <worktree>, then verify stopped provider state and zero exact routes. Preserve runtime data and Git worktree; deletion requires separately named user approval. Container or lifecycle failure is a capability blocker, not authorization for raw Docker repair, retained-data reset, or a host-toolchain substitute.

### Baseline runtime limitation

The initial ensure with playwright reached container provisioning but its post-start resolver rejected playwright: util/profile-resolver.sh excludes it while .devrouter.yml declares it. Startup attempted full afterward and failed. Explicit stop reported stopped=true and zero freed routes. The supported-profile retry completed successfully: exact repoPath and workspace matched; profile chat,live-quiz,manage was ready; desired and active apps/services/processes matched; drift was empty. Dependency/build/browser checks remain separate. Use the supported manage,chat,live-quiz union only after the existing lifecycle operation terminates and exact stop reconciliation succeeds. No baseline passing result is claimed. A lifecycle ownership refusal blocks runtime commands; do not bypass it.

### Review provenance

Native planner rounds two and three returned APPROVED after round one returned REVISE. Round three covered source-backed compatibility findings and explicit Sharp default-change disclosure. Accepted all five findings: added build:test and production-artifact ordering; supported profile union for startup/host launcher; launcher-owned host dependency exception; definite delegation map and durable plan path; conditional version wording pending research.

Optional opposing-provider review was attempted on an isolated public-source draft. AGY authenticated catalog exposed Gemini 3.8 Flash High. Its display-name selection was rejected; exact catalog-ID selection then returned no output because headless command permission was denied. No opinion was produced. No permissions or configuration were changed; this optional limitation does not replace native review.

### Sources and limitations

- npm registry metadata queried September 9, 2026 for all direct packages, selected release timestamps, engines and peer dependencies.
- https://github.com/vercel/next.js/releases/tag/v16.3.3 documents security fixes.
- https://github.com/vercel/next.js/releases/tag/v16.3.4 documents AVIF restoration and testmode, TypeScript alias and crossOrigin fixes.
- https://nextjs.org/blog/next-16-3 describes release behavior, including default build caching and versioned agent docs.
- Context7 /vercel/next.js upgrade guidance retrieved September 9 confirms coordinated Next/React/lint upgrades and explicit Webpack flags.

The upgraded tree passes the install, build, unit and browser checks recorded below. Release and deployment remain outside this package.

## Progress

- User approved the package September 9, 2026, including exact release-age exceptions and Sharp defaults. Implementation commit: c15a6fe8ffcf8b3e01a3a0a3a72183dfac73221e.
- All 82 manifest substitutions and the frozen lockfile match the approved versions. Existing overrides and policy settings remain unchanged. The target advanced only in production image values, so integration was unnecessary.
- Passing container checks: syncpack (814 entries), type/lint (42 tasks), Chat (629 tests; 21 existing skips), Auth (2 tests), PWA (7 tests), native JPEG/WebP/AVIF encode/decode, agent-docs, Git identity tests, removed-doc policy and Prisma sync.
- Passing host checks: CI policy (62 tests), Playwright launcher (31 tests), staged secret scan and Git identity. The host-only policy tests correctly reject container execution; hook-equivalent checks were split across host/container before commits.
- Production build: 23 tasks passed, including all five Next apps with unchanged bundlers. Removed mixed-version generated-type interference by preserving baseline development artifacts outside `.next`; no source fix was needed. Docs production build and all 21 test-build tasks passed.
- All five standalone apps started and served pages, static JavaScript and decodable optimized images. All three PWA apps served generated workers. Native and standalone checks preceded test-build overwrites. Temporary smoke servers stopped.
- Browser screenshots cover Auth, Manage, Control, PWA and Chat before/after, German Manage navigation/reload, and mobile participant login. Docs rendered correctly. Auth/PWA/Chat layouts match the baseline; Manage/Control fixture contents differ after guarded E2E reset, so their comparison covers layout rather than identical data. No browser page errors were captured. Task browser and docs preview stopped.
- Initial login/Chat E2E run: 110 passed, one history-rail test failed. The failure reproduced on an unchanged rerun. The short transcript fit the default desktop viewport, so its current turn changed during immediate reopening. A smaller desktop viewport creates real scroll distance; an explicit overflow assertion verifies that prerequisite. No production code, existing behavior assertion, or test count changed. The corrected test passed three consecutive repetitions (9.7 seconds total).
- Native dependency slice review: DONE, no qualifying findings. Simplification skipped for mechanical manifests/lockfile and a direct test-precondition assertion. Integrated final review follows the remaining verification and runtime shutdown.
- Nonfatal warnings remain: existing peer declarations/overrides, large page data, QR missing-message output, and deprecation/cache warnings. Other native platforms, real identity-provider login, paid model calls and production deployment were not tested locally.
- Remaining: commit the test repair and evidence, stop and verify the exact runtime, complete integrated final review, then push and create the draft PR against v3. Merge and deployment remain unauthorized.
