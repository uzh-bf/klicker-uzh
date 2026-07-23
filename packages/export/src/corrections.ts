import type { PointCorrectionType } from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'

import { type PiiContext, FULL_PII, applyPii } from './pii.js'
import type { ReadonlyPrismaClient } from './readonlyPrisma.js'

export const CORRECTION_HEADERS = [
  'correctionId',
  'liveQuizResponseId',
  'elementBlockExecution',
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

type CorrectionRow = {
  id: number
  awardedBasePoints: number
  awardedCorrectnessPoints: number
  awardedBonusPoints: number
  deductedBasePoints: number
  deductedCorrectnessPoints: number
  deductedBonusPoints: number
  createdAt: Date
  pointCorrection: {
    type: PointCorrectionType
    reason: string
    studentReason: string
  }
  response: {
    id: number
    elementBlockExecution: number
    participant: { id: string; email: string | null }
    instance: {
      id: number
      elementData: ElementData
      elementBlock: {
        liveQuiz: { id: string; name: string; displayName: string | null }
      } | null
    }
  }
}

export async function fetchCorrections(
  prisma: ReadonlyPrismaClient,
  courseId: string
): Promise<CorrectionRow[]> {
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
          id: true,
          elementBlockExecution: true,
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
                    select: { id: true, name: true, displayName: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: [{ createdAt: 'desc' }],
  }) as Promise<CorrectionRow[]>
}

export function transformCorrection(
  row: CorrectionRow,
  ctx: PiiContext = FULL_PII
): unknown[] {
  const liveQuiz = row.response.instance.elementBlock?.liveQuiz
  const elementData = row.response.instance.elementData

  return [
    row.id,
    row.response.id,
    row.response.elementBlockExecution,
    row.response.participant.id,
    applyPii(row.response.participant.email, ctx),
    liveQuiz?.id ?? '',
    liveQuiz?.displayName ?? liveQuiz?.name ?? '',
    row.response.instance.id,
    elementData.name,
    row.pointCorrection.type,
    row.pointCorrection.reason,
    ctx.mode === 'pseudonymize'
      ? '[redacted]'
      : row.pointCorrection.studentReason,
    row.awardedBasePoints,
    row.awardedCorrectnessPoints,
    row.awardedBonusPoints,
    row.deductedBasePoints,
    row.deductedCorrectnessPoints,
    row.deductedBonusPoints,
    row.createdAt.toISOString(),
  ]
}
