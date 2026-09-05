import { prisma } from '@klicker-uzh/prisma'

async function run() {
  // fetch all practice quizzes, including the corresponding course
  const practiceQuizzes = await prisma.practiceQuiz.findMany({
    where: { isDeleted: false },
    include: {
      course: { select: { id: true, name: true, isGamificationEnabled: true } },
    },
  })

  // update the practice quizzes with the course's gamification status
  let pqCounter = 0
  for (const pq of practiceQuizzes) {
    if (pq.isGamificationEnabled === pq.course.isGamificationEnabled) {
      continue // skip if already set correctly
    }

    console.log(
      `Practice Quiz ${++pqCounter}/${practiceQuizzes.length} - Gamification: ${String(pq.course.isGamificationEnabled)} (Course: ${pq.course.name})`
    )

    await prisma.practiceQuiz.update({
      where: { id: pq.id },
      data: { isGamificationEnabled: pq.course.isGamificationEnabled },
    })
  }

  // fetch all microlearnings, including the corresponding course
  const microLearnings = await prisma.microLearning.findMany({
    where: { isDeleted: false },
    include: {
      course: { select: { id: true, name: true, isGamificationEnabled: true } },
    },
  })

  // update the microlearnings with the course's gamification status
  let mlCounter = 0
  for (const ml of microLearnings) {
    if (ml.isGamificationEnabled === ml.course.isGamificationEnabled) {
      continue // skip if already set correctly
    }

    console.log(
      `Micro Learning ${++mlCounter}/${microLearnings.length} - Gamification: ${String(ml.course.isGamificationEnabled)} (Course: ${ml.course.name})`
    )

    await prisma.microLearning.update({
      where: { id: ml.id },
      data: { isGamificationEnabled: ml.course.isGamificationEnabled },
    })
  }

  // fetch all group activities, including the corresponding course
  const groupActivities = await prisma.groupActivity.findMany({
    where: { isDeleted: false },
    include: {
      course: { select: { id: true, name: true, isGamificationEnabled: true } },
    },
  })

  // update the group activities with the course's gamification status
  let gaCounter = 0
  for (const ga of groupActivities) {
    if (ga.isGamificationEnabled === ga.course.isGamificationEnabled) {
      continue // skip if already set correctly
    }

    console.log(
      `Group Activity ${++gaCounter}/${groupActivities.length} - Gamification: ${String(ga.course.isGamificationEnabled)} (Course: ${ga.course.name})`
    )

    await prisma.groupActivity.update({
      where: { id: ga.id },
      data: { isGamificationEnabled: ga.course.isGamificationEnabled },
    })
  }
}

await run()
