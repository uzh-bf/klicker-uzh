/**
 * Utility functions for chat functionality
 */

/**
 * Generates a unique ID for chat messages.
 *
 * The ID format combines:
 * - current timestamp for uniqueness across time
 * - random string for uniqueness within the same millisecond
 *
 * @returns A unique message ID in format "msg-{timestamp}-{randomString}"
 */
export function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
