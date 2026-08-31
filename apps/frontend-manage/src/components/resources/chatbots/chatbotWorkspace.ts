import { type Chatbot, ChatbotStatus } from '@klicker-uzh/graphql/dist/ops'

type ChatbotWorkspaceView = 'overview' | 'setup' | 'advanced' | 'usage'
type ChatbotSetupStep = 'basics' | 'disclaimer' | 'review'

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
  'setup',
  'advanced',
  'usage',
]
const setupSteps: ChatbotSetupStep[] = ['basics', 'disclaimer', 'review']

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
    return { view: 'setup', step: getDefaultSetupStep(chatbot) }
  }

  return { view: 'overview' }
}

function normalizeWorkspaceState(
  chatbot: Chatbot,
  requestedView: string | undefined,
  requestedStep: string | undefined
): ChatbotWorkspaceState {
  if (!includesValue(workspaceViews, requestedView)) {
    return getDefaultWorkspaceState(chatbot)
  }

  if (requestedView !== 'setup') {
    return { view: requestedView }
  }

  if (
    chatbot.status === ChatbotStatus.PendingApproval ||
    chatbot.status === ChatbotStatus.Paused
  ) {
    return { view: 'overview' }
  }

  if (chatbot.status === ChatbotStatus.Published) {
    return { view: 'setup', step: 'basics' }
  }

  const defaultStep = getDefaultSetupStep(chatbot)
  if (!includesValue(setupSteps, requestedStep)) {
    return { view: 'setup', step: defaultStep }
  }

  if (!hasCompleteBasics(chatbot) && requestedStep !== 'basics') {
    return { view: 'setup', step: 'basics' }
  }

  if (!hasCompleteDisclaimer(chatbot) && requestedStep === 'review') {
    return { view: 'setup', step: 'disclaimer' }
  }

  return { view: 'setup', step: requestedStep }
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
