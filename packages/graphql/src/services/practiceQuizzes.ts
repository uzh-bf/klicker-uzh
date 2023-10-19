import { Context } from '../lib/context'

export async function getPracticeQuizData(
  { id }: { id: string },
  ctx: Context
) {
  console.log('practice quiz id: ', id)
  const quiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id,
    },
    include: {
      course: true,
      stacks: {
        include: {
          elements: {
            orderBy: {
              order: 'asc',
            },
          },
        },
        orderBy: {
          order: 'asc',
        },
      },
    },
  })

  if (!quiz) return null

  //   const elements = quiz.stacks.reduce((acc, stack) => {
  //     return [...acc, ...stack.elements]
  //   }, [])

  //   console.log('practice quiz elements backend: ', elements)

  // TODO: reintroduce ordering
  // if (element.orderType === OrderType.LAST_RESPONSE) {
  //   const orderedInstances = R.sort(
  //     (a, b) => (a.lastResponse ?? 0) - (b.lastResponse ?? 0),
  //     shuffle(instancesWithoutSolution.instances)
  //   )

  //   return {
  //     ...element,
  //     ...instancesWithoutSolution,
  //     instances: orderedInstances,
  //   }
  // }

  // if (element.orderType === OrderType.SHUFFLED) {
  //   return {
  //     ...element,
  //     ...instancesWithoutSolution,
  //     instances: shuffle(instancesWithoutSolution.instances),
  //   }
  // }
  return quiz
}
