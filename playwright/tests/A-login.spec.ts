import type { Page } from '@playwright/test'
import { cleanupTest } from '../util/cleanup.js'
import {
  LECTURER_PASSWORD,
  LECTURER_SHORTNAME,
  STUDENT_EMAIL,
  STUDENT_PASSWORD,
  STUDENT_USERNAME,
  URL_AUTH,
  URL_CHAT,
  URL_MANAGE,
  URL_STUDENT_LOGIN,
  viewPorts,
} from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'

function getStudentLoginUrl() {
  return process.env.URL_STUDENT_LOGIN ?? URL_STUDENT_LOGIN
}

async function signInStudentFromReturnTarget(page: Page, target: string) {
  await page.context().clearCookies()
  await page.goto(
    `${getStudentLoginUrl()}?redirect_to=${encodeURIComponent(target)}`
  )
  await page
    .getByTestId('username-field')
    .fill(process.env.STUDENT_USERNAME ?? STUDENT_USERNAME)
  await page
    .getByTestId('password-field')
    .fill(process.env.STUDENT_PASSWORD ?? STUDENT_PASSWORD)
  await page.getByTestId('submit-login').click()
}

test('CLEANUP', cleanupTest)

test.describe('Login / Logout workflows for lecturer and students', () => {
  // -------------------------------------------------------------------------
  // Student: basic sign-in and sign-out
  // -------------------------------------------------------------------------
  test('Sign in to student account', async ({ page, useStudentContext }) => {
    await useStudentContext(page, {
      usernameOrEmail: STUDENT_USERNAME,
      password: STUDENT_PASSWORD,
    })
  })

  test('Reject external return target after student sign in', async ({
    page,
  }) => {
    const studentLoginUrl = getStudentLoginUrl()
    const externalTarget = 'http://127.0.0.1:9/external'

    await signInStudentFromReturnTarget(page, externalTarget)

    await expect(page.getByTestId('homepage')).toBeVisible()
    expect(new URL(page.url()).origin).toBe(new URL(studentLoginUrl).origin)
  })

  test('Preserve an absolute PWA return target after student sign in', async ({
    page,
  }) => {
    const pwaTarget = new URL('/practice', getStudentLoginUrl()).toString()

    await signInStudentFromReturnTarget(page, pwaTarget)

    await expect(page).toHaveURL(pwaTarget)
  })

  test('Return participant to the configured chatbot after sign in', async ({
    page,
  }) => {
    const chatUrl = process.env.URL_CHAT ?? URL_CHAT
    const chatTarget = `${chatUrl}/8f9c2e1d-4b7a-4c3e-9f5d-1a2b3c4d5e6f`

    await signInStudentFromReturnTarget(page, chatTarget)

    await expect(page).toHaveURL(chatTarget)
  })

  // -------------------------------------------------------------------------
  // Student: mobile viewport
  // -------------------------------------------------------------------------
  test('Sign in to student account on mobile', async ({
    page,
    useStudentContext,
  }) => {
    await useStudentContext(page, {
      usernameOrEmail: STUDENT_USERNAME,
      password: STUDENT_PASSWORD,
      viewport: 'mobile',
    })

    // restore desktop viewport for subsequent tests
    await page.setViewportSize(viewPorts.default)
  })

  // -------------------------------------------------------------------------
  // Student: avatar profile editing
  // -------------------------------------------------------------------------
  test('Sign in to the student account and tries to modify the profile settings', async ({
    page,
    useStudentContext,
  }) => {
    await useStudentContext(page, {
      usernameOrEmail: STUDENT_USERNAME,
      password: STUDENT_PASSWORD,
      editProfile: true,
    })
  })

  // -------------------------------------------------------------------------
  // Student: password change and revert
  // -------------------------------------------------------------------------
  test('Sign in into student account and modifies the password', async ({
    page,
    useStudentContext,
  }) => {
    const newPassword = 'newPassword123!'

    // Change password
    await useStudentContext(page, {
      usernameOrEmail: STUDENT_USERNAME,
      password: STUDENT_PASSWORD,
      newPassword: newPassword,
    })

    // Revert password back to original
    await useStudentContext(page, {
      usernameOrEmail: STUDENT_USERNAME,
      password: newPassword,
      newPassword: STUDENT_PASSWORD,
    })

    // Confirm revert
    await useStudentContext(page, {
      usernameOrEmail: STUDENT_USERNAME,
      password: STUDENT_PASSWORD,
    })
  })

  // -------------------------------------------------------------------------
  // Student: login via email address
  // -------------------------------------------------------------------------
  test('Sign in into student account with the students email', async ({
    page,
    useStudentContext,
  }) => {
    await useStudentContext(page, {
      usernameOrEmail: STUDENT_EMAIL,
      password: STUDENT_PASSWORD,
    })
  })

  // -------------------------------------------------------------------------
  // Lecturer: delegated login via the Auth app
  // -------------------------------------------------------------------------
  test('Sign in into lecturer account', async ({
    page,
    useLecturerContext,
  }) => {
    await useLecturerContext(page, {
      usernameOrEmail: LECTURER_SHORTNAME,
      password: LECTURER_PASSWORD,
    })
  })

  test('Preserve requested manage page after expired session', async ({
    page,
  }) => {
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const authUrl = process.env.URL_AUTH ?? URL_AUTH
    const requestedPath = '/resources/answerCollections?tab=shared'

    await page.context().clearCookies()
    await page.context().addCookies([
      {
        name: 'next-auth.session-token',
        value: 'expired',
        url: manageUrl,
      },
    ])
    await page.goto(`${manageUrl}${requestedPath}`)
    await expect(page).toHaveURL(
      new RegExp(`^${authUrl.replaceAll('.', '\\.')}`)
    )

    const delegatedLogin = page.getByTestId('delegated-login-button')
    if (await delegatedLogin.isDisabled()) {
      await page.getByTestId('tos-checkbox').click()
    }
    await delegatedLogin.click()
    await page.getByTestId('identifier-field').fill(LECTURER_SHORTNAME)
    await page.getByTestId('password-field').fill(LECTURER_PASSWORD)
    await page.getByRole('button', { name: 'Sign in with Delegation' }).click()

    await expect(page).toHaveURL(`${manageUrl}${requestedPath}`)
  })

  test('Reject unsafe lecturer return targets at manage boundary', async ({
    request,
  }) => {
    const manageUrl = process.env.URL_MANAGE ?? URL_MANAGE
    const authUrl = process.env.URL_AUTH ?? URL_AUTH

    for (const unsafeTarget of [
      'https://invalid.example/external',
      'http://[::1',
    ]) {
      const response = await request.get(
        `${manageUrl}/login?redirect_to=${encodeURIComponent(unsafeTarget)}`,
        { maxRedirects: 0 }
      )

      expect(response.status()).toBe(307)
      const location = response.headers().location
      expect(location).toBeDefined()
      const redirect = new URL(location as string)
      expect(redirect.origin).toBe(new URL(authUrl).origin)
      expect(
        decodeURIComponent(redirect.searchParams.get('redirectTo') ?? '')
      ).toBe(new URL('/', manageUrl).toString())
    }
  })
})
