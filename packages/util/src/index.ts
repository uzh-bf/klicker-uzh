import {
  ElementInstanceType,
  ElementType,
  type Element,
} from '@klicker-uzh/prisma'
import { pick } from 'remeda'

const RELEVANT_KEYS = [
  'name',
  'content',
  'explanation',
  'pointsMultiplier',
  'type',
  'options',
] as const

export function processQuestionData(question: Element) {
  return {
    ...pick(question, RELEVANT_KEYS),
    id: `${question.id}-v${question.version}`,
    questionId: question.id,
  }
}

// save custom type
type ElementKeys = keyof Element
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

export function processElementData(element: Element) {
  if (element.type === ElementType.FLASHCARD) {
    return {
      ...pick(element, FLASHCARD_KEYS),
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else if (
    element.type === ElementType.SC ||
    element.type === ElementType.MC ||
    element.type === ElementType.KPRIM ||
    element.type === ElementType.NUMERICAL ||
    element.type === ElementType.FREE_TEXT
  ) {
    return {
      ...pick(element, QUESTION_KEYS),
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else if (element.type === ElementType.CONTENT) {
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
  element: Omit<Element, 'id'> & { id: string }
) {
  if (element.type === ElementType.FLASHCARD) {
    return {
      INCORRECT: 0,
      PARTIAL: 0,
      CORRECT: 0,
      total: 0,
    }
  } else if (
    element.type === ElementType.SC ||
    element.type === ElementType.MC ||
    element.type === ElementType.KPRIM
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
    element.type === ElementType.NUMERICAL ||
    element.type === ElementType.FREE_TEXT
  ) {
    return {
      responses: {},
      total: 0,
    }
  } else if (element.type === ElementType.CONTENT) {
    return {
      total: 0,
    }
  } else {
    throw new Error(
      'Invalid element type encountered during result initialization'
    )
  }
}

export function getInitialInstanceStatistics(type: ElementInstanceType) {
  if (type === ElementInstanceType.LIVE_QUIZ) {
    return undefined
  } else if (type === ElementInstanceType.PRACTICE_QUIZ) {
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
  } else if (type === ElementInstanceType.MICROLEARNING) {
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
  } else if (type === ElementInstanceType.GROUP_ACTIVITY) {
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
