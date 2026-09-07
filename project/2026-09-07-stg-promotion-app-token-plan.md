# Repair staging promotion credentials

## Approval summary

The staging promoter cannot publish a release ref containing workflow changes
with the default GitHub Actions token. Use a short-lived GitHub App installation
token scoped to this repository with Contents write and Workflows write for the
validated Git push. Keep metadata access on a read-only default token.

The user approved source implementation, testing, independent reviews, ordinary
task-branch publication, and a draft PR targeting `v3`. App installation,
permission grants, secret configuration, release-ref writes, merging, and
deployment are not authorized. These permissions are repository-wide, not
branch-scoped. App-authored pushes can trigger workflows, unlike default-token
pushes; activation requires a separate trigger audit and approval.

Preserve dry-run defaults, manual confirmation, the automatic promotion switch,
trusted-controller execution, image provenance, ancestry checks, exact remote
leases, and post-push readback. Completion means focused checks pass and the
complete committed source package receives independent review before draft PR
publication. Live App write capability remains unverified until separately
approved setup and activation.

## Execution details

### Working context and authority

- Branch: `rs/stg-promotion-app-token`, the credential repair task branch.
- Base and upstream: `v3` at `65ae8a3523f6230290b0b99f8a8e263b61e562a6`.
- Artifacts root: `project/`; private local verification stays in ignored `_local/`.
- Authority: source-only implementation and routine draft PR delivery.
- Terminal: reviewed draft PR; boundary owner: self.
- Pause: unavailable required review or verification, changed security scope,
  or a need for one of the withheld external actions.

### Credential and error contracts

Reuse one input resolver before token minting and during promotion. Mint only
when its explicit boolean output permits writing. Default manual dry runs,
invalid confirmation, disabled automatic promotion, and wrong-source events
must not mint a token. Existing candidate validation still precedes any ref write.

Use the official `actions/create-github-app-token` action pinned to
`fee1f7d63c2ff003460e3d139729b119787bc349`, whose inspected inputs support explicit
repository scoping, `permission-contents`, `permission-workflows`, and automatic
post-job revocation. Proposed configuration is `STG_PROMOTION_APP_ID` as a
repository variable and `STG_PROMOTION_APP_PRIVATE_KEY` as a secret. This package
does not configure either value.

Pass the resulting token through a distinct `STG_PROMOTION_TOKEN` variable only
to the Git write path. Remove the implicit `process.env.GITHUB_TOKEN` fallback.
Strip both raw token variables from the subprocess environment. Keep credentials
out of argv, files, logs, receipts, and error causes. Fetch and push failures
must return sanitized, actionable errors. Preserve credential-free local Git
fixtures and the existing expected-old lease behavior.

### Scope and delegation

One coherent implementation slice belongs to `main` because the change is
security-sensitive and tightly coupled. Acceptance is the extended existing
promoter suite, scoped formatting and diff checks, independent reviews, and
draft PR delivery. No product primitives, dependencies, schema, or runtime
application behavior change.

Included source paths are `.github/workflows/deploy-stg-promote.yml`,
`.github/scripts/stg-release-promoter.js`, and its existing `.test.js` suite.
Update `docs/ci-and-deployment.md` and the supersession section of
`docs/adr/0003-promote-stg-via-release-annotation-write-back.md` for the revised
credential contract. Extend the existing decision rather than creating a
second deployment architecture. No new contract-test file is needed.

### Verification and delivery

Extend existing tests for input-policy-before-mint behavior, exact workflow
permission values and token wiring, absent App credentials despite a present
default token, and sanitized fetch/push failures. Use synthetic token markers
in message, stderr, nested causes, and attached environment. Reuse existing
ancestry, image evidence, lease, readback, dry-run, and receipt tests.

Run tests with Node 24 and Git in a disposable container without network access;
do not start the application stack. After focused verification and data hygiene,
commit implementation, dispatch independent simplifier and security slice review,
resolve findings, then review the complete committed range with final-reviewer.
Publish an ordinary task-branch push and draft PR targeting `v3` only after
required gates pass. Do not integrate another source branch or move a release ref.

### Research and review evidence

The official action definition and GitHub Actions documentation confirm the
supported installation-token inputs and the default token permission limitation.
The configured native planner approved the revised draft after correcting the
test-file inventory, committed-range review order, and credential test obligations.
Child: `01a07c2f-7664-70d1-9993-c0142400c121`.

The user approved external disclosure of this design without secrets or runtime
data. Gemini 3.8 Flash (High) returned APPROVED with cautions. Its CLI requires
the explicit High model label without a separate effort flag. Retain the
pre-activation trigger and ruleset audit and document best-effort revocation.
Reject adding skip-CI commits or automatic ruleset bypass: promotion must retain
the original candidate commit and existing repository protections. Keep Git
authentication in process-local environment configuration, never command arguments.

## Progress

Planning approved by the native planner and external advisor; user source scope
approved. Implementation is next. No implementation commit or PR yet.
The baseline promoter suite passes all 20 tests in Node 24.16.0 with Git.
The disposable verification image is `klicker-stg-promoter-verify:local`; test
containers use `--rm`, and no application runtime was started.

The correct staging dry run succeeded:
https://github.com/uzh-bf/klicker-uzh/actions/runs/34130485520.
Its verified canonical checksum covers candidate
`654621094c63b977937202269c210edc0af1e8c2`, source `v3-ai`, 15 workflows,
16 images, dry-run mode, and `update_result.result=not-attempted`.
Receipt files remain in `project/_local/stg-preflight-34130485520/`.

Next: implement and verify the approved slice, then complete committed-range
reviews and draft PR publication.
