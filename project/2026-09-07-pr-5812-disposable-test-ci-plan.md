# Disposable Playwright database provisioning

[PR #5812 — disposable CI databases](https://github.com/uzh-bf/klicker-uzh/pull/5812)

## Approval summary

Give every Playwright shard a dedicated disposable database and login, so the
following database guard can reject staging and production port forwards.
The trusted shard action currently uses a production-like database identity.
Both hosted and public runners load that action from v3, so this prerequisite
must land before the guard can pass CI.

Provision a new `klicker_test` role and database only on the shard's fixed
PostgreSQL service. Give the role no cluster administration privileges and
mark the database with the comment `klicker-disposable-test-v1`. Use that
identity for reset, seed, application processes and tests. Existing candidates
remain compatible. No product behavior or production schema changes.

The user approved preparing, reviewing, publishing and merging this separate
prerequisite on September 7. Publish to origin/rs/disposable-test-ci and merge
only its passing reviewed head into v3. Do not merge the beta authoring PR,
integrate upstream without approval, deploy, connect to a cluster, restore
local data or delete retained data. New verification containers are disposable,
task-owned and have no host ports or retained volumes.

Completion requires behavioral tests, PostgreSQL reset/seed compatibility,
independent reviews, current-head CI, prerequisite merge and a non-skipped
postmerge shard run that identifies the new trusted action. Failed postmerge
proof blocks beta readiness; it does not authorize rollback or beta merge.

## Execution details

Full-path, one cohesive prerequisite PR, followed by the existing
[PR #5799 — beta authoring](https://github.com/uzh-bf/klicker-uzh/pull/5799).
These are sequential packages, not a reorganization of that existing branch.
No product primitive changes. Source rollback is an ordinary revert, requiring
separate authorization after merge.

The provisioning script lives with the trusted action. It ignores caller
connection variables and connects to literal `postgres:5432`, using the
existing synthetic CI administration account. It loads the existing `pg`
dependency after the normal dependency install; no new dependency or Docker
socket is introduced. GitHub context is an intent check, not database proof.
Check server identity and both role/database existence before creating either.
Reject existing objects without mutation. Mark only the newly created database.
Close the client on every exit. Failures block reset and leave partial objects
untouched; retry requires a fresh disposable service.

| Work | Owner | Acceptance |
| --- | --- | --- |
| Provisioning script and trusted action | Main; security-sensitive coupling | Fixed destination, refusal before writes, restricted role, all shard URLs and health identity aligned |
| Behavioral tests | Executor, test file only | Reject context, conflicting environment cannot retarget, reject existing objects, fail closed on each provisioning error, mark only after creation |
| Verification and delivery | Main | Local real database smoke, CI contracts, reviews, published CI, authorized prerequisite merge and postmerge shard proof |

Main also updates docs/testing.md and this plan. The action runs its co-located
tests before provisioning so candidate package scripts need not know the new
test path. The shared test and provisioning code is reviewed as one slice.

Use PostgreSQL 15, Node 24.16.0 and pnpm 11.5.0 for local verification, plus
the workflow-pinned Playwright container for environment compatibility. Record
the exact owned service before writes. Prove test-role login and database
ownership, prohibited role flags, successful existing Prisma reset and seed,
and marker survival after reset. Never weaken permissions to pass the smoke.
Run focused YAML/format checks and check:playwright-ci. No UI or application
runtime startup is needed solely for the provisioning script.

After verification, commit and run the simplifier and risk reviewer in parallel.
Complete integrated final review before publication. Premerge CI uses the old
trusted action, so local smoke is mandatory and postmerge non-skipped proof
remains distinct. The user has authorized final AI review and prerequisite
merge, but no branch-protection bypass.

Pause on retained objects, failed restricted-role compatibility, unresolved
review, missing verification capability or drift requiring integration.

## Progress

Planner round 1 returned REVISE; round 2 APPROVED after the refusal, test
execution, real smoke and postmerge gates were made explicit. Main accepted
all findings. Baseline 27f2474547df045cc11302c7d9e195798ec66870 matches v3.
The provisioner, trusted action wiring, documentation and 19 behavioral tests
are implemented. The beta worktree remains untouched. Tests pass in the pinned
Playwright image. In an isolated PostgreSQL 15 tmpfs service with no host ports,
provisioning created the restricted role and marked database; all five prohibited
role flags were false. Prisma reset completed 184 migrations and preserved the
marker. The existing test seed passed under the restricted login using Node
24.16.0 and pnpm 11.5.0. The 60 Playwright CI contract tests also passed.
Independent simplification, risk and integrated final reviews pass with no
findings on d1004151f5d0f79323be4eaec5279d535c16236d. Published to the approved
branch and PR. Both disposable verification containers are stopped; no retained
database was touched. Current-head CI, final AI review, prerequisite merge and
postmerge trusted-shard proof remain. Target v3 gained unrelated login changes
in dd9e0c0bb4; no file overlap, and no upstream integration performed.
