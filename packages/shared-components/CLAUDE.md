# CLAUDE.md - Shared Components Package

This file provides guidance to Claude Code for working specifically with the shared components in the KlickerUZH project.

## Package Overview

The shared-components package contains reusable React components used across different frontend applications within the KlickerUZH platform. These components ensure consistency in UI/UX, reduce code duplication, and streamline development across applications.

### Key Responsibilities

- Providing reusable UI components for questions, evaluation, and content display
- Implementing shared hooks for common functionality
- Delivering consistent styling through Tailwind CSS
- Handling cross-application concerns like PWA installation and push notifications
- Rendering and processing different question types consistently

## Component Organization

The shared components are organized into functional categories:

### Question Components

- `ChoicesQuestion.tsx`: Renders single choice and multiple choice questions
- `FreeTextQuestion.tsx`: Handles free text input questions
- `NumericalQuestion.tsx`: Processes and displays numerical questions
- `SelectionQuestion.tsx`: Manages selection-based questions
- `CaseStudyQuestion.tsx`: Renders complex case study questions

### Evaluation Components

- `evaluation/`: Contains components for evaluating responses
  - `SCEvaluation.tsx`: Evaluates single choice responses
  - `MCKPRIMEvaluation.tsx`: Evaluates multiple choice and KPRIM responses
  - `FTEvaluation.tsx`: Processes free text responses
  - `NREvaluation.tsx`: Evaluates numerical responses
  - `CSEvaluation.tsx`: Handles case study response evaluation
  - `SEEvaluation.tsx`: Evaluates selection question responses

### Chart Components

- `charts/`: Visualization components for question responses
  - `ElementBarChart.tsx`: Bar chart visualization
  - `ElementHistogram.tsx`: Histogram visualization
  - `ElementTableChart.tsx`: Table visualization
  - `ElementWordcloud.tsx`: Word cloud visualization

### Utility Components

- `Loader.tsx`: Loading spinner
- `Footer.tsx`: Common footer component
- `LanguageChanger.tsx`: Language selection component
- `DataTable.tsx`: Reusable data table
- `Leaderboard.tsx`: Displays gamification leaderboard
- `Podium.tsx`: Shows top performers in a podium format

### Student-Specific Components

- `Participant.tsx`: Participant-related UI elements
- `StudentElement.tsx`: Specialized element rendering for student view

## Hooks and Utilities

The package provides custom hooks for common functionality:

- `hooks/usePWAInstall.ts`: Progressive Web App installation handling
- `hooks/usePushNotifications.ts`: Push notification management
- `hooks/useStudentResponse.ts`: Student response processing
- `hooks/useStickyState.ts`: Persistent state management
- `hooks/useEvaluation*.ts`: Various hooks for processing evaluation data

Utility functions are located in the `utils/` directory:

- `utils/validateResponse.ts`: Response validation logic
- `utils/slateMdConversion.ts`: Slate-to-Markdown conversion utilities
- `utils/push.ts`: Push notification helpers
- `utils/completeSelectionResponse.ts`: Selection response processing

## CSS and Styling

The package includes Tailwind CSS configurations and styles:

- `components.css`: Base component styles
- `utilities.css`: Utility classes
- `tailwind.config.mjs`: Tailwind configuration

Components use [TailwindCSS](https://tailwindcss.com/) with [tailwind-merge](https://github.com/dcastil/tailwind-merge) for class composition:

```tsx
import { twMerge } from 'tailwind-merge'

function Button({ className, ...props }) {
  return (
    <button
      className={twMerge('rounded bg-blue-500 px-4 py-2 text-white', className)}
      {...props}
    />
  )
}
```

## Development Workflow

### Building and Running

```bash
# Install dependencies (from project root)
pnpm install

# Start development with live CSS reloading
pnpm run dev

# Build the package
pnpm run build

# Type-check the package
pnpm run check
```

### Adding a New Component

1. Create the component in the appropriate directory
2. Export it in the relevant index file
3. Apply consistent styling with Tailwind CSS
4. Document props with TypeScript interfaces
5. Add tests if applicable

### Component Guidelines

When creating or modifying components:

1. **Consistency**: Follow existing patterns in other components
2. **Accessibility**: Ensure ARIA attributes and keyboard navigation
3. **Responsive design**: Components should work on all device sizes
4. **Props interface**: Clearly define and document component props
5. **Composition**: Allow style overrides via className prop

Example component structure:

```tsx
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface ButtonProps {
  /** Button label content */
  children: React.ReactNode
  /** Additional class names to apply */
  className?: string
  /** Button click handler */
  onClick?: () => void
  /** Whether the button is disabled */
  disabled?: boolean
}

function Button({
  children,
  className,
  onClick,
  disabled = false,
}: ButtonProps): React.ReactElement {
  return (
    <button
      className={twMerge(
        'rounded px-4 py-2 font-medium',
        'bg-blue-500 text-white hover:bg-blue-600',
        'disabled:cursor-not-allowed disabled:bg-gray-300',
        className
      )}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export default Button
```

## Question Type Components

The package includes specialized components for different question types in the KlickerUZH platform:

### Single Choice (SC) and Multiple Choice (MC)

- `ChoicesQuestion.tsx`: The main container component
- `questions/SCAnswerOptions.tsx`: Single choice answer options
- `questions/MCAnswerOptions.tsx`: Multiple choice answer options

### KPRIM

- Uses `questions/KPAnswerOptions.tsx` for KPRIM-specific options

### Numerical (NUM)

- `NumericalQuestion.tsx`: Main component
- `questions/NUMERICALAnswerOptions.tsx`: Numerical response input

### Free Text (FT)

- `FreeTextQuestion.tsx`: Main component
- `questions/FREETextAnswerOptions.tsx`: Text input options

### Selection (SE)

- `SelectionQuestion.tsx`: Main component
- `questions/SELECTIONAnswerOptions.tsx`: Selection input options

### Case Study (CS)

- `CaseStudyQuestion.tsx`: Main component
- `questions/CSCase.tsx`: Case study display
- `questions/CSSlider.tsx`: Interactive case study slider

When working with question types:

1. Understand the underlying data structure (defined in Prisma schema)
2. Follow the response validation patterns in `utils/validateResponse.ts`
3. Consider how responses are evaluated in the corresponding evaluation components

## Integration with Other Packages

This package integrates with other KlickerUZH packages:

- **@klicker-uzh/graphql**: For data structures and operations
- **@klicker-uzh/markdown**: For rendering markdown content
- **@klicker-uzh/types**: For shared TypeScript types

When making changes:

1. Ensure compatibility with existing GraphQL operations
2. Use types from @klicker-uzh/types for consistency
3. Consider impacts on all frontend applications using these components

## Testing Components

Components should be tested for:

1. **Rendering**: Basic rendering functionality
2. **Interaction**: User interaction behavior
3. **Validation**: Input validation logic
4. **Responsiveness**: Appearance at different screen sizes

## Best Practices

1. **Props typing**: Use TypeScript interfaces for component props
2. **Composition**: Allow style composition with className prop
3. **Accessibility**: Implement ARIA attributes and keyboard support
4. **Responsiveness**: Test on different screen sizes
5. **Performance**: Optimize re-renders with React.memo, useMemo, and useCallback
6. **State management**: Keep state localized when possible
7. **Internationalization**: Use next-intl for text content
8. **Error handling**: Implement graceful fallbacks

## Common Patterns

### Form Components Integration with Formik

Many components work with Formik for form handling:

```tsx
<Formik initialValues={{ answer: '' }} onSubmit={handleSubmit}>
  {({ values, handleChange }) => (
    <Form>
      <FreeTextQuestion
        value={values.answer}
        onChange={handleChange('answer')}
      />
      <Button type="submit">Submit</Button>
    </Form>
  )}
</Formik>
```

### Response Validation

Components use validation patterns from utils/validateResponse.ts:

```tsx
import { validateResponse } from '../utils/validateResponse'

// In component
const isValid = validateResponse(response, questionType)
```

### Internationalization

Components support internationalization with next-intl:

```tsx
import { useTranslations } from 'next-intl'

function Component() {
  const t = useTranslations('shared')
  return <button>{t('submit')}</button>
}
```

## Troubleshooting Common Issues

### Styling Issues

If component styling doesn't apply correctly:

1. Check if Tailwind classes are included in the build
2. Verify the component's CSS is imported
3. Check for conflicts with application-specific styles

### Type Errors

For TypeScript errors:

1. Ensure proper imports from @klicker-uzh/types
2. Check if props interfaces are correctly defined and used
3. Run `pnpm run check` to verify all types

### Rendering Problems

If components don't render as expected:

1. Check console for React errors
2. Verify that required props are provided
3. Check for CSS conflicts
4. Test the component in isolation

## Performance Considerations

1. **Memoization**: Use React.memo for pure components
2. **Hooks optimization**: Use useMemo and useCallback for expensive computations
3. **Lazy loading**: Consider code-splitting for larger components
4. **Bundle size**: Monitor component size and dependencies
5. **Render optimization**: Minimize unnecessary re-renders

## CSS Customization

Components can be customized with Tailwind classes:

```tsx
// Basic usage
<Button>Submit</Button>

// Customized
<Button className="bg-green-500 hover:bg-green-600">
  Save Changes
</Button>
```

The package follows the KlickerUZH design system and uses the UZH design colors and typography.
