# Informatik und Wirtschaft production go-live plan

## Goal

Activate the prepared, inactive production course chatbot end to end through the
shared multi-tenant doc-query service, with bounded participant verification and
a rehearsed rollback. This plan sequences the Klicker-side steps against the
parallel doc-query multi-tenant cutover work and records the decisions that
still need a user ruling.

## Verified starting state (2026-08-16)

- Production database rows are prepared and verified under the `klick` account:
  a new German course, disclaimer, chatbot, inactive Doc Query server, and two
  strict tutor/explainer bindings. No production cluster, deployment, route, or
  release state was changed for them.
- The production chat runtime does not yet contain the required merged runtime
  (`#5405` required MCP enforcement, `#5411` structured citations, `#5414`
  structured-content unwrapping). The current `v3` tip `2d9c5d048` does.
- STG already uses the new multi-tenant doc-query service. The I&W chatbot was
  cut over to the shared tenant route `/mcp/klicker` (service v0.8.1, source
  `bb2aba79`, image digest `sha256:6efb013`) during this work: the MCP row was
  rekeyed while inactive and live Tutor/Explainer retrieval was proven through
  the shared route. The legacy per-course STG route is no longer used by this
  chatbot.
- Direct STG Chat admission to the neutral multi-tenant service is proven
  (deployment MR `!602` at `a33141b2`: authenticated 200, wrong/missing bearer
  401, synthetic Klicker-compat binding proof with guarded rollback and zero
  residual rows).
- Production multi-tenant state (from the pre-cutover roadmap, thread
  `019febd4-cc79-7ce2-915a-6511aa7bd1a5`): deployment `origin/main@32d51401`
  now contains the exact 17-pair Klicker inventory, including both the I&W
  video pair and the RadioSurfVet pair. This proves the committed source pair,
  not the PRD collection or a live retrieval path. Draft deployment MR `!609`
  pins the STG-proven v0.8.1 image and preserves that inventory; its pipeline
  `645943` passed, but publication is held because the separate Aibuddy
  `doc-query-eduai` Secret apply failed on pre-existing Azure
  BlobServiceProperties drift (`InvalidRequestPropertyValue`). No secret
  values were read, and no PRD runtime change is claimed from the draft.
- Video-AI upstream readiness is at the package boundary only: its A8 course
  package records 82 complete videos and 872 publishable units, while A9
  EXPERT course-ingestion authorization and target read/write acceptance remain
  open. The local/STG corpus evidence therefore cannot be used as PRD
  collection-readiness proof.
- The RadioSurfVet onboarding (thread `019fead3-07b6-7831-a941-517620b0010d`)
  owns the second course pair and is aligning its roadmap with this
  deployment; both additions share the same W5a inventory gate.

## P0 preflight result (2026-08-16)

The approved bounded read-only tracer ran against both live multi-tenant
doc-query services. It did not change Milvus, deployment state, credentials, or
Klicker rows.

| Check | Result | Evidence and boundary |
| --- | --- | --- |
| PRD tenant mount | PASS | `prd-doc-query` is healthy on the promoted multi-tenant image (`v0.8.1`, digest `sha256:6efb013d…`); `/health` reports `klicker:34`, `/ready` returns `200`, and authenticated `/mcp/klicker` lists the I&W tool and its chunk-topic companion. |
| PRD source pair | PASS | The mounted I&W YAML/Markdown pair has the same canonical content as `origin/main@32d51401` after removing the ConfigMap's trailing blank line. The tool points to `klicker_ai_informatik_und_wirtschaft`. |
| PRD collection existence/schema | PASS | Direct values-free Milvus read found the named collection with `872` rows, all `resource_active=true`, vector dimension `1536`, and fields `content`, `id`, `vector`, and `sparse_vector`. |
| PRD collection scope | PASS | All `872/872` sampled rows carry `project_id=klicker-course-materials`, `kb_id=informatik-und-wirtschaft-hs26`, `chatbot_id=informatik-und-wirtschaft-hs26`, `source_id=video-corpus:informatik-und-wirtschaft-hs26`, `external_resource_id` with the same value, `resource_version=1`, and `source_type=video`. |
| PRD positive retrieval | PASS | The bounded authenticated I&W query completes through PRD `/mcp/klicker` with `20` sources and `20` nested chunks, including structured video titles and `start_sec`/`end_sec` metadata. |
| STG comparison | PASS | The same bounded query through STG `/mcp/klicker` returns `20` sources and `20` chunks, including structured `title`/`video_name` and `start_sec`/`end_sec` metadata. This confirms the corpus and prompt shape; it does not substitute for PRD proof. |
| PRD write acceptance | NOT PROVEN / NOT ATTEMPTED | The PRD collection already contains the active v1 corpus, but no values-safe activation receipt or operation identity ties that write to the current A9 package. Rewriting or introducing a new resource version would be a different production mutation, so it was withheld. |

The remaining P0 item is the PRD write-acceptance receipt and its A9 tie, not
collection existence, source metadata, credential/model access, or the shared
Doc Query deployment. The existing v1 corpus remains unchanged; no rewrite or
new resource version is implied by this readback.

### P0 blocker resolution (2026-08-17)

The PRD credential/model-access and v0.8.1 publication gates are closed under
explicit user approval of the production release chain:

- df-cloud MR !339 (blob-backup properties) merged to `stg` and promoted via
  release MR !376 (`stg` -> `prd`). The retried PRD Aibuddy `app-up` created
  exactly three `doc-query-eduai` resources (machine-identity Secret,
  SecretStore, ExternalSecret); 403 resources unchanged, no deletes/replaces,
  and all `prd-doc-query` ExternalSecrets now report `SecretSynced`/`Ready=True`
  values-free.
- Deployment MR !609 (v0.8.1 pin) was rebased onto current `main` and merged.
  Argo `app-doc-query-prd` auto-synced: both stable pods run the exact v0.8.1
  digest `sha256:6efb013d…` (source `bb2aba79`, tag `v0.8.1`), the Spot tier is
  pinned and scaled to zero, `/health` reports `aibuddy:90, eduai:2,
  klicker:34`, and `/ready` returns `200`.
- The previously blocked authenticated I&W query now completes on PRD through
  `/mcp/klicker`: 20 sources with 20 nested chunks, real video titles (e.g.
  `04.2 Digitale Daten - Digitalisierung von Text.mp4`), and `start_sec`/
  `end_sec` chunk metadata — matching the STG comparison row. The
  `403 key_model_access_denied` is resolved because the v0.8.1 tenant-prefixed
  credential resolver presents the Klicker key. The probe minted a short-lived
  HS256 bearer from `DOC_QUERY_JWT_SECRET_KLICKER` in-process without printing
  any secret value; no cluster, Milvus, or Klicker-row mutation occurred.
- Remaining P0 open item: the PRD write-acceptance receipt (A9 tie) is still
  NOT PROVEN / NOT ATTEMPTED, unchanged from the table above.

## Authority and non-goals

- Each production deployment, Argo sync, grant, credential-custody step,
  database activation, and paid ingestion run is separately authorized; this
  plan does not authorize any of them by itself.
- No STG reingestion, no legacy consumer changes, no broad video sweep, no
  merge requirement for optional course-specific `#5406`, and no second legacy
  PRD route.

## Dependency ruling (recommended)

Ride the multi-tenant PRD line. Do not build an interim legacy PRD route for
this chatbot: STG already proves the shared route end to end, the parallel
cutover roadmap retires the legacy binding, and an interim route would mean a
second credential and a second cutover. Concretely, I&W production activation is
gated on the W5e direct-Chat PRD proof (or an explicit user decision to accept a
different boundary).

## Phases

| Phase | Content | Owner | Gate |
| --- | --- | --- | --- |
| P0 PRD data readiness | Confirm the canonical PRD source pair already present in the 17-pair manifest, then complete the upstream A9 target/read-write acceptance and prove PRD collection readiness for `klicker_ai_informatik_und_wirtschaft` (82 videos / 872 ingestion rows) through the proper PRD ingestion path; no STG copy. The read-only collection and scope checks pass; write acceptance and end-to-end retrieval remain open because the PRD reranker binding fails. | This thread, coordinated with the ingestion lane | Resolve the PRD credential/model-access and v0.8.1 publication gates before any write or activation |
| P1 Multi-tenant PRD service | W5a dark preparation (single tenant inventory/readback for both course pairs), W5a.1 neutral publication/readback, W5b/W5c canary + Argo profile, W5d grants, W5e publication + operator proof + direct-Chat proof, W6 readiness review. | Thread `019febd4` (deployment repo) | Its own approval gates; I&W contributes P0 evidence only |
| P2 Klicker PRD runtime promotion | Build and promote the chat image from `v3` at or after `2d9c5d048` (contains `#5405`/`#5411`/`#5414`), production values promotion PR, manual Argo reconciliation of the PRD `app-klicker` application, rollout marker and pod digest readback. | This thread | Separately authorized production promotion |
| P3 Credential and activation | Read-only preflight of the prepared rows; custody-approved PRD tenant bearer for the Klicker caller; rekey the inactive MCP server row with the running production chat application key (the STG lesson: the Infisical profile `APP_SECRET` is not the live app key); verify both strict bindings; one transactional activation; immediate readback. | This thread | P1 W5e proof + P2 runtime live |
| P4 Bounded verification | Discovery and deep link; anonymous denial; non-participant denial (identity still missing, also open in STG); disclaimer; transcript-only, visual-only, mixed-evidence, and no-answer probes; source cards with `[n]` citations, titles, timestamps; credits; deactivate/reactivate drill. | This thread | P3 complete |
| P5 Closeout | Record evidence, update this plan and the main plan, keep rollback documented (deactivate the MCP row, Argo rollback; no data deletion). | This thread | User acceptance |

## Decisions that need a ruling

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Ride the multi-tenant PRD line versus an interim legacy PRD route | Ride the multi-tenant line; accept no earlier activation boundary than the W5e direct-Chat proof |
| D2 | One W5a tenant-inventory update covering both course pairs versus an I&W-only update | One coordinated update owned by thread `019febd4`, with the RadioSurfVet thread contributing its pair |
| D3 | PRD corpus ingestion run (paid, bounded to the 82 course videos) | Authorize when P0 is scheduled so W5a collection readiness is not blocked |
| D4 | Activation timing after W5e versus waiting for full W6 `READY_FOR_CUTOVER_REVIEW` | Activate after W5e direct-Chat proof with the I&W-slice evidence complete; the general legacy cutover stays a separate decision |

## Coordination

- Thread `019febd4` owns the deployment-repo W-items; this thread contributes
  the I&W PRD source pair and collection evidence and consumes its gates. No
  parallel tenant mounts or Secret declarations from this thread.
- Thread `019fead3` (RadioSurfVet) owns the second course pair; align on the
  single W5a inventory update and avoid duplicate Secret/MR work.
- The optional provisioner `#5406` is closed and stays unmerged; the prepared
  production rows were created by a separate guarded transaction and are the
  activation target.

## Evidence ledger before activation

- PRD source pair and values-free collection-readiness evidence accepted into
  W5a; the PRD retrieval and write-acceptance blockers above are still open.
- W5e operator and direct-Chat PRD proof recorded values-free.
- PRD chat Deployment on a release marker at or after `2ad68d057acf` with one
  ready pod and verified digest.
- Preflight readback: course/owner/disclaimer/chatbot ownership, inactive server
  row, both strict bindings, credential decryptable by the live PRD app key.
- P4 checklist complete, including the still-missing non-participant denial
  probe with an authorized identity.
