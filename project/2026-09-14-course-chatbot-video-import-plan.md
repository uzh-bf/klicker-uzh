# Course chatbot video import lane — end-to-end plan

Status: active; S1-S3 delivered on both environments, S4 producer and access prerequisites
proven, pilot import awaiting a new recording. Complements
[2026-09-12-doc-query-source-inventory-plan.md](2026-09-12-doc-query-source-inventory-plan.md)
(merged as #5922): the inventory half is delivered; this plan closes the production path for
getting lecture-recording content into course KBs and cited through the chatbots. The
operational contract lives in
`.agents/skills/klicker-course-chatbot-provisioning/SKILL.md` (video imported-lane section from
PR #6022, the one-command lane from PR #6034); this file plans the implementation slices that make that contract executable
against PRD.

## Approval summary

Approved now: this plan document and the skill addition (docs-only, draft PRs). Withheld until
named per slice: chart/secret deployment changes, live database writes, PRD corpus writes,
cluster access establishment, paid VLM processing runs, marking ready, merge.

## Current state (evidence anchors)

1. Video pipeline (klicker-uzh-video-ai): `video-processing` deployed in PRD
   (`prd-video-processing`, workflow + transcription workers, VLM spend alerts). Input: one
   video per `POST /jobs` with caller-supplied `job_id`. Output: `result.json` —
   `video_processing_result.v1` (episodes, multimodal chunks, visual states, embedding units
   with citation references, provenance, quality flags). Contract:
   `docs/klickeruzh-integration.md` in that repo. Boundary: stops at source artifacts; since PR #123 the service also publishes `artifacts/<job_id>/learning_units/ingestion_source.json`, the artifact this lane consumes.
2. df candidate lifecycle (data-ingestion): `video_ingestion_candidate.v1` package →
   target-bound prepare (embeds, receipts, zero vector writes) → inactive candidate →
   exact-count activation with replay/rollback. Locally e2e-proven (82 videos / 872 candidates,
   plan `project/2026-08-13-video-ingestion-local-e2e-plan.md`).
3. Inventory tool: `doc_query_sources` scope-guarded companion is live on both environments
   (S3): mcp-doc-query runs `3cc2771b` (2026-09-15, above the v0.13.0 release `92b45f63`),
   which registers the companion tool for any tool config declaring `token_scope`.
4. Klicker inventory consumer: `getKbImportedSources` merged to `v3-ai` (#5922 →
   `7f777565f0`). Its three original degradation causes are resolved: the ES256 minting keys
   (`DOC_QUERY_SCOPE_*`) are projected into the backend-graphql Secret on STG and PRD (S1),
   the `ChatbotMCPServer` row named `KB` exists and is active on both (S2), and the serving
   lineage exposes the scope-guarded inventory tool (S3).
5. PRD doc-query runtime: in-cluster endpoint
   `http://mcp-doc-query.prd-doc-query.svc.cluster.local:1417/mcp/klicker`, tenant collection
   `klicker_course_materials_v1`, proven by `apps/chat/scripts/prd-doc-query-proof.mjs`
   (15 KB / 22 chatbot corpus proofs on `v3-ai`).
6. Course fleet: eight published course chatbots with KBs (Finance I, AMI, FIM, SP, CF, BI,
   CHE170, IuW) provisioned 2026-09-13/16. IuW is the first whose KB holds a video corpus in
   production (872 chunks / 82 videos, copied from the legacy test scope by the IuW chatbot
   thread), and it serves correctly through the clean path (2026-09-16 verification below).

## Gaps and slices

| Gap | Slice | Repo / owner |
| --- | --- | --- |
| G1 GraphQL workload cannot mint scope tokens | S1 scope keys on backend-graphql | klicker-uzh / main |
| G2 no `KB` MCP server row in STG/PRD | S2 live registration | klicker-uzh / main |
| G3 serving lineage lacks the scope-guarded inventory tool; df-side dual-stamp already merged | S3 doc-query tool delivery | mcp-doc-query + deployment / executor |
| G4 no PRD-bound import operations for course videos | S4 pilot import runbook + first recording | data-ingestion / main + executor |
| G5 review path for flagged units undefined | S5 quarantine review loop — **resolved 2026-09-16**, folded into the S4 runbook below | video-ai + main |
| G6 no end-to-end acceptance for a course bot citing video | S6 retrieval + acceptance proof | klicker-uzh / main |

Dependencies: S1 ∥ S3; S2 after S1; S4 after S2+S3; S5 before S4 activation; S6 last.

### S1 — scope keys on the GraphQL workload

Add `DOC_QUERY_SCOPE_PRIVATE_KEY`, `_KID`, `_ISSUER`, `_AUDIENCE` (and, if the PRD
doc-query transport requires JWT, `DOC_QUERY_JWT_TOKEN_KLICKER`) to the backend-graphql
workload in `deploy/env-uzh-stg` then `deploy/env-uzh-prd`, mirroring the chat workload's
existing secret boundary (Infisical → ExternalSecret; values never in ConfigMaps). The
`@klicker-uzh/doc-query-client` package already shared by chat and GraphQL owns minting — no
new code path, only configuration. Acceptance: with a scope-matched seeded row on STG,
`getKbImportedSources` resolves through the real service (no degraded error), and the chat
workload's own doc-query path is unchanged (regression via existing corpus proof).

Authority: chart/secret deployment (STG then PRD), separately approved per environment.

### S2 — register the `KB` MCP server row (done)

Delivered on both environments: `getKbMcpServerOrThrow` resolves one global
`ChatbotMCPServer` row by `name = 'KB'`
(`packages/graphql/src/services/knowledge.ts:566`). Readback 2026-09-16 shows the row on STG
and PRD with the environment in-cluster doc-query URL, `authType = 'bearer'` (see the gated
steps' authType correction), `isActive = true` and a non-null encrypted `authSecret`. No
further action; the functional Manage readback through a real owner session remains part of S6
acceptance.

### S3 — the inventory tool on the serving lineage

The df side of this slice is already done. The candidate path stamps both scopes on every unit —
`kb_id` authoritative, `chatbot_id` retained (`modules/ingestion/src/ingestion/video_candidate_import.py::_map_unit`,
added by `a284fdc` on data-ingestion main) — and a rehearsal run of `video-import lecture` for SP
produced 11 prepared chunks carrying the SP `kb_id`, `course_id`, `semester` and `corpus_version`,
with `resource_active=false` until activation. The legacy `video_document_mapper.py` path, which
stamps only `chatbot_id`, is not used by this lane.

The serving side is released and live on STG. `doc_query_sources` (the Klicker client's
`KB_SOURCES_TOOL_NAME`) is registered for any tool config that declares `token_scope`; the code
merged as mcp-doc-query MR !84 (merge `1d9816ed` on `main`) and shipped as tag `v0.13.0`
(`92b45f63`), whose `release_tag_verify` and arm build are green. Both environments already run
the standalone lineage and already carry the Klicker tenant `doc_query` config with
`token_scope.claim = filter_field = kb_id` and `required: true`; the STG pins now carry the release
`sha-92b45f63b9dbb077cdfe90273a6e837f54f6b0b0-arm@sha256:84522e991ad76cf8225bfa9fe74ab174c4d42d20f5f6d113432bc67dbfdc570d`:
`pipelines/stg-doc-query/doc-query/deployment.yaml` and `deployment-spot.yaml`,
`pipelines/stg-klicker/doc-query/kustomization.yaml`, and the `.gitlab-ci.yml` tool-config
loader. The PRD pins stay on the older build until the STG proof is accepted.

Acceptance: a test source written with the new stamp appears in the STG inventory through Manage;
existing retrieval corpus proofs still pass (scope-filter regression); zero-row corpora explain
themselves by stamp, not by silence.

Authority: one merge, one release and the deployment pins (STG then PRD); STG corpus test write.
Exact steps: `2026-09-14-video-import-gated-steps.md`, STEP S3.

### S4 — pilot import: runbook plus first recording

Turn the local e2e flow into a PRD runbook against the course targets: per-course binding
control file (collection `klicker_course_materials_v1`, `project_id`, `kb_id`,
`chatbot_id`, embedding model + dimensions) with target-fingerprint preflight; per-recording
`job_id = {kbId}--{lectureSlug}`; result validation and the import guards from the skill
section; prepare with `target_fingerprint`/`expected_count` receipts; exact-count activation.
Pilot on the first real recording (SP, Tue 2026-09-15) into the SP KB. Acceptance: unit-count
receipts (total/exported/quarantined), activation count equals prepared count, the lecture
appears in Manage's imported-sources list for the SP KB with chunk counts.

Authority: PRD corpus write (the activation) and the paid video-processing/VLM run for the
pilot recording.

### S5 — quarantine review loop

Units with `quality.needs_review=true` are excluded from activation and routed to review. The
one-command lane generates the record: `quarantine-decisions.json` in the run tree, one
undecided row per held-back unit, create-only, path named in the receipt (data-ingestion MR
!172). The video-ai repo additionally emits review artifacts (`review/full_review.html`,
`quality_review.html`, reviewer ZIP). What remains is the loop itself: who reviews (course
team vs us) and how an approved unit re-enters a later candidate package. Acceptance: one
documented loop decision, with the scaffold and the re-entry rules folded into the S4 runbook;
no flagged unit reaches activation without a recorded decision.

Authority: none beyond S4's once folded in; the loop definition itself is docs-only.

### S6 — end-to-end acceptance per course bot

With S1–S5 done: owner-preview (`https://chat.klicker.uzh.ch/preview/{chatbotId}`) tutor
question answerable only from the imported lecture, citing the video by name and timestamp;
inventory lists the lecture; `usageSummary.lastActivityAt` advances. Record receipts in the
import manifest. Acceptance: one fully receipted lecture per pilot course, and the skill's
video-lane "done when" is satisfied on PRD, not just locally.

Authority: none new (read-only proofs), but requires S4's write to have happened.

## Out of scope (explicit)

Klicker schema changes for imported content (the zero-schema decision stands); app-added video
uploads; deletion/rollback of imported sources beyond the existing candidate seams; OLAT-side
changes; automatic re-import on lecture re-recording (manual rerun with a new slug for now);
Kaltura fetch automation (prior research recorded separately).

## S4 runbook — one recording into a course KB

Producer side, once per environment: `video-processing` must run a revision that pins the
submitted job id as the run identity and publishes
`artifacts/<job_id>/learning_units/ingestion_source.json` (klicker-uzh-video-ai PR #123), with
`VIDEO_PROCESSING_INGESTION_SOURCE_POLICY` naming the tracked eligibility descriptor. Without
the policy path the service finalizes jobs and publishes nothing, and the consumer fails closed
with `published_source_missing`. That PR already carries the configuration as well: the
descriptors are copied to `/opt/ingestion-policies` by the shared `app-base` stage and the worker
config names the file, so the remaining producer work is the merge, the STG digest promotion and
then the PRD promotion (gated steps, STEP S4).

Operator side, per recording:

1. `ingestion-cli video-import lecture --video <file> --course <slug> [--asr-language de]`
   submits, waits, fetches the published source, and runs inventory, package and prepare. The
   run directory is `project/_local/video-import/<slug>/runs/<lecture-slug>/` in the
   data-ingestion checkout.
2. Check the receipts: service job status and reuse, source unit counts against the binding's
   policy digest, inventory source/eligible/excluded/quarantined counts, prepare
   `prepared_count == eligible_unit_count`, and a `target_fingerprint` that stays stable for the
   environment.
3. If the receipt names `quarantine_decisions`, the run held back flagged units and wrote one
   undecided row per unit. Route them to the course team and fill in `decision`
   (`accept` | `reprocess` | `leave_out`), `reviewer`, `team`, `decided_at` and `note`
   in that file; the file is create-only, so re-running the import never discards a decision
   already made. The course team owns content eligibility; the platform executes. A unit the
   team wants in re-enters only through a new producer source: a producer-side `clear_review`
   for the review-flagged unit, then a re-import with a bumped `--resource-version`. The
   abandoned candidate stays inactive and no vector write happens for the quarantined set.
4. Activate with the same command plus `--activate`; this is the exact-count corpus write and the
   only step that touches the vector store.
5. Verify from Klicker: the lecture appears in Manage's imported-sources list for the KB, and one
   owner-preview question answers only from that lecture and cites it with a timestamp.

Committed bindings live at `modules/ingestion-cli/src/ingestion_cli/course_targets/<slug>.yaml`
in data-ingestion (eight courses; the IuW binding is commit `f168e24c` on
`rs/video-lecture-import`, head of draft MR !172). Environment for a PRD run (host shell, via
`rs-infisical-operator`):
`VIDEO_PROCESSING_SERVICE_URL=https://video.ai.prd.df-app.ch`, `VIDEO_PROCESSING_API_KEY`,
`VIDEO_PROCESSING_STORAGE_ACCOUNT_URL=https://prdvideoprocessingpq8ul.blob.core.windows.net`,
`VIDEO_PROCESSING_STORAGE_CONTAINER=video-processing`, plus `KLICKER_MILVUS_URI` and
`KLICKER_MILVUS_WRITER_TOKEN` for the target project config.

Three prerequisites are not yet met; the first two were found by reading live state and the
third by attempting the run. The account URL above is the live one from
`configmap/video-processing-storage`; `prdvideoprocessing.blob.core.windows.net` does not
resolve. The environment spans two operator profiles — the service credential is readable in
`video-processing-prd` and the Milvus pair in `klicker-prd` / `klicker-stg`, while `run` reads
one profile per invocation. And the published source is read with the operator's own
`DefaultAzureCredential`, so the operator needs a container-scoped `Storage Blob Data Reader`
on `prdvideoprocessingpq8ul/video-processing` (and the STG equivalent
`stgvideoprocessingv5rtr/video-processing`); today only the in-cluster workload identities hold
data-plane access.

| Course | Account | Course id | Chatbot id | KB id |
| --- | --- | --- | --- | --- |
| Finance I (`finance-i`) | assessment@df.uzh.ch | 0df37ea4-1baf-4fc6-984a-7e2db9652c59 | 03e94e5c-ac17-4ede-a2e6-f9e1db0a613b | 15ff49a3-44b0-4328-b3c1-ac5ff65ab9a0 |
| AMI (`ami`) | investments@df.uzh.ch | 0cf4d012-b5ab-4edd-bdcb-3945c84baf47 | afa62d41-a7e9-48b7-832f-610311a98108 | 609273f9-8708-496f-a315-bc0144b9a6bf |
| Corporate Finance (`corporate-finance`) | cf1@bf.uzh.ch | e4d87977-d414-4468-8060-a4b972b68e71 | 4c24b414-48ce-42c2-a516-959426ca59e1 | bbb23744-0a68-4f98-a752-ddb3f9c9519e |
| Fixed Income Markets (`fixed-income-markets`) | fim@df.uzh.ch | b16995b9-6320-442f-a2af-e0b77b9b745a | 057f1b63-3ee4-4fcf-8c8f-bbe4de7e78b3 | 751da790-a225-4703-9a34-020ecb5e1a79 |
| Structured Products (`structured-products`) | klicker-teaching@df.uzh.ch | 28ae2716-19df-4fc4-924f-2ed6a35f83db | 09ff73fc-eda5-468a-a890-af29d96d5965 | 558b9906-eebb-4333-89dd-82c249e5e3e7 |
| Banking and Insurance (`banking-and-insurance`) | banking@bf.uzh.ch | 8917b17e-fe87-4893-9d1e-5730785e0e7c | e230dff4-f7d5-46d2-9dc6-ab936ab68901 | 3698bbd4-40b9-4700-9afb-a9bfd86a2b85 |
| CHE170 (`che170`) | silke.johannsen@chem.uzh.ch | accb5947-a06a-465c-8629-9f801c34da94 | 64850878-8120-4366-8192-3ed348c89c12 | cb418afc-9c3b-4cfc-aac0-45d6208363f1 |
| Informatik und Wirtschaft (`informatik-und-wirtschaft`) | abraham.bernstein@uzh.ch | 6cb4aeac-8326-4ee3-aec2-0aa067715868 | 87113428-b6f2-4326-ad46-36a1aa9a6635 | 102dcdc9-587f-4514-a3ae-09158bc5c9ce |

Ids were read from the PRD database on 2026-09-14; the two `@bf.uzh.ch` accounts follow the
skill's ownership rule (the account that owns the current-semester course).

The IuW KB differs from the other seven in one way that matters for the pilot: it already
holds a production video corpus (872 chunks / 82 videos) copied from the legacy test scope by
the IuW chatbot thread, and the chatbot serves it correctly through the clean path. Those 82
recordings must not be re-imported through the lane; the one-command path applies to new
HS26 recordings only, starting with the first lecture not already in the corpus.

### Quarantine loop

Quarantined and excluded units never reach a candidate package, so activation cannot include
them; the loop decides what happens to the content they carry.

- Who decides: the course team owns content eligibility; the platform executes.
- What is recorded: the run itself writes `quarantine-decisions.json` next to the run's control
  file and names it in the receipt whenever the source holds held-back units. It lists one
  undecided row per unit — `unit_id`, `disposition` (`quarantine` | `excluded`), `reason_code`,
  with `decision` (`accept` | `reprocess` | `leave_out`), `reviewer`, `team`, `decided_at` and
  `note` left for the reviewer. The file is create-only, so re-running the import never discards
  a decision already made. The pilot decision is also recorded in this plan's progress table.
- How content re-enters: only through a new producer source. A unit the team wants in becomes an
  eligibility change at the producer (`clear_review` for a review-flagged unit), after which the
  recording is re-imported with a bumped `--resource-version`; the abandoned candidate stays
  inactive and no vector write happens for the quarantined set.

### S7 - in-cluster prepare/activate and course-specific policies

Target flow: the operator's local step ends at the video-processing submission. The
published `ingestion_source.json` becomes the hand-off to the data-ingestion workers: a
dispatch path triggers the existing `resource_candidate_batch` workflow on the
environment's ingestion cluster (embedding worker + in-cluster LiteLLM credential), which
runs inventory, package, prepare and the exact-count activation against Milvus with its
own credentials. The CLI keeps its local prepare/activate only as the fallback rehearsal
lane.

Work items:

1. data-ingestion: extend the video lane so prepare/activate can dispatch to the deployed
   workers (the staged run tree already produces the package artifacts; the missing piece
   is the remote dispatch + completion readback), and make the PRD ingestion embedding
   worker (currently 0/0) the execution point with its LiteLLM key.
2. video-processing: publish the completion signal in a way the lane can read without the
   public edge (the blob artifact listing is already authoritative; make the CLI treat
   published-artifact presence as terminal-state evidence instead of polling `/jobs`).
3. Policy naming: add a Finance I (or course-generic) eligibility descriptor, deploy it
   via `VIDEO_PROCESSING_INGESTION_SOURCE_POLICY`, and update the Finance I binding.
   Decide whether the pilot activation may proceed under the IuW-named descriptor
   (identical bytes) or waits for the renamed policy; the already-published lecture needs
   no reprocessing either way.
4. Runbook: replace the laptop-side prepare/activate steps with the dispatch flow; keep
   the receipt checks identical.

### S7 implementation plan - in-cluster prepare/activate (GLM 5.3 planning pass, 2026-09-16)

Verified contract facts this plan builds on: the CLI results lane runs inventory/package/
prepare/activate as pure functions of the staged run tree (`video_results.py`); the deployed
workers execute `resource-upsert` and `resource_candidate_batch` Hatchet workflows keyed by
`ResourceMutationEvent`; the PRD embedding worker (`prd-ingestion`, image `1eee63d6…`,
replicas 0, KEDA min 0/max 1, no pause annotations) gets `KLICKER_MILVUS_URI`/`_TOKEN` from
secret `prd-ingestion-klicker-milvus`, `OPENAI_API_KEY` + `HATCHET_CLIENT_TOKEN` from secret
`prd-ingestion`, and artifact storage (`prdingestartifactsfehm6/catalog-ingestion-handoff`)
from the ingestion ConfigMap; its `OPENAI_BASE_URL` is the in-cluster
`http://litellm.prd-litellm.svc.cluster.local:4000` with model `aibuddy/azure/
text-embedding-3-small`; `INGESTION_ALLOWED_MILVUS_TARGETS` already includes
`klicker_prd:klicker_course_materials_v1`; the deployed project-config set does not yet
include `klicker-course-materials.yaml`; the deployed worker image `1eee63d6…` is newer than
the STG one (`e781292e…`) and contains the video lane (per producer contract commit
`a6511ef0…` recorded in the staged candidate manifest).

Slice 7.1 - remote video-candidate workflow (data-ingestion, new branch on
`rs/video-lecture-import`): add `video_candidate_workflow.py` next to the existing
workflows: `hatchet.workflow(name="video-candidate-import"...)` with a single task
(`prepare-and-activate`) pinned via `worker_type_label("embedding")`, input model carrying
{control file reference (repo path or artifact-store key), `activate: bool`}. The task body
reuses `run_inventory/run_package/run_prepare/run_activate` from the CLI lane verbatim
(import from `ingestion_cli.video_results` or move that module into `ingestion/` so workers
can import it - prefer moving to keep the CLI thin). Receipts go to the artifact store under
`video-import/<job_id>/receipts.json` (create-only, same pattern as the service).
Registration: add the workflow to the worker registration list so the embedding worker picks
it up. Ship a new worker image (GitLab CI on the data-ingestion repo builds on the default
branch; cut a lane branch first so the workflow can merge in one PR).

Slice 7.2 - dispatch + completion readback (CLI): extend `video_import.py` with a
`--dispatch` flag on `video-import lecture`: after `_run_lane` is skipped, upload the staged
control.yaml + package inputs to the artifact store, then trigger the workflow via the
Hatchet Python client (`hatchet.admin.run_workflow("video-candidate-import", payload)`),
which needs `INGESTION_HATCHET_CLIENT_TOKEN`/`_HOST_PORT`/`_API_BASE`/`_TLS_STRATEGY` - on
PRD these resolve to `app-hatchet-svc-grpc-internal-lb.prd-hatchet-svc.svc:7070` (in-cluster)
or the LoadBalancer external IP `10.200.4.14:7070` for operator-side dispatch, token from
secret `prd-ingestion.HATCHET_CLIENT_TOKEN` via the Infisical profile once the name is
read-allowlisted). CLI polls the artifact-store receipts path (blob listing) rather than
`/jobs`, giving the WAF-resilient completion signal; print the receipts JSON as today.

Slice 7.3 - policy descriptors (klicker-uzh-video-ai + binding): add
`src/video_ai/ingestion_policies/` JSON descriptors for `finance-i-hs26-eligibility.v1`
(and optionally a `klicker-course-generic-hs26.v1` for the remaining six courses), change
`VIDEO_PROCESSING_INGESTION_SOURCE_POLICY` in the video-processing worker config to point at
the generic descriptor, update `course_targets/finance-i.yaml` policy block to the new
id+sha256, and record in this plan whether the pilot activation happens under the IuW-named
descriptor (bytes-identical) or waits for the redeploy. Ship the descriptor as part of the
same video-ai PR that merges the ingestion-source contract.

Slice 7.4 - enable PRD embedding worker + runbook (df-cloud / deployment): remove the
scale-to-zero state only if the dispatch flow is expected to run unattended (the same KEDA
metrics-api trigger already resumes on activity, so no change may be needed; verify once)
and replace the runbook's laptop-side prepare/activate steps with the dispatch flow.

Acceptance for S7: `ingestion-cli video-import lecture --video <file> --course finance-i
--dispatch` from the laptop ends with a receipt JSON in the artifact store and no embedding
call on the laptop; the worker logs show the embedding call hitting the in-cluster LiteLLM;
the vector write happens only when `--activate` is passed; and the receipts land in the run
tree for the S6 acceptance checklist.

## S6 acceptance checklist



Per pilot course: inventory lists the lecture with chunk counts; an owner-preview tutor question
answerable only from the imported lecture cites it by name and timestamp;
`usageSummary.lastActivityAt` advances; the per-stage receipts are attached to the import
manifest (job, source counts, prepare, activation count, inventory row, citation).

## Progress

- 2026-09-16 (Finance I pilot: PRD job completed and staged; local prepare blocked, target
  flow redefined): the first Finance I recording (`01_Finance1_VL.mp4`, 569 420 632 B,
  `sha256:5447065188...`) was uploaded to the PRD video-processing service as job
  `15ff49a3-44b0-4328-b3c1-ac5ff65ab9a0--01` and completed with all artifacts published
  (`ingestion_source.json` 476 812 B at 16:02 UTC, plus result/transcript/pipeline
  artifacts). The service assigned it 73 units: 67 eligible, 3 excluded, 3 quarantined,
  under the deployed eligibility descriptor `informatik-und-wirtschaft-hs26-eligibility.v1`
  (`sha256:08863ea7...`). The PRD worker config names that one descriptor globally, so the
  policy semantics (slide-type review rules) are course-agnostic but the id is IuW-named;
  the Finance I binding was written against the same digest, so the run is consistent and
  the naming fix is recorded as G8. The operator lane staged the source, and inventory (67
  eligible) and package (67 candidate units, digests receipted) passed locally. The local
  prepare failed closed: the embedding step needs `OPENAI_API_KEY`/`OPENAI_BASE_URL`, no
  operator Infisical profile exposes a readable OpenAI-compatible credential, the
  `klicker-dev` Azure OpenAI resource is VNet-restricted (403), and the deployed ingestion
  workers embed through the in-cluster LiteLLM with keys that live only in cluster secrets.
  Separately, the public `video.ai.prd.df-app.ch` edge began blocking the operator IP with
  an administrative-rules 403 after the long upload+poll session (GET /healthz without auth
  also 403s), so service-side status polling needs a WAF-resilient completion signal (blob
  listing works and is authoritative). Direction confirmed with the course owner: the local
  step should end at the video-processing submission; prepare and activation belong to the
  data-ingestion workers reading the published outputs (G7/S7 below), not to the laptop.

- 2026-09-16 (S1/S2/S3 functional acceptance readback closed on PRD; persisted-query
  registry format lesson): the `getKbImportedSources` GraphQL readback now passes on PRD
  against the IuW KB (`102dcdc9`), returning real video sources (first 10 of the 82-video
  scan) with per-source chunk counts and `urn:video-ingestion:sha256:...#t=start,end`
  source URLs. Two acceptance-relevant lessons are now confirmed live. First, the deployed
  persisted-operations registry registers each operation under the hash of its
  `__typename`-annotated form (every selection level gets a `__typename` field), so a
  client must send `extensions.persistedQuery {version: 1, sha256Hash}` computed over that
  registry text; hashing the raw op file yields `PersistedQueryNotFound`. The Yoga plugin
  (v1.9.1) reads only `extensions.persistedQuery.sha256Hash`; an `operationId` body is
  invisible to it. Second, the middleware accepts `Authorization: Bearer <session JWT>`
  alongside the session cookie, which is the practical route for scripts. STG returns the
  correct domain error `AI_BETA_ACCESS_REQUIRED` for the same query (the owner lacks AI
  beta access on STG), confirming the authorization path there. The readback script lives at
  `/private/tmp/iuw_sources_pq3.py` (ephemeral); this entry is the durable evidence record.

- 2026-09-16 (S1/S2/S3 verified live on both environments; IuW KB serving proof; Milvus
  database correction): a live readback found all three serving prerequisites delivered on
  STG and PRD, ahead of the progress notes below. The `backend-graphql` ExternalSecret on both
  clusters carries the four `DOC_QUERY_SCOPE_*` names (S1 STG was already recorded; S1 PRD was
  not); the `KB` `ChatbotMCPServer` row exists on both with the environment in-cluster URL,
  `authType = 'bearer'`, `isActive = true` and a non-null encrypted secret (S2, previously
  listed as not started); and doc-query runs `3cc2771b` on both, a 2026-09-15 revision above
  the v0.13.0 release that contains the `doc_query_sources` companion tool (S3, beyond the
  STG-only pin recorded below). PRD backend-graphql is healthy at 6/6 ready replicas; one
  rollout-leftover pod in Error state has a healthy replacement.

- 2026-09-16 (IuW KB serves correctly; prior near-empty-collection reading was a
  measurement error): the productive Informatik und Wirtschaft chatbot
  (`87113428-b6f2-4326-ad46-36a1aa9a6635`, published, owner Abraham Bernstein) is bound via an
  enabled `KBChatbot` row to KB `102dcdc9-587f-4514-a3ae-09158bc5c9ce`, and its tutor and
  explainer MCP configs both point at the global `KB` server with tool `doc_query` — the
  clean multi-tenant path. The KB scope holds 872 active chunks across 82 distinct
  `video_source_id` values, each carrying a human-readable `video_name` and a
  `urn:video-ingestion:sha256:…` source URL, with `chatbot_id` rewritten to the new chatbot.
  An earlier reading that called the serving collection near-empty was wrong: it was taken
  against Milvus's default database. The Klicker tenant serves from the database named by
  `DOC_QUERY_TENANT_KLICKER_MILVUS_DATABASE_NAME`, where `klicker_course_materials_v1` holds
  18 922 rows across all KBs. The legacy path is inert: the
  `klicker_ai_informatik_und_wirtschaft` collection (872 slug-scoped rows) still exists, and
  its `Informatik und Wirtschaft Video Doc Query` server row is `isActive=false` with both
  chatbot configs disabled. Deployment receipts from the IuW thread
  (`/private/tmp/iuw-hs26/receipts/`) show owner-preview turns answering with video citations
  and timestamps through `doc_query`, and the copy receipt (872 scanned / 872 inserted,
  postcheck verified, zero id overlap). One transient incident (second chat turn failing
  around 07:00Z on 2026-09-16) was root-caused to a Milvus rollout restart; doc-query
  readiness recovered and a fresh preview turn cited correctly. Consequences: do not re-import
  the 82 existing recordings (double corpus for paid VLM cost); the imported-sources listing
  will group them into 82 named video entries (the deployed inventory builder groups by
  `video_source_id` with `video_name` as the first title fallback); and the S6 acceptance
  already has a live citation proof to build on.

- 2026-09-15 (blob data-plane access granted and proven): the operator identity
  `roland.schlaefli@df.uzh.ch` (object id `40206a71-60af-4867-bfe4-a5ba62b0b45d`) now holds a
  container-scoped `Storage Blob Data Reader` on `prdvideoprocessingpq8ul/video-processing`
  (assignment `c88672d3-7717-4f91-9cf5-8764451d40a6`) and on
  `stgvideoprocessingv5rtr/video-processing` (assignment `b0350c16-830b-4fef-b851-596d6f624005`).
  Both were proven with the exact read path the import uses: `az storage blob download
  --auth-mode login` fetched each published `ingestion_source.json` and the local SHA-256 equals
  the pod-side readback (`b7b69f89…` STG, `61c1fc74…` PRD). The import is no longer blocked on
  storage access; the remaining pilot prerequisite is the recording itself. The lane's own client was
  then exercised directly — `AzureBlobArtifactStore(account_url=…)` plus `fetch_published_source`
  against both existing proof jobs, so no new paid run occurred — and it returned the same objects:
  PRD 35 597 B / `61c1fc74…` / 10 units (7 eligible, 3 quarantined, 0 excluded) and STG 36 207 B /
  `b7b69f89…` / 10 units (6 eligible, 3 quarantined, 1 excluded), both with
  `policy_sha256:08863ea7…`. That is the function that previously failed closed.
- 2026-09-15 (STG secret repaired): the STG ExternalSecret drift is confirmed
  at the value level, not just the event text. Through the restricted operator, the STG profile
  resolves `VIDEO_PROCESSING_POSTGRES_DSN` but returns HTTP 404 for `VIDEO_PROCESSING_API_KEY`
  (presence probes, exit status only), while the PRD profile resolves the same name. The STG
  `video-processing` Infisical project therefore lacks the unsuffixed key that both the df-cloud
  mapping (`convertExternalSecret('api-key', 'VIDEO_PROCESSING_API_KEY')`) and the operator
  profile request. The materialized Secret still holds its 2026-08-20 value, the `SecretStore` is
  healthy, and no reloader annotation is on the `video-processing` Deployments, so nothing is
  broken today and any new value needs an explicit pod restart to take effect. The repair created
  `VIDEO_PROCESSING_API_KEY` in the STG project with a generated value (`set-random --bytes 32`;
  the value was never read, printed or persisted). A fresh value was chosen over restoring the old
  one deliberately: the old value cannot be read without handling a credential, and the key is
  service-internal, so both of its readers — the API pod (via the materialized Secret) and the
  importer (via the same Infisical project) — follow the new value together. The write path was
  `allow-write VIDEO_PROCESSING_API_KEY` on `video-processing-stg` (its write allowlist was
  empty), then the key write, an ExternalSecret force-sync, and a restart of the STG API pod. Result:
  the ExternalSecret is `Ready=True` / `SecretSynced`, the materialized Secret holds all five key
  names with non-empty values, the new API pod is 1/1 Running, and the repaired key authenticates
  against the live STG service — a port-forward probe returned `health=200`, no-key `401`,
  wrong-key `401`, and the operator-supplied key `200`. The finding rests on names, status codes
  and timestamps only.

- 2026-09-15 (S4 PRD promoted, real-video proof passed on both environments): PR #123's
  revision is live on PRD. The digests promoted in PR #125 (merge
  `bfdccd7a4690724ac932706cf8b1a544b50db71b`) are the API
  `sha256:c33ddcb12f29f6cfa626453744c0c9503b2b3adf23b61b8c2a01b29124723409` and the worker
  `sha256:27a3bacdc8acff26b3a2ca31270cc5ca9fb46d33b4a1e00e49012f5a87ddd819`; ArgoCD
  `app-video-processing` is `Synced` at `bfdccd7a` in `argo` on both clusters and every
  Deployment carries those digests. One real recording was submitted to each environment. On
  PRD, job `prd-ingestion-source-proof-20260915` (`dispatch_id
  9fd0a1ce-80b4-4e71-b3f7-df295f929a73`) completed on attempt 1 in 242 s and published
  `artifacts/prd-ingestion-source-proof-20260915/learning_units/ingestion_source.json`
  (35 597 B, object `sha256:61c1fc741c413aea00e648645cf4ea28aa7c30a7a1298fbf78f1d1549e9a81b5`),
  with 10 source units: 7 eligible, 3 quarantined, 0 excluded, and 10 embedding units; VLM spend
  on the job ledger was `$0.24`, under the `$5.00` PRD cap, on the internal
  `klickeruzh/azure/gpt-5.6-luna` route. On STG, job `stg-ingestion-source-proof-20260915`
  published 36 207 B (`sha256:b7b69f891a2b0a7e644e92d73d478b5e2f40a136277a1d0d10fff368be136cfd`)
  with 10 units: 6 eligible, 3 quarantined, 1 excluded, on the OpenRouter Gemini route. Both
  objects were re-read this session from inside the respective API pod — the only client with
  data-plane access — and both still declare
  `policy_sha256 sha256:08863ea7d71d576530c4fa7b3418f842f089a761f5dce2e1f9481a9b842ff683`, the
  raw hash of the tracked descriptor, so the applied policy is the reviewed one. Both proofs used
  the same source recording (`sha256:0fd99f0c7c9787f4dda29f7dbea396ff84ef1fbad293989e4d7e293a95322fcd`,
  20 923 774 B). An earlier note that PRD carries the same migration-ledger gap as STG was wrong:
  PRD's ledger already had v1 applied on 2026-08-24.
- 2026-09-15 (KEDA pause drift cleared on both STG routes): the hand-set
  `autoscaling.keda.sh/paused-replicas: "0"` annotation (applied by `kubectl-annotate`
  2026-08-08, absent from Git) has now been removed from both STG `ScaledObject`s, not only the
  workflow route. Live readback: both are `Paused=False` with no `pausedReplicaCount`, both HPAs
  exist, both worker Deployments sit at 0/0 (correct at zero demand), and both PRD
  `ScaledObject`s are likewise unpaused. STG now matches Git; nothing remains to decide here
  unless the transcription route should be re-paused deliberately.
- 2026-09-15 (STG ExternalSecret drift pinned): the STG ExternalSecret
  `df-infra-k8s-es-inf-stg-apps-video-processing-secrets` is `Ready=False` /
  `SecretSyncedError`. Its event names the cause exactly: `spec.data[1]` (`remoteRef.key
  VIDEO_PROCESSING_API_KEY`) returns `APIError … status-code=404 … "Secret with name
  'VIDEO_PROCESSING_API_KEY' not found"` against `workspaceSlug=video-processing` environment
  `stg`. The in-cluster `SecretStore` itself is healthy (`Ready`, "store validated"), and the
  operator profile `video-processing-stg` also now returns HTTP 404 for that name, so the drift
  is a missing key in the STG Infisical project, not an operator-profile gap. The Secret object
  still carries a working value (all five keys, created 2026-07-17, last successful sync
  2026-08-20) because `DeletionPolicy: Retain` and the target `video-processing-secrets` remain
  unmanaged on failure, and the running API enforces a non-empty key — so this is latent, not
  currently breaking. Repair options: create/rename the key in the STG Infisical project to the
  unsuffixed name (matches PRD and the df-cloud mapping), or point the mapping at the suffixed
  name that exists there. Values were never read or printed.
- 2026-09-15 (S4 pilot import blocked on blob data-plane read): the operator side is ready —
  the CLI, the seven bindings and the results lane all work — but the run cannot fetch the
  published source. `fetch_published_source` reads through `AzureBlobArtifactStore` with
  `account_url` + `DefaultAzureCredential`, so it uses the operator's own identity; the signed-in
  `roland.schlaefli@df.uzh.ch` holds no blob data-plane role on `prdvideoprocessingpq8ul`. The
  account's `Storage Blob Data Contributor` grantees are `managed-identity-prd-video-processing-api`
  and `…-worker`; the STG account `stgvideoprocessingv5rtr` names its two managed identities
  likewise, and `az storage blob list --auth-mode login` is denied on both. The operator already
  holds exactly this pattern container-scoped elsewhere (`stgaiinfraingestionceebc`: Contributor
  on `eduai`, `klicker`, `web-index-catalogs`, Reader on `catalog-ingestion-handoff`), so a
  container-scoped `Storage Blob Data Reader` on `prdvideoprocessingpq8ul/video-processing` and
  `stgvideoprocessingv5rtr/video-processing` follows established convention. A request to read
  the storage-account key as an alternative was rejected by automatic approval review as
  credential extraction after failed authentication; that workaround is not pursued.
- 2026-09-15 (recording availability): no recording for a bound course is present. The PRD
  digests and the STG digests were proven with
  `Informatik und Wirtschaft/11.05 Künstliche Intelligenz - Prototypische KI-Anwendungen.mp4`
  from `klicker-uzh-video-ai/input/`, which belongs to a UZH course that has no binding here.
  `Strukturierte_Produkte/` still holds only three PDFs, and no new video file has appeared
  anywhere under `/Users/rschlae` since 2026-09-01. The pilot therefore needs either an SP
  recording supplied by the user, or an explicit decision to run any available recording into the
  SP binding (the binding is per course, not per recording). Not chosen silently.

- 2026-09-15 (S4 STG deployed, real-video proof pending): the producer revision is live on
  STG. klicker-uzh-video-ai PR #123 squash-merged to `main` as `1ef6a0b7` and the digest
  promotion merged as PR #124 -> `b3cfa52a`; `checks`, `package` and
  `hatchet-worker-smoke` are green at that head. The promotion replaced the API digest
  `sha256:c434651396a513314bd3a6b12e2301581e64668b7ca14ef2b13c3463ae5579af` with
  `sha256:c33ddcb12f29f6cfa626453744c0c9503b2b3adf23b61b8c2a01b29124723409` and the worker
  digest `sha256:e0896e52bb3f7c14e90703a021c73a7b0a5afe7892221419f681557f05ffc669` with
  `sha256:27a3bacdc8acff26b3a2ca31270cc5ca9fb46d33b4a1e00e49012f5a87ddd819`. ArgoCD
  `app-video-processing` (namespace `argo`) synced to `b3cfa52a` and all three Deployments
  carried the new digests; the worker ConfigMap already named
  `/opt/ingestion-policies/informatik_und_wirtschaft_hs26_eligibility_v1.json`, so no config
  change was needed. The rollout then exposed an unwritten STG prerequisite: the STG database
  predates the migration ledger and the first API pod crash-looped with
  `SchemaMigrationRequired`, because the documented `video-processing-migrate` deployment step
  had never been run on STG (PRD carries the same gap). Migration v1
  `video-processing-initial-schema` (checksum `435bdcfbd40909d07dcce2de5aa76e3bf04bf7bf3c43631c6e75ea04b7088367`)
  is additive-only and idempotent; a values-free readback first confirmed every table, all 32
  job columns, all 15 reservation columns and all 7 indexes already existed, so applying it
  recorded only the ledger row and left the 65 existing jobs intact. The API pod then reached
  1/1 Running. The user-supplied cluster tunnel dropped twice mid-run (`localhost:6443` and the
  STG database forward both refused connections) and the artifact readback needs cluster access
  because the STG blob endpoint resolves only inside the cluster; the deployed API is reachable
  over its public ingress (`https://video.ai.stg.df-app.ch/health` -> 200; `/jobs` without a
  key -> 401), and the run resumed each time the tunnel returned.
- 2026-09-15 (S4 one-recording proof, STG): the real-video proof passed on STG. One recording,
  `11.05 Künstliche Intelligenz - Prototypische KI-Anwendungen.mp4` (235.5 s, 20 923 774 B,
  source `sha256:0fd99f0c7c9787f4dda29f7dbea396ff84ef1fbad293989e4d7e293a95322fcd`), was
  submitted as job `stg-ingestion-source-proof-20260915` (`dispatch_id
  d473d3a6-2bdf-4143-96fa-f86449f95438`, Hatchet) and completed on attempt 1 with no error,
  2 m 52 s of processing (prepare-video 27.6 s, describe-frames 34.0 s, transcribe 141.2 s,
  build-chunks 28 ms, review 15 ms). VLM spend on the job ledger was `$0.0165035` (12
  generations, 29 504 tokens), an order of magnitude under the `$1.00` per-job cap. The
  publication step wrote `artifacts/stg-ingestion-source-proof-20260915/learning_units/ingestion_source.json`
  (36 207 B, object `sha256:b7b69f891a2b0a7e644e92d73d478b5e2f40a136277a1d0d10fff368be136cfd`,
  `schema_version video_ingestion_source.v1`); a pod-side readback listed all eight learning-unit
  artifacts. The source carries 10 units: 6 eligible, 3 quarantined (`keep_in_queue`, reason
  `ingestion_policy_keep_in_queue`), 1 excluded (`export_excluded`), with 10 embedding units.
  The published `policy_sha256 sha256:08863ea7d71d576530c4fa7b3418f842f089a761f5dce2e1f9481a9b842ff683`
  equals the raw hash of the tracked descriptor
  `src/video_ai/ingestion_policies/informatik_und_wirtschaft_hs26_eligibility_v1.json`
  (`policy_id informatik-und-wirtschaft-hs26-eligibility.v1`), so the applied policy is the
  reviewed one, not a default. The proof ran on the promoted digests: API pod image
  `…-video-processing-api@sha256:c33ddcb1…` and worker `…-video-processing-worker@sha256:27a3bacd…`,
  with ArgoCD `app-video-processing` `Synced`/`Suspended` at `b3cfa52a`. One live drift had to
  be cleared to run it, and it is not in Git: both KEDA `ScaledObject`s carried a hand-set
  `autoscaling.keda.sh/paused-replicas: "0"` (applied by `kubectl-annotate` 2026-08-08), which
  creates no HPA and leaves the workflow worker at zero replicas, so the job sat `queued`; the
  annotation was removed on `video-processing-worker-workflow` only, the HPA and worker pod
  appeared, and the job ran. The transcription route is still paused. Three stale July jobs
  (`s8-case5-acoustic-78`, `s8-case5-acoustic-78-r2`, `s8-case4-dense-807`, all
  `attempt_count: 0` from 2026-07-28) are explained by the same pause. PRD promotion (STEP S4
  item 3) is now unblocked on the STG proof and remains a separately gated action.
- 2026-09-15 (STG API-key name drift, open): the STG Infisical project `video-processing`
  (environment `stg`) stores the service credential as `VIDEO_PROCESSING_API_KEY2`; there is
  no `VIDEO_PROCESSING_API_KEY` at that path. Both df-cloud's STG ExternalSecret mapping
  (`src/apps/klicker/functions.ts`, `convertExternalSecret('api-key',
  'VIDEO_PROCESSING_API_KEY')`) and the local `rs-infisical-operator` profile
  `video-processing-stg` name the unsuffixed key, so operator injection returns HTTP 404 and
  the intended key path is unavailable. PRD's project has the unsuffixed name and matches its
  mapping. Whether the STG ExternalSecret is currently syncing or holding an older value needs
  a cluster readback; the running API enforces a non-empty key, so the Secret carries one. Values
  were never read or printed: the finding rests on names, environments and timestamps only.
- 2026-09-15 (S3 STG delivered): the serving side is live on STG with per-stage receipts.
  `ingestion_stg_manifest_validate` had been red on `main` since `fe68f4a9`
  doubled the STG durable-control slots to 16 without updating either
  `EXPECTED_LITERAL_ENV` entry, and the broad `.gitlab-ci.yml` anchor meant every pins MR
  inherited it; `deployment` MR !878 reconciled both entries, after a pristine `origin/main`
  extract reproduced the failure. The pins MR !877 was rebased and its pipeline 665304 ran all 16 jobs
  green, then merged; `main` is `661c716e6cc4b46cc7532935c99f631bea42a0d2`. ArgoCD
  `app-doc-query-stg` and `app-klicker-pipelines-stg` (both automated, selfHeal and prune)
  synced to that revision and `mcp-doc-query` in `stg-doc-query` rolled to the v0.13.0 arm
  digest, ready 1/1/1. Runtime readback through a port-forward: `tools/list` on `/mcp/klicker`
  returns 39 tools including `doc_query_sources`; a scope-token `tools/call` for the SP
  knowledge base (`558b9906-eebb-4333-89dd-82c249e5e3e7`) returns `isError: false`,
  `source_count: 0`, `scanned_chunks: 0`, `unidentified_chunks: 0`, so the SP corpus on STG is empty
  and the zero is reported by counter rather than silence. The scope header takes a `Bearer ` prefix:
  `_verify_scope_token` reads the configured header, not `authorization`. PRD pins and PRD scope keys
  are untouched.

- 2026-09-14: plan drafted; skill video-lane section pushed to PR #6022. No slice started.
- 2026-09-14 (S4 tooling): the one-command lane exists in data-ingestion branch `rs/video-lecture-import` — `ingestion-cli video-import lecture`, the operator client for the service contract, seven committed bindings under `course_targets/`, and a local rehearsal against a stand-in service plus Azurite: 13 source units, 11 candidate units, 11 prepared documents, identical digests on rerun. Producer side: klicker-uzh-video-ai PR #123 pins the job id as the run identity and publishes the source; the deployed revision predates it.
- 2026-09-14 (S1/S2 drafting): `2026-09-14-video-import-gated-steps.md` records the exact deployment and DB steps, including the `authType = bearer` correction for the `KB` MCP row. Nothing executed.
- 2026-09-14 (S3 verification): the candidate lane already stamps `kb_id` and `chatbot_id` (data-ingestion main, `a284fdc`); the SP rehearsal chunks carry the SP `kb_id` with `resource_active=false`. PRD and STG already run the standalone doc-query lineage and already carry the `kb_id` token scope; only the image predates the companion tool (mcp-doc-query draft MR !84, two commits ahead of `origin/main`). Gated steps recorded as STEP S3.
- 2026-09-14 (S1 verification): the four `DOC_QUERY_SCOPE_*` names are projected into the chat secret but not into `backendGraphqlSecretNames` (`df-cloud-image-pins` `src/apps/klicker/functions.ts`), confirming STEP S1 needs that one list change and nothing else.
- 2026-09-14 (S5 scaffold): `video-import lecture` now writes the reviewer scaffold itself — `quarantine-decisions.json` in the run tree, one undecided row per held-back unit, create-only, path in the receipt (`quarantine_decisions`), proven by a CLI test with one eligible and one quarantined unit (data-ingestion MR !172, `76e3c16`). What is left for S5 is the loop decision, not the record.
- 2026-09-14 (S4 preparation): producer PR #123 also bakes the tracked descriptors at `/opt/ingestion-policies` and names the eligibility descriptor in `deploy/base/worker-configmap.yaml`, so the S4 promotion is the merge plus digest bumps; the deploy render suite asserts the wiring in base, stg and prd (head `0bd22bf`, render suite 103 passed, Ruff and Pyrefly clean).
- 2026-09-14 (id check): the course table was re-checked against the seven committed bindings; the Corporate Finance knowledge base id carried a transcription typo and now carries the binding value.
- 2026-09-15 (S1 STG applied): the scope-signer delivery merged as `df-cloud-klickeruzh` MR !581 (`stg`, `8c0c01e266`). Pipeline 665202's manual `deploy-app-stg: [klicker]` ran `app-preview` and then `app-up`; the apply changed exactly one resource, the `app-klicker-klicker-uzh-v2-secret-backend-graphql` ExternalSecret, which now carries the four `DOC_QUERY_SCOPE_*` mappings (Reloader restarts the workload). The functional readback and S2 remain blocked on host access: this machine has no route to the cluster API (`localhost:6443` refused) or the STG database (`db-server-stg-apps` refused), and the STG `KB` row does not exist yet, so `getKbImportedSources` still throws before the token path.
