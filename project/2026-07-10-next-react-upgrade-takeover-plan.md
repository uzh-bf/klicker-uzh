# Next.js 16 and React 19 Takeover Plan

Status: approved 2026-07-10; Slices 0-8 and 10 published to draft PR #5166; implementation and local finish gates complete; current-head CI is active.

## Goal

Recover `feature/upgrade-next-react`, reduce it to a reviewable Next.js 16 / React 19 compatibility change, prove it from a clean production-like environment, then open a replacement draft PR against `v3`.

Success:

- all five Next apps start, build, lint, typecheck, and preserve current auth/navigation behavior;
- PWA builds generate working service workers under one explicit bundler strategy;
- lockfile and dependency policy match current `v3` unless a documented exception is required;
- fresh CI, browser screenshots, and e2e evidence belong to the replacement branch SHA;
- TypeScript remains `~5.6.3`; TypeScript 6 stays isolated in the stacked follow-up plan.

## Non-Goals

- Skip TypeScript 6. Owned by `project/2026-07-10-typescript-6-upgrade-takeover-plan.md` on `feature/upgrade-typescript`.
- Skip TypeScript 7, Prisma 7, React Compiler adoption, and GraphQL/Pothos major upgrades.
- Initial safe target used Webpack only. Approved Slice 10 adopts Turbopack where the current PWA contract allows; full PWA production migration remains in the separate Serwist plan.
- Skip `middleware.ts` -> `proxy.ts` auth migration unless Next 16 makes current middleware unusable. Handle separately because redirect/cookie logic is security-sensitive.
- Skip broad security dependency refresh. Only dependency overrides required by this framework upgrade stay in this PR.
- Skip the Office Add-in. Keep its package manifest on the `v3` React and React type versions because a separate PR replaces that application.
- Skip new Cypress coverage. Cypress is frozen; retain only fixes needed to keep existing parity tests green.
- Skip product/UI changes. Compatibility fixes must preserve behavior.
- Skip closing or mutating old PRs until replacement evidence exists and maintainer approves supersession.
- Skip merge. Separate explicit approval required.

## Plan Identity

- Plan path: `project/2026-07-10-next-react-upgrade-takeover-plan.md`
- Owning branch: `feature/upgrade-next-react`
- Worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/upgrade-next-react`
- Target branch: `v3`
- PR: none for replacement branch; rename this file to `project/2026-07-10-pr-<id>-next-react-upgrade-takeover-plan.md` after draft PR creation
- Pre-takeover local head: `191d7dff60312ee6f637c1d5e6bb804d844812d0`
- Pre-takeover local parent: `bd6df485b3401199468441116feded96c37f484d`
- Live `v3` checked 2026-07-10: `eef745d068ee26d48fb4020b3ae305a5e1c84f59`
- Rebased inherited commit: `3825fa4e6` (from `191d7dff6`)
- Rebased plan commit: `59b88b059` (from `07ed3e67c`)
- Post-rebase divergence before normalization commit: 2 ahead, 0 behind
- Historical source PRs: [#5091](https://github.com/uzh-bf/klicker-uzh/pull/5091), [#5111](https://github.com/uzh-bf/klicker-uzh/pull/5111)
- Historical validated pre-TS6 source SHA: `7320867dd`
- Historical plans/reports/screenshots: exist only on `origin/codex/next-16-upgrade`; evidence does not transfer to current SHA
- Planning checkout: detached review worktree at `eef745d06`; commit final plan only from owning branch after approval

## Current State

Evidence:

- both upgrade worktrees clean;
- neither replacement branch exists on GitHub;
- no replacement PR or CI run exists;
- inherited commit changes 64 files, including app runtime, auth redirects, Cypress helpers/specs, generated email HTML, lockfile, and dependency policy;
- ignored `node_modules` and `.next` trees exist in worktree; prior local success can hide clean-checkout failures;
- dry rebase overlap with current `v3`: none for Next branch; recheck after fresh fetch;
- old PR #5091: open, non-draft, conflicting/dirty, review required;
- old PR #5111: open, draft, conflicting/dirty, review required.

Push-readiness: **NO**.

### Confirmed blockers

1. **Critical — dev scripts cannot start.** Five apps pass both `--webpack` and `--turbo`. Next 16.2.6 exits with `Multiple bundler flags set`.
2. **High — PWA dependency mismatch.** Consolidated branch retains `@ducanh2912/next-pwa@7.3.3`; source validation used `10.2.9`.
3. **High — generated type dependency.** Tracked `next-env.d.ts` files import ignored `.next/types/routes.d.ts`. Current cached `.next` trees mask clean-checkout behavior.
4. **High — dependency policy drift.** Branch changes `minimumReleaseAgeIgnoreMissingTime` from `false` to `true`, keeps obsolete `tmp@0.2.6` exception, adds broad overrides, regresses `fast-xml-parser` override from current `5.7.0` to `5.5.6`, and forces `jsonwebtoken` across a major boundary.
5. **High — Cypress scope drift.** Sixteen legacy Cypress files changed; `preserveClientState` behavior documented in `docs/testing.md` was removed; live-quiz spec lost substantial coverage.
6. **High — runtime behavior mixed into dependency commit.** Manage/PWA login, Apollo redirect, layout redirects, KaTeX loading, and asset imports require individual reproduction and proof.
7. **Medium — React ecosystem alignment incomplete.** Runtime React is 19.2.6 while React type packages stay on 19.1 ranges; Office React hooks lint tooling stays on v5.
8. **Medium — docs absent.** Branch has no current plan, report, screenshots, wiki updates, skill updates, or `docs/log.md` entry.

## Research

### R1 — Next.js 16 / React 19 migration

Agent: `/root/next_react_research`.

Evidence:

- [Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16): Node 20.9+, TypeScript 5.1+, Turbopack default, `next lint` removed, Webpack opt-out via `--webpack`, React 19.2 support, image/config changes.
- [Next.js TypeScript guide](https://nextjs.org/docs/app/api-reference/config/typescript): `next-env.d.ts` is generated, should be ignored/untracked, and can be generated with `next typegen`.
- [React 19.2 release](https://react.dev/blog/2025/10/01/react-19-2): target feature line.
- [next-pwa setup](https://github.com/ducanhgh/next-pwa/blob/master/docs/content/next-pwa/getting-started.mdx): plugin remains Webpack-oriented.
- Local shared Next config has a custom Webpack callback; PWA apps need worker generation; chat Docker output needs standalone proof.

Decision:

Initial decision, superseded by the maintainer-approved mixed-bundler boundary in Slice 10:

- Use Webpack only for `dev`, `dev:offline`, `dev:test`, `build`, and `build:test` in all five apps during this upgrade.
- Remove `--turbo`; keep `--webpack`.
- Defer Turbopack adoption to separate PR after PWA/standalone migration evidence.

Limitations:

- Official docs checked 2026-07-10; library state can drift.
- No clean build or browser test ran during planning.

### R2 — Branch, PR, and evidence state

Agent: `/root/takeover_state_research`.

Evidence:

- live GitHub `v3` matched local `origin/v3` on 2026-07-10;
- replacement branches unpushed;
- old PRs remain conflicting;
- existing plans/screenshots cover different SHAs;
- current caches prevent clean-environment inference.

Decision:

- Preserve inherited commit and repair forward. Avoid expensive history decomposition unless file classification proves major scope contamination.
- Record old SHAs and create local backup refs before rebase.
- Finalize Next PR before rebasing TypeScript stack.

Limitations:

- GitHub state can drift after 2026-07-10.
- No branch fetch, build, test, or browser mutation occurred during research.

### R3 — Registry and supply-chain policy

Agent: main agent.

Checked 2026-07-10 via npm registry:

| Package | `v3` | Inherited target | Registry latest | Plan |
| --- | --- | --- | --- | --- |
| `next` / `eslint-config-next` | 15.5.18 | 16.2.6 | 16.2.10 | Selected 16.2.9. Published 2026-06-09 and policy-eligible; 16.2.10 remains inside the 14-day window. |
| `react` / `react-dom` | 19.1.2 | 19.2.6 | 19.2.7 | Selected 19.2.7. Published 2026-06-01; runtime and DOM versions aligned. |
| `@types/react` / `@types/react-dom` | 19.1.x | 19.1.x | 19.2.17 / 19.2.3 | Selected latest eligible releases; `@types/react-dom` requires `@types/react ^19.2.0`. |
| `next-intl` | 4.3.4 | 4.12.0 | 4.13.2 | Selected 4.13.0. Published 2026-05-28; 4.13.2 was published 2026-07-10. |
| `next-auth` | current 4.x | unchanged | 4.24.14 | No auth major migration. |
| `@ducanh2912/next-pwa` | 7.3.3 | 7.3.3 | 10.2.9 | Upgrade to 10.2.9; verify workers, cache, offline path. |
| `typescript` | 5.6.3 | 5.6.3 | 7.0.2 | Keep 5.6.3 in this PR. |

[pnpm settings](https://pnpm.io/settings#minimumreleaseage) confirm `minimumReleaseAge` applies to direct and transitive packages; `minimumReleaseAgeIgnoreMissingTime: false` fails closed when registry time is absent.

Decision:

- Start from current `v3` policy and overrides.
- Remove stale `tmp@0.2.6` exception.
- Keep `minimumReleaseAgeIgnoreMissingTime: false`.
- Remove broad advisory overrides from this branch unless dependency-path and API-compatibility evidence proves direct necessity.
- Never hand-merge lockfile. Regenerate with Node 24.16.0 and pnpm 11.5.0.

Slice 2 execution evidence:

- Registry cutoff: `2026-06-26T11:46:00Z`; all selected versions are stable plain semver and policy-eligible.
- Selected: Next/ESLint 16.2.9, React/DOM 19.2.7, React types 19.2.17/19.2.3, `next-intl` 4.13.0, `next-pwa` 10.2.9.
- Restored current `v3` release-age policy and six scoped overrides; removed the stale `tmp@0.2.6` exception and 35 inherited broad overrides.
- Final `pnpm-workspace.yaml` is byte-identical to `origin/v3`; no override is introduced or modified by this branch, so new-override provenance requirements do not apply in Slice 2.
- First lock attempt failed closed when registry time metadata timed out. Retry used lower concurrency and longer timeouts without policy relaxation; 3,975 inherited entries passed policy and lock regeneration completed.
- Offline frozen lock check and full frozen install passed under Node 24.16.0 / pnpm 11.5.0.
- `check:all` passed: 23 typecheck tasks and six lint tasks, plus format, syncpack, AGENTS, and Prisma-sync checks.
- Root production build passed: 21 build tasks; all five Next apps compiled, and all three PWA apps emitted service workers and custom workers.
- Build exited zero but retained known follow-up warnings: removed Next `eslint` config, inferred workspace root, Pages Router i18n, manage `MISSING_MESSAGE`, and mandatory generated tsconfig changes. Build-generated tsconfig/`next-env.d.ts` churn was restored and remains owned by Slices 3-5.
- Transactional output changed under React 19.2.7 and reproduced byte-identically across two Node 24 builds.
- Peer check retains the 11 known `v3` warnings and adds mixed Next 15/16 resolution diagnostics. Registry peer declarations for NextAuth, `next-intl`, `next-pwa`, and Matomo all accept Next 16; targeted `pnpm why` confirms apps use Next 16.2.9 while backend/i18n peer-only contexts retain Next 15.5.18.
- Audit not run: maintainer explicitly approved the external disclosure on 2026-07-10, but the execution policy prohibited sending the private repository dependency inventory to npm's advisory service. No workaround was attempted. Residual advisory coverage is deferred; frozen installation, peer analysis, `check:all`, and the full production build remain the completed local evidence.
- Per-slice dependency review, simplification review, lockfile/importer review, and final seam review completed. Accepted documentation corrections were integrated; no implementation defect or further simplification remained.

Slice 3 research evidence:

- Official Next 16.2.9 docs confirm Turbopack is the default, `--webpack` is the explicit opt-in for both `next dev` and `next build`, `next lint` is removed in favor of the ESLint CLI, and the `eslint` block is removed from `next.config`.
- Official config docs require `images.qualities`, document `dangerouslyAllowLocalIP` as private-network-only, scope built-in `i18n` to the Pages Router, and require custom Webpack callbacks to return the received config.
- Official ESLint 9 flat-config docs confirm `defineConfig` and `globalIgnores`; flat config does not automatically consume repository ignore files. Installed ESLint exports both helpers, and installed `eslint-config-next` exports the TypeScript preset.
- Baseline five-app lint passed with 130 warnings: auth 1, chat 10, control 3, manage 86, PWA 30. Eighty-one warnings came from five new React Compiler rules; five broader downgraded rules produced no violations.
- Read-only researchers `/root/slice3_config_inventory` and `/root/slice3_lint_generated` independently confirmed the five dual-bundler scripts, redundant auth/chat Webpack wrappers, hidden environment read, obsolete Next ESLint option, missing chat TypeScript preset, and nine generated PWA bundles currently traversed by ESLint.
- Decision: keep Webpack as the sole bundler, disable only the five proven React Compiler debt rules with frontend-maintainer ownership and a zero-violation removal gate, ignore generated PWA bundles explicitly, preserve chat TypeScript linting, and leave Slice 4 generated TypeScript files untouched.

Slice 3 execution evidence:

- Removed the conflicting Turbopack flag from all five development scripts; build, test-build, offline, and test variants consistently select Webpack.
- Removed redundant auth/chat Webpack wrappers. Chat alone disables Pages Router i18n; shared config now uses the passed `NEXT_PUBLIC_ENV`, removes the obsolete Next ESLint option and dead branch, and includes local image optimization/patterns only in development or test.
- Flat ESLint configs use named `defineConfig` exports. Chat restores the Next TypeScript preset. Three PWA apps globally ignore generated service-worker, Workbox, fallback, and custom-worker bundles.
- Baseline React Compiler debt is scoped to nine app/rule exceptions instead of 25 blanket disables: auth none; chat two; control one; manage three; PWA three. Frontend maintainers own each exception, removed when that app reaches zero violations for the rule.
- `@klicker-uzh/next-config` now declares ESM explicitly. Deterministic config assertions passed for argument-based staging source maps, dev/test-only local image access, production exclusion, chat i18n exclusion, quality allowlist, and Webpack config identity.
- Five app lints pass after a production build. Warnings fell from 130 to 44: auth/control zero, chat five, manage 27, PWA 12. Remaining warnings are pre-existing `exhaustive-deps` and chat image warnings; generated PWA bundles are absent.
- Five targeted app typechecks pass. Full production build passes 21 tasks; all five apps report Next 16.2.9 with Webpack, all three PWA apps emit service workers/custom workers, and the removed Next `eslint` config warning is gone. Known workspace-root, Pages Router i18n, Next-managed TypeScript, cache, page-size, and manage missing-message warnings remain outside this slice.
- Next-managed `tsconfig.json` and `next-env.d.ts` build/start churn was restored byte-for-byte from pre-verification snapshots and remains owned by Slice 4.
- DevPod default localhost overlay first collided with an existing host PostgreSQL port. The repo-supported devrouter overlay resolved port collisions, but container DNS could not resolve npm (`EAI_AGAIN`), so its clean install was stopped without policy bypass.
- Fallback branch-local host smoke used isolated ports. Auth, chat, control, manage, and PWA each reached `Next.js 16.2.9 (webpack)` ready state; browser requests returned HTTP 200 and temporary screenshots were captured. Manage then followed its configured auth path to a local TLS privacy page; chat logged missing local Langfuse settings. Both are environment limitations, not bundler failures.
- All five smoke servers, browser sessions, the branch DevPod, and devrouter were stopped. Alternate smoke ports are closed; devrouter returned to its prior down state.
- Correctness reviewer `/root/slice3_config_inventory` found missing ESM package metadata; accepted and fixed. No other correctness, security, scope, i18n, image, generated-file, or documentation finding remained.
- Simplification reviewer `/root/slice3_lint_generated` found blanket lint suppressions and stale wiki timestamp; accepted and reduced to nine measured exceptions, timestamp updated. No further simplification remained.
- First final `check:all` run failed only because the new `type` field did not match syncpack ordering. Metadata moved after `volta`; fresh rerun passed 23 typechecks, six lint tasks, formatting, syncpack, AGENTS, and Prisma-sync checks.
- Fresh post-review production build passed all 21 tasks in 36 seconds. Post-build five-app lint passed with the same 44 legacy warnings and no generated-bundle findings.

### Independent plan review

Reviewer: `/root/takeover_state_research`.

Status: completed 2026-07-10.

Accepted changes:

- separated config-derived docs from runtime-verified evidence;
- added explicit approval gate before dependency inventory reaches audit service;
- blocked old-PR comments/closure until shared supersession approval;
- required metadata-plan rename push/readback;
- cross-linked shared supersession execution from TS plan;
- corrected draft/review status and progress.

### Slice 1 classification

Completed 2026-07-10 against `origin/v3@eef745d06`.

| Class | Files | Decision |
| --- | --- | --- |
| Keep and normalize in Slices 2-4 | Next/React package manifests and peer ranges; flat ESLint migration; `apps/chat/next.config.ts`; `packages/next-config`; app scripts; Next type-generation contract | Intent belongs in PR A, but exact versions, scripts, config, ignores, and type files are not accepted until their owning slice verifies them. |
| Revert now | All 17 changed Cypress files; eight manage/PWA runtime and auth files; three generated transactional HTML files; five app tsconfigs; three tracked `next-env.d.ts` hunks | Restored from current `origin/v3`. Candidate compatibility fixes must reproduce on the normalized branch before reintroduction. Generated files must be regenerated under the final Node 24 dependency set. |
| Move to TypeScript PR | Three rank SVG import edits in manage/PWA | Restored from `origin/v3`; provenance is TypeScript migration commit `d0d14a998`. |
| Revert atomically in Slice 2 | Broad `pnpm-workspace.yaml` policy/override drift and inherited lockfile | Do not restore workspace policy alone because the lock override block and upgraded importers must be regenerated together. |
| Reproduce first | Manage layout/Apollo/login redirects; manage/PWA KaTeX relocation; PWA login message pruning; Cypress rich-text/toast/save waits; transactional React render markers | Historical evidence is stale. Reapply one smallest fix at a time only after a current failure. |

Review evidence:

- Cypress classifier found coverage loss in `N-course-workflow` and `O-live-quiz-workflow`, plus removal of documented `preserveClientState` semantics in `commands.ts`; no inherited Cypress file was accepted.
- Runtime classifier traced rank imports to the TS plan and found the five dual-bundler dev scripts, incomplete flat ESLint configs, obsolete shared Next config fields, and unproven auth changes.
- Dependency classifier found stale React types, `next-pwa@7.3.3`, broad override drift, and cached transactional output; no dependency file was classified as TS-only.
- No build, test, or browser proof was claimed in this classification slice.

## Resolved Decisions

- Delivery: two stacked PRs.
- PR A: Next/React against `v3`.
- PR B: TypeScript 6 against finalized PR A branch.
- Branch names: reuse existing local branches.
- History: preserve inherited commits; add corrective slices.
- Bundler: Webpack only for initial upgrade.
- PWA: upgrade `next-pwa` to 10.2.9; Serwist/Turbopack deferred.
- Generated Next types: untrack/ignore `next-env.d.ts`; add deterministic `next typegen` path before direct app typechecks.
- Security overrides: split unrelated audit remediation.
- Auth proxy migration: defer.
- Cypress: revert carry-over first; reintroduce only reproduced compatibility fixes.
- Old PRs: keep open until replacements have current evidence; closure needs explicit approval.
- Merge: never without explicit approval.

## Skill Routing

- Plan/execution: `rs-sliced-development-workflow`, `rs-dependency-upgrade-planner`, `caveman`.
- Verification: `klicker-testing-verification`, `agent-browser`.
- Legacy E2E maintenance: `klicker-cypress-e2e` only for existing-spec repair.
- Primary E2E: `klicker-playwright-e2e`.
- Docs: `klicker-wiki-maintenance`.
- Bugs: `diagnose` before compatibility fixes without a reproduced failure.
- Per-slice finish: `verification-before-completion`, review agent, simplification agent.
- Final gates: `security-review`, `thermo-nuclear-code-quality-review`, independent branch review.
- PR body: `rs-mr-description-writer`.

## Risks and Fallbacks

| Risk | Severity | Control | Fallback |
| --- | --- | --- | --- |
| Dev scripts select two bundlers | Critical | Static grep plus five app start smokes | Webpack-only scripts |
| PWA worker/cache behavior changes | High | Production builds, SW artifact audit, registration/reload/offline tests | Revert PWA package/config slice; retain old PRs |
| Auth redirect regression/open redirect | High | Existing e2e plus malicious `redirect_to` browser case | Revert compatibility code; dependency-only branch |
| Cypress coverage accidentally removed | High | Start from `v3` specs; reapply fixes one failure at a time | Revert all inherited Cypress edits |
| Broad override breaks transitive consumer | High | `pnpm why`, peer audit, targeted runtime tests | Remove override; separate security PR |
| Clean checkout lacks generated types | High | Artifact-free devcontainer, `next typegen`, direct app checks | Fix generation contract before PR |
| New `v3` commit lands during work | Medium | Fetch before each branch rewrite and before PR | Rebase, rerun full gates |
| React hooks warnings become permanent debt | Medium | Explicit warning inventory, owner, removal criterion | Scope disables with linked follow-up |
| Historical proof mistaken for current proof | Medium | Evidence always records exact SHA/date | Mark unverified; rerun |

## Implementation Slices

### Slice 0 — Plan ownership and safety checkpoint

Depends: maintainer approves reviewed plan.

Files:

- `project/2026-07-10-next-react-upgrade-takeover-plan.md`

Do:

- copy reviewed draft into owning worktree;
- confirm both worktrees clean;
- record `git worktree list --porcelain`, branch heads, upstreams, and live `v3`;
- create non-pushed local backup refs for `191d7dff6` and `421a5aa89` before any rewrite;
- commit only this plan file.

Check:

```bash
git status --short --branch
git worktree list --porcelain
git rev-list --left-right --count origin/v3...feature/upgrade-next-react
```

Commit:

`docs(project): add Next React upgrade takeover plan`

### Slice 1 — Rebase and classify inherited diff

Files:

- entire `origin/v3...feature/upgrade-next-react` diff
- plan `Progress`

Do:

- fetch current `origin/v3`;
- rebase owning branch onto current `origin/v3`;
- preserve new devcontainer and Summer School seed changes;
- record old -> new SHA mapping;
- classify every changed file: `keep`, `revert`, `move-to-TS6`, `reproduce-first`;
- default-revert unrelated Cypress, TS6-only, broad security, and formatting churn;
- compare resulting diff with both old PR heads without merging either.

Check:

```bash
git status --short
git diff --check origin/v3...HEAD
git log --oneline origin/v3..HEAD
git diff --stat origin/v3...HEAD
git diff --name-status origin/v3...HEAD
```

Commit:

- rebase rewrites inherited commits;
- if classification changes files: `chore(deps): normalize Next React takeover scope`.

### Slice 2 — Establish dependency contract

Files:

- affected `package.json` files
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`

Do:

- re-query exact versions, publish times, peer ranges, changelogs;
- select policy-eligible Next 16.2.x, React 19.2.x, React types, `next-intl`, `eslint-config-next`, and `next-pwa@10.2.9`;
- align every direct React/React DOM consumer and type package, or explicitly exclude that consumer;
- restore strict release-age policy from `v3`;
- remove stale exception and unrelated overrides;
- for each new or branch-modified retained override, record advisory, dependency path, API compatibility, and removal condition;
- regenerate lockfile; inspect importer and peer changes.

Check:

```bash
node --version
pnpm --version
pnpm install
CI=true pnpm install --frozen-lockfile
pnpm run check:syncpack
pnpm peers check
pnpm audit --audit-level high
git diff --check
```

Audit gate: obtain explicit maintainer approval before sending dependency inventory to external advisory service.

Commit:

`chore(deps): scope Next 16 and React 19 upgrade`

### Slice 3 — Make Next configuration deterministic

Files:

- five Next app `package.json` files
- five app ESLint configs
- app `next.config.*` files
- `packages/next-config/index.js`
- `packages/next-config/package.json`
- `.gitignore` / `.prettierignore` only if generated-file policy requires

Do:

- select `--webpack` only across all dev/build variants;
- replace `next lint` with ESLint CLI;
- remove obsolete `eslint.ignoreDuringBuilds` and unused config branches;
- use passed `NEXT_PUBLIC_ENV`, not hidden process-global reads;
- keep Pages Router i18n only in pages apps; disable it in chat App Router;
- keep image `remotePatterns`, `qualities`, and local-IP allowance scoped to dev/test;
- simplify redundant app-level Webpack wrappers;
- define React hooks lint warning/disable policy with owner and removal criterion;
- ensure generated SW/worker outputs do not break lint.

Check:

```bash
git grep -n -E -- '--webpack.*(--turbo|--turbopack)|(--turbo|--turbopack).*--webpack' -- '**/package.json'
pnpm --filter @klicker-uzh/auth lint
pnpm --filter @klicker-uzh/chat lint
pnpm --filter @klicker-uzh/frontend-control lint
pnpm --filter @klicker-uzh/frontend-manage lint
pnpm --filter @klicker-uzh/frontend-pwa lint
```

Start smoke: each app reaches ready state under branch-local devcontainer/devrouter; stop cleanly after proof.

Commit:

`fix(next): align Next 16 bundler and configuration`

### Slice 4 — Make type generation clean-checkout safe

Files:

- all Next app `next-env.d.ts` tracking entries
- app `tsconfig.json` files
- package scripts / Turbo dependencies only if needed
- `.gitignore`

Do:

- untrack and ignore Next-managed `next-env.d.ts` files per current official guidance;
- ensure `next-env.d.ts` remains in each tsconfig `include`;
- use `next typegen` before direct artifact-free app typechecks;
- include `.next/types/**/*.ts` where typed routes require it;
- prove no `.next` or stale worker artifact exists before generation;
- verify CI build-before-check remains valid and local instructions remain truthful.

Check:

```bash
pnpm --filter @klicker-uzh/auth exec next typegen
pnpm --filter @klicker-uzh/chat exec next typegen
pnpm --filter @klicker-uzh/frontend-control exec next typegen
pnpm --filter @klicker-uzh/frontend-manage exec next typegen
pnpm --filter @klicker-uzh/frontend-pwa exec next typegen
pnpm --filter @klicker-uzh/auth check
pnpm --filter @klicker-uzh/chat check
pnpm --filter @klicker-uzh/frontend-control check
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/frontend-pwa check
```

Commit:

`build(next): make generated type checks deterministic`

### Slice 5 — Reproduce and minimize runtime compatibility fixes

Files:

- `apps/frontend-manage/src/components/Layout.tsx`
- `apps/frontend-manage/src/lib/apollo.ts`
- manage/PWA login pages
- manage/PWA `_app.tsx` / `_document.tsx`
- other runtime files only after reproduced failure

Do:

- begin from normalized dependency/config baseline;
- reproduce each inherited failure before keeping its fix;
- keep render-phase redirect fixes only with behavior proof;
- validate expired-session redirects, same-origin return paths, and malicious external redirect rejection;
- keep KaTeX/local CSS changes only if build/browser failure reproduces;
- move TS6-only rank asset import changes to stacked branch;
- add smallest public-interface regression protection available; use Playwright for new user-flow coverage.

Check:

- delegated lecturer login -> requested manage page;
- expired manage session -> login -> safe relative return;
- malicious `redirect_to` -> rejected/fails closed;
- participant password login -> PWA home/course;
- control authenticated course selection;
- chat logged-out and authenticated redirect flows;
- browser console and network errors empty for tested paths.

Commit:

`fix(frontend): preserve auth navigation on Next 16`

### Slice 6 — Repair legacy e2e only from failures

Files:

- `cypress/cypress/support/commands.ts`
- existing Cypress specs only when they fail under Next 16
- Playwright specs for new regression coverage when needed

Do:

- restore current `v3` Cypress suite first;
- preserve `preserveClientState` semantics;
- run affected specs;
- reintroduce rich-text typing, toast dismissal, and save-completion waits one observed failure at a time;
- preserve coverage counts and assertions; never delete/weaken tests to pass;
- place new user-flow regression coverage in Playwright.

Check:

- targeted changed Cypress specs;
- targeted Playwright login/auth/live-quiz specs;
- CI full Cypress and Playwright suites remain final gates;
- record exact passed/failed counts.

Commit:

`test(e2e): stabilize Next 16 compatibility`

No commit if current tests pass without changes.

### Slice 7 — Update wiki, skills, and operator evidence

Files:

- `AGENTS.md`
- `docs/getting-started.md`
- `docs/frontend-conventions.md`
- `docs/chat-platform.md`
- `docs/auth-model.md` if redirect behavior stays
- `docs/testing.md`
- `docs/ci-and-deployment.md` if image/build behavior changes
- `docs/log.md`
- affected `.agents/skills/` procedures

Do:

- update Next/React versions and one-bundler strategy;
- document generated Next types and build-before-check contract;
- document PWA/standalone build facts and verification procedure;
- document only retained auth/e2e behavior;
- correct testing skill shard count drift if still present;
- add `docs/log.md` entry and bump timestamps;
- keep facts in wiki, procedures in skills;
- mark facts config-derived until Slice 8 verifies them; change to verified only with command, date, and SHA evidence.

Check:

```bash
bash ~/.claude/skills/llm-wiki-okf/scripts/validate.sh docs
pnpm exec prettier --check docs/ .agents/skills/ AGENTS.md project/2026-07-10-next-react-upgrade-takeover-plan.md
```

Commit:

`docs: document Next 16 runtime and verification`

### Slice 8 — Production-like verification and final reviews

Files:

- dated `project/` screenshot/report directory
- plan `Progress`

Environment:

- fresh branch-local devcontainer; no reused `.next`, generated client, Turbo cache, or PWA artifacts;
- devrouter workspace slug tied to worktree;
- seeded local test data only.

Automated checks, order:

```bash
node --version
pnpm --version
CI=true pnpm install --frozen-lockfile
pnpm run build
pnpm run check:all
pnpm run build:test
pnpm --filter @klicker-uzh/chat test:run
git diff --check origin/v3...HEAD
opengrep scan --config auto
```

Do not run root `pnpm run test:run` blind. Route targeted tests through `klicker-testing-verification`.

Image/build proof:

- build changed app Dockerfiles using repo-root context;
- prove chat standalone server path;
- prove PWA `sw.js`, Workbox, and custom worker output;
- confirm service worker disabled during development;
- confirm CI AMD/ARM image jobs for affected apps.

Browser proof with `npx agent-browser`:

- auth, manage, PWA, control, chat;
- delegated lecturer login and participant login;
- desktop and mobile;
- English and German smoke;
- PWA registration, reload, update, cached-shell/offline smoke;
- screenshots stored under dated `project/` directory;
- console/network errors recorded.

Review gates:

- per-slice review and simplification findings resolved;
- final `security-review` covering auth redirects, image allowlists, PWA cache, and dependency overrides;
- `thermo-nuclear-code-quality-review` resolved/deferred with rationale;
- independent final branch review against `origin/v3`;
- fresh verification rerun after accepted changes.

Commit:

`docs(project): record Next React verification evidence`

### Slice 9 — Open replacement draft PR

Do:

- push `feature/upgrade-next-react` only after Slice 8 passes;
- open draft PR against `v3` with conventional title;
- rename current plan file to include PR ID; commit rename alone;
- push metadata commit; confirm PR head contains renamed plan before final PR-body update;
- use `rs-mr-description-writer` against full branch diff/history;
- attach screenshots, commands, counts, known gaps, rollback, and manual checks;
- link old PRs in replacement PR body only; do not comment on or close old PRs before explicit supersession approval;
- read CI, reviews, and comments back; fix accepted findings one at a time;
- keep draft until all required checks and manual evidence pass.

Check:

```bash
gh pr view <id> --json number,title,state,isDraft,mergeable,mergeStateStatus,reviewDecision,statusCheckRollup,url
gh pr checks <id>
```

Commit:

`docs(project): bind Next React plan to PR <id>`

## Manual Verification Matrix

| Surface | State | Evidence |
| --- | --- | --- |
| Auth | delegated login, safe return, malicious redirect rejection | Playwright + agent-browser screenshot |
| Manage | library/dashboard after login; expired session recovery | browser screenshot, console/network audit |
| PWA | participant login, course, service-worker register/reload/offline | browser screenshots + SW artifact list |
| Control | authenticated course selection | browser screenshot |
| Chat | logged-out redirect, authenticated page, standalone build | browser screenshot + Docker smoke |
| Locales | English + German smoke | screenshots |
| Viewports | desktop + mobile | screenshots |
| E2E | targeted local; full Cypress/Playwright CI | command/check links |
| Images | changed AMD + ARM CI builds | GitHub check links |

## Rollback

- Preserve original local SHAs in plan and local backup refs.
- Keep old PRs open during replacement validation.
- If framework branch fails, abandon/revert PR A without affecting `v3` or TS branch.
- If PWA fails, revert PWA package/config slice; verify cache unregister/update behavior before redeploy.
- Production rollback: revert replacement squash commit, build new immutable image refs, deploy through normal release flow.
- Never reuse/mutate immutable-looking image tags.
- Remove worktrees/backup refs only after merge and explicit cleanup approval.

## Progress

- [x] Handoff reviewed against live repo and GitHub state.
- [x] Branch topology, worktrees, current `v3`, and stale source PRs verified.
- [x] Next/React, PWA, dependency-policy, and evidence risks researched.
- [x] Draft plan created in detached review worktree.
- [x] Independent plan review completed and accepted findings integrated.
- [x] Maintainer approves plan.
- [x] Slice 0 plan committed on owning branch as `07ed3e67c`.
- [x] Slice 1 branch rebased and inherited diff classified.
- [x] Slice 2 dependency contract implemented, reviewed, and locally verified; external audit unavailable by execution policy.
- [x] Slice 3 deterministic Next configuration implemented, reviewed, and locally verified; clean DevPod runtime blocked by container DNS with host fallback recorded.
- [x] Slice 4 clean-checkout-safe Next type generation implemented, reviewed, and locally verified.
- [x] Slice 5 runtime fixes implemented, independently reviewed, and committed as `13037b3ac`.
- [ ] Authenticated chat clean-render and console/network proof deferred to the configured Slice 8 environment.
- [x] Post-commit branch review findings resolved in a separate cleanup commit.
- [x] Slice 6 legacy e2e repair verified and committed separately.
- [x] Slice 7 wiki, skills, and operator evidence synchronized.
- [x] Slice 8 fresh verification and final reviews passed with documented environment and CI gates.
- [x] Slice 9 replacement draft PR opened and read back as #5166.
- [ ] Shared old-PR supersession gate in TypeScript plan approved and executed.
- [ ] Merge separately approved.

Evidence:

- Slice 0 pre-commit `check:all` passed. Host used Node 26.4.0 and emitted engine warnings against required Node 24; clean Node 24 verification remains mandatory.
- Backup refs: `backup/upgrade-next-react-pre-takeover-20260710` and `backup/upgrade-typescript-pre-takeover-20260710`.
- Rebase: `origin/v3@eef745d06` is an ancestor; mapping `191d7dff6 -> 3825fa4e6` and `07ed3e67c -> 59b88b059`.
- Normalization restored 17 Cypress files, eight unproven runtime/auth files, three TS-only asset imports, three generated email outputs, five tsconfigs, and three tracked `next-env.d.ts` hunks to `origin/v3`.
- Three independent read-only classifiers covered Cypress, runtime/config, and dependency/lockfile scope.
- Slice 2 manifests, strict workspace policy, lockfile, and deterministic transactional outputs are implemented and locally verified under Node 24.16.0 / pnpm 11.5.0.
- Slice 4 baseline hid all five `.next` trees and all generated PWA worker patterns; counts before generation were zero for both. Five explicit `next typegen` commands produced five `.next/types/routes.d.ts` files and zero worker files. Five app `check` scripts then passed under Node 24.16.0 / pnpm 11.5.0.
- `next typegen` applied Next 16's mandatory `jsx: react-jsx` setting. All five tsconfigs now include `next-env.d.ts`, `.next/types/**/*.ts`, and `.next/dev/types/**/*.ts`; all five generated declarations exist locally, are ignored, and have no tracked entries.
- CI's existing build-before-check order remains unchanged. Final staged `check:all` passed 23/23 type tasks, 6/6 lint tasks, formatting, syncpack, AGENTS, and Prisma-sync gates. The OKF wiki validator passed 14 files. Final production build passed 21/21 tasks. Known workspace-root, Pages Router i18n, ESM entry-point, middleware, page-size, cache, and manage missing-message warnings remain outside Slice 4.
- Native browser smoke loaded production builds for all five apps on isolated localhost ports. Auth rendered its login surface; chat `/noLogin` rendered the expected login-required page; control, manage, and PWA rendered their application shells and waited for absent backend/auth services. Screenshots were captured under `/private/tmp`; expected missing local auth/Langfuse configuration errors were recorded. All five servers and browser tabs were stopped.
- Final staged `check:all` reproduced a Next 16.2.9 Pages Router generator collision after both dev and production validators existed: control, manage, and PWA loaded two global `PagesPageConfig` declarations. Auth and chat remained clean because imports made their validators module-scoped. A one-app probe proved the root cause; three check-only tsconfigs now exclude `.next/dev/types` while canonical tsconfigs retain both Next-managed includes.
- Initial correctness review requested clearer evidence plus narrower docs language; both were integrated. Post-fix correctness review verified each check config includes all source/production types and zero dev types. Post-fix simplification review confirmed three local child configs are the smallest durable fix. No final findings remained.
- Final Opengrep auto scan ran 51 applicable rules across 13 changed app config files with zero findings.

Slice 5 evidence:

- Reproduced the manage render-phase redirect under Next 16.2.9: an expired session redirected to `/login` without preserving the requested path. Reproduced the public manage boundary accepting an external `redirect_to` before the fix (HTTP 200 instead of a safe auth redirect).
- Moved the manage redirect into an effect, preserved pathname and query, and moved the manage login handoff into `getServerSideProps`. Same-origin targets survive; external and malformed targets fail closed to the manage root.
- Moved PWA return-target validation to the server-provided page props. Configured-PWA absolute targets normalize to relative client navigation, the exact configured chat origin uses a hard navigation, and every other origin or malformed target fails closed to the PWA root.
- Added `AUTH_LECTURER_ALLOWED_HOSTS` and `AUTH_STUDENT_ALLOWED_HOSTS` to Turbo global environment propagation after a clean namespaced DevPod proved that Turbo stripped both variables from the auth child process and rejected the valid delegated-login callback. The same stack accepted the namespaced callback after the config change.
- Removed the auth-page tooltip wrapper after React 19 browser evidence showed nested-button hydration errors. The disabled Edu-ID button retains an accessible description and a non-interactive native-title wrapper; a fresh auth render had no console errors.
- Focused real-Chrome Playwright: five final login/redirect regressions passed after the fix, covering hostile PWA rejection, absolute same-PWA return, configured chatbot return, expired manage return, and external/malformed manage rejection. Two existing chat logged-out redirect tests passed.
- Native browser: delegated lecturer login returned to `/resources/answerCollections?tab=shared`; participant login returned to PWA home; controller displayed the seeded course selector; tested auth, manage, PWA, and control pages had no fresh console errors. Authenticated chat stayed on the chatbot URL rather than `/noLogin`, but the dev-only page remained at `Loading chatbot...` because the stack lacked Langfuse credentials and logged exporter errors. Clean authenticated chat rendering remains a Slice 8 environment gate.
- `pnpm run check:all` passed. `pnpm run build` passed all 21 build tasks. After the final PWA review fixes, its typecheck and production build passed again and Playwright TypeScript remained clean. Final Opengrep ran 213 applicable rules over six changed runtime/config/test files with zero findings. Existing framework, large-page-data, lint-warning, and missing-local-provider messages remain non-blocking baseline noise.
- The simplification review found two cross-app contract regressions before commit: legitimate absolute chat returns and absolute same-PWA returns. Both were fixed with explicit origins and regression coverage. Correctness review prompted hash-safe `router.asPath` preservation and an accessible disabled-login explanation. Final correctness and simplification re-reviews reported no findings.
- Post-commit branch review separated the verified chat navigation contract from the unverified authenticated chat render. Its cleanup commit reduces repeated login-test setup, removes a single-use button variable, replaces a CSS submit selector with an accessible role, and synchronizes auth/version documentation.
- Cleanup verification: `pnpm run check:all`, the auth production build, Playwright TypeScript, the 14-file OKF validator, AGENTS validation, and Opengrep all passed. Five focused Chrome login/redirect tests passed; chat and manage first hit cold-compilation timeouts, then both passed against the warm stack. `agent-browser` confirmed the simplified auth markup has one disabled button inside a non-interactive span, matching accessible help text and hover title, and no page errors. Existing Next image warnings remain.

Slice 6 evidence:

- Restored the legacy Cypress suite to the `v3` baseline before testing. The seeded Next 16 DevPod passed the exact `A-login.cy.ts` contract twice (7/7).
- `N-course-workflow.cy.ts` reproduced cold-navigation races in the deletion workflow. Four route-readiness assertions cover the failing library, courses, and activities transitions; the focused self-contained deletion scenario then passed (1/1). Full-spec runs remained noisy, including an unrelated setup transaction timeout and a previously passing repeated-student loop.
- `O-live-quiz-workflow.cy.ts` reproduced a destination-DOM race after opening a live quiz. Waiting for the visible description fixed that transition and the next full run passed the first 13 tests, including the description check.
- The full live-quiz spec then stopped at the legacy student-response boundary (13 passing, 1 failing, 67 skipped): the first SC option was already selected and the submit button enabled before the test selected an answer. This reproduced three times. Awaiting IndexedDB deletion did not change it and was reverted; the branch does not modify the response component or storage code. No speculative compatibility edit was retained.
- Electron DBus diagnostics and a response-API `POST` 404 were present in the local container logs; neither was the failing assertion. Full legacy-suite proof therefore remains a Slice 8/CI gate.

Slice 8 local evidence:

- Fresh DevPod `klicker-upgrade-next-react-slice8` used new database, node_modules, Hatchet, and app volumes. Node 24.16.0, pnpm 11.5.0, and frozen CI install passed.
- Clean production build passed 21/21 tasks with zero cached under bounded concurrency. Test build passed 19/19. Host `check:all`, fresh-container 23/23 typechecks, chat 40/40 tests, and branch diff check passed.
- Production builds emitted chat standalone server plus service worker, Workbox, and custom worker artifacts for control/manage/PWA. Development registered zero service workers.
- Browser verified delegated manage login, participant PWA login, authenticated control, logged-out chat, and mobile PWA. Next 16 initially blocked namespaced devrouter HMR resources; shared development-only `allowedDevOrigins` fixed this without changing production.
- Security, thermo maintainability, and independent branch reviews found no code issues. Detailed evidence: `project/2026-07-11-next-react-verification/verification.md`.
- Remaining: authenticated chat content, full live-quiz Cypress state boundary, production PWA offline/update behavior, and AMD/ARM image jobs.

Current: Slice 8 local verification is complete except documented environment/CI gates. Replacement PR CI is required before readiness.

### Slice 10 — Use Turbopack where the current PWA contract allows

Decision:

- Use Turbopack for development and test builds in all five Next apps.
- Use Turbopack for auth and chat production builds.
- Keep Webpack only for control, manage, and PWA production builds while they use
  `@ducanh2912/next-pwa`.
- Record the separate Serwist migration in
  [`project/2026-07-18-serwist-turbopack-pwa-migration-plan.md`](./2026-07-18-serwist-turbopack-pwa-migration-plan.md).

Do:

- bump Next and `eslint-config-next` from 16.2.9 to current stable 16.2.10;
- keep React and React DOM at current stable 19.2.7;
- set an explicit active-worktree monorepo root for Turbopack and output tracing;
- update app scripts to the approved mixed-bundler matrix;
- update wiki, verification evidence, and PR description.

Check:

- frozen install;
- all five Turbopack test builds;
- auth and chat Turbopack production builds plus standalone paths;
- control, manage, and PWA Webpack production builds plus service-worker outputs;
- `pnpm run check:all` and full production build;
- slice review, simplification, security, and maintainability gates.

Commit: `build(next): adopt mixed Turbopack builds`

Progress:

- [x] Current branch and latest package versions verified on 2026-07-18.
- [x] All five test-mode Turbopack builds passed on Next 16.2.9.
- [x] Auth and chat production Turbopack builds passed on Next 16.2.9.
- [x] Maintainer approved the mixed-bundler boundary.
- [x] Next and `eslint-config-next` updated to 16.2.10 across apps, shared packages, and lockfile; React remains current at 19.2.7.
- [x] Mixed scripts and explicit active-worktree root implemented.
- [x] Five Turbopack test builds and five mixed production builds passed under pinned Node 24.16.0 / pnpm 11.5.0; standalone and PWA worker artifacts were verified after implementation commit `76301b941`.
- [x] Auth and chat standalone servers returned HTTP 200. Same-origin Turbopack dev browser smokes rendered PWA login and chat `/noLogin` with no browser errors; development registered zero service workers.
- [x] Frozen offline install, `pnpm run check:all`, and the 21-task full production build passed.
- [x] Slice review and simplification passed after removing unrelated lockfile drift and stale documentation. Code-security review found no high-confidence vulnerabilities; strict maintainability review found no structural regression or simpler safe design.
- [x] Revision-bound evidence recorded locally.
- [x] Publish Slice 10 and read back current-head PR metadata and initial CI state.
- [x] Clean-install styled-jsx type regression fixed with native global style tags; four focused typechecks, four Turbopack builds, representative browser verification, `pnpm run check:all`, and the full production build passed.
- [x] Current-head Playwright startup failure reproduced from the downloaded artifact: direct upload dereferenced Turbopack dependency symlinks and omitted `use-intl`, causing PWA HTTP 500 in all eight shards. A tar-preserved artifact returned HTTP 200 in the same local loop.
- [x] Playwright artifact fix published at `7456de2dd`; all eight shards restored the tarred build and entered test execution, proving the startup regression fixed. Seven shards passed.
- [x] Catalog action-menu propagation fix published at `96293b227`; shard 5 passed 102 tests, including the formerly failing permission test in 7.4 seconds. Seven of eight shards passed.
- [x] Activity-wizard submit-promise fix published at `5441ea04f`; shard 8 passed 117 tests in 9.8 minutes, including the formerly failing single-choice and second-instance update test in 17.4 seconds. The Claude check failed again without producing review feedback.
- [x] Restored `apps/office-addin/package.json` byte-for-byte to `v3`; only the shared lockfile carries the second React 19.1 peer graph required to preserve that separate application's existing dependency boundary, with a package-scoped Syncpack exception for those four versions.
- [x] Maintainer marked the PR ready for review; the full ready-state CI matrix and final-head automated reviews started.
- [x] Sonar reliability fix published at `5653a14e1`; the final-head quality gate passed with zero new issues, all eight Playwright shards passed, and Greptile rated the branch safe to merge.
- [ ] Publish and verify the three valid CodeRabbit findings: require the trusted configured PWA origin for assessment redirects, honor Playwright student credential overrides, and align stale bundler documentation.

Next: publish the CodeRabbit fixes, resolve their review threads, verify final-head CI, then settle the ready PR for maintainer merge.

## Open Questions

- Old PR closure: requires maintainer approval after replacement PR evidence.
- Ready-for-review transition: maintainer decision after CI/manual matrix.
- Merge: always separate explicit approval.
