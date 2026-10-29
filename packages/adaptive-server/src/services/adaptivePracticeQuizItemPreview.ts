import type { ContextWithUser } from '@klicker-uzh/graphql/adaptive-context-types'
import type { ElementData } from '@klicker-uzh/types'
import { serializeAdaptiveParticipantElement } from './adaptivePracticeQuizRuntime.js'

// The query enforces ADMIN permission on the quiz; scope the item to that quiz too.
export async function getAdaptivePracticeQuizItemPreview(
  {
    practiceQuizId,
    poolItemId,
  }: { practiceQuizId: string; poolItemId: number },
  ctx: ContextWithUser
) {
  const item = await ctx.prisma.practiceQuizAdaptivePoolItem.findFirst({
    where: { id: poolItemId, config: { practiceQuizId } },
  })
  if (!item) return null
  return serializeAdaptiveParticipantElement({
    ...item,
    elementData: item.elementData as ElementData,
  })
}
