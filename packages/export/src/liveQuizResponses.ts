import type { PrismaClient } from '@klicker-uzh/prisma/client'

export const LIVE_QUIZ_RESPONSE_HEADERS = [
  'participantId',
  'username',
  'email',
  'elementInstanceId',
  'elementType',
  'elementName',
  'elementContent',
  'liveQuizId',
  'liveQuizName',
  'blockId',
  'blockOrder',
  'blockExecution',
  'response',
  'correctness',
  'basePoints',
  'correctnessPoints',
  'bonusPoints',
  'totalPoints',
  'correctionOnly',
  'appliedCorrectionsCount',
  'timeSpent',
  'submittedAt',
  'createdAt',
]

export async function fetchLiveQuizResponses(
  prisma: PrismaClient,
  courseId: string
) {
  return prisma.liveQuizResponse.findMany({
    where: {
      instance: {
        elementBlock: {
          liveQuiz: { courseId },
        },
      },
    },
    select: {
      id: true,
      response: true,
      correctness: true,
      basePoints: true,
      correctnessPoints: true,
      bonusPoints: true,
      timeSpent: true,
      submittedAt: true,
      correctionOnly: true,
      elementBlockExecution: true,
      createdAt: true,
      participant: {
        select: { id: true, username: true, email: true },
      },
      instance: {
        select: {
          id: true,
          elementType: true,
          elementData: true,
          elementBlock: {
            select: {
              id: true,
              order: true,
              liveQuiz: {
                select: { id: true, name: true, displayName: true },
              },
            },
          },
        },
      },
      _count: { select: { appliedCorrections: true } },
    },
    orderBy: [
      { participant: { username: 'asc' } },
      { instance: { elementBlock: { liveQuiz: { name: 'asc' } } } },
      { instance: { elementBlock: { order: 'asc' } } },
      { elementBlockExecution: 'asc' },
      { instance: { order: 'asc' } },
    ],
  })
}

type LiveQuizResponseRow = Awaited<
  ReturnType<typeof fetchLiveQuizResponses>
>[number]

export function transformLiveQuizResponse(row: LiveQuizResponseRow): unknown[] {
  const block = row.instance.elementBlock
  const liveQuiz = block?.liveQuiz
  const elementData = row.instance.elementData

  const basePoints = row.basePoints
  const correctnessPoints = row.correctnessPoints
  const bonusPoints = row.bonusPoints
  const totalPoints = basePoints + correctnessPoints + bonusPoints

  return [
    row.participant.id,
    row.participant.username,
    row.participant.email ?? '',
    row.instance.id,
    row.instance.elementType,
    elementData.name,
    elementData.content.substring(0, 200),
    liveQuiz?.id ?? '',
    liveQuiz?.displayName ?? '',
    block?.id ?? '',
    block?.order ?? '',
    row.elementBlockExecution,
    row.response != null ? JSON.stringify(row.response) : '',
    row.correctness,
    basePoints,
    correctnessPoints,
    bonusPoints,
    totalPoints,
    row.correctionOnly,
    row._count.appliedCorrections,
    row.timeSpent,
    row.submittedAt.toISOString(),
    row.createdAt.toISOString(),
  ]
}
