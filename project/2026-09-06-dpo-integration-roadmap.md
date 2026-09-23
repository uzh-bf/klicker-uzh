# DPO integration roadmap

## Current outcome — 21 September 2026

The first core DPO layer is **in production**: account-creation and assessment notices, existing-PWA completion, saved research/LA choices, profile controls, and the updated public policy/LA explanations. The full DPO programme is incomplete. Persisted chat guests and registered chat users still need account-level completion; KB confirmations, exports, consent-aware analytics and retained-points reconciliation remain later packages.

The [first-release completion and follow-up plan](./2026-09-19-dpo-first-release-completion-plan.md) owns current execution details, acceptance evidence, dependencies and outstanding decisions. This roadmap supersedes the September 6–13 delivery order and “extraction in progress” status. Earlier draft and execution records remain historical evidence in their branches and Git history. Do not restart the shipped foundation from those drafts.

This update fulfils the user's request to verify state and plan the remainder. It does not perform feature implementation, merge targets, change deployments, close old PRs or delete retained data. Task-branch documentation delivery uses the existing draft [#6227](https://github.com/uzh-bf/klicker-uzh/pull/6227). ClickUp remains the product tracker; this reconciliation changes repository plans only.

## Verified state

| Area | Current state | Remaining boundary |
| --- | --- | --- |
| Core notices, choices and settings | [#5970](https://github.com/uzh-bf/klicker-uzh/pull/5970) merged; shared canonical writer, revision/metadata and audit are in `v3` and `v3-ai`; alpha.81 deployed | Hosted authenticated assessment and fresh PRD persistence proof remain open; direct response admission has a confirmed source gap requiring correction and synthetic proof. |
| Website | German/English policy and student LA pages published and all four routes HTTP 200 | Maintain copy/availability alignment as later packages activate. Group-only lecturer explanation is published; no individual-row examples are promised. |
| PRD | All 17 deployments ready on `v3.4.0-alpha.81`; Argo Synced/Healthy/Succeeded at configuration revision `abbf785082`; migration succeeded | Health is not full consent E2E. Image release source is `fd81ae5204`, not the configuration revision. |
| STG | Synced/Healthy at `7ce67a8aa9`; `v3-audit` now `4309b63b89` | Later branch source requires separate exact-candidate promotion and verification. |
| Assessment database | Main/assessment Secret targets compare equal without printing values; migrator uses main backend Secret | Database-target uncertainty closed; authenticated assessment behavior still requires proof. |
| Optional LA processing | Python import and four GraphQL derivative reads disabled in source; withdrawal queue persists true-to-false requests | Live external writers/in-flight work and retained derivatives are unverified; queue has no shipped proven consumer. This is an open post-release acceptance gap. |
| Chat | Current branch has per-chatbot disclaimer and persisted guest persona contracts | Account-policy gate, guest notice, shared choice persistence/settings and bypass proof remain R1. Bot acceptance is not account acknowledgement. |
| KB, exports, retained points | Older reviewed draft implementations exist in #5819/#5825 | Reconcile selectively with current source, migrations, KB lifecycle and scoring; historical tests do not prove current compatibility. |

Observed refs after fetch: `v3=abbf785082`, `v3-ai=171c3e96cb`, `v3-audit=4309b63b89`, `stg-release=7ce67a8aa9`. These are evidence pins, not permanent branch targets.

## Ordered remaining packages

| Package | Outcome / target | Dependency and completion criterion |
| --- | --- | --- |
| R0 — close release acceptance | Assessment/PRD synthetic journeys, direct-response admission correction, values-free live processing and retained-data evidence | Start now. Close each with exact source/runtime proof; confirmed mismatches get scoped remediation. Real-data cleanup and new activation retain named approval. |
| R1 — finish account notices in chat | Registered renewal, simplified persisted-guest onboarding, both choices, guest-accessible settings and server gate; `v3-ai` | Shared contract already available. Verify ordinary/embed/returning guest flows, both refusals, direct bypass, identity preservation and independent bot disclaimer. |
| R2 — KB confirmations | Rights and personal-data confirmations before upload/import/replacement; durable resource/audience binding and renewal; `v3-ai` | Next feature after remaining notices. Use current KB lifecycle; real synthetic ingestion/retrieval and direct-call rejection required. |
| R3 — attested exports | Assessment operational results and purpose-bound research artifacts; core on `v3`, chat adapters on `v3-ai` | ADMIN permissions and audit at release, eligible research cohort and race protection. Non-LA classes independent of R4; media envelope decision gates transcript class only. |
| R4 — LA processing and reports | Course activation, eligible computation, withdrawal/deletion, future eligible aggregates, protected group reports, research provenance | Live reconciliation first. Consumer/writer fencing and empty-scope retirement precede activation; preserve existing minimum-cell/complement suppression and remove old individual-row output. |
| R5 — private points and publication | Retained point accrual, leave/rejoin and deletion consequences, all-member group averages; `v3` | Reconcile current scorer/leaderboard with old draft. Independent of LA activation; no lost-point reconstruction or replayed rank awards. |

R0 evidence and R1 preparation can proceed independently. R3–R5 are later packages, not additions to the already shipped term-start release. Each package has slices, stable seams, failure cases and terminal criteria in the execution plan. Use focused drafts; explicit stack topology and runtime/provider dependencies are settled before publication. Preserve core versus AI target ownership.

## Binding decisions

- Research and LA are independent. Research displays allowed initially; LA requires explicit choice. Defaults without choice metadata are incomplete. Both refusals permit ordinary/assessment use after mandatory acknowledgement. Renewal preserves existing choices.
- Normal and assessment accounts are intentionally separate. Assessment notices retain normal data categories plus identity, detailed answers/results, audit logs, authorized access and self-deletion restrictions. Add no account linking or auth redesign.
- Persisted chat guests receive a simplified policy notice and both choices. Preserve persona scope and current identity resolution; do not treat them as unpersisted anonymous live-quiz participants. Account policy and bot disclaimer remain independent.
- ADMINs may download attested research data without a human approval workflow. Free text/transcripts are permitted in principle; the precise media envelope still needs a ruling. Research and assessment exports have different purposes and eligibility.
- Gamification group averages include all members. `Participation.isActive` controls leaderboard publication, not enrollment, security or LA consent. Ordinary author/bibliographic credits are allowed in KB material.

German source wording comes from the supplied DPO documents with tracked changes accepted. Fresh source comparison confirmed substantive signup/assessment notice paragraphs and the policy, apart from the recorded grammatical correction `verwendete` → `verwendet`. Retain equivalent English meaning and clear current-availability wording. No copied private source document belongs in public Git.

## Preserved work and migration reconciliation

| Existing vehicle | Disposition |
| --- | --- |
| [#5970 — notice foundation](https://github.com/uzh-bf/klicker-uzh/pull/5970) | Merged and deployed; canonical source for participant acceptance and the four applied migrations. |
| [#5819 — broad core DPO draft](https://github.com/uzh-bf/klicker-uzh/pull/5819), head `c33710988f` | Preserve exports, retained points and withdrawal implementation as reference. Port bounded missing deltas; do not bulk-merge old consent schema. |
| [#5825 — broad AI DPO draft](https://github.com/uzh-bf/klicker-uzh/pull/5825), head `28c1749f03` | Preserve KB bindings, old chat adapters and nine-family provenance. Reconcile current auth/KB/history, empty-scope retirement and deployed schema before reuse. |
| [#5797 — prototype/reference package](https://github.com/uzh-bf/klicker-uzh/pull/5797) and [#5923 — earlier onboarding draft](https://github.com/uzh-bf/klicker-uzh/pull/5923) | Historical reference; neither is an additional prerequisite to recreate shipped onboarding. Harvest any uncovered acceptance case before proposing closure. |
| Earlier consent/LA stack: #5569, #5590, #5595, #5413, #5611, #5629 | Consent foundation overlaps shipped work; LA contracts/coordinator/reports need explicit per-operation mapping. Do not merge old migrations blindly. Retargeting/closure needs separate authority. |

Applied migration identities are immutable. Generate only genuinely missing deltas, verify schema equivalence and upgrade from alpha.81, and retain intentional custom audit SQL/concurrent indexes. Keep account-deletion cascade semantics. Application rollback keeps choices and audit rows but must also preserve effective processing containment; an older image alone is not a consent-safe rollback guarantee.

## Integration and release route

Keep `v3 → v3-ai → v3-audit`; every integration hop preserves merge ancestry. A clean `v3 → v3-ai` sync uses normal receiving-branch merge/push. Substantive conflict resolution uses a task branch and checked integration PR. The open [#6220 sync](https://github.com/uzh-bf/klicker-uzh/pull/6220) is conflicting and needs classification; [#6239 AI-to-audit sync](https://github.com/uzh-bf/klicker-uzh/pull/6239) is mergeable at the observed head and must be rechecked after upstream synchronization. Never squash these integration branches or skip a hop.

For each future release: exact-head checks and review → named merge → independent staging promotion → synthetic scenario acceptance at the served revision → named PRD rollout → post-deploy proof. Use repository release scripts and preserve migration data on rollback. Future optional-processing activation stays blocked until R0/R4 evidence closes. The already completed alpha.81 rollout and FTP publication do not silently approve the next rollout.

## Progress and continuation

This reconciliation closes stale “PRD alpha.80”, “policy unpublished” and “assessment database target unknown” statuses. It retains the actual open evidence gaps and all deferred outcomes. Main owns final reconciliation in user-requested solo mode; completed source/planning review findings have been dispositioned in the execution plan. No runtime, application code, consent data, tracker state or deployment changed during this planning update.

Next proposed execution after this planning update: correct R0 response admission, finish the remaining R0 evidence and implement R1 against the current shared contract, then R2. If a hosted actor is unavailable, keep that acceptance row open and continue independent source work. Before resuming #5819/#5825, read this roadmap and the current execution plan; their original execution logs are provenance, not current instructions.
