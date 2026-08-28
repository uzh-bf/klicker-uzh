// postMessage protocol shared between apps/frontend-manage's embedded
// ManageAssistantWidget (the top-level Manage window) and apps/chat's manage
// assistant iframe (a separate origin). Centralized here so the message-type
// string literals that cross that origin boundary cannot drift between the
// two apps — see:
// - apps/frontend-manage/src/components/assistant/ManageAssistantWidget.tsx
// - apps/frontend-manage/src/components/assistant/manageElementCreatedMessage.ts
// - apps/chat/src/hooks/useEmbeddedManageContext.ts
// - apps/chat/src/services/manageParentNotify.ts

// Manage -> chat iframe: the current Manage route/context, posted on iframe
// load, on `klicker:manage-context-ready`, and whenever the context changes.
export const MANAGE_CONTEXT_MESSAGE_TYPE = 'klicker:manage-context'

// Chat iframe -> Manage: announces that the iframe's message listener is
// registered, so Manage (re)sends the current context without racing a
// slow-hydrating iframe.
export const MANAGE_CONTEXT_READY_MESSAGE_TYPE = 'klicker:manage-context-ready'

// Chat iframe -> Manage: requests that the non-modal assistant dock closes
// after Escape is pressed inside the cross-origin iframe.
export const MANAGE_CLOSE_REQUEST_MESSAGE_TYPE = 'klicker:manage-close-request'

// Chat iframe -> Manage: a signed proposal was confirmed into a new
// question-pool element, so Manage can refresh its own data without a reload.
export const MANAGE_ELEMENT_CREATED_MESSAGE_TYPE =
  'klicker:manage-element-created'
