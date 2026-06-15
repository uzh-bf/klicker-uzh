# Playwright PoC

## Local run

1. Start test stack (same as Cypress flow): `pnpm run dev:test`
2. Run Playwright tests: `pnpm --filter @klicker-uzh/playwright test:run`

## Useful commands

- UI mode: `pnpm --filter @klicker-uzh/playwright test:ui`
- Headed Chromium only: `pnpm --filter @klicker-uzh/playwright test:headed`
- Show report: `pnpm --filter @klicker-uzh/playwright show-report`
