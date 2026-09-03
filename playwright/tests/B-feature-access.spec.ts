import { seedActivities } from '../global-setup.js'
import { readFile } from 'node:fs/promises'
import { URL_MANAGE } from '../util/constants.js'
import { cleanupTest } from '../util/cleanup.js'
import { expect, test } from '../util/fixtures.js'
import {
  mockGrowthBookLearningAnalytics,
  prepareSeededAnalyticsActivities,
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
      if (!request.url().endsWith('/api/graphql')) return

      if (request.method() === 'POST') {
        const postData = request.postData()
        const operationName = postData
          ? (JSON.parse(postData) as { operationName?: string }).operationName
          : undefined
        if (operationName) graphqlOperations.push(operationName)
        return
      }

      const extensions = new URL(request.url()).searchParams.get('extensions')
      const hash = extensions
        ? (JSON.parse(extensions) as { persistedQuery?: { hash?: string } })
            .persistedQuery?.hash
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
})
