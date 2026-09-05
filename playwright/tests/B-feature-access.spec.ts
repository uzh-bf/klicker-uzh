import { readFile } from 'node:fs/promises'
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
  mockBetaEnrollmentGraphQL,
  mockGrowthBookFeatureFlags,
  mockGrowthBookLearningAnalytics,
  prepareSeededAnalyticsActivities,
  updateLecturerPrivatePreview,
} from '../util/fixtures/manage.js'
import {
  COURSE_ID_TEST,
  LECTURER_EMAIL,
  SEEDED_COURSE,
  URL_MANAGE,
  USER_ID_TEST,
} from '../util/constants.js'

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

const standardActivityGuidance = [
  {
    button: 'create-live-quiz',
    description: 'description-create-live-quiz',
    firstStep: 'insert-live-quiz-name',
    text: 'Engage participants live during a session.',
  },
  {
    button: 'create-practice-quiz',
    description: 'description-create-practice-quiz',
    firstStep: 'insert-practice-quiz-name',
    text: 'Let participants review content independently at their own pace.',
  },
  {
    button: 'create-microlearning',
    description: 'description-create-microlearning',
    firstStep: 'insert-microlearning-name',
    text: 'Schedule short learning activities over a defined period.',
  },
  {
    button: 'create-group-activity',
    description: 'description-create-group-activity',
    firstStep: 'insert-groupactivity-name',
    text: 'Let groups collaborate on a shared task.',
  },
] as const

async function expectStandardActivityChoiceGuidance(page: Page) {
  const choiceRegion = page.getByTestId('activity-creation-choices')

  for (const activity of standardActivityGuidance) {
    const button = page.getByTestId(activity.button)
    const description = page.getByTestId(activity.description)

    await expect(button).not.toBeDisabled()
    await expect(description).toBeHidden()
    await button.hover()
    await expect(description).toBeVisible()
    await expect(page.getByTestId(activity.description)).toContainText(
      activity.text
    )
    await button.focus()
    await expect(description).toBeVisible()
    const describedBy = await button.getAttribute('aria-describedby')
    expect(describedBy).toBe(activity.description)
  }

  await expect(choiceRegion).not.toContainText(/catalyst/i)
  await expect(choiceRegion.getByRole('link')).toHaveCount(0)
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

  test('Keep chat account usage hidden when its feature flag is absent', async ({
    page,
    loginLecturer,
  }) => {
    await mockGrowthBookFeatureFlags(page, { aiBeta: false })
    await loginLecturer()

    // Production builds send hashed queries as GET requests without an
    // operationName, so decode the persisted hash back to the operation name.
    const persistedOperations = JSON.parse(
      await readFile(
        new URL(
          '../../packages/graphql/src/public/client.json',
          import.meta.url
        ),
        'utf8'
      )
    ) as Record<string, string>
    const persistedNames: Record<string, string> = {}
    for (const [name, hash] of Object.entries(persistedOperations)) {
      persistedNames[hash] = name
    }

    const graphqlOperations: string[] = []
    page.on('request', (request) => {
      const requestUrl = new URL(request.url())
      if (!requestUrl.pathname.endsWith('/api/graphql')) return

      if (request.method() === 'POST') {
        const postData = request.postData()
        const operationName = postData
          ? (JSON.parse(postData) as { operationName?: string }).operationName
          : undefined
        if (operationName) graphqlOperations.push(operationName)
        return
      }

      const extensions = requestUrl.searchParams.get('extensions')
      const hash = extensions
        ? (
            JSON.parse(extensions) as {
              persistedQuery?: { sha256Hash?: string }
            }
          ).persistedQuery?.sha256Hash
        : undefined
      if (hash) {
        graphqlOperations.push(persistedNames[hash] ?? `persisted:${hash}`)
      }
    })

    await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/user/settings`)
    await expect(page.getByTestId('create-delegated-login')).toBeVisible()
    await expect(
      page.getByTestId('chat-account-usage-boundary')
    ).not.toBeAttached()
    await expect.poll(() => graphqlOperations).toContain('GetUserLogins')
    expect(graphqlOperations).not.toContain('GetChatAccountUsage')
  })

  test('Test that all standard creation buttons open for free users', async ({
    page,
    loginFreeUser,
  }) => {
    await loginFreeUser()
    await expect(page.getByTestId('homepage')).toBeVisible()

    await expectStandardActivityChoiceGuidance(page)

    for (const activity of standardActivityGuidance) {
      await page.getByTestId(activity.button).click()
      await expect(page.getByTestId(activity.firstStep)).toBeVisible()
      await page.getByTestId('cancel-activity-creation').click()
      await expect(page.getByTestId(activity.button)).toBeVisible()
    }
  })

  test('Test that all standard creation buttons are enabled for catalyst users', async ({
    page,
    loginIndividualCatalyst,
  }) => {
    await loginIndividualCatalyst()
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
    await loginLecturer()
    await expect(page.getByTestId('homepage')).toBeVisible()

    let profileFailureInjected = false
    await page.route('**/api/graphql*', async (route) => {
      if (getGraphqlOperationName(route.request()) === 'ManageUserProfile') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            errors: [{ message: 'Synthetic user profile failure' }],
          }),
        })
        profileFailureInjected = true
        return
      }

      await route.continue()
    })

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/analytics/${COURSE_ID_TEST}/activity`)

    await expect.poll(() => profileFailureInjected).toBe(true)
    await expect(
      page.getByTestId('learning-analytics-access-denied')
    ).toBeVisible()
    await expect(page.getByText('Loading analytics data')).not.toBeAttached()
  })
})

test.describe('Beta feature enrollment discovery', () => {
  test('Open signup links eligible Catalyst users to the enrollment setting', async ({
    page,
    loginLecturer,
  }) => {
    await mockGrowthBookFeatureFlags(page, { betaSignup: true })
    await mockBetaEnrollmentGraphQL(page, {
      membership: false,
      mayChange: true,
      signupAvailable: true,
    })
    await loginLecturer()

    await page.getByTestId('user-menu').click()
    await expect(page.getByTestId('menu-beta-features')).toBeVisible()
    await page.getByTestId('menu-beta-features').click()

    await expect(page).toHaveURL(/\/user\/settings#beta-features$/)
    await expect(page.getByTestId('beta-enrollment-section')).toBeVisible()
    await expect(page.getByTestId('beta-enrollment-switch')).not.toBeChecked()
  })

  test('Closed signup hides enrollment from a non-member', async ({
    page,
    loginLecturer,
  }) => {
    await mockGrowthBookFeatureFlags(page)
    await mockBetaEnrollmentGraphQL(page, {
      membership: false,
      mayChange: false,
      signupAvailable: false,
    })
    await loginLecturer()

    await page.getByTestId('user-menu').click()
    await expect(page.getByTestId('menu-beta-features')).not.toBeAttached()
    await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/user/settings`)
    await expect(page.getByTestId('beta-enrollment-section')).not.toBeAttached()
  })

  test('Existing members can opt out after signup closes', async ({
    page,
    loginLecturer,
  }) => {
    let requestedMembership: boolean | undefined
    await mockGrowthBookFeatureFlags(page, { aiBeta: true })
    await mockBetaEnrollmentGraphQL(page, {
      membership: true,
      mayChange: true,
      onSet: (enabled) => {
        requestedMembership = enabled
      },
      signupAvailable: false,
    })
    await loginLecturer()

    await page.getByTestId('user-menu').click()
    await expect(page.getByTestId('menu-beta-features')).not.toBeAttached()
    await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/user/settings`)
    const enrollmentSwitch = page.getByTestId('beta-enrollment-switch')
    await expect(enrollmentSwitch).toBeChecked()
    await enrollmentSwitch.click()

    await expect.poll(() => requestedMembership).toBe(false)
    await expect(page.getByTestId('beta-enrollment-section')).not.toBeAttached()
  })

  test('Enrollment reports pending and feature-refresh failure states', async ({
    page,
    loginLecturer,
  }) => {
    let releaseSetResponse!: () => void
    const setResponseGate = new Promise<void>((resolve) => {
      releaseSetResponse = resolve
    })
    await mockGrowthBookFeatureFlags(page, {
      betaSignup: true,
      failRefresh: true,
    })
    await mockBetaEnrollmentGraphQL(page, {
      beforeSetResponse: () => setResponseGate,
      membership: false,
      mayChange: true,
      signupAvailable: true,
    })
    await loginLecturer()
    await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/user/settings`)

    await page.getByTestId('beta-enrollment-switch').click()
    await expect(page.getByTestId('beta-enrollment-pending')).toBeVisible()
    releaseSetResponse()

    await expect(
      page.getByTestId('beta-enrollment-refresh-failure')
    ).toBeVisible()
  })

  test('Open signup remains hidden from non-Catalyst users', async ({
    page,
    loginFreeUser,
  }) => {
    await mockGrowthBookFeatureFlags(page, { betaSignup: true })
    await mockBetaEnrollmentGraphQL(page, {
      membership: null,
      mayChange: false,
      signupAvailable: true,
    })
    await loginFreeUser()

    await page.getByTestId('user-menu').click()
    await expect(page.getByTestId('menu-beta-features')).not.toBeAttached()
    await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/user/settings`)
    await expect(page.getByTestId('beta-enrollment-section')).not.toBeAttached()
  })

  test('Open signup remains hidden from weaker login scopes', async ({
    page,
    loginFactory,
  }) => {
    await mockGrowthBookFeatureFlags(page, { betaSignup: true })
    await mockBetaEnrollmentGraphQL(page, {
      membership: null,
      mayChange: false,
      signupAvailable: true,
    })
    await loginFactory({
      email: LECTURER_EMAIL,
      sub: USER_ID_TEST,
      role: 'ADMIN',
      scope: 'EDUID',
      catalystInstitutional: true,
      catalystIndividual: true,
    })

    await page.getByTestId('user-menu').click()
    await expect(page.getByTestId('menu-beta-features')).not.toBeAttached()
    await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/user/settings`)
    await expect(page.getByTestId('beta-enrollment-section')).not.toBeAttached()
  })
})
