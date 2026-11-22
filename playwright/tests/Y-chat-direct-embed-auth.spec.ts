import { expect, test, type Page, type Response } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'
import { createHmac, randomUUID } from 'node:crypto'
import { getPrisma } from '../global-setup.js'
import {
  chatUrl,
  ltiLaunchUrl,
  mintLtiLaunchToken,
  setLtiProbeCookie,
} from '../util/chat.js'
import { APP_SECRET } from '../util/constants.js'

const mode = process.env.PLAYWRIGHT_CHAT_EMBED_MODE

test.skip(
  mode !== 'direct' && mode !== 'legacy',
  'Requires the matching local Chat auth runtime'
)
test.use({ trace: 'off', video: 'off', screenshot: 'off' })

type Launch = 'LTI guest' | 'eLearning' | 'PWA embed'

function deriveSecret(secret: string, label: string) {
  return createHmac('sha256', secret).update(label).digest('hex')
}

async function launchUrl(
  launch: Launch,
  {
    chatbotId,
    courseId,
    participantId,
    subject,
  }: {
    chatbotId: string
    courseId: string
    participantId: string
    subject: string
  }
) {
  if (launch === 'LTI guest') {
    const jwt = await mintLtiLaunchToken({
      sub: subject,
      chatbotId,
      courseId,
    })
    return ltiLaunchUrl({ jwt, chatbotId, courseId })
  }
  const secret = process.env.APP_SECRET ?? APP_SECRET
  if (launch === 'eLearning') {
    const grant = await new SignJWT({
      scope: 'ELEARNING_CHAT',
      purpose: 'chat-handoff',
      chatbotId,
      klickerCourseId: courseId,
      elearningCourseId: 'synthetic-course',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer('elearning')
      .setAudience('klicker-chat')
      .setSubject(subject)
      .setIssuedAt()
      .setExpirationTime('120s')
      .sign(
        new TextEncoder().encode(deriveSecret(secret, 'elearning-chat-handoff'))
      )
    const url = new URL('/auth/elearning', chatUrl())
    url.search = new URLSearchParams({
      grant,
      chatbotId,
      courseId,
      embed: '1',
    }).toString()
    return url.toString()
  }

  const token = await new SignJWT({
    scope: 'PWA_CHAT_EMBED_EXCHANGE',
    chatbotId,
    courseId,
    cookiesAvailable: true,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(participantId)
    .setIssuedAt()
    .setExpirationTime('120s')
    .sign(new TextEncoder().encode(secret))
  const url = new URL('/auth/pwa-embed', chatUrl())
  url.searchParams.set('token', token)
  return url.toString()
}

async function assertTransport(response: Response, origin: URL, api: URL) {
  expect(response.ok(), 'thread endpoint succeeds').toBe(true)
  expect(new URL(response.url()).origin).toBe(api.origin)
  expect(Boolean(await response.request().headerValue('authorization'))).toBe(
    mode === 'direct'
  )
  if (mode === 'direct') {
    expect(api.hostname).not.toBe(origin.hostname)
    const cookies = await response.request().headerValue('cookie')
    expect(
      Boolean(
        cookies?.match(/(?:^|;\s*)chat_(?:participant_token|pwa_embed_token)=/)
      )
    ).toBe(false)
  }
}

async function openLaunch(page: Page, url: string) {
  // Keep signed launch parameters out of diagnostic output on failure.
  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
    expect(response?.ok(), 'signed launch response succeeds').toBe(true)
  } catch {
    throw new Error('The signed synthetic launch did not complete')
  }
}

for (const launch of ['LTI guest', 'eLearning', 'PWA embed'] as const) {
  test(`${launch} authenticates and reloads a thread`, async ({ page }) => {
    test.setTimeout(120_000)
    const origin = new URL(chatUrl())
    const api = new URL(origin)
    if (mode === 'direct')
      api.hostname = origin.hostname.replace(/^chat\./, 'chat-api.')
    const prisma = await getPrisma()
    const chatbotId = randomUUID()
    const courseId = randomUUID()
    const participantId = randomUUID()
    const ownerId = randomUUID()
    const subject = randomUUID()
    const guestSeed = deriveSecret(
      process.env.APP_SECRET ?? APP_SECRET,
      'chat-guest-seed'
    )
    const guestSsoId =
      'chat-guest:' +
      createHmac('sha256', guestSeed)
        .update(`${subject}:${courseId}`)
        .digest('base64url')
    const guest = launch !== 'PWA embed'
    const chatbotApiPath = `/api/chatbots/${chatbotId}`
    const apiResponse = (
      path: '/credits' | '/threads',
      method: 'GET' | 'POST'
    ) =>
      page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname === chatbotApiPath + path &&
          response.request().method() === method
      )

    if (mode === 'direct') expect(api.hostname).not.toBe(origin.hostname)
    if (guest)
      expect(
        await prisma.participantAccount.count({ where: { ssoId: guestSsoId } })
      ).toBe(0)
    const passwordHash = await bcrypt.hash(randomUUID(), 10)
    const now = Date.now()
    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: ownerId,
          email: ownerId + '@example.invalid',
          shortname: ownerId,
          aiFeaturesEnabled: true,
        },
      })
      await tx.course.create({
        data: {
          id: courseId,
          ownerId,
          name: 'Synthetic embed course',
          displayName: 'Synthetic embed course',
          startDate: new Date(now - 60_000),
          endDate: new Date(now + 3_600_000),
          groupDeadlineDate: new Date(now + 3_600_000),
        },
      })
      await tx.participant.create({
        data: {
          id: participantId,
          username: participantId,
          password: passwordHash,
          participations: { create: { courseId } },
        },
      })
      await tx.chatbot.create({
        data: {
          id: chatbotId,
          courseId,
          ownerId,
          name: 'Synthetic embed authentication',
          status: 'PUBLISHED',
        },
      })
    })
    try {
      if (guest) await setLtiProbeCookie(page)
      const url = await launchUrl(launch, {
        chatbotId,
        courseId,
        participantId,
        subject,
      })
      // A new embed loads credits before it has a conversation to retrieve.
      const entryPath = launch === 'LTI guest' ? '/threads' : '/credits'
      const [entryResponse] = await Promise.all([
        apiResponse(entryPath, 'GET'),
        openLaunch(page, url),
      ])
      await assertTransport(entryResponse, origin, api)

      await expect(page).toHaveURL((url) => url.pathname === `/${chatbotId}`)
      const destination = new URL(page.url())
      expect(
        ['_t', '_pe', 'grant', 'jwt', 'token'].some((key) =>
          destination.searchParams.has(key)
        )
      ).toBe(false)
      const expectedCookie = guest
        ? 'chat_participant_token'
        : 'chat_pwa_embed_token'
      const cookie = (await page.context().cookies(origin.origin)).find(
        ({ name }) => name === expectedCookie
      )
      expect(cookie?.domain).toBe(origin.hostname)
      expect(cookie?.httpOnly).toBe(true)

      const button = page.locator(
        launch === 'LTI guest'
          ? '[data-cy="chat-new-thread-button"]'
          : '[data-cy="chat-embedded-new-conversation"]'
      )
      const [response] = await Promise.all([
        apiResponse('/threads', 'POST'),
        button.click(),
      ])
      await assertTransport(response, origin, api)
      const { id: threadId } = await response.json()
      const owner = guest
        ? await prisma.participantAccount.findUnique({
            where: { ssoId: guestSsoId },
            select: { participantId: true },
          })
        : { participantId }
      expect(Boolean(owner?.participantId)).toBe(true)
      const thread = await prisma.chatThread.findUnique({
        where: { id: threadId },
        select: { participantId: true, chatbotId: true },
      })
      expect(thread).toEqual({ participantId: owner?.participantId, chatbotId })

      await expect(page).toHaveURL((url) =>
        url.pathname.endsWith(`/threads/${threadId}`)
      )
      const reloaded = apiResponse('/threads', 'GET')
      await page.reload({ waitUntil: 'domcontentloaded' })
      const reloadedResponse = await reloaded
      await assertTransport(reloadedResponse, origin, api)
      const threads = await reloadedResponse.json()
      expect(threads.some(({ id }: { id: string }) => id === threadId)).toBe(
        true
      )
    } finally {
      await prisma.$transaction(async (tx) => {
        if (guest) {
          const owned = await tx.participantAccount.findUnique({
            where: { ssoId: guestSsoId },
            select: { participantId: true },
          })
          if (owned)
            await tx.participant.delete({ where: { id: owned.participantId } })
        }
        await tx.participant.delete({ where: { id: participantId } })
        // The temporary owner owns only this course and chatbot.
        await tx.user.delete({ where: { id: ownerId } })
      })
    }
  })
}
