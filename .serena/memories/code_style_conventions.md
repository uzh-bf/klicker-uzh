# Code Style and Conventions

## TypeScript Conventions

- **Strict Mode**: TypeScript strict mode is enabled
- **Type Safety**: Always use strong typing with interfaces and type definitions
- **File Organization**: Components grouped by feature domain
- **Path Aliases**: Using @ and ~ prefixes for imports (e.g., @components/_, ~/_)

## React/Next.js Conventions

- **Component Pattern**: Functional components with hooks (no class components)
- **Component Files**: One component per file unless very simple
- **Naming**:
  - PascalCase for React component files (e.g., UserCard.tsx)
  - Component functions use `function` keyword, not `const`
- **Hooks**: Extract complex logic into custom hooks with tests
- **Props**: Always define TypeScript interfaces for props
- **File Length**: Keep files under 500 lines, split into modules if larger

## Styling Conventions

- **TailwindCSS**: Use Tailwind utility classes for all styling
- **Dynamic Classes**: Use tailwind-merge (twMerge) for conditional classes
- **Responsive Design**: All components must be responsive
- **Design System**: Follow @uzh-bf/design-system patterns

## Code Formatting

- **Prettier Config**:
  - No semicolons
  - Single quotes
  - Trailing comma ES5
  - Automatic import organization
  - TailwindCSS class sorting
- **Line Length**: Default (80 chars)
- **Indentation**: 2 spaces

## Documentation

- **TypeScript/JavaScript**: JSDoc comments for all functions

```typescript
/**
 * Brief summary.
 *
 * @param param1 - Description.
 * @returns Description.
 */
```

- **Inline Comments**: Avoid inline comments in JSX
- **Complex Logic**: Add `// Reason:` comments for non-obvious code

## GraphQL Conventions

- Import operations from @klicker-uzh/graphql package
- Use Apollo Client for data fetching
- Handle loading, error, and success states consistently
- Type-safe operations with generated types

## File Structure

- `/src/components/`: UI components by feature
- `/src/pages/`: Next.js page components (file-based routing)
- `/src/lib/`: Utilities and hooks
- `__tests__/`: Test files mirroring app structure

## Git Conventions

- Feature branches from v3 branch
- Conventional commits preferred
- Run checks before committing (handled by husky)
