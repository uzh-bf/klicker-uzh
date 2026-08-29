# v3-ai production-readiness roadmap — v4 (final)

- **Date:** 2026-08-29
- **Status:** authoritative. Supersedes v3 (reviewed in
  [the v3 review](./2026-08-28-v3-ai-production-readiness-roadmap-v3-review.md))
  and v2 ([previous file](./2026-08-28-v3-ai-production-readiness-roadmap.md)).
  Incorporates all eight v3-review corrections and the complete decision-grill
  rulings of 2026-08-29 (decision log, §4.2).
- **Release model ADR:** [ADR-0028](../docs/adr/0028-short-lived-qualified-rc-branch-for-ai-releases.md)
  records the branching, clean-schema, merge-hold, and forward-only-rollback
  decisions. This roadmap references it rather than restating rationale.
- **Release-number correction (2026-08-29):** the first AI batch advances the
  current `3.4.0` alpha line to a `3.4.0` release candidate. The candidate
  branch is `v3.4.0-ai-rc`; release tags use `v3.4.0-rc.N`. Earlier review
  artifacts retain their `3.5.0` wording as historical provenance.

## Executive ruling

The mechanism is unchanged from v3: normalize the `v3-ai` persistence and
runtime boundaries, cut the short-lived release-candidate branch
`v3.4.0-ai-rc`, qualify that exact tree on shared staging, merge it into `v3`,
tag, and deploy dark; larger feature trains continue on `v3-ai` throughout.

What v4 changes, from the grill rulings:

1. **Nothing is parked.** Response examples, knowledge-graph builds, and
   lecturer element generation are all release features. The ship-clean-or-park
   rule stands, but every domain's verdict is Keep or Normalize; the parking
   mechanics remain in reserve, unused.
2. **Student generation joins the release.** The participant-practice package
   (`PersonalElement` schema per ADR-0026, chat generation per ADR-0027,
   PRs #5481–#5483) ships in the RC, flag-gated per chatbot, so students can
   test it in selected chatbots. Its boundary is defined in §3.4.
3. **One neutral AI usage ledger ships in September** (additive dual-write;
   §7.5), covering lecturer and participant usage across base and advanced
   model classes. Product credit balances stay separate; a single
   cross-capability balance is explicitly out of scope.
4. **The generation HITL gates stay.** The design-review and plan-review gates
   and the failure-driven incomplete-publication path are durable product
   states (the lecturer HITL product, ADRs 0019–0022), not workflow mirrors.
   §7.3 is amended accordingly.
5. **LTI guest access is release scope** (OLAT embed only), with one
   exclusion: guests get chat, never generation or personal-element saving.
6. Roles are replaced by the two-person reality; conservative-fallback spikes
   are cancelled (nothing is parked); dates hold with gates-over-calendar.

## 1. Verified repository constraints (refreshed 2026-08-29)

- At execution-custody start, `v3` head was `c942cd246` and `v3-ai` head
  was `bedc6a855`; `v3-ai` was **91 ahead / 13 behind** `v3`. The prerequisite
  sync completed at `edae58628`, and the Final AI review passed on the synced
  line (runs 33211452106 and 33211991290, 2026-08-28). Later `v3` movement is
  expected and remains part of the final cutoff sync in §2.
- PR #5653 then recorded the generated staging promotion for source commit
  `84eebeb48` on `v3-ai`. This is a source and repository desired-state
  receipt only; deployed revision, runtime health, and acceptance remain
  separate evidence gates.
- The RC branch must be Docker-tag-safe and match `v3*`: the staging image
  workflows build only `v3` and `v3*` pushes, and the promoter validates
  `^[A-Za-z0-9_.-]+$`. Hence the candidate branch `v3.4.0-ai-rc`; the
  release artifacts follow the existing `v3.4.0-rc.N` tag convention.
- The promoter is `workflow_run`-triggered — the definition on the default
  branch executes — so the `STG_PROMOTION_PAUSED` guard must land on `v3`
  first. A `workflow_dispatch` with exact `sha` and `dry_run` already exists.
- **The staging flip is two-sided:** `STG_SOURCE_BRANCH` (repository variable)
  *and* the ArgoCD Application `targetRevision` (manifest outside this repo)
  must move together. Per `docs/ci-and-deployment.md`: render the staging
  chart from the branch ArgoCD will track before flipping, and require both
  `Synced` and `Healthy` after; hook-only changes never trigger a sync.
- Promotion PRs carry `[skip ci]`. The promoter waits for the single status
  `Verified generated staging promotion`, requires an immediately mergeable
  PR, rechecks the live pause variable, and merges synchronously without
  leaving auto-merge or a merge-queue entry armed. Under the new ruleset the
  promoter identity (`STG_PROMOTE_TOKEN` user) is a named bypass actor; the
  controlled path is proven with one real promote PR on the RC before
  qualification depends on staging.
- `.github/CODEOWNERS` names a single owner; GitHub forbids self-approval, so
  required approvals stay at 0 and always-reporting checks carry the gate.
- Active rulesets today are tag-only; verify at G0 that the release captain
  can create `v3.4.0*` tags (add a bypass if not).
- Production `_prisma_migrations` remains the authoritative migration
  baseline; `v3.4.0-alpha.73` is only a source snapshot.

## 2. Operating model

Two concurrent tracks: the production-readiness spine (this roadmap) and the
AI feature mainline on `v3-ai`.

```
v3 ────────────────────────────────────────────────────────────┐
                                                               │
v3-ai ── normalization + core ──┬── v3.4.0-ai-rc ── qualify ──┴──> v3
        (incl. participant      │
         practice, §3.4)        ├── semantic-feedback (D10 contract)
                                ├── chat-engine cutover
                                ├── BYOK
                                ├── unified credit balance (product train)
                                ├── element-proposal / lecturer verification
                                └── embeddings / later trains
```

Non-negotiable sequencing (items 1–2 are **done**):

1. ~~Merge current `v3` into `v3-ai`.~~ Done; Final AI review green on `v3-ai`.
2. ~~Prove the trusted-policy fix.~~ Done (runs above).
3. Put the branch ruleset and pause guard in place (§5).
4. Pause staging auto-promotion before migration history changes.
5. Approve the release-schema manifest and canonical contracts (§6).
6. Normalize the complete AI schema envelope that reaches production (§7).
7. Land the named production core (§9).
8. Merge the agreed `v3` cutoff into `v3-ai`; announce the merge hold.
9. Cut `v3.4.0-ai-rc` from the exact normalized commit.
10. Reset and qualify shared staging from the RC (§10).
11. Resume S1/S2 work on `v3-ai` only after staging is isolated on the RC.
12. Back-merge every RC fix into `v3-ai` through the maintained automation PR.
13. After qualification: merge RC into held `v3`, verify path-scoped equality,
    tag, deploy dark, lift the hold.

No rebase or force-push of shared branches; preserve history and authorship.

## 3. Release scope

### 3.1 Production core

| Area | Required for the first production release |
| --- | --- |
| Access | Database-backed lecturer AI entitlement plus GrowthBook rollout, enforced server-side; generation and KG sit under this single entitlement with per-capability activation flags |
| Chatbot lifecycle | Draft creation/editing, versioned disclaimer, publication request, audited approval/rejection/pause (ADR-0020); live on `v3` ahead of the AI release (§9.1) |
| Lecturer workflow | Embedded Manage assistant, assistant-proposal review/confirmation, owner preview |
| Student workflow | Course-scoped chat; authenticated and LTI-guest paths (OLAT embed); clear failure recovery |
| MCP | Internal lecturer and student MCP, short-lived scoped authorization, no external exposure |
| Knowledge bases | KB creation, bounded file/URL resources, ingestion, status, replacement, deletion, canonical chatbot binding (association table, §6) |
| Knowledge graphs | Graph build and publication lifecycle (Keep domain) |
| Element generation | Lecturer generation with design/plan HITL gates and per-item decisions (§7.3) |
| Student generation | Participant practice package per §3.4, flag-gated per chatbot |
| Response examples | Curated examples with review lifecycle (§7.4), exposure flag-gated |
| Retrieval | Scoped doc_query, separate transport and retrieval authorization, cross-KB negative proof |
| Cost safety | Neutral usage ledger (§7.5), per-request limits, per-operation caps, funding limits for every enabled paid capability, emergency switches |
| Operations | Correlated structured logs on AI paths, metrics, traces, alerts, runbooks, cleanup and retention procedures |
| Deployment | Final production migration chain, staging reset, immutable images, rolling compatibility and forward-recovery rehearsal |

### 3.2 Pilot-only or independently activated

Advanced assistant actions and complexity routing remain separately
activatable extras; they must not be prerequisites for ingestion, retrieval,
or chat.

### 3.3 Ship-clean-or-park rule

Unchanged from v3 (and recorded in ADR-0028): every model, enum, constraint,
and migration in the RC tree is an accepted production shape; flags gate
exposure, never schema quality. Verdicts are Keep, Normalize, or Park — this
release resolved every domain to Keep or Normalize, so the parking mechanics
(archive tag, reviewed reverts, release-only-commit marking) stay documented
but unused.

### 3.4 Student generation package boundary

**In September:** generate (plan-first, per ADR-0027), save, "My cards"
practice, participant chat credits (nested model usage costed, ledger events
with participant actor). The per-chatbot enablement flag lives in chatbot
configuration (ADR-0019).

**Out (post-RC trains):** the element-proposal / lecturer-verification flow
(ADR-0026's copy-into-`Element` step) and any pooled-practice interleaving.

**Guests:** LTI guest identities are never offered generation tools and
cannot save personal elements — an ephemeral identity would make saved cards
a false persistence promise, and guest credit accounting is undefined.
Guests keep chat.

Qualification verifies ADR-0026's exclusions: personal elements appear in no
research export and no Learning Analytics.

## 4. Ownership and decisions

### 4.1 Team

Two people own the release end to end; no role matrix. Single-point-of-failure
is accepted knowingly. Two named non-negotiable deliverables: the RC→`v3-ai`
back-merge automation PR (due Sep 10) and ArgoCD access for the staging
`targetRevision` flip, verified as a G0 checklist item (holder named in the
cutover runbook).

### 4.2 Decision log (settled 2026-08-29)

| ID | Decision | Outcome |
| --- | --- | --- |
| D1 | Authoring stack target | Lands on `v3` (v3-based, zero schema files — the §16 no-`v3-ai`-dependency audit confirms this before landing) and goes properly online — chatbot creation precedes the AI release; must merge before the v3-cutoff merge or it waits out the hold |
| D2 | Response-example domain | Keep + Normalize-lite: flatten the 1:1 set wrapper to a direct `chatbotId`, drop the consumerless `digest`; the candidate review lifecycle and evidence references stay (active Test & Teach product) |
| D3 | Generated-element domain | Normalize — key release feature together with KG builds; both HITL gates and the failure-driven incomplete-publication path stay (§7.3) |
| D4 | LTI guest | **Required from the first student cohort**, OLAT embed only; guest generation excluded (§3.4) |
| D5 | Budget enforcement | No paid capability activates without an enforceable cap |
| D6 | Chatbot–KB binding | Many-to-many is the product direction: the `KBChatbot` association table stays with an enforced unique *active* binding for September; the synchronous MCP-config dual-write is removed |
| D7 | Artifact representation | One typed/versioned manifest per build (consolidates the 8 artifact JSON columns); rows only if independent querying/retention emerges |
| D8 | Accounting boundary | One neutral usage ledger for records and attribution (§7.5); `ChatUsageCredits`/`ChatAccountUsage` remain product balances on top; single cross-capability balance out of September |
| D9 | Personal-element ownership | Settled by reference to ADR-0026; no new G1 design |
| D10 | Practice cycle/attempt/evaluation contract | Deferred to a dedicated session **before Sep 10**; excludes personal elements (own spaced-repetition fields per ADR-0026); blocks only the semantic-feedback/practice train resumption, not the RC |
| D11 | `v3` change policy | Short merge hold from RC cut to dark deploy; equality proven by path-scoped diff (§11) |
| D12 | Repository controls | Approvals 0 (single code owner), checks-only gate, promoter as named bypass actor, PR-only `v3-ai`, sync-branch merge mechanics (§5) |
| D13 | Student generation | In the RC per the §3.4 package boundary, flag-gated per chatbot |
| D14 | Incomplete publication | Keep as failure-driven audited lecturer action; rejections never trigger it; statuses fold into the coarse product enum |
| D15 | Staging data at reset | Destroy; no staging updates needed during the freeze |
| D16 | Documentation | This roadmap + ADR-0028 + glossary updates in `CONTEXT.md`; release evidence manifest in gitignored `project/_local/` (public repo); repo-only tracking until the ClickUp connector is re-authenticated |

## 5. Repository controls

### 5.1 One active branch ruleset

Covers `v3`, `v3-ai`, `v3.4.0-ai-rc`:

- Require pull requests; block force-push and deletion; preserve merge
  commits (no linear-history requirement).
- Require the branch to be current before merge. Do not use a merge queue on
  these branches while generated staging promotion is active: an asynchronous
  queue entry would escape the live pause fence.
- **Required approvals: 0.** With a single code owner, any approval
  requirement deadlocks self-authored PRs; always-reporting status checks
  carry the entire gate. Code-owner review is not enabled as decoration.
- Required checks are stable aggregate statuses only (repo check/format/lint,
  GraphQL tests, Playwright, build/container, Gitleaks, CodeQL, Final AI
  review, schema gate when relevant) — never path-filtered jobs that can
  disappear. `Verified generated staging promotion` reports only on promote
  PRs and gates their controlled merge there; it is never a branch-wide
  required check (as one it would deadlock every ordinary PR).
- Bypass actors: the promoter identity only. Prove the controlled promote-PR
  merge with one real promote PR on the RC before staging-dependent
  qualification.
- Direct pushes to `v3-ai` end at G0; every change goes through a PR.

**Merge mechanics under the ruleset:** `v3`→`v3-ai` (and any conflicted sync)
uses a throwaway sync branch — cut `sync/v3-<date>` from `v3`, open
sync-branch → `v3-ai`, resolve conflicts on the sync branch, merge with a
merge commit. Never open a PR with `v3` itself as head. RC→`v3-ai`
back-merges use the same shape via the maintained automation PR.

### 5.2 Schema-change enforcement

Unchanged from v3: orthogonal classification of every AI PR as S0/S1/S2
(schema), E0/E1/E2 (runtime effect), and track (core/pilot/next/incubation).
CI derives a minimum schema class from changed paths and fails
under-classification. Every S2 PR targets `v3-ai`, enters the serialized
schema queue; one S2 foundation merges at a time. Every E2 activation is a
separate PR. Incubation work cannot target the RC.

### 5.3 Staging promotion pause

`STG_PROMOTION_PAUSED=true` checked by the default-branch promoter; the
promoter fails closed while paused. It reads the variable again through the
repository API before every external write and never leaves auto-merge armed.
The guard lands on `v3` first. A pause is effective only after queued and
running promoter jobs are canceled, auto-merge is disabled if armed, every
open promotion PR is closed, and the unchanged staging revision is recorded.
Pause and unpause events are recorded in the release evidence manifest.

## 6. G1 release-schema manifest

Create the manifest as the authoritative inventory of every AI table, enum,
relation, partial index, and migration entering production. Domain verdicts
are settled; the manifest records the full object-level inventory and the
accounting envelope — published with the D8 ledger as primary, updated at
the Sep 6 checkpoint if the fallback ships instead (§7.5).

| Domain | Verdict |
| --- | --- |
| AI entitlement | Keep — narrow entitlement; authorization vs rollout documented |
| Manage assistant proposal audit | Keep — append-only retention, `SetNull` requester relations |
| Response examples | Normalize-lite per D2 |
| KB resources | Normalize — resource identity, immutable revisions, operations, active pointer, quota, deletion (§7.1) |
| Graph builds | Keep/Normalize — build vs publication separation, artifact identity, settlement, retention (§7.2) |
| Element generation | Normalize per D3/§7.3 |
| Participant practice / student generation | Normalize-in per D13 — `PersonalElement` per ADR-0026, generation contract per ADR-0027 |
| Cost/accounting | Neutral ledger per D8/§7.5 |
| Chatbot–KB binding | Normalize per D6 — association table, unique active binding, dual-write removed |

Canonical ownership (amended rows only; the rest as in v3): the per-item
generation row is **`GeneratedElementDraft`** (glossary: "Generated element
draft" — the name `ElementGenerationCandidate` is retired to avoid the
candidate-element collision); async usage reservation/settlement is owned by
the **neutral AI usage ledger** with `ChatUsageCredits`/`ChatAccountUsage` as
product balances; personal elements are owned by **`PersonalElement`**
(ADR-0026), never by lecturer content models.

## 7. G2 normalization stack

Stacked series on current `v3-ai`, merged bottom-up while promotion is
paused, no intermediate migration history reaching shared staging:

- **N1** — lifecycle services and invariant tests (S0/E0)
- **N2** — KB resource revisions, operations, binding and deletion (S2/E1)
- **N3** — graph, generated-element, and response-example normalization
  (S2/E1; includes the §7.4 Normalize-lite)
- **N4** — neutral AI usage ledger, additive dual-write (S2/E1; §7.5)
- **N5** — participant practice + student generation package (S2/E1; §3.4,
  re-cut of #5481–#5483 on current `v3-ai`)
- **N6** — final migration-tail rewrite, schema mirror, codegen and migration
  proofs (S2/E1)

### 7.1 KB resource model

Unchanged from v3: `KBResource` / `KBResourceRevision` /
`KBResourceOperation` with the invariants listed there (immutable revisions,
one non-terminal operation, atomic active-pointer advance, failed replacement
preserves serving content, idempotency and provider-event uniqueness,
SSRF-safe URL handling, deletion hides before external cleanup completes).

### 7.2 Graph model

Unchanged from v3: `KBGraphBuild` / `KBGraphPublication` / D7 artifact
manifest; at most one non-terminal build per KB; publications reference
successful same-KB builds; late results settle usage but never publish;
quality tiers removed if behavior-free; one service boundary for
publication, cleanup, settlement.

### 7.3 Generated-element model (amended)

The v3 prescription of "one lecturer review boundary" is **amended**: the
design-review and plan-review gates are durable product states of the
lecturer HITL product (ADRs 0019–0022 record the surrounding product; the
gate decision itself is recorded here and in the §4.2 decision log — there
is deliberately no separate gate ADR), and the failure-driven
incomplete-publication path stays as an audited lecturer action (D14).

Normalization scope:

- Drop the redundant `stage` mirror column; the coarse product status enum is
  the only durable state. Hatchet phase detail remains workflow progress.
- Fold the incomplete-publication statuses into the coarse enum; document
  that only partial pipeline *failure* reaches them — rejections never do
  (per-item decisions already deliver partial results).
- Consolidate the eight artifact JSON columns into the D7 typed/versioned
  manifest.
- **Gate lifecycle rule:** a build waiting at a review gate pins its source
  graph build (Restrict FK) and holds its cost reservation. Gates expire: a
  build parked longer than the configured window auto-cancels and releases
  its reservation. Both durable waits get worker-restart tests (§13.1).
- Per-item flow unchanged: `GeneratedElementDraft` accept/reject/save;
  saving copies content into an ordinary lecturer-owned `Element` **and
  records AI origin on the element itself**, so build cleanup can never erase
  origin evidence (D-grill Q28).

### 7.4 Response examples (amended)

Normalize-lite per D2: `ResponseExample` gains a direct `chatbotId`; the 1:1
`ResponseExampleSet` wrapper and its consumerless `digest` are dropped. The
review lifecycle (`CANDIDATE → APPROVED / NEEDS_REVIEW / REJECTED`) and
evidence references stay — the candidate flow (Test & Teach capture) is live
product. Immutable evaluation datasets remain future QA-harness snapshots,
not this table.

### 7.5 Usage and cost (amended)

September ships **one neutral AI usage ledger**: every AI operation — chat
turns (with `BASE`/`ADVANCED` class), ingestion, graph builds, generation
builds, student generation — produces a ledger record with one operation
identity and attribution (capability, course, chatbot/activity, model class,
actor lecturer/participant/guest, funding scope), estimate/reservation/
actual/settled state for async jobs, idempotent measured-usage events, and
pricing-version provenance.

Guest chat turns are already capped on `v3-ai` and stay so: anonymous LTI
guests are pinned to the chatbot's fallback (BASE) model, and — with usage
enforcement enabled, as it is in production — account-usage enforcement runs
on every turn keyed on the chatbot owner's account, so guest usage draws from
the lecturer's monthly budget (funding scope: owner account). The §13.1 LTI
matrix proves this empirically. D5 is satisfied for guest chat.

**Shape: additive dual-write.** Chat keeps enforcing balances with its
existing code and additionally emits ledger events; ingestion, graph, and
generation write the ledger natively. `ChatUsageCredits` and
`ChatAccountUsage` remain the allowance/enforcement layer; a single
cross-capability credit balance is a post-RC product train (pricing and
conversion decisions).

**Sep 6 checkpoint:** based on N1–N3 progress, either the ledger lands in the
RC (primary) or the fallback ships — per-domain quota/spend tables with
consistent field semantics, ledger as the first post-RC train. The G1
manifest records which envelope the RC carries. D5 holds in both branches:
every paid capability keeps an enforceable cap.

### 7.6 Deletion and retention

Unchanged from v3: no owner cascades that erase external-cleanup
correlation; user deletion blocks until cleanup completes or an explicit
anonymization/tombstone workflow runs; audit relations use `SetNull`;
retention documented for revisions, artifacts, usage records, chat data,
traces; invariant checks for cleanup backlog and orphaned external state.
Plus the §7.3 gate-expiry rule.

## 8. Migration strategy

Unchanged from v3: two compatibility baselines (destructive relative to
disposable staging, additive relative to production during the PreSync
window); production `_prisma_migrations` read under controlled access fixes
the immutable boundary before any rewrite; the required proofs (fresh DB,
production-baseline snapshot, zero schema drift, codegen/sync/mirror clean,
hand-written constraints validated, current production image smoke-tests
against the migrated DB, rolling old-frontend/new-backend compatibility, old
callbacks harmless). Rollback is forward-only (ADR-0028).

## 9. G3 production-core integration

### 9.1 Independent S0 lane

- Owner preview (#5633) updated to latest `v3-ai`, landed before the cut.
- Authoring/publication stack lands on `v3` per D1 — **the full lifecycle is
  live pre-release**: draft, edit, preview, publication request, and audited
  approval (the two-person team approves). A published chatbot serves the
  existing `v3` chat runtime and gains KB-backed features when the AI release
  activates — the §16 dependency audit confirms exactly this runtime claim.
- Chat-engine contract and conformance runner extracted from #5126, no
  cutover.
- UI, localization, documentation, failure-state improvements; test
  harnesses and deterministic fault fixtures.

### 9.2 Schema-dependent lane

After each G2 layer: KB UI/services on revisions/operations and canonical
binding; graph/generation services on final publication, artifact, and
ledger contracts; cost caps on the final reservation service; cleanup and
account deletion on final semantics; student generation UI on N5.

### 9.3 KB hardening quarry

Unchanged from v3: #5174 is quarried, not a pre-cut requirement — extract
the release blockers (authorization/entitlement, SSRF/source gateway,
size/MIME limits, idempotent dispatch, failed-replacement preservation,
deletion correctness, stable error codes, basic owner UI, correlation and
runbook) against merged #5424; defer scale/advanced UX; close #5174 when
every retained item links to a current-base PR or backlog task.

### 9.4 LTI and embedded access (amended — D4)

Guest access is release scope, **OLAT embed only**. Required before the
student cohort: authenticated participant; LTI guest; expired account and
guest token; cross-course chatbot denial; repeat-launch identity stability;
third-party-cookie/CHIPS behavior; OLAT iframe CSP/origin; no-login
recovery; clear guest capability restrictions (no generation, no saving,
no false history-transfer promise).

### 9.5 Multi-replica controls

Unchanged from v3: rate limits, proposal replay protection, cost
reservations/quotas, idempotency and duplicate settlement are shared-state
before activation, or the pilot runs one Chat replica; the actual replica
count and scaling policy are recorded in the evidence manifest.

## 10. Staging and RC cutover

### 10.1 Before the first G2 merge

Land the pause guard on `v3`; set `STG_PROMOTION_PAUSED=true`; cancel every
queued or running promoter job, disable auto-merge if armed, close every open
promotion PR, and verify that none remains. Record the unchanged staging
revision before declaring the pause effective. Keep that last known-good
deployment running unchanged; use DevPods, tests, and isolated databases for
G2/G3 until the cut. (The `v3`→`v3-ai` merge and trusted-policy proof are
already done.)

### 10.2 Content gate for the cut

Manifest approved; every included domain Keep or Normalize-complete; all
migration proofs pass; named core S0 work merged; schema-dependent
integration complete; current `v3` cutoff merged into `v3-ai`; merge hold
announced.

### 10.3 Cut and reset

1. Cut `v3.4.0-ai-rc` from the exact content-gated commit; extend the
   ruleset to it; enable the back-merge automation.
2. Set `STG_SOURCE_BRANCH=v3.4.0-ai-rc` **and repoint the ArgoCD staging
   Application `targetRevision` to the RC** (access holder named in the
   runbook; render the chart from the RC first and verify every image tag;
   require `Synced` and `Healthy` after; hook-only changes need a manual
   sync). Keep promotion paused.
3. Close all AI dispatch gates; drain/cancel workers and external
   operations.
4. **Destroy staging data** (D15): reset PostgreSQL, staging AI Blob
   prefixes, FalkorDB namespaces, stale workflow/callback state.
5. Apply only the final migration chain and synthetic seeds; verify an old
   signed callback against the reset environment is harmless.
6. Set `STG_PROMOTION_PAUSED=false`; manually dispatch promotion for the
   exact RC SHA; verify every staging image workflow ran for the RC branch
   and every rendered tag uses it. Prove the controlled synchronous
   promote-PR merge path here (first real promote PR under the ruleset).
7. Re-enable integrations in order: ingestion, retrieval, graph canary,
   generation canary, student-generation canary.
8. Only after this proof, reopen S1/S2 merges on `v3-ai`. At RC retirement,
   flip `STG_SOURCE_BRANCH` and `targetRevision` back to the successor
   branch.

## 11. `v3` change policy during qualification (D11)

At the cut: record `V3_CUTOFF_SHA`; begin the merge hold through dark
deploy. Development and review continue in PRs; non-critical merges wait.
P0/P1 production and security fixes merge and are forward-ported to the RC
and `v3-ai` immediately; a material backend/migration/auth/provider/
deployment fix resets the relevant stability clock.

**Equality proof (replaces tree-SHA identity):** after merging the RC into
held `v3`, `git diff <RC> <merged v3> -- apps packages` must be empty, plus
an audited residue list for `deploy/`, `.github/`, and version manifests.
SHA equality is impossible whenever the hold's own escape hatch (or any
release commit) is used; the path-scoped check is the only form that can
pass.

## 12. Qualification and stability clock

Testing shifts left: every normalization or core PR lands with its
invariant, concurrency, and failure tests; G4 is integrated confirmation.

### 12.1 Stability clock

Unchanged from v3: 72 continuous hours on shared staging after the last
material change (schema/migration, P0/P1 correctness/authz/isolation/cost/
cleanup fix, enabled-core backend behavior, provider routing or secret
boundary, manual DB correction reset it; docs, test-only, and non-safety
copy changes do not; provider config-only changes start a 24-hour capability
clock).

### 12.2 Schedule

| Gate | Target | Exit |
| --- | --- | --- |
| G0 controls | Aug 28–31 | Ruleset, pause guard, pre-normalization tag, PR classification (merge + review proof done) |
| G1 decisions + manifest | Aug 31–Sep 2 | Decision log recorded (done — §4.2); manifest published; core list locked |
| G2 + G3 | Sep 2–10 | N1–N6 landed; named core complete; **Sep 6 accounting checkpoint (§7.5)**; D10 session held |
| RC cut + staging reset | Sep 10–11 | `v3.4.0-ai-rc` promoted from clean reset |
| Integrated qualification | Sep 11–15 | Fault/load/security/browser/migration evidence |
| Go/no-go | Sep 15 | Candidate accepted or rejected |
| Earliest dark deploy | Sep 17–18 | 72-hour clock and all gates complete |

Scope grew in the grill (guest matrix, ledger, student generation); the
dates hold as targets and **the gates rule** — if evidence is incomplete,
go/no-go slips to the day the clock completes. Pre-agreed relief valve: if
Sep 2–10 overruns, generation's qualification evidence and staging canary
may complete after go/no-go — its schema ships in the RC, the capability
stays gate-closed in production until its own evidence completes, while
chat/KB/retrieval proceed.

## 13. Release qualification

### 13.1 Pre-release acceptance tests

The v3 list stands (duplicate ingestion/callbacks, failed replacement,
deletion races, worker restart at every durable state boundary — now
explicitly including both HITL gates and the incomplete-publication wait —
provider 429/5xx/timeout/malformed, Redis/Blob/FalkorDB unavailability,
budget exhaustion and duplicate settlement, flag-service failure,
cross-course/cross-KB attempts, prompt-injection fencing, rolling
compatibility, old-app/new-DB), plus:

- The LTI/embed matrix per **D4** (§9.4), including guest restriction
  proofs (no generation tools offered, no personal-element save path, guest
  turns pinned to the fallback model and drawn from the owner-account
  budget).
- Student generation: plan-approval flow, per-card grounding, credit
  settlement, "My cards" practice, per-chatbot flag isolation
  (enabled chatbot vs disabled chatbot negative proof).
- Personal-element exclusions: absent from research exports and Learning
  Analytics (ADR-0026).
- Ledger reconciliation (applies when the ledger ships in the RC per the
  Sep 6 checkpoint): chat balance enforcement unchanged while ledger events
  reconcile against settled operations.

For every scenario verify user-visible behavior, persisted domain state,
external artifact/workflow state, reservation/settlement, and
logs/traces/alertability.

### 13.2 Minimum operational telemetry

Unchanged from v3: structured JSON logs on all new AI paths, one correlation
chain request→workflow→provider→callback→settlement, stable operation IDs in
support views, metrics for queue age/terminal result/callback lag/cost
reservation/cleanup backlog/client-visible failure, dashboards and alerts
for enabled capabilities, named response owner and runbook per
release-blocking alert. Post-activation SLOs are operating targets over a
real cohort window, not staging claims.

### 13.3 Release evidence manifest

Location: **`project/_local/releases/v3.4.0/manifest.md`** (gitignored —
this is a public repository; the manifest carries secret names, image
digests, and infrastructure detail). Contents as in v3: RC and cutoff SHAs,
final tree and tag, migration baseline and checksums, drift results, image
digests, rendered Helm config, secret names by workload (never values),
feature defaults and entitlement rules, staging reset receipt, test
evidence links, dashboards/alerts/runbooks, known limitations, stability
clock start/end, go/no-go approvals, rollback/forward-recovery procedure.

## 14. Rollout

Capability-specific rollout states, unchanged in structure:

- **Stage 0 — dark production:** final migrations applied, all AI execution
  gates closed, workers in readiness mode, no unintended provider calls,
  current non-AI behavior verified.
- **Stage 1 — internal synthetic canary:** authoring, owner preview, one
  synthetic KB, ingestion/retrieval, internal MCP, strict caps; plus graph
  and generation canaries (graph before generation); no real students.
- **Stage 2 — named lecturer cohort:** full create→ingest→attach→preview→
  publish→chat→delete lifecycle; generation with the HITL gates exercised;
  support and cleanup runbook exercised.
- **Stage 3 — named course cohort:** keyboard/screen-reader checks on
  critical chat/embed surfaces, the OLAT guest matrix complete, provider/
  privacy notice approved, cost attribution proven; **student generation
  enabled for selected chatbots here** (its first real-student exposure);
  measure support burden, cost, retrieval quality, failures, deletion,
  opt-out.
- **Stage 4 — wider private beta:** expand only after cohort targets hold.

## 15. Rules for continuing feature development

Every AI PR carries the three labels: Schema S0/S1/S2, Effect E0/E1/E2,
Track core/pilot/next/incubation. Amended examples:

| Work | Classification | Policy |
| --- | --- | --- |
| Owner preview | S0/E0/core | May merge during normalization |
| Response-example normalization | S2/E1/core | In N3 window |
| Participant practice package | S2/E1/core | N5; in the RC per D13 |
| Element-proposal / lecturer verification | S1/E1/next | Post-RC train |
| Unified credit balance | S2/E2/next | Post-RC product train |
| Graph activation in staging | S0/E2/pilot | Separate activation PR |
| BYOK provider routing | S2/E2/next | Source and activation split; post-core |
| Embedding RFC | S0/E0/incubation | Documentation only |

After the RC cut, large S1/S2 work resumes on `v3-ai`; shared staging stays
on `v3.4.0-ai-rc`.

## 16. Current PR disposition (amended)

| PR / stack | Action |
| --- | --- |
| #5633 owner preview | Rebase to current `v3-ai`, provider + citation smoke, land before cut |
| #5593 → #5614 → #5619 authoring | **Land on `v3`** per D1, after the no-`v3-ai`-dependency audit; before the cutoff merge |
| #5174 KB hardening | Quarry only (§9.3), then close as superseded |
| #5424 merged KB/graph | Primary N2/N3 normalization source |
| #5474/#5498 response examples | **Keep**; Normalize-lite in N3 per D2 |
| #5383–#5398 generation | **Normalize** in N3 per D3; gates and incomplete publication stay |
| #5481–#5483 participant practice | **Re-cut on current `v3-ai` and land as N5 before the cut** per D13 (§3.4 boundary) |
| #5430–#5433 semantic grading | Extract pure evaluator/contract work; persistence re-cut post-RC on the D10 contract |
| #5126 chat engine | Extract contract + conformance runner; no cutover |
| #5514 BYOK | Retarget from `v3`, decompose, post-core |
| #5062 embeddings | RFC/incubation |
| #5074 / #5078 old MCP + KB control plane | Archive / close as superseded |
| #5092 umbrella | Historical tracking or close; this roadmap + evidence manifest are authoritative |
| #5635 generation improvements | Fold into or rebase over N3; must not race the normalization |

The disposition inventory covers all remaining open AI PRs, not only this
table.

## 17. Immediate execution order

**G0 — by Aug 31** (weekend available):

1. ~~Merge `v3` into `v3-ai`; prove Final AI review there.~~ **Done.**
2. Land the staging-promotion pause guard on `v3`; set
   `STG_PROMOTION_PAUSED=true`.
3. Create the branch ruleset per §5.1 (approvals 0, promoter bypass,
   PR-only `v3-ai`); verify the tag rulesets allow `v3.4.0*` creation.
4. Verify ArgoCD access for the staging `targetRevision` flip; name the
   holder in the runbook.
5. Tag the pre-normalization state.
6. Classify all open AI PRs (S/E/track); announce the schema freeze and the
   future merge-hold window.

**G1 — Aug 31–Sep 2:** publish the release-schema manifest (§6; decisions
already recorded); lock the core list and activation defaults; create the
N1–N6 stack.

**G2/G3 — Sep 2–10:** land N1–N6 bottom-up with tests; independent S0 core
in parallel; schema-dependent integration after each layer; migration
proofs; KB blocker extraction; **Sep 6 accounting checkpoint**; **D10
session**; authoring stack lands on `v3`; final `v3` cutoff merged into
`v3-ai`.

**RC cut — Sep 10–11:** content gate; cut; hold; ruleset + back-merge
automation; two-sided staging flip; reset; exact-SHA promotion; sequential
integration re-enable; reopen `v3-ai`.

**Qualification — Sep 11 onward:** continuous fault/load/security/browser
testing; migration and forward-recovery rehearsal; observability drills;
evidence manifest; go/no-go Sep 15; after 72 stable hours merge, verify
path-scoped equality, tag `v3.4.0-rc.N`, deploy dark, lift the hold.

## 18. Final acceptance principle

Unchanged (and the gate): **clean shape** (every AI schema object has an
accepted owner, lifecycle, deletion rule, migration), **controlled
execution** (every external effect has authorization, idempotency, cost
limits, observability, cleanup, separate activation), **exact evidence**
(the tree qualified in staging is the tree tagged and deployed, with a
completed stability clock and evidence manifest). The schedule is a target;
these three conditions decide.

---

### Changelog v3 → v4

1. All eight v3-review corrections folded in (refreshed snapshot, two-sided
   ArgoCD flip, promoter bypass, approvals 0, path-scoped equality, park-cost
   handling now moot, merge hold decided, tag-ruleset check).
2. Grill rulings D1–D16 recorded (§4.2); no domain parked; spikes cancelled.
3. Student generation pulled into the RC with an explicit package boundary
   and guest exclusion (§3.4); N-stack gains N5; four sections flipped
   accordingly (D9 row, §2 diagram, §15 example, §16 disposition).
4. §7.3 amended: HITL gates and incomplete publication are product states;
   gate-expiry rule added; origin copied onto saved elements.
5. §7.4 amended: Normalize-lite; candidate lifecycle stays.
6. §7.5 rewritten: neutral ledger, additive dual-write, balance boundary,
   Sep 6 checkpoint.
7. D4 flipped: LTI guest in scope, OLAT-only, with guest restrictions.
8. Roles replaced by the two-person model; evidence manifest moved to
   gitignored `project/_local/`; `GeneratedElementDraft` naming aligned with
   the glossary; §9.4/§13.1 D3→D4 typos fixed.

### 2026-08-29 release-number correction receipt

- The first production-published AI batch is a `3.4.0` release candidate,
  continuing the current `3.4.0-alpha.N` line instead of opening `3.5.0`.
- `v3.4.0-ai-rc` is the short-lived Docker-safe qualification branch;
  `v3.4.0-rc.N` is the published release tag sequence.
- The release mechanism, scope, gates, and `v3-ai` integration target are
  unchanged. Earlier review artifacts remain unedited for provenance.

### 2026-08-29 upstream integration receipt

- After an explicit one-time integration approval, custody merged exact
  `origin/v3-ai` commit `4b85e616b` as the second parent of local commit
  `3fd9daefa`. This incorporates PR #5658 without replacement work;
  `apps/chat` at custody is identical to `origin/v3-ai`.
- The separately scoped default-branch pause safeguard merged exact
  `origin/v3` commit `bb495a1b2` as the second parent of local commit
  `967d7b067`. The overlapping policy test and deployment guide merged without
  conflict or a material change to the reviewed pause behavior.
- Post-merge safeguard verification passed 38 policy tests under pinned Node
  24.16.0, YAML parsing, focused Bash syntax and ShellCheck, formatting, diff,
  and redacted range-scoped Gitleaks checks. CI and live workflow dispatch
  remain unproven.
- Both heads remain local and unpushed. No PR, repository control, deployment,
  remote merge, tag, staging reset, or other task was changed.
