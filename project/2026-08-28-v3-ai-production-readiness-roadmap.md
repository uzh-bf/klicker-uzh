# `v3-ai` production-readiness roadmap — revised

Date: 2026-08-28 (v2, incorporating the adversarial review in `2026-08-28-v3-ai-production-readiness-roadmap-review.md`). Repository facts below were verified against `origin/v3`, `origin/v3-ai`, tag `v3.4.0-alpha.73`, the GitHub protection and check-run APIs, and all referenced PRs on 2026-08-28.

**Assumption:** the `trusted_policy` failure in the Final-AI-review workflow is being fixed independently and is assumed green on `v3-ai` before G0 completes. This roadmap contains no repair work for it; include the Final-AI-review checks in the required set once one `v3-ai` push confirms them green.

---

# Recommended operating model

Run `v3-ai` as **two concurrent tracks**:

1. A production-readiness spine that reaches a clean, cohort-gated release.
2. A continuing AI feature mainline for the larger upcoming capabilities.

The critical sequencing rule is:

> Normalize the shared persistence and runtime boundaries first, then cut a release branch. After that cut, production stabilization continues independently while large features keep landing on `v3-ai`.

As of 2026-08-28, `v3-ai` is ≈87 commits ahead of and 6 behind `v3`. **Branch protection is absent everywhere:** `v3-ai` has no protection object at all, and `v3` requires zero status checks and zero reviews — it blocks only force-pushes. Every freeze, queue, and gate in this roadmap is process-only until G0 creates real protection on **both** branches.

The release-branch model proposed here is not new machinery: the repository already cuts `release/v3-alphaNN` branches and `v3.4.0-alpha.NN` tags from `v3`, production deploys from those tags, and the prd MCP workflows trigger on `v*.*.*` tags. `release/v3.5.0-ai` reuses that existing convention.

The existing ClickUp release gate is due **September 15, 2026**, leaving 13 working days from August 28. Its intended scope is student-facing chatbot/MCP hardening, backend reliability, and tutor QA — not every AI feature currently in flight.

> **September 15: production-deployable, default-off/cohort-gated AI core.**
> It is not the GA deadline for graph generation, participant-owned practice, semantic grading, BYOK, embeddings, and the new chat-engine architecture simultaneously.

**Capacity precondition (decide at G0):** the same team currently carries a large open non-AI PR portfolio (Pino logging stack #5316–5320, assessment audit stack, live-quiz correlated-responses stack #5370–5376, analytics/participant-data-use stack, product-updates stack, Biome Tier 1 #5348). The 13-day schedule has zero slack; it holds only if G0 names which of these stacks pause or transfer for the window. This is an explicit staffing decision, not something the schedule absorbs silently.

---

# 1. Branch and release topology

The current umbrella PR #5092 (`v3-ai` → `v3`, 835 files, body is only a ClickUp tracking link) is not the release PR. Use this topology:

```text
v3 ────────────────┐
                    ├── release/v3.5.0-ai ──> final release PR ──> v3
v3-ai ──────────────┘
  ├── feature/personal-practice
  ├── feature/semantic-feedback
  ├── feature/chat-engine
  ├── feature/byok
  └── feature/embeddings
```

The sequence:

1. Merge current `v3` into `v3-ai` immediately (6 commits; trivial).
2. Tag the pre-normalization state, e.g. `v3-ai-pre-normalization-2026-08-28`.
3. Apply a short migration/schema freeze while the canonical model is established — declared only **after** protection is live (G0), because an unenforced freeze during 13 days with ~60 open PRs will be violated by accident.
4. Normalize the database and replace the staging-only migration tail (G2, trimmed scope — see §6).
5. **Re-merge `v3` into `v3-ai` immediately before the cut.** `v3` moves for ~8 working days between G0 and the cut; the cut must capture it.
6. Cut `release/v3.5.0-ai` from that exact normalized commit — **content-gated, not calendar-gated** (see §3).
7. Execute the staging cutover runbook (§6a): flip staging to the release branch, reset, re-verify.
8. Lift the `v3-ai` migration freeze only after the staging flip is confirmed.
9. Continue larger features against `v3-ai`.
10. **Back-merge automation:** a bot-opened PR merges every release-branch push into `v3-ai`. "Immediately back-merge" as a manual discipline fails under load.
11. **`v3` absorption rule during qualification:** production keeps shipping `v3.4.0-alpha.7x` from `v3` while the release branch qualifies. Merge `v3` into `release/v3.5.0-ai` before each qualification round and once more immediately before the production deploy; otherwise the `v3.5.0` deploy silently rolls back interim fixes. Owner: release engineer. (Alternative if drift is heavy: freeze alpha promotion for the window — but absorption preserves the no-freeze constraint for `v3`.)
12. Merge `release/v3.5.0-ai` into `v3` with a normal merge commit; merge the resulting `v3` back into `v3-ai`.
13. **The release branch is short-lived:** merged into `v3` and deleted within ~3 weeks of the production deploy. A long-lived parallel line is where two-track models rot.

Do not rebase or force-push any shared integration or release branch. Stale feature branches may be re-cut by cherry-picking with preserved authorship and `-x` provenance.

During the release-candidate period, shared staging must not track the advancing `v3-ai` mainline. Mechanically this is one repository variable — see §6a.

---

# 2. Production scope for the first release

## Production core

| Area              | Required capability                                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- |
| Account access    | Database entitlement plus GrowthBook rollout gate, both enforced server-side                                         |
| Chatbot lifecycle | Create/edit draft, versioned disclaimer, publication request, administrative approval/pause, clear lifecycle states  |
| Lecturer workflow | Owner preview, embedded Manage assistant, proposal review and confirmation                                           |
| Student workflow  | Course-scoped chat, documented authenticated/LTI access paths, failure recovery                                      |
| MCP               | Internal lecturer and student MCP services with scoped, short-lived authorization                                    |
| Knowledge bases   | Create KB, add file or URL, ingest, inspect status, attach one KB to a chatbot                                       |
| Retrieval         | Course-scoped `doc_query`, transport/scope separation, cross-KB negative tests                                       |
| Cost safety       | Per-operation and aggregate caps, no funding-source fallback, emergency kill switches                                |
| Operations        | Structured logs, metrics, traces, alerts, runbooks, deletion and retention procedures                                |
| Deployment        | Final migration chain, reset staging, immutable images, rollback rehearsal                                           |

**Entitlement honesty:** today's server-side entitlement is a single `User.aiFeaturesEnabled` boolean (one-line migration, default `false`). That plus GrowthBook cohorts is the September access-control claim. Whether budget/ledger *enforcement* (reservation and deny at cap) must also be live at Stage 1 is a G1 decision (§5); if yes, it is a money guard and joins the G2 keep-list.

The lecturer authoring contract PR #5593 is a strong early candidate: small, migration-free, and it defines draft lifecycle and versioned disclaimers. Note two repository facts: the stack **targets `v3`, not `v3-ai`** (#5593 → #5614 authoring UI → #5619 publication-request UI), and **#5619 already exists and is non-draft** — the publication-request UI is not "later work". G1 must decide explicitly whether the `v3` landing is deliberate (flag-gated, `v3`-compatible, reaching `v3-ai` via back-merge) or whether the stack retargets to `v3-ai`. The owner-preview PR #5633 (base `v3-ai`, stateless, migration-free) lands early either way.

The LTI guest path is merged but the release must decide whether it is a supported HS production path (G1 decision). Either complete the production acceptance matrix for it or advertise only authenticated participant access for the first rollout.

## Present but default-off or pilot-only

May ship in code and schema, but not as general production prerequisites: knowledge-graph generation, generated Klicker elements, response-example runtime injection and automated evaluation, advanced lecturer-assistant actions, model complexity routing beyond the proven path.

## Subsequent feature trains

Continue against `v3-ai` after the normalized baseline: participant-owned practice, retry/partial credit, rubric-grounded semantic feedback, versioned chat-engine cutover, BYOK, embeddings, video ingestion, graph visualization, social Q&A and personalization.

---

# 3. Milestone roadmap

Working days: Aug 28 (d1), Aug 31 (d2), Sep 1–4 (d3–d6), Sep 7–11 (d7–d11), Sep 14–15 (d12–d13).

| Gate                            | Target window        | Production-readiness work                                                                                              | Permitted parallel feature work                                              | Exit condition                                                       |
| ------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| **G0 — Controlled baseline**    | d1–d2 (Aug 28–31)    | Merge `v3`; **create** protection on `v3` and `v3-ai`; tag; confirm Final-AI-review green (assumed fixed); declare freeze; classify all open PRs; capacity decision | Documentation, tests, UI and stateless runtime PRs                            | Base green, protected on both branches, portfolio dispositioned      |
| **G1 — Schema constitution**    | d2–d4 (Aug 31–Sep 2) | Approve canonical ownership, lifecycle, usage, artifact, deletion and engine contracts; rule the named decisions (§5)  | Feature contracts, mock UIs, evaluator packages, no new persistence           | One authoritative data contract; trimmed G2 scope fixed              |
| **G2 — Normalized persistence** | d4–d9 (Sep 2–9)      | Trimmed normalization (§6); replace migration tail; migration proofs incl. prod-baseline                               | **G3 C0 core integration runs in parallel on `v3-ai`** (freeze is schema-only) | Empty DB and production-baseline DB produce identical schema         |
| **G3 — Core integration**       | d4–d9 (Sep 2–9)      | Land C0 core set on `v3-ai`: authoring/preview, #5174 extractions, MCP/LTI decisions applied, cost caps, kill switches | Same window as G2, C0/stateless only                                          | Named C0 core list fully landed on `v3-ai`                           |
| **Cut**                         | d9–d10 (Sep 9–10)    | Re-merge `v3`; cut `release/v3.5.0-ai`; staging cutover runbook (§6a); lift freeze                                     | C2 queue opens on `v3-ai` after the flip                                      | Staging tracks the release branch; new chain applied clean           |
| **G4 — Release qualification**  | d10–d13 (Sep 10–15)  | Fault/load/security/browser/E2E on the release branch; migration and rollback rehearsal; evidence manifest; dark deploy | Larger features fully resumed on `v3-ai`; release branch takes fixes only    | Production-deployable default-off core; dark deploy Sep 15           |
| **G5 — Feature wave 1**         | Sep 16–30            | Pilot stabilization and defect work; **re-cut #5481–#5483 and #5430–#5433 on the normalized baseline**                 | Participant practice, response-example workflow, cost attribution, QA harness | Feature foundations merged dark and independently gated              |
| **G6 — Feature wave 2**         | Oct 1–31             | Expand proven core cohorts                                                                                             | Retry/partial credit and rubric feedback pilot; graph/generation pilot        | Named live-course evidence and feature-specific quality gates        |
| **G7 — Platform expansion**     | Nov onward           | Broader rollout; retire the release branch (merge to `v3`, delete)                                                     | Chat-engine cutover, BYOK, embeddings, video, social/personalization          | Each capability passes its own production gate                       |

**The cut is content-gated.** It happens when the named C0 core list (#5633, the authoring layers per the G1 branch decision, the #5174 extractions, cost caps and kill-switch wiring) has landed on `v3-ai` and the G2 proofs pass — if that is later than d10, the cut slips. Core work never lands on the release branch: the release branch receives fixes only, and a calendar-forced cut with unfinished core work would invert that flow.

The October evidence rule stands: named courses are required by October 31 for retry/partial credit and rubric-grounded feedback; without authored rubrics, rubric feedback moves to FS27.

---

# 4. G0 — Control the baseline

Complete before another schema-heavy branch merges.

## Repository controls

Branch protection today: `v3-ai` has none (API 404); `v3` requires zero checks and zero reviews. **Create** — not repair — protection on both `v3` and `v3-ai`, plus the release branch at cut time:

* No direct pushes and no force-pushes.
* Required checks drawn from the demonstrably green core set on `v3-ai` (Check codebase, Playwright shards, gitleaks, stg Docker builds, CodeQL), plus the Final-AI-review checks once confirmed green under the in-flight fix.
* Required reviews from schema/data, security and deployment owners where their paths change.
* **Migration-touch CI detection:** a path filter on `packages/prisma/src/prisma/schema/` requires a `schema-change` label and routes the PR into the serialized C2 queue. This is the technical enforcement of the freeze and the one-C2-at-a-time rule — without it both are process-only.
* Merge queue or serialized merges for Prisma migrations.
* Signed or traceable release tags; required generated-artifact and schema-sync checks.

## Portfolio triage

Every open branch gets one disposition — **Land / Re-cut / Extract / Park / Retire** — recorded in the tracking issue and ClickUp (§14), not in individual PR descriptions. The corrected dispositions are in §10. Reconcile ClickUp during G0: the KB task still names #5078 as canonical, while the actual KB/graph implementation merged through #5424 on 2026-08-25.

## Capacity decision

Name which open non-AI stacks pause or transfer for the 13-day window (see the precondition in the operating model). Owner: Roland.

## Temporary schema rule

Until G1 is approved and, for migrations, until the post-cut staging flip:

* No new Prisma migration may merge to `v3-ai`.
* No new lifecycle status, persisted cost column, or artifact column.
* No new direct writes to KB, graph, generation, usage or evaluation status.
* Stateless UI/runtime work (C0) continues freely — this is a schema freeze, not a feature freeze.

---

# 5. G1 — Establish the schema constitution

Create one authoritative document, e.g. `docs/architecture/ai-platform-data-contract.md`.

## Named decisions G1 must rule (with owners)

| # | Decision | Owner | Notes |
| - | -------- | ----- | ----- |
| D1 | Authoring stack (#5593/#5614/#5619) target branch: deliberate `v3` landing vs retarget to `v3-ai` | Roland | Blocks the C0 core list |
| D2 | Response-examples migration: keep (table stays, feature default-off) vs drop from the chain | Schema owner | Default: **keep** — removal reworks merged, tested code; keeping with the feature off is strictly cheaper |
| D3 | LTI guest: supported HS production path or authenticated-only first rollout | Product | |
| D4 | Budget/ledger enforcement beyond the `aiFeaturesEnabled` boolean: Stage-1-blocking or not | Product + backend | If blocking, joins the G2 keep-list as a money guard |
| D5 | Practice cycle/attempt model: **decision only** — the shape is ruled here, implemented in the Train A/B re-cuts (G5), not in G2 | Schema owner | No practice migration exists on `v3-ai`; #5481 carries its own |
| D6 | Personal-element ownership model (shared content/revision primitive vs separate ownership tables) | Schema owner | Same timing as D5 |

## Canonical state ownership

Every mutable fact gets one authoritative owner:

| Concern                          | Canonical owner                 |
| -------------------------------- | ------------------------------- |
| Logical KB source                | `KBResource`                    |
| Captured source version          | Immutable resource revision     |
| Ingestion/cleanup status         | Resource operation              |
| Current served source            | `activeRevisionId`              |
| Graph build execution            | Graph build                     |
| Current published graph          | Graph publication relation      |
| Generated-content batch          | Generation build                |
| Blob/GraphML/workflow files      | Artifact rows                   |
| Reservation and settlement       | Neutral AI usage ledger         |
| Chat persistence and permissions | Klicker chat host               |
| Model orchestration              | Stateless chat engine           |
| Practice retries                 | Practice cycle and attempt      |
| AI feedback                      | Evaluation linked to an attempt |
| Points/XP                        | Separate reward settlement      |
| Example authoring                | Approved response examples      |
| Evaluation ground truth          | Immutable dataset snapshot      |

The merged KB implementation (#5424) documents the liabilities this resolves: mutable resource and ingestion-run state, an unchecked published-graph UUID pointer, graph quota structures drifting into general accounting, and cascading owner deletion racing external cleanup.

## Stable service boundaries

Routes, resolvers, MCP tools and Hatchet workers stop writing canonical tables directly. Consolidate service boundaries (`ChatbotLifecycleService`, `KnowledgeBaseService`, `ResourceOperationService`, `GraphBuildService`, `AIUsageService`, `ArtifactService`, `PracticeAttemptService`, `EvaluationService`). The rule matters more than the names:

> Status transitions, reservations, publication and cleanup happen through one service per domain.

## Feature flags versus entitlements

The hierarchy, defined once:

1. Environment-level emergency switch — operational disable.
2. Database capability/entitlement — authorization and funding. Today this is the `aiFeaturesEnabled` boolean; D4 decides whether ledger enforcement joins it for Stage 1.
3. GrowthBook — targeted rollout and experiment exposure only.
4. Object lifecycle — whether a specific chatbot, KB or activity is usable.

GrowthBook must not become the durable source of entitlements; the database must not duplicate rollout percentages or cohorts.

## Shared extension points

The constitution rules D5/D6 (practice, personal elements), the response-examples split (editable owner-governed examples vs immutable evaluation snapshots), and the embeddings rule (any embedding belongs to a content revision with model/deployment identity, dimension, source digest, status, timestamp; no vector column before a concrete consumer is selected). These are **contracts for the G5+ re-cuts**, not G2 implementation work.

---

# 6. G2 — Normalize the database and rewrite the migration tail (trimmed)

## The blocking discriminator

> A normalization is release-blocking only if it is **migration-shape-critical** (production will carry the shape forever) or it **guards money or isolation**. Everything else is a G1 contract decision implemented in a later train.

**Keep in G2:**

* **KB resources:** `KBResource` / `KBResourceRevision` / `KBResourceOperation` replacing the duplicated mutable state. Failed replacement leaves the previous active revision untouched; a successful operation atomically moves the active pointer; cleanup operations survive owner-facing hiding. (Shape-critical.)
* **Graph publication integrity:** a DB constraint proving the published build belongs to the same KB, and one partial unique index enforcing at most one active build per KB. (Cheap, isolation-guarding.) A timed-out or cancelled build may settle usage and be retained diagnostically but never publishes automatically.
* **Neutral AI usage ledger:** `AIUsageBudget` / `AIUsageReservation` / `AIUsageEvent`, replacing graph-specific accounting. Every chargeable action attributable to funding account, course, chatbot/activity, use case, provider/model, request/build/attempt, and pricing version. Chat, graph generation, element generation, semantic feedback and future BYOK reuse this ledger. (Money guard.)
* **Chatbot–KB binding:** direct nullable `knowledgeBaseId` on the chatbot for the one-KB MVP; no parallel mutable MCP configuration representing the same attachment. (Shape-critical, trivial.)
* **Deletion:** replace destructive owner cascades for externally managed resources with cleanup-aware semantics; user deletion blocks until KB cleanup completes or runs a defined tombstone/anonymization workflow. (Isolation/integrity guard.)
* **Ledger enforcement** if D4 rules it Stage-1-blocking.

**Deferred out of G2 (decided at G1, implemented later):**

* Artifact-row generalization (rows instead of per-kind columns) — additive migration in a later train; not shape-critical now.
* Practice cycle/attempt and reward settlement — no such migration exists on `v3-ai`; implemented in the Train A/B re-cuts (G5).
* Generated-element lifecycle simplification (coarse product states instead of Hatchet-stage mirroring) — apply where it changes the migration chain being cut, defer the service refactor.
* Response examples — per D2; default is keep-as-merged with the feature off.

## Final migration chain

Target chain (adjust names to D2's outcome):

```text
1. ai_platform_core
2. chatbot_authoring_and_examples
3. knowledge_base_resources_and_operations
4. knowledge_graph_builds_and_artifacts
5. element_generation
```

The six `v3-ai`-only migrations being replaced (`assistant_proposal_audit`, `response_examples_foundation`, `ai_features_enabled`, `kb_management_foundation`, `kb_graph_generation_bundle`, `element_generation_cost_accounting`) are **verified absent from `v3.4.0-alpha.73`**, the latest production tag — no v3-cut release carries them, so they are deletable. Production-applied migrations remain immutable.

**Definition of done includes the repo's schema workflow:** regenerate the Prisma client, run `prisma:sync` to mirror models into `apps/analytics`, regenerate GraphQL codegen, and rebuild dependents. A chain that passes SQL proofs but skips these breaks the monorepo.

## Required migration proofs

1. Apply the complete chain to an empty database.
2. Restore a production-baseline snapshot in an isolated, access-controlled environment (direct identifiers minimized) and apply the chain.
3. **Read production's `_prisma_migrations` table first** — git history cannot rule out out-of-band application; the assumed baseline must be verified, not derived.
4. Compare both resulting schemas against the final Prisma schema; require zero drift.
5. Run seeds and application startup.
6. Validate hand-written partial indexes and checks.
7. Validate row-count and orphan invariants.
8. Verify the immediately preceding application revision still starts against the migrated database (rollback safety).

Once the final chain is applied to release-candidate staging, its files and checksums become immutable.

## 6a. Staging cutover runbook

Shared staging tracks the branch named by the repository variable `STG_SOURCE_BRANCH` (currently `v3-ai`); `deploy-stg-promote.yml` fires on every push to that branch and migrations auto-apply via the ArgoCD PreSync hook (ADR-0003). This makes the retarget trivially enforceable — one variable — but the ordering is mandatory:

1. At the cut: flip `STG_SOURCE_BRANCH` to `release/v3.5.0-ai` (atomic).
2. Pause auto-promotion for the reset window (the PreSync hook must not replay mid-reset).
3. Stop workers and callbacks; reset PostgreSQL, staging-only AI Blob prefixes, FalkorDB namespaces, pending Hatchet/provider operations, stale webhook correlation state.
4. **Staging data decision:** the reset destroys all data written since 2026-07-26, including the assistant-proposal audit trail accumulated on staging. Accept the loss explicitly or export first. Owner: Roland.
5. Apply only the final chain and synthetic seeds; confirm the PreSync hook replays the new chain cleanly.
6. Re-enable one integration at a time: ingestion, retrieval, graph canary, generation canary.
7. Resume promotion; only now lift the `v3-ai` migration freeze — the first post-cut C2 merge to `v3-ai` must have nowhere to auto-apply except its own environments.

---

# 7. G3 — Complete the production spine (C0, in parallel with G2 on `v3-ai`)

## Chatbot lifecycle and lecturer flow

```text
Create draft → configure metadata/model/disclaimer → attach KB → owner preview
→ request publication → administrator approve/reject → publish or pause
```

PR #5593 supplies the draft-authoring and versioned-disclaimer foundation, and **the publication-request UI already exists as stacked PR #5619 (non-draft)** — the open question is not building it but the D1 branch decision and landing order. For the beta, operations-assisted approval remains acceptable if the runbook and audit trail are explicit; it must not be represented as automatic publication.

PR #5633 lands early (stateless, current-base). Before activation, run one real provider-backed owner-preview path with and without an attached KB, including citation rendering and failure behavior.

## Chat host and MCP

Retain the proven current chat route. Adopt the boundary from the versioned-engine work without the cutover:

* Klicker host owns authentication, permissions, threads, messages, credits, tools and persistence.
* The engine is stateless and owns model orchestration.
* Tool and scoped execution token are handed off together or not at all.
* No engine receives database access or participant cookies.

PR #5126 (note: **base is `v3`**) leaves the current route active. Extract its engine contract and conformance runner as an early C0 package onto `v3-ai`; deploying and switching traffic is post-core (Train D).

Lecturer and student MCP services remain cluster-internal; the old external FastMCP/OAuth prototype stays unexposed.

**Multi-replica controls:** hard production controls must not remain per-pod in-memory when multiple Chat replicas are active. Rate limiting, proposal replay protection and hard quotas move to Redis or the database — or the release explicitly pins the pilot to one replica until they are shared. **Verify the actual replica count at G4**; do not assume.

## LTI and embedded access

The supported matrix (per D3) covers: authenticated participant; LTI guest if included; expired account/guest tokens; cross-course chatbot; repeat launch preserving the course-scoped guest; third-party-cookie/CHIPS behavior; OLAT iframe CSP and origin; no-login recovery. If Phase B/C guest capabilities are excluded, the UI must reflect the restricted model and the absence of account-history transfer.

## Knowledge-base ingestion and retrieval

Core vertical slice:

```text
Create KB → upload PDF/TXT/MD or add supported URL → confirm source → ingest
→ receive signed callback → display active revision → attach to chatbot
→ retrieve through scoped doc_query → replace/delete safely
```

Required negative paths: malformed file; excessive size; redirect to private IP; unsupported MIME; duplicate callback; failed replacement; callback after deletion; worker death after dispatch; cross-KB scope token; inaccessible KB; provider timeout; deletion during an active operation. Graph generation remains a separate activation gate.

## Existing KB hardening branch

Do not merge PR #5174 wholesale (200 files, based on a pre-#5424 `v3-ai`, stale since Jul 30). It carries **zero schema changes**, so extraction is purely runtime/UI-level and lower-risk than its size suggests. Build a gap matrix against merged #5424 first, then extract into small current-base PRs: pagination and stable cursors; quota behavior; replacement/deletion edge cases; upload/Azurite parity; failure localization; bulk actions; observability; runbooks; browser-state coverage. Close #5174 as superseded once every retained item is linked.

---

# 8. G4 — Operational hardening and release qualification (on the release branch)

## Structured observability

Every request or workflow carries a correlated identifier through browser → chat host/GraphQL → MCP or Hatchet → engine/provider → callback → usage settlement → Langfuse/metrics. Minimum dimensions: environment; course; chatbot/activity; use case; model/provider; operation/build/attempt; funding source; terminal result. No student-authored content or direct identifiers in labels.

The ClickUp roadmap already carries Pino/JSON logging, deployment-architecture review, AI cost attribution and chatbot QA as HS-readiness work — production readiness, not post-launch niceties. (Note: the Pino stack currently targets `v3` as separate PRs #5316–5320; sequence it with the capacity decision.)

## Initial pilot SLOs

Starting thresholds, calibrated after staging telemetry:

| Surface              | Proposed pilot gate                                                                   |
| -------------------- | -------------------------------------------------------------------------------------- |
| Chat availability    | ≥99.5% successful server requests, excluding valid user/policy 4xx                     |
| Non-tool first token | p95 below 5 seconds                                                                    |
| Internal MCP calls   | ≥99% successful authorized calls                                                       |
| Retrieval isolation  | Zero cross-course or cross-KB successes                                                |
| KB ingestion         | 95% terminal within 15 minutes; 99% within 30 (measure first — no current baseline)    |
| Stuck operations     | Zero operations beyond twice their configured terminal timeout                         |
| Usage attribution    | 100% of chargeable operations carry use-case, model and funder attribution             |
| Hard budgets         | Zero successful dispatches beyond the enforced cap                                     |
| Settlement           | No unexplained reservation older than the reconciliation window                        |
| Schema               | Zero drift and zero unexpected orphan rows                                             |
| Security/privacy     | Any cross-tenant leak or secret exposure blocks rollout                                |

## Dashboards and alerts

Dashboards for chat latency/completion/abort/error; model and provider distribution; MCP auth, tool selection and failure; KB queue age and terminal status; callback and reconciliation lag; graph and generation build state; usage reservations/settlements/discrepancies; deletion and cleanup backlog; feature-gate denials; client-visible errors. Every alert has a runbook and a named owner — an alert without a response procedure is not a release gate.

## Fault and load testing

Simultaneous chat turns at pilot concurrency; repeated tool calls; duplicate callbacks; worker restart in each lifecycle phase; Redis failure; provider 429/5xx/timeout; Blob and FalkorDB unavailability; stream interruption; budget exhaustion; feature-flag service outage; DB connection pressure; delayed deletion cleanup. For every test verify user-visible behavior, persisted state and cost settlement — not only HTTP status.

## Deployment and rollback

Release evidence: exact commit and image digests; final migration list and checksums; rendered staging and production Helm values; required secrets by workload; NetworkPolicies and internal-only MCP exposure; database and Blob backup evidence; rollback procedure; previous-app compatibility with the migrated database; one complete production migration rehearsal; one complete staging restore/rebuild rehearsal.

---

# 9. Rules that allow large features to continue

| Class  | Meaning                                                         | Merge policy                                               | Examples                                            |
| ------ | --------------------------------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------- |
| **C0** | No schema and no durable external state                         | May merge during core work after current-base verification | Owner preview, authoring API, UI, contract packages |
| **C1** | Additive state beneath an accepted extension point              | May merge after G2 and schema review                       | Evaluation snapshots, new artifact kinds            |
| **C2** | Changes canonical identity, ownership, lifecycle or accounting  | Serialized through the schema train                        | Personal elements, practice attempts, BYOK ledger   |
| **C3** | Activates external effects                                      | Source merge and activation must be separate               | Graph builds, provider routing, new worker          |
| **C4** | Prototype without accepted production boundary                  | Incubation only; may not target release/mainline           | Old MCP/KB prototypes                               |

**Enforcement over checklists:** the CI migration-touch detector (§4) is the mechanism — it labels and serializes anything touching the Prisma schema, so C2 discipline does not depend on authors filling in a template. Keep the PR-template fields (feature train, release tier, schema class, migration impact, external state and cleanup, flag and default, entitlement boundary, observability/cost attribution, backward compatibility, rollout/rollback, security scope, exact-head verification) but treat them as the human layer above the automated gate, and expect them to be skimmed — the detector is what actually holds.

Only one C2 schema foundation active in the merge queue at a time. Other feature branches keep coding against the approved interfaces and re-cut migrations after the canonical schema PR merges. **A PR carrying schema/migration changes must target `v3-ai`, never `v3`** — see #5514 below.

---

# 10. Disposition of the major current PRs (corrected against repository state)

| PR / stack                            | Base (verified) | Recommended action                                                                                                                                                      |
| ------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **#5633 owner preview**               | `v3-ai`         | Revalidate on latest `v3-ai`, run real KB/provider smoke, land before the cut. Stateless, migration-free.                                                               |
| **#5593 → #5614 → #5619 authoring**   | **`v3`**        | D1 decides: deliberate flag-gated `v3` landing (document the back-merge path) or retarget to `v3-ai`. #5619 (publication-request UI) already exists and is non-draft. Migration-free either way; contract lands early. |
| **#5174 KB hardening**                | `v3-ai`         | Extract into small current-base PRs after a gap matrix vs merged #5424. Zero schema changes — lower-risk than its 200 files suggest. Close as superseded.               |
| **#5481–#5483 participant practice**  | `v3-ai`         | Preserve product work; **re-cut in G5** (after the cut), not during days 4–8 — the foundation carries 10 schema/migration files and must be replayed on the normalized baseline per D5/D6. |
| **#5430–#5433 semantic grading**      | `v3-ai`         | Extract evaluator/contract work now (C0); **re-cut persistence in G5** around the shared cycle/attempt/evaluation/reward model (9 schema/migration files today). No second retry lifecycle. |
| **#5126 chat engine**                 | **`v3`**        | Extract contract, fixtures and conformance runner as an early C0 package onto `v3-ai`. Host/frontend cutover post-core (Train D).                                        |
| **#5514 BYOK**                        | **`v3`**        | **Park and retarget to `v3-ai`** — 9 schema/migration files targeting `v3` violates the C2 rule and would land AI-provider schema on the non-AI mainline. Then decompose post-core per Train E. |
| **#5062 embeddings**                  | `v3-ai`         | Already a 2-file RFC-shaped branch — the conversion is effectively done. Keep as documentation or close; reopen only after a consumer is selected (Train F).             |
| **#5074 old MCP monolith**            | —               | Archive; extract only still-useful OAuth/tool-catalog design. Do not merge its in-memory authorization path.                                                             |
| **#5078 old KB control plane**        | —               | **Non-draft today — close explicitly** as superseded by merged #5424, after updating the ClickUp link. An open non-draft 112-file PR invites accidental resumption.      |
| **#5092 umbrella**                    | `v3`            | Convert to tracking or close as superseded (body is only a ClickUp link). The real release PR is `release/v3.5.0-ai` → `v3` with an evidence manifest.                   |

---

# 11. Feature-train roadmap after the release cut

## Train A — Participant-owned practice
Late September dark merge, then limited pilot. Foundation re-cut in G5 per D5/D6: shared content/revision model or separate ownership tables, participant ownership private-by-default, provenance from chat generation, quotas, deletion/export. Sharing, social discovery and lecturer validation are subsequent layers.

## Train B — Retry, partial credit and semantic feedback
October evidence pilot. Sequence: shared practice cycle/attempt → deterministic retry and partial credit → rubric authoring → semantic evaluation contract → student feedback → dispute/flag queue → mastery/reward settlement → evidence pilot. The product scorecard's expert-judged golden-set quality, scoring agreement, privacy controls and separation from summative grading remain **activation gates**, not September blockers. Multimodal/image path stays v3.6 unless capacity remains.

## Train C — Response examples and tutor QA
September foundation (per D2), October operational QA. Approved lecturer examples generate immutable evaluation snapshots. QA harness: deterministic policy/schema checks; groundedness and citation checks; expert-labelled golden examples; regression comparison across prompt/model changes; production tracing; model-judge evaluation only after validation against experts.

## Train D — Chat-engine cutover
Post-core. Merge contract and conformance runner → current implementation passes unchanged → default external engine passes → Catalyst/Mastra passes → dark/shadow invocation where cost permits → synthetic canary → one cohort → remove old routes only after rollback and browser proof. One canonical conversation store and one credit authority throughout.

## Train E — BYOK/provider credentials
v3.6 unless institutional deployment demands earlier. First: retarget #5514 off `v3`. No activation until: real Key Vault adapter; one-use shared-state capability tokens; platform-approved provider endpoints; neutral usage accounting live; durable participant notice versions; deletion reaching Key Vault and traces; no fallback from user-funded to platform-funded usage; named operational ownership for credential failures.

## Train F — Embeddings
Post-consumer decision (duplicate detection, semantic search, recommendation, retrieval, clustering, or adaptive selection). The decision determines indexing, update cadence, privacy and quality evaluation. No vector column before then.

---

# 12. Release gates

The final release PR does not merge until each gate has a linked evidence artifact.

| Gate           | Pass condition                                                                    |
| -------------- | ---------------------------------------------------------------------------------- |
| Branch         | Both `v3` and `v3-ai` protected; release branch current with absorbed `v3`; no direct pushes |
| CI             | Required checks reliable and green; no permanently ignored baseline failures       |
| Schema         | Canonical model accepted; no duplicated mutable status                             |
| Migrations     | Empty and production-baseline paths pass; prod `_prisma_migrations` verified; zero drift |
| Data integrity | FK, uniqueness, lifecycle and accounting invariants pass under concurrency         |
| Security       | AuthZ, SSRF, prompt injection, token scope and cross-tenant tests pass             |
| Privacy        | Retention/deletion matrix approved; participant processing choices enforced        |
| Reliability    | Duplicate, timeout, restart and late-callback scenarios pass                       |
| Cost           | Reservations and settlements reconcile; limits cannot be exceeded                  |
| Operations     | Dashboards, alerts, ownership and runbooks exist                                   |
| Browser        | EN/DE, desktop/mobile, embedded/standalone and supported browsers pass             |
| Deployment     | Exact images/config/secrets verified; backup and rollback rehearsed                |
| Rollout        | Feature defaults closed; named pilot cohort and stop conditions documented         |

**Accessibility human checks (keyboard and screen reader on critical chat surfaces) move to the Stage-3 activation gate** (§13): a cohort-gated, default-off release exposes no users at cut time, so blocking the cut on them buys nothing — but no student-facing cohort activates without them.

No source-merged feature is production-ready merely because it is flagged. The flag limits exposure; it does not replace migration, security, deletion, observability or rollback work.

---

# 13. Rollout sequence

Capability-specific rollouts, not one `ai-beta=true` launch.

**Stage 0 — Dark production deploy.** Migrations applied; all AI capabilities closed; workers start only in disabled/readiness mode; verify configuration, health, dashboards, absence of unintended calls.

**Stage 1 — Internal synthetic canary.** Lecturer authoring, owner preview, one synthetic KB, ingestion and retrieval, internal MCP, platform-funded fallback model only. No real students.

**Stage 2 — Named lecturer cohort.** Create and preview, manual publication approval, known course materials, strict cost caps. Observe one complete create–ingest–publish–chat–delete lifecycle.

**Stage 3 — Named course cohort.** Student access for selected courses. **Gate: accessibility human checks completed.** Verify OLAT/LTI behavior, participant support burden, cost per student/course, retrieval quality, model failures and recovery, deletion and opt-out. Graph and element generation remain independently gated.

**Stage 4 — Wider private beta.** Expand only after pilot SLOs and quality gates hold. Global kill switch, capability switches and per-account entitlements remain available.

---

# 14. ClickUp structure

Turn the September release task into a gate hierarchy:

```text
V3AI-G0 — Branch, CI and portfolio control
V3AI-G1 — Canonical AI data and lifecycle contract
V3AI-G2 — Migration rewrite and staging reset
V3AI-G3 — Chatbot lifecycle, preview and publication
V3AI-G4 — KB ingestion and scoped retrieval
V3AI-G5 — MCP, LTI and embedded-chat hardening
V3AI-G6 — Usage accounting, logging and observability
V3AI-G7 — Security, privacy, deletion and retention
V3AI-G8 — Release qualification and rollout
```

Separate non-blocking feature parents: `V3AI-T1` participant practice, `T2` retry/semantic feedback, `T3` response examples and tutor QA, `T4` versioned chat engine, `T5` BYOK, `T6` embeddings.

Custom fields: Release tier (core/pilot/next/parked), Schema class (C0–C4), Activation (dark/internal/cohort/broad), External state (none/Blob/Falkor/Hatchet/provider/trace), PR status (not started/draft/ready/merged/deployed/proven).

G0 reconciliation: repoint the KB task from #5078 to merged #5424 and the extraction PRs. The October evidence-pilot task stays a distinct outcome gate, not a child blocker of the September core.

---

# 15. Immediate execution order

## Days 1–2 (Aug 28–31) — G0

1. Create branch protection on `v3` and `v3-ai` (required core checks, reviews, migration-touch detection).
2. Merge `v3` into `v3-ai`; tag `v3-ai-pre-normalization-2026-08-28`.
3. Confirm the fixed Final-AI-review gate is green on a `v3-ai` push; add it to the required set.
4. Declare the schema freeze (now enforceable); pause is on migrations only, C0 work continues.
5. Classify every open AI PR per §10; fix the ClickUp #5078→#5424 link.
6. Capacity decision: name the non-AI stacks that pause for the window.

## Days 2–4 (Aug 31–Sep 2) — G1

1. Approve the AI platform data contract.
2. Rule D1–D6 (authoring branch, response examples, LTI guest, ledger enforcement, practice model, personal elements).
3. Fix the trimmed G2 scope by the blocking discriminator.
4. Lock the September release scope; update ClickUp and the tracking issue.

## Days 4–9 (Sep 2–9) — G2 + G3 in parallel

1. G2 (schema group): normalize the keep-list (§6); delete the superseded tail; generate the final chain; run all migration proofs including the prod `_prisma_migrations` read and the prod-baseline restore; `prisma:sync` + codegen + dependent rebuilds.
2. G3 (everyone else, C0 on `v3-ai`): land authoring/preview per D1; extract #5174 hardening; extract the #5126 contract package; wire cost caps and kill switches; verify feature defaults.
3. Do **not** re-cut #5481/#5430 in this window — G5 work.

## Days 9–10 (Sep 9–10) — Cut

1. Confirm the named C0 core list has landed (content gate — slip the cut if not).
2. Re-merge `v3` into `v3-ai`; cut `release/v3.5.0-ai` from the normalized commit.
3. Execute the staging cutover runbook (§6a): flip `STG_SOURCE_BRANCH`, pause promote, reset staging (data-loss decision made), apply final chain, re-enable integrations.
4. Enable the automated release→`v3-ai` back-merge.
5. Lift the `v3-ai` migration freeze; open the C2 queue.

## Days 10–13 (Sep 10–15) — G4

1. Fault, load, browser, security and E2E gates on the release branch; verify chat replica count vs in-memory controls.
2. Production migration rehearsal and staging restore/rebuild rehearsal.
3. Absorb `v3` per the qualification rule.
4. Produce the release evidence manifest; open the release PR `release/v3.5.0-ai` → `v3`.
5. Deploy to production dark/default-off if all gates pass (Sep 15); begin Stage 1 activation separately.

The essential mechanism is unchanged: normalize, then cut. Before the cut, persistence is briefly serialized and enforced by real branch protection; after it, release qualification and major feature development proceed independently, with staging atomically retargeted and `v3`'s ongoing alpha cadence absorbed rather than regressed.
