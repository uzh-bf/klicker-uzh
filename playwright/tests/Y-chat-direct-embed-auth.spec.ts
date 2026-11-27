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
        new TextEncoder().encode(
          process.env.ELEARNING_CHAT_HANDOFF_SECRET ||
            deriveSecret(secret, 'elearning-chat-handoff')
        )
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
  test(`${launch} authenticates and reloads a thread`, async ({
    browser,
    page,
  }) => {
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
    const guestAccounts = {
      type: 'lti_guest',
      participant: { participations: { some: { courseId, isActive: false } } },
    }
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
      expect(
        await prisma.participantAccount.count({ where: guestAccounts })
      ).toBe(0)
      await setLtiProbeCookie(page)
      if (!guest) {
        const guestUrl = await launchUrl('LTI guest', {
          chatbotId,
          courseId,
          participantId,
          subject,
        })
        const [priorGuestThreads] = await Promise.all([
          apiResponse('/threads', 'GET'),
          openLaunch(page, guestUrl),
        ])
        await assertTransport(priorGuestThreads, origin, api)
        expect(
          (await page.context().cookies(origin.origin)).some(
            ({ name }) => name === 'chat_participant_token'
          )
        ).toBe(true)
      }
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
      if (!guest) {
        expect(
          (await page.context().cookies(origin.origin)).some(
            ({ name }) => name === 'chat_participant_token'
          )
        ).toBe(false)
      }

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
      const owners = guest
        ? await prisma.participantAccount.findMany({
            where: guestAccounts,
            select: { participantId: true },
          })
        : [{ participantId }]
      expect(owners).toHaveLength(1)
      const thread = await prisma.chatThread.findUnique({
        where: { id: threadId },
        select: { participantId: true, chatbotId: true },
      })
      expect(thread).toEqual({
        participantId: owners[0]?.participantId,
        chatbotId,
      })

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

      // Mint from the scoped embed session, then exchange in a browser context with
      // neither its cookies nor its fallback bearer.
      const handoffPath = await page.evaluate(
        async ({ chatbotApiPath, expectedCookie, threadId }) => {
          const token = sessionStorage.getItem(expectedCookie)
          const response = await fetch(chatbotApiPath + '/handoff', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: 'Bearer ' + token } : {}),
            },
            body: JSON.stringify({ threadId }),
          })
          if (!response.ok) return null
          return ((await response.json()) as { url: string }).url
        },
        { chatbotApiPath, expectedCookie, threadId }
      )
      if (!handoffPath) throw new Error('The synthetic handoff was not minted')
      const tab = await browser.newPage({ ignoreHTTPSErrors: true })
      try {
        const [handedOff] = await Promise.all([
          tab.waitForResponse(
            (response) =>
              new URL(response.url()).pathname ===
                chatbotApiPath + '/threads' &&
              response.request().method() === 'GET'
          ),
          openLaunch(tab, new URL(handoffPath, origin).toString()),
        ])
        await assertTransport(handedOff, origin, api)
        expect(
          (await handedOff.json()).some(
            ({ id }: { id: string }) => id === threadId
          )
        ).toBe(true)
        await expect(tab).toHaveURL(
          (url) => url.pathname.endsWith('/threads/' + threadId) && !url.search
        )
      } finally {
        await tab.close()
      }
    } finally {
      try {
        // Stop further credit refetches before removing the course fixtures.
        await page.close()
      } finally {
        await prisma.$transaction(async (tx) => {
          const owned = await tx.participantAccount.findMany({
            where: guestAccounts,
            select: { participantId: true },
          })
          await tx.participant.deleteMany({
            where: {
              id: { in: owned.map(({ participantId }) => participantId) },
            },
          })
          await tx.participant.delete({ where: { id: participantId } })
          // The temporary owner owns only this course and chatbot.
          await tx.user.delete({ where: { id: ownerId } })
        })
      }
    }
  })
}
