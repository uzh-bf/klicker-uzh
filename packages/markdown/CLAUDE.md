# CLAUDE.md - Markdown Package

This file provides guidance to Claude Code for working specifically with the Markdown rendering components in the KlickerUZH project.

## Package Overview

The Markdown package provides React components for rendering markdown content in a consistent way across all KlickerUZH applications. It handles sophisticated markdown features including LaTeX math formulas, syntax highlighting, and interactive image handling.

### Key Responsibilities

- Rendering markdown strings as React components with consistent styling
- Processing markdown content with security considerations (sanitization)
- Handling LaTeX math expressions
- Providing enhanced image display capabilities with modal previews
- Text truncation with intelligent ellipsis handling

## Components

### Markdown

The main component for rendering markdown content:

- Processes markdown text using unified/remark/rehype ecosystem
- Supports LaTeX math expressions via KaTeX
- Sanitizes content to prevent XSS attacks
- Handles external links with proper security attributes
- Offers customizable styling options via TailwindCSS
- Can render content with or without TailwindCSS prose styling

```tsx
<Markdown
  content="This is **markdown** with $\LaTeX$ support"
  withProse={true}
  withModal={true}
  data={{ cy: 'markdown-content' }}
/>
```

### ImgWithModal

Enhances image display within markdown content:

- Displays images with configurable sizing constraints
- Provides an expand button for viewing images in full-screen modal
- Shows optional alt text as captions
- Respects accessibility best practices

```tsx
<ImgWithModal
  src="/path/to/image.png"
  alt="Description of image"
  withModal={true}
/>
```

### Ellipsis

Handles text truncation with intelligent markdown awareness:

- Truncates text by max length or max lines
- Preserves complete LaTeX formulas when possible
- Provides tooltips with full content on hover
- Supports both plain text and markdown content

```tsx
<Ellipsis maxLines={2}>
  Long markdown content that needs to be truncated...
</Ellipsis>
```

## Implementation Details

### Markdown Processing Pipeline

The package uses a sophisticated processing pipeline:

1. **Parsing**: Convert markdown text to structured AST with remark-parse
2. **Extensions**: Process math formulas, GFM, etc.
3. **HTML Conversion**: Transform to HTML with remark-rehype
4. **Security**: Apply sanitization with rehype-sanitize
5. **Features**: Add external link handling, syntax highlighting
6. **React Conversion**: Transform HTML to React components with rehype-react

### Security Considerations

- All content is sanitized using rehype-sanitize
- External links are automatically opened in new tabs with security attributes
- HTML is strictly controlled to prevent XSS vulnerabilities

### Integration with TailwindCSS

- Uses the @tailwindcss/typography plugin for prose styling
- Leverages tailwind-merge for dynamic class composition
- Includes reusable Tailwind utilities for consistent styling

## Usage Patterns

### Basic Markdown Rendering

```tsx
<Markdown content={markdownString} />
```

### Math Expressions

The package supports LaTeX math expressions:

```tsx
<Markdown content="Inline math: $E=mc^2$ and display math: $$\int_a^b f(x) dx$$" />
```

### Image Handling

Images within markdown are automatically enhanced with modal functionality:

```tsx
<Markdown content="![Alt text](/path/to/image.jpg)" withModal={true} />
```

### Text Truncation

For long content that needs truncation:

```tsx
<Ellipsis maxLength={100} withMarkdown={true}>
  Long markdown content that will be truncated...
</Ellipsis>
```

## Development Guidelines

### Adding New Markdown Features

To add support for new markdown syntax:

1. Add the appropriate remark/rehype plugin in Markdown.tsx
2. Update the rehype-sanitize configuration to allow new elements/attributes
3. Test with various content combinations
4. Update integration tests

### Working with LaTeX

- The package uses KaTeX for rendering math expressions
- Inline math should use single $ delimiters
- Display math should use double $$ delimiters
- Ensure proper escaping of special characters

### Performance Optimization

- The component memoizes parsed content to avoid unnecessary re-rendering
- Large content should use the Ellipsis component to improve initial load time
- Consider performance implications when adding new plugins

## Integration with KlickerUZH

The markdown package is used throughout KlickerUZH:

- Element content and questions
- Activity descriptions
- Course materials
- Evaluation explanations
- Feedback and comments
- Documentation sections

## Troubleshooting Common Issues

### Math Rendering Problems

If LaTeX expressions aren't rendering correctly:

- Check for proper delimiter usage ($, $$)
- Verify that special characters are escaped
- Ensure KaTeX can parse the expression

### Image Display Issues

For problems with images:

- Verify image paths are correct
- Check that image formats are supported
- Ensure image loading states are handled properly

### Styling Conflicts

When markdown styling conflicts with application styles:

- Use the className prop to override specific styles
- Consider using withProse={false} to disable prose styling
- Use tailwind-merge for proper class composition

## Best Practices

1. Use the withProse prop for content that benefits from typography styling
2. Implement loading states for content with images or complex formatting
3. Always consider security implications when rendering user-provided content
4. Use appropriate component variants for different content types
5. Apply consistent styling across related content
6. Consider accessibility in all markdown rendering scenarios
