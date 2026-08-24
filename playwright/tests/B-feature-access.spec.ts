import type { Page } from '@playwright/test'
import { seedActivities } from '../global-setup.js'
import { cleanupTest } from '../util/cleanup.js'
import { expect, test } from '../util/fixtures.js'
import {
  mockGrowthBookLearningAnalytics,
  prepareSeededAnalyticsActivities,
  updateLecturerPrivatePreview,
} from '../util/fixtures/manage.js'

test('CLEANUP', cleanupTest)

const standardActivityDescriptions = [
  {
    button: 'create-live-quiz',
    description: 'description-create-live-quiz',
    firstStep: 'insert-live-quiz-name',
    text: /Live quizzes can be used to promote interactivity in lectures, seminars and workshops/,
    href: 'https://www.klicker.uzh.ch/use_cases/live_quiz/',
  },
  {
    button: 'create-practice-quiz',
    description: 'description-create-practice-quiz',
    firstStep: 'insert-practice-quiz-name',
    text: /Practice quizzes can be used to prepare for exams and to review learning content/,
    href: 'https://www.klicker.uzh.ch/use_cases/practice_quiz/',
  },
  {
    button: 'create-microlearning',
    description: 'description-create-microlearning',
    firstStep: 'insert-microlearning-name',
    text: /Microlearnings can be solved by students within a specified timespan/,
    href: 'https://www.klicker.uzh.ch/use_cases/microlearning/',
  },
  {
    button: 'create-group-activity',
    description: 'description-create-group-activity',
    firstStep: 'insert-groupactivity-name',
    text: /Group activities can be solved once per group and require collaboration/,
    href: 'https://www.klicker.uzh.ch/use_cases/group_activity/',
  },
] as const

async function expectStandardActivityChoiceGuidance(page: Page) {
  const choiceRegion = page.getByTestId('activity-creation-choices')

  for (const activity of standardActivityDescriptions) {
    await expect(page.getByTestId(activity.button)).not.toBeDisabled()
    await expect(page.getByTestId(activity.description)).toBeVisible()
    await expect(page.getByTestId(activity.description)).toContainText(
      activity.text
    )
    await expect(
      page.getByTestId(activity.description).getByRole('link')
    ).toHaveAttribute('href', activity.href)
    await expect(
      page.getByTestId(activity.description).getByRole('link')
    ).toHaveAttribute('target', '_blank')
    await expect(
      page.getByTestId(activity.description).getByRole('link')
    ).toHaveClass(/underline/)
    const describedBy = await page
      .getByTestId(activity.button)
      .getAttribute('aria-describedby')
    expect(describedBy).toBe(activity.description)
    await expect(page.getByTestId(activity.description)).not.toContainText(
      /catalyst/i
    )
  }

  await expect(choiceRegion).not.toContainText(/catalyst/i)
  await expect(choiceRegion.locator('a[href*="catalyst" i]')).toHaveCount(0)
  await expect(choiceRegion.locator('[data-cy*="catalyst" i]')).toHaveCount(0)
  await expect(choiceRegion.locator('[data-icon="crown"]')).toHaveCount(0)
}

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

    await expectStandardActivityChoiceGuidance(page)

    for (const activity of standardActivityDescriptions) {
      await expect(page.getByTestId(activity.button)).not.toBeDisabled()
      await page.getByTestId(activity.button).click()
      await expect(page.getByTestId(activity.firstStep)).toBeVisible()
      await page.getByTestId('cancel-activity-creation').click()
      await expect(page.getByTestId(activity.button)).toBeVisible()
    }
  })

  test('Test that all standard creation buttons are enabled for catalyst users', async ({
    page,
    loginLecturer,
  }) => {
    await loginLecturer()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await expectStandardActivityChoiceGuidance(page)
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
})
