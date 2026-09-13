import { expect, test } from '../util/fixtures.js'
import { URL_AUTH, URL_MANAGE } from '../util/constants.js'
import {
  mockManageAiCapability,
  mockManageUserProfileUnavailable,
  mockGrowthBookFeatureFlags,
  mockBetaEnrollmentGraphQL,
} from '../util/fixtures/manage.js'

test.describe('AI beta availability recovery', () => {
  test.beforeEach(async ({ page }) => {
    // Isolate the approval-gated surfaces from independent chatbot authoring.
    await mockGrowthBookFeatureFlags(page, { aiBeta: false })
  })

  for (const failure of ['preference-refresh', 'older-capability'] as const) {
    test(`confirmed opt-out wins over ${failure}`, async ({
      loginLecturer,
      page,
    }) => {
      await mockGrowthBookFeatureFlags(page, { aiBeta: true })
      await mockManageAiCapability(page, 'ENABLED')
      await mockBetaEnrollmentGraphQL(page, {
        membership: true,
        mayChange: true,
        signupAvailable: true,
        failPreferenceRefresh: failure === 'preference-refresh',
      })
      await loginLecturer()
      await page.goto(`${process.env.URL_MANAGE ?? URL_MANAGE}/user/settings`)
      await page.getByTestId('resources').click()
      await expect(page.getByTestId('knowledge-bases')).toBeVisible()
      await page.keyboard.press('Escape')
      const toggle = page.getByTestId('beta-enrollment-switch')
      await expect(toggle).toBeChecked()

      let release: (() => void) | undefined
      let fulfilled: Promise<void> | undefined
      if (failure === 'older-capability') {
        let requested!: () => void
        const requestStarted = new Promise<void>((resolve) => {
          requested = resolve
        })
        const held = new Promise<void>((resolve) => {
          release = resolve
        })
        let completed!: () => void
        fulfilled = new Promise<void>((resolve) => {
          completed = resolve
        })
        await page.route('**/api/graphql*', async (route) => {
          const request = route.request()
          const operation =
            new URL(request.url()).searchParams.get('operationName') ??
            request.postDataJSON()?.operationName
          if (operation !== 'ManageAiCapability') {
            await route.fallback()
            return
          }
          requested()
          try {
            await held
            await route.fulfill({
              json: { data: { manageAiCapability: 'ENABLED' } },
            })
          } finally {
            completed()
          }
        })
        await page.evaluate(() => window.dispatchEvent(new Event('focus')))
        await requestStarted
      }

      try {
        await toggle.click()
        await expect(toggle).not.toBeChecked()
        await page.getByTestId('resources').click()
        await expect(page.getByTestId('knowledge-bases')).not.toBeAttached()
        await page.keyboard.press('Escape')
        release?.()
        await fulfilled
        await page.evaluate(
          () =>
            new Promise<void>((resolve) =>
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve())
              )
            )
        )
        if (failure === 'preference-refresh') {
          await expect(
            page.getByTestId('beta-enrollment-refresh-failure')
          ).toBeVisible()
        }
        await page.getByTestId('resources').click()
        await expect(page.getByTestId('knowledge-bases')).not.toBeAttached()
        await page.keyboard.press('Escape')
      } finally {
        release?.()
      }
    })
  }

  test('keeps AI resource and generation actions visible while unavailable and recovers without a reload', async ({
    loginLecturer,
    page,
  }, testInfo) => {
    const capability = await mockManageAiCapability(page, 'ENABLED')
    await loginLecturer()

    const generateElements = page.getByTestId('generate-elements')
    await expect(generateElements).toBeVisible()
    await expect(generateElements).toBeEnabled()
    await testInfo.attach('ai-navigation-enabled', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })

    capability.setState('TEMPORARILY_UNAVAILABLE')
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))

    await expect(generateElements).toBeVisible()
    await expect(generateElements).toBeDisabled()
    await page.getByTestId('resources').click()
    await expect(page.getByTestId('knowledge-bases')).toBeVisible()
    await expect(page.getByTestId('knowledge-bases')).toBeDisabled()
    await testInfo.attach('ai-navigation-unavailable', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    await page.keyboard.press('Escape')

    capability.setState('ENABLED')
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(generateElements).toBeEnabled()
    await page.getByTestId('resources').click()
    await expect(page.getByTestId('knowledge-bases')).toBeEnabled()
    expect(capability.requestCount).toBeGreaterThanOrEqual(3)
  })

  test('keeps a direct AI route stable and recovers with its retry action', async ({
    loginLecturer,
    page,
  }) => {
    const capability = await mockManageAiCapability(
      page,
      'TEMPORARILY_UNAVAILABLE'
    )
    await loginLecturer()

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/elements/generate`)
    await expect(page.getByTestId('ai-beta-unavailable')).toBeVisible()
    await expect(page.getByTestId('ai-beta-retry')).toBeVisible()

    capability.setState('ENABLED')
    await page.getByTestId('ai-beta-retry').click()

    await expect(page.getByTestId('ai-beta-unavailable')).not.toBeAttached()
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page).toHaveURL(`${manageUrl}/elements/generate`)
    expect(capability.requestCount).toBeGreaterThan(1)
  })

  test('hides AI navigation for an explicit disabled capability', async ({
    loginLecturer,
    page,
  }) => {
    const capability = await mockManageAiCapability(page, 'DISABLED')
    await loginLecturer()

    await page.getByTestId('resources').click()
    await expect(page.getByTestId('knowledge-bases')).not.toBeAttached()
    await page.keyboard.press('Escape')

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/elements/generate`)
    await expect(page.getByTestId('ai-beta-unavailable')).toBeVisible()
    expect(capability.requestCount).toBeGreaterThan(0)
  })

  test('stops capability recovery after the session expires', async ({
    loginLecturer,
    page,
  }) => {
    await mockManageAiCapability(page, 'ENABLED')
    await loginLecturer()
    await expect(page.getByTestId('generate-elements')).toBeEnabled()
    await page.clock.install()
    let requests = 0
    await page.route('**/api/graphql*', async (route) => {
      const request = route.request()
      const operation =
        new URL(request.url()).searchParams.get('operationName') ??
        request.postDataJSON()?.operationName
      if (operation !== 'ManageAiCapability') {
        await route.fallback()
        return
      }
      requests += 1
      await route.fulfill({
        json: { errors: [{ message: 'Unauthorized' }] },
      })
    })
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    const authOrigin = new URL(process.env.URL_AUTH ?? URL_AUTH).origin
    await expect(page).toHaveURL((url) => url.origin === authOrigin)
    const loginUrl = page.url()
    expect(new URL(loginUrl).searchParams.get('redirectTo')).toBe(
      `${process.env.URL_MANAGE ?? URL_MANAGE}/`
    )
    await page.clock.fastForward(120_000)
    await page.evaluate(() => {
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('online'))
    })
    await page.clock.fastForward(120_000)
    expect(requests).toBe(1)
    await expect(page).toHaveURL(loginUrl)
  })

  test('hides AI navigation when the user profile cannot be resolved', async ({
    loginLecturer,
    page,
  }) => {
    await loginLecturer()

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const isolatedPage = await page.context().newPage()
    try {
      const capability = await mockManageAiCapability(isolatedPage, 'ENABLED')
      const profile = await mockManageUserProfileUnavailable(isolatedPage)

      await isolatedPage.goto(manageUrl)
      await profile.fulfilled
      await expect(isolatedPage.getByRole('menubar').first()).toBeVisible()
      await isolatedPage.getByTestId('resources').click()
      await expect(
        isolatedPage.getByTestId('knowledge-bases')
      ).not.toBeAttached()
      await expect(isolatedPage.getByTestId('chatbots')).not.toBeAttached()
      expect(capability.requestCount).toBe(0)
    } finally {
      await isolatedPage.close()
    }
  })
})
