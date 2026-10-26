import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { PARTICIPANT_DATA_USE_DISCLOSURE_VERSION } from '../../packages/util/src/participantAccountDataUse.js'
import { getPrisma } from '../global-setup.js'
import {
  CHATBOT_ID,
  chatUrl,
  clearChatCookies,
  cookieTokenSubject,
  ensureChatbotSeeded,
  getEnrolledParticipantId,
  ltiLaunchUrl,
  mintLtiLaunchToken,
  resetChatState,
  setLtiProbeCookie,
  setParticipantToken,
  siblingAppOrigin,
} from '../util/chat.js'
import { COURSE_ID_TEST } from '../util/constants.js'

/**
 * OLAT LTI 1.3 chatbot launch (apps/lti -> frontend-pwa -> chat)
 *
 * The launch handoff runs end to end against the real apps: a signed launch
 * token is minted with the same claims apps/lti issues, then the browser
 * follows Chat's account-or-guest entry. The LMS itself and the LLM endpoint
 * are out of scope, so no live OLAT launch is claimed here.
 *
 * Covered: no account continues as anonymous guest; verified LTI-linked account
 * without a session signs in automatically; a different signed-in account wins
 * without relinking; missing participation is created with leaderboard opt-in
 * false and existing values are preserved; invalid launches are rejected
 * without identity or participation rows; cookie-less transport and reload;
 * legacy PWA-shaped link forwarding.
 */

const LTI_SUB_LINKED = 'https://olat.uzh.ch/lti-sub/linked-account'
const LTI_SUB_CURRENT_SESSION = 'https://olat.uzh.ch/lti-sub/current-session'
const LTI_SUB_GUEST = 'https://olat.uzh.ch/lti-sub/anonymous-guest'
const LTI_SUB_REJECTED = 'https://olat.uzh.ch/lti-sub/rejected'
const MISSING_CHATBOT_ID = '00000000-0000-4000-8000-000000000404'

// Placeholder for the synthetic participants this spec creates. These accounts
// are never login-capable: the value is not a credential and is not hashed.
const FIXTURE_PASSWORD = 'unused-e2e-hash'

async function chatCookie(page: Page, name: string) {
  const cookies = await page.context().cookies()
  return cookies.find((cookie) => cookie.name === name)?.value
}

/**
 * Assert the launch reached the chatbot, accepting the disclaimer when the
 * identity has not accepted it yet. The launch itself is what is under test;
 * the disclaimer is an ordinary step of the participant journey.
 */
async function expectChatbotReached(page: Page) {
  await expect(page).toHaveURL(new RegExp(CHATBOT_ID), { timeout: 20_000 })

  const dataUseSubmit = page.getByTestId('chat-data-use-submit')
  const accept = page.getByTestId('chat-disclaimer-accept')
  const composer = page.getByTestId('chat-composer')
  await expect(async () => {
    // Chat answers on behalf of a persisted participant account, so an
    // identity without a recorded disclosure meets the data-use notice before
    // the chatbot disclaimer. Every guest persona and every synthetic account
    // this spec creates starts in that state.
    if (await dataUseSubmit.isVisible()) {
      // The policy links render only on the client; wait for hydration before
      // interacting with controls that are already present in the server HTML.
      await expect(
        page.locator('form a[href$="/privacy_policy"]')
      ).toBeVisible()
      await page.getByTestId('chat-data-use-analytics-false').check()
      await page.getByTestId('chat-data-use-acknowledged').check()
      await dataUseSubmit.click()
    }
    const disclaimerResponse = await page.request.get(
      `${chatUrl()}/api/chatbots/${CHATBOT_ID}/disclaimer`
    )
    expect(disclaimerResponse.ok()).toBe(true)
    const { status } = await disclaimerResponse.json()
    if (status.required && !status.accepted) {
      await expect(accept).toBeVisible()
      await accept.click()
      await expect(accept).toBeHidden()
    }
    await expect(composer).toBeVisible({ timeout: 5_000 })
  }).toPass({ timeout: 30_000 })
}

/**
 * Launch the chatbot through Chat's LTI entry with a signed handoff.
 *
 * `allowsRefusal` tolerates a failed navigation: Chat answers a refused
 * launch with a redirect to its own no-login page, and that redirect resolves
 * to the app's internal origin, which a routed deployment cannot serve. Those
 * tests assert the refusal, not the rendered page.
 */
async function launchChatbot(
  page: Page,
  {
    sub,
    courseId = COURSE_ID_TEST,
    chatbotId = CHATBOT_ID,
    expiresInSeconds,
    allowsRefusal = false,
  }: {
    sub: string
    courseId?: string
    chatbotId?: string
    expiresInSeconds?: number
    allowsRefusal?: boolean
  }
) {
  const jwt = await mintLtiLaunchToken({
    sub,
    courseId,
    chatbotId,
    ...(expiresInSeconds === undefined ? {} : { expiresInSeconds }),
  })
  const navigation = page.goto(ltiLaunchUrl({ jwt, courseId, chatbotId }), {
    waitUntil: 'commit',
  })
  if (allowsRefusal) await navigation.catch(() => undefined)
  else await navigation
}

/**
 * Read Chat's `/auth/lti` entry response body, once it has been served.
 *
 * The transport the entry picked is only observable in that response: it
 * hands the scoped handoff to the client (`?_pe=`) and the client strips the
 * parameter from the URL before the chatbot renders. The body has to be
 * intercepted rather than inspected after the fact, because the entry
 * response navigates away immediately and Chromium then discards it.
 */
async function captureLtiEntry(page: Page): Promise<() => string | null> {
  let body: string | null = null
  await page.route(
    (url) => url.pathname === '/auth/lti',
    async (route, request) => {
      if (request.method() !== 'GET') return route.continue()
      const response = await route.fetch()
      body = await response.text()
      await route.fulfill({ response, body })
    }
  )
  return () => body
}

test.describe('LTI chatbot launch identity resolution', () => {
  test.beforeEach(async ({ page }) => {
    await clearChatCookies(page)
    await ensureChatbotSeeded()
    const prisma = await getPrisma()
    // Start from a clean slate for this spec's synthetic LMS identities and for
    // any course-scoped guest persona an earlier test left behind. Accounts
    // cascade with their participant.
    await prisma.participant.deleteMany({
      where: {
        OR: [
          { username: { startsWith: 'lti-e2e-' } },
          { accounts: { some: { ssoId: { startsWith: 'chat-guest:' } } } },
        ],
      },
    })
  })

  test('a launch without any account continues as an anonymous guest', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    expect(
      await prisma.participantAccount.count({
        where: { ssoId: LTI_SUB_GUEST },
      })
    ).toBe(0)

    await launchChatbot(page, { sub: LTI_SUB_GUEST })
    await expectChatbotReached(page)

    // The launch created a course-scoped guest persona, and the browser holds
    // the anonymous guest token instead of an account session.
    const guestAccount = await prisma.participantAccount.findFirst({
      where: { ssoId: { startsWith: 'chat-guest:' } },
      select: { type: true, participantId: true },
    })
    expect(guestAccount?.type).toBe('lti_guest')
    expect(await chatCookie(page, 'chat_participant_token')).toBeTruthy()
    expect(
      cookieTokenSubject(await chatCookie(page, 'participant_token'))
    ).not.toBe(guestAccount?.participantId)
  })

  test('onboarding can recover after a revision conflict and a failed reload', async ({
    page,
  }) => {
    let submittedRevision: number | undefined
    let attempts = 0
    let rejectReload = false
    let releaseDisclaimer: (() => void) | undefined
    const disclaimerReady = new Promise<void>((resolve) => {
      releaseDisclaimer = resolve
    })
    await page.route('**/api/chatbots/*/disclaimer', async (route) => {
      if (route.request().method() === 'GET') await disclaimerReady
      await route.continue()
    })
    await page.route('**/api/chatbots/*/data-use', async (route) => {
      if (route.request().method() === 'POST') {
        attempts += 1
        submittedRevision = route.request().postDataJSON().expectedRevision
        if (attempts === 1) {
          rejectReload = true
          await route.fulfill({
            status: 409,
            json: { error: 'PARTICIPANT_DATA_USE_STALE_REVISION' },
          })
          return
        }
      } else if (route.request().method() === 'GET' && rejectReload) {
        rejectReload = false
        await route.fulfill({ status: 503, json: {} })
        return
      }
      await route.continue()
    })

    await launchChatbot(page, { sub: LTI_SUB_GUEST })
    const submit = page.getByTestId('chat-data-use-submit')
    const acknowledge = page.getByTestId('chat-data-use-acknowledged')
    await expect(page.locator('form a[href$="/privacy_policy"]')).toBeVisible()
    await page.getByTestId('chat-data-use-analytics-false').check()
    await acknowledge.check()
    await submit.click()
    await expect(acknowledge).not.toBeChecked()
    await expect(submit).toBeDisabled()
    await acknowledge.check()
    await expect(submit).toBeEnabled()
    await submit.click()
    await expect(submit).toBeHidden()
    await expect(page.getByTestId('chat-composer')).toBeHidden()
    releaseDisclaimer?.()
    await expect(page.getByTestId('chat-disclaimer-accept')).toBeVisible()
    expect(attempts).toBe(2)
    expect(submittedRevision).toBe(0)

    const prisma = await getPrisma()
    const guest = await prisma.participantAccount.findFirstOrThrow({
      where: { ssoId: { startsWith: 'chat-guest:' } },
      include: { participant: true },
    })
    expect(guest.participant.dataUseRevision).toBe(1)
    expect(guest.participant.learningAnalyticsConsent).toBe(false)
    expect(guest.participant.dataUseAcknowledgedAt).not.toBeNull()
  })

  for (const identity of ['registered', 'guest'] as const) {
    test(`${identity} renewal preserves refusals and settings change each purpose independently`, async ({
      page,
      browser,
    }) => {
      test.setTimeout(process.env.KLICKER_DPO_GALLERY_DIR ? 240_000 : 120_000)
      const prisma = await getPrisma()
      let participantId: string
      await setLtiProbeCookie(page)
      if (identity === 'registered') {
        const participant = await prisma.participant.create({
          data: {
            username: 'lti-e2e-data-use',
            password: FIXTURE_PASSWORD,
            accounts: { create: { ssoId: LTI_SUB_LINKED, ssoType: 'LTI1.3' } },
          },
        })
        participantId = participant.id
        await launchChatbot(page, { sub: LTI_SUB_LINKED })
      } else {
        await launchChatbot(page, { sub: LTI_SUB_GUEST })
        const guest = await prisma.participantAccount.findFirstOrThrow({
          where: { ssoId: { startsWith: 'chat-guest:' } },
          select: { participantId: true },
        })
        participantId = guest.participantId
      }

      await expect(
        page.locator('form a[href$="/privacy_policy"]')
      ).toBeVisible()
      const choiceAt = new Date('2026-09-01T12:00:00Z')
      await prisma.participant.update({
        where: { id: participantId },
        data: {
          researchConsent: false,
          researchConsentChoiceAt: choiceAt,
          researchConsentDisclosureVersion:
            PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
          learningAnalyticsConsent: false,
          learningAnalyticsChoiceAt: choiceAt,
          learningAnalyticsDisclosureVersion:
            PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
          dataUseAcknowledgedAt: choiceAt,
          dataUseAcknowledgedVersion: 'previous-disclosure',
          dataUseRevision: 1,
        },
      })
      await page.reload()
      const submit = page.getByTestId('chat-data-use-submit')
      const researchToggle = page.getByTestId('chat-data-use-research-toggle')
      const analyticsToggle = page.getByTestId('chat-data-use-analytics-toggle')
      await expect(
        page.locator('form a[href$="/privacy_policy"]')
      ).toBeVisible()
      await expect(researchToggle).toHaveAttribute('aria-expanded', 'false')
      await expect(
        page.getByTestId('chat-data-use-analytics-false')
      ).toBeChecked()
      await expect(
        page.getByTestId('chat-data-use-acknowledged')
      ).not.toBeChecked()
      await expect(submit).toBeDisabled()
      const denied = await page.request.get(
        `${chatUrl()}/api/chatbots/${CHATBOT_ID}/threads`
      )
      expect(denied.status()).toBe(403)
      expect((await denied.json()).error).toBe(
        'PARTICIPANT_DATA_USE_COMPLETION_REQUIRED'
      )
      const staleCompletion = await page.request.post(
        `${chatUrl()}/api/chatbots/${CHATBOT_ID}/data-use`,
        {
          data: {
            expectedRevision: 1,
            disclosureVersion: 'previous-disclosure',
            researchConsent: true,
            learningAnalyticsConsent: true,
            acknowledged: true,
          },
        }
      )
      expect(staleCompletion.status()).toBe(400)
      expect(
        await prisma.participant.findUniqueOrThrow({
          where: { id: participantId },
          select: { dataUseRevision: true },
        })
      ).toEqual({ dataUseRevision: 1 })

      const galleryDir = process.env.KLICKER_DPO_GALLERY_DIR
      if (galleryDir) {
        await mkdir(galleryDir, { recursive: true })
        for (const locale of ['en', 'de']) {
          await page.context().addCookies([
            {
              name: 'NEXT_LOCALE',
              value: locale,
              url: new URL(chatUrl()).origin,
            },
          ])
          await page.reload()
          await expect(page.locator('h1 + div a')).toBeVisible()
          await expect(
            page
              .getByTestId('chat-data-use-acknowledged')
              .locator('..')
              .locator('a')
              .first()
          ).toBeVisible()
          await expect(page.locator('html')).toHaveAttribute('lang', locale)
          for (const [width, height] of [
            [1440, 1200],
            [390, 844],
          ]) {
            await page.setViewportSize({ width, height })
            if ((await researchToggle.getAttribute('aria-expanded')) === 'true')
              await researchToggle.click()
            await page.screenshot({
              animations: 'disabled',
              path: join(
                galleryDir,
                `${identity}-${locale}-${width}-default.png`
              ),
              fullPage: true,
            })
            await researchToggle.click()
            await expect(analyticsToggle).toHaveAttribute(
              'aria-expanded',
              'true'
            )
            await page.screenshot({
              animations: 'disabled',
              path: join(
                galleryDir,
                `${identity}-${locale}-${width}-expanded.png`
              ),
              fullPage: true,
            })
          }
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 })
      if ((await researchToggle.getAttribute('aria-expanded')) !== 'true')
        await researchToggle.click()
      await expect(
        page.getByTestId('chat-data-use-research-false')
      ).toBeChecked()
      await page.getByTestId('chat-data-use-acknowledged').check()
      await submit.click()
      await expectChatbotReached(page)
      const renewed = await prisma.participant.findUniqueOrThrow({
        where: { id: participantId },
      })
      expect(renewed.researchConsent).toBe(false)
      expect(renewed.learningAnalyticsConsent).toBe(false)
      expect(renewed.researchConsentChoiceAt).toEqual(choiceAt)
      expect(renewed.learningAnalyticsChoiceAt).toEqual(choiceAt)
      expect(renewed.dataUseAcknowledgedVersion).toBe(
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION
      )
      const staleSettings = await page.request.patch(
        `${chatUrl()}/api/chatbots/${CHATBOT_ID}/data-use`,
        {
          data: {
            purpose: 'analytics',
            consent: true,
            expectedRevision: renewed.dataUseRevision,
            disclosureVersion: 'previous-disclosure',
          },
        }
      )
      expect(staleSettings.status()).toBe(400)

      await page.getByTestId('chat-data-use-settings-toggle').click()
      await expect(
        page.getByTestId('chat-data-use-analytics-false')
      ).toBeChecked()
      await page.getByTestId('chat-data-use-research-toggle').click()
      await expect(
        page.getByTestId('chat-data-use-research-false')
      ).toBeChecked()
      if (galleryDir) {
        for (const locale of ['en', 'de']) {
          await page.setViewportSize({ width: 1440, height: 1000 })
          await page.context().addCookies([
            {
              name: 'NEXT_LOCALE',
              value: locale,
              url: new URL(chatUrl()).origin,
            },
          ])
          const settingsResearch = page.getByTestId(
            'chat-data-use-research-toggle'
          )
          for (const [width, height] of [
            [1440, 1000],
            [390, 844],
          ]) {
            await page.setViewportSize({ width, height })
            await page.reload()
            await expect(page.locator('html')).toHaveAttribute('lang', locale)
            const settingsToggle = page.getByTestId(
              'chat-data-use-settings-toggle'
            )
            if (width < 768)
              await page
                .locator('[data-cy="chat-header"] button')
                .first()
                .click()
            if (identity === 'guest') {
              const guestAccount = page.getByTestId('chat-guest-account')
              await guestAccount.hover()
              await guestAccount.focus()
              await expect(guestAccount).toHaveAttribute(
                'aria-describedby',
                /.+/
              )
              const hintId = await guestAccount.getAttribute('aria-describedby')
              await expect(page.locator(`[id="${hintId}"]`)).toBeVisible()
              await page.screenshot({
                animations: 'disabled',
                path: join(
                  galleryDir,
                  `guest-${locale}-${width}-account-hint.png`
                ),
                fullPage: true,
              })
            }
            await settingsToggle.click()
            await expect(settingsResearch).toHaveAttribute(
              'aria-expanded',
              'false'
            )
            await page.screenshot({
              animations: 'disabled',
              path: join(
                galleryDir,
                `${identity}-${locale}-${width}-settings-default.png`
              ),
              fullPage: true,
            })
            await settingsResearch.click()
            await page.screenshot({
              animations: 'disabled',
              path: join(
                galleryDir,
                `${identity}-${locale}-${width}-settings-expanded.png`
              ),
              fullPage: true,
            })
          }
        }
        await page.setViewportSize({ width: 1440, height: 1000 })
        await page.reload()
        await page.getByTestId('chat-data-use-settings-toggle').click()
        await page.getByTestId('chat-data-use-research-toggle').click()
      }
      await page.getByTestId('chat-data-use-analytics-true').click()
      await expect(
        page.getByTestId('chat-data-use-analytics-true')
      ).toBeChecked()
      await expect
        .poll(async () => {
          const participant = await prisma.participant.findUniqueOrThrow({
            where: { id: participantId },
          })
          return [
            participant.researchConsent,
            participant.learningAnalyticsConsent,
          ]
        })
        .toEqual([false, true])
      await expect(
        page.getByTestId('chat-data-use-research-true')
      ).toBeEnabled()
      await page.getByTestId('chat-data-use-research-true').click()
      await expect(
        page.getByTestId('chat-data-use-research-true')
      ).toBeChecked()
      await expect
        .poll(async () => {
          const participant = await prisma.participant.findUniqueOrThrow({
            where: { id: participantId },
          })
          return [
            participant.researchConsent,
            participant.learningAnalyticsConsent,
          ]
        })
        .toEqual([true, true])

      const fresh = await browser.newContext({
        ignoreHTTPSErrors: true,
        storageState: await page.context().storageState(),
      })
      try {
        const returning = await fresh.newPage()
        await returning.goto(`${chatUrl()}/${CHATBOT_ID}?embed=true`)
        await expect(returning.getByTestId('chat-composer')).toBeVisible()
        await expect(returning.getByTestId('chat-data-use-submit')).toHaveCount(
          0
        )
        await returning.getByTestId('chat-data-use-settings-toggle').click()
        await expect(
          returning.getByTestId('chat-data-use-analytics-true')
        ).toBeChecked()
        await returning.getByTestId('chat-data-use-research-toggle').click()
        await expect(
          returning.getByTestId('chat-data-use-research-true')
        ).toBeChecked()
        await returning.getByTestId('chat-data-use-analytics-false').click()
        await expect(
          returning.getByTestId('chat-data-use-analytics-false')
        ).toBeChecked()
        await expect
          .poll(async () => {
            const participant = await prisma.participant.findUniqueOrThrow({
              where: { id: participantId },
            })
            return [
              participant.researchConsent,
              participant.learningAnalyticsConsent,
            ]
          })
          .toEqual([true, false])
        if (galleryDir) {
          await returning.setViewportSize({ width: 390, height: 844 })
          await returning.screenshot({
            animations: 'disabled',
            path: join(galleryDir, `${identity}-de-390-embedded-settings.png`),
            fullPage: true,
          })
        }
      } finally {
        await fresh.close()
      }
    })
  }

  test('cancelling guest onboarding leaves choices and chat content untouched', async ({
    page,
  }) => {
    await launchChatbot(page, { sub: LTI_SUB_GUEST })
    await expect(page.locator('form a[href$="/privacy_policy"]')).toBeVisible()
    const prisma = await getPrisma()
    const guest = await prisma.participantAccount.findFirstOrThrow({
      where: { ssoId: { startsWith: 'chat-guest:' } },
      include: { participant: true },
    })
    let modelRequests = 0
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        /\/chat$/.test(new URL(request.url()).pathname)
      )
        modelRequests += 1
    })
    await page.route(`${siblingAppOrigin('pwa')}/**`, (route) =>
      route.fulfill({
        status: 200,
        body: '<main>Application entry</main>',
        contentType: 'text/html',
      })
    )
    await page.getByTestId('chat-data-use-cancel').click()
    await expect(page).toHaveURL(`${siblingAppOrigin('pwa')}/`)
    const unchanged = await prisma.participant.findUniqueOrThrow({
      where: { id: guest.participantId },
    })
    expect(unchanged.dataUseRevision).toBe(guest.participant.dataUseRevision)
    expect(unchanged.dataUseAcknowledgedAt).toBeNull()
    expect(unchanged.researchConsentChoiceAt).toBeNull()
    expect(unchanged.learningAnalyticsChoiceAt).toBeNull()
    expect(
      await prisma.chatThread.count({
        where: { participantId: guest.participantId },
      })
    ).toBe(0)
    expect(modelRequests).toBe(0)
  })

  test('a verified LTI-linked account signs in without a session and gets opt-out participation', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    const participant = await prisma.participant.create({
      data: {
        username: 'lti-e2e-linked',
        password: FIXTURE_PASSWORD,
        accounts: { create: { ssoId: LTI_SUB_LINKED, ssoType: 'LTI1.3' } },
      },
    })

    await launchChatbot(page, { sub: LTI_SUB_LINKED })
    await expectChatbotReached(page)

    // The launch authenticated the linked account instead of a guest persona.
    expect(
      cookieTokenSubject(await chatCookie(page, 'participant_token'))
    ).toBe(participant.id)

    // Missing participation is created with leaderboard opt-in disabled.
    const participation = await prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId: COURSE_ID_TEST,
          participantId: participant.id,
        },
      },
    })
    expect(participation?.isActive).toBe(false)
  })

  test('an existing signed-in account wins without relinking to the LMS identity', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    const signedIn = await getEnrolledParticipantId()
    await setParticipantToken(page, signedIn)

    await launchChatbot(page, { sub: LTI_SUB_CURRENT_SESSION })
    await expectChatbotReached(page)

    expect(
      cookieTokenSubject(await chatCookie(page, 'participant_token'))
    ).toBe(signedIn)
    // The launch identity is not linked to the browser session, and no guest
    // persona is created while an account session is valid.
    expect(
      await prisma.participantAccount.count({
        where: { ssoId: LTI_SUB_CURRENT_SESSION },
      })
    ).toBe(0)
    expect(
      await prisma.participantAccount.count({
        where: { ssoId: { startsWith: 'chat-guest:' } },
      })
    ).toBe(0)
  })

  test('an existing leaderboard opt-in is preserved for accounts and guests', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    const participant = await prisma.participant.create({
      data: {
        username: 'lti-e2e-optin',
        password: FIXTURE_PASSWORD,
        accounts: { create: { ssoId: LTI_SUB_LINKED, ssoType: 'LTI1.3' } },
      },
    })
    const where = {
      courseId_participantId: {
        courseId: COURSE_ID_TEST,
        participantId: participant.id,
      },
    }
    await prisma.participation.create({
      data: {
        courseId: COURSE_ID_TEST,
        participantId: participant.id,
        isActive: true,
      },
    })

    await launchChatbot(page, { sub: LTI_SUB_LINKED })
    await expectChatbotReached(page)
    expect((await prisma.participation.findUnique({ where }))?.isActive).toBe(
      true
    )

    // The same guarantee holds for the anonymous guest persona.
    await clearChatCookies(page)
    await launchChatbot(page, { sub: LTI_SUB_GUEST })
    await expectChatbotReached(page)
    const guest = await prisma.participantAccount.findFirst({
      where: { ssoId: { startsWith: 'chat-guest:' } },
      select: { participantId: true },
    })
    const guestWhere = {
      courseId_participantId: {
        courseId: COURSE_ID_TEST,
        participantId: guest!.participantId,
      },
    }
    await prisma.participation.update({
      where: guestWhere,
      data: { isActive: true },
    })
    await clearChatCookies(page)
    await launchChatbot(page, { sub: LTI_SUB_GUEST })
    await expectChatbotReached(page)
    expect(
      (await prisma.participation.findUnique({ where: guestWhere }))?.isActive
    ).toBe(true)
  })

  test('invalid launches are rejected without creating identity or participation', async ({
    page,
  }) => {
    const prisma = await getPrisma()

    // A handoff bound to a different chatbot than the one it is handed to is
    // refused by the entry route before any identity work.
    const tamperedJwt = await mintLtiLaunchToken({
      sub: LTI_SUB_REJECTED,
      courseId: COURSE_ID_TEST,
      chatbotId: MISSING_CHATBOT_ID,
    })
    const refused = await page.goto(
      ltiLaunchUrl({
        jwt: tamperedJwt,
        courseId: COURSE_ID_TEST,
        chatbotId: CHATBOT_ID,
      }),
      { waitUntil: 'commit' }
    )
    expect(refused?.status()).toBe(403)

    // An expired handoff, and a handoff for a chatbot that is not a published
    // chatbot of the course, are refused as well.
    for (const launch of [
      { sub: LTI_SUB_REJECTED, expiresInSeconds: -3600 },
      { sub: LTI_SUB_REJECTED, chatbotId: MISSING_CHATBOT_ID },
    ]) {
      await launchChatbot(page, { ...launch, allowsRefusal: true })
      // A refused launch redirects to Chat's no-login page, whose
      // `redirectTo` parameter names the chatbot that was refused, so the
      // chatbot id can legitimately appear in the URL. Assert the refusal
      // itself and that the chatbot route was never served.
      await expect(page).toHaveURL(/\/noLogin/)
      expect(new URL(page.url()).pathname).toBe('/noLogin')
      expect(await chatCookie(page, 'chat_participant_token')).toBeFalsy()
    }

    expect(
      await prisma.participantAccount.count({
        where: { ssoId: LTI_SUB_REJECTED },
      })
    ).toBe(0)
    expect(
      await prisma.participantAccount.count({
        where: { ssoId: { startsWith: 'chat-guest:' } },
      })
    ).toBe(0)
  })

  test('a launch without the LTI probe cookie uses the scoped handoff and survives reload', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    const participant = await prisma.participant.create({
      data: {
        username: 'lti-e2e-cookieless',
        password: FIXTURE_PASSWORD,
        accounts: { create: { ssoId: LTI_SUB_LINKED, ssoType: 'LTI1.3' } },
      },
    })

    // No lti-token probe cookie: the launch must use the scoped token
    // transport instead of assuming the shared cookie survived the iframe.
    const ltiEntryBody = await captureLtiEntry(page)
    await launchChatbot(page, { sub: LTI_SUB_LINKED })
    expect(ltiEntryBody()).toContain('_pe=')
    await expectChatbotReached(page)
    expect(
      cookieTokenSubject(await chatCookie(page, 'participant_token'))
    ).toBe(participant.id)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expectChatbotReached(page)
  })

  test('cookie transport is used when the probe cookie survived', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    const participant = await prisma.participant.create({
      data: {
        username: 'lti-e2e-cookie',
        password: FIXTURE_PASSWORD,
        accounts: { create: { ssoId: LTI_SUB_LINKED, ssoType: 'LTI1.3' } },
      },
    })
    await setLtiProbeCookie(page)

    await launchChatbot(page, { sub: LTI_SUB_LINKED })
    await expectChatbotReached(page)
    expect(
      cookieTokenSubject(await chatCookie(page, 'participant_token'))
    ).toBe(participant.id)

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expectChatbotReached(page)
  })

  test('the legacy PWA-shaped LTI link forwards into the unified Chat entry', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    const participant = await prisma.participant.create({
      data: {
        username: 'lti-e2e-legacy',
        password: FIXTURE_PASSWORD,
        accounts: { create: { ssoId: LTI_SUB_LINKED, ssoType: 'LTI1.3' } },
      },
    })
    const jwt = await mintLtiLaunchToken({
      sub: LTI_SUB_LINKED,
      courseId: COURSE_ID_TEST,
      chatbotId: CHATBOT_ID,
    })
    const legacyUrl =
      siblingAppOrigin('pwa') +
      '/course/' +
      COURSE_ID_TEST +
      '/chatbot/' +
      CHATBOT_ID +
      '?jwt=' +
      jwt

    await page.goto(legacyUrl, { waitUntil: 'commit' })
    await expectChatbotReached(page)
    expect(new URL(page.url()).origin).toBe(new URL(chatUrl()).origin)
    expect(
      cookieTokenSubject(await chatCookie(page, 'participant_token'))
    ).toBe(participant.id)
    await resetChatState(participant.id)
  })
})
