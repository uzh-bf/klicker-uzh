import { useManageParentStore } from '../stores/manageParentStore'

export const MANAGE_ELEMENT_CREATED_MESSAGE_TYPE =
  'klicker:manage-element-created'

export type ManageElementCreatedPayload = {
  id: number
  name: string
}

export function buildManageElementCreatedMessage(
  payload: ManageElementCreatedPayload
) {
  return {
    type: MANAGE_ELEMENT_CREATED_MESSAGE_TYPE,
    payload,
  } as const
}

// Tells the embedding Manage parent that a proposal was confirmed into a new
// question-pool element, so it can refresh its own data without a reload.
// Silently does nothing when there is no cached parent origin: that means
// this chat instance is not embedded in a Manage tab (e.g. a standalone chat
// session), so there is no parent to refresh. The cached origin always comes
// from a validated `klicker:manage-context` message (see
// useEmbeddedManageContext), so it is safe to target directly instead of '*'.
export function notifyManageParent(payload: ManageElementCreatedPayload) {
  const manageParentOrigin = useManageParentStore.getState().manageParentOrigin
  if (!manageParentOrigin) return

  window.parent.postMessage(
    buildManageElementCreatedMessage(payload),
    manageParentOrigin
  )
}
