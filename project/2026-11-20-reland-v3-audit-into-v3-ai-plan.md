# Re-land the assessment audit line onto v3-ai

## Approval summary

**Why and what changes?** The `v3-audit` branch holds two pieces of work: the
assessment audit evidence system and the Pino server-logging stack. It cannot
be merged into `v3-ai`, because the sync-ancestry guard rejects any `v3-ai`
change whose history contains the audit line.

We rebuild that work as one GitHub native stack on a new integration branch,
`v3-audit-merge`, which is created at today's `v3-ai` tip and has no
`v3-audit` ancestry. The stack lands there first. One final pull request then
merges `v3-audit-merge` into `v3-ai` with a merge commit.

- The final merge can wait. `v3-ai` releases continue meanwhile, and the
  audit migrations reach production only when the user chooses.
- The complete result can run on staging before `v3-ai` changes, by merging
  the integration branch into `v3-adaptive-learning`.
- The final pull request targets `v3-ai`, so all eight required checks run on
  the complete tree.

The stack keeps the original authors' commits:

- Each source pull request is replayed as one commit with its original author
  and date (`git cherry-pick -x`). The audit line has 106 first-parent
  commits; 34 are replayed and 72 are dropped as integration merges, empty
  commits or changes that `v3-ai` already contains.
- Everything needed to make that history work on today's `v3-ai` sits in
  separate commits under the integrator's name.
- The stack lands on `v3-audit-merge` with merge commits, and so does the
  final pull request into `v3-ai`. This is an exception to the usual squash
  convention. A squash would collapse each layer into one commit by the pull
  request opener.

The final tree still equals the code that staging runs, apart from a recorded
list of judgment calls. A small PR into `v3` separately retires the
`v3-ai → v3-audit` sync pair.

**What stays unchanged?** Assessment audit stays off in production:

- The rollout defaults to `disabled` when unset.
- `v3`, which supplies the production manifests, has no audit configuration
  or workloads.

The three audit migrations stay byte-identical, because staging has already
applied them. `v3-adaptive-learning` remains the staging source.

**What could change the decision?**

- **Production release.** Production images are built from `v3-ai` release
  tags. After landing, the next release ships the three migrations (including
  a non-transactional unique index build on `LiveQuizResponse`), Pino logging
  in every server app and the new assessment response pipeline, even with
  audit off. That release needs its own checklist (Later, item 1).
- **Authorship on `v3`.** `v3` accepts squash merges only and requires linear
  history. A later `v3-ai → v3` promotion therefore collapses these commits
  like all other `v3-ai` work. Per-commit authorship lives on `v3-ai`, which is
  where releases are cut.
- **Simplification.** Any code change breaks the equality with staging's
  tree. Code simplification therefore starts only after the faithful stack has
  landed on `v3-audit-merge` and is recorded as the equivalence checkpoint
  (Card 3).
- **A second long-lived branch.** `v3-audit` became hard to merge because it
  lived long and diverged. `v3-audit-merge` avoids the ancestry problem, but it
  still drifts from `v3-ai` while the final merge waits. Each catch-up merge
  from `v3-ai` re-runs the checks.
- **Staging already runs this code.** The final tree equals adaptive-learning's
  audit code by design. Merging the integration branch into
  `v3-adaptive-learning` therefore mainly proves that the two histories
  reconcile, and it puts the recorded judgment calls and any simplifications
  on staging.
- **Replay effort.** 14 of the 34 replayed commits conflict with today's
  `v3-ai` in the scratch replay. The three logging commits carry most of the
  conflict hunks.
- **Green layer tips are unproven.** Each layer must pass CI on today's
  `v3-ai` dependencies using only integration changes that also exist in the
  final tree. Slice 2 tests this on a real replay. If a layer cannot meet it,
  it merges with its neighbour, and the stack gets fewer, larger layers.
- **Deploy files on `v3`.** The stack changes 15 `deploy/` files, and
  production renders its chart from `v3`. Promoting those files to `v3` is a
  separate, gated step before production can use them (Later, item 1).

**How will we know it is done?**

- Every layer is green at its own tip.
- The two-sided equivalence check passes at the stack tip.
- Every kept source PR maps to a commit by the same author.
- Focused Playwright specs pass against the stack tip.
- The stack has passed an AI final review and landed on `v3-audit-merge`.
- The draft final pull request into `v3-ai` and the simplification drafts
  exist, with a readiness report for the gated merges that follow.

**What does approval authorize?** Approval covers:

- implementation in worktrees, local commits, and pushes to new `rs/reland-*`
  branches, including `--force-with-lease` restacks of those branches only;
- draft PRs;
- checks and reviews.

Card 1 adds creating `v3-audit-merge`, marking PRs ready and posting the final
review. Card 2 adds landing the stack on `v3-audit-merge`. Card 4 separately
covers closing one stale sync PR. Every later merge stays withheld: the
simplification and catch-up merges, the staging merge, the final merge into
`v3-ai`, the chain PR merge, and any release.

## Approval cards

See the chat message for the full cards.

- **Card 1 (recommended):** execute this batch, including creating the
  protected branch `v3-audit-merge`, marking the stack ready and posting
  `/final-review-stack`.
- **Card 2 (recommended):** once the reviews are settled and every layer is
  green, land the stack on `v3-audit-merge` with `merge_method=merge`, then
  open the draft final pull request into `v3-ai`.
- **Card 3 (recommended):** code simplification runs as a second package into
  `v3-audit-merge`, after the equivalence checkpoint and before the final
  merge. The alternative is a follow-up package into `v3-ai` after the final
  merge.
- **Card 4 (recommended):** after the chain PR is merged into `v3`, close the
  conflicting sync PR
  [#6676](https://github.com/uzh-bf/klicker-uzh/pull/6676) with a linking
  comment.

[#5098](https://github.com/uzh-bf/klicker-uzh/pull/5098) stays open. It is a
draft into `v3-audit` with 30 unmerged commits by the two audit-line authors.
Whether the audit line superseded it is unverified. Its disposition is
reported in the readiness report and is the user's decision.

## Execution details

### Evidence and binding contracts

- **Refs:**
  - `v3-ai` is `9de3af8bee`.
  - `v3-audit` is `453285ad29`.
  - `v3-adaptive-learning` is `9d97d8fb28`. It contains both, and its merge-base
    with `v3-ai` is today's `v3-ai` tip.
  - The audit line's merge-base with `v3-ai` is `67234d302a`.
  - The guard root is `f9c8fa7c72`.
- **Authorship on the audit line.** The first-parent history holds 106
  commits, all committed through GitHub.
  - 64 are syncs from `v3-ai` and `v3`. Four of them are squashed
    single-parent syncs (#6181, #6212, #6287, #6318); the ledger names them.
  - 42 carry content: 25 by one author and 17 by a second author.
  - 32 of the 42 are squash commits. 10 are merge commits whose inner commits
    all belong to the pull request author, so `cherry-pick -m 1` keeps the
    right author. Eight of the ten are kept.
  - A blame of the integrated code attributes 95% of the audit-line lines to
    kept picks. The three logging commits keep 96%, 64% and 98% of their added
    lines, so the replayed authorship is substantive.
  - No commit uses the CI fixture identity that `util/check-git-identity.sh`
    rejects.
- **Dropped from the replay (8 of 42):**
  - #5947, #5979 and #6433: `v3-ai` already holds their content. No file they
    touch differs between `v3-ai` and adaptive-learning.
  - #5317 and #6077: their first-parent diff is empty. The #5317 content
    landed inside the #5316 squash, and the layer description says so.
  - #6078 (lockfile) and #6147 (a carry of the staging workflow consolidation
    onto the audit line): both are integration work. Their surviving content
    arrives in the integrator's commits.
  - #5944 (identity guard glob): `v3-ai` already carries its replacement
    from #5943, and the guard script in `S` equals `v3-ai`'s. The replayed
    pick is empty.
- **Dry-run replay (plumbing only, nothing pushed).** The 35 kept commits were
  replayed in historical order onto `v3-ai` with `git merge-tree`.
  - 20 apply cleanly and 15 conflict. Two variants of the dry run, which
    resolved earlier conflicts differently, agree on these counts.
  - The conflicts total 84 to 120 hunks across the two variants. #5316, #5319
    and #5320 (logging) account for 61 to 67 of them, and #5369 for 4 to 28.
  - These numbers are a floor. The dry run resolved each conflict with a whole
    file, which hides later conflicts. Slice 2 measures the real figure.
- **Scratch replay (slice 2, plumbing only, nothing pushed).** The 34 kept
  commits were replayed onto `v3-ai` against layer-tip trees derived from
  `S`.
  - 20 picks apply cleanly and 14 conflict. No pick is empty.
  - The replay ends exactly on `S`. The five layers change 73, 79, 83, 204
    and 99 files, all under the 300-file review limit.
  - The integrator's closing commits are small: +12/-6, none, +37/-7,
    +35/-23 and none, before the lockfile and before any fix that `check`
    demands at a layer tip.
  - Attribution: of about 44,000 lines the original commits add, the
    replayed picks add 228 lines and remove 155 lines that the original
    diffs do not contain. All sit in files that conflicted with newer
    `v3-ai` code. One whitespace-only integrator line (a re-padded table
    row in `docs/testing.md`) is later rewritten by a pick.
  - The chart renders 20, 20, 22, 22 and 22 staging Deployments at the five
    layer tips and 20 production Deployments at each, matching the replica
    contract at every tip.
  - No layer tip has been installed or typechecked yet. The tips stay
    provisional until `check` passes at each one in the container.
- **Integration branch mechanics.** A new branch named `v3-audit-merge`
  matches the `v3-*` rulesets.
  - Deletion and force-push are blocked, and that ruleset lists no bypass
    actors. Deleting or resetting the branch later needs an edit of the
    ruleset, which is the user's own action.
  - The eight required checks apply to pull requests and pushes, but not to
    the branch's creation.
  - Pull requests with a `v3*` base run Playwright, OLAT API, production i18n
    and the image builds. A push to a `v3*` branch builds staging images.
  - The `sync-ancestry` ruleset and workflow name only `v3-ai`, `v3-audit` and
    `v3-adaptive-learning`. The new branch is outside the sync chain, so it has
    no automatic sync PRs. Catch-up merges from `v3-ai` are manual.
  - Stacks rooted at a `v3-<suffix>` branch are eligible for
    `/final-review-stack`.
  - Staging deploys from `v3-adaptive-learning`. The integration branch reaches
    staging only through a merge into that branch.
- **Merge method.**
  - The repository allows merge commits and squash; rebase merging is off.
  - The `v3-ai` ruleset allows `merge` and `squash` through pull requests.
  - GitHub documents that a stack merged with merge commits gets one merge
    commit per pull request and keeps each pull request's full commit history
    ([Stacked pull requests, merge methods](https://docs.github.com/en/pull-requests/reference/stacked-pull-requests#merge-methods)).
  - `v3` allows squash only and requires linear history.
- **Audit-line inventory.** 357 files are changed. Compared with
  adaptive-learning:
  - 262 are identical.
  - 42 carry adaptive-learning's conflict resolution and no adaptive-only
    commits.
  - 53 were also changed by adaptive-learning's own commits.
- **Integration fixes outside the inventory.** Adaptive-learning carries fixes
  that make the audit and logging code work with newer `v3-ai`, for example
  #6846, which gives the merged tests a logger. Most live inside its merge
  resolutions. They belong in the re-land, in the integrator's commits.
- **Dry-run merge.** Merging `v3-audit` into `v3-ai` conflicts in 20 files.
  - 11 can take adaptive-learning's resolution.
  - 9 also carry adaptive-only hunks: the chat route, `apps/lti/src/index.ts`,
    `_helpers.tpl`, `docs/ci-and-deployment.md`,
    `packages/graphql/package.json`, `packages/util/src/blocks.ts`,
    `pnpm-lock.yaml`, `turbo.json` and `check-klicker-replica-ownership.mjs`.
- **Defaults are off.** `ASSESSMENT_AUDIT_ROLLOUT` falls back to `disabled`.
  Audit workers start only with `ASSESSMENT_AUDIT_WORKER_ENABLED=true`. `v3`'s
  production values and chart contain no audit entries.
- **Migrations.** `20260811074525_assessment_audit_core`,
  `20260812140220_add_live_quiz_response_submission_id` (the non-transactional
  `CREATE UNIQUE INDEX CONCURRENTLY` on `LiveQuizResponse`) and
  `20260902090000_assessment_audit_submission_monitor_index` stay byte-identical.
  `migration_lock.toml` is unchanged.
- **Live proof.** On 2026-11-20 a complete audited assessment ran on the current
  staging build. Owner-CLI verification and export succeeded. The figures were
  checked privately. The stack tip gets its own build, test and focused
  Playwright evidence, because its tree differs from staging in the recorded
  resolution files.
- **CI on stacks.** The `v3-*` ruleset requires eight contexts. `check`,
  `check-gitleaks`, `test-graphql-status` and `test-unit-status` run on every
  pull request base. `test-playwright-status`, `test-olat-api-status`,
  `test-intl-production-status` and `build-images-status` run only on PRs
  whose base is `v3` or `v3*`, so only the bottom layer gets them in CI.
- **Final review.** Native stacks rooted at a consolidation branch such as
  `v3-ai` are eligible for `/final-review-stack`. The workflow rejects any
  layer whose compare returns 300 or more files
  (`.github/scripts/native-stack.js`).
- **Deploy files.** Adaptive-learning differs from `v3-ai` in 15 `deploy/`
  files: 12 chart templates, the chart values, the staging values and a
  disabled `assessmentAudit` block in the production values. The deploy parity
  gate between `v3` and `v3-ai` already fails today.
- **GraphQL schema snapshot.** The audit line leaves `schema.graphql`
  unchanged. Adaptive-learning's additions there are its own and stay out of
  `S`.
- **Reviewer notifications.** CODEOWNERS maps every path to the repository
  owner, so marking the stack ready notifies no third party.
- **Chain.** `PAIRS` on `v3` and `v3-ai` holds `v3→v3-ai`, `v3-ai→v3-audit` and
  `v3-ai→v3-adaptive-learning`. `sync-ancestry` is a required check on
  `v3-audit`. Closing a sync PR does not stop the controller from recreating it.

### History contract

The replay builds the history. The scratch tree `S` defines the final tree.

1. **Original commits.** Each kept source PR becomes exactly one commit made
   with `git cherry-pick -x` (`-m 1` for the eight kept merge-commit PRs).
   Author name, author email, author date and subject stay unchanged.
   `Co-authored-by` trailers from a merge-commit PR's inner commits (#6557,
   #6561) are copied into the pick's message.
2. **Conflict resolution inside a pick** only reconciles overlapping text from
   both sides. The commit body lists the resolved files under `Conflicts:`.
   When a resolution needs new code that neither side had, the pick still
   keeps its author, gains a `Co-authored-by` trailer for the integrator, and
   describes the change in its body.
   - A conflicted file takes its state from the derivation: `S` with every
     later pick reverted. Where that revert itself conflicts, the state is
     built by hand (18 layer-tip states in 9 files and one state between
     #5367 and #5369) and listed in the ledger.
   - Three kinds of path are left out of a pick and listed under
     `Excluded:` in its body: `pnpm-lock.yaml`, the wiki paths the
     repository forbids (`docs/index.md`, `docs/log/`), and three planning
     documents that entered through a pick's branch base and are excluded
     from `S`.
3. **Integrator commits.** Everything else is a separate
   `chore(integration): …` commit under the integrator's identity: dependency
   and API alignment with today's `v3-ai` (zod 4, Hatchet SDK 1.22), the
   regenerated lockfile, the surviving parts of #6078 and #6147, the
   integration fixes from adaptive-learning, and the closing delta to `S`.
   These changes are never folded into an original author's commit.
   - Every integrator hunk must survive into `S`. A layer may not carry
     throwaway code that a later layer removes.
   - #5316 edits 12 files that no longer exist on `v3-ai` (per-app staging
     workflows and `required-build-status.cjs`). Their surviving triggers are
     ported in the logging layer from #6147.
   - The lockfile stays at `v3-ai`'s version inside the picks. It is
     regenerated at each layer tip in the integrator commit and must pass a
     frozen install there. The closing delta takes the lockfile blob of `S`.
4. **A pick is kept** only when it leaves a non-empty diff that `S` also
   contains. The ledger records every dropped commit with its reason.
5. **Order.** Picks run in the audit line's historical order. Each layer is a
   contiguous range of that order and ends with the integrator commits that
   make its tip green.
6. **Commit hooks.** Git does not run the pre-commit hook for a pick that
   applies cleanly, and it does run it when a conflicted pick is concluded
   with `git cherry-pick --continue` (verified in a scratch fixture with
   Git 2.56). The hook runs the full `check:all` suite on the working tree.
   - Every integrator commit is an ordinary commit, so the hook gates every
     layer tip, and CI gates every layer's pull request.
   - A conflicted pick is an intermediate state. Whether it must pass
     `check:all` on its own is the user's ruling; no hook is bypassed
     without it.

### Equivalence acceptance

The scratch tree `S` is built in slice 2. Each check passes an explicit merge
base.

1. **Nothing extra.**
   - Command: `git merge-tree --write-tree --merge-base=$(git merge-base <tip>
     origin/v3-ai) origin/v3-adaptive-learning <tip>`.
   - It must reproduce adaptive-learning's tree, except for the frozen
     resolution ledger.
2. **Nothing missing.**
   - Command: `git merge-tree --write-tree --merge-base=67234d302a <tip>
     origin/v3-audit`.
   - It must reproduce the tip's own tree, except for the ledger's listed
     exclusions.
3. **Exact source.** The final tip's tree equals `S`, apart from the
   `v3-ai`-movement integration pass, which is re-checked with checks 1–2.
4. **Blob identity.** The 262 identical files and the 42 resolution files equal
   adaptive-learning's blobs. The three migration directories equal
   `v3-audit`'s.
5. **Ancestry.** Before every push, `git merge-base --is-ancestor f9c8fa7c72
   <head>` must report false. The only exception is the throwaway staging head
   described under Topology, which contains adaptive-learning by design.
6. **Authorship map.** A scripted table lists every kept source PR with its
   original commit, its replayed commit and both authors. Author name, email
   and date must match, and no kept PR may be missing or duplicated.
7. **Faithful picks.** Each pick's diff against its parent equals the
   original's first-parent diff (`git diff <orig>^1 <orig>`), outside the files
   listed under `Conflicts:`. The comparison uses first-parent diffs, because
   `git range-diff` would compare a merge-commit PR's inner commits instead.

The **resolution ledger** is frozen in slice 2 before any layering. It records
each of the following, with a one-line reason:

- each of the 53 overlap files;
- each of the 20 merge conflicts;
- each integration-fix file;
- each exclusion;
- each dropped commit.

The ledger and the authorship map are attached to the top PR. The final
reviewer also gets the 27 files where the stack does not simply carry
`v3-ai`'s delta: the 20 conflicts plus `check.yml`, `test-graphql.yml`,
`apps/backend-docker/Dockerfile`, `apps/chat/package.json`,
`apps/chat/test/account-usage-route.test.ts`,
`packages/graphql/src/schema/mutation.ts` and
`packages/graphql/src/services/knowledge.ts`.

**Exclusions:**

- The staging image-tag retag hunks in `deploy/env-uzh-stg/values.yaml`. Its
  audit blocks are kept, with `v3-ai`'s tag convention.
- Two unrelated planning docs that drifted onto the audit line:
  `2026-09-06-dpo-integration-roadmap.md` and `2026-09-06-pr-5819-…`.
- The audit line's deletion of `2026-08-29-pr-5667-…`. The doc is kept.

Picks stay untouched, so check 7 holds. Where a pick carries excluded content,
an integrator commit in the same layer reverts exactly those hunks, and the
revert survives into `S`.

### Topology

Five layers form one native stack rooted at `v3-audit-merge`. Each layer
stays below 300 changed files, integrator commits included, so the stack
review accepts it.

```text
v3-ai ──► v3-audit-merge ◄── stack of 5 layers (merge commits)
              │        ◄── simplification package (Card 3)
              ├──► v3-adaptive-learning   (staging, via a throwaway sync head)
              └──► v3-ai                  (final merge commit, withheld)
```

- **Staging head.** Pull requests into `v3-adaptive-learning` never use
  `v3-audit-merge` as their head. "Update branch" on such a PR would merge
  adaptive-learning, and with it the `v3-audit` ancestry, into the integration
  branch, which cannot be force-pushed. The head is a throwaway
  `sync/v3-audit-merge-into-v3-adaptive-learning-<sha10>` branch.
  - It carries the conflict resolution and therefore the `v3-audit` ancestry.
    It may only ever target `v3-adaptive-learning`.
  - It is merged with a merge commit. A squash would drop the ancestry and
    make the later `v3-ai` sync conflict again.
  - It is accepted when the merge result equals adaptive-learning's tree,
    outside the ledger paths and the approved simplification changes.
  - It is built only when the staging merge is about to happen, so it does not
    go stale.
- **Catch-up.** `v3-ai` is merged into `v3-audit-merge` through a pull request
  from a throwaway `sync/v3-ai-into-v3-audit-merge-<sha10>` head, with a merge
  commit. "Update branch" on the final pull request is not used, because it
  would push to the protected branch without the required checks.
- **Final pull request.** Its head is `v3-audit-merge` and its base is `v3-ai`.

- The stack lives in the worktree `trees/reland-audit-foundation`, on the
  five `rs/reland-*` branches.
- The main session is the single topology owner.
- Layer boundaries follow the audit line's history. Slice 2 confirms them on a
  real scratch replay, by running `check` at each candidate tip. A boundary may
  move within the historical order. Any other topology change returns to the
  user.

```yaml
stack: reland-audit-line         # worktree trees/reland-audit-foundation, root base v3-audit-merge
layers:
  - branch: rs/reland-audit-foundation
    picks: "#5311 #5356"
    reviewer: backend + data
    size_signal: ~12k/78 files incl. tests and docs — contract, outbox, evidence store, migrations
  - branch: rs/reland-audit-producers
    picks: "#5367 #5369 #5378 #5893 #5894 #5895 #5896 #5897 #5898 #5917 #5937"
    reviewer: backend + PWA + platform
    size_signal: ~18k/131 — baselines, rollout activation, producers, response contract, materialization, first staging runtime
  - branch: rs/reland-audit-submissions
    picks: "#5930 #5965 #5994"
    reviewer: backend + platform
    size_signal: ~100/8 — three follow-up fixes of the submission work
  - branch: rs/reland-logging
    picks: "#5316 (includes #5317) #5319 #5320 #6204"
    reviewer: platform + frontend + auth
    size_signal: ~11k/220 — Pino foundation and server adoption; most conflict hunks
  - branch: rs/reland-audit-sealing
    picks: "#6066 #6084 #6211 #6192 #6241 #6310 #6320 #6314 #6557 #6561 #6657 #6658 #6659 #6660 #6744"
    reviewer: backend + platform/DevOps
    size_signal: ~4.5k/101 — worker sizing, submission triggers, sealing, review fixes; closing delta to S
chain PR (separate, into v3): rs/retire-v3-audit-sync-pair — light path, ~40 lines
```

The layer sizes exceed the usual review budget. Reviewers do not re-review the
replayed pull requests. They review the conflict notes inside picks, the
integrator commits, and the ledger.

### Simplification

**History, in this batch.** The stack drops 72 of 106 first-parent commits: 64
integration merges and the 8 commits listed above. Reviewers get 34 authored
commits and a small set of integrator commits.

**Code, after the equivalence checkpoint (Card 3).** Code simplification
breaks the equality with staging's tree. The checkpoint is the commit on
`v3-audit-merge` right after the stack has landed; checks 1–7 are recorded
against it. After the checkpoint, checks 1–2 compare the checkpoint with the
tip: the difference must consist of the approved simplification pull requests
and the catch-up merges only.

- Recommended: a second package into `v3-audit-merge` after the checkpoint.
  It starts with a simplifier pass over the areas the first scan missed. It
  reaches staging through the merge into `v3-adaptive-learning` before the
  final merge, and the final merge then carries the faithful history and the
  simplifications together.
- Alternative: a follow-up package into `v3-ai` after the final merge. The
  final merge then happens sooner and carries only staging-equivalent code.
- In both cases each simplified file conflicts once when it reaches
  `v3-adaptive-learning` and resolves to the simplified version.
- Frozen in either case: the migrations and Prisma schema, event payload
  schemas and versions, canonicalization and every hash or manifest input, the
  Azure table and blob layout, Hatchet task names and queued-command payloads,
  log correlation and redaction fields, chart value keys, the rollout
  environment contract and the public GraphQL contract. Existing staging
  evidence must keep verifying.
- Each simplification is its own commit under its author, with the test that
  protects the behavior named in the description.

**Candidates.** A read-only simplifier scan of the integrated code found the
code it read lean. It covered the logging package, the audit CLI, the Azure
table reader and mapping, and the per-app logger wiring. The confirmed
candidates remove about 120 to 180 lines:

- one shared failure-reason type in `packages/audit/src/azure/table-reader.ts`
  and `cli/export.ts`, which today define it three times (low risk);
- an unreachable final branch in `exportStatuses` in `cli/export.ts` (low);
- `exportQuiz` merged into `exportQuizWithFailures`, if it has no production
  caller (unverified);
- one helper for the three `assert*` validators in `table-reader.ts` (low);
- a table-driven `verifyBaseline` in `cli/export.ts` (medium: the comparison
  depends on key order);
- dead wrappers in `packages/logging` (`resolveLevel`, `createSafeError`) and
  two test-only service-name functions (low);
- unused exports in the `packages/audit` barrel (needs a consumer check).

The scan did not reach the dispatcher, the outbox, sealing, the contract and
payload modules, the graphql audit services or the worker apps. The follow-up
package starts with a simplifier pass over those areas. Its size is unknown
until then.

**Planning docs.** The audit line adds about 9,200 lines in 21 `project/`
files. They travel unchanged with the picks. The three overlapping JSON-logging
design docs and the `project/plans_wip/` entries are candidates for the
follow-up package.

### Test portfolio

| Risk | Existing protection | Obligation | Seam | Slice |
| --- | --- | --- | --- | --- |
| Re-land adds, drops or alters code relative to the integrated source | none | add new (scripted, not committed): equivalence checks 1–5 | git trees | 2, 5 |
| An original author's work is lost, misattributed or silently altered | none | add new (scripted, not committed): checks 6–7 | git history | 3, 4, 6 |
| A layer breaks at its own tip | `check`, `test-graphql` and unit CI per layer | none | CI | every layer |
| End-to-end behavior breaks at the tip (no Playwright CI on upper layers) | Playwright CI on the bottom layer only | extend existing: host-run focused specs at the tip (`O1-live-quiz-core`, the touched chat specs, assessment specs) | `util/run-playwright-host.mjs` | 5 |
| Images, OLAT API or production i18n break at the tip (no CI for them on upper layers) | those three contexts on the bottom layer only | none (run the existing image builds and the two suites at the tip) | container builds, existing suites | 5 |
| Production manifests change when the chart reaches `v3` | `check-assessment-audit-rollout-render.mjs` | none (rendered-manifest diff against `v3`'s production values) | chart render | 5 |
| Audit or logging regressions after integrating with newer `v3-ai` | audit, processor, response-api, graphql and logging suites | none | existing suites | per layer |
| Audit active in production by default | rollout tests; `check-assessment-audit-rollout-render.mjs` | none (re-run against `v3`'s production values) | render + tests | 5 |
| Migration checksum drift | none | covered by check 4 | files | 2 |
| Analytics schema drift | `prisma:sync` contract check | none | sync | audit foundation |
| A receipt without evidence | #6659 integration tests | none | processor test | sealing |

No new committed tests are planned. The scripted checks are review evidence,
not maintained tests.

### Slices

0. **Chain PR into `v3`.** It runs in parallel and should merge before the
   final merge into `v3-ai`.
   - Apply the five documented steps:
     - remove the `v3-ai→v3-audit` pair;
     - remove the maintain-workflow source if it is now unused;
     - remove `v3-audit` from the guard workflow branches and from
       `DOWNSTREAM_ROOTS['v3-ai'].downstreams`;
     - update the controller and guard tests;
     - update the chain text in `AGENTS.md`, `CLAUDE.md` and
       `docs/ci-and-deployment.md`.
   - It touches `docs/ci-and-deployment.md`, which is also a stack conflict
     file. Resolve that file in the stack after the chain PR flows to `v3-ai`.
   - Report to the user that `sync-ancestry` stays required on `v3-audit` and
     will no longer report there. This is an admin ruleset follow-up.
   - After the user merges it, run the documented controller dry run
     (sync-chain step 5) and report the result.
1. **Integration branch and plan commit.**
   - Create `v3-audit-merge` on the remote at the pinned `v3-ai` tip
     (`9de3af8bee`). This is a Card 1 action: the branch is protected and only
     an admin can delete it.
   - Rename the worktree branch to `rs/reland-audit-foundation` and commit
     `docs(project): add v3-audit re-land implementation plan`.
2. **Scratch tree, scratch replay and ledger.** All work happens on detached
   HEADs in the worktree, never on an `rs/` branch.
   - **Tree `S`:** merge `origin/v3-audit` into the pinned `v3-ai`.
     - Take adaptive-learning's blobs for the 42 files.
     - Resolve the 11 adaptive-free conflicts to adaptive-learning's version.
     - Hand-resolve the 9 overlap conflicts.
     - Add the enumerated integration fixes.
     - Regenerate `pnpm-lock.yaml` in the container.
     - Run checks 1, 2 and 4 against `S`.
   - **Replay:** cherry-pick the 34 commits in order with real resolutions.
     - Record the conflict hunks per commit.
     - Run a frozen install and `check` at each candidate layer tip to learn
       which integrator commits each layer needs.
     - Confirm that every integrator hunk survives into `S` and that each
       layer stays below 300 changed files.
     - Confirm or move the layer boundaries.
   - Freeze the ledger. Record the tree ID of `S` and the final pick list.
3. **Layers 1–3 (audit).** Build each layer from the scratch replay: the picks,
   then the integrator commits.
   - In the container, run `check:all`, the migration and prisma sync checks,
     and the audit, processor and response-api suites at each tip.
   - Run checks 5–7.
4. **Layers 4–5 (logging and sealing).** Build them the same way. The top
   layer ends with the closing delta to `S`.
   - Run the affected unit suites at each tip.
   - Run checks 1–7 at the top.
5. **Tip end-to-end.** Start the worktree's devrouter stack at the tip.
   - Run the focused Playwright specs from the host.
   - Build the backend, response API and worker images, and run the OLAT API
     and production i18n suites.
   - Run the rollout render check against `v3`'s production values, and diff
     the rendered production manifests against `v3`'s current chart.
6. **Publish.** Run `gh stack` with the draft PRs, rooted at
   `v3-audit-merge`. Descriptions from
   `$rs-mr-description-writer` cite the source PRs, the authorship map, the
   ledger, the equivalence results, and why no screenshots apply. Watch
   per-layer CI through `$rs-babysit-pr`.
   - Right after publishing, read how the four `v3*`-only required contexts
     report on the upper layers. Report a context that can never be satisfied
     at once, not at Gate 4.
7. **Review.**
   - No simplifier pass on this stack: it carries no design change.
   - One independent `final-reviewer` covers the conflict notes in picks, the
     integrator commits, the ledger, the 27-file list and the behavior that is
     active with audit off.
   - The top PR records the lens selection.
8. **Gate 3 (Card 1).** Mark every layer ready once green, equivalent and
   settled. Read back CI, then post `/final-review-stack` on the top PR and
   settle its findings.
9. **Gate 4: land on the integration branch (Card 2).** Report approval
   state, CI on exact heads and base currency. Then, with Card 2 approved:
   - Merge only the top PR with `merge_method=merge` and the reviewed head SHA
     pinned. This produces five merge commits on `v3-audit-merge`. If an upper
     layer cannot satisfy a `v3*`-only required context, stop and report.
   - Record the resulting commit as the equivalence checkpoint and re-run
     checks 1–7 against it.
10. **Draft final pull request** from `v3-audit-merge` into `v3-ai`. All
    eight required checks run here on the complete tree. Evidence: the checks
    on the exact head and a clean `sync-ancestry` result. Merging it stays
    withheld.
11. **Simplification package (Card 3).** Run the simplifier pass and deliver
    the accepted candidates as draft pull requests into `v3-audit-merge`, each
    with its protecting test named. Merging them stays withheld.
12. **Readiness report (batch terminal).**
    - The state of the final pull request and of the simplification package.
    - The gated actions that follow, in order (Later, item 0).
    - The `deploy/` promotion to `v3` as a separately gated action, with the
      rendered-manifest diff.
    - The disposition options for #5098.
    - The production consequences under Later, item 1.

### Verification and working context

- Run installs, types, lint and unit tests in the worktree's devrouter
  container. Never install on the host. Playwright runs on the host against
  the routed stack.
- Pin the base at `9de3af8bee`, where `v3-audit-merge` is created. `v3-ai`
  movement no longer touches the stack. It is absorbed by a catch-up merge of
  `v3-ai` into `v3-audit-merge` before the final merge, followed by a re-run
  of checks 1–2 and 5.
- Record the dry-run conflict list of check 1 for the later
  `v3-ai → v3-adaptive-learning` sync PR. Each listed file resolves to
  adaptive-learning's version. Identical migrations merge cleanly and are not
  re-applied.
- Replayed subjects keep their `(#NNNN)` suffix, so GitHub adds a reference to
  each original pull request's timeline.
- Stop the devrouter runtime at the finish (`$rs-local-runtime-lifecycle`).

### Recovery

- **Check 1 or 2 shows an unexplained path.** Attribute it to a source PR, an
  adaptive-only commit or an integration fix. Update the ledger or the layer,
  and re-run. A genuine disagreement with staging's resolution stops the work
  as a decision.
- **A pick needs more than text reconciliation.** Apply history contract
  rule 2. If more than half of a pick's changed lines would be rewritten, stop
  and report it: that commit can no longer honestly carry its author alone.
- **A layer is red only at its own tip.** Add or move an integrator commit
  into the layer that needs it, restacking with `--force-with-lease` on
  `rs/reland-*` only.
- **A layer cannot be green with hunks that survive into `S`.** Merge it with
  the next layer in historical order. The stack review counts files per layer
  against the layer below. If the merged layer reaches 300 files, stop and
  report: the stack review then needs a different arrangement, which is the
  user's decision.
- **Check 5 fails.** Stop. Never push that head. Rebuild the branch from the
  scratch replay.
- **`v3-audit-merge` gains `v3-audit` ancestry**, for example through "Update
  branch" on a wrongly headed PR. Stop and report. The branch cannot be
  force-pushed; the options are a ruleset edit by the user followed by a
  reset, or a fresh integration branch.
- **The secret scan flags the 40-character source SHAs in `-x` trailers.**
  Replace the trailer with `Source-PR: #NNNN` and key check 6 on the PR number.
- **The final-review workflow fails for an infrastructure reason**, such as a
  provider quota. Treat it as a blocker, not a verdict. Rerun once, then
  report it.
- **An upper layer cannot satisfy a `v3*`-only required context.** Report it
  with the bottom-layer and local tip evidence. The landing approach is then
  the user's decision.

### ADR gate

No new ADR. ADR 0002 (Pino) travels with the stack, and ADR 0007 is
unaffected. The gate re-arms for production enablement or a change to audit
activation.

### Later (not in this batch)

0. **The gated actions after this batch, in order.** Each needs its own
   approval.
   - Merge the simplification pull requests into `v3-audit-merge`.
   - Catch up with `v3-ai` through the throwaway-head pull request, whenever
     `v3-ai` has moved.
   - Build the staging head and merge it into `v3-adaptive-learning` with a
     merge commit. This deploys to staging.
   - Merge `v3-audit-merge` into `v3-ai` with a merge commit.
   - Delete `v3-audit-merge`. This needs an edit of the `v3-*` branch
     protection ruleset, or the branch stays as a frozen reference.
1. **Release checklist for the first `v3-ai` release after the final merge.**
   - Time the `CONCURRENTLY` index migration on `LiveQuizResponse` for
     production, after a private size check.
   - Release with no running assessments, deploying the response API,
     processor and PWA together, and draining legacy queued commands.
   - Watch the migrator hook.
   - Run `pnpm run release:alpha:dry` first. The 34 replayed commits are
     conventional commits with their original PR numbers, so they appear as
     changelog entries.
   - Promote the 15 changed `deploy/` files to `v3`, per "Deploy parity across
     v3 and v3-ai". This is a separately gated action: production renders its
     chart from `v3`, and the parity gate already fails today.
3. **Production enablement.**
   - Production storage and identities (df-cloud) and the production values.
   - Monitoring and alerts, with a runbook.
   - The UZH privacy review and the SIKO delta.
   - The retention worker.
4. **The staging processing-latency investigation**, which needs cluster logs.

## Planning review

### First critique (2026-11-20, earlier design)

The council plan critique was a read-only `advisor` agent with repository
access. Its verdict was revise. Accepted:

- the equivalence check made two-sided, with explicit merge bases and an
  enumerated ledger;
- the integration-fix class;
- the production effect of `v3-ai` release tags (verified in
  `docs/ci-and-deployment.md`);
- a single stack with named lease restacks;
- chain-PR ordering, with the old-PR closure conditioned on the chain PR's
  merge;
- a detached-HEAD scratch merge with the ancestry assertion;
- explicit blobs for the 42 files;
- the conflict list handed to the later sync;
- corrections to the migration and exclusion facts.

Added after verification: upper stack layers get no Playwright CI, so the tip
gets host-run specs.

### Revision for authorship and simplification (2026-11-20)

The user asked to keep the original authors' commits and to simplify where
possible. Findings that changed the plan:

- The earlier design re-staged files into layers, which would have attributed
  all 35 pull requests to the integrator. It is replaced by an
  author-preserving replay.
- The layer order changed from logging-first to the historical order, so no
  layer carries an intermediate state that never existed.
- A squash landing would undo the replay. The plan names `merge_method=merge`
  as an explicit exception (Card 2).
- Code simplification conflicts with the equivalence proof and moves to a
  follow-up package (Card 3). History simplification stays in this batch.

### Second critique (2026-11-20, revised design)

A read-only `advisor` agent with repository access reviewed the revised plan.
Its verdict was revise. It confirmed the pick and drop lists, the layer order,
the merge-commit landing against the guard and sync scripts, the identity
guard, and that the replayed authorship is substantive. Accepted:

- the logging layer narrowed to its three picks, to stay below the stack
  review's 300-file cap;
- the rule that integrator hunks must survive into `S`, with a merge-layers
  recovery;
- the four `v3*`-only required contexts, with local tip evidence and an early
  probe;
- the `deploy/` promotion to `v3` named as a separately gated action;
- #5098 left open, because it holds unmerged work whose status is unverified;
- a frozen install per layer and the lockfile blob of `S` at the tip;
- corrected merge-commit counts and carried co-author trailers;
- additions to the frozen list, and the controller dry run after the chain PR.

### Integration branch (2026-11-20, user proposal)

The user proposed landing the stack on an intermediate branch and merging that
into `v3-ai` with one postponable merge commit. Verified against the rulesets
and workflows: the `v3-*` name gives the branch protection, the full required
checks and stack-review eligibility, and keeps it outside the sync chain.
Adopted, with the throwaway-head rule for the staging pull request and
simplification moved in front of the final merge.

A focused delta critique by the same reviewer returned revise with small
amendments, all accepted: a scoped ancestry exception and acceptance rule for
the staging head, a merge commit for the staging merge, deletion and reset
named as ruleset edits, catch-up through a pull request instead of "Update
branch", the staging head built only at staging time, the post-checkpoint
meaning of checks 1–2, and the full list of gated merges. It confirmed that
the branch sits legitimately outside the sync chain, that staging cannot move
from it, and that the final pull request passes the ancestry guard.

A final advisor pass corrected the dry-run figures, the comparison used by
check 7 for merge-commit picks, the exclusion mechanism and the description of
#5098.

Unverified, and carried into slice 6 or Gate 4: whether the secret scans read
commit messages, how GitHub evaluates required contexts when a stack lands
through its top PR, and the real conflict count of a sequential replay.

## Progress

- Status: Cards 1–4 approved by the user on 2026-11-20. The five layers are
  published as draft pull requests into `v3-audit-merge`. Per-layer CI on
  the first publication showed three layers red on their own, and the stack
  was rebuilt once to make every layer green (see "Layer boundaries").
- Done: `v3-audit-merge` created on the remote at `9de3af8bee`.
- Done (slice 2): the reference tree `S`, the layer-tip derivation, the
  scratch replay and the attribution check. Results are under "Scratch
  replay" above.
- Done (slices 3–7): the five layer branches, stacked on `v3-ai` at
  `9de3af8bee`. 35 commits are replayed with their original author and date
  (24 by the first author, 11 by the second). Each layer ends with one
  integration commit, and the layers that change a canonical CI workflow
  add one commit that pins the caller to the regenerated executor.

  | Layer | Branch | Content |
  | --- | --- | --- |
  | 1 | `rs/reland-audit-foundation` | 2 picks, integration, executor pin |
  | 2 | `rs/reland-audit-producers` | 11 picks, two integrations, executor pin |
  | 3 | `rs/reland-audit-submissions` | 3 picks, integration |
  | 4 | `rs/reland-logging` | 4 picks, integration, executor pin |
  | 5 | `rs/reland-audit-sealing` | 15 picks, integration, executor pin, this plan |

- Layer boundaries: the audit line itself was red in two stretches, and a
  layer that ends inside one fails CI on its own.
  - Layer 1: `v3-ai` requires every first-party chart image to prefer the
    optional global image tag. The audit worker template gets that form only
    in #5917, so the layer 1 integration commit takes that one line early
    and counts the template in the contract test. The #5917 pick then stops
    on the test file and takes its own version.
  - Layer 2: two GraphQL suites fail once the producers exist and pass again
    with #5917 and #5937. The boundary between layers 2 and 3 moved from
    after #5369 to after #5937, within the historical order. Layer 3 keeps
    the three submission fixes that follow.
  - Layer 4: #5320 adds a proxy test that the auth proxy satisfies only with
    #6204. #6204 is replayed directly after #5320, two positions earlier
    than in the audit line. It changes one file that no commit in between
    touches, so every pick's diff and the tip tree stay the same. This is
    the one departure from the historical order.

- Equivalence: the first build ended on a tree equal to `S` (`add7aa4e72`).
  Local test runs then showed three gaps in `S`, all adaptations that the
  staging branch carries outside the audit line. The final tip differs from
  `S` by exactly these:
  - the versioned element id in `liveQuizLifecycle.test.ts` (staging #6793),
    without which the GraphQL suite fails from layer 2 on;
  - the regenerated priority executors `test-graphql-execution.yml` and
    `check-execution.yml` with their caller pins, without which the CI
    contract test `ci-event-gates.test.cjs` fails from layer 1 on;
  - the image-scan exception for `@azure/msal-node` (staging #6744), picked
    as the last commit of the sealing work. The audit package brings that
    dependency into the backend image, and the scan gates image builds on
    push.
- Executor pins name commits of this stack. They stay valid only while those
  commits keep their SHAs, so the stack and the final pull request must land
  with merge commits, and a restack of a lower layer needs new pins above it.
- Checks at the tip, run locally: every `check:all` task, the CI contract
  tests (916 tests), the Helm, replica ownership, KB ingestion and audit
  rollout render checks, and the audit, response API, response processor and
  GraphQL suites against a database migrated to the tip. Each integration and
  pin commit went through the full pre-commit hook.
- Known failures, not caused by this work: five tests in
  `packages/hatchet/test/logging.test.ts` fail against Hatchet SDK 1.22.0.
  The staging branch has the same source, test and SDK version, and no CI
  workflow runs that suite. `packages/prisma-data/test/seedMCPServers.test.ts`
  reports no test suite, as on `v3-ai`.
- Not run locally: Playwright, the OLAT API suite, production i18n and image
  builds. CI on the bottom layer is the gate for them.
- Commit hooks (history contract, item 6), ruled by the user on 2026-11-20:
  16 picks were concluded without the full hook, because Git runs it only for
  picks that stop. These are #5311, #5356, #5367, #5369, #5378, #5893, #5897,
  #5917, #5965, #5316, #5319, #5320, #6066, #6084, #6561 and #6657. The
  secret scan and the identity guard ran by hand on each. In the rebuild,
  picks were carried over from the first publication with `git cherry-pick`;
  only #5917 stopped again and was concluded the same way.
- Changed against the approved plan: #5944 is dropped as superseded and
  #6744 is added. Fifteen files that `v3-ai` gained after the audit line's
  last sync take their logging adoption from adaptive-learning, in the
  logging layer's integration commit.
- Working files: `project/_local/reland-v3-audit/` (gitignored) holds the
  scripts (`build-s.sh`, `derive.py`, `forward.py`, `faithful.py`,
  `linecheck.py`, `replay.py`), the hand-built states (`resolved/`,
  `layers/`, `picks/`) and their ledgers.
- Root outcome: the audit-line content on `v3-ai` without `v3-audit` ancestry,
  with the original authors' commits kept, per the user's requests on
  2026-11-20. Batch terminal: the stack landed on `v3-audit-merge`, the draft
  final pull request, the simplification drafts, the readiness report and the
  chain PR as a draft.
- Worktree: `trees/reland-audit-foundation`, holding all five layer branches.
- Next action: confirm CI per layer on the rebuilt stack, then review and
  landing per Cards 1 and 2. Slice 0 (the chain pull request) is open as a
  draft into `v3`.
- Assumption most likely to be wrong: the rebuilt layer 2 tip is green in
  the suites that only CI runs (Playwright, OLAT API, production i18n, image
  builds), since that tree was never tested as a tip before.
