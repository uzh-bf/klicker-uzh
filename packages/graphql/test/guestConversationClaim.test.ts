import { prisma as prismaClient } from '@klicker-uzh/prisma'
import { PrismaClient } from '@klicker-uzh/prisma/client'
import { deriveGuestSsoId, signJWT } from '@klicker-uzh/util'
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
import { claimGuestChatThreads } from '../src/services/guestThreadClaim.js'
import {
  createParticipantToken,
  loginParticipantForElearningChatbot,
  loginParticipantForLtiChatbot,
} from '../src/services/accounts.js'

// Wrap the real claim so one test can force a transfer failure without
// touching the identity resolution that must keep working.
vi.mock('../src/services/guestThreadClaim.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../src/services/guestThreadClaim.js')>()
  return {
    ...actual,
    claimGuestChatThreads: vi.fn(actual.claimGuestChatThreads),
  }
})

// The claim moves a course-scoped guest persona's threads onto the real
// account that the verified launch subject resolves to. These tests use a
// real prisma client against the disposable test database and exercise the
// wiring through the same launch entrypoints the routes use.
const TEST_PREFIX = `codex-claim-${Date.now()}`
const usernameFor = (label: string) => `${TEST_PREFIX}-${label}`.slice(0, 48)
const ssoIdFor = (label: string) => `${TEST_PREFIX}-${label}`
// User.shortname (unique, 10 chars) and Course.pinCode (unique) need distinct
// values per synthetic course. Owners are cleaned up by their TEST_PREFIX email,
// so the shortname and pin only need to be unique within and across runs.
const RUN_TAG = `ck${Math.random().toString(36).slice(2, 7)}`
const PIN_BASE = 100000 + (parseInt(RUN_TAG.slice(2), 36) % 800000)
let courseSeq = 0
const nextShortname = () => `${RUN_TAG}${courseSeq++}`.slice(0, 10)

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

async function cleanupTestData() {
  const participants = await prisma.participant.findMany({
    where: {
      OR: [
        { username: { startsWith: TEST_PREFIX } },
        { accounts: { some: { ssoId: { startsWith: TEST_PREFIX } } } },
      ],
    },
    select: { id: true },
  })
  const participantIds = participants.map((participant) => participant.id)

  if (participantIds.length > 0) {
    await prisma.chatThread.deleteMany({
      where: { participantId: { in: participantIds } },
    })
    await prisma.participation.deleteMany({
      where: { participantId: { in: participantIds } },
    })
    await prisma.participantAccount.deleteMany({
      where: {
        OR: [
          { participantId: { in: participantIds } },
          { ssoId: { startsWith: TEST_PREFIX } },
        ],
      },
    })
    await prisma.participant.deleteMany({
      where: { id: { in: participantIds } },
    })
  }

  await prisma.chatbot.deleteMany({
    where: { course: { name: { startsWith: TEST_PREFIX } } },
  })
  await prisma.course.deleteMany({
    where: { name: { startsWith: TEST_PREFIX } },
  })
  await prisma.user.deleteMany({
    where: { email: { startsWith: TEST_PREFIX } },
  })
}

async function createTestCourse(label: string) {
  const user = await prisma.user.create({
    data: {
      email: `${TEST_PREFIX}-${label}-owner@example.com`,
      shortname: nextShortname(),
    },
  })
  const now = new Date()
  const seq = courseSeq++
  const course = await prisma.course.create({
    data: {
      name: `${TEST_PREFIX}-${label}`,
      displayName: 'Claim Course',
      pinCode: PIN_BASE + seq,
      startDate: now,
      endDate: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
      groupDeadlineDate: new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000),
      owner: { connect: { id: user.id } },
    },
  })
  return { user, course }
}

async function createChatbot(
  userId: string,
  courseId: string,
  status = 'PUBLISHED'
) {
  return prisma.chatbot.create({
    data: {
      name: 'Synthetic tutor',
      ownerId: userId,
      courseId,
      status: status as any,
    },
  })
}

// A guest persona row identical in shape to the one the chat app creates:
// inactive participation, an lti_guest account keyed by the derived ssoId.
async function createGuestPersona({
  ltiSub,
  courseId,
  label,
}: {
  ltiSub: string
  courseId: string
  label: string
}) {
  return prisma.participant.create({
    data: {
      username: usernameFor(`guest-${label}`),
      password: 'unused-test-hash',
      isSSOAccount: true,
      accounts: {
        create: {
          ssoId: deriveGuestSsoId(ltiSub, courseId),
          ssoType: 'LTI1.3',
          type: 'lti_guest',
        },
      },
      participations: { create: { isActive: false, courseId } },
    },
  })
}

async function createAccountForSubject({
  ltiSub,
  courseId,
  label,
}: {
  ltiSub: string
  courseId: string
  label: string
}) {
  return prisma.participant.create({
    data: {
      username: usernameFor(`acct-${label}`),
      password: 'unused-test-hash',
      isSSOAccount: true,
      accounts: { create: { ssoId: ltiSub, ssoType: 'LTI1.3' } },
      participations: { create: { isActive: false, courseId } },
    },
  })
}

function launchFor(sub: string, courseId: string, chatbotId: string) {
  return signJWT(
    { sub, scope: 'LTI1.3', chatbotLaunch: { courseId, chatbotId } },
    process.env.APP_SECRET!,
    { expiresIn: '5m', issuer: process.env.APP_ORIGIN_LTI }
  )
}

describe('guest chat conversation claim', () => {
  beforeAll(async () => {
    process.env.APP_SECRET = process.env.APP_SECRET ?? 'test-app-secret'
    process.env.APP_ORIGIN_API =
      process.env.APP_ORIGIN_API ?? 'https://api.klicker.test'
    process.env.APP_ORIGIN_LTI =
      process.env.APP_ORIGIN_LTI ?? 'https://lti.klicker.test'
    process.env.CHAT_GUEST_SEED =
      process.env.CHAT_GUEST_SEED ?? 'test-chat-guest-seed'

    prisma = prismaClient
    await prisma.$connect()
    await cleanupTestData()
  }, 60000)

  afterEach(async () => {
    vi.mocked(claimGuestChatThreads).mockClear()
    await cleanupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  }, 60000)

  it('moves a guest persona threads onto the account on a verified launch', async () => {
    const { user, course } = await createTestCourse('basic')
    const chatbot = await createChatbot(user.id, course.id)
    const sub = ssoIdFor('basic-sub')
    const persona = await createGuestPersona({
      ltiSub: sub,
      courseId: course.id,
      label: 'basic',
    })
    const thread = await prisma.chatThread.create({
      data: {
        participantId: persona.id,
        chatbotId: chatbot.id,
        title: 'Guest chat',
      },
    })
    const account = await createAccountForSubject({
      ltiSub: sub,
      courseId: course.id,
      label: 'basic',
    })

    const result = await loginParticipantForLtiChatbot(
      {
        signedLtiData: await launchFor(sub, course.id, chatbot.id),
        courseId: course.id,
        chatbotId: chatbot.id,
      },
      createCtx()
    )

    expect(result).toMatchObject({
      status: 'ACCOUNT',
      participantId: account.id,
    })
    const moved = await prisma.chatThread.findUnique({
      where: { id: thread.id },
    })
    expect(moved?.participantId).toBe(account.id)
    // the persona itself is intentionally retained
    expect(
      await prisma.participant.findUnique({ where: { id: persona.id } })
    ).not.toBeNull()
  })

  it('does not move threads when a valid cookie session for a different account wins', async () => {
    const { user, course } = await createTestCourse('cookie')
    const chatbot = await createChatbot(user.id, course.id)
    const sub = ssoIdFor('cookie-sub')
    const persona = await createGuestPersona({
      ltiSub: sub,
      courseId: course.id,
      label: 'cookie',
    })
    const thread = await prisma.chatThread.create({
      data: { participantId: persona.id, chatbotId: chatbot.id },
    })
    // subject-resolving account exists, but a different valid session is used
    await createAccountForSubject({
      ltiSub: sub,
      courseId: course.id,
      label: 'cookie',
    })
    const other = await prisma.participant.create({
      data: {
        username: usernameFor('cookie-other'),
        password: 'unused-test-hash',
      },
    })

    const result = await loginParticipantForLtiChatbot(
      {
        signedLtiData: await launchFor(sub, course.id, chatbot.id),
        courseId: course.id,
        chatbotId: chatbot.id,
        participantToken: await createParticipantToken(other.id),
      },
      createCtx()
    )

    expect(result).toMatchObject({ status: 'ACCOUNT', participantId: other.id })
    const untouched = await prisma.chatThread.findUnique({
      where: { id: thread.id },
    })
    expect(untouched?.participantId).toBe(persona.id)
  })

  it('claims across all the account participations, per derived persona', async () => {
    const a = await createTestCourse('cross-a')
    const b = await createTestCourse('cross-b')
    const chatbotA = await createChatbot(a.user.id, a.course.id)
    const sub = ssoIdFor('cross-sub')
    const personaA = await createGuestPersona({
      ltiSub: sub,
      courseId: a.course.id,
      label: 'cross-a',
    })
    const personaB = await createGuestPersona({
      ltiSub: sub,
      courseId: b.course.id,
      label: 'cross-b',
    })
    const threadA = await prisma.chatThread.create({
      data: { participantId: personaA.id, chatbotId: chatbotA.id },
    })
    const chatbotB = await createChatbot(b.user.id, b.course.id)
    const threadB = await prisma.chatThread.create({
      data: { participantId: personaB.id, chatbotId: chatbotB.id },
    })
    // a different subject's persona in the same course must stay untouched
    const otherPersona = await createGuestPersona({
      ltiSub: ssoIdFor('other-sub'),
      courseId: a.course.id,
      label: 'cross-other',
    })
    const otherThread = await prisma.chatThread.create({
      data: { participantId: otherPersona.id, chatbotId: chatbotA.id },
    })

    const account = await createAccountForSubject({
      ltiSub: sub,
      courseId: a.course.id,
      label: 'cross',
    })
    await prisma.participation.create({
      data: {
        participantId: account.id,
        courseId: b.course.id,
        isActive: false,
      },
    })

    await loginParticipantForLtiChatbot(
      {
        signedLtiData: await launchFor(sub, a.course.id, chatbotA.id),
        courseId: a.course.id,
        chatbotId: chatbotA.id,
      },
      createCtx()
    )

    expect(
      (await prisma.chatThread.findUnique({ where: { id: threadA.id } }))
        ?.participantId
    ).toBe(account.id)
    expect(
      (await prisma.chatThread.findUnique({ where: { id: threadB.id } }))
        ?.participantId
    ).toBe(account.id)
    expect(
      (await prisma.chatThread.findUnique({ where: { id: otherThread.id } }))
        ?.participantId
    ).toBe(otherPersona.id)
  })

  it('claims threads of a paused chatbot as well', async () => {
    const { user, course } = await createTestCourse('paused')
    const chatbot = await createChatbot(user.id, course.id, 'PUBLISHED')
    const pausedBot = await createChatbot(user.id, course.id, 'PAUSED')
    const sub = ssoIdFor('paused-sub')
    const persona = await createGuestPersona({
      ltiSub: sub,
      courseId: course.id,
      label: 'paused',
    })
    const thread = await prisma.chatThread.create({
      data: { participantId: persona.id, chatbotId: pausedBot.id },
    })
    const account = await createAccountForSubject({
      ltiSub: sub,
      courseId: course.id,
      label: 'paused',
    })

    await loginParticipantForLtiChatbot(
      {
        signedLtiData: await launchFor(sub, course.id, chatbot.id),
        courseId: course.id,
        chatbotId: chatbot.id,
      },
      createCtx()
    )

    expect(
      (await prisma.chatThread.findUnique({ where: { id: thread.id } }))
        ?.participantId
    ).toBe(account.id)
  })

  it('is idempotent on repeated launches', async () => {
    const { user, course } = await createTestCourse('idempotent')
    const chatbot = await createChatbot(user.id, course.id)
    const sub = ssoIdFor('idem-sub')
    const persona = await createGuestPersona({
      ltiSub: sub,
      courseId: course.id,
      label: 'idem',
    })
    const thread = await prisma.chatThread.create({
      data: { participantId: persona.id, chatbotId: chatbot.id },
    })
    const account = await createAccountForSubject({
      ltiSub: sub,
      courseId: course.id,
      label: 'idem',
    })
    const args = {
      signedLtiData: await launchFor(sub, course.id, chatbot.id),
      courseId: course.id,
      chatbotId: chatbot.id,
    }

    await loginParticipantForLtiChatbot(args, createCtx())
    await loginParticipantForLtiChatbot(args, createCtx())

    const threads = await prisma.chatThread.findMany({
      where: { id: thread.id },
    })
    expect(threads).toHaveLength(1)
    expect(threads[0]?.participantId).toBe(account.id)
  })

  it('keeps existing account history alongside claimed threads', async () => {
    const { user, course } = await createTestCourse('coexist')
    const chatbot = await createChatbot(user.id, course.id)
    const sub = ssoIdFor('coexist-sub')
    const persona = await createGuestPersona({
      ltiSub: sub,
      courseId: course.id,
      label: 'coexist',
    })
    const guestThread = await prisma.chatThread.create({
      data: {
        participantId: persona.id,
        chatbotId: chatbot.id,
        title: 'Guest',
      },
    })
    const account = await createAccountForSubject({
      ltiSub: sub,
      courseId: course.id,
      label: 'coexist',
    })
    const accountThread = await prisma.chatThread.create({
      data: {
        participantId: account.id,
        chatbotId: chatbot.id,
        title: 'Account',
      },
    })

    await loginParticipantForLtiChatbot(
      {
        signedLtiData: await launchFor(sub, course.id, chatbot.id),
        courseId: course.id,
        chatbotId: chatbot.id,
      },
      createCtx()
    )

    const owned = await prisma.chatThread.findMany({
      where: { participantId: account.id },
    })
    expect(owned.map((t) => t.id).sort()).toEqual(
      [guestThread.id, accountThread.id].sort()
    )
  })

  it('still returns ACCOUNT and issues a token when the claim throws', async () => {
    const { user, course } = await createTestCourse('failure')
    const chatbot = await createChatbot(user.id, course.id)
    const sub = ssoIdFor('failure-sub')
    const persona = await createGuestPersona({
      ltiSub: sub,
      courseId: course.id,
      label: 'failure',
    })
    const thread = await prisma.chatThread.create({
      data: { participantId: persona.id, chatbotId: chatbot.id },
    })
    const account = await createAccountForSubject({
      ltiSub: sub,
      courseId: course.id,
      label: 'failure',
    })

    vi.mocked(claimGuestChatThreads).mockRejectedValueOnce(
      new Error('synthetic claim failure')
    )

    const result = await loginParticipantForLtiChatbot(
      {
        signedLtiData: await launchFor(sub, course.id, chatbot.id),
        courseId: course.id,
        chatbotId: chatbot.id,
      },
      createCtx()
    )

    expect(result).toMatchObject({
      status: 'ACCOUNT',
      participantId: account.id,
    })
    expect((result as any).participantToken).toBeDefined()
    // failure means nothing moved; the next launch retries naturally
    expect(
      (await prisma.chatThread.findUnique({ where: { id: thread.id } }))
        ?.participantId
    ).toBe(persona.id)
  })

  it('claims the persona derived from the verified subject on the eLearning path', async () => {
    vi.stubEnv('ELEARNING_CHAT_HANDOFF_SECRET', 'synthetic-handoff-secret')
    const { user, course } = await createTestCourse('elearning')
    const chatbot = await createChatbot(user.id, course.id)
    const learnerId = ssoIdFor('elearning-learner')
    const persona = await createGuestPersona({
      ltiSub: learnerId,
      courseId: course.id,
      label: 'elearning',
    })
    const thread = await prisma.chatThread.create({
      data: { participantId: persona.id, chatbotId: chatbot.id },
    })
    const account = await createAccountForSubject({
      ltiSub: learnerId,
      courseId: course.id,
      label: 'elearning',
    })

    const grant = await signJWT(
      {
        sub: learnerId,
        scope: 'ELEARNING_CHAT',
        purpose: 'chat-handoff',
        chatbotId: chatbot.id,
        klickerCourseId: course.id,
        elearningCourseId: '42',
        aud: 'klicker-chat',
      },
      'synthetic-handoff-secret',
      { expiresIn: '2m', issuer: 'elearning' }
    )

    const result = await loginParticipantForElearningChatbot(
      { grant, courseId: course.id, chatbotId: chatbot.id },
      createCtx()
    )

    expect(result).toMatchObject({
      status: 'ACCOUNT',
      participantId: account.id,
    })
    expect(
      (await prisma.chatThread.findUnique({ where: { id: thread.id } }))
        ?.participantId
    ).toBe(account.id)
  })

  it('leaves guest threads alone when the subject has no account yet (GUEST path)', async () => {
    const { user, course } = await createTestCourse('guest-path')
    const chatbot = await createChatbot(user.id, course.id)
    const sub = ssoIdFor('guest-path-sub')
    const persona = await createGuestPersona({
      ltiSub: sub,
      courseId: course.id,
      label: 'guest-path',
    })
    const thread = await prisma.chatThread.create({
      data: { participantId: persona.id, chatbotId: chatbot.id },
    })

    const result = await loginParticipantForLtiChatbot(
      {
        signedLtiData: await launchFor(sub, course.id, chatbot.id),
        courseId: course.id,
        chatbotId: chatbot.id,
      },
      createCtx()
    )

    expect(result).toEqual({ status: 'GUEST' })
    expect(
      (await prisma.chatThread.findUnique({ where: { id: thread.id } }))
        ?.participantId
    ).toBe(persona.id)
  })
})
