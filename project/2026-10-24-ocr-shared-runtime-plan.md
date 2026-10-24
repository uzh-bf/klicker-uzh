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

Package 1 approved; execution starting under the native goal. Packages 2 and 3
remain proposed. No runtime, workflow, credential, activation or review policy
has changed yet. Claude Opus 5.5 completed the
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

Local plan references, formatting and secret scan passed. There are no
implementation tests or live-run results yet. Next: execute package 1's A/B/C
slices through reviewed draft delivery against `v3`. Claude CLI reviews use the
user's standing explicit `claude-opus-5-5` selection at medium effort. PR #6698
is merged into `v3-ai`; its prefixed-install guard fix stays owned there and is
not copied into this branch. Package 2 depends on a verified published
runtime revision; native GitLab work depends on pilot selection and its trust
and authority decisions.
