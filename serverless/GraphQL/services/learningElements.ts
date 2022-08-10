import { Context } from '../lib/context'

interface GetLearningElementDataArgs {
  id: string
}

export async function getLearningElementData(
  { id }: GetLearningElementDataArgs,
  ctx: Context
) {
  const element = await ctx.prisma.learningElement.findUnique({
    where: { id },
  })

  return element
}
