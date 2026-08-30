import type { ToolSet } from 'ai'

export const MANAGE_ASSISTANT_CAPABILITY_HEADER = 'X-Klicker-Manage-Capability'
export const MANAGE_ASSISTANT_PREFLIGHT_TIMEOUT_MS = 5_000

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

const DRAFT_TOOL_NAMES = [
  'klicker_lecturer_question_draft',
  'klicker_lecturer_choices_draft',
  'klicker_lecturer_feedback_draft',
  DRAFT_PROPOSAL_TOOL_NAME,
] as const

const TOOL_NAMES_BY_CAPABILITY: Record<
  ManageAssistantCapabilityState,
  readonly string[]
> = {
  'draft-and-read': [...LIVE_READ_TOOL_NAMES, ...DRAFT_TOOL_NAMES],
  'read-only': LIVE_READ_TOOL_NAMES,
  unavailable: [],
}

export function isManageAssistantCapabilityState(
  value: unknown
): value is ManageAssistantCapabilityState {
  return (
    value === 'draft-and-read' ||
    value === 'read-only' ||
    value === 'unavailable'
  )
}

export function createManageAssistantPreflightSignal(
  signal: AbortSignal,
  timeoutMs = MANAGE_ASSISTANT_PREFLIGHT_TIMEOUT_MS
) {
  return AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
}

export async function fetchManageAssistantChatWithCapability(
  fetchImplementation: typeof globalThis.fetch,
  input: Parameters<typeof globalThis.fetch>[0],
  init: Parameters<typeof globalThis.fetch>[1],
  turnRevision: { current: number },
  onCapability: (capability: ManageAssistantCapabilityState) => void
): Promise<Response> {
  turnRevision.current += 1
  const requestRevision = turnRevision.current

  try {
    const response = await fetchImplementation(input, init)
    const capability = response.headers.get(MANAGE_ASSISTANT_CAPABILITY_HEADER)

    if (requestRevision === turnRevision.current) {
      onCapability(
        isManageAssistantCapabilityState(capability)
          ? capability
          : 'unavailable'
      )
    }

    return response
  } catch (error) {
    if (requestRevision === turnRevision.current) {
      onCapability('unavailable')
    }
    throw error
  }
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

export function selectManageAssistantTools(
  tools: ToolSet,
  capabilityState: ManageAssistantCapabilityState
): ToolSet {
  const allowedToolNames = new Set(TOOL_NAMES_BY_CAPABILITY[capabilityState])
  return Object.fromEntries(
    Object.entries(tools).filter(([name]) => allowedToolNames.has(name))
  ) as ToolSet
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
      return { ...INITIAL_MANAGE_ASSISTANT_CAPABILITY_STATE }
    case 'resolve':
      return { capability: action.capability, phase: 'settled' }
    default: {
      const exhaustive: never = action
      throw new Error(
        `Unknown Manage assistant capability action: ${JSON.stringify(exhaustive)}`
      )
    }
  }
}
