# PLAN — Chat Mastra Prototype (Scope A+ evaluation harness)

**Date:** 2026-06-13
**Worktree:** `.claude/worktrees/chat-mastra-prototype`
**Branch:** `feat/chat-mastra-prototype` (off `v3`)
**Status:** Planning — not yet started.
**Predecessor:** the Mastra evaluation report and handoff (draft PR [uzh-bf/klicker-uzh#5118](https://github.com/uzh-bf/klicker-uzh/pull/5118); files at `project/plans_future/2026-06-11-mastra-evaluation-report.md` and `…-handoff.md`). This plan operationalises the report's **Stage 0 prototype** and stretches it to cover every feature we want to evaluate.

---

## 1. Purpose

Build one comprehensive, throwaway-tolerant-but-graftable prototype that exercises every capability on the Mastra wishlist against realistic KlickerUZH data, so we can issue a per-feature **adopt / adopt-with-changes / drop** verdict and a go/no-go on the Stage 1 production extraction. The prototype is an evaluation harness first and a foundation second — it must answer questions, and its engine layer should be structured so it can later become `packages/chat-engine` + `apps/chat-api` without a rewrite.

The single most important thing this prototype proves or disproves: that **we can keep our own message store (branching tree, credits, modes) while gaining Mastra's engine and building the memory features ourselves on top — with branch-correct semantics Mastra cannot offer.** Everything else is secondary to that thesis.

## 2. Locked decisions (2026-06-13)

| Decision | Choice | Consequence |
| --- | --- | --- |
| Intent | Structured spike, graftable | Engine code organised as a `chat-engine` seam consumable by a Hono service; no production wiring, but production-shaped |
| Data | Copy of seeded Klicker DB | Runs against our Prisma schema with realistic branching threads, participants, chatbots — the only way to validate branch-aware memory |
| Frontend | Minimal assistant-ui harness + Studio in parallel | Verifies the real wire format (streaming, finish-metadata shim, reasoning, sub-agent progress); Studio used for agent/trace inspection |

## 3. Non-goals

- No production traffic, no real students, no real credentials beyond a copied seed DB. Profiles and recall run on synthetic seeded participants only.
- No migration of the real `apps/chat` route, stores, or schema. The prototype reads a copy; it does not alter production code paths.
- No Mastra-owned message storage (Scope B). Messages stay in the copied Prisma tables throughout.
- No Mastra RAG. Retrieval comes exclusively from the AI-infra `doc_query` MCP server.
- Not a performance benchmark. Correctness, developer experience, cost shape, and churn exposure are the axes; throughput is out of scope.

## 4. Topology

The prototype is a small standalone service plus a thin UI, both pointed at a copied database and the live `doc_query` MCP server.

| Layer | What it is | Graft target |
| --- | --- | --- |
| Engine | A `chat-engine` module: Mastra instance, one per-request dynamic agent (instructions, model, tools resolved from a copied chatbot row), model-fallback array, MCP toolset builder, guardrail processors, skills source, sub-agent roster resolver | Future `packages/chat-engine` |
| Service | A Hono app exposing a single chat route plus thin read routes for threads/messages/profile; owns auth-stub, persistence callbacks, credit metering, finish-metadata shim | Future `apps/chat-api` |
| Persistence | The copied Klicker Postgres via Prisma (existing schema) + a few prototype-only tables (profile, embeddings, summaries) in an isolated schema | Real Postgres later |
| Memory (DIY) | Student profile, semantic recall, conversation compression — all on our store, branch-aware | Production DIY memory layer |
| Frontend | Minimal assistant-ui page driving the route; renders text, reasoning, tool calls, sub-agent progress, and the custom finish metadata | Reuses real `apps/chat` patterns |
| Inspection | Mastra Studio against the same engine for agent/skill/workflow/trace inspection | Dev-only, discarded |
| Observability | Langfuse exporter wired to confirm tracing continuity alongside our own token/credit accounting | Real Langfuse |

## 5. Feature evaluation matrix

Each feature gets built, then judged. "Owner" = whether the prototype uses Mastra-native or our own DIY implementation. **Verdict** column filled from the prototype run; per-slice evidence + caveats live in `prototype/mastra-chat/RESULTS.md`.

| Feature | Owner | Question it answers | Success signal | Verdict |
| --- | --- | --- | --- | --- |
| Engine swap | Mastra | Can a dynamic Mastra agent fully replace our `streamText` call with per-request DB-driven instructions/model/tools? | Behaviour parity with current chat on a seeded thread | **adopt** (S0; one type-skew cast) |
| Model fallback | Mastra | Does a provider error transparently fall to the next model mid-request? | Forced primary failure recovers without user-visible error | **adopt** (S0) |
| Finish-metadata shim | DIY | Can we re-attach creditsUsed/modelId/chatMode/reasoningEffort to the stream finish so our UI keeps working? | Harness reads all four fields on finish | **adopt-with-changes** (S0; surface resolved model id on fallback) |
| Reasoning streaming | Mastra | Do reasoning deltas round-trip to assistant-ui as today? | Reasoning panel renders incrementally | **wired, not separately validated** (S0 `sendReasoning:true`; gpt-4.1 emits no reasoning to assert against) |
| `doc_query` MCP toolset | Mastra | Does our DB-driven per-mode MCP config (auth, namespacing, chatbot-id header) rebind cleanly onto Mastra's MCP client? | Agent retrieves course content via `doc_query` | **adopt** (S1; `Chatbot-ID` reaches backend, cited answer) |
| Guardrails | Mastra | Are prompt-injection / moderation / PII / token-limit processors usable on a stateless agent, per-request configurable? | Each processor fires on a crafted input | **adopt** (S1; injection → `data-tripwire`, no output) |
| Skills | Mastra | Can lecturer-authored, DB-backed, versioned skill packages replace the flat per-mode prompt, with progressive disclosure? | Agent loads a skill on demand and applies it | **adopt-with-changes** (S2; thin tools until `WorkspaceSkillsImpl` exported) |
| Student profile | DIY | Can persistent per-student facts live in our schema, branch-agnostic, with a transparency view and deletion hook? | Profile updates across threads; student-facing read view works | **adopt** (S3) |
| Semantic recall | DIY | Can pgvector recall over our messages be filtered to active branches and deduped across forks? | Recall returns relevant prior content, excludes abandoned branches | **adopt** (S4; branch-correct, the thesis. pgvector deferred — float8[] suffices at branch scale) |
| Conversation compression | DIY | Can a summary anchored to a message be reused by every descendant leaf, cutting context cost branch-correctly? | Long seeded thread answers from summary + tail, lower input tokens | **adopt** (S5; measured 67% token cut. Trigger config-gated on prod) |
| Sub-agents | Mastra | Can a two-level supervisor with a DB-driven roster delegate and stream delegation progress to the UI? | Harness renders sub-agent execution; routing works | **adopt** (S6; depth held at 2 per bug #15013) |
| Evals | Mastra | Can scorers run on sampled runs + a small CI dataset to give a prompt-quality signal? | Scores recorded for a course-question set | **adopt** (S7; 6/8 keyword baseline. LLM-graded scorers later) |
| Observability | Mastra | Does Langfuse tracing coexist with our own token/credit accounting? | Traces appear; credits still computed in callbacks | **not evaluated** (no slice built; defer to integration phase) |

**Decision: GO on Scope A+** — Mastra as engine, our store, DIY branch-correct memory. Conditions: pin `provider.chat` (Responses API breaks multi-step tool calls), surface resolved model id on fallback, and run the S0.5 measurement queries against **production** to set the compression gate and confirm branching demand. Full reasoning in `RESULTS.md` → "Go / no-go".

## 6. Environment & data setup

| Item | Approach |
| --- | --- |
| Secrets | Infisical only (no `.env` files). New entries as needed for the prototype env. |
| Database | A **copy** of the seeded Klicker Postgres (never prod). Prototype-only tables (profile, embeddings, summaries) created in an isolated Postgres schema so they never collide with Prisma-managed tables. |
| pgvector | Reuse the existing `pgvector` worktree's setup if applicable; otherwise enable the extension on the copied DB. |
| `doc_query` MCP | Point at the AI-infra `doc_query` server (URL + key via Infisical). Confirm reachability before Slice 1. |
| Models | Existing OpenAI-compatible/Azure credentials via Infisical; a deliberately wrong primary model configured once to test fallback. |
| Langfuse | Existing keys via Infisical to confirm trace continuity. |
| Course material | Reuse existing course-prompt material (see the `course-agent-prompt-designer` skill and `course-qa` worktree) as source for the authored skills and the eval dataset. |

Cross-references worth reusing rather than rebuilding: the **`pgvector`** worktree (vector setup) and the **`course-qa`** worktree (course Q&A / retrieval experiments).

## 7. Build slices (ordered, tracer-bullet)

Each slice ends in something runnable and a recorded verdict. Slices are sequenced so the engine spine exists first, then features layer on independently.

| # | Slice | Builds | Eval question / gate |
| --- | --- | --- | --- |
| S0 | Engine spine | Hono service skeleton, Mastra instance, one dynamic agent reading a copied chatbot row, model-fallback array, stream to a minimal assistant-ui page via the AI-SDK-v6 bridge, finish-metadata shim, persistence callbacks writing to the copied tables; Studio up | Parity with current chat on a seeded thread; fallback recovers; finish metadata intact |
| S0.5 | Measurement | The two production-shaped queries against the copied DB: share of threads with more than one leaf (branch usage), and thread-length/token distribution | Decides whether Slice 5 (compression) is worth building at all |
| S1 | Retrieval + guardrails | Rebind our per-mode MCP config onto Mastra's MCP client for `doc_query`; add prompt-injection, moderation, PII, and token-limit processors | Retrieval works through the MCP seam; each guardrail fires |
| S2 | Skills | Author one or two Workspace Skills from existing course-prompt material; DB-backed source; progressive disclosure via the skill-search processor | Agent discovers and applies a skill on demand; lecturer-authoring shape is sane |
| S3 | Student profile (DIY) | Profile table in the isolated schema, an update-profile tool, context injection, a transparency read view in the harness, a deletion hook | Profile persists across threads, branch-agnostic; transparency + deletion work |
| S4 | Semantic recall (DIY) | Embeddings table, embed-on-write (inline for the prototype), branch-aware retrieval that filters to the active path and dedupes forked prefixes | Relevant recall that provably excludes abandoned branches |
| S5 | Compression (DIY) | Summary table anchored to a message, deepest-anchor selection on the client's branch path, summarisation job | Long seeded thread answers from summary + tail with measured lower input tokens — only if S0.5 shows demand |
| S6 | Sub-agents | Two-level supervisor, DB-driven roster resolver, message filtering per delegation, render of delegation progress in the harness | Routing works; delegation progress streams; depth held at two |
| S7 | Evals | Mastra scorers on sampled runs plus a small CI dataset of course questions | A usable prompt-quality signal is produced |

Dependencies: S0 precedes everything. S0.5 precedes S5. S1–S4, S6, S7 are independent of each other and can be tackled in any order or in parallel once S0 lands. S5 is conditional.

## 8. Evaluation framework & decision gates

Every feature is judged on four axes, scored qualitatively, and resolved to a verdict.

| Axis | What we measure |
| --- | --- |
| Developer experience / effort | How much code, how much fighting the framework, how legible the result |
| Correctness | Does it behave right — especially branch-correctness for the three DIY memory features |
| Cost shape | Token/LLM/embedding cost, including background work, and whether we can meter it through credits |
| Churn / stability | How exposed the feature is to Mastra's release churn and any open bugs |

Verdict per feature: **adopt**, **adopt-with-changes**, or **drop**. Key standing gates carried from the report: sub-agent delegation depth stays at two until the nested-streaming bug is fixed; conversation compression is built only if S0.5 shows a non-trivial share of long threads; the student profile needs a privacy decision before it leaves the prototype.

## 9. Risks & flags

| Risk | Handling |
| --- | --- |
| Mastra API churn | Pin exact versions in the prototype; record any breakage encountered as a churn data point for the verdict |
| AI-SDK wire format | The bridge defaults to v5; the prototype must select v6 to match our stack |
| `doc_query` availability | Confirm reachability and auth before Slice 1; the whole retrieval story depends on it |
| pgvector / Prisma vector type | Vector columns are raw-SQL territory in Prisma; isolate them in the prototype schema and keep them out of the generated client |
| Privacy | Profiles and recall run on synthetic seeded participants only; no real student data enters the prototype; a deletion hook is built in S3 so the production privacy story is exercised, not deferred |
| Background cost attribution | Record embedding/summarisation/eval cost separately so the "meter through credits" claim can be judged |
| Scope creep | Slices are independently shippable; an incomplete prototype that covers S0–S4 still yields verdicts on the core thesis |

## 10. Exit criteria / deliverable

The prototype is "done" when it produces a **per-feature verdict table** (the §5 matrix filled with adopt/adopt-with-changes/drop plus a one-line rationale each), the two S0.5 measurements, and a single go/no-go recommendation on the Stage 1 production extraction. That output is appended to the evaluation report so the decision trail stays in one place.

## 11. References

- Evaluation report and handoff: PR [#5118](https://github.com/uzh-bf/klicker-uzh/pull/5118) — `project/plans_future/2026-06-11-mastra-evaluation-report.md` (esp. §6.3 skills/memory/sub-agents, §9.2 stages, §9.3 Hono extraction, §9.5 managed-messages impact, §9.6 Scope A+ DIY memory).
- Sibling worktrees to reuse: `pgvector` (vector setup), `course-qa` (course retrieval).
- Existing chat code the engine spine mirrors: the chat route and MCP client service in `apps/chat` (read-only reference; not modified by the prototype).
- Mastra docs root: https://mastra.ai/docs · assistant-ui × Mastra: https://www.assistant-ui.com/docs/integrations/frameworks/mastra/overview
