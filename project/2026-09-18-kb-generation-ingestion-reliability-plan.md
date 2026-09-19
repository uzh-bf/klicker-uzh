# KB ingestion and question-generation reliability

## Metadata

| Field | Value |
| --- | --- |
| Primary repository | `uzh-bf/klicker-uzh` |
| Provider repository | `ai/data-ingestion` (`origin/main`) |
| Generation repository | `klicker/kg-content-generation` (`origin/feat/question-generation-hatch-workflow`) |
| Branch | `rs/kb-generation-ingestion-reliability` |
| Target | `v3-ai` |
| Approval mode | `direction-only` — this plan fixes the diagnosis, sequencing, and contracts; each package asks for its own execution ruling |
| PR/MR | none yet |
| Evidence base | STG end-to-end pass on 2026-09-17 (KB `355f529c-1ddc-48f4-982c-26fcb40b5fab`) |

## Approval summary

A staged end-to-end pass over the showcase features on STG found the knowledge-base and
generation path structurally sound but carrying four defects that turn ordinary user
actions into dead ends. Two real websites fail to ingest and then sit in "Processing"
forever with no failure state. An English question build fails after 0.3 seconds with a
generic workflow error, because Klicker never sends a language and the worker defaults
every knowledge base to a German policy. A German build fails at the Apply level because
the grounding gate cannot find a script anchor in a two-source knowledge base, and the
UI discards the worker's actionable explanation. Dynamic pages fail with a bare
`digest_mismatch` caused by the accepted two-fetch design.

This plan fixes the fetch worker's missing User-Agent, makes a failed upsert reach a
terminal state that Klicker can display, surfaces per-slot generation failures instead
of a generic message, and closes the language trap. URL content identity stays a design
item behind an ADR, because it changes who owns the accepted-snapshot contract.

Unchanged: the grounding gate itself, the all-or-nothing plan rule, the material-type
filter that keeps administrative uploads out of graphs, and every existing public
webhook contract.

## Execution details

### Problems, evidence, and binding contracts

**P1 — Website ingestion fails for two unrelated reasons.** `https://en.wikipedia.org/wiki/Diversification_(finance)`
returns `SnapshotFetchError: source_fetch_failed`; `https://www.df.uzh.ch/en.html`
returns `digest_mismatch`. Verified in `modules/ingestion/src/ingestion/source_snapshot.py`
at `origin/main`: the request at `_fetch_bytes` builds only `Accept`, `Connection`,
`Host`, and an optional `Authorization`, so no `User-Agent` is sent and a 403 becomes
a generic fetch failure. Klicker already sends `KB_SOURCE_USER_AGENT` from
`packages/hatchet/src/kbIngestionApi.ts`, so the two sides disagree about who may fetch.

**P2 — A failed ingestion never becomes a visible failure.** Both failed links read
`Processing` / `Not available yet` at 20:32, 21:00, and 21:25 with the counter stuck at
`0 need ingestion · 0 failed attempts · 2 already in progress`. Klicker maps
`resource.processing_failed` to `KBResourceStatus.FAILED` in
`packages/graphql/src/services/knowledgeWebhooks.ts`, and the ingestion workflow registers
`@resource_upsert_wf.on_failure_task()` in `workflows/resource_upsert.py`. That hook calls
`fail_unclaimed_upsert(..., failed_run_id=ctx.workflow_run_id)`, whose guards in
`resource_upsert_store.py` can return `claimed` or `duplicate` without transitioning the
row or enqueuing a status event. The exact branch that fires on STG is unconfirmed and must
be reproduced before the behaviour changes; the safe contract for this package is that a
claimed-but-aborted upsert always reaches a terminal state and emits exactly one status
event.

The silent returns are `:653` (the row was fenced: `failed_run_id` differs from
`hatchet_run_id`, an activation is in progress, or the row is no longer the current upsert),
`:657` (`claimed`), and `:681` (`duplicate` when a compare-and-set loses); the hook body
additionally swallows an unexpected state into a log line,
`Resource-upsert repair_required operation_id=...` (`workflows/resource_upsert.py:366`).
Three candidate mechanisms must be separated during reproduction: the run was fenced by the
stale-reclaim sweeper before its failure hook ran (`resource_operations.py:98` nulls
`hatchet_run_id`), the row was superseded (`_is_current_upsert` at `:298`), or another
activation was in progress. The `repair_required` line names the operation id and is the
cheapest first evidence to pull from the STG worker logs.

**P3 — Question-generation failures lose their explanation.** Build `80c3b638-f44d-463a-8f3c-a8c05e206cd4`
(English) failed after 0.3 s with `ValueError: policy or recipe language does not match the
question build` from `question_stage_contracts.py`. Build `b33d7d56-161e-4692-8056-f12c904b7866`
(German, Understand + Apply) failed at `generate-stems` with
`blueprint generation is all-or-nothing` after repeated
`script_anchored requires at least one relevant supporting script anchor` rejections for
`q02`, while `q01` was accepted. The worker printed both the per-slot reasons and the
remediation ("review that slot in a new design version or add the missing source material"),
and the UI showed only "Question-generation workflow did not complete" / `WORKFLOW_FAILED`.
A one-element German build with Understand only (`97cafb82-24f6-4b95-a06a-195b5fa5d2b4`)
completed 1 of 1, so the pipeline itself is healthy. The generation form pre-selects
Understand and Apply, which means the default configuration can fail on thin material.

**P4 — The language contract cannot be satisfied.** Klicker's `ExternalKBGraphPayload`
(`packages/hatchet/src/kbGraphIngestionApi.ts:47`) has no language field, so the worker
default `CourseKGInput.language: Literal["German", "English"] = "German"`
(`lightrag_research/hatchet_workflows/schemas.py:232`) resolves every knowledge-base policy
to German. The question build does carry a language from Klicker
(`packages/graphql/src/services/questionGeneration.ts:313` and `:612`, typed `'de' | 'en'`
at `questionGenerationRuntime.ts:35`), and `question_stage_contracts.py:226` translates it
into `expected_language` before requiring the resolved policy and recipe to match. An
English selection therefore contradicts a German policy every time. Binding contract for the
fix: the language offered for a generation must be the language the knowledge base's policy
actually carries, and a divergence must be rejected before dispatch. The policy language is
fixed when the graph is built, and nothing Klicker can read today reports it.

**P5 — URL content identity depends on a two-fetch byte match.** Klicker computes
`expected_sha256` from its own fetch; the worker re-fetches and requires an exact digest
match in `fetch_source_snapshot`. Dynamic pages change between the two fetches. The
2026-08-26 KB ingestion MVP plan records this as a staging-only compromise and states that
the later production design should let the provider consume the immutable accepted snapshot.
Changing digest ownership reopens the ADR gate.

### Staging environment finding (2026-09-18, read-only)

A read-only check of the STG cluster narrows the stuck-operation symptom, and changes who
owns it. Two non-catalog operations in project `klicker-course-materials` were created at
2026-09-17T18:32:25Z and 18:36:48Z and both received `resource.dispatch_requested` and
`resource.processing_started`; their outbox then stops. No `resource.processing_failed`,
`error_code` NULL, `hatchet_run_id` set, `updated_at` frozen at creation, and no
`repair_required` line or `resource_upsert` trace in any ingestion worker log over the
preceding 26 hours.

The fetch worker is demand-scaled from zero. ScaledObject `ingestion-resource-fetch-worker`
runs `minReplicaCount 0 / maxReplicaCount 1` with two `metrics-api` triggers against
`ingestion-resource-dispatcher-health.stg-ingestion.svc.cluster.local:8001/internal/scaling/demand`
(`resource-fetch.queued.total`, `resource-fetch.running.total`, 300 s cooldown). Its only
task registration is `workers/resource_fetch_worker.py:37`, consumed at
`workflows/resource_upsert.py:101`. KEDA scaled that deployment 0→1→0→1→0 between 18:32:28Z
and 18:45:08Z, so a worker existed in two roughly five-minute windows spanning both
creations. It sits at zero now, with `ScalerNotActive` and an `<unknown>` HPA metric,
while both operations still read `running`.

So `resource-fetch.running.total` reports no demand for work the ingestion database still
records as running: nothing scales the worker up, and nothing reclaims the rows. That was
measured directly, not inferred: the dispatcher's `/metrics` endpoint emits no
`oldest_running_age_seconds` sample for any worker type, and its only non-health series are
the two durable-wait gauges, both at zero.

The mechanism is now proven, and it is the defect class A2 names. The shipped operator tool
`ingestion.tools.reconcile_terminal_upsert` documents it: a resource-upsert run whose fetch
step is cancelled while it waits for a worker never executes the workflow failure hook,
because the on-failure step is skipped for a cancelled parent. The operation then stays
`running` with no worker ever assigned. That is what the KEDA flap produced: the worker was
scaled to zero roughly 60 s after each creation, the fetch task waiting for it was cancelled,
and the hook that would have written a terminal state never ran. Running the tool in its
default dry-run mode against both operations returns `outcome: would_fail` with
`lease state: absent`, so each is eligible to be closed with exactly one
`resource.processing_failed` event.

Reclaim cannot compensate, and that is deliberate rather than a misconfiguration.
`INGESTION_RESOURCE_RECLAIM_ENABLED` defaults to `false`
(`workers/resource_dispatcher.py:37`) and the STG dispatcher sets no
`INGESTION_RESOURCE_RECLAIM_*` variable at all. The documented enablement gate is that
every worker pool registering `resource-upsert` uses the generation-aware contract, since
replacement events carry a reclaim generation an older strict input contract rejects. The
reclaim predicate already matches both rows on every condition: `operation='create'`,
non-null `hatchet_run_id`, older than the stale threshold, and no live source lease. The
sweep would close this gap as soon as it is enabled on those documented terms.

Two further mechanisms add risk. The worker has no baseline replica, so an in-flight fetch
loses its pod when the demand signal goes quiet. And the demand signal is served by a single
dispatcher pod: KEDA logged `connection refused` for that endpoint across every ingestion
ScaledObject at 18:29-18:48Z on 2026-09-17 and again at 07:00:41-07:00:51Z on 2026-09-18,
each window spanning a dispatcher rollout.

Baseline replica, dispatcher resilience and enabling the reclaim sweep are cluster and
GitOps changes for `app-ai-generic-ingestion-stg` with their own approval. P1, P2, A2 and
A3 keep their value as the source guarantees that make this class of stall observable and
terminal, and V1 cannot succeed until the worker can run. The `SnapshotFetchError` and
`digest_mismatch` codes from the 2026-09-17 pass must be re-attributed before reuse as
acceptance evidence.

**Already correct, no work planned.** The graph build already restricts sources to
`materialType: COURSE_CONTENT` with a comment that administrative uploads must not reach
graph nodes, and rejects an empty selection with `KB_GRAPH_NO_COURSE_CONTENT`
(`packages/graphql/src/services/knowledge.ts`). All four resources in the STG test knowledge
base already carried `COURSE_CONTENT`, so material typing was never the cause of the
generation failure.

**Non-goals.** No change to the grounding gate's strictness, to the all-or-nothing plan
rule, to the material-type filter, or to the LTI launch contract. No new user-facing
knowledge-base language setting in this plan.

### Ownership and sequence

Delegation Map. Executors: Klicker slices are eligible for the configured external
executor because that repository is public; `data-ingestion` and `kg-content-generation`
are private and run on the trusted route with the same contract.

| Workstream | Slices | Execution owner | Dependency | Acceptance boundary |
| --- | --- | --- | --- | --- |
| Ingestion | A1, A2, A3 | executor (trusted route) | none | Focused tests in `modules/ingestion/tests` plus a live STG re-ingest of both failing URLs |
| Generation transparency | B1, B2 | executor | none | A failing build shows per-slot reasons and remediation in the UI |
| Language contract | C1 | main (cross-repo contract decision) | none | An English build is either impossible to request or succeeds by design |
| URL identity | D1 | main (design) | ADR ruling | A written ADR disposition, not code |
| Re-verification | V1 | main | A, B, C merged and deployed | Repeat of the 2026-09-17 pass with the same evidence shape |

Sequencing: A1 first because it is small, independently verifiable, and unblocks the live
re-ingest used as acceptance for A2 and A3. B and C are independent of A and of each other.
D blocks nothing else and is intentionally last.

### Slices

**A1 — Send a descriptive User-Agent from the ingestion fetch worker.**
Change the single header construction in `source_snapshot.py:258` to include the same
user-agent Klicker uses, sourced from configuration with that value as the default.
`Acceptance:` a focused test asserts the header on the outgoing request, and a live STG
re-ingest of the User-Agent-gated URL reaches `READY`. The dynamic-page URL is not part of
this acceptance; it belongs to D1.

**A2 — Guarantee a terminal state for a claimed upsert that aborts.**
Establish first that an aborted run reached a failing task: confirm the operation, its run,
and which task was left pending, because the failure hook only runs for a run that aborted.
The reproduction is a test that claims an operation and then fails the fetch, asserting a
terminal status and exactly one `resource.processing_failed` event, and
separate the three candidate mechanisms named under P2. Then close the gap in
`fail_unclaimed_upsert` or in the failure hook, whichever the reproduction identifies, and
replace the log-only `repair_required` outcome with an escalation that cannot be missed.
`Acceptance:` the new test plus the existing resource-upsert suites pass; no double event is
emitted for an already-terminal operation; a non-terminal hook outcome is observable without
reading worker logs.

**A3 — Bound the existing stale reclaim so a stuck upsert terminates.**
The ingestion service already reclaims abandoned upserts by clearing `hatchet_run_id` and
re-dispatching them: `resource_operations.py:98` `reclaim_stuck_upserts`, driven by
`INGESTION_RESOURCE_RECLAIM_STALE_SECONDS` in `workers/resource_dispatcher.py:126`. An
upsert that fails deterministically is therefore requeued again and again instead of failing,
which is what keeps a broken link reading "already in progress". Its candidate predicate also
requires `operation IN ('create', 'update')`, a non-null `hatchet_run_id`, and no live
`source_lease` row for the source, so a stale lease or an unexpected operation value blocks
reclaim just as effectively. The reproduction must show which condition held for the two STG
rows, because it decides whether a reclaim bound is sufficient on its own. Extend that path with a
bounded reclaim count that terminalizes the operation and emits
`resource.processing_failed`, and keep the Klicker side as a secondary monitor that reuses
the graph-build shape (`packages/hatchet/src/kbGraphIngestion.ts:1043-1100`, error code
`KB_GRAPH_TIMEOUT`). `Acceptance:` a test drives an operation past the reclaim bound and
asserts a terminal failure with exactly one status event, plus a monitor test for the
Klicker-side fallback.

**B1 — Surface per-slot generation failures and remediation.**
Carry the worker's terminal detail (failed slots, per-slot reason, remediation) through the
generation runtime into the review UI, replacing the generic message for the
`WORKFLOW_FAILED` case. `Acceptance:` a failing build renders the failed slot identifiers
and reasons; the existing generation runtime tests still pass.

**B2 — Stop the form from promising what the material cannot ground.**
Klicker cannot know before dispatch whether the sources can supply a script anchor: the
anchor is produced during graph construction and enforced at stem generation. The form's
promise has to change rather than its validation. Stop pre-selecting Apply, state the anchor
rule in the form's help text, and let B1's per-slot reason carry the actionable explanation
after the fact. Do not change the gate. `Acceptance:` the form opens without a
script-anchor level pre-selected, and browser verification confirms the remaining levels are
still dispatchable.

**C1 — Bind the offered language to the knowledge base policy.**
Today the policy language is always German, because Klicker sends none on the graph payload
and the worker defaults to German. The smallest correct change is therefore to offer only
the language in force for the knowledge base and to reject a divergent dispatch server-side
with a specific error code. No schema change is needed while that invariant holds, and the
invariant should be asserted where the payload is built. Give Klicker real language
ownership later, behind its own decision: send the language on the graph payload and give
the knowledge base a stored language the generation reads back. `Acceptance:` the form
offers only the language in force; a forced divergent dispatch is rejected with a specific
error code rather than a workflow failure; an assertion fails if a knowledge base can exist
whose policy language differs from the offered one.

**D1 — Decide URL content identity.**
Record an ADR disposition for who owns the accepted snapshot, then either adopt the
single-fetch design or document the supported URL classes and their failure modes.
Dynamic pages stay outside the A/B/C milestone: they are excluded from the slice acceptance
checks and from V1's success criteria, and D1 owns their follow-up package. `Acceptance:` an
ADR in `docs/adr/` and a concrete follow-up package or an explicit decision to leave the
two-fetch design in place.

### Test portfolio

One row per consequential behaviour. Existing coverage is preserved; no test pins prose.

| Behaviour | Obligation | Primary seam | Distinct failure | Slice |
| --- | --- | --- | --- | --- |
| Fetch sends a descriptive User-Agent | add new | `source_snapshot.py` header construction | A host rejects the request and the failure is indistinguishable from an outage | A1 |
| A claimed aborted upsert becomes terminal | add new | `resource_upsert_store` with the failure hook | A resource remains in progress forever with no status event | A2 |
| Stale processing terminalizes after a bounded reclaim | extend existing | `reclaim_stuck_upserts` | A deterministically failing resource is requeued forever | A3 |
| Failed builds expose per-slot reasons | extend existing | generation runtime terminal payload | Users cannot act on a failure they cannot see | B1 |
| The form does not promise a level the material cannot ground | add new | generation form default state | The default configuration fails on thin material | B2 |
| Language offered matches policy language | add new | generation dispatch validation | A permitted selection can never succeed | C1 |

Live third-party fetches stay manual STG terminal evidence; they never become an automated
suite dependency.

### Verification

Repository-native checks per slice, then one live STG pass as the package-terminal
evidence: create a knowledge base, ingest one PDF, one static example-style page and the
User-Agent-gated URL that previously failed, generate a graph, run a question build at the
offered language, use the chatbot in preview, and re-verify the LTI entry path. Before
anything else, confirm that the STG `ingestion-resource-fetch-worker` has a running replica
and an active ScaledObject; the pass is meaningless while no worker can run a fetch. The
2026-09-17 evidence shape is the baseline to compare against, with the previously observed
failure signatures re-attributed first. The dynamic-page URL is expected to still fail and
is not a V1 success criterion.

The OLAT embed has no code change here. Its config, service health, and third-party-initiated
login redirect are verified; a signed launch still requires one click from an OLAT testbed
account, and that remains an explicit blocker rather than a claim.

### Working context

Implementation lives in `trees/rs-kb-generation-ingestion-reliability` in the primary
repository, with repo-local worktrees in `data-ingestion` and `kg-content-generation`.
Preserve unrelated dirty files. Merging, deployment, and cluster changes are not
authorized by this plan.

## Progress

Status: delivery. Plan drafted 2026-09-18, revised the same day after one adversarial
challenge round.

Required planner gate: BLOCKED. The configured planner role is the Codex `planner` at
GPT-6 Astra medium, and the Codex account is out of quota until 2026-09-20 10:36 CEST
(`resetsAt` 1789893393, re-checked 2026-09-18T07:05Z; `ordinaryUsageAllowed: false`,
weekly window at 100%). The one permitted same-provider
continuity child (`gpt-5.6-sol` at xhigh) failed terminally with the same limit, and the
ladder permits no third child.

Optional cross-provider rival pass: DELIVERED with a disclosed limitation. AGY Gemini 3.8
Flash at high authenticated, but its headless mode auto-denies the `command` and `read_file`
permissions, so no provider could inspect the repositories; the pass ran on the frozen draft
plus a requester-quoted evidence bundle. Verdict `findings`, roughly 21 KB of response at 39k
input and 31k output tokens. Accepted: the unsatisfiable workstream-A acceptance, the
reclaim-loop placement of A3, the unnecessary migration in C1, the infeasible pre-dispatch
B2 check, the missing B2 test row, and the D1 scope gap. Rejected: the claim that
`hatchet_run_id` is unset because `record_snapshot` is never reached, since the
`acquire-and-claim` task sets it before the fetch task and `resource_upsert_store.py:425`
re-adopts a reclaimed row.

Also unavailable: Claude CLI (OAuth session expired), and the GLM fallback, which is
ineligible because this plan covers private repositories and internal staging evidence.
- Done: STG end-to-end diagnostic pass; the defects pinned to source with live evidence; one
  adversarial challenge round arbitrated into the plan; a read-only STG cluster diagnosis
  that pinned the stall to a cancelled-parent run whose failure hook never fires, plus a
  dry-run of `reconcile_terminal_upsert` showing both stuck operations eligible
  (`would_fail`, no lease).
- Delivered: A1 in `trees/rs-resource-fetch-user-agent` on
  `rs/resource-fetch-user-agent`, commit `5704586`, draft MR
  `ai-infrastructure/services/data-ingestion!191`. Focused suite 39 passed, ruff check
  and format clean. Live re-ingest acceptance still needs a running STG fetch worker.
- Delivered: A3 in the same MR, commit `88b40c6` — bounded reclaim closes an upsert that
  exhausts its budget as `resource_reclaim_exhausted` with one
  `resource.processing_failed`. 49 passed against a throwaway Postgres; ruff clean.
  MR !191 description rewritten to cover both commits; pipeline #667370 green on
  `api-postgres`, `unit`, `check`, `worker-isolation`, `test-cli`, `test-shared`.
- Delivered: B2 (understand-only default; commit `91f9f36d7d`) and C1 (language bound to
  the policy; commit `8fc3e8b6cc`) and D1 (ADR 0049; commit `9f5ce9f7d8`) in
  `trees/rs-kb-generation-ingestion-reliability` on `rs/kb-generation-ingestion-reliability`,
  draft PR `uzh-bf/klicker-uzh#6143` targeting `v3-ai`. GraphQL and types checks clean;
  102 focused unit tests pass, including the new language invariant.
- A2 re-scoped: its premise is refuted. A cancelled parent skips the `on_failure` step
  entirely, so the hook can never repair that case; A3's bounded reclaim is the durable
  fix for the observed STG stall. The remaining value is claimed-but-aborted runs that are
  not cancellations, which no evidence yet shows on STG. A2 is closed as no-work unless
  such a case appears.
- B1 deferred by evidence: the generation worker writes no per-slot failure detail into a
  terminal artifact — its failure manifests are strict and reject extra fields — so
  surfacing reasons needs a worker-side schema change in the private
  `kg-content-generation` repository. It stays a separate follow-up package.
- V1 executed 2026-09-18 (live STG pass, in-app browser session as the logged-in lecturer).
  KB `355f529c-1ddc-48f4-982c-26fcb40b5fab`: re-ingested all sources. The fetch worker
  scaled 0 to 1 on demand (`Active=True`, ready in ~60 s), so a worker can run a fetch when
  demand is reported. `www.df.uzh.ch`, the 2026-09-17 `digest_mismatch` symptom, now
  reaches `Succeeded Version 2` and is `Available to AI`. The User-Agent-gated Wikipedia
  URL still fails with `SnapshotFetchError: source_fetch_failed` in the worker log and then
  reads `Processing` with no terminal state, exactly the pre-A1/A3 behaviour, because
  `ingestion-worker:main` on STG is still `219a075` and reclaim is disabled. Question
  generation completed 6 of 6 (`completed_with_review`, 0 unresolved, 0 warnings, 72.6 s)
  on the Understand-only configuration; elements carry semantic titles and suggested tags.
  The chatbot owner preview answered a KB-grounded question and cited
  `FinanceI_Skript_HS26.pdf` (pp. 152, 172), so retrieval works. All STG services are
  healthy and the OLAT/LTI routes respond (401/403, expected auth).
- V1 re-attribution: the previously stuck STG operations now display a terminal `Failed`
  state, so the "in progress forever" symptom the plan diagnosed has already cleared on STG
  independently of this work. The remaining live defect is the Wikipedia fetch failure plus
  the missing terminal transition, both fixed in MR !191 and awaiting deployment.
- Confirmed missing on STG (deploy gate, not source): the form still pre-selects Understand
  and Apply, still offers English next to a German policy, and still shows the old help text,
  because STG runs `v3-audit` (`a0dd1decbb`) while the fixes sit on
  `rs/kb-generation-ingestion-reliability` and are not yet in `v3-ai`.
- Ready to review: PR #6143 (5 commits, ordinary feedback settled, no failing checks) and MR
  !191 (pipeline #667370 green). MR !191 is not draft but carries `need_rebase` (2 commits
  behind `main`); rebasing is a history rewrite and needs explicit authority.
- Next action: merge PR #6143 into `v3-ai` and MR !191 into `main`, deploy through the
  `v3-audit` STG line, then re-run the Wikipedia and English-language acceptance checks.
  Cluster and GitOps items (baseline fetch replica, dispatcher metrics resilience, enabling
  reclaim) sit behind their own approval.
- Test delta: `test_source_snapshot.py` +2; `test_resource_reclaim_postgres.py` +2;
  `questionGenerationConfiguration.test.ts` +1.
- Resolved blocker: the local data-hygiene commit hook flagged the two `packages/i18n`
  help-text edits. The finding was reproduced and attributed to the pre-existing
  login label at `en.ts:653` / `de.ts:664` (the seeded lecturer password field), a false
  positive of the hook's credential-assignment rule, not the edited help text. Committed as
  `c3322782bb` with the approved one-commit bypass; Biome and Prettier clean.
- Shipped: PR #6143 merged into `v3-ai` at `8e5a92935f` (2026-09-18T14:40:58Z). MR !191
  rebased onto refreshed `main` and merged at `9b57fdd` (ff); its pipeline #667639 was green.
  Sync PR #6146 (`rs/v3-audit-sync-20260918d` -> `v3-audit`) merged at `8c1ec75b58`; the
  eight required `v3-audit` contexts were green, and the advisory `ocr-review` failure was a
  hosted provider error (0 tokens, 1 s), not a code defect.
- STG promotion executed. STG deploys from `v3-audit` via `deploy-stg-promote.yml`
  (`STG_SOURCE_BRANCH=v3-audit`, `STG_RELEASE_PROMOTION_ENABLED=true`). The `v3-audit` push
  at `8c1ec75b58` ran the full stg check/build set (24 workflows); all succeeded. The
  `build-images-status` gate (`Build Fallback`) failed once on a queue race (60 attempts
  elapsed while `v3_backend-docker-stg.yml` was still queued), then passed on rerun. The
  promoter advanced `stg-release` `e00f2719 -> 8c1ec75b58`; ArgoCD `app-klicker` auto-synced
  and all 19 `stg-klicker` deployments rolled to `8c1ec75b58` (frontend-manage, backend-graphql,
  chat, lti, olat-api, mcp-lecturer/-student).
- V2 executed 2026-09-18 (live STG pass after the promotion, in-app browser as the logged-in
  lecturer). B2 confirmed: the generation form pre-selects only Understand (Apply/Remember/
  Analyze/Evaluate unselected) and renders the thin-material help text. C1 confirmed: the
  Language control offers German only. Ingestion A1 confirmed end-to-end at the code level:
  fetching `https://en.wikipedia.org/wiki/Diversification_(finance)` through the deployed
  worker image (`cf25d9d6`, includes !191) returns 380 KB of HTML, and the deployed
  `source_snapshot.py` sends the descriptive `User-Agent`. Chatbot owner preview answered a
  KB-grounded question with two tool calls and cited `FinanceI_Skript_HS26.pdf` (pp. 78, 103,
  159, 170-172). OLAT/LTI routes and STG services are healthy (`olat-api` `/health` 200, LTI 401).
- Open STG defect (live, blocking one acceptance check): the Wikipedia resource is still
  `Processing Version 2` and cannot be re-fetched. Ingestion state shows one stale
  `ingestion_operation` row `op_d6e26e65...` left `running` since 2026-09-18T13:57:30Z by the
  pre-fix worker, whose fencing blocks a new attempt ("1 already in progress"). A3's bounded
  reclaim would terminalize it, but `INGESTION_RESOURCE_RECLAIM_ENABLED` is unset on STG
  (defaults to false). Enabling reclaim is the plan's cluster/GitOps item and needs its own
  approval; the code fix itself is deployed and verified.
- Reclaim applied on STG 2026-09-19 (user `apply` instruction) as two GitOps changes on
  `ai-infrastructure/deployment` `main`, auto-synced by ArgoCD app `ai-generic-ingestion-stg`
  (`enableAutoSync: true`, path `ingestion/stg-generic`, revision `main`):
  - `03db1375` ([!930](https://gitlab.uzh.ch/ai-infrastructure/deployment/-/merge_requests/930))
    sets `INGESTION_RESOURCE_RECLAIM_ENABLED: "true"` in `ingestion/stg-generic/cm.yaml`.
  - `411ff169` ([!931](https://gitlab.uzh.ch/ai-infrastructure/deployment/-/merge_requests/931))
    adds `reloader.stakater.com/auto: "true"` to `ingestion-resource-dispatcher-deployment.yaml`.
    The dispatcher calls `_reclaim_enabled()` once in `main()`, and the shared `ingestion`
    ConfigMap keeps a stable name, so without this annotation the flag stays inert. The
    dispatcher was one of three deployments in the overlay without it; the other six workers
    already carried it. Deliberately not added to `resource-fetch-worker`, where a restart
    cancels an in-flight fetch and a cancelled parent skips `on_failure` -- the exact failure
    reclaim exists to clean up.
  - Gate re-verified against the deployed pins before enabling: the STG fleet moved to
    `data-ingestion` `2cbe9f1c` (rollout `c95ce279`), which contains the generation-aware
    contract from `!191`; the one older pin, `durable-control-worker` at `d835fb7`, also
    accepts `reclaim_generation` (`default=0`, `exclude_if=lambda value: value == 0`).
    `validate_render.py` passes against the rendered overlay (38 documents at `2cbe9f1c`).
- Live STG confirmation of the effect (V3, user-facing surface only -- the cluster tunnel was
  down and Azure CLI needed interactive `az login`, so pod-level evidence is still outstanding):
  KB `355f529c` shows `Diversification (finance) - Wikipedia` with `File size 371.4 KiB` and
  `Media type text/html`, which only a successful fetch can record; its `Updated` timestamp
  moved off the Sep 18 13:57 freeze point for the first time in ~31 h, and `Recent attempts`
  lists `Processing Version 2 Sep 18, 2026, 3:57 PM` as the newest entry. Reclaim is the only
  mechanism that clears the abandoned `hatchet_run_id` fence that blocked the re-fetch.
  Outstanding: whether it settles as `Succeeded` or closes as `resource_reclaim_exhausted`
  after the third reclaim, plus the `resource.processing_failed` event count.
- V3 interpretation corrected the same evening (2026-09-19, ~23:35) after reading the deployed
  source: the resource list's `Updated` column is `KBResource.updatedAt`
  (`packages/kb-management/src/components/KnowledgeBaseResourceList.tsx:405,479`), and the
  `monitor-kb-ingestions` cron runs on `*/5 * * * *` (`packages/hatchet/src/index.ts:488-495`).
  `reconcileResource` writes every selected resource unconditionally
  (`packages/hatchet/src/kbIngestion.ts:1318`), and Prisma's `@updatedAt` bumps the column on
  that write. Boundary-aligned samples confirm it: the column read `23:30` at 23:30:15 and
  still `23:30` at 23:31:34. The five-minute advance is the monitor's cadence, not ingestion
  progress, so the inference recorded above -- "the timestamp moved, therefore reclaim
  requeued the fetch" -- does not hold. `File size 371.4 KiB` is weak evidence for the same
  reason: Klicker records size and digest from its own fetch at dispatch
  (`packages/hatchet/src/kbIngestionApi.ts:386-400`), not from the worker's.
- What survives the correction: both GitOps changes are live on `main`; the worker-contract
  gate is satisfied; and the ingestion operation is still non-terminal, because Klicker's own
  five-minute reconciliation of `GET /v1/operations/{id}` keeps applying a `PROCESSING`
  transition to the row. A reclaim re-dispatch adopts the operation through the
  `adopts_reclaimed` branch of `claim_upsert` (`resource_upsert_store.py:437-446`), which sets
  `hatchet_run_id` and `updated_at` but emits no `resource.processing_started`; Klicker keeps
  the original run `createdAt`, so the unchanged `Recent attempts` entry is not evidence
  against a reclaim.
- Still outstanding, still blocked: whether a reclaimed run is executing, and the terminal
  outcome. Under the defaults (stale 3600 s, sweep 60 s, budget 3) a dead operation
  terminalizes as `resource_reclaim_exhausted` roughly three staleness windows after its first
  reclaim, so the earliest expected failure lands about three hours after the dispatcher picked
  up the flag. There is no cluster read path right now: the jumpbox tunnel on port 6443 is down
  and `az` returns `AADSTS70043` (24-hour sign-in frequency), which only an interactive
  `az login` against the DF tenant clears. Until then the acceptance check cannot be closed
  from the cluster side, and the user-facing surface alone cannot separate "slow but alive"
  from "stuck again".
