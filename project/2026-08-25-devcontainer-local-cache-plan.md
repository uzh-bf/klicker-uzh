# Devcontainer Local Cache Plan

## Goal

Reduce cold worktree and warm restart time without a registry. Share only the
pnpm content-addressed store across local DevPods, preserve healthy per-worktree
Next.js development caches, and retain the existing bounded stale-cache repair.

## Non-goals

- Do not share `node_modules`, `.next`, PostgreSQL data, or application state
  between worktrees.
- Do not add a registry, dependency, prebuilt application image, runtime
  profile, or database snapshot.
- Do not replace `devrouter ensure` as the canonical lifecycle command.
- Do not create a pull request, merge, delete a runtime, or remove the shared
  cache volume.

## Execution contract

- Authority: create and edit the task worktree, run repository checks, use the
  exact devrouter runtime when available, create local commits, and run the
  required read-only specialist reviews. The user separately authorized pushing
  the complete branch to `origin/rs/devcontainer-local-cache` on 2026-08-26.
- Withheld: pull-request creation, merge, runtime or worktree deletion,
  shared-volume removal, and broad Docker cleanup.
- Terminal: a pushed branch with fresh focused and repository checks, exact
  runtime lifecycle accounting, and an integrated final review.
- Boundary owner: self.
- Pause: a material scope or isolation change, an unsafe cache deletion path,
  or a lifecycle lock that prevents required runtime verification.

## Plan identity

- Plan: `project/2026-08-25-devcontainer-local-cache-plan.md`
- Branch: `rs/devcontainer-local-cache`
- Worktree: `trees/devcontainer-local-cache`
- Target: `v3`
- Base: `e4ef09e5bfc64a4019bace0b472630d5a21408c5`
- Pull request: none

## Decisions and assumptions

- One host-created external Docker volume named
  `klicker-uzh-pnpm-store-v1` persists the pnpm store across worktrees.
- `initializeCommand` creates the volume before Compose resolves external
  volumes. Current Dev Containers CLI documentation confirms it runs on the
  host before container creation.
- The store is safe to share because pnpm addresses package content by digest.
  Worktree-specific install links and native layout remain in each worktree's
  `node_modules` volume.
- Ordinary managed restarts preserve `.next/dev`. Only a confirmed stale-route
  repair request removes the complete `.next` directory for an allow-listed
  app, once.
- Cache cleanup remains manual and destructive. It is documented but never
  automated.

## ADR gate

No ADR. This is a reversible local-development cache policy with an explicit
volume version and bounded cleanup contract. A shared application-output or
database cache, remote registry, or mandatory cross-machine cache would reopen
the ADR gate.

## Skill routing

- `rs-sliced-development-workflow`: full-path plan, commits, and review gates.
- `rs-model-routing`: planner, slice reviewers, simplifiers, and final review.
- `rs-local-runtime-lifecycle`: exact DevPod verification and shutdown.
- `klicker-testing-verification`: focused checks and repository verification.
- `klicker-wiki-maintenance`: same-change wiki and skill updates.
- `devrouter`: canonical startup, static verification, and route ownership.

## Planning-stage specialist

- Result: `DONE` from the configured planner.
- Accepted: include the Dockerfile comment, preserve only explicit repair
  deletion, keep all writes in the main session, and verify both Compose
  overlays plus exact runtime behavior.
- Accepted: the planner omitted `docs/log/`; the applicable
  `klicker-wiki-maintenance` skill reserves that path and requires it to remain
  absent.

## Delegation map

| Workstream | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| Shared pnpm store | main | plan commit | exact volume bootstrap, Compose topology, local-first install |
| Next cache retention | main | shared store | ordinary retention, explicit repair, symlink refusal |
| Lifecycle documentation | main | runtime behavior | wiki, skill, and README agree with source |

Execution stays in the main session because the slices share one runtime
script, one Compose topology, and one exact verification environment. This is
critical-path coupling; delegation would cost more than the bounded edits.

## Test portfolio

| Behavior or risk | Existing evidence | Obligation | Primary seam | Distinct failure | Slice |
| --- | --- | --- | --- | --- | --- |
| Shared store is the only cross-worktree volume | Compose config | extend existing | resolved Compose model | app outputs or data become shared | 1 |
| Volume bootstrap is idempotent and fail-closed | none | add new | mocked host initializer | missing external volume reaches Compose | 1 |
| Dependency changes still run a frozen install | runtime shell test | extend existing | `util/test-dev-runtime.sh` | stale worktree links reuse incompatible inputs | 1 |
| Healthy `.next/dev` survives restart | runtime shell test asserts deletion | replace/consolidate | `util/test-dev-runtime.sh` | every restart recompiles all Next apps | 2 |
| Confirmed repair deletes only requested app caches | runtime shell test | extend existing | `util/test-dev-runtime.sh` | broad or repeated deletion | 2 |
| Symlink cannot escape cache deletion scope | runtime shell test | extend existing | `util/test-dev-runtime.sh` | repair deletes outside the worktree | 2 |

## Slice 1: Share the pnpm content store

- Route: main.
- Do: add the host initializer, wire it from `devcontainer.json`, mount the
  external pnpm-store volume, prefer cached package content, and update the
  Dockerfile ownership comment.
- Check: shell syntax, mocked initializer behavior, exact pnpm arguments,
  primary and linked Compose resolution.
- Acceptance: only `/pnpm/.pnpm-store` resolves to the external cache volume;
  `node_modules_root` and `pgdata` remain project-scoped.
- Commit: `enhance(dev): share pnpm store across worktrees`.
- Review: parallel simplifier and slice reviewer for host-script safety,
  persistence, and storage isolation.

## Slice 2: Preserve valid Next.js caches

- Route: main.
- Do: remove unconditional `.next/dev` deletion and retain allow-listed,
  request-driven full `.next` repair with symlink refusal.
- Check: focused runtime shell test covering ordinary restart, requested
  repair, deduplication, generation, and symlink safety.
- Acceptance: healthy caches survive; only requested stale apps are removed.
- Commit: `fix(dev): preserve valid Next development caches`.
- Review: parallel simplifier and slice reviewer for deletion scope and cache
  safety.

## Slice 3: Document the lifecycle

- Route: main.
- Do: update the devcontainer README, getting-started wiki, environment-doctor
  skill, and keep the reserved `docs/log/` path absent.
- Check: wiki validation, formatting, and source-to-document fact check.
- Acceptance: docs state the exact shared and isolated paths, canonical
  startup, repair behavior, and approval-gated manual cleanup.
- Commit: `docs(dev): document local cache lifecycle`.
- Review: no per-slice specialist; documentation-only follow-up.

## Finish gate

- Run fresh shell syntax, focused runtime tests, Compose resolution for both
  overlays, wiki validation, formatting, `check:all`, and build when the exact
  DevPod is available.
- Run `devrouter repo devcontainer verify --repo . --json` when the lifecycle
  lock permits it.
- In the exact task runtime, prove the shared pnpm-store mount and a harmless
  `.next/dev` marker survives stop/start while `pnpm run dev:doctor` remains
  healthy.
- Stop the exact checkout and confirm provider state `stopped` with zero exact
  routes. Never use `--delete` or remove the shared volume.
- Commit the complete package and run one final reviewer over the validated
  base-to-HEAD range for correctness, plan compliance, maintainability,
  shell/config security, and storage isolation.
- If the existing host-route lock blocks runtime proof, record the exact error
  without bypassing it and do not claim live performance verification.

## Progress

- Status: complete. All three slices and accepted final-review corrections are
  committed, verified, and reviewed.
- Completed: remote `v3` freshness readback, clean task worktree, planner pass,
  plan commit `585f0c1b4`, shared pnpm-store commit `3355b0829`, mocked
  initializer success/idempotence/failure checks, shell syntax, ShellCheck on
  changed production scripts, and both resolved Compose overlays.
- Focused evidence: `bash util/test-dev-runtime.sh` passed; both Compose models
  expose only `pnpm_store` as external and retain project-scoped
  `node_modules_root` and `pgdata`. The updated runtime test proves ordinary
  starts retain all five `.next/dev` caches, explicit repair remains exact and
  deduplicated, and symlinked repair targets fail without touching their data.
- Runtime evidence: the static devcontainer verifier reports five passing
  checks. The exact runtime mounted
  `klicker-uzh-pnpm-store-v1` at `/pnpm/.pnpm-store`, passed all five app
  readiness contracts, and completed the root build with 23 of 23 tasks.
- Restart evidence: after an exact stop reached zero containers and routes, the
  same Compose project restarted. A harmless marker under
  `apps/frontend-manage/.next/dev` survived, the shared-store mount remained
  exact, and `pnpm run dev:doctor` passed all five readiness contracts.
- Host anomaly: an earlier proof attempt coincided with a Docker-engine state
  reset and therefore performed a cold image and package rebuild. It is not
  counted as cache-retention evidence and no startup-time claim is based on it.
- Repository-check limitation: `pnpm run check:all` reaches the analytics
  Python environment, where `uv` selects CPython 3.14.4 and pandas 2.2.2 cannot
  build because the image has no C compiler. The exact removed-doc-artifact
  check passes, and the branch's wiki-validator findings match the archived
  `origin/v3` baseline.
- Freshness update: the branch was cleanly rebased onto current `origin/v3`
  after three upstream commits landed during verification. The rebased focused
  shell, Compose, and runtime tests pass. Installed devrouter 0.0.37 cannot
  parse the upstream `profiles` key; the already-built local devrouter 0.0.38
  checkout validates the rebased configuration with five passing checks.
- Later upstream state: unrelated CI commit `b8ce11051` landed after the final
  rebase and changes no reviewed path. The local branch is therefore one commit
  behind current `origin/v3` without a content conflict.
- Final-head runtime: exact commit `b381b01a1` started with the devrouter 0.0.38
  `full` profile. The external-store mount was exact, a commit-specific
  `.next/dev` marker survived a settled stop/start cycle, and all five
  `dev:doctor` contracts passed after restart.
- Slice 1 review: done through trusted generic-continuity specialists after the
  configured Gemini routes failed pre-work with provider `402`; the accepted
  simplification uses Docker's idempotent named-volume creation directly. No
  blocking correctness or isolation finding remained. Reports:
  `project/_local/reviews/2026-08-25-devcontainer-cache-slice-1-simplifier.md`
  and `project/_local/reviews/2026-08-25-devcontainer-cache-slice-1-review.md`.
- Slice 2 review: done through the same trusted generic-continuity route. No
  simplification or blocking finding; live proof remains a finish-gate item.
  Reports:
  `project/_local/reviews/2026-08-25-devcontainer-cache-slice-2-simplifier.md`
  and `project/_local/reviews/2026-08-25-devcontainer-cache-slice-2-review.md`.
- Runtime lifecycle: the exact workspace is stopped with zero containers and
  routes. The local `klicker-uzh-pnpm-store-v1` volume remains intentionally
  retained.
- Final review: the first integrated pass found no high or critical issue. Its
  two medium findings and one low finding were accepted: documentation now
  requires devrouter 0.0.38, final-head live proof is recorded above, and the
  source-format-dependent pnpm assertion was removed while executable argument
  coverage remains in the focused runtime test. The focused correction
  re-review returned `DONE` with no remaining findings.
- Active gate: none.
- Next: optional pull-request creation requires separate user approval.
- Required delivery: pushed remote branch.
- Achieved delivery: complete, verified, reviewed branch pushed to
  `origin/rs/devcontainer-local-cache`.
