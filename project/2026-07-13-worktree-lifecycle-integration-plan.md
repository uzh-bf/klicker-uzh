# Worktree Lifecycle Integration Plan

## Goal

- Make `v3` the reusable Klicker base for reliable agent worktree startup.
- Consume devrouter's fail-closed `workspace ensure` flow.
- Keep Klicker-specific environment and application commands local while Devrouter owns generic process lifecycle and route recovery.

## Non-goals

- No Escape Room feature changes.
- No manual container-network repair.
- No environment reset, worktree deletion, or volume deletion.
- No new application or package dependency.

## Identity

- Plan: `project/2026-07-13-worktree-lifecycle-integration-plan.md`
- Branch: `codex/worktree-lifecycle-hardening`
- Base: fresh `origin/v3` at `eef745d06`
- Target: `v3`
- Dependency: devrouter `0.0.30` (managed process helper plus the 0.0.29 worktree readiness recovery).

## Research

- Current docs require agents to keep a manual token synchronized across DevPod and route commands.
- Current `post-start.sh` accepts any existing `turbo run dev` process without proving its workspace/origin environment.
- Current Compose already passes `WORKSPACE` into the app container and labels active Compose files.
- Live incident produced mixed route tokens and a stale generic-origin Turbo supervisor.
- The first branch implementation proved the lifecycle behavior but left a generic supervisor and its regression suite inside Klicker. Devrouter 0.0.30 now packages that reusable responsibility.

## Decisions

- Require devrouter `0.0.30` in `.devrouter.yml` and extract only its process helper into the app image.
- Canonical command: `devrouter workspace ensure .` from an existing linked worktree; `workspace up` remains create-and-ensure.
- Klicker owns one `dev:container` script and its environment/origin setup; `post-start.sh` passes that command to `devrouter-process ensure`.
- The packaged helper owns locking, process-group proof, workspace/command fingerprints, bounded replacement, logs, and foreign-process refusal.
- Host-side `workspace ensure` owns HTTP readiness and the single container-recreate budget.
- Keep localhost fallback supported.

## Independent plan review

- Reviewer: collaboration review agent, 2026-07-13.
- Accepted: PID/PGID ownership, fingerprint readback, bounded group stop, and live marker proof.
- Boundary review: direct simplification pass, 2026-07-14. Generic supervision moved to Devrouter; only app-specific inputs remain in Klicker.

## Progress

- Current: Devrouter 0.0.30 cleanup, static checks, cold and warm worktree validation, browser smoke, and final review are complete.
- Next: keep draft PR #5169 open for CI and review; merge only with explicit approval.

## Slice 1: runtime ownership

- Do: extract small testable shell helper if needed; record PID/PGID/fingerprint; verify/restart only owned supervisor group.
- Test: first start, matching restart, workspace mismatch, origin mismatch, stale PID, foreign process, bounded stop failure.
- Check: shell syntax, focused tests, Prettier where applicable.
- Initial result, superseded by Slice 3: `post-start.sh` fingerprints the workspace, routed origins, and exact dev command. A small Linux helper serializes reconciliation with `flock`, proves the recorded session leader through PGID plus a `/proc` environment marker, requires every routed local endpoint to remain below 500 before reuse, waits on every non-zombie process-group member, escalates TERM to KILL boundedly, and refuses unknown Turbo processes. The devrouter overlay mounts the linked worktree's Git common directory at the same absolute container path.
- Evidence: Bash syntax and ShellCheck pass; disposable-container regression covers concurrent first start, exact reuse, unhealthy-runtime recovery, fingerprint restart, stale state, a TERM-ignoring child, and foreign-process refusal; Compose config resolves the exact same-path Git bind; Opengrep reports 0 findings.
- Commit: `fix(devcontainer): reconcile worktree runtime identity`

## Slice 2: canonical integration and docs

- Do: pin devrouter; replace manual-token instructions in AGENTS, devcontainer README, wiki, and environment-doctor; update wiki log.
- Check: doc searches find no recommended manual linked-worktree route flow; format/check-all proportional to docs/config changes.
- Result: devrouter `0.0.29` and `devrouter workspace ensure .` are canonical for existing linked worktrees. Unsupported primary-checkout proxy instructions were removed; the primary checkout remains the one-at-a-time localhost fallback.
- Evidence: Prettier and `git diff --check` pass; review found no remaining stale linked-worktree token-loop recommendation.
- Commit: `docs(devcontainer): standardize worktree ensure flow`

## Slice 3: centralize generic process lifecycle

- Do: release Devrouter 0.0.30; replace Klicker's supervisor with the packaged helper; move the app filter list into `pnpm run dev:container`; delete the local supervisor and regression test.
- Check: published-package readback, Docker build/extraction, Bash syntax, Compose resolution, root checks/build, cold and warm `workspace ensure`, exact Git/workspace identity, ten routes, and delegated browser login.
- Result: implementation complete. `.devcontainer/post-start.sh` now contains only Klicker environment/origin setup and one `devrouter-process ensure` call. The image extracts only the helper from the exact 0.0.30 tarball. `.devcontainer/dev-process.sh` and its local test are removed.
- Evidence: published 0.0.30 registry metadata and isolated CLI/helper entry points pass. The Klicker image builds and the extracted helper passes Devrouter's complete Linux lifecycle regression. Bash syntax, ShellCheck, Compose resolution, Prettier, `git diff --check`, `pnpm run check:all`, and the 21-task production build pass. The first build attempt failed only on sandbox DNS for `fonts.googleapis.com`; the network-enabled rerun passed.
- Commit: `refactor(devcontainer): delegate process lifecycle to devrouter`.

## Final review

- Maintainability: pass. The final boundary is one app-owned package script plus one helper call; 288 lines of generic supervisor and local regression code are removed. No new dependency, config schema, or oversized file remains.
- Security: no high-confidence finding. The image pins an immutable package version and extracts only its helper; startup uses constant argv; process ownership fails closed; Git metadata and database changes remain limited to the local devcontainer.
- Static analysis: Opengrep ran 93 applicable rules across the nine changed code/config surfaces with 0 findings.

## Final live gate: devrouter 0.0.30

- Cold reconcile: rebuilt the exact linked worktree app container as `486bce82e9cb`, extracted `/usr/local/bin/devrouter-process`, and started state `770 770 893406388-101`.
- Identity: `WORKSPACE` and `DEVROUTER_WORKSPACE` both equal `codex-worktree-lifecycle-hardeni`; in-container Git resolves the exact checkout at `/workspaces/klicker-uzh`.
- Runtime: one filtered Turbo task set runs all routed apps and both workers. The local state path is `/tmp/devrouter-process-klicker-dev.state`; no Klicker-owned supervisor script remains.
- Routing: API 404, Auth/PWA/Manage/Control/OLAT health/Response 200, LTI 401, and Chat 404. Devrouter also verified the PostgreSQL TCP route.
- Warm reconcile: preserved app container `486bce82e9cb` and state `770 770 893406388-101`.
- Browser: delegated lecturer login opened the same worktree-specific Manage host and rendered the seeded library. Captures: `/tmp/klicker-v030-before-login.png`, `/tmp/klicker-v030-after-login.png`, and `/tmp/klicker-v030-manage.png`.
- Browser warnings: the existing auth page reports a nested-button hydration error; initial unauthenticated GraphQL queries report `Unauthorized`; the Manage dev client logs an HMR message warning. These did not block login or rendering and are outside this devcontainer-only diff.

## Earlier live gate: devrouter 0.0.29

- Result: passed on 2026-07-14 with published `@devrouter/cli@0.0.29`.
- Worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/worktree-lifecycle-hardening` at fresh `origin/v3` base `eef745d06`.
- Identity: persisted DevPod/workspace ID `codex-worktree-lifecycle-hardeni`; final app container `e7b7e93d304cd787ca332440c2d9968d4cb1c9167cc29c093bc9bd5e460a1568`.
- Runtime: final state `649 649 3348913417-1223`; `WORKSPACE` and `DEVROUTER_WORKSPACE` both equal the persisted identity; in-container Git resolves `/workspaces/klicker-uzh`. One Turbo `dev` task set runs the routed apps and workers; no duplicate `dev:lti` tasks or `EADDRINUSE` failures remain.
- Routing: published `@devrouter/cli@0.0.29` verified nine HTTPS routes plus the PostgreSQL TCP route. After a Manage production build made its live route return HTTP 500, one automatic recreate restored all routes. The review-cleanup Compose change triggered one expected configuration recreate; a following warm repeat preserved app container `e7b7e93d304c` and owned process group `649`.
- Browser: `agent-browser` completed the delegated `lecturer` login from the routed manage host, returned to the same worktree-specific manage host, rendered the seeded library, and reported no page errors. Before/after captures: `/tmp/klicker-worktree-before-login.png` and `/tmp/klicker-worktree-after-login.png`.
- Database: all three local databases have their corresponding application role as owner; LTI starts its canonical `dev` task and listens on port 4000.
- Live-discovered corrections: tolerate Compose containers without a Docker healthcheck; propagate `DEVROUTER_WORKSPACE` through the overlay while inheriting base `WORKSPACE`; give LTI the canonical `dev` task so Turbo launches each package once; assign local database ownership during initialization; recover an owned Turbo group whose child apps became unhealthy after a production build replaced live Next.js output; classify a missing state fingerprint as malformed; require Devrouter's Git-common-dir value during Compose interpolation with an actionable error.
- Preserved: `trees/escape-room-production`, its dirty feature changes, and its existing DevPod/routes were not modified.
- Known unrelated issue: Hatchet heartbeat still logs `TypeError: this.logger[message.type] is not a function`. Startup, routing, Git identity, database initialization, and process reuse still pass; Hatchet SDK behavior remains feature/runtime follow-up scope.

## Verification

- Focused lifecycle test, Bash syntax, ShellCheck, merged Compose validation, Prettier, `git diff --check`, and Opengrep all pass; Opengrep found 0 findings. The lifecycle regression now covers a missing fingerprint, and Compose fails immediately with the `DEVROUTER_GIT_COMMON_DIR must be set by devrouter workspace ensure` message when that required value is absent.
- TypeScript checks pass serially for 31/31 tasks. A production-mode serial build passes 21/21 tasks.
- Root pre-commit checks and the pre-push production build pass; serial TypeScript and production build verification also pass for every task.
- Mandatory browser smoke passed delegated lecturer login, worktree-local redirect, seeded-library rendering, and browser error inspection.
- Published package validation passed `devrouter -V`, bundled upgrade prompt lookup, agent-artifact refresh, `workspace ensure`, exact worktree Git proof, ten-route ownership, expected non-5xx HTTP responses, and warm container/process reuse.
- Final maintainability and security reviews found no blocking issue after unhealthy-runtime recovery and devrouter's fail-closed container/route ownership checks.
- Wiki validator was unavailable; affected Markdown was formatted and checked directly.

## Branch status

- Eleven focused commits cover the plan, runtime identity, documentation, service and database startup, owned-runtime recovery, Devrouter 0.0.29 integration, and the Devrouter 0.0.30 simplification. `git log origin/v3..HEAD` is the commit-level source of truth.
