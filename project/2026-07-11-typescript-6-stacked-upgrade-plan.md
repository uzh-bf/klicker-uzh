# TypeScript 6 stacked upgrade plan

Status: approved for local preparation on 2026-07-11. Implementation stays local until a later push approval.

## Goal

Stack a narrow TypeScript 6 migration on [PR #5166](https://github.com/uzh-bf/klicker-uzh/pull/5166). Keep Next.js, React, Prisma, GraphQL runtime behavior, and product behavior unchanged.

Success:

- every direct workspace TypeScript dependency uses `~6.0.3`;
- direct lint tooling declares TypeScript 6 support;
- compiler config changes are explicit and minimal;
- Prisma generation is repeatable and fails closed when its compatibility patch no longer matches;
- GraphQL schema and operations do not drift;
- root checks plus Docs, Office, Cypress, and Playwright compiler surfaces pass;
- PR diff against `feature/upgrade-next-react` contains TypeScript-only work.

## Non-goals

- No TypeScript 7.
- No Prisma 7 or database migration.
- No GraphQL, Pothos, Yoga, or codegen major upgrade.
- No React Compiler adoption.
- No broad dependency refresh.
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
- npm registry: `@typescript-eslint` `8.62.0` is old enough for the repository's 14-day release policy and declares TypeScript `>=4.8.4 <6.1.0`.
- npm registry: `prisma-json-types-generator` `3.6.0` and `3.6.2` require Prisma 6 but declare TypeScript `^5.9.2`.
- npm registry: generator `5.1.1` requires Prisma 7. No supported Prisma 6 plus TypeScript 6 combination exists.
- Local inventory: 29 package manifests declare TypeScript directly; 25 tsconfigs use `baseUrl`.

Limitation:

- Generator peer override is temporary unsupported territory. Clean generation, idempotence, declaration builds, and removal criteria are mandatory. Failure pauses TS6 instead of pulling Prisma 7 into this PR.

## Dependency decisions

| Package | Base | Target | Decision |
| --- | --- | --- | --- |
| `typescript` | `~5.6.3` | `~6.0.3` | Pin across every direct consumer. |
| `@typescript-eslint/parser` | `~8.35.1` | `~8.62.0` or remove | Prove direct Office use. Keep parser/plugin paired. |
| `@typescript-eslint/eslint-plugin` | `~8.35.1` | `~8.62.0` or remove | Same decision as parser. |
| `@types/node` | Node 24 line | Node 24 line | No runtime-major drift. |
| Prisma and client | `6.16.1` | `6.16.1` | Prisma 7 stays separate. |
| `prisma-json-types-generator` | `3.6.0` | `3.6.x` | Temporary TS peer override only after proof. |

## Main risks

| Risk | Control | Fallback |
| --- | --- | --- |
| Obsolete Next work returns during rebuild | Start from exact PR #5166 SHA; apply historical TS commit without committing; diff against base | Abort cherry-pick; restore plan-only branch |
| Lockfile loses PR #5166 policy changes | Resolve manifests first; regenerate with pnpm 11.5.0 | Restore base manifests and reinstall |
| TS6 defaults change output paths or globals | Audit each changed tsconfig; compare emitted paths | Restore explicit TS5 behavior per package |
| Prisma generator peer mismatch breaks declarations | Generate twice, hash output, build declarations, test failure path | Revert TS6 or pause PR |
| Patch silently stops applying | Exact-string fail-closed script and fixture test | Pin generator; keep TS5 |
| GraphQL public API drifts | Diff generated schema and operations | Reject drift; narrow type fix |
| Generic root gates omit packages | Explicit Docs, Office, Cypress, Playwright checks | Fix package locally; do not weaken gates |

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
git diff --check
```

Commit: none. Source diff stays uncommitted for partitioning.

### Slice 2: Align direct compiler tooling

Files:

- direct TypeScript package manifests
- Office lint tooling
- `pnpm-workspace.yaml`
- `pnpm-lock.yaml`

Do:

- pin TypeScript `~6.0.3` everywhere it is direct;
- remove dead Office parser/plugin packages or upgrade pair to `~8.62.0`;
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

Commit: `chore(deps): align workspace tooling with TypeScript 6`

### Slice 3: Migrate compiler configs

Do:

- inventory `types`, `rootDir`, `baseUrl`, `paths`, target, module settings, declarations, and composite mode;
- inventory `strict`, `noUncheckedSideEffectImports`, `libReplacement`, `downlevelIteration`, `outFile`, false interop settings, and deprecated module/module-resolution values;
- record preserve/remove decision for each encountered TS6 default or deprecation;
- add explicit values only where TS6 changes current behavior;
- remove `baseUrl` only with equivalent explicit paths;
- keep Prisma and GraphQL check configs separate from declaration builds;
- accept only type/import fixes caused by TS6.

Check:

```bash
pnpm run check
pnpm --filter @klicker-uzh/docs build:docs
pnpm --filter @klicker-uzh/office-addin check
pnpm --filter @klicker-uzh/office-addin build:office
```

Commit: `build(tsconfig): migrate compiler configs to TypeScript 6`

### Slice 4: Stabilize Prisma generation

Do:

- generate from a clean disposable environment;
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

Commit: `fix(prisma): stabilize generated types under TypeScript 6`

### Slice 5: Prove GraphQL integration

Do:

- build Prisma first;
- type Pothos integration without broad suppression;
- generate GraphQL artifacts;
- reject unexplained public schema or operation drift;
- assert zero diff against stack base for `src/ops.ts`, `src/ops.schema.json`, `src/public/schema.graphql`, `src/public/client.json`, and `src/public/server.json`;
- assert `src/graphql/ops/**/*.graphql` remains unchanged;
- compile backend and worker consumers.

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

Commit: `fix(graphql): align Prisma types with TypeScript 6`

### Slice 6: Run omitted compiler and build surfaces

Check:

```bash
CI=true pnpm install --frozen-lockfile
pnpm run build
pnpm run check:all
pnpm run build:test
pnpm --filter @klicker-uzh/docs build:docs
pnpm --filter @klicker-uzh/office-addin build:office
pnpm --filter @klicker-uzh/office-addin validate:content
pnpm --filter @klicker-uzh/office-addin validate:taskpane
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
- explicit Docs, Office, Cypress, and Playwright compiler checks;
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
- [ ] Slice 0 plan committed alone.
- [ ] Slice 1 restack reviewed.
- [ ] Slices 2 through 7 implemented and committed.
- [ ] Slice 8 fresh verification passed.
- [ ] Slice 9 publish approval received.

Current: reviewed Slice 0 plan ready to commit.

Next: commit plan alone, rebuild plan-first branch on `bdc670190`, apply old TS commit without committing, and stop for diff classification review.
