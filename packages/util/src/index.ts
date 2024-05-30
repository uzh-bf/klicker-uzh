import type { Element } from '@klicker-uzh/prisma'
import { ElementType } from '@klicker-uzh/prisma'
import * as R from 'ramda'

const RELEVANT_KEYS = [
  'id',
  'name',
  'content',
  'explanation',
  'pointsMultiplier',
  'type',
  'options',
] as const

const extractRelevantKeys = R.pick<any>(RELEVANT_KEYS)

export function processQuestionData(question: Element) {
  return {
    ...(extractRelevantKeys(question) as Pick<
      Element,
      (typeof RELEVANT_KEYS)[number]
    >),
    id: `${question.id}-v${question.version}`,
    elementId: question.id,
  }
}

const CONTENT_KEYS = ['name', 'content', 'type', 'pointsMultiplier']
const FLASHCARD_KEYS = [
  'name',
  'content',
  'explanation',
  'type',
  'pointsMultiplier',
]
const QUESTION_KEYS = [
  'name',
  'content',
  'explanation',
  'pointsMultiplier',
  'type',
  'options',
]

const extractContentKeys = R.pick<any>(CONTENT_KEYS)
const extractFlashcardKeys = R.pick<any>(FLASHCARD_KEYS)
const extractQuestionKeys = R.pick<any>(QUESTION_KEYS)

// TODO: add union type for return value as pick removes the properties
export function processElementData(element: Element) {
  if (element.type === ElementType.FLASHCARD) {
    return {
      ...extractFlashcardKeys(element),
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
      ...extractQuestionKeys(element),
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else if (element.type === ElementType.CONTENT) {
    return {
      ...extractContentKeys(element),
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else {
    throw new Error(
      'Invalid element type encountered during element data processing'
    )
  }
}

export function getInitialElementResults(element: Element) {
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
