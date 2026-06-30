# Handoff — Mastra Framework Evaluation for `apps/chat`

**Date:** 2026-06-13
**Branch:** `claude/relaxed-poitras-88c9a9` (worktree; forked from `v3`)
**Status:** Research + decision document complete. No production code changed. Ready for an engineer to turn the recommendation into a project plan / spike.

---

## What this work is

Evaluation of whether to adopt [Mastra](https://github.com/mastra-ai/mastra) (TypeScript agent framework) as the engine behind the KlickerUZH AI chatbot (`apps/chat`), and if so, how. Driven by a series of questions: framework fit, migration complexity, win/loss, roadmap, UI compatibility, separate-API question, and the specific feature wishlist (skills, memory, sub-agents).

## Primary artifact — read this first

**[project/plans_future/2026-06-11-mastra-evaluation-report.md](2026-06-11-mastra-evaluation-report.md)** — the full evaluation. Everything below is a pointer/index into it; do not re-derive. Section map:

- §3 — current chat architecture + structural gaps
- §4 — Mastra today (v1.41.x, June 2026): state, velocity, licensing, funding
- §5 — verified compatibility matrix (15 claims, each checked against live docs/npm/GitHub on 2026-06-11)
- §6 — what we win (incl. §6.3: skills/memory/sub-agents feasibility under our constraints)
- §7 — what we lose / costs
- §8 — how it works with assistant-ui (no frontend rewrite under Scope A)
- §9 — migration path: **§9.1 the Scope A vs B decision · §9.2 staged plan · §9.3 Hono service extraction · §9.5 managed-messages (Scope B) impact · §9.6 Scope A+ (DIY memory) — RECOMMENDED**
- §10 — new features it enables
- §11 — recommendation

## The decision in one paragraph

Adopt Mastra as the **agent engine only** ("Scope A"): a per-request dynamic Mastra `Agent` replaces the `streamText` call inside our route handler; **we keep our own Prisma persistence** (branching tree, credits, modes, attachments), our credits/billing, our auth/disclaimers, and our assistant-ui frontend — all untouched. Do **not** let Mastra own message storage ("Scope B") — it has no message-branching model, and managed messages bring recall-contamination, non-atomic edits, unbilled background LLM cost, and schema-churn exposure (§9.5). For the desired memory features (compression à la Observational Memory, semantic recall, student profile), **build them ourselves on our own store** ("Scope A+", §9.6) — the branching tree we own makes our versions *better* than Mastra's (branch-correct summaries, tree-aware recall filtering, profile under our deletion/export machinery, costs metered through credits).

## Recommended sequencing (from §9.2 / §9.6)

1. **Stage 0 — prototype pilot** (no prod changes): one course agent in Mastra Studio exercising skills + DIY-style memory + a two-level sub-agent + the **AI-infra `doc_query` MCP server** attached as a toolset. Gate: DX verdict + correct behavior against live `doc_query`.
2. **Stage 1 — extract `apps/chat-api` (Hono) + engine swap.** Own Hono app, Mastra as a *library* (not Mastra's server), shared `packages/chat-engine`. Lift-and-shift route first (wire format identical → trivial parity check), then swap `streamText` → Mastra agent. Frontend only changes its API base URL.
3. **Stage 2 — evals** (Mastra scorers on sampled traffic + CI dataset).
4. **Stage 3a — skills + student profile** (DIY `ChatParticipantProfile`); **3b — sub-agents / workflows / HITL**; **3c — DIY semantic recall + conversation compression** (compression gated on thread-length data).

## Hard constraints / gotchas (verified, don't re-litigate)

- **Retrieval stays on AI-infra `doc_query` MCP** — Mastra RAG explicitly rejected. Consume as one MCP toolset.
- **Never adopt Mastra Memory as system of record** — semantic recall + Observational Memory both *require* Mastra to own `mastra_messages`; incompatible with our branching tree. Docs explicitly warn against passing full history alongside them.
- **Sub-agent delegation depth ≤ 2** until mastra#15013 (nested-delegation streaming) is fixed.
- **`@mastra/ai-sdk` defaults to AI SDK v5 wire format** — must pass `version: 'v6'` / use `toAISdkStream` with v6 imports; we are on `ai@6.0.91`.
- **Finish-event metadata is DIY** — re-emit `creditsUsed`/`modelId`/`chatMode`/`reasoningEffort` via `messageMetadata` (~1 day).
- **API churn is the main ongoing cost** — 28 minor versions / 12 weeks post-1.0, breaking changes in minors. Pin exact versions; schedule upgrades.
- **Working-memory / profile = new persistent student data** → FERPA/FADP review + wire into participant-deletion before prod.
- Latest verified versions (2026-06-11): `@mastra/core` 1.41.0, `@mastra/ai-sdk` 1.4.4, `@mastra/mcp` 1.9.1, `@mastra/pg` 1.12.1, `@mastra/memory` 1.20.2. Node 18+; chat app pinned Node 20.

## Open decisions — gather production data, not opinion (§9.5)

1. **Branch usage**: % of threads with >1 leaf (`ChatMessage.parentId` sibling analysis). Decides whether branch-switching is expendable.
2. **Thread length distribution**: % of threads > ~10–30k tokens. **The single most important number** — if 95% of threads are short, conversation compression solves a non-problem (`TokenLimiter` already covers it).
3. Cost-attribution policy for background LLM/embedding overhead (absorb vs meter into credits).
4. Privacy sign-off for stored profiles / any future recall.

→ Next concrete deliverable an engineer could pick up: **two SQL queries** against prod for inputs (1) and (2). Not yet written.

## Repo / takeover state

- Branch `docs/mastra-chat-evaluation` (off `v3`). Open as **draft PR** [uzh-bf/klicker-uzh#5118](https://github.com/uzh-bf/klicker-uzh/pull/5118).
- Artifacts (both under `project/plans_future/`): `2026-06-11-mastra-evaluation-report.md` (full eval) + `2026-06-13-mastra-evaluation-handoff.md` (this file).
- No code, deps, schema, or config touched. `pnpm` install state unchanged. Pure docs.

## Suggested skills for the next agent

- **`df-sliced-development-workflow`** — to turn §9.2/§9.6 into a dated, tracer-bullet project plan with per-slice review.
- **`df-agentic-framework-selection` / `df-agentic-memory` / `df-agentic-multi-agent`** — domain references if re-examining the architecture choices.
- **`grill-with-docs`** — stress-test the Scope-A+ plan against the existing domain model before committing.
- **`agent-browser`** (MANDATORY per CLAUDE.md) — for any frontend verification once Stage 1 touches `apps/chat`.
- **`to-prd` / `to-issues`** — to publish the staged plan into the issue tracker for the team.
- **`langfuse`** — relevant for Stage 2 evals + existing tracing continuity.

## Useful source pointers

- Current chat architecture facts: report §3 + CLAUDE.md "Codebase Learnings" (chat entries).
- Key files a Stage-1 spike touches: `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`, `apps/chat/src/services/mcpClients.ts`. Everything else (Prisma schema, GraphQL management plane, stores, auth, disclaimers) stays.
- Mastra docs root: https://mastra.ai/docs · assistant-ui×Mastra: https://www.assistant-ui.com/docs/integrations/frameworks/mastra/overview
