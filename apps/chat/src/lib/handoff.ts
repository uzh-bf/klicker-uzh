import {
  type HandoffSource,
  parseHandoffSource,
} from '@klicker-uzh/shared-components/src/utils/handoff'

/**
 * askUZH handoff links open a course chatbot with the student's question
 * already in the composer. The link's origin is kept for the tab's lifetime so
 * the chat requests of that visit can report where the student came from.
 */
export const HANDOFF_SOURCE_STORAGE_KEY = 'klicker.handoffSource'

export function rememberHandoffSource(source: HandoffSource | undefined): void {
  if (!source) {
    return
  }

  try {
    window.sessionStorage.setItem(HANDOFF_SOURCE_STORAGE_KEY, source)
  } catch {
    // Storage is unavailable in some privacy modes; attribution is optional
    // and must never break the handoff itself.
  }
}

export function readHandoffSource(): HandoffSource | undefined {
  if (typeof window === 'undefined') {
    return undefined
  }

  try {
    return parseHandoffSource(
      window.sessionStorage.getItem(HANDOFF_SOURCE_STORAGE_KEY)
    )
  } catch {
    return undefined
  }
}
