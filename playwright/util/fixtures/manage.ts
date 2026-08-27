// ---------------------------------------------------------------------------
// Helper: validates feature availability across GrowthBook and preview flags
// Mirrors the validateFeatureAvailability() function in the Cypress spec.
// Not.toBeAttached() mirrors cy.should('not.exist') — elements absent from DOM.

import {
  ElementInstanceType,
  ElementStackType,
  ElementType,
  PermissionLevel,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { expect, type Locator, type Page } from '@playwright/test'
import { getPrisma } from '../../global-setup.js'
import { openActivityActionMenu, openCourseActionMenu } from '../actions.js'
import {
  COURSE_ID_TEST,
  LECTURER_ID,
  LECTURER_IND_ID,
  LECTURER_SHORTNAME,
  SEED,
  SEEDED_COURSE,
  URL_MANAGE,
} from '../constants.js'

export type ValidateFeatureAvailabilityOptions = {
  learningAnalytics: boolean
  privatePreview: boolean
}

const LEARNING_ANALYTICS_UNAVAILABLE =
  'Learning analytics are not available for your account yet.'

async function expectFlaggedControl(
  page: Page,
  locator: Locator,
  enabled: boolean,
  unavailableReason?: string
) {
  await expect(locator).toBeVisible()
  if (enabled) {
    await expect(locator).toBeEnabled()
  } else {
    await expect(locator).toBeDisabled()
    if (unavailableReason) {
      await locator.hover()
      await expect(page.getByRole('tooltip')).toContainText(unavailableReason)
      await page.keyboard.press('Escape')
      await expect(page.getByRole('tooltip')).not.toBeVisible()
    }
  }
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

export async function prepareSeededAnalyticsActivities() {
  const prisma = await getPrisma()
  const microLearning = await prisma.microLearning.findFirstOrThrow({
    where: { name: SEED.microlearning },
    select: { id: true },
  })
  const practiceQuiz = await prisma.practiceQuiz.findFirstOrThrow({
    where: { name: SEED.practiceQuiz },
    select: { id: true },
  })

  await prisma.elementStack.deleteMany({
    where: { microLearningId: microLearning.id },
  })

  const element = await prisma.element.create({
    data: {
      name: 'Seed Analytics Content',
      content: 'Seed content for the asynchronous evaluation.',
      options: {},
      type: ElementType.CONTENT,
      ownerId: LECTURER_ID,
    },
  })
  const elementData = {
    id: `${element.id}-v${element.version}`,
    elementId: element.id,
    type: element.type,
    name: element.name,
    content: element.content,
    basePoints: element.basePoints,
    pointsMultiplier: element.pointsMultiplier,
  }
  const results = { total: 0 }

  await prisma.microLearning.update({
    where: { id: microLearning.id },
    data: {
      status: PublicationStatus.PUBLISHED,
      stacks: {
        create: {
          type: ElementStackType.MICROLEARNING,
          order: 0,
          elements: {
            create: {
              type: ElementInstanceType.MICROLEARNING,
              elementType: ElementType.CONTENT,
              order: 0,
              options: {},
              elementData,
              results,
              anonymousResults: results,
              elementId: element.id,
              ownerId: LECTURER_ID,
            },
          },
        },
      },
    },
  })

  await prisma.practiceQuiz.update({
    where: { id: practiceQuiz.id },
    data: { status: PublicationStatus.PUBLISHED },
  })
}

export type PrepareSeededCourseLearningAnalyticsOptions = {
  enabled?: boolean
  valid?: boolean
}

export async function prepareSeededCourseLearningAnalytics({
  enabled = true,
  valid = true,
}: PrepareSeededCourseLearningAnalyticsOptions = {}) {
  const prisma = await getPrisma()
  const computedAt = valid ? new Date() : null
  await prisma.course.update({
    where: { id: COURSE_ID_TEST },
    data: {
      isLearningAnalyticsEnabled: enabled,
      areAnalyticsValid: valid,
      analyticsLastComputedAt: computedAt,
      chatAnalyticsValidAt: computedAt,
    },
  })
}

export async function prepareSeededCourseLearningAnalyticsReadAccess() {
  const prisma = await getPrisma()
  const permission = await prisma.permission.upsert({
    where: {
      courseId_userId: {
        courseId: COURSE_ID_TEST,
        userId: LECTURER_IND_ID,
      },
    },
    create: {
      permissionLevel: PermissionLevel.READ,
      propagation: false,
      course: { connect: { id: COURSE_ID_TEST } },
      user: { connect: { id: LECTURER_IND_ID } },
    },
    update: {
      permissionLevel: PermissionLevel.READ,
      propagation: false,
    },
  })

  await prisma.derivedPermission.upsert({
    where: {
      courseId_userId: {
        courseId: COURSE_ID_TEST,
        userId: LECTURER_IND_ID,
      },
    },
    create: {
      permissionLevel: PermissionLevel.READ,
      derived: false,
      directPermission: { connect: { id: permission.id } },
      course: { connect: { id: COURSE_ID_TEST } },
      user: { connect: { id: LECTURER_IND_ID } },
    },
    update: {
      permissionLevel: PermissionLevel.READ,
      derived: false,
      directPermission: { connect: { id: permission.id } },
    },
  })
}

export async function validateFeatureAvailabilityFixture(
  page: Page,
  options: ValidateFeatureAvailabilityOptions
) {
  await prepareSeededCourseLearningAnalytics()

  // analytics nav item
  await expectFlaggedControl(
    page,
    page.getByTestId('analytics'),
    options.learningAnalytics,
    LEARNING_ANALYTICS_UNAVAILABLE
  )

  // course learning analytics link
  await page.getByTestId('courses').click()
  await page.getByTestId(`course-list-button-${SEEDED_COURSE}`).click()
  await openCourseActionMenu(page, 'course-learning-analytics-link')
  const courseLearningAnalytics = page.getByTestId(
    'course-learning-analytics-link'
  )
  await expectFlaggedControl(
    page,
    courseLearningAnalytics,
    options.learningAnalytics,
    LEARNING_ANALYTICS_UNAVAILABLE
  )
  await expectFlaggedControl(
    page,
    page.getByTestId('course-learning-analytics-settings'),
    options.learningAnalytics,
    LEARNING_ANALYTICS_UNAVAILABLE
  )
  await page.keyboard.press('Escape')

  // sharing buttons per activity type (private preview only)
  await page.getByTestId('courses').click()
  await page.getByTestId(`course-list-button-${SEEDED_COURSE}`).click()

  // Live quiz
  await page.getByTestId('tab-liveQuizzes').click()
  await openActivityActionMenu(
    page,
    'LIVE_QUIZ',
    SEED.liveQuiz,
    `view-activity-log-${SEED.liveQuiz}`
  )
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
  const microLearningAnalytics = `open-analytics-microlearning-${SEED.microlearning}`
  await openActivityActionMenu(
    page,
    'MICRO_LEARNING',
    SEED.microlearning,
    microLearningAnalytics
  )
  await expect(
    page.getByTestId(`view-activity-log-${SEED.microlearning}`)
  ).toBeVisible()
  await expectFlaggedControl(
    page,
    page.getByTestId(microLearningAnalytics),
    options.learningAnalytics,
    LEARNING_ANALYTICS_UNAVAILABLE
  )
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
  const practiceQuizAnalytics = `open-analytics-practice-quiz-${SEED.practiceQuiz}`
  await openActivityActionMenu(
    page,
    'PRACTICE_QUIZ',
    SEED.practiceQuiz,
    practiceQuizAnalytics
  )
  await expect(
    page.getByTestId(`view-activity-log-${SEED.practiceQuiz}`)
  ).toBeVisible()
  await expectFlaggedControl(
    page,
    page.getByTestId(practiceQuizAnalytics),
    options.learningAnalytics,
    LEARNING_ANALYTICS_UNAVAILABLE
  )
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
  await openActivityActionMenu(
    page,
    'GROUP_ACTIVITY',
    SEED.groupActivity,
    `view-activity-log-${SEED.groupActivity}`
  )
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

  // Direct asynchronous evaluation routes remain reachable. The flag controls
  // only the analytics affordance rendered by the shared evaluation header.
  const prisma = await getPrisma()
  const microLearning = await prisma.microLearning.findFirstOrThrow({
    where: { name: SEED.microlearning },
    select: { id: true },
  })
  const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
  await page.goto(`${manageUrl}/microLearning/${microLearning.id}/evaluation`)
  await expectFlaggedControl(
    page,
    page.getByTestId('quiz-analytics'),
    options.learningAnalytics,
    LEARNING_ANALYTICS_UNAVAILABLE
  )
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
