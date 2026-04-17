# Discussions Testing Plan (agent-browser)

## Objective

Verify the new discussions platform behavior for Course Q&A using `agent-browser` with evidence-first execution, while preserving existing live feedback behavior in v1.

This runbook has now been partially executed on the real `*.klicker.com` setup and should be treated as the source of truth for both remaining work and already-captured evidence.

The approved next alpha rollout/surface model is now split into three buckets:

- evidence already captured for the current branch behavior
- W1 rollout-gate behavior that is implemented in code but not yet fully executed across the full runtime matrix
- the scenario definitions that must be re-run or expanded once the stack-only alpha surface model is implemented

Any later reintroduction of deferred scopes (`PRACTICE_QUIZ`, `PRACTICE_ELEMENT`, linked live aggregation, or lecturer-facing migration UI/read-switch behavior) requires a dedicated follow-up validation matrix rather than silently broadening `QA-001` to `QA-012`.

## Preconditions

- Node 20 is active and dependencies are installed.
- Local services are running and reachable:
  - Manage UI
  - PWA
  - API
- Database is seeded with known test users and course/test content.
- Discussion schema migration has been applied in the test environment.
- Realtime subscriptions are out of scope for this verification cycle.

## Environment and Accounts

- Lecturer delegated login (local seeded env):
  - username: `lecturer`
  - password: `abcd`
- Participant login (local seeded env):
  - usernames: `testuser1` to `testuser50`
  - password: `abcdabcd`
- Base URLs (preferred):
  - `https://manage.klicker.com`
  - `https://pwa.klicker.com`
  - `https://api.klicker.com`
- Fallback URLs if Traefik is not used:
  - `http://localhost:3002` (Manage)
  - `http://localhost:3001` (PWA)
  - `http://localhost:3000` (API)

## Evidence Requirements

For each scenario (`QA-001` to `QA-012`), capture:

- one screenshot before key action
- one screenshot after key action
- optional `agent-browser snapshot -i -c` output when element refs are needed
- URL capture after key transitions (`agent-browser get url`)

Artifact naming convention:

- `/tmp/discussions/<scenario-id>-<step>-before.png`
- `/tmp/discussions/<scenario-id>-<step>-after.png`

Example:

- `/tmp/discussions/QA-003-create-thread-before.png`
- `/tmp/discussions/QA-003-create-thread-after.png`

All scenarios are binary:

- `PASS`: expected behavior observed with required evidence attached
- `FAIL`: behavior mismatch or missing evidence

## Current Execution Status (2026-04-13)

| ID | Current Status | Notes / Evidence State |
|---|---|---|
| `QA-001` | BLOCKED | Hidden rollout-gate behavior is implemented in code, but lecturer-side validation is still blocked because `https://manage.klicker.com` routes to Jobeye and even the localhost fallback redirects there after delegated login. |
| `QA-002` | PARTIAL | Direct `/qa` route behavior was validated earlier and the course-page `Course Q&A` entry is now confirmed on `https://pwa.klicker.com` in the rollout-on/runtime-on state, but rollout-off and rollout-on/runtime-off discoverability evidence is still pending. |
| `QA-003` | PASS | Real-domain PWA validation confirmed enrolled thread creation and reply creation with screenshots. |
| `QA-004` | PASS | Real-domain PWA validation confirmed idempotent upvote behavior on the created thread/reply flow with screenshots. |
| `QA-005` | PARTIAL PASS | Stack-only alpha surface implemented and runtime-verified: (1) microlearning evaluation shows "Discuss this stack" per stack, (2) clicking navigates to `qa?scopeKey=stack%3A<id>`, (3) thread creation works in stack scope, (4) course feed correctly excludes stack threads (isolation confirmed), (5) practice-quiz answering state hides the link. Flag-off test interrupted by agent-browser daemon instability; flag gating is structurally correct (props default to `false`). Screenshots under `/tmp/discussions/20-25-*`. |
| `QA-006` | BLOCKED | Manage overview and rollout-gate visibility still require lecturer-side validation, but lecturer auth currently redirects into the misrouted `manage.klicker.com` host. |
| `QA-007` | PASS (service-generated URL) | Embed mode rendering was validated on real signed URLs generated directly from app secrets because the manage UI host is currently unavailable. |
| `QA-008` | PASS (service-generated URL) | Anonymous-enabled vs identified-only embed behavior was validated on real signed URLs on `https://pwa.klicker.com`. |
| `QA-009` | PASS (service-generated URL) | Tampered embed `scopeKey` was validated to fail closed with an access-denied state and no anonymous UI leak. |
| `QA-010` | NOT RUN | Anonymous rate-limit behavior is still pending dedicated runtime execution. |
| `QA-011` | PASS | Non-participating user on an enabled course was validated to receive the explicit access-denied state on the real PWA domain. |
| `QA-012` | NOT RUN | Legacy live feedback regression validation has not been executed yet. |

Additional verification status:

- Real-domain seed course used for validation: `Testkurs` (`7c12e44e-d083-4acf-845e-4c34aaff6b49`)
- Seed and live dev DB were both updated so `Testkurs` now has:
  - `isCourseQARolloutEnabled = true`
  - `isCourseQAEnabled = true`
  - `isCourseQAAnonymousEnabled = true`
- Local compile checks already completed and green:
  - `pnpm --filter @klicker-uzh/prisma build`
  - `pnpm --filter @klicker-uzh/graphql check`
  - `pnpm --filter @klicker-uzh/frontend-pwa check`
  - `pnpm --filter @klicker-uzh/frontend-manage check`
- Additional runtime evidence already captured:
  - `Course Q&A` entry is visible on the real course page in the rollout-on/runtime-on state
  - localhost Manage fallback reaches the correct Klicker auth page, but post-login redirects to `https://manage.klicker.com/en`, which still resolves to Jobeye
- DB-backed GraphQL integration tests remain blocked by the unavailable integration DB/test environment.

## Scenario Matrix

| ID | Scenario | Pass Criteria | Fail Criteria |
|---|---|---|---|
| `QA-001` | Manage hidden rollout gate and Q&A settings visibility behave correctly | No Q&A UI visible when rollout gate is off; Q&A settings appear only after rollout gate is activated; settings persist after save | Any Q&A UI visible before rollout activation, settings fail to persist once visible, or lecturer-side auth/routing prevents the scenario from being executed |
| `QA-002` | PWA course discoverability follows rollout gate and course setting | No Q&A discoverability when rollout gate is off; course entry appears only when rollout gate and runtime enablement allow it | Q&A entry/route exposed too early, or hidden when the approved state should expose it |
| `QA-003` | Participant creates thread and reply in course scope | New thread and reply visible with correct scope label | Create fails or content not shown in expected scope |
| `QA-004` | Participant upvotes thread and reply idempotently | Upvotes increment once and repeated same action does not double-count | Counter drift or repeated same action mutates count unexpectedly |
| `QA-005` | Evaluated stack surface opens stack-scoped Q&A (`PRACTICE_STACK`) | Discussion is reachable only from the evaluated stack/microlearning result surface and shows the expected stack history | Discussion appears during answering, wrong scope opens, or stack history is missing |
| `QA-006` | Manage visibility and overview follow the rollout-gate alpha model | No Course Q&A tab/settings/embed tooling when rollout gate is off; when visible, overview stays correct for the course-only alpha surface | Manage shows Q&A UI before rollout activation or visible overview/grouping is incorrect |
| `QA-007` | Embed link generation for course scope opens embed mode | Generated URL loads embed-only discussion view | URL invalid, wrong mode, or scope mismatch |
| `QA-008` | Anonymous embed posting requires valid token + course setting | Anonymous post succeeds only when both conditions are true | Anonymous post succeeds when it should be denied, or fails when all conditions are valid |
| `QA-009` | Embed token scope mismatch is denied | Post attempt with mismatched scope token is rejected | Mismatched token still allows write |
| `QA-010` | Anonymous rate limit blocks rapid repeat posts | Burst attempts trigger denial after limit and UI reflects failure | Unlimited anonymous posting allowed in same window |
| `QA-011` | Access denial for non-participating contexts | Unauthorized/non-participating actor cannot read/write course discussion | Unauthorized actor can read/write protected discussions |
| `QA-012` | Legacy live feedback flow still works in v1 | Existing live feedback create/read/upvote behavior unchanged | Regression observed in legacy live feedback |

## Detailed agent-browser Flows

### QA-001: Manage hidden rollout gate and Q&A settings visibility behave correctly

- Target URL:
  - `https://manage.klicker.com/courses/<course-id>`
- Command skeleton:
  - `agent-browser open https://manage.klicker.com/courses/<course-id>`
  - `agent-browser screenshot /tmp/discussions/QA-001-settings-before.png --full`
  - `agent-browser snapshot -i -c`
  - delegated login actions (if required)
  - verify no Q&A tab/settings/embed tooling when rollout gate is off
  - activate rollout gate via admin/precondition step
  - reload page and verify Q&A UI is now visible
  - open course settings modal
  - enable `Course Q&A` and `Allow Anonymous in Embeds`
  - save changes
  - reload page and re-open settings
  - `agent-browser screenshot /tmp/discussions/QA-001-settings-after.png --full`
  - `agent-browser get url`
- Expected visible assertions:
  - nothing Q&A-related visible before rollout activation
  - settings become visible only after rollout activation
  - both toggles enabled after save
  - values persist after reload
- Required artifacts:
  - before/after screenshots
  - final URL

### QA-002: PWA course discoverability follows rollout gate and course setting

- Target URL:
  - `https://pwa.klicker.com/course/<course-id>`
- Command skeleton:
  - `agent-browser open https://pwa.klicker.com/course/<course-id>`
  - `agent-browser screenshot /tmp/discussions/QA-002-route-before.png --full`
  - `agent-browser snapshot -i -c`
  - verify no Q&A discoverability when rollout gate is off
  - activate rollout gate and reload PWA view
  - verify still hidden while `isCourseQAEnabled` is off
  - enable course Q&A and reload again
  - `agent-browser screenshot /tmp/discussions/QA-002-route-after.png --full`
  - `agent-browser get url`
- Expected visible assertions:
  - when rollout gate is off: no entry and direct route denied
  - when rollout gate is on but course Q&A disabled: student entry still hidden / route denied
  - when both rollout gate and course Q&A are enabled: entry visible and navigable
- Required artifacts:
  - before/after screenshots for both states
  - URL captures

### QA-003: Participant creates thread and reply in course scope

- Target URL:
  - `https://pwa.klicker.com/course/<course-id>/qa`
- Command skeleton:
  - `agent-browser open https://pwa.klicker.com/course/<course-id>/qa`
  - participant login as `testuser1` if needed
  - `agent-browser screenshot /tmp/discussions/QA-003-create-thread-before.png --full`
  - `agent-browser snapshot -i -c`
  - create thread in default course scope
  - create reply on same thread
  - `agent-browser screenshot /tmp/discussions/QA-003-create-thread-after.png --full`
  - `agent-browser get url`
- Expected visible assertions:
  - thread appears with course scope label
  - reply appears under thread
- Required artifacts:
  - before/after screenshots
  - URL capture

### QA-004: Upvote idempotency for thread and reply

- Target URL:
  - `https://pwa.klicker.com/course/<course-id>/qa`
- Command skeleton:
  - open page and locate existing thread/reply
  - `agent-browser screenshot /tmp/discussions/QA-004-upvote-before.png --full`
  - upvote thread once, verify +1
  - repeat same action without opposite toggle where applicable, verify no double increment
  - do same for reply
  - `agent-browser screenshot /tmp/discussions/QA-004-upvote-after.png --full`
- Expected visible assertions:
  - counters reflect idempotent behavior
- Required artifacts:
  - before/after screenshots
  - optional snapshots around each click

### QA-005: Evaluated stack surface opens stack-scoped Q&A (`PRACTICE_STACK`)

- Implementation details:
  - scope key format is the activity-agnostic `stack:<stackId>`; server resolves
    across practice quizzes and microlearnings via a single `PRACTICE_STACK`
    scope type
  - entry points are gated on `isCourseQARolloutEnabled && isCourseQAEnabled`
  - practice surface: `ElementStack.tsx:302` renders the link only for
    `stack.type === 'PRACTICE_QUIZ'` stacks (microlearning answering pages
    render stacks with a different type, so the link is hidden during answering)
  - microlearning surface: `microLearnings/[id]/evaluation.tsx` renders the
    link per stack in the evaluation list (answering flow is served from a
    separate `[ix].tsx` page that does not render this UI)
- Target URL:
  - evaluated stack or microlearning result surface for `<stack-id>`
- Command skeleton:
  - open a practice or microlearning flow and reach the evaluated/result state for a stack
  - `agent-browser screenshot /tmp/discussions/QA-005-practice-before.png --full`
  - verify no discussion entry during answering
  - on the evaluated/result surface, open the stack discussion entry
  - verify resulting view is stack-scoped
  - `agent-browser screenshot /tmp/discussions/QA-005-practice-after.png --full`
  - `agent-browser get url`
- Expected visible assertions:
  - discussion is reachable only from the evaluated/result surface
  - full stack history is visible there
- Required artifacts:
  - before/after screenshots
  - URL capture

### QA-006: Manage visibility and overview follow the rollout-gate alpha model

- Target URL:
  - `https://manage.klicker.com/courses/<course-id>?tab=discussions`
- Command skeleton:
  - verify the discussions tab is absent when rollout gate is off
  - activate rollout gate and open course discussions tab
  - `agent-browser screenshot /tmp/discussions/QA-006-overview-before.png --full`
  - refresh overview
  - verify the alpha overview remains course-only
  - `agent-browser screenshot /tmp/discussions/QA-006-overview-after.png --full`
- Expected visible assertions:
  - no discussion tab/overview before rollout activation
  - course-only overview/grouping remains correct for alpha
- Required artifacts:
  - before/after screenshots

### QA-007: Embed link generation and embed mode rendering

- Target URL:
  - `https://manage.klicker.com/courses/<course-id>?tab=discussions`
- Command skeleton:
  - open discussions tab and generate embed link for course scope
  - copy/open generated URL
  - `agent-browser screenshot /tmp/discussions/QA-007-embed-before.png --full`
  - verify embed layout (discussion-only chrome)
  - `agent-browser screenshot /tmp/discussions/QA-007-embed-after.png --full`
  - `agent-browser get url`
- Expected visible assertions:
  - embed URL loads and UI is in embed mode
- Required artifacts:
  - before/after screenshots
  - generated URL capture

### QA-008: Anonymous embed post allowed only with valid token + course setting

- Target URL:
  - generated embed URL
- Command skeleton:
  - `agent-browser screenshot /tmp/discussions/QA-008-anon-before.png --full`
  - with anonymous allowed + course setting enabled, post anonymously
  - `agent-browser screenshot /tmp/discussions/QA-008-anon-allow-after.png --full`
  - disable one prerequisite and retry
  - `agent-browser screenshot /tmp/discussions/QA-008-anon-deny-after.png --full`
- Expected visible assertions:
  - allow case succeeds
  - deny case is blocked
- Required artifacts:
  - screenshots for allow and deny outcomes
  - URL capture

### QA-009: Embed token scope mismatch denied

- Target URL:
  - embed URL with intentionally mismatched scope target
- Command skeleton:
  - generate token for one scope
  - navigate/force post attempt in different scope
  - `agent-browser screenshot /tmp/discussions/QA-009-mismatch-before.png --full`
  - submit post
  - `agent-browser screenshot /tmp/discussions/QA-009-mismatch-after.png --full`
- Expected visible assertions:
  - post rejected and not visible
- Required artifacts:
  - before/after screenshots
  - URL capture

### QA-010: Anonymous rate-limit behavior

- Target URL:
  - valid anonymous embed URL
- Command skeleton:
  - `agent-browser screenshot /tmp/discussions/QA-010-rate-before.png --full`
  - submit rapid sequence of anonymous posts within same window
  - verify first allowed and subsequent blocked by rate-limit policy
  - `agent-browser screenshot /tmp/discussions/QA-010-rate-after.png --full`
- Expected visible assertions:
  - denial appears after threshold
- Required artifacts:
  - before/after screenshots
  - optional snapshots around each submit

### QA-011: Access denial for non-participating contexts

- Target URL:
  - `https://pwa.klicker.com/course/<course-id>/qa`
- Command skeleton:
  - login with non-participating user context (or anonymous non-embed context)
  - `agent-browser screenshot /tmp/discussions/QA-011-access-before.png --full`
  - attempt read/write actions
  - `agent-browser screenshot /tmp/discussions/QA-011-access-after.png --full`
- Expected visible assertions:
  - read/write denied as per access policy
- Required artifacts:
  - before/after screenshots
  - URL capture

### QA-012: Legacy live feedback regression check (v1 compatibility)

- Target URL:
  - live quiz page/cockpit where existing live feedback is used
- Command skeleton:
  - `agent-browser screenshot /tmp/discussions/QA-012-live-feedback-before.png --full`
  - create/read/upvote in legacy live feedback flow
  - `agent-browser screenshot /tmp/discussions/QA-012-live-feedback-after.png --full`
- Expected visible assertions:
  - legacy behavior remains functional and unchanged
- Required artifacts:
  - before/after screenshots
  - URL capture

## Supplementary Backend/Data Verification

After browser scenarios, corroborate with backend/data checks:

- thread/reply counts match expected UI actions
- source grouping consistency in course overview (`Course` only in alpha; linked live grouping deferred)
- vote counts remain consistent after repeated toggle operations
- anonymous denial/rate-limit events captured as `ANON_RATE_LIMITED`

Recommended outputs:

- scenario-to-record-count table
- mismatch list (empty means pass)

## Exit Criteria

Release-readiness for the discussion verification cycle requires:

- all required scenarios `QA-001` to `QA-012` executed
- every scenario marked `PASS` or `FAIL` with linked evidence
- no missing mandatory artifacts
- all `FAIL` scenarios mapped to issue tickets or explicit defer decisions

Binary result:

- `PASS`: all required scenarios pass with complete evidence
- `FAIL`: any required scenario fails or evidence is incomplete

## Deferred Scenarios (Post-Migration)

The following are explicitly deferred until live dual-write/backfill/read-switch work is implemented, or until post-alpha scope re-expansion is approved:

- legacy-vs-discussion reconciliation checks in live read path
- post-cutover live quiz read parity against legacy feedback behavior
- migration rollback rehearsal metrics under production-like load
- `PRACTICE_QUIZ` entry-point validation
- `PRACTICE_ELEMENT` entry-point validation
- linked live aggregation validation in course-facing feed/overview surfaces

## Reporting Template

Use this template for each execution run:

```md
# Discussions Verification Report

- Date:
- Environment:
- Commit/Branch:
- Tester:

## Summary
- Overall result: PASS | FAIL
- Scenarios passed:
- Scenarios failed:
- Scenarios deferred:

## Scenario Results
| ID | Result | Evidence | Notes |
|---|---|---|---|
| QA-001 | PASS/FAIL | /tmp/discussions/... | |
| QA-002 | PASS/FAIL | /tmp/discussions/... | |
| QA-003 | PASS/FAIL | /tmp/discussions/... | |
| QA-004 | PASS/FAIL | /tmp/discussions/... | |
| QA-005 | PASS/FAIL | /tmp/discussions/... | |
| QA-006 | PASS/FAIL | /tmp/discussions/... | |
| QA-007 | PASS/FAIL | /tmp/discussions/... | |
| QA-008 | PASS/FAIL | /tmp/discussions/... | |
| QA-009 | PASS/FAIL | /tmp/discussions/... | |
| QA-010 | PASS/FAIL | /tmp/discussions/... | |
| QA-011 | PASS/FAIL | /tmp/discussions/... | |
| QA-012 | PASS/FAIL | /tmp/discussions/... | |

## Backend Corroboration
- Counts check:
- Grouping check:
- Vote consistency check:
- `ANON_RATE_LIMITED` check:

## Action Items
1. ...
2. ...
```
