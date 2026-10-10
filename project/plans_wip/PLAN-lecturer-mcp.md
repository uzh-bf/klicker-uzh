# Lecturer MCP and Manage Assistant Plan

**Status:** implementation plan for the lecturer-facing MCP service and its
Manage assistant integration.
**Date:** 2026-05-30.
**Scope:** new `apps/mcp-lecturer` service, integration with the existing
Manage embedded assistant, security/RBAC from the first slice, and a later
skills attachment layer for chatbots.

## 1. Current Repo State

The student side already has a concrete production direction:

- `project/STUDENT_MCP_CONCEPT.md` defines the student MCP contract.
- `apps/mcp-student` implements a focused TypeScript + FastMCP service over
  Streamable HTTP.
- `apps/chat/src/services/studentPracticeMcp.ts` connects chat to that service
  with short-lived participant JWTs.
- `apps/chat/src/services/mcpClients.ts` already supports Streamable HTTP MCP
  clients, tool filtering, and OpenAI-safe namespacing.

The lecturer side is only partially started:

- `project/plans_wip/PLAN-manage-embedded-assistant.md` outlines the Manage
  assistant shell, context bridge, draft tools, and confirmation model.
- `apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx`
  embeds the chat app in a bottom-right Manage assistant widget.
- `apps/chat/src/app/manage/page.tsx` hosts a lecturer assistant page.
- `apps/chat/src/components/manage-assistant.tsx` currently uses a placeholder
  local runtime.
- `apps/chat/src/services/manageAssistantTools.ts` contains local helper
  functions, but these are not MCP tools and are not wired into a real streamed
  assistant route.

The older `project/plans_wip/PLAN-mcp-server.md` is historical. It describes a
broad student-oriented MCP server and predates `apps/mcp-student`. For the
current branch, use this plan for lecturer MCP work and
`STUDENT_MCP_CONCEPT.md` for student MCP work.

## 2. Goal

Build a separate lecturer-facing MCP service that lets the Manage assistant
read and draft Klicker teaching objects under the authenticated lecturer's
permissions.

The first valuable workflow is:

1. Lecturer opens Manage.
2. Bottom-right assistant widget opens the chat app in embedded mode.
3. Manage sends sanitized route context to the iframe.
4. Chat authenticates the lecturer with the existing Manage session cookie.
5. Chat mints a short-lived lecturer MCP JWT and connects to
   `apps/mcp-lecturer`.
6. The assistant can list/search/get lecturer-accessible objects and generate
   draft proposals.
7. Any persisted write is preview-first and requires an explicit lecturer
   confirmation.
8. A final slice adds reusable skills to chatbots and the Manage assistant, so
   generated lecturer-doc skills can be attached without changing the MCP
   server.

## 3. Non-Goals

- Do not add lecturer functionality to `apps/mcp-student`.
- Do not resurrect the broad Python `apps/mcp` prototype as the product path.
- Do not expose a generic GraphQL wrapper over MCP.
- Do not allow autonomous writes in the first MCP slices.
- Do not trust model-provided user IDs, object IDs, route context, or MCP
  session IDs as authorization.
- Do not solve long-form documentation ingestion in the MCP slice. Skills and
  generated documentation guidance come after the lecturer assistant works
  end-to-end.

## 4. Architecture

```text
apps/frontend-manage
  bottom-right assistant widget
  sanitized route/context postMessage
        |
        v
apps/chat
  /manage embedded assistant
  lecturer session verification
  real streamed assistant route
  short-lived lecturer MCP JWT minting
        |
        v
apps/mcp-lecturer
  TypeScript + FastMCP over Streamable HTTP
  lecturer-only tools
  per-call JWT auth + RBAC checks
        |
        v
Klicker data/services
  Prisma and/or GraphQL service helpers
  derived permission checks
  existing validation and write flows
```

The lecturer MCP service should mirror the operational shape of
`apps/mcp-student`:

- package name: `@klicker-uzh/mcp-lecturer`
- app path: `apps/mcp-lecturer`
- transport: FastMCP `httpStream`
- local port: `7081`
- endpoint path: `/mcp`
- health endpoint: `/healthz`
- build: plain `tsc -p tsconfig.build.json`
- no Rollup bundling unless there is a concrete reason
- Docker, Helm, and GitHub image workflows copied and adjusted from
  `apps/mcp-student`

## 5. Security and RBAC Design

### 5.1 Trust Boundaries

Main boundaries:

- Browser to Manage: normal lecturer session and existing Manage auth.
- Manage to Chat iframe: only sanitized context via `postMessage`; no secrets.
- Chat to Lecturer MCP: internal server-to-server Streamable HTTP with a
  short-lived lecturer JWT.
- MCP to data layer: Prisma and/or GraphQL service calls with explicit user
  context and permission checks.

The MCP server must verify every inbound request. MCP session IDs are only
transport state and must never be treated as authentication.

### 5.2 Lecturer MCP JWT

Add a chat-side helper similar to `mintParticipantMcpJwt`, but for lecturers:

- function: `mintLecturerMcpJwt(userId: string)`
- signer: `APP_SECRET` or a dedicated `MCP_LECTURER_JWT_SECRET` if configured
- issuer: `APP_ORIGIN_AUTH`
- TTL: 5 minutes, cached for less than the TTL
- claims:
  - `sub`: lecturer user id
  - `role`: `USER`
  - `purpose`: `lecturer-mcp`
  - `scope`: initially `manage:read manage:draft`

`apps/mcp-lecturer` verifies:

- bearer token is present
- signature and expiry are valid
- issuer matches
- `role === 'USER'`
- `purpose === 'lecturer-mcp'`
- required scope exists for the called tool family

### 5.3 RBAC Rules

RBAC should use the same permission semantics Manage uses:

- `READ` for list/search/get.
- `WRITE` for update proposals that depend on an existing object.
- `ADMIN` or existing owner/admin semantics only for future sharing or
  destructive operations.
- `OWNER` is never assumed from `ownerId` alone when derived permissions are the
  relevant Manage model.

Implement a small lecturer MCP permission helper that checks
`derivedPermission` with the accepted permission-level hierarchy. Keep it close
to the existing GraphQL sharing service semantics and add focused tests for:

- owner can access own object
- directly shared user can access with the granted level
- lower-level permission cannot perform higher-level action
- unrelated lecturer cannot access by guessing IDs
- route context cannot grant access

### 5.4 Data Minimization

Every tool should return structured JSON with capped result sizes.

Rules:

- no auth tokens, secrets, session IDs, or raw cookies in tool output
- no full private datasets by default
- no unbounded search results
- no raw HTML; markdown/plain text only
- snippets capped, e.g. 500 characters per object
- input query length capped
- object IDs always validated server-side

### 5.5 Write Safety

Write-capable workflows must be proposal-first.

Tool output shape:

```json
{
  "kind": "element.create.proposal",
  "summary": "Create a single-choice question in Draft status",
  "requiresConfirmation": true,
  "proposalId": "signed-or-stored-id",
  "payload": {
    "type": "SC",
    "name": "...",
    "content": "...",
    "options": { "choices": [] },
    "status": "DRAFT"
  }
}
```

The assistant UI renders a confirmation card. Persisted writes happen only
after a lecturer clicks a confirmation action. The final write path should call
the existing Manage GraphQL mutation or service-layer code so validation,
permissions, activity logs, and side effects remain aligned with Manage.

Confirmation should include a signed proposal hash or server-stored proposal
record so the final write cannot be silently changed between preview and click.

### 5.6 Audit and Abuse Controls

Add structured logs for:

- request correlation id
- user id
- tool name
- object ids involved
- permission result
- success/failure code
- latency

Do not log full prompts, generated content bodies, JWTs, or tool secrets.

Add rate limits before production exposure:

- per user per minute
- per tool family
- lower limits for proposal/write-confirmation endpoints

## 6. Initial MCP Tool Surface

Use the prefix `klicker_lecturer_` to avoid ambiguity with student tools.

### Read Tools

1. `klicker_lecturer_course_list`
   - Inputs: `limit`, optional `query`, optional `includeArchived`
   - RBAC: returns courses with at least `READ`
   - Output: compact course list

2. `klicker_lecturer_course_get`
   - Inputs: `courseId`
   - RBAC: `READ`
   - Output: course metadata and compact activity counts

3. `klicker_lecturer_element_search`
   - Inputs: `query`, optional `type`, optional `status`, optional `limit`
   - RBAC: only elements with `READ`
   - Output: compact question list with snippets

4. `klicker_lecturer_element_get`
   - Inputs: `elementId`
   - RBAC: `READ`
   - Output: full element data needed for assistant reasoning, still capped and
     sanitized

5. `klicker_lecturer_practice_quiz_list`
   - Inputs: optional `courseId`, optional `status`, optional `limit`
   - RBAC: `READ`
   - Output: compact practice quiz list

### Draft Tools

6. `klicker_lecturer_question_draft`
   - Inputs: topic, type, learning objective, difficulty, optional courseId
   - RBAC: authenticated lecturer; courseId checked with `READ` if present
   - Output: draft payload, not persisted

7. `klicker_lecturer_choices_draft`
   - Inputs: question, correct answer, distractor count
   - Output: draft choice set, not persisted

8. `klicker_lecturer_feedback_draft`
   - Inputs: question, choices
   - Output: draft answer feedback, not persisted

### Proposal Tools

9. `klicker_lecturer_element_create_draft_proposal`
   - Inputs: validated draft element payload
   - RBAC: authenticated lecturer; course context checked if present
   - Output: confirmation proposal

10. `klicker_lecturer_element_update_draft_proposal`
    - Inputs: elementId and patch
    - RBAC: `WRITE`
    - Output: confirmation proposal

11. `klicker_lecturer_practice_quiz_create_draft_proposal`
    - Inputs: courseId, title, selected element ids or stacks
    - RBAC: `WRITE` on course and selected elements
    - Output: confirmation proposal

## 7. Manage Chat Integration

The current `/manage` chat page should move from placeholder local runtime to a
real streamed assistant route.

Recommended shape:

- Add an API route for Manage assistant chat, separate from
  `/api/chatbots/[chatbotId]/chat`.
- Verify the lecturer session via the existing Manage cookie helper.
- Build the system prompt from:
  - fixed Manage assistant instructions
  - sanitized Manage route context
  - active skill instructions, once skills exist
- Load lecturer MCP tools from `apps/mcp-lecturer`.
- Stream with the same AI SDK and assistant-ui thread primitives already used
  by the course chatbot.

Thread persistence can start simple:

- v1 may be ephemeral if that keeps the first working slice small.
- If persistence is required, add separate Manage assistant tables or a clearly
  separated assistant-thread namespace. Avoid forcing nullable `chatbotId` into
  existing course-chat tables without a migration design.

## 8. Skills Layer

Skills should be a runtime attachment layer, not part of the first lecturer MCP
tool implementation.

Target concept:

- A skill is a versioned instruction package generated from docs or authored by
  a lecturer/admin.
- Skills can be attached to:
  - a course chatbot
  - the global Manage assistant
  - eventually a specific course Manage context
- Skills are loaded by `apps/chat` when building the system prompt.
- Large document-backed skills should store only compact instructions in the
  prompt and use retrieval for long source material.

Suggested future data model:

- `ChatSkill`
  - `id`
  - `ownerId`
  - `name`
  - `description`
  - `version`
  - `instructions`
  - `sourceType`
  - `sourceRefs`
  - `status`
- `ChatSkillAssignment`
  - `skillId`
  - `chatbotId` nullable
  - `assistantKind` nullable, e.g. `manage`
  - `courseId` nullable
  - `priority`
  - `isEnabled`

Initial implementation can be simpler if needed: a static Manage assistant
skill file loaded from the repo, then evolve to database-backed skill
assignments once the generated lecturer docs are ready.

MCP relationship:

- Do not make every skill an MCP tool.
- Later, expose skill prompts/resources through MCP only if clients benefit
  from MCP-native discovery.
- Tool authorization remains in MCP; behavior guidance remains in skills.

## 9. Implementation Slices

Each slice should end with verification, review, simplification, and a commit.

### Slice 0: Planning Baseline

- Add this plan.
- Mark the older generic MCP plan as superseded.
- Commit the planning-only change.

Verification:

- `git diff --check`
- review the plan against current repo paths

### Slice 1: Scaffold `apps/mcp-lecturer`

- Copy the minimal app shape from `apps/mcp-student`.
- Adjust package name, port, env names, Dockerfile, tsconfig, Vitest config.
- Add config and health endpoint.
- Add one read-only diagnostic tool, e.g. `klicker_lecturer_capabilities`.
- Add workspace/lockfile updates.

Verification:

- `pnpm --filter @klicker-uzh/mcp-lecturer build`
- `pnpm --filter @klicker-uzh/mcp-lecturer check`
- `pnpm --filter @klicker-uzh/mcp-lecturer test`
- start locally and hit `/healthz`

### Slice 2: Lecturer Auth and RBAC Foundation

- Add `mintLecturerMcpJwt` in `apps/chat`.
- Add JWT verification in `apps/mcp-lecturer`.
- Add permission helper for derived permissions.
- Add unit tests for token validation and permission level hierarchy.
- Add negative tests for cross-user object access.

Verification:

- targeted Vitest for chat auth mint helper
- targeted Vitest for lecturer MCP auth/RBAC
- local unauthenticated and wrong-role calls fail

### Slice 3: Read Tools

- Implement course list/get.
- Implement element search/get.
- Add strict result caps and sanitized snippets.
- Prefer shared service helpers where they already encode Manage semantics.
- Use Prisma directly only where the query is small and RBAC is explicit.

Verification:

- unit tests for filtering and response shape
- seeded local call as lecturer returns own/shared objects
- guessed unrelated object id returns not found/forbidden

### Slice 4: Attach MCP to the Manage Assistant

- Add real Manage assistant chat API route in `apps/chat`.
- Load `apps/mcp-lecturer` tools through AI SDK MCP client.
- Replace placeholder `useExternalStoreRuntime` behavior with streamed
  responses.
- Preserve embedded layout and Manage context bridge.

Verification:

- `apps/chat` focused tests
- Manage `tsc`
- browser check with `npx agent-browser`: open Manage, open assistant, ask for
  course list, verify streamed answer

### Slice 5: Draft Tools

- Move or reimplement the local draft helpers as MCP tools.
- Keep outputs draft-only, not persisted.
- Add tool descriptions and examples that produce useful assistant behavior.

Verification:

- unit tests for draft schemas and output
- browser check: ask for an MC draft and verify the assistant renders a usable
  draft response

### Slice 6: Proposal Cards and Confirmed Draft Creation

- Add proposal tool output contract.
- Render proposal cards in assistant-ui.
- Add confirmation route/action.
- Persist only `DRAFT` elements through existing Manage GraphQL/service logic.
- Add signed proposal hash or stored proposal id to bind preview to write.

Verification:

- unit tests for proposal signature/hash tampering
- browser E2E: ask for MC question, inspect preview, confirm creation, verify
  new question appears in Manage question pool as `DRAFT`
- negative E2E or integration test: proposal for inaccessible object cannot be
  confirmed

### Slice 7: Skills Attachment Layer

- Add minimal skill-loading abstraction in `apps/chat`.
- Start with static/repo-backed Manage assistant skill instructions.
- Add database-backed skill and assignment model only once needed for generated
  lecturer docs.
- Attach active skills to the Manage assistant prompt with token caps.

Verification:

- unit tests for skill ordering, enable/disable, and token trimming
- browser check that skill-specific behavior appears without changing MCP tools

### Slice 8: Deployment and MR

- Add Helm chart templates/values for `mcpLecturer`.
- Add chat config map entry for `MCP_LECTURER_URL`.
- Add image build workflows for staging and production.
- Add required env vars to `turbo.json`.
- Update MR description with summary, verification, and screenshots.

Verification:

- Helm template render check
- Docker build if feasible locally or via CI
- full local E2E smoke through Manage and Chat

## 10. End-to-End Validation Target

The full local validation before MR should be:

1. Start local infrastructure and relevant apps.
2. Log into Manage with delegated lecturer credentials.
3. Open the assistant bubble.
4. Ask: "Show my courses."
5. Ask: "Find questions about statistics."
6. Ask: "Draft a single-choice question about standard deviation."
7. Confirm creation from the proposal card.
8. Verify the question appears in the question pool as `DRAFT`.
9. Try an inaccessible element id and verify the assistant cannot read/update it.
10. Capture desktop and mobile screenshots of the widget, proposal card, and
    created draft state.

Required checks before final completion:

- `pnpm --filter @klicker-uzh/mcp-lecturer build`
- `pnpm --filter @klicker-uzh/mcp-lecturer check`
- `pnpm --filter @klicker-uzh/mcp-lecturer test`
- relevant `apps/chat` tests
- relevant `apps/frontend-manage` typecheck/tests
- `git diff --check`
- browser validation with `npx agent-browser`

## 11. Review and Simplification Loop

After every implementation slice:

1. Run the slice-specific verification.
2. Review the diff for security, RBAC, tool scope, and UI behavior.
3. Simplify before committing:
   - remove unused abstractions
   - collapse duplicated helper code
   - reduce tool surface if tests or UX show it is premature
   - keep write paths behind explicit confirmation
4. Commit the slice separately with a conventional commit message.

## 12. Open Decisions

1. Should lecturer MCP JWTs use `APP_SECRET` only, or a dedicated
   `MCP_LECTURER_JWT_SECRET` in production?
2. Should Manage assistant threads be ephemeral in v1, or persisted in separate
   assistant-thread tables?
3. Should read tools use Prisma directly with explicit RBAC, or only GraphQL
   service wrappers where they exist?
4. What is the first generated lecturer-doc skill source format:
   markdown files, stored docs, or generated JSON skill packages?
5. Should confirmed draft creation execute from the chat iframe or by asking
   the Manage parent to run the mutation with its Apollo client?

## 13. Source References

- MCP transport/security guidance:
  `https://modelcontextprotocol.io/specification/2025-11-25/basic/transports`
- MCP security best practices:
  `https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices`
- AI SDK MCP client:
  `https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client`
- MCP agent skills:
  `https://modelcontextprotocol.io/docs/develop/build-with-agent-skills`
