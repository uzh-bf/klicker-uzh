# KlickerUZH — iteration 1 implementation plan

**Canonical plan for the first iteration.** Revised on 21 September 2026 after the source-grounded review of the same date; its findings are folded in below. Use this document alone for iteration 1. The work it adopts or supersedes is named with links in [Related work](#related-work), so agents reconcile against those documents rather than combining package lists from memory.

**Source baseline:** `v3-ai` at `2c1533f5d208fa5a6df52ed0a34c85b2f2239464` (21 September 2026). Every appendix permalink points at this commit and every line reference was verified there. Later `v3-ai` commits through `864ce068bddf090a9b633a83ab635ddf39c1f6b1` (sync merges, leaderboard redesign, scoped KB transport tokens) touch none of the referenced paths. Live GrowthBook state, provider capacity and processing latency were not observed.
**Status:** Proposed implementation plan. No application changes, migrations, tests, deployments or live flag changes were performed in preparing it.
**Audience:** Product owner and implementation agents.

## Decisions taken in this revision

- **General academic** is the visible default subject suggestion for a KB created outside a course context. It is shown and editable, never applied silently.
- **Participant credits** for the sponsored cohort are a daily allowance of a few credits per student, applied as a server-side default in chatbot creation, so the Usage view can be hidden without leaving students on one advanced turn per week. A credit is debited by the turn's registry-priced cost in USD, so one credit is roughly one US dollar of model usage. [E26a] Starting value: 3 initial credits, daily reset, reset amount 3, maximum 3, held as one server-side constant that operations tune as needed. The overall sponsored budget is high; the allowance bounds a single account's daily spend rather than rationing normal use.
- **Sponsored usage** in iteration 1 is the existing operator-controlled account usage configuration. The entitlement tiers and monthly base budget in PR #6046 (with #6049 stacked on it) follow this plan; when they land, their lecturer-facing surface sits behind `ai-advanced-management`.
- **Graph preparation** runs as one periodic sweep with a quiet period, a backoff and a concurrency cap. Six-hour admission windows are dropped.
- **Automatic ingestion is what upload means.** The existing `kb-ingestion` flag governs it; there is no `kb-auto-ingestion` flag.
- **Delivery order** is S1, S3, S2, S6, then S4, then S5. S1 and S3 are small.

## At a glance

**Deliver:** hide technical, financial and unfinished controls from normal lecturers; move subject and generation language to the KB; ingest accepted materials automatically; prepare graphs automatically; show truthful readiness; connect KB creation and selection directly to chatbot setup.

**Preserve:** existing permissions, publication review, draft/live configuration boundaries, shared-material behavior, human review of generated questions, cost accounting and operational safety limits.

**Defer:** full workspace or reviewer redesign, exact draft-runtime preview, staged KB bindings, immutable historical retrieval, new notification or billing systems, multiple active KBs and graph-engine replacement.

| Order | Package | Scope | Size | Prerequisites |
|---|---|---|---|---|
| 1 | **S1** | Simplified surface, advanced flag, cohort credit default, dead-code removal | small | none |
| 2 | **S3** | Automatic ingestion for new uploads and URLs; sequential multi-file | small | none |
| 3 | **S2** | KB-owned subject and language; the first KB update mutation; build-input adapter | medium | none at runtime |
| 4 | **S6** | KB select and create from the chatbot; list readiness; lean publication path | medium | S1 surface; S2 metadata; S3 for the complete upload journey |
| 5 | **S4** | Scheduled graph preparation; preparation fingerprint; generation readiness | medium | S2 settings; S3 serving-change semantics; the #6236 quota-lockstep fix |
| 6 | **S5** | KB-first question generation with waiting states | medium | S2 and S4 contracts |

**Sequence:** S1 and S3 first, in parallel. S2 follows on its own schema slice. S6 delivers the useful chatbot path as soon as S1, S2 and S3 have landed, and does not wait for S4 or S5. S4 then S5 complete graph-backed question generation. Activation order is in section 10.

## Related work

| Work | State at baseline | Relation to this plan |
|---|---|---|
| [PR #6046](https://github.com/uzh-bf/klicker-uzh/pull/6046) AI subscription tiers and monthly base budget, base of [#6049](https://github.com/uzh-bf/klicker-uzh/pull/6049) | draft | Follows iteration 1. S1 hides the Usage view; iteration 1 keeps the existing operator-controlled usage configuration. |
| [PR #5764](https://github.com/uzh-bf/klicker-uzh/pull/5764) response-example capture from owner preview | open | Lands behind `ai-advanced-management` or holds until after iteration 1. |
| [PR #6236](https://github.com/uzh-bf/klicker-uzh/pull/6236) knowledge-graph cost metering plan | draft | Its reservation-release fix landed as [#6238](https://github.com/uzh-bf/klicker-uzh/pull/6238). Its quota-lockstep package is an S4 prerequisite. |
| [PR #6209](https://github.com/uzh-bf/klicker-uzh/pull/6209) KG GrowthBook docs, with the [KG generation simplification plan](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/project/2026-09-20-kg-generation-simplification-plan.md) and the [KG quality roadmap](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/project/2026-09-12-kg-quality-roadmap.md) | #6178 merged, docs open | Adopted. That plan deferred a General academic default; this plan takes the decision (visible suggestion). |
| [Multiple-KB follow-up plan](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/project/2026-09-08-chatbot-multiple-kb-follow-up-plan.md), readers merged in #5879 | transition | S6's selector renders a list; the server keeps the single-active rule. |
| [Chatbot guided setup plan](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/project/2026-08-31-chatbot-authoring-guided-setup-plan.md) | shipped as the current setup steps | S1 and S6 build on the existing steps. |
| [KB management UX plan](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/project/2026-08-24-pr-5540-kb-management-ux-plan.md) and the two first-slice drafts supplied outside the repository | roadmap | Their first implementation wave is superseded by this plan. |

## 1. Product outcome and fixed scope

Replace the first implementation wave of the larger UX roadmap with a smaller, opinionated pilot experience. A normal lecturer describes a knowledge base, adds materials, connects a chatbot and understands what is ready. They never operate an ingestion pipeline, build a knowledge graph, configure usage budgets or navigate experimental tooling to get there.

Automatic graph preparation is in scope for an approved sponsored cohort. Graph generation controls, graph visualization and graph-assisted chatbot retrieval are separate capabilities: preparing a graph for question generation enables neither the student concept map nor graph-assisted chat retrieval.

The implementation preserves existing account authorization, course ownership, chatbot approval, draft/live semantics, participant access, material deletion protections and cost accounting. It introduces no new approval system, material-history service or chat runtime.

### Normal-user journey

1. Create a KB: enter a name; see and optionally change the suggested subject area and language for generated content.
2. Add files or a supported website. Preparation starts automatically once the server accepts the resource.
3. See which materials are ready for chatbot answers. Connect the KB from the chatbot, or start chatbot creation from the KB.
4. Configure only essential teaching settings and student information. Use the existing publication process, with clear next actions.
5. For question generation, select a KB rather than a graph build. See either the generation form or an accurate preparation state. Return when it is ready; the system prepares the graph without another action.

The ordinary path contains no graph, model, reasoning-effort, credit, budget, response-example or provider configuration step.

## 2. Evidence and boundaries

Source observations at the pinned baseline. They are implementation anchors, not claims about the deployed environment.

- The KB model stores resources, graph slot and publication pointers, the per-KB graph opt-in and storage capacity, but no subject, language or course field. Graph builds freeze a domain id, version and language triple. [E2]
- The graph panel owns domain and language selection, including handling for retired catalog entries and implicit legacy Finance/German builds. Moving these fields preserves those semantics. [E3]
- New-file confirmation and URL creation leave the resource in `ADDED`; nothing picks it up. [E4] File replacement already implements the target pattern: transactional `QUEUED` claim plus run row, post-commit dispatch, queue-failure marking, and 15-minute maintenance recovery that reuses the attempt id. [E16, E17]
- The ingestion admission check gates the upload-ticket request, replacement, URL creation and manual ingestion, but not upload confirmation. [E18] The dropzone accepts one file at a time and already defaults classification to course material. [E19]
- Graph building is lecturer-initiated only. It uses a per-KB slot, a build ledger, a source-only content digest, frozen source records and cost reservations, and selects serving `COURSE_CONTENT` resources. Publication is automatic on successful settlement; staleness is computed and displayed only. [E5, E20, E21]
- Question-generation sources are published graph bundles whose frozen language is German or English; the output language comes from that frozen value; the form falls back from an unavailable requested KB to the first returned source; the request pins a build id and carries no KB id. [E6, E7, E13]
- The chatbot workspace has five views: Overview, Knowledge, Behavior, Disclaimer, Usage. The publication request sits inside Overview's review step next to a credit-policy summary. Knowledge holds the KB links, the participant concept-map switch, the flag-gated GraphRAG switch and the response-example accordion. [E8] The concept-map switch has a working consumer in the chat app; it is an advanced control, not an unfinished one. [E28] `ChatbotAuthoring` carries a credits accordion that no caller mounts. [E27]
- New chatbots default to the single ADVANCED Auto model, no participant model choice, concept map off and graph retrieval off. [E9] Their participant credits default to one credit, weekly reset, maximum one; credits gate ADVANCED turns and a zero balance switches the turn to the base model. [E26] Each completed turn debits the participant balance by that turn's registry-priced USD cost, so one credit is roughly one US dollar of model usage. [E26a]
- Seven flag keys exist, all default false: `ai-beta`, `learning-analytics`, `chatbot-graphrag`, `kb-ingestion`, `kb-graph-builds`, `kb-graph-domain-selection`, `question-focus-topic`. Flags are admission controls, not entitlement; `User.aiFeaturesEnabled` is the account gate. Domain selection additionally requires the `KB_GRAPH_DOMAIN_CATALOG_REVISION` environment value to match the bundled catalog revision. [E10, E10a, E10b] The GrowthBook docs merged through #6209 record the KG flags as off in production on 2026-09-20; the staging catalog revision landed on `v3-audit` through #6192 on 2026-09-21.
- There is no KB update or rename mutation, only create and delete. Ownership checks use a pessimistic row lock without a version column. [E29]
- `Course.language` is the `en`/`de` `Locale` enum; graph language is the `German`/`English` string. No course-to-subject mapping exists anywhere. [E30]
- Sync policy differs between branches: `AGENTS.md` on `v3-ai` uses maintained draft sync PRs for both hops, while `CLAUDE.md` on `v3` prescribes a direct merge push for `v3` into `v3-ai`. Agents follow the file in their own checkout. [E1]

## 3. Simplified product surface

| Area | Normal lecturer in iteration 1 | Advanced (`ai-advanced-management`) and operators |
|---|---|---|
| KB creation | Name, suggested subject, generated-content language; optional description | Domain catalog version and provider diagnostics hidden |
| KB overview | Name, subject, language, materials, two readiness summaries, connected chatbots | Storage reservations, cleanup ledger and operation internals secondary |
| Material addition | Files or supported URL; automatic preparation | Manual ingest and re-ingest remain recovery operations |
| Material classification | Course material by default; visible row-level classification | Exclusion of administrative material from question generation stays visible to everyone |
| Knowledge graph preparation | No enable, build, rebuild, quality or cost controls once S4 is live | Graph panel remains; the automated worker uses a fixed recipe |
| Concept map and GraphRAG | No controls | Both switches remain; a completed graph enables neither |
| Chatbot knowledge | Direct KB selector, create-and-connect, material readiness | Graph switches |
| Model policy | Existing platform default (Auto) | Model allow-list, reasoning effort and provider controls |
| Response examples | Absent, including empty containers and queries | Existing data preserved; capture UI from #5764 only here |
| Costs and limits | No usage dashboard, budget or reset inputs, quota purchase flow | Metering, caps, reservations and operator alerts retained |
| Question generation | Select KB; type and count with defaults; source summary | Cognitive and difficulty controls under optional teaching settings |
| Unfinished features | Absent, without "coming soon" tiles | Explicit internal testing only |
| Publication | Student information, lifecycle, request publication, existing feedback | Approval authority unchanged (ADMIN) |

The hide list per screen, so S1 is mechanical:

| Screen | Control today | Treatment |
|---|---|---|
| Knowledge view | GraphRAG switch, already behind `chatbot-graphrag` | unmounted for normal users |
| Knowledge view | concept-map switch, response-example accordion | advanced only; the accordion keeps issuing its query only when mounted |
| Behavior view | model selection, allow-list, reasoning effort | advanced only; server default stays Auto |
| Usage view | credit editor, usage summary, MCP accordion | advanced only; cohort credit default set server-side |
| Overview review step | credit-policy summary | removed for normal users |
| `ChatbotAuthoring` | unmounted credits accordion | deleted |
| KB detail | graph panel with enable, tier, estimate and build | advanced only once S4 is live; until then it is the only preparation path (section 10) |

"Hidden" means the component is not mounted and issues none of its protected or expensive queries. Remove empty tabs, separators, setup steps, badges and validation dependencies together with the hidden panels. Old links land on the same resource and a supported view.

### 3.1 Sponsored usage is a presentation and operating policy

The product may state: "AI usage is covered during the pilot. No budget setup is required." It never states that usage is unlimited or free forever.

Three accounting lanes stay distinct: account usage enforcement, participant-credit behavior and graph or element-generation quota accounting. Hiding the UI changes none of them; authorization, metering, provider ceilings, request throttles, upload limits and emergency stops keep working.

**Participant credits are the live defect this section fixes.** With the Usage view hidden, the Prisma defaults give each student one ADVANCED turn per week before the silent base-model fallback, and the lecturer has no visible control. [E26] S1 sets the cohort's credit policy as a server-side default in `createChatbot` [E9], using the daily allowance recorded in [Decisions taken](#decisions-taken-in-this-revision). Because `createChatbot` only affects new rows, existing cohort chatbots still on the Prisma default receive the new policy through the advanced Usage view or a separately authorized one-off update. Credit values are never substituted in a browser mount or save handler, and account funding remains operations-owned.

When a capacity or safety limit blocks work, show an honest operational message and a contact route; sponsored lecturers are never sent to a hidden budget page, told they must pay, or left on an indefinite spinner. Storage and file-size constraints that affect the next upload remain visible at the point of action.

### 3.2 Keep the flag model small

Retain the typed registry, fail-closed fallbacks and the independent account gate. Two changes to the registry:

- `ai-advanced-management`: normal users false; internal cohort true. Controls the advanced editor surface only. The existing GrowthBook attributes (id, role) suffice for targeting; no new attribute.
- `kb-auto-graph-preparation`: explicit cohort rollout for the scheduler in section 5.2.

Automatic ingestion uses `kb-ingestion` unchanged: once S3 lands, upload means ingestion, and manual re-ingest is the advanced recovery path. `confirmKbFileUpload` adopts the admission check that the ticket request already applies [E18], so a flag turned off between ticket and confirmation rejects the confirmation with a temporary-unavailability message instead of parking a resource that depends on a hidden manual action.

Activation prerequisites for S2's subject selector are `kb-graph-domain-selection` on for the cohort and the catalog revision environment value set in the target environment. [E10b] `kb-graph-builds` stays on wherever scheduled builds should run; turning it off to hide the graph panel would stop them. `chatbot-graphrag` is independent and stays off.

Showing an advanced panel authorizes none of its mutations: an action withdrawn from normal users keeps its server gate as well as its UI exclusion, and account-budget mutation remains ADMIN-only. Admission switches apply before new work is created or cost reserved. Accepted work keeps its reconciliation, settlement and cleanup contract when a flag is later turned off; an emergency cancellation mechanism, where needed, is separate from hiding UI or stopping admission. If only graph preparation is unavailable, ingestion and chatbot work continue and question preparation reports itself as on hold.

## 4. KB-owned subject and language

### 4.1 Meaning and defaults

Subject area and language for generated content become canonical KB settings. Domain versions, graph tiers and provider options stay out of the normal fields.

Creation precedence:

- Reusing a KB preserves its settings.
- In a chatbot-originated creation flow (S6), propose the course language, mapped `en` to English and `de` to German. [E30]
- Otherwise propose the account language, mapped the same way, and General academic.
- If the stored language is unsupported, show an explicit supported proposal rather than coercing silently.

A suggested value is visible and editable; accepting it requires no selector. Subject is never inferred from an LLM or a filename. Cross-university KBs therefore stop defaulting to Finance, which only the provider's historical omitted-input path did. If the deployed catalog revision lacks General academic, expose the real supported choices.

The language is the default language of graph-derived generated content. It is not a restriction on source-document language, a translation request or the UI locale. Mixed-language materials remain possible.

### 4.2 Storage and compatibility

Add the minimum fields on `KB` for the desired domain policy id and version and the generation language, using the shared catalog types. Hide policy versions from the normal UI, persist them explicitly and snapshot them on each graph build.

S2 creates the first KB update mutation, owner-scoped under the existing row lock. [E29] It updates name, description, subject and language. A version column is added only if an optimistic UI needs it.

Existing KBs require evidence-based initialization. Use an explicit saved selection where one exists; otherwise preserve the currently published build's effective configuration, or an unambiguous explicit selection from the build history when nothing is published. A failed latest build is not evidence that a different domain is served. Preserve the distinction between explicit choices and the documented legacy implicit default; historical builds are not rewritten as explicit selections.

A retired domain version or unsupported combination stays identifiable. It may block a new build; it never blocks KB reading or chatbot retrieval of already-available material. Policy or version never switches silently during a sweep.

Editing subject or language marks preparation pending for S4; it re-uploads nothing, rewrites no existing questions, changes no published chatbot's language and publishes nothing. Editing name or description triggers no build.

Chatbot teaching scope remains chatbot-owned. KB metadata is at most a visible creation suggestion when no course or chatbot setting is more authoritative.

### 4.3 Graph-language transition

Question generation obtains its language from the published bundle, so relabeling a KB from German to English leaves the old German bundle German. New generation waits for a compatible preparation. Once ready, show the actual effective language. Existing generated items remain untouched.

## 5. Automatic preparation with two independent outcomes

### 5.1 Fast path: material ingestion

The normal intention is "Add materials", which includes ingestion. The replacement flow is the reference implementation [E16]: inside one transaction it claims the resource as `QUEUED` and writes the ingestion run; after commit it dispatches the Hatchet task; a dispatch failure is marked on the resource; and the 15-minute maintenance sweep re-dispatches any `QUEUED` run that never reached the provider, reusing the same attempt id. [E17]

S3 makes `confirmKbFileUpload` and `createKbUrlResource` follow that path. [E4] The resource is created in `QUEUED` with its run row in the same transaction, and dispatch happens after commit. No second browser mutation, no outbox, no new intent table. Public-URL and SSRF protections and the supported fetch scope are unchanged; a one-page addition stays a one-page addition.

Required failure behavior:

- Upload failed: retry the transfer.
- File accepted but dispatch not acknowledged: the maintenance sweep reconciles the same attempt.
- Ingestion failed: retry preparation on the existing resource.
- Replacement failed: state whether the previous version is still usable.
- Source removed or superseded: obsolete completions cannot reactivate it.

While bytes are transferring, the browser dependency is explicit. Only after server acceptance may the UI say preparation continues after leaving the page. A lost confirmation is reconciled by the existing upload-ticket identity before another resource is allocated.

For multiple files, S3 slice 2 enables multiple selection in the dropzone [E19] and transfers files sequentially through the existing ticket flow, with per-file outcomes and retry of failed files only. Concurrent transfers, folders, resumable upload and a persistent upload manager stay deferred.

Course material remains the default classification for new uploads, with the administrative alternative visible and correctable after upload. Legacy unclassified and imported material is never reclassified silently. Automatic processing applies to both classifications for chatbot retrieval; graph and question eligibility stay narrower, and the classification control stays discoverable so a syllabus can be excluded from generated questions without leaving chatbot answers.

### 5.2 Slower path: scheduled graph preparation

The platform prepares graphs automatically for eligible KBs in the sponsored cohort, including KBs not yet connected to a chatbot. A normal user never opts in to knowledge graphs, selects quality, approves a cost estimate or clicks Build.

The rebuild mutation's admission path is already correct: AI entitlement, `kb-graph-builds`, the per-KB opt-in, serving course-content sources, cost configuration, quota reservation, then a compare-and-swap on the KB's single slot. [E5] S4 factors its body into a shared service function and adds one Hatchet cron that calls it with a trusted system trigger and the KB owner's explicit identity. No user or ADMIN session is manufactured. Every automatic build is recorded as automatic.

Operating policy, configured in operator settings and validated before activation:

- **Sweep** every 15 minutes, enumerating candidates in bounded pages and claiming work atomically across scheduler instances.
- **Candidate:** undeleted KB whose owner is in the automation cohort with live AI entitlement and `kb-auto-graph-preparation` on; supported explicit subject and language; no operator hold; no active build; at least one serving course-content source.
- **Due:** no published graph, or the published build's frozen domain, language or tier differs from the KB's desired settings, or the serving source digest differs; and the latest serving or settings change is older than the quiet period (30 to 60 minutes); and any failed attempt's backoff has elapsed. An age bound of a few hours guarantees that continuous small edits cannot postpone eligible material indefinitely.
- **Admit** oldest unmet intention first, owner-fair, up to the provider concurrency cap. The Standard tier and the KB's explicit domain and language are used; High and provider tuning stay internal.
- **Run** in the existing worker infrastructure, never in a request-bound task or an API-pod timer, with provider calls outside long-running database transactions. Use the installed Hatchet SDK's cron and concurrency APIs.

Coalescing comes from the quiet period plus the single slot: a dozen uploads inside one quiet period yield one build. The 24-hour user expectation is elapsed time and is conservative under this policy rather than a target to measure into.

The per-KB opt-in `knowledgeGraphEnabled` [E21] becomes the operator hold for the cohort. Enrollment sets it for the cohort's existing KBs through a dry-run inventory and a separately authorized backfill; KBs created by cohort members default to enabled. Accounts outside the cohort keep the current manual behavior.

#### Fingerprint

The stored `sourceContentDigest` covers ordered serving source content only. The due check, shared between admission and readiness, extends it with explicit domain id and version, generation language and build tier or recipe version, so a language change is detected. The source-only digest keeps its existing consumers.

Failed or incomplete ingestion stays visible in the requested coverage: readiness distinguishes "waiting for resources" from "some resources need attention", and operators keep a finite recovery path for permanently failed resources.

A source or settings change during a build preserves the newer pending intention; the old result never overwrites the desired identity, using the existing slot rules plus version fencing. A harmless content update leaves the last published graph available under the existing stale-data policy, while the new-question flow labels it as excluding recent changes. Deleted or withdrawn content keeps its stricter invalidation.

#### Failures and spending

Reuse the existing retries, backoff and attempt limit. An ambiguous external dispatch is reconciled or flagged for operations, never retried as a fresh paid build. Reservation and settlement go through the existing accounting path even though the UI shows no money. [E20]

Two accounting defects are documented in PR #6236. An unmetered terminal result used to park its reservation forever; #6238 now releases such holds after 24 hours and the platform absorbs the cost. [E22] A quota change while the ledger row disagrees still fails every build; an automatic scheduler would hit that first, so the #6236 quota-lockstep package lands before the scheduler is enabled. Automatic builds stay within the owner's semester quota with operator-configured headroom for interactive question generation.

Graph work gets bounded capacity and lower priority than chatbot ingestion, so a graph backlog never makes material ingestion unusable. Operators see queue age, oldest unmet preparation age, failure and retry counts, ambiguous dispatches, blocked entitlements, quota blocks and last successful reconciliation. Normal users see readiness and attention states only.

### 5.3 No incidental publication or feature activation

A completed graph publishes no chatbot, turns on neither GraphRAG nor the concept map, runs no question generation, accepts no generated questions and approves no pending review. Only the derived preparation becomes available. The user starts question generation after readiness; preserving an unfinished form for a return visit is optional and is not a durable "generate later" subsystem.

## 6. Readiness and placement

### 6.1 Two small, shared readiness projections

Expose a compact server-owned projection reused on the KB overview, the KB list, the chatbot Materials view, the chatbot list and question generation:

- `chatbotMaterials`: available-source summary, processing and failure counts, actionable causes.
- `questionPreparation`: waiting-for-materials, queued, processing, ready, delayed, needs-attention, unavailable or no-eligible-materials; selected KB identity; effective and pending language and subject when they differ; last successful preparation; safe retry or contact action.

These are meanings, not new persisted enums. Derive them from the existing ledgers and the small desired-preparation record. S3 supplies retrieval readiness from existing resource and inventory semantics; S4 adds generation readiness; S6 consumes retrieval readiness before any scheduled graph exists.

Example normal overview:

> Chatbot materials: ready — 12 documents available.
> Question generation: preparing automatically. Check back within 24 hours.

Say queued or preparing only when true. After the 24-hour window is missed, replace it with a delayed state and an escalation route, keeping the original pending-age timestamp through retries. Poll moderately while a relevant page is visible and refresh on return.

A failed file needs a file-level action. A quota or provider hold needs operations. An administrative-only KB says that course material is needed for question generation. Imported-only inventories keep their origin and incomplete-scan indicators. [E12]

### Behavior while prepared material is being updated

| Change or condition | New question-generation behavior |
|---|---|
| No first eligible preparation yet | Show the waiting, processing or attention state. Generation stays unavailable. |
| Only additions or a non-removal update are pending, and the old basis remains authorized and eligible | Permit the prepared basis with a visible source count and date and a notice that recent changes are excluded. |
| Desired subject or language changed | Wait for a preparation matching the new settings. No old/new chooser in this slice. |
| A source was deleted, restricted or made ineligible | Invalidate affected uses under the source-safety contract. |
| Inventory or source identity is incomplete | Report the coverage limitation. |

Existing questions and permitted chatbot retrieval are unchanged by an ordinary subject or language edit.

### 6.2 Question generation

List all KBs the actor is authorized to see, including not-yet-ready ones, without broadening ownership or AI access. Keep an explicitly requested KB selected while it prepares. A missing or inaccessible requested id gets its own state and never falls back to another KB, which removes the current first-source fallback. [E7]

The server resolves the effective eligible graph for the selected KB and returns a source-basis identity with the source summary. The request carries that identity; the server revalidates it with ownership, permission, settings, coverage and bundle eligibility, then pins the build. [E13] When the expected basis is no longer eligible, return a targeted refresh message rather than substituting a newer graph. Another KB's build id is dropped when the selection changes.

The form keeps its existing defaults: six single-choice questions, medium difficulty, Understand level. It shows type, count and actual output language. Existing design, plan and output review requirements remain; automatic preparation is never permission to auto-approve generated material.

### 6.3 Chatbot and KB connections

Keep the existing screens and URLs. Rename Knowledge to Materials, present Disclaimer as Student information, and omit Usage for the normal cohort. After chatbot creation, continue into Materials; keep student-information completion visible before publication submission.

Binding is currently possible only from the KB page; the chatbot's Knowledge view is read-only with a link out. [E8, E25] In Chatbot → Materials, S6 provides "Use an existing KB" and "Create a KB". A successful creation returns the id, connects it and stays in the chatbot context. If creation succeeds but connection fails, show the created KB with Retry connection. The first KB is never auto-attached just because it exists.

The selector renders a list, because chatbot readers already accept plural KB ids since #5879; the server keeps enforcing single-active through the existing attach path. [E25] Replacement and disconnection of a live binding warn, as the KB page does today.

Two list additions belong to S6: the chatbot list card [E23] shows course and status only, so add the connected KB and its materials readiness; the KB list page [E24] shows counts only, so add subject, language and the two readiness summaries. Each is a one-query addition.

KB overview shows linked chatbots with real links and a "Create chatbot using this KB" action. A course-origin flow preselects the known course; otherwise require explicit selection when several courses are eligible. Bindings keep their independent live lifecycle; they are not staged as chatbot revisions. [E15] Unknown deep links never select the first object.

### 6.4 Minimum viable chatbot setup and approval

Use the teaching defaults already in the backend. Omitted hidden values mean unchanged, never reset. Legacy and custom configurations remain readable and usable; an invalid hidden setting gets an operator remedy.

Keep name and course, material connection, teaching scope and modes, and student information visible. Prefill suggested student-information text for review. Remove credits, graphs and examples from mandatory setup and review summaries. One plain sentence distinguishes "saved, not visible to students" from "published version remains live".

Continue using the existing publication request, use case, expected audience, withdrawal and review comments; publication requires use case, expected student count, disclaimer title and intro, and an AI-enabled account. Reuse the description as a visible suggestion for the use-case field. Approval remains approval plus publication with no second release state. Show the actual missing authorization and a working contact path.

Keep the preview truthfully named: it uses the active configuration, not the draft.

## 7. Six implementation work packages, in delivery order

### S1 — Simplified surface, advanced flag, cohort defaults

**Outcome:** Normal accounts see a coherent working product; the sponsored cohort's chatbots answer at full quality without hidden configuration.

**Owns:** `ai-advanced-management` in the flag contract; the hide list in section 3; the server-side credit default in `createChatbot`; deletion of the unmounted credits accordion; sponsored messaging; the affected translation keys.

**Entry points:** `packages/feature-flags/src/contracts.ts`; `packages/graphql/src/services/chatbots.ts` (`createChatbot`); `apps/frontend-manage/src/components/resources/chatbots/ChatbotDetails.tsx`, `ChatbotAuthoring.tsx`, `chatbotWorkspace.ts`, `ChatbotWorkspaceNavigation.tsx`; the graph panel mount in `packages/kb-management/src/KnowledgeBaseDetail.tsx`.

**PR slices:** (1) flag key, credit default, dead-code deletion, default-preservation tests; (2) normal-user UI hide list, safe old-link behavior, browser evidence in EN and DE.

**Acceptance:** A new normal chatbot is configured and submitted without a credit, model, graph or example panel appearing. Hidden components issue no related query. Unrelated saves preserve hidden published and draft configuration. A fresh cohort chatbot serves ADVANCED turns under the confirmed credit policy without lecturer action. Advanced users see every current control.

**Dependencies:** none.

### S3 — Automatic ingestion after upload or URL addition

**Outcome:** Accepted materials progress to chatbot usability without a second action, independently of graph preparation.

**Owns:** `confirmKbFileUpload` and `createKbUrlResource` adopting the replacement path and the admission check; sequential multi-file upload; the retrieval-readiness projection consumed by S6.

**Entry points:** `packages/graphql/src/services/knowledge.ts` (`confirmKbFileUpload`, `createKbUrlResource`, `confirmKbFileReplacement` as reference); `packages/hatchet/src/kbMaintenance.ts` for recovery tests; `packages/kb-management/src/components/KnowledgeBaseFileDropzone.tsx`, `KnowledgeBaseUrlForm.tsx`, `KnowledgeBaseAddResourceModal.tsx`.

**PR slices:** (1) the two service functions plus failure-injection tests against real PostgreSQL; (2) multi-file selection with sequential transfer and per-file outcomes.

**Acceptance:** Close the browser immediately after confirmed acceptance: ingestion still runs. A failed dispatch is re-dispatched by maintenance with the same attempt id. A failed file in a batch leaves the others intact. Confirmation with the flag off is rejected with a clear message and no `ADDED` row. Legacy `ADDED` rows are reconciled only under the documented backfill policy. Existing deletion, SSRF and quota protections pass.

**Dependencies:** none. The `kb-ingestion` flag already exists.

### S2 — KB-owned subject and language

**Outcome:** Subject and language are configured once at the KB and consumed by every build.

**Owns:** KB settings schema and migration; the first KB update mutation; catalog adapter and initialization; KB creation and overview metadata components.

**Entry points:** `packages/prisma/src/prisma/schema/knowledge.prisma`; KB GraphQL types and ops; `knowledge.ts` (`createKb`, new update mutation, `getKbKnowledgeGraphDomainConfig`); `packages/knowledge-graph/src/domainCatalog.ts`; `packages/kb-management/src/components/CreateKnowledgeBaseModal.tsx`, `KnowledgeGraphPanel.tsx`; `packages/kb-management/src/KnowledgeBaseDetail.tsx`; `apps/frontend-manage/src/pages/resources/knowledgeBases.tsx`.

**PR slices:** (1) additive model, update mutation and compatibility initialization with migration tests; (2) creation and overview settings, existing-build-aware summaries, build-input adapter so the graph panel and the future scheduler read the KB settings.

**Acceptance:** New defaults are visible and correct; an English KB requests an explicitly English graph. Retired explicit choices are unchanged. Metadata saves are owner-scoped. Name changes schedule nothing; language or subject changes mark preparation pending without changing live chatbot behavior.

**Dependencies:** none at runtime. Activation of the selector needs the domain gates in section 3.2.

### S6 — Direct chatbot material setup and lean publication path

**Outcome:** A lecturer prepares a chatbot without leaving it to discover reverse KB-binding controls.

**Owns:** reusable select, create and connect workflow; course-origin context; list readiness on both list screens; normal setup next actions; publication wording.

**Entry points:** `apps/frontend-manage/src/components/resources/Chatbots.tsx`; `apps/frontend-manage/src/components/resources/chatbots/ChatbotList.tsx`, `ChatbotCreateModal.tsx`, `ChatbotDetails.tsx` (Knowledge view), `ChatbotPublicationRequest.tsx`; `packages/kb-management/src/components/KnowledgeBaseChatbotBindings.tsx` and the KB creation callback; `apps/frontend-manage/src/pages/resources/knowledgeBases.tsx`.

**PR slices:** (1) select, create and connect workflow with safe explicit-id and course routing; (2) readiness on both lists, setup defaults, publication guidance and live-change warnings.

**Acceptance:** Create a KB from a chatbot, upload materials and return without losing context. A connection failure duplicates nothing. Live replacement or disconnection is clearly distinguished from draft settings. Required student information is still reviewed. A published bot stays live through editing, rejection and withdrawal under existing rules. No hidden section is required to submit.

**Dependencies:** S1 surface; S2 metadata for creation suggestions; S3 for the integrated upload journey. Generation readiness is added later through the shared projection.

### S4 — Scheduled graph preparation and preparation-status contract

**Outcome:** Eligible KBs become ready for generated questions without visible graph operations.

**Owns:** shared admission service function; the cron; preparation fingerprint; cohort enrollment tooling; operator observability; the generation-readiness projection.

**Entry points:** `knowledge.ts` (`rebuildKbKnowledgeGraph` body, `setKbKnowledgeGraphEnabled`); `knowledgeGraphAccounting.ts`; `packages/hatchet/src/kbGraphIngestion.ts`, `kbMaintenance.ts`, `index.ts` cron registration; `questionGenerationGraph.ts` compatibility helpers.

**PR slices:** (1) shared service function, fingerprint and readiness contract with deterministic tests and a compatible disabled path; (2) the cron with cohort-aware admission, quiet period, backoff and observability; (3) enrollment inventory tooling if independently reviewable.

**Acceptance:** Many uploads inside a quiet period produce one build. Unchanged inputs spend nothing. A domain or language change produces a new build. One active slot holds under concurrent scheduler instances. A changed or deleted source is never marked current by a stale completion. Existing settlement stays exact. Flag off stops new work only. Delayed and blocked states are observable and never masquerade as ready.

**Dependencies:** S2 settings; S3 serving-change semantics; the #6236 quota-lockstep fix merged.

### S5 — KB-first question generation and truthful readiness UI

**Outcome:** Users see the selected KB and a useful status instead of an empty source selector or a demand to build a graph.

**Owns:** authorized KB availability query; selection state and form; readiness presentation in KB overview.

**Entry points:** `apps/frontend-manage/src/components/elements/generation/ElementGenerationConfigure.tsx`, `ElementGenerationBuild.tsx`; `questionGenerationGraph.ts`; `elementGeneration.ts`; generation GraphQL operations.

**PR slices:** (1) KB-to-build resolution, source-basis identity, removal of the first-source fallback; (2) form defaults, pending, failed and delayed states, language transition and E2E journeys.

**Acceptance:** A requested unready KB stays selected while another KB is ready. Unknown errors are never empty results. The UI never claims 24 hours indefinitely. Form and server agree on effective language, domain and bundle. No request starts automatically when preparation finishes. Existing review gates remain.

**Dependencies:** S2 and S4 contracts landed.

## 8. Ownership, stacks and merge discipline

Before dispatch, record the baseline SHA, one accountable owner per package and the overlap table in [Related work](#related-work). Adopt an existing equivalent PR instead of opening a duplicate.

Shared files are `contracts.ts`, the flag docs, Prisma migrations, the public SDL snapshot and the translation catalogs. The first package to land a change owns it; later packages rebase onto it. Each layer stays buildable.

| Package | Delivery shape |
|---|---|
| S1 | one small stack of two layers, or two PRs |
| S3 | one PR; multi-file as a second PR |
| S2, S6, S4, S5 | native stacks via `$stacked-change` and `$gh-stack`, two or three layers each |

Base every task branch on the current `v3-ai`, never on the eventual promotion PR. Consume a cross-package prerequisite after it lands and passes CI. Requalify descendants after a parent changes. Checks are never bypassed and protected branches never force-pushed.

Each layer carries its tests and exact-head CI; a skipped Playwright job is not a pass. Use the repository skills for verification: `klicker-testing-verification`, `klicker-playwright-e2e` and `agent-browser` with delegated login, running app checks in the disposable container against guarded disposable databases and Playwright through `pnpm playwright:host` from the host. Retained development, staging and production data are never reset for these tests. Capture EN and DE browser evidence for affected normal and advanced paths. Post `/final-review` on an ordinary layer and `/final-review-stack` only on the top of a verified stack, under the standing repository authorization.

Follow the sync policy in the checkout's own `AGENTS.md` or `CLAUDE.md`. Merge, flag activation, provider spending, retained-database changes and deployment keep their existing authorization boundaries.

Each package handoff records: S-number, PR layers with base and head SHAs, dependency status, changed interfaces and migrations, acceptance results, executed commands and browser or E2E evidence, unrun checks, flag defaults and activation prerequisites, operational risks and rollback behavior. Proposed tests are recorded as proposed and merged features as merged, never as executed or deployed. Task status lives in the existing tracker.

## 9. Definition of done

Each package proves its own acceptance list. The integrated exercise covers five journeys:

1. **First KB and chatbot:** create a KB with defaults, upload several synthetic materials, observe automatic ingestion, connect from the chatbot, configure student information and request publication without an advanced control appearing. Chat retrieval works while question preparation is queued.
2. **Scheduled questions:** the sweep runs with no lecturer session open; the KB moves from queued to ready; question generation starts with the correct source, domain and language; human review remains.
3. **No wrong-source substitution:** open an unready or missing KB while another is ready; generation never uses the other KB.
4. **Language change during a build:** the old result never appears ready for the new settings; existing chat and generated items are untouched.
5. **Permissions and flags off:** normal, advanced, missing approval and revoked actors; `kb-ingestion` and `kb-auto-graph-preparation` off; accepted work settles; hidden sensitive actions stay protected; a limit failure offers a truthful remedy.

The one-active-build slot, semester quota and human-review quarantine already exist and are reused, not re-proven. Use deterministic clocks and synthetic fixtures locally; a mocked provider proves scheduling, not ingestion or graph quality. Separately authorized staging evidence shows real transfer, parsing, graph publication and a material-grounded chatbot and question flow.

## 10. Activation, rollback and deferred scope

Release in this order:

1. **Foundations:** S1 slice 1 (flag key, credit default, dead code) and S2 slice 1 (additive schema, initialization, update mutation). Migrations start no model work.
2. **Working chatbot path:** S1 slice 2, S3 and S6. Enable `ai-advanced-management` for the internal cohort. The graph panel stays mounted for normal users because it is still the only preparation path.
3. **Automatic question preparation:** after the #6236 quota-lockstep fix and provider, domain and cost readiness, enroll a bounded KB set, enable `kb-auto-graph-preparation` for the cohort, then land S5.
4. **Complete normal-user surface:** remove the graph panel from the normal cohort once automatic preparation and its status and recovery route work.

UI code may land earlier than its activation step. No screen claims a job is scheduled before the policy and worker registration exist, and no cohort loses its only working preparation path.

Rollback for automatic admission: turn the flag off, preserve pending evidence, let accepted work reconcile and settle, keep deletion and already-ready chat available, and show accurate temporarily-unavailable states for new work. Mass-deleting graphs or reverting to hidden manual-only UI is not a recovery strategy.

Measure upload-to-retrieval-ready time, oldest-unmet-intention-to-ready time, overdue and failed KBs, prevented duplicate builds, graph spend versus generation spend, and wrong-source regressions, from operational metadata only. If capacity cannot sustain the 24-hour expectation, adjust schedule, capacity or wording before widening the cohort.

Deferred: full workspace redesign, autosave coordinator, exact draft-runtime preview, staged KB bindings, immutable historical retrieval, multiple active KBs, reviewer workbench, review-event engine, notification platform, billing or credit redesign, automatic question generation after preparation, graph-engine replacement and mobile redesign.

**Exit criterion:** A normal approved lecturer adds materials, prepares and connects a chatbot, understands what is ready and uses question generation when preparation completes, without documentation on pipeline controls or cost configuration.

## Appendix — source references

All links point at `2c1533f5d208fa5a6df52ed0a34c85b2f2239464`. Read the current checkout before implementing.

- **E1:** [`AGENTS.md` on `v3-ai`](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/AGENTS.md); compare `CLAUDE.md` on `v3` for the direct-merge-push rule.
- **E2:** [KB model](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/prisma/src/prisma/schema/knowledge.prisma#L96-L128) and [frozen domain triple on the build](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/prisma/src/prisma/schema/knowledge.prisma#L213-L215).
- **E3:** [Domain and language selection, retired and legacy handling](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/kb-management/src/components/KnowledgeGraphPanel.tsx).
- **E4:** [`confirmKbFileUpload` ending in `ADDED`](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/knowledge.ts#L1672-L1801) and [`createKbUrlResource`](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/knowledge.ts#L2067-L2110).
- **E5:** [`rebuildKbKnowledgeGraph` admission, sources, reservation, slot and dispatch](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/knowledge.ts#L3162-L3423).
- **E6:** [Generation eligibility and language](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/questionGenerationGraph.ts#L135-L174) and [source listing](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/questionGenerationGraph.ts#L222-L266).
- **E7:** [First-source fallback in the generation form](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/apps/frontend-manage/src/components/elements/generation/ElementGenerationConfigure.tsx#L139-L146).
- **E8:** [Workspace views](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/apps/frontend-manage/src/components/resources/chatbots/ChatbotWorkspaceNavigation.tsx#L5-L19); [Knowledge view](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/apps/frontend-manage/src/components/resources/chatbots/ChatbotDetails.tsx#L872-L1085) and [Usage view](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/apps/frontend-manage/src/components/resources/chatbots/ChatbotDetails.tsx#L1126-L1424).
- **E9:** [`createChatbot` defaults, Auto model](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/chatbots.ts#L1980-L2033).
- **E10:** [Feature-flag semantics](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/docs/feature-flags.md); **E10a:** [typed registry](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/feature-flags/src/contracts.ts#L6-L19); **E10b:** [catalog revision capability gate](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/knowledge-graph/src/domainCatalog.ts#L92-L102).
- **E11:** [Trusted-pilot boundary](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/docs/adr/0041-chatbot-trusted-pilot-boundary.md).
- **E12:** [Imported inventory and reconciliation state](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/knowledge.ts#L1-L220).
- **E13:** [Generation request pinned to a build id](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/elementGeneration.ts#L89-L90).
- **E14:** [Hatchet ingestion, graph and maintenance modules](https://github.com/uzh-bf/klicker-uzh/tree/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/hatchet/src/).
- **E15:** [Bindings outside the revision contract](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/docs/adr/0043-review-chatbot-revisions-before-activation.md).
- **E16:** [`confirmKbFileReplacement`, the reference ingestion pattern](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/knowledge.ts#L1867-L2065).
- **E17:** [Maintenance re-dispatch of stranded `QUEUED` runs](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/hatchet/src/kbMaintenance.ts#L384-L504).
- **E18:** [Ingestion admission check](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/knowledge.ts#L462-L468); called from the ticket request, replacement, URL creation and manual ingestion, not from `confirmKbFileUpload`.
- **E19:** [Dropzone default classification](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/kb-management/src/components/KnowledgeBaseFileDropzone.tsx#L44-L45) and [single-file input](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/kb-management/src/components/KnowledgeBaseFileDropzone.tsx#L178).
- **E20:** [Automatic publication on settlement](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/knowledgeGraphAccounting.ts#L574-L585).
- **E21:** [`setKbKnowledgeGraphEnabled`](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/knowledge.ts#L3098-L3117).
- **E22:** [Release of unmetered reservations after 24 hours (#6238)](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/hatchet/src/kbGraphIngestion.ts).
- **E23:** [Chatbot list card](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/apps/frontend-manage/src/components/resources/chatbots/ChatbotList.tsx).
- **E24:** [KB list page](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/apps/frontend-manage/src/pages/resources/knowledgeBases.tsx).
- **E25:** [`attachKbToChatbot` disabling other bindings](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/knowledge.ts#L1181-L1197) and the [KB-side bindings panel](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/kb-management/src/components/KnowledgeBaseChatbotBindings.tsx).
- **E26:** [Participant credit defaults](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/prisma/src/prisma/schema/chat.prisma#L199-L202) and [ADR 0020 on credits and the base-model fallback](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/docs/adr/0020-two-tier-chatbot-approval.md#L55-L70).
- **E26a:** [Participant credit debit by turn cost](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/apps/chat/src/services/accountUsage.ts#L465-L471) and [turn cost from registry prices](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/apps/chat/src/app/api/chatbots/%5BchatbotId%5D/chat/route.ts#L2042-L2048).
- **E27:** [Unmounted credits accordion](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/apps/frontend-manage/src/components/resources/chatbots/ChatbotAuthoring.tsx#L1253-L1296).
- **E28:** [Concept-map consumer in the chat app](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/apps/chat/src/components/assistant.tsx#L586).
- **E29:** [Row lock on owned KBs](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/knowledge.ts#L508-L523); `createKb` at [L1303](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/graphql/src/services/knowledge.ts#L1303) is the only KB metadata writer.
- **E30:** [`Course.language`](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/prisma/src/prisma/schema/course.prisma#L12), [`Locale` enum](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/prisma/src/prisma/schema/user.prisma#L81-L84) and [graph languages](https://github.com/uzh-bf/klicker-uzh/blob/2c1533f5d208fa5a6df52ed0a34c85b2f2239464/packages/knowledge-graph/src/domainCatalog.ts#L12).

All baseline evidence is source-based. Tests and live-environment qualification are implementation deliverables.
