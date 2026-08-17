import { prisma } from '@klicker-uzh/prisma'

// ? This script will relink all missing live session activities to the corresponding live quiz entries after their migration
async function run() {
  // count udpates
  let liveQuizUpdates = 0
  let counter = 0

  // get the ids of all live sessions
  const liveSessionIds = await prisma.liveSession
    .findMany({
      select: {
        id: true,
      },
    })
    .then((sessions) => sessions.map((session) => session.id))

  for (const sessionId of liveSessionIds) {
    // update counter and logging
    counter++
    console.log(`Processing live session ${counter}/${liveSessionIds.length}`)

    // fetch live session with all related data
    const session = await prisma.liveSession.findUnique({
      where: {
        id: sessionId,
      },
      include: {
        feedbacks: true,
        confusionFeedbacks: true,
        leaderboard: true,
      },
    })

    if (!session) {
      throw new Error(`Live session with id ${sessionId} not found`)
    }

    // verify that live quiz with same id exists
    const liveQuiz = await prisma.liveQuiz.findUnique({
      where: {
        id: sessionId,
      },
    })

    if (!liveQuiz) {
      console.log(`Live quiz with id ${sessionId} not found`)
      continue
    }

    // check if there is any data to connect
    if (
      session.feedbacks.length === 0 &&
      session.confusionFeedbacks.length === 0 &&
      session.leaderboard.length === 0
    ) {
      console.log(`No data to connect for live session ${sessionId}`)
      continue
    }

    // connect data to new live quiz
    await prisma.liveQuiz.update({
      where: {
        id: sessionId,
      },
      data: {
        feedbacks: {
          connect: session.feedbacks.map((feedback) => ({
            id: feedback.id,
          })),
        },
        confusionFeedbacks: {
          connect: session.confusionFeedbacks.map((feedback) => ({
            id: feedback.id,
          })),
        },
        leaderboard: {
          connect: session.leaderboard.map((entry) => ({
            id: entry.id,
          })),
        },
      },
    })

    // increment update counter
    liveQuizUpdates++
  }

  console.log(`Updated ${liveQuizUpdates} live quizzes`)

  // check if there are any entries in the corresponding tables where
  // the linked live session id and live quiz id are not identical
  const mismatchingFeedbacks =
    await prisma.$executeRaw`SELECT f.id FROM "Feedback" f WHERE f."liveQuizId" IS NULL OR f."sessionId" != f."liveQuizId"`
  const mismatchingConfusionFeedbacks =
    await prisma.$executeRaw`SELECT ct.id FROM "ConfusionTimestep" ct WHERE ct."liveQuizId" IS NULL OR ct."sessionId" != ct."liveQuizId"`
  const mismatchingLeaderboardEntries =
    await prisma.$executeRaw`SELECT fb.id FROM "LeaderboardEntry" fb WHERE fb.type='SESSION' AND (fb."liveQuizId" IS NULL OR fb."sessionId" != fb."liveQuizId")`

  console.log(
    'Number of feedbacks with mismatching live session and live quiz ids',
    mismatchingFeedbacks
  )
  console.log(
    'Number of confusion feedbacks with mismatching live session and live quiz ids',
    mismatchingConfusionFeedbacks
  )
  console.log(
    'Number of leaderboard entries with mismatching live session and live quiz ids',
    mismatchingLeaderboardEntries
  )
}

await run()
