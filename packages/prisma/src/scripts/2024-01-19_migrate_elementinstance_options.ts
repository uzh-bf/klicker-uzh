import { PrismaClient } from '../client'

async function migrate() {
  const prisma = new PrismaClient()

  const questionInstances = await prisma.questionInstance.findMany({})

  let counter = 1

  for (const elem of questionInstances) {
    console.log(counter, elem.id)

    if (
      elem.questionData.type === 'SC' ||
      elem.questionData.type === 'MC' ||
      elem.questionData.type === 'KPRIM'
    ) {
      const displayMode =
        elem.questionData.options?.displayMode ??
        elem.questionData.displayMode ??
        'LIST'

      const hasSampleSolution =
        elem.questionData.options?.hasSampleSolution ??
        elem.questionData.hasSampleSolution ??
        elem.questionData.options?.choices?.some(
          (choice) => choice.correct === true
        )

      const hasAnswerFeedbacks =
        elem.questionData.options?.hasAnswerFeedbacks ??
        elem.questionData.hasAnswerFeedbacks ??
        elem.questionData.options?.choices?.some(
          (choice) => choice.feedback?.length > 0
        )

      if (
        elem.questionData.options.displayMode !== displayMode ||
        elem.questionData.options.hasSampleSolution !== hasSampleSolution ||
        elem.questionData.options.hasAnswerFeedbacks !== hasAnswerFeedbacks
      ) {
        // logging
        console.log(
          elem.questionData.options.displayMode,
          displayMode,
          elem.questionData.options.hasSampleSolution,
          hasSampleSolution,
          elem.questionData.options.hasAnswerFeedbacks,
          hasAnswerFeedbacks
        )
        await prisma.questionInstance.update({
          where: {
            id: elem.id,
          },
          data: {
            questionData: {
              ...elem.questionData,
              options: {
                ...(elem.questionData.options ?? {}),
                displayMode,
                hasSampleSolution,
                hasAnswerFeedbacks,
              },
            },
          },
        })
      }
    }

    if (elem.questionData.type === 'NUMERICAL') {
      const hasSampleSolution =
        elem.questionData.options?.hasSampleSolution ??
        elem.questionData.hasSampleSolution ??
        elem.questionData.solutionRanges?.length > 0

      if (
        elem.questionData.options?.hasSampleSolution !== hasSampleSolution ||
        typeof elem.questionData.options?.hasAnswerFeedbacks === 'undefined'
      ) {
        // logging
        console.log(
          elem.questionData.options.hasSampleSolution,
          hasSampleSolution
        )
        await prisma.questionInstance.update({
          where: {
            id: elem.id,
          },
          data: {
            questionData: {
              ...elem.questionData,
              options: {
                ...(elem.questionData.options ?? {}),
                hasSampleSolution,
                hasAnswerFeedbacks: false,
              },
            },
          },
        })
      }
    }

    if (elem.questionData.type === 'FREE_TEXT') {
      const hasSampleSolution =
        elem.questionData.options?.hasSampleSolution ??
        elem.questionData.hasSampleSolution ??
        elem.questionData.solutions?.length > 0

      if (
        elem.questionData.options?.hasSampleSolution !== hasSampleSolution ||
        typeof elem.questionData.options?.hasAnswerFeedbacks === 'undefined'
      ) {
        // logging
        console.log(
          elem.questionData.options.hasSampleSolution,
          hasSampleSolution
        )
        await prisma.questionInstance.update({
          where: {
            id: elem.id,
          },
          data: {
            questionData: {
              ...elem.questionData,
              options: {
                ...(elem.questionData.options ?? {}),
                hasSampleSolution,
                hasAnswerFeedbacks: false,
              },
            },
          },
        })
      }
    }

    counter++
  }

  console.log(counter)
}

await migrate()
