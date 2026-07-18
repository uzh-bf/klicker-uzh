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
- Original base: fresh `origin/v3` at `eef745d06`; synchronize current `v3` before the reopened migration slices.
- Target: `v3`
- Dependency: released devrouter `0.0.34` managed-adapter contract; validate the final safety gate with the `0.0.35` release-candidate branch from `project/2026-07-18-workspace-safety-hardening-plan.md`, then require a released/pinned `0.0.35` before this PR or Escape Room can proceed.

## Research

- Current docs require agents to keep a manual token synchronized across DevPod and route commands.
- Current `post-start.sh` accepts any existing `turbo run dev` process without proving its workspace/origin environment.
- Current Compose already passes `WORKSPACE` into the app container and labels active Compose files.
- Live incident produced mixed route tokens and a stale generic-origin Turbo supervisor.
- The first branch implementation proved the lifecycle behavior but left a generic supervisor and its regression suite inside Klicker. Devrouter 0.0.30 now packages that reusable responsibility.

## Original decisions for the completed 0.0.30 phase

These decisions and the matching evidence below are historical. The reopened decisions after Slice 3 supersede them for current implementation.

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

- Current: current `origin/v3` (`393a1fffb`) is merged at `d817f84c0`. Slice 4 is implemented, independently reviewed, simplified, and green: it consumes the released `0.0.34` managed-adapter contract, starts both checkout kinds with `devrouter ensure .`, and gives the self-contained container the same pinned uv/Python line as analytics CI. Review confirmed that `0.0.34` ignores the declared origin allowlist; the stronger identity contract remains a release blocker, not a completed consumer claim.
- Next: stage the exact Slice 4 files, run data hygiene, and commit before the cold/warm `0.0.35` branch-built safety proof. Keep draft PR #5169 open; merge only with explicit approval.

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

## Reopened decisions after devrouter PR #24

- `.devrouter.yml` is the only consumer-side devrouter version pin.
- The Dockerfile keeps `procps` and `util-linux` for the runtime-delivered helper, but removes package download/extraction and `tar` when otherwise unused.
- `devcontainer.json` does not declare `postStartCommand`; host-side `devrouter ensure` proves the exact container, delivers the helper, and invokes the managed adapter.
- `.devcontainer/post-start.sh` contains the `devrouter:managed devcontainer` marker, requires `DEVROUTER_PROCESS_HELPER`, prepares only Klicker-owned environment/origin inputs, and calls `"$DEVROUTER_PROCESS_HELPER" ensure`.
- The adapter sets `DEVROUTER_PROCESS_FINGERPRINT_ENV` to this exact comma-separated non-secret runtime-origin allowlist: `APP_ORIGIN_API,APP_ORIGIN_AUTH,APP_ORIGIN_PWA,APP_ORIGIN_MANAGE,APP_ORIGIN_CONTROL,APP_ORIGIN_ASSESSMENT_API,APP_ORIGIN_ASSESSMENT_PWA,APP_ORIGIN_LTI,APP_ORIGIN_CHAT,APP_MANAGE_SUBDOMAIN,APP_STUDENT_SUBDOMAIN,APP_CONTROL_SUBDOMAIN,NEXTAUTH_URL,COOKIE_DOMAIN,NEXT_PUBLIC_API_URL,NEXT_PUBLIC_AUTH_URL,NEXT_PUBLIC_MANAGE_URL,NEXT_PUBLIC_PWA_URL,NEXT_PUBLIC_ASSESSMENT_URL,NEXT_PUBLIC_CONTROL_URL,NEXT_PUBLIC_ADD_RESPONSE_URL,NEXT_PUBLIC_CHAT_URL,CORS_ALLOWED_ORIGINS,AUTH_LECTURER_ALLOWED_HOSTS,AUTH_STUDENT_ALLOWED_HOSTS,NODE_EXTRA_CA_CERTS`.
- Released `0.0.34` ignores `DEVROUTER_PROCESS_FINGERPRINT_ENV`; it is declared now as a forward-compatible adapter input, but only the `0.0.35` candidate hashes the adapter and allowlisted values. Do not mark the PR ready or resume Escape Room until `0.0.35` is released, pinned, and reverified.
- Documentation, AGENTS guidance, the environment-doctor skill, and wiki use one checkout-agnostic command: `devrouter ensure .`. Manual `WORKSPACE`, direct `devpod up`, and per-app route loops are migration history, not current instructions.
- Add `project/_local/` to `.gitignore` so future goal checkpoints and handoffs stay repository-local without becoming public artifacts.
- Use released `0.0.34` for the committed consumer migration. Exercise the devrouter `0.0.35` branch-built CLI for the safety proof; do not pin or publish an unreleased package.
- Keep the self-contained container capable of running the repository-wide gate: copy the existing `uv 0.11.12` binary used by the analytics image and select Python 3.12 like CI. This is development toolchain parity, not a new application dependency.

## Independent review of the reopened plan

- Reviewers: two independent collaboration agents, 2026-07-18.
- Accepted: make the historical `0.0.30` decisions/evidence explicit; use the released `0.0.34` contract before branch-built `0.0.35` proof; pin every proof command to one exact executable and source SHA; declare the exact non-secret origin fingerprint allowlist; keep release, merge, Escape Room, and live-resource boundaries explicit.
- Result: go for implementation after the upstream safety-plan revisions.

## Slice 4: adopt the runtime-delivered managed helper contract

- Do: merge current `v3`; update `.devrouter.yml`; remove helper extraction and automatic post-start wiring; migrate the adapter marker/helper invocation; add the local-checkpoint ignore.
- Do: update AGENTS, `.devcontainer/README.md`, environment wiki, environment-doctor skill, and wiki changelog so `devrouter ensure .` is canonical and no manual-token route flow is recommended.
- Check: devrouter static verification and doctor, Compose resolution, Bash syntax/ShellCheck, Prettier, `git diff --check`, focused repo checks, review, simplification, rerun, progress update, and commit.
- Result: merged current `v3`; removed image-installed devrouter and independent `postStartCommand`; added the managed marker, runtime-delivered helper requirement, and exact comma-separated origin fingerprint allowlist; made the primary overlay satisfy the same devnet alias/TLS contract; updated the repository guidance, wiki, and skills to one `devrouter ensure .` lifecycle. The image now includes the existing pinned uv tool and Python 3.12 selection required by the root lint gate. Shared Compose routing/trust wiring lives in the base; overlays contain only checkout-specific aliases, ports, namespaced hosts, and the linked Git bind.
- Evidence: branch-built devrouter `96c8df5e71e2` reports 5/5 static devcontainer checks passing and doctor has 0 errors; primary and linked Compose configs resolve with exact aliases, CA trust, and Git bind; Bash syntax, ShellCheck, Prettier, and `git diff --check` pass. A cold linked-worktree creation completed install, build, database setup, and seeding; a warm exact reconcile reused the managed process. Applying the Dockerfile toolchain correction required one explicit delete/recreate of only this plan-targeted DevPod; no Git worktree or other environment was touched. The post-review root `check:all` gate passes inside the exact DevPod. Correctness review caught and removed premature `0.0.34` origin-fingerprint claims plus stale port-free primary claims; simplification centralized Compose wiring and corrected lifecycle commands. Both independent reviewers returned READY; the `0.0.35` release dependency is explicit.
- Commit: `refactor(devcontainer): adopt runtime-delivered devrouter helper`.

## Slice 5: prove cold, warm, routed, and browser identity

- Do: build and record the source SHA/version of `node /Users/rschlae/Git/personal/devrouter/trees/workspace-safety-hardening/dist/devrouter.js`, then use that exact executable for every `ensure`, inspection, cold, and warm command against this exact checkout without changing or cleaning the Escape Room worktree.
- Do: cold reconcile, then warm reconcile; prove the same exact DevPod id/source path, app container, in-container Git path, workspace env, process fingerprint/reuse, and complete route ownership.
- Do: exercise all HTTP/TCP routes and delegated lecturer login on the worktree-specific Manage host with browser evidence.
- Check: full risk-appropriate Klicker static/build suite, code-level security review, independent branch review, strict maintainability review, and whole-branch PR #5169 description/readback.
- Commit: docs-only progress/evidence update if live proof changes the plan after the implementation commit.
- Stop: keep PR #5169 draft and report any upstream release dependency; no merge without explicit authority.

## Historical final review for 0.0.30

- Maintainability: pass. The final boundary is one app-owned package script plus one helper call; 288 lines of generic supervisor and local regression code are removed. No new dependency, config schema, or oversized file remains.
- Security: no high-confidence finding. The image pins an immutable package version and extracts only its helper; startup uses constant argv; process ownership fails closed; Git metadata and database changes remain limited to the local devcontainer.
- Static analysis: Opengrep ran 93 applicable rules across the nine changed code/config surfaces with 0 findings.

## Historical final live gate: devrouter 0.0.30

- Cold reconcile: rebuilt the exact linked worktree app container as `486bce82e9cb`, extracted `/usr/local/bin/devrouter-process`, and started state `770 770 893406388-101`.
- Identity: `WORKSPACE` and `DEVROUTER_WORKSPACE` both equal `codex-worktree-lifecycle-hardeni`; in-container Git resolves the exact checkout at `/workspaces/klicker-uzh`.
- Runtime: one filtered Turbo task set runs all routed apps and both workers. The local state path is `/tmp/devrouter-process-klicker-dev.state`; no Klicker-owned supervisor script remains.
- Routing: API 404, Auth/PWA/Manage/Control/OLAT health/Response 200, LTI 401, and Chat 404. Devrouter also verified the PostgreSQL TCP route.
- Warm reconcile: preserved app container `486bce82e9cb` and state `770 770 893406388-101`.
- Browser: delegated lecturer login opened the same worktree-specific Manage host and rendered the seeded library. Captures: `/tmp/klicker-v030-before-login.png`, `/tmp/klicker-v030-after-login.png`, and `/tmp/klicker-v030-manage.png`.
- Browser warnings: the existing auth page reports a nested-button hydration error; initial unauthenticated GraphQL queries report `Unauthorized`; the Manage dev client logs an HMR message warning. These did not block login or rendering and are outside this devcontainer-only diff.

## Historical earlier live gate: devrouter 0.0.29

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

## Historical verification through devrouter 0.0.30

- Focused lifecycle test, Bash syntax, ShellCheck, merged Compose validation, Prettier, `git diff --check`, and Opengrep all pass; Opengrep found 0 findings. The lifecycle regression now covers a missing fingerprint, and Compose fails immediately with the `DEVROUTER_GIT_COMMON_DIR must be set by devrouter workspace ensure` message when that required value is absent.
- TypeScript checks pass serially for 31/31 tasks. A production-mode serial build passes 21/21 tasks.
- Root pre-commit checks and the pre-push production build pass; serial TypeScript and production build verification also pass for every task.
- Mandatory browser smoke passed delegated lecturer login, worktree-local redirect, seeded-library rendering, and browser error inspection.
- Published package validation passed `devrouter -V`, bundled upgrade prompt lookup, agent-artifact refresh, `workspace ensure`, exact worktree Git proof, ten-route ownership, expected non-5xx HTTP responses, and warm container/process reuse.
- Final maintainability and security reviews found no blocking issue after unhealthy-runtime recovery and devrouter's fail-closed container/route ownership checks.
- Wiki validator was unavailable; affected Markdown was formatted and checked directly.

## Branch status

- Eleven focused commits cover the plan, runtime identity, documentation, service and database startup, owned-runtime recovery, Devrouter 0.0.29 integration, and the Devrouter 0.0.30 simplification. `git log origin/v3..HEAD` is the commit-level source of truth.
