import { expect, test } from '../util/fixtures.js'
import { URL_MANAGE } from '../util/constants.js'
import {
  mockManageAiCapability,
  mockManageUserProfileUnavailable,
} from '../util/fixtures/manage.js'

test.describe('AI beta availability recovery', () => {
  test('keeps the AI entry visible while unavailable and recovers without a reload', async ({
    loginLecturer,
    page,
  }, testInfo) => {
    const capability = await mockManageAiCapability(page, 'ENABLED')
    await loginLecturer()

    const aiMenu = page.getByTestId('ai')
    await expect(aiMenu).toBeVisible()
    await expect(aiMenu).toBeEnabled()
    await testInfo.attach('ai-navigation-enabled', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })

    capability.setState('TEMPORARILY_UNAVAILABLE')
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))

    await expect(aiMenu).toBeVisible()
    await expect(aiMenu).toBeDisabled()
    await aiMenu.hover()
    await expect(page.getByTestId('ai-disabled-reason')).toBeVisible()
    await testInfo.attach('ai-navigation-unavailable', {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
    await page.keyboard.press('Escape')

    capability.setState('ENABLED')
    await page.evaluate(() => window.dispatchEvent(new Event('focus')))
    await expect(aiMenu).toBeEnabled()
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

    await expect(page.getByTestId('ai')).not.toBeAttached()

    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    await page.goto(`${manageUrl}/elements/generate`)
    await expect(page.getByTestId('ai-beta-unavailable')).toBeVisible()
    expect(capability.requestCount).toBeGreaterThan(0)
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
      await expect(isolatedPage.getByTestId('ai')).not.toBeAttached()
      expect(capability.requestCount).toBe(0)
    } finally {
      await isolatedPage.close()
    }
  })
})
