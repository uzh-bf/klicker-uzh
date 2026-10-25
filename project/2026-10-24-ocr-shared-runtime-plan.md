# Shared OCR runtime and repository adoption

## Approval summary

Use one versioned OpenCodeReview runtime and execution policy across repositories,
with small forge-specific entry points and repository context settings. The
current engine is already shared through a pinned checkout, but adoption still
copies controller code, workflow steps and behavioral tests. Those copies have
started to diverge. Centralizing those parts lets one reviewed fix reach each
adopter through a small, explicit version update.

Keep the current draft, advisor and final models, maximum reasoning, budgets,
accounting, retries, deadlines, concurrency and publication semantics. Repository
settings describe trusted documentation and skills, public-library IDs and local
identity. They cannot activate private review, choose an arbitrary endpoint or
override execution limits. Credentials remain scoped to their existing owners.
New trusted root-context access can affect review findings and input usage
within the existing allowances; it does not promise identical model output.

Start by hardening and extracting the public donor implementation inside this
repository. Use immutable source revisions before adding a package registry or
container release pipeline. Migrate GitHub callers after the shared contracts
pass, then qualify a separate GitLab controller and publisher on a selected
instance. Full final review retains its forge-specific admission and evidence
gates. Native GitLab execution is not established by the existing transfer guide.

The user approved package 1 through commits, ordinary push and a draft PR against
`v3`, and requested a native goal for execution. Previously agreed hardening
remains approved. Packages 2 and 3 remain proposals; new
repositories, mirrors, publication infrastructure, live activation, credentials,
merges and paid qualification remain separate decisions. Success is a tested
shared implementation with small callers, followed by independently recorded
source, hosted CI and authorized ordinary live evidence for each adopter.

## Execution details

### Working context and evidence

Execution mode: standard. Boundary owner: main session. Planning worktree:
`trees/rs/ocr-shared-runtime`, branch `rs/ocr-shared-runtime`, target `v3`.
Baseline: `6dad21cc7a6da46eb4931b1195e99f9c9d0d2216` after remote refresh.
The primary checkout and older task worktrees remain untouched.

Continue the [advisor and transfer roadmap](2026-10-18-ocr-review-advisor-plan.md)
and [startup repair](2026-10-23-ocr-startup-repair-plan.md). This plan owns the
new shared-runtime package; older merged plans remain historical evidence.

Verified public source at the baseline:

- `.github/scripts/ocr-draft-review.cjs` already provides the reusable review
  entry point and owns provider/tool/process lifecycle. Its result helper import,
  GitHub summary sink and publisher installation check couple it to GitHub.
- `.github/scripts/ocr-mistral-adapter.cjs` owns provider transport, bounded
  progress, usage and cost accounting. Preserve its established contracts.
- `.github/scripts/ocr-review-tools.cjs` reads trusted policy blobs under
  `docs/` and `.agents/skills/`. Root contracts are inaccessible, and allowed
  public-library IDs are currently specific to the donor's web stack.
- The public draft workflow still uses sparse trusted checkout and ordinary
  success-only validation/publication sequencing. Complete blobs and valid
  partial-result publication need explicit protection in the shared path.
- `.github/scripts/final-ai-review.js` includes command authorization, exact-head
  CI, readiness, status ownership and native-stack evidence. Extracting a shared
  runner does not transplant those guarantees to another forge.

Private adopter comparisons and raw specialist reports stay in ignored
`project/_local/`. Public documentation describes mechanisms and synthetic proof.

### Shared and local ownership

| Concern | Shared release owns | Repository or forge owns |
| --- | --- | --- |
| Review execution | Provider adapter, OCR lifecycle, coverage, sanitization, cost/progress receipts, bounded advisor and docs tools | Immutable source range and approved capability admission |
| Execution settings | Reviewed draft/advisor/final profiles and unchanged operational limits | A supported profile identifier; no arbitrary model, endpoint, command or budget override |
| Trusted context | Path/schema validation, Git-blob reader, pagination and byte/line bounds, portable reviewer procedure | Trusted guide pointers, explicit root entry points, supported docs/skill roots and public-library IDs |
| Forge integration | GitHub composite action/controller; separately implemented GitLab controller/publisher | Host/project identity, events, job policy, credentials, required checks and activation authority |
| Delivery and recovery | Manifest, compatibility checks, central regression fixtures and release notes | Reviewed immutable version adoption and source revert to a qualified prior release |

No user-facing product primitive changes. Compose existing review requests,
trusted policy, review results and publication; only their implementation
ownership changes. A new shared distribution contract crosses an architecture
boundary. Record its accepted rationale in one ADR when implementation freezes
the distribution contract. A hosted controller service, candidate execution or
cross-project credential owner would reopen that decision.

### Runtime and configuration contracts

Keep a small standalone Node runtime with no application dependency installation.
Separate pure result/background helpers from final-review authorization code.
Inject report sinks and forge-specific publisher verification rather than
teaching the core to impersonate GitHub on GitLab. Preserve existing exports
through compatibility entry points while callers migrate.

Bind one run to the runtime release, resolved execution profile, trusted policy
revision, source/diff identity and portable skill. Record the resolved identities
in sanitized receipts. Reject unknown configuration fields, malformed revisions,
unsupported profile versions and mismatched artifacts before provider dispatch.
Read repository settings from the trusted policy revision; candidate settings
are evidence for review, never execution authority.

Use a narrow schema for repository settings. It permits repository identity,
trusted review-guide pointers, bounded documentation/skill roots, explicit root
Markdown contracts such as `AGENTS.md` and `CONTEXT.md`, and a finite list of
public Context7 library IDs. Missing library configuration disables lookup for
that adopter; migration writes the donor's current IDs explicitly to preserve
its behavior. Paths retain traversal, symlink, blob-mode, byte, line and
pagination checks. Reading a guide pointer must work through the actual broker
at the committed policy revision. Preserve the independently authorized docs
opt-in and its current public-query data boundary.

Shared defaults are code constants behind supported named profiles, immutable
within a release. Repository configuration has no execution-setting overrides.
First extract their actual
values and effective command construction from the current implementation,
including manual/final settings. Validate equivalence with existing behavioral
contracts. Do not create a second undocumented set of defaults. Freeze accounting
formulas, provider usage distinctions and reference-price dates independently
of repository configuration.

Preserve three effective contracts: automatic draft, individual final and stack
final. The two final paths have different task timeouts, runtime admission and
reserved cleanup/topology allowances, in addition to preview, retry/resume and
aggregate accounting. This package does not replace final execution or its
configuration construction. Sharing its pure helper imports still requires
both existing final paths' tests to pass. Any later final execution extraction
must compare both modes, not a single nominal final profile.

Draft policy is the actual complete trusted default-branch checkout, frozen
from its verified `HEAD` before configuration/context reads. Final policy stays
the verified workflow-definition SHA carried through its existing authorization
and execution chain. Runtime/action revision is separate from repository policy.
Read each run's configuration, guides, skill and authorization evidence from its
one frozen policy identity. A default-branch movement test must reject or avoid
mixed-revision evidence; it must not silently retarget an in-flight run.

Credential availability does not authorize capability activation. Keep private
review and public docs admission in trusted forge settings. Capture provider
keys as explicit adapter options, scrub the controller's ambient credentials
before engine imports, and give all metadata Git commands a clean environment.
Candidate code, scripts, hooks, dependencies and YAML never execute inside the
secret-bearing review boundary. Use complete history and blobs for review input;
the publisher-only checkout may stay sparse.

### Distribution and upgrades

Prefer a pinned source release initially. The shared runtime remains in the
public donor repository until extraction to a dedicated public tooling project
is explicitly authorized. Keep paths and imports independent of application
packages so later relocation does not redesign the execution contract.

One reviewed release manifest binds profiles, portable skill, per-mode OCR
binary/install identities and publisher dependencies. Drafts currently use stock
npm OCR 1.13.0; final review uses the pinned upstream source plus compression
patch and its build toolchain. Preserve both paths. A common manifest must not
silently switch draft review to the patched binary.

The GitHub caller pins a composite action by full commit SHA. The action uses
its own bundled code through `github.action_path`, avoiding another runtime
checkout pin. Bind source assets and external binary/publisher dependencies by
digest in its manifest; the receipt records the enclosing action/source revision
without a manifest embedding its own enclosing commit hash. GitLab consumes the
same source revision through a verified source checkout or archive. Verify its
identity and extraction integrity before executing the shared CLI. Select the
smaller qualified bootstrap during implementation; neither moving tags nor
unverified downloaded scripts are permitted.

Bootstrap in two deliveries: first publish the reviewed runtime/action source
revision on the authorized task branch and verify its tree and offline CI;
then prepare a consumer update that pins that actual commit. After the runtime
PR is merged, use its verified merged revision for durable consumer adoption.
Do not write a placeholder, guess a future squash SHA or use a local action
path as proof of cross-repository immutable distribution. Local-path synthetic
tests qualify development wiring only. Consumer pin preparation waits for the
actual published source; merge authority is not implied by this dependency.

The repository retains a small caller, trusted settings and repository-specific
guide. Preserve the discoverable `ocr-reviewer` skill while centralizing its
authoritative content; any checked-in copy is verified against the pinned
release and updated together. The operator skill `rs-ocr` teaches discovery,
configuration, upgrade and qualification rather than copying implementation.

Upgrades remain reviewed PRs/MRs changing the immutable release binding and any
necessary schema migration. Shared fixes are authored once; rollout is explicit
per adopter. Never load mutable central settings or a moving `latest` during a
run. An update helper may prepare changes later, but recurring updates or new
automation are not part of this package. Source rollback selects a compatible,
previously qualified runtime/profile/skill set together.

Npm publication, OCI images, a new public tooling repository and a GitLab mirror
are deferred distribution options. Revisit a package or image when repeated
source bootstrapping or runtime dependencies measurably justify its release
infrastructure. Revisit a dedicated home when the extracted API is stable and
independent maintenance warrants moving ownership.

### Forge-specific integration

GitHub uses a shared composite action with explicit inputs and credential
bindings. Keep events, permissions, runner/timeout/concurrency and activation
declarations visible in the small repository job. The shared action owns the
common review steps and invokes the controller from its pinned action path.
Scope provider credentials to the execution boundary and publisher credentials
to publication, rather than exporting them to every action step. Resolve
trusted policy and candidate source independently; never infer the runtime
repository from caller-associated workflow context.
Preserve publication validation, partial/failure state, current-head checks,
deduplication, logs and retention. Keep the final-review gate unchanged while
sharing its execution helpers; adding full final review to an adopter is a
separate capability migration.

GitLab uses a trusted default-ref/controller pipeline, selected for the actual
instance and repository, plus a GitLab publisher. Treat any supplied project/MR
identifier as untrusted input and re-query eligibility through the forge API.
Freeze target/source project IDs, MR IID, diff version and base/start/head SHAs.
Qualify pagination, exact text positions, renames/deletions, summary fallback,
head changes, deduplication, uncertain writes and cancellation. Reuse the
runtime's result and accounting contracts, with GitLab-native logs/artifacts.

A CI component can share offline checks or trusted controller configuration;
including it in ordinary candidate MR YAML does not establish trusted execution.
Components on a different GitLab instance need an approved mirror or another
qualified distribution route. Do not create a controller project, token, mirror,
webhook, pipeline trigger or deployment as a planning side effect. Native GitLab
final admission and commit-status lifecycle remain separately qualified work.

### Research

The main session owns current platform documentation and authority decisions.
A trusted native mapper inspected only scoped implementation paths; its report
identified the copied controller/workflow/test seams and final-review coupling.
Claude Opus 5.5 was requested for an architecture consultation. Automatic
approval review rejected private adopter export, so its accepted consultation
is limited to verified public donor source and generic design. Private adapter
conclusions are checked locally, not attributed to Claude.

Current primary documentation supports these platform constraints:

- [GitHub reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows): cross-repository workflow calls, immutable SHA references and explicit inputs/secrets.
- [GitHub composite actions](https://docs.github.com/en/actions/tutorials/create-actions/create-a-composite-action): reusable steps, SHA-pinned calls and access to bundled code through `github.action_path`.
- [Reusable workflow reference](https://docs.github.com/en/actions/reference/workflows-and-actions/reusing-workflow-configurations): caller-associated context, permission ceilings and caller/callee concurrency collisions.
- [GitLab components](https://docs.gitlab.com/ci/components/): versioned reuse, caller-configuration merging and same-instance component references.
- [GitLab MR pipelines](https://docs.gitlab.com/ci/pipelines/merge_request_pipelines/): source-branch configuration, fork/parent resources and protected-resource conditions.

Context7 retrieved current documentation; the main session inspected the
corresponding primary sources. The exact self-managed GitLab version/topology
remains a pilot prerequisite. The optional opposing-provider route is currently
unavailable because its CLI is unauthenticated; no fallback opinion is claimed.

### Packages and acceptance

1. **Harden and expose the shared seam: next package.** Slice A applies complete
   credential-free Git inputs and partial-publication protection in the existing
   draft workflow/runner and their existing tests. The already approved adopter
   credential/publication backport remains an independent repair, using its
   existing controller/workflow/tests; the expanded refactor grants it no new
   authority. Slice B adds `.github/scripts/ocr-review-shared.cjs` for neutral
   result/background helpers and their transitive pure helpers, with compatibility
   re-exports from `final-ai-review.js`. Slice C adds
   `.github/scripts/ocr-runtime-config.cjs` and
   `.github/open-code-review/repository.json`, then extends the existing runner
   and broker for trusted settings, root reads and explicit library IDs. Keep
   current public entry points compatible. Update `docs/ci-and-deployment.md`,
   the existing solution guide and portable skill in those slices as their
   contracts change. Acceptance: reproduced regressions fail before fixes,
   focused contracts pass, both final paths retain passing helper contracts,
   effective draft configuration/commands/accounting match, and every advertised
   trusted entry point is readable. Commit boundaries follow A, B and C with
   affected checks and review. Deliver one draft PR against `v3`; no composite
   action or consumer migration is needed to accept this package.
2. **Replace GitHub integration copies: subsequent package.** After package 1's
   source is available, add `.github/actions/ocr-review/action.yml`,
   `.github/open-code-review/runtime-manifest.json`,
   `.github/scripts/ocr-controller.cjs` and its shared behavioral test
   `.github/scripts/ocr-controller.test.cjs`. Reuse existing provider/runner/tool
   scripts at their paths rather than reorganizing them merely for packaging.
   The controller exposes runtime commands and the shared caller/config check.
   Add `docs/ocr-runtime.md` as the runtime API/bootstrap guide. Publish and verify
   the immutable action source before preparing caller pin changes. Migrate the
   donor, then the first established adopter and two existing adoption drafts,
   using their existing workflows/config/guides/plans; remove duplicated adapter
   controllers/test suites only after central equivalents pass. Each migration
   has its own exact scope and review before delivery. Acceptance: small caller
   mutations fail the shared check, pins resolve to verified action/manifest
   assets, broker entry points work and producing offline CI passes. No new
   local test suite, private activation or extra paid replay.
3. **Qualify native GitLab adoption: later proposal.** Select an actual GitLab MR repository and
   resolve instance version, trusted execution, minimal API capabilities and
   distribution. Implement its adapter/publisher against the shared runtime,
   with synthetic MR/API fixtures first. Activation, credentials, a mirror or
   controller project and one live qualification window need named authority.
   Source delivery alone leaves GitLab live support unqualified.

The main session owns integration and final proof. The next package's delegation
map assigns slice A to main, slice B to a trusted executor with its new helper
file and existing import/re-export regions only, and slice C to main. No writers
overlap; slice B begins only after main freezes its pure helper contract. The
executor receives exact public paths, tests and no private adopter source.
Package 2 remains proposed and main-owned until its migration-specific scope is
frozen. Package 3 has no executor or source changes before pilot selection and
trusted execution are resolved. Delegate other settled, disjoint fixture work
only within those owners and approved write sets.
Use one simplification pass per substantive slice, risk-selected source review
and an integrated final review under the standard workflow. Source delivery
includes commits, ordinary task-branch pushes and draft PR/MR updates after
agreement; preserve existing human and hosted final-review gates before merge.

| Consequential behavior | Existing protection and changed obligation | Primary acceptance seam |
| --- | --- | --- |
| Same review policy and accounting | Extend existing `ocr-draft-review.test.cjs` and `ocr-mistral-adapter.test.cjs`; reuse `final-ai-review.test.js` and installer tests unchanged | Effective legacy/shared options and commands; synthetic provider receipts; stock draft/patched final identities |
| Source and credentials stay isolated | Extend existing runner/tool tests and shared controller contracts when introduced; no copied adopter suite | Ambient in-process/Git sentinels, missing-blob rejection and complete-clone control |
| Trusted configuration and context | Extend existing `ocr-review-tools.test.cjs` and `ocr-draft-review.test.cjs` | Exact trusted root blobs, invalid config, candidate-policy rejection, explicit libraries and default-branch movement |
| Honest failure and publication | Extend existing runner tests; consolidate controller tests centrally in package 2 | Nonzero OCR with valid partial output reaches validation/publisher; invalid output cannot publish; original failure remains observable |
| Reuse works across forges | Add one shared controller test file in package 2; GitLab fixture locations settled with pilot, no tests added in package 1 | Caller parser, immutable action assets and later forge API adapters |

Run `node --test` on the affected existing OCR test paths; the helper extraction
also runs `.github/scripts/final-ai-review.test.js`. Inspect the installer test
path before that check rather than assuming a new suite. Runtime/profile tests
use structured command/options and synthetic receipts rather than prose.
Formatting and secret/data review apply to all changed files.

Package 1 acceptance requires credential-free Git controls, unchanged effective
draft settings, both final helper suites and controller-level partial-publication
proof. A parsed workflow assertion alone is insufficient for the latter. Package
2 migration additionally requires actual stock binary smoke proof with synthetic
providers and verified patched-final installer/version identity, or reports that
migration blocked on unavailable evidence. Broader optional usefulness/caching
observations do not block source delivery and cannot replace mandatory proof.
Never run a paid provider replay to obtain binary compatibility evidence.

Source-ready draft delivery means focused local checks/review and an ordinary
push with an accurate description. Hosted offline CI is reported as passed only
after its producing job runs; it may be pending at draft creation. A consumer
migration is source-accepted only when that offline job passes. Trusted merged
policy and an actual authorized ordinary event establish later live acceptance.

No application runtime, browser session or screenshots are needed for this
nonvisual workflow change. No new test suite copied into each adopter. Add tests
for behavior and machine contracts, not guide wording or example-file contents.
Use existing repository checks; preserve optional unavailable fixture labels.

Update `docs/ci-and-deployment.md`, the existing OCR solution guide and portable
reviewer skill when their contracts change. Add a dedicated shared-runtime usage
guide with the extracted implementation, not a second operator procedure.
Update the `rs-ocr` references with the new manifest/config/caller workflow;
leave non-`rs-*` upstream skill sources unchanged. The existing advisor roadmap
links this proposed package; it does not imply implementation approval.

Terminal: agreed package's source, focused checks, review, ordinary push and
draft delivery complete, with live acceptance explicitly bounded. Merge and
ordinary post-merge observation require the applicable existing or new authority.
Pause for a material trust/identity decision, an unavailable required review
capability or a separately gated effect; routine implementation choices do not
create another approval checkpoint.

## Progress

Package 1 source delivery complete through draft
[PR #6700](https://github.com/uzh-bf/klicker-uzh/pull/6700), against `v3`.
Packages 2 and 3 remain proposed. Slice A is committed
as `af8c53d7d8`; slice B as `a6c988cb8d`. Slice C adds strict trusted config,
root-context access, explicit library selection and an injected summary sink.
The runtime now records its policy SHA and fixed profile in sanitized outcomes.
Claude Opus 5.5 completed the
public-source consultation. Accepted advice: source distribution first, a
GitHub composite action, fixed execution profiles, explicit context/library
settings and distinct stock-draft/patched-final binary identities. Private
adopter comparisons remain locally verified evidence. Merge of configuration
alone never grants capability activation.

The native planner returned `REVISE`, then `APPROVED` after all five findings
were accepted: concrete slice/file ownership; individual/stack-final contract
preservation; immutable-source bootstrap order; mandatory behavioral/binary
proof; and separate frozen draft/final policy selection. Details and raw advice
are retained under ignored `project/_local/reviews/`. The optional opposing
provider was unavailable; no opinion is claimed. Four public documentation
claims received an advisory citation check: one supported, three deferred and
resolved by direct primary-source inspection. The GitLab trust-boundary
conclusion is an inference from the documented pipeline behavior.

All 264 focused tests passed on Node 24.21.0, including both final-review paths
and the actual stock OCR 1.13.0 binary with synthetic providers/tools. The
runtime scan found no issues in the four changed runtime modules. Source/live
acceptance remains separate; no live replay ran. Simplification of slices A and
B found no useful reductions. Slice C removed an identical path-validator copy
by reusing the configuration validator; all 15 affected tool tests passed.
Committed-policy broker reads reached both root contracts, the guide and the
portable skill without provider calls. The input risk review passed. Claude's
integrated final review passed through `031540a164` after local schema validation;
the initial malformed response was corrected within the same review contract.
The remaining helper/config risk review also passed, including the validator
simplification. All required local source reviews are complete. Hosted CI is
reported separately and remains pending at this draft delivery; skipped draft
final-review jobs do not qualify ready-stage review. The next implementation
package remains proposed, and merged-policy acceptance awaits an authorized
ordinary event after merge.
Claude CLI reviews use the
user's standing explicit `claude-opus-5-5` selection at medium effort. PR #6698
is merged into `v3-ai`; its prefixed-install guard fix stays owned there and is
not copied into this branch. Package 2 depends on a verified published
runtime revision; native GitLab work depends on pilot selection and its trust
and authority decisions.

The host's standard hooks explicitly defer monorepo checks/builds because this
checkout has no dependency installation; their hosted CI has not been claimed
passed. Focused scripts ran directly with the pinned Node version and existing
formatter binaries. No application or container runtime was started. The local
data-hygiene hook flagged synthetic credential assignments in tests; these
verified false positives used its documented override after staged inspection
and passing gitleaks. No real credentials or environment data entered the diff.

Scope size before the final documentation update: 1,107 changed substantive
lines, including moved helper bodies and consequential regression tests; plan
and roadmap artifacts excluded. This is one cohesive runtime preparation
package. Shared action distribution and adopter/GitLab migrations remain outside
this PR. Global `rs-ocr` distribution instructions will change with that later
manifest/caller package; this PR updates the portable model-facing skill and
current CI/solution documentation together.

### Ordinary feedback correction and conditional merge

The user authorized marking this PR ready after CI, the configured final review
and squash merge into `v3` only after the required gates pass. All eight required
CI contexts passed on `b6238275f5`; its ordinary draft review completed all nine
selected items and supplied new feedback. A synthetic replacement-object case
confirmed that metadata Git could substitute policy content. The correction
shares one Git environment that disables system/global configuration and object
replacement across the runner, config reader and broker. It also handles empty
context discovery without Git and removes unused profile fields and duplicate
library validation. A bracket-path suggestion was rejected after successful
literal reads; its behavior remains covered by the configuration fixture.

All 265 focused tests pass after correction, including the stock-binary fixture.
The new Git replacement/global-config regression and empty-root regression
protect the changed behavior. This correction requires its own source review
and current-head CI before readiness; earlier-head green checks are historical
evidence. No review settings, usage accounting or retry policy changed.

## Package 2A: publish the shared GitHub action source

The user's post-merge “proceed” continues the next source package. Package 1
is merged into `v3` as `dbe911583c33c7d0ca096da1ef977e9d4da0ceb3`;
its complete tree equals the reviewed correction head. Its final review
completed seven selected items with zero findings. No subsequent ordinary draft
event has yet established live acceptance of that merged policy.

Build and deliver the versioned action source first, then migrate callers in
separate dependent deliveries. This source-only delivery adds no active caller,
private activation, provider replay, credentials, runner setting or merge.
Existing review models, reasoning, budgets, accounting, retry behavior,
concurrency and timeouts remain the implementation's fixed contracts.

Execution mode: standard. Reuse `trees/rs/ocr-shared-runtime` on the new task
branch `rs/ocr-shared-action`, based on the verified merged `v3` revision.
The main session owns runtime/forge identity, credential boundaries and
integration. A bounded read-only explorer maps existing public call contracts.
A settled action-metadata write may be delegated after the controller contract
is frozen; shared files remain main-owned.

### Contract and smallest implementation

Add only the previously named action, release manifest, controller, shared
controller tests and `docs/ocr-runtime.md`. Reuse the existing runner's CLI
implementation through a compatibility export. Keep final execution and its
authorization/status lifecycle in the current controllers. The manifest binds
the portable skill, runtime files, stock draft CLI/publisher identities and
the separate patched-final installer/source/patch identities. SHA-256 asset
checks detect mismatched releases before imports or provider dispatch. A source
revision belongs in the run receipt, avoiding a manifest's self-reference.

The remote composite action must be pinned by a full commit SHA. It resolves
its controller from `github.action_path`; it never imports candidate scripts
or discovers an engine through the caller checkout. The action uses the same
complete trusted default-branch checkout, pinned publisher, stock CLI install,
range fetch, review, validation/publication, sanitized artifacts and summary
steps as the existing donor workflow. Provider credentials enter only review;
the repository token enters checkout/fetch and publication, never the OCR child
or metadata Git. Private authenticated fetching uses a transient Git process
environment, with no token in arguments, persisted Git configuration or logs.
This source support does not activate any private repository.

The controller validates the GitHub event/repository/PR identities, frozen
policy and source revisions, configured context and portable skill provenance.
It writes a private run context and a sanitized identity receipt, then supplies
that frozen context to existing runner commands. Publication rechecks the
current open draft head and validates the result before loading the pinned
publisher. Cancellation, invalid input and supersession cannot publish. Valid
partial findings may publish while the review/action still fails. Artifact upload failures remain job failures; only summaries are
best-effort. Preserve seven-day retention. There is no recovery retry or changed OCR resume policy.

The shared caller checker consumes a parsed workflow object plus the expected
immutable action pin. It checks trusted event admission, explicit permissions,
self-update guard, fixed timeout/concurrency, action-only execution and the
credential bindings. Repository-owned additional activation remains explicit
in the caller. It validates trusted config and skill against the same release.
YAML parsing belongs to existing offline tooling; runtime needs only Node
built-ins and the stock OCR CLI. No application dependency install is required
for the action.

### Slices, evidence and terminal condition

1. Main: expose the existing CLI, implement release verification/controller and
   manifest, and add behavioral tests in `ocr-controller.test.cjs`. Verify
   independent runtime/caller repositories, mismatched assets/config/skill,
   frozen inputs, credential-free metadata and sanitized run identity.
2. Main, or one bounded executor owning only action metadata: add the composite
   action and complete its controller-level fixture. Exercise review failure
   with valid partial publication, invalid results, cancellation, changed head
   and credential scoping. Extend existing CI to execute the central contracts.
3. Main: document runtime/bootstrap/caller usage, update this plan and the
   existing CI guide, simplify, obtain scoped risk and integrated source review,
   commit, push and open one draft PR against `v3`. Bind all final assets after
   accepted source corrections. Published immutable source and producing offline
   CI are prerequisites for subsequent caller migrations.

Extend the existing portfolio: one new central controller suite covers release
identity, forge orchestration and caller mutation rejection. Existing runner,
provider, tools, self-update and individual/stack final tests protect unchanged
execution. Reuse the actual stock OCR binary with synthetic providers; a missing
fixture remains a named acceptance blocker rather than a silent skip. Inspect
the existing patched-final identity evidence and run its unchanged installer
contracts; no paid inference is needed. Focused formatting, secret/data review
and the existing hook behavior apply before each commit.

Terminal for this delivery is reviewed action/controller/manifest source,
passing local focused contracts, ordinary push and an accurate draft PR.
Producing hosted offline CI is reported separately. No caller is repinned to
a guessed or future merge SHA. After the action source merges, migrate the
donor and established adopters using that actual merged revision, each with
its own review and offline policy job. Native GitLab remains package 3, pending
a selected instance/repository and its separate trusted controller/publisher.

Planning round 1 returned `REVISE`; all five findings were accepted. The
following details complete the frozen contract for round 2.

- The compatibility CLI accepts explicit `command`, `repo`, `policy`, `temp`
  and `publisherRoot` options with existing defaults. Its own imports stay
  relative to the verified runtime. A controller fixture runs from an unrelated
  directory with independent runtime/caller repositories and hostile duplicate
  script names, proving those files cannot supply runtime code.
- The controller's bootstrap imports Node built-ins only, then verifies the
  manifest's exact asset inventory and SHA-256 values before loading runner,
  adapter or tools. Bind controller/action, runner, adapter, broker, neutral
  helpers, config reader, portable skill, patched installer and patch. The
  resolved full action ref and action repository enter the sanitized receipt
  through `github.action_ref`/`github.action_repository` step environment.
  Caller skill bytes at the frozen policy must match the manifest skill hash
  before any dispatch. Reject missing, changed and symlink-substituted assets.
- The composite fixture evaluates the actual status expressions and runs real
  validation/publication boundaries. Assert final failure for review failure
  despite successful partial publication, publication failure and artifact
  failure; summary-only failure remains nonblocking. Do not soften upload.
- Add a producing CI qualification step selected for shared-runtime changes.
  Install stock `@alibaba-group/open-code-review@1.13.0` into a job-temporary
  prefix, set `OCR_NO_UPDATE=1`, verify its version, and run the existing
  native fixture with `OCR_TEST_BINARY=<prefix>/node_modules/.bin/ocr` and
  `OCR_REQUIRE_STOCK_BINARY=1`. The shared suite fails when the required binary
  is absent. Local qualification uses the already verified native 1.13.0
  fixture. Stock verification remains package/version plus publisher digest,
  separately labeled from the patched-final provenance chain.
- Caller checking also receives the caller repository, frozen policy revision
  and verified release root/ref. The CLI accepts a parsed workflow JSON file
  plus those explicit identities; trusted config/skill checks use Git blobs.
  Mutation fixtures reject changed/moving pins, additional execution, widened
  permissions, leaked credential bindings, weakened admission/concurrency/job
  timeout, invalid config and mismatched skill. Extra activation is a caller
  expression explicitly supplied to the check, never an engine activation.


Planning round 2: `APPROVED`; the same native planner accepted the completed
contract. Execute this source package under the user’s “proceed.”

### Package 2A implementation evidence

The compatible runner CLI seam is committed as `1fddf77a98`. Its legacy
command defaults remain intact; explicit caller inputs enable the shared
controller. The action/controller/manifest are one coherent release slice
because the manifest binds the action bytes; splitting that inventory across
commits would leave an unverifiable intermediate release. The independent
metadata executor wrote only the action file. Documentation and final
integration follow the committed release slice.

All 275 focused contracts passed on Node 24.21.0, including the actual stock
OCR 1.13.0 native binary with synthetic providers and both final suites. The
subsequent controller-only check passed 10/10 with zero skips after adding
caller config/skill mutation checks. No paid inference or live replay was used.
New tests: one central controller suite; existing provider/runner/final suites
reused. Formatting and changed-source secret scans pass. Biome reports only
nonblocking environment/style warnings; these operational scripts do not run
through Turbo's application environment cache. Source reviews and hosted CI
are still pending at this checkpoint. No active workflow caller was changed.

## Package 2B: adopt the published action in the donor

The user merged PR #6702 and requested continuation. Its actual `v3` merge
revision is `0032c990d40985ce120179ded2c9d4b6e6a1d940`, with a complete
tree equal to the final reviewed source. Use that full revision for the first
caller. Reuse `trees/rs/ocr-shared-runtime` on `rs/ocr-donor-adoption`, based
on the merge. The previous draft monitor is deleted because its PR merged.

Replace Klicker's draft workflow's repeated steps with the published action,
retaining its event types, job condition, guard/provider environment, explicit
permissions, runner, 45-minute deadline and concurrency. Pass only the existing
Mistral/Context7 bindings and GitHub token as action inputs. Preserve fixed
models, maximum reasoning, budgets, accounting, retries, publication and artifact
semantics; final controllers remain unchanged. No active private adopter,
GitLab pipeline, live setting or extra paid provider replay changes here.

This is a source migration delivered as one draft PR against `v3`. It becomes
the active donor workflow only after a separately authorized merge. Its ordinary
PR review still uses the current trusted default workflow. The first genuine
ordinary event after merge must verify remote action identities and producing
logs before claiming composite live acceptance or migrating other active callers.

### Scope and acceptance

Main owns the caller workflow and immutable release/policy seam. An executor
may adapt only the existing self-update/diagnostics guard suite once the pin is
frozen. Main adapts the existing partial-publication fixture to the published
composite metadata and adds one real-caller case to the existing central
controller suite. No adopter-local test suite or runtime module is added.

The central real-caller test reads the workflow's full-SHA action reference,
extracts only its manifest-listed runtime paths from the locally available Git
revision into a temporary directory, verifies that release, and invokes its
actual `checkCaller` against the caller's frozen policy. This binds proof to
the published runtime rather than a mutable local script with the same name.
Missing source objects fail the test; a full-history CI checkout provides them.
The existing synthetic mutation portfolio remains the protection for changed
pins, permissions, credentials, admission and added execution. The existing
real stock fixture verifies engine behavior with synthetic providers.

The partial-publication fixture must run the actual pinned controller's
validation/publication path or reuse the central controller fixture at the
release boundary. Preserve failed review status, reject invalid/head-mismatched
results and cancellation, and retain the seven-day sanitized diagnostics path.
Update existing guard tests to recognize the remote shared action and inspect
its published metadata; keep manual final provider checks intact. Do not pin
workflow prose or copy a second implementation of publication.

Update `docs/ocr-runtime.md` and the existing CI guide to record donor adoption
and its runtime pin without presenting source as live proof. Append acceptance
evidence here. Keep all release assets, the manifest and portable skill byte
identical in this migration; no upstream/runtime API change is needed. Keep
operator-skill distribution guidance synchronized before subsequent repository
transfers, after the donor's new caller is qualified.

Acceptance reuses the previously qualified runtime asset hashes and the stock
synthetic fixture, then requires current producing offline CI for this caller.
The final pre-merge check of PR #6702 was cancelled when it merged and is not
passing evidence. Prior qualified head `6ff4c24a10` has identical runtime assets;
the post-merge normal codebase run is reported separately while pending.

### Delivery and review

Execution mode: standard. This bounded migration crosses the existing runtime/
caller seam, so retain a read-only planning challenge, a committed migration
simplification/risk review and an integrated Claude Opus 5.5 medium source review.
Do not re-review unchanged release internals. One implementation slice covers
the workflow and necessary test adaptations; documentation/plan updates follow.
Use existing formatters, staged secret/data checks and focused Node contracts.
No application runtime or screenshots are needed for this nonvisual change.

Terminal: pinned caller, focused passing contracts, source reviews, ordinary push
and one accurate draft PR. Producing hosted offline CI is a separate acceptance
receipt and may be pending at draft creation. Merge, readiness, deployment,
private activation, other-repository migrations and paid canaries remain
outside this delivery. A blocker in source identity or actual pin qualification
blocks only its dependent migration evidence.

Planning challenge: native planner `APPROVED` this frozen Package 2B section.
Proceed under the user’s post-merge continuation. The removed inline-workflow
partial fixture is consolidated into the existing central controller fixture,
which will invoke the published controller for the same consequential path.

### Package 2B implementation evidence

The donor caller selects the actual merged action revision `0032c990d4`.
All ten release assets, the manifest and the portable skill are unchanged.
The post-merge codebase run [40126047394](https://github.com/uzh-bf/klicker-uzh/actions/runs/40126047394)
passed on that published revision; its producing stock and patched qualification
receipt is checked separately from action execution on an ordinary event.

Test delta: remove the legacy inline partial-publication fixture and execute
that consequential path through the actual published controller in the central
suite. Add a real-donor caller contract against that same extracted revision.
Move the old multiline `GITHUB_OUTPUT` regression to the actual published
preparation path: the new action passes bounded PR metadata in private JSON,
so the test preserves hostile multiline metadata as data without shell execution.
Adapt the existing guard suite to inspect pinned composite metadata, including
self-update protection, provider bindings, always-upload diagnostics and retention.
No adopter-local suite, dependency, runtime module or application environment is added.

Before subsequent repository transfers, synchronize the global `rs-ocr` operator
guidance with the qualified donor caller. Include release upgrade choreography:
when runtime/portable-skill hashes change, coordinate the new immutable release
with each caller's trusted skill policy rather than advancing one independently.
That follow-on operator update and other caller migrations remain separate.

All 277 focused OCR contracts pass on Node 24.21.0 with zero skips, including
the real stock 1.13.0 binary and synthetic providers/tools. The published
revision's producing CI logs also verify stock-binary execution and the patched
engine build. These checks do not establish live execution of the new caller.


The committed migration's simplification pass found no useful reductions.
The risk review verified the runtime/caller seam and identified one retained
coverage requirement: assert cancellation and publication admission directly
in the pinned action guard. Both machine-condition assertions are now present;
all three affected guard contracts pass. Other passing verification is reused
because release bytes and runtime behavior are unchanged. Integrated source
review and current-head hosted CI remain separate receipts at draft delivery.


The integrated final review identified a future-repin qualification gap: the
stock fixture now targets the published controller, but a caller-only SHA
update did not select that fixture. Accept the smaller proposed correction:
include the donor workflow in the existing shared qualification selector.
Every adopted pin therefore runs the real-publisher partial-publication fixture
against its actual published bytes. Keep one fixture rather than a second
local/published matrix; source publication and caller adoption remain distinct
phases. Only the selector changes in `check.yml`; its execution limits and
credential isolation stay intact. Recheck the selector and request the single
focused integrated-review correction before claiming final source acceptance.


## Additive usage and context diagnostics

### Approved outcome and boundary

The user approved the next shared diagnostics package: persist sanitized usage
as responses finish, measure trusted-context activity, and expose cached,
uncached and output cost components. Execution mode remains standard. Reuse
`trees/rs/ocr-shared-runtime` on `rs/ocr-usage-diagnostics`, based on merged
`v3` revision `51e8e7259f2f31d220cc78ff64e54d205837fb76`. This authorizes
source changes, synthetic verification, commits, ordinary push and one draft
PR against `v3`. Models, maximum reasoning, budgets, aggregate accounting,
retry/resume policy, concurrency, deadlines and publication remain unchanged.
No provider replay, private activation, live setting or merge is included.
No product primitive changes; this adds diagnostic evidence only.

### Diagnostic contract

Extend the existing adapter with a separate bounded JSONL usage journal next to
its aggregate diagnostics. Record dispatch, observed response and terminal
outcome using a random invocation ID, attempt ordinal, existing opaque
conversation identity, fixed provider/model/stage/kind, validated numeric usage
and fixed finish/failure codes. Write a response receipt synchronously once
its JSON is parsed, before downstream validation or another await. Preserve
usage returned by rejected completions. Missing or invalid counters stay null;
an uncompleted dispatch stays unknown. A closed or killed process must leave
previously written responses readable; a hard runner loss may still prevent
artifact upload. Bound journal bytes/rows and report truncation/write failure
without changing provider execution. Retain no source, prompts, tool arguments,
reasoning, provider IDs, raw errors, URLs or credential values. Existing
aggregate receipts stay one row per invocation and retain their formulas.

The shared broker reports successful calls and serialized result bytes by the
three fixed tool names. It has no reliable worker identity. The adapter reports
observed trusted-context tool results and UTF-8 content bytes per existing
opaque conversation, deduplicating replayed call IDs within bounded memory.
Label this as observed input evidence, not authoritative broker activity;
compression, missing keys and diagnostic caps must remain explicit. No new
MCP field, header, tool schema or model-visible text is introduced.

Add component cost lines per stage only when that stage has a complete estimate:
uncached input, cached input, output and cached share of estimated charge.
Use the existing pinned rates and counters without changing existing estimate
lines or budget units. Unavailable stages retain unavailable components.

### Ownership, files and verification

Main owns adapter code/tests, draft wiring, action/final artifact paths, release
manifest and documentation. A bounded executor owns only
`.github/scripts/ocr-review-tools.cjs` and its existing test file for aggregate
tool/result-byte diagnostics. No overlapping writers. Main owns adapter-side
conversation observations because they share the usage-journal identity seam.
Use existing files; the separate generated journal is the only new artifact.
Update `ocr-draft-review.cjs`, the composite action and both existing final
workflow artifact lists; the existing diagnostics-path convention derives the
sidecar path. Refresh manifest hashes for changed release assets. The portable
skill and caller pin remain unchanged: publishing new release source does not
automatically migrate a caller pinned to an older revision.

Acceptance uses synthetic providers and the actual stock binary where existing
fixtures require it. Verify response durability after a later SIGKILL, unknown
in-flight usage, rejected/malformed responses, journal saturation/I/O failure,
replay deduplication and conversation isolation, broker byte counts, and
complete/unavailable cost components. Existing cost reports and OCR-facing
usage must match prior fixtures; release verification and pinned caller checks
remain valid. Use Node24 in an isolated test container and existing formatters,
with no application environment or screenshots. Required source gates are one
planner challenge, simplification plus privacy/correctness slice review, and
one integrated Claude final review on the complete committed package. Reuse
the completed Opus consultation for design advice; no additional broad audit.

Terminal: focused checks and source reviews pass, bounded diagnostic artifacts
are wired into existing retention, and a clean ordinary push/draft PR accurately
distinguishes source/CI proof from post-merge live acceptance. Review feedback
and CI may be observed without extra paid replays; scheduling remains separate.

### Implementation evidence

Planner approved the diagnostics contract. The shared journal, broker counters,
conversation observations, component costs and existing artifact wiring are
implemented without changing the portable skill, caller pin or execution profile.
The complete affected set passes 307 Node24.21 checks with zero skips, including
the actual stock OCR1.13.0 binary and verified pinned publisher under synthetic
provider/tools responses. A response survives a later SIGKILL; its subsequent
dispatch retains unknown usage. Privacy, byte/row limits, unwritable/symlink
sinks, rejected usage, replay deduplication and cost components are covered.
The first kill fixture returned an unsupported response body shape; replacing
it with the existing Response fixture fixed the test and did not require a
provider/production change. No paid replay or application environment was used.
One cohesive package owns the new evidence from capture through artifact
retention; central runtime fixtures remain central. Planner, simplification,
focused risk review and integrated final source review passed. The simplification
pass removed redundant assertions on a test's expected literal; the affected
behavior check passed again. Existing cost values and summary lines match the
baseline, and parsed workflow fields match except the explicit artifact paths.

[Draft PR #6711](https://github.com/uzh-bf/klicker-uzh/pull/6711) contains the
diagnostics package. On runtime head `36aa29f7943a0cd9f78dae0aa594bbfeb49ca7d4`,
[codebase CI](https://github.com/uzh-bf/klicker-uzh/actions/runs/40209744432)
passed both stock runtime and patched engine qualification, and
[selected Playwright CI](https://github.com/uzh-bf/klicker-uzh/actions/runs/40209744503)
passed. Later documentation-only receipt updates reuse the source review and
synthetic evidence; the PR description records their current CI separately.
The draft caller's immutable pin remains unchanged. Live acceptance of the new
draft diagnostics requires a later pin update and a genuine ordinary review.
