import {
  LiveQuiz,
  MicroLearning,
  PracticeQuiz,
  PrismaClient,
} from '@klicker-uzh/prisma'
import fs from 'fs/promises'
import path from 'path'
import { pick } from 'remeda'
import { fileURLToPath } from 'url'
import { ActivityOlatConfigurationKey, ActivityType } from './types.js'

const prisma = new PrismaClient()

export async function getCourses(provider: string, providerAccountId: string) {
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
            where: { isArchived: false },
            select: { id: true, name: true },
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

async function loadActivityTypes(): Promise<ActivityType[]> {
  try {
    const __filename = fileURLToPath(import.meta.url)
    const __dirname = path.dirname(__filename)
    const dataPath = path.join(__dirname, '../static/activityTypes.json')
    const data = await fs.readFile(dataPath, 'utf-8')
    const activityTypes: ActivityType[] = JSON.parse(data)
    return activityTypes
  } catch (error) {
    console.error('Error reading data:', error)
    process.exit(1)
  }
}

export async function getActivityTypes() {
  const activityTypes = await loadActivityTypes()

  // filter out fields
  return activityTypes.map((activityType) => ({
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
) {
  const activityTypes = await loadActivityTypes()
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
      isGamificationEnabled: true,
      liveQuizzes: { where: { isDeleted: false } },
      practiceQuizzes: { where: { isDeleted: false } },
      microLearnings: { where: { isDeleted: false } },
    },
  })
  if (!course) return null

  const isGamificationEnabled = course.isGamificationEnabled
  const liveQuizzes = course.liveQuizzes ?? []
  const practiceQuizzes = course.practiceQuizzes ?? []
  const microLearnings = course.microLearnings ?? []

  const mapSubselection: Record<
    string,
    LiveQuiz[] | PracticeQuiz[] | MicroLearning[]
  > = {
    'live-quiz': liveQuizzes,
    'practice-quiz': practiceQuizzes,
    'micro-learning': microLearnings,
  }
  const activityKeysGamification = ['course-leaderboard']

  const availableActivityTypes = activityTypes.flatMap(
    ({
      id,
      'title-de': titleDE,
      'title-en': titleEN,
      'title-fr': titleFR,
      'title-it': titleIT,
      olatConfigurationKey,
      isSubselectionRequired,
    }) => {
      // Subselection activities: only include if they have items
      if (olatConfigurationKey in mapSubselection) {
        return {
          id,
          'title-de': titleDE,
          'title-en': titleEN,
          'title-fr': titleFR,
          'title-it': titleIT,
          olatConfigurationKey,
          isSubselectionRequired,
        }
      }

      // Gamification activities: only include if gamification is enabled
      if (activityKeysGamification.includes(olatConfigurationKey)) {
        return isGamificationEnabled
          ? {
              id,
              'title-de': titleDE,
              'title-en': titleEN,
              'title-fr': titleFR,
              'title-it': titleIT,
              olatConfigurationKey,
              isSubselectionRequired,
            }
          : []
      }

      // All other activities: always include
      return {
        id,
        'title-de': titleDE,
        'title-en': titleEN,
        'title-fr': titleFR,
        'title-it': titleIT,
        olatConfigurationKey,
        isSubselectionRequired,
      }
    }
  )

  return availableActivityTypes
}

export async function getActivities(
  provider: string,
  providerAccountId: string,
  courseID: string,
  activityTypeKey: ActivityOlatConfigurationKey
) {
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
      liveQuizzes:
        activityTypeKey === 'live-quiz'
          ? {
              where: { isDeleted: false },
              select: { id: true, name: true },
            }
          : false,
      practiceQuizzes:
        activityTypeKey === 'practice-quiz'
          ? {
              where: { isDeleted: false },
              select: { id: true, name: true },
            }
          : false,
      microLearnings:
        activityTypeKey === 'micro-learning'
          ? {
              where: { isDeleted: false },
              select: { id: true, name: true },
            }
          : false,
    },
  })
  if (!course) return null

  const activities =
    course.liveQuizzes ?? course.practiceQuizzes ?? course.microLearnings ?? []

  const activityDetails = activities.map((activity) => ({
    id: activity.id,
    'title-de': activity.name,
    'title-en': activity.name,
    'title-fr': activity.name,
    'title-it': activity.name,
  }))

  return [
    {
      id: 'overview',
      'title-de': 'Übersicht',
      'title-en': 'Overview',
      'title-fr': "Vue d'ensemble",
      'title-it': 'Panoramica',
    },
    ...activityDetails,
  ]
}
