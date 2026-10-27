import {
  MANAGE_ELEMENT_CREATED_MESSAGE_TYPE,
  MANAGE_ELEMENT_OPEN_REQUEST_MESSAGE_TYPE,
} from '@klicker-uzh/types'
import { useManageParentStore } from '../stores/manageParentStore'

export type ManageElementCreatedPayload = {
  id: number
  name: string
}

export type ManageElementOpenRequestPayload = {
  id: number
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
    { type: MANAGE_ELEMENT_CREATED_MESSAGE_TYPE, payload },
    manageParentOrigin
  )
}

// Asks the embedding Manage page to open the just-created draft. The parent
// owns the route so the iframe never receives or constructs a same-origin
// editor URL. Silently no-ops for standalone Chat sessions.
export function requestManageParentOpen(
  payload: ManageElementOpenRequestPayload
) {
  const manageParentOrigin = useManageParentStore.getState().manageParentOrigin
  if (!manageParentOrigin) return

  window.parent.postMessage(
    { type: MANAGE_ELEMENT_OPEN_REQUEST_MESSAGE_TYPE, payload },
    manageParentOrigin
  )
}
