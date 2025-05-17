# Element Modification Tracking Specification

## Overview

This document outlines the technical approach for implementing automatic tracking of element modifications (specifically title and status changes) in the KlickerUZH activity log.

## Goals

- Track title and status changes on elements
- Create activity log entries automatically when changes occur
- Display modifications in a user-friendly format in the activity log UI
- Distinguish modification entries from message entries visually

## Current Architecture

- ActivityLogEntry model in the database with `type` field supporting:
  - `MESSAGE`: User-generated comments
  - `MODIFICATION`: System-generated records of changes

- Element updates are processed in the `updateElement` function in `questions.ts` service
- ActivityLog component currently displays entries but doesn't differentiate by type

## Technical Approach

### 1. Modification Data Structure

We'll store modification details in the dedicated `modificationDetails` JSON field of the ActivityLogEntry using a consistent format:

```typescript
interface PrismaActivityModificationDetails {
  field: 'title' | 'status' | string; // Field that was changed
  oldValue: string;                  // Previous value
  newValue: string;                  // New value 
  displayText?: string;              // Optional pre-formatted text
}
```

This format allows for:
- Easy parsing and display in the UI
- Future extension to other field types
- Type-safe access to modification details
- Separation of user messages from system-tracked modifications

### 2. Backend Implementation

#### Update the `updateElement` Function

In `packages/graphql/src/services/questions.ts`:

```typescript
export async function updateElement(
  { id, ...updates }: UpdateElementInput,
  ctx: Context
) {
  // Get the current version of the element for comparison
  const existingElement = await ctx.prisma.element.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      status: true,
      // Add other fields to compare if needed
    },
  })

  if (!existingElement) {
    throw new Error(`Element with ID ${id} not found`)
  }

  // Proceed with the update
  const updatedElement = await ctx.prisma.element.update({
    where: { id },
    data: updates,
    include: {
      tags: true,
    },
  })

  // Track modifications
  const modifications: ElementModification[] = []

  // Check for title changes
  if (updates.name && updates.name !== existingElement.name) {
    modifications.push({
      field: 'title',
      oldValue: existingElement.name,
      newValue: updates.name,
      displayText: `Title changed from "${existingElement.name}" to "${updates.name}"`,
    })
  }

  // Check for status changes
  if (updates.status && updates.status !== existingElement.status) {
    modifications.push({
      field: 'status',
      oldValue: existingElement.status,
      newValue: updates.status,
      displayText: `Status changed from "${existingElement.status}" to "${updates.status}"`,
    })
  }

  // If we have modifications, create activity log entries
  if (modifications.length > 0) {
    // For each modification, create an activity log entry
    for (const modification of modifications) {
      await ctx.prisma.activityLogEntry.create({
        data: {
          type: DB.ActivityLogType.MODIFICATION,
          message: modification.displayText || `${modification.field} changed`, // Short message
          modificationDetails: modification, // Store structured data in dedicated field
          objectType: DB.ObjectType.ELEMENT,
          elementId: id,
          userId: ctx.user?.sub, // Record who made the change
        },
      })
    }
  }

  return updatedElement
}
```

### 3. Frontend Implementation

#### Update ActivityLog Component

Enhance the ActivityLog component to render modification entries differently:

```tsx
// In ActivityLog.tsx

// Helper function to format modification details for display
const formatModification = (entry: ActivityLogEntry) => {
  if (entry.type !== ActivityLogType.Modification) return null
  
  // Access the structured modification details directly
  if (entry.modificationDetails) {
    const details = entry.modificationDetails as {
      field: string
      oldValue: string
      newValue: string
      displayText?: string
    }
    
    // Use displayText if available, or generate a formatted string
    return details.displayText || 
      `${details.field} changed from "${details.oldValue}" to "${details.newValue}"`
  } 
  
  // Fallback to using the message field if modificationDetails isn't available
  return entry.message || 'Modified element (details unavailable)'
}

// In the render function
{entry.type === ActivityLogType.Message ? (
  // Regular message rendering
  <div className="break-words">{entry.message}</div>
) : (
  // Modification rendering
  <div className="rounded bg-blue-50 px-2 py-1 text-sm text-blue-800">
    <span className="font-medium">Modified:</span> {formatModification(entry)}
  </div>
)}
```

#### Add Modification Icons

Add appropriate icons to distinguish modification types:

```tsx
const getEntryIcon = (entry: ActivityLogEntry) => {
  if (entry.type === ActivityLogType.Message) {
    return faComment // Message icon
  }
  
  // For modifications, determine specific icon based on field
  if (entry.modificationDetails) {
    const details = entry.modificationDetails as { field: string }
    
    switch (details.field) {
      case 'title':
        return faFont // Title change icon
      case 'status':
        return faExchangeAlt // Status change icon
      default:
        return faPencilAlt // Generic edit icon
    }
  }
  
  // Fallback to generic edit icon if no modificationDetails
  return faPencilAlt
}
```

### 4. Testing Strategy

1. **Unit Tests**:
   - Test comparison logic for different fields
   - Test JSON formatting and parsing
   - Verify activity log entry creation with correct data

2. **Integration Tests**:
   - Verify the full flow from element update to activity log display
   - Test edge cases like empty values or special characters
   - Ensure multiple simultaneous changes are handled correctly

3. **UI Testing**:
   - Test rendering of different modification types
   - Verify proper styling and icons
   - Check mobile responsiveness of the design

## Next Steps After Implementation

1. **Extend to More Fields**:
   - Content changes
   - Option changes for multiple-choice questions
   - Tag changes

2. **Extend to Other Object Types**:
   - Track course modifications
   - Track activity modifications (live quizzes, practice quizzes, etc.)

3. **UX Enhancements**:
   - Add filtering by modification type
   - Group related modifications (e.g., all changes from a single update)
   - Add diff view for text content changes