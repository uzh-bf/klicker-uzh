import {
  ElementType,
  type ElementInstance,
  type ElementStack,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'

type BookmarkedStackElementSource = Pick<
  ElementInstance,
  'elementData' | 'elementType' | 'id' | 'type'
>

type BookmarkedStackSource = Pick<
  ElementStack,
  'description' | 'displayName' | 'id' | 'order' | 'type'
> & {
  elements?: BookmarkedStackElementSource[] | null
}

function getElementDataTypename(elementData: ElementData) {
  switch (elementData.type) {
    case ElementType.SC:
    case ElementType.MC:
    case ElementType.KPRIM:
      return 'ChoicesElementData'
    case ElementType.NUMERICAL:
      return 'NumericalElementData'
    case ElementType.FREE_TEXT:
      return 'FreeTextElementData'
    case ElementType.SELECTION:
      return 'SelectionElementData'
    case ElementType.CASE_STUDY:
      return 'CaseStudyElementData'
    case ElementType.FLASHCARD:
      return 'FlashcardElementData'
    case ElementType.CONTENT:
      return 'ContentElementData'
  }
}

function toBookmarkedElementData(elementData: unknown) {
  const data = elementData as ElementData

  return {
    ...data,
    __typename: getElementDataTypename(data),
  }
}

function toBookmarkedStack(stack: BookmarkedStackSource) {
  return {
    id: stack.id,
    type: stack.type,
    displayName: stack.displayName,
    description: stack.description,
    order: stack.order,
    elements:
      stack.elements?.map((element) => ({
        id: element.id,
        type: element.type,
        elementType: element.elementType,
        elementData: toBookmarkedElementData(element.elementData),
      })) ?? [],
  }
}

export async function getPracticeQuizBookmarks({
  courseId,
  participantId,
  prisma,
  quizId,
}: {
  courseId: string
  participantId: string
  prisma: PrismaClient
  quizId?: string | null
}) {
  const participation = await prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId,
        participantId,
      },
    },
    select: {
      bookmarkedElementStacks: {
        where: {
          practiceQuizId: quizId ?? undefined,
        },
        select: { id: true },
      },
    },
  })

  return participation?.bookmarkedElementStacks.map((stack) => stack.id) ?? null
}

export async function bookmarkElementStack({
  bookmarked,
  courseId,
  participantId,
  prisma,
  stackId,
}: {
  bookmarked: boolean
  courseId: string
  participantId: string
  prisma: PrismaClient
  stackId: number
}) {
  const participation = await prisma.participation.update({
    where: {
      courseId_participantId: { courseId, participantId },
    },
    data: {
      bookmarkedElementStacks: {
        [bookmarked ? 'connect' : 'disconnect']: { id: stackId },
      },
    },
    select: {
      bookmarkedElementStacks: {
        select: { id: true },
      },
    },
  })

  return participation.bookmarkedElementStacks.map((stack) => stack.id)
}

export async function getBookmarksPageData({
  courseId,
  participantId,
  prisma,
}: {
  courseId: string
  participantId: string
  prisma: PrismaClient
}) {
  const [course, participation] = await Promise.all([
    prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        displayName: true,
        description: true,
        color: true,
        owner: {
          select: {
            shortname: true,
          },
        },
      },
    }),
    prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId,
          participantId,
        },
      },
      select: {
        bookmarkedElementStacks: {
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
              },
            },
          },
        },
      },
    }),
  ])

  return {
    course,
    stacks: participation?.bookmarkedElementStacks.map(toBookmarkedStack) ?? [],
  }
}
