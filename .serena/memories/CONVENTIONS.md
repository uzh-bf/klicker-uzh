# Code Conventions

## TypeScript

**Required:**
- Strict mode enabled project-wide
- No `any` type without clear justification in comment
- Interfaces for all component props
- Path aliases: `@` and `~` prefixes for imports
- Explicit types for public APIs

**Import order:**
1. External packages
2. Internal packages (@klicker-uzh/*)
3. Relative imports
(Automatic via Prettier plugin)

## React & Next.js

**Component rules:**
- Functional components only (zero class components)
- Use `function` keyword, not `const` for components
- PascalCase files: `UserCard.tsx`, `QuizEditor.tsx`
- One component per file (exceptions: tightly coupled helpers)
- Keep files under 500 lines (split if larger)

**Hook rules:**
- Place all hooks at component top (before any logic)
- Extract complex logic into custom hooks
- Custom hooks start with `use` prefix
- Test custom hooks independently

**Props:**
- TypeScript interface for all props
- Interface name: `{ComponentName}Props`
- Minimal required props (prefer optional with defaults)

## Styling

**Required:**
- Tailwind CSS exclusively (zero inline styles)
- UZH Design System components (`@uzh-bf/design-system`)
- `tailwind-merge` (twMerge) for dynamic classes
- Mobile-first responsive design (test all viewports)

**Prohibited:**
- CSS-in-JS libraries
- Inline style attribute
- Custom CSS files (except global styles)

## GraphQL

**Operation naming:**
- Queries: `Q` + Action + Object → `QGetUserCourses`
- Mutations: `M` + Action + Object → `MCreateCourse`
- Subscriptions: `S` + Event → `SFeedbackAdded`
- Fragments: `F` + DataType → `FElementData`

**Integration:**
- Import from `@klicker-uzh/graphql` package
- Use Apollo Client hooks (`useQuery`, `useMutation`, `useSubscription`)
- Handle 3 states: loading, error, success
- Type-safe with generated types

## Testing

**Required tests:**
- E2E (Cypress): All user-facing features
- Unit (Vitest): Business logic, calculations, utilities
- Integration: GraphQL resolvers, service interactions

**Test structure:**
- Arrange-Act-Assert pattern
- Descriptive test names (`should calculate correct score for KPRIM question`)
- Mirror source structure in `__tests__/` directory
- Seeded data with predictable IDs

**Test data:**
- Default accounts: `lecturer@test.com`, `participant1@test.com`
- Password: `abcd1234`
- 50+ participant accounts with stable UUIDs

## Git

**Branches:**
- Branch from: `v3` (main development branch)
- Naming: `feature/description` or `fix/issue-123`
- Short-lived (merge within days, not weeks)

**Commits:**
- Conventional commits required
- Format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`
- Example: `feat(graphql): add course sharing permissions`

**Pre-commit (automatic via husky):**
- Prettier format check
- ESLint validation
- No manual bypass

## Formatting

**Prettier config:**
- No semicolons
- Single quotes
- Trailing commas (ES5)
- 80 character line length
- 2 space indentation
- Auto-sort Tailwind classes

**Enforced by:**
- Pre-commit hook (automatic)
- CI/CD pipeline (blocks merge)

## Documentation

**Required JSDoc:**
```typescript
/**
 * Brief summary of what function does.
 *
 * @param userId - The user's unique identifier
 * @param options - Configuration options
 * @returns The processed result
 */
```

**Rules:**
- All exported functions require JSDoc
- Parameters with descriptions
- Return value documented
- Avoid inline comments in JSX

## File Structure

**Frontend apps:**
```
src/
  components/    → UI components by feature
  pages/         → Next.js pages (file-based routing)
  lib/           → Utilities and custom hooks
  __tests__/     → Tests mirroring structure
```

**Shared packages:**
```
src/       → Source code
dist/      → Compiled output (git-ignored)
__tests__/ → Package tests
```

## Quality Gates

**Before committing:**
```bash
pnpm format:check  # Must pass
pnpm lint          # Must pass
pnpm check         # TypeScript validation
pnpm test:run      # All tests must pass
```

**Pre-commit automatically runs:**
- Prettier (fixes formatting)
- Lint-staged (validates staged files)

## State Management

**Required patterns:**
- Server state: Apollo Client cache
- Local component state: React hooks (`useState`, `useReducer`)
- Cross-component: React Context (sparingly)

**Prohibited:**
- Redux, MobX, Zustand for new code
- Global mutable state
- Complex state management libraries

## Performance

**Optimization:**
- `React.memo` for expensive re-render prevention
- `useMemo` for expensive calculations
- `useCallback` for stable function references
- Proper dependency arrays

**When NOT to optimize:**
- Don't optimize prematurely
- Profile first, then optimize
- Readability > premature optimization

## Accessibility

**Required:**
- Semantic HTML (`<button>`, `<nav>`, not `<div onClick>`)
- ARIA attributes where needed
- Keyboard navigation support
- Screen reader compatibility
- Color contrast validation (WCAG AA minimum)

## Prohibited Patterns

**Never:**
- Class components
- Inline styles
- Hardcoded user-facing strings (use i18n)
- Monolithic components (>500 lines)
- Missing error boundaries
- Skip quality checks
- Bypass TypeScript with `as any`
- Commit without tests for new features

## Enforcement

**Automated:**
- Pre-commit hooks (Husky)
- CI/CD pipeline checks
- ESLint rules
- TypeScript compiler

**Manual:**
- Code review
- Pull request approval required
- Quality gate enforcement
