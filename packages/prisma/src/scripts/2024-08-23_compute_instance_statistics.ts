import {
  ElementInstanceType,
  ElementType,
  PrismaClient,
  ResponseCorrectness,
} from '../prisma/client'

async function run() {
  const prisma = new PrismaClient()
  const debug = true

  let counter = 0
  let updateCounter = 0
  let updatedPQInstances = 0
  let updatedMLInstances = 0
  let updatedGAInstances = 0

  // ! Fetch all element instances separated by type
  const rawInstances = await prisma.elementInstance.findMany({
    include: { responses: true, element: true, instanceStatistics: true },
  })
  const instances = rawInstances.filter((instance) => {
    const statistics = instance.instanceStatistics
    if (!statistics) {
      throw new Error(`Instance ${instance.id} has no statistics`)
    }

    const responseSum =
      (statistics.anonymousCorrectCount ?? 0) +
      (statistics.anonymousPartialCorrectCount ?? 0) +
      (statistics.anonymousWrongCount ?? 0) +
      statistics.correctCount +
      statistics.partialCorrectCount +
      statistics.wrongCount

    return responseSum === 0
  })

  // ! Update the instances with the statistics based on responses
  const updates = instances.map((instance) => {
    console.log(`Processing instance ${counter}/${instances.length}`)

    // Summarize personal responses
    const isPracticeQuiz = instance.type === ElementInstanceType.PRACTICE_QUIZ
    const {
      totalResponseTime,
      correctCount,
      partialCount,
      wrongCount,
      firstCorrectCount,
      firstPartialCount,
      firstWrongCount,
      lastCorrectCount,
      lastPartialCount,
      lastWrongCount,
    } = instance.responses.reduce(
      (acc, response) => {
        // ! Accumulate total time spent on instance and correctness counts
        acc.totalResponseTime += response.averageTimeSpent
        acc.correctCount += response.correctCount
        acc.partialCount += response.partialCorrectCount
        acc.wrongCount += response.wrongCount

        // (for practice quizzes only) set first and last correctness counts
        if (isPracticeQuiz) {
          acc.firstCorrectCount += Number(
            response.firstResponseCorrectness === ResponseCorrectness.CORRECT
          )
          acc.firstPartialCount += Number(
            response.firstResponseCorrectness === ResponseCorrectness.PARTIAL
          )
          acc.firstWrongCount += Number(
            response.firstResponseCorrectness === ResponseCorrectness.WRONG
          )
          acc.lastCorrectCount += Number(
            response.lastResponseCorrectness === ResponseCorrectness.CORRECT
          )
          acc.lastPartialCount += Number(
            response.lastResponseCorrectness === ResponseCorrectness.PARTIAL
          )
          acc.lastWrongCount += Number(
            response.lastResponseCorrectness === ResponseCorrectness.WRONG
          )
        }

        return acc
      },
      {
        totalResponseTime: 0,
        correctCount: 0,
        partialCount: 0,
        wrongCount: 0,
        firstCorrectCount: 0,
        firstPartialCount: 0,
        firstWrongCount: 0,
        lastCorrectCount: 0,
        lastPartialCount: 0,
        lastWrongCount: 0,
      }
    )

    // update the instance statistics based on the accumulated data
    const totalUniqueParticipants = instance.responses.length
    const averageInstanceTime = totalResponseTime / totalUniqueParticipants

    // ! Compute anonymous correctness counts
    let anonymousCorrectCount = 0
    let anonymousPartialCorrectCount = 0
    let anonymousWrongCount = 0
    switch (instance.elementData.type) {
      case ElementType.FLASHCARD:
        anonymousCorrectCount = instance.anonymousResults['CORRECT']
        anonymousPartialCorrectCount = instance.anonymousResults['PARTIAL']
        anonymousWrongCount = instance.anonymousResults['INCORRECT']

        if (
          anonymousCorrectCount +
            anonymousPartialCorrectCount +
            anonymousWrongCount !==
          instance.anonymousResults['total']
        ) {
          throw new Error(
            `Anonymous results computed for flashcard instance ${instance.id} are inconsistent`
          )
        }
        break

      case ElementType.CONTENT:
        anonymousCorrectCount = instance.anonymousResults['total']
        break

      case ElementType.SC:
        const correctAnswerIndex =
          instance.elementData.options.choices.findIndex(
            (choice) => choice.correct
          )
        const correctAnswerIx =
          instance.elementData.options.choices[correctAnswerIndex].ix

        //check how many of the anonymous responses are equal to correctAnswerIx and the other way around
        const { tempCorrect1, tempIncorrect1 } = Object.entries(
          instance.anonymousResults.choices
        ).reduce(
          (acc, [ix, count]) => {
            if (ix === correctAnswerIx) {
              acc.tempCorrect1 += count as number
            } else {
              acc.tempIncorrect1 += count as number
            }

            return acc
          },
          { tempCorrect1: 0, tempIncorrect1: 0 }
        )

        anonymousCorrectCount = tempCorrect1
        anonymousWrongCount = tempIncorrect1
        break

      case ElementType.NUMERICAL:
      case ElementType.FREE_TEXT:
        const { tempCorrect2, tempIncorrect2 } =
          instance.anonymousResults.responses.reduce(
            (acc, response) => {
              acc.tempCorrect += Number(response.correct)
              acc.tempIncorrect += Number(!response.correct)
              return acc
            },
            { tempCorrect: 0, tempIncorrect: 0 }
          )

        anonymousCorrectCount = tempCorrect2
        anonymousWrongCount = tempIncorrect2
        break

      case ElementType.MC:
      case ElementType.KPRIM:
        console.log(
          'Anonymous results for MC/KPRIM cannot be recovered, the corresponding counts are set to -1'
        )
        anonymousCorrectCount = -1
        anonymousPartialCorrectCount = -1
        anonymousWrongCount = -1

      default:
        throw new Error(`Unknown element type ${instance.elementData.type}`)
    }

    // update the instance statistics
    return prisma.elementInstance.update({
      where: { id: instance.id },
      data: {
        instanceStatistics: {
          update: {
            // set correctness counts for all statistics with responses
            correctCount,
            partialCorrectCount: partialCount,
            wrongCount,

            // set first and last correctness counts for practice quiz
            firstCorrectCount: isPracticeQuiz ? firstCorrectCount : undefined,
            firstPartialCorrectCount: isPracticeQuiz
              ? firstPartialCount
              : undefined,
            firstWrongCount: isPracticeQuiz ? firstWrongCount : undefined,
            lastCorrectCount: isPracticeQuiz ? lastCorrectCount : undefined,
            lastPartialCorrectCount: isPracticeQuiz
              ? lastPartialCount
              : undefined,
            lastWrongCount: isPracticeQuiz ? lastWrongCount : undefined,

            // update anonymous correctness counts
            anonymousCorrectCount,
            anonymousPartialCorrectCount,
            anonymousWrongCount,

            // set average time spent on instance and total unique participants
            uniqueParticipantCount: totalUniqueParticipants,
            averageTimeSpent: averageInstanceTime,
          },
        },
      },
    })
  })

  await prisma.$transaction(updates)

  console.log(`Updated ${updateCounter} instances in total`)
  console.log(`Checked ${updatedPQInstances} practice quiz instances`)
  console.log(`Checked ${updatedMLInstances} microlearning instances`)
  console.log(`Checked ${updatedGAInstances} group activity instances`)
}

await run()
