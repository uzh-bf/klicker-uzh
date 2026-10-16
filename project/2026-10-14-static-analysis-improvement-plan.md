# Static analysis: evidence refresh and improvement plan

The highest-value next step is to make the existing checks trustworthy and
triageable. KlickerUZH already runs SonarQube Cloud, CodeQL, Biome, ESLint, Knip,
Gitleaks, dependency review, and a container-scan pilot. Adding another general
scanner would mostly add duplicate findings before fixing the current gaps.

Status: **proposal, documentation only**. Researched 2026-10-14 UTC against
`v3-ai` at `be6ae67368b3249dc01c2284bd6a8d66812a062d`; this is the implementation
base for follow-on work. `v3` was inspected separately at
`cd90f8edb3577a7512a224dc17951750377b4d18`. Nothing here enables a vendor,
changes credentials or security settings, suppresses findings, weakens a gate,
or authorizes a merge/deployment.

This refresh builds on the [September security roadmap](2026-09-12-sonarqube-security-ci-roadmap.md),
its [activation proposals](2026-09-12-sonar-ci-activation-packets.md), and the
[Biome/Knip migration](2026-07-19-biome-knip-repo-quality.md). Those documents
contain dated evidence and implementation history; do not treat their original
counts or unfinished-status labels as today's baseline. Coordinate coverage
with the concurrent coverage prototype and test quality with
[test-hygiene PR #6516](https://github.com/uzh-bf/klicker-uzh/pull/6516).

## 1. Sonar review: what is actually visible

Project key: `uzh-bf_klicker-uzh`; organization: `uzh-bf`; one project with
separate branch analyses. The public API and the cloud-browser dashboard both
returned CloudFront **403 Request blocked** during this review. No new login,
token, access grant, proxy, or settings change was used. GitHub's existing
Sonar App checks and Actions logs remain readable and provide the evidence
below.

| Evidence                                       | `v3`                                                                                                                  | `v3-ai`                                                                                                               |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Latest branch-head Sonar App result found      | Failed, completed **2026-10-14 20:01:30 UTC**                                                                         | Failed, completed **2026-10-14 09:23:25 UTC**                                                                         |
| Exact analyzed revision                        | `cd90f8edb3577a7512a224dc17951750377b4d18`                                                                            | `be6ae67368b3249dc01c2284bd6a8d66812a062d`                                                                            |
| Failing new-code conditions                    | Reliability **D**, security **B**; both require A                                                                     | Reliability **D**, security **B**; both require A                                                                     |
| Analysis workflow                              | [Run 38627217148](https://github.com/uzh-bf/klicker-uzh/actions/runs/38627217148/job/116069880663), successful upload | [Run 38541052641](https://github.com/uzh-bf/klicker-uzh/actions/runs/38541052641/job/115775947330), successful upload |
| Sonar App check                                | [116073937463](https://api.github.com/repos/uzh-bf/klicker-uzh/check-runs/116073937463)                               | [115778710308](https://api.github.com/repos/uzh-bf/klicker-uzh/check-runs/115778710308)                               |
| Scanner duration                               | 4m 02s                                                                                                                | 4m 50s                                                                                                                |
| Indexed files                                  | 2,824                                                                                                                 | 3,216                                                                                                                 |
| Boundary diagnostic: all lines / new lines     | 346,926 / 3,146 (**0.9%**)                                                                                            | 434,648 / 4,970 (**1.1%**)                                                                                            |
| Verified LCOV imported on this push            | None                                                                                                                  | None                                                                                                                  |
| Dependency analysis / CVE reachability         | Skipped / unavailable                                                                                                 | Skipped / unavailable                                                                                                 |
| SQL parse-warning occurrences / distinct files | 100 / 59                                                                                                              | 119 / 67                                                                                                              |
| Helm template-evaluation warnings              | 14                                                                                                                    | 14                                                                                                                    |

The boundary diagnostic runs immediately after upload, before Sonar's server
finishes processing that upload. Its line counts are the latest measures
available **at that time**, not proven measures of the newly uploaded SHA.
They nevertheless contradict the old claim that nearly the entire repository
currently counts as new code. Inspect the live definition before changing it;
**do not delete branch analyses or reset the baseline based on September's
historical diagnosis**.

The scanner uploads at 20:00:07 (`v3`) and 09:21:52 (`v3-ai`); the later App
completion times above identify the processed check. The API's own analysis ID
and analysis-date field could not be retrieved. Computation task IDs in the logs
are `AaE8AC4wIviO6Cj8-xk5` and `AaE5t9eyp_D9Zw7ylrm5`, respectively; these are
**task IDs, not analysis IDs**.

### Findings baseline and confidence limits

- Confirmed current signal: **two failing gate conditions per branch**. A rating
  is not an issue count, and B security does not prove a specific exploit.
- **Unavailable for both branches:** total/open/new issue counts, individual
  issue IDs and rule locations, severity distribution, hotspot counts and review
  states, duplication and coverage percentages, accepted/false-positive
  dispositions, exact New Code definition and complete gate configuration.
  The App checks contain no issue annotations. These quantities are **unknown,
  not zero**. No line-by-line Sonar finding triage is claimed.
- The collector says coverage is “not computed”; the dashboard's numeric
  coverage state was not readable. Missing import is verified; its exact UI
  rendering is not.
- Both logs select `Sonar way comprehensive` for JS, TS, Python and PL/SQL.
  Both identify PostgreSQL in a later dialect-detection sensor, yet still emit
  earlier PL/SQL parse warnings. Those warnings are analysis limitations, not
  proven migration defects.
- September's 106 bugs, 98 vulnerabilities, 46/48 hotspots and 336 Dependabot
  alerts are historical observations. They are deliberately **not** carried
  forward as today's counts.

First authorized access follow-up: export both branches' latest analysis
metadata, all paginated open issues and hotspots, rule/severity facets,
new-code measures and gate conditions. Record retrieval time, analysis revision,
profile and issue mode. Reconcile the live result to the exact GitHub head;
retain the source export outside the public repository if it contains private
comments, assignments, or security-sensitive details. Use stable issue links in
the eventual triage record. Do not change issue state during collection.

## 2. Current controls and their boundaries

| Control                        | Verified implementation                                                                                                | Coverage / enforcement boundary                                                                                                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                     | Root `check` uses Turbo; most TS packages run `tsc --noEmit`; Next apps also generate Next types                       | PR builds/checks affected packages plus dependents; pushes run all declared tasks. A missing package `check` script is not covered just because Turbo is green                          |
| ESLint                         | Five Next apps use flat Next core-web-vitals/TS configs; Office add-in lints `src/content`; analytics has Ruff         | Blocking through `check`; no explicit type-aware `projectService` or promise-rule configuration found. Next hooks exceptions and `no-explicit-any: off` remain scoped, intentional debt |
| Biome / Prettier / syncpack    | Biome code formatting; Prettier Markdown/YAML and Playwright; dependency consistency via syncpack                      | Formatting and syncpack block. **Biome lint is advisory** (`continue-on-error: true`); Playwright is excluded from Biome                                                                |
| Knip                           | Existing `knip.json`, automatic workspace/plugin discovery and narrow ignores                                          | Whole-workspace advisory check; **not** a dependency-vulnerability scanner and not a license scanner                                                                                    |
| Sonar                          | SHA-pinned scan action v8.2.1; source roots `apps,packages,deploy,util,.github/scripts`; PR coverage provenance checks | Drafts/documentation-only PRs skip analysis. Ready PR scans await the gate; branch scans upload without awaiting it. Source scope excludes the separate root `playwright/` suite        |
| CodeQL                         | SHA-pinned v4.38.0; JS/TS, Python, Actions; `security-extended`; pushes, ready PRs and weekly schedule                 | Existing security pilot, not a required check. Documentation-only PRs skip; pushes/schedule retain full analysis. Successful upload is not zero alerts                                  |
| Gitleaks                       | v8.30.1, checksum verified; read-only workflow token; introduced-commit range; redacted output                         | Blocking `check-gitleaks`; this CI scan does not re-audit all history on every PR. Native GitHub push-protection configuration was not inspected                                        |
| Dependency review / Dependabot | Changed-dependency review fails at High; weekly grouped npm, Actions, uv and Docker updates                            | SCA, not SAST. Review checks the dependency delta, not unchanged backlog; pnpm 11 updater/PR rejection behavior needs current proof                                                     |
| Trivy                          | Existing staging image receipt/admission machinery                                                                     | Container/OS plus packaged-dependency findings; not source-level analysis. Current documented pilot covers backend and migrator, not every image                                        |

Source anchors: [check workflow](../.github/workflows/check.yml),
[package scripts](../package.json), [Biome config](../biome.json),
[Knip config](../knip.json), [Sonar properties](../sonar-project.properties),
[reusable Sonar workflow](../.github/workflows/sonar-analysis.yml),
[CodeQL](../.github/workflows/codeql-analysis.yml),
[dependency review](../.github/workflows/dependency-review.yml),
[Gitleaks](../.github/workflows/check-gitleaks.yml),
[CI/security guide](../docs/ci-and-deployment.md).

Live ruleset reads on 2026-10-14 confirm the eight baseline required contexts
(`check`, `check-gitleaks`, GraphQL, Playwright, unit, OLAT, translation and image
summaries) for both `v3` and `v3-*`; `v3-ai` also requires `sync-ancestry`.
Neither Sonar, CodeQL nor Dependency Review is required by the inspected
[ruleset 23042571](https://github.com/uzh-bf/klicker-uzh/rules/23042571) and
[ruleset 23042613](https://github.com/uzh-bf/klicker-uzh/rules/23042613).
Adding one is a separate policy decision, especially while forks/Dependabot
lack a supported Sonar credential route.

### Current advisory backlog, from a real successful CI run

[`v3-ai` check-suite, 2026-10-14](https://github.com/uzh-bf/klicker-uzh/actions/runs/38541052319/job/115776020566):

- Biome: **506 errors, 2,519 warnings, 761 infos**, 2,606 files, about 4 seconds
  of lint execution. Console diagnostics are truncated, so per-rule ranking
  cannot be recovered completely from this log
- Knip: **138 unused files, 47 unused dependencies, 88 unused devDependencies,
  6 unlisted dependencies, 6 unlisted binaries, 771 unused exports,
  199 unused exported types, 9 unused enum members, 23 duplicate exports,
  1 configuration hint**; approximately 15 seconds including startup
- The step logs show nonzero findings while the job is green because these
  checks are advisory. This is expected configuration, not evidence of cleanup

Knip findings are candidates, especially one-off operational scripts, framework
entrypoints, code generation and cross-package exports. Do not bulk-delete
anything from these totals. Regenerate machine-readable reports with the pinned
versions and reviewed entrypoints before proposing fixes.

## 3. Prioritized implementation packages

Effort is an estimate in focused engineering days, excluding approvals and
remote queues. `@rschlaefli` is the current repository CODEOWNER and proposed
accountable owner; role labels below describe delegation to agree before work,
not assignments already made. Each package should be a small independently
reviewable PR based on current `v3-ai`, with normal sync-chain handling.

### P0 / A. Repair the Sonar workflow's two verified shell defects (0.5–1 day)

Owner: CI maintainer. Confidence: **high, locally reproduced and corroborated by
live logs**.

1. `Require the analysis credential` evaluates `-n "\${SONAR_TOKEN}"`. Bash tests
   the literal text, so the empty-token path exits 0 instead of emitting the
   named unavailable result. It does **not** bypass Sonar authentication; it
   defeats the intended early diagnostic. Correct expansion and test empty,
   unset and inert nonempty values without ever loading a real secret
2. `Resolve the project version` writes `value=\${version}`. The real scanner
   command contains `-Dsonar.projectVersion=${version}`, not `3.4.0-alpha.87`.
   Correct expansion and assert the emitted value equals package metadata.
   If the live baseline uses previous version, assess the next version's impact
   before changing it; no automatic baseline resets
3. Add behavioral tests that execute the actual YAML `run` fragments with a
   stubbed environment/output file. Text-presence assertions alone did not
   protect these semantics. Preserve all existing artifact and event contracts

Acceptance: empty/unset token fails before candidate scripts; inert nonempty
value passes; output is exact metadata; literal placeholders cannot appear in
scanner args. Run the Sonar helper and CI-event contract suites. This package
changes source only; it does not solve fork access or make Sonar mandatory.

### P0 / B. Verify credential scope and separate analysis from administration (0.5 day audit, implementation separately scoped)

Owner: repository/Sonar administrator. The CI guide records that the analysis
token could administer project settings in September. **Current scope is not
verified**; do not assume the old permission remains or attempt a write to test
it. Read the approved token's scope/owner/expiry without exposing its value.
If overprivileged, prepare a scoped analysis-only replacement and separate
admin path for explicit approval. Review candidate-controlled config/scripts
against [ADR 0043](../docs/adr/0043-sonar-analysis-credential-and-coverage-input-boundary.md).

Acceptance: documented minimal capability, expiry/rotation owner and proven
supported contributor path; no `pull_request_target` execution of candidate
code with secrets. Credential creation/configuration and permission changes
require separate authorization and secure handling.

### P1 / C. Triage actual Sonar issues and repair analysis scope (1–2 days after access)

Owner: security reviewer plus relevant code owner. Start with the two failing
new-code conditions on each branch; then high-priority hotspots and confirmed
high-impact legacy security findings. Deduplicate shared findings by rule and
code location across branches while preserving branch-specific state.

In parallel, fix demonstrable scope gaps:

- `sonar.test.inclusions` is configured but `sonar.tests` is absent. Both logs
  warn that heuristic classification is still in use. Official CLI guidance
  defaults tests to null; inclusion patterns also exclude matching production
  sources. Define explicit test roots and disjoint final source/test sets, then
  inspect an indexed-file manifest. Overlapping root directories are possible
  with proper filters; the same **file** must not be indexed twice
- Prove representative `.test.ts`, `.test.mjs`, `.spec.ts`, Python tests and
  GraphQL tests remain analyzed as tests; production remains in coverage and
  security scope. Decide explicitly whether root Playwright helpers/specs belong
  in Sonar's test scope, coordinated with the Playwright owner
- Resolve the PL/SQL/PostgreSQL mismatch with a minimal representative migration
  and supported analyzer settings; validate migrations on disposable PostgreSQL
  separately. Do not globally exclude SQL to silence warnings
- Reproduce 14 Helm evaluation failures using synthetic chart values. Reuse
  existing Helm render/contract tests; don't supply production secrets to obtain
  a clean scan. Resolve the missing Docusaurus extended tsconfig without running
  untrusted install scripts in a credential-bearing analysis step

Acceptance: source/test manifest, warning delta, unchanged intentional CPD-only
exclusions, new-code triage records and tests for confirmed defects. A “safe”
hotspot requires evidence and reviewer approval. No automatic dismissals or
broad `NOSONAR`/rule disabling. Existing chat complexity suppression gets an
owner and revisit criterion, not a widened glob.

### P1 / D. Close coverage provenance and branch-reporting gaps (1–2 days, shared with coverage owner)

Owner: test/CI maintainer. LCOV already exists for chat, auth, grading, markdown,
util and GraphQL. Keep those producers and the exact head/base/tree validation.
The collector resolves producers only when a PR exists; push analyses currently
have an empty producer list. **Do not add a second independent coverage lane.**

Extend the existing contract to explicitly support branch pushes, with exact
commit/tree and successful producer evidence; never reuse a PR report merely
because its head label matches a merge commit. Surface unsupported/skipped
packages and missing reports separately. Cover Node/tsx runners and other
packages only after the coverage prototype proves source mapping and unexecuted
production files are retained in its denominator.

Acceptance: one ready-PR and one branch analysis with matching provenance,
known covered/uncovered canaries, no unresolved LCOV source paths, and failure
for mismatched/stale/failed inputs. Missing coverage must remain visible, never
become 100%. Keep percentage enforcement off until the agreed scope is complete;
choose per-package/new-code targets using measured coverage and business risk.

### P1 / E. Turn advisory output into a low-noise ratchet (1–2 days setup, incremental fixes)

Owner: code-quality maintainer with app/package owners. Store machine-readable
Biome and Knip reports as bounded CI artifacts and produce one short summary:
new, existing, fixed, confidence, owner, tool/rule version. No comment per issue.

- Biome: first triage correctness/security rules and unsafe hook/async behavior;
  defer style and bulk `any` cleanup. Keep formatting ownership unchanged
- Knip: prove automatic plugin/workspace discovery, then add only missing
  operational/codegen entrypoints. Run normal mode and a separate production
  comparison; production mode intentionally omits tests and cannot replace the
  default run. Never hide unused files by declaring every source an entrypoint
- Gate **new high-confidence findings in ratcheted rules/packages**, with stable
  fingerprints and explicit expiring exceptions. Retain whole-monorepo reports
  for cross-package reachability. Do not turn all 3,786 Biome diagnostics or
  every export candidate into a blocking requirement in one change

Acceptance: representative positive/negative fixtures, no unexplained finding
loss, a seeded new violation fails while unchanged baseline debt is visible,
and a rule/version upgrade requires baseline review rather than silent reset.
Suggested pilot budget: under 60 extra seconds of unqueued PR execution and
under 10% false positives in a manually reviewed sample; these are proposed
acceptance targets, not measured outcomes or existing policy.

### P2 / F. Add narrowly targeted async and workflow checks (1–2 days pilot)

Owner: backend/chat maintainer plus CI maintainer.

- Pilot type-aware promise checks on one async-heavy surface such as chat route
  handlers or GraphQL services: `no-floating-promises` and
  `no-misused-promises`. Existing TS strictness is not a substitute. Prefer
  typescript-eslint's project service and individual rules over a whole-repo
  strict preset. Verify TypeScript 6 compatibility and measure time/memory
- Compare against the installed Biome/Sonar findings first. Biome's current
  `noFloatingPromises` documentation still marks it nursery with an unsafe fix;
  don't enable an experimental autofix across the repository or run duplicate
  blocking promise checks without evidence of extra value
- A small **actionlint** pilot is the only new general tool recommended now:
  workflow expression/schema/reusable-workflow validation fills a distinct gap.
  Use its ShellCheck integration where available and keep the semantic tests in
  A; a linter is not proof those two literal-expansion bugs are fixed. Pin a
  reviewed release/checksum and record custom runner-label exceptions

Acceptance: small public synthetic fixtures fail for a real missing await and
invalid workflow input; legitimate fire-and-forget requires an explicit error
handling decision, not indiscriminate `void`; cost/noise targets in E hold.
Never execute a fixture against production or change paid AI/eval triggers.

### P2 / G. Finish security pilot validation before new products (1–2 days initial audit)

Owner: security/CI maintainer.

- CodeQL already scans three languages. The latest `v3-ai` push completed all
  three: JS/TS 4m 29s, Python 1m 03s, Actions 1m 02s
  ([run](https://github.com/uzh-bf/klicker-uzh/actions/runs/38541052325)). Export
  current alerts, sample extended-suite precision, and assign triage. Do not
  mistake successful SARIF upload for a clean security assessment
- Dependency review's comment says pnpm recognition is unverified, while the CI
  guide records a September graph read-back. Reconcile this with current graph
  and override samples. GitHub's current updater matrix still lists pnpm 7–10,
  whereas the repo pins 11.5. Prove graph resolution, updater success and
  PR-time High/Critical rejection separately; do not infer any one from another
- Preserve Gitleaks, release-age policy and existing Trivy receipts. Refresh
  unchanged-dependency/image risk evidence and define an owner/report-age policy
  before expanding image scans or scheduled jobs. Existing Sonar logs explicitly
  skip SCA; buying Sonar SCA is not the first remedy for an unproven gap

Acceptance: current alert inventory with versions/scopes, one authorized inert
canary of each intended blocking path, and measured incremental cost. Any merge
requirement must report a terminal status for documentation, drafts, forks and
Dependabot. Enabling new required checks or scheduled scans is a separate
approval after those paths work.

## 4. Triage protocol and scope policy

For every reviewed issue record: tool + stable ID/link, branch + analysis SHA,
rule/version, source path, reported severity, observed exposure, reproduction or
reasoning, confidence, owner, disposition, due date and regression test. Use
ClickUp when creating tracked work is authorized; this plan does not open issues.

1. Confirmed reachable security defects, secret leaks or authorization bypasses:
   immediate owner review; severity follows impact, not the dashboard letter
2. New-code reliability defects: reproduce, fix with a behavioral regression test
3. Security hotspots: manual contextual review; sensitive code is not itself a
   vulnerability. Current Sonar guidance also notes some hotspot rules are being
   reclassified as vulnerabilities, so compare rule and issue mode across dates
4. Maintainability/dead-code findings: validate framework and operational usage;
   schedule by risk/payoff. Duplication or complexity alone is not a bug
5. False positive/accepted risk: exact finding, evidence, approving owner and
   expiry/revisit event. Keep suppression narrow and visible; never close findings
   simply because a scanner or baseline changed

| Check           | PR scope                                                                              | Full-scope safety net                                                            |
| --------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Typecheck/build | Existing affected-package + dependent graph                                           | Existing branch-push checks                                                      |
| ESLint/Biome    | Changed/affected code for ratcheted checks; whole-project context where rules need it | Full advisory report; no mass cleanup hidden in feature PRs                      |
| Knip            | Compare new findings, analyze dependency/dependent context                            | Whole workspace; isolated changed-file scanning cannot prove export reachability |
| Sonar/CodeQL    | Analyze required source context, gate/triage new-code findings against actual PR base | Existing branch and CodeQL scheduled analyses; legacy findings retain owners     |
| Secrets         | All introduced commits, including docs and fixtures                                   | Existing local hook; separate history audit only when authorized                 |
| SCA             | Changed resolved dependencies, with actual base/head                                  | Unchanged dependency and immutable-image reassessment with approved cadence      |
| Coverage        | Exact tested source tree; distinguish changed-package scope from total scope          | Explicit branch producer support; no fabricated whole-repo percentage            |

Keep the existing classification envelope: prose-only PRs skip application
analysis; CI/config changes run the relevant contract and security checks;
unclassifiable changes widen the checks. Changing the classifiers is not part
of this document.

## 5. Tool decisions and current primary references

Research checked 2026-10-14. Recheck versions, support and plan entitlements
when implementing; repository pins and its release-age guard still apply.

| Official guidance                                                                                                                                                                                                                                                                                                                       | Decision for KlickerUZH                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Sonar quality gates](https://docs.sonarsource.com/sonarqube-cloud/standards/managing-quality-gates/introduction-to-quality-gates)                                                                                                                                                                                                      | Improve the new-code feedback loop, preserve visible legacy risk, and distinguish a scan upload from the server's gate result                                                                                                                                              |
| [Sonar initial scope](https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/project-analysis/setting-analysis-scope/setting-initial-scope) and [inclusion/exclusion rules](https://docs.sonarsource.com/sonarqube-cloud/managing-your-projects/project-analysis/setting-analysis-scope/excluding-files-based-on-patterns) | Define actual source/test scope and verify indexed files before trusting denominator changes                                                                                                                                                                               |
| [Sonar JS/TS coverage](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/test-coverage/javascript-typescript-test-coverage)                                                                                                                                                                                            | Generate LCOV in existing tests; import matching paths using `sonar.javascript.lcov.reportPaths`; the scanner does not generate coverage                                                                                                                                   |
| [Sonar Actions integration](https://docs.sonarsource.com/sonarqube-cloud/analyzing-source-code/ci-based-analysis/github-actions-for-sonarcloud)                                                                                                                                                                                         | Preserve SHA-pinned scanner and least-privilege credentials; no new vendor setup                                                                                                                                                                                           |
| [Sonar security hotspots](https://docs.sonarsource.com/sonarqube-cloud/standards/managing-rules/security-hotspots.md)                                                                                                                                                                                                                   | Review sensitive paths before labeling findings safe or exploitable                                                                                                                                                                                                        |
| [CodeQL query suites](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-query-suites)                                                                                                                                                                                                                       | Keep the existing security-extended pilot; it includes lower-precision queries, so measure noise before enforcement; don't add security-and-quality on top of Sonar/Biome                                                                                                  |
| [Typed linting](https://typescript-eslint.io/getting-started/typed-linting/) and [Biome promise rule](https://biomejs.dev/linter/rules/no-floating-promises/javascript/)                                                                                                                                                                | Pilot a few type-aware rules, account for project-analysis cost, and avoid duplicate/experimental blocking checks                                                                                                                                                          |
| [Knip workspaces](https://knip.dev/features/monorepos-and-workspaces) and [production mode](https://knip.dev/features/production-mode)                                                                                                                                                                                                  | Tune existing automatic discovery; production comparison complements the normal graph                                                                                                                                                                                      |
| [Dependabot ecosystem support](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories)                                                                                                                                                                                          | Validate the repo's pnpm 11 behavior rather than upgrading or replacing scanners on assumption                                                                                                                                                                             |
| [actionlint](https://github.com/rhysd/actionlint)                                                                                                                                                                                                                                                                                       | Small workflow-validation pilot with semantic contract tests; no extra hosted service                                                                                                                                                                                      |
| [Semgrep metrics/data boundary](https://docs.semgrep.dev/metrics)                                                                                                                                                                                                                                                                       | **Defer broad Semgrep adoption.** Reconsider only if a reviewed repository-specific rule catches a demonstrated gap that existing tests/rules cannot express economically. If piloted, use reviewed local rules and metrics off; no account/managed code upload by default |

Also defer a second dead-code tool, a second formatter, parallel SCA vendors,
and splitting Sonar into many monorepo projects. None currently has a proven
benefit greater than the ownership, runtime and duplicate-triage cost.

## 6. Verification performed for this plan

- Read the actual manifests, configs, workflows, helper code, repository guidance
  and prior plans; compared current branch-head checks and paginated check lists
- Extracted the two actual YAML shell fragments and ran them in a temporary
  directory with an empty/inert environment: missing-token guard returned 0;
  version step emitted literal `value=${version}`. No real credential was used
- Reviewed the exact-head Sonar and code-quality logs cited above; reproduced
  counts from their summaries, not inferred from overall green checks
- The follow-on runtime/configuration packages are proposals and have not been
  implemented or tested. This PR needs Markdown formatting, link/path validation
  and the repository's documentation-change CI envelope, not a new application
  build or live scanner upload
