import { MANAGE_ELEMENT_CREATED_MESSAGE_TYPE } from '@klicker-uzh/types'

const MAX_NAME_LENGTH = 200

export type ManageElementCreatedPayload = {
  id: number
  name: string
}

export function isManageElementCreatedMessage(data: unknown): data is {
  type: typeof MANAGE_ELEMENT_CREATED_MESSAGE_TYPE
  payload: unknown
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === MANAGE_ELEMENT_CREATED_MESSAGE_TYPE
  )
}

// The payload crosses a postMessage boundary from the embedded assistant
// iframe, so it is untrusted data, not an instruction: validate its shape
// and bounds strictly rather than trusting the sender.
export function sanitizeManageElementCreatedPayload(
  payload: unknown
): ManageElementCreatedPayload | null {
  if (typeof payload !== 'object' || payload === null) return null

  const { id, name } = payload as Record<string, unknown>

  // Mirror the server-side confirmedElementSchema bound
  // (z.number().int().positive()): a created element id is always a positive
  // integer, so reject fractional or non-positive values at this boundary too.
  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) return null
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    name.length > MAX_NAME_LENGTH
  ) {
    return null
  }

  return { id, name }
}
