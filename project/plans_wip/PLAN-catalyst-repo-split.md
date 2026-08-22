# Plan: Catalyst repo split — engine + analytics extraction, engine contract, PR cleanup

Status: draft for review — decisions pending user ruling (see Open Decisions)
Date: 2026-07-21
Owner: Roland Schlaefli

## Goal

Split the proprietary Catalyst components out of the public AGPL `uzh-bf/klicker-uzh`
monorepo into the private repo currently named `uzh-bf/klicker-uzh-ai`, while keeping
the largest possible OSS surface:

- **Stays AGPL/public**: whole classroom platform, `apps/chat` UI, `apps/chat-api`
  host (auth, threads, credits, disclaimers, attachments), all `Chatbot*` /
  `Chat*` Prisma models, `apps/mcp-student` + `apps/mcp-lecturer`, the engine
  contract spec, and a working **default engine** (current prompts + AI SDK,
  nothing else).
- **Moves private (Catalyst)**: the Mastra engine (agents, tutor behaviors,
  complexity router, guardrails, TutorBench research), `apps/analytics`
  (learning analytics), and future agentic grading + AI content creation.

Licensing is settled: UZH/DF owns the copyright and is not bound by its own AGPL
grant; provenance audit of all shared packages found only team authors. The split
is architectural, not legal. Caveat: everything already pushed to public branches
is irrevocably AGPL for third parties (see PR Cleanup).

## Why this seam

Verified coupling analysis (2026-07-21, 7-area fan-out over v3, origin/v3-ai, and
the mastra worktrees):

- `packages/chat-engine` (mastra prototype, branch `feat/chat-mastra-prototype`)
  has **zero** `@klicker-uzh/*` dependencies and is documented DB-free /
  config-driven. It extracts verbatim.
- All heavy coupling (direct Prisma in `apps/chat` and `apps/chat-api`,
  `ltiGuest.ts` writes to core identity tables, shared-components live-quiz
  rendering, `APP_SECRET` cookie handshake, 5 CASCADE FKs chat→core) sits in
  components that now **stay public**, so no cross-repo coupling remains and
  **no Prisma schema split is needed**.
- `apps/analytics` is nearly free-standing already: Python/uv service, own
  Dockerfile, own workflows (`v3_analytics-stg.yml`, `v3_analytics-prd.yml`),
  no workspace imports (only a nodemon devDep), schema obtained by file copy
  via `util/sync-schema.sh` (mirrors `packages/prisma/src/prisma/schema/*`
  except `js.prisma`). Reads the shared Postgres directly.
- The PR-5126 simplification plan (`project/2026-06-24-pr-5126-mastra-chat-simplification-plan.md`)
  proposed collapsing chat-engine into chat-api. That part is **rejected**: the
  package boundary becomes the repo boundary instead.

## 1. Repo naming and scaffold

Since the private repo now hosts analytics + grading + content creation, "ai" is
too narrow. Recommendation: rename `uzh-bf/klicker-uzh-ai` → **`uzh-bf/klicker-catalyst`**
(GitHub auto-redirects the old name). Alternatives: `klicker-uzh-catalyst`
(consistent but long), keep `klicker-uzh-ai` (misleading scope).

Scaffold in the renamed repo:

| Item | Action |
| --- | --- |
| Existing 2024 notebooks (`grading.ipynb`, `rubric_gen.ipynb`, haystack/poetry setup) | Move to `research/grading-prototype/` — prior art for the grading agent; do not delete |
| Monorepo tooling | pnpm + turbo mirroring the public repo's conventions; uv for the Python analytics app (polyglot root) |
| Initial layout | `apps/engine-catalyst` (Mastra), `apps/analytics`, `packages/` (shared internals), `research/` |
| License | Proprietary notice at root; `"license": "UNLICENSED"` (or internal SPDX) in every package.json so scanners read it correctly |
| Secrets | Separate Infisical project for Catalyst (decision below); GHCR private images |
| CI | GitHub Actions on a private repo consumes paid minutes — path-filtered jobs, concurrency cancellation, lean matrix from day one |
| Consuming shared code | Allowed freely (own IP). Prefer copying stable leaf utilities over cross-repo package links; revisit publishing `@klicker-uzh/*` leaf packages to GitHub Packages only when duplication hurts |

## 2. Engine contract (public, in klicker-uzh)

The contract is the load-bearing artifact: it must let any engine plug into the
OSS platform and let Catalyst reuse one engine across chat today and grading /
content creation later. Spec lives in the public repo (docs + JSON schema +
conformance smoke tests); the default engine is its reference implementation.

Principles: the engine is **stateless toward Klicker** (persists nothing, owns no
DB access, holds no `APP_SECRET`); all state, identity, and billing stay in the
public chat-api.

| Aspect | Contract |
| --- | --- |
| Transport | HTTP; streaming responses use the AI SDK UI-message stream protocol (assistant-ui/useChat consume it natively) |
| Discovery | `GET /v1/manifest` → engine id, engine version, contract version, capability list (`chat` now; `grading`, `content` reserved), feature flags (attachments, tool streaming) |
| Chat | `POST /v1/chat` → request carries: message history (UI message format), resolved chatbot config (system prompt, model id, generation params), MCP server descriptors + a scoped short-lived MCP token, locale, course/participant context ids (opaque to the engine), trace context. Response: UI-message stream including token-usage in the finish part |
| Async capabilities (later) | `POST /v1/tasks/{capability}` with a job envelope; completion via webhook or Hatchet event back into the public repo — defined in the spec now, implemented when grading lands |
| Engine auth (caller→engine) | Bearer service token from chat-api config; engines may run network-isolated (ClusterIP) like the MCP servers |
| Klicker auth (engine→MCP) | Chat-api mints short-lived asymmetric JWTs (RS256/EdDSA): public repo holds the private signing key, engines receive tokens and MCP servers verify with the public key. The engine can never mint platform authority; `APP_SECRET` never crosses the boundary |
| Provider credentials | Chat-api decrypts per-bot provider keys (`Chatbot.openaiApiKey`) and passes them per request; Catalyst engine may additionally use its own router credentials (decision below) |
| Usage/credits | Engine reports token usage in the stream finish part; chat-api debits `ChatUsageCredits` — billing logic never leaves the public repo |
| Observability | Trace context propagated via standard `traceparent`; engines emit their own Langfuse traces keyed to it |
| Versioning | Contract semver in manifest + request header; additive changes minor, breaking changes major; conformance suite in public repo runnable against any engine URL |
| Selection | `CHAT_ENGINE_URL` + `CHAT_ENGINE_TOKEN` env/Helm values select the deployment-wide default; optional per-chatbot engine override field on `Chatbot` later |

**Default engine (public)**: new `apps/chat-engine-default` — the current system
prompts + AI SDK single-agent loop with MCP tool calling and streaming. No
router, no multi-agent, no RAG, no guardrail suite. It makes OSS chat genuinely
work with a bring-your-own key, and doubles as the contract's reference
implementation and test target.

## 3. PR/branch cleanup (force-push strategy)

Engine code (`packages/chat-engine`, `apps/chat-api`) is currently public on two
origin branches. `feat/chat-mastra-prototype` was never pushed (local worktree
only) — it seeds the private repo.

**Honesty caveat**: the engine snapshots already pushed are published under AGPL
irrevocably; force-pushing hides them going forward but cannot revoke the grant,
and GitHub keeps orphaned commits reachable by SHA (PR timeline "force-pushed"
links) until support-side GC. Risk is low (draft prototypes, short exposure,
own IP) — the future private engine is unaffected.

| PR / branch | Content today | Action |
| --- | --- | --- |
| [#5126](https://github.com/uzh-bf/klicker-uzh/pull/5126) `codex/mastra-chat-openrouter-smoke` | apps/chat + apps/chat-api + packages/chat-engine + OpenRouter smoke | Rewrite branch: keep chat-api host, engine contract, and the slimmed default engine (current prompts, AI SDK); strip Mastra internals, router, and Catalyst-bound engine code; force-push; retitle to the public scope |
| [#5129](https://github.com/uzh-bf/klicker-uzh/pull/5129) `codex/tutor-research-mastra-plan` | Tutor architecture research, TutorBench, minimized tutor schema | Migrate docs + TutorBench to `klicker-catalyst/research/`; close the public PR (or force-push down to any genuinely public docs); delete branch after migration |
| [#5092](https://github.com/uzh-bf/klicker-uzh/pull/5092) `v3-ai` | chat LTI guest, mcp-student | Stays public unchanged — all contents remain OSS under this seam |
| [#5109](https://github.com/uzh-bf/klicker-uzh/pull/5109) `codex/manage-assistant-mcp-v3-ai` | embedded assistant + mcp-lecturer | Stays public unchanged |
| [#5074](https://github.com/uzh-bf/klicker-uzh/pull/5074) `worktree-mcp` | FastMCP server, OAuth bridge | Stays public — MCP is the open integration story |
| [#5073](https://github.com/uzh-bf/klicker-uzh/pull/5073) `analytics-phase-a` | analytics pipeline improvements | Extract work to `klicker-catalyst`; close public PR with a pointer note |
| `feat/chat-mastra-prototype` (local only) | chat-engine + chat-api integration | Seed for the private engine; never push to public origin |

Borderline AI PRs needing a ruling (see Open Decisions): [#5078](https://github.com/uzh-bf/klicker-uzh/pull/5078) / [#5174](https://github.com/uzh-bf/klicker-uzh/pull/5174) / [#5182](https://github.com/uzh-bf/klicker-uzh/pull/5182) (KB management),
[#5116](https://github.com/uzh-bf/klicker-uzh/pull/5116) (FalkorDB graphs), [#5062](https://github.com/uzh-bf/klicker-uzh/pull/5062) (pgvector embeddings), [#5113](https://github.com/uzh-bf/klicker-uzh/pull/5113) (adaptive learning).

## 4. Analytics extraction

| Step | Detail |
| --- | --- |
| History | Extract `apps/analytics` with history via git-filter-repo into `klicker-catalyst/apps/analytics` (preferred over a fresh copy — keeps blame/context) |
| Schema access | Replace `util/sync-schema.sh` with a sync script in the private repo that fetches `packages/prisma/src/prisma/schema/*` (minus `js.prisma`) from the public repo at a pinned ref; CI drift check against the deployed migration version |
| Database | Continues reading the shared Postgres directly (own infra, own credentials); the DB contract is the public schema at the pinned migration — document this in the private repo README |
| Workflows | Move `v3_analytics-stg.yml` / `v3_analytics-prd.yml` logic to private-repo workflows; new GHCR image path; update ArgoCD/deploy references |
| Public repo removal | Delete `apps/analytics`, the two workflows, root `prisma:sync` script + `util/sync-schema.sh`, and doc references; add a short README note that learning analytics is part of Catalyst (transparency beats silent removal) |
| In-flight | Route PR #5073 content to the private repo |

Note: released analytics versions remain AGPL for third parties; the moved-forward
codebase is relicensed proprietary from the cut point.

## 5. Public-repo hygiene and OSS strategy

- Add missing `license` fields: `packages/shared-components`, `packages/i18n`,
  `packages/next-config` (currently none declared).
- Update README's "all subprojects are AGPL" statement to describe the open-core
  split honestly: platform + MCP + default engine open; Catalyst engine,
  analytics, grading, content creation proprietary, with the
  security rationale stated (published grading rubrics/prompts invite gaming).
- Publish the engine contract prominently — third parties may build engines;
  Catalyst is the best one. MCP servers stay the open integration plane.
- Confirm student-assistant employment-IP with UZH legal (formality; provenance
  audit found only team authors on shared packages).

## 6. Execution order

1. Rename private repo, scaffold monorepo, relocate notebooks (unblocks everything).
2. Seed `apps/engine-catalyst` from `feat/chat-mastra-prototype` + local Mastra work.
3. Land engine contract spec + `apps/chat-engine-default` in public repo (rewrite of #5126).
4. Wire chat-api to `CHAT_ENGINE_URL`; add asymmetric MCP-token minting; Helm values.
5. Force-push cleanup of #5126; migrate + close #5129.
6. Analytics extraction (section 4).
7. Hygiene + README/licensing updates (section 5).
8. Verify: OSS-only deployment E2E (default engine), Catalyst deployment E2E (engine swap via env only).

## Open decisions (user ruling needed)

| # | Question | Options | Recommendation |
| --- | --- | --- | --- |
| 1 | Private repo name | `klicker-catalyst` / `klicker-uzh-catalyst` / keep `klicker-uzh-ai` | `klicker-catalyst` — offering-scoped, survives scope growth |
| 2 | Provider credentials to engines | Per-request pass-through from chat-api / engine-owned keys | Per-request pass-through; Catalyst engine may add own router keys |
| 3 | KB PRs #5078/#5174/#5182 | Public / Catalyst | Management UI + control plane public; ingestion intelligence private if it embeds Catalyst prompts |
| 4 | FalkorDB #5116, adaptive-learning #5113 | Public / Catalyst | Catalyst (analytics-adjacent intelligence) |
| 5 | pgvector embeddings #5062 | Public / Catalyst | Public — schema/infra capability, useful to OSS users |
| 6 | Ask GitHub support to GC orphaned engine commits after force-push | Yes / No | No — low value, code is own IP and low-risk |
| 7 | Analytics history preservation | git-filter-repo with history / fresh copy | filter-repo with history |
| 8 | Infisical for Catalyst | Separate project / shared workspace env | Separate project — clean secret boundary |

## Progress

- [ ] Slice 1: repo rename + scaffold
- [ ] Slice 2: engine seed
- [ ] Slice 3: contract + default engine (public)
- [ ] Slice 4: chat-api wiring + asymmetric tokens
- [ ] Slice 5: PR cleanup (#5126, #5129)
- [ ] Slice 6: analytics extraction
- [ ] Slice 7: hygiene + comms
- [ ] Slice 8: dual-deployment E2E verification
