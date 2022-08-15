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
    include: {
      course: true,
      instances: true,
    },
  })

  console.warn(element)
  console.warn(element?.instances[0].questionData)

  return {
    ...element,
    instance: element?.instances[0],
  }
}
