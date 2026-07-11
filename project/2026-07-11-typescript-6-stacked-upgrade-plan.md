# TypeScript 6 stacked upgrade plan

Status: approved for local preparation on 2026-07-11. Implementation stays local until a later push approval.

## Goal

Stack a narrow TypeScript 6 migration on [PR #5166](https://github.com/uzh-bf/klicker-uzh/pull/5166). Keep Next.js, React, Prisma, GraphQL runtime behavior, and product behavior unchanged.

Success:

- every in-scope direct workspace TypeScript dependency uses `~6.0.3`;
- direct lint tooling declares TypeScript 6 support;
- compiler config changes are explicit and minimal;
- Prisma generation is repeatable and fails closed when its compatibility patch no longer matches;
- GraphQL schema and operations do not drift;
- GraphQL public entry declarations do not regress relative to TypeScript 5.6; existing Pothos declaration portability debt stays explicit and out of scope;
- root checks plus Docs, Cypress, and Playwright compiler surfaces pass;
- PR diff against `feature/upgrade-next-react` contains TypeScript-only work.

## Non-goals

- No TypeScript 7.
- No Prisma 7 or database migration.
- No GraphQL, Pothos, Yoga, or codegen major upgrade.
- No React Compiler adoption.
- No broad dependency refresh.
- No Office Add-in changes. Another open PR reworks that app and owns its compiler/tooling migration.
- No product or UI behavior changes unless TypeScript 6 exposes a verified defect.
- No push, old-PR closure, ready-for-review change, or merge without separate approval.

## Plan identity

- Plan: `project/2026-07-11-typescript-6-stacked-upgrade-plan.md`
- Branch: `feature/upgrade-typescript`
- Worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/upgrade-typescript`
- Stack base: `feature/upgrade-next-react`
- Base PR: [#5166](https://github.com/uzh-bf/klicker-uzh/pull/5166)
- Base SHA: `bdc6701902af6e8a9863809fa2d8246d428e7101`
- Historical source PR: [#5111](https://github.com/uzh-bf/klicker-uzh/pull/5111)
- Historical TS commit: `421a5aa89e1f3ee7540c9cef927db5f441c079d9`
- Historical Next boundary: `191d7dff60312ee6f637c1d5e6bb804d844812d0`
- Backup ref: `backup/upgrade-typescript-pre-takeover-20260710`

## Current state

Evidence:

- PR #5166 CI is green at `bdc670190`, including checks, GraphQL tests, CodeQL, fallback AMD/ARM builds, and all eight Playwright shards.
- PR #5166 remains draft, mergeable, review-required, and blocked by documented manual gates.
- TypeScript branch is clean and contains one TS commit on top of obsolete Next commit `191d7dff6`.
- Historical TS commit changes 64 files. Main areas: direct TS versions, tsconfigs, Prisma generation, GraphQL types, Office CSS declaration, lockfile.
- Plain rebase is unsafe because it would replay the obsolete Next commit and reintroduce removed scope.

Decision:

- Preserve historical commit only on the backup ref.
- Rebuild local branch history from exact PR #5166 base with plan commit first.
- Apply historical TS commit with `cherry-pick --no-commit` as source material.
- Partition uncommitted changes into dependency, tsconfig, Prisma, and GraphQL slices. Do not recreate bundled historical commit.
- Resolve manifests semantically and regenerate lockfile.
- Stop after source application for stack-diff and slice-partition review.

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
- raise the three Next frontend targets from deprecated ES5 to the TS6 floor, ES2015;
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
- [ ] Slice 7 wiki and skills committed.
- [ ] Slice 8 fresh verification passed.
- [ ] Slice 9 publish approval received.

Current: Slice 7 wiki and skill updates are implemented, reviewed, formatted, and OKF-valid.

Next: Commit Slice 7, then execute fresh Node 24 verification and final reviews in Slice 8.
