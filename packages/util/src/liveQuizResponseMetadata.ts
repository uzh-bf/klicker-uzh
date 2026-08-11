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

const COMMON_FIELDS = [
  'type',
  'blockExecution',
  'sessionBlockId',
  ...OPTIONAL_STRING_FIELDS,
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(record: Record<string, unknown>, allowed: string[]) {
  return Object.keys(record).every((key) => allowed.includes(key))
}

function hasUniqueValues<T>(values: T[]) {
  return new Set(values).size === values.length
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

  const variantFields =
    value.type === 'SC' || value.type === 'MC' || value.type === 'KPRIM'
      ? ['choiceCount']
      : value.type === 'SELECTION'
        ? ['numberOfInputs', 'selectionAnswerIds']
        : value.type === 'CASE_STUDY'
          ? ['caseStudyResponseShape']
          : []
  if (!hasOnlyKeys(value, [...COMMON_FIELDS, ...variantFields])) {
    return null
  }

  const common: CommonCorrelatedResponseInstanceInfo = {
    type: value.type,
    blockExecution: value.blockExecution,
    sessionBlockId: value.sessionBlockId,
  }
  for (const field of OPTIONAL_STRING_FIELDS) {
    if (field in value) {
      if (typeof value[field] !== 'string') return null
      common[field] = value[field]
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
      if (typeof value.caseStudyResponseShape !== 'string') return null
      try {
        const shape: unknown = JSON.parse(value.caseStudyResponseShape)
        if (
          !isRecord(shape) ||
          !Array.isArray(shape.cases) ||
          !shape.cases.every(
            (entry) => typeof entry === 'string' && entry.length > 0
          ) ||
          !hasUniqueValues(shape.cases) ||
          !Array.isArray(shape.items) ||
          !shape.items.every((entry) => Number.isInteger(entry) && entry > 0) ||
          !hasUniqueValues(shape.items) ||
          !Array.isArray(shape.criteria) ||
          !shape.criteria.every(
            (entry) =>
              isRecord(entry) &&
              typeof entry.id === 'string' &&
              entry.id.length > 0 &&
              typeof entry.min === 'number' &&
              Number.isFinite(entry.min) &&
              typeof entry.max === 'number' &&
              Number.isFinite(entry.max) &&
              entry.min <= entry.max
          ) ||
          !hasUniqueValues(
            shape.criteria.map((entry) =>
              isRecord(entry) && typeof entry.id === 'string' ? entry.id : ''
            )
          )
        ) {
          return null
        }
      } catch {
        return null
      }
      return {
        ...common,
        type: value.type,
        caseStudyResponseShape: value.caseStudyResponseShape,
      }
    case 'NUMERICAL':
    case 'FREE_TEXT':
    case 'CONTENT':
      return { ...common, type: value.type }
  }
}
