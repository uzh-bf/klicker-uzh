# Independent ingestion and graph workflows

## Approval summary

The October 11 approval supersedes the canonical-ingestion adapter design.
Keep vector ingestion and KG generation independently operated. Neither workflow
calls the other or requires its operation IDs, reader credentials, parsed output,
or serving-artifact lifecycle. Both consume KB-owned source references and raw
content hashes. Shared document processing remains an independent service.

Simplify existing draft [Klicker PR #6460](https://github.com/uzh-bf/klicker-uzh/pull/6460),
[ingestion MR !229](https://gitlab.uzh.ch/ai-infrastructure/services/data-ingestion/-/merge_requests/229)
and [KG MR !36](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/36).
Remove canonical-reader, v2 admission and provider-payload plumbing. Retain useful
independent correctness fixes and consequential regressions. Add no database
columns, migrations, dependencies or source-storage platform. Preserve ingestion
admission and the existing graph generation contract.

KG verifies the expected raw digest before graph generation. Dynamic URL rereads
can fail that check; they cannot guarantee availability of earlier bytes. Parsing
may already have incurred cost. Producer-owned immutable raw snapshots are a
separate follow-up if reproducibility is required. Automatic parser-only freshness
remains deferred; rebuild deliberately after a parser change.

## Execution details

Execution mode: standard. The previous Astra architecture challenge recommends
this boundary and the user approved its implementation. Existing plan directory:
`project/`. Klicker target is the live PR base `v3-ai`; both provider MRs target
`main`. Reuse their existing task worktrees. Ordinary local commits, non-force
pushes and draft descriptions are authorized. Merge, ready status, deployment,
live refresh/build, activation and paid evaluation remain separate actions.
The OpenRouter review waiver remains in force.

### Ownership and slices

1. Main owns Klicker removal, independent settlement/source-freshness and lock-order
   fixes, existing regression tests, ADR, roadmap and adoption plan. Restore
   canonical-only changes to the held baseline, preserving useful fixes. Generalize
   stale-source rejection to the existing graph result contract. Keep KB-before-
   resource/build lock ordering across settlement, timeout and source reconciliation.
2. One trusted executor owns ingestion's existing changed modules and tests. Remove
   graph-facing export/reader/authentication and canonical-only persistence and v2
   admission. Retain useful standalone changes only when they do not require a new
   public contract, database change or unqualified parser replacement. An empty net
   source diff is acceptable; do not invent work to preserve an MR.
3. A separate trusted executor owns KG's changed workflow modules and tests. Remove
   ingestion-reader configuration, canonical envelope/payload/recipe/result fields
   and canonical-only scratch lifecycle. Retain raw-source extraction, digest
   rejection and provenance; prove independent preparation with synthetic inputs.
4. Main integrates outcomes, checks complete net diffs and database equivalence,
   runs exact-range simplification/risk and integrated review, commits/pushes and
   updates the existing drafts with current evidence. No UI behavior changes are
   intended, so screenshots are not applicable.

### Test portfolio

| Behavior at risk                                    | Obligation and primary seam                            | Distinct failure                                                                    |
| --------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| KG independent preparation and source identity      | Extend existing KG workflow tests                      | Ingestion unavailability blocks KG, or changed bytes reach generation               |
| Source replacement/deletion during graph completion | Extend existing PostgreSQL accounting tests            | A stale/withdrawn source graph is published or metering is lost                     |
| Timeout/completion concurrency                      | Retain existing deterministic accounting regression    | Inconsistent KB/build lock order deadlocks metered or unmetered completion          |
| Ingestion replacement metadata                      | Retain applicable existing polling/webhook regressions | Desired blob name, size and MIME become inconsistent with prior serving state       |
| Existing admission and provider contracts           | Run existing worker/API/terminal suites                | Removing canonical plumbing changes ordinary payload, recovery or scope enforcement |

Use synthetic fixtures and existing test files. Tests must not pin prose, seed
contents or absence of implementation symbols. Provider-only changes do not prove
live consumer quality. Required checks and source reviews qualify source delivery;
staging serving, student map acceptance and retrieval evaluation need separate
receipts. Use existing guarded disposable test infrastructure only; do not reset
retained databases or provision new cluster connectivity.

## Progress

October 11: implementation is simplified in all three existing task branches.
Klicker retains source-freshness, accounting lock-order and replacement metadata
regressions. Ingestion retains only signed-URL credential rejection. KG restores
its existing raw-source preparation and adds synthetic independence/digest tests.
There are no net database, dependency, canonical-reader or v2 contract changes.

Klicker verification passed: 27 build tasks, 42 check tasks, seven lint tasks,
repository guards, 40 host-launcher and 93 Playwright CI contract tests, focused
PostgreSQL and worker suites, staged formatting and secret scan. The source scan
reported no findings. Ingestion reports 160 passing tests and 36 skips plus Ruff
and targeted type checks. KG lint and format pass; 71 workflow, recipe and terminal-contract tests passed
using an existing Python 3.12 environment against the task worktree.

The existing disposable verification checkout was stopped with the user-approved
`devsy workspace stop volumes-home-git-klicke-15871e75` fallback after canonical
stop rejected its existing reliability record. Source identity matched
`trees/rs/graphrag-no-db-verification`; provider state is `Stopped`, its application
container exited, and no exact checkout routes remain. Worktree and data remain.
The old cleanup-blocked native goal is complete. The new independent-workflow
simplification goal is active. Exact-range reviews and draft updates completed, and all nine required checks
passed at Klicker head 794091d1, including all eight actual Playwright shards.
Ingestion pipeline 681053 and KG pipeline 681059 passed on their pushed heads.
A subsequent lock-order correction requires fresh Klicker verification and CI.

The exact-range simplification pass inspected all 19 changed paths across the
three held ranges. Its duplicate success-test finding was accepted: merge the
null-error assertion into the existing idempotent successful-publication test and
remove the redundant new case. Replacement, deletion and forced concurrent
settlement regressions remain. The stale adoption-plan contract sentence was
corrected. Risk and integrated final reviews passed after the KG protocol/control
correction. Fresh forge feedback then revealed a reachable shared-KB/quota cycle:
a newer dispatch failure can hold quota while an older settlement holds KB.
The correction locks KB and quota before the first build write in all four
failure paths, with forced PostgreSQL regressions for late success and failure.
Settlement classification now uses one explicit precedence chain. Existing source,
claim, quota and publication contracts remain unchanged. Verification uses isolated
one-shot containers and CI; the managed verification runtime remains stopped.
