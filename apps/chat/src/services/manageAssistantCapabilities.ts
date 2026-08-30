import type { ToolSet } from 'ai'

export const MANAGE_ASSISTANT_CAPABILITY_HEADER = 'X-Klicker-Manage-Capability'

export type ManageAssistantCapabilityState =
  | 'draft-and-read'
  | 'read-only'
  | 'unavailable'

const LIVE_READ_TOOL_NAMES = [
  'klicker_lecturer_course_list',
  'klicker_lecturer_course_get',
  'klicker_lecturer_element_search',
  'klicker_lecturer_element_get',
] as const

const DRAFT_PROPOSAL_TOOL_NAME =
  'klicker_lecturer_element_create_draft_proposal'

export function isManageAssistantCapabilityState(
  value: unknown
): value is ManageAssistantCapabilityState {
  return (
    value === 'draft-and-read' ||
    value === 'read-only' ||
    value === 'unavailable'
  )
}

export function classifyManageAssistantCapabilityState(
  tools: ToolSet
): ManageAssistantCapabilityState {
  const hasLiveReadTool = LIVE_READ_TOOL_NAMES.some((name) =>
    Object.hasOwn(tools, name)
  )
  if (!hasLiveReadTool) return 'unavailable'

  return Object.hasOwn(tools, DRAFT_PROPOSAL_TOOL_NAME)
    ? 'draft-and-read'
    : 'read-only'
}

export type ManageAssistantCapabilityClientState = {
  capability: ManageAssistantCapabilityState
  phase: 'checking' | 'settled'
}

export type ManageAssistantCapabilityClientAction =
  | { type: 'check' }
  | { capability: ManageAssistantCapabilityState; type: 'resolve' }

export const INITIAL_MANAGE_ASSISTANT_CAPABILITY_STATE: ManageAssistantCapabilityClientState =
  {
    capability: 'unavailable',
    phase: 'checking',
  }

export function reduceManageAssistantCapabilityState(
  _state: ManageAssistantCapabilityClientState,
  action: ManageAssistantCapabilityClientAction
): ManageAssistantCapabilityClientState {
  switch (action.type) {
    case 'check':
      return INITIAL_MANAGE_ASSISTANT_CAPABILITY_STATE
    case 'resolve':
      return { capability: action.capability, phase: 'settled' }
    default: {
      const exhaustive: never = action
      return exhaustive
    }
  }
}
