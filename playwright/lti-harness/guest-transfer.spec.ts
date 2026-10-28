import { expect, test } from '@playwright/test'
import { decodeJwt, type JWTPayload } from 'jose'
import { randomUUID } from 'node:crypto'
import { getPrisma } from '../global-setup.js'
import { chatUrl, siblingAppOrigin } from '../util/chat.js'
import { type MockPlatform, startMockPlatform } from './mockPlatform.js'

for (const embedding of ['top-level', 'iframe'] as const) {
  test(`${embedding} real LMS launch transfers guest history to the linked account`, async ({
    page,
  }, testInfo) => {
    test.skip(
      embedding === 'iframe' &&
        testInfo.project.metadata.blocksThirdPartyCookies !== true,
      'Development SameSite=Lax sessions require the cookieless iframe path.'
    )
    test.setTimeout(120_000)
    const prisma = await getPrisma()
    const subject = `guest-transfer-${randomUUID()}`
    const courseId = randomUUID()
    const chatbotId = randomUUID()
    const target = new URL('/auth/lti', chatUrl())
    target.searchParams.set('courseId', courseId)
    target.searchParams.set('chatbotId', chatbotId)
    const toolOrigin = siblingAppOrigin('lti')
    const participantIds: string[] = []
    let platform: MockPlatform | undefined
    let ownerId: string | undefined
    let handoffs = 0
    const launches: { payload: JWTPayload; cookies: boolean }[] = []

    page.on('request', (request) => {
      const url = new URL(request.url())
      if (url.origin === toolOrigin && url.pathname === '/handoff') handoffs++
    })
    page.on('response', async (response) => {
      const url = new URL(response.url())
      if (url.origin !== target.origin || url.pathname !== '/auth/lti') return
      const jwt = url.searchParams.get('jwt')
      if (!jwt) return
      launches.push({
        payload: decodeJwt(jwt),
        cookies: /(^|;\s*)lti-token=/.test(
          (await response.request().headerValue('cookie')) ?? ''
        ),
      })
    })

    const surface =
      embedding === 'iframe' ? page.frameLocator('iframe[name="tool"]') : page
    const launch = async () => {
      await page.goto(platform!.launchUrl(embedding))
      const accept = surface.locator('[data-cy="chat-disclaimer-accept"]')
      await expect(async () => {
        if (await accept.isVisible()) await accept.click()
        await expect(surface.locator('[data-cy="chat-composer"]')).toBeVisible({
          timeout: 5_000,
        })
      }).toPass({ timeout: 30_000 })
    }
    const sessionToken = async (name: string) => {
      const cookies = await page.context().cookies(target.origin)
      const frame =
        embedding === 'iframe'
          ? page.frame({ name: 'tool' })!
          : page.mainFrame()
      return (
        cookies.find((cookie) => cookie.name === name)?.value ??
        (await frame.evaluate((key) => sessionStorage.getItem(key), name))
      )
    }

    try {
      const owner = await prisma.user.create({
        data: {
          email: `${subject}@example.com`,
          shortname: randomUUID().slice(0, 10),
        },
      })
      ownerId = owner.id
      const now = new Date()
      const end = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
      await prisma.course.create({
        data: {
          id: courseId,
          name: subject,
          displayName: 'Synthetic transfer course',
          authType: 'SSO',
          startDate: now,
          endDate: end,
          groupDeadlineDate: end,
          ownerId,
        },
      })
      await prisma.chatbot.create({
        data: {
          id: chatbotId,
          name: 'Synthetic transfer chatbot',
          courseId,
          ownerId,
          status: 'PUBLISHED',
          creditInitialCredits: 100,
          systemPrompts: {
            tutor: { prompt: 'Synthetic tutor', description: 'Tutor' },
          },
        },
      })
      platform = await startMockPlatform({
        toolOrigin,
        redirectTarget: target.href,
        // No seeded email: the first launch must resolve to a guest.
        learner: { sub: subject },
      })
      await launch()
      const guestToken = await sessionToken('chat_participant_token')
      expect(guestToken).toBeTruthy()
      const guest = decodeJwt(guestToken!)
      expect(guest.scope).toBe('CHAT_GUEST')
      participantIds.push(guest.sub!)
      expect(
        await prisma.participantAccount.findFirst({
          where: { participantId: guest.sub, type: 'lti_guest' },
        })
      ).not.toBeNull()
      const thread = await prisma.chatThread.create({
        data: {
          participantId: guest.sub!,
          chatbotId,
          title: `Guest history ${randomUUID()}`,
          messages: {
            create: {
              role: 'user',
              content: [{ type: 'text', text: randomUUID() }],
            },
          },
        },
      })
      const account = await prisma.participant.create({
        data: {
          username: subject,
          // Dummy fixture value; this participant cannot log in by password.
          password: 'dummy-test-hash',
          accounts: { create: { ssoId: subject, ssoType: 'LTI1.3' } },
        },
      })
      participantIds.push(account.id)

      await page.context().clearCookies()
      await launch()
      const accountToken = await sessionToken('chat_pwa_embed_token')
      expect(accountToken).toBeTruthy()
      expect(decodeJwt(accountToken!).sub).toBe(account.id)
      const transferred = await prisma.chatThread.findUniqueOrThrow({
        where: { id: thread.id },
      })
      expect(transferred.participantId).toBe(account.id)
      expect(transferred.updatedAt).toEqual(thread.updatedAt)
      const historyRow = surface
        .locator('[data-cy="chat-thread-item"]')
        .filter({ hasText: thread.title! })
      await expect(historyRow).toBeVisible()
      await historyRow.locator('[data-cy="chat-thread-select"]').click()
      await expect(
        surface.locator('[data-cy="chat-user-message"]')
      ).toBeVisible()

      // A fresh verified launch is idempotent and retains visible history.
      await page.context().clearCookies()
      await launch()
      expect(
        await prisma.chatThread.count({
          where: { id: thread.id, participantId: account.id },
        })
      ).toBe(1)
      await expect(historyRow).toBeVisible()
      expect(handoffs).toBe(3)
      expect(launches.map((entry) => entry.payload.sub)).toEqual([
        subject,
        subject,
        subject,
      ])
      for (const { payload } of launches) {
        expect(payload.scope).toBe('LTI1.3')
        expect(payload.iss).toBe(toolOrigin)
        expect(payload.chatbotLaunch).toEqual({
          courseId,
          chatbotId,
        })
      }
      if (embedding === 'iframe') {
        expect(launches.every((entry) => !entry.cookies)).toBe(true)
      }
      await testInfo.attach('transferred-guest-history', {
        body: await page.screenshot(),
        contentType: 'image/png',
      })
    } finally {
      await platform?.close()
      await prisma.participant.deleteMany({
        where: { id: { in: participantIds } },
      })
      if (ownerId) await prisma.user.delete({ where: { id: ownerId } })
    }
  })
}
