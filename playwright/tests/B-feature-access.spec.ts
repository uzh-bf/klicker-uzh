import { seedActivities } from '../global-setup.js'
import { cleanupTest } from '../util/cleanup.js'
import { expect, test } from '../util/fixtures.js'
import {
  mockGrowthBookLearningAnalytics,
  prepareSeededAnalyticsActivities,
  updateLecturerPrivatePreview,
} from '../util/fixtures/manage.js'
import { COURSE_ID_TEST, SEEDED_COURSE, URL_MANAGE } from '../util/constants.js'

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

  test('Blocks direct analytics navigation without feature access', async ({
    page,
    loginLecturer,
  }) => {
    let analyticsQueryRequested = false
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        request.postData()?.includes('GetCourseActivityAnalytics')
      ) {
        analyticsQueryRequested = true
      }
    })

    await mockGrowthBookLearningAnalytics(page, false)
    await loginLecturer()
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/analytics/${COURSE_ID_TEST}/activity`)

    await expect(
      page.getByTestId('learning-analytics-access-denied')
    ).toBeVisible()
    expect(analyticsQueryRequested).toBe(false)
  })

  test('Allows direct analytics navigation with feature access', async ({
    page,
    loginLecturer,
  }) => {
    await mockGrowthBookLearningAnalytics(page, true)
    await loginLecturer()
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/analytics`)

    await expect(
      page.getByTestId(`analytics-course-label-${SEEDED_COURSE}`)
    ).toBeVisible()
    await expect(
      page.getByTestId('learning-analytics-access-denied')
    ).not.toBeAttached()
  })
})
