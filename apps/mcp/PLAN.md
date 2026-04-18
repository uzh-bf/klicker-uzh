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

| # | Title | Status | Hash |
| - | ----- | ------ | ---- |
| 1 | Skeleton + PLAN.md                                        | done        | `d419d767a` |
| 2 | GraphQL client + persisted-ops codegen + poe tasks        | done        | `496d0b191` |
| 3 | Category A lecturer tools (question authoring as drafts)  | done        | `a00e38c70` |
| 4 | Category A participant tools (quiz discovery + response)  | done        | `ab03aad1e` |
| 5 | OAuth bridge (MCP auth server + apps/auth routes)         | done        | `01916b826` |
| 6 | Backend Category B exposure queries + MCP tools           | backend done, MCP deferred | `d520532b5` |
| 7 | Backend Category C aggregation + MCP tools                | backend done, MCP deferred | — |
| 8 | Deploy surface (Dockerfile, Traefik, Helm)                | pending     | — |

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

**Deliverables (MCP, deferred to a follow-up commit after codegen runs):** `get_my_course_analytics`, `get_my_performance`, `get_my_activity_performance`, `get_my_response_history`, `get_my_mistakes` (reshape of `get_my_response_history` with `correctness_in=[WRONG, PARTIAL]`), `get_my_srs_state`. These are straightforward wrappers over the new ops and mirror the iteration 4 pattern.

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

**Deliverables (MCP, deferred):** `get_weak_topics(course_id, limit)` + `get_mastery_map(course_id)` are both reshapes of `ParticipantTopicAccuracy` — weak-topics trims top-N, mastery-map derives `{topic, mastery, coverage}`. `get_my_recent_activity(limit)` and `get_bookmarks_across_courses()` are thin wrappers. Lands after codegen regenerates the persisted-query manifest.

**Verification (backend):** Same caveat as iteration 6 — vitest + typecheck require `pnpm install` at repo root.

## Iteration 8 — Deploy surface

**Goal:** Production-shaped. Docker image buildable in CI; Helm chart template alongside the other apps; Traefik routing for local dev; `mcp.klicker.com` reachable locally.

**Deliverables:** production Dockerfile, Docker Compose entry, Helm deployment template, Traefik `rules_docker.yaml` entry + mkcert cert, `/etc/hosts` note in README.

## Open questions (tracked, not blocking iteration 1)

1. Does `ACCOUNT_OWNER` scope satisfy the `asUserFullAccess` guard used by `manipulate*` mutations? If not, EduID-logged lecturers can't create questions via the MCP without a backend-guard adjustment.
2. `createdVia` audit field on `Element` — propose and land *before* iteration 3 ships to students, so AI-drafted questions are filterable in the Manage UI.
3. Rate-limiting policy for LLM-initiated writes (question creation, response submission) — decide per-tool caps before iteration 8.
4. For iteration 6: is there a cohort k-anonymity or pipeline-reliability reason the computed analytics tables were not already exposed to students? Answer shapes how aggressive iteration 6 can be.
