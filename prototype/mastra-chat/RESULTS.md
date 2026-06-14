# Prototype results — per-slice verdicts

Living record. Each slice appends a verdict here; the final §5 matrix in the plan
is filled from this file. Verdict vocabulary: **adopt** / **adopt-with-changes** /
**drop**.

---

## S0 — Engine spine — ✅ DONE

**What ran.** Hono service (`src/server.ts`) builds a per-request dynamic Mastra
`Agent` (`src/engine/agent.ts`) from a copied `Chatbot` row (instructions from
`systemPrompts[mode]`, OpenAI-compatible provider from env/row). Output converted
via `toAISdkStream(stream, { from:'agent', version:'v6', sendReasoning:true,
messageMetadata })` and returned with `createUIMessageStreamResponse`. Vanilla SSE
harness (`public/index.html`) renders it.

**Evidence.**
- `tsc --noEmit` clean against pinned Mastra 1.41 / ai 6.0.91.
- Streaming: `POST /api/chat` emits `start → start-step → text-start →
  text-delta* → finish-step → finish` AI-SDK-v6 UIMessage chunks.
- Finish-metadata shim: finish chunk carries
  `{"modelId":"openai/gpt-4.1","chatMode":"tutor","creditsUsed":0}` — all shim
  fields round-trip.
- Model fallback: request with bogus primary `openai/this-model-does-not-exist-zzz`
  errored 400 on the primary tier, Mastra retried the fallback tier, user got a
  clean answer with no user-visible error. Fallback array shape is
  `[{ model: primary }, { model: fallback }]` (`ModelWithRetries`).
- Browser e2e (agent-browser): typed a question in the harness, assistant answer
  streamed and rendered, finish-metadata box populated. Screenshot `/tmp/s0-after.png`.

**Findings / caveats.**
- **Type skew (churn flag):** Mastra `@mastra/ai-sdk` vendors its own `ai-v6`
  chunk types whose `finish` chunk allows `finishReason:'unknown'`, which the
  app's `ai@6.0.91` narrows out. Runtime chunks identical; bridged with one
  documented cast in `server.ts`. Record as an API-churn data point.
- **Fallback model attribution gap:** our finish-metadata `modelId` reflects the
  *requested* model, not the tier that actually answered. When fallback fires, the
  UI would show the failed primary's id. Production needs the resolved model id
  surfaced from Mastra (telemetry/step metadata) into the shim. Minor, fixable.

**Verdict.** Engine swap → **adopt**. Model fallback → **adopt**. Finish-metadata
shim → **adopt-with-changes** (wire the resolved model id on fallback).

---

## S2 — Skills (lecturer-authored, DB-backed) — ✅ DONE

**What ran.** Skills live in our DB (`mastra_proto.skill_file`), not on disk. A
`DbSkillSource` (`src/engine/skills.ts`) implements Mastra's filesystem-like
`SkillSource` (`exists/stat/readFile/readdir`) over those rows, so each authored
skill is a virtual `/<name>/SKILL.md`. At model-time two thin tools
(`src/engine/skillTools.ts`) expose progressive disclosure: `skill_search` returns
the cheap catalog (frontmatter `name`+`description` only), `skill` loads one full
body on demand. Attached per-request when `skills:true` (`src/server.ts`), with an
instruction nudge to consult skills before how-to/coaching answers.

**Evidence.**
- Offline (`check-skills.ts`): source lists both authored skills, exposes
  name+description for the catalog, loads a full body on demand, `exists/stat`
  resolve correctly.
- Live (`check-skills-live.ts`, model + server): for "Help me study for my
  algorithms exam", the agent calls `skill_search` → `skill` **in that order**
  (progressive disclosure), the catalog returns `exam-coaching, concept-explainer`
  (frontmatter only), the agent **selects `exam-coaching`**, loads its 512-char
  body, and the answer **applies it** — establishes exam scope (topics + date)
  before content, coaches with active recall / spaced review, one topic at a time.
  All 7 assertions pass.

**Findings / caveats.**
- **`WorkspaceSkillsImpl` not exported in 1.41.** Mastra's native
  `createSkillTools(workspaceSkills)` needs `WorkspaceSkillsImpl`, which is not
  exported, so a DB-backed (non-filesystem) source can't use the native wiring.
  The two thin tools reproduce the same progressive-disclosure contract — a small
  amount of glue, but it keeps authoring + versioning in our DB. Record as an
  API-surface gap (worth a Mastra issue / upstream export request).
- **Progressive disclosure is the win regardless of wiring.** The catalog the
  model sees is name+description only; full bodies load on demand. Token cost
  scales with skills *used*, not skills *authored*.

**Verdict.** DB-backed skill source + progressive disclosure → **adopt-with-changes**
(custom thin tools until `WorkspaceSkillsImpl` is exported or a DB source adapter
lands upstream). Lecturer authoring/versioning in our DB → **adopt**.
