import { expect, test } from '@playwright/test'

const credentials = {
  username:
    process.env.PW_STUDENT_USERNAME ??
    process.env.STUDENT_USERNAME ??
    'testuser1',
  password:
    process.env.PW_STUDENT_PASSWORD ??
    process.env.STUDENT_PASSWORD ??
    'abcdabcd',
}

test.describe('PWA student login smoke', () => {
  test('student can sign in and sign out', async ({ page, context }) => {
    await test.step('Open login page', async () => {
      await page.goto('/login')
      await expect(page.getByTestId('login-logo')).toBeVisible()
    })

    await test.step('Submit credentials and verify successful login', async () => {
      const loginResponsePromise = page.waitForResponse((response) => {
        return (
          response.request().method() === 'POST' &&
          response.url().includes('/api/auth/')
        )
      })

      await page.getByTestId('username-field').fill(credentials.username)
      await page.getByTestId('password-field').fill(credentials.password)
      await page.getByTestId('submit-login').click()

      const loginResponse = await loginResponsePromise
      expect(loginResponse.ok()).toBeTruthy()
      await expect(page.getByTestId('homepage')).toBeVisible()
    })

    await test.step('Verify session cookie exists', async () => {
      const cookies = await context.cookies()
      const hasSessionCookie = cookies.some((cookie) =>
        cookie.name.includes('session-token')
      )
      expect(hasSessionCookie).toBeTruthy()
    })

    await test.step('Logout returns to login page', async () => {
      await page.getByTestId('header-avatar').click()
      await page.getByTestId('logout').click()
      await expect(page.getByTestId('login-logo')).toBeVisible()
    })
  })
})
