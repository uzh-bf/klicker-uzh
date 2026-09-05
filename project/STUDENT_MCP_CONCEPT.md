# Student MCP Concept

**Status:** concept for the production replacement of the broad `apps/mcp` POC.
**Scope:** new `apps/mcp-student` service, TypeScript + FastMCP, internal use by the KlickerUZH chatbot.

## 1. Goal

Build a production-ready student-facing MCP service that lets the chatbot use KlickerUZH practice questions didactically without exposing a broad platform API surface.

The first use case is the tutor chatbot:

1. `apps/chat` maintains a compact summary of the current conversation and combines it with the latest student message.
2. On every turn, `apps/chat` deterministically asks `apps/mcp-student` for practice-stack candidates related to that topic.
3. The LLM receives only compact, answer-safe candidate context.
4. If the tutor decides to quiz the student, the chat UI renders a real quiz component.
5. The student answers through structured UI inputs.
6. `apps/chat` submits the answer through `apps/mcp-student`.
7. The backend records the response as a normal practice response and returns grading, feedback, points, and post-submission explanations.

This is not a direct TypeScript port of the Python POC. The old `apps/mcp` stays available as a prototype while `apps/mcp-student` is built around the student chatbot workflow.

## 2. Non-Goals

- No lecturer tools in `apps/mcp-student`.
- No OAuth for external MCP clients in v1. The initial consumer is `apps/chat`.
- No broad GraphQL wrapper surface.
- No LLM-based grading.
- No natural-language answer parsing by the LLM.
- No answer details before a structured submission.
- No vector database requirement in v1.
- No custom REST API routes unless MCP tooling proves too awkward.

## 3. Architecture

```text
apps/chat
  deterministic per-turn lookup + active quiz state
  MCP client with short-lived participant JWT and chatbot context
        |
        v
apps/mcp-student
  TypeScript FastMCP over Streamable HTTP
  student-only didactic tools
  validates participant + chatbot/course authority
        |
        v
packages/graphql / backend
  practice-pool selection services
  persisted GraphQL operations
  existing response + grading + SRS semantics
        |
        v
PostgreSQL
```

The MCP server is a thin adapter. Practice-pool membership, candidate retrieval, authorization, submission, grading, and SRS updates belong in the backend services so the PWA and chatbot use the same core logic.

## 4. Core Invariants

### 4.1 No Pre-Answer Solution Leakage

Before a student submits an answer, tools may return only answer-safe data:

- question/stem content
- choices without correctness
- numerical/free-text input requirements
- flashcard prompt
- tags/topic metadata
- source practice quiz / stack metadata
- opaque signed references

Tools must not return:

- correct choices
- numerical solution ranges
- free-text sample solutions
- explanations if they can reveal solution reasoning
- correctness
- points awarded
- feedback strings tied to correctness
- post-submission evaluation objects

The LLM context is not a security boundary. Hidden tool results can still leak through model output, so the MCP/backend contract must keep pre-answer payloads safe.

### 4.2 Structured UI Answers Only

The student answers quiz questions through the chat UI, not by free-form conversation parsing.

The LLM can decide to start a quiz, but `apps/chat` records the active quiz state and renders a structured quiz component. Submission uses typed UI data. The LLM does not infer that "I think it is B" should be submitted.

### 4.3 Normal Practice Responses

Chat-submitted quiz answers count exactly like PWA practice responses:

- response rows are written normally
- grading uses the existing backend logic
- points/XP are awarded where the normal practice flow would award them
- SRS state is updated normally
- response history and analytics see the answer as a normal student response

The chat entry point must not create a second, weaker learning history.

### 4.4 Stack-Aware Quizzing

Klicker stacks represent questions that belong to a common starting point and may build on each other. The candidate unit is therefore a stack, not an isolated element instance.

For v1, the chat quiz requires the complete selected stack to be answered before submission. This matches the existing stack-level `respondToElementStack` semantics and avoids partial-stack ambiguity. Most stacks contain one question, so the common case remains simple.

### 4.5 Authority Is Per Participant and Per Chatbot

A lookup or submission is allowed only if:

- the JWT identifies a participant,
- the participant is enrolled in the requested course,
- the chatbot is assigned to the requested course,
- the signed quiz reference belongs to that participant/course/chatbot context,
- the referenced stack is still eligible in the course practice pool.

`apps/chat` should pass chatbot context to `apps/mcp-student` on each request. The backend/MCP layer must verify that the chatbot is allowed to operate on the course.

## 5. Practice Pool

The production service should reuse the existing course practice-pool concept.

Today the PWA course practice page uses `coursePracticeQuiz(courseId)`, which returns a synthetic practice quiz from `course.elementStacks`. Practice quiz publishing links stacks to the course, and the service applies `orderStacks(...)` for spaced-repetition-style ordering before returning a batch.

For `apps/mcp-student`, this logic should be factored into a backend service that can be used by both:

- PWA course practice page
- student MCP candidate lookup

The practice pool for v1 is:

- all stacks linked to the course through published practice quizzes,
- only stacks visible to the authenticated participant through the existing course participation rules,
- ordered/scored using the existing SRS response metadata where available,
- filtered to supported element types for chat rendering.

## 6. Candidate Ranking

No vectors exist in the database yet. V1 simulates similarity search.

Ranking should use relevance first and SRS second:

1. Build a query from `conversationSummary + lastUserMessage`.
2. Score eligible practice-pool stacks by lexical/content/tag similarity.
3. Keep the top relevant candidates.
4. Apply SRS due-ness / existing `orderStacks` signals as a secondary score or tie-breaker.

This keeps the tutor aligned to the current conversation while still nudging toward spaced repetition when multiple candidates are similarly relevant.

The scoring implementation can start simple:

- normalize Markdown/plain text,
- tokenize stem, title, tags, quiz name, stack title,
- compare against the conversation query,
- boost exact tag/title matches,
- boost due or never-answered stacks,
- return deterministic scores for testability.

Future vector search should replace only the similarity scorer, not the MCP tool contract.

## 7. Supported Element Types

V1 supports stacks whose elements are all one of:

- `SC`
- `MC`
- `KPRIM`
- `NUMERICAL`
- `FREE_TEXT`
- `FLASHCARD`

V1 excludes any stack containing:

- `CONTENT`
- `SELECTION`
- `CASE_STUDY`
- future unknown element types

The whole stack is excluded if any element is unsupported. Showing only a subset would break the lecturer-authored sequence.

## 8. Tool Surface

Keep the v1 MCP surface small.

### 8.1 `lookup_relevant_practice_stacks`

**Purpose:** deterministic per-turn lookup run by `apps/chat` before the LLM answers.

**Read-only:** yes.

**Inputs:**

- `chatbotId`
- `courseId`
- `conversationSummary`
- `lastUserMessage`
- `limit` default 3, hard max 5

**Output:** compact candidate list for LLM context.

Each candidate includes:

- `questionRef` signed opaque reference
- `stackTitle`
- `sourcePracticeQuizTitle`
- `courseId`
- `tags`
- `supportedElementTypes`
- `shortQuestionPreview`
- `relevanceScore`
- `srsScore`
- `reason`

It does not include full render payloads or answer details.

### 8.2 `get_practice_stack_for_quiz`

**Purpose:** fetch full answer-safe render data after the tutor chooses a candidate and `apps/chat` starts an active quiz.

**Read-only:** yes.

**Inputs:**

- `questionRef`

**Output:** full safe stack render payload for the chat UI.

Payload includes:

- stack metadata
- ordered elements
- Markdown content
- visible answer options/input constraints
- element type
- element instance IDs embedded only in server-managed structures as needed
- no solution/explanation/correctness data

The returned payload is for UI rendering. `apps/chat` should keep as much of it as possible out of LLM context. The model can receive a short statement such as "A quiz card has been shown to the student."

### 8.3 `submit_practice_stack_answer`

**Purpose:** submit the completed stack response and return backend grading.

**Read-only:** no.

**Inputs:**

- `questionRef`
- `responses`
- `stackAnswerTimeSeconds`

**Output:** post-submission grading result.

Payload may include:

- stack feedback status
- per-element correctness
- score
- points awarded
- XP awarded
- answer feedback
- explanations
- updated SRS metadata if available

This is the first point where explanation and answer-related details may cross the MCP boundary.

## 9. Signed Question References

`questionRef` should be a short-lived signed token, not a raw stack ID.

It should bind at least:

- `participantId`
- `chatbotId`
- `courseId`
- `stackId`
- ordered `elementInstanceIds`
- supported element type set/version
- issued-at timestamp
- expiry timestamp

Recommended TTL: 10-30 minutes.

The submission tool validates the token and then re-checks current backend eligibility. The signed ref prevents the LLM or client from mixing a stack from a different course, participant, chatbot, or stale lookup.

## 10. Chat Flow

### 10.1 Normal Turn

1. Student sends a message.
2. `apps/chat` updates or reads its conversation summary.
3. `apps/chat` calls `lookup_relevant_practice_stacks`.
4. `apps/chat` injects compact candidates into hidden LLM context.
5. LLM either explains/discusses normally or chooses to start a quiz from one candidate.

### 10.2 Starting a Quiz

1. LLM chooses a candidate by `questionRef`.
2. `apps/chat` records active quiz state in the thread/session.
3. `apps/chat` calls `get_practice_stack_for_quiz`.
4. Chat UI renders a quiz component.
5. Assistant message can introduce the quiz without embedding all details in text.

### 10.3 Submitting a Quiz

1. Student fills structured quiz UI.
2. UI posts structured answer data to `apps/chat`.
3. `apps/chat` calls `submit_practice_stack_answer`.
4. Backend records and grades normally.
5. UI shows grading and feedback.
6. `apps/chat` gives the LLM a compact grading summary for follow-up tutoring.

## 11. Implementation Shape

### 11.1 `apps/mcp-student`

Use TypeScript and FastMCP:

- package name: `@klicker-uzh/mcp-student`
- transport: Streamable HTTP
- default local port: choose a new port, not `7079`, to keep the Python POC intact
- health endpoint via FastMCP health support
- Zod schemas for all tool inputs
- explicit tool annotations
- no dynamic broad tool registration

### 11.2 Auth

`apps/chat` already mints short-lived participant JWTs for MCP calls. `apps/mcp-student` should verify those JWTs with the shared Klicker secret and keep the raw token available for GraphQL forwarding.

The service should also receive chatbot identity, either:

- in the MCP tool input, or
- in a sanitized header set by `apps/chat`.

For v1, tool input is simpler and more explicit.

### 11.3 GraphQL / Backend

Add focused backend operations instead of letting the MCP server access Prisma
directly:

- `studentMcpCoursePracticeQuiz(chatbotId, courseId)` verifies participant enrollment and chatbot assignment, then reuses the existing course practice-pool service/order,
- an answer-safe practice-pool operation fetches `PracticeQuizDataWithoutSolutions` for local ranking/rendering,
- answer submission uses the existing `RespondToElementStack` persisted mutation after validating the signed question ref in the MCP service.

Avoid duplicating grading, eligibility, or SRS ordering logic in MCP. The MCP
service may do temporary lexical ranking and answer-safety normalization only.

## 12. Testing and Verification

### Unit Tests

- similarity scorer ranks exact topic matches above unrelated due items
- SRS boosts but does not override strong relevance
- unsupported element types exclude the full stack
- lookup payload contains no solution/explanation/correctness fields
- signed `questionRef` rejects wrong participant/course/chatbot/expired tokens
- incomplete stack submissions are rejected
- submitted answers map to the existing `StackResponseInput` shape

### Integration Tests

- seeded participant + course + practice pool lookup returns candidates
- selected candidate render payload is answer-safe
- submit answer writes a normal response and returns grading
- repeated submission behavior matches existing practice flow semantics

### Browser Verification

Because this creates user-facing chat UI:

- run `apps/chat` locally,
- use a seeded participant in Testkurs,
- verify a normal tutor turn with hidden candidates,
- start a quiz card,
- submit an answer,
- confirm feedback renders,
- confirm the response appears in normal practice history/analytics where applicable.

Use `npx agent-browser` screenshots before and after the quiz interaction.

## 13. Rollout Plan

### Phase 1: Concept and Backend Contract

- finalize this concept,
- define the GraphQL/backend contracts,
- confirm existing practice-pool service extraction point,
- confirm no pre-answer explanation leakage.

### Phase 2: Minimal MCP Service

- scaffold `apps/mcp-student`,
- implement auth/session verification,
- implement the three MCP tools,
- add unit tests.

### Phase 3: Chat Integration

- add deterministic per-turn lookup in `apps/chat`,
- add active quiz state,
- add quiz card UI for supported element types,
- submit through MCP,
- feed compact grading summaries back to the LLM.

### Phase 4: Verification and Hardening

- local E2E smoke,
- browser verification,
- audit logging,
- rate limiting,
- CI and deployment surface.

## 14. Open Questions

1. Where exactly should active quiz state live in `apps/chat`: thread metadata, transient server state, or persisted chat message metadata?
2. Should `questionRef` signing use `APP_SECRET` directly or a dedicated MCP student signing secret?
3. What is the exact TTL for `questionRef`?
4. How should repeated submissions for the same signed ref behave for practice quizzes: reject, allow if backend allows, or mirror PWA behavior exactly?
5. Should `FREE_TEXT` remain in v1 if some free-text questions rely on sample solutions that may be too brittle for structured chat feedback?
6. What compact grading summary should be exposed to the LLM after submission versus shown only in the UI?
7. How much audit data do we need before production: tool call metadata only, or redacted candidate/submission summaries as well?
