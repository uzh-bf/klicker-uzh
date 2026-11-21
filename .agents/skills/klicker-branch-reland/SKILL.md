---
name: klicker-branch-reland
description: Re-land a large, long-lived temporary `v3-*` branch into its promotion target (`v3-ai` or `v3`) as an author-preserving native stack on an integration branch, consolidating and simplifying on the way. Use when such a branch cannot merge directly (sync-ancestry guard, divergence, staging-only history), when it must be cleaned up before it reaches the main line, or when resuming or landing an earlier re-land.
---

# Re-land a temporary branch

A **re-land** replays the content of a source branch (for example `v3-audit`)
onto its target (for example `v3-ai`) without carrying the source's history.
The result is a GitHub native stack into a protected **integration branch**,
then one merge-commit PR from the integration branch into the target. Every
replayed commit keeps its original author and date; adaptations are separate
integrator commits.

Read [CI and deployment](../../../docs/ci-and-deployment.md) for the promotion
chain and the sync guard before starting. The stack mechanics belong to
`$rs-stacked-change` and `$gh-stack`; this skill adds the re-land specifics.

## Steps

1. **Plan and approve.** Write a plan in `project/` on the first layer's
   branch: source, target, staging reference (`gh variable get STG_SOURCE_BRANCH`,
   when it already resolves the conflicts), topology, layer list, approval cards, a
   `Progress` handover, a commit ledger and the withheld actions. Withhold
   merging the final PR, staging promotion, releases and branch deletion
   unless named. Done when the user approved the batch.
2. **Create the integration branch** at the target tip (`<source>-merge`),
   protected like `v3-*`, with no source ancestry. Never use `v3` or a `v3-*`
   branch as a PR head, and never press "Update branch".
3. **Build the reference tree S.** S is what the target looks like with all
   source content applied: `git merge-tree` of target and source, plus the
   staging branch's conflict resolutions, plus hand resolutions recorded in the
   plan. Done when every conflicted path has a recorded resolution.
4. **Replay into layers.** Cherry-pick each source squash commit with
   `git cherry-pick -x`, keeping author and date; use `-m 1` for merge sources.
   Drop sync merges and commits that are empty or superseded on the target.
   Regenerate `pnpm-lock.yaml` once per layer in a `chore(integration): …`
   commit under the integrator's name that lists every adaptation. Details:
   [replay and pins](references/replay-and-pins.md).
5. **Consolidate and simplify** only in integrator commits or in follow-up
   PRs into the integration branch. Replayed commits stay faithful to their
   source so the equivalence checks keep working.
6. **Verify every layer tip locally** before the first push: the node-only
   steps of `.github/workflows/check.yml`, `check:all` in the container and
   the unit and GraphQL suites on a reset database. Then check equivalence:
   the top tip equals S (and staging, where relevant) outside the declared
   adaptations. Done when every tip is green and the equivalence check passes.
7. **Publish** with `gh stack push` as drafts, bodies from
   `$rs-mr-description-writer`. Watch CI per layer, not only at the top.
8. **Review.** Give one independent final reviewer the code, not your
   conclusions. Defects in replayed code that staging shares go into
   follow-up draft PRs, not into the replay. Details:
   [landing and CI](references/landing-and-ci.md).
9. **Land the stack whole** with a merge commit on the top PR, after explicit
   approval. Then verify the integration branch (step 6 checks on the landed
   tree) and open the final draft PR from the integration branch into the
   target with a merge-commit landing.
10. **Close out.** Update the plan's `Progress` and ledger, list follow-ups,
    stop each touched runtime with `$rs-local-runtime-lifecycle`.

The re-land is complete when the stack has landed on the integration branch,
the landed tree matches the verified top tip, the final PR into the target is
open as a draft with green CI, and the plan names every follow-up.

## Rules that cost a rebuild when missed

- Every layer runs the full required CI on its own. A replayed history can be
  red mid-way (a test added in one commit, fixed several commits later). Move
  layer boundaries inside the historical order; reorder a commit only when it
  touches disjoint files, and record that in the plan.
- `check.yml` stops at its first failing step, so one red step hides the rest.
- A layer that changes a canonical workflow needs its priority-executor
  regenerated and pinned to a stack commit. Any restack below the pin breaks
  it, so the stack and the final PR land with merge commits.
- Restack by replaying diffs from the published commits, then compare
  `git range-diff` and tip trees with the previous publication before
  `gh stack push`.
- A first start of a new worktree needs `devrouter ensure --initialize-new`.
  Run `pnpm install --frozen-lockfile` in the container at each tip before
  committing or pushing, or the hooks fail.
