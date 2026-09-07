# Restore staging release-write authentication

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
Native explore failed before work with provider HTTP 400; the same bounded
audit uses generic-continuity Luna. Optional AGY challenge unavailable due to
catalog/authentication errors. No operational state changed.

Next: implement and verify the source slice, review, then publish a draft PR.
