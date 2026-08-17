---
type: Change Log
title: CI Efficiency & Cypress Removal
description: Removal of the legacy Cypress suite and consolidation of CI check workflows into a single cached runner job.
timestamp: '2026-08-04'
tags:
  - ci
  - testing
  - refactor
---

# CI Efficiency & Cypress Removal

## Summary

- **Cypress Removal**: Removed the frozen legacy Cypress test suite, workspace (`cypress/`), `.github/workflows/cypress-testing.yml`, `@cypress/code-coverage` dependency, cypress-related skills (`klicker-cypress-e2e`, `cypress-author`), and configuration references.
- **Fixture Relocation**: Moved shared JSON fixture files from `cypress/cypress/fixtures/` to `playwright/fixtures/` and updated Playwright test imports and dynamic fixture URL references to maintain full test suite coverage.
- **Consolidated CI Check Job**: Created `.github/workflows/check.yml` running a single `check` job with pnpm dependency caching (`cache: 'pnpm'`) that combines `format:check`, `check:syncpack`, Biome lint (advisory), ESLint/Turbo lint, `check:prisma-sync`, `check:agents-md`, turbo package build + typecheck, and Knip (advisory) sequentially in one setup step.
- **CI Dependency Caching**: Added pnpm store caching (`pnpm/action-setup@v4` followed by `actions/setup-node@v4` with `cache: 'pnpm'`) to `check-syncpack.yml` and the consolidated `check.yml`.
- **Cypress-named leftovers renamed**: `util/_create_hatchet_token_cypress.sh` → `util/_create_hatchet_token_test.sh` and `apps/backend-docker/.env.cypress` → `.env.test`, with the two callers updated (`_run_app_dependencies.sh`, `test-playwright.yml` — including its `changed-paths` pattern). The script itself stays: `test-playwright` depends on it, despite the old name.
- **`-status` gates no longer fail on a cancelled dependency**: `test-graphql-status` and `test-playwright-status` now exit 0 when the filter or test job was `cancelled`. Two runs of the same workflow start whenever a push produces two `pull_request` events seconds apart (an atomic multi-branch push, or a quick re-push); `cancel-in-progress` kills the older one, and its gate used to conclude `failure`. Branch protection reads the latest check-run per name, so merges were never blocked — but the PR kept a red check that only a manual re-run cleared.
- **Documentation & Skills**: Updated `docs/testing.md`, `docs/ci-and-deployment.md`, `docs/getting-started.md`, `docs/data-and-migrations.md`, `docs/developing-a-feature.md`, `docs/frontend-conventions.md`, `docs/async-and-workers.md`, `docs/chat-platform.md`, `AGENTS.md`, and skills (`klicker-testing-verification`, `klicker-playwright-e2e`, `klicker-data-model`, `klicker-feature-design`) to reflect Playwright as the sole E2E suite and the consolidated check workflow.
