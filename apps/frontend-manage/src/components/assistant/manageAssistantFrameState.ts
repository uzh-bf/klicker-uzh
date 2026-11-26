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
  | { type: 'ready'; generation: number }
  | { type: 'retry' }
  | { type: 'deadline'; generation: number }
  | { type: 'error'; generation: number }

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

  // Actions carrying a generation are dropped when stale. Only url-changed
  // and retry intentionally bypass this check.
  if ('generation' in action && action.generation !== state.generation) {
    return state
  }

  if (action.type === 'ready') {
    return { ...state, phase: 'ready' }
  }

  if (action.type === 'retry') {
    return {
      ...state,
      generation: state.generation + 1,
      phase: 'retrying',
    }
  }

  if (action.type === 'deadline') {
    if (state.phase !== 'loading' && state.phase !== 'retrying') return state
    return { ...state, phase: 'delayed' }
  }

  if (action.type === 'error') {
    // A late hard error can upgrade delayed, but must not regress ready.
    if (state.phase === 'ready' || state.phase === 'failed') return state
    return { ...state, phase: 'failed' }
  }

  const exhaustive: never = action
  return exhaustive
}
