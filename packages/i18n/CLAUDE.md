# CLAUDE.md - i18n Package

This file provides guidance to Claude Code for working specifically with the internationalization (i18n) layer in the KlickerUZH project.

## Package Overview

The i18n package is responsible for the internationalization and localization of all KlickerUZH applications. It provides translation messages, error handling, and fallback mechanisms for multi-language support.

### Key Responsibilities

- Providing translation message dictionaries for supported languages (English, German)
- Error handling for missing translations
- Fallback message generation
- Integration with next-intl for React components

## Message Organization

The messages are organized by language in the `messages/` directory:

- `en.ts`: English translations
- `de.ts`: German translations

Each file exports a default object with a hierarchical structure of translation keys, organized by feature area and component:

```typescript
export default {
  shared: {
    // Common translations used across the application
    table: {
      download: 'Download as CSV',
      // ...
    },
    questions: {
      // Question-related translations
      // ...
    },
  },
  manage: {
    // Translations for the management interface
    courses: {
      // Course-related translations
      // ...
    },
    // ...
  },
  pwa: {
    // Translations for the progressive web app
    // ...
  },
  // ...
}
```

## Usage Patterns

### Integration with Next.js Applications

The i18n package is designed to work with Next.js applications using `next-intl`. To integrate it in a Next.js application:

1. Import the error handling utilities:

```typescript
import { getMessageFallback, onError } from '@klicker-uzh/i18n'
```

2. Set up the NextIntlClientProvider in the application:

```typescript
<NextIntlClientProvider
  timeZone="Europe/Zurich"
  messages={pageProps.messages}
  locale={locale}
  onError={onError}
  getMessageFallback={getMessageFallback}
>
  {/* Application content */}
</NextIntlClientProvider>
```

3. Load messages in page components:

```typescript
export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}
```

### Using Translations in Components

To use translations in a React component:

1. Import the `useTranslations` hook:

```typescript
import { useTranslations } from 'next-intl'
```

2. Initialize the hook in the component:

```typescript
function SomeComponent() {
  const t = useTranslations()

  // Simple translation
  return <p>{t('shared.generic.loading')}</p>
}
```

3. Use translations with variables:

```typescript
function ComponentWithVariables() {
  const t = useTranslations()

  return <p>{t('shared.questions.seSelectNCorrectOptions', { number: 3 })}</p>
}
```

## Error Handling

The package provides two main error handling functions:

1. `onError`: Called when a translation error occurs:

```typescript
export function onError(error: any) {
  console.error(error)

  if (error.code === IntlErrorCode.MISSING_MESSAGE) {
    // Handle missing translations differently
    console.error(error)
  }
}
```

2. `getMessageFallback`: Provides fallback text when a translation is missing:

```typescript
export function getMessageFallback({
  namespace,
  key,
  error,
}: {
  namespace: string
  key: string
  error: any
}) {
  const path = [namespace, key].filter((part) => part != null).join('.')

  if (error.code === IntlErrorCode.MISSING_MESSAGE) {
    return `${path} is not yet translated`
  } else {
    return `Dear developer, please fix this message: ${path}. Error: ${error.message}`
  }
}
```

## Development Workflow

### Adding New Translations

1. Identify the appropriate section in the message files
2. Add the new translation key to both `en.ts` and `de.ts`
3. Follow the existing hierarchy and naming conventions
4. Use clear, contextual keys (e.g., `manage.courses.createButton` instead of just `create`)

### Changing Existing Translations

1. Find the translation key in the message files
2. Update the text in both `en.ts` and `de.ts`
3. Test the change in components that use the translation

### Testing Translations

1. Test each language by switching the application locale
2. Verify that all UI elements display correctly in each language
3. Check that variable substitution works correctly

## Best Practices

1. **Consistent Naming**: Use consistent, descriptive naming for translation keys
2. **Hierarchical Organization**: Keep the hierarchy logical and aligned with application structure
3. **HTML in Translations**: When translations contain HTML (e.g., `<b>` tags), ensure proper escaping and rendering
4. **Variables**: Use descriptive names for variables (e.g., `{count}` instead of `{n}`)
5. **Context**: Provide all necessary contextual information in the translation key or comments
6. **Maintenance**: Keep both language files in sync - every key in `en.ts` should also exist in `de.ts`
7. **Fallbacks**: Ensure the application gracefully handles missing translations

## Common Issues and Solutions

### Missing Translations

If translations appear as "X is not yet translated":

1. Check if the key exists in the message files
2. Verify the correct namespace is being used
3. Ensure the path to the translation is correct

### Variable Substitution Issues

If variables aren't rendering correctly:

1. Verify the variable name in the translation string matches what's passed to the translation function
2. Check for proper typing of variable values

### Integration Problems

If the application fails to load translations:

1. Verify that `getStaticProps` or `getServerSideProps` correctly imports the messages
2. Check that `NextIntlClientProvider` is set up with the correct props
3. Ensure the locale is being properly passed through the application

## Related Resources

1. **next-intl Documentation**: https://next-intl-docs.vercel.app/
2. **KlickerUZH Localization Style Guide**: For consistent terminology and voice across translations
3. **Internationalization Testing Process**: Guidelines for thorough testing of translations

## Performance Considerations

1. **Bundle Size**: Message files can grow large; consider code splitting for optimal loading
2. **Rendering Optimization**: Use memoization when translations are used in frequently re-rendered components

## Future Improvements

Potential enhancements to consider:

1. **Automated Translation Validation**: Tools to verify all keys exist in all language files
2. **Locale Detection**: Automatic detection of user's preferred language
3. **Additional Languages**: Structure to support more languages in the future
4. **Translation Management Tool**: Integration with a translation management system
