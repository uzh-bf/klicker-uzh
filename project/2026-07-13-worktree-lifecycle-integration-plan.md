# Worktree Lifecycle Integration Plan

## Goal

- Make `v3` the reusable Klicker base for reliable agent worktree startup.
- Consume devrouter's fail-closed `workspace ensure` flow.
- Restart dev processes only when their owned runtime identity is stale or their routed endpoints are unhealthy.

## Non-goals

- No Escape Room feature changes.
- No manual container-network repair.
- No environment reset, worktree deletion, or volume deletion.
- No new dependency.

## Identity

- Plan: `project/2026-07-13-worktree-lifecycle-integration-plan.md`
- Branch: `codex/worktree-lifecycle-hardening`
- Base: fresh `origin/v3` at `eef745d06`
- Target: `v3`
- Dependency: devrouter `0.0.26` lifecycle hardening.

## Research

- Current docs require agents to keep a manual token synchronized across DevPod and route commands.
- Current `post-start.sh` accepts any existing `turbo run dev` process without proving its workspace/origin environment.
- Current Compose already passes `WORKSPACE` into the app container and labels active Compose files.
- Live incident produced mixed route tokens and a stale generic-origin Turbo supervisor.

## Decisions

- Require devrouter `0.0.26` in `.devrouter.yml`.
- Canonical command: `devrouter workspace ensure .` from an existing linked worktree; `workspace up` remains create-and-ensure.
- `post-start.sh` owns one detached process group and a runtime fingerprint containing workspace plus public origins.
- Matching process group/fingerprint stays running while every routed local endpoint is below 500; mismatch or degraded health terminates the owned group, waits boundedly, then restarts.
- Missing/foreign ownership fails safely instead of killing unknown processes.
- Keep localhost fallback supported.

## Independent plan review

- Reviewer: collaboration review agent, 2026-07-13.
- Accepted: PID/PGID ownership, fingerprint readback, bounded group stop, and live marker proof.

## Progress

- Current: implementation, clean-worktree live gate, browser smoke, and final review complete locally.
- Next: approval-gated push/release of devrouter `0.0.26`, then push this branch and open a draft PR to `v3`.

## Slice 1: runtime ownership

- Do: extract small testable shell helper if needed; record PID/PGID/fingerprint; verify/restart only owned supervisor group.
- Test: first start, matching restart, workspace mismatch, origin mismatch, stale PID, foreign process, bounded stop failure.
- Check: shell syntax, focused tests, Prettier where applicable.
- Result: `post-start.sh` fingerprints the workspace, routed origins, and exact dev command. A small Linux helper serializes reconciliation with `flock`, proves the recorded session leader through PGID plus a `/proc` environment marker, requires every routed local endpoint to remain below 500 before reuse, waits on every non-zombie process-group member, escalates TERM to KILL boundedly, and refuses unknown Turbo processes. The devrouter overlay mounts the linked worktree's Git common directory at the same absolute container path.
- Evidence: Bash syntax and ShellCheck pass; disposable-container regression covers concurrent first start, exact reuse, unhealthy-runtime recovery, fingerprint restart, stale state, a TERM-ignoring child, and foreign-process refusal; Compose config resolves the exact same-path Git bind; Opengrep reports 0 findings.
- Commit: `fix(devcontainer): reconcile worktree runtime identity`

## Slice 2: canonical integration and docs

- Do: pin devrouter; replace manual-token instructions in AGENTS, devcontainer README, wiki, and environment-doctor; update wiki log.
- Check: doc searches find no recommended manual linked-worktree route flow; format/check-all proportional to docs/config changes.
- Result: devrouter `0.0.26` and `devrouter workspace ensure .` are canonical for existing linked worktrees. Unsupported primary-checkout proxy instructions were removed; the primary checkout remains the one-at-a-time localhost fallback.
- Evidence: Prettier and `git diff --check` pass; review found no remaining stale linked-worktree token-loop recommendation.
- Commit: `docs(devcontainer): standardize worktree ensure flow`

## Live gate

- Result: passed on 2026-07-13 with the locally installed devrouter `0.0.26` build.
- Worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/worktree-lifecycle-hardening` at fresh `origin/v3` base `eef745d06`.
- Identity: persisted DevPod/workspace ID `codex-worktree-lifecycle-hardeni`; app container `8d80516f34cecfe6d6a547c003c274cb5a43a91702cc96b73a919e65dbd5e051`, created `2026-07-13T19:47:10.356354699Z`.
- Runtime: final state `18116 18116 3739114626-1231`; `WORKSPACE` and `DEVROUTER_WORKSPACE` both equal the persisted identity; in-container Git resolves `/workspaces/klicker-uzh`.
- Routing: `devrouter workspace ensure .` published and verified nine HTTPS routes plus the PostgreSQL TCP route. A warm ensure completed in under five seconds and preserved both the app container and owned process group.
- Browser: `agent-browser` completed the delegated `lecturer` login from the routed manage host, returned to the same worktree-specific manage host, rendered the seeded library, and reported no page errors. Before/after captures: `/tmp/klicker-worktree-before-login.png` and `/tmp/klicker-worktree-after-login.png`.
- Database: all three local databases have their corresponding application role as owner; LTI starts its native `dev:lti` task and listens on port 4000.
- Live-discovered corrections: tolerate Compose containers without a Docker healthcheck; explicitly propagate both identity variables through the overlay; include `dev:lti` in the owned Turbo command; assign local database ownership during initialization; recover an owned Turbo group whose child apps became unhealthy after a production build replaced live Next.js output.
- Preserved: `trees/escape-room-production`, its dirty feature changes, and its existing DevPod/routes were not modified.
- Known unrelated issue: Hatchet heartbeat still logs `TypeError: this.logger[message.type] is not a function`. Startup, routing, Git identity, database initialization, and process reuse still pass; Hatchet SDK behavior remains feature/runtime follow-up scope.

## Verification

- Focused lifecycle test, Bash syntax, ShellCheck, merged Compose validation, Prettier, `git diff --check`, and Opengrep all pass; Opengrep found 0 findings.
- TypeScript checks pass serially for 31/31 tasks. A production-mode serial build passes 21/21 tasks.
- Root `pnpm run check:all` remains blocked by baseline devcontainer/tooling gaps: analytics cannot find `uv`, and chat cannot resolve `eslint-plugin-react-hooks`; the parallel runner then cancels remaining tasks.
- Mandatory browser smoke passed delegated lecturer login, worktree-local redirect, seeded-library rendering, and browser error inspection.
- Final maintainability and security reviews found no blocking issue after unhealthy-runtime recovery and devrouter's fail-closed container/route ownership checks.
- Wiki validator was unavailable; affected Markdown was formatted and checked directly.

## Local commits

- `f96f5ae2` `docs(project): add worktree lifecycle integration plan`
- `018f473b0` `fix(devcontainer): reconcile worktree runtime identity`
- `dde478177` `docs(devcontainer): standardize worktree ensure flow`
- `6c7359cc9` `fix(devcontainer): expose Devrouter workspace identity`
- `7b732711c` `fix(devcontainer): start LTI task in workspace stack`
- `dccda325e` `fix(devcontainer): assign local database owners`
- `fix(devcontainer): recover unhealthy owned runtime` (this final local commit)
