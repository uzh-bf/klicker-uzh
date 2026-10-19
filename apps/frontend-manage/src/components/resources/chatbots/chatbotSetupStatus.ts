// Status rules for the sections of the chatbot setup page. They are pure so the
// page, its tests and any later summary share one definition of what each
// status means.

export type ChatbotSetupSectionId =
  | 'materials'
  | 'students'
  | 'modes'
  | 'model'
  | 'usage'
  | 'graph'

export type ChatbotSetupSectionStatus =
  | 'default'
  | 'suggested'
  | 'saved'
  | 'warning'
  | 'invalid'
  | 'unsaved'
  | 'notSubmitted'

// The order of the checks is the contract: an unsaved edit outranks every
// stored state, and a stored but invalid value outranks a pending submission.
export function resolveSectionStatus({
  unsaved = false,
  invalid = false,
  notSubmitted = false,
  warning = false,
  suggested = false,
  isDefault = false,
}: {
  unsaved?: boolean
  invalid?: boolean
  notSubmitted?: boolean
  warning?: boolean
  suggested?: boolean
  isDefault?: boolean
}): ChatbotSetupSectionStatus {
  if (unsaved) return 'unsaved'
  if (invalid) return 'invalid'
  if (notSubmitted) return 'notSubmitted'
  if (warning) return 'warning'
  if (suggested) return 'suggested'
  if (isDefault) return 'default'
  return 'saved'
}

// Only an invalid section blocks a publication request; a warning never does.
export function sectionBlocksRequest(status: ChatbotSetupSectionStatus) {
  return status === 'unsaved' || status === 'invalid'
}

export type CreditPolicyValues = {
  creditInitialCredits: number
  creditResetPeriod: string
  creditResetAmount: number
  creditMaxCredits: number
}

// Mirrors DEFAULT_CHATBOT_CREDIT_POLICY on the server, which every new
// chatbot receives.
export const DEFAULT_CREDIT_POLICY: CreditPolicyValues = {
  creditInitialCredits: 3,
  creditResetPeriod: 'DAILY',
  creditResetAmount: 3,
  creditMaxCredits: 3,
}

export function isDefaultCreditPolicy(values: CreditPolicyValues) {
  return (
    values.creditInitialCredits ===
      DEFAULT_CREDIT_POLICY.creditInitialCredits &&
    values.creditResetPeriod === DEFAULT_CREDIT_POLICY.creditResetPeriod &&
    values.creditResetAmount === DEFAULT_CREDIT_POLICY.creditResetAmount &&
    values.creditMaxCredits === DEFAULT_CREDIT_POLICY.creditMaxCredits
  )
}

export type ModeValues = {
  tutorEnabled: boolean
  explainerEnabled: boolean
  quizzerEnabled: boolean
  scopeNote: string
  customModeCount: number
}

export function isDefaultModes(values: ModeValues) {
  return (
    values.tutorEnabled &&
    values.explainerEnabled &&
    values.quizzerEnabled &&
    values.scopeNote.trim() === '' &&
    values.customModeCount === 0
  )
}

export type ModelPolicyValues = {
  modelSelection: boolean
  allowedModelIds: readonly string[]
  reasoningEffortsByModel: readonly {
    modelId: string
    efforts: readonly string[]
  }[]
}

// A new chatbot uses one fixed model, the registry default, at medium
// reasoning. An empty model list also means that default.
export function isDefaultModelPolicy(
  values: ModelPolicyValues,
  defaultModelId: string
) {
  if (values.modelSelection) return false
  const modelIds = [...new Set(values.allowedModelIds)]
  if (modelIds.length > 1) return false
  if (modelIds.length === 1 && modelIds[0] !== defaultModelId) return false
  return values.reasoningEffortsByModel
    .filter(({ modelId }) => modelId === defaultModelId)
    .every(({ efforts }) => efforts.length === 0 || efforts[0] === 'medium')
}

export type GraphPolicyValues = {
  knowledgeGraphVisible: boolean
  knowledgeGraphRetrievalEnabled: boolean
}

export function isDefaultGraphPolicy(values: GraphPolicyValues) {
  return !values.knowledgeGraphVisible && !values.knowledgeGraphRetrievalEnabled
}

export type StudentInformationValues = {
  title: string | null | undefined
  introText: string | null | undefined
}

export function isStudentInformationInvalid(values: StudentInformationValues) {
  const intro = values.introText?.trim() ?? ''
  return !values.title?.trim() || !intro || /^<br>\s*$/i.test(intro)
}

// The suggested text exists in every interface language, and the course
// language can change after creation, so any of them still counts.
export function isSuggestedStudentInformation(
  values: StudentInformationValues,
  suggestions: readonly StudentInformationValues[]
) {
  return suggestions.some(
    (suggestion) =>
      values.title?.trim() === suggestion.title?.trim() &&
      values.introText?.trim() === suggestion.introText?.trim()
  )
}

// A published chatbot keeps its live values until a review approves the saved
// revision, so a section whose saved values differ from the live ones is saved
// but not yet submitted.
export function hasUnsubmittedChanges<Values>(
  saved: Values,
  live: Values
): boolean {
  return JSON.stringify(saved) !== JSON.stringify(live)
}
