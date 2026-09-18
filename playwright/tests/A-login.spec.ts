import type { Page, Request } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { PARTICIPANT_DATA_USE_DISCLOSURE_VERSION } from '../../packages/util/src/participantAccountDataUse.js'
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

// Apollo sends mutations as POST bodies and persisted-query reads as GET
// requests carrying the operation name in the query string, so both have to
// be read to identify an operation at the network layer.
function getGraphQLOperationName(request: Request) {
  if (request.method() === 'POST') {
    const postData = request.postData()
    return postData
      ? (JSON.parse(postData) as { operationName?: string }).operationName
      : undefined
  }
  return new URL(request.url()).searchParams.get('operationName') ?? undefined
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

  // -------------------------------------------------------------------------
  // Student: normal signup records both optional refusals; saving stays
  // disabled until the explicit learning-analytics choice and acknowledgement
  // -------------------------------------------------------------------------
  test('Signup requires learning analytics choice and acknowledgement', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    const username = `su${Date.now().toString(36).slice(-8)}`

    try {
      await page.context().clearCookies()
      await page.goto('/createAccount')

      await page.getByTestId('email-field').fill(`${username}@test.uzh.ch`)
      await page.getByTestId('username-field-account-creation').fill(username)
      await page.getByTestId('password-field').fill('signupPassword123!')
      await page
        .getByTestId('password-repetition-field')
        .fill('signupPassword123!')

      const submit = page.getByTestId('create-profile-button')
      // The learning-analytics choice starts unanswered and the acknowledgement
      // is unchecked, so saving is blocked until both are provided.
      await expect(submit).toBeDisabled()

      await expect(page.getByTestId('research-consent-no')).toBeHidden()
      await page.getByTestId('research-consent-toggle').click()
      await page.getByTestId('research-consent-no').click()
      await expect(submit).toBeDisabled()

      await page.getByTestId('learning-analytics-consent-no').click()
      await expect(submit).toBeDisabled()

      await page.getByTestId('tos-checkbox').click()
      await expect(submit).toBeEnabled()
      await submit.click()

      await expect(page).toHaveURL(/newAccount=true/)

      const participant = await prisma.participant.findUniqueOrThrow({
        where: { username },
        select: {
          researchConsent: true,
          learningAnalyticsConsent: true,
          researchConsentChoiceAt: true,
          learningAnalyticsChoiceAt: true,
          dataUseAcknowledgedAt: true,
          dataUseAcknowledgedVersion: true,
        },
      })
      expect(participant.researchConsent).toBe(false)
      expect(participant.learningAnalyticsConsent).toBe(false)
      expect(participant.researchConsentChoiceAt).toBeInstanceOf(Date)
      expect(participant.learningAnalyticsChoiceAt).toBeInstanceOf(Date)
      expect(participant.dataUseAcknowledgedAt).toBeInstanceOf(Date)
      expect(participant.dataUseAcknowledgedVersion).toBe(
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION
      )
    } finally {
      await prisma.participant.deleteMany({ where: { username } })
    }
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

  test('Participant data-use choices are independent and persist', async ({
    page,
    loginStudent,
  }) => {
    await loginStudent()
    await expect(page.getByTestId('homepage')).toBeVisible()
    await page.getByTestId('header-avatar').click()
    await page.getByTestId('participant-profile-login').click()
    await page.getByTestId('edit-profile').click()

    const researchConsent = page.getByTestId('participant-research-consent')
    const learningAnalyticsConsent = page.getByTestId(
      'participant-learning-analytics-consent'
    )

    await expect(researchConsent).toBeVisible()
    await expect(learningAnalyticsConsent).toBeVisible()

    try {
      await expect(researchConsent).toHaveAttribute('aria-checked', 'false')
      await expect(learningAnalyticsConsent).toHaveAttribute(
        'aria-checked',
        'false'
      )

      let failedResearchSaves = 0
      await page.route('**/api/graphql', async (route) => {
        const request = route.request()
        const operationName = getGraphQLOperationName(request)

        if (
          request.method() === 'POST' &&
          operationName === 'SetResearchConsent'
        ) {
          failedResearchSaves += 1
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { setResearchConsent: null },
              errors: [{ message: 'Synthetic save failure' }],
            }),
          })
          return
        }

        await route.continue()
      })

      await researchConsent.click()
      await expect.poll(() => failedResearchSaves).toBe(1)
      await expect(researchConsent).toBeEnabled()
      await expect(researchConsent).toHaveAttribute('aria-checked', 'false')
      await expect(learningAnalyticsConsent).toHaveAttribute(
        'aria-checked',
        'false'
      )
      await page.unroute('**/api/graphql')

      await researchConsent.click()
      await expect(researchConsent).toHaveAttribute('aria-checked', 'true')
      await expect(learningAnalyticsConsent).toHaveAttribute(
        'aria-checked',
        'false'
      )
      await page.reload()
      await expect(researchConsent).toHaveAttribute('aria-checked', 'true')
      await expect(learningAnalyticsConsent).toHaveAttribute(
        'aria-checked',
        'false'
      )

      await researchConsent.click()
      await expect(researchConsent).toHaveAttribute('aria-checked', 'false')
      await expect(learningAnalyticsConsent).toBeEnabled()
      await learningAnalyticsConsent.click()
      await expect(learningAnalyticsConsent).toHaveAttribute(
        'aria-checked',
        'true'
      )

      await page.reload()
      await expect(researchConsent).toHaveAttribute('aria-checked', 'false')
      await expect(learningAnalyticsConsent).toHaveAttribute(
        'aria-checked',
        'true'
      )

      await page.getByTestId('header-avatar').click()
      await page.getByTestId('participant-profile-login').click()
      await page.getByTestId('edit-profile').click()
      await expect(researchConsent).toHaveAttribute('aria-checked', 'false')
      await expect(learningAnalyticsConsent).toHaveAttribute(
        'aria-checked',
        'true'
      )
    } finally {
      await page.unroute('**/api/graphql')
      await page.reload()

      // Leave the shared test account at the fail-closed baseline.
      for (const consentSwitch of [researchConsent, learningAnalyticsConsent]) {
        if ((await consentSwitch.getAttribute('aria-checked')) === 'true') {
          await consentSwitch.click()
          if (consentSwitch === learningAnalyticsConsent) {
            await page
              .getByTestId('confirm-learning-analytics-withdrawal')
              .click()
          }
          await expect(consentSwitch).toHaveAttribute('aria-checked', 'false')
        }
      }
    }
  })

  // -------------------------------------------------------------------------
  // Student: two-tab completion retry must not overwrite a newer decision
  // -------------------------------------------------------------------------
  test('Two-tab completion retry cannot overwrite a newer decision', async ({
    page,
    browser,
    loginStudentPassword,
  }) => {
    const prisma = await getPrisma()
    const username = 'dpo' + Date.now().toString(36).slice(-8)
    const password = process.env.STUDENT_PASSWORD ?? STUDENT_PASSWORD
    const graphqlRoute = '**/api/graphql'
    const completionOperation = 'CompleteParticipantDataUse'
    const dataUseQueryOperation = 'GetParticipantAccountDataUse'

    // A dedicated participant without acknowledgement or recorded choices,
    // so the account-completion gate routes the first request to the form.
    await prisma.participant.create({
      data: {
        username,
        email: `${username}@test.uzh.ch`,
        password: await bcrypt.hash(password, 12),
      },
    })

    const secondContext = await browser.newContext({
      ignoreHTTPSErrors: true,
    })
    const secondPage = await secondContext.newPage()
    const dataCy = (id: string) => `[data-cy="${id}"]`

    // Hold tab A's post-failure refetch until tab B has committed, so the
    // ordering is deterministic instead of racy.
    let releaseRefetch: () => void = () => {}
    const refetchGate = new Promise<void>((resolve) => {
      releaseRefetch = resolve
    })

    try {
      await loginStudentPassword(username)
      await expect(page).toHaveURL(/\/account\/data-use$/)

      let failedCompletions = 0
      await page.route(graphqlRoute, async (route) => {
        const operationName = getGraphQLOperationName(route.request())

        // The completion request fails with a generic (non-conflict) error,
        // which previously left the local intent and acknowledgement intact.
        // Only this first attempt fails; the deliberate retry after the
        // reload must reach the API.
        if (operationName === completionOperation && failedCompletions === 0) {
          failedCompletions += 1
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              data: { completeParticipantDataUse: null },
              errors: [{ message: 'Synthetic network failure' }],
            }),
          })
          return
        }

        // The failure path refetches the persisted state. Delay that read
        // until tab B has advanced the revision.
        if (operationName === dataUseQueryOperation && failedCompletions > 0) {
          await refetchGate
        }

        await route.continue()
      })

      // Tab A selects Learning Analytics = yes and submits.
      await page.getByTestId('account-data-use-analytics-true').click()
      await page.getByTestId('account-data-use-acknowledged').click()
      await expect(page.getByTestId('account-data-use-submit')).toBeEnabled()
      await page.getByTestId('account-data-use-submit').click()
      await expect.poll(() => failedCompletions).toBe(1)

      // Tab B completes with both refusals and advances the revision.
      await secondPage.goto(process.env.URL_STUDENT_LOGIN ?? URL_STUDENT_LOGIN)
      await secondPage.locator(dataCy('username-field')).fill(username)
      await secondPage.locator(dataCy('password-field')).fill(password)
      await secondPage.locator(dataCy('submit-login')).click()
      await expect(secondPage).toHaveURL(/\/account\/data-use$/)

      await secondPage
        .locator(dataCy('account-data-use-research-toggle'))
        .click()
      await secondPage
        .locator(dataCy('account-data-use-research-false'))
        .click()
      await secondPage
        .locator(dataCy('account-data-use-analytics-false'))
        .click()
      await secondPage.locator(dataCy('account-data-use-acknowledged')).click()
      await secondPage.locator(dataCy('account-data-use-submit')).click()
      await expect(secondPage).not.toHaveURL(/\/account\/data-use$/)

      const afterSecondTab = await prisma.participant.findUniqueOrThrow({
        where: { username },
        select: {
          researchConsent: true,
          learningAnalyticsConsent: true,
          dataUseRevision: true,
        },
      })
      expect(afterSecondTab.researchConsent).toBe(false)
      expect(afterSecondTab.learningAnalyticsConsent).toBe(false)
      expect(afterSecondTab.dataUseRevision).toBeGreaterThan(0)

      // Let tab A's refetch resolve. It reloads tab B's newer decision and
      // drops the local intent and acknowledgement, so a retry cannot show the
      // stale choice or silently overwrite tab B.
      releaseRefetch()
      await expect(
        page.getByTestId('account-data-use-analytics-false')
      ).toHaveAttribute('aria-checked', 'true')
      await expect(page.getByTestId('account-data-use-submit')).toBeDisabled()
      await expect(
        page.getByTestId('account-data-use-acknowledged')
      ).toHaveAttribute('aria-checked', 'false')

      // A deliberate re-acknowledgement then commits the reloaded choices.
      await page.getByTestId('account-data-use-acknowledged').click()
      await expect(page.getByTestId('account-data-use-submit')).toBeEnabled()
      await page.getByTestId('account-data-use-submit').click()
      await expect(page).not.toHaveURL(/\/account\/data-use$/)

      const finalState = await prisma.participant.findUniqueOrThrow({
        where: { username },
        select: { researchConsent: true, learningAnalyticsConsent: true },
      })
      expect(finalState.researchConsent).toBe(false)
      expect(finalState.learningAnalyticsConsent).toBe(false)
    } finally {
      releaseRefetch()
      await page.unroute(graphqlRoute)
      await secondContext.close()
      await prisma.participant.deleteMany({ where: { username } })
    }
  })

  // -------------------------------------------------------------------------
  // Student: password change and revert
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

  test('First login surfaces beta enrollment for eligible users', async ({
    page,
    loginLecturer,
  }) => {
    await mockGrowthBookFeatureFlags(page)
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
