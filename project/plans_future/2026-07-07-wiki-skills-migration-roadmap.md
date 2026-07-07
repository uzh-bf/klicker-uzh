# Wiki & Skills Migration Roadmap (tRPC · Mastra · Playwright)

Companion to PR #5145 (engineering wiki + skills). Three strategic migrations are in flight; this plan maps each to the wiki pages and skills it invalidates, staged by concrete repo triggers. Written 2026-07-07 from open-PR evidence.

## Governing principles

1. **Wiki documents reality, not intent.** Pages change when the code merges, not when the decision is made. The only pre-merge edits are *status banners* marking a page as migration-affected, so agents don't build on sand.
2. **Same-change-set rule applies to the migration PRs themselves.** Each phase below is a checklist for the PR that lands the change (enforced via `klicker-wiki-maintenance`), not a separate docs project.
3. **Coexistence phases get explicit routing rules** ("new work goes to X, touch Y only for fixes") — the most dangerous window for agents is dual-stack ambiguity.

## Signals (open PRs / merged commits)

| Migration | Evidence | State |
| --- | --- | --- |
| GraphQL → tRPC | PR #5132 (non-draft, 203 commits, 664 files): `packages/api` tRPC package, `/api/trpc` mounted beside `/api/graphql`, React Query clients, **Apollo already removed from frontend-control**, pwa/manage Apollo retained until an explicit "S06 cleanup gate". Plan: `project/plans_future/graphql-to-trpc-dual-api-migration/FULL_IMPLEMENTATION_PLAN.md`. New `test-api.yml` CI. | Review-ready, dual-API |
| AI SDK → Mastra | PR #5126 (draft): new `apps/chat-api` Mastra-backed service (SSE chat, credits/threads services, model registry copy), chat app proxies to it; OpenRouter smoke CI. PR #5129 (draft): tutor architecture on top (TutorEvent Prisma table, TutorBench evals under `project/evals/`). Eval reports already in `project/plans_future/2026-06-1*-mastra-*.md`. | Prototype |
| Cypress → Playwright | Decision made; parity suite landed on v3 (`8119fd53e`, `d6c7772f8` chat specs). Cypress suite + CI still present and running. | Switched, Cypress not yet removed |

Adjacent open PRs that will also invalidate wiki pages (watchlist, not planned here): #5119 devcontainer+devrouter (getting-started; revisits plan decision D3 "no devcontainer"), #4762 helm→kustomize (ci-and-deployment), #4906 Hono response-api (async-and-workers), #5091/#5111 Next 16/React 19.2/TS6 (frontend-conventions, getting-started toolchain), #5074 MCP server app + #5078 KB control plane + #5109 embedded assistant (architecture app map, possible ai-platform scope growth).

---

## 1. GraphQL → tRPC

### Phase T0 — now (before #5132 merges) — DONE 2026-07-07

- ~~Add a short status banner to `docs/graphql-api-layer.md` and `docs/architecture-overview.md`~~ Done (banners on both pages).
- **Coordination risk:** #5132 edits `AGENTS.md` and `.agents/skills/klicker-playwright-e2e/SKILL.md` → conflicts with #5145. Recommend merging #5145 (docs-only) first and rebasing #5132 onto it — the migration PR then gains a wiki to document itself in.

### Phase T1 — trigger: #5132 merges (dual API, GraphQL still primary for pwa/manage)

Wiki:

- `architecture-overview.md` — second mount `/api/trpc`, `packages/api` in the package map, per-app client table (control = tRPC/React Query, **no Apollo**; pwa/manage = Apollo + tRPC shells). Scope the persisted-query lead to "GraphQL clients only" — tRPC has no codegen/persisted-hash contract, which retires the page's #1 warning for tRPC paths.
- NEW `trpc-api-layer.md` — router/procedure conventions in `packages/api`, how the three-layer auth pattern translates (verify against the merged code — do NOT assume `withPermission` parity), React Query client patterns, error conventions, testing (`packages/api` vitest + `test-api.yml`).
- `graphql-api-layer.md` — coexistence header: which apps still consume it, "no new GraphQL endpoints unless the feature is pwa/manage-only and pre-S06" (confirm exact routing rule with maintainers — flagged, not assumed).
- `developing-a-feature.md` — step 4/5 fork by API surface; add a tRPC-era worked-example commit once one exists.
- `testing.md` — add `packages/api` vitest row + CI workflow.
- `frontend-conventions.md` — data-fetching section becomes per-app (Apollo vs React Query); "generated documents only" scoped to remaining Apollo apps.

Skills:

- NEW `klicker-trpc-api` — mirror of `klicker-graphql-api` build order for the tRPC stack (write from merged code, not from the PR description).
- `klicker-graphql-api` — description gains "(legacy surface during tRPC migration)" + routing note to the new skill.
- `klicker-feature-design` — question 2/3 updated: choose API surface first; auth question covers both idioms.
- `klicker-environment-doctor` — check 3 (stale codegen) marked GraphQL-only.
- `klicker-frontend-ui` — data-wiring step forks by app.

### Phase T2 — trigger: S06 cleanup gate approved + Apollo/GraphQL removal merges

- Delete `graphql-api-layer.md` (log a **Deprecation** entry; grep repo for inbound links); `trpc-api-layer.md` becomes the API page; `architecture-overview.md` gets a new lead (persisted-query warning dies entirely — likely successor: three-layer auth or whatever the tRPC auth sharp edge turns out to be).
- Purge codegen ritual from: `developing-a-feature.md`, `frontend-conventions.md`, `klicker-environment-doctor` (drop check 3), `testing.md`, AGENTS.md "GraphQL Workflow" section + tech-stack table rows (GraphQL Yoga/Pothos/Apollo).
- Delete `klicker-graphql-api` skill; update index routing + `klicker-wiki-maintenance` change-map row ("Pothos schema…" → "tRPC routers…").
- `auth-model.md` — re-verify: CSRF header, persisted-op gating, `x-graphql-yoga-csrf` mentions.

---

## 2. AI SDK → Mastra

### Phase M0 — now — DONE 2026-07-07

- No content rewrites (prototype PRs are draft); `chat-platform.md` keeps documenting current AI-SDK reality. Added a migration-in-flight banner (per principle 1) pointing at #5126/#5129.

### Phase M1 — trigger: #5126 merges (chat-api service beside chat app)

- `chat-platform.md` — restructure: `apps/chat` (UI, assistant-ui stays) vs `apps/chat-api` (Mastra runtime: SSE chat route, credits/threads/disclaimers services, own model registry + auth lib). Document the proxy contract and which env vars move (`CHAT_MODEL_REGISTRY_JSON`, fallback/credits config — verify at merge; several current gotchas migrate server-side).
- `architecture-overview.md` — app map + request-flow row for chat-api; port/compose entry if added.
- `testing.md` — OpenRouter smoke workflow (non-blocking until `OPENROUTER_API_KEY` secret exists — note honestly).
- `klicker-environment-doctor` — chat-api service in bring-up/health checks if it joins compose.

### Phase M2 — trigger: tutor layer (#5129) / Mastra becomes the chat backbone

- Decide page split: `chat-platform.md` (product surface) + NEW `ai-platform.md` (Mastra agents/workflows/memory, TutorEvent telemetry, TutorBench + `project/evals/` harnesses, retrieval contract) — one page won't hold both; the MCP/KB PRs (#5074/#5078/#5109) push the same direction.
- `domain-model.md` / `data-and-migrations.md` — TutorEvent table + any later tutor tables.
- Revisit plan decision D4 ("no chat skill in v1"): a `klicker-ai-platform` skill (Mastra agent/workflow/eval procedures, DeepEval/TutorBench routing) becomes justified once ≥2 engineers work that surface. Defer until M2 is real.

---

## 3. Cypress → Playwright

### Phase P0 — now (decision made, both suites still in repo) — DONE 2026-07-07

Small honest edits — reality is "both run, Playwright is where investment goes" (all three landed, plus the `docs/index.md` routing line):

- `testing.md` — reframe: Playwright = primary/growing suite (new specs land there), Cypress = frozen parity suite pending removal; keep the dual-stack table until removal actually happens.
- `klicker-testing-verification` — routing row: new e2e specs → Playwright only; touch Cypress only to keep legacy green.
- `klicker-cypress-e2e` — description gains "(legacy — no new specs; suite frozen pending removal)".

### Phase P1 — trigger: Cypress directory/CI removal merges

- `testing.md` — drop dual-stack table, Cypress CI rows, `dev:test`/`start:test` Cypress ownership; Playwright seed becomes the only e2e seed.
- `data-and-migrations.md` + `klicker-data-model` — seed table 3 paths → 2.
- `frontend-conventions.md` — `data-cy` note: attribute name presumably survives (Playwright `testIdAttribute` already reads it) — verify no rename lands with the removal.
- `getting-started.md` / `klicker-environment-doctor` — `_run_app_dependencies.sh` cypress mode, `dev-cypress` Infisical env references.
- `ci-and-deployment.md` — CI matrix rows; `architecture-overview.md` untouched.
- Delete `klicker-cypress-e2e` skill (index routing + `klicker-wiki-maintenance` map + AGENTS.md roster in the same change).
- Re-check `klicker-playwright-e2e` "Cypress parity" sections — parity rules become historical once the source suite is gone; rewrite as plain authoring rules.

---

## Cross-cutting

- Every phase updates in the same change set: `docs/index.md` (descriptions/routing), `docs/log.md`, `klicker-wiki-maintenance` change-map, AGENTS.md quick-reference (tech-stack table rows: GraphQL Yoga+Pothos, Apollo, Cypress; "GraphQL Workflow" section; skill roster).
- `WIKI_BOOTSTRAP_INVENTORY.md` / `BRINGUP.md` are frozen evidence — never retro-edited; new claims need fresh verification at each phase.
- Each phase = one wiki/skills checklist item inside the migration PR, executed by whoever lands it, per the same-change-set rule — not a separate docs branch.

## Recommended immediate actions (this branch / next)

1. Merge #5145 before #5132 to minimize AGENTS.md / playwright-skill conflicts; rebase #5132.
2. Land Phase T0 banners + Phase P0 reframe now (small, truthful today) — either on this branch pre-merge or as an immediate follow-up PR.
3. Confirm with maintainers: the dual-phase routing rule for new endpoints (tRPC-first?), and whether S06/Cypress-removal have target dates — those dates order T2/P1.
