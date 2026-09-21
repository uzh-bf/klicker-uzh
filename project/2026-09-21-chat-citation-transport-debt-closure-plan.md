# Chat citation and KB-transport debt closure

Date: 2026-09-21

Status: planning complete; execution not started and not authorized by this
document. Merges, promotion, and activation stay separately gated.

## Goal

Replace the temporary KB-transport fix that production chatbots currently run
on with the reviewed durable stack: fresh ES256 scope tokens for every KB
transport call (chat MCP transport and GraphQL source inventory), and the
citation source normalizer that stops internal ingestion-gateway URLs from
reaching participants as citation links. Close the debt under every course
bot's citations in one deliberate sequence.

Non-goals: no new DB models or migrations (the design is deployment-bound),
no redesign of the scope-token contract, no changes to the corpus-import or
video lanes, and no activation beyond what the merged chart values enable.

## Why now

The 2026-09-21 RadioSurfVet PRD acceptance validated the corpus and citation
flow end to end, but on the temporary fix. Every answer-mode citation in every
course bot depends on this transport and normalizer, so the unmerged stack is
the largest correctness risk in the chatbot program.

## Verified current state (2026-09-21)

- **PR #6198** `fix(kb): authenticate source inventory with fresh scope
  tokens` — MERGED into `v3-ai` as `938c0f4dad` after all eight required
  checks were green at head `3183b5bc26`.
  Touches `packages/doc-query-client` (new `docQueryScopeToken.ts`,
  `mcpClient.ts`), `packages/graphql/src/services/docQuerySources.ts`,
  `kbImportedSources.test.ts`, the chat transport files shared with #6197,
  chart templates (`cm-backend-graphql`, `cm-chat`, `_helpers`,
  `values.yaml`), and `turbo.json` globalEnv.
- **PR #6197** `fix(chat): use scope tokens for KB transport
  authentication` — base `v3`, head `rs/mcp-bearer-rotation` at
  `bcbbdbf925`, source-only after the promoted chart revision was dropped
  from the branch (see C3).
- **`rs/citation-links-v3-ai`** — single commit `802d25d5d5` (`fix(chat):
  backport citation source links to staging`) on stale base `725b4dc2ec`
  (`v3-ai` is at `e6cfef46c8`). Changes
  `apps/chat/src/lib/sources/normalizeSources.ts` (+54/-11) and tests
  (+105): filters ingestion-gateway references (`.svc`,
  `.svc.cluster.local`, `/api/ingestion/resources/` paths) out of
  participant links, adds `display_name` to the title fallback chain, and
  keeps ingestion references in the dedupe key while hiding them as URLs.
  Its PR #5818 was closed unmerged; no open PR exists.
- Related but separate: PR #5709 (scoped Doc Query activation, ready) is the
  activation layer of the 2026-09-03 stack plan and keeps its own plan
  (2026-09-03-doc-query-v3-activation-stack-plan.md).
- Deployment-repo MR !95 is unrelated (2026-05 seed work). All deployment
  surface for this debt is inside the two PRs' chart changes.

## Execution log

- 2026-09-21, C1 done. All eight required contexts pass at head
  `3183b5bc2671feadc608b1d0cd33dd5a757af0fd`. The doc-query-client rebuild
  produced no tracked artifact (`dist/` is untracked and the worktree is
  clean), and host `tsc` passed for `apps/chat` and `packages/graphql`.
  Playwright failed once on a dropped shard that recorded no steps and no
  runner; re-running the same workflow at the same head passed all eight
  shards. SonarCloud failed on a coverage-receipt `treeSha` mismatch, which
  is not a required context. Receipt:
  `project/_local/evidence/2026-09-21-chat-citation-transport-c1-receipt.md`.
- 2026-09-21, C5 investigated and found already delivered on both `v3` and
  `v3-ai`, with test coverage on both. Proposed disposition: close C5 as
  delivered and drop `rs/citation-links-v3-ai`; awaiting approval.
- 2026-09-21, C4 baseline recorded before the merges: the parity files
  already differ, so C4 needs a deliberate resolution, in particular for
  `apps/chat/src/lib/server/docQueryScopeToken.ts`, which is inline on
  `v3` and a package re-export on `v3-ai`.
- 2026-09-21, C3 blocker found at #6197's updated head `3cd2724c8c` after
  merging current `v3`. The required `check` lane failed on the deploy
  parity gate, not on stale generated clients: PRs based on `v3` that edit
  `deploy/` must leave `v3` and `v3-ai` byte-identical under `deploy/`.
  Seven paths diverge today. `test-graphql-status` also failed on one
  Prisma `P2034` write conflict in `test/verification.test.ts` (904 of 905
  tests passed), which looks independent of this change.
- 2026-09-21, the deploy parity gate's semantics were read from its own
  source (`.github/scripts/deploy-parity.cjs`) rather than inferred. With
  `--base`, `candidateTouchesDeploy` decides attribution: a candidate that
  does not edit `deploy/` reports the divergence as a warning and passes,
  and only a candidate that itself edits `deploy/` has to leave both
  branches byte-identical under `deploy/`. That is what makes the C2b then
  source-only-#6197 remedy sufficient, and it is why #6198's parity step is
  skipped (its base is `v3-ai`).
- 2026-09-21, #6197's second failure was identified exactly: a single test,
  `test/verification.test.ts > assessment report credential services >
  returns one token for concurrent insertion and sequential reissue`, which
  raises `P2034` write conflicts under CI contention. The same suite passed
  on #6198 in the same window, so it is a flake, not a defect in the
  transport change.
- 2026-09-21, C2b and C3 success conditions pre-verified locally before any
  merge, in `trees/parity-dry-run`. Simulating C2 as a real merge of #6198
  into current `v3-ai` is conflict-free (13 files, +1334/-47) and adds
  exactly four files and 45 insertions under `deploy/`. On the promoted
  `v3` the gate fails against pre-promotion `v3-ai` (exit 1, four paths) and
  passes against post-C2 `v3-ai` (exit 0); the source-only #6197 variant
  changes only its seven expected paths and also passes (exit 0). Helm
  renders the promoted chart with no scoped keys when the values are empty,
  all three keys in both ConfigMaps when set, and a hard failure on a partial
  set. Receipt:
  `project/_local/evidence/2026-09-21-chat-citation-transport-c2b-c3-dry-run.md`.
- 2026-09-21, the authorized delivery steps were executed. #6198 merged into
  `v3-ai` as `938c0f4dad`; PR #6224 carries the chart promotion to `v3`;
  `rs/mcp-bearer-rotation` is source-only at `bcbbdbf925`. Both open PRs
  leave the parity gate green, and the promotion changes no image pin.
- 2026-09-21, PR #6224 merged as `faedefc5a9` (13:27:52Z). `deploy/` parity
  between `v3` and `v3-ai` is now empty and the gate exits 0 at the merged
  head. #6197 is source-only at `45997b052` (a test-await commit on top of
  `bcbbdbf925`), `BEHIND` and `MERGEABLE`; its computed merge candidate
  `725d8c0fd2769b0682b1208fbd8d3827d830be2` passes the gate.
- 2026-09-21, C4 pre-flighted in `trees/parity-dry-run`. Before #6197 lands a
  `v3` → `v3-ai` merge auto-resolves every transport file and conflicts only
  in `packages/shared-components/package.json` (cytoscape vs motion). After
  #6197 lands, seven paths conflict; the transport ones resolve by keeping the
  `v3-ai` package re-export. Receipt:
  `project/_local/evidence/2026-09-21-chat-citation-transport-c4-preflight.md`.
- 2026-09-21, the `v3` ruleset was read rather than assumed. It sets
  `strict: true` on the required status checks (`check`, `check-gitleaks`,
  `test-graphql-status`, `test-playwright-status`, `test-unit-status`,
  `test-olat-api-status`, `test-intl-production-status`,
  `build-images-status`), so a `BEHIND` PR cannot merge at any check state.
  #6197 was therefore brought up to date: merging current `v3` into
  `rs/mcp-bearer-rotation` is conflict-free, the new head is `e5cf41ec94`,
  `deploy/` is byte-identical to `v3`, and the computed merge candidate stays
  `725d8c0fd2769b0682b1208fbd8d3827d830be2`. A fresh CI generation now runs
  on that head.
- 2026-09-21, the plan itself was persisted. It lived only as an untracked
  file in the primary checkout, so it is now committed on
  `rs/chat-citation-transport-plan` as
  `docs(project): plan the chat citation and KB-transport debt closure` and
  opened as draft PR #6225, matching the repository's `docs(project)`
  precedent. The `project/_local/` evidence files stay untracked by design
  (`.gitignore`).
- 2026-09-21, #6197 went green at `e5cf41ec94` (all eight required contexts,
  plus a clean final AI review), then `v3` advanced by one docs commit (#6217)
  and the branch was refreshed again to `11973a8e25`; CI re-ran there. Each
  new `v3` commit forces a refresh because the ruleset is `strict`, so prompt
  merging avoids another cycle.
- 2026-09-21, C4 delivered as draft PR #6228
  (`chore(sync): merge v3 into v3-ai`, head `17735f22a8`). All seven expected
  paths conflicted and were resolved to the `v3-ai` structure; the manifests
  took unions. `deploy/` is byte-identical to both branches.
- 2026-09-21, a silent-revert hazard was found while resolving C4 and is worth
  a durable fix. `git` auto-merged
  `apps/chat/test/doc-query-scope-token.test.ts` without a conflict into a
  state that imports `createDocQueryScopedFetch` from the app-side module,
  which on `v3-ai` only re-exported the signer. The resolution adds that
  symbol to the `v3-ai` re-export. The deeper problem: after this merge the
  common ancestor carries `v3-ai`'s re-export, so the **next** `v3` → `v3-ai`
  sync sees `ours` unchanged and takes `v3`'s inline implementation silently,
  reverting the package-owned token with no conflict to review. See
  "Structural-split hazard" below.
- 2026-09-21, C3 met. #6197 merged into `v3` as `ffcd3297c2` at 18:55:48Z.
  `deploy/` parity between `v3` and `v3-ai` is empty at the merged head.
- 2026-09-21, `v3-ai` advanced independently to `fd81ae5204`
  (`chore(release): 3.4.0-alpha.81`) while #6197 was open, so the released
  image already carries the transport change that #6198 delivered package-side.
  C6's chart values therefore remain the only inert input.
- 2026-09-21, C4 refreshed now that #6197 is real history. The branch merges the
  merged `v3` tip instead of pre-merge content, so its ancestor chain matches
  `v3`. Six paths conflicted (the `shared-components` manifest now merges
  cleanly, and the auto-merged scope-token test converges because both sides
  agree). Head is `f719d6790e`; `deploy/` is empty against both branches, no
  conflict markers remain, and the release bump to `3.4.0-alpha.81` is
  preserved alongside the dependency union.

## Known failure mode and merge order

The consumer test failures on both PRs match the recorded requirement: the
doc-query-client package must be rebuilt before its consumers' tests run, or
`test-graphql-status` / `test-olat-api-status` fail on stale generated
client artifacts. Treat cancelled CI generations as non-final; judge only the
newest non-cancelled exact-head run.

That diagnosis covered #6198's original type errors. It does not explain
#6197's `check` failure, which is the deploy parity gate described under C3.

Merge order is fixed by branch parity: **#6198 into `v3-ai` first**, then
**#6197 into `v3`**. Reversing it is expected to break v3/v3-ai parity
because both PRs carry overlapping transport files against different bases.

## Slices

### C1 — Stabilize #6198 exact-head CI (met 2026-09-21)

Do: on `rs/doc-query-scope-auth-ai`, rebuild the doc-query-client package
(`pnpm --filter @klicker-uzh/doc-query-client build`) and commit any
regenerated artifacts the repository tracks; rerun the failing suites
locally (`test-graphql`, `test-olat-api`, `check`). Then let the queued
CI generation finish and read the newest non-cancelled run.

Check: newest non-cancelled exact-head generation green on all required
checks; no source changes beyond the rebuild and review fixes.

Result: met. See the execution log and the C1 receipt; there was no tracked
artifact to commit and no source change was needed beyond the review fix that
landed before this run.

### C2 — Merge #6198 into v3-ai (gated)

Do: merge after C1 green plus required reviews. Record the squash SHA.

Check: `v3-ai` contains the doc-query-client scope-token module and the
authenticated `docQuerySources` service.

Result (2026-09-21): merged as `938c0f4dad`. `v3-ai` carries
`packages/doc-query-client/src/docQueryScopeToken.ts` and the chart
`docQuery.scopedMcp` defaults.

### C2b — Promote the v3-ai chart revision to v3 (gated, added 2026-09-21)

Do: after C2, open a `chore(deploy): promote the v3-ai chart revision to
v3` pull request that copies `deploy/` from `v3-ai` to `v3`, following
the #6124 precedent. This restores `deploy/` parity and is what puts the
scoped-MCP chart keys into the revision production renders.

Check: `node .github/scripts/deploy-parity.cjs --other v3-ai` exits 0
against the resulting `v3`, and the chart renders with the promotion
applied.

Verified content (2026-09-21): plain `origin/v3` versus `origin/v3-ai`
differs under `deploy/` in exactly five paths — the three v3-ai-only drift
paths (`cm-hatchet-workers.yaml` gains the `KB_INGESTION_TIMEOUT_SECONDS`
bound from #6184, both environment values files drop the interim KB kill
switches) plus the chart-side kill-switch removal in `values.yaml` and
`cm-backend-graphql.yaml`. The environment-file part is semantically inert:
it removes an explicit `kbIngestionDisabled: false` / `kbGraphDisabled:
false` pair and one commented-out line. The chart part removes support for
the interim incident switch, which #6184's durable timeout replaces. After
C2 the promotion is a verbatim copy of `deploy/` from `v3-ai`, so the
parity check holds by construction rather than by coincidence.

Pre-verified 2026-09-21 by executing the gate against a simulated C2b: exit 1
against pre-promotion `v3-ai` (four paths), exit 0 against post-C2 `v3-ai`.
`helm template` against `deploy/env-uzh-stg/values.yaml` renders zero scoped
keys with default values, all three keys in both ConfigMaps when the triple is
set, and fails on a partial set.

Delivered (2026-09-21): PR #6224 `chore(deploy): promote the v3-ai chart
revision to v3` on `chore/deploy-promote-v3ai-chart`, a verbatim copy of
`deploy/` from `938c0f4dad` into `v3`. Seven paths, 52 insertions, 14
deletions, and no `tag:` or `pullPolicy:` line changed. The gate exits 0
against the real `origin/v3-ai`. Awaiting merge.

### C3 — Update and merge #6197 into v3 (gated)

Do: update `rs/mcp-bearer-rotation` onto current `v3` (branch is BEHIND),
resolve the shared transport files against the #6198 outcome if v3 already
carries it via sync, rerun the failing suites, then merge with green CI.

Check: `v3` and `v3-ai` carry equivalent transport auth; parity diff on
the shared files is empty or explained.

Remedy verified 2026-09-21: because the gate attributes divergence only to a
candidate that edits `deploy/`, C2b followed by a source-only #6197 closes
`check`. Dropping #6197's `deploy/` edits costs nothing on `v3`, because
the promotion already carries them plus the three drift paths; the keys stay
inert until C6 sets the values.

Pre-verified 2026-09-21: the source-only variant touches no `deploy/` path,
changes exactly the seven expected paths, and passes the gate (exit 0).

Delivered (2026-09-21): `rs/mcp-bearer-rotation` at `bcbbdbf925`. Its four
`deploy/` files now come from `v3`, leaving the six `apps/chat/**` files
plus `turbo.json`. The gate exits 0 and reports the branch-level divergence
as a warning. The PR description records that #6224 merges first. Awaiting
merge.

Updated (2026-09-21): the branch is now at `e5cf41ec94` after merging current
`v3`. The `v3` ruleset requires an up-to-date branch, so `BEHIND` blocked the
merge even with every context green. The merge was conflict-free, `deploy/`
matches `v3` exactly, and the merge candidate is unchanged at
`725d8c0fd2769b0682b1208fbd8d3827d830be2`. CI re-runs on the updated head.

Blocker found 2026-09-21: the required `check` lane runs
`.github/scripts/deploy-parity.cjs --other v3-ai --base <merge-base>` for
PRs whose base is `v3` (gate added by 50a1549d2c, PR #6160). Production
renders `deploy/` from `v3` while the release images are tagged from
`v3-ai`, so a `v3`-based change that edits `deploy/` must leave the two
branches identical under `deploy/`. The seven divergent paths are four
paths of #6197's own chart wiring plus three paths of v3-ai-only drift
(`cm-hatchet-workers.yaml` gained `KB_INGESTION_TIMEOUT_SECONDS`, and both
environment values files dropped the interim KB kill switches). #6198's
`deploy/` diff is byte-identical to #6197's, so landing #6198 on `v3-ai`
and promoting restores parity.

Resolution: promote first (C2b), then make #6197 source-only by dropping its
`deploy/` edits, which the promotion already carries. Keep
`apps/chat/**`, its tests, and the `turbo.json` globalEnv entries; the
chart keys still arrive from C2b and stay inert until C6 sets
`docQuery.scopedMcp`.

### C4 — Consolidation parity

Do: run the repository's normal v3 → v3-ai consolidation and verify the
scope-token files are identical on both branches.

Check: the transport auth path is equivalent on both branches, evidenced by
the scope-token suites on each side plus an empty `deploy/` parity diff.
Literal file identity is not the criterion: `docQueryScopeToken.ts` is inline
on `v3` (67 lines at `origin/v3`, 126 after #6197) and a four-line re-export
on `v3-ai`, and `packages/doc-query-client` exists only on `v3-ai`. Expect
the consolidation to conflict on that file and resolve it by keeping the
`v3-ai` re-export.

Baseline (2026-09-21): the files are not in parity today. Every `v3` commit
touching them is reachable from `v3-ai`, so the drift comes from `v3-ai`-only
work: the `kbIngestionDisabled`/`kbGraphDisabled` kill switches in
`values.yaml` and `cm-backend-graphql.yaml`, 90 changed lines in
`turbo.json`, and an inline versus re-exported
`apps/chat/src/lib/server/docQueryScopeToken.ts`. Resolve that file
deliberately: #6197 edits the inline copy on `v3` while `v3-ai` re-exports
the package.

C2b restores `deploy/` parity, so C4 ends with an empty parity diff under
`deploy/` and with the scope-token transport files resolved the same way on
both branches. The source files still legitimately differ where `v3-ai`
leads (package-owned token, citation page ranges, kill-switch cleanup); C4's
check is about the transport auth path, not literal file identity.

Pre-flighted 2026-09-21 (receipt:
`project/_local/evidence/2026-09-21-chat-citation-transport-c4-preflight.md`).
`#6224` merged as `faedefc5a9` and `deploy/` parity is empty. Simulating the
post-#6197 consolidation yields seven conflicting paths:
`apps/chat/src/lib/server/docQueryScopeToken.ts`,
`apps/chat/src/services/mcpClients.ts`, `apps/chat/src/services/mcpScope.ts`,
`apps/chat/test/doc-query-scoped-transport.test.ts`,
`apps/chat/test/mcp-clients-scope-token.test.ts`, `turbo.json`, and
`packages/shared-components/package.json`. Keep the `v3-ai` four-line
re-export, keep both `globalEnv` entries, and keep both dependency entries in
the shared-components manifest; the last one is `cytoscape` vs `motion` and
unrelated to this debt.

Delivered 2026-09-21: draft PR #6228 at `17735f22a8`, merged content
resolution per the table above. Two additions to the pre-flight: the
app-side re-export also gains `createDocQueryScopedFetch`, and the
auto-merged `doc-query-scope-token.test.ts` is kept because its assertions
match the package implementation (fresh token per request, credentials
stripped, `redirect: 'error'`, target mismatch, and no fetch when signing
fails).

Refreshed 2026-09-21 after C3 met: #6228 head `f719d6790e`, built from the
real `v3` merge commit `ffcd3297c2` and refreshed against the `v3-ai` release
commit `fd81ae5204`. Six conflicts, same resolutions. The PR is no longer a
draft; its description records the final state.

### Structural-split hazard (needs a decision)

C4's resolution does not stick on its own. The transport files legitimately
differ between the branches (`v3` inline, `v3-ai` package-owned), and a
sync resolution that keeps `ours` only holds for one merge. Once this
consolidation is the common ancestor, the next `v3` → `v3-ai` sync sees
`ours` unchanged, applies `base` → `theirs`, and silently adopts `v3`'s
inline files, reverting the package-owned token without a conflict to review.

Options, cheapest first:

1. A merge driver or `.gitattributes` entry that keeps the `v3-ai` version of
   the transport paths, so the sync never rewrites them.
2. A CI guard in the shape of `deploy-parity.cjs` asserting that
   `apps/chat/src/lib/server/docQueryScopeToken.ts` re-exports the package
   token on `v3-ai`, which turns a silent revert into a failed check.
3. Bring `@klicker-uzh/doc-query-client` onto `v3` and make `v3`'s file a
   re-export too, converging both branches. This is the architectural fix,
   because it removes the divergence rather than guarding it, but it moves
   the package to the mainline and belongs with the multi-tenant Doc Query
   work rather than this debt closure.

### C5 — Citation normalizer PR (gated; proposed: close as already delivered)

Do: rebase `802d25d5d5` onto current `v3-ai` (single commit, two files),
open a new PR replacing closed #5818, run checks, merge. The change consumes
`display_name`, which corpus-import rows already carry, so no data change
is needed.

Check: unit tests for ingestion-reference filtering and the title fallback
chain pass; the PR description names the participant-visible bug it fixes
(links to internal ingestion endpoints instead of public pages).

Finding (2026-09-21): the premise no longer holds. All three behaviors and
their tests are already present on both `v3` and `v3-ai`;
`apps/chat/test/normalize-sources.test.ts` is 708 lines on `v3` and 916 on
`v3-ai`, and both already cover the `.svc`, `.svc.cluster.local` and
`/api/ingestion/resources/` cases. The branch is 473 insertions and 34
deletions stale against `v3-ai` in `apps/chat/src/lib/sources/`, so replaying
it would remove merged work, and a trial rebase conflicts in both of its
files. Proposed disposition: close C5 as delivered, drop the branch, and keep
the evidence in
`project/_local/evidence/2026-09-21-chat-citation-transport-c1-receipt.md`.

### C6 — Promotion and activation (gated)

Do: promote through the repository's standard path
(`v3` → `v3-ai` → `v3-audit` → `stg-release`). The PRs already carry
the chart values and config-map wiring for the scope-token keys; verify the
rendered charts expose them, then roll STG.

Check: STG chat pods come up with the scope-token env resolved; no stored
bearer is used on the KB transport path.

Activation inputs (2026-09-21): the chart exposes exactly three of them, and
they are all-or-nothing. `docQuery.scopedMcp.serverId`, `.legacyUrl` and
`.url` render as `DOC_QUERY_SCOPED_MCP_SERVER_ID`,
`DOC_QUERY_SCOPED_MCP_LEGACY_URL` and `DOC_QUERY_SCOPED_MCP_URL` into both
the Chat and backend-graphql ConfigMaps. All three absent keeps the stored
bearer; a partial set fails chart rendering; all three present binds the
modern KB server to the scoped route, ignores the stored bearer, and signs a
fresh five-minute ES256 token before every outbound request. The server id is
the target environment's KB MCP server row id, so it has to come from that
environment's database and cannot be derived from the repository.

### C7 — Live verification and receipts

Do: on STG then PRD, one student E2E per environment: ask a course question,
confirm the answer cites sources, click every citation and land on a public
page (no `.svc` or `/api/ingestion/resources/` URLs), reload the thread
and confirm sources persist. Check server logs for scope-token
authentication on the KB transport and source-inventory calls. Then write
the values-free receipt under `project/` evidence conventions.

Check: citations resolve to public URLs in a real browser; scope-token auth
visible in logs; rollback path is the previous image tag plus chart values.

## Risks and open questions

- The queued CI generations had not finished at planning time; C1 starts by
  reading their terminal state rather than assuming the recorded failures
  persist.
- #6197 was BEHIND `v3`. The update onto current `v3` merged conflict-free
  (`3cd2724c8c`; none of the base commits touch the PR's files), so only the
  deploy parity gate blocks it.
- The temporary fix stays in production until C6; if it misbehaves before
  then, the rollback is the same temporary path, not this stack.
- Whether PR #5709 activation rides the same promotion train is a separate
  decision under its own plan.

## Authority

This document plans only. Each merge (C2, C3, C5), the promotion and
activation (C6), and any production verification touching live courses (C7
PRD) requires its own approval at execution time.
