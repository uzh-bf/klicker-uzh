# Course chatbot video import lane — end-to-end plan

Status: draft, awaiting slice approval. Complements
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
3. Inventory tool: `doc_query_sources` scope-guarded companion implemented at mcp-doc-query
   `d8be6cf` (S1 of the inventory plan). STG/PRD deployment and registration: not done.
4. Klicker inventory consumer: `getKbImportedSources` merged to `v3-ai` (#5922 →
   `7f777565f0`). Degrades outside local because (a) the ES256 minting keys
   (`DOC_QUERY_SCOPE_*`) exist only on the chat workload, (b) no `ChatbotMCPServer` row named
   `KB` exists in STG/PRD, (c) the live producer stamps `chatbot_id` while the scope token
   carries the KB identity (`kb_id` rename pending).
5. PRD doc-query runtime: in-cluster endpoint
   `http://mcp-doc-query.prd-doc-query.svc.cluster.local:1417/mcp/klicker`, tenant collection
   `klicker_course_materials_v1`, proven by `apps/chat/scripts/prd-doc-query-proof.mjs`
   (15 KB / 22 chatbot corpus proofs on `v3-ai`).
6. Course fleet: seven published course chatbots with KBs (Finance I, AMI, FIM, SP, CF, BI,
   CHE170) provisioned 2026-09-13/14; first lecture recordings expected from Tue 2026-09-15
   (SP).

## Gaps and slices

| Gap | Slice | Repo / owner |
| --- | --- | --- |
| G1 GraphQL workload cannot mint scope tokens | S1 scope keys on backend-graphql | klicker-uzh / main |
| G2 no `KB` MCP server row in STG/PRD | S2 live registration | klicker-uzh / main |
| G3 producer stamps `chatbot_id`, inventory scopes by KB identity | S3 identity reconciliation + doc-query deploy | data-ingestion + mcp-doc-query / executor |
| G4 no PRD-bound import operations for course videos | S4 pilot import runbook + first recording | data-ingestion / main + executor |
| G5 review path for flagged units undefined | S5 quarantine review loop | video-ai + main |
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

### S2 — register the `KB` MCP server row

`getKbMcpServerOrThrow` resolves one global `ChatbotMCPServer` row by `name = 'KB'`
(`packages/graphql/src/services/knowledge.ts:566`). Register on STG then PRD via a guarded,
receipted DB insert (idempotent upsert by name): `url` = environment doc-query MCP endpoint,
`authType = 'scope_token'`, `isActive = true`, no stored secret (scope token is minted per
call). Acceptance: Manage's imported-sources section renders non-degraded for a course KB, and
`Knowledge base retrieval is not configured` no longer occurs for inventory reads.

Authority: live database write to STG, then PRD.

### S3 — identity reconciliation and doc-query deployment

The importer maps `kb_id` and `chatbot_id` into chunk metadata
(`modules/ingestion/src/ingestion/steps/writing/video_document_mapper.py`); the live producer
still stamps only `chatbot_id`. Decide and implement the transition on the df side: preferred
dual-stamp (`kb_id` authoritative, `chatbot_id` retained for compatibility) so retrieval and
inventory agree during rollout; fallback is a doc-query-side alias filter. Deploy mcp-doc-query
main (with `doc_query_sources`) to STG then PRD. Acceptance: a test source written with the
new stamp appears in the STG inventory through Manage; existing retrieval corpus proofs still
pass (scope-filter regression); zero-row corpora explain themselves by stamp, not by silence.

Authority: df-side deployment + STG corpus test write; PRD corpus write only within S4.

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
video-ai repo already emits review artifacts (`review/full_review.html`,
`quality_review.html`, reviewer ZIP). Define the operator loop: who reviews (course team vs
us), where the decision is recorded (per-import quarantine manifest with reviewer, decision,
timestamp), and how an approved unit re-enters a later candidate package. Acceptance: one
documented loop decision plus the quarantine manifest schema folded into the S4 runbook; no
flagged unit reaches activation without a recorded decision.

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
with `published_source_missing`.

Operator side, per recording:

1. `ingestion-cli video-import lecture --video <file> --course <slug> [--asr-language de]`
   submits, waits, fetches the published source, and runs inventory, package and prepare. The
   run directory is `project/_local/video-import/<slug>/runs/<lecture-slug>/` in the
   data-ingestion checkout.
2. Check the receipts: service job status and reuse, source unit counts against the binding's
   policy digest, inventory source/eligible/excluded/quarantined counts, prepare
   `prepared_count == eligible_unit_count`, and a `target_fingerprint` that stays stable for the
   environment.
3. Activate with the same command plus `--activate`; this is the exact-count corpus write and the
   only step that touches the vector store.
4. Verify from Klicker: the lecture appears in Manage's imported-sources list for the KB, and one
   owner-preview question answers only from that lecture and cites it with a timestamp.

Committed bindings live at `modules/ingestion-cli/src/ingestion_cli/course_targets/<slug>.yaml`
in data-ingestion (seven courses). Environment for a PRD run (host shell, via
`rs-infisical-operator --profile klicker-prd run --map ...`):
`VIDEO_PROCESSING_SERVICE_URL=https://video.ai.prd.df-app.ch`, `VIDEO_PROCESSING_API_KEY`,
`VIDEO_PROCESSING_STORAGE_ACCOUNT_URL=https://prdvideoprocessing.blob.core.windows.net`,
`VIDEO_PROCESSING_STORAGE_CONTAINER=video-processing`, plus `KLICKER_MILVUS_URI` and
`KLICKER_MILVUS_TOKEN` for the target project config.

| Course | Account | Course id | Chatbot id | KB id |
| --- | --- | --- | --- | --- |
| Finance I (`finance-i`) | assessment@df.uzh.ch | 0df37ea4-1baf-4fc6-984a-7e2db9652c59 | 03e94e5c-ac17-4ede-a2e6-f9e1db0a613b | 15ff49a3-44b0-4328-b3c1-ac5ff65ab9a0 |
| AMI (`ami`) | investments@df.uzh.ch | 0cf4d012-b5ab-4edd-bdcb-3945c84baf47 | afa62d41-a7e9-48b7-832f-610311a98108 | 609273f9-8708-496f-a315-bc0144b9a6bf |
| Corporate Finance (`corporate-finance`) | cf1@bf.uzh.ch | e4d87977-d414-4468-8060-a4b972b68e71 | 4c24b414-48ce-42c2-a516-959426ca59e1 | bbbb23744-0a68-4f98-a752-ddb3f9c9519e |
| Fixed Income Markets (`fixed-income-markets`) | fim@df.uzh.ch | b16995b9-6320-442f-a2af-e0b77b9b745a | 057f1b63-3ee4-4fcf-8c8f-bbe4de7e78b3 | 751da790-a225-4703-9a34-020ecb5e1a79 |
| Structured Products (`structured-products`) | klicker-teaching@df.uzh.ch | 28ae2716-19df-4fc4-924f-2ed6a35f83db | 09ff73fc-eda5-468a-a890-af29d96d5965 | 558b9906-eebb-4333-89dd-82c249e5e3e7 |
| Banking and Insurance (`banking-and-insurance`) | banking@bf.uzh.ch | 8917b17e-fe87-4893-9d1e-5730785e0e7c | e230dff4-f7d5-46d2-9dc6-ab936ab68901 | 3698bbd4-40b9-4700-9afb-a9bfd86a2b85 |
| CHE170 (`che170`) | silke.johannsen@chem.uzh.ch | accb5947-a06a-465c-8629-9f801c34da94 | 64850878-8120-4366-8192-3ed348c89c12 | cb418afc-9c3b-4cfc-aac0-45d6208363f1 |

Ids were read from the PRD database on 2026-09-14; the two `@bf.uzh.ch` accounts follow the
skill's ownership rule (the account that owns the current-semester course).

### Quarantine loop

Quarantined and excluded units never reach a candidate package, so activation cannot include
them; the loop decides what happens to the content they carry.

- Who decides: the course team owns content eligibility; the platform executes.
- What is recorded: per import, `quarantine-decisions.json` next to the run's control file with
  one entry per unit — `unit_id`, `disposition` (`quarantine` | `excluded`), `reason_code`,
  `decision` (`accept` | `reprocess` | `leave_out`), `reviewer`, `team`, `decided_at`, `note`.
  The pilot decision is also recorded in this plan's progress table.
- How content re-enters: only through a new producer source. A unit the team wants in becomes an
  eligibility change at the producer (`clear_review` for a review-flagged unit), after which the
  recording is re-imported with a bumped `--resource-version`; the abandoned candidate stays
  inactive and no vector write happens for the quarantined set.

## S6 acceptance checklist

Per pilot course: inventory lists the lecture with chunk counts; an owner-preview tutor question
answerable only from the imported lecture cites it by name and timestamp;
`usageSummary.lastActivityAt` advances; the per-stage receipts are attached to the import
manifest (job, source counts, prepare, activation count, inventory row, citation).

## Progress

- 2026-09-14: plan drafted; skill video-lane section pushed to PR #6022. No slice started.
- 2026-09-14 (S4 tooling): the one-command lane exists in data-ingestion branch `rs/video-lecture-import` — `ingestion-cli video-import lecture`, the operator client for the service contract, seven committed bindings under `course_targets/`, and a local rehearsal against a stand-in service plus Azurite: 13 source units, 11 candidate units, 11 prepared documents, identical digests on rerun. Producer side: klicker-uzh-video-ai PR #123 pins the job id as the run identity and publishes the source; the deployed revision predates it.
- 2026-09-14 (S1/S2 drafting): `2026-09-14-video-import-gated-steps.md` records the exact deployment and DB steps, including the `authType = bearer` correction for the `KB` MCP row. Nothing executed.
