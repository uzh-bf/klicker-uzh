# Code Style and Conventions

## TypeScript Conventions

### Language Configuration

**Strict typing principles:**
- TypeScript strict mode enabled project-wide
- Strong typing enforced through interfaces and types
- Explicit type annotations for public APIs
- Minimal use of `any` type with clear justification

**Import organization:**
- Path aliases for cleaner imports (@ and ~ prefixes)
- Consistent import ordering across files
- Grouped imports by source (external, internal, relative)
- Automatic import organization via tooling

### File Organization

**Project structure:**
- Components grouped by feature domain
- Clear separation of concerns
- Logical directory hierarchy
- Consistent file naming patterns

## React and Next.js Conventions

### Component Patterns

**Component style:**
- Functional components with hooks exclusively
- No class components in new code
- Component functions use function keyword (not const)
- Props interfaces defined with TypeScript

**Component organization:**
- One component per file (unless tightly coupled utilities)
- Component name matches file name
- PascalCase for component files (e.g., UserCard.tsx)
- Clear component responsibility

**File length guidelines:**
- Keep files under 500 lines when possible
- Split large files into logical modules
- Extract complex logic into separate files
- Balance cohesion with file size

### Hook Patterns

**Custom hooks:**
- Extract complex logic into reusable hooks
- Test hooks independently from components
- Consistent return interface patterns
- Clear hook naming conventions

**Props management:**
- TypeScript interfaces for all props
- Clear prop naming conventions
- Minimal required props
- Logical default values

## Styling Conventions

### Design System Usage

**Styling approach:**
- TailwindCSS utility classes for all styling
- UZH Design System components preferred (@ uzh-bf/design-system)
- Dynamic class composition with tailwind-merge (twMerge) utility
- No inline styles in components

**Responsive design:**
- Mobile-first approach to styling
- All components must be responsive
- Test across viewport sizes
- Use Tailwind responsive utilities

## Code Formatting

### Automated Formatting

**Prettier configuration:**
- No semicolons in code
- Single quotes for strings
- Trailing commas (ES5 style)
- Default line length enforcement (80 chars)

**Import management:**
- Automatic import organization
- TailwindCSS class automatic sorting
- Consistent import grouping
- Unused import removal

**Indentation:**
- 2 space indentation throughout
- Consistent across all file types
- No mixing tabs and spaces

## Documentation Standards

### Code Documentation

**JSDoc requirements:**
- All public functions documented
- Brief summary of function purpose
- Parameter descriptions with clear explanations
- Return value documentation
- Examples for complex functions when helpful

**Inline comments:**
- Avoid inline comments in JSX
- Use comments for non-obvious logic (prefix with "// Reason:" for clarity)
- Explain "why" not "what"
- Keep comments concise and relevant

## GraphQL Conventions

### Integration Patterns

**Operation usage:**
- Import operations from @klicker-uzh/graphql package
- Use Apollo Client hooks for data fetching
- Handle loading, error, and success states consistently
- Type-safe operations with generated types

**State management:**
- Apollo Client cache for server state
- React hooks for local component state
- Minimal use of React Context
- Avoid complex state management libraries

## Directory Conventions

### Standard Structure

**Frontend applications:**
- `/src/components/`: UI components organized by feature
- `/src/pages/`: Next.js pages (file-based routing)
- `/src/lib/`: Utilities, hooks, and helper functions
- `/__tests__/`: Tests mirroring application structure

**Shared packages:**
- `/src/`: Package source code
- `/dist/`: Compiled output (git-ignored)
- `/__tests__/`: Package test files
- Clear separation of public and internal APIs

## Git Conventions

### Branch Strategy

**Branch naming:**
- Feature branches from main development branch (v3)
- Descriptive branch names
- Consistent naming conventions
- Short-lived feature branches

### Commit Message Format

**Conventional commits preferred:**
- Type prefix for commit categorization
- Clear, concise descriptions
- Reference issues when relevant
- Breaking changes clearly marked

**Pre-commit validation:**
- Automated checks via git hooks (husky)
- Formatting validation before commit
- No manual bypass of checks
- Consistent quality gate enforcement

## Quality Standards

### Code Quality Principles

**Mandatory practices:**
- TypeScript strict typing throughout
- Follow existing codebase patterns
- Functional components in React
- Design system for all styling
- Loading and error state handling

**Prohibited practices:**
- Bypassing TypeScript safety
- Hardcoding user-facing strings
- Monolithic component design
- Missing error boundaries
- Skipping automated checks

## Testing Conventions

### Test Organization

**Test file structure:**
- Tests mirror source file organization
- Clear test descriptions
- Arrange-Act-Assert pattern
- Isolated test cases

**Test naming:**
- Descriptive test names
- Behavior-focused descriptions
- Clear success criteria
- Edge case identification

## Performance Considerations

### React Optimization

**Optimization patterns:**
- React.memo for expensive components
- useMemo for expensive calculations
- useCallback for stable function references
- Proper dependency arrays in hooks

**Performance monitoring:**
- Monitor bundle sizes
- Track render performance
- Optimize critical paths
- Profile before optimizing

## Accessibility Standards

### WCAG Compliance

**Accessibility requirements:**
- Semantic HTML elements
- ARIA attributes where needed
- Keyboard navigation support
- Screen reader compatibility

**Testing requirements:**
- Manual accessibility testing
- Automated accessibility checks
- Color contrast validation
- Focus management verification

## Consistency Enforcement

### Automated Tooling

**Quality automation:**
- Pre-commit hooks enforce standards
- CI/CD validates all changes
- Automated formatting application
- Linting as quality gate

### Code Review Focus

**Review priorities:**
- Adherence to conventions
- Pattern consistency
- Test coverage adequacy
- Documentation completeness

These conventions ensure code quality, maintainability, and consistency across the KlickerUZH platform as it evolves.
