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

- GraphQL Escape Room tests: 88/88 passed serially across the seven
  non-template suites; the isolated Live Quiz template suite passed 1/1.
- Response API Escape Room enforcement: 20/20 passed.
- Response processor deduplication: 7/7 passed.
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

## Known unrelated validation debt

The engineering-wiki OKF validator still reports the pre-existing missing
`type` frontmatter field in
`docs/solutions/best-practice/repeat-production-seeds-use-prior-state.md`.
The Live Quiz wiki edits add no new core conformance error.
