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

| ID | Status | Scenario | Last Result | Remaining Delta |
|---|---|---|---|---|
| `QA-001` | PASS | Rollout and runtime gates hide Q&A in Manage until enabled | Rollout Chromium `7/7`; course baseline `8/8` | Re-run current course spec with later READ-only case |
| `QA-002` | PASS | Course overview integrates Q&A only when both gates allow it | Course/rollout Chromium baseline; screenshots `01`, `03`, `04` | Re-run later Q&A-only-course case |
| `QA-003` | PASS | Participant creates a course thread and reply in place | Course Chromium baseline; screenshot `02` | Current-spec rerun |
| `QA-004` | PASS | Thread and reply upvotes toggle without counter drift | Course baseline; backend `23/23`; screenshot `02` | Current-spec rerun |
| `QA-005` | PARTIAL | Evaluated practice and microlearning stacks expose contextual Q&A, while answering does not | Practice Chromium `7/7`; evaluated-state screenshots `08` to `12` | Fresh microlearning answering/evaluation run |
| `QA-006` | PASS | Lecturer overview groups and paginates course and stack threads | Course/practice baseline; screenshots `06`, `07` | Current-spec rerun |
| `QA-007` | PARTIAL | Lecturer generates external-block and course-wide embed links | External-only baseline; old screenshot `14`; current backend proof | Re-run after fragment transport and course-wide mode |
| `QA-008` | PARTIAL | Anonymous embed posting requires a valid token and enabled course policy | Pre-fragment Chromium baseline; current backend proof; old screenshots `15`, `16` | Re-run current fragment-token flow |
| `QA-009` | PARTIAL | Tampered or stale embed scope/token fails closed without persistent side effects | Pre-fragment Chromium baseline; current backend proof | Re-run current browser history/tamper assertions |
| `QA-010` | PARTIAL | Anonymous rate limits reject repeated posting and bound audit writes | Backend scope/course/IP/TTL cases pass | Browser error-state proof |
| `QA-011` | PASS | Non-participants and unevaluated stack participants cannot read/write protected scopes | Rollout Chromium baseline; current backend proof | Current-spec rerun |
| `QA-012` | PENDING | Existing v1 live-feedback create/read/upvote flow remains unchanged | No fresh branch runtime run | Manual smoke |

## Runtime Commands

The focused Course Q&A specs are independently seeded to avoid renderer memory
exhaustion. Run each command from the repository root:

```bash
docker exec -w /workspaces/klicker-uzh default-co-c3448-app-1 \
  pnpm --filter @klicker-uzh/cypress test:run:raw -- \
  --browser chromium --spec cypress/e2e/Y-course-qa-course-workflow.cy.ts

docker exec -w /workspaces/klicker-uzh default-co-c3448-app-1 \
  pnpm --filter @klicker-uzh/cypress test:run:raw -- \
  --browser chromium --spec cypress/e2e/Y-course-qa-practice-workflow.cy.ts

docker exec -w /workspaces/klicker-uzh default-co-c3448-app-1 \
  pnpm --filter @klicker-uzh/cypress test:run:raw -- \
  --browser chromium --spec cypress/e2e/Y-course-qa-embed-workflow.cy.ts

docker exec -w /workspaces/klicker-uzh default-co-c3448-app-1 \
  pnpm --filter @klicker-uzh/cypress test:run:raw -- \
  --browser chromium --spec cypress/e2e/Y-course-qa-rollout-gates-workflow.cy.ts
```

The last completed baseline was course `8/8`, practice `7/7`, embed `6/6`, and
rollout `7/7`. The course spec gained two cases afterward. The embed baseline
predates fragment-token transport and course-wide mode, so it is historical
evidence rather than current-branch proof.

Run the current DB-backed service suite with:

```bash
docker exec -w /workspaces/klicker-uzh default-co-c3448-app-1 \
  sh -lc 'HATCHET_CLIENT_TOKEN="$(cat /hatchet-token/api.token)" \
  APP_SECRET=test-app-secret \
  pnpm --filter @klicker-uzh/graphql exec vitest run test/discussions.test.ts'
```

Current result: `23/23` passing across authorization, gates, rate limits,
concurrency, scope behavior, pagination, and presentation metadata.

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
| `14-manage-embed-generated-redacted.png` | Historical external-only embed generator with token redacted |
| `15-anonymous-embed-empty.png` | Historical chrome-free anonymous embed baseline |
| `16-anonymous-embed-thread-reply.png` | Historical anonymous thread/reply baseline |

## Targeted Pending Runs

Use `agent-browser` against the devrouter URLs. Save evidence under
`project/_local/course-qa-screenshots/`. If participant or delegated login
fails, record the exact redirect/session behavior; do not substitute static
proof.

### QA-010: Anonymous rate-limit error

1. Generate a current external-block embed URL with anonymous posting enabled.
2. Open it in a fresh unauthenticated browser session.
3. Submit one thread and confirm it appears.
4. Submit a second thread in the same scope and browser fingerprint within 90
   seconds.
5. Confirm the UI reports failure and no second thread appears.
6. Capture the error state at `390x844`.

### QA-012: Legacy live-feedback smoke

1. Start a seeded live quiz with the existing feedback channel enabled.
2. As a participant, post one feedback item.
3. As the lecturer, publish it and add a response.
4. As the participant, confirm both are visible and upvote the feedback and
   response once.
5. Confirm both counters increment once.
6. Capture the participant result at `1440x900`.

### Final current-branch rerun

1. Run all four focused Chromium commands above.
2. Run all `23/23` backend scenarios.
3. Capture fresh embed generator and anonymous embed screenshots for
   fragment-token transport and both embed modes.
4. Re-check desktop `1440x900` and mobile `390x844` for any visible behavior
   changed after the existing screenshot set.

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
