import { type Chatbot, ChatbotStatus } from '@klicker-uzh/graphql/dist/ops'

// The workspace helpers only read these fields, so a chatbot projection does
// not have to select the whole entity for them.
type ChatbotWorkspaceFacts = Pick<Chatbot, 'status'>

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

// A draft or rejected chatbot is set up on one page of sections, which all
// start closed.
function isSectionSetup(chatbot: ChatbotWorkspaceFacts) {
  return (
    chatbot.status === ChatbotStatus.Draft ||
    chatbot.status === ChatbotStatus.Rejected
  )
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
  chatbot: ChatbotWorkspaceFacts,
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
      return isSectionSetup(chatbot)
        ? defaultWorkspaceState
        : { view: 'overview', step: 'basics' }
  }
}

function normalizeWorkspaceState(
  chatbot: ChatbotWorkspaceFacts,
  requestedView: string | undefined,
  requestedStep: string | undefined
): ChatbotWorkspaceState {
  if (requestedView === 'setup' || requestedView === 'advanced') {
    return normalizeLegacyWorkspaceState(chatbot, requestedView, requestedStep)
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
  isSectionSetup,
  normalizeWorkspaceState,
  setupSteps,
  workspaceViews,
}
