import type {
  APIRequestContext,
  Page,
  Request,
  Response as PlaywrightResponse,
} from '@playwright/test'
import { seedActivities } from '../global-setup.js'
import { cleanupTest } from '../util/cleanup.js'
import { expect, test } from '../util/fixtures.js'
import {
  mockGrowthBookLearningAnalytics,
  prepareSeededAnalyticsActivities,
  updateLecturerPrivatePreview,
} from '../util/fixtures/manage.js'
import { COURSE_ID_TEST, SEEDED_COURSE, URL_MANAGE } from '../util/constants.js'

function getGraphqlOperationName(request: Request) {
  const getOperationName = new URL(request.url()).searchParams.get(
    'operationName'
  )
  if (getOperationName) return getOperationName

  const postData = request.postData()
  if (!postData) return undefined

  try {
    return (JSON.parse(postData) as { operationName?: string }).operationName
  } catch {
    return undefined
  }
}

async function setBackendGrowthBookLearningAnalytics(
  request: APIRequestContext,
  enabled: boolean
) {
  const growthbookPort = process.env.GROWTHBOOK_TEST_PORT ?? '4010'
  const response = await request.post(
    `http://127.0.0.1:${growthbookPort}/__test/learning-analytics?enabled=${enabled}`
  )
  expect(response.ok()).toBe(true)
}

type AnalyticsGraphqlResult = {
  allowed: boolean
  forbidden: boolean
  response: PlaywrightResponse
}

async function loadActivityAnalytics(
  page: Page
): Promise<AnalyticsGraphqlResult> {
  const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
  const analyticsResponsePromise = page.waitForResponse(
    (response) =>
      getGraphqlOperationName(response.request()) ===
      'GetCourseActivityAnalytics',
    { timeout: 5000 }
  )

  await page.goto(`${manageUrl}/analytics/${COURSE_ID_TEST}/activity`, {
    timeout: 5000,
  })

  const response = await analyticsResponsePromise
  const body = (await response.json()) as {
    errors?: Array<{ extensions?: { code?: string } }>
  }
  const forbidden = Boolean(
    body.errors?.some((error) => error.extensions?.code === 'FORBIDDEN')
  )

  return {
    allowed: response.ok() && !body.errors?.length,
    forbidden,
    response,
  }
}

async function waitForBackendGrowthBookLearningAnalytics(
  page: Page,
  enabled: boolean
): Promise<AnalyticsGraphqlResult> {
  let result: AnalyticsGraphqlResult | undefined

  await expect
    .poll(
      async () => {
        result = await loadActivityAnalytics(page)
        return enabled ? result.allowed : result.forbidden
      },
      {
        intervals: [100, 250, 500],
        message: `Wait for backend learning analytics entitlement to become ${enabled ? 'enabled' : 'disabled'}`,
        timeout: 15_000,
      }
    )
    .toBe(true)

  if (!result) {
    throw new Error('Backend learning analytics decision was not observed')
  }

  return result
}

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
      if (getGraphqlOperationName(request) === 'GetCourseActivityAnalytics') {
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
    request,
  }) => {
    await setBackendGrowthBookLearningAnalytics(request, true)
    await mockGrowthBookLearningAnalytics(page, true)
    await loginLecturer()
    const analyticsResult = await waitForBackendGrowthBookLearningAnalytics(
      page,
      true
    )
    expect(analyticsResult.response.ok()).toBe(true)
    await expect(
      page.getByRole('heading', {
        name: `Activity Dashboard: ${SEEDED_COURSE}`,
      })
    ).toBeVisible()

    await expect(
      page.getByTestId('learning-analytics-access-denied')
    ).not.toBeAttached()
  })

  test('Denies analytics data when the backend entitlement is false', async ({
    page,
    loginLecturer,
    request,
  }) => {
    await mockGrowthBookLearningAnalytics(page, true)
    await loginLecturer()
    await setBackendGrowthBookLearningAnalytics(request, false)

    try {
      const analyticsResult = await waitForBackendGrowthBookLearningAnalytics(
        page,
        false
      )
      expect(analyticsResult.response.ok()).toBe(true)
      expect(analyticsResult.forbidden).toBe(true)
    } finally {
      await setBackendGrowthBookLearningAnalytics(request, true)
      await waitForBackendGrowthBookLearningAnalytics(page, true)
    }
  })

  test('Shows analytics unavailable when the user profile cannot load', async ({
    page,
    loginLecturer,
  }) => {
    await page.route('**/api/graphql*', async (route) => {
      if (getGraphqlOperationName(route.request()) === 'UserProfile') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [{ message: 'Synthetic user profile failure' }],
          }),
        })
        return
      }

      await route.continue()
    })

    await loginLecturer()
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/analytics/${COURSE_ID_TEST}/activity`)

    await expect(
      page.getByTestId('learning-analytics-access-denied')
    ).toBeVisible()
    await expect(page.getByText('Loading analytics data')).not.toBeAttached()
  })
})
