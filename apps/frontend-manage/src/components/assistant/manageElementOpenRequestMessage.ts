import { MANAGE_ELEMENT_OPEN_REQUEST_MESSAGE_TYPE } from '@klicker-uzh/types'

export type ManageElementOpenRequestPayload = {
  id: number
}

export function isManageElementOpenRequestMessage(data: unknown): data is {
  type: typeof MANAGE_ELEMENT_OPEN_REQUEST_MESSAGE_TYPE
  payload: unknown
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type ===
      MANAGE_ELEMENT_OPEN_REQUEST_MESSAGE_TYPE
  )
}

// The payload crosses a postMessage boundary from the embedded assistant and
// must remain a narrow identity-only request owned by the Manage parent.
export function sanitizeManageElementOpenRequestPayload(
  payload: unknown
): ManageElementOpenRequestPayload | null {
  if (typeof payload !== 'object' || payload === null) return null

  const { id } = payload as Record<string, unknown>
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null

  return { id }
}
