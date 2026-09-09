import { createHmac, randomUUID } from 'node:crypto'
import { PublicationStatus, UserRole } from '@klicker-uzh/prisma/client'
import { expect, test } from '@playwright/test'
import { getPrisma } from '../global-setup.js'

// Host-side Playwright cannot resolve the workspace util package, so sign the
// synthetic handoffs directly with the shared HS256 secret.
function signJwt(payload: Record<string, unknown>, expiresIn: string = '5m') {
  const seconds = Math.floor(Date.now() / 1000)
  const expiry = expiresIn === '-1h' ? seconds - 3600 : seconds + 300
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const body = encode({ ...payload, iat: seconds, exp: expiry })
  const signature = createHmac('sha256', process.env.APP_SECRET!)
    .update(`${header}.${body}`)
    .digest('base64url')
  return `${header}.${body}.${signature}`
}

test.describe('LTI course enrollment', () => {
  const ownerId = randomUUID()
  const courseIds: string[] = []
  const participantIds: string[] = []
  let pinSequence = 10000000
  let courseId: string
  let subject: string
  let email: string
  let participantId: string

  test.beforeAll(async () => {
    const prisma = await getPrisma()
    await prisma.user.create({
      data: {
        id: ownerId,
        shortname: ownerId,
        email: `${ownerId}@example.com`,
      },
    })
  })

  test.beforeEach(async () => {
    const prisma = await getPrisma()
    courseId = randomUUID()
    subject = randomUUID()
    participantId = randomUUID()
    email = `${participantId}@example.com`
    courseIds.push(courseId)
    participantIds.push(participantId)
    await prisma.course.create({
      data: {
        id: courseId,
        ownerId,
        name: 'Synthetic LTI enrollment',
        displayName: 'LTI enrollment',
        pinCode: pinSequence++,
        startDate: new Date(Date.now() - 86400000),
        endDate: new Date(Date.now() + 86400000),
        groupDeadlineDate: new Date(Date.now() + 86400000),
      },
    })
    await prisma.participant.create({
      data: {
        id: participantId,
        username: participantId,
        email,
        password: 'unused-synthetic-password',
        accounts: { create: { ssoId: subject, ssoType: 'LTI1.3' } },
      },
    })
  })

  test.afterAll(async () => {
    const prisma = await getPrisma()
    await prisma.liveQuiz.deleteMany({ where: { courseId: { in: courseIds } } })
    await prisma.course.deleteMany({ where: { id: { in: courseIds } } })
    await prisma.participant.deleteMany({
      where: { id: { in: participantIds } },
    })
    await prisma.user.deleteMany({ where: { id: ownerId } })
  })

  async function token(expiresIn = '5m') {
    return signJwt({ sub: subject, email, scope: 'LTI1.3' }, expiresIn)
  }

  async function assertMembership() {
    const prisma = await getPrisma()
    await expect
      .poll(() =>
        prisma.participation.count({ where: { courseId, participantId } })
      )
      .toBe(1)
    expect(
      await prisma.participation.findUnique({
        where: { courseId_participantId: { courseId, participantId } },
      })
    ).toMatchObject({ isActive: false })
    expect(
      await prisma.leaderboardEntry.count({
        where: { courseId, participantId },
      })
    ).toBe(0)
  }

  for (const suffix of [
    '',
    '/docs',
    '/createAccount',
    '/liveQuizzes',
    '/microLearnings',
    '/practiceQuizzes',
  ]) {
    test(`query handoff enrolls through ${suffix || 'course overview'}`, async ({
      page,
    }) => {
      const jwt = await token()
      await page.goto(
        `/course/${courseId}${suffix}?jwt=${encodeURIComponent(jwt)}`
      )
      await assertMembership()
      await page.reload()
      await assertMembership()
    })
  }

  for (const activity of [
    'liveQuizzes',
    'microLearnings',
    'practiceQuizzes',
  ] as const) {
    for (const count of [0, 1, 2]) {
      test(`${activity} enrolls with ${count} published activities`, async ({
        page,
      }) => {
        const prisma = await getPrisma()
        for (let i = 0; i < count; i++) {
          const data = {
            ownerId,
            courseId,
            name: `Synthetic activity ${i}`,
            displayName: `Activity ${i}`,
            status: PublicationStatus.PUBLISHED,
          }
          if (activity === 'liveQuizzes') await prisma.liveQuiz.create({ data })
          if (activity === 'practiceQuizzes')
            await prisma.practiceQuiz.create({ data })
          if (activity === 'microLearnings')
            await prisma.microLearning.create({
              data: {
                ...data,
                scheduledStartAt: new Date(Date.now() - 86400000),
                scheduledEndAt: new Date(Date.now() + 86400000),
              },
            })
        }
        await page.goto(
          `/course/${courseId}/${activity}/overview?jwt=${encodeURIComponent(await token())}`
        )
        await assertMembership()
        await expect
          .poll(() =>
            page.evaluate(() => {
              const value = sessionStorage.getItem('participant_token')
              return value
                ? JSON.parse(
                    atob(
                      value.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/')
                    )
                  ).sub
                : null
            })
          )
          .toBe(participantId)
      })
    }
  }

  for (const route of [
    'practiceQuizzes',
    'quiz',
    'microlearning',
    'liveQuizzes',
  ] as const) {
    test(`direct ${route} launch enrolls the linked account`, async ({
      page,
    }) => {
      const prisma = await getPrisma()
      const data = {
        ownerId,
        courseId,
        name: 'Synthetic direct activity',
        displayName: 'Direct activity',
        status: PublicationStatus.PUBLISHED,
      }
      const activity =
        route === 'liveQuizzes'
          ? await prisma.liveQuiz.create({ data })
          : route === 'quiz' || route === 'practiceQuizzes'
            ? await prisma.practiceQuiz.create({ data })
            : await prisma.microLearning.create({
                data: {
                  ...data,
                  scheduledStartAt: new Date(Date.now() - 86400000),
                  scheduledEndAt: new Date(Date.now() + 86400000),
                },
              })
      await page.goto(
        `/course/${courseId}/${route}/${activity.id}?jwt=${encodeURIComponent(await token())}`
      )
      await assertMembership()
    })
  }

  for (const existing of ['none', 'same', 'other'] as const) {
    test(`cookie handoff takes precedence over ${existing} participant session`, async ({
      page,
      context,
      baseURL,
    }) => {
      const prisma = await getPrisma()
      const otherId = randomUUID()
      if (existing === 'other') {
        participantIds.push(otherId)
        await prisma.participant.create({
          data: {
            id: otherId,
            username: otherId,
            password: 'unused-synthetic-password',
          },
        })
      }
      if (existing !== 'none') {
        const oldToken = await signJwt(
          {
            sub: existing === 'same' ? participantId : otherId,
            role: UserRole.PARTICIPANT,
          },
          '5m'
        )
        await context.addCookies([
          { name: 'participant_token', value: oldToken, url: baseURL! },
        ])
        await page.addInitScript((value) => {
          if (!sessionStorage.getItem('synthetic-session-initialized')) {
            sessionStorage.setItem('participant_token', value)
            sessionStorage.setItem('synthetic-session-initialized', 'true')
          }
        }, oldToken)
      }
      await context.addCookies([
        { name: 'lti-token', value: await token(), url: baseURL! },
      ])
      await page.goto(`/course/${courseId}/docs`)
      await expect(page).toHaveURL(/\/docs$/)
      await assertMembership()
      expect(
        await page.evaluate(() => sessionStorage.getItem('participant_token'))
      ).toBeNull()
      expect(
        await prisma.participation.count({
          where: { courseId, participantId: otherId },
        })
      ).toBe(0)
      // The dev runtime sets COOKIE_DOMAIN=klicker.localhost, which does not
      // match the namespaced PWA host; assert that the server minted a session
      // for the LTI account rather than matching a specific cookie jar entry.
      const sessionSubjects = (await context.cookies())
        .filter((cookie) => cookie.name === 'participant_token')
        .map(
          (cookie) =>
            JSON.parse(
              Buffer.from(cookie.value.split('.')[1]!, 'base64url').toString()
            ).sub
        )
      expect(sessionSubjects).toContain(participantId)
    })
  }

  test('query handoff replaces a different stored participant session before a redirect', async ({
    page,
  }) => {
    const prisma = await getPrisma()
    const otherId = randomUUID()
    participantIds.push(otherId)
    await prisma.participant.create({
      data: {
        id: otherId,
        username: otherId,
        password: 'unused-synthetic-password',
      },
    })
    const oldToken = await signJwt({ sub: otherId, role: UserRole.PARTICIPANT })
    await page.addInitScript((value) => {
      if (!sessionStorage.getItem('participant_token'))
        sessionStorage.setItem('participant_token', value)
    }, oldToken)
    await page.goto(
      `/course/${courseId}/docs?jwt=${encodeURIComponent(await token())}`
    )
    await expect(page).toHaveURL(/\/docs$/)
    await assertMembership()
    expect(
      await prisma.participation.count({
        where: { courseId, participantId: otherId },
      })
    ).toBe(0)
    expect(
      await page.evaluate(() => {
        const value = sessionStorage.getItem('participant_token')!
        return JSON.parse(
          atob(value.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))
        ).sub
      })
    ).toBe(participantId)
  })

  test('ordinary participant navigation does not enroll', async ({
    page,
    context,
    baseURL,
  }) => {
    const session = await signJwt({
      sub: participantId,
      role: UserRole.PARTICIPANT,
    })
    await context.addCookies([
      { name: 'participant_token', value: session, url: baseURL! },
    ])
    await page.goto(`/course/${courseId}/liveQuizzes/overview`)
    const prisma = await getPrisma()
    expect(
      await prisma.participation.count({ where: { courseId, participantId } })
    ).toBe(0)
  })

  for (const invalid of ['malformed', 'expired'] as const) {
    test(`${invalid} handoff creates no membership`, async ({ page }) => {
      const jwt = invalid === 'expired' ? await token('-1h') : 'invalid'
      await page.goto(
        `/course/${courseId}/liveQuizzes/overview?jwt=${encodeURIComponent(jwt)}`
      )
      const prisma = await getPrisma()
      expect(
        await prisma.participation.count({ where: { courseId, participantId } })
      ).toBe(0)
    })
  }
})
