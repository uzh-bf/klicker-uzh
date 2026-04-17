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
| 2 | GraphQL client + persisted-ops codegen + poe tasks        | in progress | — |
| 3 | Category A lecturer tools (question authoring as drafts)  | pending     | — |
| 4 | Category A participant tools (quiz discovery + response)  | pending     | — |
| 5 | OAuth bridge (MCP auth server + apps/auth routes)         | pending     | — |
| 6 | Backend Category B exposure queries + MCP tools           | pending     | — |
| 7 | Backend Category C aggregation + MCP tools                | pending     | — |
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

**Deliverables:** One tool per `manipulate*` mutation, all defaulting `status=DRAFT`. A `list_my_questions` tool wrapping `userElements`. A `promote_to_ready` tool. Pydantic input models with rich descriptions. Element-options JSON schemas exposed as MCP resources so LLMs see the required shape.

**Verification:** Tool invocations round-trip against recorded cassettes. Defaulting to DRAFT is covered by a unit test.

## Iteration 4 — Participant tools

**Goal:** A participant-scoped MCP client can discover practice quizzes, open a stack, submit a response, bookmark, flag, rate, and post to the live Q&A channel. All category-A data is exposed for chatbot reasoning.

**Deliverables:** tools corresponding to the ops listed in the iteration description. pydantic inputs. Guards that reject write tools when the role isn't `PARTICIPANT`.

**Verification:** Round-trip tests for each write tool; role guard covered.

## Iteration 5 — OAuth bridge

**Goal:** An external MCP client (Claude Desktop / Cursor) can complete an OAuth 2.1 dance against the MCP and end up able to call tools as the signed-in KlickerUZH user, with no new user database.

**Deliverables:** `auth/oauth_provider.py` subclassing FastMCP's OAuth primitives. `/authorize`, `/token`, `/.well-known/oauth-authorization-server`, `/register` (DCR). In-memory code/refresh-token store with a Redis adapter. Two new routes in `apps/auth/src/pages/api/mcp/`: `start.ts` (kicks off NextAuth), `callback.ts` (signs a short-lived payload, redirects back). MCP wraps the existing KlickerUZH JWT into its own access-token JWT.

**Verification:** Manual run against Claude Desktop confirms a successful login; automated test exercises the whole dance against a stubbed NextAuth.

## Iteration 6 — Backend Category B exposure

**Goal:** The student can read their own rows of the already-computed analytics tables. This is the highest-leverage backend change.

**Deliverables (backend):** `participantCourseAnalytics`, `participantPerformance`, `myResponseHistory`, `mySRSState` queries, all `asParticipant`, all scoped to `participantId = ctx.user.sub`. Fragments + Pothos types. Codegen run.

**Deliverables (MCP):** `get_my_course_analytics`, `get_my_performance`, `get_my_mistakes`, `get_my_response_history`, `get_my_srs_state`, `get_my_streak`.

## Iteration 7 — Backend Category C aggregation

**Goal:** Weak-topics + mastery-map via a backend aggregation service, usable from both MCP and a future PWA page.

**Deliverables (backend):** tag exposure in the participant-scoped element fragment; `getParticipantTopicAccuracy` service grouping `QuestionResponse` by `Element.tags`; new queries.

**Deliverables (MCP):** `get_weak_topics`, `get_mastery_map`, `get_my_recent_activity`, `get_bookmarks_across_courses`.

## Iteration 8 — Deploy surface

**Goal:** Production-shaped. Docker image buildable in CI; Helm chart template alongside the other apps; Traefik routing for local dev; `mcp.klicker.com` reachable locally.

**Deliverables:** production Dockerfile, Docker Compose entry, Helm deployment template, Traefik `rules_docker.yaml` entry + mkcert cert, `/etc/hosts` note in README.

## Open questions (tracked, not blocking iteration 1)

1. Does `ACCOUNT_OWNER` scope satisfy the `asUserFullAccess` guard used by `manipulate*` mutations? If not, EduID-logged lecturers can't create questions via the MCP without a backend-guard adjustment.
2. `createdVia` audit field on `Element` — propose and land *before* iteration 3 ships to students, so AI-drafted questions are filterable in the Manage UI.
3. Rate-limiting policy for LLM-initiated writes (question creation, response submission) — decide per-tool caps before iteration 8.
4. For iteration 6: is there a cohort k-anonymity or pipeline-reliability reason the computed analytics tables were not already exposed to students? Answer shapes how aggressive iteration 6 can be.
