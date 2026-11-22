# Interactive explanations: production, narration, spoken questions (roadmap)

## Approval summary

The Tutor and Explainer chat modes can show an interactive explanation card: the model writes content
JSON, the Catalyst explainer service validates it and builds the page, and the chat shows the page in
a sandboxed frame. This runs on staging since 2026-11-22 (Phase A). The card's play button already
narrates with the device's built-in voices.

This roadmap takes the feature to production in three packages, in this order (user ruling
2026-11-22):

1. **P1 — explanations in production** for opted-in chatbots, with the card using the full message
   width. No voice work.
2. **P2 — narration with Azure voices** in the chat (B1). No student audio.
3. **P3 — spoken questions** to the explanation (B2). Student audio reaches Azure only after consent.

Only P1 is ready for an executable batch. P2 and P3 are planned here to the level of design,
contracts and gates. Each needs its own approval before it starts, because its decisions depend on
P1's production evidence and, for P3, on a data-protection ruling.

Unchanged: chatbots outside the opt-in list get no explanation tool; the chat keeps working without
the explainer service (the turn answers in text); no database migration in P1.

Risks: each explanation turn costs noticeably more tokens than a text answer (measured figure in
`_local`); the production explainer service is a
new deployment with its own secret; a token mismatch silently turns cards into an "unavailable" chip.

Done for P1 when production runs the gated release, the explainer service is healthy in production,
and a Tutor question in an opted-in chatbot shows a working card while a non-listed chatbot shows
none.

## Execution context

- **Repositories:**
  - `uzh-bf/klicker-uzh` (GitHub): chat code into `v3-ai`; production chart and values on `v3`.
  - `uzh-bf/klicker-uzh-catalyst` (GitHub): explainer kit and service; image in the GitLab registry.
  - `df-cloud-klickeruzh` (GitLab): Pulumi stacks; `stg` branch for staging, promotion MR to `prd`.
  - `helm-charts` (GitLab): Kustomize manifests that Argo CD deploys; `main`.
- **Release path, chat:** PR into `v3-ai` → release PR (version bump) into `v3-ai` → tag → promotion
  PR on `v3` changing production image tags → Argo `app-klicker` syncs. Production activations happen
  before 07:00 or after 18:00 Europe/Zurich (repository release rules).
- **Release path, infra:** MR to `df-cloud` `stg` (Pulumi preview, apply on merge), then the `stg` →
  `prd` promotion MR; `helm-charts` MR to `main`, Argo syncs the overlay.
- **Roadmap owner:** the main session (boundary owner: self). This file lives on the first P1 branch
  and moves to `project/plans/` when P3 finishes or is dropped.
- **Production facts** (chatbot IDs, secret names with values, measured usage) stay in the ignored
  `project/_local/` area, never in this file.

### Verified current state

- The gate is global: `isExplanationToolEnabled` in `apps/chat/src/services/explainerService.ts`
  needs `CHAT_EXPLANATION_TOOL=1`, the service URL and token, and Tutor or Explainer mode. Tests live
  in `apps/chat/test/explainer-service.test.ts`.
- The `v3-ai` chart has `chat.explainer.enabled` and `serviceUrl` (`templates/cm-chat.yaml`); the
  production chart on `v3` lacks this template. Production values do not enable it.
- The explainer service runs as two Deployments from one image in the staging namespace
  `stg-explainer-preview`: `explainer-service` (API mode, no signing key, bearer token) and
  `explainer-preview` (tester voice preview, link login, Foundry Voice Live). The `df-cloud` stack
  `explainer-preview` refuses any environment except `stg` by design.
- `df-cloud` maps `EXPLAINER_SERVICE_TOKEN` into the KlickerUZH chat Secret only in staging, and a
  unit test asserts that.
- The kit in a chat frame narrates with `speechSynthesis` and auto-advances (checked on staging).
- Chat credits: per participant and chatbot (`ChatUsageCredits`) plus an account monthly budget per
  usage class (`ChatAccountUsage`).

## Primitive impact

| Product primitive | Disposition | Contract delta | Affected compositions and consumers | Evidence or open ruling |
| --- | --- | --- | --- | --- |
| Explanation (tutor tool result) | reuse | None in P1; still content-only in the message | Chat thread, explanation page route | Phase A on staging |
| Chatbot explanation opt-in | create | A lecturer setting per chatbot, visible and effective only with the GrowthBook flag on for the owner | Chat route gate, manage settings, publication review | D1 |
| Explanation narration | extend (P2) | Play uses Azure voices when the chatbot enables voice; device voices stay the fallback | Kit voice module, chat page bridge | Catalyst voice preview |
| Spoken question | extend (P3) | Microphone only after consent; answers may jump steps | Kit, chat page bridge, consent record | D6, D7 |
| Chat credits | extend (P2) | Voice minutes charge the participant's chatbot credits and a voice usage class | Credits display, account budget | D5 |

## Work items

### P1 — explanations in production (executable batch)

**Outcome:** production participants of opted-in chatbots get explanation cards in Tutor and
Explainer modes; the card uses the full message column. Other chatbots are unchanged.

Scope, as separate deliveries in dependency order:

1. **P1.1 chatbot toggle, flag and width** (`klicker-uzh`, branch `rs/chat-explanation-full-width`,
   draft PR #6957 into `v3-ai`, retitled to cover all three). User ruling D1: a per-chatbot lecturer
   toggle, with the toggle and the feature hidden behind a GrowthBook flag.
   - Chatbot setting `interactiveExplanationsEnabled` (default off, one migration, no backfill)
     through the authoring revision and publication review flow, like `answerPreferencesEnabled`.
   - GrowthBook flag `interactive-explanations` (default off), evaluated for the chatbot owner's
     account. Manage shows the toggle only with the flag on; GraphQL rejects turning it on without
     the flag; the chat offers the tool only when the deployment switch, the chatbot setting and the
     flag all hold. Any flag error counts as off.
   - The deployment switch (`CHAT_EXPLANATION_TOOL`, service URL and token) stays as the kill switch.
   - The page proxy (`explanations/page/route.ts`) stays on the deployment switch only, so cards
     already in a thread still render after a chatbot turns the setting off.
   - Keep the width change already on the branch; the PR keeps its screenshot table.
   - Staging cutover lives here too: the staging chat `serviceUrl` points at `stg-explainer`.
   - Tests: the three-way chat gate, the GraphQL rejection without the flag, and the revision field
     lists that enumerate settings.
   - **Dependency:** merge into `v3-ai` only after the alpha.97 tag is pushed, so alpha.97 ships
     exactly what its own plan reviewed.
2. **P1.2 explainer app, staging first** (`df-cloud` `stg` and `helm-charts`; D3 recommended shape):
   - New app `explainer` with namespace `<env>-explainer`, Infisical project, ExternalSecret for
     `EXPLAINER_SERVICE_TOKEN`, service account and Argo CD project. No Foundry roles, no ingress, no
     signing key and no ledger volume in P1; P2 adds them to this app.
   - NetworkPolicy: ingress only from the KlickerUZH chat pods of the same environment on port
     3018; egress DNS only.
   - Image: the staging digest, after checking it was built from Catalyst `main`; the production
     cluster must be able to pull from the GitLab registry (check the existing pull secret pattern
     of other GitLab-hosted images before the production step).
   - Staging cutover: the staging chat points at the new service; cards still render on staging.
   - Then remove the API-mode `explainer-service` Deployment from `stg-explainer-preview`; the
     tester voice preview stays there until P2 replaces it.
   - The KlickerUZH chat Secret maps the token in both environments (update the staging-only
     `df-cloud` test).
3. **P1.3 production token:** one random value in the production `explainer` and KlickerUZH
   Infisical projects, through a user-run script or `rs-infisical-operator set-random` after
   write-allowlist approval. The agent never reads or prints it.
4. **P1.4 production service:** `df-cloud` `stg` → `prd` promotion and the production
   `helm-charts` overlay.
5. **P1.5 release and activation** (`klicker-uzh`):
   - Release alpha.98 from `v3-ai` after alpha.97 is live (release rules as in the alpha.97 plan).
   - PR on `v3`: port the explainer template and the `chat.explainer` defaults from `v3-ai`, set
     production values (`enabled`, in-cluster `serviceUrl`) and the alpha.98 image tags.
   - GrowthBook production: create `interactive-explanations`, on only for the owner account of the
     first production chatbot (D2). That chatbot then turns the setting on through a reviewed revision.

**Acceptance, with the observer for each check:**

- P1.1 (agent): unit tests and CI pass; after merge and the staging rollout, a staging Tutor question
  still shows a card.
- P1.2 (agent, staging read-only `kubectl`): Argo app Synced/Healthy, pod ready, staging chat logs
  show no explainer errors, a staging card renders after the cutover and after the old Deployment
  is gone.
- P1.4 and P1.5 (user, or the agent only with separately approved read-only production access):
  Argo `explainer` and `app-klicker` Synced/Healthy; production chat ConfigMap has the explainer
  keys (names only).
- P1.5 (user, or the agent through Chrome on the D2 chatbot): a Tutor question there shows a card
  that steps and plays; a chatbot without the setting shows no explanation. The agent may read
  production status with read-only `kubectl` (user grant 2026-11-22).

**Recovery:**

- Card shows "unavailable": read the chat logs for the status of `/explainer/v1/schema` (staging and
  production: agent, read-only). 401 means a token mismatch: rewrite both copies (P1.3), wait for the
  ExternalSecret refresh, then restart the chat and explainer pods (user step in production).
  A timeout points to the NetworkPolicy or service name: fix the overlay.
- Quality or cost problem in production: turn the GrowthBook flag off (immediate, all chatbots) or
  the chatbot setting off; the deployment switch (`enabled: false` via a PR on `v3`) is the last
  resort. No data to undo.
- Explainer service crash-loops: the chat degrades to text answers; roll the overlay back to the
  previous digest.
- Pulumi preview shows changes beyond the new app and the token mapping: stop before merge and
  report.

**Authority requested for P1** (each when its condition holds):

- Merge #6957 into `v3-ai` after green CI and the alpha.97 tag.
- `df-cloud` MR into `stg` (Pulumi applies on merge) and the `stg` → `prd` promotion merge.
- `helm-charts` MRs into `main` (staging overlay, then production overlay).
- Delete the API-mode `explainer-service` Deployment in `stg-explainer-preview` (via the
  `helm-charts` change).
- Infisical production writes of the shared token (P1.3).
- alpha.98: confirm the dry-run version, merge the release PR, push the tag.
- Merge the `v3` PR that activates production, inside the release window.
- Rollback PRs or MRs: may merge outside the release window when production is degraded.
- Cluster-level changes: new namespaces, Argo CD projects and applications, NetworkPolicies.

Withheld: P2 and P3, chatbot setting changes, other feature flags, production data reads beyond
values-free status, any change to the alpha.97 release.

### P2 — narration with Azure voices (B1, design; separate approval)

**Outcome:** in chatbots where the lecturer enabled voice, Play narrates each step with an Azure HD
voice and shows captions; the student pays from chat credits. No microphone.

Design:

- **Transport:** the card frame stays `allow-scripts` with no network. The kit gets a host-bridge
  transport (postMessage) next to its WebSocket transport. The chat page opens one WebSocket per
  session and relays frames both ways without interpreting them.
- **Endpoint:** the explainer service serves the voice relay for KlickerUZH under the chat host
  (ingress path routing), so the socket is same-origin with the chat page. The relay protocol is the
  preview's (`narrate`, `cancel`), minus tester links.
- **Login:** the chat server mints a short-lived signed voice ticket (participant pseudonym, chatbot,
  maximum seconds) after checking opt-in and credits. The service verifies the ticket with its own
  key; it never sees KlickerUZH session cookies.
- **Billing:** the ticket reserves the worst case from the participant's chatbot credits; the
  service reports actual usage to a chat callback, and the chat settles. A voice usage class on the
  account budget caps the lecturer's monthly spend.
- **Opt-in:** a second chatbot setting `explanationVoice` next to `interactiveExplanationsEnabled`,
  behind the same flag pattern (one migration).
- **Production Foundry:** a Voice Live deployment in a Sweden Central data-zone resource, workload
  identity with a data-plane-only role, as in the staging preview.
- **Data:** no student audio. Narration text comes from the explanation content. The ledger stores a
  keyed participant hash, duration, tokens and cost, no text.

Acceptance: on staging, an enabled bot narrates with an Azure voice and credits drop by the settled
amount; a disabled bot keeps device voices; then the same in production for one bot.

Gate before start: **D5** (pricing to students) and the P1 production evidence on cost per turn.

### P3 — spoken questions (B2, design; separate approval)

**Outcome:** during an explanation, a student can press "Frage stellen", ask by voice, and hear an
answer that may jump to a step.

Design:

- **Microphone in the chat page,** not in the sandboxed frame. An opaque-origin frame cannot hold a
  reliable microphone permission, and the chat page already owns the socket. A prototype confirms
  this in Chrome, Safari and Firefox before building.
- **Consent:** a one-time notice and consent per participant and chatbot before the first microphone
  use, recorded like the disclaimer acceptance; withdrawing it disables the button.
- **Limits:** audio only while a question is open; rate and byte caps from the preview.
- **Data:** student voice goes to Voice Live (LLM and transcription in the data zone; turn detection
  and audio processing in the resource region). Transcripts are not stored (D7).

Gates before start: **D6** (UZH data-protection review of student voice processing) and **D7**
(transcript storage).

## Decisions for P1 (user rulings 2026-11-22)

- **D1 — production gate:** a per-chatbot lecturer toggle, with the toggle and the feature hidden
  behind a GrowthBook flag (user ruling; replaces the recommended deployment allowlist).
- **D2 — first chatbots:** one named course chatbot is the first production chatbot (user ruling). Its name and ID stay in
  `_local`.
- **D3 — production service shape (agreed):** a new `explainer` app (namespace `<env>-explainer`) in
  `df-cloud` and `helm-charts` for staging and production, API mode, with the staging chat moved to
  it and `explainer-preview` kept for tester links until P2 replaces them (recommended; durable name,
  staging tests the exact production path, P2 extends this app in place), or extending
  `explainer-preview` to production (less infra, a "preview" name in production). P2 assumption to
  check before P2 starts: the ingress controller routes a path on the chat host to a service in the
  `explainer` namespace, and the host's TLS secret is usable there; otherwise P2 uses its own host.
- **D4 — release timing (agreed):** ride alpha.98 after alpha.97 is live (recommended), rather than changing
  the alpha.97 release under way.

## Deferred decisions and dependencies

- **D5 — voice pricing to students** (gates P2): charge chat credits at cost plus margin
  (recommended) or let the lecturer budget absorb it. Needs P1's production cost per turn.
- **D6 — data-protection review for student voice** (gates P3): confirm with the UZH data-protection
  office before any production microphone use. Recommended: start the request when P2 starts.
- **D7 — transcripts** (gates P3): do not store (recommended) or store as chat messages for history
  and lecturer analytics.
- **External:** alpha.97 must be live before P1.4 (separate release plan); a free production window.

Decisions D1 to D4 are batched in the approval card for P1.

## Evidence and progress

Package boundary evidence: unit tests and CI on the PRs and MRs; Pulumi preview output reviewed;
Argo status; production values keys present (names only); the user's production chat check.

### Progress

- 2026-11-22: roadmap drafted; Phase A verified on staging (card renders, steps, plays with device
  voices). Draft PR #6957 has the width change.
- 2026-11-22: one independent plan critique (Claude planner, REVISE). Accepted and applied: P1.1
  merges only after the alpha.97 tag; the gate fails closed with an explicit `all` or list; the page
  proxy stays on the global flag; each acceptance check names its observer, and production checks
  are user steps without separately approved access; gated actions are listed; D3 gets a staging
  cutover and a named teardown; D3 settles the namespace now, and the cross-namespace ingress check
  is a P2 assumption; the measured cost figure moved to `_local`; P1.5 ports the chart defaults.
  Its df-cloud, helm-charts and Catalyst checks could not run (no shell access); the main session
  had verified those facts against `origin/stg` and `origin/main` before the draft.
- 2026-11-22: user rulings D1 (per-chatbot toggle behind GrowthBook flag `interactive-explanations`),
  D2 (one named chatbot first), D3 and D4 agreed; read-only production `kubectl` granted. P1.2 drafts:
  `df-cloud` !1076 (`feat/explainer-app` → `stg`) and `helm-charts` !425 (`feat/explainer-app` →
  `main`); CI previews requested. P1.1 toggle implementation in progress on #6957's branch.
