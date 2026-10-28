# LTI-only alpha.89 production release

## Approval summary

Publish alpha.89 from `v3-ai`, then promote only the LTI image through a PR into
`v3`. The user selected LTI-only scope on 2026-10-28 and approved the source
alignment, local-hook exception, and conditional release/rollback sequence in
the current chat. The approval remains bound to this plan's scope and checks.

The user also approved integrating the newly merged Writing Coach and
response-example source changes and their receipt-metadata chart additions.
Production promotion changes the LTI image tag and adds those empty metadata
settings to the chat/backend ConfigMaps and chart defaults. Their checksum
changes cause rolling restarts of chat and backend at alpha.88. Retain the
existing production CPU settings and legacy LTI chart fields during the
rollback window. The ltijs 7 service does not read `LTI_DEV_MODE` or
`LTI_AAS_MODE`; retaining the existing rendered fields preserves an image-only
rollback to alpha.88. This is preferable to removing them during promotion and
requiring a configuration rollback as well. Legacy database tables remain intact.

Release metadata is generated from the repository scripts and `.versionrc.js`.
The candidate contains the configured version bumps, generated changelog, and
approved deployment alignment, with the receipt metadata retained. No Prisma migration differs
between alpha.88 and the proposed release source. ltijs 7 creates its own storage
tables at startup; legacy platform import and concurrent startup remain rollout
checks. The mixed alpha.89 LTI / alpha.88 backend combination has source-contract
evidence, but has not had a complete live acceptance run.

The granted authority covers the source changes, local-hook exception,
conditional release and image-only LTI rollback, plus the additional chat/backend
rolling restarts. It ends after production acceptance or the defined rollback.
Required human review remains a prerequisite. Tag publication starts the
repository's production image workflows, including images beyond LTI; build cost
and queue duration are unknown. Only the LTI image is activated in production.

## Execution details

### Baseline and ownership

- Release target: `v3-ai`, integrated at `d786ffbe2b2e5750bdd5c5de7c9da871cbe80580`
  after the approved amendment; the original baseline was `b92770a07d`.
- Production manifest target: `v3`, inspected at
  `cac6bbf4dcd2caa973737abfe25d19d144069c42`; its approved CPU and legacy-LTI
  settings match the original `ea330a628b` baseline.
- Release worktree: `trees/release-alpha89`, branch
  `chore/release-3.4.0-alpha.89`. Reuse it.
- Promotion worktree, created only when needed: `trees/promote-prd-alpha89`,
  branch `chore/promote-prd-alpha.89`, based on the refreshed `origin/v3`.
- Main session owns source integration, release actions, scoped cluster
  verification, and acceptance evidence. The user explicitly authorized checking
  the configured production cluster access. Real OLAT browser acceptance remains
  a separate required observation.

Refresh remote state before mutation after a pause. Inspect new target drift;
stop for a material change to the release content, production manifest baseline,
or required rollout procedure. Preserve unrelated work and existing owners.

Before either merge, read `STG_SOURCE_BRANCH` and
`STG_RELEASE_PROMOTION_ENABLED` with `gh variable get ... --repo
uzh-bf/klicker-uzh`, keeping the observed settings private. The controller compares
`workflow_run.head_branch` with the selected source. Require that planned pushes
to `v3-ai` and `v3` cannot activate staging; this sequence grants no staging
activation or integration-PR merge. Stop if the selection or controller behavior
allows a planned merge to activate staging.

### Delegation Map

| Outcome | Owner | Dependency and acceptance |
| --- | --- | --- |
| Source preparation | Main | Approved source and check policy; exact diff, checks, final review, draft release PR. Mechanical alignment stays local because dispatch overhead exceeds the edit. |
| Release publication | Main | Verified merged release; immutable tag and successful LTI image publication. |
| Production promotion | Main | Published image, parity, current required checks and reviews; approved LTI tag and receipt-metadata promotion merge. |
| Acceptance and recovery | Main | User cluster/browser evidence and rollback prerequisites; verified acceptance, approved rollback, or explicit blocker. |

### Verification portfolio

| Risk | Test decision | Evidence and command |
| --- | --- | --- |
| Incorrect versions or extra edits | none | Host structural comparison against `.versionrc.js`, staged `git diff --check`, and staged gitleaks; only configured version fields and generated notes change. |
| Chart drift or unintended resources | none | Existing `node --test .github/scripts/deploy-parity.test.cjs`; compare release and production candidates with `node .github/scripts/deploy-parity.cjs --candidate <candidate> --other <other-ref>`. Run host `helm lint deploy/charts/klicker-uzh-v3 -f deploy/env-uzh-prd/values.yaml`, then render with `helm template lti-release deploy/charts/klicker-uzh-v3 -f deploy/env-uzh-prd/values.yaml`. Confirm retained legacy fields, unchanged resources, and only the intended image change. |
| Formatting and package consistency | none | Disposable Node 24.21.0 container: Biome `check` on `.versionrc.js` JSON targets, Prettier `--check CHANGELOG.md project/lti-production-release-plan.md`, and `syncpack lint`. |
| LTI and rollback compatibility | none | Existing container check `node --test apps/lti/tests/*.test.mjs`; inspect the unchanged signing contract and namespaced storage below; reuse implementation reviews in [#6728](https://github.com/uzh-bf/klicker-uzh/pull/6728) and [#6749](https://github.com/uzh-bf/klicker-uzh/pull/6749). Production browser and replica acceptance remains mandatory. |

Pure source and render checks start no application runtime. No new tests are
planned for generated metadata or copied declarative configuration. Existing
LTI harness evidence in `project/2026-10-26-ltijs-7-upgrade-plan.md` covers its
recorded source; it is not proof of the mixed-version production combination.

### Source preparation

1. Align only the approved LTI and CPU hunks in the following deployment paths
   with the recorded `v3` baseline: `deploy/charts/klicker-uzh-v3/templates/cm-lti.yaml`,
   `deploy/charts/klicker-uzh-v3/values.yaml`, and
   `deploy/env-uzh-prd/values.yaml`. The inspected delta is the retained legacy LTI
   fields and the existing production CPU requests. Preserve the receipt metadata
   from the integrated target. Environment-owned image tags
   remain alpha.88. Confirm every resulting hunk matches that description.
2. Retain the generated alpha.89 metadata in the `.versionrc.js` version targets
   and `CHANGELOG.md`. Any regeneration uses the repository release script with
   `--skip.tag --skip.commit`; Git mutations run on the host. No tag exists during
   preparation. This plan is the only new tracked file.
3. Verify normalized deploy parity against `v3`; verify all configured versions,
   JSON-only version changes, unchanged dependency definitions and lockfile,
   formatting, syncpack, staged secret scan, and exact diff scope. Execute the
   portfolio commands above. Inspect the service options to confirm retained
   legacy fields are ignored; platform unit tests alone do not establish that.
   Reuse applicable source review of the ltijs 7 implementation.
   Run a final review of the complete release package, including the chart delta.
4. Commit and push the task branch, then create one draft release PR into `v3-ai`
   with `rs-mr-description-writer`. Source preparation creates no new application
   behavior or UI; separate screenshots do not apply to this PR.

The local-hook exception was approved. Normal hooks require a running workspace app
container, even for the initial metadata-only candidate. The attempted commit
failed with `Expected one running workspace app container ... found 0`.
Formatting, syncpack, structural validation, and staged gitleaks passed. The pnpm
runner also rejects the filtered tooling installation's workspace state; the same
repository scripts ran successfully through `node --run`. Tooling installation
and formatter checks ran in disposable Node 24.21.0 containers; no application
runtime was started. Use the approved focused checks for local application hooks.
Hosted required CI remains blocking before either merge.

The requested exception covers the plan commit, release preparation commits, and
the one-tag promotion or rollback commits in this batch. It permits explicit
`git -C <worktree> commit --no-verify` and an ordinary task-branch push with the
local pre-push application build bypassed, after the portfolio and staged scans
pass. It omits local `check`, `check:lint`, and application `build`, and the
unrelated host contract suites listed by `check:all` (agent instructions, Git
identity/hooks, removed artifacts, Prisma sync, Playwright CI/host, and local KB).
The focused metadata/chart checks cover this package's changed behavior; they
are not substitutes for application typecheck/build evidence. Required hosted
validation on the final ready-state head and current base supplies that remaining
evidence before either merge. No secret scan is waived. Without this exception,
run the normal hooks in the provisioned task runtime instead.

### Conditional release actions requiring named approval

1. Once release PR checks and local final review pass on the held candidate,
   mark that PR ready. Await the required ready-state checks for the final head
   and current base. Post the standing-authorized `/final-review` trigger, which
   incurs the configured review-model usage and publishes its report on the PR.
   Merge into `v3-ai` only once all required reviews pass. If required human review is
   missing, leave the request to the user and stop the dependent merge.
2. Resolve and inspect the merged release commit. Confirm it contains exactly the
   verified release content and version. Create and push
   `v3.4.0-alpha.89` at that commit. Never move or replace an existing tag.
3. Use one supported watcher for the image workflows. Require a successful LTI
   production image build for that tag and verify the image exists for the
   configured architecture. A failed build blocks promotion; no automatic rerun
   or broadened release follows. Do not activate other service images.
4. Create a draft promotion PR into `v3` changing `lti.image.tag` in
   `deploy/env-uzh-prd/values.yaml` to `v3.4.0-alpha.89`, adding the approved
   receipt metadata in `deploy/charts/klicker-uzh-v3/templates/cm-chat.yaml` and
   `deploy/charts/klicker-uzh-v3/templates/cm-backend-graphql.yaml`, and preserving
   the matching `chat.responseExampleReceipt` defaults in the chart `values.yaml`.
   Confirm deploy parity, unchanged other image references, unchanged migrator
   configuration, render checks, and required CI. Verify that the release-source
   chart retained the legacy fields before accepting an image-only rollback.
5. Before activation, verify that production still uses alpha.88, the alpha.88
   image remains retrievable for the configured architecture, the legacy tables
   remain available, and the user can provide cluster/browser acceptance during
   the observation window. Keep operational evidence private. Once promotion
   checks and local review pass, mark that PR ready. Await all ready-state required
   checks and `/final-review` results for the final head and current base, plus
   required human review, then merge into `v3`. This activates ArgoCD's normal production sync.
   Confirm deployed revision, image digest, rollout completion, and both intended
   LTI replicas through scoped read-only cluster evidence. Use the configured
   cluster access under the user's explicit verification instruction; manual
   cluster mutation remains outside this plan.

   Preflight also requires healthy existing chat/backend replicas and rolling
   update settings that preserve availability while replacements start. The
   rendered promotion must change only the LTI image, the two receipt ConfigMaps,
   and their chat/backend pod-template checksums. Keep every non-LTI image at
   alpha.88. Verify chat/backend readiness and basic health after their restarts.
   A chat/backend problem stops for diagnosis; the LTI rollback does not authorize
   a configuration rollback, parity bypass, or application repair.

The normal ArgoCD PreSync migrator hook can run even for an LTI-only promotion.
Its existing image and configuration remain pinned. If it reports pending
migrations or fails, stop and inspect the cause; source equivalence alone does
not establish database history or permit a manual migration.

### Acceptance and recovery

Source compatibility evidence: the alpha.88 and proposed `apps/lti/src/index.ts`
sign the same payload fields with `APP_SECRET`, HS256, issuer `APP_ORIGIN_LTI`,
and a five-minute lifetime. The ltijs user object mapping changes; full mixed
version behavior is an acknowledged acceptance risk. In
`apps/lti/src/database.ts`, `SCHEMA` creates only `ltijs_*` objects and
`getLegacyPlatforms()` only reads the legacy tables. The adapter's writes target
the new namespace. This supports retaining old storage for rollback; preflight
still requires confirmation that no independent table cleanup or key rotation
has occurred. Missing baseline, image, table, or observer prerequisites block
the production merge.

After the rollout, check public `/keys` responses and unauthenticated `/handoff`.
Require valid public keys and a 401 `invalid_launch` response respectively.
Repeated matching key IDs alone do not prove both replicas: obtain readiness and
startup evidence for each replica, with consistent key identity, completed
legacy-platform registration, and no unexplained skipped imports. Keep raw
platform identifiers and operational records out of repository artifacts.

The user then launches the production OLAT iframe in Safari and one additional
browser, and verifies the e-learning sign-in. Retain the legacy ltijs tables.
Production acceptance requires all these checks; source checks and image builds
do not replace them.

Allow ten minutes from sync start for deployment readiness, then twenty minutes
after readiness for the observed browser checks. A failed rollout, inconsistent
replica key identity, repeated failed health probes, or a browser launch failure
attributable to the new image triggers the image rollback below. Missing observer
evidence alone follows the explicit blocker branch rather than proving failure.

If rollout or launch acceptance fails because of the new LTI image, the requested
conditional recovery is a PR into `v3` restoring only `lti.image.tag` to
`v3.4.0-alpha.88`. Full conditional approval explicitly includes creating that PR,
marking it ready, posting `/final-review`, awaiting its ready-state required
checks and human review, and merging it. A source-only approval grants none of
those live recovery actions. Confirm the legacy chart
settings are still present before merge. Verify rollout and browser sign-in
again. In-flight launches may require a relaunch. Never delete tables, rewrite
the release tag, or repair production data as part of recovery.

If acceptance needs unavailable cluster or browser evidence, stop with the exact
missing evidence and preserve the deployed state for the user; inability to
observe is not itself an automatic rollback trigger. Stop for unrelated failures
or a recovery that exceeds the stated image-only rollback.

Terminal condition: accepted LTI-only deployment, verified rollback, or a concrete
authority/capability blocker with the held source and deployed revisions recorded
privately. Task-tracker comments and messages need separate explicit authority.

## Progress

- Approval mode: executable batch, approved by the user's `approved` reply to the
  three named approval items in the current chat on 2026-10-28.
- Execution owner: main session under the current single-workflow rules.
- Initial acceptance: generated release metadata and focused checks passed.
- Package: initial metadata delta has zero executable changes; 22 version target
  edits and generated changelog. The proposed chart alignment is an isolated
  release prerequisite. Configuration changes and the production procedure arm
  the full planning and final-review gates.
- The approved three-file chart alignment is committed. Current `v3-ai` was
  integrated once for freshness and to retain the newly approved receipt fields.
  Source preparation is complete; hosted CI and independent final review remain.
- Required plan critique: approved after one correction round; report in
  `project/_local/reviews/2026-10-28-lti-production-release-plan-critique.md`.
  Final package review: pending after approval,
  source completion, and applicable verification.
- Approved amendment: `v3-ai` advanced to `d786ffbe2b` through
  [Writing Coach #5867](https://github.com/uzh-bf/klicker-uzh/pull/5867) and
  [response-example capture #5764](https://github.com/uzh-bf/klicker-uzh/pull/5764).
  The user approved the additional rolling restarts through the amendment
  question in the current chat. Its independent critique returned APPROVED.
  `v3` advanced to `cac6bbf4dc` without changing the approved deployment paths.
- Verification: 22 version targets remain alpha.89; formatting, syncpack,
  structural checks and gitleaks passed. Helm lint, 10 deploy-parity tests and
  five LTI platform tests passed. After integration, structured render comparison
  confirms only receipt ConfigMaps and their two pod-template checksums differ
  from `v3`; image references, resources and all other manifests are unchanged.
- Draft delivery: [release PR #6763](https://github.com/uzh-bf/klicker-uzh/pull/6763).
  No tag or production mutation has occurred. Next: hold the complete candidate
  for independent final review and hosted checks, then execute the approved
  readiness, review, merge and tag sequence when prerequisites pass.
