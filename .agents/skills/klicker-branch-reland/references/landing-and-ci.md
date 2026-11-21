# Review, landing and CI

## Local verification per tip

- Node-only steps of `.github/workflows/check.yml` on the host with `node`.
- `pnpm install --frozen-lockfile`, then `pnpm run check:all` in the container.
- Unit and GraphQL suites on a reset database for any tip CI has not seen.
- Commit with a standalone `git -C <abs-path> commit -F <msgfile>`; the
  data-hygiene hook rejects compound shell forms. Docs-only commits pass the
  hooks without a running container.
- A degraded runtime still runs `devrouter exec`, but after a stop it may not
  restart. Finish container checks before stopping it.

## Reviews

- One independent final reviewer gets the diff and the plan, not your
  conclusions.
- `/final-review-stack` only runs on ready PRs, on the top PR of a stack
  rooted at `v3`. A provider budget error is not a verdict; the user decides
  whether another review stands in.
- Marking PRs ready restarts CI and adds SonarCloud and CodeQL. Disposition
  their findings in follow-ups; leave replayed commits unchanged.
- Defects found in replayed code that staging also ships go into follow-up
  draft PRs into the integration branch.

## Landing the stack

After explicit approval, merge the top PR with a merge commit at a pinned SHA:

```bash
gh api -X PUT repos/<owner>/<repo>/pulls/<top>/merge-async \
  -f merge_method=merge -f sha=<head-sha>
```

Poll `…/merge-async/<uuid>` until it finishes. "Required status check … is
failing" with green latest runs means a stale failed check run from a
cancelled duplicate on the same SHA: rerun that run, then retry.

After landing, verify:

- the integration branch tree equals the verified top tip;
- each executor pin's commit is an ancestor of the integration branch;
- authors are preserved;
- no source ancestry;
- push CI on the integration branch is green.

## Final PR

Open a draft PR from the integration branch into the target, landing with a
merge commit. Merging it stays withheld unless the user names it.
