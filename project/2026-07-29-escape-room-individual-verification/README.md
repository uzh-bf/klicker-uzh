# Individual Escape Room verification

Evidence for Layer 2 of `2026-07-29-pr-5143-escape-room-stacked-delivery-plan.md`.

## Environment

- Worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/escape-room-stack`
- Branch: `codex/escape-room-individual`
- Routed workspace: `codex-escape-room-qr`
- Manage: `https://manage.klicker.codex-escape-room-qr.localhost`
- PWA: `https://pwa.klicker.codex-escape-room-qr.localhost`

## Automated verification

- Focused GraphQL Escape Room suite: 60/60 passed.
- QR utility tests: 3/3 passed.
- PWA response-state test: 1/1 passed.
- Focused Playwright Individual Escape Room suite: 16/16 passed, including the lecturer roster before any participant starts.
- Repository-wide `check:all`: passed.
- Production build: all 22 workspaces passed.
- Empty PostgreSQL migration replay: all 179 migrations applied.
- Prisma schema diff after replay: no difference detected.
- Concurrent QR index: unique and valid.
- Fresh replay contains `retentionProcessedAt` and no legacy
  `statsAggregatedAt` column.
- Analytics Prisma schema sync: passed.
- Both managed Hatchet development workers remained authenticated and alive beyond the four-second heartbeat interval after the local token was rotated.

## Browser evidence

- `manage-practice-settings-en-desktop.png`: duplicated Practice Quiz with the Escape Room toggle enabled and persisted timer, hint-penalty, and introduction settings.
- `pwa-practice-intro-en-mobile.png`: participant introduction before the server-owned timer starts.
- `pwa-practice-hint-en-mobile.png`: active stage with the hint action and timer visible.
- `pwa-qr-manual-fallback-de-mobile.png`: camera-denial/manual-code fallback for a QR Scan stage.
- `manage-progress-en-desktop.png`: roster-based lecturer progress dashboard before the first participant attempt.

The browser pass used delegated local test accounts only. All displayed participant names are synthetic repository fixtures.

## Extraction boundary

Layer 2 preserves the generalized `EscapeRoomConfig` and
`EscapeRoomAttempt` database relations needed by later layers, but exposes
runtime contracts only for Practice Quizzes and Microlearnings.

The following source implementation remains intentionally deferred:

- Group Activity authoring, shared-group attempts, atomic multi-answer
  submission, monitoring, GraphQL operations/tests, participant UI, and
  `playwright/tests/escape-room/group.ts` belong to Layer 3.
- Live Quiz block settings, template round-trip, participant and cockpit UI,
  response API/worker validation and deduplication, GraphQL operations/tests,
  and `playwright/tests/escape-room/live-quiz.ts` belong to Layer 4.
- The source branch's combined plan and screenshots are replaced by the
  per-layer plan and current-head evidence directories in this stack.

Generated Prisma and GraphQL artifacts were regenerated on current `v3`
instead of copied from source commit `4be19aa61`. The effective Layer 2 diff
contains no Group Activity or Live Quiz Escape Room API entry point, authoring
control, participant runtime, or mode-specific test.

The final review correction serializes hint requests through the same
attempt-lifecycle claim as responses and resets, removes deferred Live Quiz
settings from the public GraphQL inputs, and renames the retention marker to
describe its actual role. Regression tests cover both the lifecycle collision
and the Layer 2 schema boundary.
