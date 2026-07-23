# PLAN: Further codeapi-Backed Feature Candidates

Status: future / idea-stage ranking. Research base: [RESEARCH-codeapi-integration.md](RESEARCH-codeapi-integration.md). Companions: [PLAN-code-element-type.md](PLAN-code-element-type.md) (deep), [PLAN-chat-code-execution-tool.md](PLAN-chat-code-execution-tool.md) (deep).

## Admission test (applies to every candidate)

Sandbox execution earns its cost ONLY when the code's author is untrusted — an LLM writing code from user prompts, or a user/student submitting code. First-party pipelines that already run trusted Python/TS gain nothing from codeapi (extra latency + ops for zero security value) — extend those codebases directly instead. Also excluded by the capability envelope: anything needing internet access from code or non-baked libraries (RESEARCH doc §capability).

## Candidates, ranked

### 1. Syntax highlighting for code in content (NOT codeapi — do first anyway)

- What: enable `rehypePrism` in the markdown pipeline — import + `.use()` are already present but commented out (`packages/markdown/src/Markdown.tsx:6,107`); dep `rehype-prism-plus@2.0.2` already declared (`packages/markdown/package.json:13`).
- Why here: prerequisite polish for both code plans (question prose, chat responses, explanations all show fenced code today as plain `<pre>`); zero sandbox involvement; trivially small.
- Effort: hours. Risk: rehype-sanitize schema interaction — verify class-based highlighting survives sanitization (`Markdown.tsx:85-105` allowlist).

### 2. Group-activity code tasks (extension of CODE element)

- What: CODE elements inside group activities — a group collaborates on a coding task; submission graded by the same sandbox runner and server-side comparator.
- Fit: same untrusted-author case; reuses the entire CODE grading path. `GroupActivityDecision` already needs the `codeResponse` stub field in v1 of the element plan (`packages/types/src/index.ts:726-736`).
- When: v2 of the CODE element (after practice-quiz/microlearning prove the async grading seam). Group grading is instructor-assisted (`GroupActivityGradingStack.tsx`), which actually LOWERS latency pressure — grading can be lazy.
- Effort on top of CODE v1: ~2–3 days (decision field plumbing + grading-stack UI arm).

### 3. Instructor authoring aid: generate question data/assets via chat (chat-tool spillover)

- What: instructors use a manage-side or chat-based assistant with the execute_code tool to generate datasets, expected outputs, or plots for question authoring (e.g. "generate a CSV of 50 plausible measurements and the summary stats for the sample solution").
- Fit: LLM-authored code = untrusted; low volume; latency-tolerant. Cheapest additional win once the chat tool exists — possibly zero new code if an instructor-facing chatbot simply gets `enableCodeExecution=true`.
- When: immediately after chat-tool v1, as a pilot chatbot configuration (no build), before deciding whether a dedicated manage-UI integration is worth it.

### 4. Tutor test-drives student code from chat context (chat + element bridge)

- What: student pastes failing exercise code into the course chatbot; tutor runs it against the exercise's PUBLIC tests (never hidden ones) and coaches from real failures.
- Fit: strong pedagogy (verify-and-guide with actual signal); needs chat tool + CODE element metadata access (public test invocations fetched by elementId and sent through the runner).
- Risk: careful scoping so hidden tests are unreachable from the chat path (server-side filter on visibility, same stripping discipline as the element plan).
- When: after both v1s ship. Effort: ~2–4 days (tool variant + element lookup + guardrails).

### 5. Live-quiz CODE support — explicitly deferred

- Whole-class simultaneous submissions vs `PYTHON_CONCURRENCY=1` per worker + cold-start = queueing risk at exactly the moment latency matters most (RESEARCH doc §load). Revisit only with load-test evidence + pre-warm strategy (scale codeapi min replicas ahead of scheduled sessions). Precedent caution: CASE_STUDY's live-quiz aggregation bug survived 7 months unnoticed ([PR #4915](https://github.com/uzh-bf/klicker-uzh/pull/4915)) — live-quiz result paths are the least-observed code in the repo.

### Ruled out

- **Analytics/export/response-processing compute via codeapi** — first-party trusted code already running in TS/Python services; no sandbox value.
- **Anything fetching live data from inside the sandbox** (API-based exercises, web-data questions) — egress is blocked by design; don't fight it.
- **In-browser execution (pyodide) as a codeapi alternative** — split-brain grading (browser result ≠ graded result), heavy bundles, no stdlib parity. One runtime, server-side, sandboxed.

## Sequencing recommendation

1. rehypePrism (hours, standalone)
2. Chat tool v1 (3–5 days; after [PR #5126](https://github.com/uzh-bf/klicker-uzh/pull/5126) merges with its security check resolved) → instructor-aid pilot (config only)
3. CODE element v1 (12–18 days; infra prerequisites from RESEARCH doc first; unaffected by Mastra migration)
4. Bridge feature (#4), group activities (#2)
5. Live quiz: evidence-gated, maybe never
