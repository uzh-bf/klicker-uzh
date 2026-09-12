# Review — PR #5140: agent-readiness CI restructure (WS1/WS2)

- **Date:** 2026-07-07
- **Reviewed state:** branch `agent-readiness` @ `a0cbbd9a1` (draft PR, CI red)
- **Review method:** full diff read, live CI-log analysis of the failed run, local reproduction of the failing checks (uvx ruff, `util/check-prisma-sync.sh`, turbo task-graph trace), `gh api` verification of branch protection and CODEOWNERS handles, v3 Playwright history audit. Every finding carries the evidence that was actually checked.

## Verdict

**Right direction, good architecture — but the branch's own CI is red for three distinct, fully-diagnosed reasons, and one of them is currently invisible (masked by another).** All three are small fixes. The PR also renames every required status check, so merging without the branch-protection migration below would leave `v3` either unprotected or permanently blocked. Fix order and exact commands are at the end.

The irony worth internalizing: a PR whose thesis is "make checks reproducible for agents" fails CI because three of its checks only worked on the author's machine (locally-installed `uv`, locally-built prisma client, locally-synced analytics schema). That is the exact failure class the PR is meant to eliminate — each fix below also closes the class, not just the instance.

---

## Blockers — why CI is red (all verified, with fixes)

### B1 — `check-lint` fails: `uv` is not installed on the runner

CI log (check-lint job): `sh: 1: uv: not found` — `@klicker-uzh/analytics#lint` now runs `uv run ruff check . && uv run ruff format --check .` ([apps/analytics/package.json](../apps/analytics/package.json)), but [check-lint.yml](../.github/workflows/check-lint.yml) never installs uv. It worked locally because uv is on the author's PATH.

**Fix** — add to `check-lint.yml` after the pnpm setup, gated like the other steps:

```yaml
- name: Set up uv
  if: steps.filter.outputs.should_run == 'true'
  uses: astral-sh/setup-uv@v5
  with:
    python-version: '3.12'
```

Ruff itself passes: verified with `uvx ruff@0.15.18 check apps/analytics` and `format --check` on this branch — both clean. So this one step should turn the ruff part green.

### B2 — `check-types` fails: change-scoped build starves `prisma#check` of the generated client

CI log (check-types job): `@klicker-uzh/prisma#check` fails with `TS2307: Cannot find module '.prisma/client'`-class errors. Root cause is a filter mismatch in [check-types.yml](../.github/workflows/check-types.yml):

- Build step (line 45) is **scoped**: `turbo run build --filter="...[origin/${{ github.base_ref }}...HEAD]"` — on a CI-only PR like this one, `@klicker-uzh/prisma` is not in the changed set, so `prisma generate` (part of its `build`) never runs.
- Check step (line 54) is **unscoped**: `pnpm run check` typechecks *everything*, including `prisma#check` (`tsc --noEmit`), which imports the never-generated client.
- `turbo.json` cannot save it: the `check` task has `dependsOn: ["^build"]` — *dependencies'* builds only, never the package's **own** build.

**Fix (two parts, do both):**

1. Scope the check step with the *identical* filter as the build step:

```yaml
if [ "${{ github.event_name }}" = "pull_request" ]; then
  pnpm exec turbo run check --filter="...[origin/${{ github.base_ref }}...HEAD]"
else
  pnpm exec turbo run check --filter="...[HEAD~1...HEAD]"
fi
```

2. Add a package-scoped override in `turbo.json` so `prisma#check` always generates its own client first — this also fixes `pnpm run check` on any fresh local clone:

```json
"@klicker-uzh/prisma#check": { "dependsOn": ["build"] }
```

Note the scoping decision itself is sound (that's the point of the PR); only the asymmetry between the two steps is the bug.

### B3 — `check:prisma-sync` can never pass in CI (latent — currently masked by B1)

[check-lint.yml](../.github/workflows/check-lint.yml) runs `pnpm run check:prisma-sync` as a step *after* the lint step, so it has never executed in CI yet (lint fails first). Once B1 is fixed, this will be the next red. Verified by running it directly on a clean checkout of this branch:

```
$ bash util/check-prisma-sync.sh   # exit 1
Only in tmp.../schema: account.prisma  (…and every other schema file)
```

Root cause: [util/check-prisma-sync.sh](../util/check-prisma-sync.sh) syncs into a temp dir and diffs against `apps/analytics/prisma/schema/` — but [apps/analytics/.gitignore](../apps/analytics/.gitignore) line 1 ignores `prisma/schema/**` (only `py.prisma` is force-tracked; confirmed via `git ls-tree origin/v3` and `git check-ignore -v`). A fresh checkout therefore *always* shows "drift". It passed on the author's machine only because `prisma:sync` had been run there.

**Fix — decide one:**

- *Recommended:* commit the mirrored schema files (remove/narrow the `.gitignore` rule, run `pnpm run prisma:sync`, commit the result). Then the check does what its name claims: catch PRs that edit `packages/prisma` without re-syncing analytics.
- *Alternative:* drop the CI step (and the script) — a drift check against generated, untracked files is conceptually void.

Do **not** "fix" it by having CI run `prisma:sync` before the check — that makes the check tautologically green.

---

## Major

### M1 — Branch-protection migration is mandatory at merge time (owner action)

Current `v3` required contexts (verified via `gh api repos/uzh-bf/klicker-uzh/branches/v3/protection`): `cypress-run, format, lint, build, test, check` (strict = true). This PR renames/splits most of them, so after merge those contexts are never reported again and **every subsequent PR blocks forever** on dangling checks.

| Current required | After this PR |
| --- | --- |
| `format` | `check-format` |
| `lint` | `check-lint` |
| `check` | `check-syncpack`, `check-types` |
| `test` | `test-util`, `test-grading`, `test-olat-api`, `test-graphql-status` |
| `build` | `build` (unchanged) |
| `cypress-run` | keep — but audit whether the job is `cypress-run` or `cypress-run-cloud` on this branch |
| — (new) | `test-playwright-status` (only after M4 is resolved) |

Use the `-status` gate jobs (not the sharded/filtered jobs) as required contexts — that is exactly what they were built for. Update in the same breath as the merge:

```bash
gh api -X PATCH repos/uzh-bf/klicker-uzh/branches/v3/protection/required_status_checks \
  -f strict=true \
  -f 'contexts[]=build' -f 'contexts[]=check-format' -f 'contexts[]=check-lint' \
  -f 'contexts[]=check-syncpack' -f 'contexts[]=check-types' \
  -f 'contexts[]=test-util' -f 'contexts[]=test-grading' -f 'contexts[]=test-olat-api' \
  -f 'contexts[]=test-graphql-status' -f 'contexts[]=cypress-run'
```

### M2 — `-status` gate jobs report green when the filter job itself fails

In [test-playwright.yml](../.github/workflows/test-playwright.yml) and [test-graphql.yml](../.github/workflows/test-graphql.yml), the gate does:

```bash
if [ "${{ needs.filter.outputs.should_run }}" \!= "true" ]; then exit 0; fi
```

If the `filter` job *errors* (not skips), its output is empty → the gate exits 0 → a required check goes green while the tests never ran. Since these gates are the future required contexts (M1), harden them:

```bash
if [ "${{ needs.filter.result }}" != "success" ]; then exit 1; fi
if [ "${{ needs.filter.outputs.should_run }}" != "true" ]; then exit 0; fi
if [ "${{ needs.test-playwright.result }}" != "success" ]; then exit 1; fi
```

(Also drop the escaped `\!=` — it works in bash but is a shell-history artifact that will confuse the next reader.)

### M3 — Node is unpinned in most workflows

Repo pins `engines.node "=24"` / volta `24.16.0`, but only the cypress and playwright workflows set up Node 24 — the other jobs run whatever the `ubuntu-latest` image ships (currently v22), so CI typechecks/builds on a Node major the repo forbids. Add to each remaining workflow (check-format, check-lint, check-syncpack, check-types, test-util, test-grading, test-olat-api, test-graphql, build), before pnpm setup:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version-file: package.json
```

(`node-version-file` reads the volta/engines pin — no second place to keep in sync.)

### M4 — Playwright is red on `v3` itself, not because of this PR's resharding

The failing word-cloud spec (`O-live-quiz.spec.ts`, evaluation word-cloud assertion) fails deterministically **on v3** — verified in v3 runs 28525335172 and 28403600482, red since the wordcloud replacement merged on 2026-06-26 ([#4947](https://github.com/uzh-bf/klicker-uzh/pull/4947)). This PR's shard-3 failure is the same pre-existing test. Two consequences:

1. Don't burn time "debugging the reshard" — 5→8 shards is not the cause.
2. `test-playwright-status` must **not** become a required context until the test is fixed or quarantined (`test.fixme()` with a linked issue/ClickUp task). To reproduce locally: `pnpm exec playwright test -g "word cloud"` against the dev:test stack; start at the evaluation-link helper (~line 188) and the post-#4947 rendering (user-input filtering changed what appears in the cloud).

### M5 — CODEOWNERS points at a nonexistent user

Every entry in [.github/CODEOWNERS](../.github/CODEOWNERS) is `@rolandschlaefli` — that GitHub user does not exist (`gh api users/rolandschlaefli` → 404; the real login is `rschlaefli`). GitHub silently ignores invalid owners, so the file is currently a no-op. Fix the handle, then confirm in GitHub UI → repo → the CODEOWNERS file view, which lists syntax/owner errors inline.

---

## Minor

- **Multi-commit pushes under-trigger the filter.** On `push`, [changed-paths](../.github/actions/changed-paths/action.yml) diffs `HEAD^ HEAD` — only the last commit of a multi-commit push is inspected. Acceptable for a squash-merge repo (v3 gets one commit per PR); add a comment in the action stating that assumption so nobody "fixes" it blind, or diff `${{ github.event.before }}..HEAD` if direct multi-commit pushes ever matter.
- **`test-graphql.yml` / `test-playwright.yml` `pull_request` triggers lack `branches:` filters** that the other workflows have — harmless but inconsistent; align them.
- **`check-format.yml` has no path filter at all** (every other check does). Prettier repo-wide is cheap, so this is optional — but note it means *any* PR (including docs-only, including the file you are reading) runs it; keep the repo prettier-clean.
- **`check:agents-md` is warn-only** (`|| true`-style, always exit 0) — fine as a first step, but a check that cannot fail is noise; set a date to graduate it to failing, per the plan's own WS staging.
- **False alarm to ignore:** an earlier automated review claimed the changed-paths action's `origin/$BASE_REF` diff "never resolves on a shallow clone, so filtering is dead code on PRs." This is **refuted by the live CI log** of this PR's own run: the action prints `* [new branch] v3 -> origin/v3` followed by the full `Files changed:` listing — `git fetch --depth=1 origin "$BASE_REF"` works exactly as designed, and the fail-open guard covers the residual cases. Do not restructure the action over that claim.

## What is genuinely good (keep)

- The split into small single-purpose workflows with a shared `changed-paths` composite is the right shape: fast feedback, cheap re-runs, honest names (`check-*` vs `test-*`).
- Fail-open filtering ("if the diff can't be computed, run") is the correct default for required checks.
- The `-status` gate pattern is the correct answer to "required check + conditional job" — it just needs the M2 hardening.
- [dependabot.yml](../.github/dependabot.yml) is well-configured: valid `cooldown` syntax (14 days, matching pnpm's `minimumReleaseAge`), minors/patches grouped, majors excluded.
- The plan file ([project/2026-07-06-agent-readiness-improvement-plan.md](2026-07-06-agent-readiness-improvement-plan.md)) staging WS1→WS5 is realistic; this review only re-orders items inside WS1/WS2.

---

## Ordered path to done (junior-executable)

1. **B1**: add the `setup-uv` step to `check-lint.yml`. Push, confirm the ruff part of check-lint passes.
2. **B3**: same PR — commit the analytics schema mirror (or delete the check; decide with the team first). Confirm the `check:prisma-sync` step passes on the rerun.
3. **B2**: scope the check step in `check-types.yml` + add the `prisma#check` turbo override. Confirm check-types green.
4. **M2 + minors**: harden the two `-status` gates, remove `\!=`, align `branches:` filters. **M3**: add `setup-node` to the remaining workflows. **M5**: fix the CODEOWNERS handle.
5. **Validate the filters with two throwaway PRs**: (a) docs-only change → heavy jobs must skip, `-status` gates must still report success; (b) a `packages/graphql` change → test-graphql must run. This is the acceptance test for the whole restructure.
6. Mark ready for review; at merge time, apply the **M1** branch-protection PATCH in the same sitting.
7. **After merge (WS3)**: fix or quarantine the word-cloud Playwright test (M4), then add `test-playwright-status` to required contexts. Set a graduation date for `check:agents-md`.

## Re-review checklist for the next push

- [ ] check-lint green (uv installed; prisma-sync step passes on clean checkout)
- [ ] check-types green (scoped check + prisma override)
- [ ] `-status` gates fail when their filter job fails (M2 patch present)
- [ ] All workflows pin Node via `node-version-file`
- [ ] CODEOWNERS shows no errors in GitHub UI
- [ ] Two validation PRs behave as predicted (skip + run)
- [ ] Branch-protection migration command staged for merge day
