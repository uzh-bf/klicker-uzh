# Development Runtime Cache Self-Healing

## Goal

- Problem: generated Next.js and dependency state survives DevPod restarts in
  the bind-mounted worktree. Stale Next.js route state can therefore serve
  HTML 404 responses on routes that exist in the branch while the container,
  process, and top-level HTTP route all look healthy. This affects every Next
  app, not only Chat: Next 16 keeps the persistent Turbopack development cache
  under `.next/dev`, exactly the state a true managed start must drop.
- Evidence: the reproduced Chat failure persisted across an exact workspace
  restart and recovered only after replacing `apps/chat/.next`. The repository
  disables Turbo caching for `dev`, so the incident was stale Next.js runtime
  state rather than a replayed Turbo development task. The 2026-08-25 scope
  correction (thread `01a0347d`, quiz-evaluation 404) reports the same
  symptom class on manage detail pages; that specific incident showed the
  evaluation GraphQL query returning no data, which is a data-driven
  application 404 rather than proven cache staleness.
- Decision: make true development-process starts invalidate only Next.js
  development caches, fingerprint structural and dependency inputs, verify a
  per-app readiness contract (the nested Chat API route plus committed shell
  pages for the other apps), and perform one bounded per-app cache repair
  before failing closed.
- Non-goals: clear all Turbo caches, reset databases, change production builds,
  add dependencies, change application authentication, or modify devrouter
  itself. Data-driven 404s stay application failures and are never
  reclassified as cache signatures.

## Execution Contract

- Authority: the user's 2026-08-24 instruction authorized this isolated
  worktree, plan, local implementation, repository-native verification, exact
  DevPod startup and shutdown, and local conventional commits. The user's
  2026-08-25 instruction additionally authorizes generalizing readiness and
  repair to all Next apps, pushing the branch, and updating PR #5535.
- Withheld: merge, deployment, worktree deletion, and DevPod data deletion.
- Terminal: the branch contains the generalized plan and implementation;
  focused tests and repository checks pass; an exact-worktree runtime proves
  all five readiness contracts and is stopped with zero routes; the branch is
  pushed and PR #5535 describes the generalized scope.
- Boundary owner: self.
- Pause: stop for a required production/public behavior change, non-generated
  data deletion, an unsafe process-ownership ambiguity, or a verification
  failure that cannot be resolved inside this runtime package.

## Plan Identity

- Plan: `project/2026-08-24-pr-5535-dev-runtime-cache-self-heal-plan.md`.
- Branch: `rs/dev-runtime-cache-self-heal`.
- Target: `v3` (merged up to `origin/v3` commit `7b638c6cbe`).
- PR: [uzh-bf/klicker-uzh#5535](https://github.com/uzh-bf/klicker-uzh/pull/5535).
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
- Readiness policy: every Next app carries a readiness contract on a route
  that exists in every branch. Chat expects unauthenticated `401
  application/json` on a nested synthetic API route; auth, control, manage,
  and PWA expect `2xx` HTML or a redirect from a committed shell page. Repeated
  `404 text/html` on those routes means stale route state. Dynamic detail
  pages are deliberately not probed because legitimate data misses also 404.
- Recovery policy: collect every app with the confirmed stale signature, clear
  exactly those apps' complete `.next`, restart only the exact managed
  process group once, recheck all contracts, then fail closed with the
  observed status and log path.
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
| Generalized readiness and repair | 3 | main | Slice 2, then contract tests plus exact DevPod proof for all five app contracts |

- Execution-tier skip reason: side-conversation policy prohibits subagents;
  process lifecycle and live proof are also coupled to one exact local runtime.

## Test Portfolio

| Consequential behavior | Existing evidence | Obligation | Primary seam | Distinct failure | Slice |
| --- | --- | --- | --- | --- | --- |
| Route/config/dependency drift changes managed runtime identity | Devrouter fingerprints command arguments, but no source identity exists | add new | shell contract test | a reused process misses structural repository changes | 1 |
| Persistent dependencies match the checked-out lockfile | `post-create` installs once | add new | shell contract test with a fake installer | branch or lockfile changes reuse stale `node_modules` | 1 |
| Normal restarts preserve production outputs but drop Next dev state | no automated protection | add new | temporary-filesystem shell test | `.next/dev` survives and poisons a new process | 1 |
| Confirmed stale Chat routing gets one scoped repair | manual cache move proved recovery | add new plus runtime proof | pure response classifier and exact DevPod | blanket cleanup, false classification, or repair loop | 2 |
| Shell-route classification distinguishes ready, stale, and unexpected | Chat classifier only | add new | pure response classifier | a shell page's error or JSON response is misclassified as stale or ready | 3 |
| Multi-app stale repair removes exactly the affected caches | single-app repair only | add new | shell contract test | a multi-app outage repairs one app, restarts repeatedly, or deletes unrelated caches | 3 |
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

## Slice 3: Generalized Readiness and Repair

- Problem: the Chat-only sentinel cannot observe stale route state in the other
  four Next apps, and one repair request can name only one app.
- Route: main.
- Do:
  - Replace the Chat-only probe, wait, and classify commands with per-app
    contracts: Chat keeps the nested API `401 application/json` contract;
    auth, control, manage, and PWA use committed shell pages that must answer
    `2xx` HTML or a redirect without database content.
  - Let one repair request carry several deduplicated apps and clear exactly
    the listed apps' `.next` in a single managed start.
  - Make `post-start` probe all five apps, collect the confirmed stale set,
    repair those apps together with one restart, and fail closed otherwise.
  - Generalize `dev:doctor`, the devcontainer README, getting-started
    guidance, and the data-driven-404 boundary.
- Check: shell syntax; focused contract tests inside the exact DevPod;
  `pnpm run build` in the DevPod; exact-worktree startup proving all five
  readiness contracts; runtime stop with zero routes; PR #5535 updated.
- Commit: `fix(dev): generalize runtime self-healing to all Next apps`.

## Progress

- Status: in progress. Slices 1 and 2 are locally committed and verified; the
  2026-08-25 scope correction added Slice 3, which is being implemented and
  verified now.
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
- Remaining: Slice 3 verification, push, and the PR #5535 description update.
- Required delivery layer: pushed branch with an updated ready PR.
- Achieved delivery layer: isolated, verified local branch with slices 1 and 2
  committed.
- Review limitation: required specialist roles are unavailable in this side
  conversation. The completed main-session review found no outstanding issue;
  no child review is claimed.
- Next action: verify Slice 3 in the exact DevPod, push the branch, and update
  PR #5535.
