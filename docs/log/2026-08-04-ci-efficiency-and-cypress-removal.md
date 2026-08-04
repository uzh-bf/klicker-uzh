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
- **Documentation & Skills**: Updated `docs/testing.md`, `docs/ci-and-deployment.md`, `docs/getting-started.md`, `docs/data-and-migrations.md`, `docs/developing-a-feature.md`, `docs/frontend-conventions.md`, `docs/async-and-workers.md`, `docs/chat-platform.md`, `AGENTS.md`, and skills (`klicker-testing-verification`, `klicker-playwright-e2e`, `klicker-data-model`, `klicker-feature-design`) to reflect Playwright as the sole E2E suite and the consolidated check workflow.
