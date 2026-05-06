import prisma from '@klicker-uzh/prisma'
import type {
  PersistedGraphQLClient,
  SubmitStackAnswerInput,
} from './graphqlClient.js'
import type { ElementData, PracticeQuiz, PracticeStack } from './types.js'

export type ChatbotCourseAccessInput = {
  chatbotId: string
  courseId: string
  participantId: string
}

export interface StudentPracticeBackend {
  assertChatbotCourseAccess(input: ChatbotCourseAccessInput): Promise<void>
  getCoursePracticeQuiz(
    courseId: string,
    participantId: string
  ): Promise<PracticeQuiz | null>
  submitStackAnswer(
    input: SubmitStackAnswerInput,
    bearerToken: string
  ): Promise<unknown>
}

type ResponseForOrdering = {
  correctCount: number
  correctCountStreak: number
  lastCorrectAt: Date | null
  nextDueAt: Date | null
}

type StackForOrdering = {
  elements: Array<{
    responses: ResponseForOrdering[]
  }>
}

function findEarliestDueDate(
  responses: ResponseForOrdering[],
  fallbackDueAt: Date
): Date | null {
  return responses.reduce<Date | null>((earliest, response) => {
    const nextDueAt = response.nextDueAt ?? fallbackDueAt
    if (!earliest || nextDueAt < earliest) return nextDueAt
    return earliest
  }, null)
}

function responsesForStack(stack: StackForOrdering): ResponseForOrdering[] {
  return stack.elements.flatMap((element) => element.responses)
}

function orderPracticeStacks<T extends StackForOrdering>(stacks: T[]): T[] {
  const fallbackDueAt = new Date()

  return [...stacks].sort((stackA, stackB) => {
    const stackAResponses = responsesForStack(stackA)
    const stackBResponses = responsesForStack(stackB)

    if (stackAResponses.length === 0 && stackBResponses.length === 0) return 0
    if (stackAResponses.length === 0) return -1
    if (stackBResponses.length === 0) return 1

    const aEarliestDueDate = findEarliestDueDate(stackAResponses, fallbackDueAt)
    const bEarliestDueDate = findEarliestDueDate(stackBResponses, fallbackDueAt)

    if (!aEarliestDueDate && !bEarliestDueDate) return 0
    if (!aEarliestDueDate) return -1
    if (!bEarliestDueDate) return 1
    if (aEarliestDueDate < bEarliestDueDate) return -1
    if (aEarliestDueDate > bEarliestDueDate) return 1

    const aResponse = stackAResponses[0]
    const bResponse = stackBResponses[0]
    if (!aResponse || !bResponse) return 0

    if (aResponse.correctCountStreak < bResponse.correctCountStreak) return -1
    if (aResponse.correctCountStreak > bResponse.correctCountStreak) return 1
    if (aResponse.correctCount < bResponse.correctCount) return -1
    if (aResponse.correctCount > bResponse.correctCount) return 1
    if (!aResponse.lastCorrectAt || !bResponse.lastCorrectAt) return 0
    if (aResponse.lastCorrectAt < bResponse.lastCorrectAt) return -1
    if (aResponse.lastCorrectAt > bResponse.lastCorrectAt) return 1
    return 0
  })
}

function toPracticeStack(stack: {
  description: string | null
  displayName: string | null
  elements: Array<{
    elementData: unknown
    elementType: string
    id: number
    type: string
  }>
  id: number
  order: number
  type: string
}): PracticeStack {
  return {
    description: stack.description,
    displayName: stack.displayName,
    elements: stack.elements.map((element) => ({
      elementData: element.elementData as ElementData,
      elementType: element.elementType,
      id: element.id,
      type: element.type,
    })),
    id: stack.id,
    order: stack.order,
    type: stack.type,
  }
}

export class StudentBackend implements StudentPracticeBackend {
  constructor(private readonly graphql: PersistedGraphQLClient) {}

  async assertChatbotCourseAccess({
    chatbotId,
    courseId,
    participantId,
  }: ChatbotCourseAccessInput): Promise<void> {
    const [chatbot, participation] = await Promise.all([
      prisma.chatbot.findFirst({
        select: { id: true },
        where: { courseId, id: chatbotId },
      }),
      prisma.participation.findUnique({
        select: { id: true, isActive: true },
        where: {
          courseId_participantId: {
            courseId,
            participantId,
          },
        },
      }),
    ])

    if (!chatbot) {
      throw new Error('Chatbot is not assigned to this course')
    }

    if (!participation?.isActive) {
      throw new Error('Participant is not enrolled in this course')
    }
  }

  async getCoursePracticeQuiz(
    courseId: string,
    participantId: string
  ): Promise<PracticeQuiz | null> {
    const course = await prisma.course.findUnique({
      select: {
        displayName: true,
        elementStacks: {
          include: {
            elements: {
              include: {
                responses: {
                  select: {
                    correctCount: true,
                    correctCountStreak: true,
                    lastCorrectAt: true,
                    nextDueAt: true,
                  },
                  where: {
                    participantId,
                  },
                },
              },
              orderBy: {
                order: 'asc',
              },
            },
          },
          orderBy: {
            order: 'asc',
          },
        },
        id: true,
        name: true,
      },
      where: { id: courseId },
    })

    if (!course) return null

    return {
      displayName: course.displayName,
      id: course.id,
      name: course.name,
      stacks: orderPracticeStacks(course.elementStacks).map(toPracticeStack),
    }
  }

  async submitStackAnswer(
    input: SubmitStackAnswerInput,
    bearerToken: string
  ): Promise<unknown> {
    return this.graphql.submitStackAnswer(input, bearerToken)
  }
}
