import type { ReadonlyPrismaClient } from './readonlyPrisma.js'

export const CORRECTION_HEADERS = [
  'correctionId',
  'participantId',
  'email',
  'liveQuizId',
  'liveQuizName',
  'elementInstanceId',
  'elementName',
  'type',
  'reason',
  'studentReason',
  'awardedBasePoints',
  'awardedCorrectnessPoints',
  'awardedBonusPoints',
  'deductedBasePoints',
  'deductedCorrectnessPoints',
  'deductedBonusPoints',
  'createdAt',
]

export async function fetchCorrections(
  prisma: ReadonlyPrismaClient,
  courseId: string
) {
  return prisma.appliedPointCorrection.findMany({
    where: {
      response: {
        instance: {
          elementBlock: {
            liveQuiz: { courseId },
          },
        },
      },
    },
    select: {
      id: true,
      awardedBasePoints: true,
      awardedCorrectnessPoints: true,
      awardedBonusPoints: true,
      deductedBasePoints: true,
      deductedCorrectnessPoints: true,
      deductedBonusPoints: true,
      createdAt: true,
      pointCorrection: {
        select: {
          type: true,
          reason: true,
          studentReason: true,
        },
      },
      response: {
        select: {
          participant: {
            select: { id: true, email: true },
          },
          instance: {
            select: {
              id: true,
              elementData: true,
              elementBlock: {
                select: {
                  liveQuiz: {
                    select: { id: true, displayName: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  })
}

type CorrectionRow = Awaited<ReturnType<typeof fetchCorrections>>[number]

export function transformCorrection(row: CorrectionRow): unknown[] {
  const liveQuiz = row.response.instance.elementBlock?.liveQuiz
  const elementData = row.response.instance.elementData

  return [
    row.id,
    row.response.participant.id,
    row.response.participant.email ?? '',
    liveQuiz?.id ?? '',
    liveQuiz?.displayName ?? '',
    row.response.instance.id,
    elementData.name,
    row.pointCorrection.type,
    row.pointCorrection.reason,
    row.pointCorrection.studentReason,
    row.awardedBasePoints,
    row.awardedCorrectnessPoints,
    row.awardedBonusPoints,
    row.deductedBasePoints,
    row.deductedCorrectnessPoints,
    row.deductedBonusPoints,
    row.createdAt.toISOString(),
  ]
}
