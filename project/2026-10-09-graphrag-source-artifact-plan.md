# Version-pinned ingestion inputs for knowledge graphs

## Approval summary

Graph generation currently downloads each URL again and compares its bytes
with the digest recorded during knowledge-base ingestion. That comparison
correctly rejects changed bytes. It cannot reliably build graphs from dynamic
pages: one identified public page returned different digests on consecutive
requests. Another source rejects the graph provider's anonymous downloader.

The approved repair gives normal retrieval and KG generation the same canonical
ingestion input. Ingestion owns the content, version, access and deletion.
Klicker stores references and dispatches the selected version. The graph worker
verifies and consumes that version without fetching the original URL again.
FalkorDB retrieval, GrowthBook admission, lecturer controls, citations and the
existing evaluation framework remain the consumer contracts.

The source package changes retention and introduces an authenticated artifact
read contract. Retain only the canonical parsed artifact for the active serving
resource version; raw downloads remain temporary. Replacing or deleting a
resource revokes reads of its old input. Missing historical artifacts require a
deliberate refresh; they cannot be reconstructed by silently fetching live URLs.
No source-bearing artifact is committed to public Git or copied into Klicker's
database. The existing graph archive lifecycle remains separately owned.

Acceptance requires synthetic proof of origin drift, exact version and digest
validation, isolation, deletion, bounded reads, compatibility and one integrated
native path. Delivery ends with qualified draft changes in the three existing
repositories. Merge, deployment, re-ingestion, graph rebuild and paid evaluation
retain their named authority gates. The current request first delivers this
Astra-reviewed plan and its roadmap integration.

## Execution details

Authority: executable source batch approved October 9, with planning first.
Source changes, synthetic checks, local commits, ordinary task pushes and draft
PR/MR delivery are authorized. Planning does not grant live data mutations,
feature activation, merge, deployment or provider/judge spend.

Terminal: this planning checkpoint ends when Astra approves the plan and the
existing roadmap references it. Subsequent source execution ends at tested,
reviewed draft PRs/MRs and exact-head CI evidence for each package.

Pause: a new provider, broader content audience, historical source retention,
unknown ownership, incompatible consumer migration or unavailable required
verification capability. Routine implementation and review corrections continue
inside the approved scope. Boundary owner: self. Execution mode: standard;
native planner GPT-6 Astra owns the independent plan challenge.

### Evidence and current contracts

October 9 scoped staging investigation reproduced the provider's hash rejection
with observed hashes and an in-memory synthetic extraction. It submitted no new
job. The failed extraction itself completed successfully. The source hashes
identify original downloaded bytes, rather than parsed text.

Current call sites:

- Klicker `packages/hatchet/src/kbIngestionApi.ts` probes and hashes a URL before
  ingestion acceptance. `kbGraphIngestionApi.ts:getKBGraphSourceUrl` later
  supplies the original URL to the graph provider.
- Ingestion `modules/ingestion/src/ingestion/source_snapshot.py` verifies a raw
  snapshot. HTML parsing then calls the URL parser, which may download again.
  `resource_upsert_service.py:cleanup_terminal_artifacts` deletes the temporary
  raw and parsed artifacts after completion.
- Ingestion `modules/ingestion-api/src/ingestion_api/app.py` currently exposes
  resource and operation status, without a canonical-artifact read endpoint.
- KG `lightrag_research/hatchet_workflows/doc_processing.py` downloads and
  extracts remote inputs. `tasks.py:_prepare_remote_sources` checks the pinned
  original-byte digest before publishing prepared input.

Inspected remote baselines: Klicker `v3-ai` at
`d06cc9054ceaaff69f30794f94fde445f7c9f571`; ingestion `main` at
`22a94a784112f45e684fbcb94525aef81e602e85`; KG `main` at `94a0e0a`.
The actual staging promotion source was `v3-adaptive-learning`. Recheck it before
proposing any future integration; a source merge is not serving evidence.

The private investigation receipt stays outside public Git. It contains scoped
run metadata, not source bodies. No participant conversation or real course
content is required for source qualification.

### Product ownership

| Existing primitive | Disposition | Contract |
| --- | --- | --- |
| KB resource and serving version | Extend | Own canonical parsed input for the active version; newer desired work does not replace the serving version before successful activation |
| Graph build and source snapshot | Extend | Freeze resource-version and artifact lineage; reject stale or deleted source evidence before accepting a graph |
| Published graph and chatbot policy | Reuse | Preserve independent map/retrieval admission and current-publication checks |
| Source citation | Reuse | Resolve the original authorized material and page identity; artifact transport locations are not student citation URLs |

The artifact is an implementation of the resource version, not a second
knowledge-base product. Ingestion owns content-bearing storage. Klicker owns
graph orchestration and stores metadata only. KG owns graph extraction from
the admitted input.

### Binding input contract

Use a Resource API v2 admission and status contract alongside unchanged v1.
V2 URL admission supplies the origin and resource identity without a caller
digest or MIME probe. Ingestion fetches with its existing public-URL, redirect,
descriptive User-Agent, MIME and size policies, then durably binds the observed
raw digest and MIME to that operation's snapshot. This removes Klicker's initial
probe-to-ingestion race. V1 sources and v2 blobs retain mandatory caller digest
checks. Downstream v2 URL work uses the observed digest, not an invented expected
digest or a nullable bypass of the legacy integrity check.

Capture once means one authoritative bound snapshot. A crash before binding may
permit another bounded fetch by the recovered lease owner. After binding,
retries reuse the immutable snapshot; a missing bound snapshot fails closed.
Conditional artifact writes and the existing operation/lease fence determine
the winner and clean abandoned attempts. The invariant is stable bound bytes,
not exactly-once network delivery.

Use `canonical-document/v1` for the parsed envelope, with a shared serialization
contract in ingestion's lightweight shared package. Freeze the exact field and
digest serialization in slice 1 before changing a consumer. Reuse parsed
document/page structures where they express the required semantics.

Each envelope binds project, producer, KB, resource ID, serving resource
version, original-byte SHA-256, parser recipe/version, parsed-content SHA-256,
artifact byte count and ordered source text/page provenance. Distinguish raw
source identity from parsed identity. Define the parsed digest over a canonical
UTF-8 representation; readers hash the delivered bytes, not reconstructed
objects. Titles and origin locators are metadata; ephemeral credentials are
excluded. Preserve unpaginated materials without inventing page numbers.

The canonical document is the input actually consumed by indexing. HTML must
parse the verified first fetch; the canonical parser must not re-fetch the
origin. Subsequent chunking/enrichment may add retrieval metadata, so identical
document lineage does not imply identical final chunk strings.

Persist the canonical descriptor atomically with ingestion serving state. V2
polling and signed status reconciliation carry the raw digest, resource version,
canonical digest, parser recipe digest and envelope version. Klicker persists
that lineage on the active resource and copies it into immutable build-source
rows before dispatch. Retries, provider terminal results, manifest lineage and
publication must compare that same tuple. Preserve the legacy raw
`source_content_digest`; add a separately named canonical source-input digest
over sorted, versioned source tuples. Staleness checks compare both identities
for canonical builds, including a parser-only change with unchanged raw bytes.

Read authorization binds producer/project/KB/resource/version and requested
digests. Extend ingestion's registry/auth/policy with a distinct artifact-reader
identity, explicit approved producer/project/KB allowlists, and mutation denial.
Empty allowlists deny access. Check stored resource ownership and active serving
state on every read; caller-provided identifiers do not confer authority.
The graph worker uses this read-only identity directly against one configured
ingestion HTTPS origin, rejecting redirects and arbitrary artifact hosts.
Credentials live in Infisical/runtime environment and header authentication,
never workflow inputs, query strings, logs or public Git. No build-grant store,
new Klicker proxy, public Blob URL or Blob account credential is required.
Provisioning this exact reader and its approved KB scope is a later deployment
action, not part of planning or source-only implementation.

Stream with a byte cap, content type, timeout and checked digest. Fail closed on
missing artifacts, wrong version, scope mismatch, revoked reader access or corruption.
Do not substitute current origin content, cached text from another version or
a differently configured extract. Revalidate source eligibility before accepting
provider output. For Klicker-managed resources, deletion/replacement admission,
webhook reconciliation and publication share the existing KB/resource locking
and compare-and-swap boundary. In the publication transaction, match every frozen
source tuple and reject deleted sources or admitted deletes. A preflight API read
alone is not a publication fence. Source mutation after that transaction must
invalidate the graph through the same current-source checks used by student
consumers. Independent out-of-band source mutations remain unsupported; they
cannot be claimed to be atomically fenced across two databases.

### Retention and deletion

Retain the canonical parsed artifact while its version is the active serving
resource. Raw fetch snapshots and source-bearing job scratch retain their
current temporary lifetime. Artifact keys are immutable and include resource
identity, version and digest. Activation commits the artifact reference together
with serving identity; a failed replacement leaves the prior serving input intact.

After replacement or deletion, deny old reads immediately. Reuse ingestion's
durable cleanup/reconciliation mechanism to remove the old artifact and revoke
its reader eligibility. Cleanup failure stays observable and retryable. Do not add a grace
period, historical source archive or general-purpose retention setting.
Define and demonstrate the physical-deletion convergence bound before rollout.
Download, preparation and generation scratch are owned by one build attempt.
Remove content-bearing local files on success, failure and cancellation, and
reconcile abandoned scratch after a worker crash. Klicker payloads keep
`upload_markdown: false`; the repair must not enable Markdown Blob uploads.
Work already given to a provider cannot be recalled; publication must still
reject revoked or mismatched input. Existing graph artifact retention is not
extended by this package.

The purpose is existing authorized KB indexing and graph generation. No new
analytics, model training, participant records or external model provider is
introduced. Logs retain content-free result codes and numeric sizes. Existing
controller policy continues to govern uploaded material; the new lifetime and
recipient access must be documented before activation.

### Delivery topology and owners

Use three dependency-ordered source packages in the existing repositories.
This is a cross-repository sequence, not a newly created native PR stack.

| Slice | Main-owned seam and intended paths | Completion evidence |
| --- | --- | --- |
| 1. Canonical ingestion input | Ingestion admission, shared contract, snapshot, serving state and resource lifecycle | V2 URL acceptance through indexing binds one authoritative capture; scoped reads and resource-owned cleanup; deletion and recovery regressions |
| 2. KG canonical-input consumer | KG: existing `hatchet_workflows/schemas.py`, `doc_processing.py`, `tasks.py`, source provenance and terminal result code; existing workflow/terminal-result tests and relevant integration documentation | New input schema validates exact document lineage, reads only admitted artifacts, keeps locators and refuses origin fallback; legacy inputs still behave as declared |
| 3. Klicker dispatch and integrated proof | Klicker: existing KB ingestion and graph dispatch/API modules, corresponding tests and generated schema/model surfaces only if required; `docs/chat-platform.md` and this plan | Dispatch binds the active version and exact artifact; integrated synthetic path demonstrates origin drift does not change RAG/KG input, while replacement/deletion prevents stale publication |

Extend these existing files as required by the listed seams. Brace notation
identifies individual files, not an unrestricted directory grant:

- Ingestion: `modules/ingestion-api/src/ingestion_api/{app,models,ports,factory,service,state,registry,auth,policy}.py`;
  `modules/ingestion-shared/src/ingestion_shared/{contracts,resource_status_events}.py`;
  `modules/ingestion/src/ingestion/{source_snapshot,resource_upsert_service,resource_upsert_store,resource_upsert_types,resource_candidate,resource_candidate_artifacts,resource_operations}.py`;
  `modules/ingestion/src/ingestion/workflows/{resource_upsert,resource_delete,resource_upsert_transport}.py`;
  existing artifact adapters and `docs/resource-api.md`.
- KG: `lightrag_research/hatchet_workflows/{schemas,doc_processing,tasks,graph_provenance,klicker_terminal_result}.py`
  and existing graph manifest/generation-recipe modules where they carry source
  lineage. Preserve legacy hashing outside the canonical discriminator.
- Klicker: `packages/hatchet/src/{kbIngestionApi,kbIngestion,kbGraphIngestionApi,kbGraphIngestion}.ts`;
  `packages/graphql/src/services/{knowledge,knowledgeWebhooks,kbGraphContract}.ts`;
  `packages/knowledge-graph/src/{digest,publication}.ts`;
  `packages/prisma/src/prisma/schema/knowledge.prisma`;
  `packages/types/src/knowledgeGraph.ts`; `docs/chat-platform.md`;
  `turbo.json` and existing configuration docs for the new runtime keys.

Named new files: ingestion
`modules/ingestion-shared/src/ingestion_shared/canonical_document.py` for shared
serialization, and Klicker `docs/adr/canonical-ingestion-input-ownership.md` for
the retention boundary. Extend existing tests; no new test suite is needed.
Ingestion owns the minimal state migration in its existing
`ingestion_api/state.py` migration machinery. Klicker owns one schema-generated
Prisma migration named `canonical_ingestion_lineage`, mirrored through the
existing Prisma sync workflow; record the generated timestamped path before
committing it. Avoid new services, libraries, retrieval engines and test-only
production endpoints. Any additional module needs a concrete second caller or
an updated approved slice scope.

Main owns architecture, authorization, integration and final proof. Delegate
settled separable tests or implementation under the normal routing rules.
Each package receives the applicable risk review and integrated final review.
The user's OpenRouter review waiver remains binding; use an eligible trusted
route for required review.

### Delegation Map

| Work item | Owner at dispatch | Acceptance |
| --- | --- | --- |
| Contract, retention, authorization and first-fetch behavior | Main | Astra-approved contract and coupled state transition proof |
| Existing synthetic API/worker regressions after schema freeze | One trusted executor; assign exact test files before dispatch | Behavior assertions from the portfolio; no production test hooks or live data |
| KG canonical reader after admission contract freezes | One trusted executor; assign consumer files from slice 2 | Verified bytes/provenance and legacy compatibility; no policy decisions or external actions |
| Klicker integration, migrations, publication fence and final proof | Main | Complete cross-repository lineage and race proof |

Main integrates every result. The independent executor work starts only after
its prerequisite contract is frozen and its write set is settled.

### Verification portfolio

| Consequential behavior | Primary seam and acceptance |
| --- | --- |
| Origin changes throughout ingestion | Extend snapshot, fetch/prepare and synthetic producer tests: origin changes on every call from v2 acceptance through indexing and KG; one authoritative snapshot wins and graph preparation makes zero origin requests |
| Resource isolation and corruption | Extend API registry/policy/app and KG workflow tests: reject wrong producer, project, KB, resource, version, digest, revoked reader, redirects and oversized body; reader credentials cannot call mutations |
| Replacement, deletion and partial failure | Existing durable state/artifact fixtures prove failed replacement preserves the old active version, successful replacement revokes old reads, deletion blocks in-flight publication, and cleanup retries remove retained content |
| Input and citation compatibility | KG schema/workflow fixtures preserve source IDs and page provenance; mixed/legacy payloads cannot silently claim canonical lineage; real provider result validation requires the selected source identities |
| Integrated mechanism | Native ingestion → pinned dispatch → KG preparation fixture, without paid LLMs; later staging/map checks and retrieval quality evaluation remain separate receipts |

Focused commands, run later in each owning environment:

```bash
# Ingestion root: existing worker/state seams
uv run pytest modules/ingestion/tests/test_source_snapshot.py modules/ingestion/tests/test_resource_upsert_fetch_prepare.py modules/ingestion/tests/test_resource_upsert_activation.py modules/ingestion/tests/test_resource_upsert_recovery.py modules/ingestion/tests/test_resource_delete_workflow.py modules/ingestion/tests/test_resource_event_contract.py
# Ingestion modules/ingestion-api: admission, identity and exact response shapes
uv run pytest tests/test_app.py tests/test_contract_models.py tests/test_registry.py tests/test_policy.py tests/test_durable_app.py tests/test_sqlite_state.py
# KG lightrag_research: consumer, provenance and terminal contracts
uv run pytest tests/test_hatchet_workflows.py tests/test_graph_provenance.py tests/test_klicker_terminal_result.py
# Klicker root: lifecycle, dispatch and webhook contracts
pnpm --filter @klicker-uzh/hatchet test -- test/kbIngestionApi.test.ts test/kbIngestion.test.ts test/kbGraphIngestion.test.ts
pnpm --filter @klicker-uzh/graphql test -- test/knowledgeIngestion.test.ts test/knowledgeWebhooks.test.ts test/kbGraphContract.test.ts
```

Extend ingestion's existing PostgreSQL activation/deletion suites
`test_resource_activation_terminal_postgres.py` and `test_resource_delete_postgres.py`
against a disposable database. Extend Klicker's existing graph accounting and
webhook suites for the publication race. Skipped database tests do not qualify
the fence. Also run the owning installed Ruff/type/schema checks and mandatory
repository checks; regenerate/sync Prisma and GraphQL outputs when changed.

Reuse installed repository runners, formatter, type/schema checks and meaningful
existing tests. Run container-dependent checks in each owning container; this
planning-only package needs Markdown formatting, link validation and diff review,
with no application runtime. Visible UI changes are not planned. If a later
implementation changes browser authorization or citation behavior, perform the
required browser proof and appropriate screenshot capture.

### Compatibility and rollout sequence

Deploy the ingestion contract and the KG consumer before enabling canonical
dispatch in Klicker. Add `KB_CANONICAL_INPUT_ENABLED`, default false, for v2
ingestion admission and canonical KG dispatch; preserve the independent
GrowthBook `chatbot-graphrag` gate and lecturer retrieval policy. Once a resource
or build is canonical, store that discriminator durably. A disabled canonical
control returns a fixed unavailable result for that record, never legacy URL
dispatch. The reader's `KB_CANONICAL_INPUT_API_URL` and
`KB_CANONICAL_INPUT_API_TOKEN` are runtime-only service configuration; the token
is never returned in status or stored on builds. Chart/secret provisioning and
activation require separate rollout approval.

Keep v1 Resource API exact-key responses unchanged. Add explicit v2 status and
webhook schemas rather than slipping extra fields into legacy payloads. Version
Klicker terminal results as `klicker-kb-graph/v2` for canonical source lineage,
retaining `klicker-kb-graph/v1` validation for legacy builds. Use a source-input
discriminator separate from CourseKGInput's existing Quality Profile schema
versions. Reject mixed payloads and contract/version mismatches before writes.
Do not alias raw hashes to canonical hashes or silently add optional fields that
existing exact-key validators reject.

Deploy in reader-first order, then enable only an explicitly approved scope.
Old active resources without canonical artifacts return an actionable missing-
artifact result and require explicit re-ingestion. Do not perform a hidden
backfill or bulk refresh. The repair must support new ingestion without creating
new builds or publication side effects.

Source rollback returns canonical admission/dispatch to disabled. Reverting deployment
must preserve durable state and cannot resurrect deleted artifacts or authorize
live-URL fallback. Cleanup must remain compatible while a consumer is rolled back.

After separate merge/deployment approval, verify exact source/image revisions,
schema application, serving health and scoped contract behavior. Request a finite
refresh/build batch for the already identified controlled KB. One new graph
build requires a fresh explicit ceiling; the previously suggested CHF 2.50 is a
proposal, not carried-forward authority. Stop on failed refresh/build or missing
cost evidence. Student-map preparation and required administrator approval follow
only after a current graph. GraphRAG activation and evaluation spend remain gated.

The existing adoption plan owns the mechanism probes and frozen three-arm
comparison through `query → capture → enrich → eval`. This package adds source
version fidelity as a prerequisite and records artifact/schema/parser lineage
in the private experiment manifest. It does not change metrics, goldens, judge
thresholds or rollout criteria.

## Progress

October 9: source implementation approved; user requested planning with Astra
first and roadmap integration. Draft created from current `origin/v3-ai` in
`trees/rs/graphrag-source-artifact-plan`, branch `rs/graphrag-source-artifact-plan`.
No application source or live state changed. No PR/MR exists yet for this package.
Astra approved the revised plan in round 2. The first review identified the
initial probe/fetch race, incomplete lineage propagation, unnecessary build-grant
state, deletion/publication races and missing compatibility/cleanup proof. The
revised contract addresses each finding through one authoritative snapshot,
versioned canonical input, scoped reader access, publication fencing and the
named regression suites. The roadmap now includes milestone 1a and W9a.

Planning checks pass: Markdown formatting, new relative links, diff whitespace
and the content secret scan. Three pre-existing links to unavailable private
historical reports remain unchanged. Review receipt: ignored
`project/_local/reviews/2026-10-09-graphrag-source-artifact-planner.md`.
The planning checkpoint is complete. Subsequent source implementation and all
live acceptance gates remain open; no source checks or live acceptance ran here.

Execution started October 9 after the user's explicit goal request. Native goal
owns source delivery through tested, reviewed draft changes and CI. Full-path,
standard execution continues the approved package. Main owns slice 1's coupled
contract and lifecycle; its acceptance is the worker/API regression portfolio.
Delegated consumer work waits for the exact artifact schema to freeze.

Task worktrees: Klicker `trees/rs/graphrag-source-artifact-plan` on
`rs/graphrag-source-artifact-plan`; ingestion `trees/rs/canonical-ingestion-input`
on `rs/canonical-ingestion-input`, fresh `origin/main` baseline
`bfc3bc0bd7f01470f3c59764d8d1ec5054033fc6`; KG uses the same relative worktree
and branch name at `94a0e0aab082a6381d2d77e7582eeabeb2c2899b`.
Ingestion's newer catalog recovery changes replace the earlier inspection
baseline without changing this package's source contract.

October 10 source checkpoint: all three source packages are implemented and
published as drafts: [ingestion !229](https://gitlab.uzh.ch/ai-infrastructure/services/data-ingestion/-/merge_requests/229),
[KG !36](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/merge_requests/36)
and [Klicker #6460](https://github.com/uzh-bf/klicker-uzh/pull/6460).
The source implementation freezes `canonical-document/v1`, adds Resource API
v2 admission/status, scoped artifact reads, active-version retention and cleanup,
and pins KG dispatch/terminal/publication/consumption to canonical lineage.
One generated Prisma migration is
`packages/prisma/src/prisma/schema/migrations/20261009205103_canonical_ingestion_lineage/migration.sql`;
analytics mirrors the schema. Runtime admission defaults off.

Source owners remain main for integration and lifecycle. Independent Astra
simplifiers covered all three committed slices. Their three accepted reductions
remove an unused serialized reference, duplicate fixture type and hand-built
preparation fixture. Corrections pass their affected checks. Risk reviews and
trusted integrated final review remain pending; the first KG reviewer returned
a terminal rate limit and the permitted trusted continuity reviewer now owns it.
The user's OpenRouter review waiver remains binding.

Local evidence: 189 focused Hatchet tests, 82 real-PostgreSQL GraphQL contracts,
18 knowledge-graph tests, repository check:all and full production build pass.
Ingestion qualification includes 86 API and 132 worker regressions plus 38
resource PostgreSQL tests. KG qualification includes 103 workflow, recipe,
provenance and terminal tests. Later corrections pass 20 ingestion lifecycle
checks, 74 KG workflow tests and 20 Klicker graph accounting tests. API and KG
workflow/terminal type checks pass; this is not a claim that all optional legacy
KG modules typecheck. Integrated synthetic proof uses native ingestion capture,
Klicker dispatch and KG preparation/attempt code with a mocked artifact HTTP
transport: one origin capture, matching input tuple and removed scratch. API
scope and durable-state behavior are checked independently; no deployed end-to-end
or paid-model evidence is claimed.

Ingestion pipeline 680287 passed at `4fcfd66`. Corrected task heads are ingestion
`2659d224615339590b9a118bdf2019aae6db9dd0`, KG
`efc3e9e612c01af784e2344a9ed10b9c03ec18ec` and Klicker source
`abc22a3ae2` (final documentation receipt will follow). Exact-head CI and review
qualification remain open. The initial KG pipeline failed on workflow return
annotations; the correction carries the new v2 terminal union through that seam.
No merge, deployment, reader provisioning, source refresh, graph rebuild,
GraphRAG activation or evaluation spend occurred.

October 10 final review correction: accepted the missing raw-size/MIME lineage
and unconditional artifact-reader startup findings. V2 admission now supplies
Klicker's 25 MiB cap, bounded by the producer policy. V2 status and signed events
carry active-version `serving_source_metadata` alongside canonical lineage;
Klicker reconciles actual sizes and MIME without origin probes. V1 shapes remain
unchanged. Synthetic tests cover the wire cap, invalid metadata, activation,
replacement and persisted quota accounting. Reader startup correction and
same-reviewer qualification remain in progress.

KG slice review passed its isolation/integrity/lifecycle checks and reported a
printed-page-label consumer gap. Canonical preparation retains both identities;
existing physical-page citation navigation is intact. The adoption roadmap now
tracks printed-label citation extraction/display before widening. This source
package does not add a new question citation API.


October 10 qualification hold: final source heads are ingestion
`ea4a88a0911fb97eb83b7acf1306a08cbe2ce193`, KG
`efc3e9e612c01af784e2344a9ed10b9c03ec18ec` and Klicker
`5e9207a562538a9903aba4ad1e2ddad9e638e018`. Ingestion
[pipeline 680298](https://gitlab.uzh.ch/ai-infrastructure/services/data-ingestion/-/pipelines/680298)
and KG
[pipeline 680295](https://gitlab.uzh.ch/uzh-bf/tc/kg-content-generation/-/pipelines/680295)
pass at those exact heads. Klicker's full local production build and required
hooks pass at the source head; hosted CI remains pending. The task Devsy runtime
`rs-graphrag-source-artifact-plan` is stopped with zero exact routes; data and
worktree are retained.

The permitted final-review correction pass independently confirms the byte cap,
paired raw metadata/canonical descriptor, opt-in reader and pending success-path
reservation fixes. Its response fails the canonical review schema and is not a
passing gate. Main verified its new consequential finding directly: a failed
BLOB replacement keeps the new `blobName`, but reconciliation and the signed
webhook copy the old serving version's `sizeBytes` and `mimeType`. Manual retry
validates the new blob against that old metadata and can fail; storage accounting
can understate the retained blob. The source draft is not merge-ready.

Next bounded correction: update source metadata only when the serving version
matches the desired version in both reconciliation paths. Preserve desired BLOB
metadata on failure and pending operations. Extend the existing reconciliation
and real-PostgreSQL signed-webhook regressions with distinct old/new byte counts
and MIME types; verify retry uses the retained blob's matching tuple. No new
schema, provider, endpoint or live operation is needed. Retain conservative URL
reservations until current activation; avoid borrowing old serving metadata for
a different desired input. Then run affected checks, source publication and one
focused independent final qualification on the corrected complete package.

This is a second substantive correction cycle. The package pauses at the workflow's
scope/risk reassessment boundary; the independent review correction budget is
spent. Existing source, data, cost and rollout boundaries remain unchanged.
Main owns this correction. No merge, deployment, live refresh, graph rebuild,
activation or paid evaluation is authorized by this checkpoint. The goal remains
active and unachieved. Raw review, validation failure and verified disposition live
in ignored `project/_local/reviews/2026-10-10-canonical-integrated-final-review.md`.


October 10 reassessment approved: the user approved one additional bounded source
correction and independent qualification through updated drafts. Apply the prepared
blob-metadata patch, prove failed and pending replacement metadata preservation,
verify retry dispatch retains the blob/size/MIME tuple, run affected and mandatory
checks, and publish the corrected task head. Reuse passing ingestion and KG source
and exact-head CI receipts; their heads remain unchanged. Main owns the coupled
correction; no independent implementation item exists. The renewed final-review
pass covers the complete integrated package with prior findings and corrections.
No merge, deployment, live refresh, build, GraphRAG activation or paid evaluation
scope is added. This approval supersedes the earlier review-cycle hold; the goal's
objective and terminal condition remain unchanged.


October 10 renewed correction verification: both polling and signed callbacks now
update raw size/MIME only when the serving version matches the desired version.
Distinct old text/new PDF fixtures prove failed and pending replacements preserve
the desired blob tuple. Existing retry dispatch asserts the retained blob's size
and MIME. Checks pass: 61 ingestion reconciliation tests, 29 real-PostgreSQL
signed-webhook tests and the focused replacement-retry case. The webhook suite
now arms the disposable-database guard on its actual Prisma client before writes.
Main reviewed the correction for simplification; no new abstraction is needed.

The retained runtime's generated profile was restored only after matching both
source and generated checksums to its recorded baseline. Canonical repair starts
the exact task container, but full readiness times out on the LTI HTTP route.
Container checks work; this is not full local application E2E acceptance. Source
qualification, mandatory checks and independent integrated review remain open.
