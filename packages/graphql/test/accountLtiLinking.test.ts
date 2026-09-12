import { prisma as prismaClient } from '@klicker-uzh/prisma'
import { CourseAuthType, PrismaClient } from '@klicker-uzh/prisma/client'
import { signJWT } from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import { EventEmitter } from 'events'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { Context } from '../src/lib/context.js'
import {
  createParticipantAccount,
  createParticipantToken,
  loginParticipantForLtiChatbot,
  loginParticipantWithLti,
} from '../src/services/accounts.js'

const TEST_PREFIX = `codex-lti-${Date.now()}`
const emailFor = (label: string) => `${TEST_PREFIX}-${label}@example.com`
const usernameFor = (label: string) => `${TEST_PREFIX}-${label}`.slice(0, 48)
const ssoIdFor = (label: string) => `${TEST_PREFIX}-${label}`

let prisma: PrismaClient

function createCtx(): Context {
  return {
    prisma: prisma as any,
    req: { locals: {} } as any,
    res: { cookie: vi.fn() } as any,
    redisExec: {} as any,
    redisAssessmentExec: {} as any,
    pubSub: {} as any,
    emitter: new EventEmitter(),
    hatchet: {} as any,
    tasks: {} as any,
  } as Context
}

async function createSignedLtiData({
  sub,
  email,
  scope = 'LTI1.3',
}: {
  sub: string
  email?: string
  scope?: string
}) {
  return signJWT(
    {
      sub,
      email,
      scope,
    },
    process.env.APP_SECRET as string,
    {
      algorithm: 'HS256',
      expiresIn: '5m',
      issuer: process.env.APP_ORIGIN_PWA,
    }
  )
}

async function cleanupTestData() {
  const participants = await prisma.participant.findMany({
    where: {
      OR: [
        { username: { startsWith: TEST_PREFIX } },
        { email: { startsWith: TEST_PREFIX } },
      ],
    },
    select: { id: true },
  })

  const participantIds = participants.map((participant) => participant.id)

  if (participantIds.length > 0) {
    await prisma.participation.deleteMany({
      where: { participantId: { in: participantIds } },
    })
  }

  await prisma.participantAccount.deleteMany({
    where:
      participantIds.length > 0
        ? {
            OR: [
              { participantId: { in: participantIds } },
              { ssoId: { startsWith: TEST_PREFIX } },
            ],
          }
        : { ssoId: { startsWith: TEST_PREFIX } },
  })

  if (participantIds.length > 0) {
    await prisma.participant.deleteMany({
      where: { id: { in: participantIds } },
    })
  }

  await prisma.course.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  })

  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  })
}

async function createTestCourse() {
  const user = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}-owner@example.com`,
      shortname: TEST_PREFIX.slice(0, 10),
    },
  })

  const now = new Date()
  const course = await prisma.course.create({
    data: {
      name: `${TEST_PREFIX}-course`,
      displayName: 'Test Course',
      pinCode: 123456,
      startDate: now,
      endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      groupDeadlineDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
      owner: { connect: { id: user.id } },
    },
  })

  return { user, course }
}

describe('LTI participant linking and creation', () => {
  beforeAll(async () => {
    process.env.APP_SECRET = process.env.APP_SECRET ?? 'test-app-secret'
    process.env.APP_ORIGIN_API =
      process.env.APP_ORIGIN_API ?? 'https://api.klicker.test'
    process.env.APP_ORIGIN_PWA =
      process.env.APP_ORIGIN_PWA ?? 'https://pwa.klicker.test'

    prisma = prismaClient
    await prisma.$connect()
    await cleanupTestData()
  }, 60000)

  afterEach(async () => {
    vi.unstubAllEnvs()
    await cleanupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  }, 60000)

  it('links an existing manual participant to first-time LTI launch on exact normalized email match', async () => {
    const participant = await prisma.participant.create({
      data: {
        email: emailFor('manual-link'),
        username: usernameFor('manual-link'),
        password: await bcrypt.hash('password123', 10),
        isSSOAccount: false,
      },
    })

    const signedLtiData = await createSignedLtiData({
      sub: ssoIdFor('manual-link'),
      email: emailFor('manual-link').toUpperCase(),
    })

    const ctx = createCtx()
    const result = await loginParticipantWithLti({ signedLtiData }, ctx)

    expect(result?.participant?.id).toBe(participant.id)
    expect(result?.participantToken).toBeDefined()
    expect(ctx.res.cookie).toHaveBeenCalledWith(
      'lti-token',
      '',
      expect.objectContaining({ path: '/', maxAge: 0 })
    )

    const linkedAccount = await prisma.participantAccount.findUnique({
      where: { ssoId: ssoIdFor('manual-link') },
    })
    expect(linkedAccount?.participantId).toBe(participant.id)
    expect(linkedAccount?.ssoEmail).toBe(emailFor('manual-link'))

    const unchangedParticipant = await prisma.participant.findUnique({
      where: { id: participant.id },
    })
    expect(unchangedParticipant?.isSSOAccount).toBe(false)
  })

  it('is idempotent on repeated LTI launches with the same ssoId', async () => {
    const participant = await prisma.participant.create({
      data: {
        email: emailFor('idempotent'),
        username: usernameFor('idempotent'),
        password: await bcrypt.hash('password123', 10),
        isSSOAccount: false,
      },
    })

    const signedLtiData = await createSignedLtiData({
      sub: ssoIdFor('idempotent'),
      email: emailFor('idempotent'),
    })

    const first = await loginParticipantWithLti({ signedLtiData }, createCtx())
    const second = await loginParticipantWithLti({ signedLtiData }, createCtx())

    expect(first?.participant?.id).toBe(participant.id)
    expect(second?.participant?.id).toBe(participant.id)

    const accounts = await prisma.participantAccount.findMany({
      where: { ssoId: ssoIdFor('idempotent') },
    })
    expect(accounts).toHaveLength(1)
  })

  it('rejects retired LTI 1.1 launches even when the ssoId matches an existing account', async () => {
    const participant = await prisma.participant.create({
      data: {
        email: emailFor('lti11-ssoid'),
        username: usernameFor('lti11-ssoid'),
        password: await bcrypt.hash('password123', 10),
        isSSOAccount: false,
        accounts: {
          create: {
            ssoId: ssoIdFor('lti11-ssoid'),
            ssoType: 'LTI1.1',
            ssoEmail: emailFor('lti11-ssoid'),
          },
        },
      },
    })

    const signedLtiData = await createSignedLtiData({
      sub: ssoIdFor('lti11-ssoid'),
      email: emailFor('lti11-ssoid'),
      scope: 'LTI1.1',
    })

    const result = await loginParticipantWithLti({ signedLtiData }, createCtx())

    expect(result).toBeNull()

    // the pre-existing LTI 1.1 link must survive untouched -- retirement blocks
    // the login, it does not rewrite historical account rows
    const accounts = await prisma.participantAccount.findMany({
      where: { participantId: participant.id },
    })
    expect(accounts).toHaveLength(1)
    expect(accounts[0]?.ssoType).toBe('LTI1.1')
  })

  it('rejects retired LTI 1.1 launches that would match an existing participant by email', async () => {
    await prisma.participant.create({
      data: {
        email: emailFor('lti11-email'),
        username: usernameFor('lti11-email'),
        password: await bcrypt.hash('password123', 10),
        isSSOAccount: false,
      },
    })

    const signedLtiData = await createSignedLtiData({
      sub: ssoIdFor('lti11-email-attacker'),
      email: emailFor('lti11-email'),
      scope: 'LTI1.1',
    })

    const result = await loginParticipantWithLti({ signedLtiData }, createCtx())

    expect(result).toBeNull()

    const accounts = await prisma.participantAccount.findMany({
      where: { ssoId: ssoIdFor('lti11-email-attacker') },
    })
    expect(accounts).toHaveLength(0)
  })

  it('returns null for LTI login when no existing participant can be matched and auto-create is disabled', async () => {
    const signedLtiData = await createSignedLtiData({
      sub: ssoIdFor('no-match'),
      email: emailFor('no-match'),
    })

    const ctx = createCtx()
    const result = await loginParticipantWithLti({ signedLtiData }, ctx)

    expect(result).toBeNull()
    expect(ctx.res.cookie).not.toHaveBeenCalled()
  })

  it('creates a new SSO participant from LTI create flow when no match exists', async () => {
    const signedLtiData = await createSignedLtiData({
      sub: ssoIdFor('create-new'),
      email: emailFor('create-new'),
    })

    const result = await createParticipantAccount(
      {
        email: emailFor('unused'),
        username: usernameFor('create-new'),
        password: 'password123',
        isProfilePublic: true,
        signedLtiData,
      },
      createCtx()
    )

    expect(result?.participantToken).toBeDefined()
    expect(result?.participant?.email).toBe(emailFor('create-new'))
    expect(result?.participant?.isSSOAccount).toBe(true)

    const account = await prisma.participantAccount.findUnique({
      where: { ssoId: ssoIdFor('create-new') },
      include: { participant: true },
    })
    expect(account?.participant.email).toBe(emailFor('create-new'))
  })

  it('fails closed on ambiguous duplicate normalized email matches across auth modes', async () => {
    await prisma.participant.create({
      data: {
        email: emailFor('ambiguous'),
        username: usernameFor('ambiguous-manual'),
        password: await bcrypt.hash('password123', 10),
        isSSOAccount: false,
      },
    })
    await prisma.participant.create({
      data: {
        email: emailFor('ambiguous'),
        username: usernameFor('ambiguous-sso'),
        password: await bcrypt.hash('password123', 10),
        isSSOAccount: true,
      },
    })

    const signedLtiData = await createSignedLtiData({
      sub: ssoIdFor('ambiguous'),
      email: emailFor('ambiguous'),
    })

    const result = await loginParticipantWithLti({ signedLtiData }, createCtx())

    expect(result).toBeNull()

    const account = await prisma.participantAccount.findUnique({
      where: { ssoId: ssoIdFor('ambiguous') },
    })
    expect(account).toBeNull()
  })

  it('creates participation when courseId is provided during LTI login', async () => {
    const { course } = await createTestCourse()

    const participant = await prisma.participant.create({
      data: {
        email: emailFor('participation'),
        username: usernameFor('participation'),
        password: await bcrypt.hash('password123', 10),
        isSSOAccount: false,
      },
    })

    const signedLtiData = await createSignedLtiData({
      sub: ssoIdFor('participation'),
      email: emailFor('participation'),
    })

    const result = await loginParticipantWithLti(
      { signedLtiData, courseId: course.id },
      createCtx()
    )

    expect(result?.participant?.id).toBe(participant.id)

    const participation = await prisma.participation.findUnique({
      where: {
        courseId_participantId: {
          courseId: course.id,
          participantId: participant.id,
        },
      },
    })
    expect(participation).not.toBeNull()
  })

  it('reuses existing ParticipantAccount when same ssoType but different ssoId matches by email', async () => {
    const participant = await prisma.participant.create({
      data: {
        email: emailFor('reuse-sso'),
        username: usernameFor('reuse-sso'),
        password: await bcrypt.hash('password123', 10),
        isSSOAccount: false,
      },
    })

    const firstAccount = await prisma.participantAccount.create({
      data: {
        ssoId: ssoIdFor('reuse-sso-old'),
        ssoType: 'LTI1.3',
        ssoEmail: emailFor('reuse-sso'),
        participant: { connect: { id: participant.id } },
      },
    })

    const signedLtiData = await createSignedLtiData({
      sub: ssoIdFor('reuse-sso-new'),
      email: emailFor('reuse-sso'),
      scope: 'LTI1.3',
    })

    const result = await loginParticipantWithLti({ signedLtiData }, createCtx())

    expect(result?.participant?.id).toBe(participant.id)

    const updatedAccount = await prisma.participantAccount.findUnique({
      where: { id: firstAccount.id },
    })
    expect(updatedAccount?.ssoId).toBe(ssoIdFor('reuse-sso-new'))

    const allAccounts = await prisma.participantAccount.findMany({
      where: { participantId: participant.id, ssoType: 'LTI1.3' },
    })
    expect(allAccounts).toHaveLength(1)
  })

  it('rejects non-LTI account creation when email already exists in another auth mode', async () => {
    await prisma.participant.create({
      data: {
        email: emailFor('cross-mode'),
        username: usernameFor('cross-mode-existing'),
        password: await bcrypt.hash('password123', 10),
        isSSOAccount: true,
      },
    })

    const result = await createParticipantAccount(
      {
        email: emailFor('cross-mode').toUpperCase(),
        username: usernameFor('cross-mode-new'),
        password: 'password123',
        isProfilePublic: true,
      },
      createCtx()
    )

    expect(result).toBeNull()

    const created = await prisma.participant.findUnique({
      where: { username: usernameFor('cross-mode-new') },
    })
    expect(created).toBeNull()
  })
  it.each([
    'issuer',
    'scope',
    'expired',
    'unbound',
    'assessment',
    'deleted',
    'unpublished',
  ])('denies an invalid chatbot launch (%s) without creating participation', async (reason) => {
    vi.stubEnv('APP_ORIGIN_LTI', 'https://lti.klicker.test')
    const { user, course } = await createTestCourse()
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Synthetic tutor',
        ownerId: user.id,
        courseId: course.id,
        status: 'PUBLISHED',
      },
    })
    if (reason === 'assessment')
      await prisma.course.update({
        where: { id: course.id },
        data: {
          isAssessmentEnabled: true,
          authType: CourseAuthType.SSO,
          pinCode: null,
        },
      })
    if (reason === 'deleted')
      await prisma.course.update({
        where: { id: course.id },
        data: { deletionRequestedAt: new Date() },
      })
    if (reason === 'unpublished')
      await prisma.chatbot.update({
        where: { id: chatbot.id },
        data: { status: 'DRAFT' },
      })
    const signedLtiData = await signJWT(
      {
        sub: ssoIdFor('denied'),
        scope: reason === 'scope' ? 'LTI1.1' : 'LTI1.3',
        ...(reason === 'unbound'
          ? {}
          : { chatbotLaunch: { courseId: course.id, chatbotId: chatbot.id } }),
      },
      process.env.APP_SECRET!,
      {
        issuer:
          reason === 'issuer'
            ? 'https://wrong.klicker.test'
            : process.env.APP_ORIGIN_LTI,
        expiresIn: reason === 'expired' ? '-1h' : '5m',
      }
    )
    expect(
      await loginParticipantForLtiChatbot(
        { signedLtiData, courseId: course.id, chatbotId: chatbot.id },
        createCtx()
      )
    ).toEqual({ status: 'DENIED' })
    expect(
      await prisma.participation.count({ where: { courseId: course.id } })
    ).toBe(0)
  })

  it('reuses the current account without relinking and preserves leaderboard opt-in', async () => {
    vi.stubEnv('APP_ORIGIN_LTI', 'https://lti.klicker.test')
    const { user, course } = await createTestCourse()
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Synthetic tutor',
        ownerId: user.id,
        courseId: course.id,
        status: 'PUBLISHED',
      },
    })
    const participant = await prisma.participant.create({
      data: { username: usernameFor('current'), password: 'unused-test-hash' },
    })
    const signedLtiData = await signJWT(
      {
        sub: ssoIdFor('unlinked'),
        scope: 'LTI1.3',
        chatbotLaunch: { courseId: course.id, chatbotId: chatbot.id },
      },
      process.env.APP_SECRET!,
      { expiresIn: '5m', issuer: process.env.APP_ORIGIN_LTI }
    )
    const args = {
      signedLtiData,
      courseId: course.id,
      chatbotId: chatbot.id,
      participantToken: await createParticipantToken(participant.id),
    }
    expect(
      await loginParticipantForLtiChatbot(args, createCtx())
    ).toMatchObject({ status: 'ACCOUNT', participantId: participant.id })
    const where = {
      courseId_participantId: {
        courseId: course.id,
        participantId: participant.id,
      },
    }
    expect(await prisma.participation.findUnique({ where })).toMatchObject({
      isActive: false,
    })
    expect(
      await prisma.participantAccount.count({
        where: { participantId: participant.id },
      })
    ).toBe(0)
    await prisma.participation.update({ where, data: { isActive: true } })
    await loginParticipantForLtiChatbot(args, createCtx())
    expect(await prisma.participation.findUnique({ where })).toMatchObject({
      isActive: true,
    })
    await prisma.chatbot.delete({ where: { id: chatbot.id } })
  })

  it('logs in a linked account without a cookie and returns guest only for no match', async () => {
    vi.stubEnv('APP_ORIGIN_LTI', 'https://lti.klicker.test')
    const { user, course } = await createTestCourse()
    const chatbot = await prisma.chatbot.create({
      data: {
        name: 'Synthetic tutor',
        ownerId: user.id,
        courseId: course.id,
        status: 'PUBLISHED',
      },
    })
    const participant = await prisma.participant.create({
      data: {
        username: usernameFor('linked-chat'),
        password: 'unused-test-hash',
        accounts: {
          create: { ssoId: ssoIdFor('linked-chat'), ssoType: 'LTI1.3' },
        },
      },
    })
    const launch = (sub: string, target = chatbot.id) =>
      signJWT(
        {
          sub,
          scope: 'LTI1.3',
          chatbotLaunch: { courseId: course.id, chatbotId: target },
        },
        process.env.APP_SECRET!,
        { expiresIn: '5m', issuer: process.env.APP_ORIGIN_LTI }
      )
    const args = { courseId: course.id, chatbotId: chatbot.id }
    expect(
      await loginParticipantForLtiChatbot(
        { ...args, signedLtiData: await launch(ssoIdFor('linked-chat')) },
        createCtx()
      )
    ).toMatchObject({ status: 'ACCOUNT', participantId: participant.id })
    expect(
      await loginParticipantForLtiChatbot(
        { ...args, signedLtiData: await launch(ssoIdFor('unknown')) },
        createCtx()
      )
    ).toEqual({ status: 'GUEST' })
    expect(
      await loginParticipantForLtiChatbot(
        {
          ...args,
          signedLtiData: await launch(ssoIdFor('unknown'), course.id),
        },
        createCtx()
      )
    ).toEqual({ status: 'DENIED' })
    await prisma.chatbot.delete({ where: { id: chatbot.id } })
  })
})
