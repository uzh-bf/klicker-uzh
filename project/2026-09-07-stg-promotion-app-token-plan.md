# Harden staging promotion error handling

## Approval summary

Retain the existing STG_PROMOTE_TOKEN credential design merged in
[the staging write-token repair](https://github.com/uzh-bf/klicker-uzh/pull/5823).
The user approved retaining that design, carrying over credential-safe Git error
handling, and checking existing token permissions without a release-ref write.
The proposed GitHub App migration is deferred; its earlier implementation remains
in branch history only.

Strip the GitHub action's inherited token alias from Git subprocess environments.
Replace raw credential-bearing Git error causes with fixed diagnostic guidance.
Preserve the merged read/write token separation, dry-run defaults, confirmation,
promotion switch, provenance, ancestry, exact leases, and readback.

Authority: one integration of v3 at
2b8e6716fc83c2067c5a69480c2871c45445313f into this task branch, scoped edits,
checks, local commits, independent review, ordinary task push, and draft PR.
Merging into v3, credential grants or changes, release-ref writes, deployment,
and App setup remain excluded. Terminal: reviewed source draft PR.
Boundary owner: self. Pause: unavailable required review or unsafe verification.

## Execution details

### Scope and delegation

Branch: rs/stg-promotion-app-token. Target: v3. Artifacts root: project/.
One integration slice stays with main because of security-sensitive coupling.
Acceptance: existing promoter tests in network-isolated Node 24 with Git,
formatting, exact diff inspection, staged secret scan, and integrated final review.

Only .github/scripts/stg-release-promoter.js and its existing test suite need
behavioral changes. Keep upstream workflow and deployment documentation unchanged.
No dependency, schema, product primitive, or new architecture decision is added.
No new ADR is required; changing the credential architecture would reopen it.

### Test obligations and review reuse

Extend the existing credential-separation test to cover INPUT_GITHUB-TOKEN.
Retain the reviewed synthetic fetch/push failure test, asserting no nested cause
or sensitive marker in the exposed error. Do not pin human diagnostic wording.
Reuse existing lease, readback, receipt, provenance, and dry-run coverage.

The original planner and slice reviewer covered the retained error-sanitization
contract. The original simplifier found no justified reduction. This narrower
scope restores the upstream credential design rather than introducing another.
The final reviewer must inspect the integrated range, including its requested
token-alias cleanup. Prior final review was blocked by the then-unresolved
upstream overlap and does not establish current readiness.

Run focused container checks before the merge commit. Application-wide hooks
are replaced by scoped workflow-script checks for this source-only repair.
No application runtime is needed. Scan the complete task history before push,
including superseded App commits, for secrets and personal data.

### Credential verification boundary

Only secret-name metadata and approved operator permissions may be inspected.
The GitHub secret exists, but its presence does not prove scope or usability.
The klicker-dev operator profile does not allow reading STG_PROMOTE_TOKEN.
Do not broaden its allowlist or retrieve credentials through another client.
Token permissions and live write capability remain unverified. This does not
block the independent source-hardening package.

## Progress

The one approved target integration is in progress. Conflicts are resolved by
retaining the merged workflow and documentation, with error sanitization and
token-alias cleanup carried over. No external write or deployment was attempted.

Earlier tests passed before reconciliation; the integrated suite must be rerun.
Next: verify, commit the merge, finish independent integrated review, and publish
the draft PR. The existing-token permissions check is blocked on approved access;
no permission claim will be made from secret existence.

Slice review: done — project/_local/reviews/2026-09-07-stg-app-slice-review.md
for the retained error-sanitization behavior. The final reviewer owns verification
of its token-alias correction and the integrated upstream credential contract.
