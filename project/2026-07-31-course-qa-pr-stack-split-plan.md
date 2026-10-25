# Course Q&A — Split PR #5072 Into A Reviewable Stack

## Plan Identity

- Plan path: `project/2026-07-31-course-qa-pr-stack-split-plan.md`
- Source of truth: `course-qa-synced` — `origin/course-qa` (`5f6aff97f5`, head of PR #5072, fully green CI) merged with current `origin/v3` (`7812fa71ce`). See the 2026-07-31 Progress entry for why extracting from `origin/course-qa` directly is unsafe.
- Target branch for the whole stack: `v3`
- The stack, all opened as drafts on 2026-07-31:
  - [#5262](https://github.com/uzh-bf/klicker-uzh/pull/5262) — `course-qa-proxy-trust` → `v3`
  - [#5263](https://github.com/uzh-bf/klicker-uzh/pull/5263) — `course-qa-api` → `course-qa-proxy-trust`
  - [#5264](https://github.com/uzh-bf/klicker-uzh/pull/5264) — `course-qa-ui` → `course-qa-api`
- Existing PR: [#5072](https://github.com/uzh-bf/klicker-uzh/pull/5072) — stays a **draft**, is never merged
- Predecessor plan (history, ships inside PR A): `project/2026-06-01-pr-5072-integrated-course-qa-plan.md`
- Multi-phase epic under one shared plan: this file lands with the **first** PR of the stack; each later PR commits its own `Progress` update to this same file.

## Goal

- Split one 111-file / +18,061 / −1,316 draft PR into a stack of small, independently reviewable PRs so the outstanding blocker — review — can actually happen.
- Preserve the proven-green tree exactly. The union of the stack must be byte-identical to `5f6aff97f5`.
- Get the highest-risk-per-line change (global proxy trust + production ingress config) reviewed on its own instead of buried in an 18k-line diff.

## Non-Goals

- No behavior changes, no refactors, no review-feedback fixes while splitting. Splitting and fixing in one pass destroys the ability to prove the split is lossless.
- No merge of PR #5072 itself, and no marking it ready.
- No new feature work, no answered/pinned triage, no per-token embed revocation.
- Not re-litigating settled design decisions (ADR 0001, ADR 0002).

## Evidence

- `Evidence:` Feature is dark by default. The migration adds `isCourseQARolloutEnabled BOOLEAN NOT NULL DEFAULT false` (plus two sibling flags, same default). No production seed or migration sets any of them true. Therefore schema + API can land on `v3` with zero user-visible effect.
- `Evidence:` Migration `20260415011800_course_qa_alpha` is non-destructive: 7 `CREATE TABLE`, 11 `CREATE INDEX`, 2 `CREATE UNIQUE INDEX`, 3 added nullable-safe columns with defaults, **0** drops/renames/type changes.
- `Evidence:` The branch has **no deleted files and no renames** — every one of the 111 entries is an add or a modify. This is what makes a path-based partition safe.
- `Evidence:` `packages/graphql` depends on `@klicker-uzh/types` and imports `courseDiscussionScope` in three discussion service files, so `packages/types` **must** ship with the API, not the UI.
- `Evidence:` `packages/graphql` imports neither `@klicker-uzh/shared-components` nor `@klicker-uzh/i18n`, so both belong with the UI.
- `Evidence:` `apps/backend-docker/src/requestAddress.ts` only sets `trust proxy` on the Express app; `packages/graphql` does not import it. It is a runtime prerequisite for correct anonymous rate-limit fingerprints, not a compile-time one.
- `Evidence:` The paired production change is a `haproxy.org/forwarded-for` ingress annotation on the `backendGraphql` ingress in both `env-uzh-prd` and `env-uzh-stg`. Ingress + `trust proxy` + tests form one coherent unit.
- `Evidence:` `.github/workflows/test-graphql.yml` adds only `APP_SECRET: test-app-secret`, required by the discussion test suite — so that one line belongs with the API PR, not with the proxy PR.
- `Evidence:` Playwright's `global-setup.ts` does **not** enable the Q&A flags; each Q&A spec calls `setCourseQAFlags()` itself. Only `cypress.config.ts` enables them suite-wide.
- `Evidence:` `.github/workflows/cypress-testing.yml` is `on: workflow_dispatch` only. The Cypress seed change therefore has no automatic CI blast radius.
- `Evidence:` Changes to existing GraphQL ops and to `packages/graphql/src/index.ts` / `packages/types/src/index.ts` are purely additive (added exports, added fields). Nothing is removed from the public surface, so `v3` frontends still typecheck against the API PR alone.
- `Evidence:` `deleteParticipantAccount` in `services/accounts.ts` is rewritten to run inside a transaction and to call `reconcileParticipantDiscussionVotesBeforeDeletion`. This is the one **non-additive change to an existing production path** in the whole branch.
- `Assumption (to be proven, not asserted):` `v3` + API PR compiles and passes CI standalone. The reasoning above supports it; the plan gates on actually running the checks, not on the reasoning.

## Decisions

| ID | Decision | Why |
| --- | --- | --- |
| D1 | Split into **three** PRs, stacked: proxy trust → API → UI+E2E | Each unit is coherent and independently reviewable; three review cycles instead of four keeps maintainer coordination cost down |
| D2 | Isolate the proxy-trust change as its own first PR | 9 files / 175 lines, but it changes global Express request handling **and** production ingress config — the highest risk-per-line content on the branch, and the easiest to lose inside a large diff |
| D3 | Keep E2E with the UI it covers rather than in a fourth PR | Splitting tests from their subject leaves the UI on `v3` with no automated coverage, and the E2E diff has little independent review value |
| D4 | `packages/types` ships with the API | `packages/graphql` depends on it and imports from it — the API PR would not compile otherwise |
| D5 | `packages/prisma-data` dev-seed enablement ships with the UI | Keeps the API PR fully dark: no enablement anywhere, including dev seeds, so "this PR changes nothing observable" stays literally true |
| D6 | Build each branch as one squashed commit by path from `5f6aff97f5`, not by cherry-picking | The 147 commits are thematically interleaved; no commit subset maps to a layer. Path-based extraction from a known-green tree is the only lossless option |
| D7 | PR #5072 stays open as a draft reference until the stack lands, then is **closed, not merged** | It carries the full evidence trail and green CI; the stack reproduces its tree exactly |
| D8 | No content changes during the split | The empty-diff invariant (C1) is the entire safety argument and only holds if nothing is edited |
| D9 | **Hold all three PRs and merge them together, bottom-up, in one window** | User ruling, 2026-07-31. Nothing unused reaches production, and the schema never lands without its consumers |
| D10 | Targeted review gates: security on 0 and A; maintainability on A and B; branch crosscheck on B | User ruling, 2026-07-31. Running all four gates on all three PRs would spend most of the benefit the split creates |

### Consequence of D9

The split's value is now **review tractability only**, not incremental production de-risking. Because all three merge in one window, the production risk profile is identical to merging PR #5072 as-is. This is a deliberate trade: the blocker was never rollout risk, it was that nobody could review an 18k-line diff. Two things follow:

- The stack must be kept rebased on `v3` for as long as review takes, since none of it lands early to reduce drift.
- PR A's "compiles standalone against `v3`" gate stays mandatory even though A never sits on `v3` alone. It is what proves the layers are genuinely separable, which is what makes per-layer review meaningful.

## The Stack

| PR | Branch | Base | Files | Diff | Title |
| --- | --- | --- | --- | --- | --- |
| 0 | `course-qa-proxy-trust` | `v3` | 9 | +175 / −3 | `chore(apps/backend-docker): derive client addresses from the ingress forwarded-for header` |
| A | `course-qa-api` | `course-qa-proxy-trust` | 70 | +12,959 / −501 | `feat(packages/graphql): add course discussion schema, API, and persistence` |
| B | `course-qa-ui` | `course-qa-api` | 22 + 10 | +4,927 / −812 | `feat: surface course Q&A in the student PWA and lecturer manage app` |

Totals: 111 files, +18,061 / −1,316 — identical to `git diff --shortstat origin/v3...5f6aff97f5`. The partition is exhaustive and non-overlapping; both counts reconcile exactly.

PR A looks large at 12,959 insertions, but the reviewable payload is far smaller:

| Content | Files | Insertions | Review effort |
| --- | --- | --- | --- |
| Generated codegen artifacts (`ops.ts`, `ops.schema.json`, `public/*`) | 5 | 3,113 | Mechanical — verify by regenerating |
| GraphQL integration tests | 9 | 3,755 | Read as specification |
| ADRs, feature docs, historical plans | 9 | 1,891 | Prose |
| Handwritten API, Prisma schema, types | 47 | 4,200 | **The actual review** |

## File Partition

Every path below was classified programmatically; the classifier reported zero unclassified files.

| PR | Paths |
| --- | --- |
| 0 | `apps/backend-docker/**`, `deploy/**`, `.github/workflows/test-backend-docker.yml`, `.github/workflows/test-helm.yml` |
| A | `packages/prisma/**`, `apps/analytics/**`, `packages/types/**`, `packages/graphql/**`, `docs/**`, `project/**`, `.github/workflows/test-graphql.yml` |
| B | `apps/frontend-pwa/**`, `apps/frontend-manage/**`, `packages/i18n/**`, `packages/shared-components/**`, `packages/prisma-data/**`, `playwright/**`, `cypress/**` |

Note for B's reviewer: `playwright/util/constants.ts` is **not** a Course Q&A change. It makes every Playwright origin environment-overridable so the suite can run against a linked worktree instead of only the primary checkout. It is carried here because it is test infrastructure, not because it belongs to the feature.

## Construction Method

- `Problem:` The 147 commits interleave schema, API, UI, and tests. No contiguous or cherry-picked subset yields a layer-clean split.
- `Decision:` Extract by path from the known-green tree. Each branch gets exactly one squashed commit.
- `Do:` Work in a dedicated worktree at `trees/course-qa-split` (confirmed gitignored at `.gitignore:36`). Do not disturb the existing `course-qa-takeover` worktree, its branch, or `stash@{2}`.

Step one is the sync, and it is not optional — see the Progress entry on `accounts.ts`.

```bash
git fetch origin v3 course-qa
git worktree add --no-track -b course-qa-synced trees/course-qa-split origin/course-qa
cd trees/course-qa-split
git merge origin/v3 --no-edit          # must be conflict-free; stop and resolve if not

git checkout -b course-qa-proxy-trust origin/v3
git checkout course-qa-synced -- apps/backend-docker deploy \
  .github/workflows/test-backend-docker.yml .github/workflows/test-helm.yml
git commit -m "chore(apps/backend-docker): derive client addresses from the ingress forwarded-for header"

git checkout -b course-qa-api
git checkout course-qa-synced -- packages/prisma apps/analytics packages/types \
  packages/graphql docs project .github/workflows/test-graphql.yml
git commit -m "feat(packages/graphql): add course discussion schema, API, and persistence"

git checkout -b course-qa-ui
git checkout course-qa-synced -- apps/frontend-pwa apps/frontend-manage packages/i18n \
  packages/shared-components packages/prisma-data playwright cypress
git commit -m "feat: surface course Q&A in the student PWA and lecturer manage app"
```

`git worktree add` needs `--no-track` and a sandbox exemption in this environment: writing `.git/config` and creating files under `apps/frontend-pwa/android/.idea/` are both denied by default.

### Safety Invariant

- `Check (C1):` `git diff course-qa-synced course-qa-ui` must print **nothing**, excluding this plan file (which exists only in the stack). The strongest form is comparing root tree hashes directly — they must be equal.
- `Evidence:` C1 passed on 2026-07-31. Both trees resolved to `62a978d8a11de5e368a3d869b78799896c75e16f` before the plan commit was added.
- `Risk:` If C1 is non-empty, a path was missed. Do not hand-patch the difference — re-derive the partition, rebuild the branches, and re-check. Hand-patching breaks the "identical to a green tree" guarantee that justifies inheriting #5072's evidence.

## Verification Gates

Each PR must pass its own gate before the next is opened for review. The stack's value is destroyed if a broken intermediate reaches `v3`.

| PR | Gate |
| --- | --- |
| 0 | `pnpm --filter @klicker-uzh/backend-docker test`; CI `test-backend-docker` and `test-helm` green; manual read of the ingress annotation against the HAProxy ingress controller's documented behavior |
| A | `pnpm run check` clean across **all** packages — this is the load-bearing check that `v3` frontends still compile against the new API alone; codegen reproduces the committed artifacts with no diff; `test-graphql` green (35/35 discussion suite); migration applies to a fresh database |
| B | Full CI including all 8 Playwright shards; the four Course Q&A specs green; browser verification per the repo's `agent-browser` requirement, with before/after captures at desktop and mobile |

`Check:` For A, run codegen and confirm `git status` is clean afterwards. A dirty tree means the committed generated artifacts do not match their sources.

## Risks

| Risk | Mitigation |
| --- | --- |
| PR 0 changes `trust proxy` globally, affecting every request path, not just Q&A. Wrong hop count enables `X-Forwarded-For` spoofing | Isolated PR; explicit security review; hop count is `1`, matching the single documented ingress |
| PR A rewrites `deleteParticipantAccount`, a live production path unrelated to Q&A for existing users | Call it out explicitly in A's review focus; it is the only non-additive change to existing behavior in the stack |
| Merging all three in one window (D9) means the production risk profile equals that of merging #5072 whole | Accepted by ruling. Mitigated by per-layer review, which is the actual goal, and by each PR carrying its own green CI |
| `v3` moves under the stack during review — the dominant risk under D9, since nothing lands early to shorten the exposure | Rebase the whole stack bottom-up on a schedule, not reactively. After every rebase, re-extract the reference tree and re-run C1; never assume the previous extraction still applies |
| Merge window must be ordered and short | Merge strictly `course-qa-proxy-trust` → `course-qa-api` → `course-qa-ui`. Confirm GitHub retargeted each remaining PR after its base merges rather than assuming it did |
| Three long-lived stacked branches invite drift between them | Only ever rebuild the stack from the bottom; never cherry-pick a fix into a middle branch |
| Reusing #5072's CI evidence for the stack | Not relied upon. Each PR runs full CI in its own right; #5072's green run only supports the claim that the *union* is sound |

## Review Gate Routing (D10)

| PR | Security | Maintainability | Branch crosscheck |
| --- | --- | --- | --- |
| 0 `course-qa-proxy-trust` | Yes — global trust-proxy hop count and ingress forwarded-for handling | No | No |
| A `course-qa-api` | Yes — authorization, embed token scope binding, rate-limit fingerprints, rewritten account deletion | Yes | No |
| B `course-qa-ui` | No | Yes | Yes |

This also discharges the four gates that were waived on `5f6aff97f5`, including the three unverified greptile security findings, which fall inside PR A's scope.

## Open Decision

| Question | Recommendation |
| --- | --- |
| Is PR #5072 closed rather than merged once the stack lands? | Close it, with a comment pointing at the three replacement PRs. It stays a draft reference until then. Confirm at merge time — nothing in the plan depends on the answer before that point |

## Progress

- 2026-07-31 — Plan drafted. Partition verified programmatically: 111 files, +18,061 / −1,316, reconciling exactly to `origin/v3...5f6aff97f5`, zero unclassified paths. Dependency direction confirmed (`types` → API; `i18n` and `shared-components` → UI).
- 2026-07-31 — User rulings recorded: three-PR stack with E2E kept alongside the UI; all three held and merged together bottom-up (D9); targeted review gates (D10).
- 2026-07-31 — **`v3` moved during planning and required a sync.** `origin/v3` advanced to `7812fa71ce` (`fix(frontend-pwa): remove unverified LTI 1.1 login path`, #5260), which modifies `packages/graphql/src/services/accounts.ts` — a file `course-qa` also modifies. Extracting that file wholesale from `course-qa` would have silently reverted an unverified-login-path removal. Resolved by creating reference branch `course-qa-synced` (`origin/course-qa` merged with `origin/v3`); the merge was clean and `accounts.ts` auto-merged both changes, which occupy different regions. **All extraction is from `course-qa-synced`, never from `origin/course-qa` directly.**
- 2026-07-31 — Partition re-verified against the synced reference: still 111 files, +18,061 / −1,316, all adds/modifies, zero deletions or renames, zero unclassified paths.
- 2026-07-31 — **Three branches built and invariant C1 passes at tree-hash level.** `course-qa-synced` and `course-qa-ui` both resolve to tree `62a978d8a11de5e368a3d869b78799896c75e16f`, proving the split is byte-for-byte lossless. Per-PR sizes match prediction exactly: 9 / +175 −3, 70 / +12,959 −501, 32 / +4,927 −812.
- 2026-07-31 — **PR A verified standalone against `v3`, which was the load-bearing assumption.** On branch `course-qa-api`: `pnpm run build` 22/22 tasks in 1m19.8s, then `pnpm run check` 25/25 tasks in 16.5s. All 25 packages typecheck — including every frontend still at `v3` state — proving the API layer genuinely stands alone and the layering is real rather than asserted.
- 2026-07-31 — Codegen reproducibility confirmed: the build regenerated `ops.ts`, `ops.schema.json`, `public/*` and the Prisma client, after which `git status --untracked-files=no` was empty. The committed generated artifacts reproduce exactly.
- 2026-07-31 — `pnpm run check` alone is **not** a sufficient gate in this repo. Turbo's `check` task declares `dependsOn: ["^build"]`, but the root script passes `--parallel`, which disables dependency ordering; running it on a fresh worktree fails 21/25 tasks with `Cannot find module '@klicker-uzh/graphql/dist/ops'`. Always build first.
- 2026-07-31 — `Caveat:` pnpm subprocesses resolve Node `v22.23.0` on this host even though the login shell and the Volta pin are `24.16.0`, so every local task logged an unsupported-engine warning. Build and check both passed regardless, but CI on Node 24 remains the authoritative signal.
- 2026-07-31 — The local full build succeeded where this session's earlier containerised build failed in `packages/export` and `apps/olat-api`, confirming those rollup parse errors were a container-filesystem artifact, not a branch defect.
- 2026-07-31 — **Top of stack (`course-qa-ui`, the full feature) also verified:** `pnpm run build` 22/22, `pnpm run check` 25/25, generated artifacts reproduce exactly. Both the isolated API layer and the complete stack compile cleanly.
- 2026-07-31 — `Lesson:` amending the plan commit and rebasing the stack **breaks it** — the downstream branches still carry the old plan commit and conflict against the amended one, leaving an interactive rebase stranded mid-flight and reporting misleading per-PR sizes. Rebuild `course-qa-api` and `course-qa-ui` by re-extracting paths from `course-qa-synced` instead of replaying history. The extraction is deterministic, so the rebuilt branches are identical apart from the intended plan change.
- 2026-07-31 — The husky pre-commit gate ran in full during that amend and passed: 25/25 typecheck, 7/7 lint, Prettier, Syncpack all valid, Prisma schemas in sync, AGENTS.md zero warnings.
- 2026-07-31 — Nothing pushed. Worktree `trees/course-qa-split`; branches `course-qa-proxy-trust`, `course-qa-api`, `course-qa-ui`, plus reference branch `course-qa-synced`. None exist on `origin`, so there are no name collisions. PR #5072 verified still `OPEN`, draft, `course-qa` → `v3`, untouched; `stash@{2}` untouched.

## Next Steps

1. Run the review gates per the routing table above — this is the whole point of the split and the remaining blocker inherited from #5072.
2. Attach current desktop and mobile screenshots to [#5264](https://github.com/uzh-bf/klicker-uzh/pull/5264) through the web UI; `gh` cannot attach images.
3. Resolve or explicitly accept the `upvotes` / `replyCount` counter question on [#5263](https://github.com/uzh-bf/klicker-uzh/pull/5263).
4. Keep the stack rebased on `v3` while review runs; re-verify C1 after every rebase, rebuilding by path extraction rather than replaying history.
5. Merge bottom-up in one window once all three are approved: [#5262](https://github.com/uzh-bf/klicker-uzh/pull/5262), then [#5263](https://github.com/uzh-bf/klicker-uzh/pull/5263), then [#5264](https://github.com/uzh-bf/klicker-uzh/pull/5264). Confirm GitHub retargeted each remaining PR after its base merged.
6. Close [#5072](https://github.com/uzh-bf/klicker-uzh/pull/5072) rather than merging it, with a comment pointing at the stack. Leave it untouched and draft until then.
7. Clean up the `trees/course-qa-split` worktree and the `course-qa-synced` reference branch once the stack has merged — not before, since re-verification needs them.
