const MAX_NAME_LENGTH = 200

export const MANAGE_ELEMENT_CREATED_MESSAGE_TYPE =
  'klicker:manage-element-created'

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

  if (typeof id !== 'number' || !Number.isFinite(id)) return null
  if (
    typeof name !== 'string' ||
    name.length === 0 ||
    name.length > MAX_NAME_LENGTH
  ) {
    return null
  }

  return { id, name }
}
