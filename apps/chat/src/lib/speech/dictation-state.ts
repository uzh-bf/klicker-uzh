export const DICTATION_STATUSES = [
  'unsupported',
  'unavailable',
  'needs-install',
  'installing',
  'ready',
  'listening',
  'error',
] as const

export type DictationStatus = (typeof DICTATION_STATUSES)[number]

export type DictationErrorCode =
  | 'aborted'
  | 'audio-capture'
  | 'availability-check-failed'
  | 'install-failed'
  | 'language-not-supported'
  | 'network'
  | 'no-speech'
  | 'not-allowed'
  | 'service-not-allowed'
  | 'unknown'

export interface DictationState {
  status: DictationStatus
  error: DictationErrorCode | null
  interimTranscript: string
  finalTranscript: string
}

export type DictationEvent =
  | {
      type: 'capability'
      status: Extract<
        DictationStatus,
        'unsupported' | 'unavailable' | 'needs-install' | 'installing' | 'ready'
      >
    }
  | { type: 'install-start' }
  | { type: 'install-result'; available: boolean }
  | { type: 'start' }
  | { type: 'interim'; text: string }
  | { type: 'final'; text: string }
  | { type: 'end' }
  | { type: 'error'; error: DictationErrorCode }
  | { type: 'reset' }

export function createInitialDictationState(
  status: DictationStatus = 'unsupported'
): DictationState {
  return {
    status,
    error: null,
    interimTranscript: '',
    finalTranscript: '',
  }
}

function appendTranscript(current: string, next: string) {
  const trimmed = next.trim()
  if (!trimmed) return current
  return current ? `${current} ${trimmed}` : trimmed
}

export function dictationReducer(
  state: DictationState,
  event: DictationEvent
): DictationState {
  switch (event.type) {
    case 'capability':
      return {
        ...createInitialDictationState(event.status),
      }
    case 'install-start':
      return {
        ...state,
        status: 'installing',
        error: null,
        interimTranscript: '',
        finalTranscript: '',
      }
    case 'install-result':
      return event.available
        ? createInitialDictationState('ready')
        : { ...createInitialDictationState('error'), error: 'install-failed' }
    case 'start':
      return state.status === 'ready'
        ? {
            ...state,
            status: 'listening',
            error: null,
            interimTranscript: '',
            finalTranscript: '',
          }
        : state
    case 'interim':
      return state.status === 'listening'
        ? { ...state, interimTranscript: event.text }
        : state
    case 'final':
      return state.status === 'listening'
        ? {
            ...state,
            interimTranscript: '',
            finalTranscript: appendTranscript(
              state.finalTranscript,
              event.text
            ),
          }
        : state
    case 'end':
      return state.status === 'listening'
        ? { ...state, status: 'ready', interimTranscript: '' }
        : state
    case 'error':
      return {
        ...state,
        status: 'error',
        error: event.error,
        interimTranscript: '',
      }
    case 'reset':
      return createInitialDictationState()
  }
}
