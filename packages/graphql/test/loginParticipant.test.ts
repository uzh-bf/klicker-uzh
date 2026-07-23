import { prisma as prismaClient } from '@klicker-uzh/prisma'
import { PrismaClient } from '@klicker-uzh/prisma/client'
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
import { loginParticipant } from '../src/services/accounts.js'

const TEST_PREFIX = `codex-login-${Date.now()}`
const emailFor = (label: string) => `${TEST_PREFIX}-${label}@example.com`
const usernameFor = (label: string) => `${TEST_PREFIX}-${label}`.slice(0, 48)

const MANUAL_PASSWORD = 'manual-password-123'
const LTI_USER_SET_PASSWORD = 'lti-user-set-password'
const EDUID_RANDOM_PASSWORD = 'eduid-random-unknown-to-user'

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
        { email: { startsWith: TEST_PREFIX } },
      ],
    },
    select: { id: true },
  })

  const participantIds = participants.map((p) => p.id)

  if (participantIds.length === 0) return

  await prisma.participantAccount.deleteMany({
    where: { participantId: { in: participantIds } },
  })
  await prisma.participation.deleteMany({
    where: { participantId: { in: participantIds } },
  })
  await prisma.participant.deleteMany({
    where: { id: { in: participantIds } },
  })
}

describe('loginParticipant email/username login', () => {
  beforeAll(async () => {
    process.env.APP_SECRET = process.env.APP_SECRET ?? 'test-app-secret'
    process.env.APP_ORIGIN_API =
      process.env.APP_ORIGIN_API ?? 'https://api.klicker.test'

    prisma = prismaClient
    await prisma.$connect()
    await cleanupTestData()
  }, 60000)

  afterEach(async () => {
    await cleanupTestData()
  })

  afterAll(async () => {
    await cleanupTestData()
    await prisma.$disconnect()
  }, 60000)

  it('logs in a manual participant by username with a correct password', async () => {
    const participant = await prisma.participant.create({
      data: {
        email: emailFor('manual-username'),
        username: usernameFor('manual-username'),
        password: await bcrypt.hash(MANUAL_PASSWORD, 10),
        isSSOAccount: false,
      },
    })

    const result = await loginParticipant(
      {
        usernameOrEmail: usernameFor('manual-username'),
        password: MANUAL_PASSWORD,
      },
      createCtx()
    )

    expect(result).toBe(participant.id)
  })

  it('logs in a manual participant by email with a correct password', async () => {
    const participant = await prisma.participant.create({
      data: {
        email: emailFor('manual-email'),
        username: usernameFor('manual-email'),
        password: await bcrypt.hash(MANUAL_PASSWORD, 10),
        isSSOAccount: false,
      },
    })

    const result = await loginParticipant(
      {
        usernameOrEmail: emailFor('manual-email').toUpperCase(),
        password: MANUAL_PASSWORD,
      },
      createCtx()
    )

    expect(result).toBe(participant.id)
  })

  it('rejects login when the password does not match', async () => {
    await prisma.participant.create({
      data: {
        email: emailFor('wrong-password'),
        username: usernameFor('wrong-password'),
        password: await bcrypt.hash(MANUAL_PASSWORD, 10),
        isSSOAccount: false,
      },
    })

    const result = await loginParticipant(
      {
        usernameOrEmail: usernameFor('wrong-password'),
        password: 'totally-different',
      },
      createCtx()
    )

    expect(result).toBeNull()
  })

  it('returns null when no participant exists for the supplied identifier', async () => {
    const result = await loginParticipant(
      {
        usernameOrEmail: emailFor('does-not-exist'),
        password: MANUAL_PASSWORD,
      },
      createCtx()
    )

    expect(result).toBeNull()
  })

  it('logs in an LTI-created participant by email with the password they chose at signup', async () => {
    const lti = await prisma.participant.create({
      data: {
        email: emailFor('lti-only'),
        username: usernameFor('lti-only'),
        password: await bcrypt.hash(LTI_USER_SET_PASSWORD, 10),
        isSSOAccount: true,
      },
    })

    const result = await loginParticipant(
      {
        usernameOrEmail: emailFor('lti-only'),
        password: LTI_USER_SET_PASSWORD,
      },
      createCtx()
    )

    expect(result).toBe(lti.id)
  })

  it('logs in the manual row when both manual and SSO participants share the same email', async () => {
    const manual = await prisma.participant.create({
      data: {
        email: emailFor('dual'),
        username: usernameFor('dual-manual'),
        password: await bcrypt.hash(MANUAL_PASSWORD, 10),
        isSSOAccount: false,
      },
    })
    await prisma.participant.create({
      data: {
        email: emailFor('dual'),
        username: usernameFor('dual-sso'),
        password: await bcrypt.hash(EDUID_RANDOM_PASSWORD, 10),
        isSSOAccount: true,
      },
    })

    const result = await loginParticipant(
      {
        usernameOrEmail: emailFor('dual'),
        password: MANUAL_PASSWORD,
      },
      createCtx()
    )

    expect(result).toBe(manual.id)
  })

  it('logs in the SSO row when the LTI signup password matches and a manual row also exists', async () => {
    await prisma.participant.create({
      data: {
        email: emailFor('dual-lti'),
        username: usernameFor('dual-lti-manual'),
        password: await bcrypt.hash(MANUAL_PASSWORD, 10),
        isSSOAccount: false,
      },
    })
    const lti = await prisma.participant.create({
      data: {
        email: emailFor('dual-lti'),
        username: usernameFor('dual-lti-sso'),
        password: await bcrypt.hash(LTI_USER_SET_PASSWORD, 10),
        isSSOAccount: true,
      },
    })

    const result = await loginParticipant(
      {
        usernameOrEmail: emailFor('dual-lti'),
        password: LTI_USER_SET_PASSWORD,
      },
      createCtx()
    )

    expect(result).toBe(lti.id)
  })

  it('rejects email login for an Edu-ID-style SSO row whose hashed password is unguessable', async () => {
    await prisma.participant.create({
      data: {
        email: emailFor('eduid-only'),
        username: usernameFor('eduid-only'),
        password: await bcrypt.hash(EDUID_RANDOM_PASSWORD, 10),
        isSSOAccount: true,
      },
    })

    const result = await loginParticipant(
      {
        usernameOrEmail: emailFor('eduid-only'),
        password: 'guessed-password',
      },
      createCtx()
    )

    expect(result).toBeNull()
  })

  it('prefers a username match over an email match when both could resolve to different rows', async () => {
    // A: matches by username
    // B: matches by email (B.email === A.username after lowercasing)
    const sharedToken = `${TEST_PREFIX}-collide@example.com`

    const usernameMatch = await prisma.participant.create({
      data: {
        email: emailFor('collide-username'),
        username: sharedToken,
        password: await bcrypt.hash(MANUAL_PASSWORD, 10),
        isSSOAccount: false,
      },
    })
    await prisma.participant.create({
      data: {
        email: sharedToken.toLowerCase(),
        username: usernameFor('collide-email'),
        password: await bcrypt.hash('other-password', 10),
        isSSOAccount: false,
      },
    })

    const result = await loginParticipant(
      {
        usernameOrEmail: sharedToken,
        password: MANUAL_PASSWORD,
      },
      createCtx()
    )

    expect(result).toBe(usernameMatch.id)
  })
})
