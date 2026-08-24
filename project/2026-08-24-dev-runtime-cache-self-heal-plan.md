# Development Runtime Cache Self-Healing

## Goal

- Problem: generated Next.js and dependency state survives DevPod restarts in
  the bind-mounted worktree. A stale Chat route graph can therefore return HTML
  404 responses while the container, process, and top-level HTTP route all look
  healthy.
- Evidence: the reproduced Chat failure persisted across an exact workspace
  restart and recovered only after replacing `apps/chat/.next`. The repository
  disables Turbo caching for `dev`, so the incident was stale Next.js runtime
  state rather than a replayed Turbo development task.
- Decision: make true development-process starts invalidate only Next.js
  development caches, fingerprint structural and dependency inputs, verify a
  nested Chat API route semantically, and perform one bounded app-cache repair
  before failing closed.
- Non-goals: clear all Turbo caches, reset databases, change production builds,
  add dependencies, change application authentication, or modify devrouter
  itself.

## Execution Contract

- Authority: the user's 2026-08-24 instruction authorizes this isolated
  worktree, plan, local implementation, repository-native verification, exact
  DevPod startup and shutdown, and local conventional commits.
- Withheld: push, PR creation or update, merge, deployment, worktree deletion,
  and DevPod data deletion.
- Terminal: the branch contains the plan and implementation commits; focused
  tests and repository checks pass; an exact-worktree runtime proves healthy
  warm reuse and bounded stale-cache recovery; the runtime is stopped and its
  routes are absent.
- Boundary owner: self.
- Pause: stop for a required production/public behavior change, non-generated
  data deletion, an unsafe process-ownership ambiguity, or a verification
  failure that cannot be resolved inside this runtime package.

## Plan Identity

- Plan: `project/2026-08-24-dev-runtime-cache-self-heal-plan.md`.
- Branch: `rs/dev-runtime-cache-self-heal`.
- Target: `v3` at fresh `origin/v3` commit `09257efb71`.
- PR: none; publication is not authorized.
- Package: one ordinary PR-sized runtime reliability fix. No stack is needed
  because both slices form one independently useful lifecycle contract.

## Decisions and Boundaries

- Primitive impact: no product primitive changes. This affects only the local
  development lifecycle.
- ADR gate: no ADR. The change is reversible repository tooling and does not
  alter a production architecture or trust boundary. A shared cross-repository
  cache protocol or devrouter readiness contract would reopen the ADR gate.
- Cache policy: preserve Turbo and production build caches by default. Clear
  each Next app's `.next/dev` only when its managed dev process truly starts;
  clear one app's complete `.next` only for a confirmed stale-route signature.
- Readiness policy: the Chat sentinel uses a valid synthetic UUID without
  credentials and expects `401 application/json`. Repeated `404 text/html`
  means stale route state. Other stable failures remain visible and are not
  relabeled as cache problems.
- Recovery policy: repair once, restart only the exact managed process group,
  recheck, then fail closed with the observed status and log path.
- Dependency policy: tie the persistent `node_modules` volume to a hash of the
  lockfile and workspace package manifests. Install with the frozen lockfile
  only when that identity changes.

## Skill and Review Routing

- `rs-improve-developer-experience`: shape the fix as a paved lifecycle
  invariant with automatic diagnosis instead of a cleanup instruction.
- `devrouter`: preserve exact process ownership and command-fingerprint reuse.
- `rs-local-runtime-lifecycle`: use and release only the runtime resolved from
  this worktree's absolute source path.
- `klicker-testing-verification`: run shell, repository, build, and exact
  runtime checks inside the supported environment.
- Planning specialist: unavailable because side-conversation policy prohibits
  subagents. The main session cross-checked the plan against the reproduced
  failure, repository scripts, devrouter's helper contract, and the current
  worktree state.
- Integrated specialist reviews: unavailable under the same policy. The main
  session will perform explicit correctness, maintainability, and bounded
  security review over the committed range and record the limitation.

## Delegation Map

| Workstream | Slices | Owner | Dependency and acceptance boundary |
| --- | --- | --- | --- |
| Runtime identity and cache policy | 1 | main | Shell contract tests prove fingerprints, dependency stamping, and scoped cache cleanup |
| Semantic readiness and repair | 2 | main | Slice 1, then exact DevPod proof of healthy reuse and one-shot Chat repair |

- Execution-tier skip reason: side-conversation policy prohibits subagents;
  process lifecycle and live proof are also coupled to one exact local runtime.

## Test Portfolio

| Consequential behavior | Existing evidence | Obligation | Primary seam | Distinct failure | Slice |
| --- | --- | --- | --- | --- | --- |
| Route/config/dependency drift changes managed runtime identity | Devrouter fingerprints command arguments, but no source identity exists | add new | shell contract test | a reused process misses structural repository changes | 1 |
| Persistent dependencies match the checked-out lockfile | `post-create` installs once | add new | shell contract test with a fake installer | branch or lockfile changes reuse stale `node_modules` | 1 |
| Normal restarts preserve production outputs but drop Next dev state | no automated protection | add new | temporary-filesystem shell test | `.next/dev` survives and poisons a new process | 1 |
| Confirmed stale Chat routing gets one scoped repair | manual cache move proved recovery | add new plus runtime proof | pure response classifier and exact DevPod | blanket cleanup, false classification, or repair loop | 2 |
| Healthy warm ensure remains idempotent | devrouter process-helper contract | runtime proof | exact source-path process state | reliability fix causes repeated cold restarts | 2 |

## Slice 1: Deterministic Managed Runtime Start

- Problem: managed process identity excludes route topology and dependency
  state, while generated development caches and the dependency volume persist.
- Route: main.
- Do:
  - Add one repository-owned runtime guard with structural and dependency
    fingerprints, atomic runtime state, scoped Next cache cleanup, and a frozen
    dependency refresh on mismatch.
  - Start `dev:container` through that guard so cleanup happens only after the
    old owned process group has stopped.
  - Stamp the dependency volume after `post-create` installs packages.
  - Ignore only the guard's generated runtime-state directory.
  - Add focused shell contract tests with temporary roots and no real cache or
    dependency mutation.
- Check: shell syntax, focused runtime-guard tests, exact diff inspection, and
  secret/data hygiene.
- Commit: `fix(dev): make runtime cache identity deterministic`.

## Slice 2: Semantic Readiness and Bounded Repair

- Problem: port and page reachability do not prove nested App Router handlers
  are active.
- Route: main.
- Do:
  - Add a Chat probe and pure response classification to the runtime guard.
  - Make `post-start` wait for `401 application/json`, distinguish startup
    waiting from the repeated stale `404 text/html` signature, request one
    Chat-only full-cache repair, restart through managed process identity, and
    fail closed if the second check fails.
  - Expose a read-only `dev:doctor` command and document the lifecycle contract,
    cache policy, diagnosis, and recovery evidence.
  - Verify a normal cold start, warm reuse, semantic sentinel, and a deliberate
    generated-cache repair in this branch's exact DevPod.
- Check: focused tests; `pnpm run check:all`; `pnpm run build`; direct sentinel;
  managed process state before and after warm ensure; deliberate `.next`
  corruption or preserved stale fixture where safe; exact runtime shutdown and
  route absence.
- Commit: `fix(dev): self-heal stale Chat route state`.

## Progress

- Status: terminal. Both slices are locally committed and verified, and the
  exact runtime has been stopped without deleting its data.
- Completed: fresh remote/worktree audit, root-cause evidence, all three planned
  local commits, focused contract tests, integrated main-session correctness/
  maintainability/shell-safety review, repository quality gate, production
  build, committed-head reconciliation, exact runtime recovery proofs, and
  runtime release.
- Latest runtime evidence: warm `devrouter ensure` reused PID 4989; a deliberate
  scoped Chat repair replaced it with PID 7372, removed the generated marker,
  consumed the one-shot request, and restored `401 application/json`. The
  committed implementation head then started as PID 4786 and passed the same
  semantic Chat check. The full quality gate passed after provisioning the
  image-pinned Python 3.12 interpreter in the verification container, and the
  23-task production build passed.
- Lifecycle evidence: `devrouter stop` reported that it stopped DevPod
  `rs-dev-runtime-cache-self-heal` and freed all ten workspace routes. DevPod
  reports provider state `Stopped`; direct Docker and devrouter-state searches
  find no active container or route-state entry for the exact workspace. The
  aggregate `devrouter ls` command currently fails before listing because it
  cannot determine the host route-lock process identity, so that command is not
  counted as positive evidence.
- Remaining: none within the authorized local scope. Push and PR creation remain
  withheld.
- Required delivery layer: verified local committed branch.
- Achieved delivery layer: isolated, verified local branch with the plan and
  both implementation slices committed.
- Review limitation: required specialist roles are unavailable in this side
  conversation. The completed main-session review found no outstanding issue;
  no child review is claimed.
- Next action: none. Publishing the branch and creating or updating a PR require
  separate authorization.
