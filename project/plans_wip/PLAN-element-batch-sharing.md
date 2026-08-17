# Element batch sharing

## Goal

Add optional sharing to element batch operations so one lecturer or user group
can receive one common permission across selected Elements. Existing element
updates remain independent, and skipped shares show exact localized reasons.

Detailed implementation plan:
`docs/superpowers/plans/2026-08-17-element-batch-sharing.md`

Approved design:
`docs/superpowers/specs/2026-08-17-element-batch-sharing-design.md`

## Non-goals

- Activity, course, collection, or catalog batch sharing.
- Batch permission revocation or ownership transfer.
- Sharing propagation controls.
- Cross-mutation atomicity with existing element updates.
- Prisma, Hatchet, gamification, or seed-data changes.

## Design answers

- **Domain:** source `Element`, not `ElementInstance`.
- **Layers:** GraphQL schema/service/op/codegen, Manage UI, i18n, Vitest,
  Playwright, user docs, and engineering wiki.
- **Authorization:** `asUserFullAccess` plus derived ADMIN/OWNER per Element.
- **Gamification:** none.
- **Async:** none.
- **UI:** `frontend-manage` element batch modal under `privatePreview`; German
  and English strings and stable `data-cy` hooks.
- **Evidence:** database-backed sharing tests, targeted X-review Playwright,
  type/lint/build checks, opengrep, and real browser screenshots.
- **Seeds/fixtures:** existing synthetic seeded users and Elements only.

## Work packages and proposed stack

1. `feat/element-batch-sharing`: service/GraphQL contract, integration tests,
   codegen, and API wiki.
2. `feat/element-batch-sharing-ui`: Manage UI, i18n, Playwright, tutorial,
   screenshots, and final verification.

The current workspace is
`/Users/paldov/.codex/worktrees/f8ad/klicker-uzh`. Native stack execution awaits
user approval and availability of the repository's `$stacked-change` and
`$gh-stack` skills. If a normal single PR is explicitly approved, preserve the
same two work-package commit boundaries on `feat/element-batch-sharing`.

## Progress

- 2026-08-17: Repository exploration completed for existing batch operations
  and direct sharing.
- 2026-08-17: User approved element-only scope, combined Apply behavior,
  existing-permission upserts, and explicit skip reasons.
- 2026-08-17: Design committed as `fb21de99c`.
- 2026-08-17: Detailed implementation plan written; implementation not started.
