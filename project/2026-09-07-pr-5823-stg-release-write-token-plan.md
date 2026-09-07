# Restore staging release-write authentication — PR #5823

Draft PR: <https://github.com/uzh-bf/klicker-uzh/pull/5823>.

## Approval summary

The staging controller cannot create its release ref with `GITHUB_TOKEN`
when the candidate includes workflow changes. Restore the existing
`STG_PROMOTE_TOKEN` solely for the lease-protected Git push. Keep API and Git
fetch reads on the job token and lower its contents permission to read.

The user approved the source repair, tests, reviews, and a draft PR into `v3`.
Secret values and permissions remain unverified. No secret changes, merge,
workflow dispatch, release-ref update, automatic activation, or cluster action
are authorized. Production release tags remain unchanged.

Acceptance requires separate read/write credentials, no ambient write-token
fallback, token-free dry-runs and no-ops, preserved leases, and an audit of
downstream triggers. Stop before operational activation or broader trigger
changes. This is a full-path, single regression-repair package because it
changes credential handling. It is exempt from the size floor as a CI blocker.

## Execution details

Base: `65ae8a3523f6230290b0b99f8a8e263b61e562a6` (`v3`).
Branch/worktree: `rs/stg-release-write-token`, `trees/rs/stg-release-write-token`.
Artifacts root: `project/`. Boundary owner: self.

The main session owns the single source slice because credential handling is
security-sensitive and tightly coupled. A read-only explorer audits workflow
triggers at the base and candidate
`26e1934c398e5f614c2bb5a682e94f6929172c3e`. Publication requires its findings
and the committed slice's simplifier, risk review, and integrated final review.

Remove the implicit write fallback, scrub raw token environment variables from
Git children, and supply distinct authentication environments for fetch and
push. Require the dedicated token before Git executes only for actual HTTPS
create/fast-forward writes. Inject the workflow secret only for enabled
automatic execution or explicitly confirmed manual apply. Retain trusted
controller execution, evidence qualification, nonrecursive fetching, and the
expected-old lease. No product primitive changes.

Extend existing Git-runner and workflow contract tests for credential
separation, missing-token rejection, permission values, and secret-free
arguments/receipts. Preserve the real bare-remote lease/submodule regression
and token-free no-op/dry-run coverage. Run the promoter suite in an isolated
container with Node and Git, repository formatting, staged secret scan, and
diff inspection. No application runtime is needed; broad application checks
are outside this focused proof.

Update `docs/ci-and-deployment.md` and the supersession section of ADR-0003
to correct their credential claims. This repairs the established design;
no new ADR is required. If trigger remediation exceeds narrow release-ref
exclusions, stop for scope resolution.

GitHub documents using a separate credential when job-token permissions are
insufficient: <https://docs.github.com/en/actions/tutorials/authenticate-with-github_token>.
Non-job-token writes can trigger workflows, so candidate and default-branch
event filters are a publication gate, not an assumed equivalence.

## Progress

Approved scope; planner approved credential-repair-v2 after accepting explicit
environment scrubbing, write-only token requirements, and test/audit details.
Native explore failed before work with provider HTTP 400. Generic-continuity
Luna did not converge after a narrowing prompt; the main session completed the
trigger audit. No push/create definition matches stg-release in either tree;
no downstream build chain or filter edit is needed. Independently configured
GitHub Apps and future candidates remain outside this source audit.

Source slice `df64f832ba` passes all 21 promoter tests on Node 22.21.0 and
Git 2.39.5 in a network-disabled disposable container. The credential regression
failed before the repair. Biome, Prettier, staged Gitleaks, Git identity, and
diff checks pass. One credential-boundary test was added, existing workflow
and receipt checks were extended, and no tests were removed. Full application
build/check and Node 24 proof were not run; no application runtime was started.

Simplifier complete with no recommended reduction. Credential-risk review
complete with no findings. Integrated-final review passed the complete range
through `9586807d9e` with no findings. Source is ready for draft publication;
human review and required hosted CI remain before merge. Reports
are in `project/_local/reviews/2026-09-07-stg-write-token-*.md`.
Optional AGY challenge unavailable due to catalog/authentication errors.
Draft publication complete. No operational state changed. Next: human review
and hosted CI before any separately authorized merge; do not retry promotion.
