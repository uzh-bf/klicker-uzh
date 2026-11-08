# Group Activity Escape Room verification

Evidence for Layer 3 of
`2026-07-29-pr-5143-escape-room-stacked-delivery-plan.md`.

## Environment

- Worktree:
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/escape-room-stack`
- Branch: `codex/escape-room-group`
- Routed workspace: `codex-escape-room-qr`
- Manage:
  `https://manage.klicker.codex-escape-room-qr.localhost`
- PWA: `https://pwa.klicker.codex-escape-room-qr.localhost`

## Automated verification

- Focused GraphQL Escape Room suite: 85/85 passed across lifecycle,
  completion, hint/reset, retention/progress, QR contracts/placement, and
  Group Activity atomic submission.
- A regression participant belonging to two groups in one course starts the
  attempt for the explicitly routed group; a missing routed group is rejected.
- GraphQL, PWA, and Playwright package typechecks passed.
- Generated GraphQL operations and public artifacts are current.
- Ordered Chromium Escape Room workflow: 18/18 passed, including two group
  members sharing start, lockout, completion, monitoring, and reset.
- Repository-wide `check:all`: passed.
- Production build: all 22 workspaces passed.
- `git diff --check`: passed.

## Browser evidence

- `group-dashboard-en-desktop.png`: lecturer progress includes the active
  group and every not-started course group.
- `group-participant-de-mobile.png`: a second group member sees the shared
  German lockout state while read-only content remains visible beside the
  answerable question.
- The ordered prerequisite workflow also refreshed
  `qr-print-en-desktop.png` and `qr-manual-fallback-de-mobile.png`.

The browser pass used delegated local test accounts only. All displayed
participant and group names are synthetic repository fixtures.

## Review corrections

- Group start and hint calls now include the routed `groupId`; the server
  verifies the activity course and authenticated membership instead of
  selecting an arbitrary same-course membership.
- Group Activity authoring uses typed create/update payloads and idempotent
  `deleteMany` cleanup instead of mutable `any` data and swallowed database
  errors.
- Redis lifecycle-claim release is one shared helper across individual and
  group submissions.
- The browser workflow targets the answerable element after its read-only
  content sibling and expects a reset roster row to return to `NOT_STARTED`
  rather than disappear.

Independent correctness/security review found no remaining Layer 3 blocker or
Layer 4 leakage. Independent simplification review findings were incorporated.

## Extraction boundary

Layer 3 exposes Group Activity Escape Room authoring, shared attempts, atomic
grading, participant runtime, monitoring, and reset. No Live Quiz block
settings, participant/cockpit runtime, response API/worker behavior, or
Live-specific GraphQL inputs are exposed by this layer.

The engineering-wiki validator still reports the pre-existing missing `type`
frontmatter field in
`docs/solutions/best-practice/repeat-production-seeds-use-prior-state.md`.
That unrelated baseline issue was not changed in this feature layer.
