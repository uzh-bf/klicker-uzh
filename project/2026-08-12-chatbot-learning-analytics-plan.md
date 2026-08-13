# Chatbot learning analytics implementation plan

## Goal and boundary

- Problem: Chatbot usage has been investigated through one large committed exporter and several useful temporary Vorkurs scripts. The committed report omits ratings and parent lineage, its default row-level workbook is still personal data, its lexical clusters leave substantial content unclassified, and temporary scripts are not a governed or tested capability.
- Goal: Build a generic, reusable, privacy-by-design learning-analytics capability around the existing TypeScript exporter. Deliver trustworthy descriptive exchange analytics, disclosure-controlled aggregate outputs, and an explicit restricted export path. Prove value with a governed real-data Vorkurs run once authoritative eligibility is available.
- Non-goals for this package: collect consent; create research eligibility; schedule reports; build a dashboard or long-running analytics service; copy LiteLLM or Langfuse provider calls into PostgreSQL; automate misconception, mastery, tutoring-quality, or learning-gain claims; segment learning episodes; publish or commit real course data.
- Ceremony: full path. The package changes personal-data flow, privacy defaults, and restricted-export behavior.
- Authority: Plan approval authorizes local branch/worktree creation, implementation, synthetic verification, and read-only development-database checks. It does not authorize a production data query, restricted real-data export, push, draft PR creation, deployment, publication, merge, or deletion. Each requires its normal later gate; the real-data pilot additionally requires operational eligibility and a named operator authorization.

## Identity and continuity

- Planned artifact: `project/2026-08-12-chatbot-learning-analytics-plan.md`.
- Target: `v3` at `5264353ff77afc598ea69f05f262b25f882ca38c` when drafted.
- Branch/worktree after approval: create the first stack branch with the `rs/` prefix in a repo-local worktree under `trees/chatbot-learning-analytics/`; audit existing worktrees and fetch again before creation. Never implement from the dirty primary checkout.
- Related history: `project/2026-08-07-vorkurs-chatbot-production-adjustments.md`, `project/2026-08-08-vorkurs-chatbot-finalization-plan.md`, and `project/2026-08-09-vorkurs-chatbot-sdk-fix-plan.md` cover production readiness, not this learning-analytics capability.
- Durable decisions: ADR-0005, purpose-bound chatbot learning analytics; ADR-0006, federated chatbot analysis sources.
- Grill outcome: generic learning analytics and product quality now, research later as a separate purpose; prospective purpose-and-course eligibility; exchange-first descriptive measures; exploratory heuristics/clusters only; aggregate by default; audited restricted exports; educational coding capacity-gated; database package first and telemetry later.

## Primitive impact

| Product primitive | Disposition | Contract delta | Consumers | Evidence |
| --- | --- | --- | --- | --- |
| Chat message and feedback | Reuse | Read `parentId`, `rating`, mode, attachment metadata, credits, and permitted content without changing message ownership | Exporter, exchange builder | Prisma chat schema; ADR-0002 |
| Analysis eligibility | Compose | Consume effective-dated, purpose-specific eligibility fail closed; do not own consent collection | Dataset selector, aggregate report, restricted export | ADR-0005; separate consent work is a dependency |
| Aggregate report | Create | No row-level text or stable IDs; suppress cells below five and complementary cells; disclose provenance and unknowns | Product/teaching evaluators | `CONTEXT.md` |
| Restricted export | Create | Authoritative operator adapter, declared purpose, prospective eligibility filter, expiry, verified encrypted destination, immutable audit record, withdrawal-rebuild manifest | Authorized analysts only | ADR-0005 |
| Provider telemetry | Compose later | Join source-owned model/cost/cache/trace facts without a duplicate ledger | Later telemetry package | ADR-0006 |

## Research and existing capability

- Evidence: `packages/prisma-data/src/scripts/2026-06-16_analyze_chatbot_usage.ts` already supplies selection/window CLI flags, pseudonymized XLSX/optional JSONL, usage/credits/model/tool sheets, and deterministic multilingual n-gram clustering. It remains the baseline rather than being replaced.
- Evidence: the exporter currently does not select or emit `ChatMessage.rating` or `parentId`. It always loads message content for internal clustering even when content is omitted from outputs; its privacy modes therefore describe artifacts, not whether content was processed.
- Evidence: temporary local scripts cover bounded usage, question heuristics, image modality, LaTeX auditing, model selection, and LiteLLM/Langfuse aggregation. Only generic, privacy-reviewed logic moves into the package. No temporary output, real message text, raw image, identifier, or credential enters Git.
- Evidence: educational dialogue research supports separate student intent, tutor move, and next-turn dimensions, and treats unsupervised clusters as discovery aids requiring human interpretation. Human coding is deferred because two qualified coders are unavailable.
- Gareth routing: use `learning-analytics-interpretation-guide` to keep reports decision-led and explicit about what data cannot show. Preserve future rubric inputs from `intelligent-tutoring-dialogue-designer`, `adaptive-hint-sequence-designer`, `feedback-quality-analyser`, `ai-feedback-design-principles`, `checking-for-understanding-protocol-designer`, `error-analysis-protocol`, and `gap-analysis-from-student-work`; none produces automated production labels in this package.
- Limitation: the exact eligibility schema/API is not yet implemented. All production-content selection and durable real-data outputs fail closed until that separate owner supplies an effective-dated contract compatible with ADR-0005.

### Script disposition

| Existing capability | Disposition in this package | Reason and proof |
| --- | --- | --- |
| Committed `2026-06-16_analyze_chatbot_usage.ts` | Retain as CLI/report baseline; extract typed pure seams incrementally | Preserve its selectors, operational sheets, deterministic clustering, and backwards compatibility through synthetic golden summaries |
| `vorkurs_usage_report.mjs` and `vorkurs_period_report.mjs` | Generalize response latency, unanswered/linkage, depth, mode, attachment, tool, and credit measures | Port formulas into tested modules; discard course IDs, direct production access, and ad hoc output shapes |
| `vorkurs_question_signals.mjs` and period variant | Generalize only auditable intent/modality heuristic rules as explicitly exploratory | Version every rule; synthetic rule fixtures; no claim that regex labels are validated educational codes |
| `vorkurs_image_stats.mjs` | Fold image-only versus text-plus-image counts into attachment modality | Use attachment metadata and eligible text presence; never serialize image bytes |
| `vorkurs_quality_aggregate.mjs` | Replace with rating coverage, lineage, unanswered, and data-quality measures | Remove its hardcoded “ratings absent” assumption and reconcile against selected eligible records |
| `read_vorkurs_analytics.py` | Use as requirements evidence, then retire | Reimplement useful workbook-derived measures in TypeScript so the report is reproducible from one typed model and adds no Python dependency |
| `vorkurs_latex_audit.mjs` and focus variant | Defer to a separate prompt/rendering quality tool | Content-sensitive regex audit is not a core learning-analytics measure and would widen the first package |
| `vorkurs_model_selection_report.mjs` | Keep selected-model counts only; actual routing is Roadmap B | Selected `auto` is not actual provider model |
| Langfuse/LiteLLM aggregate and route scripts | Roadmap B evidence only | Cross-system fields and costs require a separately reviewed telemetry join |

All temporary scripts remain local evidence. Implementation reads them only to
port generic logic; it never copies real outputs, identifiers, URLs, credentials,
or message examples into source, tests, review prompts, or documentation.

## Source and field contract

| Fact | Authority | Current package behavior |
| --- | --- | --- |
| Message content, lineage, rating, mode, attachments, stored credits | PostgreSQL | Read eligible records; label credits as internal units, never actual cost |
| LA/research eligibility and effective period | Separate consent/eligibility owner in PostgreSQL | Required adapter; unavailable means synthetic-only and no real-data artifact |
| Actual model, spend, cache tokens | LiteLLM | Roadmap only; never infer from selected `auto` or credits |
| Trace, observation, latency, TTFT | Langfuse | Roadmap only; never make baseline reporting depend on trace coverage |
| Educational labels | Human-validated codebook | Capacity-gated roadmap; unavailable in this package |

## Output contract

- Default aggregate run: XLSX plus versioned JSON summary. It contains cohort totals, time distributions at approved granularity, mode/attachment/tool/credit measures, exchange linkage coverage, rating coverage and suppressed UP/DOWN distribution, and exploratory heuristic/cluster size, coverage, and stability. It contains no message text, image description, reasoning, tool result, exchange assignment, stable pseudonym, exact low-frequency slice, or hidden-cell reconstruction path.
- Restricted export: content-bearing XLSX and/or JSONL only after a separate explicit CLI action validates purpose, named operator, eligibility window, expiry, encrypted destination assertion, and audit destination. It may include eligible message text and stored image descriptions; it excludes reasoning, raw image bytes, and raw tool results. It carries field provenance, export manifest, withdrawal/rebuild key, and a machine-readable expiry.
- Existing operational sheets and selection filters stay available where compatible. Breaking sheet/header changes are versioned and documented. Layer 2 removes `--includeMessageContent` or hard-aliases it to the fully gated restricted action with an explicit migration error; no merged command may write content-bearing output outside that gate.
- The export audit records metadata and cryptographic artifact digest, never message content. Layer 2 defines and tests an audit interface with a synthetic append-only sink, but the production restricted-export command remains fail closed until a durable audit owner, authorized operator identity source, encrypted destination verification, and deletion executor are configured and proven.

## Privacy-by-design defaults

| Principle/default | Measure | Evidence required |
| --- | --- | --- |
| Transparency and purpose | Versioned manifest states purpose, population, fields, authority, eligibility period, output tier, exclusions, and limitations | Snapshot/contract test and workbook/JSON inspection |
| Data minimization | Default aggregation never serializes row-level text; restricted selection excludes reasoning, raw images, and raw tool results | Artifact scanner plus explicit allowlist tests |
| Purpose limitation | Purpose-and-course pseudonyms; separate LA/research eligibility; fail closed on missing or stale eligibility | Selector tests including retrospective and cross-purpose rejection |
| Storage limitation | Restricted manifest contains expiry and rebuild/deletion key; real run requires an owned expiry/deletion procedure | Synthetic lifecycle test; operational evidence before pilot |
| Access/confidentiality | Restricted action requires an authoritative operator adapter, verified encrypted destination, and audit record | CLI boundary and synthetic adapter integration test; production providers are an operational dependency |
| Accuracy/accountability | Every metric names source, definition, denominator, unknown count, and report version | Reconciliation tests and provenance sheet |
| Withdrawal | Rebuild excludes withdrawn subjects and regenerates derived outputs; only demonstrably anonymous aggregates survive | Synthetic before/after rebuild test |

## Feature-wide test portfolio

| Risk or behavior | Existing evidence | Obligation | Primary seam | Distinct failure caught | Owner |
| --- | --- | --- | --- | --- | --- |
| Eligibility and withdrawal | No analyzer integration | Add new | Pure effective-dated selector fixtures | Ineligible, withdrawn, pre-opt-in, wrong-purpose, or wrong-course records enter an artifact | Layer 1 |
| Message lineage and ratings | Schema only; exporter omits fields | Add new | Pure exchange-builder fixtures | Timestamp pairing, regeneration ambiguity, outside-window parent errors, or missing rating coverage | Layer 1 |
| Metric terminology/provenance | Workbook notes only | Extend | Report-model and header assertions | Credits become currency, `auto` becomes actual model, or denominators/unknowns disappear | Layer 1 |
| Default disclosure safety | Current pseudonyms and content opt-in, no release tier | Add new | Aggregate table builder plus artifact scanner | Text/stable IDs leak, rare cells reveal people, or complementary totals reconstruct a suppressed value | Layer 2 |
| Restricted export gate/audit | No comparable gate | Add new | CLI contract and audit-sink integration | Portable personal data is written without all purpose/access/expiry/destination fields or digest | Layer 2 |
| Exploratory signal honesty | Deterministic clustering without stability contract | Extend | Synthetic corpus fixtures and report metadata | Cluster examples leak or exploratory results are presented as validated educational measures | Layer 2 |
| Legacy analyzer regression | Manual exports only | Extend | Golden synthetic report summary | Existing course/chatbot/window counts and operational sheets silently drift | Both |
| Real-data usefulness | Temporary ad hoc reports | No code test | Governed Vorkurs reconciliation checklist | The capability passes fixtures but cannot answer real review questions or reconcile with SQL | Milestone gate |

## Stack topology

```yaml
feature: chatbot-learning-analytics
provider: github
base: v3
mode: progressive
layers:
  - id: 01
    name: analysis-core
    work_package: eligibility-gated descriptive analysis model with auditable exchange lineage and metric provenance
    responsibility: pure analysis core and legacy exporter compatibility
    depends_on: v3
    reviewer: data and privacy reviewers
    attention: judgment-heavy
    reviewer_focus:
      - eligibility and withdrawal fail closed
      - exchange/rating semantics and credits versus cost
      - smallest extraction from the legacy script that creates stable test seams
    validation:
      - focused Vitest suite on synthetic fixtures through a record-provider seam
      - package typecheck without `--noCheck` for the extracted analysis modules
      - format and lint on changed paths
      - legacy synthetic golden summary
    activation: inert for real data until an authoritative eligibility adapter is configured
    risk: high
    size_signal: 350-500 human-authored lines across 5-8 files; threshold ruling: one work package because selector, exchange model, and provenance form one independently testable fail-closed core
  - id: 02
    name: governed-reports
    work_package: aggregate-by-default reports and explicit audited restricted export
    responsibility: disclosure controls, artifact contracts, exploratory signals, and operator workflow
    depends_on: 01
    reviewer: learning-analytics and operations reviewers
    attention: judgment-heavy
    reviewer_focus:
      - n<5 and complementary suppression correctness
      - no default personal-data download
      - useful outputs and honest exploratory interpretation
      - restricted export gate, audit metadata, expiry, and deletion/rebuild contract
    validation:
      - focused Vitest suite and workbook/JSON artifact scan
      - package typecheck
      - format and lint on changed paths
      - synthetic end-to-end CLI runs for both output tiers
    activation: aggregate complete on eligible inputs; restricted export inert for real data until eligibility, audit, operator identity, destination verification, and deletion owners are configured
    risk: high
    size_signal: 350-550 human-authored lines across 5-8 files; threshold ruling: one work package because aggregate and restricted paths must be reviewed together to establish the no-general-download invariant
follow_up_stacks:
  - telemetry enrichment joining LiteLLM model/spend/cache facts and Langfuse observations after trace and field reconciliation
  - human-validated educational coding and later classifiers after two qualified coders and governance capacity exist
```

## Layer 1 — trustworthy analysis core

- Route: executor for bounded pure-module/test extraction if the hosted-inference privacy boundary is acceptable; main session owns eligibility seam, privacy architecture, integration, and final verification. No real data enters worker prompts.
- Problem: the monolithic exporter mixes database selection, transformations, clustering, and workbook construction, preventing focused proof of lineage, eligibility, ratings, and metric meaning.
- Do: introduce the smallest adjacent `chatbot-analysis/` modules needed for typed records, a record-provider seam, effective-dated eligibility adapter contract, exchange construction from `parentId`, rating coverage, and metric provenance. Keep participant identifiers confined to this internal analysis-core seam; Layer 2 must apply the ADR-0005 purpose-and-course pseudonym before any artifact or restricted export can consume them. Extend the Prisma projection with `parentId` and `rating`. Preserve existing CLI selectors and operational calculations through a Prisma provider; use an in-memory provider for golden synthetic summaries.
- Do: port only generic calculations from temporary scripts that improve the descriptive core: response linkage/latency and unanswered categories, mode/model selection semantics, attachment modality counts, and question/response length. Keep LaTeX content audit, LiteLLM/Langfuse calls, and Vorkurs-specific regexes out of this layer.
- Do: make missing eligibility a typed fail-closed state. Supply synthetic eligibility fixtures; define but do not fake a production adapter.
- Do: add repository-version-matched `vitest` to `@klicker-uzh/prisma-data`, add a `test` script discoverable by the root test run, and add a focused `tsconfig.analysis-check.json` plus `check:analysis` script so the extracted modules are checked without `--noCheck` while the existing seed-data check remains unchanged. Keep tests beside the behavior; add no new runtime dependency.
- Test obligation: add the selector, exchange/rating, provenance, and legacy-summary portfolio rows at their pure stable seams.
- Check: `pnpm --filter @klicker-uzh/prisma-data test`; `pnpm --filter @klicker-uzh/prisma-data check`; changed-path format/lint; inspect the in-memory provider's synthetic summary.
- Review: substantive and high-risk data-integrity/privacy slice; after the immutable layer tip, run exactly one simplifier and one intermediate reviewer in parallel, then integrate accepted findings and reverify.
- Commit: multiple conventional commits are allowed inside the layer; the layer remains one PR work package. Suggested outcome title: `enhance(prisma-data): make chatbot analysis eligibility-aware`.
- Acceptance: no real record can pass without an effective eligible interval; an in-window assistant excluded by eligibility cannot be rescued by parent closure; exchanges reconcile in all fixture branches; ratings include null coverage; credits and selected model are not mislabeled; raw participant identifiers remain internal to this core and cannot cross the Layer 2 artifact boundary without a purpose-and-course pseudonym; legacy synthetic totals match.

## Layer 2 — governed useful reports

- Route: executor for bounded disclosure-control/report builder and synthetic tests; main session owns restricted-export policy seam, audit interface, integration, and final verification. No real data enters worker prompts.
- Problem: the current workbook is useful for operations but neither a safe aggregate release nor a properly governed content export, and temporary question/image scripts do not produce reproducible review artifacts.
- Do later: wire the typed report model into two commands: default aggregate reporting and explicit restricted export. The current slice supplies the report model and restricted authorization contract; the legacy operational exporter is quarantined and rejects `--includeMessageContent` until that provider-backed command split exists. Produce versioned XLSX and JSON summary from one typed report model. Add field provenance, privacy manifest, linkage/unknowns, ratings, attachment modality, and exploratory signal coverage.
- Do: emit only one-dimensional segmented tables in this package. Suppress values below five and omit that table's margins/totals whenever any value is suppressed, so hidden values cannot be reconstructed through a displayed total. Apply the same group-level suppression to additive summary partitions (message roles, exchange statuses, and rating outcomes) before provider wiring; otherwise sibling summary fields can reconstruct a hidden cell. Apply coarsening or omission to timestamps and rare categories. General multidimensional disclosure control is out of scope.
- Do: isolate and improve generic heuristic/cluster logic from the existing analyzer and temporary question scripts. Keep rule definitions versioned and auditable; add cluster coverage and perturbation/resampling stability. Default outputs show suppressed counts and exploratory warnings only; examples and assignments require the restricted path.
- Do: define typed adapters for authoritative operator identity, effective eligibility, encrypted-destination verification, durable audit, and deletion/rebuild execution. Prove them with explicit synthetic adapters; production providers and their owners are pilot-entry dependencies, and their absence keeps real restricted exports inert. Require declared purpose, expiry, and artifact digest before writing content. Include text and stored image descriptions only; exclude reasoning, raw images, and raw tool results.
- Test obligation: add disclosure, export gate/audit, semantic honesty, and end-to-end synthetic CLI portfolio rows.
- Check: focused synthetic Vitest; synthetic aggregate and restricted model runs; open workbook and JSON programmatically; artifact scanner; package typecheck; changed-path format/lint. CLI end-to-end runs remain a follow-up to provider wiring.
- Review: substantive and high-risk privacy/output slice; run simplifier and intermediate reviewer in parallel on the immutable layer tip, then integrate accepted findings and reverify.
- Commit: multiple conventional commits are allowed inside the layer. Suggested outcome title: `enhance(prisma-data): add governed chatbot reports`.
- Acceptance for this slice: the report model contains no row-level personal data by default and enforces cross-table disclosure controls; restricted artifacts cannot be authorized without the full gate, authoritative operator identity, durable audit record, verified destination, matching eligibility period, and deletion owner; useful question/response signals remain clearly exploratory. Provider-backed CLI wiring is a subsequent slice.

## Milestone proof and real-data pilot

- Synthetic gate: both layer tips pass independently on fresh `v3`, with no secrets or personal data in Git, review prompts, fixtures, screenshots, logs, or reports.
- Delivery trade-off: the two implementation layers may merge while all production adapters remain inert. They establish safe, tested capability but do not demonstrate real-data value until the separate eligibility, audit, identity, destination, deletion, access, and operator gates are satisfied.
- Eligibility entry gate: the separate owner has implemented and documented effective-dated LA/research eligibility fields, withdrawal semantics, and operator access. This package integrates the real adapter through a separately reviewed extension to Layer 1 or records and re-approves a topology change before proceeding.
- Operational gate: a named controller/operator approves one bounded Vorkurs LA run, its purpose, eligible population, destination, expiry/deletion procedure, and access list. A durable audit sink, authoritative operator identity, encrypted-destination verification, and deletion/rebuild executor must be operational. Production connectivity and query authority are requested explicitly at that time.
- Real-data proof: generate the aggregate report plus one restricted review export in the approved destination; reconcile participant, conversation, message, exchange, rating, attachment, mode, tool, and credit totals against independent read-only SQL; record exclusions and unmatched lineage. Never add either artifact to Git.
- Review outcome: use the real aggregate report and restricted examples to identify report blind spots and propose the next improvements. Record improvements that complete this package in its plan; route genuinely new semantic labels, dashboarding, or interventions to later work.

## Roadmap B — telemetry enrichment

- Entry: LiteLLM and Langfuse tenant/configuration are operational; a metadata-only probe identifies trace, observation, auxiliary-call, actual model, cost, cache-token, token, latency, and TTFT fields; closed-window spend reconciles with the gateway authority.
- Do later: derive deterministic correlation from assistant response IDs where present; record one-to-zero/one/many joins and auxiliary calls separately; report coverage before cost/cache ratios; never infer actual model from `auto`; keep raw telemetry in its source.
- Check later: fixed trace vectors, closed-window cost reconciliation, missing/duplicate observation cases, trace-tenant isolation, and cache denominator definitions.
- Gate: separate execution plan and planning review because it crosses external observability and cost-accounting seams.

## Roadmap C — validated educational coding

- Capacity gate: two qualified coders and an instructor owner are available. Until then, heuristics and clusters remain exploratory.
- Pilot later: calibrate approximately 50 stratified exchanges, refine a multi-axis codebook, then double-code at least 200 stratified exchanges. Report per-label support, agreement, confusion, and adjudication; low-agreement labels stay human-only.
- Initial axes later: mathematical topic, student intent/presented work/modality; tutor elicitation, pump/prompt/hint/explanation/correction, answer escalation, feedback specificity/actionability, checking for understanding; next-turn continuation/clarification/correction/apparent resolution.
- Guardrails: no confirmed misconception, mastery, affect, or learning-gain claim from chat text alone. Any classifier uses participant/conversation/time-disjoint evaluation, abstention, drift/stability checks, and separate governance/provider approval.

## Documentation and execution records

- Commit the already resolved `CONTEXT.md`, ADR-0005, ADR-0006, and ADR index update separately from the later plan commit. Preserve unrelated dirty files.
- Update `docs/chat-platform.md` in the implementation stack with report ownership, eligibility boundary, outputs, operational runbook, and roadmap links. Do not duplicate ADR rationale.
- Store every planning, slice, simplifier, and final review report under `project/_local/reviews/`; keep the expensive-gate register there. These are local and ignored.
- The plan's `Progress` records layer, evidence, review paths, test delta, and next action. The plan stays with implementation and never ships alone.

## Planning-stage review

- Specialist: read-only Claude Fable 5 planner at xhigh through the documented correction route after the native Codex planner model was unavailable.
- Reviewed identity: `draft:cdf5316cd1387921ac979bc59f7e0f74cea61278f6005f504035c37640df4321`.
- Verdict: `READY_WITH_CHANGES`; report at `project/_local/reviews/2026-08-12-chatbot-learning-analytics-planning-stage.md`.
- Accepted changes: close the legacy `--includeMessageContent` bypass in Layer 2; add repository-version-matched Vitest and strict typecheck coverage; make operator identity and other production providers explicit inert adapters; bound suppression to one-dimensional tables with totals omitted when suppression occurs; add an in-memory record-provider seam for synthetic golden summaries; state that real-data value remains behind separate operational gates.
- Parent verification: the parent rechecked the draft hash, Git target, current package scripts, temporary-script inventory, and accepted corrections. The review route's initial launch and handshake blocker are recorded in the local gate register and were not counted as content reviews.

## Review and finish gates

- Planning-stage: one read-only planner challenges this frozen draft before the plan file is created.
- Each layer: fresh verification, immutable commit/range, simplifier plus intermediate reviewer in parallel because both layers are substantive and change data-integrity/privacy seams.
- Integrated final: one capable reviewer covers correctness, plan compliance, maintainability, security, and architecture after both layers integrate and fresh checks pass; one correction attempt maximum for this package.
- Pre-open: compute substantive lines excluding generated/plan docs; prove every layer independently functional, reviewable, green, and safe; keep both PRs draft until Gate 3 user approval. Layer 1 is safe because real-data input fails closed; Layer 2 is safe because aggregate input still requires eligibility and every real restricted-export adapter remains inert. Push and draft PR creation need explicit authorization.
- Real-data pilot, publication, deployment, merge, stack reorder/unstack, and branch/worktree deletion each remain separate explicit gates.

## Pragmatic correction plan — 2026-08-13

This section controls where it conflicts with the original Layer 1 and Layer 2
instructions above. The user-requested agy review found that the privacy
primitives are useful, but that unused provenance and a complete inert
restricted-export object graph make the current package larger than its usable
outcome. The correction retains the eligibility, exchange, disclosure, and
aggregate-artifact contracts and makes the aggregate path executable.

### Primitive impact

| Product primitive | Disposition | Correction delta | Evidence |
| --- | --- | --- | --- |
| Analysis eligibility | Reuse | No semantic change; missing or mismatched purpose/course/effective-window eligibility remains fail closed | ADR-0005; core tests |
| Exchange | Reuse | Preserve linked, ambiguous, absent, and outside-window states and the eligibility-sensitive fallback scan | `core.ts`; pragmatic review P3 disposition |
| Aggregate report | Extend | Retain disclosure-safe JSON/XLSX model and add one bounded executable command/provider seam | Pragmatic review P2 |
| Restricted export | Retire from this package | Remove the unconsumed implementation; ADR-0005 remains the policy boundary for a future provider-backed package | Pragmatic review P1; ADR-0005 |
| Artifact provenance | Compose | Keep provenance only in the report artifact; remove the unused duplicate core model | Pragmatic review P4 |

### Data-protection defaults preserved

- Amount: the aggregate artifact still contains no message text, stable
  identifiers, participant pseudonyms, reasoning, image bytes, or tool results.
- Processing extent: the only executable path uses purpose/course/effective
  eligibility and fails closed while no authoritative provider exists.
- Storage: the aggregate command writes only the versioned disclosure-controlled
  JSON and XLSX selected by the operator; no durable row-level dataset is added.
- Accessibility: removing the inert restricted-export subsystem leaves no
  content-bearing download path. The legacy `--includeMessageContent` flag
  continues to reject the request.
- Disclosure: minimum-cell, complementary, cross-table, and additive-partition
  suppression remain unchanged and covered by the existing report tests.

### W1 — simplify the lower analysis-core pull request

- Branch: `rs/chatbot-analysis-core`; pull request
  [#5390](https://github.com/uzh-bf/klicker-uzh/pull/5390); target `v3`.
- Do: remove only `MetricProvenance`, `createMetricProvenance`,
  `AnalysisCoreResult.provenance`, and the `runAnalysisCore` provenance
  construction.
- Preserve: all eligibility, withdrawal, bounded lineage, exchange-state,
  rating, provider, ordering, and test behavior. Do not remove the fallback
  scan or export the private comparator.
- Check: retain 8/8 core tests; strict `check:analysis`; changed-path Biome and
  Prettier; `git diff --check`; exact removal-only diff audit.
- Review: W1-specific planning-stage, simplifier, data-integrity slice review,
  and integrated final review on immutable local ranges.
- Finish: verified local commits only. Push, pull-request updates, upper-branch
  propagation, merge, deployment, production access, real-data access, and W2
  remain withheld.

### W2 — right-size reports and deliver the aggregate execution path

- Dependency: begin only after W1 is accepted. Propagate the corrected lower
  branch through the existing stack checkpoint procedure before editing the
  upper branch.
- Branch: `rs/chatbot-governed-reports`; pull request
  [#5389](https://github.com/uzh-bf/klicker-uzh/pull/5389); base
  `rs/chatbot-analysis-core`.
- Remove: the unconsumed restricted-export eligibility/request/dependency,
  row, manifest, audit-event, hashing, authorization, and artifact contracts,
  plus their two synthetic tests and unused crypto imports.
- Preserve fail-closed content behavior: retain the legacy flag rejection and
  reword its message to state that no content-bearing export exists and that a
  governed restricted export is future work under ADR-0005.
- Clarify signals: accept required numeric counts through a raw exploratory
  signal input type; construct nullable disclosure output internally; remove
  the defensive `?? 0` conversions.
- Simplify report flow: name the linked assistant records `selectedModels`
  directly. Do not export the core comparator merely to deduplicate four lines.
- Execute the useful outcome: add one small aggregate command with an injected
  record-provider seam. The production-shaped provider remains compile-checked
  and returns no eligibility until an authoritative source exists, so a real
  invocation fails closed rather than analyzing records. The end-to-end test
  uses an in-memory synthetic provider and proves JSON and XLSX output without
  database or production access.
- Update `docs/chat-platform.md`, this plan, and pull-request-facing wording so
  restricted export is future work and the bounded aggregate command is the
  delivered outcome. ADR-0005 and ADR-0006 remain unchanged.
- Test delta: remove 2 restricted-export tests; retain the aggregate/disclosure
  suite; adjust the report fixture for W1 and the raw-signal input; add one
  fail-closed provider test and one synthetic command-level artifact test. The
  command test may replace the current lower-level artifact-writer test when it
  protects the same failure class more directly.
- Check: full prisma-data Vitest; strict `check:analysis`; changed-path format;
  `git diff --check`; no surviving `RestrictedExport` implementation symbol;
  synthetic JSON/XLSX contain no text or stable identifier; legacy content flag
  still throws.
- Review: one simplifier and one privacy/data-integrity slice review on the
  immutable W2 range, then one integrated final reviewer across the corrected
  two-layer stack. The user-requested `CHANGES_REQUESTED` review re-arms these
  correction reviews; it does not authorize publication.
- Commits: one removal/simplification commit, one aggregate execution-path
  commit, and one documentation/Progress commit when needed for reviewable
  history.
- Finish: verified local commits. Push/force-push, pull-request updates, ready
  transitions, merge, production or real-data runs, publication, and cleanup
  remain separate explicit gates.

### Correction test portfolio

| Risk or behavior | Obligation | Stable seam | Owning work item |
| --- | --- | --- | --- |
| Eligibility or lineage changes during simplification | Retain existing 8 tests and exact-diff audit | `core.test.ts` | W1 |
| Aggregate suppression weakens while reports shrink | Retain current disclosure/cascade tests | `reports.test.ts` | W2 |
| Legacy content export becomes reachable | Retain explicit rejection test | legacy flag boundary | W2 |
| New command processes data without eligibility | Add fail-closed provider test | record-provider seam | W2 |
| Aggregate command is only theoretical | Add synthetic provider-to-JSON/XLSX test and artifact scan | command run function | W2 |

### Correction planning review

- The configured native planner route was unavailable in this runtime. The
  trusted read-only Claude Fable 5 planner completed the correction challenge
  as session `1d6284d3-bafe-42ee-9f56-8f0ee7464398` with verdict `DONE`.
- Accepted: two sequential work items matching the existing stack; W1 is a
  behavior-preserving deletion; W2 removes the speculative restricted path and
  delivers one aggregate command; ADR-0005 remains valid; tests use injected
  synthetic providers and no live database.
- No material decision blocks W1 or the planned W2. The exact W2 provider query
  projection remains an implementation detail as long as authoritative
  eligibility stays fail closed and no production or real-data run occurs.

## Progress

- Status: W2 implementation is complete locally and awaits the required
  simplification, privacy/data-integrity, and integrated-final reviews.
- W1 result: visible delegated task
  `019ffcc6-c396-7b23-882e-1836e7cff349` completed range
  `7e9d8e06c6e8fe5f7e0db17735a4364a873d110b..550a266d2f497cfb8cf1c15b22b9a998d9b24bea`
  on `rs/chatbot-analysis-core`. The implementation deletes 34 lines from
  `core.ts`; no tests changed. The coordinator independently reran Node 24
  Vitest (8/8), strict `check:analysis`, Biome, Prettier, `git diff --check`,
  and exact test-count/diff checks. Planning, simplifier, slice-review, and
  integrated-final reports are under `project/_local/reviews/` with the
  `2026-08-13-pr-5390-analysis-core-pragmatic-simplification` prefix.
- W1 delivery: verified local commits only. The remote pull-request branch is
  unchanged, and remote `v3` has advanced by unrelated commits without touching
  the W1 paths. No rebase was authorized or performed.
- Evidence: base `v3` was fetched/read-only and matched `5264353ff77afc598ea69f05f262b25f882ca38c`; the repo-local worktree was created; domain/ADR docs committed as `c2c3920bf`; this plan committed as `5fd5b13a8`; no production query or real-data artifact occurred.
- Active slice: analysis-core implementation complete; the main session owns the eligibility/provider and lineage seams because they are data-integrity boundaries. Executor delegation was attempted but the configured native executor model is unavailable in this runtime, so the bounded test-wiring work remained in the main session.
- Test delta: added seven focused synthetic tests at the provider/eligibility/exchange/rating seam; no tests removed. The correction adds coverage for participants with no decision and for an in-window reply excluded by an expired eligibility interval. Added strict `check:analysis` coverage without widening the existing seed-data check.
- Verification: focused Vitest run passed 6/6; strict `tsconfig.analysis-check.json` passed; Prettier check and `git diff --check` passed. Full package installation remains environment-blocked by the new worktree's incomplete pnpm hoist under Node 26, so the existing package seed-data check is not claimed as green from this checkout.
- Review gate: the user-requested Claude fallback ran the Layer 1 slice review and returned `DONE_WITH_CONCERNS`; its report identifies an eligibility parent-closure leak, a missing no-decision fixture, and an unresolved Layer 1 pseudonymization commitment. The fallback simplifier reached terminal `NEEDS_CONTEXT` because its tool-minimized contract requires exact hunks and call-site evidence, while the first fallback prompt supplied only a prose manifest. Reports and register entries are recorded at `project/_local/reviews/2026-08-12-chatbot-learning-analytics-layer1-slice-review-fallback.md`, `project/_local/reviews/2026-08-12-chatbot-learning-analytics-layer1-simplifier-fallback-needs-context.md`, and `project/_local/reviews/chatbot-learning-analytics-gate-register.md`.
- Layer 1 correction complete: the parent-closure filter now admits only out-of-window assistant records for lineage classification; in-window assistants excluded by purpose, course, withdrawal, or effective interval remain excluded. The synthetic suite covers a participant with no eligibility decision and an in-window reply excluded by an expired eligibility interval. The Layer 1 pseudonymization finding is resolved as a scope boundary: the core may hold raw IDs internally, while Layer 2 owns the purpose-and-course pseudonym before any artifact path.
- Layer 1 review: Claude fallback slice review returned `DONE_WITH_CONCERNS`; the eligibility finding was fixed in `0093c85b0`, and the follow-up invariant comment/progress wording are applied below. Claude fallback simplifier returned `DONE` with no net simplification. Reports: `project/_local/reviews/2026-08-12-chatbot-learning-analytics-layer1-slice-review-fallback-correction.md` and `project/_local/reviews/2026-08-12-chatbot-learning-analytics-layer1-simplifier-fallback-correction.md`.
- Layer 2 outcome: the aggregate JSON/XLSX model remains, while the unused
  restricted-export object graph and its two tests are removed. No
  content-bearing export path exists; ADR-0005 remains the policy boundary for
  future work. Exploratory signal inputs now require numeric counts and become
  nullable only inside disclosure processing.
- Layer 2 correction: selected-model suppression now cascades through the linked-response/user-population summary and provenance fields, closing reconstruction through exchange partitions and duplicate unknown-count metadata. The correction also suppresses same-population attachment totals, aligns chat-mode provenance to user messages, expands the regression fixture, and rejects the legacy raw-content flag. Credits suppression is participant-based rather than message-based. The fallback slice review confirmed the original disclosure fix and identified these additional pre-existing gaps; they are addressed in the current correction.
- W2 execution path: `runAggregateReport` composes the existing core, aggregate
  model, and artifact writer. The bounded Prisma provider selects one course and
  window plus direct out-of-window assistant replies, omits message content,
  and returns no eligibility decisions until an authoritative effective-dated
  source exists. The standalone command therefore writes only a fully
  suppressed database-backed report. An injected synthetic provider proves the
  JSON/XLSX path and scans both artifacts for content and stable identifiers.
- W2 verification before review: 20 focused synthetic tests pass (8 core, 11
  report, 1 fail-closed provider), strict `check:analysis` passes, changed-path
  Biome and Prettier pass, `git diff --check` passes, and no `RestrictedExport`
  implementation symbol remains. Both implementation commits also passed the
  repository pre-commit `check:all` hook under host Node 26. Repository-pinned
  Node 24 verification remains pending because `devrouter ensure` and
  `devrouter exec` fail with `could not determine process identity for workspace
  lifecycle lock` in this session.
- Integrated-final correction disposition: the fallback review confirmed the high-risk withdrawal, cross-table, provider-field, manifest, and legacy-content findings were closed. Its remaining summary-partition concern is closed in this correction by suppressing additive message-role, exchange-status, and rating-outcome partitions before any sibling values can be disclosed. Main-session verification is the closing check because the configured integrated-final review budget is exhausted.
- Next: run the W2 simplifier and privacy/data-integrity slice review on the
  immutable local range, apply any accepted correction once, then run the
  integrated-final review across both corrected layers. No push, pull-request
  update, production query, or real-data artifact is authorized in this
  session.
