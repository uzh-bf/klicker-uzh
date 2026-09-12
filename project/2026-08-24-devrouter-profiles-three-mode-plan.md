# Devrouter profiles and three-mode dev environment plan

## Goal

- Adopt devrouter `0.0.36` profiles and lease-based idle lifecycle so agent workspaces start only the apps a task needs and stop when unused.
- Formalize the three supported runtime modes — host (`pnpm dev`/`dev:raw` + docker compose), native DevContainer (DevPod with `forwardPorts`), managed devrouter (`devrouter ensure --profile`) — as one authoritative contract in AGENTS.md and `.devcontainer/README.md`.
- Cut per-workspace dev-server footprint (RAM, readiness time) without changing the single-container architecture.

## Non-goals

- No split of the single `app` container into per-app containers.
- No removal of `forwardPorts` from `.devcontainer/devcontainer.json` — native DevContainer mode requires them; managed mode ignores them.
- No changes to the legacy host-based stack (`*.klicker.com`, Traefik, Infisical).
- No new application or package dependencies.
- No worktree, volume, or branch deletion; idle lifecycle only stops runtimes via devrouter.

## Identity

- Plan: `project/2026-08-24-devrouter-profiles-three-mode-plan.md`
- Branch: `rs/devrouter-profiles`
- Worktree: `trees/rs-devrouter-profiles` (workspace token `rs-devrouter-profiles`, created with `--no-devpod`)
- Base: `v3`
- Upstream: devrouter plan `docs/project/2026-08-24-profiles-leases-resource-plan.md` on `rs/profiles-leases-idle` (`/Volumes/HOME/Git/personal/devrouter`), release target `0.0.36`.

## Verified starting state

- `.devrouter.yml` (version `0.0.35`) declares 10 proxy apps (`api`, `auth`, `pwa`, `manage`, `control`, `olat-api`, `response-api`, `db`, `lti`, `chat`) with `${WORKSPACE}` upstreams.
- `.devcontainer/post-start.sh` starts one `turbo run dev` process group (`pnpm run dev:container`) covering every routed app plus both Hatchet workers, plus the always-on local MCP fixture.
- `DEVROUTER_PROCESS_FINGERPRINT_ENV` in `post-start.sh` lists the origin/URL variables that affect managed-process identity; profile selection must join this set.
- `forwardPorts` in `.devcontainer/devcontainer.json` exists for native DevContainer/VS Code use; managed `ensure`/`exec` never establish SSH port tunnels.
- Each running workspace currently costs 8 containers (app, postgres, 3× redis, mailhog, hatchet, litellm) plus one full dev process tree; parallel-session incidents showed ~59 containers live and host memory pressure.
- Skills updated this session already mandate `npx agent-browser`, `devrouter exec` over bare `devpod ssh`, and 502 → `devrouter ensure` recovery in `klicker-environment-doctor` and the `agent-browser` skill.

## Decisions

- **Profiles are declared once in `.devrouter.yml` and selected per ensure.** `ui`, `chat`, `live-quiz`, and `full` (default) cover the real task shapes; `full` preserves today's behavior exactly.
- **Profile reaches the container as `DEVROUTER_PROFILE`.** `post-start.sh` maps it to a turbo filter set; it is added to `DEVROUTER_PROCESS_FINGERPRINT_ENV` so switching profiles replaces the owned process group instead of mixing two route/process sets.
- **Workers are profile-gated, the MCP fixture is not.** Hatchet workers run only in `live-quiz`/`full` (response processing is meaningless without the live-quiz path); the Benibot MCP fixture stays always-on (cheap, seeded-chat dependency, and keeps `chat`/`full` parity).
- **Honest resource accounting.** Container count per workspace stays 8; profile savings are dev-server processes (each Next dev server ≈300–500 MB RSS, so `ui` saves roughly 2–4 GB per workspace) plus materially faster readiness. The plan does not claim container-level savings.
- **Idle lifecycle is stop-only and delegated to devrouter.** This repo adds no cleanup scripting of its own; agents use `devrouter workspace idle --stop` (0.0.36) and long tasks use `workspace claim`/`heartbeat`. Worktrees, branches, and volumes are never touched.
- **Three modes are documented as one table, not three essays.** AGENTS.md keeps the summary; `.devcontainer/README.md` owns the authoritative contract; skills point at it.

## Slices

### Slice 1: profile definitions in `.devrouter.yml` (requires devrouter 0.0.36)

- Do: add `profiles` — `ui` (apps `manage, api, auth`; deps `db`; readiness `manage, api`), `chat` (apps `chat, api, auth`; deps `db`; readiness `chat, api`), `live-quiz` (apps `pwa, control, api, response-api, auth`; deps `db`; readiness `pwa, api`), `full` (all, default). Bump `devrouter.version` to `0.0.36` in the same change.
- Test: `devrouter doctor --repo .` passes with the profile graph; `devrouter ensure . --profile ui --json` in a scratch worktree creates only the profile's routes.
- Check: `devrouter doctor`, `devrouter app ls`, one `ensure --profile` proof.

### Slice 2: profile-aware startup

- Do: `post-start.sh` reads `DEVROUTER_PROFILE`, maps it to turbo `--filter` sets (api/auth always; manage/pwa/control/chat/response-api/olat-api/lti per profile; workers only `live-quiz`/`full`), adds `DEVROUTER_PROFILE` to `DEVROUTER_PROCESS_FINGERPRINT_ENV`, and prints the active profile in the readiness banner. Root `dev:container` script stays generic; filtering lives in the shell layer where the profile variable exists.
- Test: disposable-workspace proof per profile — process list shows exactly the profile's dev servers; profile switch (`ui` → `full`) replaces the process group and route set; `full` output matches today's baseline.
- Check: `bash -n` shell syntax; before/after `ps` and route evidence in the plan record.

### Slice 3: three-mode documentation

- Do: add the authoritative three-mode table to `.devcontainer/README.md` (mode, entry command, networking, parallel workspaces, when to use) and a condensed version + link in AGENTS.md's Local Dev Setup section; explicitly document `forwardPorts` as native-DevContainer-only and ignored by managed mode; document profile selection and the idle/lease commands in both.
- Test: none (docs); verify links and that no guidance contradicts the devrouter skill.
- Check: `pnpm run format` (Prettier on md); manual read-through against devrouter `docs/DEVCONTAINER.md` wording.

### Slice 4: skill updates

- Do: extend `klicker-environment-doctor` with profile selection guidance (pick `ui` for frontend verification tasks, `chat` for chat work, `full` only when needed) and the idle-stop policy (`workspace idle`, `claim`/`heartbeat` for long tasks); extend `klicker-frontend-ui` and `klicker-testing-verification` browser-verification steps to run `devrouter ensure <path> --profile ui` before opening `npx agent-browser`. Keep the existing `npx agent-browser`, `devrouter exec`, and 502-recovery guidance from this session intact.
- Test: none (skill markdown).
- Check: consistency pass across the four skills; no stale references to full-stack startup for UI tasks.

### Slice 5: verification and measurement

- Do: in a fresh linked worktree, run `ensure --profile ui` vs `ensure` (full): record turbo process count, aggregate RSS, and readiness time in this plan file; dry-run `devrouter workspace idle --ttl 4h` against the real workspace set and record the report; run the standard repo gates.
- Test: `pnpm run check:all` in the worktree.
- Check: recorded numbers meet the intent (≥2 dev-server processes and ≥1.5 GB RSS saved for `ui` vs `full`; readiness visibly faster); idle report matches expectations for known-stale workspaces.

## Sequencing

Slices 3–4 (docs/skills) can land independently and reference 0.0.36 as upcoming. Slices 1–2 require the devrouter `0.0.36` release from the upstream plan. Slice 5 requires Slices 1–2.

## Progress

- Current: Slices 1–2 implemented and validated live against a local devrouter `0.0.36` build (from `rs/profiles-leases-idle`).
  - `.devrouter.yml`: `manage`/`pwa`/`chat`/`live-quiz`/`full` profiles declared (`ui` renamed to `manage`, `pwa` split out); `full` is default; `devrouter.version: 0.0.36`.
  - `post-start.sh`: `DEVROUTER_PROFILE` defaulting, fingerprint inclusion, and per-component turbo `--filter` mapping — merged selections (e.g. `manage,pwa`) are matched component-wise so any combination works; `live-quiz`/`full` keep their fixed sets (workers included); unknown components warn and are ignored.
  - Merged selections (devrouter `resolveProfile` unions + dedupes apps/dependencies/readiness; canonical sorted name so `pwa,manage` ≡ `manage,pwa`):
    - `--profile manage,pwa`: 4 routes (api, auth, manage, pwa); dev servers on 3001/3002/3010 only; manage/pwa HTTP 200.
    - `--profile pwa,manage`: fingerprint matched — no process-group restart.
    - `--profile manage`: 3 routes; dev servers on 3002/3010 only.
    - `--profile manage,chat,pwa`: 5 routes; dev servers on 3001/3002/3004/3010; chat serves 200 on `/en`.
  - Earlier single-profile evidence: `ui` (now `manage`) 3 routes ≈2.0 GB RSS; default `full` 10 routes, 28 dev processes.
  - Known follow-up: first cold-compile readiness probe can time out; the immediate re-ensure passes.
- Next: Slice 3 (three-mode docs), Slice 4 (skill updates), Slice 5 (cold-workspace measurement; upstream release of devrouter `0.0.36`).
