# Deduplicate hosted pnpm cache writes

## Approval summary

Reduce cache churn without deleting stored data, increasing storage allowances,
or removing cache reads. Three hosted workflows currently use setup-node's
automatic save behavior. Dependency-identical PR refs can retain separate
roughly 650 MB stores.

Use one small shared cache-setup action to preserve the existing Node selection,
pnpm version, exact lockfile cache keys, and pnpm store path. Only the existing
codebase-check job on its existing v3/v3\* push events may save. GraphQL, unit
tests, and all PR jobs restore only. Frozen installs, builds, and tests remain
unchanged.

Existing duplicates will not disappear immediately. A dependency-changing PR
may download packages on each run until a matching push cache exists. This can
increase existing job minutes; it adds no jobs, runner allocation, or paid
capacity. Ordinary source changes retain exact-key base/default-branch reuse.

The user approved this deduplication direction and a goal on 2026-09-07.
Authority covers local worktree setup, bounded edits, checks, reviews, plan
updates, and local commits. Publication, merge, dispatches, retries, cache
deletion, storage or runner settings, Docker caching, and deployment remain
excluded. The terminal result is a reviewed local source package. Hosted
compatibility and storage savings remain pending separately authorized CI proof.

## Execution details

### Evidence and scope

Baseline: `27f2474547df045cc11302c7d9e195798ec66870` on `origin/v3`.
Branch: `rs/hosted-cache-deduplication`.
Worktree: `trees/rs/hosted-cache-deduplication`.
It started zero commits ahead and behind v3.

[The preceding scoped-build PR](https://github.com/uzh-bf/klicker-uzh/pull/5796)
changed build scheduling, not hosted persistent Turbo caching. This package
intentionally revisits its workflow files for the separately approved cache
writer policy, not to complete the build-graph change.

GitHub reported 28 caches totaling 10,430,288,345 bytes in one read-only snapshot.
The inventory changes while jobs run. The sampled setup-node pnpm family
occupied 4.52 GB, including matching keys across PR refs. The usage-policy API
returned 404; neither capacity nor billing policy is established by that error.

The source-owned writers are `.github/workflows/check.yml`,
`test-graphql.yml`, and `test-unit.yml`. Trusted Playwright seeding and its
restore-only consumers remain unchanged. Java CodeQL caches cannot be
attributed to the current JavaScript-only source workflow: generated scanning
and code-quality workflows also exist. The independent CodeQL documentation
investigation is nonblocking and authorizes no source or settings changes.

### Reuse and writer contract

Add `.github/actions/setup-node-pnpm/action.yml`. Each caller retains
`pnpm/action-setup@v4` with version 11.5.0 before this action.

The composite selects Node using `actions/setup-node@v4` and
`node-version-file: package.json`. Its `cache-write` input defaults to false.
Automatic pnpm caching is enabled only when that input is exactly true and the
event is a push. Only the codebase-check caller requests writing. Its existing
push branch filters remain unchanged.

Readers compute the same trimmed `pnpm store path --silent`, Node
`os.arch()`, `RUNNER_OS`, and GitHub `hashFiles('pnpm-lock.yaml')` key as
setup-node v4. They restore through `actions/cache/restore@v4`, with no broad
restore keys or cross-OS archives. Preserve the legacy namespace rather than
creating another family during this capacity-constrained change.

Do not replace GitHub's hashFiles calculation with a plain file hash. Validate
nonempty paths and lockfile hashes. Invalid configuration remains fatal.
An ordinary cache miss or cache-service unavailability reaches the unchanged
frozen install; actual install and build errors still fail. No blanket
continue-on-error or post-action state manipulation is permitted.

The existing setup-node success-only post action remains the writer. Readers
can still show a harmless setup-node post, but must not attempt an upload.
Failed or cancelled check pushes do not seed missing keys. Concurrent readers
on the first push may remain cold; availability is eventual, not same-run.

GitHub still enforces cache ref visibility. This reduces configured writers;
it is not a new authorization sandbox for arbitrary PR code. Cache data remains
the pnpm store, not node_modules, application outputs, or credentials.

### Caller and documentation changes

Replace only Node/cache setup in the three workflows. Keep installs outside
the composite and preserve test, service, permission, and required-status
behavior. Add the composite path to the GraphQL filter and both unit-test path
lists so helper changes exercise those consumers.

Add focused structured workflow tests using the existing yaml dependency and
Node test runner. Invoke them from the existing check job, without changing
package manifests or lockfiles. Update the hosted-cache explanation in
`docs/ci-and-deployment.md`.

No product primitive, schema, or application runtime changes. No new ADR is
needed for a reversible writer reduction in the existing backend. The small
shared action avoids duplicating the same contract across three consumers.

### Delegation and sequence

| Work item                                                    | Owner        | Acceptance                                                                           |
| ------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------ |
| Cache setup, caller wiring, focused tests, and documentation | Main session | Writer selection, exact key/path reuse, path filters, and unchanged execution gates  |
| Verification and review integration                          | Main session | Relevant CI tests, formatting, diff inspection, secret scan, and independent reviews |

The main session retains the tightly coupled cache-policy edit. Delegating its
small mechanical pieces would cost more than implementing them. A separate
researcher checks CodeQL documentation and ownership without changing it.

Commit the reviewed plan first. Commit implementation, focused tests, and
documentation as one cohesive slice. Review that immutable slice with the
simplifier and slice reviewer, then integrate verified corrections. Run one
integrated final review after verification and commits. The later delivery is
one ordinary PR, not a stack; publication requires separate authority.

### Verification

Use a minimal Node 24.16.0 container and existing repository dependencies for
toolchain checks. Git and gh remain on the host. No application runtime is
needed for YAML and composite changes.

The new tests protect the consequential structured contracts: the sole
configured writer, push-only selection, read-only defaults, existing key/path
calculation, all three consumers, and helper-trigger coverage. Do not pin prose
or recreate the cache backend in tests. Preserve existing Playwright contracts
with their existing tests.

Inspect exact differences against the baseline for unchanged installs, builds,
tests, service declarations, permissions, and status gates. Run formatting,
YAML syntax checks, the relevant Node tests, git diff checks, and staged
Gitleaks before commits.

Local checks cannot prove hosted archive compatibility or post-hook outcomes.
After separately authorized publication, natural PR CI must show restoration
without save attempts and passing required checks. After separately authorized
merge, inspect the next successful check push and subsequent read-only
consumers for matched keys and no duplicate PR writes. Measure bytes and churn
over a comparable cohort before claiming savings.

Old duplicates expire under existing policy. An ordinary source revert restores
the previous writer configuration; no cache deletion or settings mutation is
part of rollback.

## Progress

Local package complete. Baseline and cache inventory inspected. The independent planner
approved revision 2 on 2026-09-07 after two accepted corrections: harmless
setup-node post steps are allowed, and cold installs can increase job minutes.

Implementation and focused verification are complete. The three new policy tests
and all 60 existing Playwright CI contract tests pass in Node 24.16.0. Biome,
scoped Prettier, YAML parsing, and diff checks pass. An initial broader check
failed only because the isolated container lacked the node_modules executable
mount; the corrected mount passed without changing product code.

The toolchain container uses the preceding worktree's unchanged pinned
dependencies read-only. No application runtime was started. Local hooks are
split: scoped container checks and staged Gitleaks replace the broad host hook
for this CI-only package; no all-app build or full check:all run is claimed.

The simplifier and slice reviewer completed with no code findings. Their reports
are in `project/_local/reviews/2026-09-07-hosted-cache-deduplication-simplifier.md`
and `project/_local/reviews/2026-09-07-hosted-cache-deduplication-slice-review.md`.
Integrated final review covered
`27f2474547df045cc11302c7d9e195798ec66870..fa6caa624bbb5226b4e6b0bdd528bf16ccfbbf39`.
It found only the stale progress entry, corrected here; no code correction was
required. Its report is
`project/_local/reviews/2026-09-07-hosted-cache-deduplication-final-review.md`.
Test delta: three added policy tests; existing tests unchanged.

The slice reviewer unexpectedly installed ignored dependencies on the host.
No tracked file changed; its host invocation does not replace the pinned
container verification above. No managed application runtime was started.

Remote publication and hosted CI proof require separate authority. No PR exists
for this package yet. The next delivery step is a draft PR and natural Actions
verification after approval. No cache or setting was changed, and no storage or
hosted performance saving is claimed.

Boundary owner: self. Pause for material reuse, trust, or cost changes,
overlapping edits, an unavailable required review, or a necessary external
action outside this package.
