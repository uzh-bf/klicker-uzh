import {
  ElementOrderType,
  ElementType,
  PublicationStatus,
  UserRole,
  type Course,
  type ElementInstance,
  type ElementStack,
  type PracticeQuiz,
  type PrismaClient,
  type QuestionResponse,
} from '@klicker-uzh/prisma/client'
import type {
  CaseStudyCriterionLabels,
  ElementData,
  ElementOptionsAnswerCollection,
  ElementOptionsAnswerCollectionEntry,
  ElementOptionsCaseStudy,
  ElementOptionsChoices,
  ElementOptionsFreeText,
  ElementOptionsNumerical,
  ElementOptionsSelection,
  NumericalRestrictions,
} from '@klicker-uzh/types'

type PracticeQuizUser =
  | {
      role?: UserRole | null
      sub: string
    }
  | null
  | undefined

type ElementResponseOrdering = Pick<
  QuestionResponse,
  'correctCount' | 'correctCountStreak' | 'lastCorrectAt' | 'nextDueAt'
>

type PracticeQuizElementSource = Pick<
  ElementInstance,
  'elementData' | 'elementType' | 'id' | 'type'
> & {
  responses?: ElementResponseOrdering[] | null
}

type PracticeQuizStackSource = Pick<
  ElementStack,
  'description' | 'displayName' | 'id' | 'order' | 'type'
> & {
  elements?: PracticeQuizElementSource[] | null
}

type PracticeQuizSource = Pick<
  PracticeQuiz,
  | 'availableFrom'
  | 'description'
  | 'displayName'
  | 'id'
  | 'name'
  | 'orderType'
  | 'ownerId'
  | 'pointsMultiplier'
  | 'resetTimeDays'
  | 'status'
> & {
  course: Pick<Course, 'color' | 'displayName' | 'id'>
  numOfStacks?: number | null
  stacks?: PracticeQuizStackSource[] | null
}

type ElementDataBase = {
  basePoints: boolean
  content: string
  elementId: number
  explanation?: string | null
  id: string
  name: string
  pointsMultiplier: number
  type: ElementType
}

type ElementOptionFlag = boolean | null | undefined

type ElementOptionsAnswerCollectionEntryDto = Pick<
  ElementOptionsAnswerCollectionEntry,
  'id' | 'value'
>

type ElementOptionsAnswerCollectionDto = Pick<
  ElementOptionsAnswerCollection,
  'id'
> & {
  entries: ElementOptionsAnswerCollectionEntryDto[]
}

type PracticeQuizChoicesElementData = ElementDataBase & {
  __typename: 'ChoicesElementData'
  options: {
    choices: Pick<ElementOptionsChoices['choices'][number], 'ix' | 'value'>[]
    displayMode: ElementOptionsChoices['displayMode']
    hasSampleSolution?: ElementOptionFlag
  }
}

type PracticeQuizNumericalElementData = ElementDataBase & {
  __typename: 'NumericalElementData'
  options: {
    accuracy?: number | null
    hasSampleSolution?: ElementOptionFlag
    placeholder?: string | null
    restrictions?: NumericalRestrictions | null
    unit?: string | null
  }
}

type PracticeQuizFreeTextElementData = ElementDataBase & {
  __typename: 'FreeTextElementData'
  options: {
    hasSampleSolution?: ElementOptionFlag
    restrictions?: ElementOptionsFreeText['restrictions'] | null
  }
}

type PracticeQuizSelectionElementData = ElementDataBase & {
  __typename: 'SelectionElementData'
  options: {
    answerCollection?: ElementOptionsAnswerCollectionDto | null
    hasSampleSolution?: ElementOptionFlag
    numberOfInputs?: number | null
  }
}

type PracticeQuizCaseStudyElementData = ElementDataBase & {
  __typename: 'CaseStudyElementData'
  options: {
    cases: Pick<
      ElementOptionsCaseStudy['cases'][number],
      'description' | 'id' | 'title'
    >[]
    criteria: (Pick<
      ElementOptionsCaseStudy['criteria'][number],
      'id' | 'max' | 'min' | 'name' | 'step' | 'unit'
    > & {
      labels?: CaseStudyCriterionLabels | null
    })[]
    hasSampleSolution?: ElementOptionFlag
    items?: ElementOptionsAnswerCollectionEntryDto[] | null
  }
}

type PracticeQuizFlashcardElementData = ElementDataBase & {
  __typename: 'FlashcardElementData'
}

type PracticeQuizContentElementData = ElementDataBase & {
  __typename: 'ContentElementData'
}

export type PracticeQuizElementDataWithoutSolutions =
  | PracticeQuizCaseStudyElementData
  | PracticeQuizChoicesElementData
  | PracticeQuizContentElementData
  | PracticeQuizFlashcardElementData
  | PracticeQuizFreeTextElementData
  | PracticeQuizNumericalElementData
  | PracticeQuizSelectionElementData

export type PracticeQuizDetail = Omit<
  PracticeQuizSource,
  'course' | 'numOfStacks' | 'ownerId' | 'stacks'
> & {
  __typename: 'PracticeQuiz'
  course: Pick<Course, 'color' | 'displayName' | 'id'> & {
    __typename: 'Course'
  }
  isOwner: boolean
  numOfStacks?: number | null
  stacks: (Pick<
    ElementStack,
    'description' | 'displayName' | 'id' | 'order' | 'type'
  > & {
    __typename: 'ElementStack'
    elements: (Pick<ElementInstance, 'elementType' | 'id' | 'type'> & {
      __typename: 'ElementInstance'
      elementData: PracticeQuizElementDataWithoutSolutions
    })[]
  })[]
}

export type PracticeQuizDetailOutput = {
  practiceQuiz: PracticeQuizDetail | null
}

function toElementDataBase(elementData: ElementData): ElementDataBase {
  return {
    id: elementData.id,
    elementId: elementData.elementId,
    name: elementData.name,
    type: elementData.type,
    content: elementData.content,
    explanation: elementData.explanation,
    basePoints: elementData.basePoints,
    pointsMultiplier: elementData.pointsMultiplier,
  }
}

function toAnswerCollection(
  answerCollection: ElementOptionsSelection['answerCollection']
): ElementOptionsAnswerCollectionDto | null {
  if (!answerCollection) return null

  return {
    id: answerCollection.id,
    entries: answerCollection.entries.map((entry) => ({
      id: entry.id,
      value: entry.value,
    })),
  }
}

function toRestrictions(
  restrictions: ElementOptionsNumerical['restrictions']
): NumericalRestrictions | null {
  if (!restrictions) return null

  return {
    min: restrictions.min,
    max: restrictions.max,
  }
}

function toElementDataWithoutSolutions(
  elementData: unknown
): PracticeQuizElementDataWithoutSolutions {
  const data = elementData as ElementData
  const base = toElementDataBase(data)

  switch (data.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM:
      return {
        ...base,
        __typename: 'ChoicesElementData',
        options: {
          hasSampleSolution: data.options.hasSampleSolution,
          displayMode: data.options.displayMode,
          choices: data.options.choices.map((choice) => ({
            ix: choice.ix,
            value: choice.value,
          })),
        },
      }

    case ElementType.NUMERICAL:
      return {
        ...base,
        __typename: 'NumericalElementData',
        options: {
          hasSampleSolution: data.options.hasSampleSolution,
          accuracy: data.options.accuracy,
          placeholder: data.options.placeholder,
          unit: data.options.unit,
          restrictions: toRestrictions(data.options.restrictions),
        },
      }

    case ElementType.FREE_TEXT:
      return {
        ...base,
        __typename: 'FreeTextElementData',
        options: {
          hasSampleSolution: data.options.hasSampleSolution,
          restrictions: data.options.restrictions
            ? {
                maxLength: data.options.restrictions.maxLength,
              }
            : null,
        },
      }

    case ElementType.SELECTION:
      return {
        ...base,
        __typename: 'SelectionElementData',
        options: {
          hasSampleSolution: data.options.hasSampleSolution,
          numberOfInputs: data.options.numberOfInputs,
          answerCollection: toAnswerCollection(data.options.answerCollection),
        },
      }

    case ElementType.CASE_STUDY:
      return {
        ...base,
        __typename: 'CaseStudyElementData',
        options: {
          hasSampleSolution: data.options.hasSampleSolution,
          items:
            data.options.items?.map((item) => ({
              id: item.id,
              value: item.value,
            })) ?? null,
          criteria: data.options.criteria.map((criterion) => ({
            id: criterion.id,
            name: criterion.name,
            min: criterion.min,
            max: criterion.max,
            step: criterion.step,
            unit: criterion.unit,
            labels: criterion.labels
              ? {
                  min: criterion.labels.min,
                  mid: criterion.labels.mid,
                  max: criterion.labels.max,
                }
              : null,
          })),
          cases: data.options.cases.map((caseItem) => ({
            id: caseItem.id,
            title: caseItem.title,
            description: caseItem.description,
          })),
        },
      }

    case ElementType.FLASHCARD:
      return {
        ...base,
        __typename: 'FlashcardElementData',
      }

    case ElementType.CONTENT:
      return {
        ...base,
        __typename: 'ContentElementData',
      }
  }
}

function toPracticeQuizStack(stack: PracticeQuizStackSource) {
  return {
    __typename: 'ElementStack' as const,
    id: stack.id,
    type: stack.type,
    displayName: stack.displayName,
    description: stack.description,
    order: stack.order,
    elements:
      stack.elements?.map((element) => ({
        __typename: 'ElementInstance' as const,
        id: element.id,
        type: element.type,
        elementType: element.elementType,
        elementData: toElementDataWithoutSolutions(element.elementData),
      })) ?? [],
  }
}

function toPracticeQuizDetail({
  isOwner,
  quiz,
}: {
  isOwner: boolean
  quiz: PracticeQuizSource
}): PracticeQuizDetail {
  return {
    __typename: 'PracticeQuiz',
    id: quiz.id,
    status: quiz.status,
    name: quiz.name,
    displayName: quiz.displayName,
    description: quiz.description,
    pointsMultiplier: quiz.pointsMultiplier,
    resetTimeDays: quiz.resetTimeDays,
    availableFrom: quiz.availableFrom,
    orderType: quiz.orderType,
    numOfStacks: quiz.numOfStacks,
    isOwner,
    course: {
      __typename: 'Course',
      id: quiz.course.id,
      displayName: quiz.course.displayName,
      color: quiz.course.color,
    },
    stacks: quiz.stacks?.map(toPracticeQuizStack) ?? [],
  }
}

function getStackResponses(stack: PracticeQuizStackSource) {
  return (
    stack.elements
      ?.flatMap((element) => element.responses ?? [])
      .filter((response): response is ElementResponseOrdering => !!response) ??
    []
  )
}

function findEarliestDueDate(responses: ElementResponseOrdering[]) {
  if (responses.length === 0) return null

  const now = new Date()
  return responses.reduce<Date | null>((earliest, response) => {
    const dueDate = response.nextDueAt ?? now

    if (!earliest || dueDate < earliest) return dueDate
    return earliest
  }, null)
}

function compareStacks(
  stackA: PracticeQuizStackSource,
  stackB: PracticeQuizStackSource
) {
  const stackAResponses = getStackResponses(stackA)
  const stackBResponses = getStackResponses(stackB)

  if (stackAResponses.length === 0 && stackBResponses.length === 0) return 0
  if (stackAResponses.length === 0) return -1
  if (stackBResponses.length === 0) return 1

  const stackAEarliestDueDate = findEarliestDueDate(stackAResponses)
  const stackBEarliestDueDate = findEarliestDueDate(stackBResponses)

  if (!stackAEarliestDueDate) return -1
  if (!stackBEarliestDueDate) return 1
  if (stackAEarliestDueDate < stackBEarliestDueDate) return -1
  if (stackAEarliestDueDate > stackBEarliestDueDate) return 1

  const stackAResponse = stackAResponses[0]!
  const stackBResponse = stackBResponses[0]!

  if (stackAResponse.correctCountStreak < stackBResponse.correctCountStreak) {
    return -1
  }
  if (stackAResponse.correctCountStreak > stackBResponse.correctCountStreak) {
    return 1
  }

  if (stackAResponse.correctCount < stackBResponse.correctCount) return -1
  if (stackAResponse.correctCount > stackBResponse.correctCount) return 1

  if (!stackAResponse.lastCorrectAt || !stackBResponse.lastCorrectAt) return 0
  if (stackAResponse.lastCorrectAt < stackBResponse.lastCorrectAt) return -1
  if (stackAResponse.lastCorrectAt > stackBResponse.lastCorrectAt) return 1

  return 0
}

function orderPracticeQuizStacks(stacks: PracticeQuizStackSource[]) {
  return [...stacks].sort(compareStacks)
}

export async function getPracticeQuizDetail({
  id,
  prisma,
  user,
}: {
  id: string
  prisma: PrismaClient
  user?: PracticeQuizUser
}): Promise<PracticeQuizDetailOutput> {
  const participantId =
    user?.role === UserRole.PARTICIPANT ? user.sub : undefined
  const userId = user?.sub

  const quiz = await prisma.practiceQuiz.findUnique({
    where: {
      id,
      OR: [
        { status: PublicationStatus.PUBLISHED, isDeleted: false },
        { status: PublicationStatus.SCHEDULED },
        ...(userId ? [{ permissions: { some: { userId } } }] : []),
      ],
    },
    select: {
      id: true,
      status: true,
      name: true,
      displayName: true,
      description: true,
      pointsMultiplier: true,
      resetTimeDays: true,
      availableFrom: true,
      orderType: true,
      ownerId: true,
      course: {
        select: {
          id: true,
          displayName: true,
          color: true,
        },
      },
      stacks: {
        orderBy: {
          order: 'asc',
        },
        select: {
          id: true,
          type: true,
          displayName: true,
          description: true,
          order: true,
          elements: {
            orderBy: {
              order: 'asc',
            },
            select: {
              id: true,
              type: true,
              elementType: true,
              elementData: true,
              ...(participantId
                ? {
                    responses: {
                      where: {
                        participantId,
                      },
                      select: {
                        correctCount: true,
                        correctCountStreak: true,
                        lastCorrectAt: true,
                        nextDueAt: true,
                      },
                    },
                  }
                : {}),
            },
          },
        },
      },
    },
  })

  if (!quiz) return { practiceQuiz: null }

  const isOwner =
    user?.sub &&
    (user.role === UserRole.USER || user.role === UserRole.ADMIN) &&
    user.sub === quiz.ownerId
      ? true
      : false

  if (quiz.status === PublicationStatus.SCHEDULED && !isOwner) {
    return {
      practiceQuiz: toPracticeQuizDetail({
        isOwner,
        quiz: {
          ...quiz,
          numOfStacks: null,
          stacks: [],
        },
      }),
    }
  }

  const stacks =
    participantId && quiz.orderType === ElementOrderType.SPACED_REPETITION
      ? orderPracticeQuizStacks(quiz.stacks)
      : quiz.stacks

  return {
    practiceQuiz: toPracticeQuizDetail({
      isOwner,
      quiz: {
        ...quiz,
        numOfStacks: participantId ? stacks.length : null,
        stacks,
      },
    }),
  }
}
