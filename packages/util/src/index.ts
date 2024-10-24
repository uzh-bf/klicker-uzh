import {
  type Element,
  ElementInstanceType as PrismaElementInstanceType,
  ElementType as PrismaElementType,
} from '@klicker-uzh/prisma'
import {
  type AllElementTypeData,
  type AllQuestionTypeData,
  type ElementInstanceResults,
  type ElementKeys,
} from '@klicker-uzh/types'
import { pick } from 'remeda'

const RELEVANT_KEYS: ElementKeys[] = [
  'name',
  'content',
  'explanation',
  'pointsMultiplier',
  'type',
  'options',
]

export function processQuestionData(
  question: Element
): AllQuestionTypeData | null {
  if (
    question.type === PrismaElementType.SC ||
    question.type === PrismaElementType.MC ||
    question.type === PrismaElementType.KPRIM ||
    question.type === PrismaElementType.NUMERICAL ||
    question.type === PrismaElementType.FREE_TEXT
  ) {
    return {
      ...pick(question, RELEVANT_KEYS),
      id: `${question.id}-v${question.version}`,
      questionId: question.id,
    } as AllQuestionTypeData
  }
  return null
}

// save custom type
const CONTENT_KEYS: ElementKeys[] = [
  'name',
  'content',
  'type',
  'pointsMultiplier',
]
const FLASHCARD_KEYS: ElementKeys[] = [
  'name',
  'content',
  'explanation',
  'type',
  'pointsMultiplier',
]
const QUESTION_KEYS: ElementKeys[] = [
  'name',
  'content',
  'explanation',
  'pointsMultiplier',
  'type',
  'options',
]

export function processElementData(element: Element): AllElementTypeData {
  if (element.type === PrismaElementType.FLASHCARD) {
    return {
      ...pick(element, FLASHCARD_KEYS),
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else if (
    element.type === PrismaElementType.SC ||
    element.type === PrismaElementType.MC ||
    element.type === PrismaElementType.KPRIM ||
    element.type === PrismaElementType.NUMERICAL ||
    element.type === PrismaElementType.FREE_TEXT
  ) {
    return {
      ...pick(element, QUESTION_KEYS),
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else if (element.type === PrismaElementType.CONTENT) {
    return {
      ...pick(element, CONTENT_KEYS),
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else {
    throw new Error(
      'Invalid element type encountered during element data processing'
    )
  }
}

export function getInitialElementResults(
  element: Element
): ElementInstanceResults {
  if (element.type === PrismaElementType.FLASHCARD) {
    return {
      INCORRECT: 0,
      PARTIAL: 0,
      CORRECT: 0,
      total: 0,
    }
  } else if (
    element.type === PrismaElementType.SC ||
    element.type === PrismaElementType.MC ||
    element.type === PrismaElementType.KPRIM
  ) {
    const choices = element.options.choices.reduce(
      (acc: Record<string, number>, _: any, ix: number) => ({
        ...acc,
        [ix]: 0,
      }),
      {}
    )
    return { choices, total: 0 }
  } else if (
    element.type === PrismaElementType.NUMERICAL ||
    element.type === PrismaElementType.FREE_TEXT
  ) {
    return {
      responses: {},
      total: 0,
    }
  } else if (element.type === PrismaElementType.CONTENT) {
    return {
      total: 0,
    }
  } else {
    throw new Error(
      'Invalid element type encountered during result initialization'
    )
  }
}

export function getInitialInstanceStatistics(type: PrismaElementInstanceType) {
  if (type === PrismaElementInstanceType.LIVE_QUIZ) {
    return undefined
  } else if (type === PrismaElementInstanceType.PRACTICE_QUIZ) {
    return {
      anonymousCorrectCount: 0,
      anonymousPartialCorrectCount: 0,
      anonymousWrongCount: 0,

      correctCount: 0,
      partialCorrectCount: 0,
      wrongCount: 0,
      firstCorrectCount: 0,
      firstPartialCorrectCount: 0,
      firstWrongCount: 0,
      lastCorrectCount: 0,
      lastPartialCorrectCount: 0,
      lastWrongCount: 0,

      upvoteCount: 0,
      downvoteCount: 0,

      uniqueParticipantCount: 0,
      averageTimeSpent: 0,
    }
  } else if (type === PrismaElementInstanceType.MICROLEARNING) {
    return {
      anonymousCorrectCount: 0,
      anonymousPartialCorrectCount: 0,
      anonymousWrongCount: 0,

      correctCount: 0,
      partialCorrectCount: 0,
      wrongCount: 0,

      upvoteCount: 0,
      downvoteCount: 0,

      uniqueParticipantCount: 0,
      averageTimeSpent: 0,
    }
  } else if (type === PrismaElementInstanceType.GROUP_ACTIVITY) {
    return {
      // correct counts are currently only set on group activity instance
      correctCount: -1,
      partialCorrectCount: -1,
      wrongCount: -1,

      upvoteCount: 0,
      downvoteCount: 0,

      uniqueParticipantCount: -1, // participant counts not available on group activities at the moment, group counts should be available from number of instances immediately
      averageTimeSpent: -1, // time tracking not available on group activities at the moment
    }
  }

  return undefined
}
