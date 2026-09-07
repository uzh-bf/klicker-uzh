# Doc Query production canary activation and proof correction

Date: 2026-09-04

Status: production activation complete; source publication in PR 5813

## Goal and non-goals

Correct the fail-closed source defects that prevent the already-approved single
production canary from running safely. The activation operator must accept the
current fixed, non-secret Doc Query parameter shape without accepting arbitrary
configuration. It must also distinguish the manifest-pinned production
compatibility bridge from the separately managed target server, even though both
use the shared reader route. The proof supervisor must support a sealed
canary-only run that cannot be mistaken for the full cohort proof.

This package changes only the existing activation operator, proof supervisor,
and their focused tests. It does not change the runtime, tool allowlist, target
configuration, binding cohort, signer design, or deployment configuration.

The source package does not authorize push, pull request creation, merge,
deployment, cluster changes, secret writes, production database access, live
proof, cleanup, or deletion. The previously approved production canary remains
a separate transaction after this source package passes every local gate.

## Current approved continuation: inactive IuW source

On 2026-09-05 the canary re-entry and its nine-call proof passed. The user
approved activating the remaining 46 bindings across 21 chatbots and running
one full 37-call proof. The two active canary bindings and four exclusions
remain preserved. A definite failure rolls back only the new remaining batch;
ambiguous state stops without lifecycle replay.

Preflight found two IuW configurations on one disabled legacy source server.
The user approved a narrowly pinned exception so these configurations migrate
directly to the multi-tenant service. The legacy server stays disabled during
success and rollback. Rollback restores its prior disabled-service state, not
a working legacy reader. The correction and local checks, reviews and commits
are authorized, followed by the approved production continuation. The earlier
local-only and single-canary boundaries below describe completed phases; this
section extends them only by the actions explicitly named here.

The main session owns integration and production execution. No push, merge,
upstream integration, deployment, cluster mutation, source-server activation,
secret write, cleanup or deletion is authorized. Reuse the existing approved
loopback forward for proof and stop it afterward. The terminal condition is a
verified local correction and a recorded result of the remaining activation
and full proof, with rollback of the new batch on definite failure.

## Approved continuation: two active source aliases

The user approved extending eligibility to the two specifically pinned active
IuW and RadioSurfVet source servers covering four remaining bindings. They
already use the shared target URL but do not meet the compatibility-server
contract. This approval includes local correction, checks, reviews and commits,
then the same remaining46 activation and full37 proof. Preserve all earlier
canary, exclusion, disabled legacy source, rollback and ambiguity boundaries.
No publication, integration, deployment or source-server changes are permitted.

Add optional activeSources containing exactly two distinct source pins. Each
strict pin records sourceServerId, chatbotId, exactly two distinct configIds,
safe snapshot SHA256 and rollbackMode preserve-active. Normalize and sort;
omit absent fields so existing fingerprints remain unchanged. Reject overlap
between active pins, inactiveSource, held and excluded configurations. Require
exact manifest and global source inventory, including disabled rows.

Require each active alias to remain active, use the exact target URL, have a
nonmanaged name/description, bearer auth with secret presence, null or empty-object server
parameters and passChatbotId false. Pin remaining safe metadata exactly.
Never modify the source servers. Recheck state, snapshot and inventory across
all lifecycle paths, even switched readback and already-restored rollback.
Carry pins through intent, receipts, recovery, lineage, manifest reconstruction,
CAS and clear checks; reject addition/removal/substitution despite recomputed
digests. Extend transactional mode coverage to activeSources independently of
inactiveSource. Keep default source guards unchanged.

The main session owns coupled core/runner integration and private operations.
The native executor owns only focused tests. Use faithful multi-server fixtures
for both active aliases and the inactive source, combined successful migration
and exact rollback, and failure after an earlier chatbot commits. Preserve
active snapshots, inactive state, held canary and exclusions. Test active-only
postprepare mode drift and malformed inventory/state/snapshot/tamper contracts.
Retain all145 baseline tests; run focused native/strict/format/static/data checks.
Commit then simplify and review data integrity, followed by integrated final.

Rebuild reviewed operator, pin active metadata through the same Prisma adapter
so UTC timestamps match, and change only the private activeSources and its pin.
Dry-run and verify canary/exclusions/service/signing state. Reuse the explicitly
approved loopback forward for the first remaining migration and full proof;
rollback only the remaining batch on definite failure, stop on ambiguous state,
and stop the forward at the terminal boundary. No proof replay.

Planner approved this distinct amendment after accepting transactional coverage
and combined multi-server failure/rollback test requirements. Earlier waived
second reentry planner is unrelated and was not retried.

## Execution contract

- **Execution owner:** the current main session owns both coupled slices and
  their integration.
- **Baseline:** branch `fix/doc-query-canary-activation-proof` starts from exact
  `origin/v3` commit `468f05b91503b133670dda235be9a4b38bba2155`.
- **Autonomy:** the approved goal covers this plan, in-scope local edits,
  focused checks, configured reviews, progress updates, and local commits.
- **Terminal:** a clean local branch with both corrections, focused checks,
  slice reviews, and an integrated final review complete.
- **Pause:** stop for a changed authorization or receipt contract, a broader
  accepted parameter shape, a different proof matrix, an in-scope test failure,
  or a blocking reviewer finding that cannot be corrected narrowly.
- **Rollback:** ordinary source revert. No production state belongs to this
  source package.

## Decisions

### Exact source-parameter compatibility

Use one shared predicate for both live source validation and receipt validation.
It accepts only these three shapes:

- `null`;
- an empty plain object;
- the exact plain object `{ required: true, toolAlias: 'doc_query' }`.

Reject arrays, objects with extra keys, false `required`, a different alias,
and every other non-empty object before any write. Keep the existing tool
allowlist and target configuration checks unchanged. Preserve the exact source
parameters JSON in the snapshot, receipt, and rollback path; the predicate is a
compatibility check, not a normalization step.

### Canonical proof mode

Add one non-secret supervisor input named `DOC_QUERY_PROOF_MODE`:

- absent or exact `full` preserves the current full proof;
- exact `canary-only` selects the bounded canary proof;
- any other present value fails before a child process or MCP request starts.

The supervisor selects the canonical mode, passes only that mode through the
fixed child environment, and requires the receipt to contain the same mode.
It validates exact mode-specific counters and refuses a mismatched receipt.

The canary-only proof still validates the complete frozen manifest and its
fingerprint. It runs the first knowledge-base case for positive retrieval and
cross-knowledge-base isolation, uses the second case only as the foreign
knowledge-base reference, and runs all seven authentication and filter
rejection checks. It performs exactly nine calls. It does not call cases two
through fifteen. The full proof retains its current order and exact 37-call cap.

The canary receipt retains manifest-wide expected totals, but records exactly
one passed knowledge base, representative, positive check, and isolation check;
seven rejection checks; nine calls; and explicit `canary-only` mode. The full
receipt adds only explicit `full` mode.

### Pinned compatibility bridge

Keep the ordinary rule that a source cannot already be the target. Permit one
exception only for the source server ID pinned in each manifest entry when the
live server matches the complete production compatibility contract: exact name
`Klicker-compat`, exact target URL, bearer authentication, chatbot ID forwarding
through `Chatbot-ID`, empty parameters, a present encrypted secret, an active
server, and a non-empty description that is not the managed target ownership
marker.

Revalidate that contract during dry-run, prepare and recovery; immediately
before switch; before rollback would re-enable the compatibility source; and in
readback whenever that source is expected to be active. The operator does not
snapshot, restore, or otherwise own the compatibility server.

## Planning review

- The native planner returned `REVISE` in round 1. Accepted findings: bind the
  supervisor-selected proof mode to the child receipt, share one exact safe
  parameter predicate, preserve exact rollback JSON, and enforce the nine-call
  canary boundary.
- The same planner approved the revised plan in round 2 with no blocking
  findings.
- The configured opposing-provider challenge could not authenticate because
  its OAuth session expired and could not refresh. This pass is fail-open; no
  opposing-provider finding was available.

## Delegation map

| Workstream | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| Activation compatibility | main session | current activation operator | focused activation tests and data-integrity review |
| Canary proof mode | main session | reviewed activation compatibility | focused proof tests and security/runtime-proof review |
| Integrated result | main session | both committed slices | combined checks and final review |

Both implementation items stay in the main session because they jointly define
one production canary gate. Splitting ownership would increase the chance that
the operator and proof supervisor accept different contracts. Reviewers remain
read-only and independent.

## Test portfolio

| Consequential behavior | Protection |
| --- | --- |
| Current fixed source parameters are accepted | add an exact-shape activation regression |
| Near-miss parameter shapes fail before writes | table-test extra keys, false flag, alternate alias, arrays, and arbitrary objects |
| Receipt and live validation use one contract | exercise the shared predicate through migration and receipt paths |
| Rollback restores exact source JSON | retain and extend snapshot/rollback equality assertions |
| Default full proof stays unchanged | retain current order, counts, and 37-call assertions |
| Canary-only proof is bounded | assert one positive/isolation case, seven rejections, nine calls, and no remaining corpus calls |
| Mode cannot be confused or forged | assert invalid input fails before spawn and receipt-mode/counter mismatch fails closed |
| Full manifest remains sealed | assert canary-only still validates the complete fingerprint and manifest totals |
| Compatibility bridge remains distinct from the managed target | accept only the complete pinned bridge contract and table-test every near miss |
| Compatibility drift cannot be activated or restored | mutate the bridge after prepare and after switch; require a write-free refusal before switch or source re-enable |

## Execution slices

### Activation compatibility

- Implement the shared exact predicate in
  `packages/prisma-data/src/scripts/doc-query-cohort-activation.ts`.
- Extend
  `packages/prisma-data/src/scripts/doc-query-cohort-activation.test.ts` with
  accepted-shape, near-miss, and exact rollback coverage.
- Run the focused activation suite, package type checking and formatting, then
  inspect the exact diff and staged data before committing.
- Run a simplifier and a data-integrity slice review on the immutable commit.

### Canary-only proof

- Implement the canonical mode and mode-bound receipt validation in
  `apps/chat/scripts/prd-doc-query-proof.mjs`.
- Extend `apps/chat/test/prd-doc-query-proof.test.ts` and only the existing test
  support required to observe call selection and receipt validation.
- Run the focused proof suite, Chat type checking, linting and formatting, then
  inspect the exact diff and staged data before committing.
- Run a simplifier and a security/runtime-proof slice review on the immutable
  commit.

### Finish gate

- Rerun all affected focused checks on the integrated branch.
- Inspect the complete diff from the recorded baseline and account for every
  changed hunk.
- Run an integrated final review over both immutable commits.
- Record exact commits, checks, review dispositions, and remaining production
  boundary below.

### Compatibility bridge correction

- Centralize source-server eligibility in the activation operator.
- Preserve the ordinary target-route refusal while allowing only the complete
  manifest-pinned `Klicker-compat` bridge contract.
- Revalidate the bridge at each transition that could disable or re-enable its
  configurations and whenever readback expects it active.
- Run the focused activation suite, Prisma data type check, formatting, exact
  diff inspection, simplification, data-integrity review, and integrated final
  review before repeating the values-free production dry-run.

## Production continuation boundary

After the source finish gate passes, refresh only the values-free prerequisites
for the already-approved single production canary. Use `canary-only` mode. The
transaction may create the separate knowledge-base server/configuration, switch
only the named canary atomically, run positive retrieval and cross-knowledge-
base/authentication isolation proof, and restore on a definite failure. Never
retry an ambiguous transaction. Do not expand the cohort, scale, retire legacy
readers, clean up, or delete anything under this plan.

## Approved rollback re-entry correction

### Approval summary

A failed canary restored both source bindings and left its two managed target
bindings disabled. Ordinary preparation refuses these existing targets. Add a
dedicated one-time `reenter` command that uses those same bindings and a new
receipt, while preserving the terminal rollback receipt byte-for-byte.

The user approved this local correction and, on 2026-09-05, explicitly directed
continuation without the rejected second planner review. The first planner's
four safeguard findings below remain binding. The second-round review is
waived by the user, not passed or replaced. Source implementation, synthetic
checks, local commits and independent implementation reviews remain authorized.
The terminal condition is a clean verified local branch. Production execution,
publication, upstream integration, merge, secret changes and cleanup are not
part of this local correction. Earlier production approval remains separate.

### Receipt and state contract

The command accepts the original root `rolled_back` receipt and a distinct
new receipt path. It refuses lineage-bearing predecessors, preventing repeated
re-entry chains. An exclusive, durable sidecar claim beside the predecessor
binds its payload digest to the intended successor. A validated `reentry`
field binds the new intent and receipt to predecessor and claim digests and
survives every receipt transition. Ordinary migrate, recover and clear paths
refuse re-entry intents rather than inheriting their recovery semantics.

Require exactly the predecessor's two entries for one chatbot and the same
sealed manifest, including canonical held/excluded sets and current complete
mode coverage. Require enabled source rows with the exact original identifiers
and content. Capture fresh source timestamps for compare-and-swap because
rollback updates live `updatedAt` while preserving the original source
snapshot. Require exact disabled target snapshots, including timestamps, and
an exact target-server snapshot. Reuse the existing target identifiers; no
server or binding creation, deletion, schema change or adapter change belongs
to re-entry.

Resolve both receipt paths canonically, reject equal paths and symlink
ambiguity, acquire both receipt locks in lexical order, and release in reverse.
Lock acquisition may create its existing SQLite coordination files; the claim
is the first durable lifecycle mutation after all read-only validations.
Create the claim exclusively and fsync it and its containing directory. Then
persist a lineage-bearing `preparing` intent through receipt compare-and-swap,
prepare a successor receipt using read-only live snapshots, persist `prepared`,
and switch using the existing transactional compare-and-swap helper.

Any failure after claim creation stops and retains the claim and all written
receipt evidence. Do not clear, recover, delete claims, retry lifecycle steps,
or silently resume after a crash. Existing retries of uncommitted database
serialization conflicts stay unchanged. A definite switched-state failure
retains the existing explicit rollback path. No new live attempt is part of
local verification.

### Delivery and verification

| Workstream                          | Owner           | Acceptance                                                                                     |
| ----------------------------------- | --------------- | ---------------------------------------------------------------------------------------------- |
| Re-entry source and synthetic tests | native executor | existing activation tests plus re-entry contract tests, package checks and formatting          |
| Integration and local delivery      | main            | exact diff and staged-data inspection, data-integrity slice review and integrated final review |

The source scope is the existing activation module, runner and activation test
file under `packages/prisma-data/src/scripts/`. The Prisma adapter is read-only
context. Extend tests at the existing fake store and real temporary receipt
file seams. Cover success and rollback, predecessor byte immutability, replay
with same or different successors, changed manifest/inventory, invalid enabled
states, timestamp/content/server drift, competing attempts and crash boundaries.
Assert no database creation/deletion or identifier replacement. Keep the prior
56 activation tests and all existing canary/full-proof checks intact. Run
repository-native package type checks and formatting, inspect the whole diff,
and retain existing evidence for unchanged earlier source.

The main session owns the plan, local commits, runtime lifecycle and reviews.
The executor owns only the three source/test files and does not access secrets,
production data or live services. No new dependencies or runtime applications
are needed for the synthetic tests; use the existing managed toolchain when
available. A missing verification environment is a blocker, not test success.

### Review disposition

The recovered first planner review returned `REVISE`; its immutable-predecessor,
fresh-source-timestamp, durable-claim, ordering and bounded-preparation findings
were accepted. Its second-round request failed with a safety-system rejection.
The user waived that specific request with “so proceed without doing that
which was rejected”. No alternate planner request is authorized or needed.
Implementation reviews assess the resulting local code and remain required.

## Progress

- [x] Production dry-run stopped before receipt creation or writes with
  `SOURCE_SHAPE_UNSUPPORTED`.
- [x] Values-free classification proved the source shape is exactly the fixed
  `required` plus `doc_query` alias contract.
- [x] Repository inspection proved the proof tool lacks a canary-only terminal
  mode and currently always schedules the full 37-call matrix.
- [x] Native planner approved the revised plan in round 2.
- [x] Opposing-provider review attempted; authentication was unavailable.
- [x] Plan committed on the fresh exact-v3 branch as `066cfbc9bd`.
- [x] Activation compatibility slice implemented and committed as `995d660ded`.
  Its 43 focused tests, Prisma data type check, Biome check, simplifier, and
  data-integrity review passed with no blocking finding.
- [x] Canary-only proof slice implemented and committed as `723459d450`. Its 42
  focused tests, Chat type check, Biome check, simplifier, and security/runtime
  review passed with no blocking finding.
- [x] Integrated `git diff --check`, exact six-path inspection, and final review
  passed at `723459d4509f1b5327007befa00c8a657563eb41`. The configured reviewer
  failed before reading the task; the clean-context continuity review returned
  PASS.
- [x] The clean local source package is ready for the separately authorized
  values-free production preflight and single-canary transaction.
- [x] The first production dry-run remained write-free and created no receipt,
  but classified the manifest source as `SOURCE_IS_TARGET`.
- [x] Values-free production readback proved the pinned source is the active
  `Klicker-compat` bridge on the shared reader route, while the separately
  managed `KB` target is absent.
- [x] Planner review approved a narrow compatibility exception with mandatory
  transition-time revalidation and near-miss regressions.
- [x] Compatibility bridge correction committed as `3b8351d919`. The 56-test
  focused activation suite, Prisma data type checks, Biome check, exact diff,
  simplifier, and data-integrity review passed with no blocking finding.
- [x] The simplifier's two behavior-preserving suggestions were accepted:
  missing-source validation now stays inside the shared eligibility check, and
  readback validates each enabled source directly without a cache set. The same
  56 tests, type checks, Biome check, and diff check passed afterward.
- [x] Integrated final review passed at `b85e26f66f` with no P0-P3 findings.
- [x] The values-free production dry-run passed with the same frozen manifest:
  two source configurations remain eligible, 46 configurations remain held,
  the distinct managed target would be created with two configurations, and
  both canary modes would switch while preserving source rows. No receipt was
  created and the dry-run made no database writes.
- [x] The sealed production proof manifest passed independent preflight: 15
  knowledge bases, 22 in-scope chatbots, two non-overlapping exclusions, a
  first-position `mat183_v1` canary, exact activation-manifest coverage, and a
  valid full-cohort fingerprint binding.
- [x] The loopback-only proof adapter passed its security review after fixing a
  double-slash URL-authority escape. Exact-origin, Request-preservation, and
  fixed-child-spawn checks pass, and both local adapter files remain mode 600.
- [x] The single production canary activation switched exactly two
  configurations for one chatbot. Immediate readback confirmed both legacy
  source configurations disabled and both managed target configurations
  enabled.
- [x] The bounded proof stopped after its first positive request with
  `canary_positive_failed`; no isolation or rejection call ran. The mandatory
  rollback completed, and readback confirms both source configurations enabled
  and both managed target configurations disabled.
- [ ] Values-free service-log classification identified ES256 signature
  verification failure for the recognized key ID. Before another canary can be
  authorized, the Klicker signing private key and the production Doc Query
  public-key trust entry must be reconciled through their owning secret and
  GitOps workflows. The failed canary must not be retried under this receipt.
- [x] A restricted in-process comparison confirmed that the current Infisical
  private key and the merged production public key are both valid keys but do
  not form a pair. The live ConfigMap public-key fingerprint matches the merged
  GitOps source, so runtime configuration drift is not the cause.

- [x] Takeover verified clean head `4dd2c32016c847909517dc18b887d95f527b6e3f`;
      fresh `origin/v3` is two commits ahead of the branch base, with eight local
      commits ahead. No upstream integration occurred.
- [x] User waived the rejected second planner review on 2026-09-05 and directed
      local implementation under the recovered first-round safeguards.
- [x] One-time rollback re-entry implemented as `ce5162117e`; the accepted
      duplicate-check simplification is `0cccf39f17`.
- [x] Data-integrity review found a preparation-to-switch coverage race.
      Transactional coverage revalidation and its regression are committed
      as `3e9e61c052`; the same reviewer cleared the correction.
- [x] Verified source `3e9e61c052` passes 113 synthetic tests, repository data
      and historical-script checks, focused strict TypeScript for four roots,
      Biome with two existing warnings, and the bounded Opengrep scan with
      zero findings. Exact diff and staged gitleaks inspections pass.
- [x] Host Git commits bypassed the unavailable pnpm hook launcher after
      focused checks in network-disabled ephemeral containers. No full
      monorepo hook or full-package strict success is claimed; unrelated
      historical-script strict errors remain outside this source correction.
- [x] No managed runtime or live service was started. Test containers exited
      and removed themselves. The task workspace has zero routes; fresh
      provider-stopped status is unavailable because DevPod CLI is absent.
- [x] Integrated final review passed with no P0-P3 findings for the complete
      seven-path source package through `3e9e61c052`. The trusted generic
      reviewer resumed after a usage-limit interruption; the rejected second
      planner was never retried. Report:
      `project/_local/reviews/2026-09-05-doc-query-reentry-final.md`.
- [x] Local correction complete. Publication, upstream integration and live
      production execution remain separate from this completed source goal.

## Approved inactive-source correction

### Contract

Add an optional strict `inactiveSource` exception to the existing manifest,
preparing intent and receipt. Pin one source server, one chatbot, exactly two
distinct configuration identifiers, a deterministic SHA256 of safe source
metadata, and the exact rollback mode `preserve-inactive`. Normalize identifiers
and ordering. Reject unknown fields and invalid digests. Omit the field from
canonical forms when absent so existing manifest fingerprints stay unchanged.

The two exception entries are a subset of the remaining 46 entries. Require
exact agreement with the manifest and reject held or excluded overlap. Reject
any additional configurations on that source globally, including disabled,
held and excluded rows. Keep enabled-source-configuration and safe legacy
parameter/tool checks unchanged. Reject managed targets, compatibility bridges
and shared target routes independently of the inactivity exemption.

Revalidate the exact safe snapshot, inactive server state and complete source
inventory in dry-run, prepare, recovery, switch, rollback and readback. Check the
exception independently of source configuration state, including switched
readback and already-restored rollback. Recheck complete-mode coverage inside
the affected switch transaction before configuration writes. An earlier durable
switching receipt checkpoint may remain on failure. Never modify the source
server or secret values.

Carry the exception through every constructor, manifest reconstruction,
recovery, re-entry and receipt transition. Bind it to fingerprints, payload
digests and compare-and-swap expectations. Explicit equality checks reject
addition, removal or substitution even when payload digests are recomputed.
Rollback restores exact prior configuration content with fresh timestamp CAS
while preserving the inactive source server.

### Ownership and acceptance

The trusted native executor owns only the activation core, runner and existing
activation test file. The Prisma adapter is read-only context. The main session
owns this plan, integration, local commits, reviews and private operational
artifacts. No schema, dependency, provider or source-shape expansion is needed.
The existing product binding and reader contracts are preserved; no new product
primitive or durable architecture decision is introduced.

Extend synthetic tests for success and exact rollback; unmarked inactivity;
wrong identity, inventory, snapshot and metadata drift; fingerprint binding;
recomputed-digest transition downgrade or substitution; and compatibility and
re-entry regressions. Preserve the passing 113-test baseline. Run focused
repository checks, strict four-root checks, formatting, bounded static analysis
and exact staged-data inspection. Run the simplifier and data-integrity slice
review on the committed correction, then integrated final review. Reuse prior
passing evidence for unchanged source.

After these gates, rebuild the ignored operational JavaScript from reviewed
source. Read the identified inactive source snapshot without secret values,
amend and repin only the private remaining manifest, then dry-run. Verify the
active canary and exclusions, migrate the remaining batch, run the unchanged
sealed full proof once, and record terminal readbacks. Preserve the original
rollback receipt and consumed re-entry claim.

### Planning review and progress

- [x] Native planner `01a07265-9743-71d1-8494-070bdf9cf715` approved the
  revised contract after all five first-pass findings were accepted: exact
  global inventory, enabled configuration guards, state-independent checks,
  canonical propagation and explicit expanded production authority.
- [x] The earlier waived second re-entry planner remains waived and was not
  retried. This review covers the distinct inactive-source correction.
- [x] Fresh remote inspection at `b2a4d3286a` found the clean task branch 14
  commits ahead and two behind `origin/v3`; no integration occurred.
- [x] Values-free inspection confirmed both affected configurations already
  satisfy the approved parameter and legacy-tool shapes.
- [x] Implement and verify the inactive-source contract. All145 synthetic tests pass (103 activation,42 proof); focused strict TypeScript has zero diagnostics. Repository checks pass with two pre-existing Biome warnings. Bounded Opengrep reports zero findings. No schema or dependencies changed.
- [x] Complete committed source reviews and rebuild the operator. Native simplifier recommends no change; trusted data-integrity review and native integrated final review pass at8c4839220c. Three operator modules rebuilt from reviewed source.
- [x] Execute the approved remaining activation and full proof, recording
  rollback on definite failure and preserving the active canary.

### Resumed execution ownership

The goal resumed after its usage-limited checkpoint. The main session owns
the coupled core and runner completion; the same native executor owns only
the focused test file. This reduces the stalled implementation scope without
replacing the worker or repeating planning. Acceptance and production authority
remain unchanged. Fresh fetch succeeded; the branch is15 ahead and3 behind
origin/v3 with no upstream integration.

The executor returned its single success-and-rollback test and released ownership.
The parent completed the negative regression cases and verified the complete diff.
Required reviews will use trusted native routes because source contains internal
service URLs; the external slice-review route is ineligible for this scope.

### Production preflight after inactive-source review

The private remaining manifest is amended only with the approved inactive
exception and its fingerprint. Initial dry-run stopped write-free on a snapshot
mismatch. The private SQL helper interpreted a timestamp without timezone in
local Zurich time, while Prisma interprets it as UTC. A scoped comparison proved
updatedAt was the only difference, exactly7200000ms; explicit UTC conversion
matches the adapter snapshot. The helper and private pin were corrected without
source changes or database writes. Current remaining fingerprint:
34e3e4d1bf288eab635209310c2323496af95309f0078817c0cb3b680de5a00e.
Original canary/full/proof fingerprints and rollback receipt bytes are unchanged.

The corrected dry-run stops before writes with SOURCE_IS_TARGET. Two other,
active source aliases already use the exact shared target URL: one IuW source
and one RadioSurfVet source. Each has exactly two configurations, all pinned
in the remaining manifest and enabled, with safe configuration parameters.
Both use bearer authentication and empty server parameters but do not forward
the chatbot ID or match the approved compatibility-server name/header contract.
They are separate from the approved inactive source. Broadening that contract
requires a new explicit decision; do not enable sources, silently omit bindings,
weaken the global guard or run migration under the current source contract.

Canary readback remains switched with two target bindings enabled and two source
bindings disabled. No remaining activation receipt or full-proof result exists.
No migration, proof, rollback or temporary forward was started in this phase.
Live service metadata: two ready of two desired, Argo Synced Healthy at
f4fd59d44c6222dd34caab986be03e7c1cb8a586; verifier signature challenge passes.
Next decision: authorize a separately pinned active-alias source correction for
these four bindings, retaining the remaining46 and full37 scope, or revise scope.
The inactive-source implementation is verified; overall runtime goal unfinished.

### Active-alias implementation verification

Implemented optional canonical activeSources with strict state/snapshot/inventory
checks and explicit receipt/intent/CAS propagation. Shared pin validation retains
inactive behavior. Faithful combined multi-server tests protect successful and
partial-failure rollback, server states and held/excluded rows. Live safe metadata
confirms both approved aliases represent empty server parameters as null; the
contract and fixtures explicitly accept null or an empty object, never nonempty
parameters. All158 tests pass (116activation,42proof), strict4roots zero diagnostics,
native checks pass, two pre-existing Biome warnings, bounded Opengrep zero findings.
No schema, dependency, adapter or production mutation is included. Required
committed reviews and production continuation remain next.


## Completed production activation and proof

The approved runtime objective is complete. Reviewed source
4434e1a5b8135a2301a7a301fdcaefd4ba968ec0 activated all 46 remaining bindings
across 21 chatbots. The two previously active canary bindings remain active,
for 48 active managed target bindings in total. The four excluded bindings are
unchanged. The legacy inactive IuW server remains disabled; both approved
active source aliases retain their server states.

The active-alias simplifier, data-integrity review and integrated final review
passed. Their reports are in project/_local/reviews/2026-09-05-doc-query-active-*.md.
The reviewed source retains passing evidence for 158 synthetic tests, strict
TypeScript checks, repository checks and the bounded static scan. No source
behavior changed after these reviews.

The current remaining manifest fingerprint is
ed04361dca18b7ffc2a96c962b8020ff52d60033a33235d20364f8f2d42797a8.
Its full dry-run passed before activation. Final preservation reads passed,
and the live verifier accepted the in-memory signature challenge. A fresh
fetch found the clean task branch 18 commits ahead and four behind origin/v3.
The added upstream multi-KB contract preserves singleton kb_id configuration
and JWT behavior. No upstream integration occurred.

The sealed full proof ran once and passed all 37 calls in 78010 milliseconds:
15 positive retrieval checks, 15 isolation checks and seven rejection checks.
All 15 representative knowledge bases passed, covering the manifest's 22
chatbots. The affected inactive-source IuW chatbot is its proof representative.
This is direct Doc Query proof; it does not claim a browser-level chat test.

Final readback confirms all 46 remaining target bindings enabled and all 46
prior source bindings disabled. The two canary targets remain enabled. The
four exclusions and disabled legacy IuW server are preserved. No rollback or
proof replay was needed. Production has two ready replicas out of two desired;
Argo reports Synced and Healthy at ee9a7337a8cec113d06d826e19d8a4b0a48570cb.
The Doc Query image is unchanged from preflight.

The task-owned loopback forward stopped successfully, and port 1417 has no
listener. The user's database tunnel was left alone. There are no running
proof workers or unresolved review children. Private receipts and the sanitized
proof result remain under /Users/rschlae/Git/ai/_local/klicker-prd-activation/;
retain them and the original rollback receipt and consumed re-entry claim.
No publication, merge, infrastructure deployment or cleanup occurred.


## Source publication (2026-09-07)

The user authorized source publication and conflict resolution, without merge.
[PR 5813 — cohort activation source preservation](https://github.com/uzh-bf/klicker-uzh/pull/5813)
contains the six reviewed executable/test files and this plan on
`fix/doc-query-activation-publication`, based on `v3` at
`d8e29ee75168b61e5c6902a5a8d8afa12495e261`. All six files are byte-identical to
reviewed commit `4434e1a5b8135a2301a7a301fdcaefd4ba968ec0`; prior simplifier,
data-integrity and final review evidence remains applicable.

The original branch's one target integration resolved the LTI documentation
conflict by preserving the already-merged PR 5807 version. Mandatory data-hygiene
checks then rejected unrelated upstream content in the merge commit. No check
was bypassed: only the seven scoped files were carried to a fresh target-based
publication branch. The original worktree and prior receipts are preserved.

Fresh focused checks on the resolved target tree: proof 42/42 passed; activation
116/116 passed with `TMPDIR=/private/tmp`. The default macOS temporary directory
has a symlinked ancestor, which intentionally fails the re-entry root guard;
using the canonical temporary directory fixes the test environment without
weakening the guard or changing source. Host Node was 26.8.1; the prior Node 24
container checks remain separately recorded. Biome passed with the two known
warnings, JavaScript syntax passed, and the publication commit's gitleaks scan
and diff whitespace check passed. Full repository build/check coverage is left
to GitHub CI; no local application runtime was started for publication.

The separate roadmap reconciliation is published in deployment MR 739.
No production activation, proof replay, rollback or secret/data change occurred.


PR static analysis found one unused initial assignment in `runProofMatrix`.
Removed only that initializer; the successful resolution always assigns the
mode and the exception path returns immediately. All 42 synthetic proof tests
passed again with this correction; the 116 activation tests are unaffected.
Five executable/test files remain byte-identical to the prior reviewed source;
the sixth differs only by this behavior-preserving correction. Prior independent
reviews remain applicable with this explicitly recorded main-session check.
