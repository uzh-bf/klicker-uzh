import type { Page } from '@playwright/test'
import { seedActivities } from '../global-setup.js'
import { readFile } from 'node:fs/promises'
import { LECTURER_EMAIL, URL_MANAGE, USER_ID_TEST } from '../util/constants.js'
import { cleanupTest } from '../util/cleanup.js'
import { expect, test } from '../util/fixtures.js'
import {
  mockBetaEnrollmentGraphQL,
  mockGrowthBookFeatureFlags,
  mockGrowthBookLearningAnalytics,
  prepareSeededAnalyticsActivities,
  updateLecturerPrivatePreview,
} from '../util/fixtures/manage.js'

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
})

test.describe('Beta feature enrollment discovery', () => {
  test('Unknown membership keeps information visible without guessing enrollment', async ({
    page,
    loginLecturer,
  }) => {
    await mockGrowthBookFeatureFlags(page, { aiBeta: true, betaSignup: true })
    await mockBetaEnrollmentGraphQL(page, {
      membership: null,
      mayChange: true,
      signupAvailable: true,
    })
    await loginLecturer()
    await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/user/settings`)
    await expect(page.getByTestId('beta-enrollment-section')).toBeVisible()
    await expect(page.getByTestId('beta-enrollment-unavailable')).toBeVisible()
    await expect(page.getByTestId('beta-enrollment-switch')).not.toBeAttached()
  })

  test('First login explains chatbot beta features even when signup is closed', async ({
    page,
    loginLecturer,
  }) => {
    await mockGrowthBookFeatureFlags(page)
    await mockBetaEnrollmentGraphQL(page, {
      membership: false,
      mayChange: false,
      signupAvailable: false,
    })
    const persisted = JSON.parse(
      await readFile(
        new URL(
          '../../packages/graphql/src/public/client.json',
          import.meta.url
        ),
        'utf8'
      )
    ) as Record<string, string>
    await page.route('**/api/graphql*', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const body = request.postData() ? request.postDataJSON() : undefined
      const extensions =
        body?.extensions ??
        JSON.parse(url.searchParams.get('extensions') ?? '{}')
      const name = body?.operationName ?? url.searchParams.get('operationName')
      const hash = extensions?.persistedQuery?.sha256Hash
      const isProfileQuery = ['UserProfile', 'ManageUserProfile'].some(
        (profileName) =>
          name === profileName || (hash && hash === persisted[profileName])
      )
      if (!isProfileQuery) {
        await route.fallback()
        return
      }
      const response = await route.fetch()
      const json = await response.json()
      expect(json.data?.userProfile).toBeTruthy()
      json.data.userProfile.firstLogin = true
      await route.fulfill({ response, json })
    })
    await loginLecturer()
    await expect(page.getByTestId('first-login-beta-enrollment')).toBeVisible()
    await expect(page.getByTestId('beta-enrollment-switch')).not.toBeAttached()
  })

  test('Eligible Catalyst users reach enrollment through settings', async ({
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
    await expect(page.getByTestId('menu-beta-features')).not.toBeAttached()
    await page.getByTestId('menu-user-settings').click()

    await expect(page).toHaveURL(/\/user\/settings$/)
    await expect(page.getByTestId('beta-enrollment-section')).toBeVisible()
    await expect(page.getByTestId('beta-enrollment-switch')).not.toBeChecked()
  })

  test('Closed signup keeps beta discovery visible without an opt-in control', async ({
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
    await expect(page.getByTestId('menu-user-settings')).toBeVisible()
    await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/user/settings`)
    await expect(page.getByTestId('beta-enrollment-section')).toBeVisible()
    await expect(page.getByTestId('beta-enrollment-switch')).not.toBeAttached()
    await expect(page.getByTestId('beta-enrollment-unavailable')).toBeVisible()
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
    await expect(page.getByTestId('menu-user-settings')).toBeVisible()
    await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/user/settings`)
    const enrollmentSwitch = page.getByTestId('beta-enrollment-switch')
    await expect(enrollmentSwitch).toBeChecked()
    await enrollmentSwitch.click()

    await expect.poll(() => requestedMembership).toBe(false)
    await expect(page.getByTestId('beta-enrollment-section')).toBeVisible()
    await expect(enrollmentSwitch).not.toBeAttached()
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

  test('Non-Catalyst users can discover beta features but cannot enroll', async ({
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
    await expect(page.getByTestId('menu-user-settings')).toBeVisible()
    await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/user/settings`)
    await expect(page.getByTestId('beta-enrollment-section')).toBeVisible()
    await expect(page.getByTestId('beta-enrollment-switch')).not.toBeAttached()
    await expect(page.getByTestId('beta-enrollment-unavailable')).toBeVisible()
  })

  test('Weaker login scopes can discover beta features but cannot enroll', async ({
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
    await expect(page.getByTestId('menu-user-settings')).toBeVisible()
    await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/user/settings`)
    await expect(page.getByTestId('beta-enrollment-section')).toBeVisible()
    await expect(page.getByTestId('beta-enrollment-switch')).not.toBeAttached()
    await expect(page.getByTestId('beta-enrollment-unavailable')).toBeVisible()
  })
})
