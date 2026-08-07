// ---------------------------------------------------------------------------
// Helper: validates GrowthBook analytics and private-preview availability.

import type { ElementType } from '@klicker-uzh/prisma/client'
import { expect, type Page } from '@playwright/test'
import { getPrisma } from '../../global-setup.js'
import { openCourseActionMenu } from '../actions.js'
import { LECTURER_SHORTNAME, SEED, SEEDED_COURSE } from '../constants.js'

export type ValidateFeatureAvailabilityOptions = {
  learningAnalytics: boolean
  privatePreview: boolean
}

const growthbookApiHost =
  process.env.NEXT_PUBLIC_GROWTHBOOK_API_HOST ?? 'https://growthbook.test'
const growthbookClientKey =
  process.env.NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY ?? 'sdk-test'
const GROWTHBOOK_FEATURES_URL = `${growthbookApiHost.replace(/\/$/, '')}/api/features/${growthbookClientKey}*`

export async function mockGrowthBookLearningAnalytics(
  page: Page,
  enabled: boolean
) {
  await page.unroute(GROWTHBOOK_FEATURES_URL)
  await page.route(GROWTHBOOK_FEATURES_URL, (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        features: {
          'learning-analytics': { defaultValue: enabled },
        },
      }),
    })
  )
}

export async function updateLecturerPrivatePreview(privatePreview: boolean) {
  const prisma = await getPrisma()
  await prisma.user.update({
    where: { shortname: LECTURER_SHORTNAME },
    data: { privatePreview },
  })
}

export async function validateFeatureAvailabilityFixture(
  page: Page,
  options: ValidateFeatureAvailabilityOptions
) {
  // analytics nav item
  await expect(page.getByTestId('analytics')).toBeVisible()
  if (options.learningAnalytics) {
    await expect(page.getByTestId('analytics')).toBeEnabled()
  } else {
    await expect(page.getByTestId('analytics')).toBeDisabled()
  }

  // course learning analytics link
  await page.getByTestId('courses').click()
  await page.getByTestId(`course-list-button-${SEEDED_COURSE}`).click()
  await openCourseActionMenu(page, 'course-learning-analytics-link')
  const courseLearningAnalytics = page.getByTestId(
    'course-learning-analytics-link'
  )
  await expect(courseLearningAnalytics).toBeVisible()
  if (options.learningAnalytics) {
    await expect(courseLearningAnalytics).toBeEnabled()
  } else {
    await expect(courseLearningAnalytics).toBeDisabled()
  }
  await page.keyboard.press('Escape')

  // sharing buttons per activity type (private preview only)
  await page.getByTestId('courses').click()
  await page.getByTestId(`course-list-button-${SEEDED_COURSE}`).click()

  // Live quiz
  await page.getByTestId('tab-liveQuizzes').click()
  await page.getByTestId(`actions-LIVE_QUIZ-${SEED.liveQuiz}`).click()
  await expect(
    page.getByTestId(`view-activity-log-${SEED.liveQuiz}`)
  ).toBeVisible()
  if (options.privatePreview) {
    await expect(
      page.getByTestId(`share-live-quiz-${SEED.liveQuiz}`)
    ).toBeVisible()
  } else {
    await expect(
      page.getByTestId(`share-live-quiz-${SEED.liveQuiz}`)
    ).not.toBeAttached()
  }
  await page.keyboard.press('Escape')

  // Microlearning
  await page.getByTestId('tab-microLearnings').click()
  await page.getByTestId(`actions-MICRO_LEARNING-${SEED.microlearning}`).click()
  await expect(
    page.getByTestId(`view-activity-log-${SEED.microlearning}`)
  ).toBeVisible()
  if (options.privatePreview) {
    await expect(
      page.getByTestId(`share-microlearning-${SEED.microlearning}`)
    ).toBeVisible()
  } else {
    await expect(
      page.getByTestId(`share-microlearning-${SEED.microlearning}`)
    ).not.toBeAttached()
  }
  await page.keyboard.press('Escape')

  // Practice quiz
  await page.getByTestId('tab-practiceQuizzes').click()
  await page.getByTestId(`actions-PRACTICE_QUIZ-${SEED.practiceQuiz}`).click()
  await expect(
    page.getByTestId(`view-activity-log-${SEED.practiceQuiz}`)
  ).toBeVisible()
  if (options.privatePreview) {
    await expect(
      page.getByTestId(`share-practice-quiz-${SEED.practiceQuiz}`)
    ).toBeVisible()
  } else {
    await expect(
      page.getByTestId(`share-practice-quiz-${SEED.practiceQuiz}`)
    ).not.toBeAttached()
  }
  await page.keyboard.press('Escape')

  // Group activity
  await page.getByTestId('tab-groupActivities').click()
  await page.getByTestId(`actions-GROUP_ACTIVITY-${SEED.groupActivity}`).click()
  await expect(
    page.getByTestId(`view-activity-log-${SEED.groupActivity}`)
  ).toBeVisible()
  if (options.privatePreview) {
    await expect(
      page.getByTestId(`share-group-activity-${SEED.groupActivity}`)
    ).toBeVisible()
  } else {
    await expect(
      page.getByTestId(`share-group-activity-${SEED.groupActivity}`)
    ).not.toBeAttached()
  }
  await page.keyboard.press('Escape')
}

// ---------------------------------------------------------------------------
// UI fixture: create a live quiz through the wizard in the Manage app
// ---------------------------------------------------------------------------

export type CreateLiveQuizOptions = {
  name: string
  displayName: string
  questionTitle: string
}

export async function createLiveQuizFixture(
  page: Page,
  options: CreateLiveQuizOptions
) {
  await page.getByTestId('create-live-quiz').click()

  // Step 1: Name
  await page.getByTestId('insert-live-quiz-name').fill(options.name)
  await page.getByTestId('next-or-submit').click()

  // Step 2: Display name
  await page.getByTestId('insert-live-display-name').fill(options.displayName)
  await page.getByTestId('next-or-submit').click()

  // Step 3: Settings — skip
  await page.getByTestId('next-or-submit').click()

  // Step 4: Add the question to block 1
  await page.getByTestId('elements-search-input').fill(options.questionTitle)
  await page
    .getByTestId(`element-item-${options.questionTitle}`)
    .dragTo(page.getByTestId('drop-elements-block-0'))
  await page.getByTestId('next-or-submit').click()

  // Confirm creation
  await page.getByTestId('open-activity-overview').click()
  await expect(
    page.getByTestId(`activity-LIVE_QUIZ-${options.name}`)
  ).toBeVisible()
}

// helper functions

export async function createLiveQuiz({
  name,
  displayName,
  description,
  courseId,
  ownerId,
  elementNames,
}: {
  name: string
  displayName: string
  description?: string
  courseId?: string
  ownerId: string
  elementNames: string[]
}) {
  const prisma = await getPrisma()
  const { ElementInstanceType, PermissionLevel: PL } = await import(
    '@klicker-uzh/prisma/client'
  )

  try {
    // Resolve element IDs by name
    const elements: Array<{
      id: number
      name: string
      type: ElementType
      content: unknown
      explanation: unknown
      options: unknown
      basePoints: boolean
      pointsMultiplier: number
    }> = await prisma.element.findMany({
      where: { name: { in: elementNames }, ownerId },
      select: {
        id: true,
        name: true,
        type: true,
        content: true,
        explanation: true,
        options: true,
        basePoints: true,
        pointsMultiplier: true,
      },
    })

    const liveQuiz = await prisma.liveQuiz.create({
      data: {
        name,
        displayName,
        description,
        courseId: courseId ?? null,
        ownerId,
        blocks: {
          create: [
            {
              order: 0,
              elements: {
                create: elements.map((el, ix) => ({
                  order: ix,
                  type: ElementInstanceType.LIVE_QUIZ,
                  elementType: el.type,
                  elementData: {
                    id: el.id,
                    name: el.name,
                    type: el.type,
                    content: el.content,
                    explanation: el.explanation,
                    options: el.options,
                    basePoints: el.basePoints,
                    pointsMultiplier: el.pointsMultiplier,
                  },
                  options: {
                    basePoints: el.basePoints,
                    pointsMultiplier: el.pointsMultiplier,
                  },
                  results: {},
                  anonymousResults: {},
                  element: { connect: { id: el.id } },
                  owner: { connect: { id: ownerId } },
                })),
              },
            },
          ],
        },
      },
    })

    await prisma.derivedPermission.upsert({
      where: {
        liveQuizId_userId: { liveQuizId: liveQuiz.id, userId: ownerId },
      },
      create: {
        permissionLevel: PL.OWNER,
        liveQuiz: { connect: { id: liveQuiz.id } },
        user: { connect: { id: ownerId } },
      },
      update: { permissionLevel: PL.OWNER },
    })

    return liveQuiz.id
  } catch (error) {
    throw error
  }
}

export async function publishLiveQuiz(id: string) {
  const prisma = await getPrisma()
  await prisma.liveQuiz.update({
    where: { id },
    data: { status: 'PUBLISHED' },
  })
}

export async function deleteLiveQuiz(id: string) {
  const prisma = await getPrisma()
  await prisma.liveQuiz.delete({ where: { id } })
}

export async function removeSoftDeletedLiveQuiz({
  lqName,
}: {
  lqName: string
}) {
  const prisma = await getPrisma()
  try {
    const result = await prisma.liveQuiz.deleteMany({
      where: { name: lqName, isDeleted: true },
    })
    if (!result) return false
    return true
  } catch (error) {
    throw error
  }
}
