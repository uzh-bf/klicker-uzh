# Worktree Lifecycle Integration Plan

## Goal

- Make `v3` the reusable Klicker base for reliable agent worktree startup.
- Consume devrouter's fail-closed `devrouter ensure .` flow.
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
- Dependency: released Devrouter `v0.0.35`, satisfied and reverified in Slice 6.

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

- Current: Slice 6 implementation, released-artifact verification, final security review, same-provider branch crosscheck, strict maintainability review, and synchronization with current `v3` are complete in this worktree against [PR #5169](https://github.com/uzh-bf/klicker-uzh/pull/5169).
- Next: resolve final review feedback, pass refreshed CI and independent approval, then let the armed squash auto-merge complete under the user's explicit authority. Escape Room remains untouched until this passes.

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

## Reopened decisions after devrouter [PR #24](https://github.com/rschlaefli/devrouter/pull/24)

- `.devrouter.yml` is the only consumer-side devrouter version pin.
- The Dockerfile keeps `procps` and `util-linux` for the runtime-delivered helper, but removes package download/extraction and `tar` when otherwise unused.
- `devcontainer.json` does not declare `postStartCommand`; host-side `devrouter ensure` proves the exact container, delivers the helper, and invokes the managed adapter.
- `.devcontainer/post-start.sh` contains the `devrouter:managed devcontainer` marker, requires `DEVROUTER_PROCESS_HELPER`, prepares only Klicker-owned environment/origin inputs, and calls `"$DEVROUTER_PROCESS_HELPER" ensure`.
- The adapter sets `DEVROUTER_PROCESS_FINGERPRINT_ENV` to this exact comma-separated non-secret runtime-origin allowlist: `APP_ORIGIN_API,APP_ORIGIN_AUTH,APP_ORIGIN_PWA,APP_ORIGIN_MANAGE,APP_ORIGIN_CONTROL,APP_ORIGIN_ASSESSMENT_API,APP_ORIGIN_ASSESSMENT_PWA,APP_ORIGIN_LTI,APP_ORIGIN_CHAT,APP_MANAGE_SUBDOMAIN,APP_STUDENT_SUBDOMAIN,APP_CONTROL_SUBDOMAIN,NEXTAUTH_URL,COOKIE_DOMAIN,NEXT_PUBLIC_API_URL,NEXT_PUBLIC_AUTH_URL,NEXT_PUBLIC_MANAGE_URL,NEXT_PUBLIC_PWA_URL,NEXT_PUBLIC_ASSESSMENT_URL,NEXT_PUBLIC_CONTROL_URL,NEXT_PUBLIC_ADD_RESPONSE_URL,NEXT_PUBLIC_CHAT_URL,CORS_ALLOWED_ORIGINS,AUTH_LECTURER_ALLOWED_HOSTS,AUTH_STUDENT_ALLOWED_HOSTS,NODE_EXTRA_CA_CERTS`.
- Released `0.0.34` ignored `DEVROUTER_PROCESS_FINGERPRINT_ENV`; `0.0.35` hashes the adapter and allowlisted values. Do not mark the PR ready or resume Escape Room until the released artifact is pinned and reverified.
- Documentation, AGENTS guidance, the environment-doctor skill, and wiki use one checkout-agnostic command: `devrouter ensure .`. Manual `WORKSPACE`, direct `devpod up`, and per-app route loops are migration history, not current instructions.
- Add `project/_local/` to `.gitignore` so future goal checkpoints and handoffs stay repository-local without becoming public artifacts.
- Before `0.0.35` publication, keep the consumer migration on released `0.0.34` and use the branch-built candidate only for safety proof. Slice 6 owns the released pin and repeat proof.
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
- Check: full risk-appropriate Klicker static/build suite, code-level security review, independent branch review, strict maintainability review, and whole-branch [PR #5169](https://github.com/uzh-bf/klicker-uzh/pull/5169) description/readback.
- Commit: docs-only progress/evidence update if live proof changes the plan after the implementation commit.
- Stop: keep [PR #5169](https://github.com/uzh-bf/klicker-uzh/pull/5169) draft and report any upstream release dependency; no merge without explicit authority.

### Slice 5 live evidence

- Exact sources: Klicker commit `277ae692f7fe222a6c7740dc124ec07e3acc80f6`; branch-built devrouter source `0a7b11c9b3ced2b5f5fcccef7b31f44f44c31572`; exact executable `/Users/rschlae/Git/personal/devrouter/trees/workspace-safety-hardening/dist/devrouter.js`, reporting `0.0.35`. The committed consumer pin is still the released `0.0.34`.
- Cold start: `devrouter stop . --delete --json` deleted only the plan-targeted DevPod `codex-worktree-lifecycle-hardeni` and freed its ten routes. The following exact `ensure . --json` rebuilt the image, installed dependencies, built packages, initialized and seeded the databases, delivered the managed helper, started the app process, and registered nine HTTPS routes plus PostgreSQL.
- Cold identity: durable workspace/DevPod id `codex-worktree-lifecycle-hardeni`; source path `/Users/rschlae/Git/klicker/klicker-uzh/trees/worktree-lifecycle-hardening`; container hostname `ba0dcedccc4a`; in-container path `/workspaces/klicker-uzh`; in-container Git SHA `277ae692f7fe222a6c7740dc124ec07e3acc80f6`; `WORKSPACE` and `DEVROUTER_WORKSPACE` both equal the durable id. The container has `uv 0.11.12` and `UV_PYTHON=3.12`.
- Managed process: state `/tmp/devrouter-process-klicker-dev.state` contained PID/PGID `1239/1239` and fingerprint `59f58493d79fbcebcb571fd116990c5cf3b6a4d9965a74fccf38fde53fdc625f`; the process was `node /usr/local/bin/pnpm run dev:container`.
- Warm reuse: the following exact `ensure . --json` reported that `klicker-dev` already matched PID 1239 and returned `recreated: false`. Container hostname, Git SHA, PID/PGID, and fingerprint all remained byte-for-byte identical.
- Routes: API GraphQL GET returned 403, Auth/PWA/Manage/Control returned 200, OLAT `/health` returned 200, Response `/healthz` returned 200, LTI `/info` returned 401, and Chat `/` returned 404. All are application-level responses rather than router/upstream failures. PostgreSQL 18 `pg_isready` with direct SSL/SNI reported the namespaced `db` route accepting connections. Devrouter reported ten owned routes and no duplicate hosts.
- Browser: `agent-browser` accepted the terms gate, completed delegated lecturer authentication on the namespaced Auth host, followed `Open Application` back to the same namespaced Manage host, and rendered the seeded lecturer library. Desktop and mobile captures are repository-local ignored artifacts under `project/_local/evidence/workspace-hardening/`; the final recovered desktop capture also proves the session remained authenticated after runtime recovery. Existing auth hydration, initial unauthenticated GraphQL, image, and HMR console warnings are outside this infrastructure-only diff; browser page errors were empty.
- Checks: `pnpm run check:all` passed in the exact cold-created DevPod (23/23 type-check tasks plus lint, format, Syncpack, AGENTS, and Prisma synchronization). A first raw `pnpm run build` inherited the devcontainer's intentional `NODE_ENV=development` and failed Auth prerender with `NextRouter was not mounted`; the diagnosis was confirmed by environment readback. `env NODE_ENV=production pnpm run build` then passed all 21 production build tasks. Final branch review treated the documented raw-build failure as a verification-path blocker: the root `build` script now uses the repository's pinned `cross-env` to force production mode for all callers, including the pre-push hook and devcontainer workflow.
- Post-build recovery: running production Next builds beside the live dev tasks replaced `.next` output and temporarily made Auth/PWA/Manage/Control return 500 while API remained healthy. The managed parent later exited; after interrupting the long readiness wait, a new exact `ensure` preserved the durable workspace/DevPod id, started state PID/PGID `904/904` with the same fingerprint, and restored every HTTP/TCP route. The underlying app container hostname changed to `edd21dbf310b`; this recovery proves durable workspace identity and route recovery across a container change. Exact-container reuse is the separate cold-to-warm result above.
- Root-build correction proof: the exact DevPod reported `NODE_ENV=development`, while a raw `pnpm run build` visibly invoked `cross-env NODE_ENV=production turbo run build` and passed 21/21 tasks. A following `pnpm run check:all` passed 23/23 type-check tasks plus lint, format, Syncpack, AGENTS, and Prisma synchronization.
- Correction recovery proof: the following exact branch-built devrouter `ensure . --json` first tried the owned PID 904, then spent its one recreate budget when the production build had disturbed live Next output. It restored the same durable workspace/DevPod id in container `d2d39deb220e`, started PID/PGID `803/803` with the unchanged fingerprint, and returned `recreated: true`. Fresh route probes returned API 404, Auth/PWA/Manage/Control 200, OLAT health 200, Response health 200, LTI 401, and Chat 404.
- Correction review: separate correctness review returned READY after checking `cross-env`, Turbo environment propagation, the test-build boundary, pre-push behavior, wiki coverage, the exact process state, and live routes. Simplification review accepted the one-line implementation and requested only narrower README wording plus chronological plan evidence; both documentation corrections are integrated. Targeted Prettier and `git diff --check` pass.
- Final security review: no high-confidence vulnerability. The helper path and same-path Git mount are supplied by the host-side devrouter process for a local development container, both fail closed when absent, and the branch changes no production authorization or private-data path. The unreleased adapter/origin fingerprinting is treated as a readiness blocker, not as completed protection.
- Final whole-branch review: no code, lifecycle, copy-integrity, transaction, authorization, i18n, or leftover defect after the root-build correction. Its two documentation findings were stale plan status and the `post-start.sh` "core apps" comment; both are corrected in this checkpoint. The external GLM crosscheck could not complete because Droid aborted during MCP reload, so the independent collaboration review and direct repository verification are the recorded fallback rather than a claimed second-model result.
- Final maintainability review: READY with no blocking or non-blocking finding. The branch keeps generic ownership/recovery in Devrouter, app-specific inputs in Klicker, shared Compose wiring in the base, and checkout-specific differences in overlays. No new helper duplication or oversized code surface remains.
- Boundary: the branch-built proof validates the `0.0.35` candidate, but this PR cannot be ready and Escape Room cannot resume until that version is released, pinned in `.devrouter.yml`, and the cold/warm identity proof is repeated against the released artifact.

## Slice 6: pin and prove the released safety contract

- Do: pin `.devrouter.yml` and current setup guidance to released `0.0.35`; update the environment skill, wiki timestamp/log, and this progress record without rewriting historical evidence.
- Do: use one exact released `@devrouter/cli@0.0.35` executable for cold and warm reconciliation of only this worktree. Prove exact source/workspace/container/Git/process identity, origin fingerprinting, ten owned routes, PostgreSQL, and delegated lecturer login at desktop and mobile sizes.
- Check: static devcontainer verification and doctor; Compose, Bash, ShellCheck, wiki validation, Prettier, `check:all`, root build, targeted live probes, browser evidence, security review, independent branch review, strict maintainability review, PR feedback, and GitHub CI.
- Commit: `chore(devcontainer): pin devrouter 0.0.35`.
- Stop: do not resume or mutate the Escape Room worktree until [PR #5169](https://github.com/uzh-bf/klicker-uzh/pull/5169) is merged into `v3`.

### Slice 6 live evidence

- Released artifact: Devrouter `v0.0.35` targets `57e9749b86e8afeb41f850bd7fdbbeb99826880c`; release workflow run `29654758160` passed its check and publish jobs. npm readback returned `@devrouter/cli@0.0.35` with integrity `sha512-G+D097f5KzYPBLe7lS3Ci6BjBrcqmwl7HVeF8PXlEwbHgeWupnNJj/EUgCdpPweXGZ0faH3yIE9ovFR3ebfMXA==`. Every live command used `/opt/homebrew/lib/node_modules/@devrouter/cli/dist/devrouter.js`, whose SHA-256 is `814c8a65828b33e5b7d506039db77c3fb4a4d84c934d5456c9b9d24f067ce756`; `-V` reports installed and repository version `0.0.35` with no upgrade target.
- Static contract: `repo devcontainer verify --repo . --json` returned 5 ok, 0 warnings, and 0 errors across ten proxy applications. `doctor --repo . --json` returned 23 ok, 3 known overlay/runtime warnings, and 0 errors. Primary and linked Compose configs resolve; Bash syntax, targeted Prettier, `git diff --check`, and ShellCheck pass. The raw ShellCheck findings `SC1091` and `SC2034` are unchanged on `origin/v3`; excluding those two baseline warnings returns clean. Opengrep scanned 3,032 tracked files with 676 rules; all 610 reported findings are outside the 19 changed branch paths.
- Cold ownership and identity: the preflight ledger bound only workspace/DevPod `codex-worktree-lifecycle-hardeni` and its ten routes to this exact checkout. `stop . --delete --json` deleted only that DevPod and freed its ten routes. The following released `ensure . --json` rebuilt, installed, built, initialized, seeded, started PID/PGID `1234/1234`, and registered all routes. Container `d260e9ef798f` resolved `/workspaces/klicker-uzh` at Git SHA `58590e974e90bf035ece82010d25f4c868cad33f`; both workspace variables matched the durable id. The state fingerprint was `a8d4cf46f94139225b13d3e9e0d2491fe7de3736107fd6e3c74a3aebee47b8f3`, with `uv 0.11.12` and `UV_PYTHON=3.12`.
- Warm reuse: the immediate released `ensure` returned `recreated: false`; container, Git SHA, PID/PGID, and fingerprint remained byte-for-byte identical.
- Routes and database: API `/` returned 404; Auth, PWA, Manage, and Control returned 200; OLAT `/health` and Response `/healthz` returned 200; LTI `/info` returned 401; Chat `/` returned 404. PostgreSQL connected through `db.klicker.codex-worktree-lifecycle-hardeni.localhost:5432` with direct negotiation, TLS 1.3, and `postgresql` ALPN.
- Browser: `npx agent-browser` accepted the terms gate, completed delegated lecturer authentication on the namespaced Auth host, and returned to the same namespaced Manage host. The seeded library rendered at 1440x1000 and 390x844; captures are ignored local artifacts under `project/_local/evidence/workspace-hardening-release/`. Page errors were empty. Existing development-only unauthenticated GraphQL, nested-button hydration, image, and HMR console warnings remain outside this infrastructure-only diff.
- Repository gates: `pnpm run check:all` passed in the exact DevPod, including all 23 type-check tasks plus lint, format, Syncpack, AGENTS, and Prisma synchronization. `pnpm run build` passed all 21 production build tasks with existing warnings only. As expected, the production build disturbed live Next output; the following released `ensure` spent its recreate budget, restored the same durable workspace in container `24f60debc150`, started PID/PGID `806/806` with the unchanged fingerprint, and returned `recreated: true`. Every route passed again, and the next ensure reused that recovered runtime with `recreated: false`.
- Wiki validation: the documented Python validator could not run because PyYAML is not installed and the skill forbids installing it without approval. A temporary Node validator using the repository's pinned `yaml@2.6.1` checked the OKF core plus repository profile fields and passed all 14 applicable Markdown files; `docs/solutions/` remains under its separate `rs-compound` schema.
- Review: simplification removed premature proof wording and repeated release evidence. Correctness review found one workflow-format issue, bare PR references in touched plan progress, and all such references are now clickable links. Final security review found no high-confidence vulnerability. A same-provider branch crosscheck validated the lifecycle, configuration-safety, review-lens, and maintainability conclusions; its only correction broadens the database-owner scope from devcontainer-only to fresh local and test PostgreSQL initialization. A different-model crosscheck remains unavailable: Droid aborted during MCP reload, and the approval reviewer blocked the OpenCode disclosure before execution, so no worktree data was sent and no cross-model result is claimed. The first strict maintainability pass caught the stale generated Devrouter skill and narrow README fingerprint wording. Running the exact released `devrouter repo agents` generator, documenting adapter and declared non-secret environment fingerprinting, and rerunning the complete gate resolved the finding; the final verdict is READY with no remaining maintainability issue at confidence 80 or higher.

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

- Current migration commits after synchronizing `v3`: `17838a57e` reopens the plan, `d817f84c0` merges current `v3`, `277ae692f` adopts the runtime-delivered managed helper, `722ce9e4a` records the safety proof, and `7f1646ef1` fixes root-build production semantics. `git log origin/v3..HEAD` remains the commit-level source of truth.
