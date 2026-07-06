import type { ReadonlyPrismaClient } from './readonlyPrisma.js'

export const LIVE_QUIZ_HEADERS = [
  'liveQuizId',
  'liveQuizName',
  'liveQuizDisplayName',
  'status',
  'isAssessmentEnabled',
  'isGamificationEnabled',
  'defaultPoints',
  'defaultCorrectPoints',
  'maxBonusPoints',
  'pointsMultiplier',
  'startedAt',
  'finishedAt',
  'createdAt',
  'updatedAt',
]

// 0-based indices of date columns above (consumed by addSheet for xlsx date cells).
export const LIVE_QUIZ_DATE_COLUMNS = [10, 11, 12, 13]

export async function fetchLiveQuizzes(
  prisma: ReadonlyPrismaClient,
  courseId: string
) {
  // No isDeleted/response filter: live quizzes with zero responses are included.
  return prisma.liveQuiz.findMany({
    where: { courseId },
    select: {
      id: true,
      name: true,
      displayName: true,
      status: true,
      isAssessmentEnabled: true,
      isGamificationEnabled: true,
      defaultPoints: true,
      defaultCorrectPoints: true,
      maxBonusPoints: true,
      pointsMultiplier: true,
      startedAt: true,
      finishedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { name: 'asc' },
  })
}

type LiveQuizRow = Awaited<ReturnType<typeof fetchLiveQuizzes>>[number]

export function transformLiveQuiz(row: LiveQuizRow): unknown[] {
  return [
    row.id,
    row.name,
    row.displayName,
    row.status,
    row.isAssessmentEnabled,
    row.isGamificationEnabled,
    row.defaultPoints,
    row.defaultCorrectPoints,
    row.maxBonusPoints,
    row.pointsMultiplier,
    row.startedAt?.toISOString() ?? '',
    row.finishedAt?.toISOString() ?? '',
    row.createdAt.toISOString(),
    row.updatedAt.toISOString(),
  ]
}
