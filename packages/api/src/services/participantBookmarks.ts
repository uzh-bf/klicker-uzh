import type { PrismaClient } from '@klicker-uzh/prisma/client'

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
