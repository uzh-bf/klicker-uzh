# PR #5167 TypeScript 6 upgrade plan

Status: rebased onto merged `v3` and published on 2026-07-19. The approved tsconfig best-practice extension is active and fresh verification has passed; the ready PR remains governed by current-head CI and maintainer approval.

## Goal

Land a narrow TypeScript 6 migration on `v3` after [PR #5166](https://github.com/uzh-bf/klicker-uzh/pull/5166). Keep Next.js, React, Prisma, GraphQL runtime behavior, and product behavior unchanged.

Success:

- every in-scope direct workspace TypeScript dependency uses `~6.0.3`;
- direct lint tooling declares TypeScript 6 support;
- compiler config changes are explicit and minimal;
- Prisma generation is repeatable and fails closed when its compatibility patch no longer matches;
- GraphQL schema and operations do not drift;
- GraphQL public entry declarations do not regress relative to TypeScript 5.6; existing Pothos declaration portability debt stays explicit and out of scope;
- root checks plus Docs, Cypress, and Playwright compiler surfaces pass;
- PR diff against `v3` contains TypeScript migration work plus supporting documentation, tests, and tooling changes.

## Non-goals

- No TypeScript 7.
- No Prisma 7 or database migration.
- No GraphQL, Pothos, Yoga, or codegen major upgrade.
- No React Compiler adoption.
- No broad dependency refresh.
- No Office Add-in changes. Another open PR reworks that app and owns its compiler/tooling migration.
- No product or UI behavior changes unless TypeScript 6 exposes a verified defect.
- No old-PR closure, ready-for-review change, or merge without separate approval.

## Plan identity

- Plan: `project/2026-07-11-pr-5167-typescript-6-stacked-upgrade-plan.md`
- Branch: `feature/upgrade-typescript`
- Worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/upgrade-typescript`
- PR: [#5167](https://github.com/uzh-bf/klicker-uzh/pull/5167)
- Target: `v3`
- Merged prerequisite: [#5166](https://github.com/uzh-bf/klicker-uzh/pull/5166)
- Merged prerequisite SHA: `212a924c1`
- Current `v3` rebase base: `3872caee79df882e9c56ab438e740b5caf561d50`
- Historical source PR: [#5111](https://github.com/uzh-bf/klicker-uzh/pull/5111)
- Historical TS commit: `421a5aa89e1f3ee7540c9cef927db5f441c079d9`
- Historical Next boundary: `191d7dff60312ee6f637c1d5e6bb804d844812d0`
- Original takeover backup: `backup/upgrade-typescript-pre-takeover-20260710`
- Pre-`v3`-rebase backup: `backup/upgrade-typescript-pre-v3-20260719`

## Current state

Evidence:

- PR #5166 merged into `v3` as `212a924c1` with Next.js 16 and React 19. Current `v3` is `3872caee7`, adding only the later devcontainer startup hardening from PR #5169.
- The eight TypeScript commits were replayed onto that merge without retaining obsolete stacked Next/React history. A range-diff confirmed that all eight logical commits remain.
- The merged dual-React dependency graph exposed a missing `@types/react` edge in `recharts@2.15.3`. The same graph fails under TypeScript 5.6, so this is dependency resolution exposed by the rebase, not a TypeScript 6 language regression.
- A package-scoped pnpm extension supplies the omitted peer only to `recharts@2.15.3`; a clean install links the React types into each Recharts virtual package.
- Node 24.16.0 and pnpm 11.5.0 verification passes: frozen install, `check:all` (24/24 typechecks and 6/6 lint tasks), production build (21/21), test build (19/19), and Docs production build. Frozen install, `check:all`, and production build were rerun after the final rebase onto `3872caee7`.
- Office Add-in remains unchanged relative to `v3` and stays on TypeScript 5.6.

Decision:

- Keep the Recharts package extension in this PR because it is required for the rebased TypeScript branch to typecheck from a clean install.
- Keep TypeScript 7 out of PR #5167. Pursue it separately as a dual-compiler migration after the repository release-age gate allows the package and the Docs compiler boundary is decided.

## Research

Checked 2026-07-11:

- [TypeScript 6 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-6-0.html): new defaults affect `types`, `rootDir`, side-effect imports, target floor, and `baseUrl` use.
- [TypeScript 6 announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/): migration context and compatibility guidance.
- [typescript-eslint dependency policy](https://typescript-eslint.io/users/dependency-versions/): supported compiler range must include the selected TypeScript version.
- npm registry: TypeScript `6.0.3` is the final TS6 patch; TypeScript `7.0.2` is latest overall and out of scope.
- npm registry: `prisma-json-types-generator` `3.6.0` and `3.6.2` require Prisma 6 but declare TypeScript `^5.9.2`.
- npm registry: generator `5.1.1` requires Prisma 7. No supported Prisma 6 plus TypeScript 6 combination exists.
- Local inventory: 29 package manifests declare TypeScript directly; 28 are in scope and the Office Add-in remains on its existing compiler. Twenty-five tsconfigs use `baseUrl`.

Limitation:

- Generator peer override is temporary unsupported territory. Clean generation, idempotence, declaration builds, and removal criteria are mandatory. Failure pauses TS6 instead of pulling Prisma 7 into this PR.

## Dependency decisions

| Package | Base | Target | Decision |
| --- | --- | --- | --- |
| `typescript` | `~5.6.3` | `~6.0.3` | Pin across every direct consumer. |
| Office Add-in TypeScript and lint tooling | Current PR #5166 state | Unchanged | Owned by separate Office Add-in PR. |
| `@types/node` | Node 24 line | Node 24 line | No runtime-major drift. |
| Prisma and client | `6.16.1` | `6.16.1` | Prisma 7 stays separate. |
| `prisma-json-types-generator` | `3.6.0` | `3.6.0` | Temporary TS peer override only after proof. |

## Main risks

| Risk | Control | Fallback |
| --- | --- | --- |
| Obsolete Next work returns during rebuild | Start from exact PR #5166 SHA; apply historical TS commit without committing; diff against base | Abort cherry-pick; restore plan-only branch |
| Lockfile loses PR #5166 policy changes | Resolve manifests first; regenerate with pnpm 11.5.0 | Restore base manifests and reinstall |
| TS6 defaults change output paths or globals | Audit each changed tsconfig; compare emitted paths | Restore explicit TS5 behavior per package |
| Prisma generator peer mismatch breaks declarations | Generate twice, hash output, build declarations, test failure path | Revert TS6 or pause PR |
| Patch silently stops applying | Exact-string fail-closed script and fixture test | Pin generator; keep TS5 |
| GraphQL public API drifts | Diff generated schema and operations | Reject drift; narrow type fix |
| Existing GraphQL declaration warnings are mistaken for TS6 regressions | Compare TS5.6 and TS6 diagnostics plus public entry declaration hashes on identical source | Split warning cleanup into a prerequisite/follow-up PR if TS6 changes the baseline |
| Generic root gates omit packages | Explicit Docs, Cypress, and Playwright checks | Fix package locally; do not weaken gates |

## Slices

### Slice 0: Own plan and checkpoint stack

Files:

- this plan only

Do:

- record live PR #5166 SHA and CI state;
- confirm TS branch/worktree clean;
- confirm backup ref points to `421a5aa89`;
- commit plan alone.

Check:

```bash
git status --short --branch
git show-ref --verify refs/heads/backup/upgrade-typescript-pre-takeover-20260710
git rev-parse feature/upgrade-next-react
git rev-parse feature/upgrade-typescript
```

Commit: `docs(project): add TypeScript 6 stacked upgrade plan`

### Slice 1: Rebuild plan-first stack and classify source diff

Do:

- fetch refs and confirm PR #5166 live head still equals `bdc670190`;
- rebuild local feature branch from exact base with Slice 0 plan as first branch commit;
- apply `421a5aa89` using `git cherry-pick --no-commit`;
- resolve conflicts by preserving PR #5166 behavior and exposing only TS6 source changes;
- leave historical source diff uncommitted;
- classify every changed file into Slice 2, 3, 4, or 5;
- remove stale runtime, Cypress, generated HTML, and Next config work if any appears;
- stop for diff and classification review before committing implementation.

Reference shape:

```bash
git fetch origin
gh pr view 5166 --json headRefOid
SOURCE=421a5aa89e1f3ee7540c9cef927db5f441c079d9
BASE=bdc6701902af6e8a9863809fa2d8246d428e7101
# Replay only commits after SOURCE. At Slice 1 start, that is the plan commit.
git rebase --onto "$BASE" "$SOURCE" feature/upgrade-typescript
git cherry-pick --no-commit "$SOURCE"
```

Check:

```bash
test "$(git merge-base feature/upgrade-next-react HEAD)" = \
  "$(git rev-parse feature/upgrade-next-react)"
git log --oneline feature/upgrade-next-react..HEAD
git diff --name-status
git ls-files --others --exclude-standard
git diff --check
```

Commit: none. Source diff stays uncommitted for partitioning.

### Slice 2: Align direct compiler tooling

Files:

- direct TypeScript package manifests
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`
- `.syncpackrc.mjs`

Do:

- pin TypeScript `~6.0.3` in all 28 in-scope direct consumers;
- leave Office Add-in manifest and tooling unchanged;
- add one scoped syncpack exception for Office Add-in `typescript` until its owning PR lands;
- keep Node types on Node 24;
- keep one documented Prisma generator peer exception;
- regenerate lockfile and inspect peers.

Check:

```bash
pnpm install
CI=true pnpm install --frozen-lockfile
pnpm run check:syncpack
pnpm peers check
```

Checkpoint: batch with Slices 3–5. A dependency-only commit cannot pass the mandatory root pre-commit typecheck before the compiler-config and Prisma/GraphQL compatibility changes exist.

### Slice 3: Migrate compiler configs

Do:

- inventory `types`, `rootDir`, `baseUrl`, `paths`, target, module settings, declarations, and composite mode;
- inventory `strict`, `noUncheckedSideEffectImports`, `libReplacement`, `downlevelIteration`, `outFile`, false interop settings, and deprecated module/module-resolution values;
- record preserve/remove decision for each encountered TS6 default or deprecation;
- add explicit values only where TS6 changes current behavior;
- remove `baseUrl` only with equivalent explicit paths;
- retain the Docs `baseUrl` with `ignoreDeprecations: "6.0"` because the inherited Docusaurus `@site/*` mapping otherwise resolves relative to the dependency package;
- keep Prisma and GraphQL check configs separate from declaration builds;
- accept only type/import fixes caused by TS6.

Check:

```bash
pnpm run check
pnpm --filter @klicker-uzh/docs build:docs
```

Decisions:

- remove 24 local `baseUrl` declarations; retain only the Docusaurus compatibility exception;
- make path targets explicitly relative where TS6 requires it without `baseUrl`;
- raise the three Next frontend targets from deprecated ES5 to Next's ES2017 baseline;
- leave `types`, `rootDir`, module settings, strictness, side-effect imports, library replacement, downlevel iteration, output mode, and interop behavior unchanged.

Checkpoint: batch with Slices 2, 4, and 5 so the normal pre-commit gate sees one buildable compatibility set.

### Slice 4: Stabilize Prisma generation

Do:

- generate twice in the local worktree; reserve clean disposable-environment proof for Slice 8;
- run compatibility patch through package script;
- generate twice and compare hashes;
- add automated patch tests for expected input, already-patched input, missing token, and duplicate token;
- require exact replacement cardinality rather than first-match success;
- build declarations and inspect exports;
- document workaround owner and removal trigger.

Check:

```bash
pnpm --filter @klicker-uzh/prisma generate
pnpm --filter @klicker-uzh/prisma test:patch-namespace
pnpm --filter @klicker-uzh/prisma check
pnpm --filter @klicker-uzh/prisma build
pnpm --filter @klicker-uzh/prisma build:test
```

Checkpoint: batch with Slices 2, 3, and 5. Final clean-environment proof remains in Slice 8.

### Slice 5: Prove GraphQL integration

Do:

- build Prisma first;
- type Pothos integration without broad suppression;
- generate GraphQL artifacts;
- reject unexplained public schema or operation drift;
- assert zero diff against stack base for `src/ops.ts`, `src/ops.schema.json`, `src/public/schema.graphql`, `src/public/client.json`, and `src/public/server.json`;
- assert `src/graphql/ops/**/*.graphql` remains unchanged;
- compile backend and worker consumers.
- compare TS5.6 and TS6 declaration diagnostics and public entry declarations on identical source; do not claim warning-free declarations while baseline Pothos portability debt remains.

Check:

```bash
pnpm --filter @klicker-uzh/graphql generate
pnpm --filter @klicker-uzh/graphql check
pnpm --filter @klicker-uzh/graphql build
pnpm --filter @klicker-uzh/graphql test:local
git diff --exit-code feature/upgrade-next-react -- \
  packages/graphql/src/ops.ts \
  packages/graphql/src/ops.schema.json \
  packages/graphql/src/public/schema.graphql \
  packages/graphql/src/public/client.json \
  packages/graphql/src/public/server.json \
  ':(glob)packages/graphql/src/graphql/ops/**/*.graphql'
pnpm --filter @klicker-uzh/backend-docker check
pnpm --filter @klicker-uzh/hatchet-worker-general check
pnpm --filter @klicker-uzh/hatchet-worker-response-processor check
```

Commit for Slices 2–5: `chore(types): upgrade workspace to TypeScript 6`

### Slice 6: Run omitted compiler and build surfaces

Check:

```bash
CI=true pnpm install --frozen-lockfile
pnpm run build
pnpm run check:all
pnpm run build:test
pnpm --filter @klicker-uzh/docs build:docs
pnpm --filter @klicker-uzh/cypress exec tsc --noEmit -p tsconfig.json
pnpm --filter @klicker-uzh/playwright exec tsc --noEmit -p tsconfig.json
```

Commit: fixes use smallest accurate scope. Evidence alone gets no code commit.

### Slice 7: Update wiki and skills

Files:

- `docs/getting-started.md`
- `docs/data-and-migrations.md`
- `docs/frontend-conventions.md`
- `docs/testing.md`
- `docs/log.md`
- affected `.agents/skills/klicker-*` files

Do:

- document TS6 baseline and explicit verification surfaces;
- document package-script-only Prisma generation, peer exception, and removal trigger;
- keep facts in wiki and procedure in skills.

Commit: `docs: document TypeScript 6 build and generation workflow`

### Slice 8: Fresh verification and final review

Environment:

- fresh branch-local DevPod;
- new generated Prisma tree, package outputs, `.next` trees, and Turbo state;
- Node 24.16.0 and pnpm 11.5.0.

Proof:

- root build/check/test-build gates;
- explicit Docs, Cypress, and Playwright compiler checks;
- auth, manage, PWA, control, and chat browser smoke;
- desktop/mobile screenshots;
- scoped Opengrep plus repository-wide baseline report;
- security review, strict maintainability review, and independent branch review.

Commit: `docs(project): record TypeScript 6 verification evidence`

### Slice 9: Publish stacked draft PR

Do only after approval:

- push `feature/upgrade-typescript`;
- open draft PR targeting `feature/upgrade-next-react`;
- rename plan with PR ID in a standalone commit;
- fetch and read `gh pr view 5166 --json headRefOid` before each push;
- require live PR #5166 head to equal stack merge-base; on drift, pause, restack, and rerun affected local gates;
- write branch-wide PR body against PR #5166;
- run and read CI, reviews, comments, full Playwright/Cypress status, and affected image builds;
- after PR #5166 merges, request approval before rewriting published history, restack onto `origin/v3`, force-push with lease, retarget, and rerun all gates.

## Post-merge rebase and TypeScript 7 feasibility

### TypeScript 6 rebase

- preserve the pre-rebase branch as `backup/upgrade-typescript-pre-v3-20260719`;
- replay the eight TypeScript commits onto the merged Next.js and React prerequisite;
- resolve dependency-policy and lockfile conflicts semantically;
- rebase once more onto the current `v3` head before publication;
- verify from a clean install and force-push only with a lease.

### TypeScript 7 result

Checked 2026-07-19 against stable TypeScript `7.0.2`:

| Approach | Result | Meaning |
| --- | --- | --- |
| Replace TypeScript 6 directly with TypeScript 7 | Blocked | Prisma/Pothos generation fails because TypeScript 7 has no programmatic compiler API. Next type generation also expects the API package. |
| Official dual-compiler transition | Viable | Keep `typescript` aliased to `@typescript/typescript6@6.0.2` for API consumers and add stable TypeScript 7 under a separate native CLI alias. Prisma generation, all five Next type-generation commands, production build (21/21), and post-build checks (24/24) pass. |
| Compile Docs with TypeScript 7 | Blocked on current Docusaurus | Docusaurus 3.8.1 inherits the removed `baseUrl` option. Upgrade Docusaurus or keep Docs on TypeScript 6 during the transition. |
| Install through repository policy | Temporarily blocked | The 14-day minimum release-age policy rejects TypeScript 7.0.2 until it matures past the configured gate. Do not bypass this policy in the real branch. |

Additional constraint: the current `typescript-eslint` release officially supports TypeScript versions below 6.1. The dual setup can keep lint tooling on the TypeScript 6 compatibility package, but CI must still prove that the TypeScript 7 CLI does not introduce unacceptable runtime or memory cost when Turbo runs checks in parallel.

Recommendation: merge TypeScript 6 first. Open a separate TypeScript 7 transition PR after the release-age gate clears, using the supported dual-compiler pattern. Keep Office Add-in on its existing compiler, and either upgrade Docusaurus first or explicitly exempt Docs. A full TypeScript 7 replacement should wait until Next, Prisma generators, lint tooling, and Docs no longer require the TypeScript 6 API/configuration surface.

## Approved tsconfig best-practice extension

Approved 2026-07-19 after auditing all tracked tsconfigs except Office Add-in against installed Next.js 16.2.10 behavior and current TypeScript module guidance.

Decision:

- keep Next apps on `module: ESNext`, `moduleResolution: Bundler`, and `jsx: react-jsx`;
- keep Node-targeted Rollup outputs on `NodeNext` because external packages remain runtime imports;
- keep browser/source bundles on bundler-aware resolution;
- do not introduce a shared tsconfig hierarchy in this dependency PR;
- do not change Office Add-in, TypeScript 7, Serwist, Cypress, Playwright, or Docusaurus compatibility boundaries.

### Slice 10: Align Next.js compiler contracts

Do:

- raise Control, Manage, and PWA from `ES2015` to Next's `ES2017` baseline;
- add the Next TypeScript plugin to those three apps;
- remove `ignoreBuildErrors` from the shared Next config;
- remove the TypeScript build bypass from every Next app;
- keep build-time type checking enabled against each app's canonical `tsconfig.json`; Next 16 filters stale development validators on its production typecheck path;
- preserve Turbopack production builds for Auth/Chat and Webpack production builds for the three PWA apps.

Check:

```bash
pnpm --filter @klicker-uzh/auth check
pnpm --filter @klicker-uzh/chat check
pnpm --filter @klicker-uzh/frontend-control check
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/frontend-pwa check
```

Commit: `build(next): align TypeScript compiler contracts`

### Slice 11: Align library and script compiler roles

Do:

- replace unused `composite` settings with `incremental` where emitted packages already persist build info;
- remove now-redundant check-config overrides;
- use `react-jsx` in Markdown and shared components;
- make source-only i18n explicit `noEmit` with `module: preserve` and bundler resolution;
- make script-only Prisma data explicit `noEmit` while retaining `NodeNext` runtime resolution;
- keep existing strictness and test-runner compatibility exceptions.

Check:

```bash
pnpm run check
pnpm --filter @klicker-uzh/markdown build
pnpm --filter @klicker-uzh/graphql build
pnpm --filter @klicker-uzh/export build
```

Commit: `build(types): align workspace compiler roles`

### Slice 12: Document and verify the compiler matrix

Do:

- update compiler and bundler facts in the engineering wiki and testing procedure;
- record the raw-check validator-duplication exception and the NodeNext-versus-Bundler rule;
- run the full compiler, mixed production bundler, all-Turbopack test build, Docs, browser-smoke, security, maintainability, and independent-review gates;
- update the whole-branch PR body and read back current-head CI.

Check:

```bash
pnpm run check:all
pnpm run build
pnpm run build:test
pnpm --filter @klicker-uzh/docs build:docs
```

Commit: `build(types): isolate compiler cache ownership`

## Review cadence

Every implementation slice:

1. run fastest relevant check;
2. independent correctness review;
3. separate simplification review;
4. integrate findings;
5. rerun checks;
6. update progress;
7. commit one slice.

## Rollback

- PR #5166 stays independent and mergeable without this branch.
- Backup ref preserves original TS commit.
- Generator or declaration failure pauses TS6 and restores TS5.6.
- Prisma 7 is never an emergency fix inside this stack.
- Lockfile conflict resets to PR #5166 manifests before regeneration.

## Progress

- [x] Live worktrees, branches, old PRs, and stack boundary verified.
- [x] PR #5166 current SHA and CI read back.
- [x] TypeScript, typescript-eslint, and Prisma generator registry facts refreshed.
- [x] Historical TS commit classified as source material.
- [x] Independent plan review completed on this branch-owned draft.
- [x] Review changes accepted: plan-first rebuild, local-before-remote verification order, live-base drift gate, patch tests, GraphQL no-drift assertion, expanded compiler audit.
- [x] Slice 0 plan committed alone as `03c185f20`; rewritten on the new base as `00d528063`.
- [x] Slice 1 plan-first rebuild completed on `bdc670190`; historical TS commit applied without commit.
- [x] Slice 1 source scope classified after Office exclusion: 60 files excluding this plan, comprising 28 manifests, one workspace-policy file, 25 modified tsconfigs, two new config files, and four Prisma/GraphQL integration files. No runtime page/component, Cypress-spec, Next-config, Office Add-in, or generated-email scope remains.
- [x] Slice 1 conflict resolution preserved PR #5166 typegen includes and release/security policy; lockfile restored to base for Slice 2 regeneration.
- [x] Slice 1 correctness and simplification reviews completed. Accepted fixes: restore auth `baseUrl` removal, include untracked source files in inventory, correct source counts, remove one cosmetic blank line.
- [x] Slice 2 dependency partition prepared: 28 direct consumers use TypeScript `~6.0.3`; Office Add-in remains the only `~5.6.3` consumer; a package-scoped Syncpack exception isolates that intentional mismatch.
- [x] Slice 2 lockfile regenerated with pnpm 11.5.0, then narrowed to preserve the existing Office Add-in Teams CLI transitive edges. Frozen install and Syncpack pass; peer inspection reports only pre-existing non-TypeScript incompatibilities.
- [x] Slice 2 correctness review found no actionable issue. Simplification review identified the Office transitive drift, which was removed without adding global overrides.
- [x] Slice 2 cannot be committed as a standalone buildable checkpoint: the normal root hook correctly fails on TS6-deprecated compiler options before Slice 3. No hook bypass was used; Slices 2–5 will form one atomic compatibility commit.
- [x] Slice 3 migrated 25 tracked compiler configs. Root compiler gate passes 23/23 tasks and Docs production build passes. Review restored the required Docs `baseUrl`; an invalid suggestion to remove explicit `./` path prefixes was rejected by fresh TS5090 evidence.
- [x] Slice 4 added fail-closed exact-cardinality patching and four node-level regression tests. Two generations produced identical tree hash `ae14ed18d4d72e7b88a2e800df8fe556abf3bc97eed6a0dcf0f0bb92800c5d3a`; Prisma check, build, test build, and declaration export inspection pass. Correctness and simplification reviews found no issues.
- [x] Slice 5 Prisma-first GraphQL generation, check, build, no-drift assertion, backend check, and both worker checks pass. Generated schema, operations, and GraphQL documents are unchanged from the stack base.
- [x] Slice 5 declaration baseline compared on identical source: TS5.6 reports 33 TS2742 diagnostics and TS6 reports the corresponding 33 TS2883 diagnostics; Rollup diagnostic histograms and public `index.d.ts` / `builder.d.ts` hashes are identical. Existing Pothos declaration debt is not expanded in this upgrade.
- [x] Slices 2–5 committed atomically as `fcc231ce9`; the normal pre-commit gate passed without bypassing hooks.
- [ ] GraphQL `test:local` rerun pending an environment without the existing OrbStack port-80 listener; the script cleaned up after the bind failure.
- [x] Slice 6 frozen install, full build (21/21), root `check:all`, test build (19/19), Docs production build, and explicit Cypress and Playwright compiler checks pass.
- [x] Slice 6 restored the two intentional bare `public/*` asset import roots with explicit relative aliases in Manage and PWA. Both focused production builds pass.
- [x] Slice 6 made Cypress's inherited TypeScript 5 non-strict behavior explicit. Cypress passes under TypeScript 5.6 and under TypeScript 6 with `strict: false`; Playwright remains strict and passes under TypeScript 6.
- [x] Slice 6 correctness and simplification reviews found no issues. The two aliases cover all nine bare asset imports without source churn; explicit Cypress `strict: false` does not weaken its TypeScript 5 baseline.
- [x] Slice 6 compatibility fixes committed as `6d3a86a24`; the normal hook passed 23/23 typecheck tasks and 6/6 lint tasks.
- [x] Slice 7 updated the four affected wiki pages, log, and two existing procedures. Correctness review found no issues; simplification kept durable facts in the wiki and exact commands in skills.
- [x] Slice 7 wiki and skills committed as `fd4cfe82a`; the normal hook passed 23/23 typecheck tasks and 6/6 lint tasks.
- [x] Slice 8 created fresh DevPod `klicker-upgrade-typescript` for repo `/Users/rschlae/Git/klicker/klicker-uzh/trees/upgrade-typescript`, with workspace token `upgrade-typescript`, Node 24.16.0, pnpm 11.5.0, and TypeScript 6.0.3. Fresh install passed the 3,995-entry supply-chain lockfile policy.
- [x] Slice 8 cold Node 24 gates pass: production build 21/21, expanded typecheck 25/25 with Cypress, Playwright, and the four Prisma patch invariant tests, test build 19/19, and Docs production build. The production build required removing the devcontainer's inherited `NODE_ENV=development`, matching CI production semantics.
- [x] Slice 8 aggregate `check:all` limitations are environment-only and explicit: container `lint-staged` cannot follow the host worktree's `.git` metadata path, and the devcontainer omits `uv` for Analytics lint. The normal host hooks passed the complete check on both Slice 6 and Slice 7; direct Node 24 typecheck, Syncpack, AGENTS, and Prisma-sync gates pass.
- [x] Slice 8 browser smoke passed with no page errors: delegated Auth → Manage login and authenticated dashboard, PWA login page, Control course list, and Chat no-login page. Evidence: `/private/tmp/ts6-browser/manage-desktop.png` and `/private/tmp/ts6-browser/pwa-mobile.png`.
- [x] Slice 8 scoped Opengrep ran 200 rules on both new Prisma script files with zero findings. Repository baseline ran 676 rules on 3,013 tracked files and reported 607 pre-existing findings; none touch the new scripts.
- [x] Slice 8 registry audit reports no TypeScript advisory. The repository baseline remains 123 advisories (2 critical, 40 high, 65 moderate, 16 low), outside this TypeScript-only dependency scope.
- [x] Slice 8 security review found no high-confidence vulnerability: the TypeScript artifact is pinned with integrity, the peer override is package-scoped, the Prisma patch is fixed-path and fail-closed, and Office's semantic importer remains unchanged.
- [x] Slice 8 strict maintainability review produced two accepted fixes: make Cypress, Playwright, and Prisma regression checks canonical, and remove duplicate `src/*` import dialects from Chat and PWA. Focused checks, the 25/25 Node 24 graph, Chat/PWA Node 24 production builds, root `check:all`, and OKF validation pass after the fixes.
- [x] Slice 8 independent branch review found no code or scope issue and confirmed the branch is ready for a stacked draft PR. Merge readiness remains gated on GraphQL runtime tests in CI or an environment without the existing host port-80 listener.
- [x] Slice 8 fresh verification passed. Browser warming was serialized after simultaneous first compilation exhausted the 24 GiB container memory and swap; the resulting user-path smoke is clean. Both unchanged Hatchet workers connect but expose an existing `@hatchet-dev/typescript-sdk@1.9.4` heartbeat logger `TypeError`; this is recorded as an unrelated runtime baseline gap.
- [x] Publication standards, spec, and simplification reviews completed. Accepted cleanup: replace GraphQL's compatibility-only `src/*` alias with repository-standard `@/*` imports across all 12 consumers. Node 24 GraphQL check and production build pass after the cleanup; existing declaration warnings remain baseline-equivalent.
- [x] Slice 9 publish approval received.
- [x] PR CI failure diagnosis completed at `d74201f15`: GraphQL tests could not resolve the new `@/*` imports because Vitest lacked the matching runtime alias; `check-types` restored a cached Prisma build without the generated `src/prisma/client` tree. The `test-graphql-status` failure was only the downstream status gate.
- [x] CI repair adds the Vitest alias, makes the Prisma check generate its own client, and removes the now-redundant Prisma check-to-build Turbo edge. A missing-client Node 24 Prisma check passes, the formerly blocked GraphQL suite resolves its aliases and executes, and the full Node 24 typecheck graph passes 25/25. Full service-backed GraphQL results remain delegated to the clean CI stack because the shared DevPod database and worker state are not test-isolated.
- [x] PR #5166 merged into `v3`; the eight TypeScript commits were replayed onto the merged dependency base and preserved by range-diff. Backup ref `backup/upgrade-typescript-pre-v3-20260719` retains the old published history.
- [x] Clean post-rebase checks exposed the missing Recharts-to-React-types dependency edge. A package-scoped pnpm extension fixes the graph; TypeScript 5.6 reproduction confirmed this is not a TypeScript 6 regression.
- [x] Post-fix Node 24 verification passes: frozen install, `check:all` (24/24 typechecks and 6/6 lint tasks), production build (21/21), test build (19/19), and Docs build. Office Add-in has no diff from `v3`.
- [x] TypeScript 7 feasibility tested in disposable trees. Direct replacement is blocked; the official TypeScript 7 CLI plus TypeScript 6 API compatibility pattern passes Prisma generation, Next type generation, production build, and all 24 post-build checks. Release-age policy and Docusaurus remain explicit prerequisites.
- [x] Final rebase onto current `v3` commit `3872caee7` completed. Range-diff preserves all ten branch commits; the TypeScript wiki commit keeps the newer devcontainer timestamp and log history. Fresh Node 24 frozen install, `check:all` (24/24 and 6/6), and production build (21/21) pass.
- [x] Slice 10 aligned the three PWA apps with Next's ES2017 target and TypeScript plugin and removed every Next TypeScript build bypass. The final design has no per-app config-selection branch: Next 16 production builds typecheck the canonical `tsconfig.json`, while raw PWA checks alone use `tsconfig.check.json` to exclude stale development validators. Fresh Node 24 production Webpack builds for Control, Manage, and PWA ran Next's `Running TypeScript` gate and passed with their service-worker outputs.
- [x] Slice 11 replaced unused project-reference `composite` flags with explicit incremental caches where emitted outputs and build state persist, made i18n and Prisma data explicit source/script-only check targets, and adopted the automatic React JSX runtime in shared React libraries. A no-emit-only check-config simplification reproduced the existing 33 GraphQL declaration-portability diagnostics, so GraphQL and Prisma checks retain the minimal declaration overrides. The sequential finish gate exposed Prisma's Rollup cleanup racing with incremental state inside `dist`; Prisma remains deliberately non-incremental, and two consecutive Prisma builds retain both declarations before the downstream Types build passes. Fresh Node 24 typecheck (24/24), production build (21/21), and corrected all-Turbopack build (19/19) pass.
- [x] Slice 12 documented the compiler matrix, raw-check validator boundary, Prisma incremental exception, and both build-error lessons. Strict review found and corrected shared incremental state between emit and no-emit compilers, including separate GraphQL, Backend, Export library/CLI/check, and workspace check caches; no shared config abstraction was added. Fresh Node 24 gates pass: `check:all` (24/24 typechecks and 6/6 lint tasks), forced production build (21/21), forced all-Turbopack test build (19/19), Docs production build, focused canonical-config PWA builds, and a mobile PWA browser smoke with no page errors. Branch-owned solution docs pass OKF validation; full wiki validation retains one unrelated pre-existing solution-frontmatter error. Security, correctness, alternate-model, and final strict maintainability reviews found no remaining code issue.
- [x] Current-head CI at `30037aabd` exposed a gap between the staged-file pre-commit format check and CI's full-repository check. The TypeScript 6-aware import organizer removed or narrowed 33 obsolete React default imports after the automatic JSX migration. The exact formatter diff and both affected package typechecks pass locally.
- [x] CI at `38dbe9a97` passed every reported check: TypeScript, full-repository formatting, lint, Syncpack, GraphQL, CodeQL, SonarCloud, GitGuardian, all image builds and package tests, and all eight Playwright shards.
- [x] Final review feedback was verified and resolved with documentation-only wording corrections: the complete `check:all` gate, an exact `agent-browser@0.32.2` command, the plan's migration scope, and the final ES2017 target.

Current: The approved tsconfig extension and final review cleanup are published on [PR #5167](https://github.com/uzh-bf/klicker-uzh/pull/5167). Office Add-in remains on TypeScript 5.6 and is untouched.

Next: keep current-head CI green and obtain the required maintainer approval. Do not change the PR's readiness or merge state without explicit authority; merge only with green current-head CI.
