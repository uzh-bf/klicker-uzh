# SonarQube quality and dependency security in KlickerUZH CI

## Approval summary

Make source analysis, dependency vulnerabilities, and container vulnerabilities
usable inputs to pull-request and release decisions. Today a successful Sonar
workflow can accompany a failed Sonar quality gate, dependency analysis is
skipped, and staging promotion does not consult the quality gate. Improve the
accuracy and availability of the evidence before making additional checks
mandatory.

The proposed sequence has three milestones: reliable analysis and contributor
coverage; test coverage and vulnerability controls; then separately authorized
merge and promotion enforcement. Reuse the existing Sonar project, test jobs,
GitHub security results, image builders, and staging controller. Preserve
application behavior, human reviews, package-release-age protections, and
existing deployment ownership.

This is a **direction-only roadmap**. The user requested its detailed creation
under `project/`; this authorizes the documentation deliverable and its ordinary
task-branch delivery. It does not start the implementation work below. Further
approval must name the executable package. Live settings, credential setup,
subscription changes, merges, publication of packages or releases, deployment,
scheduled jobs, and promotion activation retain separate named authority.

Completion requires proven detection and rejection of representative failures,
successful supported contributor paths, and evidence tied to the correct source
revision and image digest. Sonar administration access, pnpm 11 support, useful
coverage, and the existing findings backlog remain material uncertainties.
Resolve each before its dependent enforcement; independent source preparation
can continue within an approved implementation package.

## Working context

| Field | Value |
| --- | --- |
| Repository and target | `uzh-bf/klicker-uzh`, `v3` |
| Investigation baseline | `b824ae26126bd33b44112dc27aad0ce42dbe1c4b`, 2026-09-12 |
| Reconciled source baseline | `8c6a4c74f3bba3b73a5b5c3a185f6a1f0d3e89f5`, after [PR #5919](https://github.com/uzh-bf/klicker-uzh/pull/5919) |
| Roadmap branch | `rs/sonarqube-workflow-roadmap` |
| Roadmap checkout | `trees/rs/sonarqube-workflow-roadmap` |
| Artifact root | Existing `project/`; this file is the roadmap authority |
| Boundary owner | Main session owning the approved package |
| Current terminal condition | Reviewed source implementation on draft PR #5924; live activation not started |
| PR | [Draft PR #5924](https://github.com/uzh-bf/klicker-uzh/pull/5924), targeting `v3` |

The primary checkout has unrelated changes and is 68 commits behind the recorded
remote baseline. Primary Git metadata writes were denied by the sandbox when
refreshing and creating a linked worktree. A GitHub CLI ref read confirmed the
same remote SHA. The roadmap therefore uses an isolated shared-object checkout
under `trees/`, on its own branch with the existing GitHub repository as origin.
It is not registered as a linked worktree. No primary source changes were moved.
The checkout depends on the primary object store; preserve it until work is
delivered or explicitly reclaimed.

Before implementation, refresh the target, inspect existing task owners and PRs,
and revalidate the configuration touched by the selected package. Coordinate
with the [CI throughput roadmap](2026-09-05-ci-throughput-roadmap-plan.md),
especially test scheduling and coverage artifacts. Historical plans are context;
live GitHub rules and current source determine the effective configuration.

During drafting, [PR #5919](https://github.com/uzh-bf/klicker-uzh/pull/5919)
merged required-test summaries and exact-candidate staging qualification. The
isolated checkout could fetch normally and was fast-forwarded to its merge
commit because these changes materially affect W3/W8/W10. The source now
declares eight baseline checks and includes required CI/build status helpers;
the `v3` ruleset now requires those eight contexts on read-back, while the two
integration-branch rulesets still require only `check` and `check-gitleaks`; the
[activation packets](2026-09-12-sonar-ci-activation-packets.md) record the exact
live state. Coordinate baseline activation with that package's owner. Do not
replace its intended checks or claim its settings are already active.

## Evidence and limitations

The following observations were collected on 2026-09-12 through committed source,
host `gh`, and sanitized workflow logs. Counts are a dated inventory, not proof
of exploitability or deployment exposure.

| Observation | Evidence and implication |
| --- | --- |
| Workflow success differs from gate success | [Run 34700223966](https://github.com/uzh-bf/klicker-uzh/actions/runs/34700223966) succeeded on the baseline. The Sonar App check failed: 48 security hotspots, E new-code reliability/security ratings, and 10.2% duplication against 3%. |
| Sonar is not required | Active `v3` ruleset 23042571 requires `check` and `check-gitleaks`, GitHub Actions app 15368. Integration ruleset 23042613 requires the same contexts for `v3-*`. Sonar's actual check is `SonarCloud Code Analysis`, app 12526. |
| Scanner and events need attention | [Sonar workflow](../.github/workflows/v3_sonarcloud.yml) uses deprecated `SonarSource/sonarcloud-github-action@master`, skips drafts, and limits PR bases to `v3*`. Analysis took approximately four minutes in the examined run. |
| Scope is not explicit enough | [Properties](../sonar-project.properties) scope sources to `apps,packages,deploy`; `sonar.tests` is unset. Heuristic test detection runs, while duplication warnings name two GraphQL test files. Root utility and CI-script scope is absent. |
| Coverage is not integrated | No coverage-producing script or import was found in the examined package/workflow configuration. Vitest and `node:test`/`tsx --test` both exist. |
| Metadata and analyzer warnings need review | `sonar.projectVersion=2.0` differs from repository version `3.4.0-alpha.75`. Python version is unspecified; PostgreSQL migrations produce PL/SQL parsing warnings. Logs do create TypeScript 6.0.3 programs. |
| Sonar dependency analysis is skipped | The run explicitly reports `Dependency analysis skipped`. Subscription entitlement and organization/project SCA settings remain unknown. |
| Dependencies have an existing backlog | GitHub returned 336 open alerts: 7 critical, 128 high, 175 medium, 26 low. Its SBOM contains 4,636 packages; population does not establish completeness. |
| Dependabot analysis fails | [Run 34700393757](https://github.com/uzh-bf/klicker-uzh/actions/runs/34700393757) reports missing `SONAR_TOKEN` and authorization failure. |
| Other scanners have gaps | [CodeQL](../.github/workflows/codeql-analysis.yml) uses action v2 and JavaScript only. [Dependabot](../.github/dependabot.yml) configures npm/actions only. No explicit image-vulnerability scanner was found. |
| Promotion uses image evidence | [Promotion workflow](../.github/workflows/deploy-stg-promote.yml) and [controller](../.github/scripts/stg-release-promoter.js) validate candidate image workflows without Sonar quality evidence. A successful controller run is not itself proof that a ref moved. |

The promotion row records the original investigation. At the reconciled source
baseline, the controller additionally requires exact candidate push results for
code, secrets, GraphQL, Playwright, unit, OLAT, translation, and image summaries.
It also validates bounded JSON evidence against current job attempts and requires
reviewed controller/release SHAs for manual apply. Sonar remains absent. W8/W10
extend these existing contracts instead of constructing a second admission layer.

Browser approval review denied access to `sonarcloud.io`. Do not recover that
access through another browser, API, or indirect route. W0 requires restored
authorized access or settings evidence supplied by the user. The GitHub evidence
above is sufficient for roadmap preparation, not for claiming the live Sonar
gate definition, new-code baseline, entitlement, or permissions were inspected.

## Research and decisions

| Question | Verified guidance and roadmap decision |
| --- | --- |
| Which scanner? | [Sonar scan action v8.2.1](https://github.com/SonarSource/sonarqube-scan-action/releases/tag/v8.2.1) was the current release checked. Pin a reviewed supported release by full SHA; recheck at implementation. |
| How should a gate affect Actions? | [Sonar Actions guidance](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/ci-based-analysis/github-actions-for-sonarcloud) documents `sonar.qualitygate.wait` and a timeout. Require the actual Sonar App result for merges and make workflow completion meaningful for downstream consumers. |
| Which code should block adoption? | [Quality-gate guidance](https://docs.sonarsource.com/sonarqube-cloud/standards/managing-quality-gates/introduction-to-quality-gates) distinguishes PR new-code conditions from branch conditions. Start with new-code enforcement and separately triage existing risk. |
| How is coverage imported? | [JS/TS coverage guidance](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/test-coverage/javascript-typescript-test-coverage) uses LCOV. Generate reports from existing tests and validate their source mapping before enforcement. |
| Can Sonar cover CVEs? | [Current SCA documentation](https://docs.sonarsource.com/sonarqube-cloud/advanced-security/analyzing-projects-for-dependencies-sca) offers Advanced Security separately from the Team plan and supports pnpm/uv. Older cached Enterprise-only guidance is stale. Entitlement and pnpm 11 behavior still require verification. |
| Can native GitHub controls be assumed complete? | [GitHub's ecosystem table](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories) lists pnpm 7–10 and native `uv`. The repo pins pnpm 11.5. Validate graph and updater compatibility rather than treating the existing SBOM as proof. |
| Where does dependency review help? | [Dependency-review configuration](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/manage-your-dependency-security/configure-dependency-review-action) supports severity/scope gates on changed dependencies. Existing unchanged dependencies also need continuing reassessment. |
| How should images be covered? | Sonar's documented container-SBOM OS list omits Alpine, used by application images. [Trivy image scanning](https://trivy.dev/docs/latest/target/container_image/) supports Alpine. Scan immutable built images with Trivy; Sonar dependency analysis does not replace this proof. |
| How should CodeQL grow? | [CodeQL configuration](https://docs.github.com/en/code-security/reference/code-scanning/workflow-configuration-options) and [Actions queries](https://docs.github.com/en/code-security/reference/code-scanning/codeql/codeql-queries/actions-built-in-queries) support the v4 action line, additional languages, and security suites. Add Python/Actions and assess `security-extended` noise. |

Retain one Sonar project initially. Split only if measured analysis cost,
independent owners, or incompatible quality policies justify it. Keep built-in
Sonar profiles initially; rule changes need a reproduced mismatch and recorded
reason. Retain Gitleaks and the existing IDE connected-mode binding. GitHub
already receives Sonar and CodeQL analysis records; avoid duplicate upload jobs.

No end-user product primitive changes are proposed. The trust boundary of a
credentialed contributor-analysis workflow and the release admission policy
do require a durable architecture decision if those designs are implemented.
W1/W10 must resolve the repository ADR gate before implementation, allocate the
next available ADR ID, and keep rationale there. This roadmap does not allocate
speculative ADR numbers or create new services.

## Binding implementation contracts

### Evidence and credential boundaries

Run contributor builds/tests without the Sonar credential. A privileged analysis
phase uses a trusted workflow and trusted scanner configuration. Validate the
repository, workflow/run identity, PR, base/head SHA, artifact provenance, and
current PR head through GitHub metadata. Treat artifact contents as untrusted.
Reject mismatched or superseded inputs. Candidate-controlled destinations,
scanner options, symlinks, plugins, build commands, lifecycle scripts, and SCA
resolution must not gain access to the analysis credential.

Use the smallest supported analysis-token scope, with Infisical as its source
of truth and approved GitHub delivery. Token creation, synchronization, and
permission changes need explicit setup authority. A workflow declaration is not
evidence that a Dependabot or fork run can access a credential safely. Do not
use `pull_request_target` to execute PR code with secrets.

Keep exactly one authoritative Sonar analysis per revision and analysis context.
PR results evaluate the actual PR base; branch results evaluate the selected
branch. Coverage and analysis must describe the same checked-out source tree.
If tests use a synthetic merge ref, either analyze that exact tree with correct
PR metadata or run coverage on the head tree. Do not mix reports by SHA label.

New security fixtures contain inert synthetic patterns and are never run against
production. Do not dispatch scans, upload analysis, seed test findings, schedule
jobs, or create fixtures in an external Sonar project during this documentation
task. Implementation approval must name those verification effects.

### Quality and backlog policy

The proposed steady-state new-code gate uses A security, reliability, and
maintainability ratings; all new hotspots reviewed; duplication at most 3%;
and coverage at least 80%. Preserve the documented small-change treatment for
coverage/duplication. The user must approve actual policy/settings activation.

Classify tests and generated files before judging duplication. Preserve current
translation and generated Office HTML duplication-only exclusions. Exclusions
do not hide source security findings merely to improve ratings. Resolve the SQL
dialect mismatch without dropping migration validation, and configure Python
analysis against the actual supported runtime.

PR new code is relative to its actual base. For `v3`, choose and document a
release-aligned baseline after inspecting W0 evidence; derive project version
from the release metadata if using previous-version analysis. A different
baseline requires a reason and an explicit inventory of carried risk. Do not
reset the baseline per commit or classify old severe findings as resolved.

The initial dependency admission recommendation is High/Critical across runtime,
development, and unknown scopes. Sonar severities must be mapped to this policy
explicitly; its risk names need not equal GitHub severity names. Existing alerts
receive triage, owners, and deadlines rather than automatically freezing every
unrelated PR. Confirmed release-critical risks still block the relevant release.
License blocking remains pending an approved license policy.

An exception identifies the finding/advisory, package or image digest, affected
scope, evidence, accountable owner, expiry, compensating controls, and approval.
An expired or broader-than-approved exception does not pass admission. Keep
unfixed vulnerabilities visible. Hotspot review and vulnerability remediation
remain different dispositions. Use ClickUp for tracked work once writes are
authorized; do not create GitHub Issues as a parallel backlog.

### Coverage and cost

Reuse existing test jobs and artifacts. Match the Vitest coverage provider to
the installed Vitest version; support existing Node test runners separately.
Record Python coverage only where tests actually run. Preserve untested
production files in the denominator. Missing expected reports, invalid source
paths, unsuccessful producers, or incompatible trees cannot become a green
coverage result. A changed-package report is not whole-repository coverage.

Coverage changes must protect consequential behavior, not prose, translations,
seed contents, or implementation-shaped assertions. New application runtimes
and browser suites are unnecessary for this roadmap document. Future runtime
checks reuse the repository container/host-Playwright split only when needed.

Measure queue time, scanner time, coverage overhead, image-scan time, runner
minutes, and artifact storage before widening triggers. Reuse dependency
advisory databases with bounded freshness. Avoid installing several overlapping
SCA tools without evidence of missing capability. New subscriptions, runner
capacity, or external providers require a separate cost decision.

## Milestones, ownership, and dependencies

The table is a decomposition for future approval, not an approved Git stack or
authorization to create peer tasks. Each work item has one accountable owner.
The main session integrates shared-file changes and owns live effects.

| Milestone | Items | Outcome and exit boundary |
| --- | --- | --- |
| M1: trustworthy analysis | W0–W2 | Settings understood; supported contributor/event routes and representative source/test analysis proven |
| M2: coverage and vulnerability controls | W3–W7 | Honest coverage, validated dependency detection, image reports, complementary security analysis, and operating policy |
| M3: enforcement | W8–W10 | Approved required checks and promotion admission activated with exact-source evidence and recovery proof |

| Workstream | Items | Route and owner | Dependency / acceptance boundary |
| --- | --- | --- | --- |
| Current settings | W0 | Main; secrets and access decisions | Unblocks policy/entitlement-dependent work |
| Sonar analysis | W1–W2 | Main for W1 trust design; executor for settled W2 edits | W1 after W0; W2 inventory can proceed independently, proof uses W1 |
| Coverage | W3 | Executor; main integrates workflow scheduling | W1/W2; accurate reports and producer/consumer identity |
| Dependencies | W4 | Main for tool choice; executor for settled source changes | W0 entitlement; real pnpm/uv completeness evidence |
| Images | W5 | Executor; main owns publication effects | W4 policy; may prototype independently without publication |
| Complementary analysis | W6 | Executor | Independent source package; shared event contract from W1 |
| Triage and ownership | W7 | Main | W0 inventory; baseline/report results from W2–W6 |
| Admission source | W8 | Main; cross-system policy and exact-result semantics | W1–W7 acceptance |
| Merge activation | W9 | Main; live settings | W8 and named activation authority |
| Promotion and reassessment | W10 | Main; release boundary | W5/W8/W9 and named promotion/scheduling authority |

W3, W4, and W6 can proceed in parallel after their inputs settle, with disjoint
file ownership. Serialize edits to the Sonar workflow/properties and shared CI
event helpers. Reuse the existing test and promotion owners. Every main-owned
implementation item has critical-path coupling or unresolved security/policy;
delegate its settled mechanical subset once that reason no longer applies.

### W0 — Reconcile Sonar settings and freeze the adoption decision

Read the current analysis method, main branch, new-code definition, assigned
gate and profiles, background-task warnings, SCA entitlement and configuration,
GitHub binding, token scope metadata, and relevant notification settings. Record
keys, selected values, and sanitized evidence only. Check for competing automatic
and CI analyses; choose one authoritative method for the same context.

Also refresh actual rulesets, Dependabot status, and the owners of active CI and
promotion work. Record which source and policy observations from this roadmap
remain true. Distinguish package-manager update support from dependency-graph
support and vulnerability detection.

**Acceptance:** a dated settings/evidence table, explicit resolution or blocked
status for every field above, and a selected SCA evaluation branch. Browser
denial blocks this item's live inspection, not unrelated source preparation.
**Delivery:** update this roadmap in the next approved source package; no
standalone live setting changes.

### W1 — Make scans available to every supported contributor path

Modernize and SHA-pin the scanner and checkout in the existing Sonar workflow.
Retain full Git history, explicit permissions, cancellation of obsolete PR work,
and bounded timeouts. Specify push behavior independently of PR draft fields.
Cover ordinary PRs, drafts, ready transitions, Dependabot, forks, and stacked
bases. Add manual recovery only if the implementation package authorizes it.

Implement the credential separation defined above. Use the smallest necessary
additional workflow for untrusted contributors; approve its exact path in the
derived W1 plan. Cover retargeted PRs and base advancement so comparison evidence
cannot remain silently stale. Scan relevant integration branch baselines before
depending on their PR comparison.

**Acceptance:** one valid result per supported event/source context; successful
ordinary, bot, fork, and stack cases; rejected stale/forged artifact metadata;
no secret-bearing execution of contributor code. Missing credentials produce a
clear unavailable-analysis result. No merge gate is activated here.
**Delivery:** coherent analysis-workflow PR with security review and authorized
synthetic CI/Sonar verification. Primary paths: existing Sonar workflow and any
specifically approved trusted-analysis workflow/helper.

### W2 — Correct classification, scope, and analyzer metadata

Update `sonar-project.properties` to explicitly classify source and tests using
the actual file inventory. Cover selected root utilities and CI scripts; include
test roots without indexing files twice. Keep generated build/codegen artifacts
out of production analysis once W3 introduces artifacts. Preserve narrow existing
duplication exclusions. Remove the stale hard-coded version and apply W0's
baseline choice. Correct Python and SQL analyzer configuration from evidence.

**Acceptance:** representative production, test, translation, generated,
workflow, utility, and migration files have the intended scope. Test duplication
does not distort production metrics. Compare before/after scope counts and
warnings on a stable tree. TypeScript 6 analysis remains complete; no custom
tsconfig is added without a demonstrated resolution problem.
**Delivery:** properties changes and analysis receipts, preferably with W1 if
they remain one reviewable package. Do not assert the current red gate is fully
explained by classification errors.

### W3 — Connect trustworthy coverage to analysis

Extend `.github/workflows/test-unit.yml`, `test-graphql.yml`, affected Vitest
configs/package scripts, and the Sonar consumer to generate/import coverage.
Add the matching coverage provider and lockfile update only where required.
Account for Node test runners and Python reports with their own producers.
Choose one scheduling arrangement that satisfies the source-tree contract;
avoid racing two analyses for the same PR.

**Acceptance:** known covered and uncovered branches map correctly to original
source; tests with no application runtime remain lightweight; missing/corrupt
reports and failed producers are rejected. Display the first honest baseline
and measured CI overhead. An 80% requirement is armed only after useful reporting
and its initial remediation are accepted. If the plan cannot customize gates,
complete this work before requiring the built-in gate.
**Delivery:** coverage source package; relevant existing tests remain intact.
Use LCOV import rather than inventing another coverage database or dashboard.

### W4 — Prove dependency coverage and implement the selected CVE path

First test pnpm 11 workspace/transitive/patched dependency recognition, uv
lockfile recognition, vulnerability detection/removal, and updater output.
Compare representative graph relationships and locked versions, not merely
package counts. Prefer GitHub dependency review with existing Dependabot if
these checks pass. If entitled, evaluate Sonar SCA on the same acceptance cases.
Supplement only a demonstrated capability gap with one compatible scanner.

Implement dependency-review severity and scope policy. With Sonar SCA, configure
explicit project enablement and suitable failure handling after validating its
environment; a degraded manifest analysis must remain visible and must not
satisfy complete-CVE acceptance. Keep dependency resolution away from privileged
untrusted-source analysis. Add native `uv` updates for analytics and Docker
updates for relevant application bases in `.github/dependabot.yml`.

**Acceptance:** inert fixtures show a newly vulnerable dependency blocked and
its repair accepted, including representative transitive/workspace paths. A
pnpm updater produces a lockfile valid for the pinned toolchain. Unchanged
dependency risks have an identified continuing-reassessment mechanism. Existing
release-age protection retains exact reviewed emergency exceptions.
**Delivery:** one selected CVE implementation, configuration, and compatibility
receipt. Subscription purchase, SCA activation, and schedules remain separate
effects. Sonar's daily reassessment capability is not proof it is enabled here.

### W5 — Scan immutable built images and retain SBOM evidence

Pilot Trivy on an existing application image and the migrator, then extend to
the runtime image inventory consumed by deployment. Scan each published
architecture that can be selected for release; account for intentionally
disabled builders. Prefer existing immutable image artifacts/digests rather than
another build. Record scan engine/database version and time, digest, architecture,
SBOM, findings, and policy disposition in existing artifact storage.

Place the check so the release controller cannot treat a failed image scan as
an admissible image. A publication that precedes scanning must still be prevented
from promotion; do not claim that preventing promotion prevents registry upload.

**Acceptance:** Alpine OS and bundled package findings are recognized; the
report identifies the exact image; missing architecture, expired exception,
scanner error, or stale database does not pass. A representative inert vulnerable
fixture is rejected under the policy. Capture initial image debt separately.
**Delivery:** reviewed image-workflow changes and receipts. No image publication
or production scan is implied by this documentation request.

### W6 — Modernize complementary static security analysis

Update `.github/workflows/codeql-analysis.yml` to supported SHA-pinned actions.
Cover JavaScript/TypeScript, analytics Python, and GitHub Actions. Reuse W1's event
semantics and preserve minimal upload permissions. Pilot `security-extended`,
then decide its blocking policy from representative findings and runtime cost.
Keep Sonar's maintainability/duplication role distinct from CodeQL's security role.

**Acceptance:** the correct language categories produce results on the candidate
revision, including a representative workflow-security fixture; missing analysis
is visible. Confirm GitHub receives one intended result per category. Existing
Gitleaks coverage and required checks remain effective.
**Delivery:** independent static-security workflow package; no repository-wide
deep security audit or unrestricted source remediation is authorized by W6.

### W7 — Assign findings and define a workable exception process

Triage existing Sonar, dependency, and image findings into actionable remediation,
documented false positives/safe cases, or approved time-bounded exceptions.
Prioritize confirmed exploitable/runtime risk and build-system compromise;
severity alone does not establish reachability. Avoid claiming JavaScript
dependency reachability from a feature not validated for this stack.

Proposed service targets are triage of critical findings within one working day,
high within three, and explicit remediation/exception dates. These are proposed
operating commitments, not a claim that an on-call owner exists. Resolve owner
availability before activation. Existing production-critical findings receive
named release decisions before W10, even while unrelated PRs use new-code gates.

**Acceptance:** the release-relevant backlog has owners, dispositions, and dates;
an expired exception fails the intended policy; a sample hotspot receives real
review. Update `docs/ci-and-deployment.md` and `docs/testing.md` with the implemented
contracts. Correct the stale scanning claims in `.serena/memories/reference.md`
when that file still exists. Update the repository verification skill only when
its actual completion instructions become inaccurate.
**Delivery:** policy and implementation documentation with the corresponding
source package; ClickUp writes and subscriptions require named authority.

### W8 — Prepare exact-result admission and its activation packet

Implement workflow failure on Sonar gate failure using the supported wait and
timeout behavior. Prepare the exact ruleset delta for the effective Sonar App
check and selected vulnerability checks. Verify actual check names/app IDs on
the delivered implementation head; the inventory above is not a permanent ID
contract. Require terminal successful analysis, not scan upload success.

Keep source and runtime CVE checks distinguishable so a failure explains what
must be repaired. Protect workflow/policy ownership through the repository's
review mechanisms. If changed-file optimization skips work, its applicability
decision must be conservative and observable; unknown scope cannot pass as
irrelevant. Handle concurrent reruns and newest-result selection explicitly.
Reuse `required-ci-status.cjs`, `required-build-status.cjs`, and their existing
tests where the contracts fit. Preserve the eight baseline contexts introduced
by PR #5919 and reconcile its separate settings activation before preparing
the final ruleset delta.

**Acceptance:** stale, missing, failed, cancelled, not-computed, wrong-app, and
wrong-SHA results cannot satisfy admission. A valid unchanged equivalent result
is reused only under the repository's source/environment evidence rules. Draft,
fork, bot, and stack PRs remain able to obtain the required results.
**Delivery:** reviewed admission source plus an activation packet; no settings
are applied by this item. This can share a PR with the relevant source changes
once the complete package remains reviewable.

### W9 — Activate merge protection after acceptance

With explicit authority, apply the reviewed delta to `v3` ruleset 23042571 and
the selected integration-branch ruleset(s), after refreshing their IDs, scopes,
and owners. Include the previously proven Sonar App check and agreed dependency
security checks. Preserve unrelated requirements, human review, and bypass policy.

**Acceptance:** read-back matches the approved delta; an authorized failing test
PR cannot merge; a clean representative PR is eligible while retaining other
required checks. Fork/bot/stack routes have no permanently pending check. Do not
perform a merge merely to test eligibility without separate merge authority.
**Recovery:** restore only the captured ruleset fields if the named canary
condition fails, provided that rollback was included in the approval. Otherwise
stop dependent activation and report the exact missing authority.
**Delivery:** live rule read-back and canary evidence, distinct from source merge.

### W10 — Gate promotion and establish continuing reassessment

Extend `.github/scripts/stg-release-promoter.js`, its existing tests/fixtures,
and `deploy-stg-promote.yml` to admit only candidates with the agreed source and
image security evidence. Preserve the trusted-controller checkout, image/job
inventory validation, source branch validation, and compare-and-swap ref update.
Also preserve its full candidate-push suite requirements, evidence validation
against current attempts, and expected-controller/expected-release apply checks.
Do not rebuild an image after scanning it and then promote the unscanned result.

Add a supported completion event or bounded continuation so a candidate waiting
for Sonar is reconsidered when analysis finishes. Validate event provenance and
candidate identity. Scan-first and image-first completion orders must both work;
missing evidence blocks only the dependent candidate. Prepare read-only dry-run
receipts before any approved ref movement.

Select one continuing dependency reassessment mechanism and schedule retained
release-image digest scans with approved retention and cost. New disclosures
must reach an accountable owner without notification spam. Define maximum
acceptable report/database age and operational response before activating these
schedules. A historical successful check is not permanent vulnerability proof.

**Acceptance:** existing controller regression tests plus new ordering, stale
evidence, wrong-app/revision/digest, missing architecture, expiry, retry, and CAS
cases pass. An authorized dry run admits a clean candidate and rejects failing
ones without changing refs. Activation read-back, one approved canary, and the
first authorized scheduled reassessment prove the live layer.
**Recovery:** use a reviewed scoped controller revert/settings rollback while
preserving existing ref/CAS protections; release-ref rollback or deployment
rollback needs explicit target authority. A scan failure does not authorize it.
**Delivery:** controller source, merged-result proof, authorized activation, and
operational evidence. Production rollout remains a separate named action.

## Verification portfolio

Use existing fixtures/helpers where possible. The following are consequential
contracts; this table does not authorize brittle documentation or content tests.

| Risk | Existing protection / obligation | Primary seam and owning items |
| --- | --- | --- |
| Green upload hides failed gate | Current app check exposes mismatch; existing required CI/build status tests protect summary behavior; extend applicable contracts | Sonar workflow/result fixture, W1/W8 |
| Contributor controls privileged execution | Existing trusted-controller patterns are reference, not fork-analysis proof; add focused negative cases | Trusted analysis boundary, W1 |
| Wrong source or stale PR reports pass | GitHub identifies runs/commits; extend event and artifact validation | Source/report consumer, W1/W3/W8 |
| Test/generated files distort metrics | Heuristics and CPD warnings exist; add a small synthetic classification acceptance case | Sonar scope report, W2 |
| Missing coverage looks complete | Existing test suites lack imports; add producer/consumer contract checks, preserve behavior tests | Existing unit/GraphQL jobs, W3 |
| pnpm 11 graph loses vulnerabilities | Populated GitHub graph only; add representative transitive/workspace/patch detection and updater cases | Lockfile/parser and native review boundary, W4 |
| Image report describes another artifact | Existing build/controller digest checks; extend receipt validation | Image workflow and controller, W5/W10 |
| Language/security analysis silently absent | Existing CodeQL JS result; extend language/category acceptance | CodeQL workflow, W6 |
| Expired exception passes | No verified common exception policy; add only the selected policy's expiry/scope cases | Admission decision, W7/W8/W10 |
| Candidate stranded or superseded during promotion | Existing `stg-release-promoter.test.js` and fixtures; extend ordering/identity/CAS coverage | Existing controller, W10 |

The exact synthetic CI/Sonar probes and external effects must be included in
the executable package's approval. Do not create intentionally vulnerable
production changes. Do not add broad tests solely because a helper was added.

## Delivery and activation gates

Derive one implementation plan per coherent source package only when that
package is selected. Resolve its exact writable paths, owner, tests, and terminal
condition. An ordinary PR is preferred for a cohesive package; cross-layer
splitting or a native stack requires an explicit topology decision. This roadmap
does not create eleven PRs automatically.

Source package acceptance includes repository-native applicable checks, focused
contract tests, required security review for credential/admission boundaries,
and the actual scan/CI results. Use the configured planner/slice/final roles
according to package risk. Build or browser verification is required only for
the behavior changed by that package. Documentation alone needs formatting,
links, and scope checks.

For each live activation, prepare one reviewable packet: exact targets and
current settings, proposed delta, prerequisites, expected result, allowed canary,
conditional recovery, data/cost effects, and terminal condition. Obtain approval
for that named sequence before applying it. A failed prerequisite blocks only
its dependent action. Read back effective settings and retain sanitized receipts.

| Layer | Evidence needed before claiming completion |
| --- | --- |
| Roadmap | Reviewed document, valid references, explicit decisions and limitations |
| Source | Immutable reviewed commit/PR and relevant passing checks |
| Merge | Named merge authority, required reviews/checks, merged target verification |
| Sonar/GitHub configuration | Approved settings/token effects and live read-back |
| Promotion | Approved controller/ref effects, exact-source/image admission, CAS receipt |
| Operations | Authorized schedules, fresh reports, accountable owner, proven notification behavior |

## Progress and review provenance

- Status: source implementation in progress on [draft PR #5924](https://github.com/uzh-bf/klicker-uzh/pull/5924); no live effect applied.
- Completed: repository and GitHub investigation, documentation research,
  planner approval, documentation delivery, and the source implementation of
  W1, W2, W3, W4, W5 (pilot), W6, W7, W8, and W10, together with the W0, W8,
  W9, and W10 activation packets.
- Investigation baseline: `b824ae26126bd33b44112dc27aad0ce42dbe1c4b`; reconciled
  source baseline `8c6a4c74f3bba3b73a5b5c3a185f6a1f0d3e89f5`.
- Delivery layer: source only. No runtime was started, no Sonar setting was
  changed, no ruleset was applied, and no image was published by this work.
- Implementation state:
  - W1: the scanner is pinned to `SonarSource/sonarqube-scan-action` v8.2.1
    (`22918119ff8e1ca75a623e15c8296b6ea4fbe28f`), with explicit
    `contents: read` and `actions: read` permissions, a bounded timeout,
    event-aware draft handling, `edited` for retargeting, and a named
    fail-closed result when `SONAR_TOKEN` is unavailable. The trusted analysis
    route for fork and Dependabot pull requests is decided in
    [ADR 0043](../docs/adr/0043-sonar-analysis-credential-and-coverage-input-boundary.md)
    and is not implemented yet.
  - W2: the source scope now includes `util` and `.github/scripts`, test
    classification is explicit, `sonar.python.version=3.12` is set, and the
    stale hand-written version is gone (supplied from `package.json`). The
    before/after scope comparison still requires a live analysis.
  - W3: `test-unit.yml` and `test-graphql.yml` publish LCOV as the
    `coverage-lcov` artifact, and the analysis imports a report only from a run
    bound to the analyzed head with a matching tested-source receipt
    (`.github/scripts/sonar-coverage-inputs.cjs`, 23 unit cases). The unit
    suites invoke Vitest with the coverage flags directly because the first
    `pnpm … test -- --coverage` form forwarded a literal `--`; Vitest then ran in
    filter mode and published no LCOV without failing, and the artifact upload
    now reports a missing report as a job failure instead of ignoring it.
    Imported reports have their `SF:` entries rewritten to repository-relative
    paths so the import does not depend on both runners sharing an absolute
    checkout path. The upload pattern is restricted to the reports directly
    inside `apps/*` and `packages/*`; a workspace-wide glob collected 75 files
    for four producers, because pnpm links every workspace package into its
    dependents' `node_modules`. The transport now resolves the producing package
    per report from the artifact path and the sources the report records, and
    refuses a report that matches no package or more than one, which rejects
    those linked copies instead of importing duplicate coverage from
    `node_modules` (`.github/scripts/sonar-coverage-transport.cjs`, 19 unit
    cases). The coverage threshold is deliberately unarmed, and frontend PWA
    coverage (Node test runner) is still unpublished.
  - W4: `dependency-review.yml` fails on high severity, and Dependabot now
    covers `uv` plus the twelve application Dockerfile directories. pnpm 11
    graph and updater support is still unverified, so this is not complete CVE
    coverage.
  - W5: Trivy scans the staging backend-docker image and its migrator by digest
    after publication and records receipts and SBOMs. Promotion consumes those
    receipts once the controller source reaches the default branch, and only for
    the two images the pilot scans.
  - W6: CodeQL v4 is SHA-pinned and covers JavaScript/TypeScript, Python, and
    GitHub Actions with a `security-extended` pilot that is not a required check.
  - W7: `docs/ci-and-deployment.md`, `docs/testing.md`, and the scanning claims in
    `.serena/memories/reference.md` describe the implemented contracts. ClickUp
    triage, finding owners, and remediation dates remain unwritten because they
    need authority.
  - W8: the analysis workflow now fails when the quality gate fails, and the
    ruleset delta for the effective SonarCloud App check (app `12526`, context
    `SonarCloud Code Analysis`) is prepared with a live read-back in the
    [activation packets](2026-09-12-sonar-ci-activation-packets.md). Neither the
    delta nor any other setting is applied.
  - W9: activation is prepared only. Applying the delta waits for a green gate on
    `v3`, which currently fails, and for the fork and Dependabot route decision.
  - W10: the staging controller requires a successful terminal SonarCloud
    candidate run and an `image-scan-receipt` whose digest matches the promoted
    image, and a candidate whose gate is still running is reconsidered when the
    analysis finishes (`.github/scripts/image-scan-admission.cjs`, 18 unit
    cases). Merging that source activates the requirement for later promotions,
    which is disclosed as a live effect; the scheduled reassessment and its
    retention, cost, and owner decisions remain proposals.
- Outstanding gates: live Sonar settings and entitlement (W0), the trusted
  contributor analysis route (W1), ruleset application (W9), promotion
  admission
  once this source merges (W10), and the scheduled reassessment. Each needs a
  named approval as described under activation gates.
- Verification limits: the Sonar workflow, the CodeQL update, dependency review,
  and the image scan cannot be proven from source alone. Expect the Sonar quality
  gate to fail this pull request while W0 and the policy decisions stay open, and
  treat the image scan as unproven until a publication run exercises it.
- Next action: obtain authorized Sonar settings evidence for W0, then decide the
  fork and Dependabot analysis route before any merge enforcement. Marking the
  pull request ready for review is a separate, separately authorized step.
