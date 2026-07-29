# Live Quiz Escape Room verification

Evidence for Layer 4 of
`2026-07-29-pr-5143-escape-room-stacked-delivery-plan.md`.

## Environment

- Worktree:
  `/Users/rschlae/Git/klicker/klicker-uzh/trees/escape-room-stack`
- Branch: `codex/escape-room-live`
- Source implementation: `codex/escape-room-production` at `4be19aa61`
- Routed workspace: `codex-escape-room-qr`
- Manage:
  `https://manage.klicker.codex-escape-room-qr.localhost`
- PWA: `https://pwa.klicker.codex-escape-room-qr.localhost`
- Response endpoint:
  `https://response-api.klicker.codex-escape-room-qr.localhost/AddResponse`

## Automated verification

- GraphQL Escape Room and QR tests: 102/102 passed serially across the nine
  non-template suites; the isolated Live Quiz template suite passed 1/1 on a
  clean DevPod database.
- Response API Escape Room enforcement: 23/23 passed.
- Response processor deduplication: 8/8 passed.
- Live Quiz response/closure coordination: 4/4 passed.
- PWA Live Quiz response serialization/parsing: 1/1 passed.
- GraphQL, Response API, response processor, Manage, PWA, and Playwright
  package typechecks passed.
- Generated GraphQL operations and public artifacts are current.
- Ordered Chromium Escape Room workflow: 20/20 passed, preserving all
  Individual and Group scenarios and adding the two Live Quiz journeys.
- Production Docusaurus build passed. It retained only pre-existing broken-link
  and CSS compatibility warnings outside the Escape Room tutorials.
- Repository formatting and `git diff --check` passed for the layer.

## Browser evidence

- `live-participant-en-mobile.png`: the explicitly started Live Quiz block
  exposes only the current question and the server-owned timer/progress.
- `live-cockpit-de-desktop.png`: the German lecturer cockpit reports the
  participant as completed at 1/1 and exposes the permission-scoped reset.

The browser pass used delegated local test accounts only. All displayed names
are synthetic repository fixtures.

## Review corrections already incorporated

- The Live layer preserves Layer 3's explicit routed `groupId` and group-roster
  behavior while extending the shared Escape Room services with
  `elementBlockId`.
- Live Quiz template creation validates new, retained, and duplicated element
  types before any write. Ordinary Live Quiz templates continue to reject QR
  Scan, while Escape Room blocks accept only their supported element set.
- The pre-existing QR placement tests remain active instead of being removed
  as they were on the source branch.
- The devcontainer response URL now includes the required `/AddResponse` path
  for primary, linked, and direct-local execution. Before this correction,
  Live Quiz browser submissions posted to the health endpoint and returned
  404.
- Escape Room responses now apply the same exact-origin credentialed CORS
  policy as every other Response API path.
- A Redis close gate rejects late submissions and drains both in-flight grading
  and accepted worker events before block results are snapshotted. Failed
  closure reopens the gate rather than silently dropping an accepted answer.
- Live Quiz participant timers animate from the server's
  `remainingSeconds`/`expiresInSeconds` snapshot with a monotonic clock, and
  refetch the authoritative status once at expiry.
- Live cockpit progress expands the Live Quiz course roster so enrolled
  participants without attempts appear as `NOT_STARTED`.

## Engineering wiki conformance

The source branch's missing OKF metadata correction for
`repeat-production-seeds-use-prior-state.md` is retained in this layer. The
validator reports the bundle as OKF v0.1 core conformant with 20 pre-existing
hygiene warnings.
