import {
  type AnswerCollectionEntry,
  type Element,
  type ElementInstance,
  ElementType,
  ElementInstanceType as PrismaElementInstanceType,
  ElementType as PrismaElementType,
} from '@klicker-uzh/prisma/client'
import {
  type Choice,
  type CodeElementData,
  type ElementData,
  type ElementInstanceInput,
  type ElementInstanceResults,
  type ElementKeys,
  type ElementOptionsCaseStudy,
  type ElementOptionsChoices,
  type ElementOptionsCode,
  type ElementOptionsFreeText,
  type ElementOptionsNumerical,
  type ElementOptionsSelection,
  type ElementResultsCaseStudy,
  type ElementResultsCode,
  type ParticipantElementData,
} from '@klicker-uzh/types'
import { pick } from 'remeda'

// save custom type
const CONTENT_KEYS: ElementKeys[] = [
  'name',
  'content',
  'type',
  'basePoints',
  'pointsMultiplier',
]
const NO_OPTIONS_KEYS: ElementKeys[] = [
  'name',
  'content',
  'explanation',
  'basePoints',
  'pointsMultiplier',
]
const QUESTION_KEYS: ElementKeys[] = [
  'name',
  'content',
  'explanation',
  'basePoints',
  'pointsMultiplier',
  'options',
]

export type ElementWithAnswerCollection = Element & {
  answerCollection?: { id: number; entries: AnswerCollectionEntry[] } | null
  answerCollectionItems?: AnswerCollectionEntry[] | null
}

export function sanitizeElementDataForParticipant(
  elementData: CodeElementData
): Extract<ParticipantElementData, { type: 'CODE' }>
export function sanitizeElementDataForParticipant(
  elementData: ElementData
): ParticipantElementData
export function sanitizeElementDataForParticipant(
  elementData: ElementData
): ParticipantElementData {
  if (elementData.type !== PrismaElementType.CODE) {
    return elementData
  }

  const codeElementData = elementData as CodeElementData
  return {
    ...codeElementData,
    options: {
      language: codeElementData.options.language,
      starterCode: codeElementData.options.starterCode,
      entrypoint: codeElementData.options.entrypoint,
      executionLimits: codeElementData.options.executionLimits,
      testCases: codeElementData.options.testCases
        .filter((testCase) => testCase.visibility === 'public')
        .map(({ id, name, args, expectedOutput }) => ({
          id,
          name,
          args,
          expectedOutput,
        })),
    },
  }
}

export function processElementData(
  element: ElementWithAnswerCollection
): ElementData {
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
  } else if (element.type === PrismaElementType.CODE) {
    return {
      ...pick(element, QUESTION_KEYS),
      type: element.type,
      options: element.options as ElementOptionsCode,
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
      } as ElementOptionsSelection,
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
    const caseStudyItems = element.answerCollection.entries.flatMap(
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
        answerCollectionId: element.answerCollection.id,
        items: caseStudyItems,
      } as ElementOptionsCaseStudy,
    }
  } else {
    throw new Error(
      'Invalid element type encountered during element data processing'
    )
  }
}

export function getInitialInstanceResults(
  elementData: ElementData
): ElementInstanceResults {
  if (elementData.type === PrismaElementType.FLASHCARD) {
    return {
      INCORRECT: 0,
      PARTIAL: 0,
      CORRECT: 0,
      total: 0,
    }
  } else if (
    (elementData.type === PrismaElementType.SC ||
      elementData.type === PrismaElementType.MC ||
      elementData.type === PrismaElementType.KPRIM) &&
    'choices' in elementData.options
  ) {
    const choices = elementData.options.choices.reduce(
      (acc: Record<string, number>, choice: Choice) => ({
        ...acc,
        [choice.ix]: 0,
      }),
      {}
    )
    return { choices, total: 0 }
  } else if (
    elementData.type === PrismaElementType.NUMERICAL ||
    elementData.type === PrismaElementType.FREE_TEXT
  ) {
    return {
      responses: {},
      total: 0,
    }
  } else if (elementData.type === PrismaElementType.CODE) {
    const tests: ElementResultsCode['tests'] = {}
    elementData.options.testCases.forEach((testCase) => {
      tests[testCase.id] = { passed: 0, total: 0 }
    })

    return {
      tests,
      submissions: {},
      total: 0,
    }
  } else if (elementData.type === PrismaElementType.CONTENT) {
    return {
      total: 0,
    }
  } else if (elementData.type === PrismaElementType.SELECTION) {
    if (
      !('answerCollection' in elementData.options) ||
      !elementData.options.answerCollection ||
      !('entries' in elementData.options.answerCollection)
    ) {
      throw new Error(
        'Answer collection missing for selection element data during result initialization'
      )
    }

    const selections: Record<number, number> = {}
    for (const entry of elementData.options.answerCollection.entries) {
      selections[entry.id] = 0
    }

    return {
      selections,
      total: 0,
    }
  } else if (elementData.type === PrismaElementType.CASE_STUDY) {
    // verify that both the selected items from the answer collection are available
    if (
      !('items' in elementData.options) ||
      !elementData.options.items ||
      elementData.options.items.length === 0 ||
      !('criteria' in elementData.options) ||
      !('cases' in elementData.options)
    ) {
      throw new Error(
        'Selected items missing for case study element during result initialization'
      )
    }

    const assessments: ElementResultsCaseStudy['assessments'] = {}
    const options = elementData.options as ElementOptionsCaseStudy
    const itemIds = elementData.options.items.map((item) => item.id)

    // initialize all cases, their items and criteria as empty maps
    options.cases.forEach((caseItem) => {
      if (
        caseItem.id === '__proto__' ||
        caseItem.id === 'constructor' ||
        caseItem.id === 'prototype'
      ) {
        throw new Error('Invalid caseItem.id value')
      }

      assessments[caseItem.id] = {}

      itemIds.forEach((itemId) => {
        assessments[caseItem.id]![String(itemId)] = {}

        options.criteria.forEach((criterion) => {
          if (
            criterion.id === '__proto__' ||
            criterion.id === 'constructor' ||
            criterion.id === 'prototype'
          ) {
            throw new Error('Invalid criterion.id value')
          }

          assessments[caseItem.id]![String(itemId)]![criterion.id] = {}
        })
      })
    })

    return {
      assessments,
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

export function getActivityInstanceConnectOrCreate({
  instance,
  instanceType,
  activityMultiplier,
  persistentInstances,
  duplicationInstances,
  elementMap,
  userId,
  additionalInstanceOptions,
}: {
  instance: ElementInstanceInput
  instanceType: PrismaElementInstanceType
  activityMultiplier: number
  persistentInstances: ElementInstance[]
  duplicationInstances: ElementInstance[]
  elementMap: Record<number, Element>
  userId: string
  additionalInstanceOptions?: Record<string, any>
}) {
  // ! Case 1: (edit mode) keep existing instance without modification
  if (instance.existingInstanceId !== null && !instance.duplicateInstance) {
    // verify that the instance is well-defined and will be connected
    if (
      !persistentInstances.find((i) => i.id === instance.existingInstanceId)
    ) {
      throw new Error('Instance that was required for connection not found')
    }

    return {
      where: { id: instance.existingInstanceId },
      // dummy content - case should never occur
      create: {
        elementType: ElementType.SC,
        order: instance.order,
        type: instanceType,
        elementData: {} as ElementData,
        options: {},
        results: {} as ElementInstanceResults,
        anonymousResults: {} as ElementInstanceResults,
        instanceStatistics: undefined,
        element: {
          connect: { id: -1 },
        },
        owner: {
          connect: { id: userId },
        },
      },
    }
  }

  // ! Case 2: (duplication mode) duplicate existing instance and reset results & instance statistics
  else if (instance.existingInstanceId !== null && instance.duplicateInstance) {
    // verify that the instance is well-defined and contained in the ones selected for duplication
    const existingInstance = duplicationInstances.find(
      (i) => i.id === instance.existingInstanceId
    )
    if (!existingInstance) {
      throw new Error('Instance that was required for duplication not found')
    }

    // create new instance based on existing instance (with empty results and empty statistics)
    const initialResults = getInitialInstanceResults(
      existingInstance.elementData
    )
    return {
      where: { id: -1 },
      create: {
        elementType: existingInstance.elementType,
        order: instance.order,
        type: instanceType,
        elementData: existingInstance.elementData,
        options: {
          ...additionalInstanceOptions,
          basePoints: existingInstance.elementData.basePoints,
          pointsMultiplier:
            activityMultiplier * existingInstance.elementData.pointsMultiplier,
        },
        results: initialResults,
        anonymousResults: initialResults,
        instanceStatistics: {
          create: getInitialInstanceStatistics(instanceType),
        },
        element: {
          connect: { id: existingInstance.elementId },
        },
        owner: {
          connect: { id: userId },
        },
      },
    }
  }

  // ! Case 3: (creation / edit) create new instance based on database element
  else {
    const element = elementMap[instance.elementId]!

    // if the element is not found, throw an error
    if (!element) {
      throw new Error(
        'Element that was required for instance creation not found'
      )
    }

    const elementData = processElementData(element)
    const initialResults = getInitialInstanceResults(elementData)

    return {
      where: { id: -1 },
      create: {
        elementType: element.type,
        order: instance.order,
        type: instanceType,
        elementData: elementData,
        options: {
          ...additionalInstanceOptions,
          basePoints: element.basePoints,
          pointsMultiplier: activityMultiplier * element.pointsMultiplier,
        },
        results: initialResults,
        anonymousResults: initialResults,
        instanceStatistics: {
          create: getInitialInstanceStatistics(instanceType),
        },
        element: {
          connect: { id: element.id },
        },
        owner: {
          connect: { id: userId },
        },
      },
    }
  }
}
