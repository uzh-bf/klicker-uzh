# Replay and executor pins

## Reference tree S

1. `git merge-tree --write-tree <target> <source>` gives the clean merge and
   the conflicted paths.
2. For each conflicted path, take the resolution the staging source branch
   already ships (`gh variable get STG_SOURCE_BRANCH`) when that branch
   contains both sides; otherwise resolve by hand and record why in the plan.
3. Commit S on a scratch ref. Every later equivalence check compares against
   it.

## Picking commits

- List source commits with `git log --first-parent --reverse <target>..<source>`.
  Pick squash commits with `git cherry-pick -x <sha>`; the original author and
  date stay. Pick a merge commit with `-m 1` and compare its first-parent diff.
- Drop sync merges from the target, empty picks and commits whose content the
  target already has. List each dropped commit and its reason in the ledger.
- When a pick stops, resolve to S's version of the file, then add
  `Conflicts:` and, for removed paths, `Excluded:` lines to the message.
  `pnpm-lock.yaml` and deleted docs index files are always excluded.
- Each layer ends with one `chore(integration): …` commit under the
  integrator's name: regenerated lockfile plus every adaptation the layer
  needed, each listed in the message.

## Equivalence checks

Run these on every tip before each push:

1. Each pick's diff equals its source diff outside its `Conflicts:` files.
2. Each pick keeps the source author.
3. Migrations are byte-equal to the source.
4. The top tip equals S outside the declared adaptations.
5. No commit on the stack has source ancestry
   (`git merge-base --is-ancestor <source> <tip>` fails).

## Layer boundaries

Group commits by concern in historical order. When a layer tip is red because
a test arrives before its fix, move the boundary. Reorder only a commit whose
files are disjoint from what it jumps over, and record it in the plan.

## Priority executor pins

`.github/scripts/priority-ci-workflows.cjs` generates
`<name>-execution.yml` from each canonical workflow, and
`ci-event-gates.test.cjs` checks parity. When a layer changes a canonical
workflow:

1. Regenerate with `--write`, keep only the semantic changes, format with
   Prettier, and commit.
2. In a separate `ci:` commit, pin the caller's
   `…-execution.yml@<40-hex>` to the commit from step 1.
3. After any restack at or below that commit, redo step 2.

The pin names a stack commit, so the stack and the final PR land with merge
commits; squashing orphans the pin.

## Restacking

Rebuild from the published commits with `git cherry-pick`, never by reusing a
recorded tree. Compare `git range-diff <old-base>..<old-tip> <new-base>..<new-tip>`
and the tip trees with the previous publication, then `gh stack push`
(atomic, `--force-with-lease`).
