# [PR #5777 — generation lifecycle contracts and business-regression protection](https://github.com/uzh-bf/klicker-uzh/pull/5777)

## Approval summary

### Isolated local KB test stack — approved source execution extension

Build a reproducible local Klicker, ingestion and retrieval stack without
restarting retained jobs or changing the user's existing KBs. Use a separate
runtime checkout, fresh backing stores and isolated provider processes. Do not
reset, clone or rebind the retained environment. This replaces the proposed
queue-emptiness preflight: incomplete Hatchet listings cannot establish that
restarting old workers is harmless.

The user approved source implementation on 2026-09-08, including offline
checks, reviews, local commits and ordinary publication to the existing
draft PR. That stage ends at source-ready, not a
working-AI claim. It does not create, seed, start or stop a runtime. Runtime
qualification follows a separate exact-target and capacity proposal. A real
ingestion and Chat proof additionally needs an explicit request and cost cap.

Preserve all retained data, current source edits, provider contracts and product
behavior. Do not add provider dependencies, schema changes, production actions,
graph generation, automatic retries or deletion. The trade-off is extra local
RAM and disk; available concurrent capacity is not yet established. Docker
reports about 34 GiB total memory, which is not evidence of free capacity.

Success at the source stage means the launcher can describe the complete
dependency graph, reject shared mutable state and ambiguous ownership, and pass
focused offline checks and independent reviews. Documentation must distinguish
infrastructure health, provider process readiness and external AI capability.

#### Execution details: isolation contract

Continue implementation in `trees/rs/generation-lifecycle-contracts`, branch
`rs/generation-lifecycle-contracts`, targeting the existing draft PR's `v3-ai`
base. The refreshed branch is five commits ahead of its tracking branch and
178 ahead/five behind default `origin/v3`; no integration is required for this
plan update. Preserve the recovery stash and all existing uncommitted work.

The proposed runtime-only checkout is `trees/rs/local-kb-isolated-e2e` under
this repository; it does not exist at planning time. Create it only in the
separately approved runtime stage, detached at the exact committed candidate.
Use canonical devrouter lifecycle and resolve its generated identity from its
source path. Do not guess a workspace token or use the primary checkout.

Use a separate Compose project with fresh Postgres databases for Klicker,
Hatchet and ingestion state; separate Hatchet engine/configuration; Redis;
Blob storage; Milvus and its object backing; scraper cache; producer registry;
signing material; and provider process groups. Include ingestion API, workers,
callback delivery, scraping/Crawl4AI and Doc Query in the declared topology.
Do not substitute the deterministic MCP fixture for real retrieval.

Validate rendered destinations before any runtime mutation. Reject retained
or externally shared mutable volumes, generic cross-workspace aliases, remote
endpoint fallbacks, old KB bindings and inherited signing keys/tokens. Shared
devrouter routing infrastructure and proven immutable toolchain inputs are
allowed; shared application state is not. Route attachment does not itself
establish network isolation.

Provider source roots remain explicit and revision-verified. Reuse the known
repositories without updating them, and require clean sources mounted read-only.
Put every generated file, cache, temporary file and state directory in the new
runtime's owned storage. Stop if a supported entrypoint requires modifying a
reused provider tree. Never copy ignored files or secret configuration into a
runtime checkout. Provider edits and a provider MR are not part of this design.

Extend `util/local-kb-stack.mjs`, `util/local-kb/` and a minimal devcontainer
overlay rather than building a competing harness. Disable dotenv inheritance
and allowlist the environment. Local generated signing material belongs in
ignored owner-only files. Real upstream keys remain process-only through the
restricted operator and are excluded from this first execution stage.

#### Execution details: lifecycle and readiness

Keep plan/status read-only. Setup, start and stop remain explicit operations.
Before initialization, exclusively create minimal durable ownership evidence
bound to canonical source path, project/volume identities and candidate/provider
revisions. Setup refuses existing or ambiguous initialization evidence. A
partial startup is incomplete, not a fresh stack that may be silently retried.

Setup alone may migrate and seed newly proven isolated databases when runtime
authority is granted. Start never migrates or resets. Restarting initialized
workers can resume their own jobs, so it requires explicit resume authority;
a future bounded cold-start/stop/restart approval may cover that sequence if
no work has been submitted. Stop only exact owned groups and the exact managed
checkout. Preserve volumes and data by default, including after failure.

Expose infrastructure health, provider process readiness and external-provider
capability separately. Missing upstream credentials leave that capability
unqualified. Start a provider without keys only when its supported mode permits
it; otherwise leave it stopped. Never invent disabled modes or inject dummy
credentials to obtain a green result. No producer submission or worker/scheduler
activation occurs in the source stage.

The future credential-free runtime check must block public application egress
while allowing declared local dependencies. Verify effective network wiring
before requests; intercepted browser requests alone do not prove this. Any
image/dependency provisioning happens before acceptance under the later runtime
approval. Do not describe credential-free startup as full pipeline readiness.

#### Ownership, sequence and acceptance

| Slice and outcome | Owner | Acceptance and dependency |
| --- | --- | --- |
| Isolated configuration | Native executor | Extend launcher configuration/command tests and rendered topology checks; reject shared mutable destinations and dirty provider inputs. Main accepts the result. |
| Explicit lifecycle | Main | Depends on configuration. Integrate setup/start/status/stop with ownership fences; test mismatch and partial-start paths produce no unapproved mutations. Retained by main because the cross-system lifecycle is coupled. |
| Source qualification and delivery | Main | Depends on lifecycle. Run affected native checks and committed slice/final reviews; update the existing draft with accurate source-only evidence. |

Use one substantive commit boundary per implementation slice. Apply the existing
simplifier and risk-review gates, followed by integrated Sol final review. Do
not restart unrelated passing checks. Document the supported sequence in
`.devcontainer/README.md` and `docs/solutions/integration/local-kb-stack.md`.
This is reversible opt-in tooling, so a solution document is sufficient; a new
product identity or trust contract would reopen the ADR/design decision.

| Test obligation | Existing protection and required extension |
| --- | --- |
| Extend launcher/identity/command tests | Two stack configurations cannot share mutable destinations; wrong source/PID/port ownership produces no mutation. |
| Add rendered configuration contract | The complete dependency graph is represented, sources are read-only and no retained/remote destinations or ambient credentials leak into the new stack. |
| Extend lifecycle failure tests | Initialization is exclusive, partial state cannot auto-retry, start never migrates and repeated setup refuses existing state. |
| Reuse citation regression tests | Existing saved-fixture parsing/rendering/reload evidence remains scoped to those contracts; no duplicate tests or new provider calls. |

#### Separately gated runtime and live proof

After source completion, propose the exact candidate and provider revisions,
new runtime path/identity, rendered limits, image/disk needs and expected memory
use. Use values-free Docker capacity/current usage and disk readback without
starting services. Pause if concurrent capacity is insufficient; never stop
the retained stack to make room without the user's separate instruction.

Before/after runtime qualification, compare source-resolved identities and
status of the retained runtime, its volumes and already-known KB resource/version
counts, without content or retained writes. Also prove the launcher never targets
retained resources; natural retained-stack activity is not attributed to the new
test. The user's retained manual-verification lease stays unchanged.

Request one bounded fresh setup/start/stop/restart test, synthetic local seeding
and browser verification only after these prerequisites are available. Stop
the new runtime after verification unless the user explicitly keeps it running.
No cleanup or deletion is implied. Later, separately approve one synthetic or
public fixture and a request/financial cap for real ingestion, callback, READY,
retrieval, Chat answer and citation/reload evidence. Keep graphs and question
generation out of that first live proof.

Authority now: approved source execution for this new extension. Terminal:
reviewed source-ready draft publication. Boundary owner: main. Pause on an
unsupported isolation seam, unexpected ownership, unavailable required review,
or a new data/cost boundary. Runtime creation, live secrets, paid calls, merges,
deployment and deletion remain withheld.

Planning review: native planner approved revision B after one correction round.
Accepted findings cover source immutability, exclusive initialization, precise
readiness levels, single-owner slices and separate runtime capacity approval.
Report: `project/_local/reviews/2026-09-08-isolated-local-kb-plan-hardening.md`.
External consultation was not used: the complete unpublished cross-repository
scope is not established as eligible for that destination. No external review
or runtime acceptance is claimed. Progress: plan approved; isolated configuration
is the active slice. This extension supersedes the queue-preflight approach below,
which remains as historical evidence.

Execution finding, 2026-09-08: the plan's service inventory omitted Doc Processing.
The current ingestion parser routes document inputs to that separate service;
`steps/parsing/doc_processing.py` requires both `DOC_PROCESSING_BASE_URL` and
`DOC_PROCESSING_API_KEY`. A cold PDF cannot rely on the retained parsed cache.
Do not label the planned graph complete for PDFs or inherit a remote endpoint.
Main has requested a ruling to include local Doc Processing in the source-only
scope, or explicitly limit initial support to HTML/text. The independent
configuration slice continues, with document processing marked unqualified.
No provider file, runtime, queue or database was changed. The existing three
launcher/helper suites pass 14 tests using the retained container's Node 24;
this is an offline baseline, not isolated-runtime proof. The exact container
source mount matches this task worktree and its keep-running lease is preserved.

### Local reconciliation checkpoint — 2026-09-08

The user subsequently approved the bounded data-ingestion source extension:
add a read-only local queue/retry preflight and consume it from the portable
launcher. Reuse `data-ingestion/trees/rs/local-kb-e2e`, verified clean at
`d46282848100beec5a1f571e0cc9b091dcdd4179`, equal to `origin/main`.
This supersedes the earlier exclusion of provider edits only for this preflight.
No worker/job execution, deployment, deletion or paid operation is included.
Main owns the cross-system contract; the existing read-only investigator maps
Hatchet state coverage. The preflight must include resource operations and
outbox retries as well as all nonterminal Hatchet work and future triggers,
and fail closed on missing, partial or unknown evidence. It reports sanitized
counts/reasons only. A zero snapshot is not a concurrency lock or permission
to run jobs; startup still requires controlled producers and exact ownership.
Use focused synthetic adapter/contract tests before any separately gated live
readback. Preserve the existing review and draft-delivery gates.

Preflight investigation completed on 2026-09-08 against unchanged provider
`d46282848100beec5a1f571e0cc9b091dcdd4179` and installed Hatchet SDK 1.33.6.
The SDK exposes paginated task, scheduled-workflow and cron listings. Task
listing accepts `include_payloads=False`, but has a mandatory time window
and only QUEUED/RUNNING nonterminal states. No separate delayed-retry feed or
server guarantee of retry coverage was established. Resource-operation counts
alone therefore cannot qualify worker startup. Pending/delivering outbox rows
must also include future attempts and callback events, not only due dispatches.
Missing pagination or incomplete retry coverage must remain unknown, never idle.

This is source-contract evidence, not live queue evidence. The investigator
completed without edits or live calls; main checked the SDK signatures and
pagination models. No provider source was changed and no worker was started.
The remaining design boundary is how to establish an authoritative empty
execution scope without consuming retained work. Do not add a nominally green
preflight based on these incomplete feeds. An isolated fresh local execution
scope is a possible alternative, but creating/rebinding it needs a concrete
scope decision before implementation. The retained-data launcher remains
non-executable until that boundary is resolved.

Local merge `eccc1f5bf0` incorporates published task head `1c8ff98696`.
All equivalent hook checks passed, split between the container toolchain and
host-only Playwright contract tests. Initial cached/parallel checks failed on
generated Prisma types; fresh dependency builds and direct sequential package
checks passed without changing application code. No database operation ran.
The saved citation and launcher edits are restored from recovery snapshot
`e0719fd719a1d757d0e4ddb64bdd7fea522cb21b`, which remains retained.
Their verification and reviews remain separate from the merge checks.

The runtime-stop receipt below belongs to the earlier published qualification
on Compose `default-rs-cea28`. It does not describe this device's retained
`default-rs-6d40c` runtime. This device retains its runtime under the user's
manual-verification lease. No restart, provider call, cleanup or push occurred
during this reconciliation. Earlier receipts below remain historical evidence.

### Published qualification history

Post-restoration verification, 2026-09-08: all four focused Chat suites pass
(101 tests), the launcher/identity/command suites pass (27 tests), and Chat
typecheck passes. The retained synthetic browser test passes in 6.3 seconds
including reload and zero local write requests; external requests are blocked.
This is saved-fixture rendering evidence, not a new provider or ingestion run.
No publication or new paid operation occurred.

Portable startup remains blocked at the approved provider-preparation boundary.
The existing read-only provider investigation confirms that API operation counts
do not cover Hatchet queues. Worker startup can consume retained tasks; the
resource dispatcher can dispatch due outbox rows. The available idle precheck
covers only queued/running LLM, embedding and resource-fetch work, not every
worker or scheduled/retry state. A complete supported no-work preflight was
not found. Provider source changes are excluded by current approval, and no
credentialed fleet startup is authorized on incomplete evidence. Request a
bounded provider-side preflight extension before claiming portable startup.

Current qualification, 2026-09-08: the inherited UI acceptance and guarded retained-runtime recovery pass. The integrated final review passes on e9641fbc900cbfdd76b051ba6df0c7245c760f96 with no findings. The exact task runtime is stopped with zero routes. Approved delivery is an ordinary push to the existing draft; current-head hosted CI, hosted review and explicit merge authority remain separate gates. The earlier device-transfer checkpoint is retained below as history.

### Current KB ingestion and retrieval checkpoint — 2026-09-07

This checkpoint supersedes older runtime and local-delivery claims below.
The existing PR remains open against `v3-ai`. The local branch is at
`b0fb93c98a`, with 36 commits not yet published to its tracking branch.
The Devrouter version pin, selective Turbo concurrency correction, Manage
Blob route, and task-local signer hook remain uncommitted. Preserve them;
the signer hook and ignored prototype are not yet portable release artifacts.

The approved public-PDF test proved browser upload, one external ingestion
operation, callback settlement to the current AI-serving version, and real
Doc Query retrieval in Chat. The returned tool result contains one PDF source,
five chunks, and page metadata. It does not prove correct citation display:
the result badge incorrectly says no results and the answer exposes an internal
ingestion URL. Exact local evidence is in
`project/_local/local-kb-e2e/README.md`; do not publish its fixture inventory or
secret-bearing generated configuration.

The user approved continuing the existing package to correct those acceptance
failures and make local ingestion/retrieval startup reproducible. The main
session owns cross-system contracts, runtime effects, and final proof. A bounded
read-only child maps the existing Chat parser and source-normalization seams.
Preserve original source identity, signed scope, existing provider contracts,
and process-only upstream credentials. No new schema, dependency, production
action, graph build, deletion, merge, or deployment is authorized by this
continuation. Further product or trust-boundary changes require a fresh ruling.

The runtime is retained for the user's manual verification at the exact task
checkout, workspace `rs-generation-lifecycle-contract`, Compose project
`default-rs-6d40c`. Latest canonical ensure reported ready, eight routes,
no drift, no recreation, and mock MCP stopped. This replaces the older
`default-rs-f189c` and stopped-runtime receipts; do not act on those old IDs.

### Approved local ingestion and citation execution contract

Authority: the existing approval covers source corrections, focused checks,
native reviews, ordinary task-branch publication and updating this draft PR.
No merge, deployment, deletion, provider-repository edits, new schema or access
endpoint is included. KG and question generation are not part of this proof.
The remaining paid budget cannot be verified. Do not submit another paid query
or ingestion until the user approves a fresh cap. Offline and deterministic
browser checks continue without that gate.

Terminal: reviewed source publication with accurate acceptance limits. Claim
reproducible startup only after an owned restart and retained-data proof.
Boundary owner: self. Pause on ownership ambiguity, unsupported provider
preparation, a new data boundary, or the separately gated paid proof.

#### Delegation map

| Slice | Execution owner | Acceptance |
| --- | --- | --- |
| Truthful retrieval and citations | Native executor after main freezes the response boundary; existing explore child maps seams | Focused parser, MCP and activity-chip checks; deterministic browser and reload evidence |
| Portable local composition | Main; cross-system coupling and secret-handling boundary | Ownership and preflight tests, actual profile planning, bounded startup proof |
| Integrated qualification and delivery | Main; integration and final proof | Applicable native reviews, focused verification and accurate whole-branch draft publication |

#### Truthful retrieval and citations

Extend the existing normalizer, tool fallback and MCP response boundary rather
than replacing the merged wrapper support. Reproduce the real documents
envelope with a gateway reference, missing display metadata and nonempty chunks.
Count retrieved documents from valid source entries with chunks, not rendered
cards or chunk count. Distinguish malformed results from a genuinely empty
result. Preserve one source per document, first-chunk page metadata and current
citation numbering.

Main owns the model-facing correction at the existing MCP result boundary.
Remove ingestion gateway destinations from both structured and text payloads,
retaining opaque identity and non-link title/page metadata. Use established
metadata, or an honest generic document label when unavailable. Never derive
an original public URL from an uploaded filename. Verify nested wrappers,
non-clickable source presentation, result-count distinctions and reload with
deterministic fixtures.

Owned areas are the existing Chat source normalizer, tool fallback, MCP service
result mapping and their focused tests. Resolve exact service and browser-test
paths from the prerequisite mapping before editing.

#### Portable local composition

Implement opt-in setup, start, status, connect and stop under
`util/local-kb-stack.mjs`, focused tests, and `util/local-kb/` support files.
Document the supported sequence in the existing devcontainer README and
`docs/solutions/integration/local-kb-stack.md`. This is not the legacy API-only
ingestion launcher and must not start a competing fleet.

Require explicit `DATA_INGESTION_REPO`, `WEB_SCRAPING_REPO`, `DOC_QUERY_REPO`,
local paths and selectable ports. Do not clone or update providers. Record the
actual immutable provider baselines before implementation. Verify compatible entrypoints,
scope-header support and prepared state; revision equality alone is not enough.

Setup explicitly owns local configuration, owner-only signing material and
provider schema preparation. Start accepts only prepared providers and verifies
exact source/process identity and authoritative absence of queued or retry
work before credentialed workers run. Missing evidence blocks that provider.
Start never creates fixtures, migrates implicitly, rebinds a KB, or makes a
proof submission. Status is read-only and values-free.

Connect is explicit and transactional: validate the expected server, exactly
the two seeded Benibot Tutor/Explainer consumers, expected old KB and requested
new KB before changing anything. Mismatch produces zero writes. Stop validates
source path, PID start identity and port ownership, stops only owned groups and
preserves data. Upstream credentials remain process-only through the restricted
operator. The signer file must be an explicit opt-in regular owner-only input.

Use `ai,chat,email,live-quiz,manage`, excluding mock `mcp` and `full`. Reconcile
the Blob route with `playwright/runtime-contract.yml` and its consumer semantics
without inventing a Node build target or readiness endpoint. Acceptance includes
`devrouter profile plan --repo . --profile manage --contract playwright/runtime-contract.yml`
and affected host profile tests. Cover stale/reused PID, occupied port, partial
and repeated startup, identity mismatch and no-write preflight/status.

#### Qualification and evidence

Run focused Node 24 checks in the exact container, host profile checks and
deterministic browser verification. Review committed substantive slices with
the configured simplifier and risk reviewer, then obtain the integrated Sol
review. Earlier lifecycle-only reviews do not qualify this extension. New live
acceptance may remain explicitly pending at source publication; no additional
paid calls are included. Retain the runtime for the user's manual verification.

Native planner Carson approved the revised draft in round two. The report is
`project/_local/reviews/2026-09-07-local-kb-acceptance-plan-hardening.md`.

### Current integration and runtime checkpoint — 2026-09-06

The user explicitly approved integrating current v3 and recovering this exact
workspace with the latest devrouter. Source/runtime custody was released by
the coordinating task before work. Local merge 479a1045be incorporates
v3 at 27f2474547df045cc11302c7d9e195798ec66870 into the existing branch;
no protected branch was changed. Twelve conflicts were reconciled, preserving
the branch's participant authentication and MCP client cleanup alongside v3's
multi-KB and standard-mode contracts. The two remaining Next peer ranges were
aligned to 16.2.11 and the lockfile regenerated inside the container.

Container verification passed: 81 focused Chat tests, Chat/GraphQL/Manage
typechecks, and literal root check:all with 40 successful tasks. Staged
redacted gitleaks passed. The host merge hook was split after these container
checks. The integrated Sol review found one owner-preview scope mismatch:
KB relations are not the authority for multi-KB MCP scope. The correction
uses resolveMcpScope and has a passing eight-test route suite, including the
new configuration-versus-relation regression, and a passing Chat typecheck.
Sol's correction review passed on 4cb54e47d1 with no actionable findings.

Installed CLI and repository pin both equal the latest official devrouter
release, 0.0.55. Exact runtime identity remains workspace
rs-generation-lifecycle-contract, Compose default-rs-f189c, source
trees/rs/generation-lifecycle-contracts. Port override 10043 and the retained
Next cache marker were preserved. An initial ensure --repair passed all
readiness contracts without recreation, and delegated local login worked.
After dependency relinking during checks, Chat's live Turbopack process failed
with Next.js package not found and the app group exited. This is not a passing
final runtime result.

Normal reconciliation then recorded degraded state; two supported repairs
failed with Preparation for 'klicker-dev' left running children. A bounded
foreground build diagnostic passed 10/10 tasks but proved its surviving child
was /usr/bin/git diff HEAD --no-ext-diff --no-color. Disabling the optional
Turbo daemon did not resolve it. No helper or lock was bypassed. Other owners'
provider locks were left untouched. The remaining runtime recovery therefore
requires correcting or accommodating that foreground-process completion seam,
not another CLI version bump or database reset. A subsequent isolated comparison
found that invoking the installed Turbo binary directly, without pnpm exec,
completed with no surviving process in its group. The bounded candidate changes
only preparation to use that binary; the focused shell runtime suite passes,
including direct-execution and failure-propagation checks. Canonical repair is
completed after another workspace released the provider lock. The exact repair
run passed all six app contracts and both worker checks, reporting ready with
empty drift, eleven scoped routes, and no recreation or TLS refresh. Normal
delegated login and settings rendering passed after removing the browser mock.
The focused shell runtime suite passes; the separate unchanged hanging-response
test cannot run alongside live Auth because both bind port 3010 (EADDRINUSE).
That collision is not claimed as passing test evidence. No live service was
stopped to accommodate that test.

AI navigation has an independent local SDK fixture limitation: the configured
GrowthBook test endpoint is unavailable. A browser-only interception was used
for diagnosis and is not normal-browser feature availability or server
authorization evidence. No ingestion, graph, generation, provider request,
secret injection, database reset, deployment or cleanup was performed. The
user's keep-running request retains the exact runtime resources for the next
recovery checkpoint; the application is now running, but normal-browser AI
availability remains unverified pending resolution of the local SDK fixture.

Device-transfer checkpoint, 2026-09-06: the user explicitly requests publishing the current work as pushed draft PRs so another device can continue. This permits a work-in-progress source checkpoint before the previously required publication verification completes; it does not waive any verification or review gate before merge. Preserve pending browser, static assertion, runtime and implementation-review obligations. The adopted runtime source remains attributed to PR #5790, now merged; this checkpoint preserves the exact local candidate rather than integrating any upstream branch. Host identity, shell syntax, diff and redacted secret checks run for this checkpoint. Container-only hooks/builds remain unrun because the task runtime is stopped and startup qualification is blocked; do not report the checkpoint as tested or source-reviewed.

This package consolidates generation around the existing Element model and protects existing business behavior before v3-ai can qualify for stable v3. The backend consolidation is published on this draft PR. The approved remaining correction repairs two browser-test fixtures, the header overflow at smaller desktop widths, and the analytics loading-state redirect on profile failure; it does not change eligibility, permissions, account usage, or Element behavior.

Approval includes local edits, checks, independent reviews, commits, and publication to origin/rs/generation-lifecycle-contracts on this same draft PR. The user also approved reset and reseed of task-local klicker-prod in default-rs-f189c_pgdata and layout-only Header.tsx changes here. Preserve the release task's separate permission edits. No other database, task-to-target merge, deployment, or credential repair is authorized. Subsequent explicit v3-to-v3-ai merges and necessary target integration are recorded in Progress.

Acceptance requires the three inherited UI failures to pass with meaningful behavioral assertions, adjacent regression checks, and browser proof that navigation remains usable without horizontal page overflow. Required reviews precede publication. Stop the exact runtime after verification unless the user's manual-verification lease remains active; coordinate its release with the current owner. Persist results in this plan and the parent roadmap. Hosted review authentication remains a separate owner-held gate; source completion is not stable-release readiness.

## Execution details and research

### Approved UI qualification extension — 2026-09-05

The user approved correcting the three inherited UI failures on the existing draft PR. Restore the test contracts and the smaller-desktop layout without changing feature eligibility, backend authorization, account usage policy, or Element behavior. Credential repair remains with its existing owner. This section supersedes the earlier exclusion of these three UI failures only; the completed backend scope and its evidence remain unchanged.

Authority update, 2026-09-05: the user explicitly approved resetting and reseeding task-local klicker-prod in default-rs-f189c_pgdata for Playwright, deleting that database's current contents, and a layout-only Header.tsx correction in this worktree while preserving the release task's separate permission changes. These two approval boundaries are resolved for this bounded verification/correction workflow; other databases, peer workspaces, policy changes and upstream integration remain excluded. Revalidate the exact runtime/database identity before cleanup. The earlier paused checkpoint below is historical.

The updated test policy replaces the touched loading-copy assertion with behavioral protection: the unavailable state must render after an observed failed ManageUserProfile request, and no GetCourseActivityAnalytics request may be issued. Both named and persisted operations count. This supersedes references below to retaining the literal loading-text assertion; no UI copy is pinned. The test-only correction remains executor-produced and main-verified. Main owns the layout correction because runtime reproduction and the approved same-path ownership boundary are coupled.

- Baseline: c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f, clean and matching origin/rs/generation-lifecycle-contracts. Playwright run 33963182292 has seven passing shards and three failures in shard 8, also reproduced on exact-base run 33918795985. Fetched v3-ai is 795808d18e9d2fb41861ec10f89d43a752bb5cf8; no upstream integration is authorized or performed.
- Feature test correction: main verifies the absent-flag setup and failed-profile interception in playwright/tests/B-feature-access.spec.ts. The automatic browser fixture currently enables ai-beta; the absent-flag test does not override it. The analytics provider now requests ManageUserProfile, while its failure test intercepts UserProfile. Preserve the hidden-usage, no-query, unavailable-state and no-loading assertions. Ensure the failure stub observes the actual request, including the existing persisted-operation transport, before accepting a green result.
- Layout correction: main measures the unchanged library at 749 by 820 pixels with the same synthetic flags as the failing test. Identify the overflowing element before editing. Preserve four activity choices, sidebar width, content position, labels, focus and navigation. Use only the smallest demonstrated layout correction; do not hide page overflow or weaken the viewport assertion. Broader mobile redesign is excluded.
- Ownership: read-only fixture mapping used a native executor after the configured explore route failed before work with insufficient provider credits. That child completed and is closed. PR #5771 owns ChatAccountUsageSettings.tsx; the release task currently edits Header.tsx and chatbot permissions. Neither is delegated to this task. Stop before an actual overlapping edit and request custody direction; unrelated base movement alone is not a blocker. Main retains diagnosis because reproduction and ownership are coupled. A bounded executor may implement only the settled non-overlapping test correction after plan review.
- Verification and delivery: run the unchanged failing assertions as a red/green loop and adjacent feature-gate/layout cases; capture browser states before and after any visible correction. Run scoped formatting and applicable package checks. Review substantive committed changes with the configured simplifier and risk-selected slice reviewer; final review covers the integrated changed package, reusing unchanged backend proof. Continue the approved local-commit workflow, but do not publish an unverified UI correction. Keep the PR draft and preserve credential-review failure as a separate unresolved gate.

The task-owned manage runtime is resumed for synthetic browser inspection. The standard host Playwright launcher selects its database from committed configuration and global setup performs broad cleanup. Existing databases remain preserved: do not run that setup until the selected database is proven disposable under the existing approval, or the user approves the exact reset. Do not bypass the host launcher or modify shared runtime configuration. If native verification cannot proceed safely, retain the diagnosis and local candidate, stop the exact runtime, and ask at that database boundary. The monitoring heartbeat is paused while this extension is active.

Acceptance cases are `Keep chat account usage hidden when its feature flag is absent`, `Shows analytics unavailable when the user profile cannot load`, and `library keeps four activity choices across smaller desktops`. The first explicitly omits ai-beta in its browser fixture; the second proves at least one intercepted ManageUserProfile request before the existing unavailable/no-loading assertions. Decode persisted hashes as well as named requests. Reuse the remaining B-feature-access cases for enabled/disabled flags and backend denial, and W4-activity-wizard-safety cases for wizard entry, pristine/dirty cancellation, labels, focus and navigation, including `element creation remains available while an activity wizard is open`. Never substitute an unchanged assertion with a weaker one.

Planner round 1 requested explicit slice assignments, exact acceptance cases, and a timestamped target baseline. Accepted and applied; the earlier narrow UI exclusion override was already explicit, and is also linked from the historical non-goals below. Remote tracking v3-ai advanced during parallel work to 5c8ee4b6a034c22da8e85159214c629f371d0f3d (11 ahead, 8 behind); the earlier fetched SHA is an observation, not a current baseline claim. No integration occurred. Round 2: APPROVED with no blocking findings. Native planner Gibbs is closed. Its advisory note correctly locates focus/activity-description coverage in B-feature-access and layout/navigation in W4-activity-wizard-safety; both remain required. Transcript: project/_local/reviews/2026-09-05-ui-qualification-plan-hardening.md.

Browser diagnosis: with synthetic CI flags and a 749-by-820 viewport, document width is 761 pixels. The header user-menu menubar extends to x=761.078125; library activity choices remain within the viewport. Evidence: project/_local/ui-overflow-749-before.png. The release owner has an active Header.tsx edit, so this actual path overlap pauses the layout correction only. New scope, database-reset authority, changed policy, or a missing required review capability are material stop conditions; routine corrections and evidence updates are not.

Local checkpoint: executor Ampere produced only the B-feature-access candidate and is closed. It explicitly omits ai-beta while retaining other fixture defaults, intercepts named or hashed ManageUserProfile, and asserts an observed interception before the unchanged UI assertions. Main inspected every changed hunk; git diff --check passes. Browser/Playwright, formatter and package checks for this candidate remain unrun. It is uncommitted and unpublished, with required implementation reviews pending; passing backend receipts do not cover it. The launcher-selected database name is klicker-prod inside this task's retained default-rs-f189c_pgdata volume, not a production connection. Existing content was neither inventoried broadly nor deleted. Exact reset approval is still required. A values-free settings visibility command was never launched because the permission review timed out twice; no settings red/green result is claimed. Browser pr5777-ui is closed. Managed runtime stop succeeded and freed three routes. Fresh Devsy status for the source-resolved workspace rs-generation-lifecycle-contract is Stopped; the exact source-path workspace listing reports zero routes and no hosts. Runtime data and the worktree remain preserved. The user must resolve the header custody and exact database-reset boundaries before full qualification continues.

- Problem: v3-ai integrates working feature branches. Normalization must reuse that code and preserve existing business behavior before 3.4.0 RC can qualify for stable v3.
- Baseline: fetched 2026-09-04. Published AI 1765a2d6394fc9a3f18bddd330dda70438510e23; stable 468f05b91503b133670dda235be9a4b38bba2155. Owned sync is published as 208e97d38e6abfd13d997d48200077febc8c1445. The two generation service files match the published baseline at this local sync. Never integrate it ourselves.
- Evidence: questionGeneration.ts:384-417,851-887,1029-1079 and flashcardGeneration.ts:335-373,795-835 repeat 15-second owner-scoped synchronization lease acquisition and token-fenced release. Preparing/review claims require a status predicate; ordinary polling claims currently do not. These are not interchangeable generic state transitions.
- Existing behavior: elementGenerationDispatch.ts and elementGenerationAccounting.ts already own reserve/claim/settle/release. knowledgeGraphAccounting.ts:32-36,73-122 deliberately separates ordinary releasable reservations from human-review holds. Reuse them, do not introduce terminal-status-wide release.
- Existing test gap: questionGenerationLifecycle.test.ts mocks provider/storage/Prisma; it covers retry/poll contention and review dispatch but cannot establish PostgreSQL atomicity. elementGenerationDraftPersistence.test.ts mocks manipulateElement and therefore cannot prove generated content respects the real Element persistence boundary.
- Ownership: multilingual processed-document plan in trees/question-generation-english-e2e, owned by task Klicker KB KG, explicitly owns the ingestion webhook/polling reducer, active serving tuple, knowledge.ts, graph dispatch/readiness, shared schema/types and UI. Consume its delivered results; do not implement a competing reducer. [PR #5756 — resource replacement](https://github.com/uzh-bf/klicker-uzh/pull/5756) replacement owns knowledge.ts and cleanup. [PR #5771 — cost controls](https://github.com/uzh-bf/klicker-uzh/pull/5771) cost controls owns chatbot policy; [PR #5764 — response-example capture](https://github.com/uzh-bf/klicker-uzh/pull/5764) capture owns response examples. Do not redirect or edit other tasks.
- Research routing: public-source lifecycle/test mapping via explore failed pre-work HTTP400; generic native Luna max continuity used. Main retains architecture, ownership and regression interpretation. External documentation is unnecessary for behavior-preserving extraction using existing APIs; consult current primary docs if an API uncertainty arises.
- Advisor and rival review: Claude advisor and final-reviewer failed OAuth authentication before work. Record absence; no opposing-provider result is claimed.

## Identity and execution contract

- Plan: `project/2026-09-04-pr-5777-generation-lifecycle-contracts-plan.md`. [PR #5777 — generation synchronization leases](https://github.com/uzh-bf/klicker-uzh/pull/5777) is draft, targeting v3-ai.
- Parent: `trees/v3-ai-production-readiness/project/2026-09-03-v3-ai-pre-release-improvement-roadmap.md` in the repository's existing roadmap-custody worktree. This is a bounded first portion of W4 — lifecycle normalization, not completion of lifecycle normalization or data-model normalization.
- Tier/topology: full-path, one cohesive ordinary PR eventually targeting v3-ai. Backend lease reuse and its real database boundary tests are one independently useful concern. No new stack or changes to feature stacks. Subsequent data-model packages remain in parent roadmap order.
- Planning custody: existing trees/v3-ai-production-readiness. Execution custody: trees/rs/generation-lifecycle-contracts and branch rs/generation-lifecycle-contracts at published owned-sync 208e97d38e6abfd13d997d48200077febc8c1445. Only this plan is transferred, not custody branch history. Generation services, relevant tests and Prisma schema match the researched baseline. No duplicate owner branch/PR was found in the execution preflight.
- Owner: main; boundary owner: self. This task owns integration and review. No peer execution-orchestrator handoff or hidden supervisory task.
- Authority now: user approved local execution on 2026-09-04, including the goal, executor delegation, isolated runtime verification, required reviews and local commits. On 2026-09-05 the user additionally approved pushing rs/generation-lifecycle-contracts to origin and opening one draft PR targeting v3-ai, without merging.
- Approved execution: local worktree setup from the published sync, applying the existing schema to the newly created test-only database, in-scope edits, isolated synthetic test-runtime use, repository-native checks, required child reviews, Progress and local commits through source-reviewed terminal. This includes synthetic rows and their own scoped fixture cleanup in a dedicated local test database; existing repository cleanup/seed hooks are permitted only against the database created for this package and proven to contain solely disposable synthetic fixtures; no reset or broad cleanup of any pre-existing or shared database.
- Extension approval: on 2026-09-05 the user agreed to the planner-reviewed one-Element completion proposal and said proceed. This authorizes the completion-test and shared-completion slices below, task-runtime resume/use with scoped synthetic fixtures, native checks/reviews, local commits, push to origin/rs/generation-lifecycle-contracts and update existing draft PR #5777. The prior lease/persistence approval remains historical and distinct.
- Withheld: ready status, branch integration/rebase/cherry-pick, any merge, stack alteration, shared runtime changes, secrets, real data, paid application-model/provider calls, staging/production, shared feature flags, new or changed migration files, staging/production migration execution, deployments, branch/worktree deletion.
- Terminal: the completion extension is reviewed and published to the same draft PR with matching remote readback, roadmap evidence and stopped runtime; then exact-head hosted checks, ordinary feedback and final AI review settle, or a named material authority/blocker boundary remains. Publication is intermediate. Pending checks use one bounded watcher/heartbeat; no readiness claim with parked/failed gates.
- Pause: actual owner/path overlap; unpublished sync; missing safe test database; behavior changes beyond preservation; schema/public API/dependency change; an acceptance failure showing a pre-existing rule defect needing a separate decision. Routine slice/review corrections stay autonomous.

## Goal and non-goals

- Normalize generation around the existing Element domain. Completed scope shares synchronization leases and proves real Element persistence. Approved extension replaces initial question/flashcard completion transactions with one Element completion operation and protects compatibility with real database tests. Shared names or a dispatcher around duplicate transactions do not satisfy the goal.
- Zero Prisma schema, enum, relation, migration, Analytics model or public SDL changes. No identifier rewrite, state collapse, accounting redesign, retry-policy change, lease-duration change, renewal/heartbeat feature, provider contract change, generic workflow engine or new package/dependency. UI was excluded from the completed backend scope; only the three failures in the approved UI qualification extension above are now in scope, subject to its ownership and verification boundaries.
- Graph/resource lifecycle implementation remains with current owners. Expiry/cancellation additions, ledger choice, response-example digest transition, resource revisions and migration-tail rewrite are later explicitly reviewed packages. Unknown invariants needing future storage are recorded there, never stubbed.

## Primitive impact and invariant boundaries

- ElementGenerationBuild: reuse identity/owner/state; share existing lease acquisition/release and one initial-draft completion transaction. SC, MC, KPRIM and FLASHCARD are Element types, not separate product primitives. Content validation and provider-result conversion may differ; common lifecycle ownership and atomic persistence do not.
- GeneratedElementDraft and ordinary Element: reuse canonical normalize/validate/manipulate path and atomic link; test only, no new persistence owner.
- KBGraphQuota and ElementGenerationSpend: reuse existing ledger and exception handling, no changes.
- User versus Participant; Participation.isActive remains leaderboard opt-in, not access. AI entitlement is additional to resource permission, never a replacement. No modifications to these primitives.
- ADR gate: reversible internal consolidation follows the canonical Element model and existing accounting/graph ADRs; no new ADR. Changed public contracts, lifecycle behavior, data ownership or schema re-arm the decision gate. Preserve one-way imports into existing normalization and avoid cycles.
- Documentation: update docs/async-and-workers.md only with the accepted internal lease owner and direct source link; preserve domain semantics. Parent roadmap gets package and residual ownership status. No new glossary or broad wiki cleanup.

## Delegation map

- Baseline and contract inventory: main (architecture/ownership coupling); acceptance exact sync, owner exclusions and five caller contracts below.
- Lease consolidation: main owns interface and integration; executor may implement the settled local module/callsite change with finite paths, returning uncommitted diff; acceptance existing lifecycle suite plus lease database tests.
- Real Element regression evidence: executor on the new integration test only, serial after lease changes; acceptance real persistence/concurrency/rollback evidence and reused permissions/snapshot checks without bypassing auth/validation.
- Completion characterization: executor owns only test/elementGenerationCompletion.integration.test.ts; depends on approved frozen contract; acceptance direct real PostgreSQL proof on existing helpers.
- Shared Element completion: executor owns the new elementGenerationCompletion.ts, removal of old completion bodies, both generation callsites and new test imports; depends on characterization review; acceptance one actual shared transaction and unchanged contracts.
- Feature-test contract repair: executor after main's diagnosis, only playwright/tests/B-feature-access.spec.ts; acceptance is the two exact feature cases and observed fixture/interception contract above. Main owns runtime and accepts the diff.
- Smaller-desktop layout: main owns reproduction, overflow diagnosis, ownership check and minimal correction. Acceptance is the 749-by-820 contract and existing adjacent wizard cases above. Correction is currently paused for actual Header.tsx ownership overlap.
- Finish: main with simplifier and slice-reviewer on substantive committed scope, then final-reviewer on integrated scope. Depends on both new UI workstreams; do not claim the extension complete while either is paused. Children cannot integrate upstream or publish. All substantive slices serial in one worktree.

## Frozen caller contract

Preserve the current five claim sites:

1. Question preparation: owner+build+PREPARING_INPUT and null/expired lease; loser rereads owned build; failure handler remains caller-owned.
2. Question polling: owner+build and null/expired lease; retain outer terminal/runtime/accounting checks, without adding a status predicate.
3. Question review dispatch: owner+build+expected review status and null/expired lease; preserve durable review claim and exact replay semantics.
4. Flashcard preparation/retry: owner+build+PREPARING_INPUT and null/expired lease; retain independent retry spend and incomplete-publication recovery.
5. Flashcard polling/publication: owner+build and null/expired lease; preserve its distinct NON_SYNCHRONIZING statuses and runtime capability check.
   All retain fresh token, 15-second duration, strict expiration comparison (equal is not expired), token-conditional release and caller finally semantics. No provider call inside a new database transaction; no transaction shared with unrelated activities. Lease expiry may allow a replacement worker; existing durable dispatch claim remains the external-effect fence. Do not claim lease alone ensures exactly-once execution.

## Frozen Element-completion contract

- Expose one Element completion operation with typed inputs for currently supported generated element types. Existing question-provider input accepts SC/MC/KPRIM in FINALIZING, verifies question item types, keeps provenance/defaults and counts only duplicationIndex=0; commits COMPLETED. Existing flashcard-provider input accepts QUEUED/RUNNING/PUBLISHING_INCOMPLETE, counts all build drafts, preserves warning/unresolved/checkpoint fields and maps incomplete to INCOMPLETE, completed and completed_with_review to COMPLETED. Each of the three accepted flashcard source states accepts each of these three result statuses independently; preserve that existing compatibility matrix.
- Preserve initial read and final conditional-write predicates including build, type, status and lease token, error codes/messages, createMany skipDuplicates, and final row-count failure. Preserve current lack of direct owner predicate: entrypoint ownership and unguessable lease token remain the current composition; do not turn a hypothesis into an authorization change.
- Preserve re-entry: createMany skipDuplicates leaves matching existing drafts unchanged, and matching cardinality may satisfy completion. Do not overwrite original/current/provenance/defaults of existing rows or strengthen this into a content-equality/idempotency policy change.
- Draft writes and build completion remain in one existing Prisma transaction. Failure at draft cardinality, item type or final conditional transition must roll back every draft and artifact/counter/status write from that call. No success on a stale token or incompatible state.
- Completion creates review drafts, NOT ordinary Elements, activity snapshots, new dispatch/spend or release operations. Accounting/dispatch and the short lease stay separate.

### Completion implementation boundary

Use packages/graphql/src/services/elementGenerationCompletion.ts for one shared Element completion operation, called directly by both current provider workflows. One implementation owns the transaction, build/type/status/lease checks, draft insertion, cardinality assertion, final conditional update and rollback. Merely moving two transaction bodies into one file or hiding them behind a dispatcher does not satisfy the user ruling.

Use a closed, typed input for the currently supported provider result variants. Type-specific conversion validates and maps choices or front/back content into the existing GeneratedElementDraft shape. Keep conversion within the same transaction and after the current build check where required to preserve validation and error precedence. Retain original/current/provenance and the existing default/null behavior exactly.

The shared operation derives expected statuses, counting scope, terminal outcome and optional artifact/counter fields internally from validated result kind and the current provider contract. Callers cannot supply arbitrary Prisma predicates/update data, transaction callbacks or ad-hoc behavior flags. Distinguish content shape from provider phase: present source-state/count differences are compatibility constraints, not separate permanent Element lifecycles. Do not alter persisted enums, public operations or retry policy to make completion look uniform.

Keep one shared database path with small local conversion/policy branches only where the contracts differ; no plugin registry, generic workflow engine or new package. Remove the two old completion implementations and switch both callers to the same operation; no compatibility re-exports. Retain existing editable normalization and one-way imports. Adding a future supported Element type should extend its typed result conversion/validation, not copy the transaction or introduce a new completion service. This does not enable generation for currently unsupported Element types.

The wider roadmap carries this same convergence requirement for preparation, review, retry and saving: share common lifecycle and business services, isolate justified content/provider differences, and require evidence before changing incompatible historical behavior. This slice proves completion only, not the entire generation lifecycle.
Owned production paths: new elementGenerationCompletion.ts, questionGenerationDrafts.ts, flashcardGenerationDrafts.ts, and completion-callsite and import hunks in questionGeneration.ts/flashcardGeneration.ts. Tests: one new elementGenerationCompletion.integration.test.ts, existing questionGenerationLifecycle.test.ts only if a consequential wiring assertion is absent. docs/async-and-workers.md records the owner and same transaction boundary. No changes to editable draft operations, general Elements, auth/permissions, schema/Analytics/migrations, SDL/public operations, dependencies, workers, knowledge.ts, knowledgeGraphAccounting.ts, provider configuration, UI, or other worktrees.
Parallel ownership: Klicker KB KG actively owns processed-document schemas, graph serving state, webhook/polling/ingestion, graph accounting and associated UI. Recheck exact path overlap before editing; stop for actual overlap, not unrelated upstream movement.

## Test portfolio

- Lease ownership and races: extend questionGenerationLifecycle.test.ts only for uncovered caller wiring; add elementGenerationLease.test.ts real PostgreSQL two-client race, foreign owner, required-status mismatch, exact expiry boundary, stale-token release after takeover. Callback-error cleanup belongs in the caller-level lifecycle tests because the shared primitive does not own callbacks. Row assertions, not only mock call counts. Prove an old release cannot clear a successor claim. Do not infer universal state-write fencing from this acquisition/release primitive; characterize existing caller writes and stop on a reproduced unfenced business mutation. Preserve no-status poll variant.
- Existing spend safety: reuse elementGenerationAccounting.test.ts, elementGenerationDispatch.test.ts, knowledgeGraphAccounting.test.ts unchanged. Confirm duplicate reserve/settle, hold on uncertain claim, stale recovery and no provider dispatch after failed spend claim. Add no duplicate accounting suite.
- Ordinary Element boundary: retain elementGenerationDraftPersistence.test.ts for payload variants and Y-question-generation-review.spec.ts for real editor/save behavior. Add only missing database risks in elementGenerationPersistence.integration.test.ts: simultaneous identical keep requests produce one Element/link; conflicting requests cannot create an orphan or overwrite the winner; a controlled failure at the final link-write boundary rolls back the real Element and associated writes. Use real keepGeneratedElementDraft, manipulateElement, ownership/entitlement validation and PostgreSQL transaction. Allow a narrowly scoped test-only fault at the final link write, not a fake transaction or mocked Element service; document what the injected failure proves. Cover foreign-owner and disabled-entitlement no-write assertions here only if not already protected at an equivalent real boundary. Reuse existing element permissions/manual authoring and elementBatchOperations suites for non-AI behavior and explicit versus absent instance updates; add at most the missing non-AI entitlement case, not a second SC/MC/KPRIM/flashcard matrix. Do not change production behavior to make the tests pass.
- Stable sentinel suites: elementPermissions.test.ts, elementSharing.test.ts, coursePermissions.test.ts, courseChatbots.test.ts (leaderboard-inactive access), courseDeletion.test.ts/courseDeletionRequest.test.ts, elementBatchOperations.test.ts, manageAiFeatureGate.test.ts and packages/grading existing suite. Reuse existing tests, no new broad app suite. These are representative regression checks, not proof of every business rule.
- Unchanged structure: exact diff excludes Prisma/Analytics models and migration paths, SDL, package/lock manifests, types, worker configuration, request validation/Element services. Generated SDL equality and schema-sync check must pass. Unexpected changes block acceptance; never bless as formatting.

### Initial Element-completion evidence

1. Add a direct real PostgreSQL completion suite at the existing completion seams for baseline, then the single Element completion operation. Use one detailed stored-shape success per provider-result variant for original/current/provenance and counters/artifacts. Parameterize question SC/MC/KPRIM acceptance and flashcard QUEUED/RUNNING/PUBLISHING_INCOMPLETE source-state acceptance with distinct COMPLETED/INCOMPLETE terminal outcomes. Do not multiply parser payload matrices.
2. Same suite: stale token and incompatible from-state reject for both supported provider-result variants through the same operation with no new drafts or build mutation. Cover question item-type mismatch and each variant's different draft-cardinality rule. Cross a question-result variant with a FLASHCARD build and the flashcard-result variant with a question build; assert the existing exact error code/message and no draft/build mutation. Add one matching pre-existing-row re-entry case per payload family, proving existing original/current/provenance/defaults are unchanged. Use compact service-level parameterization for all nine accepted flashcard source-state/result-status combinations. Existing lease acquisition tests remain unchanged; do not duplicate them.
3. Same suite, one takeover case for EACH existing provider-result variant: lose the lease AFTER the initial read but BEFORE the terminal update. Use the existing Prisma query-extension barrier pattern from elementGenerationPersistence.integration.test.ts:82-105, narrowed to the target build's real initial findFirst; execute query(args), retain its actual result, signal arrival and await explicit release. A second real database client takes the expired lease through acquireElementGenerationLease with the existing clock seam. Require distinct backend identities and one successful successor claim; then release the suspended completion call. Assert CONCURRENT_MODIFICATION, zero leaked inserted drafts, unchanged winner token/state/artifacts and no spend/quota mutation. Bound the barrier and release it in finally. No mocked Prisma transaction or database result and no production test hook. The test-only query extension controls scheduling, not returned data. Use bounded waits and finally cleanup of both clients and barrier. Broad table locks and polling database lock views are unnecessary. If a deterministic real barrier cannot be implemented safely, stop with the exact gap rather than weaken the assertion.
4. Reuse existing accounting/dispatch, lease, generated keep and lifecycle tests plus existing Element/permission/activity sentinel suites from the current plan. No new save-entrypoint, preparation-failure or generic status matrix in this extension. A baseline defect becomes a preserved reproducer and user decision; never silently patch behavior or assert incorrect behavior as desired.

## Slices

### Contract baseline and test foundation

- Route main, reason architecture/ownership coupling. Record published synced base, current open PR overlap, versioned schema/migration file inventory, five callsites, their predicates and exception paths. No schema edit.
- Check known tests once against baseline in isolated runtime. Record baseline failures before editing; no pass by weakening tests. Add only absent contract fixtures/tests, sharing existing synthetic helpers when safe.
- Commit approved plan first (docs(project)); next test commit only if independently meaningful evidence. No plan-only PR.

### Shared generation lease, preserving both workflows

- Route executor for finite implementation after main freezes contract above. Paths packages/graphql/src/services/elementGenerationLease.ts (new), questionGeneration.ts, flashcardGeneration.ts; test/questionGenerationLifecycle.test.ts and test/elementGenerationLease.test.ts. Main accepts diff.
- Extract only acquisition/release primitives, not business transitions or arbitrary update-data API. Use explicit owner/build/optional expected-status selection matching caller table. Preserve type safety, transaction-client compatibility where existing code requires it, error propagation and finally ownership.
- Caller-specific failure resets stay where they are; do not deduplicate recordBuildFailure/recordStartFailure or merge question/flashcard state sets. Inventory remaining direct writes and label their existing domain owner; no empty grep milestone.
- Check lease database matrix and existing lifecycle, dispatch/accounting suites, package check/lint/format. Commit refactor(graphql), then simplifier and one architecture/concurrency slice review. No generic auth/lock helper.

### Prove generated content respects existing Element rules

- Route executor for finite test path; main owns fixture/auth interpretation. Paths packages/graphql/test/elementGenerationPersistence.integration.test.ts only, reuse existing synthetic setup; prefer local helpers in test over touching global helpers.
- Implement only absent integration obligations in portfolio. If behavior fails on baseline, preserve repro and ask before source fix; do not silently turn regression qualification into a new business rule.
- Check real database integration plus stable sentinel suites serially. Commit test(graphql); risk reviewer covers data-integrity evidence, simplifier required for substantive new regression-test logic; skip only documentation, mechanical or assertion-only edits that preserve the tested contract.

### Characterize initial Element completion

- Route executor; owned path packages/graphql/test/elementGenerationCompletion.integration.test.ts only. Add the approved completion portfolio against existing helpers. Main controls runtime, accepts the diff and runs the focused baseline suite.
- Preserve existing source behavior. A reproduced baseline defect requires a ruling, not an unplanned production fix or weakened assertion. Use one synthetic database and bound all barriers/cleanup.
- Commit test(graphql), then dedicated simplifier and data-integrity slice reviewer on the immutable range. Disposition before the next slice.

### Install one shared Element-completion transaction

- Route executor after characterization is accepted. Implement the frozen completion boundary above in finite owned paths; migrate both callers and new test imports. Main owns integration and verification.
- Remove both old transaction bodies, without a compatibility façade, generic registry, caller-defined predicates or arbitrary updates. Future supported types extend typed conversion, not transaction duplication.
- Run the completion suite and existing lifecycle/lease/accounting/keep tests plus package checks. Commit refactor(graphql), then simplifier and architecture/data-integrity slice reviewer. Preserve exact error/default/re-entry behavior.

### Integrated local qualification and reconciliation

- Route main, critical-path integration. Update docs/async-and-workers.md and this plan. Re-run affected tests and repo check:all/build inside isolated worktree container. Restore no unrelated edits.
- No UI or provider behavior changes intended. Existing Y-question-generation-review and agent-browser evidence covers completed-build editing and real Element save, not initial completion. Reuse it unless the change materially alters that tested wiring; direct completion database proof is mandatory. Exact-head hosted Playwright remains a qualification gate; no paid provider calls.
- Exact committed scope final review: correctness, existing contract preservation, data integrity/concurrency, bounded security and architecture; not a broad security audit.
- Stop and verify exact task runtime unless user keeps it. After local gates, push the approved extension to origin/rs/generation-lifecycle-contracts and update the same draft PR; continue hosted qualification around explicitly parked blockers. Parent W4 — lifecycle normalization remains partial; ingestion/graph owner work and broader transition normalization not declared done.

## Verification execution

All package commands run inside task container via devrouter exec <exact-checkout> --; host only Git/gh and pnpm playwright:host -- playwright/tests/Y-question-generation-review.spec.ts --project=chromium. Inspect current test script first: GraphQL test:local starts/stops shared compose volumes and prints token prefixes; do not use it in this parallel workflow. Use test (vitest run) directly in isolated configured runtime, serialized and with synthetic DB guard before mutations. Existing GraphQL testCleanup and Playwright global setup use unfiltered deleteMany; never run them on a reused worktree database. Create one dedicated empty database for this package, explicitly inject DATABASE_URL before Prisma import and never use the helper fallback URL. Run GraphQL and browser phases serially, keep the app connected to the database used by host Playwright, and allow native cleanup/seed only after proving all rows belong to this disposable fixture environment. Do not change global helpers or weaken cleanup guards.
Focused: pnpm --filter @klicker-uzh/graphql test test/questionGenerationLifecycle.test.ts test/elementGenerationLease.test.ts test/elementGenerationDispatch.test.ts test/elementGenerationAccounting.test.ts test/knowledgeGraphAccounting.test.ts test/elementGenerationDraftPersistence.test.ts test/elementGenerationPersistence.integration.test.ts test/elementGenerationCompletion.integration.test.ts. Do not insert an extra `--`: pnpm 11 forwards it to Vitest, which then ignores the intended file filters. Confirm the finite file selection before execution.
Sentinels: same test command with named stable files above; pnpm --filter @klicker-uzh/grading test. Finish pnpm run check:all and pnpm run build. No new tooling. Reuse evidence on unchanged source/environment.
Before tests prove isolated local DB identity via values-free host/db class and synthetic fixture counts, correct worktree and absence of concurrent users; use no production URL or external service. Runtime skill at startup/finalization. If missing, block runtime checks without establishing shared/production connectivity.

## Data-model acceptance inherited by subsequent roadmap packages

This package leaves schema definitions and migration files byte-identical; synthetic test rows are temporary. Later model changes each require an exact before/after ownership map: one authoritative state owner, independently required identities, cardinality/uniqueness, nullable lifecycle semantics, immutable provenance and public consumer projections. Retain justified serving snapshots/audit ledgers; normalization does not mean eliminating every duplicate field.
Require generated migration provenance and minimum count, supported-data backfill without orphaned links, Prisma/Analytics equality, tracked SDL/codegen, custom indexes/checks/defaults preserved, production-applied and stable-branch migrations immutable, old-app/new-schema rolling compatibility and forward recovery. Any approved AI-only history rewrite needs its own allowlist, staging pause and production inventory. A feature flag never excuses malformed schema.
Trace effects on manual Elements/instances, derived permissions, activities, course deletion, invitations/assessment, points versus XP, chat budgets and participant ownership. Reuse existing business services instead of parallel AI-only implementations. Tests run against approved baseline and candidate; existing regressions and new ones are reported separately. This is a roadmap gate, not permission to edit those domains now.

## Planning review

- Element-completion architecture: user ruled one Element approach on 2026-09-05. The earlier two-body proposal is superseded. Fresh native planner round 1 REVISE, round 2 APPROVED; crossed types, unchanged pre-existing-row re-entry, full flashcard state/result compatibility and explicit main/executor ownership accepted. Report project/\_local/reviews/2026-09-05-element-completion-architecture-plan-hardening.md. User then approved execution and own-branch draft publication. Claude advisor again failed OAuth before work; no cross-provider result.

- Native planner: round 1 REVISE; round 2 APPROVED on 2026-09-04. All three findings accepted and verified: retain explicit instance updates, reuse terminal-fixture UI evidence without claiming lease proof, and isolate destructive test hooks in one new synthetic database. No blocking findings remain.
- Research mapping found no confirmed source defect. Generation belongs to the GraphQL services; there is no Hatchet elementGeneration.ts at this baseline. Existing provider-correlation, accounting and maintenance paths remain owners of their effects. Processed-document source-identity compatibility remains an acceptance obligation for the active owner and later model normalization, not a competing implementation here.
- Review evidence is retained locally under project/\_local/reviews/2026-09-04-generation-lifecycle-contracts-plan-hardening.md. Native review approval does not grant implementation authority.

## Progress

### Current verified state — 2026-09-08

The local branch includes the disabled-fixture recovery and both verified browser-test corrections. The same draft remains published at b82f5b83e6; publication is pending acceptance and integrated review. Resolved target v3-ai remains df1ea25580 and is integrated. Fresh remote refs show the task baseline 48 ahead of its upstream and 168 ahead / 4 behind the remote default v3, before the recovery commit. Target movement alone requires no merge.

Canonical retained recovery succeeds on the exact generation source path, workspace rs-generation-lifecycle-contract, Compose default-rs-cea28. No database was deleted. The first candidate used a text-array insertion based on the old temporary test schema and failed startup; main corrected both to the application's JSON column type, stopped the failed runtime, and verified the corrected retained repair. The installed host devrouter now reports 0.0.59; no tooling configuration was changed by this task.

The disposable guard and live synthetic readback pass: two MCP bindings disabled, exact native parent ownership, chatbot DRAFT. The extended PostgreSQL temporary-table acceptance passes recovery, repeated rotation, activation preservation and rejected-write rollback. All 19 MCP authentication tests pass. Scoped Biome passes. Prior 26-task production build, 40 type checks, seven lint tasks, Syncpack and 33 Chat route tests remain applicable to their unchanged surfaces.

The four-case browser run completed producing cleanup and seed: all three original acceptance cases pass, the adjacent unauthenticated analytics case initially failed on an aborted overlapping login navigation. Recovered trace evidence shows real Unauthorized responses and a final Auth HTTP 200. A fresh no-cookie engineering browser reaches Authentication without errors. Replacing only the URL matcher with polling of the exact current Auth origin/path resolves the race; the isolated browser case passes with zero analytics requests. All four required cases now pass across these scoped runs. Post-browser guarded readback showed zero fixture bindings; canonical stop and normal retained startup succeeded, and readback confirms two disabled bindings plus a DRAFT chatbot. A native simplifier found no justified reduction; the risk reviewer found no code defect, and its pending recurrence concern is resolved by this producing evidence. Post-cleanup restart/readback is complete. Canonical final stop succeeded and freed eleven routes. Fresh source-matched inventory shows zero routes, and Devsy reports Stopped. No keep-running lease exists. Integrated final review passes on e9641fbc900cbfdd76b051ba6df0c7245c760f96 with no findings. Publication to the existing draft is the remaining local delivery action; hosted CI and hosted-review authentication remain separate merge gates. No merge or release readiness is claimed.

### Retained fixture recovery — 2026-09-08

The current recovery uses the retained generation runtime; this supersedes the prior deletion proposal. Native and Playwright seeds use different course IDs. Adapt the absent-parent restoration from sibling commit 11db845b only in local-mcp-seed.mjs and its existing temporary-table acceptance script. Restore exact owned parents with both MCP bindings disabled, reject absent legacy unauthenticated bindings, preserve existing activation flags, and retain normal bootstrap bearer rotation. The native allowedTools column is JSON. Correct the existing temporary-table harness, which incorrectly used a text array, so its insertion checks match the application schema.

Route: main; the previous executor returned no patch and the ownership/activation decision is coupled to recovery. Acceptance starts with syntax and exact diff inspection, followed by canonical retained ensure --repair on the exact source checkout with KB_GRAPH_BLOB_HOST_PORT=10053. Once canonical execution works, run the existing PostgreSQL temporary-table acceptance and the disposable-database guard. Cover scope-token and marked-bearer restoration, disabled bindings, legacy no-write rejection, existing enabled/disabled/mixed preservation, repeated repair identity, parent/owner conflicts, interruption and rollback. These database checks are pending until execution becomes available.

Run the three focused browser cases and adjacent unauthenticated analytics case through the canonical host launcher. Require producing setup evidence for cleanup and seed, verify missing fixture bindings afterward, then canonical stop/start and values-free readback proving both restored bindings remain disabled. Stop the exact runtime and verify provider stopped plus zero routes. If retained repair fails, stop and report its evidence; no deletion or lifecycle bypass. Reuse unaffected verification, complete armed reviews and publish to the existing draft only after acceptance.

Native planner Boole reviewed this bounded plan: round one REVISE; all four acceptance findings incorporated; round two APPROVED. The prior successful isolated advisor consultation remains applicable. User proceed authorizes this in-scope fixture correction; no new provider, database deletion, activation or protected-branch action is added.

### Historical device-transfer authority

Device-transfer checkpoint, 2026-09-06: the user explicitly requests publishing the current work as pushed draft PRs so another device can continue. This permits a work-in-progress source checkpoint before the previously required publication verification completes; it does not waive any verification or review gate before merge. Preserve pending browser, static assertion, runtime and implementation-review obligations. The adopted runtime source remains attributed to PR #5790, now merged; this checkpoint preserves the exact local candidate rather than integrating any upstream branch. Host identity, shell syntax, diff and redacted secret checks run for this checkpoint. Container-only hooks/builds remain unrun because the task runtime is stopped and startup qualification is blocked; do not report the checkpoint as tested or source-reviewed.

### Historical target integration checkpoints — 2026-09-07

Latest checkpoint: HEAD a4c8333ac includes the latest published v3-ai target df1ea25580. Full production build passes all 26 tasks; type checks pass 40 tasks, lint passes seven, focused formatting and Syncpack pass. The native source mapper verified that the remaining analytics fixture must fail ManageFeaturePreferences, not authentication-owned ManageUserProfile. Main verified the call sites and applied exactly that one-line interception correction; unavailable visibility, observed interception and zero analytics-query assertions remain unchanged. Main retained the mechanical correction because delegation costs more than the single verified substitution. The correction is uncommitted and browser-unverified.

The browser rerun is blocked before execution: prior Playwright cleanup removes local MCP bindings, full-profile startup fails authenticated fixture validation, and canonical exec cannot reseed while lifecycle is blocked. Canonical stop succeeds, but subsequent ensure --profile manage attempts to repair the recorded full profile and fails on the same MCP fixture. No lock bypass, manual state-file edit or additional deletion occurred. Next: restore supported execution or profile recovery for this exact runtime, run native seed:raw against its marked disposable database, then rerun the three acceptance cases and required adjacent cases, final review, and draft publication. Prior successful receipts remain reusable. No generation push or readiness claim is made.

Fresh runtime recreation succeeded with zero drift and a passing disposable-database guard. All 19 focused local MCP authentication tests and all 40 package typecheck tasks pass. Canonical host browser execution completed: absent-ai-beta usage protection and smaller-desktop four-choice layout pass; analytics profile-failure handling fails because the intercepted ManageUserProfile error redirects to Auth. A native read-only explorer is tracing that exact boundary; no auth policy or assertion was weakened. Host pnpm 11 requires pnpm_config_verify_deps_before_run=false (not npm_config) to avoid its automatic install path; run the canonical util/run-playwright-host.mjs with pinned Node and that environment setting. Runtime remains active during this approved diagnosis.

The user explicitly approved exact generation runtime deletion/recreation in the visible conversation. Canonical deletion completed with deleted=true and zero routes; provider readback reported the old registration absent. Fresh manage-profile recreation is running with port 10053 and the marked disposable-database configuration. This resolves the earlier approval blocker; verification remains pending. Git work and peer runtimes are preserved.

Latest target is published as df1ea25580136bf1dc70b05dc8e18a633374b371. It includes normal v3 merge 43520ff2a8 and preserves concurrent Knowledge Base fix 57c802ac68. Docker recovered; generation canonical stop succeeds, but non-destructive repair still refuses changed Compose app configuration. No runtime deletion occurred. The explicit deletion/recreation approval boundary below remains, and this checkout still retains its prior uncommitted merge pending verification.

Latest continuation: v3 was merged into v3-ai with normal two-parent commit d03d4830622984d43e6712e30f06673a7f2b85cf and pushed; remote readback matches. Its v3 parent is 7c73ed231ce89885f634d37fece86c621424f617. Merge verification and review are recorded in the v3-ai checkout under project/_local/reviews/2026-09-07-v3-ai-merge-final-review.md. The separate merge-verification runtime is stopped, with provider Stopped and zero exact routes.

Host verification on the integrated source passes `bash util/test-dev-runtime.sh` and the one `util/dev-runtime-readiness.test.mjs` test. The initial sandboxed attempt could not inspect processes and is not counted; the completed host retry is the passing receipt.

The generation checkout now has a conflict-free, uncommitted merge of that published v3-ai target into d50988c34e5d39610ab6e08e8634087aaccd2a7e. The existing duplicate-test cleanup and Progress changes remain preserved and unstaged. Diff hygiene passes. No generation merge commit or push is claimed. Qualification cannot resume: recorded full-profile repair refuses `Managed Compose configuration changed for service 'app'` after the upstream disposable-database configuration change. Source-resolved Devsy rs-generation-lifecycle-contract remains Stopped with zero routes. The retained database and caches are preserved.

Automatic approval review rejected canonical exact-runtime deletion/recreation because the visible transcript lacks explicit destructive-deletion approval, despite the historical plan approval below. No deletion executed. Next: obtain explicit approval for `KB_GRAPH_BLOB_HOST_PORT=10053 /tmp/v3-ai-devrouter stop . --delete --json` in this generation checkout, recreating only its managed synthetic database/caches; then canonical ensure with port 10053, verify the marked disposable database, run pending focused checks and browser acceptance serially, complete integration/reviews, and publish to the existing draft. Git work and peer runtimes remain excluded from deletion.

Latest stopped checkpoint: fixture repair is committed locally as d50988c34e5d39610ab6e08e8634087aaccd2a7e. Independent slice review returns no findings; the simplifier identified two duplicate test entries, which main verified and removed in an uncommitted follow-up. Both reviewers are closed; reports are in project/_local/reviews/2026-09-07-local-mcp-fixture-{simplifier,slice-review}.md. Forty package checks, seven lint tasks, staged formatting, Syncpack, 68 host policy checks, 13 launcher checks, identity/schema/wiki checks and redacted staged secret scanning pass through their supported host/container split. The original 35 focused fixture tests and transactional suite remain passing evidence for the committed implementation. The follow-up test rerun could not launch after two automatic approval-review timeouts.

The broad browser run logged ten passes and nine failures before interruption; its remaining cases did not run. It overlapped generated-package checks, so rerun acceptance serially rather than treating this partial run as clean regression evidence. Independent HTTP probes confirm dynamic course and analytics routes return 404 while the root returns 200. The repository-supported request-repair for frontend-manage was recorded, but subsequent reconciliation stopped on missing synthetic MCP bindings after Playwright cleanup. The approved native reset/push/seed sequence could not launch after two automatic approval-review timeouts. No database restoration or cache repair completion is claimed. Next: restore this task's synthetic fixtures through the native sequence, apply the pending Manage repair with canonical ensure --repair, verify the dynamic route, then rerun the original acceptance cases and only the necessary adjacent cases without concurrent generated-package checks. Preserve all auth/test assertions. Full production build, integrated-final review and publication remain pending.

Canonical shutdown is freshly verified: Devsy rs-generation-lifecycle-contract is Stopped, its exact workspace has zero routes and no hosts, and app 83f4f48542fb5854c070dcad9cf505dc25094aaf9984bceb2479cccb974871aa is exited. Keep port 10053 for subsequent lifecycle commands. No push, extra target integration, peer-runtime mutation or handoff sync occurred. This status and the duplicate-test cleanup remain uncommitted.

Resumed qualification: fetched refs confirm zero behind the integrated v3-ai target; no further integration occurred. Normal startup and the canonical browser launcher both complete dependency preparation, so the previous Rollup stall does not currently reproduce. Forty package check tasks, staged formatting, seven lint tasks and 68 host policy tests pass. The aggregate check's host-Devrouter policy failure is covered on the host; its interrupted typecheck/lint branches were rerun separately. The broad browser run was interrupted after repeated navigation failures; it is not an acceptance pass. Direct HTTP probes independently confirm existing dynamic course and analytics routes return 404 while Manage's root returns 200. Both source files are mounted, but the development page manifest lacks their entries. Preserve authentication and test assertions while diagnosing local route generation. The scoped MCP fixture's earlier 35-test and transactional receipts remain applicable; its implementation review remains pending.

Final retry checkpoint: the single-case diagnostic never reached Playwright. Canonical dependency preparation emitted the Prisma Rollup bundle in 2.8 seconds but its Rollup process remained alive in an event wait for more than twelve minutes. Main interrupted the exact host launcher; exit 130 is an interrupted run, not a browser failure. The retained first-run trace confirms Unauthorized profile/scope responses and a 200 login-data request, but lacks that response body and does not establish the redirect failure's cause. Temporary test diagnostics are removed; no global authentication source changed. The configured advisor catalog is available, but automatic approval review timed out twice before the isolated source-only consultation could launch. No advisor result is claimed. Next action is to restore successful canonical dependency preparation, then rerun the unauthenticated redirect case and adjacent acceptance checks before implementation review and publication.

Shutdown is verified: canonical stop freed eleven routes; Devsy reports Stopped for rs-generation-lifecycle-contract, exact source-workspace readback reports routeCount zero and no hosts, and app container 83f4f48542fb5854c070dcad9cf505dc25094aaf9984bceb2479cccb974871aa is exited. Compose identity is default-rs-a29e3; retain KB_GRAPH_BLOB_HOST_PORT=10053 on future lifecycle commands. The isolated generation-auth browser is closed. The fixture candidate remains uncommitted; HEAD is still 2ddf4a380f2dc2203bad4f8c3fa32a31eeb79d4d, with no push or new target integration. Full build and required fixture/UI reviews remain pending. No new handoff sync was attempted.

Browser qualification checkpoint: the first four-case run passes the absent chat-account flag, observed profile-failure/unavailable state, and smaller-desktop library layout cases. The unauthenticated analytics case fails its unchanged login-redirect assertion with a blank page. A separate isolated agent-browser session reaches the expected auth page with the same feature flags, so the cause is unresolved. Temporary test diagnostics report only page errors and GraphQL error messages; remove them before committing. Playwright global setup deletes courses/users and cascades away the local MCP bindings. The task-only synthetic database was reset, pushed and reseeded through native commands, then canonical repair completed with zero drift. The single-case diagnostic retry is in canonical dependency preparation, before browser execution. No authentication source change or new passing browser result is claimed.

Recreation and fixture proof: the approved exact deletion completed, provider registration was absent and old task containers were absent. The same checkout was recreated with port 10053; full-profile readiness reports zero drift. Thirty-five focused MCP/authentication tests, temporary-table seed rotation/rollback checks and Chat typechecking pass. The bounded scan ran 200 rules on the two changed implementation files with zero findings. Canonical host Playwright is now retrying the four original browser regressions. Keep the port override on every future ensure/exec/stop for this runtime. No fixture activation state changed.

The user explicitly approved deleting and recreating only this task runtime and its synthetic database/caches with KB_GRAPH_BLOB_HOST_PORT=10053. Git work and peer runtimes remain preserved. This resolves the port-recovery approval gate below. Native executor James completed the two-file regression candidate and is closed; main owns its final inspection and runtime checks.

Retry checkpoint: fetched refs still contain the integrated v3-ai target with zero target-behind commits; no additional integration performed. Main implemented the bounded local fixture candidate, retaining configuration activation state and all owner/course/tool constraints. Syntax and diff checks pass; executable checks have not run. Canonical retained startup fails because a peer runtime owns host port 10003. The documented KB_GRAPH_BLOB_HOST_PORT=10053 override is rejected by repair with `Managed Compose configuration changed for service app`. Do not mutate peer runtime or retained lifecycle records. Exact task stop succeeded and the app container is exited. Approval is pending for exact runtime deletion/recreation, including synthetic database/caches, with the new port. Native executor James (01a07c36-aee0-7500-8240-292b442bed4f) owns only the two focused test files and is completing a bounded correction.

The user approved continuing the local fixture reconciliation. Main owns its authentication/ownership seam; a native executor owns only focused unit and temporary-table regression tests. Recognize the exact current scope_token seed in addition to the old legacy shape, preserve every disabled/enabled configuration, and normalize only the local transport authentication and obsolete chatbot-ID forwarding. Do not enable tools, alter production seeding, weaken foreign-owner checks, or inject paid-provider keys. Acceptance requires ownership rejection tests, transactional seed/rotation/rollback checks and canonical startup before the original browser cases. The completed integration source review finds no merge-resolution defects; its known upstream fixture mismatch is this authorized repair.

Local merge checkpoint: 2ddf4a380f2dc2203bad4f8c3fa32a31eeb79d4d includes target 654621094c63b977937202269c210edc0af1e8c2 and is not pushed. Source reviewer Mill, native child 01a07c23-8660-7110-a02a-506c60eaf666, remains active on the complete 97-path first-parent range; await this child rather than spawning another. Runtime shutdown is verified: exact source-path canonical stop succeeded, Devsy reports Stopped, app container exited and workspace routeCount is zero. The local-fixture decision remains pending. Automatic approval review rejected handoff saving/sync because its external destination was unverified; no new handoff was saved. This status paragraph is an uncommitted checkpoint.

The user requested another retry and explicitly authorized pulling in the latest target branch. Live draft PR #5777 targets v3-ai. This pass integrates origin/v3-ai at 654621094c63b977937202269c210edc0af1e8c2 into the previous local v3 merge, 7563dc45b0edf8081b0f46664b07e02b433fd42f. The target includes the feature-access corrections and newer v3 integrations. Eight conflict files are resolved; the absent-flag and observed-profile-failure browser assertions remain intact. Owner preview adopts the target's complete knowledge-base array. No PR merge or deployment is authorized.

Main owns integration and runtime diagnosis because the merge resolutions and their acceptance checks share the critical path. Acceptance requires a conflict-free index, focused MCP tests, package checks, and the original browser regressions. Existing reviews of the previous v3 merge remain applicable to unchanged content; this target integration needs its own bounded source review after commit. Final UI review remains pending.

Host launcher/profile tests pass 28/28; target release-policy and final-review tests pass 82/82. Host Playwright, Prisma client, shared types, bcryptjs and jose imports succeed. pnpm 11 defaults to automatic installation before run/exec; a temporary process-only verify-deps-before-run=warn setting avoids that implicit installation for the existing host runner. No dependency directories were removed. Invoke the Volta Devrouter shim from this task checkout, where it resolves 0.0.55; invoking it from the primary checkout resolves the older pin.

Canonical runtime repair reaches the new authenticated local MCP bootstrap, then rejects the retained synthetic fixture. Scoped readback proves exactly one KB server, passChatbotId=false and default header. The committed seed configures scope_token, no chatbot-id forwarding and disabled Tutor/Explainer configurations; the target bootstrap accepts only the legacy none/enabled fixture or its marked bearer successor. This is an integration contract mismatch, not missing paid-provider credentials. Preserve ownership/authentication checks. A question about reconciling this local-only fixture is pending while independent source verification completes. No browser test ran in this retry.

Verification for this target merge passes: 76 focused MCP/authentication/source-normalization tests, 40 package check tasks, 28 host launcher/profile tests, 82 target release-policy/final-review tests, 56 additional host policy tests, staged formatting, lint, Syncpack, schema mirroring and staged redacted secret scanning. GraphQL regeneration matches the tracked SDL. The initial check failed on stale generated operations; the passing rerun followed GraphQL regeneration. A dependency-closure build stopped progressing after emitting util output and was interrupted; the direct GraphQL build succeeded. Full production build and browser qualification are not claimed. The merge is a local source checkpoint; publication and integrated-final review remain pending the runtime contract decision. No simplifier is needed for this mechanical integration; bounded integration source review remains next.

### Destination v3 integration — 2026-09-07

The user explicitly requested integrating the latest v3 to consume its host-tool selection fix. The merge uses origin/v3 at ac5c8a64442f6d7ef0a54afa068d63b6d1fdaf56 and remains in progress until verification and commit. This is one approved integration pass; the PR base remains v3-ai. Generation custody is now trees/rs/generation-lifecycle-contracts on the destination machine. The restored branch started clean at b82f5b83e6b6e4fc9d6012734cfcb40ca445b757, matching its own upstream.

Resolve both branches' intents: explicit host Devrouter selection, Turbo CI dependency builds, standard chatbot mode settings, multi-KB scope validation, and request-scoped MCP client cleanup. Preserve the existing Student Practice client export and adapt the owner-preview single-KB request to the array contract without broadening its scope. Main owns the authentication and lifecycle seams; the native executor was closed after continued discovery beyond one narrowing checkpoint. Main resolved the six CI/tooling/lockfile files without a replacement worker. All ten main-owned conflict-related TypeScript files passed syntax parsing; this is not a typecheck or runtime test.

Destination verification: host Devrouter 0.0.55 became available without installation by this task. Canonical Manage startup succeeds with zero drift in destination Compose project default-rs-62e53. This is the newly created task-only synthetic database; source-device volume and port overrides do not apply. All 65 focused MCP tests, 40 package typechecks, 26 production build tasks, staged formatting, 68 host CI-policy tests and 13 host-launcher tests pass. The aggregate container check exits one because its installed-Devrouter test belongs on the host; its equivalent host suite passes. Package-manager regeneration repairs two stale Next.js lockfile references and removes an unused snapshot without changing dependency declarations. Browser regressions and required reviews remain pending. The host launcher proves the full profile ready, then browser startup fails before tests with ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY: host pnpm tries to replace container-prepared dependencies. Do not force that replacement or bypass the canonical launcher. Browser qualification and publication remain blocked; preserve the unauthenticated analytics regression unchanged. Complete the independently verified local merge commit and required source review while retaining this runtime-tooling boundary.

### Active local KB acceptance correction — 2026-09-07

2026-09-08 retained-data browser qualification: the executor delivered a
dedicated config, spec and host-launcher mode. Main moved the spec outside
the default tests directory to prevent ordinary CI discovery and included it
explicitly in TypeScript checking. The launcher skips lifecycle, install,
build and database setup. Main's ignored fixture script passed dry-run and
created only one synthetic thread with two messages in a transaction; existing
records and disclaimer acceptance remain unchanged. The fixture is retained.

The host Chromium run passes in 4.4 seconds after external disclaimer-media
requests were blocked separately from local writes. Source-card, page metadata,
non-link identity, nonempty retrieval and reload assertions pass. No local
write request occurred; no provider query or ingestion was submitted. The
captured source screenshot is obscured by the disclaimer overlay, so visual
acceptance remains unproven. This proves saved-fixture rendering, not the
live provider-to-persistence path. Playwright TypeScript, 13 host launcher
tests and diff checks pass. Required implementation reviews and publication
remain pending; portable composition still lacks the approved lifecycle.
The exact generation-lifecycle-contracts workspace remains running under the
user's manual-verification lease; no data or runtime cleanup occurred.

2026-09-08 implementation continuation: existing citation Playwright setup is
unsafe for this retained database: global setup resets/reseeds it, and citation
beforeEach deletes participant chat state. A bounded executor
01a07fad-9a4a-74b3-a62d-e86a90f57389 owns a separate deterministic browser seam
with no database setup, writes, provider calls or runtime mutation. Mocked
history reload will establish rendering only, not database persistence.
Main replaced the hardcoded signer lookup with explicit LOCAL_KB_SIGNER_ENV_FILE
selection and regular-file/ownership/mode-600 checks. Temporary fixture tests
reject symlinks and broad permissions and accept the protected input; runtime
tests pass in the container and on the host. No live restart applied this edit.
Provider demand reports queued/running states only; delayed retry absence is
not established, so credentialed provider startup remains blocked.
The isolated browser executor did not deliver a test after the narrowing
checkpoint: normal Chat rendering requires authenticated server-side fixture
reads, outside its no-DB-read contract. Main requested termination with the
precise dependency rather than introducing an authentication bypass. No test
files or launcher mode were delivered. Resume with main-owned, scoped synthetic
identity readback; do not rerun the destructive standard citation suite.

2026-09-08 continuation: Chat owner preview reloads successfully but contains
no transcript; its explicit unsaved-conversation contract makes it unsuitable
for persistence acceptance. No new message was submitted. Focused citation
verification passes 101 tests across four files, Chat typecheck passes, and
the local launcher helpers pass 14 tests in the managed container. The host
profile suite passes 16 tests; running that suite inside the container failed
because its host Devrouter dependency is deliberately absent. Actual Manage
profile planning now includes Blob/Azurite without a fabricated build target.
Read-only provider status reports ingestion, dispatcher, callback, scraping,
and retrieval unreachable; Crawl4AI and Milvus respond. No provider was
restarted. The launcher still implements status/plan only, not the approved
setup/start/connect/stop lifecycle. The browser-test owner is identifying a
no-reset saved-conversation fixture before any test mutates retained state.

2026-09-08: the user approved continuation of the Manage-only cache repair.
The exact task runtime was healthy, with no pending cache repairs. The existing
guard was temporarily moved, the native frontend-manage repair was requested,
and canonical ensure completed with recreated=false and no drift. The repair
request was consumed and the original guard restored. The retained NASA KB
detail route now returns HTTP 200 instead of 404. No database reset, new
ingestion, model request, or graph build occurred. The runtime remains running
for the user's manual verification. The authenticated in-app browser confirms
the retained NASA PDF is Succeeded Version 1 and Available to AI: Current
version 1, with one connected chatbot and no graph build. This verifies page
recovery and retained state, not a new retrieval or citation result. The isolated
agent-browser command stalled and was interrupted; the existing in-app browser
provided the visual check. Current source is an unfinished candidate, not a published or reviewed
complete launcher; helper tests alone do not establish end-to-end acceptance.

Process identity helper is implemented and independently verified: 14 combined
launcher tests pass in the managed container. It refuses reused PID/start
identity, source/group mismatch, foreign port owners, incomplete observations
and invalid TCP ports; explicit absent-process evidence is distinct from an
unknown observation. Main requested and verified the single port-range
correction. The executor is completed and closed. This is pure classification,
not yet an operating supervisor or evidence about the live fleet.

Citation correction now also distinguishes retrieved documents from visible
source cards in the disclosure hint. Malformed objects retain the raw panel,
and chunks without renderable metadata do not promise nonexistent cards.
The four focused suites pass 101 tests and Chat typecheck passes. Source checks
report only the three pre-existing MCP any warnings. The cache guard remains
unchanged; browser acceptance, full launcher integration and source publication
are not complete.

Provider command construction now separates the explicit ingestion migration
entrypoint from individual serving/worker entrypoints. The non-executing plan
command emits argument arrays with frozen/no-sync dependency behavior and no
dotenv auto-loading. Scraping uses its verified UVICORN_HOST/UVICORN_PORT
contract, inline execution and no cache sweep. Retrieval uses its native
factory without the prototype's binding mutation. The status command now
includes retrieval's side-effect-free health endpoint. Five isolated tests
pass in the container. These command definitions have not been executed;
prepared-state/queue checks and lifecycle integration are still required.
Native executor McClintock owns only the pure process-identity helper and its
synthetic tests; no provider, runtime or secret access is delegated.

Portable composition first increment, 2026-09-08: added the configured-path,
read-only status command at util/local-kb-stack.mjs and four isolated tests.
It accepts explicit provider roots and loopback health ports, reports source
heads and HTTP status without response bodies or environment values, and never
equates reachability with readiness. Container Node tests pass 4/4. Actual host
readback finds all three recorded provider heads and six HTTP 200 endpoints;
exit 2 and ready=false correctly retain the unqualified ownership, queue and
retrieval boundary. No startup, migration, binding update, or job ran.

Provider contract inspection establishes two remaining implementation seams:
the ingestion worker launcher performs migrations on start, and the ignored
retrieval prototype couples startup to a chatbot binding transaction. Neither
may be wrapped unchanged under this plan. Separate explicit setup/connect
from start before claiming portable orchestration. Status is only the first
increment, not delivery of the complete launcher.

2026-09-08 independent continuation: the cache-preservation approval remains
pending; no marker or cache was changed. Four deterministic citation/MCP suites
passed 95 tests after recovery. Contract inspection then found that document
counting still depended on card normalization, and parsed objects without a
sources array could claim an empty retrieval. The bounded correction removes
that rendering dependency and leaves malformed objects neutral. Four focused
regressions were added; the combined suites now pass 99 tests, and Chat
typecheck passes. No external application-provider request occurred.

Provider source refs were refreshed without integration or checkout changes.
Current inspected baselines are data-ingestion
d46282848100beec5a1f571e0cc9b091dcdd4179, web-scraping
b6881533a97fbaa24e09f6fb05d0d99005231f2b, and mcp-doc-query
80313c4fb842bf7c9a82e0b444d207db5fcf900d. These are source identities, not
qualification of the planned portable launcher. That implementation and its
ownership/queue tests remain incomplete. Consumer remains 36 local commits
ahead of its tracked task branch and 163 ahead/10 behind origin/v3; PR target
remains v3-ai. No source publication or merge occurred.

Authenticated browser restart proof: the KB list shows NASA PDF local
verification with one resource and one connected chatbot. Its existing detail
URL still returns 404 through direct and client-side navigation. The server
reports PageNotFoundError/ENOENT for the detail URL, while the source dynamic
page exists. This is not evidence of missing KB data. A repository-supported
Manage route-cache repair request was refused because the existing coordinated
preserve-next-cache marker is present; no cache was removed and the marker was
not changed. A subsequent canonical ensure kept the matching process running.
The next runtime decision is whether the cache owner permits one exact Manage
generated-cache repair. Citation/browser acceptance remains blocked, not passed.

Runtime recovery now passes: canonical repair with the retained Blob port and
restricted runtime-only key injection completed with managedRuntime.status=ready,
recreated=false, zero drift, all selected services healthy, and both workers
live. The preparation wrapper waits up to ten seconds for non-zombie Git
processes in its own process group, without killing them or bypassing the
lifecycle guard. Isolated shell tests pass on the host and in the managed
container, including delayed same-group Git and unrelated-group behavior.
The retained Manage KB URL now reaches delegated authentication instead of
Bad Gateway. Browser acceptance and source reviews remain incomplete. Keep
this exact runtime running for the user's requested manual verification;
revisit that lease at the next verification checkpoint. No data was reset,
container recreated, ingestion submitted, or paid query performed.

Recovery diagnosis: retained container configuration confirms
KB_GRAPH_BLOB_HOST_PORT=10043. Restoring that exact non-secret override removes
the Compose mismatch; earlier commands omitted it. Canonical repair now reaches
preparation and repeats the foreground-child failure. One temporary values-free
process snapshot at preparation exit identified PID 13918, PPID 1, PGID 13788,
state R, command git. The preparation shell is PID/PGID 13788. Thus a Git
subprocess survives the completed Turbo invocation in its owned process group.
The temporary snapshot was removed immediately after capture. Do not bypass
Devrouter's guard or kill unrelated processes. Installed Devrouter is now
0.0.58; this worktree's local pin remains 0.0.57. Further startup correction must
address completion of that Git child and review any required version adaptation.

Approved goal restart: restricted Infisical profile authentication and existing
OpenRouter mapping passed. Canonical ensure for ai,chat,email,live-quiz,manage
waited in the provider queue, then returned container
e47aa8e9d4588fe8732c08c8be127684041a2ecab8477fed7a7c251ea992df13.
Dependency preparation reported ten successful cached builds but failed the
foreground-process guard: preparation left running children. Managed rollback
left degraded process state. Exact-container read-only Docker process metadata
subsequently showed only init and sleep; no surviving preparation child was
identified. Managed exec now rejects the lifecycle transition.

One canonical ensure --repair with the same profile and restricted mapping
failed before recovery: Managed Compose configuration changed for service app.
Do not bypass that guard, recreate the workspace, reset data, or modify shared
Devrouter state. Resolve the retained configuration difference before retrying.
All six external ingestion preflight endpoints still return HTTP 200; this is
reachability only. No ingestion, query, graph build or deletion occurred.
The goal remains active with runtime recovery unresolved.

Integrated citation checkpoint: executor Popper completed its four-file UI
correction. Main inspected the diff and ran the combined four focused suites:
94 tests pass. The combined Chat typecheck passes after a transient
`next: not found` failure; a subsequent exact-container check found dependencies
present. Container Biome checked the UI correction. The isolated browser
successfully opened the current Chat URL but rendered `Bad Gateway`, so no
browser acceptance is claimed. A process-name-only container read showed only
the container init/sleep and inspection processes. Recover exact managed app
startup and establish runtime custody before any lifecycle change; do not
reset the retained KB or use broad Playwright database cleanup. Current source
changes are uncommitted, with source reviews and publication still pending.

Agent service recovered with ready=true. Native executor Popper owns the four
bounded normalizer/tool-fallback implementation and test paths; main owns the
MCP result boundary. Main added a doc-query-only execution wrapper that removes
ingestion gateway destinations from structured and JSON-text payloads before
model context and persistence, retaining opaque document identity and metadata.
Nineteen focused sanitizer/MCP tests pass; Chat typecheck passes after replacing
an untyped argument spread with the SDK execute parameter tuple. Container
Biome passes with three pre-existing explicit-any warnings. Changes remain
uncommitted. UI integration, deterministic browser proof, committed reviews,
portable composition and publication remain pending. No new paid calls ran.

Resumed correction: the Manage Blob route now maps to an explicit Azurite
managed-service binding. The host runtime-plan consumer validates that binding
only when Blob is selected and requires the actual managed service; no fake
Turbo filter or health URL was added. The real Manage profile plan passes.
All 16 host profile-runtime tests pass, including every real shard profile
union. Container execution passed 15 tests; its host-Devrouter integration test
cannot run there and passed on the host instead. Container Biome formatted and
checked both changed JavaScript files. Whitespace checks pass. This candidate
is uncommitted and does not establish browser upload or restart acceptance.

OpenCodex readiness remains failed at the resumed checkpoint. The existing
mapping child has not delivered a terminal result and is retained, not replaced.
Citation corrections, provider composition and required source reviews remain
pending. No new ingestion, paid query, fixture mutation or runtime restart ran.
The runtime remains retained for the user's manual verification.

Status: incomplete; achieved delivery is local source and runtime proof, not
reviewed publication. The latest PDF test passes ingestion and retrieval but
fails result-count presentation and user-facing citation provenance. Runtime
fixes remain local. Startup currently depends on an ignored multi-repository
prototype and therefore is not yet a reproducible published profile.

Next: verify the parser and provenance causes, freeze the smallest compatible
correction and startup contract, complete the armed planning review, then
implement and verify within this package. Preserve passing evidence when its
source and contract are unchanged. Required source reviews, affected tests,
browser citation proof, and publication remain incomplete. No completed
review for the earlier lifecycle slice qualifies these new corrections.

### Approved analytics loading-state correction — 2026-09-06

The user approved the narrow loading-state correction while preserving authentication enforcement. Main owns LearningAnalyticsRouteGuard.tsx because the authentication seam and runtime proof are coupled; native executor Harvey owns only the added unauthenticated analytics browser regression in B-feature-access.spec.ts. The loading branch now uses the existing shared Loader without Layout; profile-unavailable stays fail-closed, and global Unauthorized redirects plus backend authorization remain unchanged. Acceptance requires observed profile-failure interception, unavailable UI and zero analytics calls; genuinely unauthenticated access must still reach login with zero analytics calls. Existing unrelated candidates remain preserved. Fetch succeeded without integration; branch tracks origin/rs/generation-lifecycle-contracts and is 145 ahead/eight behind origin/v3.

Initial startup session 2402 and the single canonical repair session 99273 both failed after ten cached dependency builds: `[devrouter-process] Preparation for 'klicker-dev' left running children; a synchronous foreground command is required.` The installed helper excludes zombie processes from that check; the exact surviving child has not been identified. No safety check was bypassed or shared tooling changed. Fresh source-path status confirms failed-transition, the application process stopped and supporting services healthy. Manage typecheck and lint pass (23 existing hook warnings), as does the guard's scoped Biome check. Updated Playwright typecheck session 72922 and test formatting session 66768 pass; an earlier check overlapped an unfinished edit and failed syntax, so only the finished-file result is usable. No post-fix browser result exists. The prior scope-decision blocker below is superseded, but publication still requires browser verification and the existing review gates. The guard and test candidates remain local and uncommitted.

Executor checkpoint: Harvey added the unauthenticated-access case and corrected its prose assertion and persisted POST decoding. Native evidence showed repeated reconsideration after the bounded correction; main closed the child and retained its work. Main changed the final URL assertion to Playwright's retrying URL predicate so client-side navigation can settle. No global authentication or backend code changed. The preceding typecheck/format receipts cover the executor diff, not that final assertion adjustment: its container check was rejected because canonical stop session 88086 already held the task lifecycle lock. Keep this small verification gap explicit. `git diff --check` passes. Shutdown is queued behind another owner; do not bypass or restart it.

Shutdown result: canonical stop session 88086 waited for the shared provider queue, then exited one with `Managed Compose configuration changed for service 'app'.` No successful stop or zero-route verification is claimed. The exact task source path remains /Users/rschlae/Git/klicker/klicker-uzh/trees/rs/generation-lifecycle-contracts, workspace rs-generation-lifecycle-contract, Compose default-rs-f189c. The command omitted KB_GRAPH_BLOB_HOST_PORT=10043, which was present at startup; restore that task-specific override before attributing the configuration discrepancy to another owner. Do not use raw provider/Docker mutations or affect parallel workspaces. Runtime and source qualification remain incomplete.

Final lifecycle receipt, 2026-09-06: repeating the canonical stop with startup's KB_GRAPH_BLOB_HOST_PORT=10043 succeeded in session 54275 after the provider queue. The exact source-path receipt reports stopped=true and freedRoutes=0. Fresh Docker state shows all nine default-rs-f189c containers exited. This supersedes the failed stop above: its configuration discrepancy came from the omitted task-specific override, not evidence of a peer edit. Worktree and database volume are retained. No active child or source-check process remains. The next qualification step requires resolving the foreground-preparation failure, then running the final assertion's static check and the focused browser cases before implementation reviews/publication. No commit, push, merge or release-readiness claim is made for these local corrections.

Fresh complete route-inventory readback contains no rs-generation-lifecycle-contract entry. Exact runtime release is verified: stopped containers and zero task routes; retained data is not deleted.

### UI qualification: tooling verified; analytics loading/auth flow needs scope decision

Runtime released on 2026-09-06: canonical stop session 71067 exited zero for /Users/rschlae/Git/klicker/klicker-uzh/trees/rs/generation-lifecycle-contracts, workspace rs-generation-lifecycle-contract, reporting stopped and eleven freed routes. Fresh Docker metadata confirms all nine default-rs-f189c containers exited; a complete parsed devrouter route listing contains no matching workspace token. Worktree and database volume are retained. No active test, lifecycle watcher or child remains from this qualification run.

Latest producing-run evidence on 2026-09-06: focused canonical Playwright session 21198 completed with five passes, one failure and one skipped test. Missing chat feature flag and the smaller-desktop four-choice library checks pass; analytics profile-failure handling redirects to the auth page instead of showing learning-analytics-access-denied. The mock interception counter passed before that assertion. The additional English storage-cleanup test matched the case-insensitive CLEANUP grep and passed; its German case was skipped. No broad UI qualification is claimed. Preceding session 9393 failed before tests on four missing Docker IDs; fresh exact-container inspection found all nine task containers present with ready/zero-drift state, and the one retry passed reconciliation. Container launcher/profile contract tests pass 24/24, including installed Devrouter profile planning. Prettier checks for the YAML/config/lockfile and Biome package.json check pass; git diff --check passes.

The remaining source seam is outside the pin/test correction: LearningAnalyticsRouteGuard mounts AnalyticsLoadingView while flags are not ready; that view mounts Layout, whose missing-profile redirect can navigate to login during the synthetic profile failure. The guard's later evaluation-unavailable branch cannot recover that navigation. The global Apollo Unauthorized redirect is not triggered by the synthetic error message. Retain these application files unchanged pending explicit authority for a narrow loading/authentication-flow fix. Recommend rendering the initial analytics guard loading state without the authenticated Layout, preserving real authentication enforcement and verifying both profile-unavailable and truly unauthorized cases. Keep the test failure visible; do not weaken it to accept login. Tooling and UI candidates remain uncommitted/unpublished. Stop the exact runtime for this decision boundary and verify release below.

Canonical repair session 14016 exited zero on 2026-09-06: full profile ready, zero drift, eleven routes, eight supporting services healthy and both managed processes running. Ten dependency builds completed in 3m30.148s, with the already observed Pothos/design-system TypeScript warnings; this is not a clean typecheck. Six app readiness contracts and both worker process checks passed. Synthetic Manage course warm-up remained 404, not course-flow proof. Focused host Playwright session 9393 uses Node 24.16.0/Corepack pnpm 11.5.0 and the aligned CLI, selecting cleanup plus the three inherited failures in the feature-access and wizard specs. It is queued in canonical reconciliation; preserve the run and report no UI pass until assertions finish.

Devrouter alignment is locally verified: package.json, .devrouter.yml, the exact release-age exception and the pnpm-generated lockfile now select 0.0.55. The lockfile diff is five additions/five deletions, all Devrouter; unrelated Next.js peer normalization was restored. The temporary old-version exception was removed. Container frozen install passed with pnpm 11.5.0, changing one package; the scoped host Playwright/root frozen install passed with the launcher's Node 24.16.0/Corepack pnpm 11.5.0 toolchain, also changing one package. Host pnpm exec now reports installed and repository Devrouter 0.0.55. The initial Volta pnpm command resolved to unrelated pnpm 9.7.0 and exited at its reinstall prompt without changing dependencies; do not reuse that command. Canonical full-profile repair session 14016 has reached foreground preparation and dependency builds. Runtime readiness and UI assertions remain unverified. No source commit or publication is claimed for these local changes.

The user explicitly approved the tooling prerequisite on 2026-09-06: align the repository Devrouter pin, lockfile, exact release-age exception and version metadata with host 0.0.55. This is a mechanical main-session change; delegation costs more than this bounded edit. Preserve the adopted runtime changes and separate UI candidates. Stop session 16872 completed successfully with all nine containers stopped and zero routes. The subsequent repair session is no longer available; fresh status reports failed-transition, supporting services healthy, local MCP running and the application process stopped. Do not claim runtime readiness. Container pnpm 11.5.0 is available through canonical exec. Lockfile generation temporarily retains the pre-existing 0.0.51 age exception because pnpm verifies the old lockfile before resolution; remove that exception after generation and require frozen-lockfile verification. Then align the host Playwright dependency installation and rerun the canonical focused checks. No new merge, deployment or shared-runtime authority is granted.

Latest qualification result, 2026-09-06: session 24968 exited one before Playwright/global cleanup. After its provider queue completed, post-start rejected the delivered helper because it lacks --prepare-command support; rollback left degraded process drift. Root cause is verified executable selection: direct host Devrouter is /opt/homebrew/bin/devrouter at 0.0.55, while pnpm selects node_modules/.bin/devrouter at repository-pinned 0.0.51. package.json, pnpm-workspace.yaml and pnpm-lock.yaml retain that pin. The adopted runtime adapter requires the newer helper. This is not a failed UI assertion or shared-router absence. Updating tooling pins/lockfile and the corresponding Devrouter metadata is a new scoped change requiring authority before implementation; do not bypass the canonical host launcher. Exact non-destructive stop was submitted through the compatible host CLI as session 16872; verify its terminal result before claiming shutdown. Existing goal, UI candidates and unchanged backend evidence remain intact.

Current producing-run receipt, 2026-09-06: canonical ensure session 95129 completed successfully. Managed full profile is ready with zero drift, eleven routes, all eight supporting services healthy, both managed processes running and both Hatchet workers live. App container is 561cc422cb273b4799aa60fe63bf23c1d8eb4535c48e1e4224c06aa7ab73aa25. The newly created default-rs-f189c_pgdata volume timestamp is 2026-09-06T11:58:49+02:00; bootstrap initialized this disposable local environment. Dependency builds completed ten tasks in 39.389 seconds with warnings, not a clean typecheck. App readiness passed; synthetic course warm-up returned 404 and is not course-flow proof.

Historical host Playwright session 24968 selected CLEANUP and the three inherited failures, but failed during canonical runtime startup before running tests or cleanup. The host entry printed a Node 26 engine warning; the launcher selects its Volta toolchain for Playwright, whose actual version still needs verification. The earlier shared-router and custody blockers below are superseded; do not request setup again.

Latest startup receipt, 2026-09-06: the user reported shared routing restored. Fresh host checks confirm devnet exists and devrouter-traefik runs. No setup mutation was needed. Canonical full-profile ensure is active as session 95129 with KB_GRAPH_BLOB_HOST_PORT=10043, waiting behind the live provider-lock holder PID 8509. Preserve this one operation and queue position; no readiness or test result exists yet. This supersedes the shared-setup approval blocker below.

Current authority and evidence, 2026-09-06: the user explicitly requested independent execution and takeover of this worktree and its Devrouter runtime. Central was notified; the previous custody-handback blocker below is superseded. Reuse the existing full goal and approved UI qualification package, not a duplicate release branch or generation implementation. Fetch succeeded; rs/generation-lifecycle-contracts tracks its matching origin branch, remains 145 ahead/six behind origin/v3 and eleven ahead/eight behind origin/v3-ai. Published head remains c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f, draft and mergeable.

Fresh provider evidence contradicts the old retained-runtime record: Devsy reports NotFound, no default-rs-f189c containers exist, and default-rs-f189c_pgdata is absent. Repair therefore exited before startup because it requires a retained app container. Normal ensure began workspace creation but failed on Docker Hub DNS while resolving the required Node image. The exact node:24.16.0-bookworm-slim image was pulled successfully; canonical ensure then downloaded the declared service images and failed because external network devnet is absent. A scoped read confirms both devnet and devrouter-traefik are absent, with no task containers running. Sessions 69642, 89723, 70985 and 64815 are terminal. No data deletion, source implementation edit, cache clear, commit, upstream integration or publication occurred.

Next boundary: obtain explicit shared-machine Devrouter setup authority, then run canonical setup and resume this exact checkout with KB_GRAPH_BLOB_HOST_PORT=10043. Preserve the cache marker and the six adopted runtime-source paths outside our publication. After startup, prove the newly created database is synthetic and proceed through the already-approved focused UI tests, browser checks, reviews and same-draft publication. Existing data-model/business-regression obligations below remain unchanged. The historical blocked-goal record must not be interpreted as current custody or runtime evidence.

Blocked audit, 2026-09-06: three resumed goal turns encountered the same missing generation readiness and runtime handback. Identity delivery and checkpoint reconciliation are complete, but neither unlocks the required browser verification. The recovery owner's receiving turn is terminal and idle with no handback; its final recovery record still reports generation stopped after prelaunch approval-service timeouts. There is no live operation to wait on. Mark the full goal blocked, not complete, until recovery evidence and custody change. Preserve the existing PR, review evidence, runtime owner and paused monitor; do not generate further unchanged-status checkpoints.

Current checkpoint, 2026-09-06: outbound task messaging is restored. The shared-runtime identity and source-custody confirmation was delivered to Devsy Issues; its receiving turn completed without a readable reply or handback. Central's latest recovery record reports UX recovered and stopped, then generation stopped after unsuccessful recovery attempts. No generation application-readiness proof exists. Fresh provider status is Stopped and an elevated, source-scoped route query confirms zero routes. Keep central runtime custody and the cache-preservation boundary; do not run the reset/reseed Playwright launcher before handback and reconciliation of that data boundary. The preceding goal turn made progress by delivering the previously blocked identity confirmation. The full goal remains incomplete; this resumed audit has not reached three blocked turns. Remote refresh succeeded, with branch/upstream and drift unchanged from the exact-head reconciliation below. PR #5777 — generation lifecycle contracts remains open, draft and mergeable at c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f. Older messaging-unavailable and UX-in-progress statements below are historical.

Resumed blocked audit: the same unavailable shared generation runtime and central custody boundary has persisted across three consecutive resumed goal turns. The intervening turns completed source-receipt verification and corrected published PR evidence; neither supplied the required browser runtime. Fresh host readback still shows failed-transition/full, all nine original containers exited, both managed processes stopped and no matching generation lifecycle operation. Central's latest checkpoint now reports UX recovery progressing after its queue wait; that supersedes the earlier blanket prelaunch-timeout status but is not a generation-runtime recovery or custody handback. Do not observe or interrupt central's process through a duplicate watcher. Mark this goal blocked, not complete, until central supplies qualified generation recovery and returns custody. No further independent qualification or publication gate can finish without that external-state change. Existing source, data, cache guard and PR evidence remain preserved.

Exact-head PR reconciliation completed after host access recovered. Fetch succeeded without integration: rs/generation-lifecycle-contracts tracks origin/rs/generation-lifecycle-contracts, stands 145 ahead and six behind origin/v3, and remains eleven ahead and eight behind unchanged target origin/v3-ai at 5c8ee4b6a034c22da8e85159214c629f371d0f3d. PR #5777 is still open, draft and mergeable at c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f with zero unresolved review threads. GraphQL and codebase CI pass; the existing shard-eight/aggregate Playwright and OCR checks fail, and final-ai-review remains pending. No new source, review finding or CI run appeared.

Updated the existing PR description and verified exact readback. Removed stale claims that the runtime was running under a manual lease; distinguished uncommitted Header/test corrections and the six adopted runtime files from the published backend diff. Preserved all branch-wide implementation and backend verification context. Recomputed eleven commits, thirteen published paths and substantive size 1,628 additions plus 324 deletions. Current host runtime readback confirms failed-transition/full, both managed processes stopped, the same nine exited containers and zero checkout routes. No lifecycle mutation occurred. The remaining blocker is central's qualified recovery and custody handback, followed by focused UI qualification and required reviews. This PR-body update is not source publication, readiness approval or final AI review.

Latest continuation checkpoint: central Devsy rollout records Devrouter 0.0.55 published and installed, including resolved Compose env_file hashing and order-independent retained mount comparison. The former unexplained app hash and review-credit blockers below are superseded. Central still owns serialized recovery; its latest execution record says the first UX repair never launched because automatic permission review timed out twice. No shared generation runtime readiness or custody-release receipt is available yet.

This task is the source owner of this checkout and the same blocked runtime shared with KB/KG/Generation, not a separate V3-AI runtime. The six runtime-source adoption paths remain uncommitted alongside our Header.tsx, B-feature-access.spec.ts and plan edits. The adopted cache-preservation guard is present, and central's preserve-next-cache marker exists. Source inspection confirms the guard blocks new repair requests and pending cache deletion. Host shell syntax and whitespace checks pass; this is not execution or browser proof. Preserve KB_GRAPH_BLOB_HOST_PORT=10043 and the existing data/caches.

Remote refresh in this continuation failed before command creation twice because the automatic permission approval reviewer timed out. No third retry, lifecycle operation, upstream integration, commit, push, seed or cache clearing was attempted. Local HEAD remains c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f; remote/CI observations below are historical until refresh succeeds. Outbound cross-thread messaging is still unavailable, so source identity confirmations in this thread must not be recorded as delivered to central. Resume after central's qualified recovery and custody handback; then run the already-approved focused UI checks and review/publication sequence. This checkpoint only reconciles local progress with the owner's recorded rollout, without treating stale refs as new source authority.

Earlier repair investigation follows; its superseded blockers are retained only as producing-run history.

Current checkpoint, 2026-09-05: the user explicitly approved restoring the committed GrowthBook test default and retrying repair. NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY is restored to sdk-test; .devcontainer/devcontainer.env now has no Git diff. The exact retry with KB_GRAPH_BLOB_HOST_PORT=10043 and installed devrouter 0.0.52 exited one at 17:21 UTC after about ten seconds with `Managed Compose configuration changed for service 'app'.` The original command receipt was recovered from this session after its output handle expired; no duplicate retry was launched.

Read-only comparison isolates the guard failure to app: all eight other retained services match their recorded Compose hashes. Every currently configured app environment value matches the retained container. The app's recorded hash is b9f83811cf985ed989f0933ce7b526e1340a3a4c244517258e63b943e6febafe; current resolution produces d9e0272b66b06ddc17f8295a01f6d8fd452cf95d66e13844e4032755983a212c. A read-only in-memory variant supplying the retained image name also fails to match. The remaining configuration mismatch is unresolved; neither environment equivalence nor this comparison establishes safe repair. No hash, generated configuration, provider state or lock was edited.

Fresh host inspection confirms Compose default-rs-f189c still contains the same nine exited containers, zero exact-checkout routes and no active lifecycle command. Managed status remains failed-transition at process-start for the recorded full profile. No reset, deletion, recreation, app startup or browser test occurred. The task runtime is stopped at the container layer, with degraded managed state retained. Source candidates remain uncommitted and unqualified; backend head c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f is unchanged.

Devsy Issues retains the separate runtime-fix lane. Its latest receipt distinguishes passing isolated dependency-build experiments from unimplemented startup/shutdown fixes; its required planning review is blocked by unavailable review credits. Do not duplicate that work or infer runtime readiness. Outbound cross-thread messaging remains unavailable here, so this checkpoint records the consumer evidence without claiming delivery to the owner. Resume focused UI qualification only after an ownership-preserving resolution of the app configuration guard and successful canonical readiness. No new generation plan, upstream integration or generic manual test round is needed.

Final provider readback: `devsy workspace status rs-generation-lifecycle-contract --result-format json` exited zero and reports context default, provider docker, state Stopped. Together with all nine exited containers and zero exact routes, this completes the stopped-runtime receipt. Whitespace checks pass in both the task plan and roadmap worktrees; their unrelated changes remain preserved.

The following repair and custody notes are historical and superseded by the current checkpoint where they conflict.

Latest repair attempt, 2026-09-05: the user approved the exact `ensure --repair` command after investigation of installed devrouter 0.0.52. A read-only process check found no active lifecycle command for this checkout. With KB_GRAPH_BLOB_HOST_PORT=10043 and the recorded full profile, repair exited one before starting containers: `Managed Compose configuration changed for service 'app'.` Fresh inspection confirms all nine retained project containers exited and zero checkout routes. No deletion, recreation, reset, state-file edit or source change occurred in the repair attempt.

The retained app has the committed test-default NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY, while the peer's preserved local-only file clears it. This is a confirmed configuration difference consistent with the repair guard; other configuration equality has not been proved by a successful repair. Cross-task messaging is unavailable in this session. Stop before removing the peer override: request permission to restore the committed test setting, then retry the same exact repair. The earlier need to implement a devrouter recovery fix is superseded by the installed release; no competing tooling patch is needed here.

Latest resumed checkpoint, 2026-09-05: the runtime owner explicitly released source custody for the authorized Header.tsx and B-feature-access edits while retaining runtime custody. Its approved managed stop succeeded and freed eleven routes; ensure still rejected the old degraded process-start transition. The owner reports all services/processes stopped, zero active routes and no reset/deletion. A bounded devrouter recovery fix awaits approval in that task; this package does not implement it.

Main applied the minimal layout candidate: the outer header can wrap its existing groups, and the account-navigation group retains right alignment through its auto margin. Only two class strings changed; labels, ordering, permissions, handlers and test selectors are unchanged. The release task's separate Header.tsx permission edits and the local-only environment override are untouched. Main retained this two-token CSS correction because delegation costs more than the edit and reproduction/integration remains coupled; the substantive feature-test candidate was already executor-produced. git diff --check passes and exact diff inspection confirms the bounded change. No formatter, build, browser acceptance, implementation review, commit or publication is claimed. Check 749-by-820 EN/DE and ordinary desktop navigation after recovery, then continue the existing review/publication sequence. The previous unchanged-header checkpoint below is historical.

The user refocused this task on finalizing the existing generation-lifecycle refactor. Reuse the published backend implementation and its passing evidence; do not request generic manual regression testing or widen this work into full v3-ai acceptance. The remaining approved work is the two feature-test repairs, the minimal header layout correction, their focused browser checks and required reviews, followed by publication to the same draft PR.

Fresh remote inspection on 2026-09-05 confirms published head c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f, an open draft targeting v3-ai, mergeable with no unresolved review threads. GraphQL and codebase checks pass; Playwright shard eight and hosted OCR review still fail, and final AI review remains pending. Fetch completed without integration. The branch tracks origin/rs/generation-lifecycle-contracts, stands 145 ahead and two behind origin/v3, and 11 ahead and eight behind origin/v3-ai. Target advancement includes shared schemas and dependencies but no generation-service changes; do not infer merged-result compatibility from existing head-scoped proof.

Klicker KB/KG/Generation retains runtime custody. Its latest recovery receipt reports canonical ensure exited one with `Managed runtime state is degraded; refusing a new profile transition until drift is repaired.` The failed transition is at process-start; the owner reports stopped containers with active routes remaining. After requesting exact non-destructive managed stop/ensure recovery, that task is active again in turn 01a0720d-a321-7053-8c51-46015161b2b1; no successful recovery or custody-release receipt has arrived. Preserve data and Blob port 10043. This task performs no concurrent runtime mutation, reset or recovery. The earlier successful restoration below is historical, not current readiness evidence.

Goal checkpoint: the same unavailable verification runtime and retained owner custody have prevented qualification across at least three consecutive goal turns. The live owner task is not failed or cancelled. Mark this goal blocked pending its recovery result and custody release, rather than repeatedly checking unchanged state. The next-plan requirement already corresponds to the reviewed, implemented common Element-completion extension; the parent roadmap explicitly rules out a duplicate plan. All remaining implementation and verification resumes under the existing approval once the runtime boundary clears.

The owner's .devcontainer/devcontainer.env change is local-only: NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY is cleared for manual AI testing and must not be committed. Restore its committed sdk-test setting only after custody returns and before the intercepted GrowthBook test run. Shared feature-flag code is unchanged; manual AI after-state is unverified. The B-feature-access candidate remains uncommitted and unverified, and Header.tsx is unchanged. git diff --check passes. Container formatting/checks, browser qualification, implementation reviews and publication remain pending. No new commit, push, upstream integration, migration or provider call occurred. Resume the already-approved focused qualification when the owner releases the recovered runtime; do not duplicate the owner's recovery request.

### Earlier successful restoration

Restoration succeeded on 2026-09-05: canonical ensure exited zero after fresh bootstrap and full-profile readiness. Devsy workspace rs-generation-lifecycle-contract uses Compose default-rs-f189c and app container 6dc71c3e28a67f99430d500bd36e814a955f4160af00d1d01446b2761b76002a. Managed runtime is ready with zero drift; all selected and base services are healthy, both managed processes run, and both Hatchet workers are live. Native readiness passed for auth, chat, control, manage, PWA and response-api. The rebuilt local database was initialized and seeded by the normal bootstrap; no old OrbStack data was recovered. No source/configuration changes or volume deletions were made by this restoration.

The workspace remains running for the user's manual verification under Klicker KB/KG/Generation custody, confirmed by that task and acknowledged with the producing-run receipt. Revisit this lease when manual verification completes, before broad Playwright cleanup, or at the next custody handoff. Manage is https://manage.klicker.rs-generation-lifecycle-contract.localhost. Keep the supported temporary KB_GRAPH_BLOB_HOST_PORT=10043 override on subsequent ensure commands; the durable host graph-worker Blob routing change is separately owned. Paid provider calls and AI generation were not qualified by startup health. The local UI candidate remains uncommitted, unreviewed and unpublished. The historical blocker and intermediate receipts below are superseded by this outcome.

Restoration custody update: the peer startup exited after the cached official Node image resolved image lookup, then hit an Azurite bind collision on port 10003. The peer explicitly handed restoration to this task and requested retaining the workspace for the user's manual verification. Port 10043 was free and is supported by the existing KB_GRAPH_BLOB_HOST_PORT override. One canonical ensure is now running with that override; it has entered the bootstrap hook. The colliding container belongs to Compose default-rs-956ce and is untouched. No duplicate startup or lock bypass occurred. Keep this workspace for manual-verification custody at the next checkpoint; do not run broad Playwright cleanup during that use. This is temporary port-based restoration, not a durable change to host graph-worker Blob routing.

Resume update, 2026-09-05: the user confirmed cleaning OrbStack and explicitly requested recreating this workspace. This resolves the missing-volume explanation and grants the normal task-local recreation. Remote refs were refreshed without integration; the branch still tracks origin/rs/generation-lifecycle-contracts and is 145 ahead, two behind origin/v3. The pre-existing startup PID 71513 belongs to task 01a02ee6-aebd-7463-89d6-d1ba5dca23a8 (Klicker KB/KG/Generation), verified through its task-ID metadata only. Read-only coordination requested its status and continued need; no interruption or lock bypass occurred. Await that owner's result before launching a duplicate transition.

2026-09-05 resumed with explicit task-database reset and layout-only header authority. No new commit or push occurred; the published draft still matches c8c35e2d94d06c42c4dc94ff41170dc2ed01c51f. The local feature-test candidate now replaces the touched loading-copy assertion with an unavailable-state check and zero activity-analytics requests after an observed profile failure. Main inspected the diff and git diff --check passes. Header.tsx remains unchanged. Release-task permission changes remain in its own worktree.

The canonical focused host Playwright run failed during runtime reconciliation, before global setup or any test: Docker Hub image inspection returned `connect: bad file descriptor`. Container-side plan formatting then failed with `no running container found for workspace "default-rs-f189c"`. Neither is passing verification, and no database reset was performed by that run. A normal ensure retry found an existing lifecycle owner, PID 71513, and exited without bypassing its lock. The process remains active; its owning task is not established, so do not interrupt it or start another transition.

Fresh read-only checks report Devsy rs-generation-lifecycle-contract as NotFound, no containers for Compose default-rs-f189c, and no default-rs-f189c_pgdata volume. Both configured local Docker endpoints resolve to the same OrbStack daemon. The source-path routing record still has eleven routes; stopped-runtime and retained-data claims from earlier checkpoints are no longer current. The browser remains closed. Resolve the active lifecycle owner and missing runtime/volume before further runtime mutation; do not claim cleanup or data preservation from stale records. No other task, configuration, volume or source was changed.

Remaining work is already approved once the environment identity is resolved: format and commit this plan, qualify the test repair, apply the minimal header layout correction, run adjacent browser checks and required committed reviews, then publish only verified source to the same draft. Toolchain, browser, implementation reviews and publication remain pending. The hosted-review authentication gate stays with its owner; the heartbeat remains paused.

### Completion extension: local qualification complete

Integrated final review: DONE on 208e97d38e6abfd13d997d48200077febc8c1445..801a04f7110486ffb09d45555a298c0fc7fa553b, all 13 changed paths, no reportable findings. Report: project/\_local/reviews/2026-09-05-element-completion-integrated-final-review.md. Main verified and accepted the result; reviewer closed. This closeout changes only Progress. Approved push to origin/rs/generation-lifecycle-contracts and update of the existing draft PR follow; hosted qualification remains pending. Runtime remains Stopped with zero routes.

The source head f901f7f16ca39029ff18bb59e30d658e0e4e731f passes the focused tests, business sentinels, native checks and full build recorded below. Slice review: done — project/\_local/reviews/2026-09-05-element-completion-slice-review.md, no findings. Simplifier: done — project/\_local/reviews/2026-09-05-element-completion-simplifier.md, no justified changes. Both children are closed. The exact task runtime has been stopped; route readback has zero routes and the owned app container is exited. Data and worktree remain preserved. Integrated final review of the full branch and approved own-branch draft publication remain next. Hosted checks and final AI review remain separate; inherited UI failures and hosted-review authentication are parked, not accepted as passing. No merge, upstream integration or deployment occurred.

### Earlier extension checkpoints

Final provider readback: devsy workspace status rs-generation-lifecycle-contract reports Stopped on the default Docker provider. The source-path-resolved devrouter inventory reports zero routes and no hosts. This closes the task runtime lifecycle without deletion.

Shared completion is committed at f901f7f16ca39029ff18bb59e30d658e0e4e731f. Integrated local verification passes: eight focused files/93 tests, eight business-regression files/106 tests, grading/ten tests, GraphQL typecheck, root serial typecheck/40 tasks and lint/seven tasks, both without cache hits, plus Syncpack and repository policy checks. Full production build passed 26 tasks with zero cache hits in 3m0.726s using Python 3.12 and /tmp/generation-completion-build-cache. No schema, migration, Analytics, SDL or dependency change. The container-local wiki validator is unavailable; scoped Prettier and direct source-link checks pass, and existing frontmatter is preserved except its semantic-update date. Simplifier: done — project/\_local/reviews/2026-09-05-element-completion-simplifier.md, no changes. Required data-integrity slice review is active (01a0713f-2327-7201-b47f-c2f301d63498). Runtime shutdown, integrated final review and approved draft publication are next. Prior completed-build editor/browser evidence remains applicable to unchanged editing/saving code, not evidence of initial completion. All assertions introduced for initial completion use the real synthetic PostgreSQL boundary.

2026-09-05 continuation checkpoint: executor Bernoulli delivered the shared completion operation and is closed. Main verified one transaction with one draft insertion/count and one fenced terminal update; both old completion bodies are removed. The 26 characterization assertions are unchanged apart from routing to the shared operation. Focused verification passed 93 tests in eight files at 10:59 UTC, including both real takeover races; GraphQL typecheck passed. Scoped Opengrep ran 210 rules on five production files with zero findings. Schema, migrations, Analytics, public SDL and lockfile remain unchanged. Formatter-only import/export reorderings outside the extraction were restored. Source-slice reviews and integrated verification/publication remain pending. The exact task runtime is active; other owners and runtimes remain untouched. Refreshed v3-ai remains at 208e97d38e6abfd13d997d48200077febc8c1445; stable v3 is two commits ahead of this branch's common history, without completion-path overlap. No integration occurred.

Completion test slice is committed at f2fd5aed02b1da147f4ef9a31d6878f87d0d8f41. Slice review: done — project/\_local/reviews/2026-09-05-element-completion-tests-slice-review.md, no findings. Simplifier: done — project/\_local/reviews/2026-09-05-element-completion-tests-simplifier.md, no justified changes. Both children are closed. The shared completion implementation is active; it must preserve all 26 cases and replace both old bodies before source acceptance.

Completion characterization: main took back the bounded test slice after the executor continued design without delivering an artifact following a narrowing checkpoint. The child is closed; this was a progress-contract failure, not a model availability failure. The new 26-case suite passes against the original helpers. It covers type/state/result compatibility, stored payloads and nulls, unchanged re-entry rows, distinct count rules, and both real post-read lease takeovers with rollback and unchanged accounting. Test-only transaction instrumentation delegates the entire transaction to Prisma and records its backend PID; the query-extension barrier returns the actual query result. Two real concurrent transaction clients have different PIDs and release through Prisma; the suite disconnects its shared pool after completion. Initial assertion/type mistakes were corrected in the test only, not production. GraphQL typecheck and scoped Biome checks pass. Root serial typechecks passed 40 tasks; remaining repository checks passed. Required test-slice simplifier and data-integrity review are next; completion production code is still unchanged.

### Current status

2026-09-05 extension approved and starting: test-only characterization, then one shared Element completion operation. Baseline head 5e984643c6a63f800e4402736fa5d3370a980ae8; origin/v3-ai unchanged at 208e97d38e6abfd13d997d48200077febc8c1445. Stable v3 advanced one commit; no integration. Existing PR GraphQL74-file and codebase checks passed; inherited UI failures and hosted review authentication remain parked. The following completed-scope evidence is historical and must not be read as completion of this extension.

Extension baseline verification, 2026-09-05: approved plan committed at ea717d68601151998e7d7f7405c63a0a70cafad7. Exact task runtime resumed with manage profile, Devsy rs-generation-lifecycle-contract, Compose default-rs-f189c. Created empty generation_completion_20260905 database in the task-owned volume and applied the unchanged schema; every test invocation explicitly overrides DATABASE_URL before imports. Existing seeded databases remain untouched. Seven generation/accounting/lease/persistence files passed 67 tests, eight business sentinel files passed 106 tests, and grading passed ten. Schema/Analytics/SDL/lockfile diff remains empty. The new completion characterization is in progress; production completion code is unchanged. The previous heartbeat is paused after its 09:43:58 UTC deadline. Runtime remains in active use for this authorized verification phase and must be stopped at its end.

Implementation and slice reviews are complete locally. Published base is 208e97d38e6abfd13d997d48200077febc8c1445; lease refactor is 5c334a959ac6ec46a13287bb08ee3d4190731343; persistence tests are 2960efc6f6560cc2003bd7ad58a203231a0b9831. Execution custody is trees/rs/generation-lifecycle-contracts on rs/generation-lifecycle-contracts, tracking origin/v3-ai. The refreshed remote refs and overlapping pull-request owners are unchanged. No upstream integration occurred.

The required local implementation and review gates are complete. Documentation evidence is committed at 620ab16d0b286e99318d3f7c166146a3f8ff2a87. Integrated final review passed on the complete base-to-documentation range with no reportable findings; exact runtime shutdown is verified below. The user then approved draft publication. Initial head 6fa13de25295e84c3240d78f8cb9846953915d1d was pushed and matched remote readback; [PR #5777 — generation synchronization leases](https://github.com/uzh-bf/klicker-uzh/pull/5777) is open and draft with base v3-ai. This PR-identity update changes only the plan. Hosted checks and final AI review remain pending; no merge readiness is claimed. W4 — lifecycle normalization remains partial, and this package does not complete data-model normalization or qualify 3.4.0 RC for stable v3.

### Completed implementation and evidence

- All five acquisition/release callsites share the small lease primitive while retaining their status predicates, error handling and finally ownership. The durable dispatch/accounting claims are unchanged. No schema, migration, public SDL, dependency, Element service or provider-contract change exists in the branch.
- Ten database tests were added: five lease tests and five real Element persistence tests. Two existing artifact-failure tests gained release assertions; none were removed. The persistence tests prove concurrent identical/conflicting keeps, real transaction rollback at final-link invocation, foreign-owner rejection and disabled entitlement without disabling manual authoring. They do not claim SQL-constraint failure injection or in-memory event rollback.
- Focused lifecycle/accounting/lease verification passed 62 tests; the corrected typed lease fixture passed its five tests again. The new persistence file passed all five tests. Eight existing business-regression files passed 106 tests; grading passed ten. Only the task-created synthetic PostgreSQL database was used, with existing native cleanup allowed after ownership verification.
- GraphQL generate/typecheck/public SDL equality, scoped Biome format/lint and Prisma mirror checks passed. The isolated serial root check passed all 40 tasks with zero cache hits, using Python 3.12 and a task-local write-only cache. Full build passed 26 tasks with zero cache hits at concurrency two. Root lint, syncpack, AGENTS, Git identity, removed-document and Playwright CI/host policy checks passed. Actual staged gitleaks checks passed before both implementation commits. The host hooks were split because toolchain checks ran inside the container.
- The existing host Playwright generation-review journey passed one test in 38 seconds. It exercised SC, MC, KPRIM and flashcard editors, save/discard/reload behavior and persisted Element data without provider calls. Agent-browser also verified the seeded summary and canonical editor after delegated login, using the same browser-local GrowthBook fixture as Playwright; server authorization and account entitlement were not mocked. Local screenshots are project/\_local/generation-review-inbox.png (completed-build summary) and project/\_local/generation-review-editor.png. The earlier generation-review-desktop.png records the closed browser flag, not successful review evidence.

### Remaining direct business-state writes

| Existing owner                | Retained write sites                                                                                                                                                                                                                                          |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Question-generation workflow  | Eleven direct build updateMany calls remain in recordBuildFailure, dispatchPreparingQuestionBuild, synchronizeLeasedBuild and dispatchQuestionReviewLeased. They own failure recording, dispatch correlation, polling/review status and publication outcomes. |
| Flashcard-generation workflow | Seven direct build updateMany calls remain in recordStartFailure, dispatchPreparingBuild, dispatchIncompletePublication, markResumableOrFailed and synchronizeLeasedBuild. They retain flashcard retry and incomplete-publication semantics.                  |

This is an ownership inventory, not a claim that every business-state write is fenced by the short lease. Broader transition normalization remains separate roadmap work.

### Reviews and delegation

Lease slice review: done — project/\_local/reviews/2026-09-05-generation-lease-slice-review.md, no findings. Its simplifier report records why explicit clock injection and conditional release results were retained. Persistence slice review: done — project/\_local/reviews/2026-09-05-generation-persistence-slice-review.md, no findings. Persistence simplifier: done — project/\_local/reviews/2026-09-05-generation-persistence-simplifier.md, no justified reduction. All children are closed. Main verified and dispositioned every result.

A bounded executor produced the lease extraction; main corrected typed fixtures and checked the five callsites. A second executor supplied read-only persistence-fixture design. The persistence implementation executor continued discovery beyond one narrowing checkpoint and was closed; main completed that single test file instead of launching a replacement. The earlier planner approved the hardened plan. Claude advisor/opposing review failed OAuth before work and are not claimed as completed.

Integrated final review: DONE, no reportable findings on 208e97d38e6abfd13d997d48200077febc8c1445..620ab16d0b286e99318d3f7c166146a3f8ff2a87, all nine changed paths. Report: project/\_local/reviews/2026-09-05-generation-lifecycle-final-review.md. Main verified and accepted the result; the child is closed. Bookkeeping-only closeout preserves the reviewed source and test tree. Fresh fetch on 2026-09-05 confirmed unchanged origin/v3-ai at the published base and origin/v3 at 468f05b91503b133670dda235be9a4b38bba2155; reviewed head was four commits ahead of v3-ai and 138 ahead of v3, zero behind either. No integration occurred.

### Environment lessons and limitations

The standard parallel/shared-cache check:all command failed on baseline generated-artifact/type issues and an Analytics Python mismatch. Serial checks against the same shared cache also reproduced inherited errors. Regeneration plus a task-local fresh cache and the configured Python 3.12 produced the passing 40-task check; no build configuration, dependency or shared cache was changed. Do not report the literal parallel command as fixed.

An early test invocation included an extra argument separator and selected the full suite; it was cancelled and is invalid evidence. The correct finite selection was verified before the passing rerun. The lesson is captured in docs/solutions/test-failure/graphql-focused-test-selection.md. A bootstrap port collision was avoided with the supported KB_GRAPH_BLOB_HOST_PORT=10043 override. A managed readiness rollback recovered on warm startup. Host permission review later timed out before launching formatting/stop commands; it recovered, and an exact stop was verified before the browser phase restarted the task runtime. None of these failures authorized shared-runtime repair or source integration.

### Runtime and next action

Only the repository's trees/rs/generation-lifecycle-contracts worktree was used: Devsy workspace rs-generation-lifecycle-contract, Compose project default-rs-f189c, task-created PostgreSQL volume default-rs-f189c_pgdata. The synthetic review fixture was removed with its existing cleanup helper, and the isolated browser was closed. Final shutdown readback on 2026-09-05 returned provider state Stopped; devrouter's exact source-path match returned routeCount 0 and no hosts. No keep-running exception exists. Worktree and database are preserved; deletion is not authorized. Optional later teardown requires separate approval for devrouter stop trees/rs/generation-lifecycle-contracts --delete from the repository root, which removes this task's managed runtime data and caches, not its Git worktree. Publication does not restart the runtime.

Next: assess exact-head hosted checks and ordinary feedback, then use the repository's standing final-AI-review authority when eligible. Leaving draft, upstream integration and merge remain separate approvals. Continue later lifecycle normalization from the remaining writer inventory and existing owner results, not a duplicate lease or ingestion implementation. No upstream integration, merge, deployment, real data, paid application-provider calls or shared-runtime mutation occurred. The pre-push build was reused on the unchanged source tree; host identity checks ran again and HUSKY=0 avoided restarting container-dependent checks on the host.

Destination update, 2026-09-07: host Devrouter 0.0.55 became available during the turn without installation by this task. The new host resolver succeeds and all 13 host-launcher tests pass. JSON/YAML parsing and diff checks pass. All conflict markers are resolved; container qualification is next. The earlier installation request is no longer needed.
