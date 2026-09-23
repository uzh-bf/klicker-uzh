# Alpha 75 release preparation

## Outcome and authority

Prepare version `3.4.0-alpha.75` from verified application source
`236ecd4fef9c9fddb6f4e6dd252e7e2f2226ddc4` on `v3`. This package updates the
21 version targets declared in `.versionrc.js` through `pnpm run release:alpha`,
generates the changelog, documents the command requirement in `AGENTS.md`, and
provides the publication and activation checklist. It changes no executable
application logic, dependencies, database schema, or deployment values.

The user authorized release preparation on September 9. Main owns version
metadata, verification, and draft PR delivery. A read-only explorer owns
release-check discovery; an independent reviewer checks the final package.
This is a light preparation package with a release correctness review.
Terminal: a reviewed draft PR targeting `v3`. Publishing a release tag,
merging, and activating production require separate authorization.

## Candidate evidence

- [Exact-candidate Playwright](https://github.com/uzh-bf/klicker-uzh/actions/runs/34349948438): shared build and all eight hosted shards passed.
- [Codebase checks](https://github.com/uzh-bf/klicker-uzh/actions/runs/34349947688), [unit suites](https://github.com/uzh-bf/klicker-uzh/actions/runs/34349947858), [GraphQL](https://github.com/uzh-bf/klicker-uzh/actions/runs/34349947927), and [OLAT](https://github.com/uzh-bf/klicker-uzh/actions/runs/34349947565) passed.
- [Production translation smoke](https://github.com/uzh-bf/klicker-uzh/actions/runs/34349933376) passed on the translation PR head for PWA and Manage.
- STG runs the `v3-ai` descendant `7a4648aa931dab207146dd06a54131581ab0a63c`. English/German account forms render and disclosure controls work; anonymous entry checks cover PWA, Assessment, Manage, Control, Auth, and Chat. The user confirms STG works. This is not exact-v3 authenticated Chat or LMS acceptance.
- Source diff from `v3.4.0-alpha.74` contains no Prisma changes. No migration is introduced by this package.

Production observation on September 9: Argo tracks `v3`, is Synced/Healthy at
the candidate, and all 15 listed deployments meet desired replica counts.
Application images remain `v3.4.0-alpha.74`. Current resource configuration is
therefore already running with the rollback image version. Chat telemetry is
disabled and must remain disabled through this release.

## Publication and activation sequence

1. Merge this preparation PR only after its checks and review pass. Confirm
   the resulting commit contains only the reviewed version and documentation
   delta above the qualified source; requalify any intervening application changes.
2. With explicit publication approval, create and push `v3.4.0-alpha.75` at
   that merged release commit. The existing tag-triggered PRD workflows build
   and publish images. Record each required image digest and producing run;
   do not change deployment image tags before every required image exists.
3. Before activation, verify the built production PWA/Manage forms in EN/DE,
   exercise Chat citation rendering with synthetic content, and verify prompt
   assets are present with telemetry disabled. Check browser reload/cache
   behavior. Reuse equivalent existing proof only when the image/configuration
   and tested contract match. Any missing runtime proof stays an explicit gate.
4. Prepare a separate deployment PR changing only the 15 production image tags
   in `deploy/env-uzh-prd/values.yaml` from `v3.4.0-alpha.74` to
   `v3.4.0-alpha.75`. Preserve resource settings and telemetry configuration.
   Obtain production activation approval before merging it.
5. After activation, verify Argo revision, all image digests and readiness,
   account/LTI entry behavior, synthetic Chat citation behavior, and bounded
   error evidence. Report results separately from CI or release publication.

## Rollback

Retain the current alpha74 registry digests before activation. The rollback
source change restores only the 15 production image tags to
`v3.4.0-alpha.74`; keep the current healthy replica/resource configuration and
telemetry disabled. Do not revert the entire branch or older resource commits.
No database reversal is introduced by this release. Rollback activation needs
explicit authority, either in the rollout approval or separately when needed.

## Verification of this preparation

No new tests are needed for version metadata and release documentation.
Run `pnpm run release:alpha --skip.tag --commit-all` for PR preparation; defer
the tag until the approved merged release commit. Validate every configured version target, preserve every other manifest field,
check the changelog and document formatting, inspect the exact diff, and scan
staged content for secrets. Existing exact-candidate CI covers unchanged
application source. PRD image builds and candidate runtime acceptance remain
publication/activation gates, not completed preparation evidence.
