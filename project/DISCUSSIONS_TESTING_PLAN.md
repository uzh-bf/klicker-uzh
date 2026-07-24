# Course Q&A Testing Plan

## Objective

Verify the Course Q&A alpha as an integrated part of existing course,
practice-stack, microlearning-evaluation, and lecturer workflows. The standalone
`/qa` route is tested only as a fallback/deep link and as the embed host.

This file is the current verification matrix for PR #5072. Execution details and
slice history live in
`project/2026-06-01-pr-5072-integrated-course-qa-plan.md`.

## Environment

- Node `24.16.0` and pnpm `11.5.0`
- Isolated devrouter workspace: `codex-course-qa-takeover`
- Preferred local URLs:
  - `https://pwa.klicker.codex-course-qa-takeover.localhost`
  - `https://manage.klicker.codex-course-qa-takeover.localhost`
  - `https://api.klicker.codex-course-qa-takeover.localhost`
- Seeded local accounts:
  - lecturer delegated login: `lecturer` / `abcd`
  - participants: `testuser1` to `testuser50` / `abcdabcd`
- Screenshot directory:
  - `project/_local/course-qa-screenshots/`

The `_local` evidence directory is intentionally ignored. Attach its selected
screenshots to the draft PR so reviewers can access them.

## Proof Types

- **Browser screenshot**: manually exercised with `agent-browser` against the
  isolated real app and routing.
- **Focused Chromium**: Cypress workflow completed against the isolated app.
- **Backend integration**: DB-backed Vitest scenario completed against the
  isolated PostgreSQL and Redis services.
- **Static**: type, lint, format, schema-generation, or build verification only.

Do not present static checks as runtime proof. A scenario is `PASS` only when its
behavior has browser or backend runtime evidence appropriate to the assertion.

## Current Status

Last reconciled: 2026-07-23.

| ID | Status | Scenario | Evidence |
|---|---|---|---|
| `QA-001` | PASS | Rollout and runtime gates hide Q&A in Manage until enabled | Focused Chromium rollout workflow `7/7`; course workflow `8/8` |
| `QA-002` | PASS | Course overview integrates Q&A only when both gates allow it | Focused Chromium course and rollout workflows; screenshots `01`, `03`, `04` |
| `QA-003` | PASS | Participant creates a course thread and reply in place | Focused Chromium course workflow; screenshot `02` |
| `QA-004` | PASS | Thread and reply upvotes toggle without counter drift | Focused Chromium course workflow; backend integration `23/23`; screenshot `02` |
| `QA-005` | PASS | Evaluated practice and microlearning stacks expose contextual Q&A, while answering does not | Focused Chromium practice workflow `7/7`; authenticated screenshots `08` to `12` |
| `QA-006` | PASS | Lecturer overview groups and paginates course and stack threads | Focused Chromium course/practice workflows; screenshots `06`, `07` |
| `QA-007` | PASS | Lecturer generates external-block and course-wide embed links | Focused Chromium embed workflow `6/6`; screenshots `14`, `15` |
| `QA-008` | PASS | Anonymous embed posting requires a valid token and enabled course policy | Focused Chromium embed workflow; backend integration; screenshots `15`, `16` |
| `QA-009` | PASS | Tampered or stale embed scope/token fails closed without persistent side effects | Focused Chromium embed workflow; backend integration |
| `QA-010` | PARTIAL | Anonymous rate limits reject repeated posting and bound audit writes | Backend integration passes scope, course, IP, and TTL cases; browser error-state screenshot pending |
| `QA-011` | PASS | Non-participants and unevaluated stack participants cannot read/write protected scopes | Focused Chromium rollout workflow; backend integration |
| `QA-012` | PENDING | Existing v1 live-feedback create/read/upvote flow remains unchanged | No fresh branch runtime run |

## Completed Runtime Suites

### Focused Chromium

The Course Q&A workflow was split into independently seeded specs to avoid
renderer memory exhaustion:

| Workflow | Result | Coverage |
|---|---:|---|
| Course baseline | `8/8` | Manage visibility/settings, integrated course feed, fallback route, create/reply/vote, second participant |
| Practice | `7/7` | Evaluation gating, mobile disclosure, stack posting, course isolation, lecturer grouping |
| Embed | `6/6` | Link generation, chrome-free embed, identified/anonymous thread and reply, tampered token |
| Rollout gates | `7/7` | Runtime-off and rollout-off behavior in PWA, fallback route, and Manage |

The large legacy microlearning workflow has compile-time coverage for the new
selector, DOM order, disclosure state, and context switch. Its current Q&A
states were also exercised directly with `agent-browser`.

The current course spec contains two later regression cases for READ-only
lecturers and Q&A-only courses. Those cases compile but did not complete a fresh
runtime run after the local Auth setup began redirecting before the first
assertion; they remain explicit finish-gate work.

### Backend Integration

Run:

```bash
docker exec -w /workspaces/klicker-uzh default-co-c3448-app-1 \
  sh -lc 'HATCHET_CLIENT_TOKEN="$(cat /hatchet-token/api.token)" \
  APP_SECRET=test-app-secret \
  pnpm --filter @klicker-uzh/graphql exec vitest run test/discussions.test.ts'
```

Current result: `23/23` passing.

The suite covers:

- course, practice-stack, microlearning-stack, external-block, and course-embed
  scope behavior
- rollout/runtime gates for reads, writes, votes, and deletes
- evaluated-stack authorization with zero side effects on rejection
- participant, anonymous, and embed-token authorization
- anonymous scope/course/IP rate limits and bounded audit events
- content length and comparison-text preservation
- reply caps and concurrent create/delete behavior
- concurrent idempotent votes and deletes
- source grouping, default course-only listing, and cursor pagination
- stack presentation metadata on list and mutation responses

## Screenshot Inventory

| File | Functionality |
|---|---|
| `01-course-overview-desktop.png` | Integrated course overview with desktop Q&A rail |
| `02-course-thread-reply-upvotes.png` | Thread, reply, and upvote interaction |
| `03-course-overview-mobile.png` | Course overview on mobile |
| `04-course-qa-mobile-panel.png` | In-page course Q&A on mobile |
| `05-practice-stack-desktop-rail.png` | Initial practice desktop rail proof |
| `06-manage-overview-first-page.png` | Lecturer overview at 20-thread first page |
| `07-manage-overview-all-threads.png` | Lecturer overview after loading all 27 threads |
| `08-practice-mobile-collapsed.png` | Practice Q&A collapsed after evaluation |
| `09-practice-mobile-expanded.png` | Practice Q&A expanded in place |
| `10-practice-desktop-responsive-rail.png` | Practice Q&A beside evaluated content |
| `11-microlearning-evaluation-desktop.png` | Microlearning results with contextual desktop rail |
| `12-microlearning-evaluation-mobile-collapsed.png` | Microlearning Q&A before long results, collapsed |
| `12-microlearning-evaluation-mobile-expanded.png` | Microlearning Q&A expanded in place |
| `13-qa-fallback-deep-link.png` | Standalone fallback/deep-link route |
| `14-manage-embed-generated-redacted.png` | Lecturer embed generator with bearer redacted |
| `15-anonymous-embed-empty.png` | Chrome-free anonymous embed |
| `16-anonymous-embed-thread-reply.png` | Anonymous embed thread and reply |

## Remaining Finish-Gate Runs

1. Capture the anonymous rate-limit error state in the browser (`QA-010`).
2. Run the existing v1 live-feedback smoke (`QA-012`).
3. Re-run the four independently seeded Course Q&A Chromium specs after the
   final structural changes.
4. Re-run all `23/23` backend integration scenarios.
5. Capture fresh desktop/mobile screenshots only when the final branch changes
   visible behavior; behavior-preserving refactors can retain the already
   authenticated evidence when the current local Auth setup blocks a new
   session, but the blocker must be stated.

## Browser Procedure

Use `agent-browser` against the devrouter URLs. Verify both `1440x900` desktop
and a mobile viewport around `390x844`.

For every changed visible state:

1. Open the existing course/activity page.
2. Confirm Q&A is integrated in that page rather than requiring navigation.
3. Confirm the desktop rail remains beside the primary content.
4. Confirm mobile Q&A follows the relevant content as a collapsed disclosure.
5. Exercise thread, reply, vote, context switch, pagination, and embed controls
   relevant to the surface.
6. Check the fallback `/qa` route separately.
7. Save a screenshot under `project/_local/course-qa-screenshots/`.

If local participant or delegated login fails, record the exact redirect or
session behavior. Do not replace authenticated runtime proof with a static page
or claim a screenshot that was not captured.

## Deferred Scope

The alpha intentionally does not include:

- realtime subscriptions
- answered/resolved state
- pinned threads
- expanded lecturer moderation beyond the product decision still pending
- broader practice-quiz or element-level discussion scope types
- linked live-session aggregation
- anonymous-embed GA rollout policy

Any later expansion requires its own scenario matrix rather than silently
broadening `QA-001` to `QA-012`.
