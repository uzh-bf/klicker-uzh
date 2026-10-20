type ChatbotWorkspaceView =
  | 'overview'
  | 'knowledge'
  | 'behavior'
  | 'disclaimer'
  | 'usage'
type ChatbotSetupStep = 'basics' | 'modes' | 'disclaimer' | 'credits' | 'review'

type ChatbotWorkspaceState = {
  view: ChatbotWorkspaceView
  step?: ChatbotSetupStep
}

type ChatbotNavigationState = {
  dirty: boolean
  pending: boolean
}

const workspaceViews: ChatbotWorkspaceView[] = [
  'overview',
  'knowledge',
  'behavior',
  'disclaimer',
  'usage',
]
const setupSteps: ChatbotSetupStep[] = [
  'basics',
  'modes',
  'disclaimer',
  'credits',
  'review',
]

function includesValue<T extends string>(
  values: readonly T[],
  value: string | undefined
): value is T {
  return typeof value === 'string' && values.includes(value as T)
}

const defaultWorkspaceState: ChatbotWorkspaceState = { view: 'overview' }

type ChatbotSetupLinkTarget =
  | 'materials'
  | 'students'
  | 'modes'
  | 'usage'
  | 'details'
  | 'request'

// Links into the former workspace views open the matching section of the
// setup page.
function getSetupLinkTarget(
  state: ChatbotWorkspaceState
): ChatbotSetupLinkTarget | undefined {
  switch (state.view) {
    case 'knowledge':
      return 'materials'
    case 'disclaimer':
      return 'students'
    case 'behavior':
      return 'modes'
    case 'usage':
      return 'usage'
    case 'overview':
      if (state.step === 'basics') return 'details'
      if (state.step === 'review') return 'request'
      return undefined
  }
}

function normalizeLegacyWorkspaceState(
  requestedView: string,
  requestedStep: string | undefined
): ChatbotWorkspaceState {
  if (requestedView === 'advanced') {
    return { view: 'behavior' }
  }

  switch (requestedStep) {
    case 'modes':
      return { view: 'behavior' }
    case 'disclaimer':
      return { view: 'disclaimer' }
    case 'credits':
      return { view: 'usage' }
    case 'basics':
      return { view: 'overview', step: 'basics' }
    case 'review':
      return { view: 'overview', step: 'review' }
    default:
      return defaultWorkspaceState
  }
}

function normalizeWorkspaceState(
  requestedView: string | undefined,
  requestedStep: string | undefined
): ChatbotWorkspaceState {
  if (requestedView === 'setup' || requestedView === 'advanced') {
    return normalizeLegacyWorkspaceState(requestedView, requestedStep)
  }

  if (!includesValue(workspaceViews, requestedView)) {
    return defaultWorkspaceState
  }

  if (requestedView === 'overview') {
    if (requestedStep === 'basics' || requestedStep === 'review') {
      return { view: 'overview', step: requestedStep }
    }
    if (requestedStep === 'modes') {
      return { view: 'behavior' }
    }
    if (requestedStep === 'disclaimer') {
      return { view: 'disclaimer' }
    }
    if (requestedStep === 'credits') {
      return { view: 'usage' }
    }
  }

  return { view: requestedView }
}

export type {
  ChatbotNavigationState,
  ChatbotSetupLinkTarget,
  ChatbotSetupStep,
  ChatbotWorkspaceState,
  ChatbotWorkspaceView,
}
export {
  getSetupLinkTarget,
  normalizeWorkspaceState,
  setupSteps,
  workspaceViews,
}
