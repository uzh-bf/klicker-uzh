# Agent Readiness Improvement Plan

Goal: raise KlickerUZH from Factory readiness level 4 (61%) toward level 5, consolidate the devcontainer PR stack into one merged path, and cut agent verification loops (CI, e2e, local boot) from hours to minutes.

Branch: `agent-readiness`
Target: `v3`
Plan path: `project/2026-07-06-agent-readiness-improvement-plan.md`
MR/PR: work ships as several small PRs (one per phase, see Execution Checklist)

Audience: written so a junior dev (or coding agent) can execute each item without extra context. Every item has a **Done when** acceptance check. Items marked **OWNER DECISION** need Roland's sign-off before implementation.

Inputs:

- Factory Agent Readiness report 2026-07-06 (commit `d6c7772`, level 4/5, 61%, 40/82 passed, 31 failed). Source file: `klicker-uzh-readiness-report.md` (Downloads; copy into `project/reports/` when convenient).
- Open PRs: #5119 (devcontainer phase 1), #5120 (phase 2 tier 1), #5138 (phase 2 tier 2/3, Jules-authored), #3928 (old devcontainer), #4901 (act local CI), #5081 (sandcastle, targets `v3-ai`).
- Multi-agent audit 2026-07-06: 6 domain audits, 9 adversarial judges (3 lenses x 3 chunks), completeness critic. 52 proposals survived majority vote, 9 killed. Agent-tooling domain re-audited inline after subagent failure.
- Measured CI data (live run history + PR #5136 check-runs).

## Current State (evidence)

| Category | Pass rate | Reality check |
| --- | --- | --- |
| Style & Validation | 91% | Healthy. Only gaps: Python formatter (analytics), boundary-lint tooling. |
| Build System | 81% | Healthy except fast-CI-feedback + feature flags + bundle analyzer. |
| Documentation | 77% | AGENTS.md good; no freshness check; GraphQL schema not discoverable. |
| Security | 67% | Branch protection requires code-owner review but **no CODEOWNERS file exists** — requirement is a silent no-op. No dependabot/renovate. |
| Development Environment | 64% | No devcontainer on `v3`; solution already exists in PR stack #5119→#5120→#5138. |
| Task Discovery | 50% | GitHub Issues dead; ClickUp is the real tracker (auto-triage links in PR bodies). No PR template. |
| Debugging & Observability | 22% | pino only in hatchet-worker-general; Sentry only in backend-docker; health endpoints are bare "OK" stubs. |
| Testing | 12% | Worst category — but partly rubric mismatch: logic lives in packages, apps are thin shells covered by e2e. Real gaps: apps/chat has 9 vitest files **no CI runs**; packages/word-cloud suite also CI-blind; no fast single-spec path. |
| Product & Experimentation | 0% | Consciously out of scope for a 2–4 dev university product (see Non-Goals). |

Hard-measured CI facts (PR #5136 + run history):

- `cypress-run-cloud` (the path real, non-draft PRs take): **~75–80 min, unsharded**. Only draft PRs get the 8–10-way `cypress-split`.
- Playwright: 5 shards, **imbalanced** — shard 2 ran 36m50s vs 14–17m for the rest; not a required check.
- Lint/format/types/syncpack: 1–4 min each, turbo-cached. Fine as-is.
- **Branch protection is partly cosmetic**: required contexts `cypress-run`, `build`, `test` match no actual job name (real jobs: `cypress-run-cloud`/`cypress-run-parallel-draft`, `build-amd`/`build-arm`; three workflows collide on generic `test`/`check`). GitHub does not block on a context that never fires — PR #5136 merged without a bare `cypress-run` context ever reporting.

## Research Findings

One subagent per question; citations inline; each with limitations + local applicability.

### R1 — Factory rubric mechanics

Levels: Functional → Documented → Standardized → Optimized → Autonomous. Advancing needs 80% pass at a level plus all lower levels. Level-5 criteria not publicly specified (docs.factory.ai/web/agent-readiness/dashboard, factory.ai/news/agent-readiness). Limitation: rubric internals partially opaque. Applicability: fastest legitimate climb = close failed criteria in already-strong categories, then re-scan; do not hand-chase undocumented level-5 criteria.

### R2 — Which cloud agents consume devcontainer.json

- GitHub Copilot coding agent: does **not** read devcontainer.json; wants `.github/workflows/copilot-setup-steps.yml` (single job, 59-min cap, own firewall allowlist) (docs.github.com "customizing the development environment for copilot coding agent"; community discussion #161180).
- Cursor cloud agents: want `.cursor/environment.json` (cursor.com/docs/cloud-agent).
- OpenAI Codex cloud: two-phase model — setup phase online (secrets injected, then wiped), agent phase offline by default with optional domain allowlist (developers.openai.com/codex/cloud/environments, /internet-access).
- Google Jules: most devcontainer-agnostic; infers setup from AGENTS.md/README or an explicit setup script (jules.google/docs/environment).

Limitation: vendor behavior changes fast; revalidate before documenting publicly. Applicability: the devcontainer merge is a human/local-DX + Codespaces/devpod win; each cloud agent needs its own thin adapter. AGENTS.md quality is the common lever (esp. Jules).

### R3 — AGENTS.md ecosystem

AGENTS.md is now a Linux Foundation (AAIF) project (Dec 2025), 60k+ repos. Freshness-validation tooling (agents-lint, agnix, ctxlint) exists but is young/small. Consensus failure mode: stale commands are worse than no commands. Applicability: write a ~30-line homegrown check; revisit third-party linters once mature.

### R4 — Fast CI in pnpm/turbo monorepos with heavy e2e

Mature pattern: fast tier (lint/type/unit) required and blocking; e2e moved to merge queue (`merge_group` trigger) or post-merge non-blocking, scoped by turbo affected-package detection (docs.github.com merge-queue docs; tenki.cloud merge-queue setup; warpbuild.com monorepo guide). Applicability: directly matches our measured problem (80-min cypress on the blocking path).

### R5 — Feature flags at our scale

Dedicated flag tooling pays off around 20–50 engineers or 30–50 concurrent flags (flagshark.com startup-vs-enterprise; configcat.com flags-vs-env-vars). We are 2–4 devs with a working env-var flag convention (CODEBASE_NOTES.md "Feature flag guards"). Applicability: keep env-var flags + add a flag registry section to CODEBASE_NOTES.md; explicitly accept the red scanner mark.

## Non-Goals (explicit skips, with rationale)

Deliberate defers — documented so future scans/agents stop re-litigating them:

| Skip | Rationale | Cheap fallback |
| --- | --- | --- |
| Feature-flag platform (Unleash/GrowthBook) | Below evidence-based team-size threshold (R5); env flags work. | Flag registry section in CODEBASE_NOTES.md. |
| Metrics stack (Prometheus/Grafana/Datadog) | Disproportionate infra for 2–4 devs; nothing to dashboard yet. | Revisit after an incident logs+Sentry can't answer. |
| Alerting (PagerDuty/OpsGenie) | No on-call rotation exists. | Enable Sentry built-in alert rules on the existing project. |
| Product analytics + error-to-issue pipeline | No growth function; student-data privacy surface; GitHub Issues isn't the backlog. | Revisit if ClickUp gains a Sentry integration. |
| Bundle analyzer + boundary lint as CI gates | SonarCloud+knip already cover adjacent ground; no size budget exists to gate on. | Optional manual `ANALYZE=true` build for frontend-manage only. |
| Per-app unit tests for thin apps | backend-docker/response-api/workers/lti/frontends are composition layers; logic tested in packages + e2e. | Triage note in CODEBASE_NOTES.md (item 3.8). If response-api/workers grow own logic, revisit. |
| Real vitest parallel isolation (drop singleFork) | Requires schema-per-file or transaction-per-test rework in packages/graphql; L effort. | Document tradeoff (item 3.7); revisit if suite runtime becomes the bottleneck. |
| Chasing Factory level 5 directly | Level-5 criteria unpublished (R1). | Re-scan after this plan lands; measure delta. |

## Workstreams

Effort: S <0.5d, M 0.5–2d, L >2d. Impact = effect on agent effectiveness, not rubric score.

### WS0 — Quick wins (all S, one PR, ~1 day total)

| # | Item | Impact | What to do | Done when |
| --- | --- | --- | --- | --- |
| 0.1 | `.github/CODEOWNERS` | high | New file. Coarse mappings only: one line per top-level dir (`apps/backend-docker/`, `packages/prisma/`, …) plus catch-all `*`, all pointing at the maintainer GitHub handles. **OWNER DECISION**: who is listed. | File exists on `v3`; opening a test PR shows "Review required from code owners". |
| 0.2 | `.github/dependabot.yml` | high | New file. Two ecosystems: `npm` (root, weekly, grouped minor+patch into one PR, majors ignored) and `github-actions` (weekly). Set `cooldown` days ≥14 to match the pnpm `minimumReleaseAge: 20160` policy in `pnpm-workspace.yaml`. | Dependabot opens its first grouped PR; no more than ~2 PRs/week. |
| 0.3 | `.github/pull_request_template.md` | high | New file, short: What & why / Changes / How to test + verification evidence / Screenshots (UI) / ClickUp link. Mirror the section structure of PR #5119's body. | New PRs open pre-filled with the template. |
| 0.4 | AGENTS.md command smoke check | medium | New script `util/check-agents-md.sh`: extract backticked `pnpm run <script>` / `pnpm --filter … <script>` occurrences from AGENTS.md, verify each script exists in the corresponding package.json; verify relative file paths referenced in AGENTS.md exist. Warn-only (exit 0) in the first iteration. Call it as an extra step in `.github/workflows/check-lint.yml`. | CI logs the check on every PR; deliberately renaming a script in AGENTS.md produces a warning line. |
| 0.5 | Prisma sync drift check | medium | Add a step (in `check-lint.yml` or a tiny new workflow): run `util/sync-schema.sh` into a temp dir, `diff -r` against `apps/analytics/prisma/schema/`, fail on drift. Note: `prisma:sync` is referenced by zero workflows today. | Editing a `.prisma` file without running `pnpm run prisma:sync` fails the check. |
| 0.6 | Point AGENTS.md at the generated GraphQL schema | high | Add one line to AGENTS.md "GraphQL Workflow": schema file path (`packages/graphql/src/public/schema.graphql`) + regen command. (Dropped the idea of surfacing the schema on the user-facing docs site — it is dev/agent-facing, not relevant to end users.) | AGENTS.md names the schema path. |
| 0.7 | ruff for apps/analytics | low | In `apps/analytics`: `uv add --dev ruff`, minimal `[tool.ruff]` in pyproject.toml (target py312), add `format`/`lint` entries to its scripts consistent with root naming. Not wired into pre-commit yet. | `uv run ruff format --check .` and `uv run ruff check .` pass locally in apps/analytics. |
| 0.8 | ClickUp-as-tracker note | medium | One line in AGENTS.md: "Task tracking: ClickUp is the source of truth; GitHub Issues are not actively used." Close the single stale 2024 GitHub issue with a comment pointing to ClickUp. | AGENTS.md updated; GitHub issue list empty. |
| 0.9 | Flag registry note | low | New CODEBASE_NOTES.md subsection under "Frontend, PWA & CSP" or "Process & tooling": list active env-var feature flags (grep for `privatePreview` and similar), each with owner + removal criterion; state the feature-flag-platform skip as an accepted tradeoff (R5). | Section exists; readiness-scan red mark on feature flags is documented as accepted. |

### WS1 — CI integrity + fast feedback (highest leverage)

Order matters: fix correctness (1.1) before speed (1.2+).

| # | Item | Effort | Impact | What to do | Done when |
| --- | --- | --- | --- | --- | --- |
| 1.1 | Fix required-check context names | S | high | In `.github/workflows/cypress-testing.yml`: add a final summary job with the stable id/name `cypress-run` that `needs:` both variant jobs and fails if the one that ran failed (if-always + result check). In the two workflows colliding on `check` (`check-types.yml`, `check-syncpack.yml`) and three colliding on `test` (`test-util.yml`, `test-grading.yml`, `test-olat-api.yml`): rename job ids/names to unique ones (`check-types`, `check-syncpack`, `test-util`, `test-grading`, `test-olat-api`). Then update branch protection required contexts on `v3` to the exact new names (gh api or repo settings). **OWNER DECISION**: confirm the final required-context list. | Branch protection lists only contexts that demonstrably appear on every PR (verify with `gh pr checks` on a test PR); no orphan contexts remain. |
| 1.2 | Tier required vs advisory checks | M | high | Required fast tier: format, lint, check-types, check-syncpack, test-util, test-grading, test-graphql, test-olat-api (all ≤6 min). Move cypress off the PR-blocking list. **OWNER DECISION** between: (a) GitHub merge queue on `v3` — add `merge_group` trigger to cypress-testing.yml, enable queue in branch protection, e2e gates merges batched; or (b) post-merge cypress on `v3` push + failure alert + agreed revert policy. Playwright stays non-required (already true — formalize in the workflow comment). | Required tier completes <10 min on a real PR; e2e still runs for every merge (queued or post-merge). |
| 1.3 | Shard `cypress-run-cloud` | M | high | Copy the `strategy.matrix.containers: [1..10]` + cypress-split pattern from `cypress-run-parallel-draft` (cypress-testing.yml:43-46) onto the cloud job (currently no matrix, commented out at :256-259), keeping Cypress Cloud recording per shard. | Full cypress suite wall-clock ≤15 min wherever it runs. |
| 1.4 | Turbo affected scoping in CI | S | medium | In CI invocations only (not local scripts): add `--filter=...[origin/v3...HEAD]` to turbo lint/check runs. Rewrite `check-types.yml:36-49` (hardcoded serial `cd packages/X && pnpm run build` over 8 packages) to a single turbo-filtered build so it reuses remote cache. | check-types wall-clock drops on a small PR; unaffected packages show cache hits. |
| 1.5 | Rebalance playwright shards | S | medium | `playwright-testing.yml:34-38`: raise shardTotal 5 → 8–10. | Slowest shard ≤20 min (was 36m50s). |
| 1.6 | Close PR #4901 (act) | S | medium | Close with a comment: superseded by devcontainer stack (#5119+) for local verification and by WS1 tiering for fast feedback; act replay covered only a single cypress shard. | PR closed, comment posted, ClickUp 86caazdhp updated. |

### WS2 — Devcontainer consolidation + agent runtime

Resolves ClickUp task 86caazdhp ("one coherent path").

| # | Item | Effort | Impact | What to do | Done when |
| --- | --- | --- | --- | --- | --- |
| 2.1 | Land the stack in order | S | high | (1) Rebase #5119 onto `v3` (currently CONFLICTING), re-verify with a clean `devpod up`, merge. (2) Retarget #5120 to `v3`, merge (was MERGEABLE). (3) In #5138 fix the README corruption — a stray litellm table row is spliced mid-sentence into the Hatchet-token paragraph (pr diff lines 24–30); the row already exists in the services table, delete the insertion — then retarget + merge. Squash each separately to keep the per-tier validation trail. | All three merged to `v3`; `.devcontainer/` present on `v3`; readiness criterion "Dev Container" passes. |
| 2.2 | Close PR #3928 | S | medium | Close with comment: superseded by #5119 (Node 18/pnpm 8/Doppler/published-ports skeleton; no hatchet/seed/token wiring; nothing to salvage). | PR closed. |
| 2.3 | Keep #5081 (sandcastle) out of this track | S | low | It targets `v3-ai` and belongs to ClickUp 86caazdjm (park AI prototype branches). Note in both ClickUp tasks that it is excluded here; decide with `v3-ai`'s fate (see 5.2). | ClickUp notes added; no action on the PR itself. |
| 2.4 | Make devrouter optional | M | high | Blocker for headless/cloud use: `.devcontainer/docker-compose.yml` declares `devnet: external: true`; cloud agents never run `dev up`, so compose fails at network resolution. Split: base compose uses an internal bridge network; optional `docker-compose.devrouter.yml` overlay adds the external devnet + Traefik labels when devrouter is present. Add a plain-localhost env profile (COOKIE_DOMAIN, NEXTAUTH_URL, APP_ORIGIN_* currently hardcoded to `*.klicker.localhost`). | `docker compose up` succeeds on a host with no devrouter/mkcert; devrouter mode still works via overlay. |
| 2.5 | forwardPorts / published ports | S | high | Add `forwardPorts` to `.devcontainer/devcontainer.json`: 3000, 3001, 3002, 3003, 3010 (+3030/7078/4000/3004 as tiers land). | From inside the container, `curl localhost:3000/healthz` (and each app port) responds without devrouter. |
| 2.6 | Conditional mkcert mount | S | medium | Compose bind-mounts `${HOME}/Library/Application Support/mkcert/rootCA.pem` (macOS-only default). Make the mount part of the devrouter overlay only (belongs with 2.4), or guard via an entrypoint existence check. | Container boots on Linux/CI hosts without the file. |
| 2.7 | Measure + budget postCreate | M | medium | First: time a cold `devpod up` end-to-end and record the number in `.devcontainer/README.md`. Then: parallelize the turbo build with the Hatchet-token wait in `post-create.sh` (independent; worst-case retry sleeps alone ~205s today), and evaluate pre-baking pnpm store/turbo cache into the image. Target: cold setup within Copilot's 59-min cap with margin; ideally <15 min. | README documents measured cold-boot time; postCreate wall-clock reduced vs baseline. |
| 2.8 | Optional e2e browser stage | M | medium | Dockerfile (node:20-bookworm-slim) has no browser deps. Add an optional image stage or install script running `npx playwright install --with-deps chromium` (~300MB), plus README docs for the e2e BASE_URL (devrouter hostname or forwarded port). Keep opt-in. | An agent inside the devcontainer can run one playwright spec end-to-end. |
| 2.9 | Cloud-agent adapters | S | medium | Per R2: add `.github/workflows/copilot-setup-steps.yml` (~20 lines: checkout, pnpm install, build shared packages) if Copilot coding agent is wanted (**OWNER DECISION**); add an AGENTS.md note on the Codex-cloud two-phase secrets model (Infisical calls belong in setup phase only); Jules needs nothing beyond AGENTS.md. | Adapter file(s) merged or decision recorded here as skipped. |
| 2.10 | "Agent runtime support" README section | S | medium | Section in `.devcontainer/README.md`: apps covered per tier (analytics/office-addin/docs are skipped by design), devrouter optionality, forwardPorts headless path, e2e status, measured boot time (2.7). | Section exists and matches reality. |

### WS3 — Testing: fast, deterministic agent feedback

| # | Item | Effort | Impact | What to do | Done when |
| --- | --- | --- | --- | --- | --- |
| 3.1 | Wire apps/chat tests into CI | S | high | New `.github/workflows/test-chat.yml` modeled on `test-util.yml`: checkout, pnpm install, build chat's workspace deps (prisma/types/graphql), run `pnpm --filter @klicker-uzh/chat run test:run`. Trigger on `apps/chat/**` + workflow file paths. The 9 vitest files are plain node-env, no infra needed. Add the new context to the required tier (WS1.2). | Chat tests run on PRs touching apps/chat; a deliberately broken test blocks the PR. |
| 3.2 | Wire packages/word-cloud tests into CI | S | medium | Same pattern: `test-word-cloud.yml`, `pnpm --filter @klicker-uzh/word-cloud test`. Currently zero workflows reference the package. | Suite runs in CI on relevant paths. |
| 3.3 | graphql subset runner fast path | S | high | `packages/graphql/test/run-tests-local.sh` already accepts a vitest filter as `$1` but unconditionally runs `docker compose down --volumes` + up + sleep 15 + rebuilds 5 packages. Add a skip-infra mode: probe postgres:5432 and hatchet:8888; if both respond, skip compose+reset+rebuild and run vitest directly. | With infra already running, one graphql test file completes in <60s. |
| 3.4 | Single-spec e2e fast path | M | high | `package.json` `dev:playwright` runs `turbo run dev:test --concurrency 30` with no filter (boots ~14 packages). Add scoped variants (e.g. `dev:playwright:core`) using turbo dependency-aware `--filter` for backend-docker + auth + one frontend. | A login-flow spec runs against a scoped boot; cold time <5 min. |
| 3.5 | Per-spec service map in skills | S | high | Add a table to `.agents/skills/klicker-playwright-e2e/SKILL.md` (mirror in klicker-cypress-e2e): spec pattern → required services. Most specs: backend+auth+one frontend; `O-live-quiz`/`V-template`: + response-api + both hatchet workers (today only in CODEBASE_NOTES.md:63–64). | Skill answers "what do I boot for spec X" without tribal knowledge. |
| 3.6 | Flaky-test minimum | S | medium | Cypress: add `retries: { runMode: 1, openMode: 0 }` to `cypress/cypress.config.ts` (none today). Playwright: CI step parsing `test-results/junit.xml` for passed-on-retry tests → workflow summary annotation. No flaky-test SaaS. | Retry policy consistent across both suites; retried-pass tests visible in the workflow summary. |
| 3.7 | Document singleFork tradeoff | S | medium | CODEBASE_NOTES.md "Testing & CI" entry: all vitest configs set `poolOptions.forks.singleFork: true` because graphql/grading/util tests share mutable Prisma/Redis/Hatchet fixtures (`packages/graphql/test/helpers.ts`); parallelizing without isolation rework causes flaky corruption. Real fix deferred (see Non-Goals). | Note merged; future agents stop deleting singleFork. |
| 3.8 | Naming + zero-test-app triage notes | S | low | CODEBASE_NOTES.md: vitest suites `test/*.test.ts`; playwright specs `playwright/tests/<Letter>-<name>.spec.ts` (letter prefix = Cypress parity ordering). Plus the explicit defer rationale for zero-test thin apps (Non-Goals row). | Both notes merged. |

### WS4 — Observability: minimal, agent-debuggable

| # | Item | Effort | Impact | What to do | Done when |
| --- | --- | --- | --- | --- | --- |
| 4.1 | Shared pino logger with redaction | M | high | Thin wrapper in `packages/util` (pino already proven in hatchet-worker-general): standard fields (service, requestId), pino `redact` list for auth/magic-link tokens, JWTs, emails. Adopt in backend-docker, response-api, both workers, lti. Redact list = starting point, not a compliance guarantee. | All five backend processes emit JSON logs through the wrapper; a log line containing a JWT field shows `[Redacted]`. |
| 4.2 | Request-id propagation | S | medium | Generate/propagate `x-request-id`: response-api → Hatchet event payload (additive optional field) → workers, bound into pino child loggers. Depends on 4.1. No OpenTelemetry. | One student response traceable across response-api + worker logs by grepping a single id. |
| 4.3 | Sentry for response-api + workers | S | medium | Reuse backend-docker's `@sentry/node` setup pattern + env-var names verbatim for response-api and both hatchet workers. Skip frontends. Check Sentry plan quota before enabling. | Errors from all three services appear in Sentry with service tags. |
| 4.4 | Deepen health endpoints | S | high | backend-docker `/healthz` (src/app.ts:190) and response-api (src/index.ts:355-361) return bare "OK". Add a dependency-aware readiness variant (Prisma `SELECT 1`, Redis PING → 503 on failure) wired to the Helm readinessProbe; keep livenessProbe on the shallow check. Add a minimal `/healthz` HTTP listener to both hatchet workers (headless today). | Killing postgres makes readiness go 503 while liveness stays 200; workers answer `/healthz`. |
| 4.5 | RUNBOOKS.md | S | medium | New `project/RUNBOOKS.md`, 4–6 entries mined from CODEBASE_NOTES.md's recurring failure modes (Hatchet token/DB mismatch, worker not consuming, PersistedQueryOnly in prod, Redis refused, Helm/ArgoCD rollback). Format per entry: symptom → likely cause → fix command → where to look. Link from AGENTS.md. Only already-observed failure modes; no speculative content. | File exists, linked from AGENTS.md. |
| 4.6 | Deploy notification | S | low | Final step in the prd deploy workflows: GitHub deployment status (free, no new secret) or Slack webhook (**OWNER DECISION** which). Include app name + SHA + result. | Every prd deploy leaves a visible success/failure signal outside the Actions log list. |

### WS5 — Agent tooling & repo hygiene

Existing skills (`.agents/skills/`): agent-browser, cypress-author, klicker-cypress-e2e, klicker-playwright-e2e, playwright-best-practices, playwright-cli, vercel-react-best-practices, web-design-guidelines — all test/browser/frontend-oriented. The recurring backend workflows agents fumble (per CODEBASE_NOTES.md gotchas) have no skill coverage.

| # | Item | Effort | Impact | What to do | Done when |
| --- | --- | --- | --- | --- | --- |
| 5.1 | Worktree sprawl triage | S | medium | ~18 registered worktrees, several as visible `trees/*` siblings (audit-log, landing-updates, sandcastle, worktree-mcp, …). One-time manual triage: `git worktree list --porcelain`, check each for uncommitted work + merged/abandoned branch status, then **OWNER DECISION** per removal (name path, branch, exact `git worktree remove` command). | Only active worktrees remain; `trees/` either empty or gitignored-hidden going forward. |
| 5.2 | Sandcastle (#5081) disposition | S | low | Decide with `v3-ai`'s fate. Once the devcontainer is the agent runtime, sandcastle's Docker-isolated-copy niche shrinks. Park or close explicitly (ClickUp 86caazdjm), don't let it rot. | Decision recorded in ClickUp + PR comment. |
| 5.3 | Skills-location consistency | S | medium | Devcontainer PR branches carry `.factory/skills/` duplicating `.agents/skills/` — drift risk. On merge (2.1): keep `.agents/` canonical, make `.factory/skills` a symlink like `.claude/skills`/`.github/skills`, or delete it. | One canonical skills dir; duplicates gone or symlinked. |
| 5.4 | New skill: klicker-dev-workflows | M | high | One skill (not five) covering the recurring backend dances agents get wrong, with exact commands + failure modes: (a) GraphQL change → `pnpm --filter @klicker-uzh/graphql generate` → why ops go stale; (b) Prisma change → `prisma:migrate` → `prisma:sync` → client regen; (c) seed/reset flows (`prisma:setup` vs `prisma:reset` vs `seed:interactions`, non-idempotency caveats); (d) Hatchet debugging (token minting, worker not consuming, which env vars); (e) Infisical injection basics + `dev:raw` fallback. Source material already exists in AGENTS.md + CODEBASE_NOTES.md — the skill packages it task-shaped. | Skill exists in `.agents/skills/klicker-dev-workflows/`; an agent asked to "add a field to a Prisma model and expose it in GraphQL" follows the right sequence without prompting. |
| 5.5 | CODEBASE_NOTES freshness ritual | S | low | Add one line to the PR template (0.3): "CODEBASE_NOTES.md updated? (new gotcha discovered / stale entry removed / n.a.)". Cheapest sustainable freshness mechanism; no tooling. | Template line present; notes keep receiving updates. |

## Execution Checklist (PR by PR)

Each PR: branch from `v3`, conventional-commit title, fill the PR template, run `pnpm run check:all` locally, get review. UI-adjacent changes need agent-browser screenshot verification per AGENTS.md.

1. **PR A — quick wins** (WS0.1–0.9). All file-adds + doc edits; no behavior change. Gate: owner confirms CODEOWNERS list (0.1).
2. **PR B — CI context integrity** (WS1.1). Workflow job renames + branch-protection update (do the protection update immediately after merge; it's a settings change, not a file). Gate: owner confirms required-context list.
3. **PR C — CI tiering + sharding** (WS1.2, 1.3, 1.4, 1.5). Gate: owner picks merge-queue vs post-merge for cypress. Close #4901 (1.6) alongside.
4. **Devcontainer landing** (WS2.1–2.3): not new PRs — rebase/retarget/merge the existing stack, close #3928, annotate #5081. Gate: reviewer runs clean `devpod up` per #5119's checklist.
5. **PR D — devcontainer hardening** (WS2.4–2.8, 2.10, 5.3). Gate: verify compose-up-without-devrouter on a Linux host or CI job. Optional PR D2 for 2.9 adapters (owner decision).
6. **PR E — testing feedback loops** (WS3.1–3.8). 3.1/3.2 first — CI-blind suites are live regression risk.
7. **PR F — observability minimum** (WS4.1–4.6). 4.1 first; 4.2/4.3 depend on it. Gate: Sentry quota check; owner picks deploy-notification channel (4.6).
8. **PR G — agent tooling** (WS5.4, 5.5). Plus the one-time manual 5.1 worktree triage (owner-approved) and 5.2 decision.
9. **Re-scan**: run Factory Agent Readiness again on `v3`; append the delta to Progress below; spawn follow-ups for surviving red criteria that aren't documented skips.

## Verification

- Re-run the Factory scan after PR F: target >80% overall; Testing and Observability out of the red band; accept documented-skip reds.
- Required PR feedback wall-clock <10 min (measure on a real PR after PR C).
- One graphql test file against running infra <60s (after PR E).
- One playwright spec with scoped boot <5 min cold (after PR E).
- `docker compose up` in `.devcontainer/` succeeds with no devrouter on the host; in-container curl of each forwarded port (after PR D).

## Risks

- Moving e2e off PR-blocking changes merge-safety semantics — explicit owner decision; mitigation: merge queue keeps e2e gating merges (batched), or post-merge run + agreed revert policy.
- #5119 rebase may surface substantial conflicts (last updated 2026-06-18); re-run its full validation checklist after rebase.
- Devcontainer dual-mode (devrouter vs plain) doubles the env matrix; keep the plain profile minimal and document both in 2.10.
- Runbooks + redact lists rot; both scoped to already-observed failure modes only; PR-template line (5.5) is the maintenance mechanism.
- Dependabot noise; mitigated by weekly + grouped + majors-manual config.
- Cypress Cloud sharding (1.3) multiplies recorded parallel runs — check Cypress Cloud plan limits before enabling.

## Progress

- 2026-07-06: Plan created from readiness report + 6-PR review + multi-agent audit.
- 2026-07-06: **PR A — Quick Wins** implemented and verified. All linting, formatting, typechecking, syncpack, check:prisma-sync, and check:agents-md pass successfully.
- 2026-07-06: **PR B — CI context integrity** committed (`c5ced11a80`): job renames + job-level path filtering; `playwright-testing.yml` → `test-playwright.yml`. Note: branch-protection contexts on `v3` still need updating to the renamed jobs (settings change, owner action).
- 2026-07-06: **Devcontainer consolidation** done on `feat/devcontainer-devnet`: #5120 + #5138 merged in, devrouter made optional via `docker-compose.devrouter.yml` overlay + localhost port publishing + post-start fallback (covers 2.1 stack + 2.4–2.6). #5119 is MERGEABLE but held per owner instruction.
- 2026-07-06: **PR C — CI scoping** (handoff takeover): check-types.yml serial builds → turbo-filtered build (1.4); playwright shards 5→8 (1.5). `pnpm run check:all` passes. Pending: commit+push, close #4901 (1.6) and #3928 (2.2).
- 2026-07-06: **/simplify pass** over the branch: extracted the 7× duplicated path-filter bash into `.github/actions/changed-paths` (fixes the shallow-clone bug — the old three-dot diff has no merge base on `fetch-depth: 1` checkouts and would have failed every PR run; push events now deepen by 1 and fail open instead of silently skipping); added `test-graphql-status` / `test-playwright-status` always-reporting gate jobs so those workflows are usable as required checks despite path-filter skips; restored path gating on check-lint; check-types got `fetch-depth: 0` (turbo change-filter needs a merge base) and lost the silent `|| full build` fallback; `check-agents-md.mjs` slimmed 180→~75 lines (dead machine-specific `file://` branch and lifecycle allowlist removed); `check-prisma-sync.sh` now reuses `sync-schema.sh`; dependabot `cooldown: 14` added (aligned with pnpm `minimumReleaseAge`). Kept 8 playwright shards (justified by measured shard imbalance 36m50s vs 14–17m); check-format left ungated (prettier covers nearly all file types, a filter would be near-universal).
- 2026-07-08: PR 5140 changes (CI integrity, path-filtered checks, and tooling quick wins) fully implemented and polished, including all outstanding reviews and quality improvements (B1 setup-uv, B2 check-types scoping, B3 analytics schema tracking, M2 status check hardening, M3 setup-node integration, M5 CODEOWNERS). Pushed to GitHub and triggered CI.
- 2026-07-08: Pulled latest `v3` into the branch, resolved all merges cleanly, and updated the engineering wiki documentation (`docs/ci-and-deployment.md`, `docs/testing.md`) to align with the changes.

## Next Steps

1. Wait for PR 5140 checks to finish and merge it into `v3`.
2. Update branch-protection required contexts on `v3` to point to the renamed/hardened contexts (settings change, owner action).
3. Proceed with the devcontainer landing (WS2) and subsequent workstreams (WS3 testing feedback loops, WS4 observability).
