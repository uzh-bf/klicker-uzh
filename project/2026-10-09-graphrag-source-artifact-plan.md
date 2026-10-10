# Canonical ingestion input for graph generation

## Approval summary

Graph generation currently downloads source URLs again. Dynamic pages can then
produce bytes different from those indexed for retrieval. Ingestion owns the
canonical parsed input; graph generation should read that admitted input.

The user approved a simpler scope on October 10: [PR #6460](https://github.com/uzh-bf/klicker-uzh/pull/6460) adds no Klicker
schema changes or migrations. Klicker retains its existing source snapshots and
content-hash freshness model. When canonical input is enabled, the dispatch
worker resolves the serving artifact from ingestion, validates its resource,
KB, current serving version and raw digest against the source snapshot, and submits the exact
reference to the graph provider. The provider persists it in its workflow input
and checks the artifact bytes on every generation attempt.

Canonical identity is pinned at dispatch. Automatic parser-only freshness and
request-time parser pinning are deferred. Rebuild graphs deliberately after a
parser change. Missing or revoked canonical input fails before generation;
canonical dispatch never substitutes an origin download. Legacy dispatch remains
available when the deployment selects the legacy mode.

URL admission in canonical mode lets ingestion bind the fetched digest and
MIME. Signed events and polling update the existing serving fields and preserve
the desired blob metadata during pending or failed replacements. Blob and
legacy URL admission retain their existing hash checks. Existing scope,
quota, publication identity and cleanup checks remain in force.

Acceptance is a schema-identical PR, passing synthetic admission, reconciliation,
dispatch and settlement checks, required repository checks and an independent
integrated review. Delivery ends at an updated draft PR and exact-head CI.
Merge, deployment, live refresh/rebuild, activation and paid evaluation remain
separate actions. The OpenRouter final-review waiver still applies.

## Execution details

Approval mode: executable batch. Source edits, focused synthetic verification,
local commits, ordinary task-branch push and draft PR update are authorized.
Execution mode: standard. Target: the live PR base, `v3-ai`. Worktree:
`trees/rs/graphrag-source-artifact-plan`. This revision supersedes the prior
Klicker lineage-storage design; [ingestion MR !229](https://gitlab.uzh.ch/ai-infrastructure/services/data-ingestion/-/merge_requests/229) and [KG MR !36](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/36) retain their
canonical reader and worker contracts.

### Ownership and sequence

Main owns the plan, schemas, graph orchestration, contracts, docs, integration
and delivery. A bounded executor owns ingestion reconciliation and signed
webhook code/tests after the plan is reviewed. Both use the existing modules.

One implementation slice simplifies the complete no-migration adapter. Restore
lecturer configuration/rebuild and student publication code to the existing
raw-digest behavior. Remove the five new database fields and migration. Keep
only the pure canonical-reference hash helper needed to construct the provider
payload; remove database-backed canonical digest calculation and its tests.

Resolve serving references only immediately before a fresh provider dispatch,
using the existing ingestion operation ID. Match scope and the current resource
`activeResourceVersion` (not the desired replacement version); match its raw
source hash; reject deleted or deletion-pending resources. Bound concurrent
lookups. Recover an accepted run before canonical lookup or mode-dependent
rejection. The frozen provider workflow owns retries, including recovery of an
already accepted run. Accept validated v1/v2 terminal results independently of
the current mode flag; do not recompute canonical lineage at settlement. Retain the v2 terminal schema without storing its lineage
in Klicker. Validate existing build/run, raw digest, graph and output-artifact
identities at settlement. Under existing KB/resource locks, reject a successful
result whose current raw source set differs from the build snapshot.

Canonical URL work can have no caller hash until successful activation. Poll v2
while such work is pending, even if new canonical admission is disabled; while
canonical mode is enabled, poll all operations through v2. Keep the caller hash
for blobs. Adopt observed source metadata only when the serving version matches
the desired version. Do not add lineage JSON to unrelated existing columns.
Deletion uses the existing resource deletion contract and cleanup lifecycle.

Remove tests of deleted persistence fields. Keep consequential coverage for
unknown URL hashes, blob hash mismatch, replacement metadata, scoped references,
missing artifacts, flag-off legacy dispatch, accepted-run recovery, terminal
identity and stale raw-source publication. All fixtures are synthetic.

After verification, commit the slice, run simplification and risk review on the
exact range, correct verified findings, and run integrated final review. Update
the existing ADR, roadmap/adoption references and PR description to state the
parser-change limitation and zero migration requirement.

### Delegation Map and test portfolio

The single slice is owned by main. The subordinate executor owns only
`kbIngestion.ts`, `knowledgeWebhooks.ts` and their existing tests: remove lineage
persistence while preserving v2 admission, polling and signed reconciliation.
Main owns all other paths and reviews the executor result against those tests.

Existing provider-dispatch tests change to cover transient scoped lookup,
legacy dispatch and accepted-run recovery after disablement. Existing ingestion
and webhook tests change to cover unknown URL hashes, prior serving state and
blob metadata. Existing settlement tests cover v2 results after disablement and
raw-source drift. Remove database-canonical-digest and stored-lineage assertions.
Reuse unaffected raw-digest, cost, cancellation, deletion and legacy contracts.
No new test modules are required; use synthetic fixtures only.

### Acceptance and boundaries

- Prisma and analytics schemas match the target; no migration remains in the PR.
- Canonical dispatch uses exact scoped references without minting blob source
  URLs or carrying credentials. Missing, mismatched, revoked or deleted input
  cannot fall back to an origin fetch.
- Reconciliation supports v2 URL binding with existing fields; failed/pending
  blob replacement preserves the desired blob, MIME and size tuple.
- Provider workflow input pins canonical references for its own retries; Klicker
  freshness compares original-byte source hashes. Parser changes require rebuild.
- Focused tests, applicable type/lint/format checks, build and exact-head CI
  pass, with limitations reported separately from live staging acceptance.

Use a task-owned disposable runtime for service-backed checks. The retained
runtime cannot resume because its managed Compose baseline differs; a fresh
verification checkout uses the unchanged schema and synthetic fixtures. Regenerate Prisma from the unchanged schema so removed columns cannot hide
in a stale generated client. Do not reset retained data or apply migrations.
Stop and verify the exact runtime after the final runtime-dependent check.
No browser/UI contract changes are planned; screenshots do not apply.

Pause only for a material scope or data boundary change, unavailable required
verification, or a required external action without authority. Routine fixes
continue within this batch. Keep the current PR draft; do not request reviewers.

## Progress

October 10: the user approved the no-database scope and deferred parser-only
freshness. Planner challenge approved the revised contract after correcting
serving-version and flag-independent recovery requirements. Implementation is
complete locally: both schemas match the target, the migration is removed, and
canonical references remain transient until the provider accepts its input.

Focused verification passes: 51 dispatch tests, 129 ingestion/API/maintenance
tests, 47 terminal/accounting tests and 31 signed-webhook tests. The graph package
passes 93 unit tests; its two real-FalkorDB integration tests remain skipped.
All records are synthetic. Initial dispatch negative tests failed because they
omitted the expected rejected promise; corrected assertions now pass.

The retained runtime is stopped with no routes. The fresh verification checkout
is `trees/rs/graphrag-no-db-verification`, with container `default-vo-363da-app-1`.
Managed bootstrap failed during dependency installation; a frozen install and
backend package build succeeded through the ownership-verified Docker container.
Canonical exec also selects an absent directory for this detached checkout.
This verifies source contracts only and does not prove routed application E2E.

Production build passes 27/27; lint passes 7/7; type checks pass after the
redundant canonical deletion condition is removed. Host checks use the current
Devrouter executable explicitly because PATH also contains a stale binary.
A pending URL success learns its hash only after serving cutover, preserving v2
polling during rollback.

The scoped Opengrep run passes with zero findings across 15 TypeScript files;
seven paths are excluded by existing ignore rules. A final source comparison
matches the verification checkout except for import ordering in one test.
Staged Gitleaks review passes with no leaks.

The initial commit was not executed because approval review failed internally.
The user approved a retry, which succeeded at `7c6357f68f`. A conflict-free
normal merge of current `v3-ai` (`4a7040ee36`) produced `cdc0bad98b`. This removes
the misleading reverse diff of two upstream chat fixes. All net Prisma/schema
and migration differences against the actual target are zero.

Integrated verification passes: 63 affected chat tests, chat type checks and the
full production build (27/27). The no-database source matches the previously
tested verification checkout; one test differs only in import ordering.
Substantive package size against target is 2,657 added and 65 removed lines,
mostly existing regression suites. Keep the single cohesive canonical adapter
PR; no new feature or stack is introduced by this simplification.

Native simplifier Ampere completed the immutable no-database slice with no
further evidence-backed reduction. Independent risk review is running on that
same slice. Final integrated review follows; CI is watching the published head.
The updated draft description states no migration, provider-owned canonical
pinning and deferred parser-only freshness. OpenRouter review remains waived.

Canonical shutdown of the disposable verification checkout failed:
`Initial managed stop requires the drained ensure's recorded profile.` Fresh
provider status is `Running`; route inspection finds zero exact routes for both
the verification checkout and original task checkout. Canonical repair is denied
while lifecycle phase is `stopping`; the latest recorded operation is a completed
`exec`, not `ensure`. No stop worker is running. No raw-provider stop, lifecycle
record edits, configuration changes or deletion were used to bypass it. The
original retained task runtime is stopped. This operational limitation remains
separate from the source-contract checks and unqualified routed E2E.

Next: disposition independent risk review, complete integrated final review,
verify exact-head CI, and refresh the draft evidence. No merge, deployment,
live refresh/rebuild, activation or paid evaluation is admitted.
