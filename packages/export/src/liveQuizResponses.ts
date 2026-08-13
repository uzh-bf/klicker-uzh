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

/**
 * Column headers for the responses CSV / RESPONSES sheet.
 *
 * - blockExecution: execution/run index of the enclosing block for this
 *   participant (increments when a block is replayed).
 * - correctionOnly: true when the row was created by a lecturer correction
 *   rather than a real participant submission.
 * - appliedCorrectionsCount: count of point corrections linked to this row.
 *
 * Full untruncated element content lives in the ELEMENT_INSTANCES sheet,
 * joinable via elementInstanceId.
 */
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
  // Type-specific flattened views of `response` so analysts avoid parsing JSON.
  'response_choices',
  'response_value',
  'response_selection',
  'response_assessment',
]

// 0-based index of the single date column above (consumed by addSheet).
// Full untruncated element content lives in the ELEMENT_INSTANCES sheet.
export const LIVE_QUIZ_RESPONSE_DATE_COLUMNS = [21]

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
  participant: { id: string; email: string | null } | null
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
      { respondentId: 'asc' },
      { instance: { elementBlock: { liveQuiz: { name: 'asc' } } } },
      { instance: { elementBlock: { order: 'asc' } } },
      { elementBlockExecution: 'asc' },
      { instance: { order: 'asc' } },
    ],
  }) as Promise<LiveQuizResponseRow[]>
}

function flattenChoices(resp: SingleQuestionResponseLiveQuiz | null): string {
  if (resp != null && 'choices' in resp) {
    return resp.choices
      .filter((c) => c.selected)
      .map((c) => c.ix)
      .join(',')
  }
  return ''
}

function flattenValue(
  resp: SingleQuestionResponseLiveQuiz | null,
  elementType: ElementType,
  ctx: PiiContext
): string {
  if (resp != null && 'value' in resp) {
    // Free-text answers can carry PII; gate them behind pseudonymize mode.
    if (elementType === 'FREE_TEXT' && ctx.mode === 'pseudonymize') {
      return '[redacted]'
    }
    return resp.value
  }
  return ''
}

function flattenSelection(resp: SingleQuestionResponseLiveQuiz | null): string {
  if (resp != null && 'selection' in resp) {
    return resp.selection.join(',')
  }
  return ''
}

// CASE_STUDY assessment is criterion IDs + numeric scores only (structural,
// not personal data), so it is emitted verbatim even in pseudonymize mode. If
// the assessment object ever gains a free-text field, gate it on `ctx` here.
function flattenAssessment(
  resp: SingleQuestionResponseLiveQuiz | null
): string {
  if (resp != null && 'assessment' in resp) {
    return JSON.stringify(resp.assessment)
  }
  return ''
}

export function transformLiveQuizResponse(
  row: LiveQuizResponseRow,
  ctx: PiiContext = FULL_PII
): unknown[] {
  const block = row.instance.elementBlock
  const liveQuiz = block?.liveQuiz
  const elementData = row.instance.elementData

  const totalPoints = row.basePoints + row.correctnessPoints + row.bonusPoints

  return [
    row.id,
    block?.id ?? '',
    block?.order ?? '',
    row.instance.order,
    row.instance.elementId,
    row.participant?.id ?? '',
    applyPii(row.participant?.email ?? null, ctx),
    row.instance.id,
    row.instance.elementType,
    elementData.name,
    liveQuiz?.id ?? '',
    liveQuiz?.displayName ?? liveQuiz?.name ?? '',
    row.elementBlockExecution,
    ctx.mode === 'pseudonymize'
      ? '[redacted]'
      : row.response != null
        ? JSON.stringify(row.response)
        : '',
    row.correctness,
    row.basePoints,
    row.correctnessPoints,
    row.bonusPoints,
    totalPoints,
    row.correctionOnly,
    row._count.appliedCorrections,
    row.submittedAt.toISOString(),
    flattenChoices(row.response),
    flattenValue(row.response, row.instance.elementType, ctx),
    flattenSelection(row.response),
    flattenAssessment(row.response),
  ]
}
