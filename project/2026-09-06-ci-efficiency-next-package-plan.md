# Faster hosted GraphQL and unit-test builds

## Approval summary

Replace sequential dependency builds in hosted GraphQL and lightweight unit
workflows with narrowly scoped Turbo dependency graphs. Reuse existing trusted
`v3` caches only where task identity, environment, inputs, and outputs are proven
compatible. This reduces repeated compilation without buying capacity.

Cache compatibility is a prerequisite. Playwright seeds run `build:test` inside
a pinned container; hosted tests currently run `build` on Ubuntu. If sharing
fails that check, retain ordinary builds and deliver only the verified graph
improvement. Do not alter build semantics to manufacture cache hits.

Database setup and every currently selected test suite must execute regardless
of build-cache hits. Preserve draft behavior, status reporting, permissions,
and runner-group restrictions. There is no new cache service, dependency,
paid capacity, deployment change, or secret configuration.

The user approved this execution plan on 2026-09-06. Approval permits scoped local implementation,
focused validation, isolated synthetic test services when needed, plan updates,
local commits, and required reviews. Push, PR publication, upstream integration,
merge, dispatches, settings changes, and deployment remain separate actions.

Success requires complete cold and restored build outputs, unchanged test
execution, passing verification, and measured cache behavior. Local evidence is
not hosted acceleration. The terminal deliverable is a reviewed local package;
live performance proof remains pending until a comparable run exists.

## Execution details

### Baseline and ownership

Repository: `uzh-bf/klicker-uzh`. Target: `v3`. The parent refreshed remote refs
on 2026-09-06. Baseline: `1387f884ba731400b251e5646d83de6a9aa9e3b9`.
The source inspected for planning is `trees/rs/ci-timing-ref-validation`,
tracking `origin/v3` at zero ahead and behind. The primary checkout is behind
and contains unrelated changes; it is excluded.

This plan is initially uncommitted beside the separate timing repair. Before
implementation, audit worktrees and establish one owned execution lane without
absorbing that repair. Do not integrate upstream automatically. Reference the
[previous throughput roadmap](2026-09-05-ci-throughput-roadmap-plan.md) as history.
No product primitive changes. An ADR becomes necessary only if a new execution
or trust boundary is proposed.

The main session owns decisions, integration, and evidence. Required reviews
follow the sliced-development and model-routing skills. The writing-for-agents
skill keeps prerequisites, acceptance, and authority explicit in this artifact.

### Measurements and limitations

| Verified observation                                                                                                                                                                                                     | Consequence                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| [Latest completed PR Playwright run](https://github.com/uzh-bf/klicker-uzh/actions/runs/33993694804) has a 4m59 build and shards of approximately 11–15m33. Shards start 2–3 seconds after the build.                    | Execution, not queueing, dominates this sample. It is not a representative fleet benchmark. |
| That run was created at 21:39:52 UTC; global caching was enabled at 21:40:14 UTC. Its logs explicitly report caching disabled.                                                                                           | Its zero of 21 cached tasks cannot evaluate the newly enabled cache.                        |
| [GraphQL validation](https://github.com/uzh-bf/klicker-uzh/actions/runs/33993694587) takes 5m19 overall. Container initialization takes 53 seconds, installation 29 seconds, manual builds 64 seconds, tests 98 seconds. | Graph compilation reuse can reduce one component, not the whole job.                        |
| [Code validation](https://github.com/uzh-bf/klicker-uzh/actions/runs/33993694576) takes under two minutes.                                                                                                               | Preserve its existing affected-task optimization; inspect reuse without adding more jobs.   |
| [Trusted seed attempt 2](https://github.com/uzh-bf/klicker-uzh/actions/runs/33992561288/attempts/2) reports 21 of 21 tasks cached on both architectures.                                                                 | This proves seed self-reuse, not compatibility with other workflows.                        |

The planner found that GraphQL declares `feature-flags`, and that Prisma
generates source outside the generic `dist` outputs. Verify those contracts in
the first slice; do not copy the existing manual package list blindly.

### Delegation map

| Work item                                | Owner    | Acceptance                                                                                                   |
| ---------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| Establish task and cache compatibility   | Main     | Per-task compatibility matrix and explicit sharing decision; environment and trust decisions remain coupled. |
| Convert hosted dependency builds         | Executor | Exact dependency graph, complete cold/restored outputs, existing suites pass.                                |
| Wire compatible cache restoration        | Main     | Restore-only consumers, trusted writer, correct misses and outputs; retain trust-sensitive decisions.        |
| Verify and review the integrated package | Main     | Focused checks, resolved reviews, local timing evidence, explicit hosted-proof limits.                       |

### Establish compatibility before changing workflows

Inspect relevant package manifests, build configurations, generated-output
consumers, existing cache helpers, and workflow contracts. Record for each task:

- Identity, command, dependencies, and hashed source inputs.
- Node, pnpm, Turbo, operating system, architecture, and effective environment.
- Required generated source and runtime outputs, including Prisma client and
  Pothos output, GraphQL documents/maps, and the worker entry point.
- Actual seed coverage and whether restored outputs serve cold downstream tasks.
- Sharing decision and remaining evidence gaps.

Inspect environment keys and compatibility without printing secret values or
whole environment files. Task-name or environment differences are not presumed
equivalent. Never remove hash inputs merely to obtain hits.

Read an existing compatible PR run created after cache activation when available.
Record source/test subject, workflow revision, attempt, architecture, fingerprint,
matched key, and actual task hits. If none exists, record that gap without
dispatching or retrying a workflow.

Commit boundary: approved plan first, followed by compatibility findings with
their implementation slice. No standalone plan PR.

### Convert hosted dependency builds

Primary files are `.github/workflows/test-graphql.yml` and
`.github/workflows/test-unit.yml`. Use Turbo `build` with the GraphQL worker
dependency closure, explicitly retaining GraphQL as a required target. For unit
jobs, select the current Prisma, types, grading, and util roots and dependencies;
do not introduce Chat or PWA application builds.

Verify the exact task set using the installed Turbo dry-run facility. Preserve
the unit build step identifier and downstream conditions. Keep all current
tests selected and maintain failure propagation.

Permit narrowly scoped Turbo output corrections only when the compatibility
inventory proves missing required output. Verify restored producer plus cold
consumer behavior. Include new orchestration inputs in change filters and check
the GraphQL dependency closure, including `feature-flags`; do not reduce coverage.

Acceptance: cold builds from clean outputs, warm restoration with outputs absent,
and passing existing GraphQL/worker and unit suites. This is a `ci` commit with
the necessary output and trigger corrections, not a general configuration cleanup.

### Restore only proven-compatible caches

Potential changes are confined to those two workflows, the existing seed
workflow, and existing cache-contract helpers and focused tests. Keep
architecture separation, immutable compatible keys, and frozen installation.
Use restore-only public build-cache consumers and the existing trusted `v3`
writer. Do not cache database state, test results, tokens, or environment files.

Existing setup-node pnpm caching remains; do not add a redundant store restore.
A missing or unavailable cache falls back to compilation. Compilation errors
remain fatal. Test and database steps execute even on full build-cache hits.

If sharing requires new seed workloads, different build semantics, broader
environment changes, or increased CI cost, pause that extension and retain the
verified graph conversion. Do not introduce a service or credentials implicitly.

Acceptance: actual reuse, complete restored outputs, safe cold fallback, and
unchanged executed tests. Extend existing compatibility/policy tests for changed
contracts only. Commit compatible wiring separately, or record its deferral.

### Verification and delivery

Use existing formatting, YAML parsing, CI-contract checks, cache/telemetry tests,
and exact diff inspection. Build/install/package tests use the configured
container toolchain; static checks do not justify starting an application stack.

Integration verification requires isolated synthetic PostgreSQL and the exact
GraphQL/Chat dependencies. Identify the target before any reset. Never reuse
or reset a user's database. Stop the exact runtime after testing unless the user
explicitly retains it.

Test cold and warm cases in isolated output/cache state. Include a changed
dependency case with mixed restored and rebuilt producers. Verify generated
artifacts and worker imports. Existing behavior tests remain the primary proof;
add no prose snapshots or YAML text assertions.

Measure setup, container startup, install, cache transfer/extraction, build,
database setup, tests, artifact transfer, queue, and total time separately.
Report sample counts and spread with architecture, toolchain, selected tasks,
source/test subject, cache state, and outcome. Separate cancelled/failed samples
and account for seed/storage overhead. Promise no speedup percentage.

Run the applicable simplifier, cache-risk slice review, and integrated final
review. Prior reviews do not cover this package. Local commits are permitted
after execution-plan approval. Publication and live activation remain withheld.

### Other CI improvements, outside this package

| Candidate                                | Next evidence or decision                                                                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Docker layer caching                     | The inspected staging manage build uses `no-cache: true`. Coordinate existing Docker ownership before a single-image cache pilot; preserve image inputs and deployment behavior. |
| Smarter draft Playwright runs            | Complete existing shadow and draft-to-ready acceptance before activation; ready PRs retain full coverage.                                                                        |
| Fewer scheduler-only jobs                | The fallback workflow allocates two success-only jobs. Verify consumers and required-check names before consolidating them.                                                      |
| Less repeated validation                 | Prove test-subject equivalence before suppressing push versus PR runs; branch and merge-ref runs are not automatically equivalent.                                               |
| Smaller service sets and balanced shards | Repair timing publication first, then measure setup and slow-tail tests; preserve meaningful integration coverage.                                                               |

Vercel is not mandatory: Turbo supports a self-hosted compatible HTTP cache.
That is not proposed here because it adds operations without proven need.
Public PR-readable caches must contain no secrets.
References: [Turbo remote caching](https://turborepo.dev/docs/core-concepts/remote-caching),
[Turbo task outputs](https://turborepo.dev/docs/crafting-your-repository/configuring-tasks),
[GitHub cache access](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching).
Current Context7 documentation also confirms that `globalEnv` changes invalidate
all task caches; narrowing it requires a separate input-usage audit, not deletion.

## Progress

Execution approved on 2026-09-06; build verification is active. Native planner returned
`DONE — VERDICT APPROVED` on 2026-09-06. Its findings about task identity,
generated outputs, compatibility, and measurement limits are retained above.
The parent independently refreshed the remote baseline and confirmed activation
timing. The dependency-graph conversion is implemented. Its dry runs select eight
GraphQL/worker tasks and four unit dependency tasks. The cold GraphQL graph
passes all eight builds; isolated Chat, PWA, grading, Markdown, util, and
GraphQL suites pass. All 60 existing Playwright CI contract checks pass.

Existing Playwright seeds cannot supply these `build` tasks. Cache wiring is
deferred under the approved compatibility fallback; no seed workload, cache
service, credential, or setting is added. See the
[compatibility evidence](2026-09-06-hosted-build-cache-compatibility.md).

Restoration passes with eight cache hits and complete `dist` artifacts while
generated source is absent. All 1,494 tests pass on both cold and restored
outputs. Mixed-hit compilation passes with five restored producers and three
rebuilt tasks. No output correction is needed for these consumers.

Test portfolio: existing suites protect test execution; Turbo dry runs protect
the selected dependency closure; cold/restored/mixed probes protect output
equivalence. No new maintained test is needed for the workflow-only conversion.
Implementation commit: `50898f9e5191480463b578a19aaee74b80d6443a`.
Simplification is complete: retain the explicit build roots required by the
plan, even where today's dependency edges also reach them. Risk review and
integrated final review remain pending. No maintained tests were added or removed.

The exact disposable Compose project `klicker-ci-build-graphs-proof` is stopped;
its running-service query returns no entries. All named build/test containers
have exited. No Devrouter runtime or routes were started. Container data and
task-local probe backups are preserved; no deletion or broad cleanup occurred.

The separate timing-ref repair is one uncommitted line in
`update-playwright-timings.yml`. Missing-ref reproduction, valid commit lookup,
non-commit rejection, Prettier, YAML parsing, and diff checks pass locally.
This does not prove remote timing publication; no workflow was rerun or pushed.

Execution lane: `trees/rs/hosted-test-build-graphs`, branch
`rs/hosted-test-build-graphs`, baseline `1387f884ba731400b251e5646d83de6a9aa9e3b9`.
The timing repair remains in its original worktree and is excluded.

Boundary owner: main. Next action: finish independent review and local evidence
commits. Stop only for a material cost/trust decision,
unavailable isolated verification, competing ownership, or new external action.
