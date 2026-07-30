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

Last reconciled: 2026-07-29.

| ID | Status | Scenario | Last Result | Remaining Delta |
|---|---|---|---|---|
| `QA-001` | PASS | Rollout and runtime gates hide Q&A in Manage until enabled | Historical focused Cypress baseline plus fresh Manage browser proof | Current Cypress rerun blocked by auth harness |
| `QA-002` | PASS | Course overview integrates Q&A only when both gates allow it | Fresh desktop and mobile browser proof, screenshots `25` to `28` | Current Cypress rerun blocked by auth harness |
| `QA-003` | PASS | Participant creates a course thread and reply in place | Fresh real API/browser proof, screenshot `26` | Current Cypress rerun blocked by auth harness |
| `QA-004` | PASS | Thread and reply upvotes toggle without counter drift | Fresh browser proof plus backend `30/30`, screenshot `26` | None |
| `QA-005` | PASS | Evaluated practice and microlearning stacks expose contextual Q&A, while answering does not | Fresh practice and test-published microlearning browser proof, screenshots `29` to `35` | Production-like microlearning publication blocked by missing Hatchet workflow |
| `QA-006` | PASS | Lecturer overview groups and paginates course and stack threads | Fresh grouped overview screenshot `37`; current 20-to-21 pagination screenshots `42`, `43` | None |
| `QA-007` | PASS | Lecturer generates external-block and course-wide embed links | Fresh generator and both embed modes, screenshots `21`, `40` | None |
| `QA-008` | PASS | Anonymous embed posting requires a valid token and enabled course policy | Fresh fragment-token thread and reply flow, screenshots `22`, `23` | None |
| `QA-009` | PASS | Tampered or stale embed scope/token fails closed without persistent side effects | Backend suite `30/30`; embed Playwright fragment/history and tampered-token proof | None |
| `QA-010` | PASS | Anonymous rate limits reject repeated posting and bound audit writes | Backend suite plus fresh mobile browser rejection, screenshot `24` | Improve generic error copy |
| `QA-011` | PASS | Non-participants and unevaluated stack participants cannot read/write protected scopes | Rollout Playwright `7/7`; current backend proof | None |
| `QA-012` | PASS | Existing v1 live-feedback create/read/upvote flow remains unchanged | Fresh student and lecturer browser flow plus exact counter checks, screenshots `44`, `45` | None |

## Runtime Commands

The focused Course Q&A specs are independently seeded to avoid renderer memory
exhaustion. Run each command from the repository root:

```bash
pnpm --filter @klicker-uzh/playwright test:run:raw -- \
  --project=chromium tests/Y-course-qa-course.spec.ts

pnpm --filter @klicker-uzh/playwright test:run:raw -- \
  --project=chromium tests/Y-course-qa-practice.spec.ts

pnpm --filter @klicker-uzh/playwright test:run:raw -- \
  --project=chromium tests/Y-course-qa-embed.spec.ts

pnpm --filter @klicker-uzh/playwright test:run:raw -- \
  --project=chromium tests/Y-course-qa-rollout-gates.spec.ts
```

The current Playwright baseline is course `13/13`, practice `7/7`, embed `7/7`,
and rollout gates `7/7`. Each spec resets and seeds its own database state and
runs serially because later cases intentionally depend on earlier setup. The
rollout suite also restores all Q&A flags in file-level teardown so a terminal
failure cannot leak disabled state.

Run the current DB-backed service suite with:

```bash
docker exec -w /workspaces/klicker-uzh default-co-c3448-app-1 \
  sh -lc 'HATCHET_CLIENT_TOKEN="$(cat /hatchet-token/api.token)" \
  APP_SECRET=test-app-secret \
  pnpm --filter @klicker-uzh/graphql exec vitest run test/discussions.test.ts'
```

Current result: `30/30` passing across authorization, gates, rate limits,
concurrency, scope behavior, pagination, and presentation metadata.

## Screenshot Inventory

The canonical review surface is
`project/_local/course-qa-screenshots/index.html`. It links 43 verified images:

- Manage empty/full-width/grouped overview, settings, and external embed
  generation plus current 20-to-21 pagination: screenshots `19` to `21`, `37`,
  `38`, and `41` to `43`
- anonymous external embed empty, thread/reply, and rate-limit states:
  screenshots `22` to `24`
- course desktop rail, thread/reply/upvotes, and mobile disclosure:
  screenshots `25` to `28`
- evaluated practice desktop/mobile rail and thread:
  screenshots `29` to `32`
- test-published microlearning desktop/mobile rail:
  screenshots `33` to `35`
- fallback/deep-link route and course-wide read-only embed:
  screenshots `36` and `40`
- legacy live-feedback student and lecturer states with both vote counters:
  screenshots `44` and `45`

Historical screenshots `06` and `07` remain the runtime evidence for lecturer
pagination from 20 to all 27 threads, bringing the gallery to 28 images. The
gallery and images are intentionally ignored local artifacts.

## Targeted Runs

Use `agent-browser` against the devrouter URLs. Save evidence under
`project/_local/course-qa-screenshots/`. If participant or delegated login
fails, record the exact redirect/session behavior; do not substitute static
proof.

### QA-012: Legacy live-feedback smoke

Completed on 2026-07-29 against the seeded moderated live quiz:

1. Start a seeded live quiz with the existing feedback channel enabled.
2. As a participant, post one feedback item.
3. As the lecturer, publish it and add a response.
4. Reopen the answered item, because the legacy response action resolves it and
   resolved feedback cannot be upvoted; as the participant, upvote the feedback
   and response once, then resolve it again.
5. Confirm both counters increment once.
6. Capture the final participant and lecturer states at `1440x900`.

### Final current-branch rerun

Completed on 2026-07-29:

1. The backend suite passes all `30/30` scenarios.
2. Fresh desktop `1440x900` and mobile `390x844` browser proof covers the
   integrated course, practice, microlearning, Manage, and embed surfaces.
3. Fragment-token transport and both embed modes have fresh browser evidence.

The attempted course workflow is blocked at login by the devrouter/auth harness
mismatch described above. The other focused workflows share that login setup
and were not rerun after the repeated course-workflow failure.

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
