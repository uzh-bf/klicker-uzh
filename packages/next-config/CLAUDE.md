# CLAUDE.md - Next-Config Package

This file provides guidance to Claude Code for working specifically with the Next.js configuration package in the KlickerUZH project.

## Package Overview

The next-config package provides standardized Next.js configuration options that are shared across all frontend applications in the KlickerUZH ecosystem. It centralizes common settings to ensure consistency and reduce duplication.

### Key Responsibilities

- Providing base Next.js configuration for all frontend applications
- Managing image domains and remote patterns for asset optimization
- Configuring transpilation settings for shared packages
- Setting up Progressive Web App (PWA) capabilities
- Standardizing i18n configuration across applications

## Configuration Options

The package exports two main configuration functions:

### 1. getNextBaseConfig

This function returns the standard Next.js configuration used across all applications:

```javascript
getNextBaseConfig({ BLOB_STORAGE_ACCOUNT_URL, NODE_ENV })
```

#### Key Settings

- **transpilePackages**: Ensures shared packages are properly transpiled
- **i18n**: Standardizes localization with English and German support
- **images**: Configures domains and remote patterns for image optimization
- **modularizeImports**: Optimizes imports for libraries like Lodash
- **output**: Configures standalone output for production builds
- **reactStrictMode**: Enforces React best practices

### 2. getNextPWAConfig

This function returns Progressive Web App configuration options:

```javascript
getNextPWAConfig({ NODE_ENV })
```

#### Key Settings

- **dest**: Output directory for service worker files
- **skipWaiting**: Controls immediate activation of service workers
- **dynamicStartUrlRedirect**: Enables dynamic URL redirection
- **disable**: Automatically disables PWA features in development mode

## Usage in Applications

Applications within the KlickerUZH ecosystem use this package to maintain consistent configuration.

### Basic Implementation

```javascript
import { getNextBaseConfig, getNextPWAConfig } from '@klicker-uzh/next-config'

/** @type {import('next').NextConfig} */
let nextConfig = {
  ...getNextBaseConfig({
    BLOB_STORAGE_ACCOUNT_URL: process.env.BLOB_STORAGE_ACCOUNT_URL,
    NODE_ENV: process.env.NODE_ENV,
  }),
  // Application-specific configurations
  async redirects() {
    return [
      // Custom redirects...
    ]
  },
}

// Add PWA capabilities if not in test environment
if (process.env.NODE_ENV !== 'test') {
  const withPWA = withPWAInit(
    getNextPWAConfig({ NODE_ENV: process.env.NODE_ENV })
  )
  nextConfig = withPWA(nextConfig)
}

export default nextConfig
```

### Extending the Base Configuration

When applications need custom configuration, they can:

1. Spread the base config `...getNextBaseConfig({})`
2. Add application-specific settings alongside
3. Override base settings by specifying them after the spread

## Environment Variables

The configuration functions expect these environment variables:

- **BLOB_STORAGE_ACCOUNT_URL**: Azure Blob Storage account URL for image storage
- **NODE_ENV**: Environment mode (development, production, test)

## Common Customizations

### Adding Custom Image Domains

```javascript
let nextConfig = {
  ...getNextBaseConfig({ BLOB_STORAGE_ACCOUNT_URL }),
  images: {
    ...getNextBaseConfig({ BLOB_STORAGE_ACCOUNT_URL }).images,
    domains: [
      ...getNextBaseConfig({ BLOB_STORAGE_ACCOUNT_URL }).images.domains,
      'custom-domain.com',
    ],
  },
}
```

### Adding Custom Redirects

```javascript
let nextConfig = {
  ...getNextBaseConfig({ BLOB_STORAGE_ACCOUNT_URL }),
  async redirects() {
    return [
      {
        source: '/old-path',
        destination: '/new-path',
        permanent: true,
      },
    ]
  },
}
```

### Custom Webpack Configurations

```javascript
let nextConfig = {
  ...getNextBaseConfig({ BLOB_STORAGE_ACCOUNT_URL }),
  webpack(config, options) {
    // Custom webpack configuration
    return config
  },
}
```

## Best Practices

1. **Don't Duplicate**: Use the shared config rather than recreating settings
2. **Environment-Specific Settings**: Pass environment variables to the config functions
3. **Extend, Don't Replace**: Build on top of the base configuration instead of replacing it
4. **App-Specific Overrides**: Place app-specific overrides after spreading the base config
5. **PWA Configuration**: Only apply PWA features for production environments
6. **Updates**: When updating Next.js version, ensure compatibility with all apps

## Common Issues and Solutions

### PWA Not Working in Production

Make sure the PWA configuration is properly applied outside of test environments and that the service worker is properly registered.

```javascript
if (process.env.NODE_ENV !== 'test') {
  const withPWA = withPWAInit(
    getNextPWAConfig({ NODE_ENV: process.env.NODE_ENV })
  )
  nextConfig = withPWA(nextConfig)
}
```

### Transpilation Issues with Shared Packages

Verify that all internal packages are properly listed in the transpilePackages array.

```javascript
transpilePackages: [
  '@klicker-uzh/shared-components',
  '@klicker-uzh/i18n',
  '@klicker-uzh/util',
  // Add any new internal packages here
],
```

### Image Optimization Errors

Ensure that all domains serving images are properly configured in both domains and remotePatterns.

## Integration with Other Packages

### Prisma

When backend models change, update any frontend types that depend on the Prisma schema.

### GraphQL

GraphQL queries and mutations should be properly typed with the latest schema.

### i18n

The next-config sets up basic i18n configuration, but applications should import translation files from the i18n package.

## Development Workflow

1. Make changes to the base configuration
2. Test changes against all applications that use the package
3. Update version according to semantic versioning
4. Update all applications to use the new version

## Future Enhancements

Future enhancements for this package may include:

1. TypeScript support for stronger type checking
2. Configuration options for more Next.js features
3. Theme and styling configuration
4. Build optimization settings
5. SEO configuration defaults
