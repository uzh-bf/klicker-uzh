# Worktree MCP Pattern Adoption Plan

**Status:** follow-up planning document.
**Date:** 2026-06-03.
**Source branch:** `worktree-mcp` at `a4fac28ac`.
**Current product path:** split TypeScript services in `apps/mcp-student` and
`apps/mcp-lecturer`.

## Context

The old `worktree-mcp` branch is not current product code. It predates the
merged TypeScript student MCP (`apps/mcp-student`, PR #5090) and built a broad
Python FastMCP service under `apps/mcp`.

Do not merge that branch wholesale. It has useful patterns, but the current
architecture should stay with focused TypeScript MCP services:

- `apps/mcp-student`: participant practice support for course chatbots.
- `apps/mcp-lecturer`: Manage assistant tools for lecturer read/draft/proposal
  workflows.

## Progress

- 2026-06-03: Slice 1 done. Added central tool policy helpers and per-tool
  metadata for `apps/mcp-student` and `apps/mcp-lecturer`; server registration
  now uses typed `toolDefinition(...)` helpers so tool names and annotations
  stay tied. Evidence: focused policy Vitest `10/10` passed, Prettier passed,
  `git diff --check` passed, standalone strict TypeScript check for the new
  policy helpers passed. Full MCP package typechecks were attempted but blocked
  locally by missing package symlinks in this temp worktree (`fastmcp`, `zod`,
  `vitest`, `@apollo/client`, etc.); CI remains the authoritative package
  check. Next: Slice 2 instrumented tool runner.
- 2026-06-03: Slice 2 done. Added local instrumented tool runners for student
  and lecturer MCP services; server registration now passes tool name, session,
  and execution callback through the runner while preserving current JSON
  success/error contracts. Logs include service, tool, subject id, role/scopes,
  latency, outcome, and error code only. Evidence: focused policy/runner Vitest
  `16/16` passed, Prettier passed, `git diff --check` passed, standalone strict
  TypeScript check for policy/runner helpers passed. Local review/simplification
  confirmed no production log entry includes tool inputs, outputs, tokens,
  cookies, question content, answer content, or proposal payloads. Next: Slice 3
  error taxonomy cleanup.
- 2026-06-03: Slice 3 done. Extracted student and lecturer tool error
  classifiers into local `toolErrors.ts` modules; runners now only handle
  execution, JSON formatting, and sanitized logging. Student errors gained
  common `FORBIDDEN`, `INVALID_INPUT`, `NOT_FOUND`, and `BACKEND_UNAVAILABLE`
  codes, with chat status mapping updated. Lecturer errors gained explicit
  `MISSING_SCOPE`, `PROPOSAL_EXPIRED`, `PROPOSAL_INVALID`,
  `PERMISSION_LEVEL_INSUFFICIENT`, `UNAUTHENTICATED`, and backend/common
  classes with safe public messages. Evidence: focused policy/runner/error/chat
  Vitest `33/33` passed, Prettier passed, `git diff --check` passed,
  standalone strict TypeScript check for policy/error/runner helpers passed.
  Local review/simplification kept classifiers local because student and
  lecturer taxonomies intentionally diverge. Next: Slice 4 capability manifest
  alignment.
- 2026-06-03: Slice 4 done. Added a student capabilities tool and extracted
  student/lecturer capability manifest builders into dependency-light
  `capabilities.ts` modules. Both manifests now include service metadata,
  endpoint, autonomous write policy, human confirmation/proposal policy, and
  per-tool annotation/category/scope/solution-exposure summaries derived from
  local tool policy metadata. Evidence: focused policy/runner/error/capability
  and chat Vitest `36/36` passed, Prettier passed, `git diff --check` passed,
  standalone strict TypeScript check for policy/error/runner/capability helpers
  passed. Local review/simplification moved capability tests away from
  `server.ts` imports so local validation does not depend on missing FastMCP
  symlinks in the temp worktree. Next: Slice 5 local E2E smoke scripts.
- 2026-06-03: Slice 5 done. Added small local smoke scripts for student and
  lecturer MCP services plus a shared raw Streamable HTTP JSON-RPC smoke
  client. Scripts cover health, initialize, tool discovery, capability tools,
  representative read paths, lecturer proposal creation, and optional student
  answer submission behind `MCP_STUDENT_SMOKE_SUBMIT=1`. Evidence: scripts
  compile with strict TypeScript to `/private/tmp/mcp-smoke-build`, compiled
  student and lecturer `--dry-run` entrypoints passed, Prettier passed,
  `git diff --check` passed, and the shared smoke client passed standalone
  strict TypeScript. Live local smoke was not run because `localhost:7080` and
  `localhost:7081` were not listening; package-script dry-run was also blocked
  in this sparse temp worktree by pnpm/corepack `fetch failed`, so validation
  used the compiled no-network path. Next: final whole-branch review/security
  pass and PR description refresh.
- 2026-06-03: Final follow-up done. Current-head CI initially failed the
  lecturer MCP Docker build because `toolRunner.ts` duplicated the lecturer
  session type with readonly scopes while `server.ts` passed the canonical auth
  session. Fixed by importing `LecturerMcpScope` and `LecturerMcpSession` from
  `auth.ts`. Evidence: focused MCP Vitest `28/28` passed, Prettier passed,
  `git diff --check` passed, and local `docker build -f
  apps/mcp-lecturer/Dockerfile --target builder .` passed the same
  `pnpm run build --filter=@klicker-uzh/mcp-lecturer` stage that failed in CI.
  Local security review found no high-confidence issue in the adopted MCP
  policy/runner/error/smoke changes. Next: refresh PR description and monitor
  restarted CI on the new head.
- 2026-06-03: Final check follow-up done. Current-head CI later found the same
  readonly-scope mismatch in the lecturer runner test fixture. Fixed by typing
  the fixture as the canonical `LecturerMcpSession` instead of using an
  `as const` tuple. Evidence: focused lecturer MCP Vitest `9/9` passed,
  Prettier passed, `git diff --check` passed, local lecturer MCP Docker builder
  passed, and Docker `pnpm run check --filter=@klicker-uzh/mcp-lecturer`
  passed the same package `tsc --noEmit` path that failed in CI. Next: push and
  monitor restarted PR head CI.
- 2026-06-03: Static-analysis follow-up done. CodeQL flagged lecturer smoke
  dry-run output as clear-text env-derived data, and Sonar flagged policy-test
  sort calls plus inherited chat route complexity after this branch touched the
  route. Fixed by redacting smoke dry-run env values, using explicit
  `localeCompare` sort callbacks, switching smoke entrypoints to top-level
  await, simplifying the lecturer runner return type, and adding a narrow
  `NOSONAR` comment to the legacy chat `POST` handler. Evidence: focused MCP
  and chat Vitest `28/28` passed, smoke scripts compiled with strict TypeScript,
  compiled student and lecturer smoke `--dry-run` passed with redacted labels,
  Prettier passed, `git diff --check` passed, local lecturer MCP Docker builder
  passed, and Docker lecturer MCP package `check` passed. Next: push and
  monitor restarted static-analysis CI.

## What To Take Over

### 1. Central Tool Annotation Presets

Old pattern:

- `READ_ONLY`
- `IDEMPOTENT_WRITE`
- `CUMULATIVE_WRITE`

Current state:

- Student and lecturer tools define annotations inline.
- Some lecturer draft/proposal tools are read-only in protocol terms but have
  important policy semantics that are not explicit enough yet.

Adopt:

- Add small TypeScript helper(s) for annotation presets.
- Use the same names across student and lecturer services.
- Add tests asserting every tool has annotations.

Policy mapping:

- Course, element, and practice lookup: `READ_ONLY`.
- Draft payload generation: `READ_ONLY` plus `requiresHumanConfirmation: false`
  because it does not persist.
- Signed proposal creation: `READ_ONLY` plus
  `requiresHumanConfirmation: true`.
- Practice answer submission: `CUMULATIVE_WRITE`.
- Future bookmark/rating/flag tools: `IDEMPOTENT_WRITE`.

### 2. Tool Metadata Taxonomy

Old pattern:

- `audience`
- `category`
- `lawful_basis`
- `solution_exposure`

Adopt with TypeScript naming:

- `audience`: `student | lecturer | any`
- `category`: `practice-read | practice-write | course-read | element-read |
  authoring | proposal | analytics | meta`
- `solutionExposure`: `none | submission-gated | post-submission-only |
  lecturer-owned`
- `requiresHumanConfirmation`: boolean
- `rbacScope`: scope string or list of strings

Why:

- The chat app can filter tools by policy, not only by string name.
- Reviews can inspect tool policy in one place.
- Future OAuth scopes can align with tool metadata.
- Compliance/security reviews get stable labels for solution exposure and
  role-specific data access.

### 3. Read / Proposal / Write Taxonomy

Adopt a stricter model than the old branch:

- **Read:** can run autonomously after authentication and scope checks.
- **Proposal:** can create a signed preview payload, but cannot persist data.
- **Write:** persists data only after explicit user action.

Lecturer authoring should remain proposal-first. Direct lecturer write tools
from the old branch should not be ported as autonomous MCP tools.

### 4. Per-Call Instrumentation

Old pattern:

- Wrap every tool call.
- Log tool name, authenticated subject, latency, outcome, and stable error
  class.
- Never log tool payloads.

Adopt:

- Add `runInstrumentedTool` or equivalent in both TypeScript MCP services.
- Include:
  - service name
  - tool name
  - subject id
  - role
  - scopes
  - latency
  - outcome
  - error code/class
- Avoid:
  - prompts
  - question content
  - answer content
  - proposal payloads
  - tokens
  - cookies

This is useful for debugging, abuse monitoring, and authorization audits.

### 5. Stable Error Taxonomy

Old pattern:

- Translate backend/auth errors into stable tool-level error classes.

Adopt:

Common classes:

- `UNAUTHENTICATED`
- `FORBIDDEN`
- `INVALID_INPUT`
- `NOT_FOUND`
- `BACKEND_UNAVAILABLE`
- `UNKNOWN`

Student-specific:

- `QUESTION_REF_EXPIRED`
- `QUESTION_REF_INVALID`
- `QUESTION_REF_STALE`
- `SUBMISSION_INVALID`
- `PRACTICE_POOL_UNAVAILABLE`

Lecturer-specific:

- `MISSING_SCOPE`
- `PROPOSAL_EXPIRED`
- `PROPOSAL_INVALID`
- `PERMISSION_LEVEL_INSUFFICIENT`

Why:

- The chat UI can render useful messages.
- The assistant can avoid retry loops.
- Tests can assert behavior without depending on fragile prose.

### 6. E2E Smoke Scripts

Old pattern:

- Real MCP client smoke against HTTP server and seeded data.

Adopt current-service version:

- Student smoke:
  - health
  - list tools
  - lookup relevant practice stacks
  - fetch selected stack
  - submit answer with seeded participant
- Lecturer smoke:
  - health
  - list tools
  - list courses
  - search/get element
  - create signed proposal
  - confirm proposal through Manage/chat route if local auth supports it

Keep smoke scripts small. They should validate wiring, not replace Cypress or
unit tests.

### 7. Tool Capability Manifest

Current lecturer service already has `klicker_lecturer_capabilities`.

Adopt more generally:

- Capability tools or metadata should include version, transport, endpoint,
  autonomous write policy, and tool policy summary.
- Student MCP should expose comparable capabilities if useful.

This helps external clients and reviews understand the surface without reading
source code.

### 8. Thin Adapter Principle

Keep:

- MCP services are thin adapters over Klicker authorization and service logic.
- Backend/service-layer checks remain authoritative.
- Route context, model-provided IDs, and client hints never grant access.

Do not move recommendation engines, analytics computations, or domain policy
into MCP services unless there is no existing backend home.

## What Not To Take Over

- The generic Python `apps/mcp` service as a product path.
- Direct lecturer write tools that persist objects without Manage confirmation.
- Broad participant analytics tools until student-facing privacy/product rules
  are agreed.
- OAuth implementation details without current MCP/FastMCP research.
- Unscoped GraphQL wrapper behavior.

## Implementation Slices

### Slice 1: Tool Policy Helpers

Do:

- Add local TypeScript tool policy helpers in `apps/mcp-student` and
  `apps/mcp-lecturer`, or a shared helper only if it avoids dependency churn.
- Replace inline annotations with named presets.
- Add metadata for audience, category, solution exposure, confirmation, and
  required scopes.

Check:

- Unit test that every registered tool has annotations and policy metadata.
- Existing MCP service tests pass.

Commit:

- `feat(mcp): add tool policy metadata`

### Slice 2: Instrumented Tool Runner

Do:

- Add a wrapper for timing, safe logging, and error translation.
- Replace ad hoc `runTool`, `runReadTool`, and `runDraftTool` logic where it
  reduces duplication.
- Preserve current JSON error-output contracts.

Check:

- Unit tests for success logging shape without payloads.
- Unit tests for error mapping.
- Existing tool tests pass.

Commit:

- `feat(mcp): instrument tool calls`

### Slice 3: Error Taxonomy Cleanup

Do:

- Centralize student and lecturer error mapping.
- Add lecturer-specific codes for missing scope, proposal failure, and
  permission insufficiency.
- Keep user-facing messages safe and non-leaky.

Check:

- Tests for representative auth, RBAC, input, backend, and domain failures.

Commit:

- `fix(mcp): standardize tool errors`

### Slice 4: Capability Manifest Alignment

Do:

- Add or align capability output for both services.
- Include annotation/category/scope summaries.
- Keep it read-only and free of secrets.

Check:

- Capability output snapshot or shape tests.

Commit:

- `feat(mcp): expose service capabilities`

### Slice 5: Local E2E Smoke

Do:

- Add small smoke scripts for student and lecturer MCP services.
- Use seeded local data and direct localhost endpoints first.
- Document prerequisites.

Check:

- Script exits nonzero on auth failure, missing tool, and broken backend path.

Commit:

- `test(mcp): add local smoke scripts`

## Relationship To OAuth Plan

OAuth is planned separately in
`project/plans_wip/PLAN-external-mcp-oauth.md`.

This pattern plan should land first where possible:

- tool metadata makes OAuth scopes easier to map
- instrumentation makes OAuth rollout observable
- error taxonomy gives external clients stable failure behavior
- smoke scripts provide a local validation loop for OAuth later

## Recommended Order

1. Tool policy helpers and metadata.
2. Instrumentation.
3. Error taxonomy cleanup.
4. Capability manifest alignment.
5. Local smoke scripts.
6. OAuth research/implementation after the policy surface is stable.
