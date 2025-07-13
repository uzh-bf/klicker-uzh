# Office Add-in V2

This is the new version of the KlickerUZH PowerPoint add-in that allows users to embed live quiz evaluations directly into PowerPoint slides. This replaces the previous `office-addin/` folder.

## Overview

The PowerPoint add-in provides an embedded content pane that allows lecturers to:
- Enter a KlickerUZH evaluation URL (from live quizzes)
- Embed the evaluation content directly into PowerPoint slides
- Display real-time quiz results, specific questions, or leaderboards
- Resize the add-in to cover full slides or specific areas

## Architecture

### Core Components

- **Content Pane**: Single HTML page (`content.html`) with embedded JavaScript (`content.js`)
- **Manifest**: Office add-in configuration (`manifest.xml`)
- **Assets**: Icons and images for the add-in interface
- **Webpack Configuration**: Build system for development and production

### Technology Stack

- **Office JavaScript API**: For PowerPoint integration and document settings
- **Vanilla JavaScript**: No external frameworks, pure DOM manipulation
- **TailwindCSS**: Utility-first CSS framework via CDN
- **Webpack**: Module bundler and development server
- **Babel**: JavaScript transpilation for older Office clients

## Key Features

### URL Validation and Storage
- Validates KlickerUZH evaluation URLs with specific regex pattern
- Stores embedded URLs in Office document settings (persistent across sessions)
- Handles migration from legacy slide-specific storage to document-wide storage

### Responsive UI
- Initial view with instructions and URL input
- Fullscreen iframe mode for embedded content
- "Change URL" button to return to initial view
- Toast notifications for user feedback

### Office Integration
- PowerPoint host detection and validation
- Document settings API for persistent storage
- Slide ID detection for legacy migration
- Proper iframe sandboxing for security

## File Structure

```
apps/office-addin-v2/
├── README.md                    # Development and usage instructions
├── package.json                 # Dependencies and scripts
├── manifest.xml                 # Office add-in configuration
├── webpack.config.js            # Build configuration
├── babel.config.json            # JavaScript transpilation config
├── assets/                      # Icons and images
│   ├── icon-*.png              # Various sizes for Office
│   ├── logo-*.png              # KlickerUZH logos
│   └── embed-modal.png         # Instructions screenshot
└── src/
    └── content/
        ├── content.html        # Main UI markup
        └── content.js          # Core application logic
```

## Development

### Prerequisites

- Node.js (latest LTS)
- Office 365 subscription or Microsoft 365 Developer Program access
- Office Add-ins Development Kit extension for VS Code

### Scripts

```bash
# Development server with hot reload
npm run dev-server

# Build for development
npm run build:dev

# Build for production
npm run build

# Start debugging in PowerPoint
npm run start

# Stop debugging
npm run stop

# Validate manifest
npm run validate

# Linting and formatting
npm run lint
npm run lint:fix
npm run prettier
```

### Key Configuration

- **Development URL**: `https://localhost:3000/`
- **Production URL**: `https://www.klicker.uzh.ch/` (configurable in webpack.config.js)
- **Host Application**: PowerPoint only
- **Permissions**: ReadWriteDocument (for settings storage)

## Core Logic

### URL Validation

The add-in validates URLs using a strict regex pattern:
```javascript
/^https:\/\/manage\.klicker\.uzh\.ch\/quizzes\/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\/evaluation\?hmac=.+$/
```

This ensures only valid KlickerUZH evaluation URLs are accepted.

### Settings Storage

- **Current**: Uses document-wide storage with key `embeddedUrl`
- **Legacy Migration**: Automatically migrates from slide-specific keys (`selectedURL{slideID}`)
- **Persistence**: URLs survive PowerPoint restarts and document sharing

### UI States

1. **Initial View**: Instructions panel, URL input, and embed button
2. **Fullscreen Mode**: Hidden UI elements, fullscreen iframe, floating "Change URL" button
3. **Error States**: Toast notifications for validation and storage errors

## Security Considerations

- **Iframe Sandboxing**: Restricted permissions for embedded content
- **URL Validation**: Strict pattern matching prevents arbitrary URL embedding
- **HTTPS Only**: All communication over secure connections
- **Domain Restrictions**: Limited to KlickerUZH domains only

## Common Development Tasks

### Adding New UI Elements

1. Update `content.html` with new markup
2. Add event listeners in `content.js`
3. Update CSS classes (TailwindCSS utilities)
4. Test in PowerPoint development environment

### Modifying URL Validation

1. Update the regex pattern in `isValidUrl()` function
2. Test with various URL formats
3. Update validation error messages
4. Consider backwards compatibility

### Changing Storage Logic

1. Modify `saveUrlToSettings()` and related functions
2. Update the `SETTINGS_KEY` constant if needed
3. Implement migration logic for existing documents
4. Test persistence across sessions

### Debugging

- Use browser developer tools when running in PowerPoint Online
- Check console logs for Office API errors
- Validate manifest using Office Add-ins Development Kit
- Test in both PowerPoint Desktop and Online versions

## Integration with KlickerUZH

The add-in integrates with the main KlickerUZH platform by:

1. **Evaluation URLs**: Embeds content from `manage.klicker.uzh.ch/quizzes/{id}/evaluation`
2. **HMAC Authentication**: Supports authenticated evaluation views
3. **Responsive Design**: Adapts to different iframe sizes within PowerPoint
4. **Real-time Updates**: Embedded content updates automatically during live quizzes

## Known Limitations

- PowerPoint host application required (not compatible with Word/Excel)
- HTTPS development certificates needed for local testing
- Internet connectivity required for embedded content
- Limited to KlickerUZH evaluation URLs only

## Migration from V1

This version replaces the previous `office-addin/` implementation with:

- **Simplified Architecture**: Single content pane instead of multiple views
- **Improved Storage**: Document-wide settings instead of slide-specific
- **Modern Tooling**: Webpack-based build system
- **Enhanced UI**: Better responsive design and user feedback
- **Security Improvements**: Stricter URL validation and iframe sandboxing

## Troubleshooting

### Common Issues

1. **Add-in not loading**: Check HTTPS certificates and manifest validation
2. **URL not persisting**: Verify Office document settings permissions
3. **Embedded content not displaying**: Check network connectivity and URL validity
4. **Legacy migration fails**: Manual URL re-entry may be required

### Debug Steps

1. Validate manifest file using Office Add-ins Development Kit
2. Check browser console for JavaScript errors
3. Verify PowerPoint version compatibility
4. Test with known working evaluation URLs
5. Clear Office cache if experiencing persistent issues