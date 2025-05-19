# CLAUDE.md - Transactional Package

This file provides guidance to Claude Code for working specifically with the transactional email templates in the KlickerUZH project.

## Package Overview

The @klicker-uzh/transactional package manages email templates and transactional email functionality for the KlickerUZH platform. It uses React Email to create, style, and export HTML email templates that are sent to users for various system notifications.

### Key Responsibilities

- Defining email templates with React components
- Exporting templates to HTML for storage in the database
- Managing layout, styling, and branding for all system emails
- Providing script functionality to deploy updated templates to the system

## Email Template Structure

The email templates are organized as React components in the `src/emails/` directory:

- `MagicLinkRequested.tsx`: Sent when a user requests a magic login link
- `ParticipantAccountActivation.tsx`: Sent when a new participant account is created
- `RandomizedGroupCreationFailure.tsx`: Notification for course administrators when group randomization fails

## Component Organization

The package follows a modular approach to email template design:

- `src/components/Layout.tsx`: Base layout shared by all email templates
- `src/components/Header.tsx`: Common header with logo and branding
- `src/components/Footer.tsx`: Standard footer with contact information
- `src/components/tailwind.config.ts`: Tailwind CSS configuration for styling

## Development Workflow

### Common Commands

```bash
# Build all email templates (exports to HTML)
pnpm run build

# Start development server for previewing emails
pnpm run dev:email

# Deploy updated templates to the database (development)
pnpm run update-templates

# Deploy updated templates to the staging database
pnpm run update-templates:qa

# Deploy updated templates to the production database
pnpm run update-templates:prod
```

### Creating a New Email Template

1. Create a new React component in `src/emails/` (use existing templates as a reference)
2. Ensure the component is exported both as a named export and default export
3. Use the shared Layout component for consistent branding
4. Define props for variable content that will be replaced at send time
5. Add the new template name to the `AVAILABLE_EMAIL_TEMPLATES` type in `packages/graphql/src/services/email.ts`
6. Build the template with `pnpm run build`
7. Deploy the template to the appropriate environment

### Modifying Existing Templates

1. Edit the template component in `src/emails/`
2. Test the changes with `pnpm run dev:email`
3. Build the updated template with `pnpm run build`
4. Deploy the updated template to the appropriate environment

## Integration with GraphQL

The email templates are loaded into the database and used by the email service in the GraphQL package:

1. Templates are exported as HTML and stored in the `EmailTemplate` table
2. The `hydrateTemplate` function in `packages/graphql/src/services/email.ts` loads templates and replaces variables
3. The `sendEmail` function handles the actual email delivery

When updating templates:

1. Build the templates with `pnpm run build`
2. Use the appropriate update-templates script to deploy to the database
3. Ensure the template name matches in both the file name and database record

## Variable Replacement

Templates use a simple variable replacement system:

1. Define variables in the component props (e.g., `link` in MagicLinkRequested)
2. Use the variables in the template (e.g., `{link}`)
3. When sending emails, variables are provided in the `variables` object
4. Variables in the HTML template use the format `[VARIABLE_NAME]`

## Best Practices

1. **Maintain Consistency**: Use the shared Layout, Header, and Footer components
2. **Mobile Responsiveness**: Ensure all templates work well on mobile devices
3. **Accessibility**: Include text alternatives for all visual elements
4. **Brand Guidelines**: Follow UZH brand guidelines for colors, logos, and tone
5. **Plain Text**: Always include a plain text version for email clients that don't support HTML
6. **Testing**: Test templates across different email clients before deployment
7. **Code Organization**: Keep components small and focused on a single responsibility
8. **Documentation**: Comment template code, especially for complex styling or logic

## Troubleshooting Common Issues

### Template Not Updating

If templates aren't updating after deployment:

1. Check that the build step completed successfully
2. Verify the template name matches in both the file and database
3. Ensure the database update script ran without errors
4. Check for missing template variables or syntax errors

### Styling Issues

If email styling appears broken:

1. Test with multiple email clients (Gmail, Outlook, Apple Mail)
2. Use simpler CSS that's widely supported by email clients
3. Consider using table-based layouts for complex arrangements
4. Check that all styles are properly included in the Tailwind config

## Performance Considerations

1. **Optimized Images**: Use compressed images to reduce email size
2. **Minimal External Resources**: Avoid external stylesheets or scripts
3. **Template Size**: Keep templates under 100KB when possible
4. **Caching**: The system caches templates to reduce database load

## Testing Email Templates

- Preview templates during development with `pnpm run dev:email`
- Send test emails to multiple addresses and check rendering
- Test on different devices (desktop, mobile, tablet)
- Verify all links work correctly
- Check both HTML and plain text versions
