# PLAN — LLM Wiki (OKF) + Junior-Engineer Skill Set

## Identity

- Plan path: `project/plans_wip/PLAN-llm-wiki-and-skills.md`
- Branch: `claude/busy-shirley-b9c7bc` (worktree) → target `v3`
- PR: none yet (rename plan on ID per workflow)
- Method: `ai-project-wiki-and-skills-bootstrap` (execute mode) + `llm-wiki-okf` + `df-sliced-development-workflow`

## Goal

- Ship agent-readable OKF wiki + 7 new `klicker-*` task-shaped skills. Junior + coding agent go clone → reviewed feature without senior.
- Done = behavioral: fresh agent ships dogfood feature using only repo + brief. Not "docs exist".

## Non-goals

- No rewrite of `apps/docs` (user-facing docusaurus; different audience).
- No devcontainer build (D3).
- No changes to existing skills (`agent-browser`, `klicker-cypress-e2e`, `klicker-playwright-e2e`, `cypress-author`, `playwright-*`, `vercel-react-best-practices`, `web-design-guidelines`) — new set integrates, never duplicates.
- No app code changes outside dogfood feature (which runs in a separate worktree).

## Research (done, repo-internal evidence)

- Method note: subagent fan-out hit server-side API rate limits twice (2026-07-06); research done inline sequentially. Execution phases plan for the same fallback (sequential subagents, small bursts).
- Evidence: no `.devcontainer` (root ls). Bring-up = host pnpm + `docker-compose.yml` deps (postgres, redis_exec/assessment/cache, traefik variants `reverse_proxy_{docker,macos,wsl}`, mailhog, hatchet, litellm). Secrets via Infisical (`util/_run_with_infisical.sh`); `dev:raw` path exists without injection.
- Evidence: skill prefix `klicker-` established (`.agents/skills/klicker-cypress-e2e`, `klicker-playwright-e2e`); `.claude/skills` + `.github/skills` symlink to `.agents/skills` (AGENTS.md).
- Evidence: plan convention `project/plans_wip/PLAN-<topic>.md` (8 live examples), archive in `project/plans_archive/`.
- Evidence: `project/CODEBASE_NOTES.md` = 70+ curated gotchas by area (GraphQL/data, chat, frontend/CSP, auth/LTI, infra, testing/CI). Prime wiki input. Maintained via AGENTS.md instruction.
- Evidence: GraphQL layout `packages/graphql/src/{schema,services,graphql/ops}`; codegen ritual in AGENTS.md; op prefixes Q/M/S/F.
- Evidence: CI = per-concern workflows (check-{format,lint,syncpack,types}, test-{grading,graphql,util,olat-api}, cypress-testing, playwright-testing, codeql, release) + per-app `v3_*-{stg,prd}` image builds. Deploy = `deploy/charts` (helm) + `env-uzh-{stg,prd}`.
- Evidence: worked-example feature slices: #4951 (assessment performance overview), #4958/#4945 (point corrections) — full-stack graphql service + manage UI + i18n + e2e. #4947 wordcloud = package-heavy, less canonical.
- Weak/missing evidence (Phase 0/1 must establish, hard gate before writing): exact bring-up transcript + durations, real failure signatures, `dev:raw` viability without any Infisical access, seed health-check URLs.

## Inputs (bootstrap prompt block, resolved)

- `REPO`: klicker-uzh monorepo (this worktree)
- `SKILL_PREFIX`: `klicker`
- `STACKS`: typescript-react-next; node-graphql-api (Pothos/Yoga — adapt tRPC module); prisma data layer. Chat/LLM: wiki page only (D4).
- `REFERENCE_IMPL`: none-as-app. Worked examples = pinned feature slices `ff61d9bc7` (#4951 assessment performance overview; trace fully in S2) and `38c92d035` (#4958 point corrections; secondary, trace only where #4951 lacks a pattern). Drop `scaffold-new-module` skill (features here = slices through existing apps, not new modules).
- `WIKI_DIR`: `docs/` at repo root (D1)
- `SKILL_DIR`: `.agents/skills/` (canonical; symlinks already wired)
- `AUDIENCE_NOTES`: junior engineers + host coding agents (Claude Code, Codex). OS mix macos/wsl/linux (compose has per-OS traefik variants). Infisical access varies — juniors may lack secrets → `dev:raw`/localhost path must be first-class. Agents must not start dev servers unprompted (AGENTS.md rule); skills explicitly authorize server starts where the task requires them.

## Decisions (approved 2026-07-07 with recommendations)

- D1 WIKI_DIR: **`docs/` root** (OKF default, human-browsable on GitHub, no clash on disk). Alts considered: `docs/wiki/`, `.agents/wiki/`. Confusion with `apps/docs` mitigated via index title "Engineering Wiki (agent-facing)", root README pointer, `apps/docs` cross-note.
- D2 CODEBASE_NOTES.md: **migrate entries into wiki pages by area; replace file with pointer stub; update AGENTS.md instruction → wiki + `klicker-wiki-maintenance` skill.** Pages absorb notes as they are written (S3–S5), not in a late migration slice — avoids duplication window.
- D3 devcontainer: **none built; host bring-up is the documented runtime surface.** Doctor skill + wiki document OS matrix explicitly; Phase 4 review hunts host/OS assumptions extra hard.
- D4 chat app: **wiki page `chat-platform.md`, no chat skill in v1** (cap discipline). Add later if usage shows need.
- D5 dogfood feature: pick after Phase 1. Candidates (full-stack, deliberately different mechanic from worked examples): (a) lecturer-configurable course setting gating a participant-visible UI element (schema + api + manage UI + pwa UI); (b) new aggregate stat on lecturer cockpit fed by new service query + tests. Must NOT be re-skin of #4951/#4958.

## Wiki page taxonomy (Phase 2; adapt/merge if thin)

`index.md` (okf_version 0.1, reading order, skill routing) · `getting-started.md` (both paths: full Infisical+Traefik; localhost `dev:raw`; agent addendum: never auto-start dev servers, npx agent-browser) · `architecture-overview.md` (apps/packages map, request flow) · `domain-model.md` (Course, Element→ElementInstance/Block, activity types, Participant vs User, points/XP) · `graphql-api-layer.md` (Pothos code-first, 3-layer auth, ops naming, codegen ritual) · `data-and-migrations.md` (split schema, migrate→sync→generate ritual, seeding, test users) · `async-and-workers.md` (Hatchet, response-api, 3 redis roles) · `auth-model.md` (Edu-ID/delegated/LTI/magic-link, JWT, cookie domains) · `frontend-conventions.md` (design system, Apollo+generated ops, i18n de/en, data-cy, twMerge) · `chat-platform.md` (app-router island: zustand, assistant-ui, model registry) · `testing.md` (pyramid, dev:test vs dev:playwright split, safe non-DB targets) · `ci-and-deployment.md` (PR gates, husky, release, v3_* builds, helm) · `developing-a-feature.md` (bridging page: lifecycle step → skill) · `log.md`. ~14 pages; each leads with its one non-obvious point; every command from Phase 0/1 transcripts; validate via `llm-wiki-okf` validate.sh + repo prettier.

## Skill catalog (Phase 3; 7 new, contract per bootstrap checklist)

1. `klicker-environment-doctor` — bring-up both paths, health checks, failure-signature table from deliberately broken runs (missing /etc/hosts, stale volume, stale codegen, port conflict, missing Hatchet token/worker), reset recipes (`prisma:setup`, `_down.sh`). Every other skill's failure path.
2. `klicker-feature-design` — spec before code; PLAN-*.md convention in `project/plans_wip/`; what a design must answer (domain vocab, activity type, auth layer, i18n, gamification impact, test level).
3. `klicker-graphql-api` — endpoint end-to-end: schema type → service → op → codegen → client; 3-layer auth; worked trace of #4951.
4. `klicker-data-model` — split-schema ritual edit→migrate→sync→generate; seed updates; Decimal + analytics py.prisma gotchas.
5. `klicker-frontend-ui` — per-app conventions for manage/pwa/control (pages-router), design system, i18n pair edits, data-cy, mandatory `npx agent-browser` verification (cites agent-browser skill). Explicitly excludes `apps/chat` → links `chat-platform.md`. Explicitly authorizes starting the needed dev servers for verification + cleanup via `_down.sh`.
6. `klicker-testing-verification` — which level when; safe non-DB test targets; dev:test vs dev:playwright ownership; "verified before PR" = check:all + build + targeted tests + browser evidence. Routes to existing `klicker-cypress-e2e` / `klicker-playwright-e2e` (no duplication).
7. `klicker-wiki-maintenance` — governance: change-type → page map, same-change-set rule, index/log upkeep, validation loop, D2 aftercare.

Integration: existing e2e/browser skills stay canonical for their domains; new skills link, never restate. Total repo skill count 15 — trigger discipline: every new description names the repo ("…for KlickerUZH…") and routes by name (Cypress/Playwright work → `klicker-cypress-e2e`/`klicker-playwright-e2e`, browser verification → `agent-browser`).

## Slices (one branch, commit per slice)

- S0 commit plan: `docs(project): add llm wiki and skills bootstrap plan`.
- S1 Phase 0 env bring-up: run both paths for real (full Infisical path + clean Infisical-less `dev:raw` path), record transcript + durations + health evidence incl. Hatchet + workers health (publication mutations need worker); deliberately break ≥3 ways, capture exact errors → `project/docs/WIKI_BOOTSTRAP_BRINGUP.md`. Evidence rules: redact secrets/private URLs/user-specific paths before commit; label every command verified-on-macOS — WSL/Linux variants marked inferred-from-config unless executed. Verify: app responds, seeded login works, secret scan over the transcript. Commit `docs(project)`. **Gate: no downstream writing before this exists.**
- S2 Phase 1 archaeology: subagent fan-out (sequential/small-burst fallback), one question each (architecture, domain, api, data, frontend, testing, ci/deploy, full trace of pinned `ff61d9bc7`) → inventory `project/docs/WIKI_BOOTSTRAP_INVENTORY.md`, every claim file:line, secret scan before commit. Commit `docs(project)`.
- S3 wiki core: index, log, getting-started, architecture-overview. Validation loop green (validate.sh + prettier). Commit `docs(wiki)`.
- S4 wiki backend: domain-model, graphql-api-layer, data-and-migrations, async-and-workers, auth-model. Commit.
- S5 wiki frontend+ops: frontend-conventions, chat-platform, testing, ci-and-deployment, developing-a-feature. Full validation. Commit.
- (S3–S5, D2: each page absorbs the matching CODEBASE_NOTES entries as it is written; per-slice note removal keeps single source of truth throughout.)
- S6 skills spine: environment-doctor, testing-verification. Contract checklist per skill. Commit `docs(skills)`.
- S7 skills backend: graphql-api, data-model. Commit.
- S8 skills flow: feature-design, frontend-ui, wiki-maintenance + cross-refs into index/developing-a-feature. Commit.
- S9 reconciliation + independent review (Phase 4): wiki↔skills cross-check; independent review briefed on wrong-runtime assumptions (OS matrix, host-vs-compose, Infisical-less machines, stale-state instructions). Verify findings against running system. Fix/defer in writing. Commit.
- S10 D2 closure: replace CODEBASE_NOTES with pointer stub + AGENTS.md instruction updates (absorption happened in S3–S5). Commit `docs`.
- S11 dogfood (Phase 5): write brief (bootstrap Appendix A template, feature per D5). Run in a **separate fresh worktree/branch** (`trees/` convention) so app code never lands on this docs branch; dogfood branch is evidence, discarded after (with approval). Pass/fail contract: fresh agent, only repo + brief, no hints; success = feature works with browser evidence + tests green; feedback report classifies failures (env / wiki-gap / skill-gap / agent-error). Only the feedback report + resulting wiki/skill fixes commit here. **Gate: fresh agent succeeds.**
- S12 finish: security-review subagent (published artifacts: no secrets/PII/private URLs), final branch review (independent agent), PR to `v3` via df-mr-description-writer, conventional title `docs: ...`. Next Steps section.

- Per-slice loop: verify → review subagent → simplification subagent → integrate → conventional commit (df-sliced lifecycle).

## Verification & evidence

- Wiki: validate.sh + `pnpm run format:check` scope docs/; link+frontmatter check; every command executed with output recorded.
- Skills: per-skill contract checklist; commands from transcripts only.
- Evidence slices (S1/S2): secret scan + redaction before each commit, not only at S12.
- End: dogfood feedback report committed; PR description = whole branch.

## Risks

- Rate-limit on subagent fan-outs (observed 2×) → sequential fallback baked into S2/S9.
- Infisical-gated bring-up: if `dev:raw` insufficient for a working stack without secrets, getting-started must say so honestly and document minimum secret set. Phase 0 resolves.
- Local machine state: user's dev stack/DB may hold in-progress work. S1 inventories running containers/volumes first; destructive resets (`prisma:setup`, volume wipes) only on demonstrably test-seeded state, otherwise deferred and documented.
- 15-skill trigger surface: mitigate with disjoint pushy descriptions; merge if dogfood shows misfires.

## Independent plan review

- Reviewer: Codex CLI (`codex exec`, read-only sandbox) — `agy` print mode non-functional in this environment (smoke test returned empty), fallback per workflow defaults (Codex when main agent is Claude).
- Verdict: DONE_WITH_CONCERNS, 11 findings (7 Important, 4 Minor). All accepted and integrated (D2 timing → decide at approval + absorb per-page; dogfood → separate worktree + pass/fail contract; OS/verified-vs-inferred labeling; per-slice secret scans; pinned example SHAs; server-start authorization in skills; trigger/routing discipline; chat ownership; Hatchet health in S1). D1 partially accepted: `docs/` kept, alternatives + routing mitigations documented.

## Progress

- 2026-07-06: research done (inline fallback after 2× subagent rate-limit); plan drafted; Codex review integrated.
- 2026-07-07: plan approved ("continue" with recommended D1–D5). S0 committed (`a93185f8f`).
- 2026-07-07: S1 done **with constraints**: user instructed "don't start the app" mid-slice; host ports 5432/6379/7077/8888 occupied by unrelated stacks. Verified: install/build/hook chain (pnpm 11.5.0, build 21 tasks no secrets), compose config w/o secrets, partial infra up+teardown. 5 exact failure signatures + agent-path traps captured → `project/docs/WIKI_BOOTSTRAP_BRINGUP.md`. App-layer bring-up NOT executed → all app-run commands in wiki/skills must carry `config-derived` label; doctor skill says "verify on your machine". Amendment: S1 gate satisfied at package+infra layer; app-layer verification deferred to dogfood run on a machine with free ports (S11) or explicit user go-ahead.
- 2026-07-07: S2 done (`7166e943e`): 8 archaeology questions answered via sequential Explore-agent pairs (rate-limit-safe), merged into `project/docs/WIKI_BOOTSTRAP_INVENTORY.md` with file:line evidence, cross-cutting synthesis, 6 consolidated open questions. Secret scan clean; 3 cited line ranges spot-checked against source.
- 2026-07-07: S3 done (`acabbf703`): OKF bundle `docs/` created (index w/ okf_version, log, getting-started, architecture-overview), validate.sh conformant, prettier clean. Review subagent rate-limited → inline claim verification instead; caught + fixed 2 errors (middleware order cors→cookieParser→jwtMiddleware; traefik service actually `reverse_proxy_{docker,macos,wsl}`). D2 absorption: 3 CODEBASE_NOTES entries (turbo globalEnv, turbo persistent cache, npx agent-browser) moved into getting-started. README Important-Links pointer added.
- 2026-07-07: S4 done (`aee4cfd72`): domain-model, graphql-api-layer, data-and-migrations, async-and-workers, auth-model. Extra verification for auth page (origin-based cookie selection in jwtMiddleware — new finding, made it the page lead; NextAuth providers/delegated/magic-link traced in source). Absorbed CODEBASE_NOTES: GraphQL & data (3), Export package (3 → data page "Adjacent" section), Auth/LTI (1). validate.sh conformant (2 expected broken-link warnings to S5 pages).
- 2026-07-07: S5 done (`18b68f754`): frontend-conventions, chat-platform, testing, ci-and-deployment, developing-a-feature. Full bundle: 14 files, validate.sh conformant, zero warnings. D2 CLOSED early: ALL remaining CODEBASE_NOTES sections absorbed (chat→chat-platform; frontend/CSP→frontend-conventions; infra→ci-and-deployment; testing facts→testing.md; Playwright authoring+CI gotchas→klicker-playwright-e2e skill new "Authoring Gotchas" + extended CI Notes; PR-triage→developing-a-feature) — CODEBASE_NOTES is now the pointer stub. S10 shrinks to AGENTS.md updates only. Spot-verified: testIdAttribute, cypress-split comments, @source, knip script, versionrc chart-bump commented, embed-harness 3101.
- 2026-07-07: S6 done (`a23c1ff2a`): klicker-environment-doctor (9 ordered checks, verified/config-derived provenance labels, agent ground rules incl. no-headless-_run_app_dependencies + destructive-reset gate), klicker-testing-verification (routing table, e2e-locally decision rule + server-start authorization, 6-item pre-PR checklist).
- 2026-07-07: S7 done (`b8589199a`): klicker-graphql-api (8-step build order, auth composition, debugging table), klicker-data-model (3-step ritual, incident rules, 3-seed-path table).
- 2026-07-07: S8 done (`3675e1828`): klicker-feature-design (8 design questions, plan-file convention), klicker-frontend-ui (work loop w/ mandatory agent-browser verification + server-start authorization, chat exclusion), klicker-wiki-maintenance (same-change-set rule, change-type→page map, house conventions). index.md skill routing expanded to full roster.
- 2026-07-07: S9 reconciliation: caught + fixed wrong `withPermission` code sketch in klicker-graphql-api (it WRAPS the resolver — verified against `mutation.ts:deleteCourse` and `sharing.ts:withPermission`). Doctor check-number cross-refs verified (check 7/8 referenced by graphql/data-model skills match).
- 2026-07-07: S9 in progress: withPermission fix committed (`1bb0b5fca`); link sweep over docs/ + skills clean; Codex independent review running (background).
- 2026-07-07: S10 done (`cf9811eaf`): AGENTS.md → wiki pointer (Engineering Wiki section replaces Codebase Notes), stale "pnpm 10.x / Node 20" fixed to 11.x/24, klicker-* skill roster added to AI Assistance. (CODEBASE_NOTES stub already landed with S5.)
- 2026-07-07: S9 independent review DEFERRED by user ("proceed without waiting, we will do a review later") — Codex background run stopped before output. Inline verification (this session) stands: 3 factual errors caught+fixed, link sweeps clean. S11 dogfood also deferred (app start prohibited this session).
- 2026-07-07: S12 security pass done: secret-pattern scan over full branch diff clean; seeded-credential-value scan over new/changed docs clean.
- Next: draft PR to `v3`.

## Next steps

- Post-merge / later per user: independent review of wiki+skills (S9 brief: factual errors, wrong-runtime assumptions, wiki↔skill inconsistencies, secrets) and S11 dogfood run (fresh agent, separate worktree, D5 feature, pass/fail contract in plan).
- Open wiki questions to resolve with maintainer knowledge: deploy trigger for `helm upgrade`, `prisma migrate deploy` invocation point, achievement-award trigger + LiveQuiz bonus formula (marked "unmapped" in domain page).
