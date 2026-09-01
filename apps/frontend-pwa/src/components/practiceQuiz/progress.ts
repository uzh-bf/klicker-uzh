import { StackFeedbackStatus } from '@klicker-uzh/graphql/dist/ops'

export type PracticeQuizStackProgress = {
  status: StackFeedbackStatus
  score?: number | null
}

export type PracticeQuizProgressState = Record<
  string,
  PracticeQuizStackProgress
>

export function findFirstUnansweredStack(
  progressState: PracticeQuizProgressState | undefined,
  stackIds: Array<string | number>
): number {
  const firstUnanswered = stackIds.findIndex((stackId) => {
    const status = progressState?.[String(stackId)]?.status
    return !status || status === StackFeedbackStatus.Unanswered
  })

  return firstUnanswered === -1 ? stackIds.length : firstUnanswered
}

export type PracticeQuizCompletionSummary = {
  score: number | null
  answeredCount: number
}

export function summarizePracticeQuizCompletion(
  progressState: PracticeQuizProgressState | undefined,
  stackIds: Array<string | number>
): PracticeQuizCompletionSummary {
  let score: number | null = null
  let answeredCount = 0

  for (const stackId of stackIds) {
    const stackProgress = progressState?.[String(stackId)]
    if (!stackProgress) continue

    if (
      typeof stackProgress.score === 'number' &&
      Number.isFinite(stackProgress.score)
    ) {
      score = (score ?? 0) + stackProgress.score
    }

    if (
      stackProgress.status &&
      stackProgress.status !== StackFeedbackStatus.Unanswered
    ) {
      answeredCount += 1
    }
  }

  return { score, answeredCount }
}
