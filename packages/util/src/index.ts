import {
  type AnswerCollectionEntry,
  type Element,
  ElementInstanceType as PrismaElementInstanceType,
  ElementType as PrismaElementType,
} from '@klicker-uzh/prisma'
import {
  type AllElementTypeData,
  type Choice,
  type ElementInstanceResults,
  type ElementKeys,
  type ElementOptionsCaseStudy,
  type ElementOptionsChoices,
  type ElementOptionsFreeText,
  type ElementOptionsNumerical,
  type ElementResultsCaseStudy,
} from '@klicker-uzh/types'
import { pick } from 'remeda'

// save custom type
const CONTENT_KEYS: ElementKeys[] = [
  'name',
  'content',
  'type',
  'pointsMultiplier',
]
const NO_OPTIONS_KEYS: ElementKeys[] = [
  'name',
  'content',
  'explanation',
  'pointsMultiplier',
]
const QUESTION_KEYS: ElementKeys[] = [
  'name',
  'content',
  'explanation',
  'pointsMultiplier',
  'options',
]

export type ElementWithAnswerCollection = Element & {
  answerCollection?: { id: number; entries: AnswerCollectionEntry[] } | null
  answerCollectionItems?: AnswerCollectionEntry[] | null
}

export function processElementData(
  element: ElementWithAnswerCollection
): AllElementTypeData {
  if (element.type === PrismaElementType.FLASHCARD) {
    return {
      ...pick(element, NO_OPTIONS_KEYS),
      type: element.type,
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else if (
    element.type === PrismaElementType.SC ||
    element.type === PrismaElementType.MC ||
    element.type === PrismaElementType.KPRIM
  ) {
    return {
      ...pick(element, QUESTION_KEYS),
      type: element.type,
      options: element.options as ElementOptionsChoices,
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else if (element.type === PrismaElementType.NUMERICAL) {
    return {
      ...pick(element, QUESTION_KEYS),
      type: element.type,
      options: element.options as ElementOptionsNumerical,
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else if (element.type === PrismaElementType.FREE_TEXT) {
    return {
      ...pick(element, QUESTION_KEYS),
      type: element.type,
      options: element.options as ElementOptionsFreeText,
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else if (element.type === PrismaElementType.CONTENT) {
    return {
      ...pick(element, CONTENT_KEYS),
      type: element.type,
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
    }
  } else if (
    element.type === PrismaElementType.SELECTION &&
    'hasSampleSolution' in element.options &&
    'numberOfInputs' in element.options
  ) {
    if (
      !element.answerCollection?.entries ||
      (element.options.hasSampleSolution && !element.answerCollectionItems)
    ) {
      throw new Error(
        'Answer collection or solutions missing for selection element'
      )
    }

    // formulate answer collection in the format as it will be required in the element data options
    const answerCollectionOptions = {
      id: element.answerCollection.id,
      entries: element.answerCollection.entries.map((entry) => ({
        id: entry.id,
        value: entry.value,
      })),
    }

    // extract the ids of the correct solution options
    const answerCollectionSolutionIds = element.options.hasSampleSolution
      ? element.answerCollectionItems!.map((entry) => entry.id)
      : []

    return {
      ...pick(element, NO_OPTIONS_KEYS),
      type: element.type,
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
      options: {
        hasSampleSolution: element.options.hasSampleSolution,
        numberOfInputs: element.options.numberOfInputs,
        answerCollection: answerCollectionOptions,
        answerCollectionSolutionIds,
      },
    }
  } else if (element.type === PrismaElementType.CASE_STUDY) {
    // make sure that answer collection and selected items were passed to the function
    if (
      !element.answerCollection ||
      !element.answerCollection.entries ||
      element.answerCollection.entries.length === 0 ||
      !element.answerCollectionItems ||
      element.answerCollectionItems.length === 0
    ) {
      throw new Error(
        'Answer collection or selected items missing for case study element'
      )
    }

    // extract selected items from collection (store only relevant information on instance)
    const selectedItemIds = element.answerCollectionItems.map((item) => item.id)
    const caseStudyItems = element.options.answerCollection.entries.flatMap(
      (entry: AnswerCollectionEntry) => {
        if (selectedItemIds?.includes(entry.id)) {
          return {
            id: entry.id,
            value: entry.value,
          }
        }

        return []
      }
    )

    return {
      ...pick(element, NO_OPTIONS_KEYS),
      type: element.type,
      id: `${element.id}-v${element.version}`,
      elementId: element.id,
      options: {
        ...element.options,
        items: caseStudyItems,
      },
    }
  } else {
    throw new Error(
      'Invalid element type encountered during element data processing'
    )
  }
}

export function getInitialElementResults(
  element: ElementWithAnswerCollection
): ElementInstanceResults {
  // TODO: extend for case study elements
  if (element.type === PrismaElementType.FLASHCARD) {
    return {
      INCORRECT: 0,
      PARTIAL: 0,
      CORRECT: 0,
      total: 0,
    }
  } else if (
    (element.type === PrismaElementType.SC ||
      element.type === PrismaElementType.MC ||
      element.type === PrismaElementType.KPRIM) &&
    'choices' in element.options
  ) {
    const choices = element.options.choices.reduce(
      (acc: Record<string, number>, choice: Choice) => ({
        ...acc,
        [choice.ix]: 0,
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
  } else if (
    element.type === PrismaElementType.SELECTION &&
    'answerCollection' in element &&
    element.answerCollection &&
    'entries' in element.answerCollection
  ) {
    const selections: Record<number, number> = {}
    for (const entry of element.answerCollection.entries) {
      selections[entry.id] = 0
    }

    return {
      selections,
      total: 0,
    }
  } else if (
    element.type === PrismaElementType.CASE_STUDY &&
    'answerCollection' in element.options &&
    'answerCollectionItems' in element.options
  ) {
    // verify that both the selected items from the answer collection are available
    if (
      !element.answerCollectionItems ||
      element.answerCollectionItems.length === 0
    ) {
      throw new Error(
        'Selected items missing for case study element during result initialization'
      )
    }

    const assessment: ElementResultsCaseStudy['assessment'] = {}
    const options = element.options as ElementOptionsCaseStudy
    const itemIds = element.answerCollectionItems.map((item) => item.id)

    // initialize all cases, their items and criteria as empty maps
    options.cases.forEach((caseItem) => {
      assessment[caseItem.id] = {}

      itemIds.forEach((itemId) => {
        assessment[caseItem.id]![String(itemId)] = {}

        options.criteria.forEach((criterion) => {
          assessment[caseItem.id]![String(itemId)]![criterion.id] = {}
        })
      })
    })

    return {
      assessment,
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
