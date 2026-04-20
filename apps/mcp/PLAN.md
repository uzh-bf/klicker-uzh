# KlickerUZH MCP — Build Plan

Living tracker for the `apps/mcp` POC. Updated at the end of every iteration.

## Principle

The MCP server is a **thin adapter** over the KlickerUZH GraphQL API. No learning logic, analytics, or recommendation math lives here. Anything computed over more than one field moves to a backend service so it can also power personal analytics in the PWA and the lecturer cockpit.

## Scope

**In:** Category A tools (wrappers over ops that already accept the student/lecturer role today), Category B tools (wrappers over new `asParticipant`-gated queries that expose already-computed data), Category C tools (wrappers over new backend aggregation queries), OAuth bridge delegating to `apps/auth`, persisted-query GraphQL client, Docker + Helm + Traefik surface.

**Out (for now):** Category D — recommendation engines, study plans, self-graded free-text, competency pipeline, peer-generated content. These are separate backend initiatives.

## Architecture at a glance

Python 3.12 · uv-managed project · FastMCP v3.2 · Streamable HTTP transport · port 7079 · `https://mcp.klicker.com`. Stateless except for a small auth code/refresh-token store (in-memory for dev, Redis for prod) introduced in iteration 5. GraphQL calls go out as APQ-shaped POSTs to `api.klicker.com/graphql` with the user's KlickerUZH JWT on `Authorization: Bearer`. Persisted-query SHA-256 hashes are generated at build time from `@klicker-uzh/graphql/dist/server.json`.

## Iteration status

| #   | Title                                                    | Status | Hash                                     |
| --- | -------------------------------------------------------- | ------ | ---------------------------------------- |
| 1   | Skeleton + PLAN.md                                       | done   | `d419d767a`                              |
| 2   | GraphQL client + persisted-ops codegen + poe tasks       | done   | `496d0b191`                              |
| 3   | Category A lecturer tools (question authoring as drafts) | done   | `a00e38c70`                              |
| 4   | Category A participant tools (quiz discovery + response) | done   | `ab03aad1e`                              |
| 5   | OAuth bridge (MCP auth server + apps/auth routes)        | done   | `01916b826`                              |
| 6   | Backend Category B exposure queries + MCP tools          | done   | `d520532b5` (backend), `4557252a5` (MCP) |
| 7   | Backend Category C aggregation + MCP tools               | done   | `f64971a26` (backend), `4557252a5` (MCP) |
| 8   | Deploy surface (Dockerfile, Traefik, Helm)               | done   | `f555aaec0`                              |
| 9   | Participant-analytics MCP tools + shared test helpers    | done   | `4557252a5`                              |

## Iteration 1 — Skeleton + PLAN.md

**Goal:** Prove the Python app exists and boots inside the monorepo's tooling: uv resolves deps, pyright type-checks clean, pytest runs, Turborepo sees the package, Docker builds.

**Deliverables:** `apps/mcp/` with `pyproject.toml`, `src/klicker_mcp/` package (`server.py`, `settings.py`, `logging.py`, `main.py`), single placeholder `whoami` tool, pytest skeleton, Dockerfile, `package.json` stub for Turborepo.

**Verification:** `uv sync` succeeds · `uv run pytest` passes · `uv run python -c "from klicker_mcp.server import mcp"` prints nothing (i.e. imports clean) · `uv run python -m klicker_mcp.main` boots and serves on the configured port (local smoke only, not required for commit).

**Commit:** `feat(mcp): scaffold apps/mcp with FastMCP v3 skeleton`.

## Iteration 2 — GraphQL client + persisted-ops codegen + poe tasks

**Goal:** Any tool can call a GraphQL op by name, forwarding the user's Bearer token. Production-safe: no ad-hoc GraphQL. Common dev actions run as poe tasks so the same verb works from `apps/mcp` or via Turborepo.

**Deliverables:** `gql/client.py` (`AsyncGraphQLClient`, httpx-based, APQ shape). `scripts/gen_ops.py` reads `packages/graphql/src/public/server.json` and regenerates `src/klicker_mcp/gql/ops.py` — currently 283 operations. Auth helper `auth/context.py` pulls the Bearer header from the current FastMCP HTTP request. `whoami` rewired to call the real `Self` query. `[tool.poe.tasks]` covers sync/test/check/lint/format/dev/gen-ops + an `all` sequence. `package.json` thin-wraps them for Turborepo.

**Verification:** `uv run poe all` runs format-check → ruff → pyright → pytest end-to-end. 19 tests cover auth extraction, client shape, error propagation, unknown-op rejection, shared-client lifecycle, and whoami wiring. Boot smoke confirmed on port 7079.

## Iteration 3 — Lecturer tools

**Goal:** A lecturer-scoped MCP client can create draft questions of every supported element type and list existing questions in their pool.

**Deliverables:** Six tools — `create_choices_question` (SC/MC/KPRIM), `create_free_text_question`, `create_numerical_question`, `create_flashcard`, `create_content_element`, `list_my_questions`. All create tools default `status=DRAFT` so LLM-authored questions never reach students without human review. Pydantic models (`Choice`, `NumericalRange`, `NumericalRestrictions`, `FreeTextRestrictions`) carry rich descriptions so the LLM receives a proper JSON schema. Module layout was split so `app.py` holds the `FastMCP` instance, `server.py` imports `tools/` for registration side-effects, and role-scoped tool files can grow without circular imports.

**Verification:** `uv run poe all` green — 28 tests including explicit checks that DRAFT is the default, pydantic options marshal correctly (including the camelCase `minLength`/`maxLength` alias for `FreeTextRestrictions`), None-valued arguments are dropped so the backend applies its own defaults, bearer-token absence raises `NotAuthenticatedError`, and every expected tool name is registered on the shared `mcp` instance.

Promote-to-ready and per-element-type option schema resources are deferred — they can land as follow-ups after OAuth so real usage signals what to refine.

## Iteration 4 — Participant tools

**Goal:** A participant-scoped MCP client can discover practice quizzes, open a stack, submit a response, bookmark, flag, rate, and post to the live Q&A channel. All category-A data is exposed for chatbot reasoning.

**Deliverables:** 21 tools in `tools/participant.py` wrapping existing persisted ops — courses/quizzes/microlearning read, overview/leaderboard/achievements/timeline/assessment/groups read, bookmarks read, live Q&A read, plus write paths: `submit_stack_response` (hero), `bookmark_stack`, `flag_element`, `rate_element`, `post_live_qa_question`, `upvote_live_qa`, `send_confusion_signal`. Pydantic `StackResponse` + `ChoicesResponse` models marshal the union-shaped `StackResponseInput` (including the intentional backend typo `contentReponse`). `optional_bearer_token()` helper for the open-field `GetPracticeQuiz` / `GetMicroLearning` reads. Backend role guards (`asParticipant`) remain authoritative; MCP just forwards the JWT.

**Verification:** `uv run poe all` green — 53 tests total (25 new), covering per-op operation-name + persisted-sha256 + variable shape, `StackResponse` marshalling for all element types, optional-token passthrough, and a full registration sanity check.

## Iteration 5 — OAuth bridge

**Goal:** An external MCP client (Claude Desktop / Cursor) can complete an OAuth 2.1 dance against the MCP and end up able to call tools as the signed-in KlickerUZH user, with no new user database.

**Deliverables:**

- MCP side: `auth/oauth.py` wraps FastMCP's `OAuthProxy` with a `JWTVerifier(algorithm="HS256", public_key=APP_SECRET)` so the proxy validates KlickerUZH JWTs without local key infrastructure. OAuth is opt-in — unset envs mean pass-through mode, preserving the iteration 2–4 dev loop. `main.py` attaches the proxy to the shared `mcp` instance at boot. `auth/context.py` grows a two-tier fallback: prefer `get_access_token()` (OAuth mode), fall back to the raw `Authorization` header (pass-through), so tools transparently forward the right JWT in either mode.
- Upstream side: two new Next.js Pages-Router routes in `apps/auth/src/pages/api/mcp/`. `authorize.ts` enforces the client-id pin, checks the NextAuth session (lecturer or participant cookie depending on `scope`), redirects through the existing sign-in flow if missing, then mints a PKCE-bound authorization code and redirects back to the proxy. `token.ts` validates the client secret + PKCE `S256` digest and returns a 12h HS256 JWT the backend's `jwtMiddleware` already accepts. An in-process `_store.ts` (1 min TTL) holds codes for the POC; production will swap to Redis.
- New envs: `MCP_ORIGIN`, `MCP_UPSTREAM_CLIENT_ID`, `MCP_UPSTREAM_CLIENT_SECRET`, `MCP_UPSTREAM_AUTHORIZE_URL`, `MCP_UPSTREAM_TOKEN_URL`, `MCP_UPSTREAM_ISSUER`, `MCP_STORAGE_URL`, all added to `turbo.json` globalEnv.

**Verification:** `uv run poe all` green — 60 tests total (7 new for OAuth): proxy-builder opt-in behaviour, bearer-token fallback chain (OAuth wins over header, header wins when OAuth ctx errors or is absent). End-to-end manual validation against Claude Desktop deferred until iteration 8 deploys the routable domain.

## Iteration 6 — Backend Category B exposure

**Goal:** The student can read their own rows of the already-computed analytics tables. This is the highest-leverage backend change.

**Deliverables (backend, done in this iteration):**

- `packages/graphql/src/schema/analytics.ts` — new Pothos types `ParticipantAnalytics`, `MyResponse`, `MyResponseHistoryPage`, `MySRSEntry`, and the `AnalyticsType` enum. Existing `ParticipantPerformance` + `ParticipantActivityPerformance` types reused.
- `packages/graphql/src/services/analytics.ts` — three new service functions: `getParticipantCourseAnalyticsSelf`, `getParticipantPerformanceSelf`, `getParticipantActivityPerformanceSelf`. All filter by `participantId = ctx.user.sub` so rows of other participants are unreachable.
- `packages/graphql/src/services/participants.ts` — `getMyResponseHistory` (paginated, correctness-filtered) and `getMySRSStateSelf`. Join through `ElementInstance → Element` for the element metadata the MCP needs.
- `packages/graphql/src/schema/query.ts` — five new `asParticipant`-gated queries: `participantCourseAnalytics`, `participantPerformance`, `participantActivityPerformance`, `myResponseHistory`, `mySRSState`.
- `packages/graphql/src/graphql/ops/` — five new `.graphql` files for the query operations.

**Codegen step (user-driven):** `pnpm --filter @klicker-uzh/graphql generate` regenerates `server.json` / `client.json` with the new persisted-query hashes. Then `uv run poe gen-ops` (from `apps/mcp`) rewrites `src/klicker_mcp/gql/ops.py`. Without that step, calling the new ops from the MCP side throws `UnknownOperationError`.

**Deliverables (MCP, landed after codegen):** `get_my_course_analytics` (with optional client-side timeframe filter), `get_my_performance`, `get_my_activity_performance`, `get_my_response_history`, `get_my_mistakes` (reshape of `get_my_response_history` with `correctness_in=[WRONG, PARTIAL]` hard-coded in the tool body), `get_my_srs_state`. All live in `tools/participant_analytics.py`, follow the iteration 4 pattern, and are covered by `tests/test_participant_analytics_tools.py`.

**Verification (backend):** Because the worktree doesn't have `node_modules`, vitest + `pnpm --filter @klicker-uzh/graphql check` were not run in this session. The user must verify before merging with `pnpm install && pnpm --filter @klicker-uzh/graphql build && pnpm --filter @klicker-uzh/graphql test` (the last needs `HATCHET_CLIENT_TOKEN` injected; see CLAUDE.md).

## Iteration 7 — Backend Category C aggregation

**Goal:** Weak-topics + mastery-map via a backend aggregation service, usable from both MCP and a future PWA page.

**Deliverables (backend, done in this iteration):**

- `packages/graphql/src/schema/analytics.ts` — new Pothos types `ParticipantTopicAccuracy`, `MyActivityEntry` (+ `MyActivityKind` enum), `BookmarkedStackSummary`, `BookmarkedStacksByCourse`.
- `packages/graphql/src/services/analytics.ts` — `getParticipantTopicAccuracy` groups the participant's `QuestionResponse` rows by `Element.tags` (many-to-many) in-memory; sorts weakest-first on `1 - correctCount/totalCount`. Stays under a Prisma `findMany`-and-reduce because per-course response counts are low.
- `packages/graphql/src/services/participants.ts` — `getMyRecentActivity` (chronological merge of `QuestionResponseDetail` + `ParticipantAchievementInstance`) and `getMyBookmarksAcrossCourses` (walks active `Participation.bookmarkedElementStacks`). Leaderboard-rank deltas omitted because Prisma doesn't persist rank history today.
- `packages/graphql/src/schema/query.ts` — three new `asParticipant`-gated queries: `participantTopicAccuracy`, `myRecentActivity`, `myBookmarksAcrossCourses`.
- `packages/graphql/src/graphql/ops/` — three new `.graphql` files.

**Codegen step:** Same as iteration 6 — `pnpm --filter @klicker-uzh/graphql generate && (cd apps/mcp && uv run poe gen-ops)`.

**Deliverables (MCP, landed after codegen):** `get_weak_topics(course_id, limit)` + `get_mastery_map(course_id)` are both reshapes of `ParticipantTopicAccuracy` — weak-topics trims top-N (backend already sorts weakest-first), mastery-map derives `{topic, mastery, coverage}` client-side. `get_my_recent_activity(limit)` and `get_bookmarks_across_courses()` are thin wrappers. All four live in `tools/participant_analytics.py` alongside the iteration 6 tools.

**Verification (backend):** Same caveat as iteration 6 — vitest + typecheck require `pnpm install` at repo root.

## Iteration 8 — Deploy surface

**Goal:** Production-shaped. Docker image buildable in CI; Helm chart template alongside the other apps; Traefik routing for local dev; `mcp.klicker.com` reachable locally.

**Deliverables:**

- Helm: `deploy/charts/klicker-uzh-v3/templates/deployment-mcp.yaml`, `cm-mcp.yaml`, `ingress-mcp.yaml`, and the `mcp:` Service stanza appended to `service-app.yaml`. External Secret `secret-mcp` is referenced by `envFrom.secretRef` (per the "v3 secrets are external" learning in CLAUDE.md). Liveness + readiness probes hit `/health`.
- `deploy/charts/klicker-uzh-v3/values.yaml` — new top-level `mcp:` block mirrors `responseApi:` for image/resources/service/ingress/autoscaling. Production overlays (`deploy/env-uzh-{stg,prd}`) can override from there.
- `docker-compose.yml` — new `mcp` service on the `full` profile, port `7079:7079`, same `APP_SECRET`/`APP_ORIGIN_API` pattern as the other apps.
- Traefik — `util/traefik/rules_docker.yaml` and `rules_wsl.yaml` pick up `mcp.klicker.com` routing to `host.docker.internal:7079` (docker) / `172.25.8.0:7079` (WSL). The `*.klicker.com` mkcert wildcard already covers this host, so no new cert.
- CI — three new workflows under `.github/workflows/`: `v3_mcp-stg.yml` (ARM + AMD builds on pushes to `v3*` and PRs touching `apps/mcp/**`), `v3_mcp-prd.yml` (version-tag trigger), and `check-mcp.yml` — the repo's **first** Python CI — which installs uv + Python 3.12 and runs `uv run poe all` (format-check → ruff → pyright → pytest).
- Health endpoint — `apps/mcp/src/klicker_mcp/health.py` registers `GET /health` via FastMCP's `custom_route`. Tested.
- README + PLAN updated; all new envs already landed in `turbo.json` globalEnv in iteration 5.

**Verification:** `uv run poe all` green with 62 tests (2 new for `/health`). Helm template linting and local `docker compose` boot are manual — run `helm template deploy/charts/klicker-uzh-v3 -f deploy/env-uzh-stg/values.yaml` and `curl https://mcp.klicker.com/health` before shipping the chart rollout.

## Iteration 9 — Participant-analytics MCP tools + shared test helpers

**Goal:** Close the deferred-MCP gap from iterations 6 and 7 so an MCP client can read weak-topics / SRS / mistakes / performance / analytics directly. Unblocks the `project/TUTORING_EXPANSION.md` P1 (tutor system-prompt v1 in `apps/chat`).

**Deliverables:**

- `apps/mcp/src/klicker_mcp/tools/participant_analytics.py` — 10 read-only tools wrapping the iter 6/7 persisted ops: `get_my_course_analytics` (client-side timeframe filter), `get_my_performance`, `get_my_activity_performance`, `get_my_response_history`, `get_my_mistakes` (hard-codes `correctness_in=[WRONG, PARTIAL]`), `get_my_srs_state`, `get_weak_topics` (trims top-N), `get_mastery_map` (reshapes to `{topic, mastery, coverage}`), `get_my_recent_activity`, `get_bookmarks_across_courses`. All participant-scoped via the existing bearer-token forwarding; backend is authoritative on `participantId = ctx.user.sub`.
- `apps/mcp/src/klicker_mcp/tools/_helpers.py` — `drop_none` promoted from `lecturer.py`-local to a shared helper; `lecturer.py` + `participant_analytics.py` both import it.
- `apps/mcp/tests/conftest.py` — `mock_graphql` + `sent_body` moved from per-file test helpers into the shared conftest; the existing `test_participant_tools.py` migrated too, dropping the unused `operation_name` positional.
- `apps/mcp/src/klicker_mcp/tools/__init__.py` — registers `participant_analytics`; switched from the noqa suppression to `__all__` so the four module imports satisfy pyright strict mode without per-line ignores.

**Verification:** `uv run poe all` green — 81 tests total (19 new for the analytics tools + 1 auth-guard + 1 registration sanity). Pre-commit hook (prettier via lint-staged + turbo check + syncpack + eslint) also green.

## Next steps — candidates for iteration 10

Sized by reference to `project/TUTORING_EXPANSION.md` §7.

1. **P1 — tutor system prompt v1 in `apps/chat`** (~1 week). Consume the now-complete MCP surface: RTRI-style prompt, session-open snapshot calling the 10 analytics tools in parallel, Socratic default, anti-sycophancy grounding via `submit_stack_response` correctness field, solution-gating, adaptive intensity keyed on `get_my_performance` tier. Depends on §8 Q1 (where the tutor lives in the client stack — preference is `apps/chat` → MCP over HTTP) being resolved. **Highest-impact follow-up; depends only on iter 9.**
2. **End-to-end manual verification of iterations 5–9 against deployed `mcp.klicker.com`** (~0.5 day). Never done against a routable domain. Use a real participant JWT (delegated-login `testuser1`), point Claude Desktop / MCP Inspector at the deployed endpoint, smoke-test one tool per category (1 lecturer write in DRAFT mode, 1 participant write, 1 analytics read). Low risk, high information — validates the OAuth dance, the persisted-ops path, the /health probe, and the ingress setup together.
3. **Resolve open question 2 (iteration 3 lecturer writes with Edu-ID)** (~0.5–2 days). Verify whether `ACCOUNT_OWNER`-scoped JWTs satisfy `asUserFullAccess`. If not, either adjust the guard, or gate lecturer-write tools behind delegated login for the MCP POC. Blocks any real lecturer usage.
4. **Resolve open question 2 (`createdVia` audit field on `Element`)** (~0.5 day). Propose + land so AI-drafted questions are filterable in the Manage UI — promised _before_ iter 3 ships to students. Prisma-only change; no new persisted ops needed.
5. **P3 — solution explanations** (~2 days). Per-element explanations, post-submission gating. Lecturer-authored or LLM-drafted + lecturer-approved via the existing iter 3 `status=DRAFT` pattern. Unlike P2/P4, does not require session memory or cohort norming — can land in parallel with P1 work.

Recommendation: start with step 2 (deploy smoke) because it's cheap and de-risks everything iterations 5–9 assumed. Then step 1 (P1 tutor prompt) in a separate planning round — it's a meaningfully larger commitment and lives in `apps/chat`, not `apps/mcp`, so it warrants its own plan doc.

## Open questions (tracked, not blocking iteration 1)

1. Does `ACCOUNT_OWNER` scope satisfy the `asUserFullAccess` guard used by `manipulate*` mutations? If not, EduID-logged lecturers can't create questions via the MCP without a backend-guard adjustment.
2. `createdVia` audit field on `Element` — propose and land _before_ iteration 3 ships to students, so AI-drafted questions are filterable in the Manage UI.
3. Rate-limiting policy for LLM-initiated writes (question creation, response submission) — decide per-tool caps before iteration 8.
4. For iteration 6: is there a cohort k-anonymity or pipeline-reliability reason the computed analytics tables were not already exposed to students? Answer shapes how aggressive iteration 6 can be.
