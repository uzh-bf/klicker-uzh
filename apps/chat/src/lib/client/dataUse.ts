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
