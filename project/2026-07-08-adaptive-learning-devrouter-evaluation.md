# Devrouter Environment Evaluation — Adaptive Learning branch (`origin/adaptive-learning` @ `2480cda80`)

**Date:** 2026-07-08 · **Environment:** devcontainer via DevPod (workspace id **`klicker-adaptive-learning`**) fronted by devrouter over `https://*.klicker.localhost`.
**Scope:** runtime verification of the adaptive-learning branch state against the four prior reviews. Since the remediation deleted the standalone adaptive surface and the competence-tree/adaptive-quiz runtime is not yet implemented, the testable surface is: (1) the removal is complete and unreachable through every layer, (2) the seed is clean, (3) the practice-quiz surface — adaptive v2's future home — works end-to-end, (4) general environment health.

## Setup performed

- `.devcontainer/devcontainer.json` switched to the devrouter overlay (`dockerComposeFile: [docker-compose.yml, docker-compose.devrouter.yml]`, no forwarded ports) and `.devcontainer/docker-compose.devrouter.yml` updated to the `ports: !reset []` variant with devnet aliases — per the provided configurations.
- New DevPod workspace **`klicker-adaptive-learning`** created for this worktree (devrouter workspace token `adaptive-learning`). Because every route upstreams to the single `klicker-app` alias on `devnet`, the previously running `klicker-course-duplication` workspace was stopped first (user-approved; restart anytime with `devpod up klicker-course-duplication`). Routes for all ten apps re-registered from this worktree (`devrouter app run <app>` × api/auth/pwa/manage/control/olat-api/response-api/lti/chat/db).

## Results — adaptive learning verification

| # | Check | Result |
| --- | --- | --- |
| 1 | GraphQL positive control (`{ __typename }`) | ✅ works (with `x-graphql-yoga-csrf` header) |
| 2 | `publishedAdaptiveAssessments` (the answer-key leak path, R1-A1/R2-F28) | ✅ **"Cannot query field"** — schema-level gone |
| 3 | `publishedAdaptiveAssessmentInfos` (unauthenticated listing, R1-A2) | ✅ "Cannot query field" |
| 4 | `upsertAdaptiveAssessment` / `startAdaptiveAssessmentAttempt` mutations | ✅ "Cannot query field" |
| 5 | Introspection `__type(name: "AdaptiveAssessment")`, `"AdaptiveAttemptState"` | ✅ `null` — types absent from the schema |
| 6 | Manage course page (Testkurs, `lecturer/abcd` via delegated login) | ✅ loads; tab bar = Live Quizzes · Practice Quizzes · Microlearnings · Group Activities — **no Adaptive Learning tab** |
| 7 | `manage…/courses/<id>/adaptive-learning` direct URL | ✅ HTTP 404 + rendered 404 page |
| 8 | PWA course page (`testuser1/abcdabcd`) | ✅ loads (leaderboard/course info); no adaptive entry |
| 9 | `pwa…/course/<id>/adaptive-learning` direct URL | ✅ HTTP 404 + rendered 404 page |
| 10 | Seed state in DB | ✅ 5 users, 52 participants, 5 practice quizzes; **0 `AdaptiveAssessment` rows** (seed calls removed as promised); competence-tree tables exist (migration applied) and are empty as expected |
| 11 | Practice-quiz baseline (adaptive v2's delivery surface) | ✅ full loop: list → intro screen → start → flashcard flip → self-rating → submit → stack marked complete, quiz advances |

Screenshots (in `/tmp/`): `eval-01-manage.png` … `eval-14-after-submit.png` — login, course tabs, both 404 pages, practice-quiz intro/question/submitted states.

**Conclusion regarding the reviews:** every runtime-verifiable claim from the remediation reviews held up. The critical security findings (answer-key exposure, unauthenticated listings, destructive upsert, unrestricted submit) are not just patched but structurally unreachable — the operations, types, pages, and seed data no longer exist at any layer (GraphQL schema, introspection, Next.js routes, navigation, database). No adaptive UI exists to didactically evaluate yet; the next evaluation point is after remediation Phases 2–4 land (competence-tree CRUD, adaptive quiz mode, runtime).

## New finding from the evaluation

**E1 🟠 Both Hatchet workers crash on Node 24 (`@hatchet-dev/typescript-sdk` 1.9.4).**
`hatchet-worker-response-processor` registers, then dies with `TypeError: this.logger[message.type] is not a function` in the SDK's `heartbeat-controller.js` (worker_threads message handling); `hatchet-worker-general` never reaches "listening for actions" with the same error; both sit in "waiting for file changes". Backend and response-api run fine, so interactive flows work, but **async response processing (points/XP, analytics events) is dead in this environment** — and since the branch (and now `v3`) pins Node 24 everywhere including the worker Dockerfiles, this is likely not devcontainer-specific. This is exactly the class of regression the Node-bump review point warned about (v2-review Q1 / remediation 0.1 "runtime bump has its own verification record"): E2E CI wouldn't catch it because the workers aren't covered. *Action:* reproduce with `node:24` + SDK 1.9.4 in isolation, check upstream for a Node-24-compatible SDK release, and add a worker-boot smoke check to CI before any Node-24 deployment.

## Environment gotchas hit and resolved (worth recording)

1. **Disk exhaustion → `pnpm install` Bus error.** The OrbStack VM disk hit 100 % (a >100 GB `.turbo` cache); pnpm died mid-extraction with SIGBUS. After clearing, installs still failed in novel ways (see 2–4).
2. **Host↔container shared worktree breaks `@rollup/plugin-typescript` silently.** Host-built `dist/tsconfig.tsbuildinfo` files (host-absolute paths, `composite: true`) are bind-mounted into the container; the plugin's incremental builder then skips emitting and rollup parses raw TS — the misleading error is `Expected ',', got '<identifier>'` on `import { type X }` lines. **Fix:** delete `packages/*/dist` (and `.turbo/cache`) inside the container before building when the worktree is also used for host builds. Candidate hardening: `post-create.sh` could clean stale `*.tsbuildinfo` before the turbo build.
3. **pnpm 11 "Already up to date" after a manual `node_modules` wipe.** pnpm's decision state lives in `node_modules/.pnpm-workspace-state-v1.json`; deleting visible package dirs but not this dotfile makes subsequent installs a 200 ms no-op that leaves dangling symlinks. Wipe includes dotfiles or use `pnpm install --force` after removing the state file.
4. **Docker/OrbStack phantom network endpoints after the disk-full event.** The postgres container lost its IPs while "running"; restarts then failed with `endpoint with name … already exists in network` on both the project network and the shared `devnet`. Recovery: remove the container, `docker network disconnect -f <net> <name>` for the phantom entries (works only once the container is gone), remove/recreate the project network, `devpod up`.
5. **devrouter constraint (by design):** all klicker routes upstream to the fixed `klicker-app` alias, so only one klicker devcontainer can be routed at a time; workspace-namespaced hostnames don't remove the collision because the upstream alias is shared, and namespaced hosts would break the `*.klicker.localhost` cookie/origin env anyway. Swapping workspaces = stop one devpod, start the other, re-run `devrouter app run` from the active worktree.
