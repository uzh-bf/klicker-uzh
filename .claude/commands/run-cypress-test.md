The user wants you to reset the database and to run a specific Cypress test spec.

Within `packages/prisma`, run the following to reset the database:
pnpm run prisma:reset

Within `cypress`, run the following command to run the specific test file:
pnpm run test:run:one $ARGUMENTS

For example, you would use the following to run the test file called X-test-function.cy.ts:
pnpm run test:run:one cypress/e2e/X-test-function.cy.ts
