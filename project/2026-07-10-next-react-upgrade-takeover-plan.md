# Next.js 16 and React 19 Takeover Plan

Status: approved 2026-07-10; Slice 2 active.

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
- Skip Turbopack migration. Initial safe target uses Webpack only.
- Skip `middleware.ts` -> `proxy.ts` auth migration unless Next 16 makes current middleware unusable. Handle separately because redirect/cookie logic is security-sensitive.
- Skip broad security dependency refresh. Only dependency overrides required by this framework upgrade stay in this PR.
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
- [ ] Slices 2-7 implemented and committed separately.
- [ ] Slice 8 fresh verification and final reviews pass.
- [ ] Slice 9 replacement draft PR opened and read back.
- [ ] Shared old-PR supersession gate in TypeScript plan approved and executed.
- [ ] Merge separately approved.

Evidence:

- Slice 0 pre-commit `check:all` passed. Host used Node 26.4.0 and emitted engine warnings against required Node 24; clean Node 24 verification remains mandatory.
- Backup refs: `backup/upgrade-next-react-pre-takeover-20260710` and `backup/upgrade-typescript-pre-takeover-20260710`.
- Rebase: `origin/v3@eef745d06` is an ancestor; mapping `191d7dff6 -> 3825fa4e6` and `07ed3e67c -> 59b88b059`.
- Normalization restored 17 Cypress files, eight unproven runtime/auth files, three TS-only asset imports, three generated email outputs, five tsconfigs, and three tracked `next-env.d.ts` hunks to `origin/v3`.
- Three independent read-only classifiers covered Cypress, runtime/config, and dependency/lockfile scope.
- Slice 2 manifests, strict workspace policy, lockfile, and deterministic transactional outputs are implemented and locally verified under Node 24.16.0 / pnpm 11.5.0.

Current: Slice 2 dependency contract is committed at branch `HEAD`; implementation and reviews are complete. The external audit was approved but prohibited by execution policy.

Next: start Slice 3 bundler and Next configuration cleanup.

## Open Questions

- Old PR closure: requires maintainer approval after replacement PR evidence.
- Ready-for-review transition: maintainer decision after CI/manual matrix.
- Merge: always separate explicit approval.

## Next Steps

1. Start Slice 3 bundler and Next configuration cleanup.
