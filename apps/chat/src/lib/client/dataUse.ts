import {
  TUTOR_PERSONALIZATION_DISCLOSURE_VERSION,
  TUTOR_PERSONALIZATION_NOTES_DISCLOSURE_VERSION,
} from '@klicker-uzh/util/participant-account-data-use'
import type { ChatDataUseState } from '../dataUse'
import { authedFetch } from './authedFetch'

/** Fired after any data-use choice is saved, so open surfaces can re-read. */
export const DATA_USE_CHANGED_EVENT = 'klicker-chat-data-use-changed'

/** The route every chat surface reads and writes the data-use choices through. */
export function dataUseEndpoint(chatbotId: string) {
  return `/api/chatbots/${chatbotId}/data-use`
}

/**
 * Read the persisted data-use state. A failed read answers null, and the
 * caller decides what that means for its surface.
 */
export async function fetchDataUseState(
  chatbotId: string
): Promise<ChatDataUseState | null> {
  try {
    const response = await authedFetch(dataUseEndpoint(chatbotId))
    if (!response.ok) return null
    const data = (await response.json()) as { state: ChatDataUseState }
    return data.state ?? null
  } catch {
    return null
  }
}

/**
 * Which Tutor notice this page shows for the server's current version. The
 * texts are bundled with the page, so a page opened before a notice change can
 * receive a version it has no text for; it answers null, and the choice waits
 * until the page is reloaded. An answer always carries the version shown.
 */
export function shownTutorNotice(version: string): 'results' | 'notes' | null {
  if (version === TUTOR_PERSONALIZATION_NOTES_DISCLOSURE_VERSION) return 'notes'
  if (version === TUTOR_PERSONALIZATION_DISCLOSURE_VERSION) return 'results'
  return null
}
