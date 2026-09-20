# Draft sync PR maintenance

## Approval summary

Maintain one open PR for each approved forward integration pair: `v3` to
`v3-ai`, and `v3-ai` to `v3-audit`. Every PR created by the controller is a
draft. Existing PRs retain their content and draft/ready state; their source
branches already keep the diff current. No other pairs are created.

The user approved implementation in solo mode. Approval mode: executable batch.
The main session owns implementation, focused verification, simplification,
and final self-review. Delivery ends with a pushed task branch and draft PR
targeting `v3`. Merge, branch-rule changes, method enforcement, automatic
merging, and deployment are outside this package.

The workflow runs trusted default-branch code after the existing Check codebase
push workflow completes for either source branch, regardless of its outcome.
Manual dispatch supports a read-only preview. The controller uses the ordinary
workflow token with contents read and pull requests write permissions. It never
executes source-branch code or writes branch refs. Drafts reduce some CI work;
they do not disable all checks. Workflow-token-created PR runs may need manual
approval, and normal source push CI continues.

## Execution details

Baseline: `origin/v3` at `02aaaa87b14c2d27db8ceb9a8e617ec5a5875fef`.
Task branch: `rs/draft-sync-prs`, repository-local worktree
`trees/rs/draft-sync-prs`.

One implementation slice adds `.github/workflows/maintain-draft-sync-prs.yml`,
`.github/scripts/draft-sync-prs.cjs`, and its `.test.cjs` file. Register the
tests in `.github/workflows/check.yml`. Update the existing sync-routing
paragraphs in `AGENTS.md` and the operational contract in
`docs/ci-and-deployment.md`; the branch topology and merge authority remain
unchanged.

The controller reads current refs and exact same-repository PR pairs. It skips
already integrated or empty diffs, preserves existing ready and draft PRs,
and recovers duplicate-creation races by rereading open PRs. Unexpected API
errors remain failures. Repository-wide concurrency serializes reconciliation;
each run handles both pairs, so coalesced events lose no branch coverage.

Verification uses synthetic API fixtures for pair scoping, draft creation,
idempotence, empty comparisons, concurrency races, rejected events, and errors.
Workflow contract checks cover permissions, trusted checkout, and event gates.
Use repository formatters, focused Node tests, staged secret scanning, and exact
diff inspection. No application runtime is needed for this CI-only change.
A read-only live API preview validates current pair selection. Actual hosted
creation remains post-merge proof because the controller lives on `v3`.

## Progress

- Plan recorded from the approved scope; implementation pending.
- Execution mode: solo. Final simplification and review will be self-performed.
