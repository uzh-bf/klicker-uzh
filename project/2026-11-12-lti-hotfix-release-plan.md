# Isolated LTI recovery release

## Decision and authority

Prepare an alpha.93 hotfix from v3.4.0-alpha.92 plus the reviewed LTI recovery fix in PR [6864](https://github.com/uzh-bf/klicker-uzh/pull/6864). This excludes the question revisions, video citations, graph-build handling and course-image changes subsequently included in v3-ai. Main session owns the package. Full-path release preparation; source preparation is authorized by the November 12 user request. The user approved the isolated hotfix route and release-policy exception on November 12. Prepare the release branch and deployment draft PR. Tag publication, merges and production rollout remain explicitly withheld.

Repository: klicker-uzh. Local branch: chore/lti-hotfix-release. Base tag: v3.4.0-alpha.92 at c76a0e83a648c3fafaad6a58f2cd294d092d29ec. Fix source: e17fcbbb4a6757cbfb4ed153e9e4f6276cf635c4. Version preview: v3.4.0-alpha.93, subject to a fresh uniqueness check before publication.

Approved topology exception: repository AGENTS.md says “Tag publication and production activation remain separately authorized actions” and requires creating the tag “only at the approved merged release commit.” The user approved the narrow exception permitting the exact independently reviewed commit on the hotfix branch to be tagged without merging into moving v3-ai. Tagging the result of such a merge would include unrelated changes. Do not create a new maintained release branch merely to work around this rule. Do not promote the source tree to v3, whose role here is deployment configuration.

## Preparation batch

1. Backport only apps/lti/src/index.ts, launchOrigin.ts, requestLogging.ts, apps/lti/tests/launchOrigin.test.mjs, requestLogging.test.mjs and docs/auth-model.md from the reviewed fix. The six files must match the reviewed source byte for byte. Preserve alpha.92 dependency lockfiles, shared packages and schema. No migrations or new dependencies.
2. Test the candidate against baseline dependencies in its exact managed runtime: real-provider regression tests, LTI typecheck/build and repository-required checks. Preserve the original review's coverage of recovery HMAC, state binding, JWT signatures, expiry, exact-Origin gating and one-use nonces. Reuse source review only where context matches; independently review the integrated baseline-plus-fix result. If managed runtime is unavailable, report the precise missing capability; no database resets or check waivers implied.
3. Commit the verified backport. Use the repository standard-version alpha generator with --skip.tag and --skip.commit to prepare version/changelog changes, then inspect its output before committing. Changelog must contain the hotfix only, never excluded v3-ai changes. The earlier dry run establishes the proposed next version only; because the patch was uncommitted, it is not the final changelog. Expected additional files are CHANGELOG.md and the package manifests in .versionrc.js. No hand-edited versions.
4. Review the full tree delta from alpha.92, including generated metadata, lockfiles and absence of schema changes. Complete independent final release review. Publish the reviewed task branch only under the agreed hotfix topology, retaining its exact source SHA as the review reference.
5. Prepare a separate deployment draft from fresh origin/v3 changing only lti.image.tag. Preserve all other image pins, release assets, burst settings, replicas, graph service configuration and model settings. Render the chart and verify only the LTI image changes, plus any existing same-image migration hook is unchanged. Treat the proposed alpha.93 pin as unqualified until its image exists; do not merge it early.

Terminal for preparation: exact reviewed source SHA, generated alpha.93 metadata, passing applicable checks, reviewed LTI-only deployment diff and a concrete conditional approval card. No release tag or live change is part of preparation. Keep the source release branch as the immutable review reference, with a comparison against alpha.92; do not open a misleading source-promotion PR into a later source branch. The deployment draft PR targets v3.

## Conditional publication and rollout, separately gated

- Verify the deployed LTI baseline and rollback image identity privately, verify APP_ORIGIN_LTI is a bare HTTP(S) origin without exposing values, refresh remote state and check tag availability.
- With exact named authority and policy exception, publish v3.4.0-alpha.93 at the reviewed isolated source SHA. Existing tag workflows build every service; this does not authorize deploying those other images.
- Verify successful LTI ARM64 build, source provenance, image digest and applicable security checks. A failed build blocks promotion; do not overwrite tags or substitute a later source revision.
- Only with conditional merge and deployment authority, merge the reviewed LTI-only configuration PR into v3 and let the established GitOps controller reconcile. No manual cluster patch or database mutation.
- Observe desired revision, updated ready replicas, /keys, expected unauthenticated /handoff rejection and a successful browser launch. Inspect bounded diagnostics without recording personal data in public artifacts.
- If acceptance fails, report the exact failure. Rollback, when explicitly included in approval, reverts only the LTI pin to its verified prior image through GitOps. Do not disable state validation.

## Progress and evidence

Source backport complete; the six application, test and authentication-documentation files match PR 6864 exactly. The alpha.92 baseline retains its dependency lockfile and schema. Candidate LTI tests, typechecks, formatting, lint, dependency consistency, host contracts and focused source scan pass. The initial aggregate production build passed. The repository generator produced alpha.93 version-only metadata and hotfix notes. Validation of that final metadata and integrated release review are pending. The deployment branch changes only the LTI image tag; chart lint and before/after rendering pass with exactly one changed image line. No tag or deployment has been performed.

Independent plan critique: native GPT-6 Astra continuity after configured planner launch failed. Accepted findings: verify deployed baseline privately, keep proposed deployment pins unqualified until builds pass, and inspect generated metadata against alpha.92. These gates are incorporated above. No production-derived facts are included here.

Validation of the reconstructed release artifact remains separate from the existing fix review. The application change is identical, but the release uses the alpha.92 dependency baseline.
