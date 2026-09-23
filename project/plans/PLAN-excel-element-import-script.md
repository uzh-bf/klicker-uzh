# Standalone Excel element import script

## Goal

Provide a draft, independently reviewable operator script in `packages/graphql`
for the fixed `klicker-elements-6` workbook, targeting current `v3` without the
import/export PR stack. Import populated Multiple choice and Flashcards tabs,
up to 500 rows; reject populated unsupported tabs rather than discard them.

## Contract

- Elements are new private source Elements, explicitly REVIEW, with owner
  permissions. No ElementInstances, activity publication, responses, XP, or
  leaderboard changes. No API, frontend, i18n, Prisma schema, or codegen changes.
- Preserve front, back, explanations, individual feedback (including `-`), and
  literal image placeholders. No downloading/uploading media or interpreting
  placeholder position. Reuse/create owner-scoped tags from semicolon CSV cells.
- Exact didactic matches ignore title and tags; skip them within the workbook
  and the target owner's existing non-deleted library. Report source row/title.
- Operator authority comes from explicit database credentials and target owner
  UUID, not an HTTP session. Validate owner USER/ADMIN. No writes by default;
  `DRY_RUN=false` and an unchanged saved preview are both required.
- Local private before/after state hashes and comparison CSV bind the workbook,
  target owner, and database. Writes are one serializable transaction, serialized
  per owner, with no automatic retry. Revalidate state before write, verify
  persisted values and owner permissions before commit; refuse completed reruns.
- Never commit real source PDFs, workbooks, credentials, or local run artifacts.

## Scope and verification

Parser, run planning, transaction adapter, CLI, synthetic tests, and operator
documentation are one cohesive script slice. No changes to the existing stack.
Exercise the exact private workbook only through offline validation. Use
synthetic fixtures for persistence tests and fresh disposable database only.
Run targeted tests, script typecheck, formatting, and available repository gates;
record any full-monorepo or runtime gaps in the draft PR. Independent native
review before publication. No external executor: repository opt-in is absent.

## Progress

- 2026-09-23: inspected v3 and existing stack; created branch
  `feat/excel-element-import-script` in `trees/excel-element-import-script` from
  `origin/v3` at `6f5756f94`. Existing worktrees remain unchanged.
- Parser delegated to a bounded native worker; main agent owns database safety,
  integration, verification, and draft publication.
- Implemented offline parser, duplicate planner, transactional database adapter,
  safe-default CLI, documentation, and synthetic tests. Native independent review
  identified schema-target, UUID, and CSV-whitespace issues; all were corrected.
- Verification: exact private workbook validates 470 rows (159 MC / 311 flashcards);
  12 targeted parser/planner/database tests pass on fresh marked PostgreSQL 15.
  Prisma build, GraphQL package typecheck, script typecheck, scoped Biome,
  dependency syncpack, and frozen-lockfile installation pass.
- Remaining draft evidence gaps: concurrent-writer and post-commit receipt failure
  scenarios are not exercised. Root check:all fails on container Git recognition;
  the GraphQL dependency build emits dist but does not exit and was stopped.
  No production or user-library imports executed. No real data included in Git.
