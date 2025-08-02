import {
  LiveQuiz,
  MicroLearning,
  PracticeQuiz,
  PrismaClient,
} from '@klicker-uzh/prisma'
import dayjs from 'dayjs'
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
          // find all shared non-archived courses (permission level irrelevant - read permissions are sufficient)
          objects: {
            where: { courseId: { not: null }, course: { isArchived: false } },
            select: { course: { select: { id: true, name: true } } },
          },
        },
      },
    },
  })

  const courses =
    account?.user?.objects
      .map((object) => object.course)
      .filter((course) => !!course) ?? []

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
    select: { userId: true },
  })
  if (!account) return null

  const course = await prisma.course.findUnique({
    where: {
      id: courseID,
      permissions: { some: { userId: account.userId } }, // user has at least read permissions on course
    },
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
      title_de: titleDE,
      title_en: titleEN,
      title_fr: titleFR,
      title_it: titleIT,
      olatConfigurationKey,
      isSubselectionRequired,
    }) => {
      // Subselection activities: only include if they have items
      if (olatConfigurationKey in mapSubselection) {
        return {
          id,
          title_de: titleDE,
          title_en: titleEN,
          title_fr: titleFR,
          title_it: titleIT,
          olatConfigurationKey,
          isSubselectionRequired,
        }
      }

      // Gamification activities: only include if gamification is enabled
      if (activityKeysGamification.includes(olatConfigurationKey)) {
        return isGamificationEnabled
          ? {
              id,
              title_de: titleDE,
              title_en: titleEN,
              title_fr: titleFR,
              title_it: titleIT,
              olatConfigurationKey,
              isSubselectionRequired,
            }
          : []
      }

      // All other activities: always include
      return {
        id,
        title_de: titleDE,
        title_en: titleEN,
        title_fr: titleFR,
        title_it: titleIT,
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
    select: { userId: true },
  })
  if (!account) return null

  const course = await prisma.course.findUnique({
    where: {
      id: courseID,
      permissions: { some: { userId: account.userId } }, // user has at least read permissions on course
    },
    select: {
      liveQuizzes:
        activityTypeKey === 'live-quiz'
          ? {
              where: { isDeleted: false },
              select: { id: true, name: true },
              orderBy: { name: 'asc' }, // order alphabetically by name
            }
          : false,
      practiceQuizzes:
        activityTypeKey === 'practice-quiz'
          ? {
              where: { isDeleted: false },
              select: { id: true, name: true, availableFrom: true },
              orderBy: [{ availableFrom: 'asc' }, { name: 'asc' }], // order by availability date and then alphabetically by name
            }
          : false,
      microLearnings:
        activityTypeKey === 'micro-learning'
          ? {
              where: { isDeleted: false },
              select: {
                id: true,
                name: true,
                scheduledStartAt: true,
                scheduledEndAt: true,
              },
              orderBy: [{ scheduledStartAt: 'asc' }, { name: 'asc' }], // order by scheduled start date and then alphabetically by name
            }
          : false,
    },
  })
  if (!course) return null

  const liveQuizzes = (course.liveQuizzes ?? []).map((lq) => ({
    id: lq.id,
    title_de: lq.name,
    title_en: lq.name,
    title_fr: lq.name,
    title_it: lq.name,
  }))
  const practiceQuizzes = (course.practiceQuizzes ?? []).map((pq) => ({
    id: pq.id,
    title_de: pq.availableFrom
      ? `${pq.name} (verfügbar ab ${dayjs(pq.availableFrom).format('DD.MM.YYYY')})`
      : pq.name,
    title_en: pq.availableFrom
      ? `${pq.name} (available from ${dayjs(pq.availableFrom).format('DD.MM.YYYY')})`
      : pq.name,
    title_fr: pq.availableFrom
      ? `${pq.name} (disponible à partir du ${dayjs(pq.availableFrom).format('DD.MM.YYYY')})`
      : pq.name,
    title_it: pq.availableFrom
      ? `${pq.name} (disponibile da ${dayjs(pq.availableFrom).format('DD.MM.YYYY')})`
      : pq.name,
  }))
  const microLearnings = (course.microLearnings ?? []).map((ml) => ({
    id: ml.id,
    title_de: `${ml.name} (Start: ${dayjs(ml.scheduledStartAt).format('DD.MM.YYYY')} - Ende: ${dayjs(ml.scheduledEndAt).format('DD.MM.YYYY')})`,
    title_en: `${ml.name} (Start: ${dayjs(ml.scheduledStartAt).format('DD.MM.YYYY')} - End: ${dayjs(ml.scheduledEndAt).format('DD.MM.YYYY')})`,
    title_fr: `${ml.name} (Début: ${dayjs(ml.scheduledStartAt).format('DD.MM.YYYY')} - Fin: ${dayjs(ml.scheduledEndAt).format('DD.MM.YYYY')})`,
    title_it: `${ml.name} (Inizio: ${dayjs(ml.scheduledStartAt).format('DD.MM.YYYY')} - Fine: ${dayjs(ml.scheduledEndAt).format('DD.MM.YYYY')})`,
  }))

  return [
    {
      id: 'overview',
      title_de: 'Übersicht',
      title_en: 'Overview',
      title_fr: "Vue d'ensemble",
      title_it: 'Panoramica',
    },
    ...liveQuizzes,
    ...practiceQuizzes,
    ...microLearnings,
  ]
}
