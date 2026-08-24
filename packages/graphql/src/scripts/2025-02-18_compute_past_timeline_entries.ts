import { prisma } from '@klicker-uzh/prisma'
import { LeaderboardType, TimelineEntryType } from '@klicker-uzh/prisma/client'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
dayjs.extend(utc)

async function run() {
  // fetch all participants
  const participants = await prisma.participant.findMany()

  // initialize counters
  let counter = 0
  let liveQuizzesWithoutCourse = 0

  for (const participant of participants) {
    console.log(`Processing participant ${counter++}/${participants.length}`)

    // fetch all question detail entries, ascending in creation time
    const details = await prisma.questionResponseDetail.findMany({
      where: {
        participantId: participant.id,
      },
      orderBy: {
        createdAt: 'asc',
      },
      include: {
        microLearning: true,
        practiceQuiz: true,
        participation: true,
      },
    })

    // group question response details by day and aggregate collected points and XP
    const dailyData: {
      [dayCourse: string]: {
        date: string
        courseId: string
        participationId: number
        collectedPoints: number
        collectedXp: number
      }
    } = details.reduce((acc, detail) => {
      // if both the course linked to the microlearning and practice quiz are not defined, throw an error
      if (
        (detail.microLearning?.courseId === null ||
          typeof detail.microLearning?.courseId === 'undefined') &&
        (detail.practiceQuiz?.courseId === null ||
          typeof detail.practiceQuiz?.courseId === 'undefined')
      ) {
        throw new Error(
          'Course not found for response detail with id ' + detail.id
        )
      }

      const day = new Date(detail.createdAt).toISOString().split('T')[0]
      const courseId =
        detail.microLearning?.courseId ?? detail.practiceQuiz?.courseId!
      const key = `${day}-${courseId}`

      // initialize empty day entry
      if (!acc[key]) {
        acc[key] = {
          date: day,
          courseId,
          participationId: detail.participationId,
          collectedPoints: 0,
          collectedXp: 0,
        }
      }

      // add points and XP
      acc[key].collectedPoints += detail.participation.isActive
        ? (detail.pointsAwarded ?? 0)
        : 0
      acc[key].collectedXp += detail.xpAwarded

      return acc
    }, {})

    // fetch all live quiz leaderboard entries for this participant (xp are not tracked here)
    const lqLeaderboardEntries = await prisma.leaderboardEntry.findMany({
      where: {
        type: LeaderboardType.SESSION,
        participantId: participant.id,
      },
      include: {
        liveQuiz: true,
        sessionParticipation: true,
      },
    })

    // add live quiz points to the corresponding day where the quiz was finished (finishedAt date)
    for (const entry of lqLeaderboardEntries) {
      // if the live quiz is still running or the participation is not active, continue
      if (
        !entry.liveQuiz?.finishedAt ||
        entry.sessionParticipationId === null ||
        !entry.sessionParticipation ||
        !entry.sessionParticipation.isActive
      ) {
        continue
      }

      // if the course linked to the live quiz is not defined, throw an error
      if (
        entry.liveQuiz.courseId === null ||
        typeof entry.liveQuiz.courseId === 'undefined'
      ) {
        console.log(
          'Course not found for live quiz leaderboard entry with id ' + entry.id
        )
        liveQuizzesWithoutCourse++
        continue
      }

      // initialize empty day entry
      const day = new Date(entry.liveQuiz.finishedAt)
        .toISOString()
        .split('T')[0]
      const courseId = entry.liveQuiz.courseId
      const key = `${day}-${courseId}`

      if (!dailyData[key]) {
        dailyData[key] = {
          date: day,
          courseId,
          participationId: entry.sessionParticipationId,
          collectedPoints: 0,
          collectedXp: 0,
        }
      }

      // add points
      dailyData[key].collectedPoints += entry.score
    }

    // aggregate the daily data into weekly data grouped by the week start date
    const weeklyData = Object.values(dailyData).reduce<{
      [weekCourse: string]: {
        date: string
        courseId: string
        participationId: number
        collectedPoints: number
        collectedXp: number
      }
    }>((acc, data) => {
      // get the week start date (Monday) in UTC format
      const weekStart = dayjs(data.date)
        .utc()
        .startOf('week')
        .add(1, 'day')
        .toISOString()
        .split('T')[0]
      const courseId = data.courseId
      const key = `${weekStart}-${courseId}`

      if (!acc[key]) {
        acc[key] = {
          date: weekStart,
          courseId,
          participationId: data.participationId,
          collectedPoints: 0,
          collectedXp: 0,
        }
      }

      acc[key].collectedPoints += data.collectedPoints
      acc[key].collectedXp += data.collectedXp
      return acc
    }, {})

    // upsert timeline entries for daily and weekly timeline entries
    await Promise.all(
      Object.values(dailyData).map(async (data) => {
        // create daily timeline entry
        await prisma.timelineEntry.upsert({
          where: {
            participationId_courseId_timestamp_type: {
              participationId: data.participationId,
              courseId: data.courseId,
              timestamp: dayjs.utc(data.date).toDate(),
              type: TimelineEntryType.DAILY,
            },
          },
          create: {
            type: TimelineEntryType.DAILY,
            timestamp: dayjs.utc(data.date).toDate(),
            collectedPoints: data.collectedPoints,
            collectedXp: data.collectedXp,
            computedAt: new Date(),
            course: {
              connect: {
                id: data.courseId,
              },
            },
            participation: {
              connect: {
                id: data.participationId,
              },
            },
          },
          update: {
            collectedPoints: data.collectedPoints,
            collectedXp: data.collectedXp,
            computedAt: new Date(),
          },
        })
      })
    )
    await Promise.all(
      Object.values(weeklyData).map(async (data) => {
        // create weekly timeline entry
        await prisma.timelineEntry.upsert({
          where: {
            participationId_courseId_timestamp_type: {
              participationId: data.participationId,
              courseId: data.courseId,
              timestamp: dayjs.utc(data.date).toDate(),
              type: TimelineEntryType.WEEKLY,
            },
          },
          create: {
            type: TimelineEntryType.WEEKLY,
            timestamp: dayjs.utc(data.date).toDate(),
            collectedPoints: data.collectedPoints,
            collectedXp: data.collectedXp,
            computedAt: new Date(),
            course: {
              connect: {
                id: data.courseId,
              },
            },
            participation: {
              connect: {
                id: data.participationId,
              },
            },
          },
          update: {
            collectedPoints: data.collectedPoints,
            collectedXp: data.collectedXp,
            computedAt: new Date(),
          },
        })
      })
    )
  }

  // logging
  console.log(
    'Encountered leaderboard entries in live quizzes without course:',
    liveQuizzesWithoutCourse
  )
}

await run()
