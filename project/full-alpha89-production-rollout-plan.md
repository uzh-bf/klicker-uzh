# Full alpha.89 production rollout preparation

## Approval summary

Prepare a reviewable promotion of the existing `v3.4.0-alpha.89` images for the
production workloads configured in `deploy/env-uzh-prd/values.yaml`. Use the
immutable release source `3d6a945b83ff05e8afa3e1ece86ead3576af3ed7`; this is
preparation for that release, rather than a release from the latest integration
branch. Keep the existing LTI pin and change the remaining alpha.88 image pins
to alpha.89. The migrator follows the backend tag through the existing chart.

The user's request on 2026-10-29 authorizes evaluating LTI operation and preparing
the full rollout. This executable preparation batch ends with a held draft PR,
focused manifest verification and a clear account of outstanding gates. It does
not authorize marking ready, merging, deployment, staging activation, secret
writes, data repair, new image publication, or a broader source integration.

The release includes Next.js 16, substantial chat changes including Writing Coach
and response-example capture, and one additive Prisma migration relative to
alpha.88. A successful LTI observation does not establish acceptance of these
other services. Require the applicable CI, image checks, migration and backup
preflight, independent final review, human review and browser acceptance before
seeking activation authority. Optional response capture requires its receipt
configuration or an explicit decision to defer that capability. Preserve all
other chart settings and retained LTI storage. Preparation uses existing hosted
PR checks; their queue time and compute cost are unknown. Production model and
feature usage costs require separate acceptance during rollout planning.

## Execution details

### Ownership and scope

- Boundary owner: self; the main session owns preparation and evidence.
- Authority: the user's current request permits read-only operational validation,
  local preparation, ordinary task-branch publication and a draft PR.
- Terminal: a held draft with the exact manifest diff, verification evidence and
  remaining release decisions. Runtime observations stay in ignored local records.
- Pause: a required gate, a source change beyond image pins, secret setup,
  readiness, merge, deployment or rollback needs its own applicable authority.

Use one ordinary promotion PR targeting `v3`, based on
`52d1abddfb33607bd3a6c0d891219c4d11fad0d6`. The worktree is
`trees/prepare-full-alpha89`, branch `chore/prepare-full-alpha89`. Preserve the
earlier LTI release and promotion worktrees. There is no application-source or
dependency change in this package and no topology change to integration branches.

The intended changed files are this plan and
`deploy/env-uzh-prd/values.yaml`. Only existing alpha.88 image-tag fields change
in the values file. The existing chart also derives chat's `LANGFUSE_RELEASE`
and configuration checksum from its image tag; those follow the release change.
Keep replica counts, resources, autoscaling, rollout
strategies, secrets, feature settings and third-party image pins intact. Do not
enable services that are not rendered by the existing production configuration.

### Evidence and compatibility

The alpha.89 source and all production image workflows are public release
evidence. Confirm the Linux ARM64 config of each required published image names
the release commit and version. Record the actual backend and migrator production
digest scans separately from the staging-image scans at the same source commit.
Image builds and scans do not establish runtime or browser acceptance. A fresh
production backend scan reports `CVE-2026-115887` for `graphql-scalars 1.23.0`.
The upstream repository advisory explicitly excludes that version, while the
aggregated advisory range and scanner include it. The application registers
Date and JSON scalars, rather than PhoneNumber. Inspection of the immutable image
confirms version 1.23.0 and its linear PhoneNumber expression. Record an independent
finding disposition before accepting the scan; neither a
major upgrade nor a scanner-policy exception follows automatically. The production
migrator scan reports no fixable HIGH/CRITICAL findings.

The chart directory at the preparation base matches the release tag. Confirm
that property again before final promotion review. For frozen-release parity,
compare the complete local `deploy/` tree against the immutable release SHA using
the existing parity module's normalization and evaluation functions. Resolve both
refs first, fail on missing files and report the compared paths. The CLI's
`--other` argument resolves remote branches, so passing a tag there cannot prove
this comparison. Separately run the normal required branch comparison against
`origin/v3-ai`; a frozen-release pass cannot discharge a branch-parity failure.
Retain environment-owned tag differences rather than copying integration
environment settings. There is no reason to republish or move the release tag.

The source difference from alpha.88 contains
`20261021164300_chatbot_answer_preferences_toggle/migration.sql`, which adds
`Chatbot.answerPreferencesEnabled BOOLEAN NOT NULL DEFAULT true`. Before
activation, privately compare the complete candidate migration set with the
primary and assessment database histories, confirm their database relationship,
check unresolved migrations and schema state, and establish recent backup and
restoration evidence. The PreSync hook applies migrations before application
rollout while the old application can still serve traffic. An additive source
change alone is insufficient proof of lock behavior or rollback compatibility.
If assessment targets a distinct database, activation is blocked until its full
candidate migration set has a proven execution path, order, backup and recovery
evidence, and explicit authority for any additional operation. The primary hook
does not independently migrate a distinct assessment database.

Response-example preview capture requires the private signing key in chat, the
matching public key in GraphQL, and matching key ID, issuer and audience. The
source fails closed when these are missing. Verify presence and matching
configuration privately; never copy key material into this plan or PR. Validated
configuration permits later functional acceptance. If setup is needed, propose a
separately approved Infisical operation or obtain an explicit capability deferral
and test the unavailable state. This requirement
does not imply that ordinary chat or Writing Coach needs those signing keys.

The existing `v3` staging-image workflow can evaluate older application source
than the tagged production images. Its required status must still pass or receive
an explicitly authorized repository-policy resolution. Passing tag builds or
different scanned digests do not waive a failed required check. Do not merge the
integration branch, patch dependencies, rerun failed jobs, or bypass CI as a
side effect of preparing this promotion. Diagnose the exact candidate result and
report the smallest separate resolution if the failure recurs.

### Preparation sequence

1. Validate LTI privately using exact deployed revision and image identity,
   replica lifetime and restarts, complete retained application logs, public and
   per-replica key health, and scoped historical monitoring. State the measured
   time range and limitations. Handoffs are events, not unique users or complete
   browser successes; invalid/reused handoffs are not automatically regressions.
2. Verify published production image identity, source CI, the backend and
   migrator scan evidence, the source migration delta and optional configuration
   contracts. Keep production-derived findings out of tracked files and PR text.
3. Obtain one independent critique of this preparation and future rollout
   contract, using source and public CI evidence only. Resolve actionable findings.
   Change only the intended image-tag fields and verify the rendered result.
4. Inspect the staged diff for secrets, personal and production data, run the
   repository's mandatory scans and applicable checks, commit and ordinarily push
   the task branch, then open and attach one draft promotion PR into `v3`.
5. Read back the draft state, head, base and body. Record observed CI honestly and
   leave the draft held for the unresolved decisions and separately approved
   activation sequence. No second observer or automatic rerun is part of this batch.

### Verification portfolio

| Risk                        | Test obligation | Verification and acceptance                                                                                                                                           |
| --------------------------- | --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extra configuration changes | none            | Structural YAML comparison allows only existing image tag fields changing alpha.88 to alpha.89; exact diff inspection.                                                |
| Chart drift                 | none            | Complete local normalized comparison against the immutable release SHA, separate required branch parity against `origin/v3-ai`, and Helm lint with production values. |
| Unintended rendered changes | none            | Compare base and candidate Helm objects after normalizing container image tags, derived chat release metadata and its config checksum; no other fields may differ.    |
| Wrong or missing image      | none            | Published Linux ARM64 config revision/version, immutable digest readback and applicable backend/migrator scan results.                                                |
| Public data leakage         | none            | Staged gitleaks and manual review of all tracked text and the complete PR body. Runtime results remain ignored.                                                       |

Use the existing deploy-parity tests. No new test is needed for version-tag
substitution. This package adds no UI; screenshots of unchanged source are not
part of manifest preparation. Full rollout acceptance still requires real browser
checks of the newly activated UI and authentication flows.

### Future activation contract, not approved by this preparation

Before requesting activation, finish exact-head required CI, applicable final
review and required human review without requesting human reviewers. Check the
selected staging source and promotion setting privately so the planned `v3`
merge cannot activate staging. Refresh live rollout, database, backup, image and
capacity preflight. Obtain the receipt-configuration decision. Bound paid model
calls with a named synthetic acceptance fixture and an approved usage limit.

A later activation approval must explicitly name ready/merge of the held PR
into `v3`, normal Argo reconciliation and PreSync migration, verification windows,
and any conditional rollback. Verify all rendered workloads and the migrator at
their intended digests before functional acceptance. Test lecturer and student
sign-in, PWA and service-worker loading, course/activity routes, normal chat and
owner preview, enabled Writing Coach/response-capture behavior, numerical grading,
assessment isolation and worker readiness with synthetic fixtures. Reuse existing
feature evidence only where its source and acceptance boundary match.

Prepare a source-controlled reversal of only the newly advanced image pins to
alpha.88, retaining LTI at alpha.89 and preserving the expanded schema. Establish
reader compatibility before approving that recovery; a source revert cannot undo
a migration or new-format data. On a failed migration, unproven compatibility or
an unrelated service problem, stop for diagnosis. No automatic schema reversal,
secret rollback, manual cluster mutation, table deletion or production data repair
is covered by this preparation.

## Progress

2026-10-29: preparation in progress. The user requested LTI validation and full
alpha.89 rollout preparation in this chat. Required delivery layer: held draft PR;
activation authority is outstanding. The main session is the only writer.

The candidate scope is 16 image-tag substitutions and this plan, totaling
16 added and 16 removed substantive lines. The independent plan critique passed
after correcting the separate frozen-release and branch parity obligations and
the distinct-assessment-database stop condition. Existing release evidence is reusable
only at its recorded source and environment boundary. Current runtime evidence,
private preflight results and review reports belong in `project/_local/reviews/`.

Manifest verification passed: 10 existing parity tests, Helm lint, a complete
119-path frozen-release comparison, separate branch parity, and a structural
comparison of 78 rendered objects. Only the 17 expected container images and
derived chat release metadata/checksum change. Container Prettier checks passed.
This is an isolated promotion package under the packaging floor; its production
effects retain the full-path review and activation gates.

Next: commit the verified candidate, obtain the independent final preparation
review and deliver the held draft. Required
CI, final review, human review, activation authority and full functional acceptance
must retain their actual pending or failed state.
