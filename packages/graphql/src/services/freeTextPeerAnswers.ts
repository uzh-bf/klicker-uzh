import { normalizeFreeTextAnswer } from '@klicker-uzh/grading'
import type * as DB from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '@/lib/context.js'

const MAX_PEER_ANSWERS = 20

export async function loadFreeTextPeerAnswers({
  elementInstance,
  participantId,
  solutionAuthorized,
  ctx,
}: {
  elementInstance: DB.ElementInstance
  participantId: string
  solutionAuthorized: boolean
  ctx: ContextWithUser
}) {
  if (!solutionAuthorized || !('responses' in elementInstance.results)) {
    return []
  }

  const participantAttempts = await ctx.prisma.freeTextAttempt.findMany({
    where: {
      questionResponseDetailId: { not: null },
      cycle: {
        participantId,
        elementInstanceId: elementInstance.id,
      },
    },
    select: { answer: true },
  })
  const participantAnswerCounts = new Map<string, number>()
  for (const { answer } of participantAttempts) {
    const normalized = normalizeFreeTextAnswer(answer)
    participantAnswerCounts.set(
      normalized,
      (participantAnswerCounts.get(normalized) ?? 0) + 1
    )
  }

  return Object.values(elementInstance.results.responses)
    .map(({ value, count }) => {
      const participantCount =
        participantAnswerCounts.get(normalizeFreeTextAnswer(value)) ?? 0
      return { value, count: Math.max(0, count - participantCount) }
    })
    .filter(({ count }) => count > 0)
    .sort((left, right) => {
      return right.count - left.count || left.value.localeCompare(right.value)
    })
    .slice(0, MAX_PEER_ANSWERS)
}
