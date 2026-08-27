---
title: Manage assistant session UX
date: 2026-08-27
status: complete
path: full
target_branch: v3-ai
branch: rs/manage-assistant-session-ux
worktree: trees/manage-assistant-session-ux
base_commit: d96cf502a04bff1e16e6ffba4c43af3ea5ec9163
---

# Manage assistant session UX

## Goal

Make the embedded lecturer assistant a usable non-modal working companion. A
lecturer can review complete generated questions, refine the latest signed
proposal conversationally, resize the desktop dock, start a new in-memory
conversation without reloading Manage, continue using Manage behind the dock,
and understand that the assistant can guide them through relevant official
KlickerUZH documentation.

## Non-goals

- Durable or cross-page chat history.
- Database, Prisma, or migration changes.
- A new dependency, external provider, or longer proposal-token lifetime.
- Publishing, editing, deleting, duplicating, or sharing existing elements.
- Push, PR creation, merge, release, deployment, secrets, production access,
  or upstream integration.

## Settled product contract

- The assistant is a labelled non-modal complementary region. It does not trap
  focus or make the Manage application inert, and the question pool receives
  no assistant-specific bottom spacer.
- Desktop users can resize width and height with pointer and keyboard controls.
  Only versioned numeric dimensions are stored locally and clamped to the
  viewport. Mobile uses a fixed full-width bounded-height dock and ignores the
  desktop preference.
- A loading status remains visible until a validated readiness message arrives
  from the expected iframe origin and window, not merely until the iframe load
  event fires.
- Closing and reopening the dock preserves the current in-memory conversation.
  “New conversation” resets an empty conversation immediately, confirms before
  discarding messages or composer content, and is disabled during generation.
  Reset clears messages, draft input, and attachments through the pinned
  assistant-ui runtime API without reloading Manage or the iframe. Page context
  and dock dimensions remain.
- Proposal continuity accepts only the opaque token found in the exact signed
  proposal tool part. The server verifies signature, issuer, expiry, purpose,
  subject, and schema without consuming `jti`, then reconstructs only the
  latest canonical proposal context. Raw browser payloads, tool output, tokens,
  `jti`, and provider metadata never reach the model. Confirmation alone claims
  `jti`, preserving one-time creation behavior. Continuity lasts no longer than
  the existing 15-minute token expiry.
- The author review card shows each option's correctness with text and icon,
  each available answer feedback, the general explanation, and existing
  free-text solutions. Long cards and confirmation actions remain reachable
  above the composer.
- The welcome state keeps concrete examples and also explains that the
  assistant can guide lecturers to relevant official documentation and
  tutorials from its curated KlickerUZH documentation index.

No new product primitive or ADR is required. This package extends the existing
ephemeral assistant dock, signed proposal, and author-review projection.

## Execution contract

The user approved local implementation of every listed feedback item except
durable history. The main session is the sole writer because the trust boundary,
iframe protocol, reset lifecycle, proposal rendering, and accessibility
behavior are critically coupled. Read-only specialist roles may review
immutable commits. Local edits, repository-native checks, screenshots, review
reports, and conventional commits are authorized. All external delivery and
upstream-integration actions remain withheld.

## Work packages

### S0 — Plan baseline

Write this reviewed execution plan and its ignored planning report. Acceptance:
the plan records the base, authority, trust and privacy boundaries, reset-loss
ruling, verification, stop conditions, and progress. Commit:
`docs(project): plan manage assistant session UX`.

### S1 — Trusted proposal continuity

Separate non-consuming proposal-token inspection from consuming confirmation.
Extract only proposal tokens from the exact allowlisted proposal tool output,
verify candidates server-side, select the latest valid candidate, and add a
bounded canonical proposal block to the system prompt. Invalid or expired
candidates fall back to ordinary chat. Preserve existing tool stripping and
one-time confirmation.

Acceptance: focused tests cover valid, tampered, expired, wrong-subject,
already-confirmed, malformed, unrelated-tool, and fabricated-browser-payload
cases. The chat-platform wiki documents the revised trust boundary. Commit:
`fix(chat): preserve trusted proposal context across manage turns`. Run a
risk-selected slice review for security and data integrity.

### S2 — Complete proposal review

Replace the student-answer preview with a static lecturer review projection for
the validated proposal. Render correctness without color-only meaning,
per-answer feedback, explanation, and free-text solutions. Move the embedded
composer into normal flex flow so long proposal content and actions remain
scrollable and visible.

Acceptance: focused unit coverage and Playwright fixtures prove choice and
free-text details, including missing optional feedback, without trusting raw
unvalidated payloads. Commit:
`fix(chat): show complete manage proposal details`.

### S3 — Non-modal adaptive dock

Remove dialog semantics, modal focus management, focus trapping, `inert`, and
app-root `aria-hidden`. Remove the layout spacer. Add desktop pointer and
keyboard resizing, pure clamping and persistence helpers, and the responsive
mobile fallback. Add a visible and announced loading state until the validated
ready handshake arrives. Preserve close focus restoration and exact-origin
postMessage checks.

Acceptance: unit tests cover parsing, clamping, keyboard deltas, corrupt stored
values, and viewport changes. Playwright covers background interaction,
readiness loading, pointer and keyboard resizing, persisted dimensions, mobile
fallback, and absence of extra page clearance. Update frontend conventions and
the frontend UI skill. Commit:
`fix(manage): make the assistant a non-modal adaptive dock`. Run a risk-selected
slice review for cross-origin and accessibility behavior.

### S4 — Conversation lifecycle and discovery

Add an in-frame “New conversation” control that uses the pinned runtime reset
API. Guard destructive reset as settled above. Expand the welcome capabilities
to mention guidance through relevant official KlickerUZH documentation while
retaining practical examples. Update the lecturer tutorial, testing wiki, and
chat platform wiki. The generated root release changelog is intentionally not
hand-edited; the final reviewer accepted the affected wiki and plan records as
the behavior log for this package.

Acceptance: unit and Playwright coverage proves empty reset, confirmed non-empty
reset, disabled reset during generation, clearing messages/composer/attachments,
no iframe or Manage reload, retained page context and dock dimensions, preserved
conversation on close/reopen before reset, and the expanded welcome copy in
English and German browser journeys. Commit:
`feat(chat): add explicit manage conversation reset`.

## Integrated verification

Run all commands inside the exact devrouter worktree runtime:

- Focused Chat tests for request validation, route context, proposal token
  verification, proposal card/conversion, and runtime reset logic.
- Chat, Manage, and Playwright type checks, then `pnpm run check:all`.
- Chromium `playwright/tests/Y-manage-assistant.spec.ts`.
- Desktop English journey: readiness loading, background interaction, pointer
  and keyboard resize, trusted proposal follow-up, complete long proposal, reset,
  and close/reopen behavior.
- Mobile German journey: fixed responsive dock, complete free-text proposal,
  expanded welcome, reset confirmation, and composer clearance.
- Capture synthetic-data screenshots before and after the changed states.
- Fetch the current web interface guidelines and disposition relevant findings.
- Run one simplifier over the substantive committed slices and one final reviewer
  over the verified integrated commit range. Apply and reverify accepted
  corrections.

After the final runtime-dependent check, stop the exact workspace and verify its
provider state is stopped and its routes are absent.

## Stop conditions

Stop and return for a new decision if the work requires durable storage, a
database or schema change, a dependency, a longer token lifetime, raw client
proposal trust, an iframe-remount reset fallback, production data, secrets,
upstream integration, or an external delivery action.

## Progress

- [x] Remote-state gate and clean task worktree established from
  `origin/v3-ai` at `d96cf502`.
- [x] Product, privacy, UI, runtime, testing, documentation, and workflow skills
  reviewed.
- [x] Native planning review completed and its required corrections integrated.
- [x] Reset-loss behavior settled: immediate when empty, confirm when non-empty,
  disabled while running.
- [x] S0 plan commit.
- [x] S1 trusted proposal continuity.
- [x] S2 complete proposal review.
- [x] S3 non-modal adaptive dock.
- [x] S4 conversation lifecycle and discovery.
- [x] Integrated verification, reviews, screenshots, and runtime shutdown.

## Completion evidence

- Shared types built, and Chat, Manage, and Playwright type checks passed.
  Three focused proposal suites passed with 15 tests.
- Desktop English and mobile German browser journeys verified the non-modal
  dock, responsive resizing, readiness state, reset lifecycle, retained iframe,
  background interaction, translated capabilities, complete proposal review,
  and reachable composer actions. The corrected toolbar and first message had
  no overlap, with eight pixels of clearance.
- The simplifier corrections landed in `44f2a63a9`. The final reviewer found
  four issues, all were dispositioned in `0877f1e03`, and its corrective
  re-review passed without findings.
- Full Chromium Playwright execution remains unavailable because the pinned
  browser installation stalled during extraction. The specification typechecks.
  Repository-wide `check:all` remains blocked only by the unrelated Analytics
  Python toolchain, where Python 3.14 cannot build pandas without a C compiler.
- `origin/v3-ai` advanced by three commits during execution. No upstream merge
  or rebase was authorized, so the branch remains on its original base.
- The exact `rs-manage-assistant-session-ux` DevPod is stopped and all 11
  namespaced routes were freed. Provider state is `Stopped`, and the exact
  remaining route count is zero. The worktree and runtime data are preserved.
