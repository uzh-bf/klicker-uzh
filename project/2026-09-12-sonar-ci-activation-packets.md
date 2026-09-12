# Sonar and dependency security activation packets

Proposed settings and schedule changes for the
[SonarQube and dependency security roadmap](2026-09-12-sonarqube-security-ci-roadmap.md).
Every packet below is a proposal. Nothing in this file has been applied: no
ruleset, Sonar project setting, subscription, schedule, or promotion ref was
changed by the source work on
[draft PR #5924](https://github.com/uzh-bf/klicker-uzh/pull/5924).

## Live read-back

Read back from GitHub on 2026-09-12 15:58 UTC.

| Ruleset | Target | Ref include | Required checks | Strict |
| --- | --- | --- | --- | --- |
| 23042571 v3 quality and merge protection | branch, active | `refs/heads/v3` | `check`, `check-gitleaks`, `test-graphql-status`, `test-playwright-status`, `test-unit-status`, `test-olat-api-status`, `test-intl-production-status`, `build-images-status` (all app 15368) | true |
| 23042595 v3 integration branch protection | branch, active | `refs/heads/v3-*` | none | — |
| 23042613 v3 integration baseline CI | branch, active | `refs/heads/v3-*` | `check`, `check-gitleaks` (app 15368) | false |

`23042571` carries no bypass actors, requires a code-owner review, and allows
squash merges only. Its eight required contexts are the baseline introduced by
[PR #5919](https://github.com/uzh-bf/klicker-uzh/pull/5919), which is merged as
`8c6a4c74f3bba3b73a5b5c3a185f6a1f0d3e89f5`. This read-back supersedes the earlier
roadmap note that the live rulesets returned only `check` and `check-gitleaks`;
that note described the pre-#5919 state.

The SonarCloud quality check comes from the SonarCloud GitHub App, id `12526`,
slug `sonarqubecloud`, context `SonarCloud Code Analysis`. That check and the
workflow's own `SonarCloud` job (app 15368) are distinct, and on the current
`v3` head they disagree:

| Check | App | Conclusion | Recorded |
| --- | --- | --- | --- |
| SonarCloud | 15368 | success | 2026-09-12 15:09:52 UTC |
| SonarCloud Code Analysis | 12526 | failure | 2026-09-12 15:10:19 UTC |

A green analysis workflow therefore still accompanies a failing quality gate,
which is the mismatch this roadmap exists to remove. Until the gate is green on
the analyzed revision, Packet A and Packet C stay blocked.

Pushing the roadmap branch also reported the default-branch dependency backlog:
336 open Dependabot alerts (7 critical, 128 high, 175 moderate, 26 low). This is
raw alert evidence, not a reachability assessment, and it is the input size that
W7 triage must reduce rather than a list of exploitable defects.

## Packet A — Require the terminal Sonar result on `v3` (W9)

**Target.** Ruleset `23042571`, `refs/heads/v3`.

**Proposed delta.** Add one entry to the existing `required_status_checks`
parameter and change nothing else:

```json
{ "context": "SonarCloud Code Analysis", "integration_id": 12526 }
```

**Prerequisites**, each blocking only its dependent step:

1. The analysis of the revision being merged must pass its quality gate. It does
   not today (table above), so W0 settings reconciliation and the W7
   remediation-or-exception decisions come first. With
   `strict_required_status_checks_policy: true`, a permanently failing required
   check blocks every merge into `v3`.
2. A supported analysis route for fork and Dependabot pull requests, or an
   explicit decision to leave those pull requests permanently ineligible. Today
   they cannot receive `SONAR_TOKEN`, so their analysis fails closed and the
   required check would never become green. See
   [ADR 0043](../docs/adr/0043-sonar-analysis-credential-and-coverage-input-boundary.md).
3. Dependency and CodeQL checks are deliberately **not** part of this delta.
   pnpm 11 dependency-graph support is unverified (W4) and CodeQL runs as a
   `security-extended` pilot (W6), so neither can carry admission yet.

**Expected result.** A pull request whose gate fails cannot merge into `v3`,
independent of the workflow's own green job. Unrelated requirements, the
code-owner review, and the squash-only policy are preserved.

**Allowed canary.** One authorized pull request with a deliberately failing gate
must show the required check blocking. A clean representative pull request must
remain eligible. Do not merge anything to test eligibility.

**Recovery.** Remove the added required-status entry, restoring the captured
field exactly; stop dependent activation and report the missing authority if the
canary fails for an unrelated reason.

**Data and cost.** No new analysis runs. The strict policy can require an extra
base update before a merge.

**Terminal condition.** Read-back shows the entry present with app 12526, the
other seven contexts unchanged, and the canary outcome recorded with receipts.

## Packet B — Integration branches (W9, optional second step)

**Targets.** Rulesets `23042613` (`check`, `check-gitleaks`) and, when
applicable, `23042595`.

**Proposed delta.** Add the same SonarCloud entry to `23042613` so work merged
into a `v3-*` integration branch carries the analysis result. This is optional
and separable: integration branches exist to collect a stack, and the same
prerequisites as Packet A apply per branch.

**Recovery.** Remove the added entry; no other field changes.

## Packet C — Promotion admission (W10)

**Source prepared on PR #5924; not active until that source is merged.**

**Proposed behavior.** The trusted staging controller requires, for the exact
candidate SHA and source branch:

1. a completed, successful push run of `.github/workflows/v3_sonarcloud.yml`
   whose `SonarCloud` job succeeded, which now means the awaited quality gate
   passed rather than that the scan upload finished;
2. for every image that publishes a scan, an `image-scan-receipt` artifact of
   the same staging run whose recorded digest equals the digest the controller
   resolves for that image, so a rebuild after the scan cannot be promoted as if
   it were the scanned artifact;
3. reconsideration when analysis finishes, through the controller's existing
   `workflow_run` trigger list rather than a new polling loop.

**Live-effect disclosure.** The controller is evaluated from the workflow
definition revision it runs from, so merging this source into `v3` activates
the requirement for every later promotion. Combined with the failing gate above,
merging Packet C before Packet A's prerequisites are met would stop promotions.

**Prerequisites.** A green quality gate on the candidate-producing branches, and
an explicit decision to require scan receipts only from the images that publish
them while the image-scan pilot covers the two staging backend images.

**Allowed canary.** One authorized manual dry run that admits a clean candidate
and rejects: an unpromoted digest, a stale receipt, a wrong-app or wrong-SHA
analysis, and a missing receipt. Dry runs must not move `stg-release`.

**Recovery.** Revert the controller source; the release ref and its compare-and-
swap protections are untouched by a read-only decision, so no ref rollback is
needed.

**Data and cost.** No new analysis; one extra controller evaluation per finished
sonar run per candidate.

**Terminal condition.** Controller regression tests pass, one authorized dry run
shows both outcomes, and one approved canary promotion completes with receipts.

## Packet D — Continuing reassessment (W10, proposal only)

**Not prepared as source.** A schedule merged into `v3` starts live runs
immediately, so it stays a proposal until an owner and budget are named.

**Proposal.** One weekly scheduled workflow that re-scans the retained staging
and release image digests with the pinned Trivy action, records receipts and
SBOMs like the pilot, and reports new fixable HIGH/CRITICAL findings to a named
owner. It should also state the maximum acceptable report age and the response
expectation, because a historical green result is not vulnerability proof.

**Open decisions before activation.** Owner and escalation path; retention for
the scanned images and reports; acceptable runner-minutes and Trivy database
download cost per run; whether the schedule scans digests, tags, or both; and
whether notifications go to an issue, a check summary, or a tracking system that
is allowed to receive them.

## Packet E — Sonar settings evidence (W0, blocked)

Still required before Packet A can be prepared as an executable change: the
new-code definition in use, the quality gate's conditions, whether dependency
scanning (SCA) is entitled for this organization, fork-analysis policy, and the
project's binding to the organization gate. The in-app browser session available
to this task cannot reach `sonarcloud.io` (the approval review denied that
navigation), so this evidence must come from the user or from an authorized
session. It is the first blocker in the roadmap's critical path.

