import { PrismaClient } from '@klicker-uzh/prisma'
import { pick } from 'remeda'
import { activityTypesAvailable } from './static.js'
import { ActivityTypeSubselection } from './types.js'

const prisma = new PrismaClient()

export async function getCourses(
  provider: string,
  providerAccountId: string
): Promise<any[] | null> {
  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: provider,
        providerAccountId: providerAccountId,
      },
    },
    select: {
      user: {
        select: {
          courses: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  const courses = account?.user?.courses ?? []
  if (courses.length === 0) {
    return []
  }

  return courses.map((course) => ({
    id: course.id,
    title: course.name,
  }))
}

export async function getActivityTypes(): Promise<any[] | null> {
  // filter out fields
  return activityTypesAvailable.map((activityType) => ({
    ...pick(activityType, [
      'id',
      'path',
      'olatConfigurationKey',
      'isEmailTransferRequired',
    ]),
  }))
}

export async function getCourseActivityTypes(
  provider: string,
  providerAccountId: string,
  courseID: string
): Promise<any[] | null> {
  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: provider,
        providerAccountId: providerAccountId,
      },
    },
    select: {
      userId: true,
    },
  })
  if (!account) return null

  const course = await prisma.course.findUnique({
    where: { id: courseID, ownerId: account.userId },
    select: {
      // NOTE: modify if required
      isGamificationEnabled: true,
      liveQuizzes: true,
      practiceQuizzes: true,
      microLearnings: true,
    },
  })
  if (!course) return null

  const isGamificationEnabled = course.isGamificationEnabled
  const liveQuizzes = course.liveQuizzes ?? []
  const practiceQuizzes = course.practiceQuizzes ?? []
  const microLearnings = course.microLearnings ?? []

  const mapOverview: Record<string, any[]> = {
    // NOTE: modify if required
    'live-quizzes': liveQuizzes,
    'practice-quizzes': practiceQuizzes,
    'micro-learnings': microLearnings,
  }

  const mapSubselection: Record<string, any[]> = {
    // NOTE: modify if required
    'live-quiz': liveQuizzes,
    'practice-quiz': practiceQuizzes,
    'micro-learning': microLearnings,
  }
  const activityKeysGamification = ['course-leaderboard'] // NOTE: modify if required

  const activityTypes = activityTypesAvailable.flatMap(
    ({ id, title, olatConfigurationKey, isSubselectionRequired }) => {
      // Overview activities: show count in title
      if (olatConfigurationKey in mapOverview) {
        const count = mapOverview[olatConfigurationKey]?.length || 0
        return {
          id,
          title: `${title} (${count})`,
          olatConfigurationKey,
          isSubselectionRequired,
        }
      }

      // Subselection activities: only include if they have items
      if (olatConfigurationKey in mapSubselection) {
        const count = mapSubselection[olatConfigurationKey]?.length || 0
        return count > 0
          ? {
              id,
              title,
              olatConfigurationKey,
              isSubselectionRequired,
            }
          : []
      }

      // Gamification activities: only include if gamification is enabled
      if (activityKeysGamification.includes(olatConfigurationKey)) {
        return isGamificationEnabled
          ? {
              id,
              title,
              olatConfigurationKey,
              isSubselectionRequired,
            }
          : []
      }

      // All other activities: always include
      return {
        id,
        title,
        olatConfigurationKey,
        isSubselectionRequired,
      }
    }
  )

  return activityTypes
}

export async function getActivities(
  provider: string,
  providerAccountId: string,
  courseID: string,
  activityTypeKey: ActivityTypeSubselection // NOTE: modify if required
): Promise<any[] | null> {
  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: provider,
        providerAccountId: providerAccountId,
      },
    },
    select: {
      userId: true,
    },
  })
  if (!account) return null

  const course = await prisma.course.findUnique({
    where: { id: courseID, ownerId: account.userId },
    select: {
      // NOTE: modify if required
      liveQuizzes:
        activityTypeKey === 'live-quiz'
          ? {
              select: { id: true, name: true },
            }
          : false,
      practiceQuizzes:
        activityTypeKey === 'practice-quiz'
          ? {
              select: { id: true, name: true },
            }
          : false,
      microLearnings:
        activityTypeKey === 'micro-learning'
          ? {
              select: { id: true, name: true },
            }
          : false,
    },
  })
  if (!course) return null

  // NOTE: modify if required
  const activity =
    course.liveQuizzes ?? course.practiceQuizzes ?? course.microLearnings ?? []

  const activityDetails = activity.map((activity) => ({
    id: activity.id,
    title: activity.name,
  }))
  return activityDetails
}
