import { type Chatbot, ChatbotStatus } from '@klicker-uzh/graphql/dist/ops'

type ChatbotWorkspaceView =
  | 'overview'
  | 'knowledge'
  | 'behavior'
  | 'disclaimer'
  | 'usage'
type ChatbotSetupStep = 'basics' | 'modes' | 'disclaimer' | 'review'

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
  'review',
]

function includesValue<T extends string>(
  values: readonly T[],
  value: string | undefined
): value is T {
  return typeof value === 'string' && values.includes(value as T)
}

function hasCompleteBasics(chatbot: Chatbot) {
  return Boolean(chatbot.name.trim() && (chatbot.courses?.length ?? 0) > 0)
}

function hasCompleteDisclaimer(chatbot: Chatbot) {
  return Boolean(
    chatbot.disclaimerSummary?.title?.trim() &&
      chatbot.disclaimerSummary.introText?.trim()
  )
}

function getDefaultSetupStep(chatbot: Chatbot): ChatbotSetupStep {
  if (!hasCompleteBasics(chatbot)) return 'basics'
  if (!hasCompleteDisclaimer(chatbot)) return 'disclaimer'
  return 'review'
}

function getDefaultWorkspaceState(chatbot: Chatbot): ChatbotWorkspaceState {
  if (
    chatbot.status === ChatbotStatus.Draft ||
    chatbot.status === ChatbotStatus.Rejected
  ) {
    const defaultStep = getDefaultSetupStep(chatbot)
    return defaultStep === 'disclaimer'
      ? { view: 'disclaimer' }
      : { view: 'overview', step: defaultStep }
  }

  return { view: 'overview' }
}

function normalizeLegacyWorkspaceState(
  chatbot: Chatbot,
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
    case 'basics':
      return { view: 'overview', step: 'basics' }
    case 'review':
      return { view: 'overview', step: 'review' }
    default: {
      const defaultState = getDefaultWorkspaceState(chatbot)
      return defaultState.view === 'disclaimer'
        ? defaultState
        : { view: 'overview', step: defaultState.step ?? 'basics' }
    }
  }
}

function normalizeWorkspaceState(
  chatbot: Chatbot,
  requestedView: string | undefined,
  requestedStep: string | undefined
): ChatbotWorkspaceState {
  if (requestedView === 'setup' || requestedView === 'advanced') {
    return normalizeLegacyWorkspaceState(chatbot, requestedView, requestedStep)
  }

  if (!includesValue(workspaceViews, requestedView)) {
    return getDefaultWorkspaceState(chatbot)
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
  }

  return { view: requestedView }
}

export type {
  ChatbotNavigationState,
  ChatbotSetupStep,
  ChatbotWorkspaceState,
  ChatbotWorkspaceView,
}
export {
  getDefaultWorkspaceState,
  hasCompleteBasics,
  hasCompleteDisclaimer,
  normalizeWorkspaceState,
  setupSteps,
  workspaceViews,
}
