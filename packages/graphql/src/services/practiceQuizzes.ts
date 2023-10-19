import { Context } from '../lib/context'

export async function getPracticeQuizData(
  { id }: { id: string },
  ctx: Context
) {
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

interface RespondToFlashcardInstanceInput {
  id: number
  courseId: string
  correctness: number
}

export async function respondToFlashcardInstance(
  { id, courseId, correctness }: RespondToFlashcardInstanceInput,
  ctx: Context
) {
  // 0 = wrong, 1 = partial, 2 = correct
  if (![0, 1, 2].includes(correctness)) {
    return null
  }

  // TODO: also handle the case where the participant is logged in, but has no valid participation in the considered course
  if (!ctx.user?.sub) {
    // TODO: if user is not logged in, do not check the questionResponse, only save it on the instance / update the instance results
    return null
  }

  // find existing question response to this instance by this user
  const existingResponse = await ctx.prisma.questionResponse.findUnique({
    where: {
      participantId_elementInstanceId: {
        participantId: ctx.user.sub,
        elementInstanceId: id,
      },
    },
  })

  // TODO: think about possibility to fuse these two cases with a single upsert (however, keep in mind that we need to update JSON stuff here)
  if (existingResponse) {
    let response
    switch (correctness) {
      case 0:
        response = {
          ...existingResponse.response,
          wrong: existingResponse.response.wrong + 1,
          total: existingResponse.response.total + 1,
        }
        break
      case 1:
        response = {
          ...existingResponse.response,
          partial: existingResponse.response.partial + 1,
          total: existingResponse.response.total + 1,
        }
        break
      case 2:
        response = {
          ...existingResponse.response,
          correct: existingResponse.response.correct + 1,
          total: existingResponse.response.total + 1,
        }
        break
    }

    // update existing response
    const questionResponse = await ctx.prisma.questionResponse.update({
      where: {
        participantId_elementInstanceId: {
          participantId: ctx.user.sub,
          elementInstanceId: id,
        },
      },
      data: {
        trialsCount: 1,
        response,
        correctCount: {
          increment: correctness === 2 ? 1 : 0,
        },
        correctCountStreak: {
          increment:
            correctness === 2 ? 1 : -existingResponse.correctCountStreak,
        },
        lastCorrectAt: correctness === 2 ? new Date() : undefined,
        participant: {
          connect: { id: ctx.user.sub },
        },
        elementInstance: {
          connect: { id },
        },
        participation: {
          connect: {
            courseId_participantId: {
              courseId,
              participantId: ctx.user.sub,
            },
          },
        },
      },
    })

    // TODO: fix return type
    // return questionResponse
    return null
  } else {
    let response = {
      wrong: 0,
      partial: 0,
      correct: 0,
      total: 0,
    }

    switch (correctness) {
      case 0:
        response = {
          wrong: 1,
          partial: 0,
          correct: 0,
          total: 1,
        }
        break
      case 1:
        response = {
          wrong: 0,
          partial: 1,
          correct: 0,
          total: 1,
        }
        break
      case 2:
        response = {
          wrong: 0,
          partial: 0,
          correct: 1,
          total: 1,
        }
        break
    }

    // create new response
    const questionResponse = await ctx.prisma.questionResponse.create({
      data: {
        trialsCount: 1,
        response,
        correctCount: correctness === 2 ? 1 : 0,
        correctCountStreak: correctness === 2 ? 1 : 0,
        lastCorrectAt: correctness === 2 ? new Date() : undefined,
        participant: {
          connect: { id: ctx.user.sub },
        },
        elementInstance: {
          connect: { id },
        },
        participation: {
          connect: {
            courseId_participantId: {
              courseId,
              participantId: ctx.user.sub,
            },
          },
        },
      },
    })

    // TODO: fix return type
    // return questionResponse
    return null
  }
}
