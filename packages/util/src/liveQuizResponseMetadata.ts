export const LIVE_QUIZ_QUESTION_TYPES = [
  'SC',
  'MC',
  'KPRIM',
  'NUMERICAL',
  'FREE_TEXT',
  'SELECTION',
  'CASE_STUDY',
  'CONTENT',
] as const

export type LiveQuizQuestionType = (typeof LIVE_QUIZ_QUESTION_TYPES)[number]

type CommonCorrelatedResponseInstanceInfo = {
  type: LiveQuizQuestionType
  blockExecution: string
  sessionBlockId: string
  basePoints?: string
  blockClosedAt?: string
  defaultCorrectPoints?: string
  defaultPoints?: string
  firstResponseReceivedAt?: string
  maxBonusPoints?: string
  pointsMultiplier?: string
  restrictions?: string
  solutions?: string
  timeToZeroBonus?: string
}

export type CorrelatedResponseInstanceInfo =
  | (CommonCorrelatedResponseInstanceInfo & {
      type: 'SC' | 'MC' | 'KPRIM'
      choiceCount: string
    })
  | (CommonCorrelatedResponseInstanceInfo & {
      type: 'NUMERICAL' | 'FREE_TEXT' | 'CONTENT'
    })
  | (CommonCorrelatedResponseInstanceInfo & {
      type: 'SELECTION'
      numberOfInputs: string
      selectionAnswerIds: string
    })
  | (CommonCorrelatedResponseInstanceInfo & {
      type: 'CASE_STUDY'
      caseStudyResponseShape: string
    })

const OPTIONAL_STRING_FIELDS = [
  'basePoints',
  'blockClosedAt',
  'defaultCorrectPoints',
  'defaultPoints',
  'firstResponseReceivedAt',
  'maxBonusPoints',
  'pointsMultiplier',
  'restrictions',
  'solutions',
  'timeToZeroBonus',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isLiveQuizQuestionType(
  type: string
): type is LiveQuizQuestionType {
  return LIVE_QUIZ_QUESTION_TYPES.some((candidate) => candidate === type)
}

export function parseCorrelatedResponseInstanceInfo(
  value: unknown
): CorrelatedResponseInstanceInfo | null {
  if (
    !isRecord(value) ||
    typeof value.type !== 'string' ||
    !isLiveQuizQuestionType(value.type) ||
    typeof value.blockExecution !== 'string' ||
    typeof value.sessionBlockId !== 'string'
  ) {
    return null
  }

  const common: CommonCorrelatedResponseInstanceInfo = {
    type: value.type,
    blockExecution: value.blockExecution,
    sessionBlockId: value.sessionBlockId,
  }
  for (const field of OPTIONAL_STRING_FIELDS) {
    const fieldValue = value[field]
    if (typeof fieldValue === 'string') {
      common[field] = fieldValue
    }
  }

  switch (value.type) {
    case 'SC':
    case 'MC':
    case 'KPRIM':
      return typeof value.choiceCount === 'string'
        ? { ...common, type: value.type, choiceCount: value.choiceCount }
        : null
    case 'SELECTION':
      return typeof value.numberOfInputs === 'string' &&
        typeof value.selectionAnswerIds === 'string'
        ? {
            ...common,
            type: value.type,
            numberOfInputs: value.numberOfInputs,
            selectionAnswerIds: value.selectionAnswerIds,
          }
        : null
    case 'CASE_STUDY':
      return typeof value.caseStudyResponseShape === 'string'
        ? {
            ...common,
            type: value.type,
            caseStudyResponseShape: value.caseStudyResponseShape,
          }
        : null
    case 'NUMERICAL':
    case 'FREE_TEXT':
    case 'CONTENT':
      return { ...common, type: value.type }
  }
}
