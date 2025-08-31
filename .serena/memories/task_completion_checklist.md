# Task Completion Checklist

When completing any development task in KlickerUZH, follow these steps:

## 1. Code Quality Checks

```bash
# Format check (MUST PASS)
pnpm format:check

# If formatting needed
pnpm format

# Lint check (MUST PASS)
pnpm lint

# Type checking (for TypeScript packages)
pnpm run check
```

## 2. Testing

```bash
# Run relevant tests
pnpm test:run

# For new features, ensure tests are added:
# - Unit tests in __tests__ folders
# - E2E tests in cypress/ if UI changes
```

## 3. Database Changes

If Prisma schema was modified:

```bash
# Create migration
pnpm run prisma:migrate

# Sync schema across packages
./util/sync-schema.sh

# Deploy to database
pnpm run prisma:deploy
```

## 4. Documentation Updates

- Update CLAUDE.md files if architecture changes
- Update package-specific CLAUDE.md files
- Update README.md for new features
- Add JSDoc comments for new functions

## 5. Pre-Commit Validation

The following will run automatically via git hooks:

- Prettier formatting check
- Staged files validation

## 6. Manual Verification

- Test in different viewport sizes (responsive)
- Verify GraphQL operations work correctly
- Check error handling and edge cases
- Ensure i18n messages are used for user-facing text

## 7. Final Build Check

```bash
# Ensure everything builds
pnpm build

# For critical changes, run full test suite
pnpm build:test
pnpm test:run
```

## Important Reminders

- NEVER commit without running checks
- NEVER add inline comments in JSX
- ALWAYS use TypeScript strict typing
- ALWAYS follow existing patterns in codebase
- ALWAYS use functional components in React
- ALWAYS keep files under 500 lines
- ALWAYS use Tailwind for styling
- ALWAYS handle loading and error states in UI
