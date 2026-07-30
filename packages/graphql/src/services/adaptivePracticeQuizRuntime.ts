import {
  MIN_ADAPTIVE_REPORTING_RESPONSES,
  advanceAdaptiveRuntime,
  computeAdaptiveRuntimeEstimates,
  normalizeAdaptiveRuntimeEstimateForChart,
  normalizeFreeTextResponse,
  normalizeNumericalResponse,
  prepareAdaptiveRuntime,
  type AdaptiveRuntimeDecision as CoreAdaptiveRuntimeDecision,
  type AdaptiveRuntimeEstimate as CoreAdaptiveRuntimeEstimate,
  type AdaptiveRuntimeEstimates as CoreAdaptiveRuntimeEstimates,
  type AdaptiveRuntimeLevel as CoreAdaptiveRuntimeLevel,
  type AdaptiveRuntimeNode as CoreAdaptiveRuntimeNode,
  type AdaptiveRuntimePoolItem as CoreAdaptiveRuntimePoolItem,
  type AdaptiveRuntimeResponse as CoreAdaptiveRuntimeResponse,
  type AdaptiveRuntimeSettings as CoreAdaptiveRuntimeSettings,
} from '@klicker-uzh/adaptive-learning'
import {
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  ChoicesElementData,
  ElementData,
  FreeTextElementData,
  NumericalElementData,
} from '@klicker-uzh/types'

export const MIN_REPORTING_RESPONSES = MIN_ADAPTIVE_REPORTING_RESPONSES

export type AdaptivePracticeQuizResponseInput = {
  choiceIndices?: number[] | null
  numericalResponse?: string | null
  freeTextResponse?: string | null
}

export type AdaptiveRuntimeSettings = CoreAdaptiveRuntimeSettings
export type AdaptiveRuntimeLevel = CoreAdaptiveRuntimeLevel
export type AdaptiveRuntimeNode = CoreAdaptiveRuntimeNode

export type AdaptiveRuntimePoolItem = CoreAdaptiveRuntimePoolItem & {
  sourceAssignmentId: number
  elementId: number
  elementVersion: number
  elementType: DB.ElementType
  elementName: string
  elementData: ElementData
  nodeNamePath: string[]
  levelLabel: string
  levelOrder: number
  enablePercentInput: boolean
}

export type AdaptiveRuntimeRoutingPoolItem = Omit<
  AdaptiveRuntimePoolItem,
  'elementData'
>

export type AdaptiveRuntimeResponse =
  CoreAdaptiveRuntimeResponse<AdaptiveRuntimeRoutingPoolItem>
export type AdaptiveRuntimeEstimate = CoreAdaptiveRuntimeEstimate
export type AdaptiveRuntimeEstimates = CoreAdaptiveRuntimeEstimates
export type AdaptiveNextItemDecision =
  CoreAdaptiveRuntimeDecision<AdaptiveRuntimeRoutingPoolItem>

export type GradedAdaptiveResponse = {
  rawResponse: Record<string, unknown>
  normalizedResponse: Record<string, unknown>
  score: number
  correct: boolean
}

export type AdaptiveParticipantElement = {
  poolItemId: number
  elementId: number
  name: string
  type: DB.ElementType
  content: string
  options:
    | {
        kind: 'CHOICES'
        displayMode: ChoicesElementData['options']['displayMode']
        choices: Array<{ ix: number; value: string }>
      }
    | {
        kind: 'NUMERICAL'
        unit: string | null
        accuracy: number | null
        placeholder: string | null
        restrictions: NumericalElementData['options']['restrictions']
        enablePercentInput: boolean
      }
    | {
        kind: 'FREE_TEXT'
        restrictions: FreeTextElementData['options']['restrictions']
      }
}

export class AdaptiveRuntimeValidationError extends Error {
  readonly code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = 'AdaptiveRuntimeValidationError'
    this.code = code
  }
}

export function gradeAdaptiveResponse({
  poolItem,
  input,
}: {
  poolItem: AdaptiveRuntimePoolItem
  input: AdaptivePracticeQuizResponseInput
}): GradedAdaptiveResponse {
  assertSingleResponseValue(input)
  if (poolItem.elementData.type !== poolItem.elementType) {
    throw new AdaptiveRuntimeValidationError(
      'The published element snapshot has an inconsistent type.',
      'ADAPTIVE_POOL_ITEM_INVALID'
    )
  }

  switch (poolItem.elementData.type) {
    case DB.ElementType.SC:
    case DB.ElementType.MC:
    case DB.ElementType.KPRIM:
      return gradeChoicesResponse(poolItem.elementData, input.choiceIndices)
    case DB.ElementType.NUMERICAL:
      return gradeNumericalResponse(
        poolItem.elementData,
        input.numericalResponse,
        poolItem.enablePercentInput
      )
    case DB.ElementType.FREE_TEXT:
      return gradeFreeTextResponse(poolItem.elementData, input.freeTextResponse)
    default:
      throw new AdaptiveRuntimeValidationError(
        'This published element type is not supported by adaptive quizzes.',
        'ADAPTIVE_ELEMENT_TYPE_UNSUPPORTED'
      )
  }
}

export function serializeAdaptiveParticipantElement(
  poolItem: AdaptiveRuntimePoolItem
): AdaptiveParticipantElement {
  const element = poolItem.elementData
  if (element.type !== poolItem.elementType) {
    throw new AdaptiveRuntimeValidationError(
      'The published element snapshot has an inconsistent type.',
      'ADAPTIVE_POOL_ITEM_INVALID'
    )
  }

  switch (element.type) {
    case DB.ElementType.SC:
    case DB.ElementType.MC:
    case DB.ElementType.KPRIM:
      return {
        poolItemId: poolItem.id,
        elementId: poolItem.elementId,
        name: poolItem.elementName,
        type: poolItem.elementType,
        content: element.content,
        options: {
          kind: 'CHOICES',
          displayMode: element.options.displayMode,
          choices: element.options.choices.map(({ ix, value }) => ({
            ix,
            value,
          })),
        },
      }
    case DB.ElementType.NUMERICAL:
      return {
        poolItemId: poolItem.id,
        elementId: poolItem.elementId,
        name: poolItem.elementName,
        type: poolItem.elementType,
        content: element.content,
        options: {
          kind: 'NUMERICAL',
          unit: element.options.unit ?? null,
          accuracy: element.options.accuracy ?? null,
          placeholder: element.options.placeholder ?? null,
          restrictions: element.options.restrictions ?? null,
          enablePercentInput: poolItem.enablePercentInput,
        },
      }
    case DB.ElementType.FREE_TEXT:
      return {
        poolItemId: poolItem.id,
        elementId: poolItem.elementId,
        name: poolItem.elementName,
        type: poolItem.elementType,
        content: element.content,
        options: {
          kind: 'FREE_TEXT',
          restrictions: element.options.restrictions ?? null,
        },
      }
    default:
      throw new AdaptiveRuntimeValidationError(
        'This published element type is not supported by adaptive quizzes.',
        'ADAPTIVE_ELEMENT_TYPE_UNSUPPORTED'
      )
  }
}

export function computeAdaptiveEstimates({
  nodes,
  levels,
  responses,
  settings,
  terminalStopReason = null,
}: {
  nodes: AdaptiveRuntimeNode[]
  levels: AdaptiveRuntimeLevel[]
  responses: AdaptiveRuntimeResponse[]
  settings: AdaptiveRuntimeSettings
  terminalStopReason?: DB.AdaptivePracticeQuizStopReason | null
}): AdaptiveRuntimeEstimates {
  return computeAdaptiveRuntimeEstimates({
    nodes,
    levels,
    responses,
    settings,
    terminalStopReason,
  })
}

export function selectAdaptiveNextPoolItem({
  attemptId,
  nodes,
  levels,
  pool,
  responses,
  settings,
}: {
  attemptId: string
  nodes: AdaptiveRuntimeNode[]
  levels: AdaptiveRuntimeLevel[]
  pool: AdaptiveRuntimeRoutingPoolItem[]
  responses: AdaptiveRuntimeResponse[]
  settings: AdaptiveRuntimeSettings
}): AdaptiveNextItemDecision {
  const runtime = prepareAdaptiveRuntime({
    nodes,
    levels,
    pool,
    settings,
  })
  return advanceAdaptiveRuntime({ attemptId, runtime, responses })
}

export function normalizeRuntimeEstimateForChart({
  estimate,
  settings,
}: {
  estimate: Pick<AdaptiveRuntimeEstimate, 'theta' | 'standardError'>
  settings: Pick<AdaptiveRuntimeSettings, 'thetaRange' | 'classificationZ'>
}) {
  return normalizeAdaptiveRuntimeEstimateForChart({ estimate, settings })
}

function gradeChoicesResponse(
  element: ChoicesElementData,
  choiceIndices: number[] | null | undefined
): GradedAdaptiveResponse {
  if (!Array.isArray(choiceIndices)) {
    throw invalidResponse('Choice indices are required for this element.')
  }
  if (new Set(choiceIndices).size !== choiceIndices.length) {
    throw invalidResponse('Choice indices must be unique.')
  }
  const validIndices = new Set(element.options.choices.map(({ ix }) => ix))
  if (
    choiceIndices.some((ix) => !Number.isInteger(ix) || !validIndices.has(ix))
  ) {
    throw invalidResponse('The response contains an unknown choice index.')
  }
  if (element.type === DB.ElementType.SC && choiceIndices.length !== 1) {
    throw invalidResponse('Single-choice elements require exactly one choice.')
  }
  if (element.type === DB.ElementType.MC && choiceIndices.length === 0) {
    throw invalidResponse(
      'Multiple-choice elements require at least one selected choice.'
    )
  }

  const selected = new Set(choiceIndices)
  const response = element.options.choices.map(({ ix }) => ({
    ix,
    selected: selected.has(ix),
  }))
  const solution = element.options.choices
    .filter(({ correct }) => correct === true)
    .map(({ ix }) => ix)
  const args = {
    responseCount: element.options.choices.length,
    response,
    solution,
  }
  const score =
    element.type === DB.ElementType.SC
      ? gradeQuestionSC(args)
      : element.type === DB.ElementType.MC
        ? gradeQuestionMC(args)
        : gradeQuestionKPRIM(args)
  if (score === null) {
    throw new AdaptiveRuntimeValidationError(
      'The published element has no controlled answer.',
      'ADAPTIVE_POOL_ITEM_UNSCORABLE'
    )
  }

  const normalized = [...choiceIndices].sort((a, b) => a - b)
  return {
    rawResponse: { choiceIndices },
    normalizedResponse: { choiceIndices: normalized },
    score,
    correct: score === 1,
  }
}

function gradeNumericalResponse(
  element: NumericalElementData,
  numericalResponse: string | null | undefined,
  enablePercentInput: boolean
): GradedAdaptiveResponse {
  if (typeof numericalResponse !== 'string') {
    throw invalidResponse('A numerical response is required for this element.')
  }
  const normalized = normalizeNumericalResponse(numericalResponse, {
    allowPercentInput: enablePercentInput,
  })
  if (normalized.error || normalized.value === null) {
    throw invalidResponse(
      normalized.error ?? 'The numerical response is invalid.'
    )
  }
  const restrictions = element.options.restrictions
  if (
    (typeof restrictions?.min === 'number' &&
      normalized.value < restrictions.min) ||
    (typeof restrictions?.max === 'number' &&
      normalized.value > restrictions.max)
  ) {
    throw invalidResponse(
      'The numerical response is outside the allowed range.'
    )
  }
  const score = gradeQuestionNumerical({
    response: normalized.value,
    solutionRanges: element.options.solutionRanges ?? [],
    exactSolutions: element.options.exactSolutions ?? [],
  })
  if (score === null) {
    throw new AdaptiveRuntimeValidationError(
      'The published element has no controlled answer.',
      'ADAPTIVE_POOL_ITEM_UNSCORABLE'
    )
  }

  return {
    rawResponse: { value: numericalResponse },
    normalizedResponse: { value: normalized.normalized },
    score,
    correct: score === 1,
  }
}

function gradeFreeTextResponse(
  element: FreeTextElementData,
  freeTextResponse: string | null | undefined
): GradedAdaptiveResponse {
  if (typeof freeTextResponse !== 'string') {
    throw invalidResponse('A free-text response is required for this element.')
  }
  const maxLength = element.options.restrictions?.maxLength
  if (typeof maxLength === 'number' && freeTextResponse.length > maxLength) {
    throw invalidResponse('The free-text response exceeds the maximum length.')
  }
  const normalized = normalizeFreeTextResponse(freeTextResponse)
  if (normalized.length === 0) {
    throw invalidResponse('The free-text response cannot be empty.')
  }
  const solutions = element.options.solutions
  if (
    !Array.isArray(solutions) ||
    solutions.length === 0 ||
    !solutions.every(
      (solution) =>
        typeof solution === 'string' &&
        normalizeFreeTextResponse(solution).length > 0
    )
  ) {
    throw new AdaptiveRuntimeValidationError(
      'The published element has no controlled answer.',
      'ADAPTIVE_POOL_ITEM_UNSCORABLE'
    )
  }
  const normalizedSolutions = solutions.map(normalizeFreeTextResponse)
  const score = gradeQuestionFreeText({
    response: normalized,
    solutions: normalizedSolutions,
  })
  if (score === null) {
    throw new AdaptiveRuntimeValidationError(
      'The published element has no controlled answer.',
      'ADAPTIVE_POOL_ITEM_UNSCORABLE'
    )
  }

  return {
    rawResponse: { value: freeTextResponse },
    normalizedResponse: { value: normalized },
    score,
    correct: score === 1,
  }
}

function assertSingleResponseValue(input: AdaptivePracticeQuizResponseInput) {
  const provided = [
    input.choiceIndices !== null && typeof input.choiceIndices !== 'undefined',
    input.numericalResponse !== null &&
      typeof input.numericalResponse !== 'undefined',
    input.freeTextResponse !== null &&
      typeof input.freeTextResponse !== 'undefined',
  ].filter(Boolean).length
  if (provided !== 1) {
    throw invalidResponse('Exactly one response value must be provided.')
  }
}

function invalidResponse(message: string) {
  return new AdaptiveRuntimeValidationError(
    message,
    'ADAPTIVE_RESPONSE_INVALID'
  )
}
