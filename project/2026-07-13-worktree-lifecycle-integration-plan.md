# Worktree Lifecycle Integration Plan

## Goal

- Make `v3` the reusable Klicker base for reliable agent worktree startup.
- Consume devrouter's fail-closed `workspace ensure` flow.
- Restart dev processes only when their owned runtime identity is stale.

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
- Matching process group/fingerprint stays running; mismatch terminates owned group, waits boundedly, then restarts.
- Missing/foreign ownership fails safely instead of killing unknown processes.
- Keep localhost fallback supported.

## Independent plan review

- Reviewer: collaboration review agent, 2026-07-13.
- Accepted: PID/PGID ownership, fingerprint readback, bounded group stop, and live marker proof.

## Progress

- Current: Slice 1 committed locally; Devrouter dependency complete at `0713383`; Slice 2 ready for commit.
- Next: run the live gate, record evidence, then complete final review.

## Slice 1: runtime ownership

- Do: extract small testable shell helper if needed; record PID/PGID/fingerprint; verify/restart only owned supervisor group.
- Test: first start, matching restart, workspace mismatch, origin mismatch, stale PID, foreign process, bounded stop failure.
- Check: shell syntax, focused tests, Prettier where applicable.
- Result: `post-start.sh` fingerprints the workspace, routed origins, and exact dev command. A small Linux helper serializes reconciliation with `flock`, proves the recorded session leader through PGID plus a `/proc` environment marker, waits on every non-zombie process-group member, escalates TERM to KILL boundedly, and refuses unknown Turbo processes. The devrouter overlay mounts the linked worktree's Git common directory at the same absolute container path.
- Evidence: Bash syntax and ShellCheck pass; disposable-container regression covers concurrent first start, exact reuse, fingerprint restart, stale state, a TERM-ignoring child, and foreign-process refusal; Compose config resolves the exact same-path Git bind; Opengrep reports 0 findings.
- Commit: `fix(devcontainer): reconcile worktree runtime identity`

## Slice 2: canonical integration and docs

- Do: pin devrouter; replace manual-token instructions in AGENTS, devcontainer README, wiki, and environment-doctor; update wiki log.
- Check: doc searches find no recommended manual linked-worktree route flow; format/check-all proportional to docs/config changes.
- Result: devrouter `0.0.26` and `devrouter workspace ensure .` are canonical for existing linked worktrees. Unsupported primary-checkout proxy instructions were removed; the primary checkout remains the one-at-a-time localhost fallback.
- Evidence: Prettier and `git diff --check` pass; review found no remaining stale linked-worktree token-loop recommendation.
- Commit: `docs(devcontainer): standardize worktree ensure flow`

## Live gate

- Install local devrouter build.
- Preserve `trees/escape-room-production` and its current DevPod unchanged because the feature branch does not yet contain this contract.
- Run `devrouter workspace ensure .` against this clean latest-`origin/v3` integration worktree.
- Require identity/overlay/alias/route/database proof before agent-browser login.
- Capture live proof in this plan. Escape Room work resumes only after gate passes.
