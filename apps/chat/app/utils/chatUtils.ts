import { v4 as uuidv4 } from 'uuid';

/**
 * Utility functions for chat functionality
 */

/**
 * Generates a unique ID for chat messages.
 *
 * @returns A unique message ID in format uuid
 */
export function generateId(): string {
  return uuidv4()
}
