import type {
  ElementType,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import type {
  ElementData,
  SingleQuestionResponseLiveQuiz,
} from '@klicker-uzh/types'

import { type PiiContext, FULL_PII, applyPii } from './pii.js'
import type { ReadonlyPrismaClient } from './readonlyPrisma.js'

export const LIVE_QUIZ_RESPONSE_HEADERS = [
  'liveQuizResponseId',
  'elementBlockId',
  'elementBlockOrder',
  'instanceOrder',
  'elementId',
  'participantId',
  'email',
  'elementInstanceId',
  'elementType',
  'elementName',
  'elementContent',
  'liveQuizId',
  'liveQuizName',
  'blockExecution',
  'response',
  'correctness',
  'basePoints',
  'correctnessPoints',
  'bonusPoints',
  'totalPoints',
  'correctionOnly',
  'appliedCorrectionsCount',
  'submittedAt',
]

type LiveQuizResponseRow = {
  id: number
  response: SingleQuestionResponseLiveQuiz | null
  correctness: ResponseCorrectness
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
  submittedAt: Date
  correctionOnly: boolean
  elementBlockExecution: number
  participant: { id: string; email: string | null }
  instance: {
    id: number
    order: number
    elementId: number
    elementType: ElementType
    elementData: ElementData
    elementBlock: {
      id: number
      order: number
      liveQuiz: { id: string; name: string; displayName: string | null }
    } | null
  }
  _count: { appliedCorrections: number }
}

export async function fetchLiveQuizResponses(
  prisma: ReadonlyPrismaClient,
  courseId: string
): Promise<LiveQuizResponseRow[]> {
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
      submittedAt: true,
      correctionOnly: true,
      elementBlockExecution: true,
      participant: {
        select: { id: true, email: true },
      },
      instance: {
        select: {
          id: true,
          order: true,
          elementId: true,
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
      { participant: { email: 'asc' } },
      { instance: { elementBlock: { liveQuiz: { name: 'asc' } } } },
      { instance: { elementBlock: { order: 'asc' } } },
      { elementBlockExecution: 'asc' },
      { instance: { order: 'asc' } },
    ],
  }) as Promise<LiveQuizResponseRow[]>
}

export function transformLiveQuizResponse(
  row: LiveQuizResponseRow,
  ctx: PiiContext = FULL_PII
): unknown[] {
  const block = row.instance.elementBlock
  const liveQuiz = block?.liveQuiz
  const elementData = row.instance.elementData

  const basePoints = row.basePoints
  const correctnessPoints = row.correctnessPoints
  const bonusPoints = row.bonusPoints
  const totalPoints = basePoints + correctnessPoints + bonusPoints

  return [
    row.id,
    block?.id ?? '',
    block?.order ?? '',
    row.instance.order,
    row.instance.elementId,
    row.participant.id,
    applyPii(row.participant.email, ctx),
    row.instance.id,
    row.instance.elementType,
    elementData.name,
    elementData.content.length > 200
      ? elementData.content.substring(0, 200) + '...'
      : elementData.content,
    liveQuiz?.id ?? '',
    liveQuiz?.displayName ?? liveQuiz?.name ?? '',
    row.elementBlockExecution,
    ctx.mode === 'pseudonymize'
      ? '[redacted]'
      : row.response != null
        ? JSON.stringify(row.response)
        : '',
    row.correctness,
    basePoints,
    correctnessPoints,
    bonusPoints,
    totalPoints,
    row.correctionOnly,
    row._count.appliedCorrections,
    row.submittedAt.toISOString(),
  ]
}
