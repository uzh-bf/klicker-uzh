export const MANAGE_ASSISTANT_LOADING_DEADLINE_MS = 10_000

export type ManageAssistantFramePhase =
  | 'loading'
  | 'retrying'
  | 'delayed'
  | 'failed'
  | 'ready'

export type ManageAssistantFrameState = {
  generation: number
  phase: ManageAssistantFramePhase
  url: string | null
}

export type ManageAssistantFrameAction =
  | { type: 'url-changed'; url: string | null }
  | { type: 'ready'; generation: number; url: string }
  | { type: 'retry'; url: string }
  | { type: 'deadline'; generation: number; url: string }
  | { type: 'error'; generation: number; url: string }

export function createManageAssistantFrameState(
  url: string | null
): ManageAssistantFrameState {
  return { generation: 0, phase: 'loading', url }
}

export function reduceManageAssistantFrameState(
  state: ManageAssistantFrameState,
  action: ManageAssistantFrameAction
): ManageAssistantFrameState {
  if (action.type === 'url-changed') {
    if (action.url === state.url) return state

    return {
      generation: state.generation + 1,
      phase: 'loading',
      url: action.url,
    }
  }

  if (action.url !== state.url) return state

  if (action.type === 'ready') {
    if (action.generation !== state.generation) return state
    return { ...state, phase: 'ready' }
  }

  if (action.type === 'retry') {
    return {
      ...state,
      generation: state.generation + 1,
      phase: 'retrying',
    }
  }

  if (action.generation !== state.generation) return state

  if (action.type === 'deadline') {
    if (state.phase !== 'loading' && state.phase !== 'retrying') return state
    return { ...state, phase: 'delayed' }
  }

  return { ...state, phase: 'failed' }
}
