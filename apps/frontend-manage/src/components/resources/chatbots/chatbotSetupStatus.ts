// Status rules for the sections of the chatbot setup page. They are pure so the
// page, its tests and any later summary share one definition of what each
// status means.

import { DEFAULT_CHATBOT_CREDIT_POLICY_VALUES } from '@klicker-uzh/util/chatbot-credit-policy-defaults'

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

export const DEFAULT_CREDIT_POLICY: CreditPolicyValues =
  DEFAULT_CHATBOT_CREDIT_POLICY_VALUES

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
  courseName?: string | null
  subjectDomain?: string | null
  languageOfInstruction?: string | null
  scopeNote: string
  customModeCount: number
}

// Framing is any stored context for the standard modes. Manage edits only the
// scope note, but the other fields can be set elsewhere and are kept on save.
export function hasModeFraming(
  values: Omit<ModeValues, 'customModeCount'>
): boolean {
  return Boolean(
    values.courseName?.trim() ||
      values.subjectDomain?.trim() ||
      values.languageOfInstruction ||
      values.scopeNote.trim()
  )
}

export function isDefaultModes(values: ModeValues) {
  return (
    values.tutorEnabled &&
    values.explainerEnabled &&
    values.quizzerEnabled &&
    !hasModeFraming(values) &&
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
    .every(
      ({ efforts }) =>
        efforts.length === 0 ||
        (efforts.length === 1 && efforts[0] === 'medium')
    )
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

// Saved and live values come from different projections, so they compare by
// value: object keys in any order, and a missing key equal to null.
function normalizeForComparison(value: unknown): unknown {
  if (value === undefined) return null
  if (Array.isArray(value)) return value.map(normalizeForComparison)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined && entry !== null)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, entry]) => [key, normalizeForComparison(entry)])
    )
  }
  return value
}

// A published chatbot keeps its live values until a review approves the saved
// revision, so a section whose saved values differ from the live ones is saved
// but not yet submitted.
export function hasUnsubmittedChanges<Values>(
  saved: Values,
  live: Values
): boolean {
  return (
    JSON.stringify(normalizeForComparison(saved)) !==
    JSON.stringify(normalizeForComparison(live))
  )
}
