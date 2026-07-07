# Review: PR #4946 — Audit logging from UI and more logging from auth

- **Date**: 2026-07-07
- **Scope**: Branch `audit-log-ui` at `f7f9cd61a` vs base branch `audit-log` (8 files, +800 / −322)
- **Goal being reviewed against**: capture student-side and auth-side actions for the immutable assessment-mode audit log
- **Companion review**: `project/REVIEW-2026-07-07-audit-log-pr4872.md` on branch `audit-log` (PR #4872) — read that one first; several blockers there (public-endpoint cookie auth, rebase, CI) determine whether anything in this PR works at all

## Verdict

The event design in this PR is good: join/view/answer-draft/submission events with change detection, client error capture with an assessment-specific error boundary, and auth invitation events that are correctly collected inside the DB transaction and flushed after commit. Three things keep it from being mergeable: (1) it inherits the base-branch bug that the audit endpoint rejects the cookie types exam participants actually have — until that is fixed on `audit-log`, everything this PR adds returns 401 in the real exam setup; (2) two frontend changes (`key={router.asPath}` remount, `currentInstance` object dependency) change app behavior well beyond audit logging and need to be reverted or justified; (3) events that fail after retries are gone forever — the fallback TODO in the PR description is required for production, not a nice-to-have, because during an exam a failing audit path must neither disturb students nor go unnoticed.

---

## What is genuinely good (keep as-is)

- **QuestionArea submit consolidation**: six copy-pasted per-element-type submit branches collapsed into one `requestAnswer` + shared submit/store block (`apps/frontend-pwa/src/components/liveQuiz/QuestionArea.tsx:506-601`). Real maintainability win, and submission audit now also records *failed* attempts with `statusCode`/`success` (`logResponseSubmission`, `:450-487`) — failures are exactly what you need in a dispute.
- **Submission no longer blocked by audit**: the old code `await`ed the audit call before releasing the submit lock; now `logAsync` is fire-and-forget. During an exam, an unreachable audit service adds zero latency to answering.
- **Draft-change events are throttled and meaningful**: the existing 10s temp-save interval now emits `PARTICIPANT_UPDATE_ANSWER` only when the serialized response actually changed, with `changeType`, `diffChars`, `responseLength` and a 200-char preview (`QuestionArea.tsx:195-256`) — enough to reconstruct answer evolution without shipping keystrokes.
- **Auth events respect transaction boundaries**: invitation events are accumulated inside `prisma.$transaction` and flushed only after commit (`apps/auth/src/lib/helpers.ts:199-395`, flush at `:658`) — no audit entries for rolled-back writes, no HTTP inside the transaction. Emails only appear as hashes (`hashSensitiveData`) — good PII hygiene.
- **Client error capture is bounded**: 4,000-char truncation for message/stack/componentStack (`apps/frontend-pwa/src/pages/_app.tsx:31-38`), global `error` + `unhandledrejection` listeners registered only in assessment mode (`:144-187`).
- `useAuditClient` now strips `undefined` values before serialization (`packages/shared-components/src/hooks/useAuditClient.ts:59-66`) — avoids schema-validation noise.

---

## Findings

Severity: 🔴 blocker · 🟠 major · 🟡 minor.

### Frontend (`frontend-pwa`)

1. 🔴 **Inherited: all these events 401 for password/temporary participants.** `useAuditClient` posts with `credentials: 'include'`, but the endpoint only accepts `next-auth.participant-session-token` (base branch, `apps/audit/src/routes/audit-public.ts:36-47`). Exam seat accounts get `participant_token`, temporary accounts `temporary_participant_token` (`packages/graphql/src/services/accounts.ts:89,243`). Fix lives on `audit-log` (see companion review, roadmap step 3), but **verify from this branch** that events flow for all three login types before calling this PR done.
2. 🟠 **`key={router.asPath}` forces a full page remount on every navigation, in all modes.** `pageComponent = <Component key={router.asPath} {...pageProps} />` (`_app.tsx:242`) applies to assessment *and* normal mode. Any route or query-param change unmounts the whole page tree: local state loss, refetches, scroll reset — an app-wide behavior change smuggled in via an audit PR. If the intent was to reset the error boundary on navigation, reset it explicitly (e.g. `useEffect` on `router.asPath` calling `reset()`, or key the `AssessmentErrorBoundary` instead, inside the assessment-only branch). Remove the key from the always-rendered component.
3. 🟠 **Effect dependency changed from `currentInstance?.id` to `currentInstance` (object identity)** (`QuestionArea.tsx:194` and `:260-267`). The instances prop is re-derived from Apollo data; every poll/subscription update creates new object references, so both effects re-run continuously: `loadStoredResponse` re-executes (async localforage reads + `setState`) and the 10s temp-save interval is torn down and re-created. If updates arrive more often than every 10s, **the draft save and the `PARTICIPANT_UPDATE_ANSWER` events may never fire**. Revert to primitive deps (`currentInstance?.id`) and read the latest object via a ref inside the effect. Verify with a live quiz open and network tab: temp saves must appear every 10s while typing.
4. 🟠 **Error-boundary fallback is hardcoded English** (`_app.tsx:189-231`: "Assessment temporarily unavailable", "Try again", "Reload page"). The app is fully i18n'd via next-intl and exams run in German too. Move the strings to `packages/i18n` messages and use `useTranslations`. Also reconsider showing raw `error.message` in the `<pre>` to students — an opaque error code + "show details" toggle leaks less and still helps support.
5. 🟠 **Events that fail all 3 retries are lost, silently from the operator's perspective** (`useAuditClient.ts:83-92`: `console.warn` in the student's browser only). Two-part fix, in priority order:
   - **Fallback path (the PR-description TODO — required)**: on final failure, send the event to the backend (GraphQL mutation `logAuditEvent`), which pushes it into Hatchet's `create-audit-log-entry` task (retries, durable; task exists at `packages/hatchet/src/index.ts:49-65`). The backend must enforce the public-action allow-list and overwrite `subject` from the authenticated context, mirroring `audit-public.ts:99-123`.
   - **Local buffer**: queue failed events in localforage and flush on the next successful send / page load, so even a full outage window is recoverable. Cap the queue (e.g. 200 events) to bound storage.
6. 🟡 **Tab-close loses in-flight events.** `fetch` without `keepalive` and no `pagehide`/`visibilitychange` flush — the final `PARTICIPANT_UPDATE_ANSWER`/`SUBMIT_RESPONSE` of a session can vanish when the student closes the tab. Add `keepalive: true` to the fetch (payloads here are ≪64KB) and flush the local buffer on `pagehide` via `navigator.sendBeacon`.
7. 🟡 **`PARTICIPANT_JOIN_QUIZ` fires on component mount, not on actual join, and re-fires per reload** (`QuestionArea.tsx:270-286`, guarded only by an in-memory ref). Server-side PIN events already exist (`liveQuizzes.ts:2965`); treat the client event as "quiz UI opened" and name/attribute it accordingly (`attributes.trigger: 'mount'`), or dedupe server-side via deterministic eventId. Also note `attributes.timestamp: Date.now()` duplicates the event's own timestamp — drop it.
8. 🟡 **`viewedInstancesRef`/`lastLoggedResponseRef` reset on remount** — combined with finding 2's remount-on-navigation, every navigation re-emits `VIEW_INSTANCE` for already-viewed instances. Acceptable (views are idempotent facts) but be aware when reading the log; fixing findings 2/3 mostly removes the noise.

### Auth (`apps/auth`)

9. 🟠 **`flushAuditEvents` is awaited inside the login flow** (`helpers.ts:658` in `createOrLinkParticipant`). With the audit service down, each event costs up to ~10.5s (2 attempts × 5s timeout + backoff, `packages/util/src/audit.ts:63-108`); `Promise.all` parallelizes but the slowest event still delays Edu-ID login completion. During an exam-morning login rush with a degraded audit service this is a real availability risk. Either fire-and-forget (`void flushAuditEvents(...)` + error log) or shorten the client timeout for the auth app (e.g. 1.5s, 0 retries) — login must never wait on audit.
10. 🟡 **Module-level `new AuditClient()` silently disables auth auditing on misconfig** (`helpers.ts:90-95`: constructor throws if env vars missing → `auditClient = null` → all events skipped with only a startup warning). Fail hard in production (`NODE_ENV === 'production'` + assessment context ⇒ throw), warn-and-continue only in dev.
11. 🟡 **Failure taxonomy is good but unbounded `reason` strings**: `recordFailure('auto_accept_error', { error: error.message })` (`helpers.ts:391-394`) can carry long/PII-ish ORM errors into attributes. Truncate to a few hundred chars like `_app.tsx` does.
12. 🟡 Inherited from base branch, but this file is touched here: code-scanning flags an externally-controlled format string at `helpers.ts:114` — while editing this file anyway, switch any `console.*`/pino calls that interpolate user-derived values in the *format* position to structured arguments.

### Process

13. 🟠 **No tests for any of the new behavior.** At minimum: unit test for `useAuditClient` retry/fallback ordering (mock fetch), a component test asserting `PARTICIPANT_SUBMIT_RESPONSE` fires with `success: false` on a failed submit, and an auth test asserting invitation events are flushed only after the transaction commits (and not on rollback).
14. 🟡 PR title says "more logging from auth" but the auth delta only covers invitation auto-accept. Lecturer/participant *login* success events via the auth app (nextauth callbacks) are still missing — align the PR description with reality or add them here (companion review, finding 9).

---

## Instructions to finish this PR (ordered)

Do the base-branch work first (companion review steps 1–4); this branch merges into `audit-log`, so rebase it after each base change (`git checkout audit-log-ui && git merge audit-log`).

**1. Revert the two behavior changes (findings 2, 3).**
Remove `key={router.asPath}`; restore `currentInstance?.id`-style primitive effect deps and access the instance object through a ref. Manually verify in the browser (agent-browser, delegated login `testuser1/abcdabcd` against the local stack): (a) navigating between pages keeps unrelated page state, (b) with a live quiz open, temp saves hit localforage every 10s while typing, (c) `PARTICIPANT_UPDATE_ANSWER` appears in the audit table (Azurite) at most every 10s and only on change.

**2. Implement the backend fallback + local buffer (finding 5).**
New mutation `logAuditEvent(event: PublicAuditEventInput!)` in `packages/graphql` (regenerate ops: `pnpm --filter @klicker-uzh/graphql generate`): validate action against `ALLOWED_PUBLIC_ACTIONS`, override `subject`/`scope`/`timestamp` from `ctx`, push to `ctx.hatchet.events.push('create-audit-log-entry', …)`. In `useAuditClient`: on final direct failure → try mutation → on failure enqueue to localforage (`audit-pending` key, cap 200) → flush queue on next mount/successful send.
*Done when*: with the audit service container stopped, answering questions produces zero student-visible errors and all events appear in the table after the service restarts (via Hatchet retries / queue flush).

**3. i18n the error boundary (finding 4).**
Strings into `packages/i18n` (`de`/`en`), replace raw `error.message` with a collapsed details section. Screenshot both locales for the PR description.

**4. Un-await audit in the login flow (finding 9), harden client init (finding 10), truncate error attributes (finding 11).**

**5. Add `keepalive`/`pagehide` flush (finding 6) and rename/attribute the join event (finding 7).**

**6. Tests (finding 13), then full verification loop.**
Run the assessment-mode stack locally (`.env.assessment` wiring: `NEXT_PUBLIC_IS_ASSESSMENT=true`, audit service + Azurite up), log in as each participant type (password, temporary), complete a quiz, and paste the resulting event sequence (from Azurite Table query) into the PR description as evidence. Add before/after screenshots of the error boundary (trigger with a thrown error in dev).

**7. Update the PR description**: check off the fallback TODO, document what is and isn't covered (e.g. login-success events deferred to base branch), and list the manual verification steps a reviewer should repeat.
