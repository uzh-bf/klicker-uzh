# CLAUDE.md - Documentation Application

This file provides guidance to Claude Code for working specifically with the documentation application in the KlickerUZH project.

## Application Overview

The documentation application is the public-facing knowledge base and user guide for KlickerUZH. Built with Docusaurus, it provides comprehensive documentation for students, lecturers, and administrators. The documentation site serves as the primary resource for learning how to use the platform's features.

### Key Responsibilities

- User-facing documentation and tutorials
- Getting started guides for new users
- Feature documentation and use cases
- Terms of service and legal documents
- Student and lecturer learning resources
- Project information and roadmap details

## Architecture

This is a Docusaurus application built with React, MDX, and Tailwind CSS.

### Directory Structure

- `/docs/`: Content organized by topic
  - `/about/`: Project information and roadmap
  - `/gamification/`: Gamification features documentation
  - `/getting_started/`: Onboarding and core concepts
  - `/student_tutorials/`: Student-specific guides
  - `/tutorials/`: Lecturer-focused guides and feature documentation
  - Legal documents (privacy policy, terms of service)
- `/src/`: Application source code

  - `/components/`: Custom React components for documentation
  - `/css/`: CSS customization including Tailwind configuration
  - `/pages/`: Special pages outside the documentation tree

- `/static/`: Static assets

  - `/img/`: Images and graphics
  - `/woff/`: Custom font files
  - `/office-addin/`: PowerPoint add-in files

- Configuration files
  - `docusaurus.config.ts`: Main configuration
  - `sidebars.js`: Sidebar navigation structure
  - `tailwind.config.mjs`: Tailwind CSS configuration

## Key Technologies

- **Framework**: Docusaurus 3.x
- **Content**: MDX (Markdown with JSX)
- **Styling**: TailwindCSS with custom configuration
- **Search**: Algolia DocSearch
- **Analytics**: Matomo
- **Math Rendering**: KaTeX
- **Plugins**: Docusaurus plugins for images, redirects, and other features

## Development Workflow

### Common Commands

```bash
# Install dependencies
pnpm install

# Start development server
pnpm start

# Build for production
pnpm build

# Deploy the docs site
pnpm deploy

# Serve the built site locally
pnpm serve
```

### Development Best Practices

1. **Documentation Structure**

   - Group related content in appropriate directories
   - Use consistent heading levels (h1 for page title, h2 for sections)
   - Include step-by-step instructions with screenshots for tutorials
   - Maintain separation between student and lecturer documentation

2. **Content Creation**

   - Use MDX for content with embedded React components when needed
   - Follow consistent formatting and style conventions
   - Include relevant images and diagrams to support textual explanations
   - Link related documentation pages for easy navigation

3. **Component Development**
   - Create reusable components for consistent documentation elements
   - Place components in the appropriate subdirectory
   - Use TypeScript for component props
   - Style with Tailwind classes

## Key Features and Implementation

### Documentation Organization

The content is organized into several key sections:

- **Getting Started**: Core concepts and onboarding for new users
- **Tutorials**: Task-based guides for specific features
- **Student Tutorials**: Guides specifically for student users
- **Gamification**: Documentation on points, achievements, and awards
- **About**: Project information, roadmap, and updates

### Custom Components

Special components enhance the documentation experience:

- `AnnouncementBanner`: Site-wide announcements
- `BarChart`: Data visualization for statistics
- `CaseSummary`: Formatted case study presentation
- `ChartGrid`: Organized display of multiple charts
- `ImageModal`: Zoomable image viewing
- `UserForm`: Interactive form examples

### Search Integration

The site uses Algolia DocSearch for comprehensive content search:

- Configured in `docusaurus.config.ts`
- Indexes all documentation pages
- Provides contextual search results
- Auto-generates search index during build

### Versioning

Documentation versioning follows the application's major versions:

- Current documentation refers to v3 of KlickerUZH
- Version switcher available for accessing different documentation versions
- Each version maintains its own sidebar structure

## Testing

When implementing or modifying documentation:

1. Check content rendering in development mode
2. Verify that internal links work correctly
3. Test responsive layout on different device sizes
4. Ensure custom components display correctly
5. Validate that code examples are formatted properly
6. Check that images and other media display correctly

## Common Tasks

### Adding a New Documentation Page

1. Create a new `.mdx` file in the appropriate directory
2. Add frontmatter with title, sidebar position, and other metadata
3. Write content using Markdown with optional JSX components
4. Add the page to the sidebar configuration if needed
5. Include appropriate internal links from related pages

### Creating a Custom Component

1. Add a new component file in `/src/components/`
2. Define TypeScript interface for props
3. Implement the component with appropriate styling
4. Import and use in MDX files as needed

### Updating Sidebar Navigation

1. Edit the `sidebars.js` file to update navigation structure
2. Organize items logically by topic and user role
3. Use appropriate labels that clearly indicate content
4. Maintain consistent depth of nesting

## Troubleshooting Common Issues

### Build Errors

If you encounter build errors:

1. Check for broken links in markdown content
2. Verify that all referenced components are correctly imported
3. Ensure MDX syntax is valid
4. Check for missing dependencies in package.json

### Content Rendering Issues

For content that doesn't render as expected:

1. Verify MDX syntax is correct
2. Check for conflicting Tailwind classes
3. Ensure images have correct paths
4. Test components in isolation to identify issues

## Performance Considerations

1. **Image Optimization**

   - Use the IdealImage plugin for responsive images
   - Optimize image size and format
   - Use appropriate image dimensions for the context

2. **Page Load Performance**

   - Minimize custom JavaScript in documentation pages
   - Use code splitting for large components
   - Leverage Docusaurus's built-in performance optimizations

3. **Build Performance**
   - Use the experimental_faster option for development when appropriate
   - Minimize unnecessary dependencies
   - Use efficient components for complex visualizations

## Best Practices

1. **Content Quality**

   - Keep documentation up-to-date with the latest features
   - Use clear, concise language
   - Provide examples for complex concepts
   - Include troubleshooting sections for common issues

2. **Accessibility**

   - Ensure sufficient color contrast
   - Provide alt text for all images
   - Use semantic HTML structure
   - Test with keyboard navigation

3. **SEO**

   - Use descriptive page titles
   - Include appropriate metadata
   - Structure content with proper heading hierarchy
   - Use the description field in frontmatter

4. **Internationalization**
   - Support for language-specific content (English/German)
   - Use language-neutral examples when possible
   - Maintain consistent terminology across languages

## Integration with Other Packages

The documentation references and explains functionality from all other packages:

- Frontend applications (manage, pwa, control)
- GraphQL API and operations
- Database schema and models
- Authentication and permission system
- Activity types and execution

When documenting features, ensure alignment with the actual implementation in the codebase.
