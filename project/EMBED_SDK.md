# EMBED SDK Plan

## Summary
Build a reusable embed platform as:
- `@klicker-uzh/embed-sdk` (framework-agnostic core)
- `@klicker-uzh/embed-react` (React wrapper)

Use chat as first integration, but design for future embeds (PowerPoint, Q&A, evaluation views).

## Goals
- Standardize secure iframe embedding across products.
- Keep backend/auth enforcement in target apps (chat first).
- Provide a clean React API for host apps.
- Support future non-chat embeds without redesign.

## Non-Goals (v1)
- No full “chat UI as npm package”.
- No immediate public npm release.
- No Office add-in migration in the first implementation.

## Current Merge Blockers To Resolve First
- Duplicate assistant render in chat route tree.
- Embedded mode lost after first message/navigation.
- Embedded runtime skips mode/credits loading.
- No iframe-origin restriction (`frame-ancestors`) for chat.

## Package Architecture

### `@klicker-uzh/embed-sdk`
Core responsibilities:
- Create/destroy iframe.
- Parent<->iframe postMessage handshake.
- Origin validation (both directions).
- Event bus (`ready`, `error`, `resize`, `auth-required`, `navigated`).
- Optional auto-resize channel.
- URL/token lifecycle helpers (including token stripping callback support).

### `@klicker-uzh/embed-react`
React responsibilities:
- `useEmbeddedFrame(options)` hook.
- `<EmbeddedFrame />` component.
- Declarative prop-to-controller lifecycle.
- Typed callbacks for embed events.

## Security Model (Required)
- Target app enforces auth and authorization server-side.
- Embed launch uses short-lived signed claims (chatbot, user binding, expiry, scope).
- Chat app validates launch claims + participant session.
- Chat app sets CSP `frame-ancestors` allowlist.
- Launch token removed from URL after first validation (session cookie continuation).
- Handshake requires explicit acknowledgment from both parent and iframe before privileged messaging.

## Chat-First Integration
- Keep chat as iframe target app.
- Host app embeds chat with `embed=true` launch URL.
- Chat middleware validates launch and parent origin.
- Embedded chat UX remains compact and stable across first message + thread navigation.

## API Draft (v1)

### Core
- `createEmbed(options): EmbedController`
- `EmbedOptions`
  - `container: HTMLElement`
  - `launchUrl: string`
  - `allowedParentOrigins: string[]`
  - `sandbox?: string`
  - `onEvent?: (event) => void`
- `EmbedController`
  - `mount()`
  - `destroy()`
  - `post(type, payload)`
  - `updateUrl(url)`
  - `resize(height)`

### React
- `useEmbeddedFrame(options)`
- `<EmbeddedFrame {...options} />`

## Implementation Phases

### Phase 1: Stabilize Chat Embed Branch
- Fix P1 blockers listed above.
- Preserve embedded mode across lifecycle/navigation.
- Re-verify with browser screenshots.

### Phase 2: Create `embed-sdk`
- Add package scaffold, build, exports, tests.
- Implement iframe lifecycle + handshake + origin checks + events.

### Phase 3: Create `embed-react`
- Add hook/component wrappers.
- Add tests for mount/unmount/update/event propagation.

### Phase 4: Integrate Chat With Packages
- Replace ad-hoc parent embed logic with `embed-react`.
- Keep chat backend validations in place.
- Add docs + examples for external React host usage.

### Phase 5: Harden + Document
- Add chat docs for integration + security.
- Add package READMEs and migration guidance.
- Add operational runbook for allowlist/token config.

## Testing Plan
- Unit tests (`embed-sdk`): handshake state machine, origin filtering, message gating, teardown.
- Component tests (`embed-react`): lifecycle, prop updates, event callbacks.
- Integration tests (chat): valid launch, expired token, wrong origin, login-required behavior.
- Browser verification: `npx agent-browser` with before/after screenshots for critical flows.

## Acceptance Criteria
- Chat embed is functionally stable and secure.
- Generic core + React packages are usable by another React host.
- Security controls are enforced server-side and documented.
- No regression for non-embedded chat.
- Internal docs are complete and actionable.

## Assumptions
- Hosts are React-based for v1.
- Distribution is internal workspace first.
- Future embeds (Office/Q&A) will reuse the same core handshake and origin model.
