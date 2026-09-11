import { expect, test, type Page } from '@playwright/test'
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

  const accept = page.getByTestId('chat-disclaimer-accept')
  const composer = page.getByTestId('chat-composer')
  await expect(async () => {
    if (await accept.isVisible()) await accept.click()
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

  test('a verified LTI-linked account signs in without a session and gets opt-out participation', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    const participant = await prisma.participant.create({
      data: {
        username: 'lti-e2e-linked',
        password: 'unused-e2e-hash',
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
        password: 'unused-e2e-hash',
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
      await expect(page).not.toHaveURL(new RegExp(CHATBOT_ID))
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

  test('blocked third-party cookies use the scoped handoff and survive reload', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    const participant = await prisma.participant.create({
      data: {
        username: 'lti-e2e-cookieless',
        password: 'unused-e2e-hash',
        accounts: { create: { ssoId: LTI_SUB_LINKED, ssoType: 'LTI1.3' } },
      },
    })

    // No lti-token probe cookie: the launch must use the scoped token
    // transport instead of assuming the shared cookie survived the iframe.
    await launchChatbot(page, { sub: LTI_SUB_LINKED })
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
        password: 'unused-e2e-hash',
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
        password: 'unused-e2e-hash',
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
