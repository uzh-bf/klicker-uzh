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
  `019febd4-cc79-7ce2-915a-6511aa7bd1a5`): the neutral PRD workload is
  Aibuddy-only on an older image pair; the PRD Klicker source inventory has 15
  tool pairs and is missing the I&W video pair and the RadioSurfVet pair;
  canonical PRD source pairs and collection-readiness evidence for both
  additions do not exist yet; df-cloud MR `!375` landed the tenant Secrets on
  `stg` (`b9e96928`) but the `prd` head (`d697fa66`) does not contain the
  tenant Secret declarations.
- The RadioSurfVet onboarding (thread `019fead3-07b6-7831-a941-517620b0010d`)
  owns the second missing PRD tool pair and is aligning its roadmap with this
  deployment; both additions share the same W5a inventory gate.

## Authority and non-goals

- Each production deployment, Argo sync, grant, credential-custody step,
  database activation, and paid ingestion run is separately authorized; this
  plan does not authorize any of them by itself.
- No STG reingestion, no legacy consumer changes, no broad video sweep, no
  merge requirement for draft `#5406`, and no second legacy PRD route.

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
| P0 PRD data readiness | Canonical PRD source pair for `informatik_und_wirtschaft_video_expert` and PRD collection readiness for `klicker_ai_informatik_und_wirtschaft` (82 videos / 872 ingestion rows) through the proper PRD ingestion path; no STG copy. | This thread, coordinated with the ingestion lane | Bounded paid-run authorization when scheduled; feeds the W5a source-pair gate |
| P1 Multi-tenant PRD service | W5a dark preparation (single tenant inventory update including both missing pairs), W5a.1 neutral publication/readback, W5b/W5c canary + Argo profile, W5d grants, W5e publication + operator proof + direct-Chat proof, W6 readiness review. | Thread `019febd4` (deployment repo) | Its own approval gates; I&W contributes P0 evidence only |
| P2 Klicker PRD runtime promotion | Build and promote the chat image from `v3` at or after `2d9c5d048` (contains `#5405`/`#5411`/`#5414`), production values promotion PR, manual Argo reconciliation of the PRD `app-klicker` application, rollout marker and pod digest readback. | This thread | Separately authorized production promotion |
| P3 Credential and activation | Read-only preflight of the prepared rows; custody-approved PRD tenant bearer for the Klicker caller; rekey the inactive MCP server row with the running production chat application key (the STG lesson: the Infisical profile `APP_SECRET` is not the live app key); verify both strict bindings; one transactional activation; immediate readback. | This thread | P1 W5e proof + P2 runtime live |
| P4 Bounded verification | Discovery and deep link; anonymous denial; non-participant denial (identity still missing, also open in STG); disclaimer; transcript-only, visual-only, mixed-evidence, and no-answer probes; source cards with `[n]` citations, titles, timestamps; credits; deactivate/reactivate drill. | This thread | P3 complete |
| P5 Closeout | Record evidence, update this plan and the main plan, keep rollback documented (deactivate the MCP row, Argo rollback; no data deletion). | This thread | User acceptance |

## Decisions that need a ruling

| # | Decision | Recommendation |
| --- | --- | --- |
| D1 | Ride the multi-tenant PRD line versus an interim legacy PRD route | Ride the multi-tenant line; accept no earlier activation boundary than the W5e direct-Chat proof |
| D2 | One W5a tenant-inventory update with both missing pairs versus an I&W-only update | One coordinated update owned by thread `019febd4`, with the RadioSurfVet thread contributing its pair |
| D3 | PRD corpus ingestion run (paid, bounded to the 82 course videos) | Authorize when P0 is scheduled so W5a collection readiness is not blocked |
| D4 | Activation timing after W5e versus waiting for full W6 `READY_FOR_CUTOVER_REVIEW` | Activate after W5e direct-Chat proof with the I&W-slice evidence complete; the general legacy cutover stays a separate decision |

## Coordination

- Thread `019febd4` owns the deployment-repo W-items; this thread contributes
  the I&W PRD source pair and collection evidence and consumes its gates. No
  parallel tenant mounts or Secret declarations from this thread.
- Thread `019fead3` (RadioSurfVet) owns the second missing pair; align on the
  single W5a inventory update and avoid duplicate Secret/MR work.
- The optional provisioner `#5406` stays unmerged; the prepared production rows
  were created by a separate guarded transaction and are the activation target.

## Evidence ledger before activation

- PRD source pair and collection-readiness evidence accepted into W5a.
- W5e operator and direct-Chat PRD proof recorded values-free.
- PRD chat Deployment on a release marker at or after `2ad68d057acf` with one
  ready pod and verified digest.
- Preflight readback: course/owner/disclaimer/chatbot ownership, inactive server
  row, both strict bindings, credential decryptable by the live PRD app key.
- P4 checklist complete, including the still-missing non-participant denial
  probe with an authorized identity.
