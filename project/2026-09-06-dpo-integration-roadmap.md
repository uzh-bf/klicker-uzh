# DPO integration roadmap

## Current direction — 26 October 2026

The notice, account-choice and profile foundation has been delivered. Six follow-up implementations remain open drafts. The user agreed that KB confirmations must fit the pending lecturer UX improvements; those improvements are not merged. This update records coordination and acceptance, not a new merge, release or stack-topology authorization.

The [completion plan](./2026-09-19-dpo-first-release-completion-plan.md) owns current source pins and detailed acceptance. Existing documentation vehicle: draft [#6227](https://github.com/uzh-bf/klicker-uzh/pull/6227), target `v3`. ClickUp remains the product tracker. Real-environment findings are kept privately; repository artifacts contain public source/check evidence, reviewed synthetic evidence and generic acceptance requirements only.

## Delivery order and ownership

| Order                       | Owner / package                                          | Completion boundary                                                                                                                                                                                                   |
| --------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parallel acceptance         | DPO/release owner, R0                                    | Authorized hosted account journeys, processing containment and purpose/provenance reconciliation; private evidence for real environments.                                                                             |
| Next user-facing milestone  | DPO task, R1 / #6249                                     | Registered and persisted-guest notices/settings, independent choices and reviewed browser captures are locally verified. Latest hosted checks and review coverage remain open. Does not depend on the lecturer stack. |
| Coordinated KB milestone    | DPO task, R2 / #6282, with existing lecturer-setup owner | Confirmation before batch transfer, per-file provenance, URL/replacement enforcement, preserved automatic ingestion and combined synthetic retrieval proof.                                                           |
| Independent bounded drafts  | DPO task, R3–R5 / #6253, #6257, #6258, #6267             | Downloads/receipts, private-point scoring, withdrawal completion and eligibility fencing; no automatic LA activation.                                                                                                 |
| Separate release/activation | Release owner after named authority                      | Qualify the actual selected staging candidate, verify synthetic journeys, then prepare production. Optional activation and cleanup retain their own conditions.                                                       |

## Lecturer KB/setup alignment

All fourteen reviewed setup layers remain OPEN as of October 26:

`#6254 → #6255 → #6259 → #6260 → #6261 → #6290 → #6298 → #6300 → #6301 → #6302 → #6362 → #6366 → #6367 → #6625`.

This stack owns simplified chatbot management, automatic ingestion, multiple-file upload, KB subject/language settings, chatbot materials and readiness, graph/question preparation, and consolidated setup. Narrower ingestion failure explanations (#6381), separation of ingestion and graph workflows (#6460), and graph presentation improvements have merged. Implementation on the stack is not merged or deployed behavior.

The DPO draft's single-file form and `ADDED` resource state are not the final UI/lifecycle. Preserve batch progress, partial-failure retry and automatic `QUEUED` ingestion with its run/dispatch record. Collect both unchecked confirmations before a batch requests tickets or uploads; retain evidence for every file, and apply the same server contract to URL creation and replacement. Verify omitted/stale evidence, cancellation and concurrent replacement against the combined candidate. The [R2 contract](./2026-09-19-dpo-first-release-completion-plan.md#r2--kb-confirmations-coordinated-with-lecturer-setup) owns detailed obligations and exclusions.

Retain the existing PR owners and topology while reconciling shared source. Choose landing mechanics from refreshed native stack metadata before integration. Separate green checks do not prove the combined boundary. Changed-audience use-time renewal and bulk reprocessing remain outside this transfer milestone.

## Other in-flight boundaries

- Chat's code/practice workspace, onboarding and guest-conversation work overlap the notice entry points. Preserve identity resolution and account/bot disclaimer composition. The merged browser-local document-sharing reminder supplements the account notice; reconcile extracted text, visual summaries and provider transmission with the approved policy wording.
- The older chatbot evaluation exporter #5302 lacks research-choice filtering; it must not become a parallel research release path. Assessment exports remain operational and independent of optional-purpose refusal.
- The older LA dashboard #5629 still contains individual student rows. Remove that output before delivering the agreed group-only lecturer reports. LA activation still requires course controls, writer fencing, protected reads and derivative reconciliation.
- Private-point retention must integrate with gamification and response-scoring work while retaining every group member in the denominator. Student docs #6428 retain their existing owner and describe actual feature availability.

## Binding decisions

- Research and LA are independent. Research displays allowed initially; LA requires explicit choice. Defaults without choice metadata are incomplete. Both refusals permit ordinary/assessment use after mandatory acknowledgement. Renewal preserves existing choices.
- Normal and assessment accounts are intentionally separate. Assessment notices retain normal data categories plus identity, detailed answers/results, audit logs, authorized access and self-deletion restrictions. Add no account linking or auth redesign.
- Persisted chat guests receive a simplified policy notice and both choices. Preserve persona scope and current identity resolution; do not treat them as unpersisted anonymous live-quiz participants. Account policy and bot disclaimer remain independent.
- ADMINs may download attested research data without a human approval workflow. Free text/transcripts are permitted in principle; the precise media envelope still needs a ruling. Research and assessment exports have different purposes and eligibility.
- Gamification group averages include all members. `Participation.isActive` controls leaderboard publication, not enrollment, security or LA consent. Ordinary author/bibliographic credits are allowed in KB material.

German source wording comes from the supplied DPO documents with tracked changes accepted. The prior source comparison confirmed substantive signup/assessment notice paragraphs and the policy, apart from the recorded grammatical correction `verwendete` → `verwendet`. Retain equivalent English meaning and clear current-availability wording. No copied private source document belongs in public Git.

## Preserved work and migration reconciliation

| Existing vehicle                                                                                                                                                               | Disposition                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [#5970 — notice foundation](https://github.com/uzh-bf/klicker-uzh/pull/5970)                                                                                                   | Merged and deployed; canonical source for participant acceptance and the four foundation migrations.                                                                                               |
| [#5819 — broad core DPO draft](https://github.com/uzh-bf/klicker-uzh/pull/5819), head `c33710988f`                                                                             | Preserve exports, retained points and withdrawal implementation as reference. Port bounded missing deltas; do not bulk-merge old consent schema.                                                   |
| [#5825 — broad AI DPO draft](https://github.com/uzh-bf/klicker-uzh/pull/5825), head `28c1749f03`                                                                               | Preserve KB bindings, old chat adapters and nine-family provenance. Reconcile current auth/KB/history, empty-scope retirement and deployed schema before reuse.                                    |
| [#5797 — prototype/reference package](https://github.com/uzh-bf/klicker-uzh/pull/5797) and [#5923 — earlier onboarding draft](https://github.com/uzh-bf/klicker-uzh/pull/5923) | Historical reference; neither is an additional prerequisite to recreate shipped onboarding. Harvest any uncovered acceptance case before proposing closure.                                        |
| Earlier consent/LA stack: #5569, #5590, #5595, #5413, #5611, #5629                                                                                                             | Consent foundation overlaps shipped work; LA contracts/coordinator/reports need explicit per-operation mapping. Do not merge old migrations blindly. Retargeting/closure needs separate authority. |

Applied migration identities are immutable. Generate only genuinely missing deltas, verify schema equivalence and upgrade from alpha.81, and retain intentional custom audit SQL/concurrent indexes. Keep account-deletion cascade semantics. Application rollback keeps choices and audit rows but must also preserve effective processing containment; an older image alone is not a consent-safe rollback guarantee.

## Integration and release route

Read current upstream repository instructions and `STG_SOURCE_BRANCH` before preparing a candidate. On October 26, upstream uses maintained sync PRs from `v3` to `v3-ai`, then to sibling `v3-audit` and `v3-adaptive-learning` destinations; the selector chooses `v3-adaptive-learning`. Earlier audit-only/direct-push instructions require reconciliation before execution. This update changes no routing configuration or authority. Preserve merge ancestry with normal merge commits and qualify the selected staging source before production promotion.

Each release needs current source checks/review, named merge authority, staging candidate qualification and synthetic acceptance, then separately authorized production delivery and verification. Use repository release scripts and preserve saved choices/audit data during rollback. Optional processing activation, retained-data cleanup and extended export/use-time contracts remain separately bounded.

## Progress and continuation

Source and PR review completed October 26. The completion plan records the published follow-up heads; chat's old provider-review failure is superseded by its October 12 passing result. R1 publishes its current-target integration at `affe17b8d375`; the other five candidates retain staged, uncommitted integrations; the KB import conflict is resolved locally. Chat cancellation/embedded settings, withdrawal regression coverage, a research-download case and a local combined KB candidate are prepared. The approved removal of one empty test network restored R1 verification. All 12 guest/LTI browser journeys pass, and 34 reviewed notice/settings captures are published in the chat draft. Canonical persistence, chat unit and monorepo checks pass locally. R1 commit hooks and the full 27-task build passed; fresh hosted CI and ordinary review are running. The chat runtime is stopped with its routes removed. Withdrawal/export startup remains blocked by address-pool exhaustion; a new exact-network recovery request is pending. The export candidate now includes real-endpoint research and both-scope assessment download cases, still unexecuted. Other package acceptance remains outstanding; these results do not establish deployment.

Next: settle chat exact-head checks independently; verify KB confirmations with the pending lecturer workflow; continue independent foundation, export, withdrawal and scoring proof. The [active execution checkpoint](./2026-09-19-dpo-first-release-completion-plan.md#active-execution-checkpoint) records exact source and verification limits. Historical #5819/#5825 and the earlier consent stack remain references, not instructions to recreate shipped work. Documentation updates stay in [#6227](https://github.com/uzh-bf/klicker-uzh/pull/6227); source checks and hook requirements remain in force.
