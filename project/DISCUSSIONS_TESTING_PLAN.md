# Discussions Testing Plan (agent-browser)

## Objective

Verify the new discussions platform behavior for Course Q&A using `agent-browser` with evidence-first execution, while preserving existing live feedback behavior in v1.

This runbook is for later execution and does not imply immediate test execution in this step.

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

## Scenario Matrix

| ID | Scenario | Pass Criteria | Fail Criteria |
|---|---|---|---|
| `QA-001` | Manage enables Course Q&A and anonymous embeds toggle persists | Both switches save and remain set after reload | Toggle values reset, save fails, or settings not reflected |
| `QA-002` | PWA course Q&A route visibility depends on course setting | Link/route available only when enabled | Route exposed when disabled or hidden when enabled |
| `QA-003` | Participant creates thread and reply in course scope | New thread and reply visible with correct scope label | Create fails or content not shown in expected scope |
| `QA-004` | Participant upvotes thread and reply idempotently | Upvotes increment once and repeated same action does not double-count | Counter drift or repeated same action mutates count unexpectedly |
| `QA-005` | Practice quiz scoped entry opens filtered Q&A (`pq:{id}`) | Route opens with expected scope filter and relevant threads shown | Scope filter ignored, wrong scope shown, or route broken |
| `QA-006` | Manage overview groups by source label | Group labels include `Course` and `Live Quiz: <name>` when applicable | Missing/incorrect grouping labels |
| `QA-007` | Embed link generation for course scope opens embed mode | Generated URL loads embed-only discussion view | URL invalid, wrong mode, or scope mismatch |
| `QA-008` | Anonymous embed posting requires valid token + course setting | Anonymous post succeeds only when both conditions are true | Anonymous post succeeds when it should be denied, or fails when all conditions are valid |
| `QA-009` | Embed token scope mismatch is denied | Post attempt with mismatched scope token is rejected | Mismatched token still allows write |
| `QA-010` | Anonymous rate limit blocks rapid repeat posts | Burst attempts trigger denial after limit and UI reflects failure | Unlimited anonymous posting allowed in same window |
| `QA-011` | Access denial for non-participating contexts | Unauthorized/non-participating actor cannot read/write course discussion | Unauthorized actor can read/write protected discussions |
| `QA-012` | Legacy live feedback flow still works in v1 | Existing live feedback create/read/upvote behavior unchanged | Regression observed in legacy live feedback |

## Detailed agent-browser Flows

### QA-001: Manage enables Course Q&A and anonymous embeds toggle persists

- Target URL:
  - `https://manage.klicker.com/courses/<course-id>`
- Command skeleton:
  - `agent-browser open https://manage.klicker.com/courses/<course-id>`
  - `agent-browser screenshot /tmp/discussions/QA-001-settings-before.png --full`
  - `agent-browser snapshot -i -c`
  - delegated login actions (if required)
  - open course settings modal
  - enable `Course Q&A` and `Allow Anonymous in Embeds`
  - save changes
  - reload page and re-open settings
  - `agent-browser screenshot /tmp/discussions/QA-001-settings-after.png --full`
  - `agent-browser get url`
- Expected visible assertions:
  - both toggles enabled after save
  - values persist after reload
- Required artifacts:
  - before/after screenshots
  - final URL

### QA-002: PWA route visibility follows course setting

- Target URL:
  - `https://pwa.klicker.com/course/<course-id>`
- Command skeleton:
  - `agent-browser open https://pwa.klicker.com/course/<course-id>`
  - `agent-browser screenshot /tmp/discussions/QA-002-route-before.png --full`
  - `agent-browser snapshot -i -c`
  - verify `Course Q&A` entry visibility state
  - toggle course setting in Manage (precondition step) and reload PWA view
  - `agent-browser screenshot /tmp/discussions/QA-002-route-after.png --full`
  - `agent-browser get url`
- Expected visible assertions:
  - when enabled: Q&A entry visible and navigable
  - when disabled: entry hidden or route access denied
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

### QA-005: Practice quiz scoped entry filters to `pq:{id}`

- Target URL:
  - `https://pwa.klicker.com/course/<course-id>/practiceQuizzes/<quiz-id>`
- Command skeleton:
  - open practice quiz page
  - `agent-browser screenshot /tmp/discussions/QA-005-practice-before.png --full`
  - click `Course Q&A` scoped entry
  - verify resulting URL contains scope key for quiz
  - `agent-browser screenshot /tmp/discussions/QA-005-practice-after.png --full`
  - `agent-browser get url`
- Expected visible assertions:
  - discussion list is filtered to that practice scope
- Required artifacts:
  - before/after screenshots
  - URL capture

### QA-006: Manage overview grouping by source label

- Target URL:
  - `https://manage.klicker.com/courses/<course-id>?tab=discussions`
- Command skeleton:
  - open course discussions tab
  - `agent-browser screenshot /tmp/discussions/QA-006-overview-before.png --full`
  - refresh overview
  - verify groups for `Course` and `Live Quiz: <name>` when linked live data exists
  - `agent-browser screenshot /tmp/discussions/QA-006-overview-after.png --full`
- Expected visible assertions:
  - correct source grouping labels and thread placement
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
- source grouping consistency in course overview (`Course` vs linked `Live Quiz`)
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

The following are explicitly deferred until live dual-write/backfill/read-switch work is implemented:

- legacy-vs-discussion reconciliation checks in live read path
- post-cutover live quiz read parity against legacy feedback behavior
- migration rollback rehearsal metrics under production-like load

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
