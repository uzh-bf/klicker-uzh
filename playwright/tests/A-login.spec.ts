import type { Page } from '@playwright/test'
import { getPrisma } from '../global-setup.js'
import { cleanupTest } from '../util/cleanup.js'
import {
  LECTURER_EMAIL,
  LECTURER_PASSWORD,
  LECTURER_SHORTNAME,
  STUDENT_EMAIL,
  STUDENT_PASSWORD,
  STUDENT_USERNAME,
  URL_AUTH,
  URL_CHAT,
  URL_MANAGE,
  URL_STUDENT_LOGIN,
  USER_ID_TEST,
  viewPorts,
} from '../util/constants.js'
import { expect, test } from '../util/fixtures.js'
import {
  mockBetaEnrollmentGraphQL,
  mockGrowthBookFeatureFlags,
} from '../util/fixtures/manage.js'

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

// The first-login modal only appears while the synthetic seeded lecturer's
// firstLogin flag is true. Each controlled case flips the flag, exercises
// the decision UI, and restores the original value in a finally block so
// later tests never inherit an unset decision.
async function withSyntheticFirstLogin(run: () => Promise<void>) {
  const prisma = await getPrisma()
  const original = await prisma.user.findUniqueOrThrow({
    where: { id: USER_ID_TEST },
    select: { firstLogin: true },
  })
  await prisma.user.update({
    where: { id: USER_ID_TEST },
    data: { firstLogin: true },
  })

  try {
    await run()
  } finally {
    await prisma.user.update({
      where: { id: USER_ID_TEST },
      data: { firstLogin: original.firstLogin },
    })
  }
}

async function interceptInitialSettings(
  page: Page,
  captureVariables: (variables: Record<string, unknown>) => void
) {
  await page.route('**/api/graphql*', async (route) => {
    const rawBody = route.request().postData()
    const body = rawBody
      ? (JSON.parse(rawBody) as {
          operationName?: string
          variables?: Record<string, unknown>
        })
      : undefined

    if (body?.operationName !== 'ChangeInitialSettings') {
      await route.fallback()
      return
    }

    captureVariables(body.variables ?? {})
    await route.fulfill({
      json: {
        data: {
          changeInitialSettings: {
            id: USER_ID_TEST,
            email: LECTURER_EMAIL,
            shortname: LECTURER_SHORTNAME,
            locale: 'en',
            firstLogin: false,
            catalyst: true,
            catalystTier: null,
            __typename: 'User',
          },
        },
      },
    })
  })
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

  // -------------------------------------------------------------------------
  // Lecturer: explicit first-login demo-content decision
  // -------------------------------------------------------------------------
  test('First login requires an explicit demo-content choice before save', async ({
    page,
    loginLecturer,
  }) => {
    let mutationFired = false

    await interceptInitialSettings(page, () => {
      mutationFired = true
    })

    await withSyntheticFirstLogin(async () => {
      await loginLecturer()

      const saveButton = page.getByTestId('first-login-save-settings')
      await expect(
        page.getByTestId('first-login-seed-demo-elements-yes')
      ).toBeVisible()
      await expect(
        page.getByTestId('first-login-seed-demo-elements-no')
      ).toBeVisible()
      await expect(saveButton).toBeDisabled()

      // Keyboard submission (Enter) must not send the mutation while unset.
      await page.getByTestId('first-login-shortname').press('Enter')
      await page.keyboard.press('Enter')
      await page.waitForTimeout(500)
      expect(mutationFired).toBe(false)
      await expect(saveButton).toBeDisabled()
    })
  })

  test('First login surfaces beta enrollment while signup is open', async ({
    page,
    loginLecturer,
  }) => {
    await mockGrowthBookFeatureFlags(page, { betaSignup: true })
    await mockBetaEnrollmentGraphQL(page, {
      membership: false,
      mayChange: true,
      signupAvailable: true,
    })

    await withSyntheticFirstLogin(async () => {
      await loginLecturer()

      await expect(
        page.getByTestId('first-login-beta-enrollment')
      ).toBeVisible()
      await expect(page.getByTestId('beta-enrollment-switch')).not.toBeChecked()
      await expect(page.getByTestId('first-login-save-settings')).toBeDisabled()
    })
  })

  for (const choice of [
    {
      label: 'true',
      value: true,
      testId: 'first-login-seed-demo-elements-yes',
    },
    {
      label: 'false',
      value: false,
      testId: 'first-login-seed-demo-elements-no',
    },
  ] as const) {
    test(`First login submits an exact ${choice.label} demo-content choice`, async ({
      page,
      loginLecturer,
    }) => {
      let capturedSeedDemoElements: unknown

      await interceptInitialSettings(page, (variables) => {
        capturedSeedDemoElements = variables.seedDemoElements
      })

      await withSyntheticFirstLogin(async () => {
        await loginLecturer()
        await page.getByTestId(choice.testId).click()
        await expect(
          page.getByTestId('first-login-save-settings')
        ).toBeEnabled()
        await page.getByTestId('first-login-save-settings').click()

        await expect(
          page.getByTestId('first-login-save-settings')
        ).not.toBeVisible({ timeout: 15000 })
        expect(capturedSeedDemoElements).toBe(choice.value)
        expect(typeof capturedSeedDemoElements).toBe('boolean')
      })
    })
  }

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
