# v3-ai Assistant UI and MCP Runtime Fixes

## Goal

Make the lecturer-facing KlickerUZH Assistant stable during normal use and
ensure the self-contained `devrouter ensure .` stack starts and wires the
Lecturer MCP to that assistant and the Student MCP to the participant chatbot.

## Non-goals

- No new assistant capabilities or MCP tools.
- No Prisma, GraphQL schema, persisted-operation, prompt, model-routing, credit,
  gamification, or deployment changes unless the runtime proof identifies a
  concrete missing production contract.
- No weakening of existing MCP authentication, authorization, or fail-closed
  behavior.

## Design

- **Domain vocabulary:** the Manage Assistant acts for an authenticated `User`
  (lecturer); the student chatbot acts for an authenticated `Participant` in a
  `Course` through an existing `Chatbot`. Their tools remain separate services:
  `mcp-lecturer` and `mcp-student`.
- **Layer footprint:** `apps/frontend-manage` and/or the `apps/chat` embedded
  runtime for the flicker; root/devcontainer lifecycle configuration for MCP
  startup; focused tests and this plan. Existing adapters and MCP services are
  reused.
- **Auth:** Lecturer MCP keeps the minted lecturer JWT and its effective
  `manage:read` / `manage:draft` scope. Student MCP keeps the participant JWT,
  chatbot/course participation checks, and persisted-GraphQL authorization.
- **Gamification:** none.
- **Async/workers:** none beyond the existing devcontainer process supervisor;
  Hatchet behavior is unchanged.
- **UI surface:** the global Manage widget and embedded `apps/chat/manage`
  island. No strings are planned; add matching EN/DE keys if that changes.
- **Test level:** a deterministic browser repro that observes the assistant
  iframe/runtime across open, interaction, context update, close, and reopen;
  focused Chat/Manage tests; MCP unit tests; and a live devcontainer proof that
  both services expose usable, authenticated tools through their Chat adapters.
- **Seeds/fixtures:** reuse the local seeded lecturer, participant, course, and
  chatbot fixtures. No new fixture data is planned.

## Candidate UI approaches

1. Preserve the iframe/runtime while the widget is closed and toggle only its
   visibility/inert state. This avoids reloads and retains the conversation;
   preferred if the repro shows remount-related flicker.
2. Keep remounting on every open but add a loading cover and transition. This
   masks startup without fixing state loss and is only suitable if keeping the
   iframe alive creates unacceptable background work.
3. Stabilize only the embedded assistant runtime/transport around meaningful
   context changes. Use this if the iframe remains mounted but context messages
   recreate the runtime.

The measured repro decides between 1 and 3; both may be needed if they represent
independent remount paths.

## Slices

1. Build and run the browser/DOM feedback loop; rank and test flicker causes.
2. Add regression coverage and implement the smallest stable-lifecycle fix.
3. Include Student MCP in the managed full-stack lifecycle and document both
   internal MCP endpoints consistently.
4. Prove Lecturer and Student MCP discovery/auth/tool execution through the
   actual Chat adapters; run targeted checks and browser verification.

## Progress

- 2026-08-21: Started from local/remote `v3-ai` commit `198747502` on
  `feat/v3-ai-assistant-mcp-fixes`; worktree was initially clean and detached.
- 2026-08-21: Confirmed the branch contains both MCP services and both Chat
  adapters. Confirmed `pnpm run dev:container` includes `mcp-lecturer` but omits
  `mcp-student`, so the managed "run everything" path cannot provide student
  practice MCP tools.
- 2026-08-21: Reproduced the assistant iframe build failure and captured the
  missing `@klicker-uzh/util/auth` export error. Added a red/green public-package
  export regression and emitted the `auth` and `clientAuth` JavaScript entries.
- 2026-08-21: Reproduced a fresh iframe/window plus roughly 25 seconds of blank
  loading on every close/reopen. The widget now keeps its loaded iframe mounted
  and toggles hidden/inert/modal state; a selected draft prompt survives an
  immediate close/reopen in browser verification.
- 2026-08-21: Added `mcp-student` to `dev:container`, aligned its dev script with
  the long-running plain-`tsx` MCP process model, and updated the devcontainer
  endpoint output and setup/Chat documentation for both internal services.
- 2026-08-21: Live runtime proof passed: Lecturer MCP smoke 9/9, Student MCP
  smoke 6/6 with the non-mutating answer submission skipped, the real Chat
  Lecturer adapter discovered all nine scoped tools, and the real Chat Student
  adapter returned three signed practice candidates.
- 2026-08-21: Verification passed: 60 utility tests, 40 Lecturer MCP tests, 28
  Student MCP tests, 514 Chat tests, affected-package type checks, Playwright
  type check, shell syntax, formatting, and `git diff --check`. The two focused
  Playwright lifecycle cases were blocked before launch by a missing disposable
  Chromium binary; the same behavior passed through the mandatory in-app browser.

## Evidence

- [Pre-fix embedded build error](../screenshots/2026-08-21-v3-ai-assistant-build-error-before.png)
