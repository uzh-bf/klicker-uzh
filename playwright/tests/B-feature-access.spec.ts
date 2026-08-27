import { getPrisma, seedActivities } from '../global-setup.js'
import { openCourseActionMenu } from '../util/actions.js'
import { cleanupTest } from '../util/cleanup.js'
import { COURSE_ID_TEST, SEEDED_COURSE, URL_MANAGE } from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  mockGrowthBookLearningAnalytics,
  prepareSeededAnalyticsActivities,
  prepareSeededCourseLearningAnalytics,
  prepareSeededCourseLearningAnalyticsReadAccess,
  updateLecturerPrivatePreview,
} from '../util/fixtures/manage.js'

test('CLEANUP', cleanupTest)

test.describe('Tests the availability of standard activity creation formats', () => {
  test.beforeAll(async () => {
    await seedActivities()
    await prepareSeededAnalyticsActivities()
  })

  test.afterAll(async () => {
    // Restore the lecturer flag and shared activity fixtures for later specs.
    await cleanupTest()
    await updateLecturerPrivatePreview(true)
  })

  test('Test login for catalyst users and non-catalyst users', async ({
    page,
    loginLecturer,
    loginFreeUser,
    loginIndividualCatalyst,
    loginInstitutionalCatalyst,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await loginFreeUser()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await loginIndividualCatalyst()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await loginInstitutionalCatalyst()
    await expect(page.getByTestId('homepage')).toBeVisible()
  })

  test('Test that all standard creation buttons open for free users', async ({
    page,
    loginFreeUser,
  }) => {
    await loginFreeUser()
    await expect(page.getByTestId('homepage')).toBeVisible()

    for (const [button, firstStep] of [
      ['create-live-quiz', 'insert-live-quiz-name'],
      ['create-practice-quiz', 'insert-practice-quiz-name'],
      ['create-microlearning', 'insert-microlearning-name'],
      ['create-group-activity', 'insert-groupactivity-name'],
    ]) {
      await expect(page.getByTestId(button)).not.toBeDisabled()
      await page.getByTestId(button).click()
      await expect(page.getByTestId(firstStep)).toBeVisible()
      await page.getByTestId('cancel-activity-creation').click()
      await expect(page.getByTestId(button)).toBeVisible()
    }
  })

  test('Test that all standard creation buttons are enabled for catalyst users', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await expect(page.getByTestId('create-live-quiz')).not.toBeDisabled()
    await expect(page.getByTestId('create-practice-quiz')).not.toBeDisabled()
    await expect(page.getByTestId('create-microlearning')).not.toBeDisabled()
    await expect(page.getByTestId('create-group-activity')).not.toBeDisabled()
  })

  test('Verify that learning analytics and private preview features are available for lecturer', async ({
    page,
    loginLecturer,
    validateFeatureAvailability,
  }) => {
    await updateLecturerPrivatePreview(true)
    await loginLecturer()
    await validateFeatureAvailability(page, {
      learningAnalytics: true,
      privatePreview: true,
    })
  })

  test('Verify that only learning analytics is available if private preview is disabled', async ({
    page,
    loginLecturer,
    validateFeatureAvailability,
  }) => {
    await updateLecturerPrivatePreview(false)
    await loginLecturer()
    await validateFeatureAvailability(page, {
      learningAnalytics: true,
      privatePreview: false,
    })
  })

  test('Verify that only private preview features are available if learning analytics is disabled', async ({
    page,
    loginLecturer,
    validateFeatureAvailability,
  }) => {
    await mockGrowthBookLearningAnalytics(page, false)
    await updateLecturerPrivatePreview(true)
    await loginLecturer()
    await validateFeatureAvailability(page, {
      learningAnalytics: false,
      privatePreview: true,
    })
  })

  test('Verify that analytics controls remain visible but disabled without feature access', async ({
    page,
    loginLecturer,
    validateFeatureAvailability,
  }) => {
    await mockGrowthBookLearningAnalytics(page, false)
    await updateLecturerPrivatePreview(false)
    await loginLecturer()
    await validateFeatureAvailability(page, {
      learningAnalytics: false,
      privatePreview: false,
    })
  })

  test('Show analytics to a non-manager without exposing course settings', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await prepareSeededCourseLearningAnalytics()
    await prepareSeededCourseLearningAnalyticsReadAccess()
    await loginIndividualCatalyst()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SEEDED_COURSE}`).click()

    await openCourseActionMenu(page, 'course-learning-analytics-link')
    await expect(
      page.getByTestId('course-learning-analytics-link')
    ).toBeEnabled()
    await expect(
      page.getByTestId('course-learning-analytics-settings')
    ).not.toBeAttached()
  })

  test('Show the pending state while analytics recomputation is incomplete', async ({
    page,
    loginLecturer,
  }) => {
    await prepareSeededCourseLearningAnalytics({ valid: false })
    await loginLecturer()
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/analytics/${COURSE_ID_TEST}/activity`)

    await expect(
      page.getByText(
        'Learning analytics is being prepared for this course. Dashboards become available after the next successful recomputation.'
      )
    ).toBeVisible()
  })

  test('Fail closed in an open analytics tab after an out-of-band disable', async ({
    page,
    context,
    loginLecturer,
  }) => {
    await prepareSeededCourseLearningAnalytics()
    await loginLecturer()
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/analytics/${COURSE_ID_TEST}/activity`)
    await expect(
      page.getByRole('heading', { name: /Activity Dashboard: Testkurs/ })
    ).toBeVisible()

    const secondTab = await context.newPage()
    try {
      await secondTab.goto('about:blank')
      await secondTab.bringToFront()

      const prisma = await getPrisma()
      await prisma.course.update({
        where: { id: COURSE_ID_TEST },
        data: {
          isLearningAnalyticsEnabled: false,
          areAnalyticsValid: false,
          analyticsFinalizedAt: null,
          chatAnalyticsValidAt: null,
        },
      })

      await page.bringToFront()
      await page.evaluate(() => {
        document.dispatchEvent(new Event('visibilitychange'))
        window.dispatchEvent(new Event('focus'))
      })
      await expect(
        page.getByText('Learning analytics is disabled for this course.')
      ).toBeVisible()
    } finally {
      await secondTab.close()
    }
  })

  test('Disable course learning analytics and hide dashboards immediately', async ({
    page,
    loginLecturer,
  }) => {
    await prepareSeededCourseLearningAnalytics()
    await loginLecturer()
    await page.getByTestId('courses').click()
    await page.getByTestId(`course-list-button-${SEEDED_COURSE}`).click()

    await openCourseActionMenu(page, 'course-learning-analytics-settings')
    await page.getByTestId('course-learning-analytics-settings').click()
    await expect(
      page.getByRole('heading', { name: 'Learning analytics settings' })
    ).toBeVisible()
    await page.getByTestId('course-learning-analytics-switch').click()
    await expect(
      page.getByText('Dashboards become unavailable immediately.')
    ).toBeVisible()
    await page.getByTestId('course-learning-analytics-save').click()
    await expect(
      page.getByRole('heading', { name: 'Learning analytics settings' })
    ).not.toBeVisible()

    await openCourseActionMenu(page, 'course-learning-analytics-link')
    const analyticsLink = page.getByTestId('course-learning-analytics-link')
    await expect(analyticsLink).toBeDisabled()
    await analyticsLink.hover()
    await expect(page.getByRole('tooltip')).toContainText(
      'Learning analytics is disabled for this course.'
    )

    const prisma = await getPrisma()
    await expect(
      prisma.course.findUniqueOrThrow({
        where: { id: COURSE_ID_TEST },
        select: {
          isLearningAnalyticsEnabled: true,
          areAnalyticsValid: true,
          analyticsFinalizedAt: true,
          chatAnalyticsValidAt: true,
        },
      })
    ).resolves.toEqual({
      isLearningAnalyticsEnabled: false,
      areAnalyticsValid: false,
      analyticsFinalizedAt: null,
      chatAnalyticsValidAt: null,
    })

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/analytics/${COURSE_ID_TEST}/activity`)
    await expect(
      page.getByText('Learning analytics is disabled for this course.')
    ).toBeVisible()
  })
})
