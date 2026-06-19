# Mastra Tutor Implementation Plan

Date: 2026-06-17

Status: implementation complete, validation in progress

Inputs:

- Research synthesis: `docs/llm-tutoring-research/LLM_TUTORING_RESEARCH.md`
- Topic notes: `docs/llm-tutoring-research/`
- Current chat route: `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
- Current Benibot prompt: `packages/prisma-data/src/data/data/tutorMode.txt`
- Mastra worktree reviewed: `/Users/roland/.codex/worktrees/f891/klicker-uzh`, branch `codex/mastra-chat-openrouter-smoke` / `feat/chat-mastra-prototype`, head `6146ebfc14`
- Mastra docs checked via Context7: `/mastra-ai/mastra`, covering `Agent`, tools, memory, workflows, observability, and evals

## Progress

Implemented on branch `codex/tutor-research-mastra-plan`:

- Slice 0: merged latest Mastra branch and verified focused baseline.
- Slice 1: added `tutor-skills-v1` prompt variant.
- Slice 2: added MathTutorBench wrapper and ignored result artifacts.
- Slice 3: added hidden tutor turn-state planner with heuristic fallback.
- Slice 4: added move policy and prompt composer.
- Slice 5: added verifier preflight and posthoc checks.
- Slice 6: added evidence-id extraction and citation-fidelity tracking.
- Slice 7: kept generated tutor guidance out of the first Prisma schema; the tutor starts from prompt policy plus LightRAG/Milvus retrieval.
- Slice 8: added payload-minimized `TutorEvent` logging and feedback uptake detection.
- Slice 9: added privacy gate for persistent tutor memory.
- Slice 10: wired dormant Mastra Memory with Postgres storage behind the privacy gate.
- Slice 11: added a Mastra tutor workflow skeleton for the deterministic stage contract.
- Slice 12: added local structural tutor evals and a GitHub Actions workflow.
- Slice 13: added stable tutor observability attributes and dashboard notes.
- Slice 14: added rollout flags, gates, and env tracking.

Known validation caveats:

- Root pre-commit remains blocked by unrelated generated-output gaps in the monorepo.
- Local Rollup builds emit `dist` and then hang in this environment; dist generation is complete before interruption.
- Persistent memory remains disabled unless all privacy gate flags pass.

## 1. Objective

Build a research-grounded tutor architecture that uses Mastra as the production substrate for:

- explicit tutor skills
- hidden learner-state planning
- course-grounded retrieval
- pedagogical move selection
- leakage and grounding verification
- course-scoped learner memory
- optional tutor guidance distilled asynchronously from LightRAG/Milvus context,
  chats, and eval failures
- evaluation and observability
- feedback uptake logging

Target architecture:

```text
course evidence retrieval
  -> hidden learner-state planner
  -> pedagogical move selector
  -> safety / grounding verifier
  -> concise presenter
  -> feedback uptake logger
```

The implementation should avoid a many-agent swarm at first. Use Mastra's strengths, but keep the first production path small and testable.

## 2. Current State

### Current production path

The current tutor is one large Next.js route:

- loads `Chatbot.systemPrompts[selectedMode]`
- loads MCP tools from DB config
- calls `streamText({ system, messages, tools })`
- persists messages, images, reasoning, credits

Strengths:

- already supports DB-driven prompts
- already supports mode-specific MCP tools
- already supports image descriptions
- already supports citations when course context is available
- good fast path for prompt experiments

Missing against the research:

- no explicit hidden learner state
- no first-error diagnosis step
- no strategy / intention selector
- no hint-depth tracking
- no structured misconception library
- no mastery/prerequisite model
- no explicit answer-leakage verifier
- no citation-fidelity verifier
- no feedback-uptake event model
- no pedagogical eval harness
- no course-scoped learner memory

### Mastra worktree state

The Mastra branch has already done the hard platform extraction:

- `packages/chat-engine`: DB-free Mastra engine with agent builder, Responses API provider, MCP toolset builder, guardrails, cost, observability
- `apps/chat-api`: standalone Hono service owning auth, disclaimer, images, persistence, credits, MCP loading, Mastra streaming
- `apps/chat`: flag-gated proxy with `CHAT_USE_MASTRA_ENGINE`
- `toAISdkStream(...)`: preserves frontend stream shape
- reasoning accumulator: avoids finish-metadata race
- local drive: text, images, MCP, credits, thread reload pass according to plan notes

Important current seams:

- `buildAgent(..., extras)` accepts `tools`, `inputProcessors`, and `instructionsSuffix`
- MCP tools are Mastra tools now
- observability is isolated through `withObservability(agent)`
- DIY memory is deferred in `packages/chat-engine/src/index.ts`
- `buildInputProcessors` exists but is not yet passed by `apps/chat-api/src/index.ts`

This is the right substrate for the tutor work.

## 3. Design Principles

1. Policy before fluency.
   The model may write the final wording, but tutor policy chooses the move.

2. Structured state before long prompts.
   Prefer a small hidden state object over a giant instruction blob.

3. Retrieval before optional guidance.
   Launch from LightRAG knowledge graph retrieval and Milvus chunks. Generate
   misconception, hint-ladder, rubric, and directness guidance asynchronously
   from chats/evals only when it adds measurable value.

4. Memory only after privacy gates.
   Persistent learner memory touches real participant data. Ship prompt/policy first; gate profile and semantic recall separately.

5. Evaluate behavior, not only answers.
   Track leakage, first-error diagnosis, hint depth, citation fidelity, feedback uptake, and transfer.

6. Mastra capability with narrow blast radius.
   Use Agent, tools, workflows, memory, processors, observability, and evals where each removes real complexity.

## 4. Target Mastra Model

### Agent

One per-request `TutorAgent` remains the presenter. It receives:

- base course prompt
- tutor skill pack prompt
- hidden state summary
- retrieved course evidence
- allowed tutor move
- leakage/grounding constraints
- MCP tools
- guardrail processors
- optional memory context

Implementation seam:

- extend `AgentExtras.instructionsSuffix`
- pass `inputProcessors: buildInputProcessors(...)`
- pass Mastra tools from course retrieval, rubric lookup, answer checking, learner-state update

### Tools

Tools should be narrow and auditable:

- `course_search`: current KB / `doc_query`
- `rubric_lookup`: fetch lecturer rubric for current item
- `misconception_lookup`: fetch authored misconception candidates
- `hint_ladder_lookup`: fetch allowed hint ladder
- `answer_check`: deterministic or LLM-assisted check against expected solution
- `learner_state_read`: read course-scoped state
- `learner_state_update`: write allowed state changes
- `feedback_event_log`: record feedback uptake events

Do not let the presenter agent call arbitrary state-write tools before the planner/verifier pattern is in place.

### Workflows

Use Mastra workflows for deterministic tutor pipelines:

```text
tutorTurnWorkflow
  1. collect_context
  2. retrieve_course_evidence
  3. plan_hidden_state
  4. select_pedagogical_move
  5. generate_candidate
  6. verify_candidate
  7. present_or_repair
  8. persist_and_log
```

Workflow benefit:

- each step testable
- planner/verifier logs visible
- eval can target intermediate state
- fallback/retry rules explicit

First production version can implement this as plain functions in `apps/chat-api`, then promote to Mastra workflow once semantics are stable. Do not block v1 on perfect workflow abstraction.

### Memory

Use Mastra Memory after privacy gate. Preferred backend:

- `@mastra/memory`
- `@mastra/pg` `PostgresStore`
- `@mastra/pg` `PgVector`
- course-scoped participant memory

Memory categories:

- current course/topic focus
- known mastered skills
- current prerequisite gaps
- repeated misconception labels
- preferred answer language
- preferred explanation depth
- unresolved questions

Avoid by default:

- sensitive personal facts
- free-form psychological profile
- cross-course retrieval
- cross-student retrieval
- unbounded semantic recall

Working memory template should be course-scoped:

```text
# Course Learner State

## Current Course
- course_id:
- chatbot_id:
- active_topic:

## Skill State
- current_skill:
- prerequisite_gaps:
- mastery_estimates:

## Tutoring State
- last_misconception:
- current_hint_depth:
- last_tutor_move:
- unresolved_question:

## Preferences
- language:
- explanation_depth:
- formula_style:
```

### Processors / Guardrails

Use Mastra input processors for:

- prompt injection
- moderation
- PII
- token limit

Add tutor-specific verifier after generation for:

- answer leakage
- citation support
- one-question rule
- directness level
- first-error targeting
- academic-integrity boundary

Input processors stop unsafe inputs. Tutor verifier checks pedagogical output.

### Observability

Keep Mastra native observability from the branch. Add tutor span attributes:

- `chatbotId`
- `courseId`
- `selectedMode`
- `modelId`
- `skillPackVersion`
- `currentSkill`
- `studentState`
- `tutorMove`
- `hintDepth`
- `misconceptionId`
- `retrievedEvidenceIds`
- `leakageDecision`
- `citationFidelityDecision`
- `feedbackEventIds`

### Evals

Use Mastra evals or a repo-local eval runner around the same engine.

Eval targets:

- MathTutorBench
- local finance transcript suite
- pedagogical safety suite
- RAG citation-fidelity suite
- multimodal extraction suite
- feedback uptake metric suite

Mastra evals are useful once the engine is stable. Before that, use a thin CLI that calls `apps/chat-api` / `packages/chat-engine` directly.

## 5. Data Model

Keep the first Prisma change deliberately small. The tutor should run from existing chat configuration, LightRAG/Milvus retrieval, and prompt policy without requiring generated guidance tables at launch.

Do not add first-pass tables for skill packs, knowledge components, misconceptions, hint ladders, or learner state. Those shapes belong in a later migration once the async guidance-generation workflow has real traces, review UX, retention rules, and query patterns.

### Tutor events

The only first-pass tutor table is an append-only event log for quality instrumentation and feedback-uptake detection.

```prisma
model TutorEvent {
  id            String   @id @default(uuid()) @db.Uuid
  participantId String?  @db.Uuid
  chatbotId     String   @db.Uuid
  threadId      String?  @db.Uuid
  messageId     String?  @db.Uuid
  eventType     String
  payload       Json
  createdAt     DateTime @default(now())
}
```

Initial event types:

- `tutor_state_planned`
- `tutor_move_selected`
- `feedback_delivered`
- `student_attempt_received`
- `feedback_uptake_detected`
- `answer_leakage_blocked`
- `citation_fidelity_failed`

## 6. Implementation Slices

### Slice 0: Branch and merge base

Goal:

- decide base branch for implementation
- avoid mixing research docs with Mastra platform PR

Steps:

1. Keep research docs on current worktree unless user wants them committed.
2. Finish or merge Mastra chat-api branch first, or create tutor branch from that branch.
3. Record exact Mastra package versions:
   - `@mastra/core`
   - `@mastra/mcp`
   - `@mastra/observability`
   - future `@mastra/memory`
   - future `@mastra/pg`
4. Verify current Mastra branch still passes:
   - `pnpm --filter @klicker-uzh/chat-engine check`
   - `pnpm --filter @klicker-uzh/chat-api check`
   - `pnpm --filter @klicker-uzh/chat-api build`
   - smoke runner

Exit:

- clean branch decision
- Mastra branch green enough to build on

### Slice 1: Prompt-only `tutor-skills-v1`

Goal:

- prove research-based tutor policy improves behavior before schema/memory work

Files:

- `packages/prisma-data/src/data/data/tutorModeSkillsV1.txt`
- `packages/prisma-data/src/data/seedChatbots.ts`
- optional `apps/chat/src/lib/config/prompts.ts`

Content:

- hidden student-state classification
- first-error diagnosis
- move selection
- hint ladder
- Socratic switch rule
- answer-leakage gate
- course-grounding rule
- metacognitive nudge
- affect/tone policy
- image uncertainty confirmation
- feedback uptake next-action rule

Approach:

- add separate mode or separate seeded chatbot variant first
- do not replace Benibot default until eval results exist
- keep prompt concise

Exit:

- can run current route and Mastra route with same skill prompt
- prompt version visible in evaluation logs

### Slice 2: MathTutorBench harness

Goal:

- compare current Benibot vs `tutor-skills-v1`

Files:

- `project/evals/mathtutorbench/README.md`
- `scripts/eval/run_mathtutorbench.ts` or Python wrapper if benchmark expects Python
- generated result folder under `project/evals/results/`

Inputs:

- current prompt
- skill prompt
- concise benchmark prompt
- model config

Tasks:

- `student_solution_correctness`
- `mistake_location`
- `mistake_correction`
- `socratic_questioning`
- `scaffolding_generation`
- `pedagogy_following`

Metrics:

- task score
- answer leakage
- one-question compliance
- response length
- first-error targeting
- self-correction support

Exit:

- scorecard with go/no-go for integrating skill prompt into production path

### Slice 3: Tutor state planner

Goal:

- create hidden structured state before generation

Location:

- Mastra branch / `apps/chat-api`
- likely helper in `packages/chat-engine/src/tutor/state.ts`

State schema:

```ts
type TutorTurnState = {
  skillPackVersion: string
  currentSkill?: string
  studentState:
    | 'asking'
    | 'attempting'
    | 'correct'
    | 'partial'
    | 'incorrect'
    | 'unclear'
    | 'stuck'
    | 'off_task'
  firstError?: {
    step?: string
    explanation: string
  }
  misconception?: {
    id?: string
    label: string
    confidence: number
  }
  hintDepth: number
  allowedMove:
    | 'ask'
    | 'hint'
    | 'simplify'
    | 'explain'
    | 'worked_micro_step'
    | 'self_explain'
    | 'reflect'
    | 'summarize'
  leakageAllowed: boolean
  retrievalNeeded: boolean
  affectSignal?: 'neutral' | 'frustrated' | 'confident' | 'disengaged'
  imageUncertainty?: boolean
}
```

Implementation:

- first pass: model-generated JSON using `generateText` or structured output if available in current stack
- fallback: deterministic heuristic when planner fails
- store state only in trace/log at first, not DB
- inject summarized state through `instructionsSuffix`

Exit:

- every tutor turn has state in dev logs / observability
- no student-facing leakage of labels

### Slice 4: Move selector and prompt composer

Goal:

- make the final agent obey one allowed move

Files:

- `packages/chat-engine/src/tutor/prompt.ts`
- `packages/chat-engine/src/tutor/policy.ts`

Generated prompt suffix:

```text
Private tutor state for this turn:
- student_state: ...
- current_skill: ...
- allowed_move: ...
- hint_depth: ...
- leakage_allowed: ...

Follow only the allowed move. Do not reveal private state.
```

Rules:

- one move per turn
- one question max
- answer leak allowed only if state says true
- if image uncertainty true, ask confirmation before tutoring
- cite only retrieved evidence

Exit:

- final agent output changes based on state
- tests cover allowed move enforcement

### Slice 5: Verifier gate

Goal:

- catch tutor failures before output reaches student

Verifier checks:

- final answer leakage
- unsupported citation
- too many questions
- wrong directness level
- no next action
- invented course reference
- privacy overreach

Modes:

1. Low-risk streaming mode:
   - preflight policy only
   - stream directly
   - post-hoc log verifier failures

2. High-risk verified mode:
   - generate candidate non-streaming
   - verify
   - repair once if failed
   - stream approved final text

Use cases for verified mode:

- assessments
- homework-like problem solving
- explicit "give me answer" pressure
- detected misconception
- citation-heavy answer

Exit:

- verifier can block/repair at least leakage and citation failures
- eval suite includes verifier pass/fail stats

### Slice 6: Course-grounded RAG discipline

Goal:

- make retrieval policy explicit

Existing:

- KB MCP `doc_query` tool

Add:

- retrieval-needed decision in planner
- evidence id list in state
- quote/paraphrase policy
- citation fidelity verifier
- weak retrieval fallback

Behavior:

- retrieve when course-specific answer likely needed
- cite only retrieved chunks
- if retrieval weak, ask clarification or mark general background
- never invent lecture/source names

Exit:

- local citation-fidelity eval suite
- tool-call trace includes evidence ids

### Slice 7: Optional generated skills, misconceptions, hints

Goal:

- keep the tutor usable from LightRAG/Milvus context first, then allow optional
  generated tutor guidance when chats/evals reveal recurring needs

Backend:

- Prisma models from section 5
- future GraphQL queries/mutations for compact review queues
- local seed fixtures for finance:
  - WACC
  - CAPM
  - NPV
  - duration
  - risk/return
  - leverage
  - option pricing

Frontend:

- start with minimal manage UI or admin-only JSON editor
- no polished UX needed for first internal validation

LLM assist:

- draft misconceptions and hint ladders from course material
- lecturer must approve before published

Exit:

- planner can lookup published misconception/hint records
- unpublished drafts never affect student chat

### Slice 8: Feedback uptake logging

Goal:

- measure whether feedback changes student behavior

Add events:

- `feedback_delivered`
- `student_attempt_received`
- `feedback_uptake_detected`
- `target_misconception_corrected`
- `post_test_completed`

First pass:

- log tutor move + next student message
- offline classifier detects uptake

Later:

- UI/dashboard for lecturer
- aggregate by skill and misconception

Exit:

- eval report can show feedback uptake, not only response quality

### Slice 9: Memory privacy gate

Goal:

- decide allowed persistent memory before any real learner memory ships

Required decisions:

- legal basis
- allowed memory categories
- retention period
- deletion path on participant account deletion
- chatbot/course deletion behavior
- student view/delete UI
- embedding endpoint restrictions
- disclaimer update and re-acceptance

Engineering record:

- create ADR or plan section with DPO/product decisions

Exit:

- no persistent Mastra Memory enabled until gate passes

### Slice 10: Mastra Memory integration

Goal:

- use Mastra Memory for course-scoped learner state and recall

Dependencies:

- `@mastra/memory`
- `@mastra/pg`
- possibly `@mastra/fastembed` or existing OpenAI-compatible embeddings

Implementation:

- PostgresStore backed by existing Postgres
- PgVector backed by existing pgvector plan if available
- scope memory by `participantId + chatbotId`
- semantic recall topK small, e.g. 3
- message range small
- working memory template course-scoped

Guardrails:

- category allowlist
- no sensitive inference
- no cross-student recall
- retention/deletion job
- memory event log

Exit:

- memory improves continuity in a synthetic test user
- deletion test proves participant deletion purges memory rows

### Slice 11: Mastra workflows

Goal:

- formalize tutor turn pipeline once planner/verifier semantics are stable

Workflow:

- `collectContext`
- `retrieveEvidence`
- `planState`
- `selectMove`
- `generateCandidate`
- `verifyCandidate`
- `repairOrApprove`
- `persistAndLog`

Reason to wait:

- avoid cementing wrong abstractions before state/verifier are tested

Exit:

- workflow logs each step
- intermediate artifacts available for eval

### Slice 12: Mastra evals and CI

Goal:

- make tutor quality regressions visible

Eval suites:

- `mathtutorbench-smoke`
- `finance-local-10`
- `pedagogical-safety-20`
- `rag-citation-20`
- `multimodal-10`
- `memory-privacy-10`

CI:

- non-network structural tests on every PR
- optional network eval job manually triggered
- nightly benchmark against configured model

Pass gates:

- no leakage regression
- no citation-fidelity regression
- no one-question compliance regression
- no increase in hallucinated course references
- no memory privacy violation

Exit:

- PR template includes latest tutor eval result

### Slice 13: Observability dashboard

Goal:

- make tutor policy visible in production

Metrics:

- tutor turns by move
- hint-depth distribution
- leakage blocks
- verifier failures
- citation-fidelity failures
- retrieval-needed vs retrieval-used
- feedback uptake
- model cost by tutor stage
- memory read/write count

Exit:

- Langfuse / logs can answer: "why did tutor respond this way?"

### Slice 14: Rollout

Rollout order:

1. internal synthetic chats
2. seeded local dev
3. staging with staff test accounts
4. one low-stakes course chatbot
5. generated guidance review for one high-impact module, if needed
6. broader finance topics

Feature flags:

- `CHAT_USE_MASTRA_ENGINE`
- `TUTOR_SKILL_PACK_VERSION`
- `TUTOR_PLANNER_ENABLED`
- `TUTOR_VERIFIER_MODE=off|posthoc|blocking`
- `TUTOR_MEMORY_ENABLED`
- `TUTOR_WORKFLOW_ENABLED`
- `TUTOR_EVAL_LOGGING_ENABLED`

Do not enable memory and verifier blocking in same rollout. Separate failure domains.

## 7. Recommended Sequence

Best next 6 implementation tickets:

1. `feat(tutor): add tutor-skills-v1 prompt variant`
2. `test(tutor): add MathTutorBench smoke harness`
3. `feat(chat-engine): add tutor turn state planner`
4. `feat(chat-engine): add tutor prompt composer and move selector`
5. `feat(chat-engine): add pedagogical verifier posthoc mode`
6. `feat(tutor): add feedback uptake event logging`

Then:

7. `feat(tutor): add async generated guidance candidates`
8. `feat(tutor): add citation-fidelity eval suite`
9. `feat(tutor): add privacy-gated Mastra Memory`
10. `feat(tutor): promote turn pipeline to Mastra workflow`

## 8. Testing Strategy

### Unit tests

- state schema parse/fallback
- move selector
- hint-depth policy
- leakage gate
- citation verifier
- misconception lookup
- memory allowlist

### Integration tests

- Hono chat-api SSE stream keeps frontend wire format
- MCP retrieval included in tutor state
- image uncertainty leads to confirmation
- abort persists partial output
- feedback event logged after tutor response

### Browser tests

Use `npx agent-browser` once UI changes exist:

- Benibot text chat
- tool call rendering
- cited answer rendering
- image attachment uncertainty path
- lecturer authoring draft/approve flow
- memory transparency UI

### Eval tests

- MathTutorBench subset
- local finance cases
- safety stress suite
- RAG citation suite
- multimodal suite

## 9. Security And Privacy

Critical risks:

- answer leakage during assessments
- hallucinated citations
- model storing sensitive personal facts
- prompt injection through retrieved content
- cross-student memory leak
- account deletion not purging memory
- unbounded body/attachment sizes
- credit race already flagged in Mastra plan as pre-existing

Controls:

- prompt-injection input processor
- verifier for leakage/citations
- memory category allowlist
- participant+chatbot memory scope
- deletion tests
- event payload minimization
- no raw private chain-of-thought storage
- no persistent memory before DPO/product sign-off

## 10. Open Decisions

1. Should `tutor-skills-v1` be a new mode, a new chatbot, or a versioned prompt attached to `tutor`?

2. Should first planner output be stored in DB or only observability logs?

3. Which finance topic becomes first authored skill pack?

4. Should verified mode be required for all problem-solving turns or only high-risk turns?

5. What memory categories are legally and pedagogically allowed?

6. Should lecturer authoring start as JSON/admin-only or polished Manage UI?

7. What minimum eval score gates production rollout?

## 11. Definition Of Done

The tutor architecture is ready for production rollout when:

- Mastra chat-api parity is merged and feature-flagged
- `tutor-skills-v1` beats current prompt on MathTutorBench subset without higher leakage
- hidden state exists for every tutor turn
- verifier catches leakage and citation failures in eval
- tutor works from LightRAG/Milvus context without required guidance records
- optional generated guidance candidates can be reviewed for one high-impact module
- feedback uptake events are logged
- privacy gate passes before memory is enabled
- memory deletion test passes
- browser verification passes for tutor chat and authoring flow
- dashboards show tutor move, hint depth, verifier failures, and costs

## 12. Not In First Release

- cross-student retrieval
- broad learner profiling
- fully autonomous lecturer-content authoring
- fine-tuning
- many-agent swarm
- replacing structured course exercises with open chat
- claims about learning gains without course pilot data
